// One-off vendoring tool: downloads the in-game PI import templates from
// MattFalahe/EVE-PI-Templates (MIT) and writes pi-templates.json at the repo
// root. Not part of the build — run manually with `node scripts/fetch-pi-templates.mjs`
// when upstream publishes new templates, then commit the regenerated file.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const REPO = 'MattFalahe/EVE-PI-Templates';
const RAW = `https://raw.githubusercontent.com/${REPO}/main/Templates`;
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

// File lists mirror the upstream tree (upstream mixes hyphen/en-dash and has a
// couple of "(CCU VI)" typos in filenames — we try variants below).
const DIRS = {
  'miner-ccu4': { dir: 'Miners CCU IV', files: [
    'Miner - Biofuels (CCU IV)', 'Miner - Biomass (CCU IV)', 'Miner - Chiral Structures (CCU IV)',
    'Miner - Industrial Fibers (CCU IV)', 'Miner - Oxidizing Compound (CCU IV)', 'Miner - Oxygen (CCU IV)',
    'Miner - Plasmoids (CCU IV)', 'Miner - Precious Metals (CCU IV)', 'Miner - Proteins (CCU IV)',
    'Miner - Silicon (CCU IV)', 'Miner - Toxic Metals (CCU VI)', 'Miner - Water (CCU IV)',
    'Miner – Bacteria (CCU IV)', 'Miner – Electrolytes (CCU VI)', 'Miner – Reactive Metals (CCU IV)',
  ]},
  'miner-ccu5': { dir: 'Miners CCU V', files: [
    'Miner - Biofuels (CCU V)', 'Miner - Biomass (CCU V)', 'Miner - Chiral Structures (CCU V)',
    'Miner - Industrial Fibers (CCU V)', 'Miner - Oxidizing Compound (CCU V)', 'Miner - Oxygen (CCU V)',
    'Miner - Plasmoids (CCU V)', 'Miner - Precious Metals (CCU V)', 'Miner - Proteins (CCU V)',
    'Miner - Silicon (CCU V)', 'Miner - Toxic Metals (CCU V)', 'Miner - Water (CCU V)',
    'Miner – Bacteria (CCU V)', 'Miner – Electrolytes (CCU V)', 'Miner – Reactive Metals (CCU V)',
  ]},
  'factory-p2': { dir: 'Factory P2', files: [
    'Factory – Biocells', 'Factory – Construction Blocks', 'Factory – Consumer Electronics',
    'Factory – Coolant', 'Factory – Enriched Uranium', 'Factory – Fertilizer',
    'Factory – Genetically Enhanced Livestock', 'Factory – Livestock', 'Factory – Mechanical Parts',
    'Factory – Microfiber Shielding', 'Factory – Miniature Electronics', 'Factory – Nanites',
    'Factory – Oxides', 'Factory – Polyaramids', 'Factory – Polytextiles', 'Factory – Rocket Fuel',
    'Factory – Silicate Glass', 'Factory – Superconductors', 'Factory – Supertensile Plastics',
    'Factory – Synthetic Oil', 'Factory – Test Cultures', 'Factory – Transmitter',
    'Factory – Viral Agent', 'Factory – Water-Cooled CPU',
  ]},
  'factory-p3': { dir: 'Factory P3', files: [
    'Factory – Biotech Research Reports', 'Factory – Camera Drones', 'Factory – Condensates',
    'Factory – Cryoprotectant Solution', 'Factory – Data Chips', 'Factory – Gel-Matrix Biopaste',
    'Factory – Guidance Systems', 'Factory – Hazmat Detection Systems', 'Factory – Hermetic Membranes',
    'Factory – High-Tech Transmitters', 'Factory – Industrial Explosives', 'Factory – Neocoms',
    'Factory – Nuclear Reactors', 'Factory – Planetary Vehicles', 'Factory – Robotics',
    'Factory – Smartfab Units', 'Factory – Supercomputers', 'Factory – Synthetic Synapses',
    'Factory – Transcranial Microcontrollers', 'Factory – Ukomi Superconductors', 'Factory – Vaccines',
  ]},
  'factory-p4': { dir: 'Factory P4', files: [
    'Factory – Broadcast Node', 'Factory – Integrity Response Drones', 'Factory – Nano-Factory',
    'Factory – Organic Mortar Applicators', 'Factory – Recursive Computing Module',
    'Factory – Self-Harmonizing Power Core', 'Factory – Sterile Conduits', 'Factory – Wetware Mainframe',
  ]},
};

