// api/map.js
// Galaxy-map backend — one consolidated function (Vercel Hobby 12-function cap).
//
// POST /api/map?action=sample   x-cron-secret guarded (GitHub Actions cron).
//                               Samples ESI corporation membertracking with the
//                               CEO's stored token and appends member movement
//                               transitions to a 7-day KV log.
// GET  /api/map?action=log&from=ms&to=ms   CEO only. Returns movements in range.

import { kvGet, kvSet, kvDel, kvKeys, kvMGet } from './_kv.js';

const ESI = 'https://esi.evetech.net/latest';
const CORP_ID = 98800626;
const RETENTION_DAYS = 7;
const MAX_STATION_LOOKUPS = 25;

export default async function handler(req, res) {
  if (req.method === 'POST' && req.query.action === 'sample') return sample(req, res);
  if (req.method === 'GET' && req.query.action === 'log') return movementLog(req, res);
  return res.status(400).json({ error: 'Unknown action' });
}

// ---------------------------------------------------------------- sample

async function sample(req, res) {
  const secret = req.headers['x-cron-secret'];
  if (!secret || secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const status = { lastOkTs: null, lastError: null, lastErrorTs: null };
  const fail = async (reason) => {
    // 200 on purpose: token/ESI trouble must not paint the Actions history red
    // every 10 minutes — staleness is surfaced in the CEO UI via track:status.
    const prev = await kvGet('track:status').catch(() => null);
    await kvSet('track:status', { ...(prev || status), lastError: reason, lastErrorTs: Date.now() }).catch(() => {});
    return res.status(200).json({ ok: false, reason });
  };

  try {
    // 1. CEO token — prefer the corp's real CEO (auto-detected at login, stored
    // in corp:ceo by callback.js), falling back to the env override.
    const ceoId = (await kvGet('corp:ceo').catch(() => null))?.ceoId || process.env.CEO_CHARACTER_ID;
    if (!ceoId) return fail('no_ceo_configured');
    const tokenDoc = await kvGet(`member:${ceoId}:token`).catch(() => null);
    if (!tokenDoc?.refreshToken) return fail('no_ceo_token');
    const refreshed = await refreshAccessToken(tokenDoc.refreshToken);
    if (!refreshed) return fail('token_refresh_failed');
    kvSet(`member:${ceoId}:token`, {
      ...tokenDoc,
      refreshToken: refreshed.refresh_token || tokenDoc.refreshToken,
      lastSeen: Date.now(),
    }).catch(() => {});
    const headers = { Authorization: `Bearer ${refreshed.access_token}` };

    // 2. Member locations
    let tracking;
    try {
      tracking = await esiGet(`/corporations/${CORP_ID}/membertracking/`, headers);
    } catch (e) {
      return fail('membertracking_failed_' + (e.status || 'network'));
    }

    // 3. Normalize location_id -> solar system id (or null)
    const locmap = (await kvGet('track:locmap').catch(() => null)) || {};
    let locmapDirty = false;
    let lookups = 0;
    async function toSystemId(locId, hdrs) {
      if (locId == null) return null;
      if (locId >= 30000000 && locId < 31000000) return locId;
      const key = String(locId);
      if (key in locmap) return locmap[key];
      if (lookups >= MAX_STATION_LOOKUPS) return null; // resolve on a later run
      lookups++;
      try {
        let sys = null;
        if (locId >= 60000000 && locId < 70000000) {
          const st = await esiGet(`/universe/stations/${locId}/`);
          sys = st.system_id || null;
        } else if (locId > 1e12) {
          const st = await esiGet(`/universe/structures/${locId}/`, hdrs);
          sys = st.solar_system_id || null;
        }
        locmap[key] = sys;
        locmapDirty = true;
        return sys;
      } catch {
        return null; // 403/404/timeout — retry next run (not cached)
      }
    }

    const now = Date.now();
    const chars = {};
    for (const m of tracking) {
      const online = !!(m.logon_date && (!m.logoff_date || m.logon_date > m.logoff_date));
      chars[String(m.character_id)] = {
        loc: await toSystemId(m.location_id, headers),
        online,
        ship: m.ship_type_id || null,
      };
    }

    // 4. Diff vs previous snapshot → movement transitions
    const snapshot = await kvGet('track:snapshot').catch(() => null);
    const moves = [];
    if (snapshot?.chars) {
      for (const [cid, cur] of Object.entries(chars)) {
        const prev = snapshot.chars[cid];
        if (prev?.loc && cur.loc && prev.loc !== cur.loc && cur.online) {
          moves.push({ c: Number(cid), f: prev.loc, t: cur.loc, ts: now, s: cur.ship });
        }
      }
    }

    // 5. Names for characters we haven't resolved yet
    const names = (await kvGet('track:names').catch(() => null)) || {};
    const missing = Object.keys(chars).filter(id => !names[id]).map(Number);
    if (missing.length) {
      const resolved = await resolveNames(missing);
      let dirty = false;
      for (const [id, name] of Object.entries(resolved)) { names[id] = name; dirty = true; }
      if (dirty) await kvSet('track:names', names).catch(() => {});
    }

    // 6. Append to today's log (single writer — the cron — so RMW is safe)
    const today = new Date().toISOString().slice(0, 10);
    if (moves.length) {
      const log = (await kvGet(`track:log:${today}`).catch(() => null)) || [];
      log.push(...moves);
      await kvSet(`track:log:${today}`, log);
    }

    // 7. Retention
    const cutoff = new Date(now - RETENTION_DAYS * 86400e3).toISOString().slice(0, 10);
    const logKeys = await kvKeys('track:log:*').catch(() => []);
    for (const key of logKeys) {
      const day = key.slice('track:log:'.length);
      if (day < cutoff) await kvDel(key).catch(() => {});
    }

    // 8. Save snapshot + status
    await kvSet('track:snapshot', { ts: now, chars });
    if (locmapDirty) await kvSet('track:locmap', locmap).catch(() => {});
    const prevStatus = await kvGet('track:status').catch(() => null);
    await kvSet('track:status', { ...(prevStatus || {}), lastOkTs: now }).catch(() => {});

    return res.status(200).json({
      ok: true,
      first: !snapshot,
      members: Object.keys(chars).length,
      moves: moves.length,
    });
  } catch (e) {
    console.error('sample error:', e.message);
    return res.status(500).json({ error: e.message });
  }
}

// ------------------------------------------------------------ movement log

async function movementLog(req, res) {
  const session = requireCeo(req, res);
  if (!session) return;

  const now = Date.now();
  const minFrom = now - RETENTION_DAYS * 86400e3;
  let from = Number(req.query.from) || (now - 86400e3);
  let to = Number(req.query.to) || now;
  from = Math.max(from, minFrom);
  to = Math.min(to, now);

  const dayKeys = [];
  for (let t = from; t <= to + 86400e3; t += 86400e3) {
    const day = new Date(t).toISOString().slice(0, 10);
    const key = `track:log:${day}`;
    if (!dayKeys.includes(key)) dayKeys.push(key);
  }

  const [logs, names, status] = await Promise.all([
    kvMGet(dayKeys).catch(() => []),
    kvGet('track:names').catch(() => null),
    kvGet('track:status').catch(() => null),
  ]);

  const movements = logs
    .filter(Array.isArray)
    .flat()
    .filter(m => m.ts >= from && m.ts <= to)
    .sort((a, b) => a.ts - b.ts);

  return res.status(200).json({ movements, names: names || {}, status: status || {}, from, to });
}

// ----------------------------------------------------------------- helpers

function requireCeo(req, res) {
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

async function esiGet(path, headers) {
  const url = `${ESI}${path}${path.includes('?') ? '&' : '?'}datasource=tranquility`;
  const r = await fetch(url, { headers, signal: AbortSignal.timeout(6000) });
  if (!r.ok) {
    const e = new Error(`ESI ${r.status} on ${path}`);
    e.status = r.status;
    throw e;
  }
  return r.json();
}

async function resolveNames(ids) {
  const names = {};
  try {
    for (let i = 0; i < ids.length; i += 1000) {
      const chunk = ids.slice(i, i + 1000);
      const r = await fetch(`${ESI}/universe/names/?datasource=tranquility`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(chunk),
        signal: AbortSignal.timeout(6000),
      });
      if (!r.ok) continue;
      for (const item of await r.json()) names[item.id] = item.name;
    }
  } catch (e) {
    console.warn('name resolution failed:', e.message);
  }
  return names;
}

async function refreshAccessToken(refreshToken) {
  const clientId = process.env.EVE_CLIENT_ID;
  const clientSecret = process.env.EVE_CLIENT_SECRET;
  try {
    const r = await fetch('https://login.eveonline.com/v2/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64'),
      },
      body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken }),
    });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

function parseCookies(h) {
  const c = {};
  h.split(';').forEach(p => { const [k, ...v] = p.trim().split('='); if (k) c[k.trim()] = decodeURIComponent(v.join('=')); });
  return c;
}
