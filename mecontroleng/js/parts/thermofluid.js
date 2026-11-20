/* ============================================================
   MeControlEng — Domínios térmico e fluídico (hidráulico)
   Térmico : nó = temperatura T [°C]      ramo = fluxo de calor q [W]
   Fluídico: nó = pressão p [Pa] (manom.) ramo = vazão Q [m³/s]
     R térmica (K/W) ↔ resistor     C térmica = m·c (J/K) ↔ capacitor ao terra
     R hidráulica ↔ resistor        tanque A/(ρg) ↔ capacitor   inertância ρL/A ↔ indutor
     bomba (ω → Q) e cilindro (p → F) são giradores (Q = D·ω, τ = D·p; Q = A·v, F = A·p)
   ============================================================ */
'use strict';
(function () {
  const D = MS.Draw, WAVE = MS.WAVE, G0 = 9.81;
  const H2 = [[-2, 0], [2, 0]], V2 = [[0, -2], [0, 2]];
  const pins2 = (pp, d, n = ['1', '2']) => pp.map((p, i) => [p[0], p[1], d, n[i]]);
  const srcLeads = g => { D.line(g, 0, -2, 0, -1); D.line(g, 0, 1, 0, 2); D.circle(g, 0, 0, 1); };
  const rectR = (g, S, txt) => { D.line(g, -2, 0, -1.2, 0); D.line(g, 1.2, 0, 2, 0); D.rect(g, -1.2, -0.5, 2.4, 1); S.text(txt, 0, 0.03, 0.6); };
  const tColor = T => { const k = Math.max(0, Math.min(1, (T - 15) / 85)); return `rgb(${Math.round(60 + 195 * k)},${Math.round(120 - 60 * k + (k > 0.7 ? (k - 0.7) * 400 : 0))},${Math.round(230 - 210 * k)})`; };

  Object.assign(MS.DEFS, {
    /* ════════ TÉRMICO ════════ */
    RTH: {
      name: 'Resistência térmica (condução)', cat: 'Térmico', prefix: 'Rθ', pins: pins2(H2, 'H'), bbox: [-2, -0.6, 2, 0.6], lbl: [0, -1.1],
      params: [{ k: 'R', l: 'Resistência térmica', u: 'K/W', def: '2' }],
      val: c => c.params.R + ' K/W',
      draw(g, c, S) { rectR(g, S, 'Rθ'); },
      build(x) { const e = { t: 'G', a: x.n(0), b: x.n(1), g: 1 / x.pos('R', x.P('R')) }; x.els.push(e); x.Q('q', 'q', 'W', X => e.g * (X(e.a) - X(e.b))); },
      view3d(k) { const m = k.M.heat.clone(); const b = k.mesh(new k.T.BoxGeometry(3.4, 0.35, 0.6), m); b.position.y = k.TH; k.g.add(b); k.up(f => { if (f.has) f.tcolor(m.color, k.nodes[0]); }); },
    },
    CONV: {
      name: 'Convecção (h·A)', cat: 'Térmico', prefix: 'Rh', pins: pins2(H2, 'H'), bbox: [-2, -0.8, 2, 0.8], lbl: [0, -1.3],
      params: [{ k: 'h', l: 'Coef. de convecção h', u: 'W/(m²·K)', def: '10' }, { k: 'A', l: 'Área de troca', u: 'm²', def: '0.05' }],
      val: c => `h=${c.params.h} A=${c.params.A}`,
      draw(g) {
        D.line(g, -2, 0, -1.2, 0); D.line(g, 1.2, 0, 2, 0);
        for (const y of [-0.45, 0, 0.45]) { g.beginPath(); for (let i = 0; i <= 24; i++) { const x = -1.2 + 2.4 * i / 24; const yy = y + 0.12 * Math.sin(i / 24 * Math.PI * 4); i ? g.lineTo(x, yy) : g.moveTo(x, yy); } g.stroke(); }
      },
      build(x) { const e = { t: 'G', a: x.n(0), b: x.n(1), g: x.pos('h', x.P('h')) * x.pos('A', x.P('A')) }; x.els.push(e); x.Q('q', 'q', 'W', X => e.g * (X(e.a) - X(e.b))); },
      view3d(k) { for (let i = 0; i < 6; i++) { const f = k.mesh(new k.T.BoxGeometry(0.08, 0.9, 1.2), k.M.steel); f.position.set(-1.2 + i * 0.48, k.TH + 0.3, 0); k.g.add(f); } k.lead(k.V(-2, k.TH, 0), k.V(2, k.TH, 0), 0.06, k.M.heat); },
    },
    CTH: {
      name: 'Capacitância térmica (corpo)', cat: 'Térmico', prefix: 'Cθ', pins: pins2(H2, 'H'), same: [[0, 1]], bbox: [-2, -1.1, 2, 1.1], lbl: [0, -1.6],
      params: [{ k: 'm', l: 'Massa', u: 'kg', def: '0.5' }, { k: 'cp', l: 'Calor específico', u: 'J/(kg·K)', def: '900' }, { k: 'T0', l: 'Temperatura inicial', u: '°C', def: '25' }],
      val: c => `C=${MS.fmt(MS.parseEng(c.params.m) * MS.parseEng(c.params.cp), 'J/K')}`,
      draw(g, c, S) {
        D.line(g, -2, 0, -1.1, 0); D.line(g, 1.1, 0, 2, 0);
        const T = S.q ? S.q('T') : null;
        D.rect(g, -1.1, -1.1, 2.2, 2.2, T != null ? tColor(T) : 'rgba(255,107,107,0.15)'); S.text('m·c', 0, 0.05, 0.7);
      },
      live(g, c, S) { const T = S.q('T'); if (T == null) return; g.save(); g.rotate(-c.rot * Math.PI / 2); g.fillStyle = '#fff'; g.font = '0.55px "Share Tech Mono", monospace'; g.textAlign = 'center'; g.fillText(MS.fmt(T, '°C', 3), 0, 1.75); g.restore(); },
      build(x) {
        const C = x.pos('m', x.P('m')) * x.pos('cp', x.P('cp'));
        const e = { t: 'C', a: x.n(0), b: 0, C, v0: x.P('T0') }; x.els.push(e);
        x.Q('q', 'q', 'W', () => e.i); x.Q('T', 'T', '°C', X => X(e.a));
      },
      view3d(k) { const m = k.M.heat.clone(); const b = k.mesh(new k.T.BoxGeometry(2.0, 1.4, 2.0), m); b.position.y = 0.7; k.g.add(b); k.up(f => f.tcolor(m.color, k.nodes[0])); },
    },
    TSRC: {
      name: 'Fonte de temperatura (ambiente)', cat: 'Térmico', prefix: 'Ta', pins: pins2(V2, 'H', ['+', '−']), bbox: [-1, -2, 1, 2], lbl: [1.3, -0.5],
      params: WAVE('°C', '25'), val: c => (c.params.forma === 'DC' ? c.params.val + ' °C' : c.params.forma),
      draw(g, c, S) { srcLeads(g); S.text('T', 0, 0.05, 1.0); },
      build(x) { const e = { t: 'V', a: x.n(0), b: x.n(1), fn: x.wave(), k: x.br() }; x.els.push(e); x.Q('q', 'q', 'W', (X, xv) => -xv[e.k]); },
      view3d(k) { const b = k.mesh(new k.T.BoxGeometry(1.4, 0.8, 1.4), k.M.wall); b.position.y = 0.4; k.g.add(b); const t = k.mesh(new k.T.CylinderGeometry(0.08, 0.08, 1.4, 10), new k.T.MeshStandardMaterial({ color: 0xff4d6d, emissive: 0x401020 })); t.position.y = 1.4; k.g.add(t); },
    },
    QSRC: {
      name: 'Fonte de calor (potência)', cat: 'Térmico', prefix: 'Pq', pins: pins2(V2, 'H', ['+', '−']), bbox: [-1, -2, 1, 2], lbl: [1.3, -0.5],
      params: WAVE('W', '20'), val: c => (c.params.forma === 'DC' ? c.params.val + ' W' : c.params.forma),
      draw(g) { srcLeads(g); D.arrow(g, 0, 0.6, 0, -0.6); g.beginPath(); for (let i = 0; i <= 12; i++) { const y = 0.6 - 1.2 * i / 12; const xx = 0.35 + 0.12 * Math.sin(i); i ? g.lineTo(xx, y) : g.moveTo(xx, y); } g.stroke(); },
      build(x) { const e = { t: 'I', a: x.n(0), b: x.n(1), fn: x.wave() }; x.els.push(e); x.Q('q', 'q', 'W', () => e.val); },
      view3d(k) { heaterCoil(k, 'q'); },
    },
    HGND: {
      name: 'Referência térmica (0 °C)', cat: 'Térmico', prefix: '', pins: [[0, 0, 'H', 'ref']], bbox: [-1, 0, 1, 1.1], lbl: null, ground: true,
      params: [], val: () => '', draw(g) { D.hatchGround(g); D.line(g, -0.4, 0.3, 0.4, 0.3); },
      view3d(k) { const p = k.mesh(new k.T.BoxGeometry(1.4, 0.1, 1.4), k.M.wall); p.position.set(0, 0.05, 0.4); k.g.add(p); },
    },
    HEATER: {
      name: 'Resistor de aquecimento (elétrico → térmico)', cat: 'Térmico', prefix: 'RH',
      pins: [[-3, -1, 'E', '+'], [-3, 1, 'E', '−'], [3, 0, 'H', 'calor']], bbox: [-3, -1.5, 3, 1.5], lbl: [0, -2.0],
      params: [{ k: 'R', l: 'Resistência elétrica', u: 'Ω', def: '10' }],
      val: c => c.params.R + 'Ω',
      draw(g) {
        D.rect(g, -2, -1.3, 2.8, 2.6, 'rgba(255,107,107,0.08)');
        D.line(g, -3, -1, -2, -1); D.line(g, -3, 1, -2, 1); D.zigV(g, -1, 1, -1.2, 3, 0.35);
        for (const y of [-0.6, 0, 0.6]) { g.beginPath(); for (let i = 0; i <= 10; i++) { const xx = -0.4 + 1.0 * i / 10; const yy = y + 0.12 * Math.sin(i * 1.3); i ? g.lineTo(xx, yy) : g.moveTo(xx, yy); } g.stroke(); }
        D.line(g, 0.8, 0, 3, 0);
      },
      build(x) {
        const R = x.pos('R', x.P('R')), a = x.n(0), b = x.n(1);
        x.els.push({ t: 'G', a, b, g: 1 / R });
        const q = { t: 'I', a: x.n(2), b: 0, val: 0 }; x.els.push(q);
        x.els.push({ t: 'CTRL', rhsOnly: true, init: () => { q.val = 0; }, pre: (t, Xp) => { const v = Xp(a) - Xp(b); q.val = v * v / R; } });
        x.Q('P', 'P', 'W', X => { const v = X(a) - X(b); return v * v / R; }); x.Q('I', 'I', 'A', X => (X(a) - X(b)) / R);
      },
      view3d(k) { heaterCoil(k, 'P'); k.lead(k.V(-3, k.EH, -1), k.V(-1, k.EH, -0.4), 0.04, k.M.wire); k.lead(k.V(-3, k.EH, 1), k.V(-1, k.EH, 0.4), 0.04, k.M.wire); k.lead(k.V(1, k.TH, 0), k.V(3, k.TH, 0), 0.07, k.M.heat); },
    },
    TSENS: {
      name: 'Sensor de temperatura (LM35)', cat: 'Térmico', prefix: 'TS', pins: [[-2, 0, 'H', 'T'], [2, 0, 'E', 'saída']], bbox: [-2, -0.9, 2, 0.9], lbl: [0, -1.4],
      params: [{ k: 'K', l: 'Ganho', u: 'V/°C', def: '10m' }],
      val: c => c.params.K + ' V/°C',
      draw(g, c, S) { D.line(g, -2, 0, -1, 0); D.line(g, 1, 0, 2, 0); D.rect(g, -1, -0.8, 2, 1.6, 'rgba(255,107,107,0.10)'); S.text('T→V', 0, 0.05, 0.55); },
      build(x) { x.els.push({ t: 'E', o: x.n(1), s: x.n(0), K: x.P('K'), k: x.br() }); },
      view3d(k) { const b = k.mesh(new k.T.CylinderGeometry(0.2, 0.2, 0.9, 12), k.M.dip); b.position.y = k.TH + 0.3; k.g.add(b); k.lead(k.V(-2, k.TH, 0), k.V(0, k.TH, 0), 0.05, k.M.heat); k.lead(k.V(0, k.EH, 0), k.V(2, k.EH, 0), 0.04, k.M.wire); },
    },

    /* ════════ FLUÍDICO ════════ */
    RHYD: {
      name: 'Resistência hidráulica (válvula/tubo)', cat: 'Fluídico', prefix: 'Rf', pins: pins2(H2, 'F'), bbox: [-2, -0.9, 2, 0.9], lbl: [0, -1.4],
      params: [{ k: 'R', l: 'Resistência Δp/Q', u: 'Pa·s/m³', def: '100meg' }],
      val: c => c.params.R,
      draw(g) { D.line(g, -2, 0, -0.8, 0); D.line(g, 0.8, 0, 2, 0); g.beginPath(); g.moveTo(-0.8, -0.6); g.lineTo(0.8, 0.6); g.lineTo(0.8, -0.6); g.lineTo(-0.8, 0.6); g.closePath(); g.stroke(); D.line(g, 0, 0, 0, -0.9); D.line(g, -0.35, -0.9, 0.35, -0.9); },
      build(x) { const e = { t: 'G', a: x.n(0), b: x.n(1), g: 1 / x.pos('R', x.P('R')) }; x.els.push(e); x.Q('Q', 'Q', 'm³/s', X => e.g * (X(e.a) - X(e.b))); },
      view3d(k) { valve3d(k); },
    },
    INERT: {
      name: 'Inertância (tubo longo)', cat: 'Fluídico', prefix: 'If', pins: pins2(H2, 'F'), bbox: [-2, -0.7, 2, 0.7], lbl: [0, -1.2],
      params: [{ k: 'L', l: 'Comprimento', u: 'm', def: '10' }, { k: 'A', l: 'Área da seção', u: 'm²', def: '1m' }, { k: 'rho', l: 'Massa específica', u: 'kg/m³', def: '1000' }],
      val: c => `L=${c.params.L}m`,
      draw(g) { D.line(g, -2, 0, -1.3, 0); D.line(g, 1.3, 0, 2, 0); for (let k = 0; k < 4; k++) { g.beginPath(); g.arc(-0.975 + 0.65 * k, 0, 0.32, Math.PI, 0); g.stroke(); } D.line(g, -1.3, 0.35, 1.3, 0.35); },
      build(x) {
        const I = x.P('rho') * x.pos('L', x.P('L')) / x.pos('A', x.P('A'));
        const e = { t: 'L', a: x.n(0), b: x.n(1), L: I, i0: 0, k: x.br() }; x.els.push(e); x.Q('Q', 'Q', 'm³/s', (X, xv) => xv[e.k]);
      },
      view3d(k) { const p = k.mesh(new k.T.TorusGeometry(0.8, 0.13, 10, 30), k.M.water); p.position.set(0, k.FH + 0.3, 0); p.rotation.x = Math.PI / 2; k.g.add(p); k.lead(k.V(-2, k.FH, 0), k.V(2, k.FH, 0), 0.12, k.M.pipe); },
    },
    TANK: {
      name: 'Tanque (capacitância hidráulica)', cat: 'Fluídico', prefix: 'TQ', pins: [[-2, 2, 'F', '1'], [2, 2, 'F', '2']], same: [[0, 1]], bbox: [-2, -2.2, 2, 2.2], lbl: [0, -2.7],
      params: [{ k: 'A', l: 'Área da base', u: 'm²', def: '0.5' }, { k: 'rho', l: 'Massa específica', u: 'kg/m³', def: '1000' }, { k: 'h0', l: 'Nível inicial', u: 'm', def: '0' }, { k: 'hmax', l: 'Altura do tanque (visual)', u: 'm', def: '2' }],
      val: c => `A=${c.params.A}m²`,
      draw(g, c, S) {
        D.line(g, -1.5, -2, -1.5, 1.4, 1.5, 1.4, 1.5, -2);
        D.line(g, -2, 2, -1, 2, -1, 1.4); D.line(g, 2, 2, 1, 2, 1, 1.4);
        const h = S.q ? S.q('h') : null, hm = MS.parseEng(c.params.hmax) || 2;
        const k = h == null ? 0.35 : Math.max(0, Math.min(1, h / hm));
        g.fillStyle = 'rgba(45,212,191,0.35)'; g.fillRect(-1.45, 1.35 - 3.3 * k, 2.9, 3.3 * k);
      },
      live(g, c, S) { const h = S.q('h'); if (h == null) return; g.save(); g.rotate(-c.rot * Math.PI / 2); g.fillStyle = '#9ff'; g.font = '0.55px "Share Tech Mono", monospace'; g.textAlign = 'center'; g.fillText('h=' + MS.fmt(h, 'm', 3), 0, -0.3); g.restore(); },
      build(x) {
        const rho = x.pos('rho', x.P('rho')), A = x.pos('A', x.P('A'));
        const e = { t: 'C', a: x.n(0), b: 0, C: A / (rho * G0), v0: rho * G0 * x.P('h0') }; x.els.push(e);
        x.Q('h', 'h', 'm', X => X(e.a) / (rho * G0)); x.Q('Q', 'Q', 'm³/s', () => e.i);
      },
      view3d(k) {
        const hm = MS.parseEng(k.c.params.hmax) || 2, H = 3.2, R = 1.6;
        const shell = k.mesh(new k.T.CylinderGeometry(R, R, H, 36, 1, true), k.M.tank); shell.position.y = H / 2 + 0.2; k.g.add(shell);
        const base = k.mesh(new k.T.CylinderGeometry(R + 0.05, R + 0.05, 0.2, 36), k.M.steel); base.position.y = 0.1; k.g.add(base);
        const water = k.mesh(new k.T.CylinderGeometry(R - 0.05, R - 0.05, 1, 36), k.M.water); water.position.y = 0.2; k.g.add(water);
        for (const xx of [-2, 2]) k.lead(k.V(xx, k.FH, 2), k.V(xx * 0.5, k.FH * 0.4, 1.0), 0.12, k.M.pipe);
        k.up(f => { const hh = Math.max(0.001, Math.min(1, f.sig(k.c.id, 'h') / hm)) * (H - 0.1); water.scale.y = hh; water.position.y = 0.2 + hh / 2; });
      },
    },
    PSRC: {
      name: 'Fonte de pressão', cat: 'Fluídico', prefix: 'Ps', pins: pins2(V2, 'F', ['+', '−']), bbox: [-1, -2, 1, 2], lbl: [1.3, -0.5],
      params: WAVE('Pa', '100k'), val: c => (c.params.forma === 'DC' ? c.params.val + ' Pa' : c.params.forma),
      draw(g, c, S) { srcLeads(g); S.text('p', 0, 0.05, 1.0); },
      build(x) { const e = { t: 'V', a: x.n(0), b: x.n(1), fn: x.wave(), k: x.br() }; x.els.push(e); x.Q('Q', 'Q', 'm³/s', (X, xv) => -xv[e.k]); },
      view3d(k) { pump3d(k, false); },
    },
    FSRC: {
      name: 'Fonte de vazão (bomba volumétrica)', cat: 'Fluídico', prefix: 'Qs', pins: pins2(V2, 'F', ['+', '−']), bbox: [-1, -2, 1, 2], lbl: [1.3, -0.5],
      params: WAVE('m³/s', '1m'), val: c => (c.params.forma === 'DC' ? c.params.val + ' m³/s' : c.params.forma),
      draw(g) { srcLeads(g); D.arrow(g, 0, 0.6, 0, -0.6); D.circle(g, 0, 0, 0.45); },
      build(x) { const e = { t: 'I', a: x.n(0), b: x.n(1), fn: x.wave() }; x.els.push(e); x.Q('Q', 'Q', 'm³/s', () => e.val); },
      view3d(k) { pump3d(k, false); },
    },
    FGND: {
      name: 'Referência de pressão (atmosfera)', cat: 'Fluídico', prefix: '', pins: [[0, 0, 'F', 'atm']], bbox: [-1, 0, 1, 1.2], lbl: null, ground: true,
      params: [], val: () => '',
      draw(g) { D.line(g, 0, 0, 0, 0.5); D.line(g, -1, 0.5, -1, 1.1, 1, 1.1, 1, 0.5); g.beginPath(); for (let i = 0; i <= 12; i++) { const xx = -0.9 + 1.8 * i / 12; const y = 0.8 + 0.08 * Math.sin(i * 1.6); i ? g.lineTo(xx, y) : g.moveTo(xx, y); } g.stroke(); },
      view3d(k) { const r = k.mesh(new k.T.BoxGeometry(1.6, 0.5, 1.6), k.M.water); r.position.set(0, 0.25, 0.6); k.g.add(r); },
    },
    PUMP: {
      name: 'Bomba acionada por eixo (ω → vazão)', cat: 'Fluídico', prefix: 'B', pins: [[-3, 0, 'R', 'eixo'], [3, 0, 'F', 'saída']], bbox: [-3, -1.3, 3, 1.3], lbl: [0, -1.8],
      params: [{ k: 'D', l: 'Deslocamento volumétrico', u: 'm³/rad', def: '10u' }],
      val: c => `D=${c.params.D}`,
      draw(g) {
        D.circle(g, 0, 0, 1.2, 'rgba(45,212,191,0.08)'); g.beginPath(); g.moveTo(-0.3, -0.9); g.lineTo(0.9, 0); g.lineTo(-0.3, 0.9); g.closePath(); g.stroke();
        g.save(); g.lineWidth *= 2; D.line(g, -3, 0, -1.2, 0); g.restore(); D.line(g, 1.2, 0, 3, 0);
      },
      build(x) {
        const Dv = x.P('D'), s = x.n(0), f = x.n(1);
        x.els.push({ t: 'GY', ent: [[f, s, -Dv], [s, f, Dv]] });
        x.Q('Q', 'Q', 'm³/s', X => Dv * X(s)); x.Q('tau', 'τ', 'N·m', X => Dv * X(f));
      },
      view3d(k) { pump3d(k, true); },
    },
    CYL: {
      name: 'Cilindro hidráulico (p → força)', cat: 'Fluídico', prefix: 'CL', pins: [[-3, 0, 'F', 'óleo'], [3, 0, 'T', 'haste']], bbox: [-3, -1.1, 3, 1.1], lbl: [0, -1.6],
      params: [{ k: 'A', l: 'Área do pistão', u: 'm²', def: '2m' }],
      val: c => `A=${c.params.A}m²`,
      draw(g) { D.rect(g, -2, -1, 2.6, 2, 'rgba(45,212,191,0.08)'); D.line(g, -3, 0, -2, 0); D.line(g, -0.2, -0.9, -0.2, 0.9); g.save(); g.lineWidth *= 2.2; D.line(g, -0.2, 0, 3, 0); g.restore(); },
      build(x) {
        const A = x.pos('A', x.P('A')), f = x.n(0), r = x.n(1);
        x.els.push({ t: 'GY', ent: [[f, r, A], [r, f, -A]] });
        x.Q('F', 'F', 'N', X => A * X(f)); x.Q('Q', 'Q', 'm³/s', X => A * X(r));
      },
      view3d(k) {
        const bar = k.mesh(new k.T.CylinderGeometry(0.75, 0.75, 2.8, 28), k.M.steel); bar.rotation.z = Math.PI / 2; bar.position.set(-0.6, k.AX, 0); k.g.add(bar);
        const cap = k.discX(0.8, 0.2, k.M.dark); cap.position.set(-2.0, k.AX, 0); k.g.add(cap);
        k.lead(k.V(-3, k.FH, 0), k.V(-2.1, k.AX, 0), 0.12, k.M.pipe);
        const mv = new k.T.Group(); k.g.add(mv);
        const pist = k.discX(0.7, 0.3, k.M.gear1); pist.position.set(0.2, k.AX, 0); mv.add(pist);
        mv.add(k.rod(k.V(0.2, k.AX, 0), k.V(3, k.AX, 0), 0.16, k.M.chrome).g);
        const foot = k.mesh(new k.T.BoxGeometry(2.6, k.AX - 0.7, 1.0), k.M.base); foot.position.set(-0.6, (k.AX - 0.7) / 2, 0); k.g.add(foot);
        k.up(f => { mv.position.x = Math.max(-1.0, Math.min(1.6, k.sx * k.disp(f, 1))); });
      },
    },
    PVALVE: {
      name: 'Válvula proporcional (comando elétrico)', cat: 'Fluídico', prefix: 'VP', pins: [[-2, 0, 'F', '1'], [2, 0, 'F', '2'], [0, -3, 'E', 'cmd']], bbox: [-2, -3, 2, 0.9], lbl: [1.2, -2.2],
      params: [{ k: 'Rmin', l: 'Resistência totalmente aberta', u: 'Pa·s/m³', def: '10meg' }, { k: 'Vmax', l: 'Tensão para abertura total', u: 'V', def: '10' }],
      val: c => `0–${c.params.Vmax}V`,
      draw(g) {
        D.line(g, -2, 0, -0.8, 0); D.line(g, 0.8, 0, 2, 0); g.beginPath(); g.moveTo(-0.8, -0.6); g.lineTo(0.8, 0.6); g.lineTo(0.8, -0.6); g.lineTo(-0.8, 0.6); g.closePath(); g.stroke();
        D.line(g, 0, 0, 0, -1.5); D.rect(g, -0.6, -2.3, 1.2, 0.8, 'rgba(79,179,255,0.1)'); D.line(g, 0, -2.3, 0, -3); D.line(g, -0.6, -2.3, 0.6, -1.5);
      },
      build(x) {
        const gmax = 1 / x.pos('Rmin', x.P('Rmin')), vmax = x.pos('Vmax', x.P('Vmax')), cmd = x.n(2);
        const e = { t: 'G', a: x.n(0), b: x.n(1), g: 1e-15, var: true }; x.els.push(e);
        const st = { u: 0 };
        x.els.push({ t: 'CTRL', init: () => { st.u = 0; e.g = 1e-15; }, pre: (t, Xp) => { st.u = Math.max(0, Math.min(1, Xp(cmd) / vmax)); e.g = gmax * st.u + 1e-15; } });
        x.Q('Q', 'Q', 'm³/s', X => e.g * (X(e.a) - X(e.b))); x.Q('ab', 'abertura', '%', () => 100 * st.u);
      },
      view3d(k) { const st = valve3d(k); k.lead(k.V(0, k.EH, -3), k.V(0, k.FH + 1.2, -0.3), 0.04, k.M.wire); k.up(f => { st.position.y = k.FH + 0.6 + 0.5 * f.sig(k.c.id, 'ab') / 100; }); },
    },
    LSENS: {
      name: 'Sensor de nível (p → V)', cat: 'Fluídico', prefix: 'LT', pins: [[-2, 0, 'F', 'p'], [2, 0, 'E', 'saída']], bbox: [-2, -0.9, 2, 0.9], lbl: [0, -1.4],
      params: [{ k: 'K', l: 'Ganho', u: 'V/m', def: '1' }, { k: 'rho', l: 'Massa específica', u: 'kg/m³', def: '1000' }],
      val: c => c.params.K + ' V/m',
      draw(g, c, S) { D.line(g, -2, 0, -1, 0); D.line(g, 1, 0, 2, 0); D.rect(g, -1, -0.8, 2, 1.6, 'rgba(45,212,191,0.10)'); S.text('h→V', 0, 0.05, 0.55); },
      build(x) { x.els.push({ t: 'E', o: x.n(1), s: x.n(0), K: x.P('K') / (x.pos('rho', x.P('rho')) * G0), k: x.br() }); },
      view3d(k) { const b = k.mesh(new k.T.CylinderGeometry(0.3, 0.3, 0.7, 14), k.M.relay); b.position.y = k.FH + 0.3; k.g.add(b); k.lead(k.V(-2, k.FH, 0), k.V(0, k.FH, 0), 0.1, k.M.pipe); k.lead(k.V(0, k.EH, 0), k.V(2, k.EH, 0), 0.04, k.M.wire); },
    },
  });

  /* ── peças 3D comuns ── */
  function heaterCoil(k, key) {
    const base = k.mesh(new k.T.BoxGeometry(2.2, 0.5, 1.6), new k.T.MeshStandardMaterial({ color: 0xe8e2d4, roughness: 0.9 })); base.position.y = 0.25; k.g.add(base);
    const m = new k.T.MeshStandardMaterial({ color: 0x8a3b1d, emissive: 0x000000, metalness: 0.6, roughness: 0.4 });
    const cl = k.coil(m, 0.28, 7, 0.06); cl.set(-0.9, 0.9); cl.mesh.position.y = 0.85; k.g.add(cl.mesh);
    k.up(f => { const kk = Math.max(0, Math.min(1, Math.abs(f.sig(k.c.id, key)) / (k.view.qmax.get('c:' + k.c.name + ':' + key) || 1))); m.emissive.setRGB(kk, kk * 0.3, 0); });
  }
  function valve3d(k) {
    const body = k.mesh(new k.T.SphereGeometry(0.55, 20, 14), k.M.brass); body.position.y = k.FH; k.g.add(body);
    k.lead(k.V(-2, k.FH, 0), k.V(2, k.FH, 0), 0.12, k.M.pipe);
    const stem = new k.T.Group(); stem.position.y = k.FH + 0.6; k.g.add(stem);
    stem.add(k.mesh(new k.T.CylinderGeometry(0.06, 0.06, 0.6, 8), k.M.steel));
    const wheel = k.mesh(new k.T.TorusGeometry(0.4, 0.06, 8, 24), k.M.arrow); wheel.rotation.x = Math.PI / 2; wheel.position.y = 0.3; stem.add(wheel);
    return stem;
  }
  function pump3d(k, shaft) {
    const body = k.mesh(new k.T.CylinderGeometry(0.9, 0.9, 0.8, 28), new k.T.MeshStandardMaterial({ color: 0x1f7a6e, metalness: 0.5, roughness: 0.4 }));
    body.rotation.x = Math.PI / 2; body.position.set(0, k.FH + 0.3, 0); k.g.add(body);
    const imp = new k.T.Group(); imp.position.set(0, k.FH + 0.3, -0.45); k.g.add(imp);
    for (let i = 0; i < 5; i++) { const b = k.mesh(new k.T.BoxGeometry(0.1, 0.7, 0.08), k.M.key); b.rotation.z = i / 5 * Math.PI * 2; imp.add(b); }
    if (shaft) {
      const sh = k.rod(k.V(-3, k.AX, 0), k.V(-0.9, k.AX, 0), 0.09, k.M.steel, true); k.g.add(sh.g);
      k.lead(k.V(0.9, k.FH + 0.3, 0), k.V(3, k.FH, 0), 0.12, k.M.pipe);
      k.up(f => { const a = k.sx * k.ang(f, 0); sh.spin.rotation.x = a; imp.rotation.z = a; });
    } else {
      k.lead(k.V(0, k.FH, -2), k.V(0, k.FH, -0.4), 0.12, k.M.pipe); k.lead(k.V(0, k.FH, 0.4), k.V(0, k.FH, 2), 0.12, k.M.pipe);
      k.up(f => { imp.rotation.z = f.t * 6; });
    }
  }
})();
