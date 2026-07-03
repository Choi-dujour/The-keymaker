// api/applications-data.js
// Returns all pending/reviewed corp applications with their stored ESI snapshot — CEO only.

import { kvKeys, kvMGet } from './_kv.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

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

  const metaKeys = await kvKeys('applicant:*:meta').catch(() => []);
  if (!metaKeys.length) return res.status(200).json({ applications: [] });

  let values;
  try {
    values = await kvMGet(metaKeys);
  } catch (e) {
    console.error('applications-data: kvMGet failed for', metaKeys.length, 'keys —', e.message);
    return res.status(500).json({ error: 'Failed to read application records: ' + e.message });
  }
  const applications = values.filter(Boolean);
  applications.sort((a, b) => (b.registeredAt || 0) - (a.registeredAt || 0));

  return res.status(200).json({ applications, total: applications.length });
}

function parseCookies(h) {
  const c = {};
  h.split(';').forEach(p => { const [k,...v]=p.trim().split('='); if(k) c[k.trim()]=decodeURIComponent(v.join('=')); });
  return c;
}
