// api/callback.js

import crypto from 'crypto';

const CORP_ID = 98800626;
const PI_LINK_CLEAR = 'pi_link=; HttpOnly; Secure; SameSite=Lax; Max-Age=0; Path=/';

export default async function handler(req, res) {
  const { code, state } = req.query;

  if (!state || state.length < 5) {
    return res.status(400).send('Missing state parameter.');
  }
  if (!code) {
    return res.status(400).send('Missing authorization code.');
  }

  const cookies = parseCookies(req.headers.cookie || '');
  if (!cookies.eve_state || cookies.eve_state !== state) {
    return res.redirect(302, '/?auth=denied');
  }

  const clientId     = process.env.EVE_CLIENT_ID;
  const clientSecret = process.env.EVE_CLIENT_SECRET;
  const callbackUrl  = process.env.EVE_CALLBACK_URL;
  const ceoId        = process.env.CEO_CHARACTER_ID;
  const whitelist    = (process.env.WHITELIST_CHARACTER_IDS || '').split(',').map(s => s.trim());

  try {
    // 1. Scambia code → tokens
    const tokenRes = await fetch('https://login.eveonline.com/v2/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64'),
      },
      body: new URLSearchParams({
        grant_type:   'authorization_code',
        code,
        redirect_uri: callbackUrl,
      }),
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      console.error('Token exchange failed:', err);
      return res.status(500).send(`Token exchange failed: ${err}`);
    }

    const tokenData = await tokenRes.json();
    const accessToken  = tokenData.access_token;
    const refreshToken = tokenData.refresh_token;
    const expiresIn    = tokenData.expires_in || 1200;

    // 2. Decodifica JWT per ottenere character info (senza chiamate extra)
    const jwtPayload = JSON.parse(
      Buffer.from(accessToken.split('.')[1], 'base64').toString('utf8')
    );

    // ESI v2 JWT: sub = "CHARACTER:EVE:12345678"
    const characterId   = String(jwtPayload.sub).split(':').pop();
    const characterName = jwtPayload.name || 'Unknown';

    // 3. Controlla whitelist oppure membership corp attuale (via ESI, dato pubblico)
    const isWhitelisted = whitelist.includes(characterId);
    let isCorpMember = false;
    try {
      const charInfo = await fetch(`https://esi.evetech.net/latest/characters/${characterId}/?datasource=tranquility`)
        .then(r => r.json());
      isCorpMember = charInfo.corporation_id === CORP_ID;
    } catch (e) {
      console.warn('ESI corp membership check failed:', e.message);
    }

    // CEO rilevato automaticamente dal dato pubblico della corp (ceo_id). La env
    // CEO_CHARACTER_ID resta come override/fallback (admin non-CEO, o ESI down).
    let realCeoId = null;
    try {
      const corpInfo = await fetch(`https://esi.evetech.net/latest/corporations/${CORP_ID}/?datasource=tranquility`)
        .then(r => r.json());
      if (corpInfo.ceo_id) {
        realCeoId = String(corpInfo.ceo_id);
        // Salva il CEO corrente per il cron di map.js (fire-and-forget, non critico)
        import('./_kv.js').then(({ kvSet }) => kvSet('corp:ceo', { ceoId: realCeoId, at: Date.now() }))
          .catch(e => console.warn('corp:ceo save failed:', e.message));
      }
    } catch (e) {
      console.warn('ESI corp CEO lookup failed:', e.message);
    }

    const isAllowed = isWhitelisted || isCorpMember;
    const isCeo     = characterId === realCeoId || (ceoId != null && characterId === String(ceoId));

    if (!isAllowed) {
      // Not a member (yet) — treat this as an application instead of a hard denial.
      // Reuses the exact same OAuth consent/scopes already granted, so the CEO can
      // review the applicant's real character data before any in-game invite.
      saveCharacterToKV('applicant', characterId, characterName, accessToken, tokenData.refresh_token).catch(e =>
        console.warn('KV applicant save failed (non-critical):', e.message)
      );

      const applicantCookie = Buffer.from(JSON.stringify({ characterId, characterName })).toString('base64');
      const applicantCookies = [`eve_applicant=${applicantCookie}; HttpOnly; Secure; SameSite=Lax; Max-Age=600; Path=/`];
      if (cookies.pi_link) applicantCookies.push(PI_LINK_CLEAR); // no PI linking for applicants
      res.setHeader('Set-Cookie', applicantCookies);
      return res.redirect(302, '/apply.html?status=submitted&name=' + encodeURIComponent(characterName));
    }

    // 4. Sessione leggera — NO access_token nel cookie (troppo grande)
    // Salviamo solo l'essenziale, il refresh token ci basta per rigenerare
    const sessionData = JSON.stringify({
      characterId,
      characterName,
      accessToken,   // ~500 chars, ok
      refreshToken,
      isCeo,
      expires: Date.now() + (expiresIn * 1000),
    });

    const encoded = Buffer.from(sessionData).toString('base64');

    const setCookies = [];
    // Controlla dimensione cookie (max ~4000 bytes sicuri)
    if (encoded.length > 3800) {
      // Sessione troppo grande: salva senza accessToken (verrà refreshato da me.js)
      const slim = JSON.stringify({ characterId, characterName, refreshToken, isCeo, expires: 0 });
      const slimEncoded = Buffer.from(slim).toString('base64');
      setCookies.push(`eve_session=${slimEncoded}; HttpOnly; Secure; SameSite=Lax; Max-Age=3600; Path=/`);
    } else {
      setCookies.push(`eve_session=${encoded}; HttpOnly; Secure; SameSite=Lax; Max-Age=3600; Path=/`);
    }

    // Auto-save member data to KV for vetting (background, non-blocking)
    saveCharacterToKV('member', characterId, characterName, accessToken, tokenData.refresh_token).catch(e =>
      console.warn('KV save failed (non-critical):', e.message)
    );

    // PI character linking (see api/login.js): a signed pi_link cookie carries
    // the characterId that initiated "Add character" — merge the two PI groups.
    let redirectTo = '/dashboard.html';
    if (cookies.pi_link) {
      setCookies.push(PI_LINK_CLEAR);
      const link = verifyPiLink(cookies.pi_link);
      const backPage = link?.back === 'dashboard' ? '/dashboard.html' : '/pi.html';
      if (link && link.cid !== String(characterId)) {
        try {
          await mergePiGroups(link.cid, String(characterId));
          redirectTo = backPage + '?linked=' + encodeURIComponent(characterName);
        } catch (e) {
          console.warn('character link failed:', e.message);
          redirectTo = backPage + '?linked=error';
        }
      } else {
        redirectTo = backPage;
      }
    }

    res.setHeader('Set-Cookie', setCookies);
    return res.redirect(302, redirectTo);

  } catch (err) {
    console.error('Callback error:', err.message, err.stack);
    return res.status(500).send(`Auth error: ${err.message}`);
  }
}

