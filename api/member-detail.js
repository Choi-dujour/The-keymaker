// api/member-detail.js
// Full on-demand ESI data pull for a single member, using their stored refresh
// token — CEO only. Powers the member detail panel on the Members page.

import { kvGet, kvSet } from './_kv.js';

const ESI = 'https://esi.evetech.net/latest';

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

  const characterId = req.query.characterId;
  if (!characterId || !/^\d+$/.test(characterId)) {
    return res.status(400).json({ error: 'characterId must be numeric' });
  }

  const tokenData = await kvGet(`member:${characterId}:token`).catch(() => null);
  if (!tokenData?.refreshToken) {
    return res.status(404).json({ error: 'This member has never logged into the dashboard — no ESI data available.' });
  }

  const newToken = await refreshAccessToken(tokenData.refreshToken);
  if (!newToken) {
    return res.status(502).json({ error: "Failed to refresh this member's ESI access token — they may need to log in again." });
  }

  await kvSet(`member:${characterId}:token`, {
    ...tokenData,
    refreshToken: newToken.refresh_token || tokenData.refreshToken,
    lastSeen: Date.now(),
  }).catch(() => {});

  const result = await fetchFullMemberData(newToken.access_token, characterId);
  return res.status(200).json(result);
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

async function fetchFullMemberData(accessToken, characterId) {
  const headers = { Authorization: `Bearer ${accessToken}` };
  const out = { characterId, fetchedAt: Date.now(), errors: {} };

  async function esiGet(path, auth = true) {
    const url = `${ESI}${path}${path.includes('?') ? '&' : '?'}datasource=tranquility`;
    const r = await fetch(url, auth ? { headers } : undefined);
    if (!r.ok) throw new Error(`ESI ${r.status} on ${path}`);
    return r.json();
  }

  async function esiGetPaged(path, maxPages) {
    const all = [];
    for (let page = 1; page <= maxPages; page++) {
      const url = `${ESI}${path}${path.includes('?') ? '&' : '?'}datasource=tranquility&page=${page}`;
      const r = await fetch(url, { headers });
      if (!r.ok) {
        if (page === 1) throw new Error(`ESI ${r.status} on ${path}`);
        break;
      }
      const data = await r.json();
      if (!Array.isArray(data) || !data.length) break;
      all.push(...data);
      const totalPages = parseInt(r.headers.get('x-pages') || '1', 10);
      if (page >= totalPages) break;
    }
    return all;
  }

  async function section(name, fn) {
    try {
      out[name] = await fn();
    } catch (e) {
      out.errors[name] = e.message;
    }
  }

  await Promise.allSettled([
    section('profile', () => esiGet(`/characters/${characterId}/`, false)),
    section('corpHistory', () => esiGet(`/characters/${characterId}/corporationhistory/`, false)),
    section('wallet', () => esiGet(`/characters/${characterId}/wallet/`)),
    section('walletJournal', () => esiGet(`/characters/${characterId}/wallet/journal/?page=1`)),
    section('skills', () => esiGet(`/characters/${characterId}/skills/`)),
    section('skillQueue', () => esiGet(`/characters/${characterId}/skillqueue/`)),
    section('clones', () => esiGet(`/characters/${characterId}/clones/`)),
    section('implants', () => esiGet(`/characters/${characterId}/implants/`)),
    section('contacts', () => esiGet(`/characters/${characterId}/contacts/`)),
    section('standings', () => esiGet(`/characters/${characterId}/standings/`)),
    section('blueprints', () => esiGetPaged(`/characters/${characterId}/blueprints/`, 2)),
    section('medals', () => esiGet(`/characters/${characterId}/medals/`)),
    section('titles', () => esiGet(`/characters/${characterId}/titles/`)),
    section('loyaltyPoints', () => esiGet(`/characters/${characterId}/loyalty/points/`)),
    section('fatigue', () => esiGet(`/characters/${characterId}/fatigue/`)),
    section('agentsResearch', () => esiGet(`/characters/${characterId}/agents_research/`)),
    section('location', () => esiGet(`/characters/${characterId}/location/`)),
    section('online', () => esiGet(`/characters/${characterId}/online/`)),
    section('ship', () => esiGet(`/characters/${characterId}/ship/`)),
    section('fittings', () => esiGet(`/characters/${characterId}/fittings/`)),
    section('industryJobs', () => esiGet(`/characters/${characterId}/industry/jobs/?include_completed=true`)),
    section('miningLedger', () => esiGetPaged(`/characters/${characterId}/mining/`, 2)),
    section('contracts', () => esiGetPaged(`/characters/${characterId}/contracts/`, 2)),
    section('notifications', () => esiGet(`/characters/${characterId}/notifications/`)),
    section('calendar', () => esiGet(`/characters/${characterId}/calendar/`)),
    section('mailHeaders', () => esiGet(`/characters/${characterId}/mail/`)),
    section('assetsRaw', () => esiGetPaged(`/characters/${characterId}/assets/`, 5)),
  ]);

  await resolveAssetLocations(out, headers);
  delete out.assetsRaw;
  await enrichNames(out, headers);

  return out;
}

