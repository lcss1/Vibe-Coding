/* ============================================================
   MeControlEng — Mecânica › Materiais e Projetos
   Resistência dos Materiais · Dinâmica e Vibrações ·
   Elementos de Máquinas e Projeto Mecânico · Ciência e Seleção de Materiais
   ============================================================ */
'use strict';
(function () {
  const CS = MS.CS, h = CS.h, K = MS.MK;
  const COL = ['#4fb3ff', '#ff9f1c', '#3ddc84', '#c77dff', '#ffd166', '#ff4d6d', '#06d6a0'];
  const chart = (host, cls, o) => { const b = CS.chartBox(cls); host.append(b); return new MS.Chart(b, o); };
  const STEELS = K.matOpts(m => /Metal/.test(m.classe));

  /* ───────── seção transversal ───────── */
  const SEC_FIELDS = [
    { k: 'sec', l: 'Seção', type: 'sel', v: 'ret', opts: [['ret', 'Retangular b × h'], ['circ', 'Circular maciça Ø d'], ['tubo', 'Tubo Ø D × espessura t'], ['I', 'Perfil I (b, h, tw, tf)']] },
    { k: 'b', l: 'Largura b', u: 'mm', v: '50' }, { k: 'hh', l: 'Altura h', u: 'mm', v: '100' },
    { k: 'd', l: 'Diâmetro d', u: 'mm', v: '60' }, { k: 'D', l: 'Diâmetro externo D', u: 'mm', v: '80' }, { k: 't', l: 'Espessura t', u: 'mm', v: '5' },
    { k: 'tw', l: 'Alma tw', u: 'mm', v: '6' }, { k: 'tf', l: 'Mesa tf', u: 'mm', v: '9' },
    { k: 'mat', l: 'Material', type: 'sel', v: '0', opts: K.matOpts() },
  ];
  const SEC_VIS = { ret: ['b', 'hh'], circ: ['d'], tubo: ['D', 't'], I: ['b', 'hh', 'tw', 'tf'] };
  const secVisibility = f => { const vis = SEC_VIS[f.st.sec]; for (const k of ['b', 'hh', 'd', 'D', 't', 'tw', 'tf']) f.inputs[k].parentElement.style.display = vis.includes(k) ? '' : 'none'; };
  /* propriedades geométricas (SI) */
  function secProps(s) {
    const mm = 1e-3;
    let A, I, Imin, c, tauK, name;
    if (s.sec === 'ret') { const b = s.b * mm, hh = s.hh * mm; A = b * hh; I = b * hh ** 3 / 12; Imin = Math.min(I, hh * b ** 3 / 12); c = hh / 2; tauK = 1.5; name = `${s.b}×${s.hh} mm`; }
    else if (s.sec === 'circ') { const d = s.d * mm; A = Math.PI * d * d / 4; I = Math.PI * d ** 4 / 64; Imin = I; c = d / 2; tauK = 4 / 3; name = `Ø${s.d} mm`; }
    else if (s.sec === 'tubo') { const D = s.D * mm, d = Math.max(0, D - 2 * s.t * mm); A = Math.PI * (D * D - d * d) / 4; I = Math.PI * (D ** 4 - d ** 4) / 64; Imin = I; c = D / 2; tauK = 2; name = `Ø${s.D}×${s.t} mm`; }
    else { const b = s.b * mm, hh = s.hh * mm, tw = s.tw * mm, tf = s.tf * mm; A = 2 * b * tf + (hh - 2 * tf) * tw; I = (b * hh ** 3 - (b - tw) * (hh - 2 * tf) ** 3) / 12; Imin = (2 * tf * b ** 3 + (hh - 2 * tf) * tw ** 3) / 12; c = hh / 2; tauK = A / ((hh - 2 * tf) * tw); name = `I ${s.hh}×${s.b}`; }
    const m = K.MATS[+s.mat];
    return { A, I, Imin, c, W: I / c, r: Math.sqrt(Imin / A), tauK, name, m, E: m.E * 1e9, sy: m.sy * 1e6 };
  }

  /* ════════════════ 1. RESISTÊNCIA DOS MATERIAIS ════════════════ */
  const toolResMat = (host, onClean) => {
    const { body } = CS.page(host, {
      title: 'Resistência dos Materiais', lead: 'Vigas (reações, esforço cortante, momento fletor, tensões e flecha), estado plano de tensões (círculo de Mohr) e flambagem de colunas.',
      learn: `<p><b>Vigas.</b> Do equilíbrio (ΣF = 0, ΣM = 0) saem as reações. O <b>esforço cortante</b> V(x) e o <b>momento fletor</b> M(x) se relacionam por dM/dx = V e dV/dx = −w.</p>
      <p><b>Tensão de flexão:</b> σ = M·c/I = M/W (máxima nas fibras extremas). <b>Cisalhamento:</b> τ = V·Q/(I·t); para a seção retangular, τ<sub>máx</sub> = 1,5·V/A.</p>
      <p><b>Linha elástica:</b> E·I·v″ = M(x). Integrando duas vezes e aplicando as condições de contorno (v = 0 nos apoios; v = v′ = 0 no engaste), obtém-se a flecha. Limites usuais: L/250 a L/360.</p>
      <p><b>Círculo de Mohr:</b> representa o estado plano de tensões em todas as orientações. Centro C = (σx+σy)/2 e raio R = √(((σx−σy)/2)² + τ²). As tensões principais são σ₁,₂ = C ± R, e τ<sub>máx</sub> = R ocorre a 45° delas. No círculo, um giro θ no elemento corresponde a 2θ.</p>
      <p><b>Critérios de falha (dúcteis):</b> von Mises σ' = √(σ₁² − σ₁σ₂ + σ₂²) ≤ σ<sub>esc</sub>; Tresca: τ<sub>máx</sub> ≤ σ<sub>esc</sub>/2.</p>
      <p><b>Flambagem:</b> carga crítica de Euler P<sub>cr</sub> = π²EI/(KL)². O índice de esbeltez λ = KL/r (r = √(I/A)) separa colunas longas (Euler) de intermediárias (parábola de Johnson, λ &lt; λ<sub>c</sub> = √(2π²E/σ<sub>esc</sub>)).</p>`,
    });
    onClean(K.sections(body, 'resmat', [
      { id: 'viga', label: 'Vigas', render: secViga },
      { id: 'mohr', label: 'Círculo de Mohr', render: secMohr },
      { id: 'flamb', label: 'Flambagem', render: secFlamb },
    ]));
  };

  function beamSolve(cfg, loads, EI) {
    const L = cfg.L, N = 801, xs = K.linspace(0, L, N);
    const lv = x => {
      let V = 0, M = 0;
      for (const q of loads) {
        if (q.t === 'P' && x > q.x1) { V -= q.v; M -= q.v * (x - q.x1); }
        if (q.t === 'w' && x > q.x1) { const s = Math.min(x, q.x2) - q.x1; if (s > 0) { const F = q.v * s; V -= F; M -= F * (x - q.x1 - s / 2); } }
        if (q.t === 'M' && x > q.x1) M += q.v;
      }
      return { V, M };
    };
    const end = lv(L + 1e-9);
    let V, M, reac;
    if (cfg.tipo === 'eng') {
      const R0 = -end.V, Mr = -R0 * L - end.M;
      reac = [{ x: 0, F: R0, label: 'R₀' }, { x: 0, Mr, label: 'M₀' }];
      V = xs.map(x => lv(x).V + R0); M = xs.map(x => lv(x).M + R0 * x + Mr);
    } else {
      const a = cfg.a, b = cfg.b;
      if (Math.abs(b - a) < 1e-9) throw new Error('Os apoios A e B precisam estar em posições diferentes.');
      // Ra + Rb = −V_end ; Ra(L−a) + Rb(L−b) = −M_end
      const Rb = (-end.M + end.V * (L - a)) / ((L - b) - (L - a));
      const Ra = -end.V - Rb;
      reac = [{ x: a, F: Ra, label: 'RA' }, { x: b, F: Rb, label: 'RB' }];
      V = xs.map(x => { const l = lv(x); return l.V + (x > a ? Ra : 0) + (x > b ? Rb : 0); });
      M = xs.map(x => { const l = lv(x); return l.M + (x > a ? Ra * (x - a) : 0) + (x > b ? Rb * (x - b) : 0); });
    }
    // linha elástica: v'' = M/EI
    const th = [0], F2 = [0];
    for (let i = 1; i < N; i++) { const dx = xs[i] - xs[i - 1]; th.push(th[i - 1] + 0.5 * (M[i] + M[i - 1]) / EI * dx); F2.push(F2[i - 1] + 0.5 * (th[i] + th[i - 1]) * dx); }
    const at = (arr, x) => { const f = x / L * (N - 1), i = Math.max(0, Math.min(N - 2, Math.floor(f))); return arr[i] + (arr[i + 1] - arr[i]) * (f - i); };
    let C1 = 0, C2 = 0;
    if (cfg.tipo !== 'eng') { C1 = -(at(F2, cfg.b) - at(F2, cfg.a)) / (cfg.b - cfg.a); C2 = -at(F2, cfg.a) - C1 * cfg.a; }
    const v = xs.map((x, i) => F2[i] + C1 * x + C2);
    return { xs, V, M, v, reac };
  }

  function secViga(area) {
    const top = h('div', { class: 'grid2' }), res = h('div', { class: 'grid2' });
    area.append(top, res);
    const fb = K.form([
      { k: 'tipo', l: 'Vinculação', type: 'sel', v: '2ap', opts: [['2ap', 'Dois apoios (A pino, B rolete)'], ['eng', 'Engastada em x = 0 (balanço)']] },
      { k: 'L', l: 'Comprimento L', u: 'm', v: '4' }, { k: 'a', l: 'Posição do apoio A', u: 'm', v: '0' }, { k: 'b', l: 'Posição do apoio B', u: 'm', v: '4' },
    ], () => { vis(); run(); }, { cols: 2 });
    const fs = K.form(SEC_FIELDS, () => { secVisibility(fs); run(); }, { cols: 2 });
    const vis = () => { for (const k of ['a', 'b']) fb.inputs[k].parentElement.style.display = fb.st.tipo === 'eng' ? 'none' : ''; };
    let loads = [{ t: 'P', x1: 1.5, x2: 0, v: 10 }, { t: 'w', x1: 2, x2: 4, v: 5 }];
    const lt = h('div');
    const renderLoads = () => {
      lt.innerHTML = '';
      loads.forEach((q, i) => {
        const t = h('select', {}, h('option', { value: 'P' }, 'Força P [kN]'), h('option', { value: 'w' }, 'Distribuída w [kN/m]'), h('option', { value: 'M' }, 'Momento M [kN·m] (horário +)'));
        t.value = q.t;
        const mk = (k, ph) => { const inp = h('input', { value: q[k], placeholder: ph, class: 'sm' }); inp.addEventListener('change', () => { const v = MS.parseEng(inp.value); if (isFinite(v)) { q[k] = v; run(); } }); return inp; };
        t.addEventListener('change', () => { q.t = t.value; renderLoads(); run(); });
        lt.append(h('div', { class: 'load-row' }, t, h('span', {}, 'x'), mk('x1', 'x [m]'), q.t === 'w' ? h('span', {}, 'até') : null, q.t === 'w' ? mk('x2', 'x₂ [m]') : null, h('span', {}, 'valor'), mk('v', 'valor'),
          h('button', { class: 'btn icon sm danger', onclick: () => { loads.splice(i, 1); renderLoads(); run(); } }, '✕')));
      });
      lt.append(h('button', { class: 'btn sm', onclick: () => { loads.push({ t: 'P', x1: fb.st.L / 2, x2: fb.st.L, v: 5 }); renderLoads(); run(); } }, '+ carga'));
    };
    top.append(CS.card('Viga e vinculação', fb.el, h('div', { class: 'card-title', style: 'margin-top:10px' }, 'Cargas (para baixo = positivo)'), lt), CS.card('Seção e material', fs.el));
    const cvCard = CS.card('Esquema da viga'); const cv = K.canvas(cvCard, 150, null);
    const out = h('div');
    res.append(h('div', { class: 'col' }, cvCard, CS.card('Resultados', out)), h('div', { class: 'col' }, CS.card('Esforço cortante V(x) [kN]', CS.chartBox('sm')), CS.card('Momento fletor M(x) [kN·m]', CS.chartBox('sm')), CS.card('Flecha v(x) [mm]', CS.chartBox('sm'))));
    const boxes = res.querySelectorAll('.chart-box');
    const cV = new MS.Chart(boxes[0], { xlabel: 'x [m]', readout: (x, y) => `x = ${K.n(x)} m\nV = ${K.n(y)} kN` });
    const cM = new MS.Chart(boxes[1], { xlabel: 'x [m]', readout: (x, y) => `x = ${K.n(x)} m\nM = ${K.n(y)} kN·m` });
    const cD = new MS.Chart(boxes[2], { xlabel: 'x [m]', readout: (x, y) => `x = ${K.n(x)} m\nv = ${K.n(y)} mm` });
    secVisibility(fs); vis(); renderLoads();
    function run() {
      out.innerHTML = '';
      try {
        const L = fb.st.L; if (!(L > 0)) throw new Error('L deve ser > 0');
        const sp = secProps(fs.st);
        const ld = loads.map(q => ({ ...q, v: q.v * 1e3 }));
        const r = beamSolve({ tipo: fb.st.tipo, L, a: fb.st.a, b: fb.st.b }, ld, sp.E * sp.I);
        const Vk = r.V.map(v => v / 1e3), Mk = r.M.map(v => v / 1e3), vmm = r.v.map(v => v * 1e3);
        const fill = (arr, c) => ({ x: [0, ...r.xs, L], y: [0, ...arr, 0], color: c, width: 2 });
        cV.set({ series: [fill(Vk, '#4fb3ff')] }); cM.set({ series: [fill(Mk, '#ff9f1c')] }); cD.set({ series: [{ x: r.xs, y: vmm, color: '#3ddc84', width: 2 }] });
        const iM = Mk.reduce((bi, v, i) => (Math.abs(v) > Math.abs(Mk[bi]) ? i : bi), 0);
        const Vmax = Math.max(...Vk.map(Math.abs)), Mmax = Math.abs(Mk[iM]);
        const iv = vmm.reduce((bi, v, i) => (Math.abs(v) > Math.abs(vmm[bi]) ? i : bi), 0);
        const sig = Mmax * 1e3 / sp.W / 1e6, tau = sp.tauK * Vmax * 1e3 / sp.A / 1e6, FS = sp.m.sy / sig;
        const dmax = Math.abs(vmm[iv]), lim = L * 1e3 / 250;
        out.append(CS.kv([
          ...r.reac.map(rr => [rr.label.replace(/^R(A|B)$/, 'R<sub>$1</sub>').replace('R₀', 'R₀ (engaste)').replace('M₀', 'M₀ (engaste)'), rr.Mr !== undefined ? `${K.n(rr.Mr / 1e3)} kN·m` : `${K.n(rr.F / 1e3)} kN (x = ${K.n(rr.x)} m)`]),
          ['|V|<sub>máx</sub>', `${K.n(Vmax)} kN`], ['|M|<sub>máx</sub>', `${K.n(Mmax)} kN·m em x = ${K.n(r.xs[iM])} m`],
          ['Seção', `${sp.name} · I = ${K.f(sp.I * 1e12 / 1e4, '', 4)} cm⁴ · W = ${K.n(sp.W * 1e6)} cm³`],
          ['σ<sub>máx</sub> (flexão)', `${K.n(sig)} MPa`], ['τ<sub>máx</sub> (cisalhamento)', `${K.n(tau)} MPa`],
          ['Coef. de segurança (σ<sub>esc</sub>/σ)', K.verdict(FS)],
          ['Flecha máxima', `${K.n(dmax)} mm em x = ${K.n(r.xs[iv])} m · ${dmax <= lim ? `<span class="good">≤ L/250 = ${K.n(lim)} mm</span>` : `<span class="bad">&gt; L/250 = ${K.n(lim)} mm</span>`}`],
        ]));
        cv.draw = (g, W, H) => drawBeam(g, W, H, fb.st, loads, r.reac);
        cv.redraw();
      } catch (e) { out.append(h('div', { class: 'err' }, e.message)); }
    }
    run();
  }
  function drawBeam(g, W, H, cfg, loads, reac) {
    const L = cfg.L, x0 = 40, x1 = W - 40, X = x => x0 + (x1 - x0) * x / L, y = H / 2 + 10;
    g.fillStyle = '#2b4a78'; g.fillRect(x0, y - 6, x1 - x0, 12); g.strokeStyle = '#9fb4d0'; g.strokeRect(x0, y - 6, x1 - x0, 12);
    g.strokeStyle = '#9fb4d0'; g.fillStyle = '#9fb4d0'; g.lineWidth = 1.5;
    if (cfg.tipo === 'eng') { g.fillRect(x0 - 10, y - 30, 10, 60); for (let k = -30; k < 30; k += 8) { g.beginPath(); g.moveTo(x0 - 10, y + k); g.lineTo(x0 - 18, y + k + 8); g.stroke(); } }
    else for (const [xx, roller] of [[cfg.a, false], [cfg.b, true]]) { const px = X(xx); g.beginPath(); g.moveTo(px, y + 6); g.lineTo(px - 10, y + 24); g.lineTo(px + 10, y + 24); g.closePath(); g.stroke(); if (roller) { g.beginPath(); g.arc(px - 5, y + 28, 3, 0, 7); g.arc(px + 5, y + 28, 3, 0, 7); g.stroke(); } else { g.beginPath(); g.moveTo(px - 14, y + 26); g.lineTo(px + 14, y + 26); g.stroke(); } }
    const arrow = (x, ya, yb, c) => { g.strokeStyle = c; g.fillStyle = c; g.beginPath(); g.moveTo(x, ya); g.lineTo(x, yb); g.stroke(); const d = Math.sign(yb - ya); g.beginPath(); g.moveTo(x, yb); g.lineTo(x - 5, yb - 8 * d); g.lineTo(x + 5, yb - 8 * d); g.closePath(); g.fill(); };
    g.font = '11px Barlow'; g.textAlign = 'center';
    for (const q of loads) {
      if (q.t === 'P') { const d = q.v >= 0 ? 1 : -1; arrow(X(q.x1), y - 6 - 40 * d, y - 6 - (d < 0 ? -12 : 0), '#ff4d6d'); g.fillText(`${q.v} kN`, X(q.x1), y - 52); }
      if (q.t === 'w') { const a = X(q.x1), b = X(Math.min(L, q.x2)); g.strokeStyle = '#ffd166'; g.beginPath(); g.moveTo(a, y - 32); g.lineTo(b, y - 32); g.stroke(); for (let px = a; px <= b + 0.1; px += Math.max(10, (b - a) / 8)) arrow(px, y - 32, y - 7, '#ffd166'); g.fillStyle = '#ffd166'; g.fillText(`${q.v} kN/m`, (a + b) / 2, y - 38); }
      if (q.t === 'M') { g.strokeStyle = '#c77dff'; g.beginPath(); g.arc(X(q.x1), y, 16, Math.PI * 0.9, Math.PI * 2.3); g.stroke(); g.fillStyle = '#c77dff'; g.fillText(`${q.v} kN·m`, X(q.x1), y - 22); }
    }
    for (const r of reac) if (r.F !== undefined) { const px = X(r.x); arrow(px, y + 60, y + 36, '#3ddc84'); g.fillStyle = '#3ddc84'; g.fillText(`${r.label} = ${K.n(r.F / 1e3, 3)} kN`, px, y + 72); }
    g.fillStyle = '#6f8bad'; g.fillText('0', x0, y + 48); g.fillText(`${L} m`, x1, y + 48);
  }

  function secMohr(area) {
    const f = K.form([{ k: 'sx', l: 'σx', u: 'MPa', v: '80' }, { k: 'sy', l: 'σy', u: 'MPa', v: '-40' }, { k: 'txy', l: 'τxy', u: 'MPa', v: '30' }, { k: 'th', l: 'Rotação do elemento θ', u: '°', v: '20' }, { k: 'Sy', l: 'σ de escoamento (critério)', u: 'MPa', v: '250' }], () => run(), { cols: 2 });
    const out = h('div'), ec = h('div');
    const g2 = h('div', { class: 'grid2' });
    const cc = CS.chartBox('tall');
    g2.append(h('div', { class: 'col' }, CS.card('Estado de tensões', f.el), CS.card('Resultados', out), CS.card('Elemento girado de θ', ec)), CS.card('Círculo de Mohr', cc));
    area.append(g2);
    const ch = new MS.Chart(cc, { equal: true, xlabel: 'σ [MPa]', ylabel: 'τ [MPa]', pad: 0.15, readout: (x, y) => `σ = ${K.n(x)}\nτ = ${K.n(y)}` });
    const el = K.canvas(ec, 170, null);
    function run() {
      const { sx, sy, txy, th, Sy } = f.st;
      const C = (sx + sy) / 2, R = Math.hypot((sx - sy) / 2, txy);
      const s1 = C + R, s2 = C - R, tp = 0.5 * Math.atan2(2 * txy, sx - sy) * 180 / Math.PI;
      const t2 = 2 * th * Math.PI / 180;
      const sxp = C + (sx - sy) / 2 * Math.cos(t2) + txy * Math.sin(t2), syp = C - (sx - sy) / 2 * Math.cos(t2) - txy * Math.sin(t2), txp = -(sx - sy) / 2 * Math.sin(t2) + txy * Math.cos(t2);
      const vm = Math.sqrt(s1 * s1 - s1 * s2 + s2 * s2), tr = Math.max(Math.abs(s1), Math.abs(s2), Math.abs(s1 - s2));
      const circ = { x: [], y: [] }; for (let i = 0; i <= 120; i++) { const a = i / 120 * 2 * Math.PI; circ.x.push(C + R * Math.cos(a)); circ.y.push(R * Math.sin(a)); }
      ch.set({ series: [{ ...circ, color: '#4fb3ff', width: 2 }, { x: [sx, sy], y: [txy, -txy], color: 'rgba(255,255,255,0.4)', dash: [4, 3], width: 1 }, { x: [sxp, syp], y: [txp, -txp], color: '#ffd166', width: 1.5 }],
        markers: [{ x: sx, y: txy, shape: 'dot', color: '#4fb3ff', label: 'X' }, { x: sy, y: -txy, shape: 'dot', color: '#4fb3ff', label: 'Y' }, { x: s1, y: 0, shape: 'dot', color: '#3ddc84', label: 'σ₁' }, { x: s2, y: 0, shape: 'dot', color: '#3ddc84', label: 'σ₂' },
          { x: C, y: R, shape: 'dot', color: '#ff4d6d', label: 'τmáx' }, { x: sxp, y: txp, shape: 'sq', color: '#ffd166', label: "X'" }, { x: C, y: 0, shape: 'plus', color: '#9fb4d0' }] });
      out.innerHTML = '';
      out.append(CS.kv([
        ['Centro C · raio R', `${K.n(C)} · ${K.n(R)} MPa`], ['σ₁ · σ₂', `${K.n(s1)} · ${K.n(s2)} MPa`], ['τ<sub>máx</sub> (no plano)', `${K.n(R)} MPa`],
        ['Ângulo principal θp', `${K.n(tp)}°`], [`σx' · σy' · τx'y' (θ = ${th}°)`, `${K.n(sxp)} · ${K.n(syp)} · ${K.n(txp)} MPa`],
        ['von Mises σ\'', `${K.n(vm)} MPa → FS = ${K.verdict(Sy / vm)}`], ['Tresca (2τ<sub>máx</sub>)', `${K.n(tr)} MPa → FS = ${K.verdict(Sy / tr)}`],
      ]));
      el.draw = (g, W, H) => {
        const cx = W / 2, cy = H / 2, s = 46;
        g.save(); g.translate(cx, cy); g.rotate(-th * Math.PI / 180);
        g.strokeStyle = '#9fb4d0'; g.fillStyle = 'rgba(79,179,255,0.12)'; g.fillRect(-s / 2, -s / 2, s, s); g.strokeRect(-s / 2, -s / 2, s, s);
        const arr = (x0, y0, x1, y1, c, t) => { g.strokeStyle = c; g.fillStyle = c; g.lineWidth = 2; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); const a = Math.atan2(y1 - y0, x1 - x0); g.beginPath(); g.moveTo(x1, y1); g.lineTo(x1 - 7 * Math.cos(a - 0.4), y1 - 7 * Math.sin(a - 0.4)); g.lineTo(x1 - 7 * Math.cos(a + 0.4), y1 - 7 * Math.sin(a + 0.4)); g.fill(); if (t) { g.save(); g.rotate(th * Math.PI / 180 * 0); g.font = '10px Share Tech Mono'; g.fillText(t, x1 + 4, y1 - 4); g.restore(); } };
        const k = 30 / Math.max(1, Math.abs(sxp), Math.abs(syp), Math.abs(txp));
        if (Math.abs(sxp) > 1e-9) { const d = Math.sign(sxp) * Math.max(8, Math.abs(sxp) * k); arr(s / 2 + (d < 0 ? -d : 0), 0, s / 2 + (d > 0 ? d : 0) + (d < 0 ? 0 : 0), 0, '#4fb3ff', "σx'"); }
        if (Math.abs(syp) > 1e-9) { const d = Math.sign(syp) * Math.max(8, Math.abs(syp) * k); arr(0, -s / 2 - (d < 0 ? -d : 0), 0, -s / 2 - (d > 0 ? d : 0), '#ff9f1c', "σy'"); }
        if (Math.abs(txp) > 1e-9) { const d = Math.sign(txp) * Math.max(8, Math.abs(txp) * k) / 2; arr(s / 2 + 5, d, s / 2 + 5, -d, '#ffd166', "τ'"); arr(-d, -s / 2 - 5, d, -s / 2 - 5, '#ffd166'); }
        g.restore();
        g.fillStyle = '#6f8bad'; g.font = '11px Barlow'; g.textAlign = 'left'; g.fillText(`θ = ${th}° (anti-horário)`, 8, H - 8);
      };
      el.redraw();
    }
    run();
  }

  function secFlamb(area) {
    const fc = K.form([
      { k: 'L', l: 'Comprimento L', u: 'm', v: '2' },
      { k: 'Kf', l: 'Vinculação (fator K)', type: 'sel', v: '1', opts: [['1', 'Biarticulada (K = 1)'], ['2', 'Engastada-livre (K = 2)'], ['0.7', 'Engastada-articulada (K = 0,7)'], ['0.5', 'Biengastada (K = 0,5)']] },
      { k: 'P', l: 'Carga de compressão P', u: 'kN', v: '50' },
    ], () => run(), { cols: 1 });
    const fs = K.form(SEC_FIELDS.map(x => (x.k === 'sec' ? { ...x, v: 'tubo' } : x)), () => { secVisibility(fs); run(); }, { cols: 2 });
    const out = h('div'), cb = CS.chartBox();
    area.append(h('div', { class: 'grid2' }, h('div', { class: 'col' }, CS.card('Coluna', fc.el), CS.card('Seção e material', fs.el)), h('div', { class: 'col' }, CS.card('Resultados', out), CS.card('Tensão crítica × esbeltez', cb))));
    const ch = new MS.Chart(cb, { xlabel: 'λ = KL/r', ylabel: 'σcr [MPa]', readout: (x, y) => `λ = ${K.n(x)}\nσ = ${K.n(y)} MPa` });
    secVisibility(fs);
    function run() {
      const sp = secProps(fs.st), Kf = +fc.st.Kf, L = fc.st.L;
      const lam = Kf * L / sp.r, lamc = Math.sqrt(2 * Math.PI ** 2 * sp.E / sp.sy);
      const euler = l => Math.PI ** 2 * sp.E / (l * l), johnson = l => sp.sy - (sp.sy / (2 * Math.PI)) ** 2 * l * l / sp.E;
      const scr = lam >= lamc ? euler(lam) : johnson(lam);
      const Pcr = scr * sp.A, FS = Pcr / (fc.st.P * 1e3);
      const xs = K.linspace(1, Math.max(250, lam * 1.3), 300);
      ch.set({ series: [
        { x: xs, y: xs.map(l => Math.min(euler(l), sp.sy * 3) / 1e6), color: 'rgba(79,179,255,0.45)', dash: [5, 4], width: 1.3, name: 'Euler' },
        { x: xs.filter(l => l <= lamc), y: xs.filter(l => l <= lamc).map(l => johnson(l) / 1e6), color: '#ff9f1c', width: 2, name: 'Johnson' },
        { x: xs.filter(l => l >= lamc), y: xs.filter(l => l >= lamc).map(l => euler(l) / 1e6), color: '#4fb3ff', width: 2 },
      ], hlines: [{ y: sp.sy / 1e6, color: 'rgba(255,77,109,0.6)', label: 'σesc' }], vlines: [{ x: lamc, color: 'rgba(199,125,255,0.6)', label: 'λc' }],
      markers: [{ x: lam, y: scr / 1e6, shape: 'dot', color: '#ffd166', size: 6, label: 'coluna' }, { x: lam, y: fc.st.P * 1e3 / sp.A / 1e6, shape: 'x', color: '#ff4d6d', label: 'σ aplicada' }] });
      out.innerHTML = '';
      out.append(CS.kv([
        ['Seção', `${sp.name} · A = ${K.n(sp.A * 1e4)} cm² · I<sub>mín</sub> = ${K.n(sp.Imin * 1e8)} cm⁴`], ['Raio de giração r', `${K.n(sp.r * 1e3)} mm`],
        ['Esbeltez λ = KL/r', `${K.n(lam)} (λc = ${K.n(lamc)}) → ${lam >= lamc ? 'coluna longa (Euler)' : 'coluna intermediária (Johnson)'}`],
        ['σ crítica', `${K.n(scr / 1e6)} MPa`], ['P crítica', `${K.n(Pcr / 1e3)} kN`], ['Coef. de segurança', K.verdict(FS, 2)],
      ]));
    }
    run();
  }

  /* ════════════════ 2. DINÂMICA E VIBRAÇÕES ════════════════ */
  const toolVib = (host, onClean) => {
    const { body } = CS.page(host, {
      title: 'Dinâmica e Vibrações', lead: 'Sistema de 1 grau de liberdade m-c-k: vibração livre, vibração forçada (ressonância) e isolamento de vibrações.',
      learn: `<p><b>Modelo:</b> m·ẍ + c·ẋ + k·x = F(t). <b>Frequência natural</b> ω<sub>n</sub> = √(k/m) [rad/s], f<sub>n</sub> = ω<sub>n</sub>/2π. <b>Fator de amortecimento</b> ζ = c/(2√(km)) = c/c<sub>c</sub>.</p>
      <p><b>Vibração livre:</b> ζ &lt; 1 é subamortecido (oscila com ω<sub>d</sub> = ω<sub>n</sub>√(1−ζ²)); ζ = 1 é crítico (retorno mais rápido sem oscilar); ζ &gt; 1 é superamortecido. O <b>decremento logarítmico</b> δ = ln(x<sub>i</sub>/x<sub>i+1</sub>) = 2πζ/√(1−ζ²) permite medir ζ experimentalmente.</p>
      <p><b>Vibração forçada</b> F₀·sen(ωt), com r = ω/ω<sub>n</sub>: X = (F₀/k)/√((1−r²)² + (2ζr)²). Em r ≈ 1 ocorre <b>ressonância</b>, com amplificação ≈ 1/(2ζ).</p>
      <p><b>Isolamento:</b> transmissibilidade TR = √(1+(2ζr)²)/√((1−r²)²+(2ζr)²). Só há isolamento (TR &lt; 1) para <b>r &gt; √2</b>, por isso se usam molas macias. Mais amortecimento reduz o pico na ressonância, mas piora o isolamento em alta frequência.</p>
      <p><b>Deflexão estática:</b> δ<sub>st</sub> = m·g/k = g/ω<sub>n</sub>². É a forma prática de especificar coxins.</p>`,
    });
    onClean(K.sections(body, 'vib', [
      { id: 'livre', label: 'Vibração livre', render: secLivre },
      { id: 'forc', label: 'Vibração forçada', render: secForcada },
      { id: 'iso', label: 'Isolamento', render: secIso },
    ]));
  };
  const mckFields = (c = '2') => [{ k: 'm', l: 'Massa m', u: 'kg', v: '1' }, { k: 'k', l: 'Rigidez k', u: 'N/m', v: '400' }, { k: 'c', l: 'Amortecimento c', u: 'N·s/m', v: c }];
  function freeResp(m, k, c, x0, v0, t) {
    const wn = Math.sqrt(k / m), z = c / (2 * Math.sqrt(k * m));
    if (z < 1 - 1e-9) { const wd = wn * Math.sqrt(1 - z * z); return Math.exp(-z * wn * t) * (x0 * Math.cos(wd * t) + (v0 + z * wn * x0) / wd * Math.sin(wd * t)); }
    if (z < 1 + 1e-9) return (x0 + (v0 + wn * x0) * t) * Math.exp(-wn * t);
    const s1 = -z * wn + wn * Math.sqrt(z * z - 1), s2 = -z * wn - wn * Math.sqrt(z * z - 1);
    const A = (v0 - s2 * x0) / (s1 - s2); return A * Math.exp(s1 * t) + (x0 - A) * Math.exp(s2 * t);
  }
  function springAnim(host, getX, scale = 1) {
    const cv = K.canvas(host, 110, null);
    const stop = K.animate(cv.box, t => {
      cv.draw = (g, W, H) => {
        const x = getX(t) * scale, y = H / 2, wall = 20, x0 = W * 0.55 + x;
        g.fillStyle = '#223451'; g.fillRect(4, 10, wall - 4, H - 20);
        g.strokeStyle = '#9fe8c0'; g.lineWidth = 2; g.beginPath(); g.moveTo(wall, y - 14);
        const n = 10; for (let i = 0; i <= n; i++) g.lineTo(wall + (x0 - 30 - wall) * i / n, y - 14 + (i % 2 ? -9 : 9) * (i > 0 && i < n));
        g.lineTo(x0 - 30, y - 14); g.stroke();
        g.strokeStyle = '#ffb04a'; g.beginPath(); g.moveTo(wall, y + 14); g.lineTo(wall + 30, y + 14); g.stroke(); g.strokeRect(wall + 30, y + 6, 40, 16); g.beginPath(); g.moveTo(wall + 50, y + 14); g.lineTo(x0 - 30, y + 14); g.stroke();
        g.fillStyle = '#2fbf7a'; g.fillRect(x0 - 30, y - 30, 60, 60); g.fillStyle = '#e8f4ff'; g.font = '14px Barlow'; g.textAlign = 'center'; g.fillText('m', x0, y + 5);
        g.strokeStyle = 'rgba(255,255,255,0.2)'; g.setLineDash([3, 3]); g.beginPath(); g.moveTo(W * 0.55, 6); g.lineTo(W * 0.55, H - 6); g.stroke(); g.setLineDash([]);
      };
      cv.redraw();
    });
    return stop;
  }
  function secLivre(area, onClean) {
    const f = K.form([...mckFields(), { k: 'x0', l: 'Deslocamento inicial x₀', u: 'mm', v: '20' }, { k: 'v0', l: 'Velocidade inicial v₀', u: 'mm/s', v: '0' }], () => run(), { cols: 2 });
    const out = h('div'), cb = CS.chartBox(), anim = CS.card('Animação (escala de tempo real)');
    area.append(h('div', { class: 'grid2' }, h('div', { class: 'col' }, CS.card('Parâmetros', f.el), CS.card('Resultados', out)), h('div', { class: 'col' }, CS.card('Resposta livre x(t)', cb), anim)));
    const ch = new MS.Chart(cb, { xlabel: 't [s]', ylabel: 'x [mm]', readout: (t, y) => `t = ${K.n(t)} s\nx = ${K.n(y)} mm` });
    let tEnd = 1;
    onClean(springAnim(anim, t => { const s = f.st; return freeResp(s.m, s.k, s.c, s.x0, s.v0, t % tEnd); }, 1.5));
    function run() {
      const { m, k, c, x0, v0 } = f.st;
      const wn = Math.sqrt(k / m), z = c / (2 * Math.sqrt(k * m)), wd = wn * Math.sqrt(Math.max(0, 1 - z * z));
      tEnd = Math.min(60, z < 1 ? Math.max(4 / (z * wn || 1e-9), 3 * 2 * Math.PI / wn) : 8 / wn);
      if (z < 0.02) tEnd = 12 * 2 * Math.PI / wn;
      const ts = K.linspace(0, tEnd, 800);
      const X0 = Math.sqrt(x0 * x0 + ((v0 + z * wn * x0) / (wd || 1)) ** 2);
      ch.set({ series: [{ x: ts, y: ts.map(t => freeResp(m, k, c, x0, v0, t)), color: '#4fb3ff', width: 2, name: 'x(t)' },
        ...(z < 1 ? [{ x: ts, y: ts.map(t => X0 * Math.exp(-z * wn * t)), color: 'rgba(255,209,102,0.5)', dash: [4, 4], width: 1, name: 'envelope e^(−ζωn t)' }, { x: ts, y: ts.map(t => -X0 * Math.exp(-z * wn * t)), color: 'rgba(255,209,102,0.5)', dash: [4, 4], width: 1 }] : [])] });
      out.innerHTML = '';
      out.append(CS.kv([
        ['ω<sub>n</sub> · f<sub>n</sub>', `${K.n(wn)} rad/s · ${K.n(wn / 2 / Math.PI)} Hz`], ['Período natural T<sub>n</sub>', `${K.n(2 * Math.PI / wn)} s`],
        ['ζ (fator de amortecimento)', `${K.n(z)} → ${z < 1 ? 'subamortecido' : Math.abs(z - 1) < 1e-6 ? 'crítico' : 'superamortecido'}`],
        ['c crítico = 2√(km)', `${K.n(2 * Math.sqrt(k * m))} N·s/m`],
        z < 1 ? ['ω<sub>d</sub> (amortecida)', `${K.n(wd)} rad/s`] : null,
        z < 1 ? ['Decremento logarítmico δ', K.n(2 * Math.PI * z / Math.sqrt(1 - z * z))] : null,
        ['Deflexão estática m·g/k', `${K.n(m * 9.81 / k * 1e3)} mm`],
      ]));
    }
    run();
  }
  const MF = (r, z) => 1 / Math.sqrt((1 - r * r) ** 2 + (2 * z * r) ** 2);
  const TR = (r, z) => Math.sqrt(1 + (2 * z * r) ** 2) / Math.sqrt((1 - r * r) ** 2 + (2 * z * r) ** 2);
  function secForcada(area, onClean) {
    const f = K.form([...mckFields('4'), { k: 'F0', l: 'Amplitude da força F₀', u: 'N', v: '10' }, { k: 'fr', l: 'Frequência da força f', u: 'Hz', v: '3' }], () => run(), { cols: 2 });
    const out = h('div'), b1 = CS.chartBox('sm'), b2 = CS.chartBox('sm'), b3 = CS.chartBox();
    area.append(h('div', { class: 'grid2' }, h('div', { class: 'col' }, CS.card('Parâmetros', f.el), CS.card('Resultados', out), CS.card('Resposta no tempo (partindo do repouso)', b3)), h('div', { class: 'col' }, CS.card('Fator de amplificação X/(F₀/k) × r', b1), CS.card('Fase φ × r', b2))));
    const c1 = new MS.Chart(b1, { xlabel: 'r = ω/ωn', ylabel: 'X·k/F₀', yrange: [0, 6], readout: (x, y) => `r = ${K.n(x)}\nMF = ${K.n(y)}` });
    const c2 = new MS.Chart(b2, { xlabel: 'r = ω/ωn', ylabel: 'φ [°]', readout: (x, y) => `r = ${K.n(x)}\nφ = ${K.n(y)}°` });
    const c3 = new MS.Chart(b3, { xlabel: 't [s]', ylabel: 'x [mm]', readout: (t, y) => `t = ${K.n(t)}\nx = ${K.n(y)} mm` });
    function run() {
      const { m, k, c, F0, fr } = f.st;
      const wn = Math.sqrt(k / m), z = c / (2 * Math.sqrt(k * m)), w = 2 * Math.PI * fr, r = w / wn;
      const rs = K.linspace(0.01, 3, 400);
      const zs = [0.05, 0.1, 0.25, 0.5, 1];
      c1.set({ series: [...zs.map((zz, i) => ({ x: rs, y: rs.map(x => Math.min(8, MF(x, zz))), color: 'rgba(159,180,208,0.35)', width: 1, name: i === 0 ? 'ζ = 0,05 · 0,1 · 0,25 · 0,5 · 1' : undefined })), { x: rs, y: rs.map(x => Math.min(8, MF(x, z))), color: '#4fb3ff', width: 2.2, name: `ζ = ${K.n(z, 3)}` }],
        markers: [{ x: r, y: Math.min(8, MF(r, z)), shape: 'dot', color: '#ffd166', size: 6 }], vlines: [{ x: 1, color: 'rgba(255,77,109,0.5)', label: 'ressonância' }] });
      const ph = x => Math.atan2(2 * z * x, 1 - x * x) * 180 / Math.PI;
      c2.set({ series: [{ x: rs, y: rs.map(ph), color: '#ff9f1c', width: 2 }], markers: [{ x: r, y: ph(r), shape: 'dot', color: '#ffd166', size: 6 }] });
      // RK4 a partir do repouso
      const tEnd = Math.min(60, Math.max(8 * 2 * Math.PI / w, 5 / Math.max(1e-3, z * wn))), N = 3000, dt = tEnd / N;
      let x = 0, v = 0; const tx = [0], ty = [0];
      const acc = (t, x_, v_) => (F0 * Math.sin(w * t) - c * v_ - k * x_) / m;
      for (let i = 0; i < N; i++) {
        const t = i * dt;
        const k1x = v, k1v = acc(t, x, v), k2x = v + dt / 2 * k1v, k2v = acc(t + dt / 2, x + dt / 2 * k1x, v + dt / 2 * k1v), k3x = v + dt / 2 * k2v, k3v = acc(t + dt / 2, x + dt / 2 * k2x, v + dt / 2 * k2v), k4x = v + dt * k3v, k4v = acc(t + dt, x + dt * k3x, v + dt * k3v);
        x += dt / 6 * (k1x + 2 * k2x + 2 * k3x + k4x); v += dt / 6 * (k1v + 2 * k2v + 2 * k3v + k4v);
        tx.push(t + dt); ty.push(x * 1e3);
      }
      const X = F0 / k * MF(r, z);
      c3.set({ series: [{ x: tx, y: ty, color: '#4fb3ff', width: 1.6, name: 'x(t) = transitório + regime' }], hlines: [{ y: X * 1e3, color: 'rgba(61,220,132,0.5)', label: '±X regime' }, { y: -X * 1e3, color: 'rgba(61,220,132,0.5)' }] });
      out.innerHTML = '';
      out.append(CS.kv([
        ['ω<sub>n</sub> · f<sub>n</sub>', `${K.n(wn)} rad/s · ${K.n(wn / 2 / Math.PI)} Hz`], ['ζ', K.n(z)], ['r = ω/ω<sub>n</sub>', K.n(r)],
        ['Deflexão estática F₀/k', `${K.n(F0 / k * 1e3)} mm`], ['Fator de amplificação', `${K.n(MF(r, z))} ${Math.abs(r - 1) < 0.15 ? '<span class="bad">perto da ressonância!</span>' : ''}`],
        ['Amplitude X em regime', `${K.n(X * 1e3)} mm`], ['Fase φ (atraso)', `${K.n(Math.atan2(2 * z * r, 1 - r * r) * 180 / Math.PI)}°`],
        z < 0.707 ? ['Pico de ressonância', `MF ≈ ${K.n(1 / (2 * z * Math.sqrt(1 - z * z)))} em r = ${K.n(Math.sqrt(1 - 2 * z * z))}`] : null,
      ]));
    }
    run();
  }
  function secIso(area) {
    const f = K.form([{ k: 'm', l: 'Massa da máquina', u: 'kg', v: '200' }, { k: 'rpm', l: 'Rotação de operação', u: 'rpm', v: '1800' }, { k: 'z', l: 'Amortecimento do coxim ζ', u: '', v: '0.05' }, { k: 'iso', l: 'Isolamento desejado', u: '%', v: '85' }], () => run(), { cols: 2 });
    const out = h('div'), cb = CS.chartBox('tall');
    area.append(h('div', { class: 'grid2' }, h('div', { class: 'col' }, CS.card('Dados', f.el), CS.card('Coxim recomendado', out)), CS.card('Transmissibilidade TR × r', cb)));
    const ch = new MS.Chart(cb, { xlabel: 'r = ω/ωn', ylabel: 'TR', yrange: [0, 5], readout: (x, y) => `r = ${K.n(x)}\nTR = ${K.n(y)}` });
    function run() {
      const { m, rpm, z, iso } = f.st;
      const w = rpm * 2 * Math.PI / 60, target = 1 - iso / 100;
      const r = K.solve(x => TR(x, z) - target, Math.SQRT2 + 1e-6, 200);
      const wn = w / r, k = m * wn * wn, dst = 9.81 / (wn * wn);
      const rs = K.linspace(0.01, Math.max(5, r * 1.3), 500);
      ch.set({ regions: [{ x0: Math.SQRT2, x1: Infinity, y0: -Infinity, y1: Infinity, color: 'rgba(61,220,132,0.06)' }], series: [0.05, 0.2, 0.5].filter(zz => Math.abs(zz - z) > 1e-6).map(zz => ({ x: rs, y: rs.map(x => Math.min(6, TR(x, zz))), color: 'rgba(159,180,208,0.35)', width: 1 })).concat([{ x: rs, y: rs.map(x => Math.min(6, TR(x, z))), color: '#4fb3ff', width: 2.2, name: `ζ = ${z}` }]),
        hlines: [{ y: 1, color: 'rgba(255,255,255,0.3)', label: 'TR = 1' }, { y: target, color: 'rgba(255,209,102,0.6)', label: 'meta' }], vlines: [{ x: Math.SQRT2, color: 'rgba(61,220,132,0.6)', label: '√2: início do isolamento' }],
        markers: [{ x: r, y: target, shape: 'dot', color: '#ffd166', size: 6 }] });
      out.innerHTML = '';
      out.append(CS.kv([
        ['Frequência de excitação', `${K.n(w)} rad/s (${K.n(rpm / 60)} Hz)`], ['r necessário', K.n(r)],
        ['Frequência natural máx. do sistema', `${K.n(wn / 2 / Math.PI)} Hz`], ['Rigidez total máx. dos coxins', `${K.f(k, 'N/m')} (${K.f(k / 4, 'N/m')} por coxim, se 4)`],
        ['Deflexão estática mín.', `${K.n(dst * 1e3)} mm`],
      ]));
    }
    run();
  }

  /* ════════════════ 3. ELEMENTOS DE MÁQUINAS ════════════════ */
  const toolElem = (host, onClean) => {
    const { body } = CS.page(host, {
      title: 'Elementos de Máquinas e Projeto Mecânico', lead: 'Dimensionamento de eixos, engrenagens, rolamentos e uniões parafusadas, e análise de fadiga.',
      learn: `<p><b>Eixos:</b> transmitem torque T = P/ω e sofrem flexão. Pela teoria da energia de distorção (von Mises), com flexão alternada M e torque constante T, o critério DE-Goodman dá d = [16n/π·(2K<sub>f</sub>M/S<sub>e</sub> + √3·K<sub>fs</sub>T/S<sub>ut</sub>)]<sup>1/3</sup>.</p>
      <p><b>Engrenagens:</b> d = m·z, relação i = z₂/z₁ = n₁/n₂. Força tangencial F<sub>t</sub> = P/v. A tensão no pé do dente, pela <b>equação de Lewis</b>, é σ = K<sub>v</sub>·F<sub>t</sub>/(b·m·Y).</p>
      <p><b>Rolamentos:</b> vida nominal L₁₀ = (C/P)<sup>p</sup> milhões de rotações, com p = 3 (esferas) ou 10/3 (rolos). Carga equivalente P = X·F<sub>r</sub> + Y·F<sub>a</sub>. L₁₀ é a vida que 90% dos rolamentos atingem.</p>
      <p><b>Parafusos:</b> pré-carga F<sub>i</sub> ≈ 0,75·A<sub>t</sub>·S<sub>p</sub> (reutilizável). Torque de aperto T = K·F<sub>i</sub>·d. Com carga externa P, o parafuso recebe C·P e a junta perde (1−C)·P. A junta abre quando P = F<sub>i</sub>/(1−C).</p>
      <p><b>Fadiga:</b> S<sub>e</sub> = k<sub>a</sub>k<sub>b</sub>k<sub>c</sub>k<sub>e</sub>·S'<sub>e</sub>, com S'<sub>e</sub> ≈ 0,5·S<sub>ut</sub> para aços. Os fatores de Marin descontam acabamento, tamanho, tipo de carga e confiabilidade. Com tensão média σ<sub>m</sub>, usa-se Goodman (1/n = σa/Se + σm/Sut), Soderberg (mais conservador) ou Gerber (parabólico).</p>`,
    });
    onClean(K.sections(body, 'elem', [
      { id: 'eixo', label: 'Eixos', render: secEixo },
      { id: 'eng', label: 'Engrenagens', render: secEng },
      { id: 'rol', label: 'Rolamentos', render: secRol },
      { id: 'paraf', label: 'Parafusos', render: secParaf },
      { id: 'fad', label: 'Fadiga', render: secFadiga },
    ]));
  };
  const DSTD = [6, 8, 10, 12, 15, 17, 20, 22, 25, 28, 30, 32, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 90, 100, 110, 120, 140, 160];
  function secEixo(area) {
    const f = K.form([
      { k: 'P', l: 'Potência', u: 'kW', v: '15' }, { k: 'n', l: 'Rotação', u: 'rpm', v: '1200' }, { k: 'M', l: 'Momento fletor (alternado)', u: 'N·m', v: '200' },
      { k: 'mat', l: 'Material', type: 'sel', v: '1', opts: STEELS }, { k: 'Kf', l: 'Kf (conc. tensão flexão)', u: '', v: '1.7' }, { k: 'Kfs', l: 'Kfs (conc. tensão torção)', u: '', v: '1.5' },
      { k: 'marin', l: 'Produto dos fatores de Marin', u: '', v: '0.6', tip: 'ka·kb·kc·kd·ke (acabamento, tamanho, carga, temperatura, confiabilidade)' }, { k: 'FS', l: 'Coef. de segurança n', u: '', v: '2' },
    ], () => run(), { cols: 2 });
    const out = h('div');
    area.append(h('div', { class: 'grid2' }, CS.card('Dados do eixo', f.el), CS.card('Dimensionamento', out)));
    function run() {
      const { P, n, M, Kf, Kfs, marin, FS } = f.st, m = K.MATS[+f.st.mat];
      const T = P * 1e3 / (n * 2 * Math.PI / 60), Sut = m.su * 1e6, Sy = m.sy * 1e6, Se = marin * 0.5 * Math.min(Sut, 1400e6);
      const dS = Math.cbrt(16 * FS * Math.sqrt(4 * M * M + 3 * T * T) / (Math.PI * Sy));
      const dF = Math.cbrt(16 * FS / Math.PI * (2 * Kf * M / Se + Math.sqrt(3) * Kfs * T / Sut));
      const dmin = Math.max(dS, dF) * 1e3, dc = DSTD.find(d => d >= dmin) || Math.ceil(dmin);
      const d = dc / 1e3, J = Math.PI * d ** 4 / 32, tau = T * d / 2 / J, sig = 32 * M / (Math.PI * d ** 3), twist = T / (80e9 * J) * 180 / Math.PI;
      out.innerHTML = '';
      out.append(CS.kv([
        ['Torque T = P/ω', `${K.n(T)} N·m`], ['S<sub>ut</sub> · S<sub>y</sub>', `${m.su} · ${m.sy} MPa`], ['S<sub>e</sub> corrigido', `${K.n(Se / 1e6)} MPa`],
        ['d mínimo — estático (von Mises)', `${K.n(dS * 1e3)} mm`], ['d mínimo — fadiga (DE-Goodman)', `${K.n(dF * 1e3)} mm`],
        ['Diâmetro comercial recomendado', `<b class="good">${dc} mm</b>`], ['σ flexão · τ torção (em d)', `${K.n(sig / 1e6)} · ${K.n(tau / 1e6)} MPa`],
        ['Ângulo de torção', `${K.n(twist)} °/m ${twist > 1 ? '<span class="warn">(alto: &gt; 1°/m)</span>' : ''}`],
      ]));
    }
    run();
  }
  const LEWIS = [[12, .245], [13, .261], [14, .277], [15, .290], [16, .296], [17, .303], [18, .309], [19, .314], [20, .322], [21, .328], [22, .331], [24, .337], [26, .346], [28, .353], [30, .359], [34, .371], [38, .384], [43, .397], [50, .409], [60, .422], [75, .435], [100, .447], [150, .460], [300, .472], [400, .480]];
  const lewisY = z => { if (z <= 12) return LEWIS[0][1]; for (let i = 1; i < LEWIS.length; i++) if (z <= LEWIS[i][0]) { const [z0, y0] = LEWIS[i - 1], [z1, y1] = LEWIS[i]; return y0 + (y1 - y0) * (z - z0) / (z1 - z0); } return 0.485; };
  function secEng(area, onClean) {
    const f = K.form([
      { k: 'm', l: 'Módulo m', u: 'mm', v: '2' }, { k: 'z1', l: 'Dentes do pinhão z₁', u: '', v: '20' }, { k: 'z2', l: 'Dentes da coroa z₂', u: '', v: '50' },
      { k: 'al', l: 'Ângulo de pressão α', u: '°', v: '20' }, { k: 'b', l: 'Largura da face b', u: 'mm', v: '20' }, { k: 'P', l: 'Potência', u: 'kW', v: '5' },
      { k: 'n1', l: 'Rotação do pinhão', u: 'rpm', v: '1500' }, { k: 'sadm', l: 'Tensão admissível (flexão)', u: 'MPa', v: '200' },
    ], () => run(), { cols: 2 });
    const out = h('div'), anim = CS.card('Par engrenado (animação lenta)');
    area.append(h('div', { class: 'grid2' }, h('div', { class: 'col' }, CS.card('Dados', f.el), anim), CS.card('Geometria e esforços', out)));
    const cv = K.canvas(anim, 220, null);
    onClean(K.animate(cv.box, t => {
      const { m, z1, z2 } = f.st; const r1 = m * z1 / 2, r2 = m * z2 / 2;
      cv.draw = (g, W, H) => { const s = Math.min((W - 30) / (2 * (r1 + r2) + 4 * m), (H - 20) / (2 * Math.max(r1, r2) + 4 * m)); const cx = W / 2 - (r2 - r1) * s / 2; const a1 = t * 0.6, a2 = -a1 * z1 / z2 + Math.PI / z2 + Math.PI;
        K.drawGear(g, cx - r1 * s, H / 2, r1 * s, Math.round(z1), a1, '#ffb04a', '#ffcf8a'); K.drawGear(g, cx + r2 * s, H / 2, r2 * s, Math.round(z2), a2, '#7aa2ff', '#a9c2ff'); };
      cv.redraw();
    }));
    function run() {
      const { m, z1, z2, al, b, P, n1, sadm } = f.st;
      const d1 = m * z1, d2 = m * z2, i = z2 / z1, n2 = n1 / i, v = Math.PI * d1 / 1000 * n1 / 60;
      const Ft = P * 1e3 / v, Fr = Ft * Math.tan(al * Math.PI / 180), Kv = (6.1 + v) / 6.1;
      const Y = lewisY(z1), sig = Kv * Ft / (b * m * Y);
      out.innerHTML = '';
      out.append(CS.kv([
        ['Relação i = z₂/z₁', `${K.n(i)} · n₂ = ${K.n(n2)} rpm`], ['Diâmetros primitivos d₁ · d₂', `${K.n(d1)} · ${K.n(d2)} mm`],
        ['Diâmetros externos (d + 2m)', `${K.n(d1 + 2 * m)} · ${K.n(d2 + 2 * m)} mm`], ['Diâmetros de pé (d − 2,5m)', `${K.n(d1 - 2.5 * m)} · ${K.n(d2 - 2.5 * m)} mm`],
        ['Distância entre centros', `${K.n((d1 + d2) / 2)} mm`], ['Passo circular p = πm', `${K.n(Math.PI * m)} mm`],
        ['Velocidade tangencial', `${K.n(v)} m/s`], ['Torques T₁ · T₂', `${K.n(Ft * d1 / 2000)} · ${K.n(Ft * d2 / 2000)} N·m`],
        ['F<sub>t</sub> · F<sub>r</sub>', `${K.n(Ft)} · ${K.n(Fr)} N`], ['Fator de Lewis Y(z₁) · K<sub>v</sub>', `${K.n(Y, 3)} · ${K.n(Kv, 3)}`],
        ['σ no pé do dente (Lewis)', `${K.n(sig)} MPa`], ['Coef. de segurança', K.verdict(sadm / sig)],
        z1 < 17 ? ['Atenção', '<span class="warn">z₁ &lt; 17 com α = 20°: risco de interferência (adelgaçamento)</span>'] : null,
      ]));
    }
    run();
  }
  const A1 = { 90: 1, 95: 0.64, 96: 0.55, 97: 0.47, 98: 0.37, 99: 0.25 };
  function secRol(area) {
    const f = K.form([
      { k: 'tipo', l: 'Tipo', type: 'sel', v: '3', opts: [['3', 'Esferas (p = 3)'], ['3.333', 'Rolos (p = 10/3)']] },
      { k: 'C', l: 'Capacidade dinâmica C', u: 'kN', v: '30' }, { k: 'Fr', l: 'Carga radial Fr', u: 'kN', v: '4' }, { k: 'Fa', l: 'Carga axial Fa', u: 'kN', v: '1' },
      { k: 'X', l: 'Fator X', u: '', v: '0.56' }, { k: 'Y', l: 'Fator Y', u: '', v: '1.5' }, { k: 'n', l: 'Rotação', u: 'rpm', v: '1500' },
      { k: 'R', l: 'Confiabilidade', type: 'sel', v: '90', opts: Object.keys(A1).map(k => [k, k + ' %']) }, { k: 'Lh', l: 'Vida desejada', u: 'h', v: '20000' },
    ], () => run(), { cols: 2 });
    const out = h('div'), cb = CS.chartBox();
    area.append(h('div', { class: 'grid2' }, h('div', { class: 'col' }, CS.card('Dados', f.el), CS.card('Resultados', out)), CS.card('Vida × carga equivalente', cb)));
    const ch = new MS.Chart(cb, { ylog: true, xlabel: 'P [kN]', ylabel: 'L₁₀h [h]', readout: (x, y) => `P = ${K.n(x)} kN\nL = ${K.f(y, 'h')}` });
    function run() {
      const { C, Fr, Fa, X, Y, n, Lh } = f.st, p = +f.st.tipo, a1 = A1[f.st.R];
      const P = Math.max(Fr, X * Fr + Y * Fa), L10 = (C / P) ** p, L10h = L10 * 1e6 / (60 * n), Lna = a1 * L10h;
      const Creq = P * Math.pow(Lh * 60 * n / 1e6 / a1, 1 / p);
      const Ps = K.linspace(P * 0.3, P * 3, 200);
      ch.set({ series: [{ x: Ps, y: Ps.map(q => a1 * (C / q) ** p * 1e6 / (60 * n)), color: '#4fb3ff', width: 2 }], hlines: [{ y: Lh, color: 'rgba(255,209,102,0.6)', label: 'vida desejada' }], markers: [{ x: P, y: Lna, shape: 'dot', color: '#ffd166', size: 6 }] });
      out.innerHTML = '';
      out.append(CS.kv([
        ['Carga equivalente P', `${K.n(P)} kN`], ['L₁₀ (milhões de rotações)', K.n(L10)], ['L₁₀h', `${K.f(L10h, 'h')}`],
        [`Vida ajustada (R = ${f.st.R}%, a₁ = ${a1})`, `${K.f(Lna, 'h')} ${Lna >= Lh ? '<span class="good">✓ atende</span>' : '<span class="bad">✗ insuficiente</span>'}`],
        ['C necessário para a vida desejada', `${K.n(Creq)} kN`],
      ]));
    }
    run();
  }
  const BOLTS = { M6: [1, 20.1], M8: [1.25, 36.6], M10: [1.5, 58], M12: [1.75, 84.3], M14: [2, 115], M16: [2, 157], M20: [2.5, 245], M24: [3, 353], M30: [3.5, 561] };
  const CLASSES = { '4.6': [225, 240, 400], '5.8': [380, 420, 520], '8.8': [600, 640, 800], '10.9': [830, 940, 1040], '12.9': [970, 1100, 1220] };
  function secParaf(area) {
    const f = K.form([
      { k: 'd', l: 'Rosca métrica', type: 'sel', v: 'M12', opts: Object.keys(BOLTS) }, { k: 'cl', l: 'Classe de resistência', type: 'sel', v: '8.8', opts: Object.keys(CLASSES) },
      { k: 'pct', l: 'Pré-carga (% da carga de prova)', u: '%', v: '75' }, { k: 'Kt', l: 'Coef. de torque K', u: '', v: '0.2', tip: '0,2 seco · 0,15 lubrificado' },
      { k: 'P', l: 'Carga externa de tração (por parafuso)', u: 'kN', v: '15' }, { k: 'C', l: 'Fração de rigidez C = kb/(kb+km)', u: '', v: '0.25' },
    ], () => run(), { cols: 2 });
    const out = h('div'), cb = CS.chartBox();
    area.append(h('div', { class: 'grid2' }, h('div', { class: 'col' }, CS.card('Dados', f.el), CS.card('Resultados', out)), CS.card('Forças no parafuso e na junta × carga externa', cb)));
    const ch = new MS.Chart(cb, { xlabel: 'P [kN]', ylabel: 'Força [kN]', readout: (x, y) => `P = ${K.n(x)} kN\n${K.n(y)} kN` });
    function run() {
      const [pitch, At] = BOLTS[f.st.d], [Sp, Sy, Sut] = CLASSES[f.st.cl], dmm = +f.st.d.slice(1);
      const Fp = At * Sp / 1e3, Fi = f.st.pct / 100 * Fp, T = f.st.Kt * Fi * 1e3 * dmm / 1e3, C = f.st.C, P = f.st.P;
      const Fb = Fi + C * P, Fm = Fi - (1 - C) * P, P0 = Fi / (1 - C);
      const nL = (Fp - Fi) / (C * P), n0 = P0 / P;
      const Ps = K.linspace(0, Math.max(P0 * 1.4, P * 1.3), 200);
      ch.set({ series: [{ x: Ps, y: Ps.map(p => (p < P0 ? Fi + C * p : p)), color: '#ff9f1c', width: 2, name: 'parafuso Fb' }, { x: Ps, y: Ps.map(p => Math.max(0, Fi - (1 - C) * p)), color: '#4fb3ff', width: 2, name: 'junta (compressão) Fm' }],
        hlines: [{ y: Fp, color: 'rgba(255,77,109,0.6)', label: 'carga de prova' }], vlines: [{ x: P0, color: 'rgba(199,125,255,0.6)', label: 'separação' }, { x: P, color: 'rgba(255,209,102,0.6)', label: 'P' }] });
      out.innerHTML = '';
      out.append(CS.kv([
        ['Passo · área resistente A<sub>t</sub>', `${pitch} mm · ${At} mm²`], ['S<sub>p</sub> · S<sub>y</sub> · S<sub>ut</sub>', `${Sp} · ${Sy} · ${Sut} MPa`],
        ['Carga de prova F<sub>p</sub>', `${K.n(Fp)} kN`], ['Pré-carga F<sub>i</sub>', `${K.n(Fi)} kN`], ['Torque de aperto T = K·Fi·d', `<b>${K.n(T)} N·m</b>`],
        ['Força no parafuso Fb = Fi + C·P', `${K.n(Fb)} kN`], ['Compressão na junta', `${K.n(Fm)} kN`],
        ['Segurança ao escoamento (carga)', K.verdict(nL)], ['Segurança à separação', K.verdict(n0)],
      ]));
    }
    run();
  }
  const KA = { retificado: [1.58, -0.085], usinado: [4.51, -0.265], 'laminado a quente': [57.7, -0.718], forjado: [272, -0.995] };
  const KE = { 50: 1, 90: 0.897, 95: 0.868, 99: 0.814, 99.9: 0.753 };
  function secFadiga(area) {
    const f = K.form([
      { k: 'Sut', l: 'S<sub>ut</sub> (ruptura)', u: 'MPa', v: '600' }, { k: 'Sy', l: 'S<sub>y</sub> (escoamento)', u: 'MPa', v: '450' },
      { k: 'acab', l: 'Acabamento superficial', type: 'sel', v: 'usinado', opts: Object.keys(KA) }, { k: 'd', l: 'Diâmetro (fator de tamanho)', u: 'mm', v: '25' },
      { k: 'carga', l: 'Tipo de carga', type: 'sel', v: '1', opts: [['1', 'Flexão'], ['0.85', 'Axial'], ['0.59', 'Torção']] }, { k: 'conf', l: 'Confiabilidade', type: 'sel', v: '90', opts: Object.keys(KE).map(k => [k, k + ' %']) },
      { k: 'sa', l: 'Tensão alternada σ<sub>a</sub>', u: 'MPa', v: '120' }, { k: 'sm', l: 'Tensão média σ<sub>m</sub>', u: 'MPa', v: '80' },
    ], () => run(), { cols: 2 });
    const out = h('div'), cb = CS.chartBox('tall');
    area.append(h('div', { class: 'grid2' }, h('div', { class: 'col' }, CS.card('Dados', f.el), CS.card('Resultados', out)), CS.card('Diagrama de fadiga σa × σm', cb)));
    const ch = new MS.Chart(cb, { xlabel: 'σm [MPa]', ylabel: 'σa [MPa]', includeOrigin: true, readout: (x, y) => `σm = ${K.n(x)}\nσa = ${K.n(y)}` });
    function run() {
      const { Sut, Sy, d, sa, sm } = f.st;
      const [a, b] = KA[f.st.acab], ka = a * Math.pow(Sut, b);
      const kb = +f.st.carga === 0.85 ? 1 : d <= 51 ? 1.24 * Math.pow(Math.max(2.79, d), -0.107) : 1.51 * Math.pow(d, -0.157);
      const kc = +f.st.carga, ke = KE[f.st.conf];
      const Se = ka * kb * kc * ke * 0.5 * Math.min(Sut, 1400);
      const nG = 1 / (sa / Se + sm / Sut), nS = 1 / (sa / Se + sm / Sy);
      const nGe = sm > 0 ? 0.5 * (Sut / sm) ** 2 * (sa / Se) * (-1 + Math.sqrt(1 + (2 * sm * Se / (Sut * sa)) ** 2)) : Se / sa;
      const nY = Sy / (sa + sm);
      const ms = K.linspace(0, Sut, 200);
      ch.set({ series: [
        { x: [0, Sut], y: [Se, 0], color: '#4fb3ff', width: 2, name: 'Goodman' }, { x: [0, Sy], y: [Se, 0], color: '#c77dff', width: 1.5, dash: [5, 4], name: 'Soderberg' },
        { x: ms, y: ms.map(m => Se * (1 - (m / Sut) ** 2)), color: '#3ddc84', width: 1.5, name: 'Gerber' }, { x: [0, Sy], y: [Sy, 0], color: '#ff4d6d', width: 1.5, dash: [3, 3], name: 'Escoamento (Langer)' },
        { x: [0, sm * 3], y: [0, sa * 3], color: 'rgba(255,209,102,0.4)', width: 1, dash: [2, 3], noFit: true }],
      markers: [{ x: sm, y: sa, shape: 'dot', color: '#ffd166', size: 6, label: 'ponto de operação' }] });
      out.innerHTML = '';
      out.append(CS.kv([
        ["S'<sub>e</sub> = 0,5·S<sub>ut</sub>", `${K.n(0.5 * Math.min(Sut, 1400))} MPa`], ['k<sub>a</sub> · k<sub>b</sub> · k<sub>c</sub> · k<sub>e</sub>', `${K.n(ka, 3)} · ${K.n(kb, 3)} · ${K.n(kc, 3)} · ${K.n(ke, 3)}`],
        ['Limite de fadiga corrigido S<sub>e</sub>', `<b>${K.n(Se)} MPa</b>`], ['n Goodman', K.verdict(nG)], ['n Soderberg', K.verdict(nS)], ['n Gerber', K.verdict(nGe)], ['n escoamento (Langer)', K.verdict(nY)],
      ]));
    }
    run();
  }

  /* ════════════════ 4. CIÊNCIA E SELEÇÃO DE MATERIAIS ════════════════ */
  const PROPS = { rho: ['Densidade ρ', 'kg/m³'], E: ['Módulo de Young E', 'GPa'], sy: ['Resistência (escoamento) σ', 'MPa'], su: ['Resistência à tração σu', 'MPa'], k: ['Condutividade térmica k', 'W/m·K'], a: ['Expansão térmica α', 'µm/m·K'], T: ['Temp. máx. de serviço', '°C'], c: ['Custo relativo (aço = 1)', ''], el: ['Alongamento', '%'] };
  const toolMat = (host, onClean) => {
    const { body } = CS.page(host, {
      title: 'Ciência e Seleção de Materiais', lead: 'Banco de dados de materiais de engenharia, gráficos de Ashby, seleção por índices de desempenho e curvas tensão-deformação.',
      learn: `<p><b>Classes de materiais:</b> metais (resistentes, dúcteis, condutores), polímeros (leves, baratos, baixo E), cerâmicas (rígidas, duras, frágeis, refratárias), compósitos (alta rigidez e resistência por peso) e naturais.</p>
      <p><b>Gráficos de Ashby:</b> duas propriedades em escala log-log. Cada classe ocupa uma "bolha". Em log-log, os índices de desempenho viram <b>retas</b>: todos os materiais sobre uma mesma reta têm desempenho igual, e os acima/à esquerda são melhores.</p>
      <p><b>Índices de desempenho</b> (maximizar), para peso mínimo:</p>
      <ul><li>tirante rígido: E/ρ · tirante resistente: σ/ρ</li><li>viga rígida: E<sup>1/2</sup>/ρ · viga resistente: σ<sup>2/3</sup>/ρ</li><li>placa rígida: E<sup>1/3</sup>/ρ · mola: σ²/E</li></ul>
      <p><b>Curva tensão-deformação:</b> a inclinação inicial é E; σ<sub>y</sub> marca o fim do regime elástico; σ<sub>u</sub> é a máxima. A área sob a curva elástica é a <b>resiliência</b> (σ<sub>y</sub>²/2E), e a área total é a <b>tenacidade</b>. Materiais frágeis rompem quase sem deformação plástica.</p>
      <p class="muted">Os valores são típicos e servem para estudo e pré-seleção. Para projeto, consulte a norma ou o fornecedor.</p>`,
    });
    onClean(K.sections(body, 'mat', [
      { id: 'ashby', label: 'Gráfico de Ashby', render: secAshby },
      { id: 'sel', label: 'Seleção por índice', render: secSel },
      { id: 'ss', label: 'Tensão-deformação', render: secSS },
      { id: 'db', label: 'Banco de dados', render: secDB },
    ]));
  };
  function secAshby(area) {
    const opts = Object.entries(PROPS).filter(([k]) => k !== 'el').map(([k, v]) => [k, `${v[0]} [${v[1]}]`]);
    const f = K.form([
      { k: 'x', l: 'Eixo X', type: 'sel', v: 'rho', opts }, { k: 'y', l: 'Eixo Y', type: 'sel', v: 'E', opts },
      { k: 'guia', l: 'Linha-guia (índice)', type: 'sel', v: '2', opts: [['0', 'nenhuma'], ['1', 'inclinação 1 (ex.: E/ρ)'], ['2', 'inclinação 2 (ex.: E^½/ρ)'], ['3', 'inclinação 3 (ex.: E^⅓/ρ)'], ['1.5', 'inclinação 1,5 (ex.: σ^⅔/ρ)']] },
      { k: 'ref', l: 'Linha passando por', type: 'sel', v: '8', opts: K.matOpts() },
    ], () => run(), { cols: 2 });
    const cb = CS.chartBox('xl'), leg = h('div', { class: 'mat-legend' });
    area.append(CS.card(null, f.el, leg), CS.card(null, cb));
    for (const [c, col] of Object.entries(K.CLASS_COL)) leg.append(h('span', {}, h('i', { style: `background:${col}` }), c));
    let ch;
    function run() {
      const X = f.st.x, Y = f.st.y;
      cb.innerHTML = '';
      ch = new MS.Chart(cb, { xlog: true, ylog: true, xlabel: `${PROPS[X][0]} [${PROPS[X][1]}]`, ylabel: `${PROPS[Y][0]} [${PROPS[Y][1]}]`, pad: 0.1,
        readout: (x, y) => { let best = null, bd = Infinity; for (const m of K.MATS) { const d = Math.hypot(Math.log10(m[X] / x), Math.log10(m[Y] / y)); if (d < bd) { bd = d; best = m; } } return bd < 0.15 ? `${best.nome}\n${PROPS[X][0]}: ${best[X]}\n${PROPS[Y][0]}: ${best[Y]}` : ''; } });
      const pts = K.MATS.filter(m => m[X] > 0 && m[Y] > 0);
      const series = [];
      const s = +f.st.guia, rm = K.MATS[+f.st.ref];
      if (s > 0 && rm[X] > 0 && rm[Y] > 0) { const xs = [1e-4, 1e6]; series.push({ x: xs, y: xs.map(x => rm[Y] * Math.pow(x / rm[X], s)), color: 'rgba(255,209,102,0.7)', dash: [6, 4], width: 1.5, noFit: true, name: 'índice constante (acima/esquerda = melhor)' }); }
      ch.set({ series, markers: pts.map(m => ({ x: m[X], y: m[Y], shape: 'dot', color: K.CLASS_COL[m.classe], size: 7, label: m.nome.split(' (')[0].split(' ').slice(0, 2).join(' ') })) });
    }
    run();
  }
  const OBJ = {
    tir_r: ['Tirante leve e rígido', m => m.E / m.rho, 'E/ρ'], viga_r: ['Viga leve e rígida', m => Math.sqrt(m.E) / m.rho, 'E^½/ρ'], placa_r: ['Placa leve e rígida', m => Math.cbrt(m.E) / m.rho, 'E^⅓/ρ'],
    tir_s: ['Tirante leve e resistente', m => m.sy / m.rho, 'σ/ρ'], viga_s: ['Viga leve e resistente', m => Math.pow(m.sy, 2 / 3) / m.rho, 'σ^⅔/ρ'],
    viga_c: ['Viga rígida e barata', m => Math.sqrt(m.E) / (m.rho * m.c), 'E^½/(ρ·custo)'], mola: ['Mola (energia elástica por volume)', m => m.sy * m.sy / (m.E * 1e3), 'σ²/E'],
    isol: ['Isolante térmico', m => 1 / m.k, '1/k'], dissip: ['Dissipador de calor', m => m.k, 'k'],
  };
  function secSel(area) {
    const f = K.form([
      { k: 'obj', l: 'Função / objetivo', type: 'sel', v: 'viga_r', opts: Object.entries(OBJ).map(([k, v]) => [k, `${v[0]} — M = ${v[2]}`]) },
      { k: 'T', l: 'Temperatura de serviço mín.', u: '°C', v: '80' }, { k: 'el', l: 'Alongamento mín. (ductilidade)', u: '%', v: '0' }, { k: 'c', l: 'Custo relativo máx.', u: '', v: '100' },
    ], () => run(), { cols: 2 });
    const out = h('div');
    area.append(CS.card('Requisitos', f.el), CS.card('Ranking (índice M normalizado: melhor = 100)', out));
    function run() {
      const [nm, fn] = OBJ[f.st.obj];
      const ok = K.MATS.filter(m => m.T >= f.st.T && m.el >= f.st.el && m.c <= f.st.c).map(m => ({ m, M: fn(m) })).sort((a, b) => b.M - a.M);
      const best = ok.length ? ok[0].M : 1;
      out.innerHTML = '';
      if (!ok.length) { out.append(h('div', { class: 'warn' }, 'Nenhum material atende às restrições.')); return; }
      out.append(K.table(['#', 'Material', 'Classe', 'Índice', ''], ok.slice(0, 12).map((x, i) => [i + 1, x.m.nome, x.m.classe, K.n(x.M / best * 100, 3), h('div', { class: 'bar', style: `width:${Math.max(2, x.M / best * 160)}px;background:${K.CLASS_COL[x.m.classe]}` })]), 'rank'),
        h('div', { class: 'muted small' }, `${nm}: ${ok.length} de ${K.MATS.length} materiais atendem às restrições.`));
    }
    run();
  }
  function ssCurve(m) {
    const E = m.E * 1e3, ey = m.sy / E, ef = Math.max(ey * 1.001, m.el / 100), xs = [], ys = [];
    if (m.el < 1) { xs.push(0, m.su / E * 100); ys.push(0, m.su); return { xs, ys }; }
    const N = 200;
    for (let i = 0; i <= N; i++) {
      const e = ef * i / N;
      let s;
      if (e <= ey) s = E * e;
      else { const u = (e - ey) / (ef - ey); s = m.sy + (m.su - m.sy) * Math.sin(Math.min(1, u / 0.7) * Math.PI / 2) - (u > 0.7 ? (m.su - m.sy) * 0.6 * ((u - 0.7) / 0.3) ** 2 + 0.08 * m.su * ((u - 0.7) / 0.3) ** 2 : 0); }
      xs.push(e * 100); ys.push(Math.max(0, s));
    }
    return { xs, ys };
  }
  function secSS(area) {
    const fields = [0, 1, 2, 3].map(i => ({ k: 'm' + i, l: `Material ${i + 1}`, type: 'sel', v: ['2', '8', '17', '23'][i], opts: [['-1', '—'], ...K.matOpts()] }));
    const f = K.form([...fields, { k: 'zoom', l: 'Faixa de deformação', type: 'sel', v: 'all', opts: [['all', 'até a ruptura'], ['el', 'região elástica (≤ 1%)']] }], () => run(), { cols: 2 });
    const cb = CS.chartBox('tall'), out = h('div');
    area.append(h('div', { class: 'grid2' }, h('div', { class: 'col' }, CS.card('Comparar materiais', f.el), CS.card('Propriedades mecânicas', out)), CS.card('Curva tensão-deformação (aproximada)', cb)));
    let ch;
    function run() {
      cb.innerHTML = '';
      ch = new MS.Chart(cb, { xlabel: 'ε [%]', ylabel: 'σ [MPa]', includeOrigin: true, xrange: f.st.zoom === 'el' ? [0, 1] : undefined, readout: (x, y) => `ε = ${K.n(x)} %\nσ = ${K.n(y)} MPa` });
      const sel = [0, 1, 2, 3].map(i => +f.st['m' + i]).filter(i => i >= 0);
      const rows = [];
      ch.set({ series: sel.map((i, j) => { const m = K.MATS[i], c = ssCurve(m); let tough = 0; for (let k = 1; k < c.xs.length; k++) tough += (c.xs[k] - c.xs[k - 1]) / 100 * (c.ys[k] + c.ys[k - 1]) / 2; rows.push([`<span style="color:${COL[j]}">●</span> ${m.nome}`, m.E, m.sy, m.su, m.el, K.n(m.sy * m.sy / (2 * m.E * 1e3) * 1e3, 3), K.n(tough, 3)]); return { x: c.xs, y: c.ys, color: COL[j], width: 2, name: m.nome.split(' (')[0] }; }) });
      out.innerHTML = '';
      out.append(K.table(['Material', 'E [GPa]', 'σy [MPa]', 'σu [MPa]', 'ε rup. [%]', 'Resiliência [kJ/m³]', 'Tenacidade [MJ/m³]'], rows));
    }
    run();
  }
  function secDB(area) {
    const keys = ['rho', 'E', 'sy', 'su', 'el', 'k', 'a', 'T', 'c'];
    let sortK = 'E', dir = -1;
    const host = h('div'); area.append(CS.card('Clique no cabeçalho para ordenar', host));
    const render = () => {
      const rows = K.MATS.slice().sort((a, b) => dir * (a[sortK] - b[sortK]));
      const t = h('table', { class: 'tbl dbt' });
      const tr = h('tr', {}, h('th', {}, 'Material'), h('th', {}, 'Classe'), ...keys.map(k => h('th', { class: 'sortable' + (k === sortK ? ' on' : ''), onclick: () => { if (sortK === k) dir = -dir; else { sortK = k; dir = -1; } render(); }, html: `${PROPS[k][0].split(' ')[0]}<br><small>${PROPS[k][1]}</small>` })));
      t.append(tr);
      for (const m of rows) t.append(h('tr', {}, h('td', {}, m.nome), h('td', {}, h('span', { style: `color:${K.CLASS_COL[m.classe]}` }, m.classe)), ...keys.map(k => h('td', { class: 'num' }, String(m[k])))));
      host.innerHTML = ''; host.append(t);
    };
    render();
  }

  CS.registerTab('mat', {
    title: 'Materiais e Projetos',
    tools: [
      { id: 'resmat', label: 'Resistência dos Materiais', desc: 'vigas, Mohr, flambagem', render: toolResMat },
      { id: 'vib', label: 'Dinâmica e Vibrações', desc: 'livre, forçada, isolamento', render: toolVib },
      { id: 'elem', label: 'Elementos de Máquinas e Projeto Mecânico', desc: 'eixos, engrenagens, rolamentos, parafusos, fadiga', render: toolElem },
      { id: 'mat', label: 'Ciência e Seleção de Materiais', desc: 'Ashby, índices, tensão-deformação', render: toolMat },
    ],
  });
  MS.MK.beamSolve = beamSolve; MS.MK.secProps = secProps;
})();