// SDE planet type ids -> ESI planet_type keys (must match pi-data.js)
const PLANET_BY_ID = { 11: 'temperate', 12: 'ice', 13: 'gas', 2014: 'oceanic', 2015: 'lava', 2016: 'barren', 2017: 'storm', 2063: 'plasma' };

// Load PI_DATA to derive which planets can actually extract a miner template's
// product (upstream Pln is just whatever planet the author saved from).
eval(fs.readFileSync(path.join(path.dirname(path.dirname(fileURLToPath(import.meta.url))), 'pi-data.js'), 'utf8')
  .replace('const PI_DATA', 'globalThis.PI_DATA'));
const P1_NAME_TO_ID = {};
for (const [id, c] of Object.entries(PI_DATA.commodities)) if (c.tier === 1) P1_NAME_TO_ID[c.name] = Number(id);
function validPlanetsForP1(p1Name) {
  const p1 = P1_NAME_TO_ID[p1Name];
  if (!p1) return null;
  const p0 = PI_DATA.schematics[PI_DATA.byOutput[p1]].inputs[0].t;
  return Object.entries(PI_DATA.planetTypes).filter(([, pt]) => pt.p0.includes(p0)).map(([k]) => k);
}

function nameVariants(base) {
  const set = new Set([base]);
  set.add(base.replace(/–/g, '-'));       // en-dash -> hyphen
  set.add(base.replace(/ - /g, ' – '));   // hyphen -> en-dash
  if (base.includes('(CCU VI)')) set.add(base.replace('(CCU VI)', '(CCU V)'));
  if (base.includes('(CCU IV)')) set.add(base.replace('(CCU IV)', '(CCU VI)'));
  if (base.includes('(CCU V)') && !base.includes('VI')) set.add(base.replace('(CCU V)', '(CCU VI)'));
  return [...set];
}

async function fetchTemplate(dir, base) {
  for (const variant of nameVariants(base)) {
    const url = `${RAW}/${encodeURIComponent(dir)}/${encodeURIComponent(variant)}.json`;
    const r = await fetch(url);
    if (r.ok) return await r.text();
  }
  return null;
}

const templates = [];
const failures = [];
for (const [category, { dir, files }] of Object.entries(DIRS)) {
  for (const base of files) {
    const raw = await fetchTemplate(dir, base);
    if (raw === null) { failures.push(`${dir}/${base}`); continue; }
    let parsed;
    try { parsed = JSON.parse(raw); } catch { failures.push(`${dir}/${base} (bad JSON)`); continue; }
    const name = base.replace(/^(Miner|Factory)\s*[-–]\s*/, '');
    const product = name.replace(/ \(CCU.*/, '');
    // Miners are tied to planets that can extract the product's P0; factories
    // have no extractors so any planet type works.
    const validPlanets = category.startsWith('miner') ? validPlanetsForP1(product) : null;
    if (category.startsWith('miner') && !validPlanets) { failures.push(`${dir}/${base} (unknown P1 "${product}")`); continue; }
    templates.push({
      name,
      category,
      product,
      validPlanets,
      cmdCtrLv: parsed.CmdCtrLv ?? null,
      comment: parsed.Cmt || '',
      pins: Array.isArray(parsed.P) ? parsed.P.length : 0,
      raw: JSON.stringify(parsed), // compact, byte-equivalent for the game importer
    });
    console.log(`ok  ${category}  ${base}  planets=${validPlanets ? validPlanets.join('/') : 'any'}`);
  }
}

if (failures.length) {
  console.error('\nFAILED downloads:\n' + failures.join('\n'));
  process.exit(1);
}

templates.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
const out = {
  source: `https://github.com/${REPO}`,
  license: 'MIT',
  fetchedAt: new Date().toISOString().slice(0, 10),
  templates,
};
fs.writeFileSync(path.join(root, 'pi-templates.json'), JSON.stringify(out));
console.log(`\nwrote pi-templates.json: ${templates.length} templates`);
