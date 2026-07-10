// api/members.js
// Member admin operations — CEO only (purge also accepts CRON_SECRET). Consolidated
// from members-data.js/member-delete.js/member-purge.js to stay under Vercel Hobby's
// 12-serverless-function-per-deployment cap.
//
// GET  /api/members                               → list all registered members
// POST /api/members?action=delete&characterId=X   → delete one member's KV record
// POST /api/members?action=purge                  → purge members no longer in corp

import { kvKeys, kvMGet, kvDel } from './_kv.js';

const CORP_ID = 98800626;

export default async function handler(req, res) {
  if (req.method === 'GET') return listMembers(req, res);
  if (req.method === 'POST') {
    const action = req.query.action;
    if (action === 'delete') return deleteMember(req, res);
    if (action === 'purge') return purgeMembers(req, res);
    return res.status(400).json({ error: 'Unknown action' });
  }
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

async function listMembers(req, res) {
  if (!(await requireCeo(req, res))) return;

  const metaKeys = await kvKeys('member:*:meta').catch(() => []);
  if (!metaKeys.length) return res.status(200).json({ members: [] });

  let values;
  try {
    values = await kvMGet(metaKeys);
  } catch (e) {
    console.error('members: kvMGet failed for', metaKeys.length, 'keys —', e.message);
    return res.status(500).json({ error: 'Failed to read member records: ' + e.message });
  }
  const members = values.filter(Boolean);
  members.sort((a, b) => (b.registeredAt || 0) - (a.registeredAt || 0));

  // Declared alt groups (the PI link groups double as the alt registry).
  // Deduped by sorted-member signature since each group is mirrored per member.
  let groups = [];
  try {
    const groupKeys = await kvKeys('pi:group:*');
    if (groupKeys.length) {
      const docs = await kvMGet(groupKeys);
      const seen = new Set();
      for (const doc of docs) {
        if (!Array.isArray(doc?.members) || doc.members.length < 2) continue;
        const sorted = [...doc.members].map(String).sort();
        const sig = sorted.join(',');
        if (!seen.has(sig)) { seen.add(sig); groups.push(sorted); }
      }
    }
  } catch (e) {
    console.warn('members: group read failed —', e.message);
  }

  return res.status(200).json({ members, total: members.length, groups });
}

async function deleteMember(req, res) {
  if (!(await requireCeo(req, res))) return;

  const characterId = req.query.characterId;
  if (!characterId || !/^\d+$/.test(characterId)) {
    return res.status(400).json({ error: 'characterId must be numeric' });
  }

  const id = String(characterId);
  await Promise.all([
    kvDel(`member:${id}:token`),
    kvDel(`member:${id}:meta`),
    kvDel(`pi:planets:${id}`),
    kvDel(`pi:group:${id}`),
  ]);

  return res.status(200).json({ ok: true, deleted: id });
}

async function purgeMembers(req, res) {
  const cronSecret = req.headers['x-cron-secret'];
  const isCron = cronSecret && cronSecret === process.env.CRON_SECRET;
  if (!isCron) {
    if (!(await requireCeo(req, res))) return;
  }

  const whitelist = (process.env.WHITELIST_CHARACTER_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
  const tokenKeys = await kvKeys('member:*:token').catch(() => []);
  const purged = [];

  for (const key of tokenKeys) {
    const match = key.match(/^member:(\d+):token$/);
    if (!match) continue;
    const id = match[1];
    if (whitelist.includes(id)) continue;

    let isCorpMember = false;
    try {
      const info = await fetch(`https://esi.evetech.net/latest/characters/${id}/?datasource=tranquility`)
        .then(r => r.json());
      isCorpMember = info.corporation_id === CORP_ID;
    } catch (e) {
      console.warn('ESI corp membership check failed for', id, e.message);
    }
    if (isCorpMember) continue;

    await Promise.all([
      kvDel(`member:${id}:token`), kvDel(`member:${id}:meta`),
      kvDel(`pi:planets:${id}`), kvDel(`pi:group:${id}`),
    ]);
    purged.push(id);
  }

  return res.status(200).json({ ok: true, purged, purgedCount: purged.length });
}

function parseCookies(h) {
  const c = {};
  h.split(';').forEach(p => { const [k, ...v] = p.trim().split('='); if (k) c[k.trim()] = decodeURIComponent(v.join('=')); });
  return c;
}
