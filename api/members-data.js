// api/members-data.js
// Returns all registered members with their stored ESI data — CEO only.

import { kvKeys, kvMGet } from './_kv.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  // CEO auth check
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

  const metaKeys = await kvKeys('member:*:meta').catch(() => []);
  if (!metaKeys.length) return res.status(200).json({ members: [] });

  let values;
  try {
    values = await kvMGet(metaKeys);
  } catch (e) {
    console.error('members-data: kvMGet failed for', metaKeys.length, 'keys —', e.message);
    return res.status(500).json({ error: 'Failed to read member records: ' + e.message });
  }
  const members = values.filter(Boolean);
  members.sort((a, b) => (b.registeredAt || 0) - (a.registeredAt || 0));

  return res.status(200).json({ members, total: members.length });
}

function parseCookies(h) {
  const c = {};
  h.split(';').forEach(p => { const [k,...v]=p.trim().split('='); if(k) c[k.trim()]=decodeURIComponent(v.join('=')); });
  return c;
}
