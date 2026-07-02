// api/member-delete.js
// Deletes a single member's stored token + vetting data from KV — CEO only.

import { kvDel } from './_kv.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const cookies = parseCookies(req.headers.cookie || '');
  const sessionCookie = cookies.eve_session;
  if (!sessionCookie) return res.status(401).json({ error: 'Unauthorized' });

  let session;
  try {
    session = JSON.parse(Buffer.from(sessionCookie, 'base64').toString('utf8'));
    if (!session.isCeo) return res.status(403).json({ error: 'CEO only' });
  } catch {
    return res.status(401).json({ error: 'Bad session' });
  }

  const characterId = req.query.characterId;
  if (!characterId || !/^\d+$/.test(characterId)) {
    return res.status(400).json({ error: 'characterId must be numeric' });
  }

  const id = String(characterId);
  await Promise.all([
    kvDel(`member:${id}:token`),
    kvDel(`member:${id}:meta`),
  ]);

  return res.status(200).json({ ok: true, deleted: id });
}

function parseCookies(h) {
  const c = {};
  h.split(';').forEach(p => { const [k, ...v] = p.trim().split('='); if (k) c[k.trim()] = decodeURIComponent(v.join('=')); });
  return c;
}
