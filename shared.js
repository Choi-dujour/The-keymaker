// shared.js — small utilities reused across pages (starfield bg, HTML escaping, member count, corp id).

const CORP_ID = 98800626;

function esc(s) {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function initStarfield(canvasId, opts = {}) {
  const {
    density = 7000,
    rMin = 0.15, rSpread = 0.9,
    oMin = 0.05, oSpread = 0.35,
    alphaCap = 0.5,
    flickerAmp = 0.07,
    fullPageHeight = true,
  } = opts;

  const cv = document.getElementById(canvasId);
  const cx = cv.getContext('2d');
  let st = [];

  function rs() {
    cv.width = innerWidth;
    cv.height = fullPageHeight ? Math.max(document.body.scrollHeight, innerHeight) : innerHeight;
    st = Array.from({ length: Math.floor(cv.width * cv.height / density) }, () => ({
      x: Math.random() * cv.width,
      y: Math.random() * cv.height,
      r: Math.random() * rSpread + rMin,
      o: Math.random() * oSpread + oMin,
      f: Math.random() * 0.002 + 0.001,
      p: Math.random() * Math.PI * 2,
    }));
  }

  let fr = 0;
  (function draw() {
    cx.clearRect(0, 0, cv.width, cv.height);
    fr++;
    st.forEach(s => {
      const o = s.o + Math.sin(fr * s.f + s.p) * flickerAmp;
      cx.beginPath();
      cx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      cx.fillStyle = `rgba(200,200,255,${Math.max(0, Math.min(alphaCap, o))})`;
      cx.fill();
    });
    requestAnimationFrame(draw);
  })();

  rs();
  window.addEventListener('resize', rs);
}

// Auto-updates every element carrying data-hq with the corp's CURRENT in-game
// headquarters (public ESI: corporation → home_station_id → station). Modes:
//   data-hq="short"   → "Hek IV"          (system + planet, from the station name)
//   data-hq="station" → full station name
//   data-hq="sub"     → "Hek IV · Krusual Tribe Bureau"
// The hardcoded text in the HTML stays as fallback if ESI is unreachable.
// Cached in localStorage for 12h. Exposes the result on window.CORP_HQ and
// fires a 'corp-hq' event so pages (e.g. the galaxy map) can place markers.
async function initHqAuto() {
  let hq = null;
  try {
    const cached = JSON.parse(localStorage.getItem('keymaker_hq_v1') || 'null');
    if (cached && Date.now() - cached.ts < 43200e3) hq = cached;
  } catch {}
  if (!hq) {
    try {
      const corp = await fetch(`https://esi.evetech.net/latest/corporations/${CORP_ID}/?datasource=tranquility`).then(r => r.json());
      if (!corp.home_station_id) return;
      const st = await fetch(`https://esi.evetech.net/latest/universe/stations/${corp.home_station_id}/?datasource=tranquility`).then(r => r.json());
      if (!st.name) return;
      hq = { ts: Date.now(), station: st.name, systemId: st.system_id };
      try { localStorage.setItem('keymaker_hq_v1', JSON.stringify(hq)); } catch {}
    } catch (e) {
      console.warn('HQ fetch failed:', e.message);
      return;
    }
  }
  const parts = hq.station.split(' - ').map(s => s.trim());
  const short = parts[0];
  const operator = parts[parts.length - 1];
  document.querySelectorAll('[data-hq]').forEach(el => {
    const mode = el.dataset.hq;
    if (mode === 'station') el.textContent = hq.station;
    else if (mode === 'sub') el.textContent = short + ' · ' + operator;
    else el.textContent = short;
  });
  window.CORP_HQ = hq;
  window.dispatchEvent(new CustomEvent('corp-hq', { detail: hq }));
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initHqAuto);
else initHqAuto();

function loadMemberCount(elId, retries = 2) {
  fetch(`https://esi.evetech.net/latest/corporations/${CORP_ID}/?datasource=tranquility&_=${Date.now()}`, { cache: 'no-store' })
    .then(r => { if (!r.ok) throw new Error('ESI ' + r.status); return r.json(); })
    .then(d => {
      const el = document.getElementById(elId);
      if (d.member_count != null) el.textContent = d.member_count;
      else throw new Error('no member_count');
    })
    .catch(e => {
      console.warn('Member count fetch failed:', e.message);
      if (retries > 0) setTimeout(() => loadMemberCount(elId, retries - 1), 1500);
      else document.getElementById(elId).textContent = 'N/A';
    });
}
