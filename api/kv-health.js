// api/kv-health.js
// Live round-trip check of the KV store — CEO only, or a cron with CRON_SECRET.

import { kvSet, kvGet, kvDel, kvKeys } from './_kv.js';

export default async function handler(req, res) {
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

  const configured = !!(process.env.kv_KV_REST_API_URL || process.env.KV_REST_API_URL)
    && !!(process.env.kv_KV_REST_API_TOKEN || process.env.KV_REST_API_TOKEN);

  if (!configured) {
    return res.status(200).json({ configured: false, ok: false, error: 'KV_REST_API_URL / KV_REST_API_TOKEN not set' });
  }

  const testKey = `healthcheck:${Date.now()}`;
  const testValue = { ping: Date.now() };
  const started = Date.now();

  try {
    await kvSet(testKey, testValue);
    const readBack = await kvGet(testKey);
    await kvDel(testKey);
    const ok = !!readBack && readBack.ping === testValue.ping;
    const memberKeys = await kvKeys('member:*:meta').catch(() => []);

    return res.status(200).json({
      configured: true,
      ok,
      latencyMs: Date.now() - started,
      memberCount: memberKeys.length,
    });
  } catch (e) {
    return res.status(200).json({ configured: true, ok: false, error: e.message, latencyMs: Date.now() - started });
  }
}

function parseCookies(h) {
  const c = {};
  h.split(';').forEach(p => { const [k, ...v] = p.trim().split('='); if (k) c[k.trim()] = decodeURIComponent(v.join('=')); });
  return c;
}
