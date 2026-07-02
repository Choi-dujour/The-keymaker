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

  const values = await kvMGet(metaKeys).catch(() => []);
  const members = values.filter(Boolean);

  members.forEach(m => { m.riskScore = riskScore(m); });
  members.sort((a, b) => b.riskScore - a.riskScore);

  return res.status(200).json({ members, total: members.length });
}

function riskScore(m) {
  let score = 0;
  // New character but rich = suspicious
  const ageDays = m.birthday ? Math.floor((Date.now() - new Date(m.birthday).getTime()) / 86400000) : 999;
  if (ageDays < 30 && (m.walletBalance || 0) > 1e9)  score += 10;
  if (ageDays < 90 && (m.walletBalance || 0) > 5e9)  score += 8;
  if (ageDays < 30 && (m.assetCount || 0) > 50)       score += 7;
  // Too many corp switches
  if ((m.corpHistoryCount || 0) > 15) score += 5;
  if ((m.corpHistoryCount || 0) > 30) score += 8;
  // Very high ISK on fresh character
  if ((m.walletBalance || 0) > 10e9 && ageDays < 180) score += 6;
  return score;
}

function parseCookies(h) {
  const c = {};
  h.split(';').forEach(p => { const [k,...v]=p.trim().split('='); if(k) c[k.trim()]=decodeURIComponent(v.join('=')); });
  return c;
}
