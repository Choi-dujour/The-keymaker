// api/_kv.js
// Lightweight Upstash Redis REST client — no npm dependency needed.
// Works with Vercel's KV/Upstash integration env vars: KV_REST_API_URL + KV_REST_API_TOKEN

const KV_URL   = process.env.kv_KV_REST_API_URL   || process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.kv_KV_REST_API_TOKEN || process.env.KV_REST_API_TOKEN;

async function kvCommand(args) {
  if (!KV_URL || !KV_TOKEN) {
    throw new Error('KV not configured: missing KV_REST_API_URL / KV_REST_API_TOKEN env vars');
  }
  const res = await fetch(KV_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${KV_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(args),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`KV command failed: ${res.status} ${text}`);
  }
  const data = await res.json();
  return data.result;
}

export async function kvSet(key, value) {
  const serialized = typeof value === 'string' ? value : JSON.stringify(value);
  return kvCommand(['SET', key, serialized]);
}

export async function kvGet(key) {
  const result = await kvCommand(['GET', key]);
  if (result === null || result === undefined) return null;
  try { return JSON.parse(result); } catch { return result; }
}

export async function kvDel(key) {
  return kvCommand(['DEL', key]);
}

export async function kvKeys(pattern) {
  // SCAN-based key listing (KEYS is fine for small datasets like a single corp's members)
  return kvCommand(['KEYS', pattern]);
}

export async function kvMGet(keys) {
  if (!keys.length) return [];
  const result = await kvCommand(['MGET', ...keys]);
  return (result || []).map(v => {
    if (v === null || v === undefined) return null;
    try { return JSON.parse(v); } catch { return v; }
  });
}
