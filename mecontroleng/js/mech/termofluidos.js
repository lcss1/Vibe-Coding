/* ============================================================
   MeControlEng — Mecânica › Fluidos e Sistemas Térmicos
   Termodinâmica · Mecânica dos Fluidos e Fenômenos de Transporte ·
   Transferência de Calor
   ============================================================ */
'use strict';
(function () {
  const CS = MS.CS, h = CS.h, K = MS.MK;
  const G = 9.81;

  /* ════════════════ 1. TERMODINÂMICA ════════════════ */
  const GASES = { ar: ['Ar', 287, 1005], n2: ['Nitrogênio N₂', 296.8, 1039], o2: ['Oxigênio O₂', 259.8, 918], he: ['Hélio He', 2077, 5193], co2: ['Dióxido de carbono CO₂', 188.9, 846], h2: ['Hidrogênio H₂', 4124, 14307] };
  const gas = id => { const [n, R, cp] = GASES[id]; return { n, R, cp, cv: cp - R, k: cp / (cp - R) }; };
  const gasOpts = Object.entries(GASES).map(([k, v]) => [k, v[0]]);

  const toolTermo = (host, onClean) => {
    const { body } = CS.page(host, {
      title: 'Termodinâmica', lead: 'Processos com gás ideal e ciclos de potência padrão a ar (Otto, Diesel, Brayton, Carnot), com diagramas P-v e T-s.',
      learn: `<p><b>Gás ideal:</b> P·v = R·T, com cv = cp − R e k = cp/cv. <b>1ª lei</b> (sistema fechado): Q − W = ΔU = m·cv·ΔT. <b>Entropia:</b> Δs = cv·ln(T₂/T₁) + R·ln(v₂/v₁).</p>
      <p><b>Processos politrópicos</b> P·vⁿ = cte: n = 0 isobárico, n = 1 isotérmico, n = k isentrópico (adiabático reversível), n → ∞ isocórico. Trabalho de fronteira: W = (P₂V₂ − P₁V₁)/(1 − n), ou m·R·T·ln(V₂/V₁) no isotérmico.</p>
      <p><b>Diagramas:</b> no P-v, a área sob a curva é o trabalho. No T-s, a área sob a curva é o calor (processo reversível). A área interna do ciclo é o trabalho líquido nos dois diagramas.</p>
      <p><b>Ciclos padrão a ar:</b><br>• Otto (motor a gasolina): η = 1 − 1/r<sup>k−1</sup><br>• Diesel: η = 1 − [r<sub>c</sub><sup>k</sup> − 1]/[k·r<sup>k−1</sup>(r<sub>c</sub> − 1)]<br>• Brayton (turbina a gás): η = 1 − 1/r<sub>p</sub><sup>(k−1)/k</sup><br>• Carnot: η = 1 − T<sub>C</sub>/T<sub>H</sub>, o máximo possível entre dois reservatórios (2ª lei).</p>
      <p><b>Simplificações:</b> ar como gás ideal com calores específicos constantes; processos internamente reversíveis; combustão substituída por adição de calor.</p>`,
    });
    onClean(K.sections(body, 'termo', [{ id: 'proc', label: 'Processos', render: secProc }, { id: 'ciclo', label: 'Ciclos de potência', render: secCiclo }]));
  };
  /* trajetória entre dois estados (para os diagramas) */
  function path(g, a, b, type, n) {
    const pts = [];
    for (let i = 0; i <= 60; i++) {
      const t = i / 60;
      let v, P, T;
      if (type === 'v') { v = a.v; T = a.T + (b.T - a.T) * t; P = g.R * T / v; }
      else { v = a.v * Math.pow(b.v / a.v, t); const nn = type === 'p' ? 0 : type === 't' ? 1 : type === 's' ? g.k : n; P = a.P * Math.pow(a.v / v, nn); T = P * v / g.R; }
      pts.push({ v, P, T });
    }
    return pts;
  }
  const sOf = (g, st, ref) => g.cv * Math.log(st.T / ref.T) + g.R * Math.log(st.v / ref.v);
  function diagrams(area) {
    const b1 = CS.chartBox(), b2 = CS.chartBox();
    area.append(h('div', { class: 'grid2' }, CS.card('Diagrama P-v', b1), CS.card('Diagrama T-s', b2)));
    return [new MS.Chart(b1, { xlabel: 'v [m³/kg]', ylabel: 'P [kPa]', readout: (x, y) => `v = ${K.n(x)} m³/kg\nP = ${K.n(y)} kPa` }), new MS.Chart(b2, { xlabel: 's [kJ/kg·K]', ylabel: 'T [K]', readout: (x, y) => `s = ${K.n(x)}\nT = ${K.n(y)} K` })];
  }
  function secProc(area) {
    const f = K.form([
      { k: 'gas', l: 'Gás', type: 'sel', v: 'ar', opts: gasOpts }, { k: 'm', l: 'Massa', u: 'kg', v: '1' },
      { k: 'P1', l: 'Pressão inicial P₁', u: 'kPa', v: '100' }, { k: 'T1', l: 'Temperatura inicial T₁', u: '°C', v: '25' },
      { k: 'proc', l: 'Processo', type: 'sel', v: 's', opts: [['t', 'Isotérmico (T = cte)'], ['p', 'Isobárico (P = cte)'], ['v', 'Isocórico (V = cte)'], ['s', 'Isentrópico (adiabático reversível)'], ['n', 'Politrópico (P·vⁿ = cte)']] },
      { k: 'n', l: 'Expoente politrópico n', u: '', v: '1.3' }, { k: 'r', l: 'Razão final: V₂/V₁ (isocórico: P₂/P₁)', u: '', v: '0.125' },
    ], () => run(), { cols: 2 });
    const out = h('div');
    area.append(h('div', { class: 'grid2' }, CS.card('Estado inicial e processo', f.el), CS.card('Resultados (W > 0: realizado pelo gás · Q > 0: recebido)', out)));
    const [cpv, cts] = diagrams(area);
    function run() {
      const g = gas(f.st.gas), m = f.st.m, P1 = f.st.P1 * 1e3, T1 = f.st.T1 + 273.15, r = f.st.r, p = f.st.proc;
      const s1 = { P: P1, T: T1, v: g.R * T1 / P1 };
      let s2, W = 0;
      if (p === 'v') { s2 = { v: s1.v, P: P1 * r, T: T1 * r }; W = 0; }
      else {
        const v2 = s1.v * r, nn = p === 'p' ? 0 : p === 't' ? 1 : p === 's' ? g.k : f.st.n;
        const P2 = P1 * Math.pow(r, -nn); s2 = { v: v2, P: P2, T: P2 * v2 / g.R };
        W = Math.abs(nn - 1) < 1e-9 ? m * g.R * T1 * Math.log(r) : m * (s2.P * s2.v - P1 * s1.v) / (1 - nn);
      }
      const dU = m * g.cv * (s2.T - s1.T), Q = dU + W, dS = m * sOf(g, s2, s1);
      const pts = path(g, s1, s2, p, f.st.n);
      cpv.set({ series: [{ x: pts.map(q => q.v), y: pts.map(q => q.P / 1e3), color: '#4fb3ff', width: 2.2, arrows: 2 }], markers: [{ x: s1.v, y: P1 / 1e3, shape: 'dot', color: '#3ddc84', label: '1' }, { x: s2.v, y: s2.P / 1e3, shape: 'dot', color: '#ff4d6d', label: '2' }] });
      cts.set({ series: [{ x: pts.map(q => sOf(g, q, s1) / 1e3), y: pts.map(q => q.T), color: '#ff9f1c', width: 2.2, arrows: 2 }], markers: [{ x: 0, y: T1, shape: 'dot', color: '#3ddc84', label: '1' }, { x: sOf(g, s2, s1) / 1e3, y: s2.T, shape: 'dot', color: '#ff4d6d', label: '2' }] });
      out.innerHTML = '';
      out.append(K.table(['Estado', 'P [kPa]', 'T [°C]', 'v [m³/kg]', 'V [m³]'], [['1', K.n(P1 / 1e3), K.n(T1 - 273.15), K.n(s1.v), K.n(m * s1.v)], ['2', K.n(s2.P / 1e3), K.n(s2.T - 273.15), K.n(s2.v), K.n(m * s2.v)]]),
        CS.kv([['Gás', `${g.n} · R = ${g.R} · cp = ${g.cp} J/kg·K · k = ${K.n(g.k, 3)}`], ['Trabalho W', `${K.n(W / 1e3)} kJ`], ['Calor Q', `${K.n(Q / 1e3)} kJ`], ['ΔU', `${K.n(dU / 1e3)} kJ`], ['ΔH', `${K.n(m * g.cp * (s2.T - s1.T) / 1e3)} kJ`], ['ΔS', `${K.n(dS / 1e3)} kJ/K`]]));
    }
    run();
  }
  function secCiclo(area) {
    const f = K.form([
      { k: 'c', l: 'Ciclo', type: 'sel', v: 'otto', opts: [['otto', 'Otto (ignição por centelha)'], ['diesel', 'Diesel (ignição por compressão)'], ['brayton', 'Brayton (turbina a gás)'], ['carnot', 'Carnot (ideal)']] },
      { k: 'gas', l: 'Fluido', type: 'sel', v: 'ar', opts: gasOpts }, { k: 'T1', l: 'T₁ (admissão / fonte fria)', u: '°C', v: '25' }, { k: 'P1', l: 'P₁', u: 'kPa', v: '100' },
      { k: 'r', l: 'Razão de compressão r (Otto/Diesel)', u: '', v: '9' }, { k: 'rc', l: 'Razão de corte rc (Diesel)', u: '', v: '2' },
      { k: 'rp', l: 'Razão de pressões rp (Brayton)', u: '', v: '10' }, { k: 'T3', l: 'Temperatura máxima T₃ (fonte quente)', u: '°C', v: '1400' },
      { k: 'ri', l: 'Expansão isotérmica V₃/V₂ (Carnot)', u: '', v: '3' },
    ], () => run(), { cols: 2 });
    const out = h('div');
    area.append(h('div', { class: 'grid2' }, CS.card('Ciclo', f.el), CS.card('Desempenho', out)));
    const [cpv, cts] = diagrams(area);
    function run() {
      const g = gas(f.st.gas), k = g.k, c = f.st.c;
      const T1 = f.st.T1 + 273.15, P1 = f.st.P1 * 1e3, T3m = f.st.T3 + 273.15;
      const S = [{ P: P1, T: T1, v: g.R * T1 / P1 }];
      const st = (v, T) => ({ v, T, P: g.R * T / v });
      let types, eta, qin, qout, name;
      if (c === 'otto') {
        const r = f.st.r; S.push(st(S[0].v / r, T1 * r ** (k - 1))); S.push(st(S[1].v, Math.max(T3m, S[1].T * 1.01))); S.push(st(S[0].v, S[2].T / r ** (k - 1)));
        types = ['s', 'v', 's', 'v']; qin = g.cv * (S[2].T - S[1].T); qout = g.cv * (S[3].T - S[0].T); eta = 1 - 1 / r ** (k - 1); name = '1 − 1/r^(k−1)';
      } else if (c === 'diesel') {
        const r = f.st.r, rc = f.st.rc; S.push(st(S[0].v / r, T1 * r ** (k - 1))); S.push(st(S[1].v * rc, S[1].T * rc)); S.push(st(S[0].v, S[2].T * (S[2].v / S[0].v) ** (k - 1)));
        types = ['s', 'p', 's', 'v']; qin = g.cp * (S[2].T - S[1].T); qout = g.cv * (S[3].T - S[0].T); eta = 1 - (rc ** k - 1) / (k * r ** (k - 1) * (rc - 1)); name = '1 − (rc^k − 1)/(k·r^(k−1)·(rc − 1))';
      } else if (c === 'brayton') {
        const rp = f.st.rp, e = (k - 1) / k; const T2 = T1 * rp ** e; S.push({ P: P1 * rp, T: T2, v: g.R * T2 / (P1 * rp) }); S.push({ P: P1 * rp, T: Math.max(T3m, T2 * 1.01), v: g.R * Math.max(T3m, T2 * 1.01) / (P1 * rp) }); const T4 = S[2].T / rp ** e; S.push({ P: P1, T: T4, v: g.R * T4 / P1 });
        types = ['s', 'p', 's', 'p']; qin = g.cp * (S[2].T - S[1].T); qout = g.cp * (S[3].T - S[0].T); eta = 1 - 1 / rp ** e; name = '1 − 1/rp^((k−1)/k)';
      } else {
        const TH = Math.max(T3m, T1 * 1.05), v2 = S[0].v * (T1 / TH) ** (1 / (k - 1)); S.push(st(v2, TH)); S.push(st(v2 * f.st.ri, TH)); S.push(st(S[2].v * (TH / T1) ** (1 / (k - 1)), T1));
        types = ['s', 't', 's', 't']; qin = g.R * TH * Math.log(f.st.ri); qout = g.R * T1 * Math.log(f.st.ri); eta = 1 - T1 / TH; name = '1 − T_C/T_H';
      }
      const wnet = qin - qout;
      const pv = [], ts = [];
      types.forEach((t, i) => { const p = path(g, S[i], S[(i + 1) % 4], t); pv.push({ x: p.map(q => q.v), y: p.map(q => q.P / 1e3), color: ['#4fb3ff', '#ff4d6d', '#3ddc84', '#c77dff'][i], width: 2.2, arrows: 1 }); ts.push({ x: p.map(q => sOf(g, q, S[0]) / 1e3), y: p.map(q => q.T), color: ['#4fb3ff', '#ff4d6d', '#3ddc84', '#c77dff'][i], width: 2.2, arrows: 1 }); });
      const mk = (fx, fy) => S.map((s, i) => ({ x: fx(s), y: fy(s), shape: 'dot', color: '#ffd166', label: String(i + 1) }));
      cpv.set({ series: pv, markers: mk(s => s.v, s => s.P / 1e3) });
      cts.set({ series: ts, markers: mk(s => sOf(g, s, S[0]) / 1e3, s => s.T) });
      const etaC = 1 - T1 / Math.max(...S.map(s => s.T));
      out.innerHTML = '';
      out.append(K.table(['Estado', 'P [kPa]', 'T [°C]', 'v [m³/kg]'], S.map((s, i) => [i + 1, K.n(s.P / 1e3), K.n(s.T - 273.15), K.n(s.v)])),
        CS.kv([
          ['Calor fornecido q<sub>in</sub>', `${K.n(qin / 1e3)} kJ/kg`], ['Calor rejeitado q<sub>out</sub>', `${K.n(qout / 1e3)} kJ/kg`], ['Trabalho líquido', `${K.n(wnet / 1e3)} kJ/kg`],
          ['Rendimento térmico η', `<b>${K.n(eta * 100, 3)} %</b> (η = ${name})`], ['Carnot entre T mín. e máx.', `${K.n(etaC * 100, 3)} % (limite teórico)`],
          c !== 'brayton' && c !== 'carnot' ? ['Pressão média efetiva', `${K.n(wnet / (S[0].v - S[1].v) / 1e3)} kPa`] : null,
          c === 'brayton' ? ['Razão de trabalho reverso', `${K.n((S[1].T - S[0].T) / (S[2].T - S[3].T) * 100, 3)} % do trabalho da turbina vai para o compressor`] : null,
        ]));
    }
    run();
  }

  /* ════════════════ 2. MECÂNICA DOS FLUIDOS ════════════════ */
  const FLUIDS = { agua20: ['Água 20 °C', 998, 1.002e-3], agua60: ['Água 60 °C', 983, 4.66e-4], oleo: ['Óleo hidráulico ISO VG 46 (40 °C)', 870, 0.04], glic: ['Glicerina 20 °C', 1260, 1.412], gas: ['Gasolina', 720, 3.1e-4], ar: ['Ar 20 °C', 1.204, 1.825e-5] };
  const RUG = { aco: ['Aço comercial', 0.045], galv: ['Aço galvanizado', 0.15], ff: ['Ferro fundido', 0.26], pvc: ['PVC / plástico', 0.0015], cobre: ['Cobre / latão', 0.0015], conc: ['Concreto', 1.0] };
  const fluidOpts = Object.entries(FLUIDS).map(([k, v]) => [k, v[0]]), rugOpts = Object.entries(RUG).map(([k, v]) => [k, `${v[0]} (ε = ${v[1]} mm)`]);
  K.friction = function (Re, eD) {
    if (Re < 2300) return 64 / Math.max(Re, 1e-9);
    let f = 0.25 / Math.log10(eD / 3.7 + 5.74 / Re ** 0.9) ** 2;
    for (let i = 0; i < 30; i++) f = 1 / (-2 * Math.log10(eD / 3.7 + 2.51 / (Re * Math.sqrt(f)))) ** 2;
    return f;
  };
  function pipe(s, Qm3s) {
    const [, rho, mu] = FLUIDS[s.fl], D = s.D / 1e3, A = Math.PI * D * D / 4, v = Qm3s / A, Re = rho * v * D / mu, eD = RUG[s.mat][1] / s.D;
    const f = K.friction(Re, eD), hv = v * v / (2 * G), hf = f * s.L / D * hv, hm = s.K * hv;
    return { rho, mu, D, A, v, Re, eD, f, hf, hm, H: s.dz + hf + hm };
  }
  const toolFluidos = (host, onClean) => {
    const { body } = CS.page(host, {
      title: 'Mecânica dos Fluidos e Fenômenos de Transporte', lead: 'Escoamento em tubulações (diagrama de Moody, perdas de carga), ponto de operação bomba × sistema e medição de vazão por Venturi (Bernoulli).',
      learn: `<p><b>Número de Reynolds</b> Re = ρ·v·D/μ: laminar se Re &lt; 2300 e turbulento se Re &gt; 4000 (entre os dois, transição).</p>
      <p><b>Perda de carga distribuída</b> (Darcy-Weisbach): h<sub>f</sub> = f·(L/D)·v²/2g. Fator de atrito: laminar f = 64/Re; turbulento, equação de Colebrook 1/√f = −2·log(ε/3,7D + 2,51/(Re√f)). O <b>diagrama de Moody</b> resume isso.</p>
      <p><b>Perdas localizadas:</b> h<sub>m</sub> = ΣK·v²/2g. Valores típicos de K: curva 90° ≈ 0,3–0,9 · registro gaveta aberto ≈ 0,2 · registro globo ≈ 10 · entrada de reservatório ≈ 0,5 · saída ≈ 1.</p>
      <p><b>Energia:</b> H<sub>bomba</sub> = Δz + h<sub>f</sub> + h<sub>m</sub> (+ Δp/ρg). Potência hidráulica P = ρ·g·Q·H; potência no eixo = P/η.</p>
      <p><b>Bomba × sistema:</b> o ponto de operação é a interseção da curva da bomba (H cai com Q) com a do sistema (H = Δz + k·Q²). Duas bombas em série somam alturas; em paralelo, somam vazões.</p>
      <p><b>Bernoulli</b> (escoamento ideal): p + ½ρv² + ρgz = cte. No Venturi, a redução de área acelera o fluido e reduz a pressão, e a diferença mede a vazão: Q = C<sub>d</sub>·A₂·√(2Δp/(ρ(1−β⁴))).</p>
      <p><b>Fenômenos de transporte:</b> quantidade de movimento (Newton: τ = μ·du/dy), calor (Fourier: q = −k·dT/dx) e massa (Fick: J = −D·dC/dx) seguem a mesma forma de "fluxo = −difusividade × gradiente". Os números adimensionais Re, Pr, Nu e Sc ligam os três.</p>`,
    });
    onClean(K.sections(body, 'fluid', [{ id: 'tubo', label: 'Tubulação (Moody)', render: secTubo }, { id: 'bomba', label: 'Bomba × sistema', render: secBomba }, { id: 'venturi', label: 'Venturi (Bernoulli)', render: secVenturi }]));
  };
  const pipeFields = [
    { k: 'fl', l: 'Fluido', type: 'sel', v: 'agua20', opts: fluidOpts }, { k: 'mat', l: 'Material do tubo', type: 'sel', v: 'aco', opts: rugOpts },
    { k: 'D', l: 'Diâmetro interno D', u: 'mm', v: '50' }, { k: 'L', l: 'Comprimento L', u: 'm', v: '100' },
    { k: 'K', l: 'Soma dos coef. de perda ΣK', u: '', v: '5' }, { k: 'dz', l: 'Desnível Δz', u: 'm', v: '10' },
  ];
  function secTubo(area) {
    const f = K.form([...pipeFields, { k: 'Q', l: 'Vazão Q', u: 'm³/h', v: '20' }, { k: 'eta', l: 'Rendimento da bomba', u: '%', v: '70' }], () => run(), { cols: 2 });
    const out = h('div'), cb = CS.chartBox('tall');
    area.append(h('div', { class: 'grid2' }, h('div', { class: 'col' }, CS.card('Dados', f.el), CS.card('Resultados', out)), CS.card('Diagrama de Moody', cb)));
    const ch = new MS.Chart(cb, { xlog: true, ylog: true, xlabel: 'Re', ylabel: 'f', xrange: [600, 1e8], yrange: [0.008, 0.1], readout: (x, y) => `Re = ${K.f(x, '', 3)}\nf = ${K.n(y, 3)}` });
    const eds = [0, 1e-5, 5e-5, 1e-4, 5e-4, 1e-3, 5e-3, 0.01, 0.02, 0.05];
    function run() {
      const p = pipe(f.st, f.st.Q / 3600);
      const Res = CS.logspace(2300, 1e8, 120);
      const series = [{ x: CS.logspace(600, 2300, 20), y: CS.logspace(600, 2300, 20).map(r => 64 / r), color: '#ff9f1c', width: 2, name: 'laminar 64/Re' }];
      eds.forEach(e => series.push({ x: Res, y: Res.map(r => K.friction(r, e)), color: 'rgba(159,180,208,0.35)', width: 1 }));
      series.push({ x: Res, y: Res.map(r => K.friction(r, p.eD)), color: '#4fb3ff', width: 2, name: `ε/D = ${K.n(p.eD, 2)}` });
      ch.set({ series, markers: [{ x: p.Re, y: p.f, shape: 'dot', color: '#ffd166', size: 7, label: 'operação' }], regions: [{ x0: 2300, x1: 4000, y0: -Infinity, y1: Infinity, color: 'rgba(255,209,102,0.06)' }] }, false);
      const P = p.rho * G * f.st.Q / 3600 * p.H;
      out.innerHTML = '';
      out.append(CS.kv([
        ['Velocidade média', `${K.n(p.v)} m/s ${p.v > 3 ? '<span class="warn">(alta: ruído e erosão)</span>' : ''}`], ['Reynolds', `${K.f(p.Re, '', 4)} → ${p.Re < 2300 ? 'laminar' : p.Re < 4000 ? 'transição' : 'turbulento'}`],
        ['Rugosidade relativa ε/D', K.n(p.eD, 3)], ['Fator de atrito f', K.n(p.f, 4)], ['Perda distribuída h<sub>f</sub>', `${K.n(p.hf)} m`], ['Perdas localizadas h<sub>m</sub>', `${K.n(p.hm)} m`],
        ['Altura manométrica total H', `<b>${K.n(p.H)} m</b> (Δp = ${K.n(p.rho * G * p.H / 1e3)} kPa)`], ['Potência hidráulica', `${K.f(P, 'W')}`], ['Potência no eixo', `${K.f(P / (f.st.eta / 100), 'W')}`],
      ]));
    }
    run();
  }
  function secBomba(area) {
    const f = K.form([...pipeFields, { k: 'H0', l: 'Altura de shutoff da bomba H₀', u: 'm', v: '40' }, { k: 'Qx', l: 'Vazão máxima da bomba', u: 'm³/h', v: '40' },
      { k: 'arr', l: 'Arranjo', type: 'sel', v: '1', opts: [['1', '1 bomba'], ['s', '2 bombas em série'], ['p', '2 bombas em paralelo']] }], () => run(), { cols: 2 });
    const out = h('div'), cb = CS.chartBox('tall');
    area.append(h('div', { class: 'grid2' }, h('div', { class: 'col' }, CS.card('Sistema e bomba', f.el), CS.card('Ponto de operação', out)), CS.card('Curvas H × Q', cb)));
    const ch = new MS.Chart(cb, { xlabel: 'Q [m³/h]', ylabel: 'H [m]', includeOrigin: true, readout: (x, y) => `Q = ${K.n(x)} m³/h\nH = ${K.n(y)} m` });
    function run() {
      const { H0, Qx, arr } = f.st;
      const pump1 = q => H0 * (1 - (q / Qx) ** 2);
      const pump = q => (arr === 's' ? 2 * pump1(q) : arr === 'p' ? pump1(q / 2) : pump1(q));
      const Qmax = arr === 'p' ? 2 * Qx : Qx;
      const sys = q => pipe(f.st, q / 3600).H;
      const qs = K.linspace(0.001, Qmax * 1.05, 200);
      let qop = null;
      if (sys(0.001) < pump(0.001)) qop = K.solve(q => pump(q) - sys(q), 0.001, Qmax);
      ch.set({ series: [{ x: qs, y: qs.map(q => Math.max(0, pump(q))), color: '#4fb3ff', width: 2.2, name: 'bomba' }, { x: qs, y: qs.map(sys), color: '#ff9f1c', width: 2.2, name: 'sistema' }, ...(arr !== '1' ? [{ x: qs, y: qs.map(q => Math.max(0, pump1(q))), color: 'rgba(79,179,255,0.35)', dash: [5, 4], width: 1, name: '1 bomba' }] : [])],
        markers: qop ? [{ x: qop, y: pump(qop), shape: 'dot', color: '#ffd166', size: 7, label: 'operação' }] : [] });
      out.innerHTML = '';
      if (!qop) { out.append(h('div', { class: 'bad' }, 'A bomba não vence o desnível do sistema: não há escoamento.')); return; }
      const p = pipe(f.st, qop / 3600);
      out.append(CS.kv([['Vazão de operação', `<b>${K.n(qop)} m³/h</b> (${K.n(qop / 3.6)} L/s)`], ['Altura de operação', `${K.n(pump(qop))} m`], ['Velocidade no tubo', `${K.n(p.v)} m/s`], ['Potência hidráulica', K.f(p.rho * G * qop / 3600 * pump(qop), 'W')]]));
    }
    run();
  }
  function secVenturi(area) {
    const f = K.form([{ k: 'fl', l: 'Fluido', type: 'sel', v: 'agua20', opts: fluidOpts }, { k: 'Q', l: 'Vazão Q', u: 'L/s', v: '10' }, { k: 'D1', l: 'Diâmetro da entrada D₁', u: 'mm', v: '100' }, { k: 'D2', l: 'Diâmetro da garganta D₂', u: 'mm', v: '50' }, { k: 'Cd', l: 'Coef. de descarga Cd', u: '', v: '0.98' }, { k: 'rm', l: 'Fluido do manômetro', type: 'sel', v: '13600', opts: [['13600', 'Mercúrio (13 600 kg/m³)'], ['1590', 'Tetracloreto (1 590 kg/m³)']] }], () => run(), { cols: 2 });
    const out = h('div'), cvCard = CS.card('Venturi com piezômetros');
    area.append(h('div', { class: 'grid2' }, h('div', { class: 'col' }, CS.card('Dados', f.el), CS.card('Resultados', out)), cvCard));
    const cv = K.canvas(cvCard, 260, null);
    function run() {
      const [, rho] = FLUIDS[f.st.fl], Q = f.st.Q / 1e3, D1 = f.st.D1 / 1e3, D2 = f.st.D2 / 1e3, A1 = Math.PI * D1 * D1 / 4, A2 = Math.PI * D2 * D2 / 4, beta = D2 / D1;
      const v1 = Q / A1, v2 = Q / A2, dpi = rho / 2 * (v2 * v2 - v1 * v1), dpr = dpi / (f.st.Cd ** 2), dh = dpr / ((+f.st.rm - rho) * G);
      out.innerHTML = '';
      out.append(CS.kv([['v₁ · v₂', `${K.n(v1)} · ${K.n(v2)} m/s`], ['β = D₂/D₁', K.n(beta, 3)], ['Δp ideal (Bernoulli)', `${K.n(dpi / 1e3)} kPa`], ['Δp real (com Cd)', `${K.n(dpr / 1e3)} kPa`], ['Desnível no manômetro Δh', `${K.n(dh * 1e3)} mm`], ['Altura piezométrica perdida na garganta', `${K.n(dpr / (rho * G))} m de coluna do fluido`]]));
      cv.draw = (g, W, H) => {
        const y = H * 0.68, x0 = 20, x1 = W - 20, L = x1 - x0, r1 = 34, r2 = r1 * beta;
        const prof = t => (t < 0.3 ? r1 : t < 0.45 ? r1 + (r2 - r1) * (t - 0.3) / 0.15 : t < 0.55 ? r2 : r2 + (r1 - r2) * (t - 0.55) / 0.45);
        g.fillStyle = 'rgba(47,127,214,0.55)'; g.beginPath();
        for (let i = 0; i <= 100; i++) { const t = i / 100; g.lineTo(x0 + L * t, y - prof(t)); }
        for (let i = 100; i >= 0; i--) { const t = i / 100; g.lineTo(x0 + L * t, y + prof(t)); }
        g.fill(); g.strokeStyle = '#9fb4d0'; g.stroke();
        const hmax = H * 0.55, p1 = 1, p2 = Math.max(0.05, 1 - dpr / (rho * G) / Math.max(1e-6, dpr / (rho * G) * 1.4));
        for (const [t, k, lab] of [[0.15, p1, 'p₁'], [0.5, p2, 'p₂']]) { const x = x0 + L * t, top = y - prof(t); g.strokeStyle = '#9fb4d0'; g.strokeRect(x - 6, top - hmax, 12, hmax); g.fillStyle = 'rgba(47,127,214,0.8)'; g.fillRect(x - 5, top - hmax * k, 10, hmax * k); g.fillStyle = '#c3d3e8'; g.font = '12px Barlow'; g.textAlign = 'center'; g.fillText(lab, x, top - hmax - 6); }
        g.fillStyle = '#ffd166'; g.font = '11px Barlow'; g.fillText(`v₁ = ${K.n(v1, 3)} m/s`, x0 + L * 0.15, y + r1 + 16); g.fillText(`v₂ = ${K.n(v2, 3)} m/s`, x0 + L * 0.5, y + r1 + 16);
      };
      cv.redraw();
    }
    run();
  }

  /* ════════════════ 3. TRANSFERÊNCIA DE CALOR ════════════════ */
  const KMAT = { tijolo: ['Tijolo comum', 0.72], concreto: ['Concreto', 1.4], la: ['Lã de vidro', 0.04], eps: ['Poliestireno (EPS)', 0.033], gesso: ['Gesso', 0.17], madeira: ['Madeira', 0.12], aco: ['Aço carbono', 50], inox: ['Aço inox', 16], al: ['Alumínio', 205], cobre: ['Cobre', 400], ar: ['Ar parado', 0.026], outro: ['Outro (k manual)', 1] };
  const TMAT = { aco: ['Aço 1020', 52, 7870, 486], al: ['Alumínio 6061', 167, 2700, 896], cu: ['Cobre', 398, 8960, 385], inox: ['Aço inox 304', 16.2, 8000, 500], conc: ['Concreto', 1.4, 2300, 880], vidro: ['Vidro', 1.0, 2500, 840], madeira: ['Madeira', 0.12, 500, 1380] };
  const toolCalor = (host, onClean) => {
    const { body } = CS.page(host, {
      title: 'Transferência de Calor', lead: 'Condução em paredes compostas (planas e cilíndricas), aletas e condução transiente por diferenças finitas, com animação.',
      learn: `<p><b>Mecanismos:</b> condução (Fourier: q = −k·A·dT/dx), convecção (Newton: q = h·A·(T<sub>s</sub> − T<sub>∞</sub>)) e radiação (q = εσA(T⁴ − T<sub>viz</sub>⁴)).</p>
      <p><b>Analogia elétrica:</b> resistência térmica R = ΔT/q. Parede plana: R = L/(kA). Cilindro: R = ln(r₂/r₁)/(2πkL). Convecção: R = 1/(hA). As resistências em série se somam, como resistores.</p>
      <p><b>Raio crítico de isolamento</b> (cilindro): r<sub>c</sub> = k<sub>isol</sub>/h. Isolar um tubo fino demais (r &lt; r<sub>c</sub>) <i>aumenta</i> a perda de calor!</p>
      <p><b>Aletas:</b> aumentam a área de troca. Com m = √(hP/(kA<sub>c</sub>)), a eficiência é η = tanh(mL<sub>c</sub>)/(mL<sub>c</sub>). A efetividade ε = q<sub>aleta</sub>/(hA<sub>c</sub>θ<sub>b</sub>) deve ser bem maior que 1 (≥ 2) para valer a pena.</p>
      <p><b>Transiente:</b> ∂T/∂t = α·∂²T/∂x², com α = k/(ρc). O número de <b>Fourier</b> Fo = αt/L² é o tempo adimensional, e o número de <b>Biot</b> Bi = hL/k compara a resistência interna com a externa. Se Bi &lt; 0,1, vale a capacitância concentrada (temperatura uniforme no corpo).</p>
      <p><b>Diferenças finitas explícitas:</b> T<sub>i</sub><sup>p+1</sup> = T<sub>i</sub><sup>p</sup> + Fo·(T<sub>i+1</sub> − 2T<sub>i</sub> + T<sub>i−1</sub>), estável para Fo ≤ 0,5 (menor com convecção na borda).</p>`,
    });
    onClean(K.sections(body, 'calor', [{ id: 'parede', label: 'Parede composta', render: secParede }, { id: 'aleta', label: 'Aletas', render: secAleta }, { id: 'trans', label: 'Transiente (animação)', render: secTrans }]));
  };
  function secParede(area) {
    const f = K.form([
      { k: 'geo', l: 'Geometria', type: 'sel', v: 'plana', opts: [['plana', 'Parede plana (por m²)'], ['cil', 'Tubo cilíndrico (por metro)']] }, { k: 'ri', l: 'Raio interno (cilindro)', u: 'mm', v: '25' },
      { k: 'Ti', l: 'Temperatura interna T<sub>i</sub>', u: '°C', v: '22' }, { k: 'hi', l: 'Convecção interna h<sub>i</sub>', u: 'W/m²K', v: '8' },
      { k: 'Te', l: 'Temperatura externa T<sub>e</sub>', u: '°C', v: '-5' }, { k: 'he', l: 'Convecção externa h<sub>e</sub>', u: 'W/m²K', v: '25' },
    ], () => run(), { cols: 2 });
    let layers = [{ m: 'gesso', t: 15, k: 0.17 }, { m: 'tijolo', t: 115, k: 0.72 }, { m: 'eps', t: 50, k: 0.033 }, { m: 'concreto', t: 20, k: 1.4 }];
    const lt = h('div'), out = h('div'), cb = CS.chartBox('tall');
    area.append(h('div', { class: 'grid2' }, h('div', { class: 'col' }, CS.card('Condições', f.el, h('div', { class: 'card-title', style: 'margin-top:10px' }, 'Camadas (de dentro para fora)'), lt), CS.card('Resultados', out)), CS.card('Perfil de temperatura', cb)));
    const ch = new MS.Chart(cb, { xlabel: 'posição [mm]', ylabel: 'T [°C]', readout: (x, y) => `x = ${K.n(x)} mm\nT = ${K.n(y)} °C` });
    const renderLayers = () => {
      lt.innerHTML = '';
      layers.forEach((L, i) => {
        const s = h('select', {}, ...Object.entries(KMAT).map(([k, v]) => h('option', { value: k }, v[0]))); s.value = L.m;
        const t = h('input', { value: L.t, class: 'sm' }), k = h('input', { value: L.k, class: 'sm' });
        s.addEventListener('change', () => { L.m = s.value; if (s.value !== 'outro') { L.k = KMAT[s.value][1]; k.value = L.k; } run(); });
        t.addEventListener('change', () => { const v = MS.parseEng(t.value); if (v > 0) { L.t = v; run(); } });
        k.addEventListener('change', () => { const v = MS.parseEng(k.value); if (v > 0) { L.k = v; L.m = 'outro'; s.value = 'outro'; run(); } });
        lt.append(h('div', { class: 'load-row' }, s, h('span', {}, 'e'), t, h('span', {}, 'mm · k'), k, h('button', { class: 'btn icon sm danger', onclick: () => { layers.splice(i, 1); renderLayers(); run(); } }, '✕')));
      });
      lt.append(h('button', { class: 'btn sm', onclick: () => { layers.push({ m: 'la', t: 50, k: 0.04 }); renderLayers(); run(); } }, '+ camada'));
    };
    renderLayers();
    function run() {
      const { geo, Ti, hi, Te, he } = f.st, cyl = geo === 'cil';
      let r = f.st.ri / 1e3; const Rs = [];
      Rs.push({ n: 'conv. interna', R: cyl ? 1 / (hi * 2 * Math.PI * r) : 1 / hi, conv: true });
      let x = 0; const xs = [0];
      for (const L of layers) { const t = L.t / 1e3; Rs.push({ n: KMAT[L.m][0], R: cyl ? Math.log((r + t) / r) / (2 * Math.PI * L.k) : t / L.k, t, k: L.k, r0: r }); r += t; x += L.t; xs.push(x); }
      Rs.push({ n: 'conv. externa', R: cyl ? 1 / (he * 2 * Math.PI * r) : 1 / he, conv: true });
      const Rt = Rs.reduce((s, q) => s + q.R, 0), q = (Ti - Te) / Rt;
      let T = Ti; const Tint = [];
      const prof = { x: [-8, 0], y: [Ti, Ti - q * Rs[0].R] }; T -= q * Rs[0].R; Tint.push(T);
      let pos = 0, rr = f.st.ri / 1e3;
      layers.forEach((L, i) => {
        const R = Rs[i + 1]; const n = 20;
        for (let j = 1; j <= n; j++) { const fr = j / n; const Tj = cyl ? T - q * Math.log((rr + L.t / 1e3 * fr) / rr) / (2 * Math.PI * L.k) : T - q * R.R * fr; prof.x.push(pos + L.t * fr); prof.y.push(Tj); }
        T -= q * R.R; Tint.push(T); pos += L.t; rr += L.t / 1e3;
      });
      prof.x.push(pos + 8); prof.y.push(Te);
      const cols = ['rgba(79,179,255,0.08)', 'rgba(255,159,28,0.08)'];
      ch.set({ series: [{ ...prof, color: '#ff6b6b', width: 2.2 }], regions: layers.map((L, i) => ({ x0: xs[i], x1: xs[i + 1], y0: -Infinity, y1: Infinity, color: cols[i % 2] })), markers: Tint.map((t, i) => ({ x: xs[i], y: t, shape: 'dot', color: '#ffd166', size: 4 })) });
      out.innerHTML = '';
      const u = cyl ? 'W/m' : 'W/m²';
      out.append(K.table(['Resistência', cyl ? 'R [m·K/W]' : 'R [m²·K/W]', '% do total', 'ΔT [°C]'], Rs.map(rr2 => [rr2.n, K.n(rr2.R, 3), K.n(rr2.R / Rt * 100, 3), K.n(q * rr2.R, 3)])),
        CS.kv([['Resistência total', `${K.n(Rt)} ${cyl ? 'm·K/W' : 'm²·K/W'}`], ['Fluxo de calor q', `<b>${K.n(q)} ${u}</b>`], !cyl ? ['Transmitância U = 1/R', `${K.n(1 / Rt)} W/m²·K`] : null, ['Temp. superfície interna · externa', `${K.n(Tint[0])} · ${K.n(Tint[Tint.length - 1])} °C`],
          cyl && layers.length ? ['Raio crítico (última camada)', `${K.n(layers[layers.length - 1].k / he * 1e3)} mm (raio externo atual ${K.n(r * 1e3)} mm)${layers[layers.length - 1].k / he > r ? ' <span class="warn">isolamento ainda abaixo do raio crítico!</span>' : ''}`] : null]));
    }
    run();
  }
  function secAleta(area) {
    const f = K.form([
      { k: 'tipo', l: 'Tipo', type: 'sel', v: 'pino', opts: [['pino', 'Pino circular (diâmetro D)'], ['ret', 'Retangular (espessura t, largura w)']] },
      { k: 'k', l: 'Condutividade k', u: 'W/m·K', v: '200' }, { k: 'h', l: 'Convecção h', u: 'W/m²K', v: '25' },
      { k: 'D', l: 'Diâmetro D / espessura t', u: 'mm', v: '5' }, { k: 'w', l: 'Largura w (retangular)', u: 'mm', v: '50' }, { k: 'L', l: 'Comprimento L', u: 'mm', v: '50' },
      { k: 'Tb', l: 'Temperatura da base', u: '°C', v: '100' }, { k: 'Ti', l: 'Temperatura do fluido', u: '°C', v: '25' },
    ], () => run(), { cols: 2 });
    const out = h('div'), b1 = CS.chartBox(), b2 = CS.chartBox();
    area.append(h('div', { class: 'grid2' }, h('div', { class: 'col' }, CS.card('Dados', f.el), CS.card('Resultados', out)), h('div', { class: 'col' }, CS.card('Temperatura ao longo da aleta', b1), CS.card('Eficiência × mL<sub>c</sub>', b2))));
    const c1 = new MS.Chart(b1, { xlabel: 'x [mm]', ylabel: 'T [°C]', readout: (x, y) => `x = ${K.n(x)} mm\nT = ${K.n(y)} °C` });
    const c2 = new MS.Chart(b2, { xlabel: 'mLc', ylabel: 'η', yrange: [0, 1.02], readout: (x, y) => `mLc = ${K.n(x)}\nη = ${K.n(y)}` });
    function run() {
      const { k, h: hh, Tb, Ti } = f.st, D = f.st.D / 1e3, w = f.st.w / 1e3, L = f.st.L / 1e3;
      let P, Ac, Lc;
      if (f.st.tipo === 'pino') { P = Math.PI * D; Ac = Math.PI * D * D / 4; Lc = L + D / 4; } else { P = 2 * (w + D); Ac = w * D; Lc = L + D / 2; }
      const m = Math.sqrt(hh * P / (k * Ac)), mL = m * Lc, eta = Math.tanh(mL) / mL, th = Tb - Ti;
      const Af = P * Lc, qf = eta * hh * Af * th, eps = qf / (hh * Ac * th);
      const xs = K.linspace(0, L, 100);
      c1.set({ series: [{ x: xs.map(x => x * 1e3), y: xs.map(x => Ti + th * Math.cosh(m * (Lc - x)) / Math.cosh(mL)), color: '#ff6b6b', width: 2.2 }], hlines: [{ y: Ti, color: 'rgba(79,179,255,0.5)', label: 'fluido' }] });
      const ms = K.linspace(0.01, Math.max(4, mL * 1.3), 200);
      c2.set({ series: [{ x: ms, y: ms.map(x => Math.tanh(x) / x), color: '#4fb3ff', width: 2 }], markers: [{ x: mL, y: eta, shape: 'dot', color: '#ffd166', size: 6 }] });
      out.innerHTML = '';
      out.append(CS.kv([['m = √(hP/kA<sub>c</sub>)', `${K.n(m)} 1/m`], ['Comprimento corrigido L<sub>c</sub>', `${K.n(Lc * 1e3)} mm`], ['m·L<sub>c</sub>', K.n(mL)], ['Eficiência η', `<b>${K.n(eta * 100, 3)} %</b>`], ['Calor dissipado por aleta', `${K.n(qf)} W`], ['Efetividade ε', `${K.n(eps)} ${eps < 2 ? '<span class="warn">(baixa: aleta pouco útil)</span>' : '<span class="good">✓</span>'}`], ['Temperatura na ponta', `${K.n(Ti + th / Math.cosh(mL))} °C`]]));
    }
    run();
  }
  function secTrans(area, onClean) {
    const bcOpts = [['T', 'Temperatura fixa'], ['h', 'Convecção'], ['q', 'Isolada (adiabática)']];
    const f = K.form([
      { k: 'mat', l: 'Material', type: 'sel', v: 'aco', opts: Object.entries(TMAT).map(([k, v]) => [k, v[0]]) }, { k: 'L', l: 'Espessura / comprimento L', u: 'mm', v: '50' }, { k: 'T0', l: 'Temperatura inicial', u: '°C', v: '20' },
      { k: 'bl', l: 'Contorno esquerdo', type: 'sel', v: 'T', opts: bcOpts }, { k: 'Tl', l: 'T do fluido/parede esquerda', u: '°C', v: '200' }, { k: 'hl', l: 'h esquerdo', u: 'W/m²K', v: '100' },
      { k: 'br', l: 'Contorno direito', type: 'sel', v: 'h', opts: bcOpts }, { k: 'Tr', l: 'T do fluido/parede direita', u: '°C', v: '20' }, { k: 'hr', l: 'h direito', u: 'W/m²K', v: '20' },
    ], () => reset(), { cols: 2 });
    const ctl = h('div', { class: 'row gap' }), out = h('div'), cb = CS.chartBox('tall'), stripC = CS.card('Mapa de cor (frio → quente)');
    area.append(h('div', { class: 'grid2' }, h('div', { class: 'col' }, CS.card('Problema', f.el, ctl), CS.card('Estado', out)), h('div', { class: 'col' }, CS.card('T(x) ao longo do tempo', cb), stripC)));
    const ch = new MS.Chart(cb, { xlabel: 'x [mm]', ylabel: 'T [°C]', readout: (x, y) => `x = ${K.n(x)} mm\nT = ${K.n(y)} °C` });
    const strip = K.canvas(stripC, 60, null);
    let T = [], t = 0, dt = 1, play = true, snaps = [], speed = 20, a, dx, N = 41, Tmin, Tmax, nextSnap;
    const sp = h('select', {}, ...[[5, 'lento'], [20, 'normal'], [100, 'rápido'], [500, 'muito rápido']].map(([v, l]) => h('option', { value: v }, l))); sp.value = '20';
    sp.addEventListener('change', () => { speed = +sp.value; });
    const pb = h('button', { class: 'btn sm', onclick: () => { play = !play; pb.textContent = play ? '❚❚ pausar' : '▶ continuar'; } }, '❚❚ pausar');
    ctl.append(pb, h('button', { class: 'btn sm', onclick: () => reset() }, '↺ reiniciar'), h('span', { class: 'muted small' }, 'velocidade'), sp);
    function reset() {
      const [, k, rho, c] = TMAT[f.st.mat]; a = k / (rho * c); dx = f.st.L / 1e3 / (N - 1);
      const bi = Math.max(f.st.bl === 'h' ? f.st.hl * dx / k : 0, f.st.br === 'h' ? f.st.hr * dx / k : 0);
      dt = 0.45 * dx * dx / (a * (1 + bi));
      T = Array(N).fill(f.st.T0); t = 0; snaps = []; nextSnap = 0;
      if (f.st.bl === 'T') T[0] = f.st.Tl; if (f.st.br === 'T') T[N - 1] = f.st.Tr;
      Tmin = Math.min(f.st.T0, f.st.Tl, f.st.Tr); Tmax = Math.max(f.st.T0, f.st.Tl, f.st.Tr) + 1e-9;
      draw();
    }
    const step = () => {
      const [, k] = TMAT[f.st.mat], Fo = a * dt / (dx * dx), n = T.slice();
      for (let i = 1; i < N - 1; i++) n[i] = T[i] + Fo * (T[i + 1] - 2 * T[i] + T[i - 1]);
      const bnd = (i, j, type, Tf, hh) => { if (type === 'T') return Tf; const Bi = type === 'h' ? hh * dx / k : 0; return T[i] + 2 * Fo * ((T[j] - T[i]) + Bi * (Tf - T[i])); };
      n[0] = bnd(0, 1, f.st.bl, f.st.Tl, f.st.hl); n[N - 1] = bnd(N - 1, N - 2, f.st.br, f.st.Tr, f.st.hr);
      T = n; t += dt;
    };
    function draw() {
      const xs = T.map((_, i) => i * dx * 1e3);
      ch.set({ series: [...snaps.map((s, i) => ({ x: xs, y: s, color: `rgba(159,180,208,${0.15 + 0.4 * i / Math.max(1, snaps.length)})`, width: 1 })), { x: xs, y: T, color: '#ff6b6b', width: 2.4 }], hlines: [] }, true);
      if (!ch.view || t === 0) ch.set({ series: [{ x: xs, y: T, color: '#ff6b6b', width: 2.4 }], markers: [{ x: 0, y: Tmin, hidden: true }, { x: 0, y: Tmax, hidden: true }] });
      const [, k, rho, c] = TMAT[f.st.mat], L = f.st.L / 1e3;
      out.innerHTML = '';
      out.append(CS.kv([['Tempo', `<b>${t < 120 ? K.n(t) + ' s' : t < 7200 ? K.n(t / 60) + ' min' : K.n(t / 3600) + ' h'}</b>`], ['Difusividade α = k/ρc', `${K.f(a, 'm²/s', 3)}`], ['Número de Fourier αt/L²', K.n(a * t / (L * L))], ['Biot (esq · dir)', `${K.n(f.st.hl * L / k)} · ${K.n(f.st.hr * L / k)}`], ['Passo Δt (estável)', `${K.n(dt)} s`], ['T média', `${K.n(T.reduce((s, v) => s + v, 0) / N)} °C`]]));
      strip.draw = (g, W, H) => { const w = W / N; T.forEach((v, i) => { const kk = (v - Tmin) / (Tmax - Tmin); g.fillStyle = `rgb(${Math.round(40 + 215 * kk)},${Math.round(90 + 60 * Math.sin(kk * Math.PI))},${Math.round(230 - 210 * kk)})`; g.fillRect(i * w, 4, w + 1, H - 8); }); };
      strip.redraw();
    }
    reset();
    let frame = 0;
    onClean(K.animate(cb, () => {
      if (!play) return;
      for (let i = 0; i < speed; i++) step();
      if (t >= nextSnap) { snaps.push(T.slice()); if (snaps.length > 8) snaps.shift(); nextSnap = t + dt * speed * 25; }
      if (++frame % 2 === 0) draw();
    }));
  }

  CS.registerTab('fts', {
    title: 'Fluidos e Sistemas Térmicos',
    tools: [
      { id: 'termo', label: 'Termodinâmica', desc: 'processos, ciclos, P-v e T-s', render: toolTermo },
      { id: 'fluid', label: 'Mecânica dos Fluidos e Fenômenos de Transporte', desc: 'Moody, bomba × sistema, Venturi', render: toolFluidos },
      { id: 'calor', label: 'Transferência de Calor', desc: 'paredes, aletas, transiente', render: toolCalor },
    ],
  });
})();
