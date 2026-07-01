// api/member-refresh.js
// Refreshes ESI data for all registered members using their stored refresh tokens.
// Should be called periodically — e.g. via a cron job or manual trigger from CEO dashboard.
// Protected: only callable with CEO_CHARACTER_ID session or a shared CRON_SECRET header.

import { kvGet, kvSet, kvKeys } from './_kv.js';

export default async function handler(req, res) {
  // Auth: either CEO session cookie or CRON_SECRET header
  const cronSecret = req.headers['x-cron-secret'];
  const isCron = cronSecret && cronSecret === process.env.CRON_SECRET;

  if (!isCron) {
    const cookies = parseCookies(req.headers.cookie || '');
    const sessionCookie = cookies.eve_session;
    if (!sessionCookie) return res.status(401).json({ error: 'Unauthorized' });
    try {
      const session = JSON.parse(Buffer.from(sessionCookie, 'base64').toString('utf8'));
      if (!session.isCeo) return res.status(403).json({ error: 'CEO only' });
    } catch {
      return res.status(401).json({ error: 'Bad session' });
    }
  }

  // Find all member token keys
  const tokenKeys = await kvKeys('member:*:token').catch(() => []);
  if (!tokenKeys.length) return res.status(200).json({ ok: true, refreshed: 0 });

  const results = [];

  for (const tokenKey of tokenKeys) {
    const tokenData = await kvGet(tokenKey).catch(() => null);
    if (!tokenData?.refreshToken) continue;

    const charId = String(tokenData.characterId);
    try {
      // Refresh the access token
      const newToken = await refreshAccessToken(tokenData.refreshToken);
      if (!newToken) { results.push({ charId, status: 'refresh_failed' }); continue; }

      // Update stored token
      await kvSet(tokenKey, {
        ...tokenData,
        refreshToken: newToken.refresh_token || tokenData.refreshToken,
        lastSeen: Date.now(),
      });

      // Fetch fresh ESI data
      const freshData = await fetchMemberData(newToken.access_token, tokenData.characterId);

      // Update meta (no token)
      const existing = await kvGet(`member:${charId}:meta`).catch(() => ({}));
      await kvSet(`member:${charId}:meta`, {
        ...existing,
        ...freshData,
        characterId:   tokenData.characterId,
        characterName: tokenData.characterName,
        lastFetched:   Date.now(),
      });

      results.push({ charId, name: tokenData.characterName, status: 'ok' });
    } catch (e) {
      results.push({ charId, status: 'error', error: e.message });
    }
  }

  return res.status(200).json({ ok: true, refreshed: results.filter(r => r.status === 'ok').length, results });
}

async function refreshAccessToken(refreshToken) {
  const clientId     = process.env.EVE_CLIENT_ID;
  const clientSecret = process.env.EVE_CLIENT_SECRET;
  try {
    const r = await fetch('https://login.eveonline.com/v2/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64'),
      },
      body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken }),
    });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

async function fetchMemberData(accessToken, characterId) {
  const headers = { 'Authorization': `Bearer ${accessToken}` };
  const data = { lastFetched: Date.now(), error: null };

  await Promise.allSettled([
    fetch(`https://esi.evetech.net/latest/characters/${characterId}/?datasource=tranquility`)
      .then(r => r.json()).then(d => {
        data.birthday = d.birthday;
        data.securityStatus = d.security_status;
      }),

    fetch(`https://esi.evetech.net/latest/characters/${characterId}/wallet/?datasource=tranquility`, { headers })
      .then(r => r.json()).then(d => { if (typeof d === 'number') data.walletBalance = d; }),

    fetch(`https://esi.evetech.net/latest/characters/${characterId}/assets/?datasource=tranquility&page=1`, { headers })
      .then(r => r.json()).then(d => {
        if (Array.isArray(d)) {
          data.assetCount = d.length;
          data.assetSample = d.slice(0, 5).map(a => ({ typeId: a.type_id, qty: a.quantity, flag: a.location_flag }));
        }
      }),

    fetch(`https://esi.evetech.net/latest/characters/${characterId}/skills/?datasource=tranquility`, { headers })
      .then(r => r.json()).then(d => {
        data.totalSP = d.total_sp;
        data.skillCount = d.skills?.length;
      }),

    fetch(`https://esi.evetech.net/latest/characters/${characterId}/corporationhistory/?datasource=tranquility`)
      .then(r => r.json()).then(d => {
        if (Array.isArray(d)) {
          data.corpHistoryCount = d.length;
          data.corpHistory = d.slice(0, 10);
        }
      }),
  ]);

  return data;
}

function parseCookies(h) {
  const c = {};
  h.split(';').forEach(p => { const [k,...v]=p.trim().split('='); if(k) c[k.trim()]=decodeURIComponent(v.join('=')); });
  return c;
}
