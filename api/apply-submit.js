// api/apply-submit.js
// Attaches an optional message to an application just created by api/callback.js.
// Public endpoint, but gated by the short-lived eve_applicant cookie set right after
// the applicant's own EVE SSO login — so a message can only be attributed to the
// character that actually just completed OAuth, not spoofed for someone else.

import { kvGet, kvSet } from './_kv.js';

const MAX_MESSAGE_LENGTH = 1000;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const cookies = parseCookies(req.headers.cookie || '');
  const applicantCookie = cookies.eve_applicant;
  if (!applicantCookie) return res.status(401).json({ error: 'Application session expired — please apply again.' });

  let applicant;
  try {
    applicant = JSON.parse(Buffer.from(applicantCookie, 'base64').toString('utf8'));
  } catch {
    return res.status(401).json({ error: 'Bad application session' });
  }

  // The cookie alone identifies the applicant (HttpOnly, set server-side right after
  // their own OAuth login) — no client-supplied characterId to trust or validate.
  const characterId = String(applicant.characterId);
  const message = String(req.body?.message || '').trim().slice(0, MAX_MESSAGE_LENGTH);

  const existing = await kvGet(`applicant:${characterId}:meta`).catch(() => null);
  if (!existing) return res.status(404).json({ error: 'Application not found — please apply again.' });

  await kvSet(`applicant:${characterId}:meta`, {
    ...existing,
    message: message || null,
    messageSubmittedAt: Date.now(),
  });

  return res.status(200).json({ ok: true });
}

function parseCookies(h) {
  const c = {};
  h.split(';').forEach(p => { const [k, ...v] = p.trim().split('='); if (k) c[k.trim()] = decodeURIComponent(v.join('=')); });
  return c;
}