// Validates the HMAC-signed pi_link cookie set by api/login.js; returns
// {cid, back} or null.
function verifyPiLink(raw) {
  try {
    const [payload, sig] = raw.split('.');
    if (!payload || !sig) return null;
    const expected = crypto.createHmac('sha256', process.env.EVE_CLIENT_SECRET).update(payload).digest('hex');
    const a = Buffer.from(sig, 'hex');
    const b = Buffer.from(expected, 'hex');
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!data.cid || !/^\d+$/.test(data.cid) || Date.now() > data.exp) return null;
    return { cid: data.cid, back: data.back === 'dashboard' ? 'dashboard' : 'pi' };
  } catch {
    return null;
  }
}

// Joins two characters' PI groups into one, mirroring the merged member list
// under every member's pi:group:{id} key (api/pi.js reads the caller's own key).
async function mergePiGroups(a, b) {
  const { kvGet, kvSet } = await import('./_kv.js');
  const [docA, docB] = await Promise.all([
    kvGet(`pi:group:${a}`).catch(() => null),
    kvGet(`pi:group:${b}`).catch(() => null),
  ]);
  const members = [...new Set([
    ...(Array.isArray(docA?.members) ? docA.members.map(String) : [a]),
    ...(Array.isArray(docB?.members) ? docB.members.map(String) : [b]),
    a, b,
  ])];
  if (members.length > 8) throw new Error(`merged group would have ${members.length} characters (max 8)`);
  const doc = { members, updatedAt: Date.now() };
  await Promise.all(members.map(id => kvSet(`pi:group:${id}`, doc)));
}

function parseCookies(cookieHeader) {
  const cookies = {};
  cookieHeader.split(';').forEach(part => {
    const [key, ...val] = part.trim().split('=');
    if (key) cookies[key.trim()] = decodeURIComponent(val.join('='));
  });
  return cookies;
}

// Shared by members (prefix 'member') and applicants (prefix 'applicant') — same OAuth
// scopes, same public/wallet/asset/skill/corp-history snapshot, different KV namespace so
// the two lists never mix.
async function saveCharacterToKV(prefix, characterId, characterName, accessToken, refreshToken) {
  try {
    const { kvSet, kvGet } = await import('./_kv.js');
    const charId = String(characterId);
    const existing = await kvGet(`${prefix}:${charId}:meta`).catch(() => null);

    await kvSet(`${prefix}:${charId}:token`, {
      characterId, characterName, refreshToken,
      registeredAt: existing?.registeredAt || Date.now(),
      lastSeen: Date.now(),
    });

    const headers = { 'Authorization': `Bearer ${accessToken}` };
    const data = {
      characterId, characterName,
      lastFetched: Date.now(),
      registeredAt: existing?.registeredAt || Date.now(),
      consentGiven: true,
    };
    if (prefix === 'applicant') {
      data.status = 'pending';
      data.message = existing?.message || null;
      data.messageSubmittedAt = existing?.messageSubmittedAt || null;
    }

    await Promise.allSettled([
      fetch(`https://esi.evetech.net/latest/characters/${characterId}/?datasource=tranquility`)
        .then(r => r.json()).then(d => { data.birthday = d.birthday; data.securityStatus = d.security_status; }),
      fetch(`https://esi.evetech.net/latest/characters/${characterId}/wallet/?datasource=tranquility`, { headers })
        .then(r => r.json()).then(d => { if (typeof d === 'number') data.walletBalance = d; }),
      fetch(`https://esi.evetech.net/latest/characters/${characterId}/assets/?datasource=tranquility&page=1`, { headers })
        .then(r => r.json()).then(d => { if (Array.isArray(d)) { data.assetCount = d.length; data.assetSample = d.slice(0,5); } }),
      fetch(`https://esi.evetech.net/latest/characters/${characterId}/skills/?datasource=tranquility`, { headers })
        .then(r => r.json()).then(d => { data.totalSP = d.total_sp; data.skillCount = d.skills?.length; }),
      fetch(`https://esi.evetech.net/latest/characters/${characterId}/corporationhistory/?datasource=tranquility`)
        .then(r => r.json()).then(d => { if (Array.isArray(d)) { data.corpHistoryCount = d.length; data.corpHistory = d.slice(0,10); } }),
    ]);

    await kvSet(`${prefix}:${charId}:meta`, data);
  } catch (e) {
    console.warn('saveCharacterToKV error:', e.message);
  }
}
