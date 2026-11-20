/* ============================================================
   MeControlEng — Componentes eletrônicos
   Zener, LED, fotodiodo, BJT NPN/PNP, MOSFET N/P, regulador 78xx,
   AmpOp, porta lógica, contador 4026, display 7 segmentos, 555,
   relé, transformador, voltímetro e amperímetro.
   Cada componente define: símbolo (draw), modelo (build),
   visual ao vivo opcional (live) e peça 3D (view3d).
   ============================================================ */
'use strict';
(function () {
  const D = MS.Draw, dev = MS.dev, VT = dev.VT;
  const V2 = [[0, -2], [0, 2]];
  const WAVE = MS.WAVE;

  /* ── ajudantes de símbolo ── */
  const diodeSym = (g, up, bar) => {
    // up = true: triângulo aponta para cima (cátodo em cima)
    const yb = up ? 0.5 : -0.5, yt = -yb;
    D.line(g, 0, -2, 0, -0.5); D.line(g, 0, 0.5, 0, 2);
    g.beginPath(); g.moveTo(-0.6, yb); g.lineTo(0.6, yb); g.lineTo(0, yt); g.closePath(); g.stroke();
    if (bar === 'zener') { D.line(g, -0.6, yt + (up ? -0.15 : 0.15), -0.6, yt, 0.6, yt, 0.6, yt + (up ? 0.15 : -0.15)); }
    else D.line(g, -0.6, yt, 0.6, yt);
  };
  const arrows = (g, out, x0, y0) => {
    for (const dy of [0, 0.5]) {
      const a = out ? [x0, y0 + dy, x0 + 0.6, y0 + dy - 0.5] : [x0 + 0.6, y0 + dy - 0.5, x0, y0 + dy];
      D.arrow(g, a[0], a[1], a[2], a[3], 0.2);
    }
  };
  const box = (g, x0, y0, x1, y1, fill) => D.rect(g, x0, y0, x1 - x0, y1 - y0, fill);
  const LED_COL = { vermelho: '#ff3b3b', verde: '#3dff7a', azul: '#4f8bff', amarelo: '#ffd23b', branco: '#f4f7ff' };
  const LED_VF = { vermelho: 1.8, verde: 2.1, azul: 3.0, amarelo: 2.0, branco: 3.1 };
  const ledIs = vf => 0.01 / Math.exp(vf / (2 * VT));
  const meterBox = (g, c, S, txt, color) => {
    g.save(); g.rotate(-c.rot * Math.PI / 2);
    g.font = '0.62px "Share Tech Mono", monospace';
    const w = Math.max(2.4, g.measureText(txt).width + 0.5);
    g.fillStyle = 'rgba(4,7,13,0.92)'; g.strokeStyle = color; g.lineWidth = 0.06;
    g.beginPath(); g.rect(1.25, -0.45, w, 0.9); g.fill(); g.stroke();
    g.fillStyle = color; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText(txt, 1.5, 0.02);
    g.restore();
  };

  /* ── ajudantes 3D ── */
  const pcbBody = (x, w, h, d, mat, k, y = 0) => {
    const b = k.mesh(new k.T.BoxGeometry(w, h, d), mat); b.position.set(x, k.EH + h / 2 - 0.05 + y, 0); k.g.add(b); return b;
  };
  const legsTo = (k, pins, x0, z0, x1, z1) => {
    for (const p of pins) {
      const cx = Math.max(x0, Math.min(x1, p[0])), cz = Math.max(z0, Math.min(z1, p[1]));
      if (Math.hypot(cx - p[0], cz - p[1]) > 0.01) k.lead(k.V(p[0], k.EH, p[1]), k.V(cx, k.EH, cz), 0.035, k.M.pin);
    }
  };
  const emissive = (k, color, r = 0.28, pos = [0, 0.6, 0]) => {
    const m = new k.T.MeshStandardMaterial({ color, emissive: 0x000000, roughness: 0.3, metalness: 0.1, transparent: true, opacity: 0.9 });
    const s = k.mesh(new k.T.SphereGeometry(r, 18, 12), m); s.position.set(pos[0], k.EH + pos[1], pos[2]); k.g.add(s);
    return m;
  };

  const nl = (ctx, nodes, fn) => { const e = { t: 'NL', nodes, ev: fn }; ctx.els.push(e); return e; };
  const val0 = (fn, idx) => X => fn(idx.map(X), false);

  Object.assign(MS.DEFS, {
    /* ════════ SEMICONDUTORES ════════ */
    ZENER: {
      name: 'Diodo Zener', cat: 'Semicondutores', prefix: 'DZ', pins: [[0, -2, 'E', 'K'], [0, 2, 'E', 'A']], bbox: [-0.7, -2, 0.7, 2], lbl: [0.9, -0.5],
      params: [{ k: 'Vz', l: 'Tensão Zener', u: 'V', def: '5.1' }, { k: 'Izt', l: 'Corrente de teste (joelho)', u: 'A', def: '5m' }, { k: 'Is', l: 'Corrente de saturação', u: 'A', def: '10f' }],
      val: c => c.params.Vz + 'V',
      draw(g) { diodeSym(g, true, 'zener'); },
      build(x) {
        const fn = dev.diode({ Is: x.pos('Is', x.P('Is')), vt: VT, Vz: x.pos('Vz', x.P('Vz')), Isz: x.P('Izt'), vtz: VT * 1.2 });
        nl(x, [x.n(1), x.n(0)], fn);
        x.Q('I', 'Iz', 'A', X => -val0(fn, [x.n(1), x.n(0)])(X).i[0]);
      },
      view3d(k) { k.elecLeads(-0.4, 0.4); const b = k.mesh(new k.T.CylinderGeometry(0.16, 0.16, 0.8, 16), k.M.capBlue); b.rotation.x = Math.PI / 2; b.position.y = k.EH; k.g.add(b); const band = k.mesh(new k.T.CylinderGeometry(0.17, 0.17, 0.1, 16), k.M.black); band.rotation.x = Math.PI / 2; band.position.set(0, k.EH, -0.3); k.g.add(band); },
    },
    LED: {
      name: 'LED', cat: 'Semicondutores', prefix: 'LED', pins: [[0, -2, 'E', 'A'], [0, 2, 'E', 'K']], bbox: [-0.8, -2, 1.4, 2], lbl: [1.6, -0.5],
      params: [{ k: 'cor', l: 'Cor', type: 'sel', opts: ['vermelho', 'verde', 'azul', 'amarelo', 'branco'], def: 'vermelho' }, { k: 'Imax', l: 'Corrente nominal', u: 'A', def: '20m' }],
      val: c => c.params.cor,
      draw(g) { diodeSym(g, false); arrows(g, true, 0.55, -0.35); },
      live(g, c, S) {
        const i = S.q('I'); if (i == null) return;
        const k = Math.max(0, Math.min(1, i / (MS.parseEng(c.params.Imax) || 0.02)));
        if (k < 0.02) return;
        const col = LED_COL[c.params.cor] || '#ff3b3b';
        const gr = g.createRadialGradient(0, 0, 0.1, 0, 0, 1.4);
        gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)');
        g.globalAlpha = 0.25 + 0.6 * k; g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 1.4, 0, Math.PI * 2); g.fill();
      },
      build(x) {
        const vf = LED_VF[x.c.params.cor] || 2;
        const fn = dev.diode({ Is: ledIs(vf), vt: 2 * VT });
        nl(x, [x.n(0), x.n(1)], fn);
        x.Q('I', 'I', 'A', val0Index(fn, x, [0, 1]));
      },
      view3d(k) {
        k.elecLeads(-0.35, 0.35);
        const col = new k.T.Color(LED_COL[k.c.params.cor] || '#ff3b3b');
        const m = emissive(k, col.clone().multiplyScalar(0.5), 0.3, [0, 0.35, 0]);
        const imax = MS.parseEng(k.c.params.Imax) || 0.02;
        k.up(f => { const kk = Math.max(0, Math.min(1, f.sig(k.c.id, 'I') / imax)); m.emissive.copy(col).multiplyScalar(kk * 1.6); });
      },
    },
    PHOTO: {
      name: 'Fotodiodo', cat: 'Semicondutores', prefix: 'PD', pins: [[0, -2, 'E', 'K'], [0, 2, 'E', 'A']], bbox: [-1.4, -2, 0.8, 2], lbl: [1.0, -0.5],
      params: [...WAVE('lux', '500').map(p => ({ ...p, l: p.k === 'val' ? 'Iluminância (DC/final/pico)' : p.l })), { k: 'S', l: 'Sensibilidade', u: 'A/lux', def: '100n' }, { k: 'Is', l: 'Corrente de escuro (sat.)', u: 'A', def: '1p' }],
      val: c => (c.params.forma === 'DC' ? c.params.val + ' lux' : c.params.forma),
      draw(g) { diodeSym(g, true); arrows(g, false, -1.3, -0.4); },
      build(x) {
        const fn = dev.diode({ Is: x.pos('Is', x.P('Is')), vt: VT });
        nl(x, [x.n(1), x.n(0)], fn);
        const w = x.wave(), S = x.P('S');
        const e = { t: 'I', a: x.n(1), b: x.n(0), fn: t => S * Math.max(0, w(t)) }; x.els.push(e);
        x.Q('I', 'Ir', 'A', X => e.val - val0(fn, [x.n(1), x.n(0)])(X).i[0]);
        x.Q('lux', 'E', 'lux', () => e.val / S);
      },
      view3d(k) { k.elecLeads(-0.35, 0.35); const b = k.mesh(new k.T.BoxGeometry(0.6, 0.35, 0.7), k.M.dip); b.position.y = k.EH + 0.1; k.g.add(b); const w = k.mesh(new k.T.BoxGeometry(0.4, 0.02, 0.45), new k.T.MeshStandardMaterial({ color: 0x8899aa, metalness: 0.9, roughness: 0.2 })); w.position.y = k.EH + 0.28; k.g.add(w); },
    },
    NPN: bjtDef('NPN', 1),
    PNP: bjtDef('PNP', -1),
    NMOS: mosDef('NMOS', 1),
    PMOS: mosDef('PMOS', -1),

    /* ════════ CIs E DIGITAIS ════════ */
    REG: {
      name: 'Regulador de tensão (78xx)', cat: 'CIs & digitais', prefix: 'U', pins: [[-3, 0, 'E', 'IN'], [0, 2, 'E', 'GND'], [3, 0, 'E', 'OUT']], bbox: [-3, -1.2, 3, 2], lbl: [0, -1.7],
      params: [{ k: 'Vreg', l: 'Tensão regulada', u: 'V', def: '5' }, { k: 'Vdo', l: 'Tensão de dropout', u: 'V', def: '2' }, { k: 'Ro', l: 'Resistência de saída', u: 'Ω', def: '50m' }, { k: 'Iq', l: 'Corrente quiescente', u: 'A', def: '5m' }],
      val: c => `78${String(Math.round(MS.parseEng(c.params.Vreg))).padStart(2, '0')}`,
      draw(g, c, S) { box(g, -2, -1.2, 2, 1.2, 'rgba(79,179,255,0.08)'); D.line(g, -3, 0, -2, 0); D.line(g, 2, 0, 3, 0); D.line(g, 0, 1.2, 0, 2); S.text('IN', -1.4, 0, 0.5); S.text('OUT', 1.25, 0, 0.5); S.text('GND', 0, 0.75, 0.45); },
      build(x) {
        const fn = dev.regulator({ Vreg: x.P('Vreg'), Vdo: x.P('Vdo'), Ro: x.pos('Ro', x.P('Ro')), Iq: x.P('Iq') });
        const nd = [x.n(0), x.n(1), x.n(2)];
        nl(x, nd, fn);
        x.Q('Io', 'Io', 'A', X => -fn(nd.map(X)).i[2]);
        x.Q('P', 'Pdis', 'W', X => { const r = fn(nd.map(X)); return (X(nd[0]) - X(nd[2])) * (-r.i[2]); });
      },
      view3d(k) { to220(k, true); },
    },
    OPAMP: {
      name: 'Amplificador operacional (CI)', cat: 'CIs & digitais', prefix: 'U', pins: [[-3, -1, 'E', '−'], [-3, 1, 'E', '+'], [3, 0, 'E', 'OUT']], bbox: [-3, -2, 3, 2], lbl: [0, -2.5],
      params: [{ k: 'A', l: 'Ganho em malha aberta', u: '', def: '100k' }, { k: 'Vp', l: 'Alimentação +Vcc', u: 'V', def: '15' }, { k: 'Vn', l: 'Alimentação −Vcc', u: 'V', def: '-15' }, { k: 'Ro', l: 'Resistência de saída', u: 'Ω', def: '75' }],
      val: c => `±${c.params.Vp}V`,
      draw(g, c, S) {
        g.beginPath(); g.moveTo(-2, -2); g.lineTo(2, 0); g.lineTo(-2, 2); g.closePath(); g.fillStyle = 'rgba(199,125,255,0.08)'; g.fill(); g.stroke();
        D.line(g, -3, -1, -2, -1); D.line(g, -3, 1, -2, 1); D.line(g, 2, 0, 3, 0);
        S.text('−', -1.55, -1, 0.8); S.text('+', -1.55, 1, 0.8);
      },
      build(x) {
        const fn = dev.opamp({ A: x.P('A'), Vp: x.P('Vp'), Vn: x.P('Vn'), Ro: x.pos('Ro', x.P('Ro')) });
        const nd = [x.n(1), x.n(0), x.n(2)];
        nl(x, nd, fn);
        x.Q('Io', 'Io', 'A', X => -fn(nd.map(X)).i[2]);
      },
      view3d(k) { dip(k, 8, 'AmpOp'); },
    },
    LOGIC: {
      name: 'Porta lógica (CI 74xx)', cat: 'CIs & digitais', prefix: 'U', pins: [[-3, -1, 'E', 'A'], [-3, 1, 'E', 'B'], [3, 0, 'E', 'Y']], bbox: [-3, -1.8, 3, 1.8], lbl: [0, -2.3],
      params: [{ k: 'tipo', l: 'Função', type: 'sel', opts: ['AND', 'OR', 'NAND', 'NOR', 'XOR', 'NOT'], def: 'AND' }, { k: 'Vdd', l: 'Alimentação', u: 'V', def: '5' }, { k: 'Ro', l: 'Resistência de saída', u: 'Ω', def: '50' }],
      val: c => c.params.tipo,
      draw(g, c, S) {
        const t = c.params.tipo;
        box(g, -2, -1.8, 1.5, 1.8, 'rgba(255,209,102,0.06)');
        D.line(g, -3, -1, -2, -1); if (t !== 'NOT') D.line(g, -3, 1, -2, 1);
        const neg = ['NAND', 'NOR', 'NOT'].includes(t);
        if (neg) { D.circle(g, 1.75, 0, 0.25); D.line(g, 2, 0, 3, 0); } else D.line(g, 1.5, 0, 3, 0);
        S.text({ AND: '&', NAND: '&', OR: '≥1', NOR: '≥1', XOR: '=1', NOT: '1' }[t], -0.25, 0, 1.0);
      },
      live(g, c, S) { const y = S.q('Y'); if (y == null) return; g.fillStyle = y > 0.5 ? '#3dff7a' : '#33404f'; g.beginPath(); g.arc(1.0, -1.3, 0.22, 0, Math.PI * 2); g.fill(); },
      build(x) {
        const vdd = x.P('Vdd'), ro = x.pos('Ro', x.P('Ro'));
        const a = x.n(0), b = x.n(1), y = x.n(2), t = x.c.params.tipo;
        x.els.push({ t: 'G', a: y, b: 0, g: 1 / ro });
        const src = { t: 'I', a: y, b: 0, val: 0 }; x.els.push(src);
        const st = { y: 0 };
        x.els.push({ t: 'CTRL', pre: (tt, Xp) => {
          const A = Xp(a) > vdd / 2, B = Xp(b) > vdd / 2;
          const r = { AND: A && B, OR: A || B, NAND: !(A && B), NOR: !(A || B), XOR: A !== B, NOT: !A }[t];
          st.y = r ? 1 : 0; src.val = st.y * vdd / ro;
        } });
        x.Q('Y', 'Y', '', () => st.y);
      },
      view3d(k) { dip(k, 14, '74'); },
    },
    C4026: {
      name: 'Contador de década + decodificador 7 seg (CI 4026)', cat: 'CIs & digitais', prefix: 'U',
      pins: [[-3, -2, 'E', 'CLK'], [-3, 2, 'E', 'RST'], ...'abcdefg'.split('').map((s, i) => [3, -3 + i, 'E', s])], bbox: [-3, -4, 3, 4], lbl: [0, -4.5],
      params: [{ k: 'Vdd', l: 'Alimentação', u: 'V', def: '5' }, { k: 'Ro', l: 'Resistência de saída (limita a corrente do LED)', u: 'Ω', def: '300' }],
      val: () => '4026',
      draw(g, c, S) {
        box(g, -2, -4, 2, 4, 'rgba(255,209,102,0.06)');
        D.line(g, -3, -2, -2, -2); D.line(g, -3, 2, -2, 2);
        for (let i = 0; i < 7; i++) { D.line(g, 2, -3 + i, 3, -3 + i); S.text('abcdefg'[i], 1.55, -3 + i, 0.5); }
        S.text('CLK', -1.3, -2, 0.45); S.text('RST', -1.3, 2, 0.45); S.text('4026', -0.3, 0, 0.6);
        g.beginPath(); g.moveTo(-2, -2.3); g.lineTo(-1.75, -2); g.lineTo(-2, -1.7); g.stroke();
      },
      live(g, c, S) { const n = S.q('n'); if (n == null) return; S.text(String(Math.round(n)), -0.3, 1.2, 1.2); },
      build(x) {
        const vdd = x.P('Vdd'), ro = x.pos('Ro', x.P('Ro'));
        const clk = x.n(0), rst = x.n(1);
        const segs = [];
        for (let i = 0; i < 7; i++) { const nd = x.n(2 + i); x.els.push({ t: 'G', a: nd, b: 0, g: 1 / ro }); const s = { t: 'I', a: nd, b: 0, val: 0 }; x.els.push(s); segs.push(s); }
        const st = { n: 0, prev: false };
        const apply = () => { const m = MS.SEG7[st.n]; segs.forEach((s, i) => { s.val = m[i] ? vdd / ro : 0; }); };
        x.els.push({ t: 'CTRL', init: () => { st.n = 0; st.prev = false; apply(); }, pre: (tt, Xp) => {
          const c1 = Xp(clk) > vdd / 2;
          if (Xp(rst) > vdd / 2) st.n = 0; else if (c1 && !st.prev) st.n = (st.n + 1) % 10;
          st.prev = c1; apply();
        } });
        x.Q('n', 'N', '', () => st.n);
      },
      view3d(k) { dip(k, 16, '4026'); },
    },
    SEG7: {
      name: 'Display de LED 7 segmentos (cátodo comum)', cat: 'CIs & digitais', prefix: 'DS',
      pins: [...'abcdefg'.split('').map((s, i) => [-3, -3 + i, 'E', s]), [0, 5, 'E', 'COM']], bbox: [-3, -4, 2.2, 5], lbl: [0, -4.5],
      params: [{ k: 'cor', l: 'Cor', type: 'sel', opts: ['vermelho', 'verde', 'azul', 'amarelo', 'branco'], def: 'vermelho' }],
      val: c => c.params.cor,
      draw(g, c, S) {
        box(g, -2, -4, 2.2, 4, '#0b0f16');
        for (let i = 0; i < 7; i++) { D.line(g, -3, -3 + i, -2, -3 + i); S.text('abcdefg'[i], -1.7, -3 + i, 0.42); }
        D.line(g, 0, 4, 0, 5);
        drawDigit(g, null, c);
      },
      live(g, c, S) { const on = 'abcdefg'.split('').map(s => (S.q('I' + s) || 0) > 5e-4); drawDigit(g, on, c); },
      build(x) {
        const vf = LED_VF[x.c.params.cor] || 2, com = x.n(7);
        'abcdefg'.split('').forEach((s, i) => {
          const fn = dev.diode({ Is: ledIs(vf), vt: 2 * VT });
          nl(x, [x.n(i), com], fn);
          x.Q('I' + s, 'I' + s, 'A', X => fn([X(x.n(i)), X(com)], false).i[0]);
        });
      },
      view3d(k) {
        const b = k.mesh(new k.T.BoxGeometry(3.6, 0.5, 6.6), k.M.dip); b.position.set(0.1, k.EH + 0.2, 0.5); k.g.add(b);
        legsTo(k, MS.DEFS.SEG7.pins.map(p => [p[0], p[1]]), -1.7, -2.8, 1.9, 3.8);
        const col = new k.T.Color(LED_COL[k.c.params.cor] || '#ff3b3b');
        const geo = [[0, -2, 1.6, 0.3], [0.9, -1, 0.3, 1.7], [0.9, 1, 0.3, 1.7], [0, 2, 1.6, 0.3], [-0.9, 1, 0.3, 1.7], [-0.9, -1, 0.3, 1.7], [0, 0, 1.6, 0.3]];
        geo.forEach(([x0, z0, w, d], i) => {
          const m = new k.T.MeshStandardMaterial({ color: 0x2a1010, emissive: 0x000000, roughness: 0.4 });
          const s = k.mesh(new k.T.BoxGeometry(w, 0.06, d), m); s.position.set(x0 + 0.1, k.EH + 0.48, z0 + 0.5); k.g.add(s);
          k.up(f => { const on = f.sig(k.c.id, 'I' + 'abcdefg'[i]) > 5e-4; m.emissive.copy(on ? col : new k.T.Color(0)); m.color.copy(on ? col : new k.T.Color(0x2a1010)); });
        });
      },
    },
    T555: {
      name: 'Temporizador 555', cat: 'CIs & digitais', prefix: 'U',
      pins: [[0, -4, 'E', 'VCC'], [0, 4, 'E', 'GND'], [-3, -2, 'E', 'DIS'], [-3, 0, 'E', 'THR'], [-3, 2, 'E', 'TRIG'], [3, 0, 'E', 'OUT']], bbox: [-3, -4, 3, 4], lbl: [2.4, -3],
      params: [{ k: 'Ro', l: 'Resistência de saída', u: 'Ω', def: '10' }],
      val: () => '555',
      draw(g, c, S) {
        box(g, -2, -3, 2, 3, 'rgba(255,159,28,0.07)');
        D.line(g, 0, -4, 0, -3); D.line(g, 0, 3, 0, 4); D.line(g, -3, -2, -2, -2); D.line(g, -3, 0, -2, 0); D.line(g, -3, 2, -2, 2); D.line(g, 2, 0, 3, 0);
        S.text('555', 0.2, 0, 0.9); S.text('VCC', 0, -2.55, 0.42); S.text('GND', 0, 2.55, 0.42);
        S.text('DIS', -1.35, -2, 0.42); S.text('THR', -1.35, 0, 0.42); S.text('TRIG', -1.25, 2, 0.42); S.text('OUT', 1.3, -0.6, 0.42);
      },
      live(g, c, S) { const q = S.q('Q'); if (q == null) return; g.fillStyle = q > 0.5 ? '#3dff7a' : '#33404f'; g.beginPath(); g.arc(1.4, 0.6, 0.25, 0, Math.PI * 2); g.fill(); },
      build(x) {
        const ro = x.pos('Ro', x.P('Ro'));
        const [vcc, gnd, dis, thr, trg, out] = [0, 1, 2, 3, 4, 5].map(i => x.n(i));
        x.els.push({ t: 'G', a: vcc, b: gnd, g: 1 / 10e3 });
        x.els.push({ t: 'G', a: out, b: gnd, g: 1 / ro });
        const src = { t: 'I', a: out, b: gnd, val: 0 }; x.els.push(src);
        const dsw = { t: 'G', a: dis, b: gnd, g: 1e-9, var: true }; x.els.push(dsw);
        const st = { q: 0 };
        x.els.push({ t: 'CTRL', init: () => { st.q = 0; }, pre: (tt, Xp) => {
          const v = Xp(vcc) - Xp(gnd);
          if (v > 1) {
            if (Xp(trg) - Xp(gnd) < v / 3) st.q = 1;
            else if (Xp(thr) - Xp(gnd) > 2 * v / 3) st.q = 0;
          }
          src.val = st.q ? Math.max(0, v - 1.7) / ro : 0;
          dsw.g = st.q ? 1e-9 : 1 / 10;
        } });
        x.Q('Q', 'Q', '', () => st.q);
      },
      view3d(k) { dip(k, 8, '555'); },
    },

    /* ════════ ELÉTRICO (eletromecânico/magnético) ════════ */
    RELAY: {
      name: 'Relé', cat: 'Elétrico', prefix: 'K', pins: [[-3, -1, 'E', 'A1'], [-3, 1, 'E', 'A2'], [3, -2, 'E', 'COM'], [3, 0, 'E', 'NA'], [3, 2, 'E', 'NF']], bbox: [-3, -2.6, 3, 2.6], lbl: [0, -3.1],
      params: [{ k: 'Rc', l: 'Resistência da bobina', u: 'Ω', def: '100' }, { k: 'Lc', l: 'Indutância da bobina', u: 'H', def: '50m' }, { k: 'Ion', l: 'Corrente de atracação', u: 'A', def: '40m' }, { k: 'Ron', l: 'Resistência do contato', u: 'Ω', def: '50m' }],
      val: c => `${c.params.Rc}Ω`,
      draw(g, c, S) {
        box(g, -2.4, -1.4, -0.8, 1.4, 'rgba(79,179,255,0.08)'); D.line(g, -2.4, 1.4, -0.8, -1.4);
        D.line(g, -3, -1, -2.4, -1); D.line(g, -3, 1, -2.4, 1);
        D.line(g, 3, -2, 1.4, -2); D.line(g, 3, 0, 2.2, 0); D.line(g, 3, 2, 2.2, 2); D.circle(g, 1.4, -2, 0.1);
        g.setLineDash([0.2, 0.2]); D.line(g, -0.8, 0, 1.6, 0); g.setLineDash([]);
        const on = S.q && S.q('on') > 0.5;
        D.line(g, 1.4, -2, on ? 2.2 : 2.2, on ? -0.1 : 1.9);
        S.text('NA', 2.4, -0.45, 0.4); S.text('NF', 2.4, 1.55, 0.4);
      },
      build(x) {
        const coil = { t: 'EMC', p: x.n(0), m: x.n(1), s: 0, Ra: x.pos('Rc', x.P('Rc')), La: x.pos('Lc', x.P('Lc')), K: 0, k: x.br(), vL: 0 };
        x.els.push(coil);
        const gon = 1 / x.pos('Ron', x.P('Ron')), goff = 1e-9, ion = x.P('Ion');
        const no = { t: 'G', a: x.n(2), b: x.n(3), g: goff, var: true }, nc = { t: 'G', a: x.n(2), b: x.n(4), g: gon, var: true };
        x.els.push(no, nc);
        const st = { on: 0 };
        x.els.push({ t: 'CTRL', init: () => { st.on = 0; no.g = goff; nc.g = gon; }, pre: (tt, Xp, h, xp) => {
          const i = Math.abs(xp[coil.k]);
          if (!st.on && i > ion) st.on = 1; else if (st.on && i < 0.5 * ion) st.on = 0;
          no.g = st.on ? gon : goff; nc.g = st.on ? goff : gon;
        } });
        x.Q('I', 'Ibob', 'A', (X, xv) => xv[coil.k]);
        x.Q('on', 'K', '', () => st.on);
      },
      view3d(k) {
        const b = k.mesh(new k.T.BoxGeometry(3.4, 1.6, 2.8), k.M.relay); b.position.set(0, k.EH + 0.75, 0); k.g.add(b);
        legsTo(k, MS.DEFS.RELAY.pins.map(p => [p[0], p[1]]), -1.7, -1.4, 1.7, 1.4);
        const lamp = emissive(k, new k.T.Color(0x113322), 0.12, [1.2, 1.6, -1.0]);
        k.up(f => { lamp.emissive.setRGB(0, f.sig(k.c.id, 'on') > 0.5 ? 1 : 0, 0.3 * (f.sig(k.c.id, 'on') > 0.5)); });
      },
    },
    XFMR: {
      name: 'Transformador', cat: 'Elétrico', prefix: 'T', pins: [[-3, -2, 'E', 'P1'], [-3, 2, 'E', 'P2'], [3, -2, 'E', 'S1'], [3, 2, 'E', 'S2']], bbox: [-3, -2.2, 3, 2.2], lbl: [0, -2.7],
      params: [{ k: 'Lp', l: 'Indutância do primário', u: 'H', def: '2' }, { k: 'n', l: 'Relação de espiras Ns/Np', u: '', def: '0.1' }, { k: 'k', l: 'Coeficiente de acoplamento', u: '', def: '0.999' }, { k: 'Rp', l: 'Resistência do primário', u: 'Ω', def: '1' }, { k: 'Rs', l: 'Resistência do secundário', u: 'Ω', def: '0.1' }],
      val: c => `1:${c.params.n}`,
      draw(g) {
        D.line(g, -3, -2, -1.1, -2, -1.1, -1.4); D.line(g, -3, 2, -1.1, 2, -1.1, 1.4);
        D.line(g, 3, -2, 1.1, -2, 1.1, -1.4); D.line(g, 3, 2, 1.1, 2, 1.1, 1.4);
        for (let k = 0; k < 4; k++) { g.beginPath(); g.arc(-1.1, -1.05 + 0.7 * k, 0.35, -Math.PI / 2, Math.PI / 2); g.stroke(); g.beginPath(); g.arc(1.1, -1.05 + 0.7 * k, 0.35, Math.PI / 2, 3 * Math.PI / 2); g.stroke(); }
        D.line(g, -0.2, -1.6, -0.2, 1.6); D.line(g, 0.2, -1.6, 0.2, 1.6);
        g.beginPath(); g.arc(-1.6, -1.5, 0.1, 0, 7); g.fill(); g.beginPath(); g.arc(1.6, -1.5, 0.1, 0, 7); g.fill();
      },
      build(x) {
        const Lp = x.pos('Lp', x.P('Lp')), n = x.pos('n', x.P('n')), kk = Math.min(0.99999, x.P('k'));
        const L2 = Lp * n * n;
        const e = { t: 'XFMR', p1: x.n(0), p2: x.n(1), s1: x.n(2), s2: x.n(3), L1: Lp, L2, M: kk * Math.sqrt(Lp * L2), R1: Math.max(1e-6, x.P('Rp')), R2: Math.max(1e-6, x.P('Rs')), k1: x.br(), k2: x.br() };
        x.els.push(e);
        x.Q('Ip', 'Ip', 'A', (X, xv) => xv[e.k1]); x.Q('Is', 'Is', 'A', (X, xv) => -xv[e.k2]);
      },
      view3d(k) {
        const core = k.mesh(new k.T.BoxGeometry(1.0, 2.0, 3.6), k.M.dark); core.position.set(0, k.EH + 0.9, 0); k.g.add(core);
        for (const xx of [-1, 1]) { const c = k.mesh(new k.T.CylinderGeometry(0.75, 0.75, 2.4, 24), k.M.copper); c.rotation.x = Math.PI / 2; c.position.set(xx * 0.95, k.EH + 0.9, 0); k.g.add(c); }
        legsTo(k, MS.DEFS.XFMR.pins.map(p => [p[0], p[1]]), -1.7, -1.2, 1.7, 1.2);
      },
    },

    /* ════════ INSTRUMENTOS ════════ */
    VMETER: {
      name: 'Voltímetro', cat: 'Instrumentos', prefix: 'VM', pins: [[0, -2, 'E', '+'], [0, 2, 'E', '−']], bbox: [-1, -2, 1, 2], lbl: [-1.3, -0.5],
      params: [], val: () => '',
      draw(g, c, S) { D.line(g, 0, -2, 0, -1); D.line(g, 0, 1, 0, 2); D.circle(g, 0, 0, 1, 'rgba(255,209,102,0.07)'); S.text('V', 0, 0.05, 1.0); S.text('+', 0.55, -1.3, 0.5); },
      live(g, c, S) { const v = S.q('V'); if (v == null) return; meterBox(g, c, S, MS.fmt(v, 'V', 4), '#ffd166'); },
      build(x) { const a = x.n(0), b = x.n(1); x.Q('V', 'V', 'V', X => X(a) - X(b)); },
      view3d(k) { meter3d(k, 0xffc21a); },
    },
    AMETER: {
      name: 'Amperímetro', cat: 'Instrumentos', prefix: 'AM', pins: [[0, -2, 'E', '+'], [0, 2, 'E', '−']], bbox: [-1, -2, 1, 2], lbl: [-1.3, -0.5],
      params: [], val: () => '',
      draw(g, c, S) { D.line(g, 0, -2, 0, -1); D.line(g, 0, 1, 0, 2); D.circle(g, 0, 0, 1, 'rgba(79,179,255,0.07)'); S.text('A', 0, 0.05, 1.0); S.text('+', 0.55, -1.3, 0.5); },
      live(g, c, S) { const v = S.q('I'); if (v == null) return; meterBox(g, c, S, MS.fmt(v, 'A', 4), '#4fb3ff'); },
      build(x) { const e = { t: 'V', a: x.n(0), b: x.n(1), fn: () => 0, k: x.br() }; x.els.push(e); x.Q('I', 'I', 'A', (X, xv) => xv[e.k]); },
      view3d(k) { meter3d(k, 0x1a8cff); },
    },
  });

  /* ── fábricas de BJT e MOSFET ── */
  function bjtDef(kind, pol) {
    const npn = pol > 0;
    const pins = npn ? [[0, -2, 'E', 'C'], [-2, 0, 'E', 'B'], [0, 2, 'E', 'E']] : [[0, -2, 'E', 'E'], [-2, 0, 'E', 'B'], [0, 2, 'E', 'C']];
    return {
      name: `Transistor ${kind} (TBJ)`, cat: 'Semicondutores', prefix: 'Q', pins, bbox: [-2, -2, 1.2, 2], lbl: [1.4, -0.5],
      params: [{ k: 'bf', l: 'Ganho de corrente β (hFE)', u: '', def: '100' }, { k: 'br', l: 'β reverso', u: '', def: '1' }, { k: 'Is', l: 'Corrente de saturação', u: 'A', def: '10f' }],
      val: c => 'β=' + c.params.bf,
      draw(g) {
        D.circle(g, -0.15, 0, 1.25, 'rgba(79,179,255,0.05)');
        D.line(g, -2, 0, -0.55, 0); D.line(g, -0.55, -0.8, -0.55, 0.8);
        D.line(g, -0.55, -0.35, 0, -1.0, 0, -2); D.line(g, -0.55, 0.35, 0, 1.0, 0, 2);
        // seta no emissor: NPN aponta para fora; PNP para dentro
        if (npn) D.arrow(g, -0.4, 0.5, -0.05, 0.95, 0.3); else D.arrow(g, -0.1, -0.9, -0.48, -0.47, 0.3);
      },
      build(x) {
        const fn = dev.bjt({ Is: x.pos('Is', x.P('Is')), bf: x.pos('bf', x.P('bf')), br: x.pos('br', x.P('br')) }, pol);
        const C = npn ? x.n(0) : x.n(2), B = x.n(1), E = npn ? x.n(2) : x.n(0);
        nl(x, [C, B, E], fn);
        const f = X => fn([X(C), X(B), X(E)], false);
        x.Q('Ic', 'Ic', 'A', X => pol * f(X).i[0]); x.Q('Ib', 'Ib', 'A', X => pol * f(X).i[1]);
      },
      view3d(k) {
        const b = k.mesh(new k.T.CylinderGeometry(0.4, 0.4, 0.7, 20, 1, false, 0, Math.PI), k.M.dip); b.position.set(0.25, k.EH + 0.35, 0); b.rotation.y = Math.PI / 2; k.g.add(b);
        legsTo(k, pins.map(p => [p[0], p[1]]), -0.15, -0.35, 0.65, 0.35);
      },
    };
  }
  function mosDef(kind, pol) {
    const n = pol > 0;
    const pins = n ? [[0, -2, 'E', 'D'], [-2, 0, 'E', 'G'], [0, 2, 'E', 'S']] : [[0, -2, 'E', 'S'], [-2, 0, 'E', 'G'], [0, 2, 'E', 'D']];
    return {
      name: `MOSFET canal ${n ? 'N' : 'P'}`, cat: 'Semicondutores', prefix: 'M', pins, bbox: [-2, -2, 1.2, 2], lbl: [1.4, -0.5],
      params: [{ k: 'Vth', l: 'Tensão de limiar |Vth|', u: 'V', def: '2' }, { k: 'K', l: 'Transcondutância K', u: 'A/V²', def: '1' }, { k: 'lam', l: 'Modulação de canal λ', u: '1/V', def: '10m' }],
      val: c => 'Vth=' + c.params.Vth,
      draw(g) {
        D.line(g, -2, 0, -0.9, 0); D.line(g, -0.9, -0.8, -0.9, 0.8);
        for (const y of [-0.6, 0, 0.6]) D.line(g, -0.55, y - 0.22, -0.55, y + 0.22);
        D.line(g, -0.55, -0.6, 0, -0.6, 0, -2); D.line(g, -0.55, 0.6, 0, 0.6, 0, 2); D.line(g, -0.55, 0, 0, 0, 0, 0.6);
        if (n) D.arrow(g, 0, 0, -0.5, 0, 0.25); else D.arrow(g, -0.55, 0, -0.05, 0, 0.25);
      },
      build(x) {
        const fn = dev.mos({ Vth: Math.abs(x.P('Vth')), K: x.pos('K', x.P('K')), lam: x.P('lam') }, pol);
        const Dn = n ? x.n(0) : x.n(2), Gn = x.n(1), Sn = n ? x.n(2) : x.n(0);
        nl(x, [Dn, Gn, Sn], fn);
        x.Q('Id', 'Id', 'A', X => pol * fn([X(Dn), X(Gn), X(Sn)], false).i[0]);
      },
      view3d(k) { to220(k, false); },
    };
  }
  function val0Index(fn, x, idx) { return X => fn(idx.map(i => X(x.n(i))), false).i[0]; }

  /* ── peças 3D comuns ── */
  function dip(k, npins, label) {
    const L = Math.max(1.2, npins / 2 * 0.36);
    const b = k.mesh(new k.T.BoxGeometry(1.4, 0.45, L), k.M.dip); b.position.set(0, k.EH + 0.25, 0); k.g.add(b);
    const notch = k.mesh(new k.T.CylinderGeometry(0.15, 0.15, 0.02, 12), k.M.dark); notch.position.set(0, k.EH + 0.48, -L / 2 + 0.25); k.g.add(notch);
    for (let i = 0; i < npins / 2; i++) for (const s of [-1, 1]) { const p = k.mesh(new k.T.BoxGeometry(0.25, 0.32, 0.12), k.M.pin); p.position.set(s * 0.8, k.EH + 0.1, -L / 2 + 0.2 + i * (L - 0.4) / Math.max(1, npins / 2 - 1)); k.g.add(p); }
    legsTo(k, MS.DEFS[k.c.type].pins.map(p => [p[0], p[1]]), -0.8, -L / 2, 0.8, L / 2);
    void label;
  }
  function to220(k, sink) {
    const b = k.mesh(new k.T.BoxGeometry(1.0, 0.45, 1.0), k.M.dip); b.position.set(0, k.EH + 0.3, 0); k.g.add(b);
    const tab = k.mesh(new k.T.BoxGeometry(1.0, 0.08, 1.4), k.M.pin); tab.position.set(0, k.EH + 0.1, -0.15); k.g.add(tab);
    if (sink) for (let i = 0; i < 5; i++) { const f = k.mesh(new k.T.BoxGeometry(1.4, 0.9, 0.06), k.M.steel); f.position.set(0, k.EH + 0.75, -0.9 + i * 0.12); k.g.add(f); }
    legsTo(k, MS.DEFS[k.c.type].pins.map(p => [p[0], p[1]]), -0.5, -0.5, 0.5, 0.5);
  }
  function meter3d(k, color) {
    const b = k.mesh(new k.T.BoxGeometry(1.6, 0.4, 2.4), new k.T.MeshStandardMaterial({ color, roughness: 0.6 })); b.position.set(0, k.EH + 0.2, 0); k.g.add(b);
    const s = k.mesh(new k.T.BoxGeometry(1.2, 0.05, 0.8), new k.T.MeshStandardMaterial({ color: 0x9fd8a8, emissive: 0x153a20, roughness: 0.3 })); s.position.set(0, k.EH + 0.42, -0.5); k.g.add(s);
    k.lead(k.V(0, k.EH, -2), k.V(0, k.EH, -1.2), 0.04, k.M.arrow); k.lead(k.V(0, k.EH, 1.2), k.V(0, k.EH, 2), 0.04, k.M.black);
  }

  /* ── dígito de 7 segmentos (esquemático) ── */
  MS.SEG7 = [[1, 1, 1, 1, 1, 1, 0], [0, 1, 1, 0, 0, 0, 0], [1, 1, 0, 1, 1, 0, 1], [1, 1, 1, 1, 0, 0, 1], [0, 1, 1, 0, 0, 1, 1], [1, 0, 1, 1, 0, 1, 1], [1, 0, 1, 1, 1, 1, 1], [1, 1, 1, 0, 0, 0, 0], [1, 1, 1, 1, 1, 1, 1], [1, 1, 1, 1, 0, 1, 1]];
  function drawDigit(g, on, c) {
    const col = LED_COL[c.params.cor] || '#ff3b3b';
    const segs = [[-0.2, -2.9, 1.4, -2.9], [1.5, -2.7, 1.5, -0.2], [1.5, 0.2, 1.5, 2.7], [-0.2, 2.9, 1.4, 2.9], [-0.4, 0.2, -0.4, 2.7], [-0.4, -2.7, -0.4, -0.2], [-0.2, 0, 1.4, 0]];
    g.save(); g.lineCap = 'round'; g.lineWidth = 0.32;
    segs.forEach((s, i) => { const lit = on && on[i]; g.strokeStyle = lit ? col : 'rgba(120,130,150,0.18)'; if (lit) { g.shadowColor = col; g.shadowBlur = 8; } else g.shadowBlur = 0; D.line(g, ...s); });
    g.restore();
  }
})();
