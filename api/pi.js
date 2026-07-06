// api/pi.js
// Planetary Industry data for the /pi.html page — any corp member. Consolidated
// actions in one function to stay under Vercel Hobby's 12-function cap.
//
// GET  /api/pi                                  → planets for the caller's character group
// GET  /api/pi?refresh=1                        → same, bypassing the 10-minute KV cache
// GET  /api/pi?action=all                       → CEO corp-wide overview (KV cache only)
// POST /api/pi?action=unlink&characterId=X      → remove a character from the caller's group

import { kvGet, kvSet, kvDel, kvKeys, kvMGet } from './_kv.js';

const ESI = 'https://esi.evetech.net/latest';
const MAX_CHARS = 8;
const CACHE_MS = 600_000; // ESI caches planet endpoints ~600s anyway

export default async function handler(req, res) {
  if (req.method === 'GET') {
    if (req.query.action === 'all') return corpOverview(req, res);
    return overview(req, res);
  }
  if (req.method === 'POST') {
    if (req.query.action === 'unlink') return unlink(req, res);
    return res.status(400).json({ error: 'Unknown action' });
  }
  return res.status(405).json({ error: 'Method not allowed' });
}

function requireMember(req, res) {
  const cookies = parseCookies(req.headers.cookie || '');
  const sessionCookie = cookies.eve_session;
  if (!sessionCookie) { res.status(401).json({ error: 'Unauthorized' }); return null; }
  try {
    return JSON.parse(Buffer.from(sessionCookie, 'base64').toString('utf8'));
  } catch {
    res.status(401).json({ error: 'Bad session' });
    return null;
  }
}

async function getGroup(characterId) {
  const self = String(characterId);
  const doc = await kvGet(`pi:group:${self}`).catch(() => null);
  const members = Array.isArray(doc?.members) ? doc.members.map(String) : [];
  if (!members.includes(self)) members.unshift(self);
  return members.slice(0, MAX_CHARS);
}

// ---------------------------------------------------------------- overview

async function overview(req, res) {
  const session = requireMember(req, res);
  if (!session) return;

  const forceRefresh = req.query.refresh === '1';
  const group = await getGroup(session.characterId);

  const characters = await Promise.all(group.map(id =>
    loadCharacterPlanets(id, session, forceRefresh).catch(e => ({
      characterId: id, characterName: null, fetchedAt: null, fromCache: false,
      error: e.message || 'fetch_failed', planets: [],
    }))
  ));

  // Resolve solar system + pin type names in one batch across all characters
  const ids = new Set();
  for (const c of characters) for (const p of c.planets) {
    if (!p.solarSystemName) ids.add(p.solarSystemId);
    for (const s of p.storage) if (!s.typeName) ids.add(s.typeId);
  }
  if (ids.size) {
    const names = await resolveNames([...ids]);
    for (const c of characters) {
      for (const p of c.planets) {
        if (!p.solarSystemName) p.solarSystemName = names[p.solarSystemId] || String(p.solarSystemId);
        for (const s of p.storage) {
          if (!s.typeName) s.typeName = names[s.typeId] || '';
          s.kind = storageKind(s.typeName);
        }
      }
      // Re-cache with names baked in so cache hits skip resolution entirely
      if (!c.fromCache && !c.error) {
        kvSet(`pi:planets:${c.characterId}`, c).catch(() => {});
      }
    }
  }

  return res.status(200).json({
    group,
    activeCharacterId: String(session.characterId),
    serverTime: Date.now(),
    characters,
  });
}

