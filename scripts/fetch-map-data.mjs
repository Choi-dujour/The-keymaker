// One-off generator: builds map-data.json (systems, stargate jumps, regions)
// for /map.html from the official EVE Online SDE via the eve-online-sde npm
// package. Not part of the build — rerun when CCP adds systems, then commit:
//   node scripts/fetch-map-data.mjs
// Set SDE_DIR to a pre-extracted package/ dir to skip the ~98 MB download.
// EVE data © CCP hf., redistributed under the CCP Developer License.
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

// ---- 0. Obtain the SDE tree ------------------------------------------------
let sdeRoot = process.env.SDE_DIR;
let work = null;
if (!sdeRoot) {
  work = fs.mkdtempSync(path.join(os.tmpdir(), 'eve-sde-'));
  console.log('resolving eve-online-sde on npm…');
  const meta = await fetch('https://registry.npmjs.org/eve-online-sde').then(r => r.json());
  const tarball = meta.versions[meta['dist-tags'].latest].dist.tarball;
  console.log('downloading', tarball);
  const buf = Buffer.from(await fetch(tarball).then(r => r.arrayBuffer()));
  const tgz = path.join(work, 'sde.tgz');
  fs.writeFileSync(tgz, buf);
  execFileSync('tar', ['-xzf', tgz, '-C', work, 'package/sde/universe/eve', 'package/sde/bsd/invUniqueNames.yaml']);
  sdeRoot = path.join(work, 'package');
}
const UNIVERSE = path.join(sdeRoot, 'sde/universe/eve'); // k-space only (no wormhole/abyssal/void)
const NAMES_YAML = path.join(sdeRoot, 'sde/bsd/invUniqueNames.yaml');

// ---- 1. Canonical names (folder names lack spaces: "BlackRise") ------------
// invUniqueNames.yaml is a flat list of {groupID, itemID, itemName} — line-scan
// it instead of YAML-parsing 22 MB.
const nameById = new Map();
{
  let itemID = null;
  for (const line of fs.readFileSync(NAMES_YAML, 'utf8').split('\n')) {
    let m = /^ {2}itemID: (\d+)/.exec(line);
    if (m) { itemID = Number(m[1]); continue; }
    m = /^ {2}itemName: (.*)$/.exec(line);
    if (m && itemID !== null) {
      // only regions (10M) and solar systems (30M) are needed
      if ((itemID >= 10000000 && itemID < 11000000) || (itemID >= 30000000 && itemID < 31000000)) {
        let name = m[1].trim();
        if (name.startsWith("'") || name.startsWith('"')) name = name.slice(1, -1);
        nameById.set(itemID, name);
      }
      itemID = null;
    }
  }
  console.log('unique names loaded:', nameById.size);
}

// ---- 2. Pass 1 — walk regions/constellations/systems -----------------------
// solarsystem.yaml files are big (all planet/moon stats); scan only the root-
// indented fields we need instead of YAML-parsing ~5,400 large documents.
function parseSystemYaml(file) {
  const out = { id: null, sec: null, center: [], gates: {} };
  let mode = null; // 'center' | 'stargates' | null
  let curGate = null;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    if (/^[A-Za-z]/.test(line)) { // any column-0 key resets block mode
      mode = null; curGate = null;
      let m = /^solarSystemID: (\d+)/.exec(line);
      if (m) { out.id = Number(m[1]); continue; }
      m = /^security: (-?[\d.eE+-]+)/.exec(line);
      if (m) { out.sec = Number(m[1]); continue; }
      if (/^center:/.test(line)) { mode = 'center'; continue; }
      if (/^stargates:/.test(line)) { mode = 'stargates'; continue; }
      continue;
    }
    if (mode === 'center') {
      const m = /^- (-?[\d.eE+]+)/.exec(line);
      if (m && out.center.length < 3) out.center.push(Number(m[1]));
    } else if (mode === 'stargates') {
      let m = /^ {2}(\d+):/.exec(line);
      if (m) { curGate = Number(m[1]); continue; }
      m = /^ {4}destination: (\d+)/.exec(line);
      if (m && curGate !== null) out.gates[curGate] = Number(m[1]);
    }
  }
  return out;
}

