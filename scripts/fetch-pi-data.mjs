// One-off generator: rebuilds pi-data.js at the repo root from the official
// EVE Online SDE (planetSchematics/types/groups YAML), obtained via the
// eve-online-sde npm package. Not part of the build — run manually when CCP
// changes PI data (it has been stable for years):
//   npm i -D js-yaml && node scripts/fetch-pi-data.mjs
// EVE data © CCP hf., redistributed under the CCP Developer License.
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

let yaml;
try { yaml = await import('js-yaml'); }
catch { console.error('js-yaml missing — run: npm i -D js-yaml'); process.exit(1); }

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'eve-sde-'));

// ---- 0. Download + extract the SDE fsd files ------------------------------
console.log('resolving eve-online-sde on npm…');
const meta = await fetch('https://registry.npmjs.org/eve-online-sde').then(r => r.json());
const tarball = meta.versions[meta['dist-tags'].latest].dist.tarball;
console.log('downloading', tarball);
const buf = Buffer.from(await fetch(tarball).then(r => r.arrayBuffer()));
const tgz = path.join(work, 'sde.tgz');
fs.writeFileSync(tgz, buf);
execFileSync('tar', ['-xzf', tgz, '-C', work,
  'package/sde/fsd/planetSchematics.yaml', 'package/sde/fsd/types.yaml', 'package/sde/fsd/groups.yaml']);
const FSD = path.join(work, 'package/sde/fsd');

// ---- 1. Schematics ---------------------------------------------------------
const rawSchem = yaml.load(fs.readFileSync(`${FSD}/planetSchematics.yaml`, 'utf8'));
const schematics = {};
const typeIds = new Set();
for (const [sid, s] of Object.entries(rawSchem)) {
  let output = null, qty = 0;
  const inputs = [];
  for (const [tid, t] of Object.entries(s.types)) {
    typeIds.add(Number(tid));
    if (t.isInput) inputs.push({ t: Number(tid), q: t.quantity });
    else { output = Number(tid); qty = t.quantity; }
  }
  inputs.sort((a, b) => a.t - b.t);
  schematics[sid] = { name: s.nameID.en, cycle: s.cycleTime, output, qty, inputs };
}
console.log('schematics:', Object.keys(schematics).length, '— commodity types:', typeIds.size);

// ---- 2. Tier from the chain graph (P0 = never an output) -------------------
const byOutput = {};
for (const [sid, s] of Object.entries(schematics)) byOutput[s.output] = Number(sid);
const tierCache = new Map();
function tierOf(tid) {
  if (tierCache.has(tid)) return tierCache.get(tid);
  const sid = byOutput[tid];
  const tier = sid == null ? 0 : 1 + Math.max(...schematics[sid].inputs.map(i => tierOf(i.t)));
  tierCache.set(tid, tier);
  return tier;
}
for (const tid of typeIds) tierOf(tid);

// ---- 3. Names/volumes from types.yaml (streamed — the file is ~140 MB) -----
const PLANET_TYPE_IDS = { temperate: 11, ice: 12, gas: 13, oceanic: 2014, lava: 2015, barren: 2016, storm: 2017, plasma: 2063 };
const wanted = new Set([...typeIds, ...Object.values(PLANET_TYPE_IDS)]);
const typeInfo = {};
{
  const stream = fs.createReadStream(`${FSD}/types.yaml`, { encoding: 'utf8' });
  let buf2 = '', curId = null, curLines = null;
  const finishBlock = () => {
    if (curId === null || !wanted.has(curId)) return;
    const doc = yaml.load(curLines.join('\n'));
    typeInfo[curId] = { name: doc.name.en, volume: doc.volume, groupID: doc.groupID };
  };
  await new Promise((res, rej) => {
    stream.on('data', chunk => {
      buf2 += chunk;
      const lines = buf2.split('\n');
      buf2 = lines.pop();
      for (const line of lines) {
        const m = /^(\d+):\s*$/.exec(line);
        if (m) { finishBlock(); curId = Number(m[1]); curLines = []; }
        else if (curLines && wanted.has(curId)) curLines.push(line);
      }
    });
    stream.on('end', () => { finishBlock(); res(); });
    stream.on('error', rej);
  });
}
console.log('resolved types:', Object.keys(typeInfo).length, 'of', wanted.size);
if (Object.keys(typeInfo).length !== wanted.size) throw new Error('some typeIds missing from types.yaml');