async function loadCharacterPlanets(characterId, session, forceRefresh) {
  const id = String(characterId);
  const cached = await kvGet(`pi:planets:${id}`).catch(() => null);
  if (!forceRefresh && cached?.fetchedAt && Date.now() - cached.fetchedAt < CACHE_MS) {
    return { ...cached, fromCache: true };
  }

  const tokenDoc = await kvGet(`member:${id}:token`).catch(() => null);
  const stale = () => cached
    ? { ...cached, fromCache: true, error: cached.error || 'token_refresh_failed' }
    : null;

  let accessToken = null;
  let characterName = tokenDoc?.characterName || null;

  // The logged-in character can ride the session's still-valid access token
  if (id === String(session.characterId) && session.accessToken && Date.now() < (session.expires || 0) - 60000) {
    accessToken = session.accessToken;
    characterName = session.characterName;
  } else {
    if (!tokenDoc?.refreshToken) {
      return stale() || { characterId: id, characterName, fetchedAt: null, fromCache: false, error: 'no_token', planets: [] };
    }
    const refreshed = await refreshAccessToken(tokenDoc.refreshToken);
    if (!refreshed) {
      return stale() || { characterId: id, characterName, fetchedAt: null, fromCache: false, error: 'token_refresh_failed', planets: [] };
    }
    accessToken = refreshed.access_token;
    // EVE SSO rotates refresh tokens — persist the new one (same as member-detail.js)
    kvSet(`member:${id}:token`, {
      ...tokenDoc,
      refreshToken: refreshed.refresh_token || tokenDoc.refreshToken,
      lastSeen: Date.now(),
    }).catch(() => {});
  }

  const headers = { Authorization: `Bearer ${accessToken}` };
  const list = await esiGet(`/characters/${id}/planets/`, headers);

  const planets = await Promise.all(list.slice(0, 12).map(async p => {
    const planet = {
      planetId: p.planet_id,
      planetType: p.planet_type,
      solarSystemId: p.solar_system_id,
      solarSystemName: null,
      upgradeLevel: p.upgrade_level,
      numPins: p.num_pins,
      lastUpdate: p.last_update,
      extractors: [],
      factories: {},
      storage: [],
    };
    try {
      const detail = await esiGet(`/characters/${id}/planets/${p.planet_id}/`, headers);
      for (const pin of detail.pins || []) {
        if (pin.extractor_details) {
          planet.extractors.push({
            productTypeId: pin.extractor_details.product_type_id || null,
            qtyPerCycle: pin.extractor_details.qty_per_cycle || 0,
            cycleTime: pin.extractor_details.cycle_time || 0,
            heads: (pin.extractor_details.heads || []).length,
            installTime: pin.install_time || null,
            expiryTime: pin.expiry_time || null,
          });
        } else if (pin.schematic_id) {
          planet.factories[pin.schematic_id] = (planet.factories[pin.schematic_id] || 0) + 1;
        } else {
          planet.storage.push({
            typeId: pin.type_id,
            typeName: null,
            kind: null,
            contents: (pin.contents || []).map(c => ({ typeId: c.type_id, amount: c.amount })),
          });
        }
      }
    } catch (e) {
      planet.error = e.message;
    }
    return planet;
  }));

  const result = {
    characterId: id,
    characterName,
    fetchedAt: Date.now(),
    fromCache: false,
    error: null,
    planets,
  };
  // Cached again with resolved names by the caller; this write covers the
  // no-names-needed path (zero planets).
  if (!planets.length) kvSet(`pi:planets:${id}`, result).catch(() => {});
  return result;
}

// ---------------------------------------------------------- CEO corp view

async function corpOverview(req, res) {
  const session = requireMember(req, res);
  if (!session) return;
  if (!session.isCeo) return res.status(403).json({ error: 'CEO only' });

  const [planetKeys, groupKeys] = await Promise.all([
    kvKeys('pi:planets:*').catch(() => []),
    kvKeys('pi:group:*').catch(() => []),
  ]);

  const snapshots = planetKeys.length ? await kvMGet(planetKeys).catch(() => []) : [];
  const groupDocs = groupKeys.length ? await kvMGet(groupKeys).catch(() => []) : [];

  // Union-find-lite: group signature = sorted member list; solo chars form their own
  const groupOf = {};
  for (const doc of groupDocs) {
    if (!Array.isArray(doc?.members)) continue;
    const sig = [...doc.members].map(String).sort().join(',');
    for (const m of doc.members) groupOf[String(m)] = sig;
  }

  const bySig = {};
  let totalPlanets = 0;
  for (const snap of snapshots) {
    if (!snap?.characterId) continue;
    const id = String(snap.characterId);
    const sig = groupOf[id] || id;
    const planets = snap.planets || [];
    totalPlanets += planets.length;
    let nextExpiry = null;
    for (const p of planets) for (const x of p.extractors) {
      if (x.expiryTime && (!nextExpiry || x.expiryTime < nextExpiry)) nextExpiry = x.expiryTime;
    }
    (bySig[sig] = bySig[sig] || []).push({
      characterId: id,
      characterName: snap.characterName,
      planetCount: planets.length,
      planetTypes: [...new Set(planets.map(p => p.planetType))],
      nextExpiry,
      fetchedAt: snap.fetchedAt,
    });
  }

  const groups = Object.values(bySig).map(members => ({
    members: members.sort((a, b) => (a.characterName || '').localeCompare(b.characterName || '')),
  }));
  groups.sort((a, b) => (a.members[0]?.characterName || '').localeCompare(b.members[0]?.characterName || ''));

  return res.status(200).json({
    groups,
    totalCharacters: snapshots.filter(s => s?.characterId).length,
    totalPlanets,
  });
}

// ------------------------------------------------------------------ unlink

async function unlink(req, res) {
  const session = requireMember(req, res);
  if (!session) return;

  const target = String(req.query.characterId || '');
  if (!/^\d+$/.test(target)) return res.status(400).json({ error: 'characterId must be numeric' });

  const self = String(session.characterId);
  const group = await getGroup(self);
  if (!group.includes(target)) return res.status(403).json({ error: 'Character not in your group' });

  const remaining = group.filter(id => id !== target);
  const doc = { members: remaining, updatedAt: Date.now() };
  await Promise.all([
    ...(remaining.length > 1 ? remaining.map(id => kvSet(`pi:group:${id}`, doc)) : remaining.map(id => kvDel(`pi:group:${id}`))),
    kvDel(`pi:group:${target}`),
  ]);

  return res.status(200).json({ ok: true, group: remaining });
}

// ----------------------------------------------------------------- helpers

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

function storageKind(typeName) {
  const n = (typeName || '').toLowerCase();
  if (n.includes('launchpad')) return 'launchpad';
  if (n.includes('command center')) return 'command';
  if (n.includes('storage')) return 'storage';
  return 'other';
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
