/* ============================================================
   MeControlEng — Mecânica › Fabricação, Controle e Gestão Industrial
   Processos de Fabricação · Metrologia e Controle · Manutenção e Gestão
   ============================================================ */
'use strict';
(function () {
  const CS = MS.CS, h = CS.h, K = MS.MK;

  /* ════════════════ 1. PROCESSOS DE FABRICAÇÃO ════════════════ */
  // kc1.1 [N/mm²], mc, Vc HSS, Vc metal duro [m/min]
  const WP = { a1020: ['Aço 1020', 1500, 0.25, 30, 250], a4140: ['Aço 4140', 1800, 0.25, 20, 180], inox: ['Aço inox 304', 2000, 0.21, 15, 150], ff: ['Ferro fundido cinzento', 1100, 0.28, 25, 200], al: ['Alumínio', 700, 0.25, 150, 600], lat: ['Latão', 780, 0.18, 70, 300] };
  const wpOpts = Object.entries(WP).map(([k, v]) => [k, v[0]]);
  const toolUsin = (host, onClean) => {
    const { body } = CS.page(host, {
      title: 'Processos de Fabricação', lead: 'Usinagem (torneamento, fresamento e furação): parâmetros de corte, força, potência e tempo. Vida da ferramenta (Taylor) e velocidade econômica.',
      learn: `<p><b>Parâmetros de corte:</b> velocidade de corte V<sub>c</sub> [m/min], avanço f [mm/rot ou mm/dente], profundidade a<sub>p</sub> [mm]. A rotação vem de n = 1000·V<sub>c</sub>/(π·D).</p>
      <p><b>Taxa de remoção</b> (torneamento): Q = V<sub>c</sub>·a<sub>p</sub>·f [cm³/min]. <b>Força de corte</b> (Kienzle): F<sub>c</sub> = k<sub>c</sub>·a<sub>p</sub>·f, com k<sub>c</sub> = k<sub>c1.1</sub>·h<sup>−mc</sup> (a pressão específica cresce quando o cavaco é fino). <b>Potência:</b> P<sub>c</sub> = F<sub>c</sub>·V<sub>c</sub>/60 000 [kW].</p>
      <p><b>Acabamento:</b> rugosidade teórica R<sub>a</sub> ≈ f²/(32·r<sub>ε</sub>). Avanço menor e raio de ponta maior dão superfície melhor.</p>
      <p><b>Equação de Taylor:</b> V·T<sup>n</sup> = C (n ≈ 0,125 aço rápido, 0,25 metal duro, 0,5 cerâmica). Velocidade maior gasta a ferramenta muito mais depressa.</p>
      <p><b>Velocidade econômica:</b> o custo por peça soma máquina × tempo de corte (cai com V) e ferramenta + troca (sobe com V). O mínimo ocorre em T<sub>ótimo</sub> = (1/n − 1)·(t<sub>troca</sub> + C<sub>ferr</sub>/C<sub>máq</sub>). A máxima produção usa T = (1/n − 1)·t<sub>troca</sub>.</p>
      <p><b>Outros processos</b> (visão geral): fundição (formas complexas, peças grandes), conformação (forjamento, laminação, estampagem: melhora as propriedades e aproveita o material), soldagem (união permanente), metalurgia do pó e manufatura aditiva (geometrias livres).</p>`,
    });
    onClean(K.sections(body, 'usin', [{ id: 'torno', label: 'Torneamento', render: a => secUsin(a, 'torno') }, { id: 'fresa', label: 'Fresamento', render: a => secUsin(a, 'fresa') }, { id: 'furo', label: 'Furação', render: a => secUsin(a, 'furo') }, { id: 'taylor', label: 'Vida da ferramenta e custo', render: secTaylor }]));
  };
  function secUsin(area, op) {
    const base = [{ k: 'wp', l: 'Material da peça', type: 'sel', v: 'a1020', opts: wpOpts }, { k: 'ferr', l: 'Ferramenta', type: 'sel', v: 'md', opts: [['md', 'Metal duro'], ['hss', 'Aço rápido (HSS)']] }, { k: 'Vc', l: 'Velocidade de corte Vc', u: 'm/min', v: '' }];
    const extra = {
      torno: [{ k: 'D', l: 'Diâmetro da peça D', u: 'mm', v: '60' }, { k: 'L', l: 'Comprimento usinado L', u: 'mm', v: '150' }, { k: 'ap', l: 'Profundidade de corte ap', u: 'mm', v: '2' }, { k: 'f', l: 'Avanço f', u: 'mm/rot', v: '0.25' }, { k: 're', l: 'Raio de ponta rε', u: 'mm', v: '0.8' }],
      fresa: [{ k: 'D', l: 'Diâmetro da fresa D', u: 'mm', v: '50' }, { k: 'z', l: 'Número de dentes z', u: '', v: '4' }, { k: 'fz', l: 'Avanço por dente fz', u: 'mm', v: '0.1' }, { k: 'ap', l: 'Profundidade axial ap', u: 'mm', v: '3' }, { k: 'ae', l: 'Largura radial ae', u: 'mm', v: '30' }, { k: 'L', l: 'Comprimento do passe L', u: 'mm', v: '200' }],
      furo: [{ k: 'D', l: 'Diâmetro da broca D', u: 'mm', v: '12' }, { k: 'f', l: 'Avanço f', u: 'mm/rot', v: '0.2' }, { k: 'L', l: 'Profundidade do furo', u: 'mm', v: '30' }],
    }[op];
    const f = K.form([...base, ...extra, { k: 'Pm', l: 'Potência da máquina', u: 'kW', v: '7.5' }, { k: 'eta', l: 'Rendimento da máquina', u: '%', v: '80' }], k => { if (k === 'wp' || k === 'ferr') setVc(); run(); }, { cols: 2 });
    const out = h('div'), bar = h('div');
    area.append(h('div', { class: 'grid2' }, CS.card('Parâmetros', f.el), h('div', { class: 'col' }, CS.card('Resultados', out), CS.card('Uso da potência da máquina', bar))));
    const setVc = () => { const w = WP[f.st.wp]; f.set('Vc', String(f.st.ferr === 'md' ? w[4] : w[3])); };
    setVc();
    function run() {
      const w = WP[f.st.wp], s = f.st, Vc = s.Vc, n = 1000 * Vc / (Math.PI * s.D);
      let rows, Pc;
      if (op === 'torno') {
        const Vf = s.f * n, tc = s.L / Vf, Q = Vc * s.ap * s.f, kc = w[1] * Math.pow(s.f, -w[2]), Fc = kc * s.ap * s.f; Pc = Fc * Vc / 60000;
        rows = [['Rotação n', `${K.n(n)} rpm`], ['Velocidade de avanço', `${K.n(Vf)} mm/min`], ['Tempo de corte', `${K.n(tc)} min (${K.n(tc * 60)} s)`], ['Taxa de remoção Q', `${K.n(Q)} cm³/min`], ['k<sub>c</sub> (h = f)', `${K.n(kc)} N/mm²`], ['Força de corte F<sub>c</sub>', `${K.n(Fc)} N`], ['Potência de corte', `${K.n(Pc)} kW`], ['Rugosidade teórica R<sub>a</sub>', `${K.n(s.f * s.f / (32 * s.re) * 1000)} µm`], ['Diâmetro final', `${K.n(s.D - 2 * s.ap)} mm`]];
      } else if (op === 'fresa') {
        const Vf = s.fz * s.z * n, Q = s.ap * s.ae * Vf / 1000, hm = s.fz * Math.sqrt(Math.min(1, s.ae / s.D)), kc = w[1] * Math.pow(hm, -w[2]); Pc = s.ap * s.ae * Vf * kc / 60e6;
        rows = [['Rotação n', `${K.n(n)} rpm`], ['Velocidade de avanço Vf = fz·z·n', `${K.n(Vf)} mm/min`], ['Tempo do passe (L + D)', `${K.n((s.L + s.D) / Vf)} min`], ['Taxa de remoção Q', `${K.n(Q)} cm³/min`], ['Espessura média do cavaco hm', `${K.n(hm, 3)} mm`], ['k<sub>c</sub>', `${K.n(kc)} N/mm²`], ['Potência de corte', `${K.n(Pc)} kW`], ['Torque no eixo', `${K.n(Pc * 30e3 / (Math.PI * n))} N·m`]];
      } else {
        const Vf = s.f * n, Q = Math.PI * s.D * s.D / 4 * Vf / 1000, kc = w[1] * Math.pow(s.f / 2 * Math.sin(59 * Math.PI / 180), -w[2]); Pc = s.f * s.D * Vc * kc / 240000;
        rows = [['Rotação n', `${K.n(n)} rpm`], ['Velocidade de avanço', `${K.n(Vf)} mm/min`], ['Tempo por furo', `${K.n(s.L / Vf * 60)} s`], ['Taxa de remoção Q', `${K.n(Q)} cm³/min`], ['k<sub>c</sub>', `${K.n(kc)} N/mm²`], ['Potência de corte', `${K.n(Pc)} kW`], ['Torque', `${K.n(Pc * 30e3 / (Math.PI * n))} N·m`]];
      }
      const need = Pc / (s.eta / 100), use = need / s.Pm * 100;
      out.innerHTML = ''; out.append(CS.kv(rows));
      bar.innerHTML = '';
      bar.append(h('div', { class: 'hbar' }, h('div', { class: 'hbar-fill', style: `width:${Math.min(100, use)}%;background:${use > 100 ? '#ff4d6d' : use > 80 ? '#ffd166' : '#3ddc84'}` })),
        h('div', { class: 'small', html: `Potência necessária no motor: ${K.n(need)} kW = ${K.n(use, 3)} % da máquina ${use > 100 ? '— <b class="bad">insuficiente: reduza ap, f ou Vc</b>' : ''}` }));
    }
    run();
  }
  function secTaylor(area) {
    const f = K.form([
      { k: 'modo', l: 'Constantes de Taylor', type: 'sel', v: 'ens', opts: [['ens', 'calibrar com dois ensaios'], ['dir', 'informar n e C']] },
      { k: 'V1', l: 'Ensaio 1: velocidade V₁', u: 'm/min', v: '200' }, { k: 'T1', l: 'Ensaio 1: vida T₁', u: 'min', v: '30' }, { k: 'V2', l: 'Ensaio 2: velocidade V₂', u: 'm/min', v: '300' }, { k: 'T2', l: 'Ensaio 2: vida T₂', u: 'min', v: '6' },
      { k: 'n', l: 'Expoente n', u: '', v: '0.25' }, { k: 'C', l: 'Constante C', u: 'm/min', v: '470' },
      { sep: 'Peça e custos' }, { k: 'D', l: 'Diâmetro', u: 'mm', v: '80' }, { k: 'L', l: 'Comprimento usinado', u: 'mm', v: '300' }, { k: 'fv', l: 'Avanço', u: 'mm/rot', v: '0.25' },
      { k: 'Co', l: 'Custo máquina + operador', u: 'R$/min', v: '2.5' }, { k: 'Ct', l: 'Custo da aresta da ferramenta', u: 'R$', v: '15' }, { k: 'tct', l: 'Tempo de troca da ferramenta', u: 'min', v: '2' }, { k: 'th', l: 'Tempo de manuseio por peça', u: 'min', v: '1' },
    ], () => run(), { cols: 2 });
    const out = h('div'), b1 = CS.chartBox('tall'), b2 = CS.chartBox();
    area.append(h('div', { class: 'grid2' }, h('div', { class: 'col' }, CS.card('Dados', f.el), CS.card('Resultados', out)), h('div', { class: 'col' }, CS.card('Custo por peça × velocidade de corte', b1), CS.card('Curva de Taylor (log-log)', b2))));
    const c1 = new MS.Chart(b1, { xlabel: 'Vc [m/min]', ylabel: 'R$/peça', readout: (x, y) => `V = ${K.n(x)} m/min\nR$ ${K.n(y)}` });
    const c2 = new MS.Chart(b2, { xlog: true, ylog: true, xlabel: 'T [min]', ylabel: 'V [m/min]', readout: (x, y) => `T = ${K.n(x)} min\nV = ${K.n(y)}` });
    function run() {
      const s = f.st;
      let n = s.n, C = s.C;
      if (s.modo === 'ens') { n = Math.log(s.V1 / s.V2) / Math.log(s.T2 / s.T1); C = s.V1 * Math.pow(s.T1, n); }
      const Tof = V => Math.pow(C / V, 1 / n), tm = V => Math.PI * s.D * s.L / (1000 * V * s.fv);
      const cost = V => { const T = Tof(V), t = tm(V); return { maq: s.Co * (s.th + t), ferr: (s.Co * s.tct + s.Ct) * t / T }; };
      const Topt = (1 / n - 1) * (s.tct + s.Ct / s.Co), Vopt = C / Math.pow(Topt, n), Tmp = (1 / n - 1) * s.tct, Vmp = C / Math.pow(Tmp, n);
      const Vs = K.linspace(Vopt * 0.3, Math.min(Vmp * 1.4, C * 0.98), 200);
      c1.set({ series: [{ x: Vs, y: Vs.map(v => cost(v).maq), color: '#4fb3ff', width: 1.5, dash: [5, 4], name: 'máquina + mão de obra' }, { x: Vs, y: Vs.map(v => cost(v).ferr), color: '#ff9f1c', width: 1.5, dash: [5, 4], name: 'ferramenta + trocas' }, { x: Vs, y: Vs.map(v => cost(v).maq + cost(v).ferr), color: '#3ddc84', width: 2.4, name: 'total' }],
        vlines: [{ x: Vopt, color: '#3ddc84', label: 'mín. custo' }, { x: Vmp, color: '#c77dff', label: 'máx. produção' }] });
      const Ts = CS.logspace(0.5, 200, 50);
      c2.set({ series: [{ x: Ts, y: Ts.map(T => C / Math.pow(T, n)), color: '#4fb3ff', width: 2 }], markers: s.modo === 'ens' ? [{ x: s.T1, y: s.V1, shape: 'dot', color: '#ffd166', label: 'ensaio 1' }, { x: s.T2, y: s.V2, shape: 'dot', color: '#ffd166', label: 'ensaio 2' }] : [] });
      const co = cost(Vopt);
      out.innerHTML = '';
      out.append(CS.kv([['Taylor', `V·T<sup>${K.n(n, 3)}</sup> = ${K.n(C)}`], ['Velocidade de mínimo custo', `<b>${K.n(Vopt)} m/min</b> (vida T = ${K.n(Topt)} min)`], ['Custo por peça no ótimo', `R$ ${K.n(co.maq + co.ferr)}`], ['Velocidade de máxima produção', `${K.n(Vmp)} m/min (T = ${K.n(Tmp)} min)`], ['Tempo de corte no ótimo', `${K.n(tm(Vopt))} min/peça`], ['Peças por aresta no ótimo', K.n(Topt / tm(Vopt), 3)]]));
    }
    run();
  }

  /* ════════════════ 2. METROLOGIA E CONTROLE ════════════════ */
  const RANGES = [[1, 3], [3, 6], [6, 10], [10, 18], [18, 30], [30, 50], [50, 80], [80, 120], [120, 180], [180, 250], [250, 315], [315, 400], [400, 500]];
  const DEV = { // desvios fundamentais de eixos [µm]: es (c–h) ou ei (k–s)
    c: [-60, -70, -80, -95, -110, -125, -145, -175, -210, -260, -315, -380, -460], d: [-20, -30, -40, -50, -65, -80, -100, -120, -145, -170, -190, -210, -230],
    e: [-14, -20, -25, -32, -40, -50, -60, -72, -85, -100, -110, -125, -135], f: [-6, -10, -13, -16, -20, -25, -30, -36, -43, -50, -56, -62, -68],
    g: [-2, -4, -5, -6, -7, -9, -10, -12, -14, -15, -17, -18, -20], h: Array(13).fill(0),
    k: [0, 1, 1, 1, 2, 2, 2, 3, 3, 4, 4, 4, 5], m: [2, 4, 6, 7, 8, 9, 11, 13, 15, 17, 20, 21, 23], n: [4, 8, 10, 12, 15, 17, 20, 23, 27, 31, 34, 37, 40],
    p: [6, 12, 15, 18, 22, 26, 32, 37, 43, 50, 56, 62, 68], r: [10, 15, 19, 23, 28, 34, 42, 52, 65, 80, 96, 111, 129], s: [14, 19, 23, 28, 35, 43, 56, 75, 100, 130, 164, 199, 242],
  };
  const ITM = { 5: 7, 6: 10, 7: 16, 8: 25, 9: 40, 10: 64, 11: 100 };
  K.iso286 = function (Dn, holeIT, shaftL, shaftIT) {
    const ri = RANGES.findIndex(([a, b]) => Dn > a - 1e-9 && Dn <= b) ; const r = ri < 0 ? (Dn <= 1 ? 0 : -1) : ri;
    if (r < 0) throw new Error('Diâmetro fora da faixa da norma (até 500 mm).');
    const Dg = Math.sqrt(RANGES[r][0] * RANGES[r][1]), i = 0.45 * Math.cbrt(Dg) + 0.001 * Dg, IT = n => Math.round(ITM[n] * i);
    const ITh = IT(holeIT), ITs = IT(shaftIT);
    const hole = { EI: 0, ES: ITh };
    let es, ei;
    if (shaftL === 'js') { es = ITs / 2; ei = -ITs / 2; }
    else if ('cdefgh'.includes(shaftL)) { es = DEV[shaftL][r]; ei = es - ITs; }
    else { ei = shaftL === 'k' && (shaftIT > 7) ? 0 : DEV[shaftL][r]; es = ei + ITs; }
    const fmax = hole.ES - ei, fmin = hole.EI - es;
    const kind = fmin >= 0 ? 'folga' : fmax <= 0 ? 'interferência' : 'transição';
    return { r, range: RANGES[r], i, ITh, ITs, hole, shaft: { es, ei }, fmax, fmin, kind };
  };
  const FITS = { 'H7/g6': 'Deslizante preciso: guias, pinos de articulação, engrenagens deslizantes.', 'H7/h6': 'Localização com folga mínima: peças desmontáveis, centragens.', 'H8/f7': 'Rotativo com lubrificação: mancais de deslizamento comuns.', 'H9/d9': 'Rotativo livre: mancais com folga, polias loucas.', 'H11/c11': 'Folga grande: montagens grosseiras, pinos de dobradiças.', 'H7/k6': 'Transição: polias, acoplamentos e engrenagens com chaveta.', 'H7/n6': 'Transição firme: montagem com prensa leve.', 'H7/p6': 'Interferência leve: buchas prensadas, posicionamento rígido.', 'H7/s6': 'Interferência média: prensado a quente, transmite torque sem chaveta.' };
  const toolMetro = (host, onClean) => {
    const { body } = CS.page(host, {
      title: 'Metrologia e Controle', lead: 'Tolerâncias e ajustes ISO 286, controle estatístico de processo (cartas X̄-R e capabilidade) e leitura de paquímetro com nônio.',
      learn: `<p><b>Tolerância</b> é a variação permitida de uma dimensão. Na ISO 286 ela é dada por uma <b>letra</b> (posição em relação à linha zero: H = furo com afastamento inferior nulo; h = eixo com superior nulo) e um <b>número</b> (qualidade IT: quanto menor, mais preciso e mais caro). IT = k·i, com i = 0,45·∛D + 0,001·D [µm].</p>
      <p><b>Ajustes</b> (sistema furo-base H): <i>com folga</i> (o eixo sempre menor), <i>de transição</i> (pode haver folga ou interferência) e <i>com interferência</i> (montagem forçada ou a quente).</p>
      <p><b>CEP:</b> todo processo varia. As cartas de controle separam <i>causas comuns</i> (aleatórias) de <i>causas especiais</i> (desgaste, troca de lote…). Limites da carta X̄: X̿ ± A₂·R̄. Da carta R: D₃·R̄ a D₄·R̄. Ponto fora dos limites ou 7 seguidos do mesmo lado da média indicam processo fora de controle.</p>
      <p><b>Capabilidade:</b> C<sub>p</sub> = (LSE − LIE)/6σ mede se o processo cabe na tolerância; C<sub>pk</sub> = mín(LSE − μ, μ − LIE)/3σ considera também a centralização. Referências: C<sub>pk</sub> ≥ 1,33 é capaz; &lt; 1 é incapaz.</p>
      <p><b>Paquímetro:</b> leitura = valor da escala principal antes do zero do nônio + (traço do nônio coincidente × resolução). Resoluções comuns: 0,1 · 0,05 · 0,02 mm. Lembre-se também do erro de paralaxe, da força de medição e da temperatura de referência (20 °C).</p>`,
    });
    onClean(K.sections(body, 'metro', [{ id: 'iso', label: 'Tolerâncias e ajustes (ISO 286)', render: secISO }, { id: 'cep', label: 'CEP e capabilidade', render: secCEP }, { id: 'paq', label: 'Paquímetro virtual', render: secPaq }]));
  };
  function secISO(area) {
    const f = K.form([
      { k: 'D', l: 'Diâmetro nominal', u: 'mm', v: '25' }, { k: 'pre', l: 'Ajuste usual', type: 'sel', v: 'H7/g6', opts: [['', 'personalizado'], ...Object.keys(FITS).map(k => [k, k])] },
      { k: 'hIT', l: 'Furo H — qualidade IT', type: 'sel', v: '7', opts: ['6', '7', '8', '9', '10', '11'] }, { k: 'sL', l: 'Eixo — posição (letra)', type: 'sel', v: 'g', opts: ['c', 'd', 'e', 'f', 'g', 'h', 'js', 'k', 'm', 'n', 'p', 'r', 's'] }, { k: 'sIT', l: 'Eixo — qualidade IT', type: 'sel', v: '6', opts: ['5', '6', '7', '8', '9', '10', '11'] },
    ], k => { if (k === 'pre' && f.st.pre) { const [a, b] = f.st.pre.split('/'); f.set('hIT', a.slice(1)); f.set('sL', b.replace(/\d+/, '')); f.set('sIT', b.match(/\d+/)[0]); } else if (k !== 'D' && k !== 'pre') f.set('pre', ''); run(); }, { cols: 2 });
    const out = h('div'), dc = CS.card('Zonas de tolerância (µm em relação ao nominal)');
    area.append(h('div', { class: 'grid2' }, h('div', { class: 'col' }, CS.card('Ajuste', f.el), CS.card('Resultados', out)), dc));
    const cv = K.canvas(dc, 320, null);
    function run() {
      out.innerHTML = '';
      try {
        const D = f.st.D, r = K.iso286(D, +f.st.hIT, f.st.sL, +f.st.sIT), mm = v => K.n(D + v / 1000, 6);
        const name = `Ø${D} H${f.st.hIT}/${f.st.sL}${f.st.sIT}`;
        out.append(CS.kv([
          ['Faixa de diâmetros', `${r.range[0]} a ${r.range[1]} mm · i = ${K.n(r.i, 3)} µm`],
          [`Furo H${f.st.hIT} (IT = ${r.ITh} µm)`, `${mm(r.hole.EI)} a ${mm(r.hole.ES)} mm (EI = 0, ES = +${r.hole.ES} µm)`],
          [`Eixo ${f.st.sL}${f.st.sIT} (IT = ${r.ITs} µm)`, `${mm(r.shaft.ei)} a ${mm(r.shaft.es)} mm (es = ${r.shaft.es > 0 ? '+' : ''}${r.shaft.es}, ei = ${r.shaft.ei > 0 ? '+' : ''}${r.shaft.ei} µm)`],
          ['Folga máxima', `${r.fmax} µm`], [r.fmin >= 0 ? 'Folga mínima' : 'Interferência máxima', `${Math.abs(r.fmin)} µm`],
          ['Tipo de ajuste', `<b class="${r.kind === 'folga' ? 'good' : r.kind === 'transição' ? 'warn' : 'bad'}">${r.kind}</b>`],
          FITS[`H${f.st.hIT}/${f.st.sL}${f.st.sIT}`] ? ['Aplicação típica', FITS[`H${f.st.hIT}/${f.st.sL}${f.st.sIT}`]] : null,
        ]), h('div', { class: 'muted small' }, 'Desvios das tabelas da ISO 286-2 (valor representativo de cada faixa); IT calculado pela fórmula da norma.'));
        cv.draw = (g, W, H) => {
          const vals = [r.hole.ES, r.hole.EI, r.shaft.es, r.shaft.ei, 0], mx = Math.max(...vals) + 5, mn = Math.min(...vals) - 5;
          const Y = v => 20 + (mx - v) / (mx - mn) * (H - 50);
          g.strokeStyle = '#9fb4d0'; g.setLineDash([5, 4]); g.beginPath(); g.moveTo(10, Y(0)); g.lineTo(W - 10, Y(0)); g.stroke(); g.setLineDash([]);
          g.fillStyle = '#9fb4d0'; g.font = '11px Barlow'; g.textAlign = 'left'; g.fillText(`linha zero (Ø${D})`, 12, Y(0) - 4);
          const box = (x, a, b, c, lab) => { g.fillStyle = c + '55'; g.strokeStyle = c; g.fillRect(x, Y(a), 90, Y(b) - Y(a)); g.strokeRect(x, Y(a), 90, Y(b) - Y(a)); g.fillStyle = c; g.textAlign = 'center'; g.fillText(lab, x + 45, Y(a) - 6); g.font = '10px Share Tech Mono'; g.fillText(`${a > 0 ? '+' : ''}${a}`, x + 112, Y(a) + 4); g.fillText(`${b > 0 ? '+' : ''}${b}`, x + 112, Y(b) + 4); g.font = '11px Barlow'; };
          box(W * 0.18, r.hole.ES, r.hole.EI, '#4fb3ff', `furo H${f.st.hIT}`);
          box(W * 0.55, r.shaft.es, r.shaft.ei, '#ff9f1c', `eixo ${f.st.sL}${f.st.sIT}`);
          g.fillStyle = '#c3d3e8'; g.textAlign = 'center'; g.fillText(name + ' — ajuste ' + r.kind, W / 2, H - 8);
        };
        cv.redraw();
      } catch (e) { out.append(h('div', { class: 'err' }, e.message)); }
    }
    run();
  }
  const SPC = { A2: [0, 0, 1.880, 1.023, 0.729, 0.577, 0.483, 0.419, 0.373, 0.337, 0.308], d2: [0, 0, 1.128, 1.693, 2.059, 2.326, 2.534, 2.704, 2.847, 2.970, 3.078], D3: [0, 0, 0, 0, 0, 0, 0, 0.076, 0.136, 0.184, 0.223], D4: [0, 0, 3.267, 2.574, 2.282, 2.114, 2.004, 1.924, 1.864, 1.816, 1.777] };
  const rng = seed => { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };
  const Phi = x => 0.5 * (1 + erf(x / Math.SQRT2));
  function erf(x) { const s = Math.sign(x); x = Math.abs(x); const t = 1 / (1 + 0.3275911 * x); const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x); return s * y; }
  function secCEP(area) {
    let seed = 7;
    const f = K.form([
      { k: 'mu', l: 'Média do processo μ', u: 'mm', v: '50.00' }, { k: 'sg', l: 'Desvio-padrão σ', u: 'mm', v: '0.012' },
      { k: 'LIE', l: 'Limite inferior de especificação', u: 'mm', v: '49.95' }, { k: 'LSE', l: 'Limite superior de especificação', u: 'mm', v: '50.05' },
      { k: 'n', l: 'Tamanho do subgrupo n (2–10)', u: '', v: '5' }, { k: 'k', l: 'Número de subgrupos', u: '', v: '30' },
      { k: 'sh', l: 'Deslocamento da média (causa especial)', u: 'mm', v: '0.02' }, { k: 'at', l: 'A partir do subgrupo', u: '', v: '20' },
    ], () => run(), { cols: 2 });
    const out = h('div'), b1 = CS.chartBox('sm'), b2 = CS.chartBox('sm'), b3 = CS.chartBox();
    area.append(h('div', { class: 'grid2' }, h('div', { class: 'col' }, CS.card('Processo simulado', f.el, h('button', { class: 'btn sm', style: 'margin-top:8px', onclick: () => { seed++; run(); } }, '🎲 nova amostragem')), CS.card('Resultados', out)), h('div', { class: 'col' }, CS.card('Carta X̄ (médias)', b1), CS.card('Carta R (amplitudes)', b2), CS.card('Histograma e especificação', b3))));
    const cX = new MS.Chart(b1, { xlabel: 'subgrupo', readout: (x, y) => `#${Math.round(x)}\n${K.n(y, 6)}` }), cR = new MS.Chart(b2, { xlabel: 'subgrupo', readout: (x, y) => `#${Math.round(x)}\n${K.n(y, 4)}` }), cH = new MS.Chart(b3, { xlabel: 'medida [mm]', ylabel: 'freq.', readout: (x, y) => `${K.n(x, 6)} mm` });
    function run() {
      const s = f.st, n = Math.max(2, Math.min(10, Math.round(s.n))), k = Math.max(5, Math.round(s.k)), R = rng(seed);
      const gauss = () => Math.sqrt(-2 * Math.log(R() + 1e-12)) * Math.cos(2 * Math.PI * R());
      const subs = []; for (let j = 0; j < k; j++) { const m = s.mu + (j + 1 >= s.at ? s.sh : 0); subs.push([...Array(n)].map(() => m + s.sg * gauss())); }
      const xb = subs.map(a => a.reduce((p, q) => p + q, 0) / n), rr = subs.map(a => Math.max(...a) - Math.min(...a));
      const Xbb = xb.reduce((p, q) => p + q, 0) / k, Rb = rr.reduce((p, q) => p + q, 0) / k;
      const UCL = Xbb + SPC.A2[n] * Rb, LCL = Xbb - SPC.A2[n] * Rb, sig = Rb / SPC.d2[n];
      const out1 = xb.map((v, i) => (v > UCL || v < LCL ? i : -1)).filter(i => i >= 0);
      let run7 = []; for (let i = 6; i < k; i++) { const sl = xb.slice(i - 6, i + 1); if (sl.every(v => v > Xbb) || sl.every(v => v < Xbb)) run7.push(i); }
      const idx = xb.map((_, i) => i + 1);
      cX.set({ series: [{ x: idx, y: xb, color: '#4fb3ff', width: 1.5 }], hlines: [{ y: Xbb, color: 'rgba(61,220,132,0.7)', label: 'X̿' }, { y: UCL, color: 'rgba(255,77,109,0.7)', label: 'LSC' }, { y: LCL, color: 'rgba(255,77,109,0.7)', label: 'LIC' }], markers: xb.map((v, i) => ({ x: i + 1, y: v, shape: 'dot', size: 4, color: out1.includes(i) ? '#ff4d6d' : run7.includes(i) ? '#ffd166' : '#4fb3ff' })) });
      cR.set({ series: [{ x: idx, y: rr, color: '#ff9f1c', width: 1.5 }], hlines: [{ y: Rb, color: 'rgba(61,220,132,0.7)', label: 'R̄' }, { y: SPC.D4[n] * Rb, color: 'rgba(255,77,109,0.7)', label: 'LSC' }, ...(SPC.D3[n] > 0 ? [{ y: SPC.D3[n] * Rb, color: 'rgba(255,77,109,0.7)', label: 'LIC' }] : [])], markers: rr.map((v, i) => ({ x: i + 1, y: v, shape: 'dot', size: 4, color: v > SPC.D4[n] * Rb ? '#ff4d6d' : '#ff9f1c' })) });
      const all = subs.flat(), lo = Math.min(...all, s.LIE), hi = Math.max(...all, s.LSE), nb = 20, w = (hi - lo) / nb;
      const cnt = Array(nb).fill(0); all.forEach(v => { cnt[Math.min(nb - 1, Math.floor((v - lo) / w))]++; });
      const hx = [], hy = []; cnt.forEach((c, i) => { hx.push(lo + i * w, lo + i * w, lo + (i + 1) * w, lo + (i + 1) * w); hy.push(0, c, c, 0); });
      const mAll = all.reduce((p, q) => p + q, 0) / all.length, xs = K.linspace(lo, hi, 200);
      cH.set({ series: [{ x: hx, y: hy, color: '#4fb3ff', width: 1.5 }, { x: xs, y: xs.map(x => all.length * w / (sig * Math.sqrt(2 * Math.PI)) * Math.exp(-0.5 * ((x - mAll) / sig) ** 2)), color: '#ffd166', width: 2, name: 'normal (σ̂)' }], vlines: [{ x: s.LIE, color: '#ff4d6d', label: 'LIE' }, { x: s.LSE, color: '#ff4d6d', label: 'LSE' }] });
      const Cp = (s.LSE - s.LIE) / (6 * sig), Cpk = Math.min(s.LSE - mAll, mAll - s.LIE) / (3 * sig), ppm = (Phi((s.LIE - mAll) / sig) + 1 - Phi((s.LSE - mAll) / sig)) * 1e6;
      out.innerHTML = '';
      out.append(CS.kv([['X̿ · R̄', `${K.n(Xbb, 6)} · ${K.n(R̄fmt(Rb), 4)} mm`], ['Limites carta X̄', `${K.n(LCL, 6)} a ${K.n(UCL, 6)} mm`], ['σ̂ = R̄/d₂', `${K.n(sig, 4)} mm`],
        ['C<sub>p</sub>', `${K.n(Cp, 3)}`], ['C<sub>pk</sub>', `<b class="${Cpk >= 1.33 ? 'good' : Cpk >= 1 ? 'warn' : 'bad'}">${K.n(Cpk, 3)}</b> ${Cpk >= 1.33 ? '(capaz)' : Cpk >= 1 ? '(marginal)' : '(incapaz)'}`], ['Fora da especificação (estimado)', `${K.n(ppm, 3)} ppm`],
        ['Pontos fora dos limites', out1.length ? `<span class="bad">subgrupos ${out1.map(i => i + 1).join(', ')}</span>` : '<span class="good">nenhum</span>'], ['7 seguidos do mesmo lado', run7.length ? `<span class="warn">a partir do subgrupo ${run7[0] - 5}</span>` : '<span class="good">não</span>'],
        ['Estado', out1.length || run7.length ? '<b class="bad">fora de controle estatístico: investigue a causa especial</b>' : '<b class="good">sob controle estatístico</b>']]));
    }
    const R̄fmt = v => v;
    run();
  }
  function secPaq(area) {
    const f = K.form([{ k: 'res', l: 'Resolução do paquímetro', type: 'sel', v: '0.05', opts: [['0.1', '0,1 mm (nônio de 10 divisões)'], ['0.05', '0,05 mm (nônio de 20 divisões)'], ['0.02', '0,02 mm (nônio de 50 divisões)']] }], () => novo(), { cols: 1 });
    const ans = h('input', { placeholder: 'sua leitura em mm', class: 'tf-input', style: 'max-width:180px' });
    const msg = h('div', { class: 'paq-msg' });
    const score = { ok: 0, tot: 0 }, sc = h('span', { class: 'muted small' });
    let M = 0, show = false;
    const card = CS.card('Paquímetro — leia a medida entre os bicos');
    area.append(h('div', { class: 'row gap wrap' }, f.el, h('button', { class: 'btn sm', onclick: () => novo() }, '↻ Nova medida'), ans, h('button', { class: 'btn sm run', onclick: () => check() }, 'Verificar'), h('button', { class: 'btn sm', onclick: () => { show = true; cv.redraw(); explain(); } }, 'Mostrar solução'), sc), card, msg);
    const cv = K.canvas(card, 260, null);
    ans.addEventListener('keydown', e => { if (e.key === 'Enter') check(); });
    function geom() { const r = +f.st.res, n = Math.round(1 / r), span = r === 0.1 ? 9 : r === 0.05 ? 39 : 49; return { r, n, d: span / n, span }; }
    function novo() { const { r } = geom(); M = Math.round((5 + Math.random() * 120) / r) * r; show = false; ans.value = ''; msg.innerHTML = ''; cv.redraw(); }
    function explain() { const { r, d } = geom(); const base = Math.floor(M + 1e-9), k = Math.round((M - base) / r); msg.innerHTML = `<b>Leitura = ${K.n(M, 6)} mm.</b> Escala principal antes do zero do nônio: <b>${base} mm</b>. Traço do nônio que coincide com um traço da escala principal: <b>${k}</b> → ${k} × ${r} = ${K.n(k * r, 4)} mm. Total: ${base} + ${K.n(k * r, 4)} = ${K.n(M, 6)} mm. (Cada divisão do nônio mede ${K.n(d, 4)} mm, ou seja, ${r} mm a menos que a da escala principal.)`; }
    function check() { const v = MS.parseEng(ans.value.replace(',', '.')); if (!isFinite(v)) return; const { r } = geom(); score.tot++; const ok = Math.abs(v - M) < r / 2; if (ok) score.ok++; sc.textContent = `acertos: ${score.ok}/${score.tot}`; msg.innerHTML = ok ? `<b class="good">Correto! ${K.n(M, 6)} mm.</b>` : `<b class="bad">Ainda não.</b> Dica: localize o traço do nônio perfeitamente alinhado com um traço da escala principal.`; if (!ok) { show = false; } }
    cv.draw = (g, W, H) => {
      const { r, n, d } = geom(), px = W / 70, x0 = M - 12, X = mm => (mm - x0) * px, yb = 120;
      g.fillStyle = '#c9ced6'; g.fillRect(0, yb - 70, W, 70);
      g.strokeStyle = '#1a1d22'; g.fillStyle = '#1a1d22'; g.font = '13px Barlow'; g.textAlign = 'center';
      for (let mm = Math.ceil(x0); mm < x0 + 70; mm++) { const x = X(mm), L = mm % 10 === 0 ? 30 : mm % 5 === 0 ? 22 : 14; g.beginPath(); g.moveTo(x, yb); g.lineTo(x, yb - L); g.lineWidth = 1; g.stroke(); if (mm % 10 === 0 && mm >= 0) g.fillText(String(mm / 10), x, yb - 36); }
      g.fillStyle = '#5a6270'; g.font = '10px Barlow'; g.fillText('cm', 20, yb - 52);
      g.fillStyle = '#e4e7ec'; g.fillRect(X(M) - 18, yb, n * d * px + 40, 62); g.strokeStyle = '#8a929e'; g.strokeRect(X(M) - 18, yb, n * d * px + 40, 62);
      g.fillStyle = '#1a1d22'; g.font = '12px Barlow';
      const step = r === 0.1 ? 1 : r === 0.05 ? 2 : 5;
      const kc = Math.round((M - Math.floor(M + 1e-9)) / r);
      for (let i = 0; i <= n; i++) { const x = X(M + i * d), L = i % step === 0 ? 24 : 14; g.strokeStyle = show && i === kc ? '#ff2d55' : '#1a1d22'; g.lineWidth = show && i === kc ? 2.5 : 1; g.beginPath(); g.moveTo(x, yb); g.lineTo(x, yb + L); g.stroke(); if (i % step === 0) { g.fillStyle = '#1a1d22'; g.fillText(String(i / step * (r === 0.02 ? 1 : 1)), x, yb + 40); } }
      if (show) { g.strokeStyle = '#ff2d55'; g.lineWidth = 2.5; const xm = X(Math.round(M + kc * d)); g.beginPath(); g.moveTo(xm, yb); g.lineTo(xm, yb - 20); g.stroke(); g.strokeStyle = '#0a84ff'; g.beginPath(); g.moveTo(X(M), yb - 66); g.lineTo(X(M), yb + 60); g.stroke(); }
      g.fillStyle = '#c3d3e8'; g.font = '11px Barlow'; g.textAlign = 'left'; g.fillText(`Nônio: ${n} divisões em ${n * d} mm → resolução ${r} mm. Números do nônio em décimos de mm.`, 8, H - 10);
      g.lineWidth = 1;
    };
    novo();
  }

  /* ════════════════ 3. MANUTENÇÃO E GESTÃO ════════════════ */
  const toolManut = (host, onClean) => {
    const { body } = CS.page(host, {
      title: 'Manutenção e Gestão', lead: 'Confiabilidade (Weibull), intervalo ótimo de manutenção preventiva, indicadores (MTBF, MTTR, disponibilidade, OEE) e análise de Pareto das falhas.',
      learn: `<p><b>Tipos de manutenção:</b> corretiva (após a falha), preventiva (por tempo ou uso), preditiva (pela condição: vibração, termografia, análise de óleo) e prescritiva. A <b>TPM</b> envolve a operação nos cuidados básicos; a <b>RCM</b> escolhe a estratégia pelo modo de falha.</p>
      <p><b>Weibull:</b> R(t) = e<sup>−(t/η)<sup>β</sup></sup>. O parâmetro de forma β indica a fase da <b>curva da banheira</b>: β &lt; 1 mortalidade infantil (taxa de falha cai), β = 1 falhas aleatórias (exponencial), β &gt; 1 desgaste (taxa cresce). <b>Só faz sentido trocar preventivamente quando β &gt; 1.</b></p>
      <p><b>Intervalo ótimo (substituição por idade):</b> minimiza o custo por hora C(T) = [C<sub>p</sub>·R(T) + C<sub>c</sub>·F(T)] / ∫₀ᵀR(t)dt.</p>
      <p><b>Indicadores:</b> MTBF = tempo em operação / nº de falhas; MTTR = tempo de reparo / nº de falhas; disponibilidade = MTBF/(MTBF + MTTR). <b>OEE</b> = Disponibilidade × Desempenho × Qualidade; o nível "classe mundial" é ≈ 85% (90% × 95% × 99,9%).</p>
      <p><b>Pareto (80/20):</b> poucas causas respondem pela maior parte das falhas. A classificação ABC prioriza onde agir primeiro.</p>
      <p><b>Confiabilidade de sistemas:</b> em série, R = ∏R<sub>i</sub> (o elo mais fraco domina); em paralelo (redundância), R = 1 − ∏(1 − R<sub>i</sub>).</p>`,
    });
    onClean(K.sections(body, 'manut', [{ id: 'weib', label: 'Confiabilidade (Weibull)', render: secWeib }, { id: 'oee', label: 'Indicadores e OEE', render: secOEE }, { id: 'par', label: 'Pareto / ABC', render: secPareto }]));
  };
  function secWeib(area) {
    const f = K.form([
      { k: 'b', l: 'Forma β', u: '', v: '2.5' }, { k: 'eta', l: 'Vida característica η', u: 'h', v: '5000' }, { k: 't', l: 'Tempo de missão', u: 'h', v: '1000' },
      { k: 'Cp', l: 'Custo da troca preventiva', u: 'R$', v: '500' }, { k: 'Cc', l: 'Custo da falha (corretiva)', u: 'R$', v: '4000' },
      { sep: 'Sistema com componentes iguais' }, { k: 'nc', l: 'Número de componentes', u: '', v: '3' },
    ], () => run(), { cols: 2 });
    const out = h('div'), b1 = CS.chartBox('sm'), b2 = CS.chartBox('sm'), b3 = CS.chartBox('sm');
    area.append(h('div', { class: 'grid2' }, h('div', { class: 'col' }, CS.card('Parâmetros', f.el), CS.card('Resultados', out)), h('div', { class: 'col' }, CS.card('Confiabilidade R(t) e probabilidade de falha F(t)', b1), CS.card('Taxa de falha λ(t)', b2), CS.card('Custo por hora × intervalo de troca T', b3))));
    const c1 = new MS.Chart(b1, { xlabel: 't [h]', yrange: [0, 1.02], readout: (x, y) => `t = ${K.n(x)} h\n${K.n(y, 3)}` }), c2 = new MS.Chart(b2, { xlabel: 't [h]', ylabel: 'falhas/h', readout: (x, y) => `t = ${K.n(x)} h\nλ = ${K.f(y, '/h', 3)}` }), c3 = new MS.Chart(b3, { xlabel: 'T [h]', ylabel: 'R$/h', readout: (x, y) => `T = ${K.n(x)} h\nR$ ${K.n(y, 3)}/h` });
    function run() {
      const { b, eta, t, Cp, Cc, nc } = f.st;
      const R = x => Math.exp(-Math.pow(x / eta, b)), lam = x => b / eta * Math.pow(x / eta, b - 1);
      const ts = K.linspace(0, eta * 2.5, 300), MTTF = eta * K.gamma(1 + 1 / b), B10 = eta * Math.pow(-Math.log(0.9), 1 / b);
      c1.set({ series: [{ x: ts, y: ts.map(R), color: '#3ddc84', width: 2, name: 'R(t)' }, { x: ts, y: ts.map(x => 1 - R(x)), color: '#ff4d6d', width: 2, name: 'F(t)' }], vlines: [{ x: t, color: 'rgba(255,209,102,0.6)', label: 'missão' }] });
      c2.set({ series: [{ x: ts.slice(1), y: ts.slice(1).map(lam), color: '#ff9f1c', width: 2 }] });
      const Ts = K.linspace(eta * 0.03, eta * 2.5, 250), cr = Ts.map(T => { const n = 200; let I = 0; for (let i = 0; i < n; i++) { const a = T * i / n, c = T * (i + 1) / n; I += (R(a) + R(c)) / 2 * (c - a); } return (Cp * R(T) + Cc * (1 - R(T))) / I; });
      const io = cr.reduce((bi, v, i) => (v < cr[bi] ? i : bi), 0), Tbest = Ts[io], runFail = Cc / MTTF;
      c3.set({ series: [{ x: Ts, y: cr, color: '#4fb3ff', width: 2, name: 'preventiva no intervalo T' }], hlines: [{ y: runFail, color: 'rgba(255,77,109,0.6)', label: 'só corretiva' }], markers: b > 1 ? [{ x: Tbest, y: cr[io], shape: 'dot', color: '#ffd166', size: 6, label: 'ótimo' }] : [] });
      const Rm = R(t);
      out.innerHTML = '';
      out.append(CS.kv([
        ['Fase da curva da banheira', b < 0.95 ? 'β &lt; 1: mortalidade infantil (falhas precoces)' : b <= 1.05 ? 'β ≈ 1: falhas aleatórias (taxa constante)' : 'β &gt; 1: desgaste (taxa crescente)'],
        ['MTTF = η·Γ(1 + 1/β)', `${K.n(MTTF)} h`], ['Vida B10 (10% falham)', `${K.n(B10)} h`], [`R(${t} h)`, `<b>${K.n(Rm * 100, 4)} %</b>`],
        [`Sistema em série (${nc}×)`, `${K.n(Math.pow(Rm, nc) * 100, 4)} %`], [`Sistema redundante em paralelo (${nc}×)`, `${K.n((1 - Math.pow(1 - Rm, nc)) * 100, 4)} %`],
        b > 1 ? ['Intervalo ótimo de troca preventiva', `<b class="good">${K.n(Tbest)} h</b> → R$ ${K.n(cr[io], 3)}/h (vs. R$ ${K.n(runFail, 3)}/h só com corretiva: economia de ${K.n((1 - cr[io] / runFail) * 100, 3)} %)`] : ['Preventiva por tempo', '<span class="warn">não compensa com β ≤ 1: trocar antes não reduz falhas. Prefira a preditiva ou a corretiva.</span>'],
      ]));
    }
    run();
  }
  function secOEE(area) {
    const f = K.form([
      { k: 'Tp', l: 'Tempo de produção planejado', u: 'h', v: '160' }, { k: 'Tpar', l: 'Paradas não planejadas (falhas, setup…)', u: 'h', v: '14' },
      { k: 'nf', l: 'Número de falhas no período', u: '', v: '6' }, { k: 'Tr', l: 'Tempo total de reparo', u: 'h', v: '9' },
      { k: 'ciclo', l: 'Tempo de ciclo ideal', u: 's/peça', v: '30' }, { k: 'prod', l: 'Peças produzidas', u: '', v: '15500' }, { k: 'boas', l: 'Peças boas', u: '', v: '15100' },
    ], () => run(), { cols: 2 });
    const out = h('div'), bars = h('div', { class: 'oee-bars' });
    area.append(h('div', { class: 'grid2' }, h('div', { class: 'col' }, CS.card('Dados do período', f.el), CS.card('Indicadores de manutenção', out)), CS.card('OEE — eficiência global do equipamento', bars)));
    function run() {
      const s = f.st, Top = s.Tp - s.Tpar, D = Top / s.Tp, P = Math.min(1, s.ciclo * s.prod / 3600 / Top), Q = s.boas / s.prod, OEE = D * P * Q;
      const MTBF = Top / Math.max(1, s.nf), MTTR = s.Tr / Math.max(1, s.nf);
      out.innerHTML = '';
      out.append(CS.kv([['Tempo em operação', `${K.n(Top)} h`], ['MTBF', `${K.n(MTBF)} h`], ['MTTR', `${K.n(MTTR)} h`], ['Disponibilidade inerente MTBF/(MTBF + MTTR)', `${K.n(MTBF / (MTBF + MTTR) * 100, 4)} %`], ['Perda de produção por qualidade', `${s.prod - s.boas} peças`]]));
      bars.innerHTML = '';
      const row = (name, v, wc, note) => bars.append(h('div', { class: 'oee-row' }, h('div', { class: 'oee-name' }, name), h('div', { class: 'hbar' }, h('div', { class: 'hbar-fill', style: `width:${v * 100}%;background:${v >= wc ? '#3ddc84' : v >= wc - 0.15 ? '#ffd166' : '#ff4d6d'}` }), h('div', { class: 'hbar-mark', style: `left:${wc * 100}%`, title: 'classe mundial' })), h('div', { class: 'oee-val' }, K.n(v * 100, 3) + ' %'), h('div', { class: 'muted small oee-note' }, note)));
      row('Disponibilidade', D, 0.9, 'tempo operando / tempo planejado');
      row('Desempenho', P, 0.95, 'produção real / produção no ciclo ideal');
      row('Qualidade', Q, 0.999, 'peças boas / produzidas');
      row('OEE', OEE, 0.85, 'D × P × Q');
      bars.append(h('div', { class: 'muted small' }, 'Marcador branco: referência "classe mundial" (D 90% · P 95% · Q 99,9% · OEE 85%).'));
    }
    run();
  }
  function secPareto(area) {
    let items = [['Vazamento hidráulico', 31], ['Rolamento danificado', 23], ['Correia rompida', 15], ['Lubrificação insuficiente', 12], ['Falha elétrica no motor', 9], ['Desalinhamento', 7], ['Sensor com defeito', 5], ['Outros', 4]];
    const tbl = h('div'), cvCard = CS.card('Diagrama de Pareto'), res = h('div');
    area.append(h('div', { class: 'grid2' }, CS.card('Causas de falha (edite à vontade)', tbl), h('div', { class: 'col' }, cvCard, CS.card('Classificação ABC', res))));
    const cv = K.canvas(cvCard, 300, null);
    const renderTbl = () => {
      tbl.innerHTML = '';
      items.forEach((it, i) => {
        const a = h('input', { value: it[0] }), b = h('input', { value: it[1], class: 'sm' });
        a.addEventListener('change', () => { it[0] = a.value; run(); }); b.addEventListener('change', () => { const v = MS.parseEng(b.value); if (v >= 0) { it[1] = v; run(); } });
        tbl.append(h('div', { class: 'load-row' }, a, b, h('button', { class: 'btn icon sm danger', onclick: () => { items.splice(i, 1); renderTbl(); run(); } }, '✕')));
      });
      tbl.append(h('button', { class: 'btn sm', onclick: () => { items.push(['Nova causa', 1]); renderTbl(); run(); } }, '+ causa'));
    };
    function run() {
      const s = items.slice().sort((a, b) => b[1] - a[1]), tot = s.reduce((p, q) => p + q[1], 0) || 1;
      let acc = 0; const rows = s.map(([n, v]) => { acc += v; const pc = acc / tot; return [n, v, pc, pc <= 0.8 + 1e-9 ? 'A' : pc <= 0.95 + 1e-9 ? 'B' : 'C']; });
      res.innerHTML = ''; res.append(K.table(['Causa', 'Ocorr.', '% acum.', 'Classe'], rows.map(r => [r[0], r[1], K.n(r[2] * 100, 3) + ' %', `<b class="${r[3] === 'A' ? 'bad' : r[3] === 'B' ? 'warn' : 'good'}">${r[3]}</b>`])));
      cv.draw = (g, W, H) => {
        const L = 40, R = W - 40, T = 16, B = H - 70, n = rows.length, bw = (R - L) / n, mx = rows[0] ? rows[0][1] : 1;
        g.strokeStyle = '#1e3355'; g.strokeRect(L, T, R - L, B - T);
        rows.forEach((r, i) => { const x = L + i * bw, hgt = (B - T) * r[1] / mx; g.fillStyle = r[3] === 'A' ? '#ff4d6d' : r[3] === 'B' ? '#ffd166' : '#3ddc84'; g.globalAlpha = 0.75; g.fillRect(x + 4, B - hgt, bw - 8, hgt); g.globalAlpha = 1; g.save(); g.translate(x + bw / 2, B + 6); g.rotate(-0.6); g.fillStyle = '#c3d3e8'; g.font = '10px Barlow'; g.textAlign = 'right'; g.fillText(r[0].slice(0, 22), 0, 6); g.restore(); g.fillStyle = '#e8f4ff'; g.font = '10px Share Tech Mono'; g.textAlign = 'center'; g.fillText(String(r[1]), x + bw / 2, B - hgt - 4); });
        g.strokeStyle = '#4fb3ff'; g.lineWidth = 2; g.beginPath(); rows.forEach((r, i) => { const x = L + (i + 0.5) * bw, y = B - (B - T) * r[2]; i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke();
        rows.forEach((r, i) => { g.fillStyle = '#4fb3ff'; g.beginPath(); g.arc(L + (i + 0.5) * bw, B - (B - T) * r[2], 3, 0, 7); g.fill(); });
        g.strokeStyle = 'rgba(255,209,102,0.6)'; g.setLineDash([5, 4]); g.lineWidth = 1; const y80 = B - (B - T) * 0.8; g.beginPath(); g.moveTo(L, y80); g.lineTo(R, y80); g.stroke(); g.setLineDash([]);
        g.fillStyle = '#ffd166'; g.font = '10px Barlow'; g.textAlign = 'left'; g.fillText('80 %', R + 4, y80 + 3); g.fillStyle = '#4fb3ff'; g.fillText('100 %', R + 4, T + 4);
      };
      cv.redraw();
    }
    renderTbl(); run();
  }

  CS.registerTab('fab', {
    title: 'Fabricação, Controle e Gestão Industrial',
    tools: [
      { id: 'usin', label: 'Processos de Fabricação', desc: 'usinagem, Taylor, custo', render: toolUsin },
      { id: 'metro', label: 'Metrologia e Controle', desc: 'ISO 286, CEP, paquímetro', render: toolMetro },
      { id: 'manut', label: 'Manutenção e Gestão', desc: 'Weibull, OEE, Pareto', render: toolManut },
    ],
  });
})();
