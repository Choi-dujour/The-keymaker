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