// Collects every other reference ID scattered across sections (corp history, contacts,
// mail senders, implants, clone bay locations, blueprints, current ship, standings, current
// system) and resolves them all in one batch, so the frontend can show names instead of bare
// IDs without needing its own ESI calls.
async function enrichNames(out, headers) {
  const ids = new Set();
  (out.corpHistory || []).forEach(h => ids.add(h.corporation_id));
  (out.contacts || []).forEach(c => ids.add(c.contact_id));
  (out.mailHeaders || []).forEach(m => { if (m.from) ids.add(m.from); });
  (out.implants || []).forEach(id => ids.add(id));
  (out.clones?.jump_clones || []).forEach(jc => {
    if (jc.location_id) ids.add(jc.location_id);
    (jc.implants || []).forEach(id => ids.add(id));
  });
  (out.blueprints || []).forEach(b => ids.add(b.type_id));
  if (out.ship?.ship_type_id) ids.add(out.ship.ship_type_id);
  (out.standings || []).forEach(s => ids.add(s.from_id));
  if (out.location?.solar_system_id) ids.add(out.location.solar_system_id);

  const idList = [...ids].filter(id => typeof id === 'number' && id > 0);
  const resolved = await resolveNamesBatch(idList);

  const missing = idList.filter(id => !resolved[id] && id > 1e12);
  await Promise.allSettled(missing.map(async id => {
    try {
      const r = await fetch(`${ESI}/universe/structures/${id}/?datasource=tranquility`, { headers });
      if (r.ok) {
        const info = await r.json();
        resolved[id] = info.name;
      }
    } catch {}
  }));

  out.names = resolved;
}

async function resolveAssetLocations(out, headers) {
  const assets = out.assetsRaw;
  if (!Array.isArray(assets)) {
    out.assetsByLocation = [];
    return;
  }

  const itemIds = new Set(assets.map(a => a.item_id));
  const typeIds = [...new Set(assets.map(a => a.type_id))];
  // Assets whose location_id is itself another asset's item_id are packed inside
  // that container/ship — only top-level assets sit directly "at" a station/structure.
  const topLevel = assets.filter(a => !itemIds.has(a.location_id));
  const locationIds = [...new Set(topLevel.map(a => a.location_id))];

  const [typeNames, locationNames] = await Promise.all([
    resolveNamesBatch(typeIds),
    resolveLocationNames(locationIds, headers),
  ]);

  const groups = {};
  for (const a of topLevel) {
    const locName = locationNames[a.location_id] || `Location #${a.location_id}`;
    if (!groups[locName]) groups[locName] = [];
    groups[locName].push({
      name: typeNames[a.type_id] || `Type #${a.type_id}`,
      quantity: a.quantity,
      flag: a.location_flag,
      singleton: a.is_singleton,
    });
  }
  out.assetsByLocation = Object.entries(groups).map(([station, items]) => ({ station, items }));
  out.assetCount = assets.length;
}

async function resolveNamesBatch(ids) {
  const out = {};
  for (let i = 0; i < ids.length; i += 1000) {
    const batch = ids.slice(i, i + 1000);
    try {
      const r = await fetch(`${ESI}/universe/names/?datasource=tranquility`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(batch),
      });
      const names = await r.json();
      if (Array.isArray(names)) names.forEach(n => { out[n.id] = n.name; });
    } catch {}
  }
  return out;
}

async function resolveLocationNames(ids, headers) {
  const out = {};
  // /universe/names/ resolves NPC stations & systems but never player structures.
  Object.assign(out, await resolveNamesBatch(ids));
  const remaining = ids.filter(id => !out[id]);
  await Promise.allSettled(remaining.map(async id => {
    try {
      const r = await fetch(`${ESI}/universe/structures/${id}/?datasource=tranquility`, { headers });
      if (r.ok) {
        const info = await r.json();
        out[id] = info.name;
      }
    } catch {}
  }));
  return out;
}

function parseCookies(h) {
  const c = {};
  h.split(';').forEach(p => { const [k, ...v] = p.trim().split('='); if (k) c[k.trim()] = decodeURIComponent(v.join('=')); });
  return c;
}
