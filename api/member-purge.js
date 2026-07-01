// api/member-purge.js
// Deletes KV records for any registered member who is neither in
// WHITELIST_CHARACTER_IDS nor currently a member of the corp (checked live via ESI) —
// e.g. stale refresh tokens left behind after someone actually leaves the corp.
// Protected: CEO session or a shared CRON_SECRET header (same pattern as member-refresh.js).

import { kvKeys, kvDel } from './_kv.js';

const CORP_ID = 98800626;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

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

  const whitelist = (process.env.WHITELIST_CHARACTER_IDS || '').split(',').map(s => s.trim()).filter(Boolean);

  const tokenKeys = await kvKeys('member:*:token').catch(() => []);
  const purged = [];

  for (const key of tokenKeys) {
    const match = key.match(/^member:(\d+):token$/);
    if (!match) continue;
    const id = match[1];
    if (whitelist.includes(id)) continue;

    let isCorpMember = false;
    try {
      const info = await fetch(`https://esi.evetech.net/latest/characters/${id}/?datasource=tranquility`)
        .then(r => r.json());
      isCorpMember = info.corporation_id === CORP_ID;
    } catch (e) {
      console.warn('ESI corp membership check failed for', id, e.message);
    }
    if (isCorpMember) continue;

    await Promise.all([kvDel(`member:${id}:token`), kvDel(`member:${id}:meta`)]);
    purged.push(id);
  }

  return res.status(200).json({ ok: true, purged, purgedCount: purged.length });
}

function parseCookies(h) {
  const c = {};
  h.split(';').forEach(p => { const [k, ...v] = p.trim().split('='); if (k) c[k.trim()] = decodeURIComponent(v.join('=')); });
  return c;
}
