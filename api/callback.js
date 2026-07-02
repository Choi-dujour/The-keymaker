// api/callback.js

const CORP_ID = 98800626;

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

    const isAllowed = isWhitelisted || isCorpMember;
    const isCeo     = characterId === String(ceoId);

    if (!isAllowed) {
      return res.redirect(302, '/?auth=denied&name=' + encodeURIComponent(characterName));
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

    // Controlla dimensione cookie (max ~4000 bytes sicuri)
    if (encoded.length > 3800) {
      // Sessione troppo grande: salva senza accessToken (verrà refreshato da me.js)
      const slim = JSON.stringify({ characterId, characterName, refreshToken, isCeo, expires: 0 });
      const slimEncoded = Buffer.from(slim).toString('base64');
      res.setHeader('Set-Cookie', `eve_session=${slimEncoded}; HttpOnly; Secure; SameSite=Lax; Max-Age=3600; Path=/`);
    } else {
      res.setHeader('Set-Cookie', `eve_session=${encoded}; HttpOnly; Secure; SameSite=Lax; Max-Age=3600; Path=/`);
    }

    // Auto-save member data to KV for vetting (background, non-blocking)
    if (isAllowed) {
      saveMemberToKV(characterId, characterName, accessToken, tokenData.refresh_token).catch(e =>
        console.warn('KV save failed (non-critical):', e.message)
      );
    }

    return res.redirect(302, '/dashboard.html');

  } catch (err) {
    console.error('Callback error:', err.message, err.stack);
    return res.status(500).send(`Auth error: ${err.message}`);
  }
}

function parseCookies(cookieHeader) {
  const cookies = {};
  cookieHeader.split(';').forEach(part => {
    const [key, ...val] = part.trim().split('=');
    if (key) cookies[key.trim()] = decodeURIComponent(val.join('='));
  });
  return cookies;
}

async function saveMemberToKV(characterId, characterName, accessToken, refreshToken) {
  try {
    const { kvSet, kvGet } = await import('./_kv.js');
    const charId = String(characterId);
    const existing = await kvGet(`member:${charId}:meta`).catch(() => null);

    await kvSet(`member:${charId}:token`, {
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

    await kvSet(`member:${charId}:meta`, data);
  } catch (e) {
    console.warn('saveMemberToKV error:', e.message);
  }
}