// ---- 4. Cross-check tier vs SDE category (42 = P0 resources, 43 = P1-P4) ---
const groups = yaml.load(fs.readFileSync(`${FSD}/groups.yaml`, 'utf8'));
for (const tid of typeIds) {
  const cat = groups[typeInfo[tid].groupID]?.categoryID;
  const t = tierCache.get(tid);
  if (!((t === 0 && cat === 42) || (t > 0 && cat === 43)))
    throw new Error(`tier check failed: type ${tid} (${typeInfo[tid].name}) tier=${t} category=${cat}`);
}

// ---- 5. Planet type -> extractable P0 --------------------------------------
// This mapping is not in the public SDE; it is the canonical, unchanged-since-2010
// extraction table, cross-validated against the vendored miner templates by
// scripts/fetch-pi-templates.mjs (each product's P0 must be extractable on the
// template's planets).
const EXTRACTABLES = {
  temperate: ['Aqueous Liquids', 'Autotrophs', 'Carbon Compounds', 'Complex Organisms', 'Microorganisms'],
  ice:       ['Aqueous Liquids', 'Heavy Metals', 'Microorganisms', 'Noble Gas', 'Planktic Colonies'],
  gas:       ['Aqueous Liquids', 'Base Metals', 'Ionic Solutions', 'Noble Gas', 'Reactive Gas'],
  oceanic:   ['Aqueous Liquids', 'Carbon Compounds', 'Complex Organisms', 'Microorganisms', 'Planktic Colonies'],
  lava:      ['Base Metals', 'Felsic Magma', 'Heavy Metals', 'Non-CS Crystals', 'Suspended Plasma'],
  barren:    ['Aqueous Liquids', 'Base Metals', 'Carbon Compounds', 'Microorganisms', 'Noble Metals'],
  storm:     ['Aqueous Liquids', 'Base Metals', 'Ionic Solutions', 'Noble Gas', 'Suspended Plasma'],
  plasma:    ['Base Metals', 'Heavy Metals', 'Noble Metals', 'Non-CS Crystals', 'Suspended Plasma'],
};
const nameToId = {};
for (const tid of typeIds) if (tierCache.get(tid) === 0) nameToId[typeInfo[tid].name] = tid;
const planetTypes = {};
for (const [ptype, resNames] of Object.entries(EXTRACTABLES)) {
  const p0 = resNames.map(n => {
    if (!nameToId[n]) throw new Error(`P0 name not found in SDE: "${n}"`);
    return nameToId[n];
  });
  planetTypes[ptype] = { name: typeInfo[PLANET_TYPE_IDS[ptype]].name.replace(/^Planet \((.*)\)$/, '$1'), typeId: PLANET_TYPE_IDS[ptype], p0 };
}
const covered = new Set(Object.values(planetTypes).flatMap(pt => pt.p0));
for (const [name, tid] of Object.entries(nameToId))
  if (!covered.has(tid)) throw new Error(`P0 ${name} not extractable on any planet type`);

// ---- 6. Emit pi-data.js -----------------------------------------------------
const commodities = {};
for (const tid of [...typeIds].sort((a, b) => a - b))
  commodities[tid] = { name: typeInfo[tid].name, tier: tierCache.get(tid), volume: typeInfo[tid].volume };

const out = `// PI static dataset — generated from the official EVE Online SDE
// (planetSchematics.yaml + types.yaml). Do not edit by hand; regenerate with
// scripts/fetch-pi-data.mjs. EVE data © CCP hf., used under the CCP Developer License.
const PI_DATA = {
  planetTypes: ${JSON.stringify(planetTypes, null, 1)},
  commodities: ${JSON.stringify(commodities, null, 1)},
  schematics: ${JSON.stringify(schematics, null, 1)}
};
// typeId -> schematicId that produces it
PI_DATA.byOutput = {};
for (const [sid, s] of Object.entries(PI_DATA.schematics)) PI_DATA.byOutput[s.output] = Number(sid);
PI_DATA.tierColor = { 0: '#8080a0', 1: '#39FF14', 2: '#4488ff', 3: '#ffcc33', 4: '#ff4455' };
`;
fs.writeFileSync(path.join(root, 'pi-data.js'), out);
fs.rmSync(work, { recursive: true, force: true });
console.log('wrote pi-data.js:', out.length, 'bytes');
