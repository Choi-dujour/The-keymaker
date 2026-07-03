// api/applications.js
// Application admin operations — CEO only. Consolidated from applications-data.js/
// application-review.js to stay under Vercel Hobby's 12-serverless-function cap.
//
// GET  /api/applications                          → list all applications
// POST /api/applications {characterId, status}    → set pending/accepted/rejected label
//                                                     (HR tracking only — never touches
//                                                     real EVE corp membership)

import { kvKeys, kvMGet, kvGet, kvSet } from './_kv.js';

const VALID_STATUSES = ['pending', 'accepted', 'rejected'];

export default async function handler(req, res) {
  if (req.method === 'GET') return listApplications(req, res);
  if (req.method === 'POST') return reviewApplication(req, res);
  return res.status(405).json({ error: 'Method not allowed' });
}

async function requireCeo(req, res) {
  const cookies = parseCookies(req.headers.cookie || '');
  const sessionCookie = cookies.eve_session;
  if (!sessionCookie) { res.status(401).json({ error: 'Unauthorized' }); return null; }
  try {
    const session = JSON.parse(Buffer.from(sessionCookie, 'base64').toString('utf8'));
    if (!session.isCeo) { res.status(403).json({ error: 'CEO only' }); return null; }
    return session;
  } catch {
    res.status(401).json({ error: 'Bad session' });
    return null;
  }
}

async function listApplications(req, res) {
  if (!(await requireCeo(req, res))) return;

  const metaKeys = await kvKeys('applicant:*:meta').catch(() => []);
  if (!metaKeys.length) return res.status(200).json({ applications: [] });

  let values;
  try {
    values = await kvMGet(metaKeys);
  } catch (e) {
    console.error('applications: kvMGet failed for', metaKeys.length, 'keys —', e.message);
    return res.status(500).json({ error: 'Failed to read application records: ' + e.message });
  }
  const applications = values.filter(Boolean);
  applications.sort((a, b) => (b.registeredAt || 0) - (a.registeredAt || 0));

  return res.status(200).json({ applications, total: applications.length });
}

async function reviewApplication(req, res) {
  const session = await requireCeo(req, res);
  if (!session) return;

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