const regions = [];
const systems = [];
const gateOwner = new Map(); // stargateId -> system index
const gateDest = [];         // [systemIndex, destinationGateId]

for (const regionDir of fs.readdirSync(UNIVERSE).sort()) {
  const regionPath = path.join(UNIVERSE, regionDir);
  if (!fs.statSync(regionPath).isDirectory()) continue;
  const regionYaml = fs.readFileSync(path.join(regionPath, 'region.yaml'), 'utf8');
  const regionId = Number(/regionID: (\d+)/.exec(regionYaml)[1]);
  const r = regions.push([regionId, nameById.get(regionId) || regionDir]) - 1;

  for (const constDir of fs.readdirSync(regionPath).sort()) {
    const constPath = path.join(regionPath, constDir);
    if (!fs.statSync(constPath).isDirectory()) continue;
    for (const sysDir of fs.readdirSync(constPath).sort()) {
      const sysPath = path.join(constPath, sysDir);
      if (!fs.statSync(sysPath).isDirectory()) continue;
      const doc = parseSystemYaml(path.join(sysPath, 'solarsystem.yaml'));
      if (doc.id === null || doc.center.length !== 3) throw new Error(`bad solarsystem.yaml in ${sysPath}`);
      const i = systems.length;
      systems.push({ id: doc.id, name: nameById.get(doc.id) || sysDir, sec: doc.sec, r, center: doc.center });
      for (const [gid, dest] of Object.entries(doc.gates)) {
        gateOwner.set(Number(gid), i);
        gateDest.push([i, dest]);
      }
    }
  }
}
console.log('regions:', regions.length, '— systems:', systems.length, '— gates:', gateDest.length);

// ---- 3. Pass 2 — resolve destination gates to systems, dedupe edges --------
const seen = new Set();
const jumps = [];
let unresolved = 0;
for (const [i, destGate] of gateDest) {
  const j = gateOwner.get(destGate);
  if (j === undefined) { unresolved++; continue; } // gate to non-k-space (shouldn't happen)
  if (i === j) continue;
  const key = i < j ? i * 100000 + j : j * 100000 + i;
  if (!seen.has(key)) { seen.add(key); jumps.push(i < j ? [i, j] : [j, i]); }
}
console.log('jumps:', jumps.length, '— unresolved gates:', unresolved);

// ---- 4. Emit compact column-array JSON --------------------------------------
const LY = 9.4607e15; // meters per light-year
const q = v => Math.round(v / LY * 10) / 10;
const out = {
  source: 'EVE Online SDE (eve-online-sde npm package)',
  generatedAt: new Date().toISOString().slice(0, 10),
  cols: { regions: ['id', 'name'], systems: ['id', 'name', 'sec10', 'regionIndex', 'x', 'y', 'z'] },
  regions,
  systems: systems.map(s => [s.id, s.name, Math.round(s.sec * 10), s.r, q(s.center[0]), q(s.center[1]), q(s.center[2])]),
  jumps, // pairs of system array indices, undirected, deduped
};

// ---- 5. Sanity assertions ----------------------------------------------------
const byId = new Map(systems.map((s, i) => [s.id, i]));
function assert(cond, msg) { if (!cond) throw new Error('ASSERT: ' + msg); }
assert(systems.length >= 5200 && systems.length <= 5700, `system count ${systems.length}`);
assert(jumps.length >= 6000 && jumps.length <= 8500, `jump count ${jumps.length}`);
assert(byId.has(30000142), 'Jita missing');
assert(byId.has(30002053), 'Hek missing');
assert(systems[byId.get(30000142)].name === 'Jita', 'Jita name mismatch');
assert(regions.some(([, n]) => n === 'Black Rise'), 'region names not resolved');
const jita = byId.get(30000142), perimeter = byId.get(30000144);
assert(jumps.some(([a, b]) => (a === jita && b === perimeter) || (a === perimeter && b === jita)), 'Jita↔Perimeter edge missing');
assert(jumps.every(([a, b]) => a >= 0 && b < systems.length), 'jump index out of range');

const json = JSON.stringify(out);
fs.writeFileSync(path.join(root, 'map-data.json'), json);
if (work) fs.rmSync(work, { recursive: true, force: true });
console.log(`wrote map-data.json: ${(json.length / 1024).toFixed(0)} KB`);
