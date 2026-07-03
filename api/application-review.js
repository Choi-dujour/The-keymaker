// api/application-review.js
// Sets a pending/accepted/rejected label on an application — CEO only.
// This is HR record-keeping only: it never touches real EVE corp membership,
// which always requires a manual in-game invite (no ESI scope allows an app
// to add someone to a corporation on its own).

import { kvGet, kvSet } from './_kv.js';

const VALID_STATUSES = ['pending', 'accepted', 'rejected'];

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

  const characterId = String(req.body?.characterId || '');
  const status = String(req.body?.status || '');
  if (!/^\d+$/.test(characterId)) return res.status(400).json({ error: 'characterId must be numeric' });
  if (!VALID_STATUSES.includes(status)) return res.status(400).json({ error: 'status must be one of ' + VALID_STATUSES.join(', ') });

  const existing = await kvGet(`applicant:${characterId}:meta`).catch(() => null);
  if (!existing) return res.status(404).json({ error: 'Application not found' });

  await kvSet(`applicant:${characterId}:meta`, {
    ...existing,
    status,
    reviewedAt: Date.now(),
    reviewedBy: session.characterName,
  });

  return res.status(200).json({ ok: true, characterId, status });
}

function parseCookies(h) {
  const c = {};
  h.split(';').forEach(p => { const [k, ...v] = p.trim().split('='); if (k) c[k.trim()] = decodeURIComponent(v.join('=')); });
  return c;
}
