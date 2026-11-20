/* ============================================================
   MeControlEng — Kit comum das ferramentas de Mecânica
   formulários, seções, canvas, tabelas e banco de materiais
   ============================================================ */
'use strict';
(function () {
  const CS = MS.CS, h = CS.h;
  const K = MS.MK = {};

  /* formulário: campos numéricos (prefixos SI aceitos) e listas */
  K.form = function (fields, onChange, opts = {}) {
    const st = {}, inputs = {};
    const el = h('div', { class: 'mform' + (opts.cols ? ' c' + opts.cols : '') });
    for (const f of fields) {
      if (f.sep) { el.append(h('div', { class: 'mf-sep' }, f.sep)); continue; }
      let inp;
      if (f.type === 'sel') {
        inp = h('select', {}, ...f.opts.map(o => (Array.isArray(o) ? h('option', { value: o[0] }, o[1]) : h('option', { value: o }, o))));
        inp.value = f.v;
        inp.addEventListener('change', () => { st[f.k] = inp.value; onChange && onChange(f.k); });
        st[f.k] = inp.value;
      } else {
        inp = h('input', { value: f.v, spellcheck: 'false' });
        const apply = () => {
          const x = MS.parseEng(inp.value);
          if (!isFinite(x)) { inp.classList.add('bad'); return; }
          inp.classList.remove('bad'); st[f.k] = x; onChange && onChange(f.k);
        };
        inp.addEventListener('change', apply);
        inp.addEventListener('keydown', e => { if (e.key === 'Enter') apply(); });
        st[f.k] = MS.parseEng(f.v);
      }
      inputs[f.k] = inp;
      el.append(h('label', { class: 'mf', title: f.tip || '' }, h('span', { html: f.l + (f.u ? ` <em>${f.u}</em>` : '') }), inp));
    }
    return {
      el, st, inputs,
      set(k, v) { const i = inputs[k]; if (!i) return; i.value = v; st[k] = i.tagName === 'SELECT' ? v : MS.parseEng(v); },
    };
  };

  /* seções internas (controle segmentado) */
  const lastSec = {};
  K.sections = function (body, key, list) {
    const seg = h('div', { class: 'seg sec-seg' });
    const area = h('div', { class: 'sec-area' });
    let cleanups = [];
    const show = id => {
      cleanups.forEach(f => f()); cleanups = [];
      lastSec[key] = id;
      seg.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.s === id));
      area.innerHTML = '';
      const s = list.find(x => x.id === id) || list[0];
      try { s.render(area, f => cleanups.push(f)); } catch (e) { area.innerHTML = `<div class="err pad">Erro: ${e.message}</div>`; console.error(e); }
    };
    for (const s of list) seg.append(h('button', { 'data-s': s.id, onclick: () => show(s.id) }, s.label));
    body.append(seg, area);
    show(lastSec[key] || list[0].id);
    return () => cleanups.forEach(f => f());
  };

  /* canvas responsivo com redesenho */
  K.canvas = function (host, height, draw) {
    const box = h('div', { class: 'mk-canvas', style: `height:${height}px` });
    const cv = h('canvas'); box.append(cv); host.append(box);
    const g = cv.getContext('2d');
    const o = { box, cv, g, W: 0, H: 0, draw };
    o.redraw = () => { if (!o.W) return; g.setTransform(o.dpr, 0, 0, o.dpr, 0, 0); g.clearRect(0, 0, o.W, o.H); o.draw && o.draw(g, o.W, o.H); };
    const rs = () => { const r = box.getBoundingClientRect(); if (r.width < 5) return; o.dpr = window.devicePixelRatio || 1; o.W = r.width; o.H = r.height; cv.width = r.width * o.dpr; cv.height = r.height * o.dpr; cv.style.width = r.width + 'px'; cv.style.height = r.height + 'px'; o.redraw(); };
    o.ro = new ResizeObserver(rs); o.ro.observe(box);
    return o;
  };
  /* laço de animação que para sozinho quando o elemento sai da tela */
  K.animate = function (el, fn) {
    let alive = true, t0 = performance.now();
    const loop = ts => { if (!alive) return; if (el.isConnected) { if (el.offsetParent) fn((ts - t0) / 1000); requestAnimationFrame(loop); } };
    requestAnimationFrame(loop);
    return () => { alive = false; };
  };

  K.table = (heads, rows, cls = '') => h('table', { class: 'tbl ' + cls }, h('tr', {}, ...heads.map(x => h('th', { html: x }))), ...rows.map(r => h('tr', {}, ...r.map(c => (c instanceof Node ? h('td', {}, c) : h('td', { html: String(c) }))))));
  K.f = (v, u = '', d = 4) => MS.fmt(v, u, d);
  K.n = (v, d = 4) => CS.fmtNum(v, d);
  K.verdict = (fs, lim = 1) => (fs >= 1.5 * lim ? `<b class="good">${K.n(fs, 3)}</b> ✓` : fs >= lim ? `<b class="warn">${K.n(fs, 3)}</b> (baixo)` : `<b class="bad">${K.n(fs, 3)}</b> ✗ falha`);

  /* função gama (Lanczos) */
  K.gamma = function gamma(z) {
    if (z < 0.5) return Math.PI / (Math.sin(Math.PI * z) * gamma(1 - z));
    z -= 1;
    const c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
    let x = c[0]; for (let i = 1; i < 9; i++) x += c[i] / (z + i);
    const t = z + 7.5;
    return Math.sqrt(2 * Math.PI) * Math.pow(t, z + 0.5) * Math.exp(-t) * x;
  };
  /* bissecção genérica */
  K.solve = (f, a, b, it = 80) => { let fa = f(a); for (let i = 0; i < it; i++) { const m = (a + b) / 2, fm = f(m); if (Math.sign(fm) === Math.sign(fa)) { a = m; fa = fm; } else b = m; } return (a + b) / 2; };
  K.linspace = (a, b, n) => [...Array(n)].map((_, i) => a + (b - a) * i / (n - 1));

  /* engrenagem desenhada em canvas */
  K.drawGear = function (g, cx, cy, r, z, ang, fill, stroke) {
    const m = 2 * r / z, ra = r + m, rf = r - 1.25 * m;
    g.beginPath();
    for (let i = 0; i < z; i++) {
      const a0 = ang + i / z * Math.PI * 2, da = Math.PI * 2 / z;
      const pts = [[rf, a0 - da * 0.5], [rf, a0 - da * 0.27], [ra, a0 - da * 0.13], [ra, a0 + da * 0.13], [rf, a0 + da * 0.27]];
      pts.forEach(([rr, a], j) => { const x = cx + rr * Math.cos(a), y = cy + rr * Math.sin(a); (i === 0 && j === 0) ? g.moveTo(x, y) : g.lineTo(x, y); });
    }
    g.closePath(); g.fillStyle = fill; g.fill(); g.strokeStyle = stroke; g.lineWidth = 1; g.stroke();
    g.beginPath(); g.arc(cx, cy, Math.max(3, rf * 0.25), 0, Math.PI * 2); g.fillStyle = '#0b1322'; g.fill();
    g.strokeStyle = '#ffd166'; g.lineWidth = 2; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + rf * 0.8 * Math.cos(ang), cy + rf * 0.8 * Math.sin(ang)); g.stroke();
  };

  /* ───────── banco de materiais (valores típicos, ordem de grandeza) ─────────
     rho kg/m³ · E GPa · sy MPa (escoamento; frágeis: resistência) · su MPa · el % ·
     k W/m·K · a µm/m·K · T °C (serviço máx.) · c custo relativo por kg (aço carbono = 1) */
  K.MATS = [
    ['Aço 1020 (laminado)', 'Metal ferroso', 7870, 205, 350, 420, 15, 52, 11.7, 400, 1],
    ['Aço 1045 (normalizado)', 'Metal ferroso', 7850, 205, 530, 625, 16, 50, 11.2, 400, 1.1],
    ['Aço 4140 (temperado e revenido)', 'Metal ferroso', 7850, 205, 655, 1020, 17, 43, 12.3, 450, 1.6],
    ['Aço inox 304', 'Metal ferroso', 8000, 193, 215, 505, 70, 16.2, 17.3, 870, 4],
    ['Aço inox 420 (temperado)', 'Metal ferroso', 7740, 200, 1360, 1720, 8, 24.9, 10.3, 600, 4.5],
    ['Ferro fundido cinzento', 'Metal ferroso', 7200, 110, 170, 250, 0.5, 46, 11, 350, 0.8],
    ['Ferro fundido nodular', 'Metal ferroso', 7100, 170, 310, 450, 12, 36, 11, 350, 1],
    ['Alumínio 1100', 'Metal não ferroso', 2710, 69, 34, 90, 35, 222, 23.6, 150, 2.5],
    ['Alumínio 6061-T6', 'Metal não ferroso', 2700, 69, 276, 310, 12, 167, 23.6, 150, 3],
    ['Alumínio 7075-T6', 'Metal não ferroso', 2810, 72, 503, 572, 11, 130, 23.4, 120, 5],
    ['Magnésio AZ31B', 'Metal não ferroso', 1770, 45, 200, 260, 15, 96, 26, 120, 4],
    ['Titânio Ti-6Al-4V', 'Metal não ferroso', 4430, 114, 880, 950, 14, 6.7, 8.6, 400, 25],
    ['Cobre (recozido)', 'Metal não ferroso', 8960, 117, 70, 220, 45, 398, 16.5, 200, 8],
    ['Latão C360', 'Metal não ferroso', 8500, 97, 310, 385, 25, 115, 20.5, 200, 6],
    ['Bronze fosforoso', 'Metal não ferroso', 8800, 110, 200, 350, 20, 50, 18, 250, 9],
    ['Inconel 718', 'Metal não ferroso', 8190, 200, 1100, 1375, 20, 11.4, 13, 700, 40],
    ['ABS', 'Polímero', 1050, 2.3, 40, 45, 25, 0.17, 90, 80, 2.5],
    ['Nylon PA66', 'Polímero', 1140, 2.8, 70, 80, 50, 0.25, 80, 100, 3.5],
    ['Policarbonato', 'Polímero', 1200, 2.4, 62, 70, 110, 0.2, 68, 120, 4],
    ['PEAD (polietileno)', 'Polímero', 950, 1.0, 26, 30, 500, 0.45, 150, 80, 1.5],
    ['PTFE (Teflon)', 'Polímero', 2200, 0.5, 15, 25, 300, 0.25, 120, 250, 15],
    ['PEEK', 'Polímero', 1300, 3.6, 100, 110, 30, 0.25, 47, 250, 90],
    ['Borracha natural', 'Elastômero', 930, 0.003, 15, 20, 500, 0.15, 200, 80, 3],
    ['Alumina (Al₂O₃)', 'Cerâmica', 3950, 380, 330, 330, 0, 30, 8.1, 1700, 20],
    ['Carbeto de silício (SiC)', 'Cerâmica', 3100, 410, 450, 450, 0, 120, 4.0, 1600, 30],
    ['Vidro soda-cal', 'Cerâmica', 2500, 70, 50, 50, 0, 1.0, 9, 500, 1.5],
    ['Concreto (tração)', 'Cerâmica', 2400, 30, 3, 3, 0, 1.7, 12, 300, 0.1],
    ['CFRP (fibra de carbono, quase-isotrópico)', 'Compósito', 1600, 70, 600, 600, 1.5, 5, 2, 120, 40],
    ['GFRP (fibra de vidro)', 'Compósito', 1900, 25, 300, 300, 2, 0.4, 15, 120, 4],
    ['Madeira (pinho, ao longo das fibras)', 'Natural', 500, 10, 40, 80, 1, 0.12, 5, 100, 1],
  ].map(a => ({ nome: a[0], classe: a[1], rho: a[2], E: a[3], sy: a[4], su: a[5], el: a[6], k: a[7], a: a[8], T: a[9], c: a[10] }));
  K.CLASS_COL = { 'Metal ferroso': '#9fb4d0', 'Metal não ferroso': '#ff9f1c', 'Polímero': '#3ddc84', 'Elastômero': '#a0e426', 'Cerâmica': '#c77dff', 'Compósito': '#4fb3ff', 'Natural': '#f78c6b' };
  K.matOpts = (filter = () => true) => K.MATS.map((m, i) => [String(i), m.nome]).filter((_, i) => filter(K.MATS[i]));
})();
