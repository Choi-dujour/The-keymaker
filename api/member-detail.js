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

  let prefix = 'member';
  let tokenData = await kvGet(`member:${characterId}:token`).catch(() => null);
  if (!tokenData?.refreshToken) {
    prefix = 'applicant';
    tokenData = await kvGet(`applicant:${characterId}:token`).catch(() => null);
  }
  if (!tokenData?.refreshToken) {
    return res.status(404).json({ error: 'This member has never logged into the dashboard — no ESI data available.' });
  }

  const newToken = await refreshAccessToken(tokenData.refreshToken);
  if (!newToken) {
    return res.status(502).json({ error: "Failed to refresh this member's ESI access token — they may need to log in again." });
  }

  await kvSet(`${prefix}:${characterId}:token`, {
    ...tokenData,
    refreshToken: newToken.refresh_token || tokenData.refreshToken,
    lastSeen: Date.now(),
  }).catch(() => {});

  const result = await fetchFullMemberData(newToken.access_token, characterId);
  if (prefix === 'applicant') result.isApplicant = true;
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
    if (!r.ok) {
      const e = new Error(`ESI ${r.status} on ${path}`);
      e.status = r.status;
      throw e;
    }
    return r.json();
  }

  async function esiGetPaged(path, maxPages) {
    const all = [];
    for (let page = 1; page <= maxPages; page++) {
      const url = `${ESI}${path}${path.includes('?') ? '&' : '?'}datasource=tranquility&page=${page}`;
      const r = await fetch(url, { headers });
      if (!r.ok) {
        if (page === 1) {
          const e = new Error(`ESI ${r.status} on ${path}`);
          e.status = r.status;
          throw e;
        }
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

  async function section(name, fn, opts = {}) {
    try {
      out[name] = await fn();
    } catch (e) {
      if (opts.newScope && e.status === 403) {
        out.errors[name] = 'Not available — this permission isn\'t enabled on the app.';
      } else {
        out.errors[name] = e.message;
      }
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
    section('characterStats', () => esiGet(`/characters/${characterId}/stats/`), { newScope: true }),
    section('fwStats', () => esiGet(`/characters/${characterId}/fw/stats/`), { newScope: true }),
    section('bookmarks', () => esiGetPaged(`/characters/${characterId}/bookmarks/`, 2), { newScope: true }),
  ]);

  await resolveEverything(out, headers);
  delete out.assetsRaw;

  return out;
}

// Collects every reference ID scattered across every section — asset types/locations, corp
// history, contacts, mail senders, implants, clone bay locations, blueprints, current ship,
// standings, current system, contract parties/locations, industry job blueprints/products/
// facilities, bookmark locations — and resolves them all in one batch, so the frontend can show
// names instead of bare IDs without needing its own ESI calls. Also groups top-level assets
// (ones not packed inside another asset/ship) by their resolved station/structure name.
async function resolveEverything(out, headers) {
  const assets = out.assetsRaw || [];
  const itemIds = new Set(assets.map(a => a.item_id));
  const topLevelAssets = assets.filter(a => !itemIds.has(a.location_id));

  const ids = new Set();
  assets.forEach(a => ids.add(a.type_id));
  topLevelAssets.forEach(a => ids.add(a.location_id));
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
  (out.contracts || []).forEach(c => {
    if (c.issuer_id) ids.add(c.issuer_id);
    if (c.assignee_id) ids.add(c.assignee_id);
    if (c.start_location_id) ids.add(c.start_location_id);
    if (c.end_location_id) ids.add(c.end_location_id);
  });
  (out.industryJobs || []).forEach(j => {
    if (j.blueprint_type_id) ids.add(j.blueprint_type_id);
    if (j.product_type_id) ids.add(j.product_type_id);
    if (j.facility_id) ids.add(j.facility_id);
  });
  (out.miningLedger || []).forEach(m => { if (m.type_id) ids.add(m.type_id); });
  (out.bookmarks || []).forEach(b => {
    if (b.location_id) ids.add(b.location_id);
    if (b.item?.type_id) ids.add(b.item.type_id);
  });
  if (out.fwStats?.faction_id) ids.add(out.fwStats.faction_id);

  const idList = [...ids].filter(id => typeof id === 'number' && id > 0);
  const resolved = await resolveNamesBatch(idList);

  // /universe/names/ resolves NPC stations, systems, corps, characters etc. but never
  // player-owned structures (citadels) — those need a per-id authenticated lookup.
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

  const groups = {};
  for (const a of topLevelAssets) {
    const locName = resolved[a.location_id] || `Location #${a.location_id}`;
    if (!groups[locName]) groups[locName] = [];
    groups[locName].push({
      name: resolved[a.type_id] || `Type #${a.type_id}`,
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

function parseCookies(h) {
  const c = {};
  h.split(';').forEach(p => { const [k, ...v] = p.trim().split('='); if (k) c[k.trim()] = decodeURIComponent(v.join('=')); });
  return c;
}
