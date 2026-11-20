/* ============================================================
   MeControlEng — Elétrica › Instalações Elétricas
   Dimensionamento de condutores · Normas Técnicas e Segurança ·
   Dispositivos de Proteção e Aterramento · Projeto, Infraestrutura e
   Execução · Aplicações Especiais e Tendências
   ============================================================ */
'use strict';
(function () {
  const CS = MS.CS, h = CS.h, K = MS.MK;
  const E = MS.EL = MS.EL || {};
  const NOTE = 'Valores de referência para estudo e pré-dimensionamento. O projeto real deve seguir o texto vigente da norma e as exigências da concessionária.';

  /* ───────── tabelas NBR 5410 (cobre, referência) ───────── */
  E.SEC = [1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120, 150, 185, 240];
  // Tabela 36 (PVC 70 °C, cobre, 30 °C ar / 20 °C solo): [2 condutores carregados, 3 carregados]
  E.IZ = {
    A1: [[14.5, 19.5, 26, 34, 46, 61, 80, 99, 119, 151, 182, 210, 240, 273, 321], [13.5, 18, 24, 31, 42, 56, 73, 89, 108, 136, 164, 188, 216, 245, 286]],
    B1: [[17.5, 24, 32, 41, 57, 76, 101, 125, 151, 192, 232, 269, 309, 353, 415], [15.5, 21, 28, 36, 50, 68, 89, 110, 134, 171, 207, 239, 275, 314, 370]],
    B2: [[16.5, 23, 30, 38, 52, 69, 90, 111, 133, 168, 201, 232, 258, 294, 344], [15, 20, 27, 34, 46, 62, 80, 99, 118, 149, 179, 206, 225, 255, 297]],
    C: [[19.5, 27, 36, 46, 63, 85, 112, 138, 168, 213, 258, 299, 344, 392, 461], [17.5, 24, 32, 41, 57, 76, 96, 119, 144, 184, 223, 259, 299, 341, 403]],
    D: [[22, 29, 38, 47, 63, 81, 104, 125, 148, 183, 216, 246, 278, 312, 361], [18, 24, 31, 39, 52, 67, 86, 103, 122, 151, 179, 203, 230, 258, 297]],
  };
  E.METODOS = [['B1', 'B1 — condutores isolados em eletroduto embutido em alvenaria'], ['B2', 'B2 — cabo multipolar em eletroduto embutido'], ['A1', 'A1 — eletroduto em parede termicamente isolante'], ['C', 'C — cabo fixado diretamente na parede'], ['D', 'D — cabo em eletroduto enterrado']];
  const FT = { pvc: { 10: 1.22, 15: 1.17, 20: 1.12, 25: 1.06, 30: 1, 35: 0.94, 40: 0.87, 45: 0.79, 50: 0.71, 55: 0.61, 60: 0.5 }, xlpe: { 10: 1.15, 15: 1.12, 20: 1.08, 25: 1.04, 30: 1, 35: 0.96, 40: 0.91, 45: 0.87, 50: 0.82, 55: 0.76, 60: 0.71 } };
  const FA = [1, 1, 0.8, 0.7, 0.65, 0.6, 0.57, 0.54, 0.52, 0.5, 0.5, 0.5, 0.45, 0.45, 0.45, 0.45, 0.41, 0.41, 0.41, 0.41, 0.38];
  E.DISJ = [6, 10, 13, 16, 20, 25, 32, 40, 50, 63, 70, 80, 100, 125, 150, 175, 200, 225, 250, 300, 400];
  E.SIST = { fn127: ['Monofásico F-N 127 V', 127, 1], fn220: ['Monofásico F-N 220 V', 220, 1], ff220: ['Bifásico F-F 220 V', 220, 1], '3f220': ['Trifásico 220 V', 220, 3], '3f380': ['Trifásico 380 V', 380, 3] };
  const ftOf = (iso, T) => { const t = FT[iso], ks = Object.keys(t).map(Number); const k = ks.reduce((a, b) => (Math.abs(b - T) < Math.abs(a - T) ? b : a)); return t[k]; };
  /* dimensionamento completo (capacidade, queda de tensão, mínimos e coordenação com o disjuntor) */
  E.dimensionar = function (o) {
    const [, V, fases] = E.SIST[o.sist];
    const IB = fases === 3 ? o.P / (Math.sqrt(3) * V * o.fp) : o.P / (V * o.fp);
    const ft = ftOf(o.iso, o.T), fa = FA[Math.min(20, Math.max(1, Math.round(o.n)))];
    const fXL = o.iso === 'xlpe' ? 1.24 : 1;
    const col = E.IZ[o.met][fases === 3 ? 1 : 0];
    const smin = o.tipo === 'ilum' ? 1.5 : 2.5;
    const rho = 0.0225, kq = fases === 3 ? Math.sqrt(3) : 2;
    const rows = E.SEC.map((S, i) => {
      const Iz = col[i] * fXL * ft * fa;
      const dv = kq * rho * o.L * IB * o.fp / S / V * 100;
      const In = E.DISJ.find(x => x >= IB && x <= Iz);
      return { S, Itab: col[i] * fXL, Iz, dv, In, okI: Iz >= IB, okV: dv <= o.dvmax, okMin: S >= smin };
    });
    const iCap = rows.findIndex(r => r.okI), iV = rows.findIndex(r => r.okV), iMin = rows.findIndex(r => r.okMin);
    const iOk = rows.findIndex(r => r.okI && r.okV && r.okMin && r.In);
    const S = iOk >= 0 ? rows[iOk] : null;
    const pe = S ? (S.S <= 16 ? S.S : S.S <= 35 ? 16 : S.S / 2) : null;
    return { IB, ft, fa, rows, iCap, iV, iMin, iOk, S, pe, V, fases };
  };

  /* ════════════════ 1. DIMENSIONAMENTO DE CONDUTORES ════════════════ */
  const toolCond = (host) => {
    const { body } = CS.page(host, {
      title: 'Dimensionamento de condutores (NBR 5410)', lead: 'Seção do condutor por <b>capacidade de corrente</b>, <b>queda de tensão</b> e <b>seção mínima</b>, coordenada com o disjuntor (I<sub>B</sub> ≤ I<sub>n</sub> ≤ I<sub>z</sub>).',
      learn: `<p><b>Roteiro da NBR 5410:</b></p><ol>
      <li><b>Corrente de projeto</b> I<sub>B</sub> = P/(V·cosφ), ou P/(√3·V·cosφ) no trifásico.</li>
      <li><b>Capacidade de condução</b> (Tabelas 36–39), conforme o <i>método de instalação</i> (B1, B2, C, D…) e o número de condutores carregados.</li>
      <li><b>Fatores de correção:</b> temperatura (Tabela 40) e agrupamento de circuitos (Tabela 42). I<sub>z</sub> = I<sub>tab</sub>·f<sub>t</sub>·f<sub>a</sub>.</li>
      <li><b>Seção mínima:</b> 1,5 mm² em iluminação e 2,5 mm² em tomadas e força (cobre).</li>
      <li><b>Queda de tensão:</b> ΔV% = k·ρ·L·I·cosφ/(S·V), com k = 2 (mono) ou √3 (tri). Limite de 4% nos circuitos terminais (7% total, a partir do transformador próprio).</li>
      <li><b>Proteção:</b> I<sub>B</sub> ≤ I<sub>n</sub> ≤ I<sub>z</sub> e I₂ ≤ 1,45·I<sub>z</sub> (atendida pelos disjuntores IEC 60898).</li></ol>
      <p><b>Condutor de proteção (PE):</b> S ≤ 16 mm² → igual à fase; 16 &lt; S ≤ 35 → 16 mm²; S &gt; 35 → S/2.</p>
      <p><b>Cores usuais:</b> neutro azul-claro; PE verde-amarelo (ou verde); fases em outras cores (preto, vermelho, branco…).</p>
      <p class="muted">${NOTE} Para EPR/XLPE (90 °C) foi usado um fator aproximado de 1,24 sobre a tabela do PVC.</p>`,
    });
    const f = K.form([
      { k: 'sist', l: 'Sistema', type: 'sel', v: 'fn220', opts: Object.entries(E.SIST).map(([k, v]) => [k, v[0]]) },
      { k: 'tipo', l: 'Tipo de circuito', type: 'sel', v: 'forca', opts: [['ilum', 'Iluminação (mín. 1,5 mm²)'], ['forca', 'Tomadas / força (mín. 2,5 mm²)']] },
      { k: 'P', l: 'Potência da carga', u: 'W', v: '5400' }, { k: 'fp', l: 'Fator de potência', u: '', v: '1' },
      { k: 'met', l: 'Método de instalação', type: 'sel', v: 'B1', opts: E.METODOS }, { k: 'iso', l: 'Isolação', type: 'sel', v: 'pvc', opts: [['pvc', 'PVC 70 °C'], ['xlpe', 'EPR / XLPE 90 °C']] },
      { k: 'T', l: 'Temperatura ambiente', u: '°C', v: '30' }, { k: 'n', l: 'Circuitos agrupados (no mesmo eletroduto)', u: '', v: '2' },
      { k: 'L', l: 'Comprimento do circuito', u: 'm', v: '25' }, { k: 'dvmax', l: 'Queda de tensão máxima', u: '%', v: '4' },
    ], () => run(), { cols: 2 });
    const out = h('div'), tb = h('div');
    body.append(h('div', { class: 'grid2' }, CS.card('Circuito', f.el), CS.card('Resultado', out)), CS.card('Tabela de verificação (a linha verde é a seção adotada)', tb));
    function run() {
      const r = E.dimensionar(f.st);
      out.innerHTML = ''; tb.innerHTML = '';
      const sec = i => (i >= 0 ? `${E.SEC[i]} mm²` : '—');
      out.append(CS.kv([
        ['Corrente de projeto I<sub>B</sub>', `<b>${K.n(r.IB)} A</b>`], ['Fatores f<sub>t</sub> · f<sub>a</sub>', `${r.ft} · ${r.fa}`],
        ['Seção por capacidade de corrente', sec(r.iCap)], ['Seção por queda de tensão', sec(r.iV)], ['Seção mínima', sec(r.iMin)],
        ['<b>Seção adotada (fase)</b>', r.S ? `<b class="good">${r.S.S} mm²</b>` : '<b class="bad">nenhuma seção da tabela atende</b>'],
        r.S ? ['Disjuntor', `<b>${r.S.In} A</b> (I<sub>B</sub> ${K.n(r.IB)} ≤ I<sub>n</sub> ${r.S.In} ≤ I<sub>z</sub> ${K.n(r.S.Iz)} A) — curva ${f.st.tipo === 'ilum' || f.st.fp === 1 ? 'B (cargas resistivas)' : 'C (motores e cargas indutivas)'}`] : null,
        r.S ? ['Queda de tensão', `${K.n(r.S.dv, 3)} % (${K.n(r.S.dv / 100 * r.V, 3)} V)`] : null,
        r.S ? ['Neutro · proteção (PE)', `${f.st.sist.startsWith('fn') ? r.S.S + ' mm²' : r.fases === 3 ? r.S.S + ' mm² (se houver)' : '— (F-F)'} · ${r.pe} mm²`] : null,
      ]));
      tb.append(K.table(['Seção', 'I<sub>tab</sub> [A]', 'I<sub>z</sub> corrigida [A]', 'Disjuntor possível', 'ΔV [%]', 'Capacidade', 'Queda', 'Mínimo'], r.rows.slice(0, 11).map((x, i) => [x.S + ' mm²', K.n(x.Itab, 3), K.n(x.Iz, 3), x.In ? x.In + ' A' : '—', K.n(x.dv, 3), x.okI ? '✓' : '✗', x.okV ? '✓' : '✗', x.okMin ? '✓' : '✗'])));
      if (r.iOk >= 0 && r.iOk < 11) tb.querySelectorAll('tr')[r.iOk + 1].classList.add('row-ok');
    }
    run();
  };

  /* ════════════════ 2. NORMAS TÉCNICAS E SEGURANÇA ════════════════ */
  const NORMAS = [
    ['NBR 5410', 'Instalações elétricas de baixa tensão', 'Instalações até 1 000 V CA / 1 500 V CC: residenciais, comerciais e industriais.', ['Proteção contra choques (seccionamento automático, DR de 30 mA em áreas molhadas e tomadas externas)', 'Dimensionamento de condutores (capacidade, queda de tensão, seções mínimas)', 'Previsão mínima de cargas de iluminação e tomadas', 'Esquemas de aterramento TN, TT e IT; equipotencialização', 'Proteção contra sobretensões (DPS) e verificação final (ensaios)']],
    ['NBR 14039', 'Instalações elétricas de média tensão (1,0 a 36,2 kV)', 'Subestações e instalações de consumidores em MT.', ['Proteção, seccionamento e comando em MT', 'Subestação abrigada ou ao tempo, cabine de medição', 'Distâncias de segurança e espaços de manobra', 'Aterramento de subestações e coordenação de proteção']],
    ['NBR 5419 (partes 1 a 4)', 'Proteção contra descargas atmosféricas', 'Edificações e estruturas; versão de 2015 alinhada à IEC 62305.', ['Parte 1: princípios gerais · Parte 2: gerenciamento de risco', 'Parte 3: danos físicos e perigo à vida (SPDA externo: captação, descidas, aterramento)', 'Parte 4: sistemas elétricos e eletrônicos internos (MPS, DPS coordenados)', 'Métodos de captação: esfera rolante, ângulo de proteção e malhas', 'Classes de proteção I a IV conforme o risco']],
    ['NBR 5418 → NBR IEC 60079', 'Instalações em atmosferas explosivas', 'A NBR 5418 (histórica) foi substituída pela série ABNT NBR IEC 60079.', ['Classificação de áreas por zonas (0, 1, 2 gases; 20, 21, 22 poeiras)', 'Tipos de proteção: à prova de explosão (Ex d), segurança aumentada (Ex e), intrinsecamente seguro (Ex i)…', 'Grupos de gases e classes de temperatura (T1 a T6)', 'Equipamentos certificados (INMETRO) e inspeção periódica']],
    ['NBR 14136', 'Plugues e tomadas para uso doméstico (padrão brasileiro)', 'Plugues e tomadas até 20 A / 250 V.', ['Tomadas de 10 A (pinos de 4,0 mm) e 20 A (pinos de 4,8 mm)', 'Rebaixo de proteção contra contato acidental com os pinos energizados', 'Pino central de aterramento (2P+T)', 'Tomada de 20 A aceita plugue de 10 A, mas não o contrário']],
    ['NR-10', 'Segurança em instalações e serviços em eletricidade', 'Norma regulamentadora (Ministério do Trabalho).', ['Prontuário das instalações (acima de 75 kW)', 'Desenergização: seccionamento, impedimento de reenergização, constatação da ausência de tensão, aterramento temporário, proteção dos elementos energizados e sinalização', 'Zonas de risco e controlada (Anexo II)', 'Treinamento obrigatório (básico e SEP) e trabalhador autorizado']],
    ['NBR 16690', 'Instalações elétricas de arranjos fotovoltaicos', 'Lado CC de sistemas fotovoltaicos.', ['Dimensionamento de strings e cabos CC', 'Proteção contra sobrecorrente e sobretensão no lado CC', 'Seccionamento e aterramento do arranjo']],
    ['NBR 17019', 'Instalações para recarga de veículos elétricos', 'Requisitos para pontos de recarga em BT (2022).', ['Circuito exclusivo por ponto de recarga', 'DR tipo A + detecção de corrente CC ≥ 6 mA (ou DR tipo B)', 'Modos de recarga e capacidade da instalação']],
    ['NBR ISO/CIE 8995-1', 'Iluminação de ambientes de trabalho', 'Substituiu a antiga NBR 5413.', ['Iluminância mantida por tarefa (ex.: escritório 500 lx, circulação 100 lx)', 'Uniformidade, ofuscamento (UGR) e reprodução de cor (Ra)']],
    ['NBR IEC 61439', 'Conjuntos de manobra e comando de baixa tensão', 'Quadros elétricos.', ['Verificação de projeto (elevação de temperatura, curto-circuito)', 'Ensaios de rotina e formas de separação']],
    ['NBR 13534', 'Instalações em estabelecimentos assistenciais de saúde', 'Hospitais e clínicas.', ['Grupos de locais médicos (0, 1, 2)', 'Esquema IT médico com supervisão de isolamento', 'Fontes de segurança (tempo de comutação)']],
    ['NBR 15749 / 15751', 'Aterramento: medição e malhas de subestações', 'Medição de resistência de aterramento e dimensionamento de malhas.', ['Método da queda de potencial (62%)', 'Tensões de passo e de toque toleráveis', 'Resistividade do solo (método de Wenner)']],
  ];
  const NR10 = [[1, 0.20, 0.70], [3, 0.22, 1.22], [6, 0.25, 1.25], [10, 0.35, 1.35], [15, 0.38, 1.38], [20, 0.40, 1.40], [30, 0.56, 1.56], [36, 0.58, 1.58], [45, 0.63, 1.63], [60, 0.83, 1.83], [70, 0.90, 1.90], [110, 1.00, 2.00], [132, 1.10, 3.10], [150, 1.20, 3.20], [220, 1.60, 3.60], [275, 1.80, 3.80], [380, 2.50, 4.50], [480, 3.20, 5.20], [700, 5.20, 7.20]];
  const toolNormas = (host, onClean) => {
    const { body } = CS.page(host, {
      title: 'Normas Técnicas e Segurança', lead: 'Guia das principais normas (NBR 5410, 14039, 5419, 5418/IEC 60079, 14136, NR-10…), efeitos do choque elétrico, distâncias de segurança da NR-10 e graus de proteção IP.',
      learn: `<p><b>Por que normas?</b> Elas consolidam o conhecimento técnico para garantir segurança, desempenho e compatibilidade. No Brasil, as normas ABNT são de referência, e as <b>NRs</b> (Normas Regulamentadoras) são de cumprimento obrigatório por lei.</p>
      <p><b>Choque elétrico:</b> o perigo vem da <b>corrente</b> pelo corpo e do <b>tempo</b> de exposição. A corrente depende da tensão de contato e da resistência do corpo (de ~500 Ω molhado a alguns kΩ seco). A IEC 60479-1 define zonas: AC-1 (percepção), AC-2 (sem efeitos fisiológicos perigosos), AC-3 (contrações, dificuldade respiratória, sem fibrilação), AC-4 (risco de fibrilação ventricular).</p>
      <p><b>Tensão de contato limite</b> (NBR 5410): 50 V CA em situação normal e 25 V em locais molhados.</p>
      <p><b>Hierarquia de medidas:</b> eliminar o risco (desenergizar) → proteção coletiva (barreiras, DR, aterramento) → procedimentos → EPIs.</p>
      <p class="muted">Resumo didático: consulte sempre o texto oficial vigente.</p>`,
    });
    onClean(K.sections(body, 'normas', [
      { id: 'lista', label: 'Normas', render: secNormas },
      { id: 'choque', label: 'Choque elétrico (IEC 60479)', render: secChoque },
      { id: 'nr10', label: 'Distâncias NR-10', render: secNR10 },
      { id: 'ip', label: 'Grau de proteção IP', render: secIP },
    ]));
  };
  function secNormas(area) {
    const q = h('input', { placeholder: 'buscar (ex.: DR, aterramento, fotovoltaico…)', class: 'tf-input', style: 'max-width:360px' });
    const grid = h('div', { class: 'norm-grid' });
    area.append(q, grid);
    const render = () => {
      const s = q.value.toLowerCase(); grid.innerHTML = '';
      for (const [cod, tit, esc, pts] of NORMAS) {
        if (s && !(cod + tit + esc + pts.join(' ')).toLowerCase().includes(s)) continue;
        grid.append(h('div', { class: 'card norm' }, h('div', { class: 'norm-cod' }, cod), h('div', { class: 'norm-tit' }, tit), h('div', { class: 'muted small' }, esc), h('ul', {}, ...pts.map(p => h('li', {}, p)))));
      }
    };
    q.addEventListener('input', render); render();
  }
  const C1 = [[10, 500], [100, 400], [300, 180], [500, 100], [1000, 50], [3000, 40], [10000, 40]];
  const BB = [[10, 200], [20, 100], [50, 40], [100, 25], [200, 17], [500, 11], [1000, 10], [10000, 10]];
  const interp = (pts, t) => { if (t <= pts[0][0]) return pts[0][1]; for (let i = 1; i < pts.length; i++) if (t <= pts[i][0]) { const [t0, i0] = pts[i - 1], [t1, i1] = pts[i]; const f = Math.log(t / t0) / Math.log(t1 / t0); return Math.exp(Math.log(i0) + f * Math.log(i1 / i0)); } return pts[pts.length - 1][1]; };
  E.zona60479 = (mA, ms) => (mA < 0.5 ? ['AC-1', 'percepção possível, sem reação'] : mA < interp(BB, ms) ? ['AC-2', 'percepção e contrações involuntárias leves; geralmente sem efeitos perigosos'] : mA < interp(C1, ms) ? ['AC-3', 'contrações musculares fortes, dificuldade de respirar, possível "não largar"; efeitos geralmente reversíveis'] : ['AC-4', 'RISCO DE FIBRILAÇÃO VENTRICULAR, parada respiratória e queimaduras']);
  function secChoque(area) {
    const f = K.form([{ k: 'V', l: 'Tensão de contato', u: 'V', v: '127' }, { k: 'R', l: 'Resistência do corpo', type: 'sel', v: '1000', opts: [['500', 'molhado (~500 Ω)'], ['1000', 'pele úmida (~1 kΩ)'], ['2000', 'pele seca (~2 kΩ)']] }, { k: 't', l: 'Tempo de exposição', u: 'ms', v: '500' }], () => run(), { cols: 1 });
    const out = h('div'), cb = CS.chartBox('tall');
    area.append(h('div', { class: 'grid2' }, h('div', { class: 'col' }, CS.card('Situação', f.el), CS.card('Efeito provável', out)), CS.card('Zonas tempo × corrente (CA 50/60 Hz, mão-pés) — aproximado', cb)));
    const ch = new MS.Chart(cb, { xlog: true, ylog: true, xlabel: 'corrente pelo corpo [mA]', ylabel: 'tempo [ms]', xrange: [0.1, 10000], yrange: [10, 10000], readout: (x, y) => { const z = E.zona60479(x, y); return `${K.n(x)} mA · ${K.n(y)} ms\nzona ${z[0]}`; } });
    function run() {
      const I = f.st.V / +f.st.R * 1000, t = f.st.t, z = E.zona60479(I, t);
      const ts = CS.logspace(10, 10000, 60);
      ch.set({ regions: [], series: [
        { x: [0.5, 0.5], y: [10, 10000], color: '#3ddc84', width: 1.5, name: 'a' }, { x: ts.map(t2 => interp(BB, t2)), y: ts, color: '#ffd166', width: 1.5, name: 'b' }, { x: ts.map(t2 => interp(C1, t2)), y: ts, color: '#ff4d6d', width: 2, name: 'c1 (limiar de fibrilação)' },
      ], texts: [{ x: 0.15, y: 3000, text: 'AC-1', color: '#3ddc84' }, { x: 2, y: 3000, text: 'AC-2', color: '#9fe8c0' }, { x: 18, y: 3000, text: 'AC-3', color: '#ffd166' }, { x: 300, y: 3000, text: 'AC-4', color: '#ff4d6d' }],
      markers: [{ x: Math.max(0.11, I), y: t, shape: 'dot', color: '#fff', size: 7, label: `${K.n(I, 3)} mA` }] });
      out.innerHTML = '';
      out.append(CS.kv([['Corrente I = V/R', `<b>${K.n(I, 3)} mA</b>`], ['Zona', `<b class="${z[0] === 'AC-4' ? 'bad' : z[0] === 'AC-3' ? 'warn' : 'good'}">${z[0]}</b>`], ['Efeitos', z[1]], ['Com DR de 30 mA', I >= 30 ? 'o DR desliga em ≤ 40 ms (a 5·IΔn) a 300 ms (a IΔn), o que reduz muito o risco' : 'corrente abaixo de 30 mA: o DR pode não atuar']]));
    }
    run();
  }
  function secNR10(area) {
    const f = K.form([{ k: 'kV', l: 'Tensão nominal da instalação', u: 'kV', v: '13.8' }], () => run(), { cols: 1 });
    const out = h('div'), cvc = CS.card('Zonas em torno do ponto energizado (vista em planta, sem escala)');
    area.append(h('div', { class: 'grid2' }, h('div', { class: 'col' }, CS.card('Dados', f.el), CS.card('Distâncias (NR-10, Anexo II)', out), CS.card('Tabela', K.table(['Tensão (kV) até', 'R<sub>r</sub> zona de risco [m]', 'R<sub>c</sub> zona controlada [m]'], NR10.map(r => ['&lt; ' + r[0], r[1].toFixed(2), r[2].toFixed(2)])))), cvc));
    const cv = K.canvas(cvc, 380, null);
    function run() {
      const row = NR10.find(r => f.st.kV < r[0]) || NR10[NR10.length - 1];
      out.innerHTML = '';
      out.append(CS.kv([['Raio da zona de risco R<sub>r</sub>', `<b class="bad">${row[1].toFixed(2)} m</b> — só profissionais autorizados, com técnicas e EPIs para trabalho energizado`], ['Raio da zona controlada R<sub>c</sub>', `<b class="warn">${row[2].toFixed(2)} m</b> — só profissionais autorizados`], ['Zona livre', `além de ${row[2].toFixed(2)} m`]]));
      cv.draw = (g, W, H) => {
        const cx = W / 2, cy = H / 2, s = Math.min(W, H) / 2 / (row[2] * 1.25);
        g.fillStyle = 'rgba(255,209,102,0.15)'; g.beginPath(); g.arc(cx, cy, row[2] * s, 0, 7); g.fill(); g.strokeStyle = '#ffd166'; g.stroke();
        g.fillStyle = 'rgba(255,77,109,0.25)'; g.beginPath(); g.arc(cx, cy, row[1] * s, 0, 7); g.fill(); g.strokeStyle = '#ff4d6d'; g.stroke();
        g.fillStyle = '#ff4d6d'; g.beginPath(); g.arc(cx, cy, 5, 0, 7); g.fill();
        g.fillStyle = '#c3d3e8'; g.font = '12px Barlow'; g.textAlign = 'center'; g.fillText('ponto energizado', cx, cy - 10);
        g.fillStyle = '#ff4d6d'; g.fillText(`zona de risco (${row[1]} m)`, cx, cy + row[1] * s - 6); g.fillStyle = '#ffd166'; g.fillText(`zona controlada (${row[2]} m)`, cx, cy + row[2] * s - 6);
        g.fillStyle = '#3ddc84'; g.fillText('zona livre', cx, cy + row[2] * s + 18);
      };
      cv.redraw();
    }
    run();
  }
  const IP1 = ['não protegido', 'objetos ≥ 50 mm (mão)', 'objetos ≥ 12,5 mm (dedo)', 'objetos ≥ 2,5 mm (ferramentas)', 'objetos ≥ 1 mm (fios)', 'protegido contra poeira (entrada limitada)', 'totalmente estanque à poeira'];
  const IP2 = ['não protegido', 'gotas verticais', 'gotas com inclinação de até 15°', 'aspersão de água (chuva, até 60°)', 'projeções de água de qualquer direção', 'jatos de água', 'jatos potentes', 'imersão temporária (até 1 m)', 'imersão contínua (> 1 m)', 'jatos de alta pressão e temperatura (9K)'];
  function secIP(area) {
    const f = K.form([{ k: 'a', l: '1º dígito (sólidos)', type: 'sel', v: '5', opts: IP1.map((t, i) => [String(i), `${i} — ${t}`]) }, { k: 'b', l: '2º dígito (líquidos)', type: 'sel', v: '4', opts: IP2.map((t, i) => [String(i), `${i} — ${t}`]) }], () => run(), { cols: 2 });
    const out = h('div');
    area.append(CS.card('Grau de proteção IP (NBR IEC 60529)', f.el, out));
    const uses = { 20: 'quadros internos em áreas secas', 40: 'interruptores e tomadas internas', 44: 'luminárias em áreas cobertas', 54: 'ambientes industriais com poeira', 55: 'áreas externas abrigadas', 65: 'equipamentos externos sujeitos a jatos', 66: 'áreas externas severas / lavagem', 67: 'equipamentos submersíveis temporariamente', 68: 'bombas submersas, iluminação de piscinas' };
    function run() { const code = +(f.st.a + f.st.b); out.innerHTML = ''; out.append(h('div', { class: 'ip-code' }, `IP${f.st.a}${f.st.b}`), CS.kv([['Sólidos', IP1[+f.st.a]], ['Líquidos', IP2[+f.st.b]], ['Uso típico', uses[code] || '—']])); }
    run();
  }

  /* ════════════════ 3. DISPOSITIVOS DE PROTEÇÃO E ATERRAMENTO ════════════════ */
  const toolProt = (host, onClean) => {
    const { body } = CS.page(host, {
      title: 'Dispositivos de Proteção e Aterramento', lead: 'Curvas de disjuntores, DR e tensão de contato, esquemas de aterramento, eletrodos (hastes e malhas), corrente de curto-circuito e SPDA (esfera rolante).',
      learn: `<p><b>Disjuntor termomagnético</b> (IEC 60898): o elemento térmico protege contra sobrecarga (tempo inverso: quanto maior a corrente, mais rápido) e o magnético contra curto-circuito (instantâneo). As curvas definem o disparo magnético: <b>B</b> 3–5·I<sub>n</sub> (resistivas), <b>C</b> 5–10·I<sub>n</sub> (uso geral, motores pequenos), <b>D</b> 10–20·I<sub>n</sub> (grandes correntes de partida).</p>
      <p><b>DR (dispositivo diferencial-residual):</b> compara as correntes de ida e volta. Uma diferença maior que I<sub>Δn</sub> (30 mA para proteção de pessoas) significa fuga e o DR desliga. É obrigatório em banheiros, cozinhas, áreas de serviço, áreas externas e tomadas em locais molhados.</p>
      <p><b>Esquemas de aterramento</b> (1ª letra: fonte; 2ª: massas): <b>TN</b> (massas ao neutro aterrado; falta vira curto e o disjuntor atua), <b>TT</b> (massas em eletrodo próprio; exige DR), <b>IT</b> (fonte isolada; a 1ª falta não desliga, usado em hospitais e indústrias de processo contínuo).</p>
      <p><b>Eletrodo de aterramento:</b> haste vertical R = ρ/(2πL)·[ln(4L/d) − 1]. Hastes em paralelo não dividem R por n, porque há influência mútua; o espaçamento ideal é de pelo menos o comprimento da haste.</p>
      <p><b>Curto-circuito:</b> I<sub>cc</sub> = V/(√3·Z<sub>total</sub>). O disjuntor precisa ter capacidade de interrupção ≥ I<sub>cc</sub>, e o cabo precisa suportar I²t ≤ k²S² (k = 115 para cobre/PVC).</p>
      <p><b>SPDA (NBR 5419):</b> no método da <b>esfera rolante</b> (raios de 20, 30, 45 e 60 m para as classes I a IV), tudo o que a esfera não toca está protegido.</p>`,
    });
    onClean(K.sections(body, 'prot', [
      { id: 'disj', label: 'Disjuntores (curvas)', render: secDisj }, { id: 'dr', label: 'DR e tensão de contato', render: secDR },
      { id: 'esq', label: 'Esquemas TN / TT / IT', render: secEsq }, { id: 'eletr', label: 'Eletrodos de aterramento', render: secEletrodo },
      { id: 'icc', label: 'Curto-circuito', render: secIcc }, { id: 'spda', label: 'SPDA (esfera rolante)', render: secSPDA },
    ]));
  };
  const MAG = { B: [3, 5], C: [5, 10], D: [10, 20] };
  E.tripTime = (I, In, curva, side) => { const m = I / In; const [lo, hi] = MAG[curva]; if (m >= (side === 'max' ? hi : lo)) return 0.01; if (m <= (side === 'max' ? 1.45 : 1.13)) return Infinity; const k = side === 'max' ? 120 : 25, m0 = side === 'max' ? 1.45 : 1.13; return Math.min(7200, k / (m * m - m0 * m0)); };
  function secDisj(area) {
    const f = K.form([{ k: 'In', l: 'Corrente nominal I<sub>n</sub>', type: 'sel', v: '20', opts: E.DISJ.slice(0, 12).map(String) }, { k: 'c', l: 'Curva', type: 'sel', v: 'C', opts: ['B', 'C', 'D'] }, { k: 'I', l: 'Corrente de sobrecarga / falta', u: 'A', v: '120' }], () => run(), { cols: 1 });
    const out = h('div'), cb = CS.chartBox('tall');
    area.append(h('div', { class: 'grid2' }, h('div', { class: 'col' }, CS.card('Disjuntor', f.el), CS.card('Disparo', out)), CS.card('Curva tempo × corrente (faixa de atuação)', cb)));
    const ch = new MS.Chart(cb, { xlog: true, ylog: true, xlabel: 'I / In', ylabel: 't [s]', xrange: [1, 40], yrange: [0.005, 7200], readout: (x, y) => `${K.n(x)} × In\n${K.n(y)} s` });
    function run() {
      const In = +f.st.In, c = f.st.c, ms = CS.logspace(1.01, 40, 300);
      const lo = ms.map(m => E.tripTime(m * In, In, c, 'min')), hi = ms.map(m => E.tripTime(m * In, In, c, 'max'));
      ch.set({ series: [{ x: ms, y: lo, color: '#4fb3ff', width: 2, name: 'disparo mais rápido' }, { x: ms, y: hi, color: '#ff9f1c', width: 2, name: 'disparo mais lento' }], vlines: [{ x: MAG[c][0], color: 'rgba(199,125,255,0.5)', label: `${MAG[c][0]}In` }, { x: MAG[c][1], color: 'rgba(199,125,255,0.5)', label: `${MAG[c][1]}In` }],
        markers: [{ x: f.st.I / In, y: Math.max(0.006, Math.min(7000, E.tripTime(f.st.I, In, c, 'max'))), shape: 'dot', color: '#ffd166', size: 6, label: `${f.st.I} A` }] });
      const a = E.tripTime(f.st.I, In, c, 'min'), b = E.tripTime(f.st.I, In, c, 'max'), fmt = t => (t === Infinity ? 'não dispara' : t <= 0.01 ? 'instantâneo (< 10 ms)' : t >= 7200 ? '> 2 h' : K.n(t, 3) + ' s');
      out.innerHTML = '';
      out.append(CS.kv([['Múltiplo I/I<sub>n</sub>', K.n(f.st.I / In)], ['Faixa de tempo de disparo', `${fmt(a)} a ${fmt(b)}`], ['Região', f.st.I / In >= MAG[c][1] ? 'magnética (curto-circuito)' : f.st.I / In >= MAG[c][0] ? 'transição térmica/magnética' : f.st.I / In > 1.13 ? 'térmica (sobrecarga)' : 'sem disparo (≤ 1,13·In)']]), h('div', { class: 'muted small' }, 'Curvas aproximadas dentro dos limites da IEC 60898 (1,13·In não dispara em 1 h; 1,45·In dispara em menos de 1 h).'));
    }
    run();
  }
  function secDR(area) {
    const f = K.form([{ k: 'U0', l: 'Tensão fase-terra U₀', u: 'V', v: '127' }, { k: 'Rb', l: 'Aterramento da fonte (neutro) R<sub>B</sub>', u: 'Ω', v: '10' }, { k: 'Ra', l: 'Aterramento das massas R<sub>A</sub>', u: 'Ω', v: '40' }, { k: 'Rc', l: 'Resistência do corpo', u: 'Ω', v: '1000' }, { k: 'dr', l: 'Proteção', type: 'sel', v: '30', opts: [['0', 'sem DR (só disjuntor 20 A)'], ['30', 'DR 30 mA'], ['300', 'DR 300 mA']] }], () => run(), { cols: 1 });
    const out = h('div'), cvc = CS.card('Esquema TT com falta à massa');
    area.append(h('div', { class: 'grid2' }, h('div', { class: 'col' }, CS.card('Dados', f.el), CS.card('Resultado', out)), cvc));
    const cv = K.canvas(cvc, 300, null);
    function run() {
      const { U0, Rb, Ra, Rc } = f.st, dr = +f.st.dr / 1000;
      const Rp = Ra * Rc / (Ra + Rc), If = U0 / (Rb + Rp), Uc = If * Rp, Ib = Uc / Rc * 1000;
      const trips = dr > 0 && If >= dr, t = !trips ? (If > 20 * 5 ? 10 : Infinity) : If >= 5 * dr ? 40 : 300;
      const z = E.zona60479(Ib, isFinite(t) ? t : 5000);
      out.innerHTML = '';
      out.append(CS.kv([['Corrente de falta I<sub>f</sub>', `${K.n(If, 3)} A`], ['Tensão de contato U<sub>c</sub>', `<b class="${Uc > 50 ? 'bad' : 'good'}">${K.n(Uc, 3)} V</b> (limite 50 V)`], ['Corrente pelo corpo', `${K.n(Ib, 3)} mA`],
        ['Desligamento', isFinite(t) ? `em ≈ ${t} ms` : '<b class="bad">não desliga! o disjuntor de 20 A não "enxerga" uma corrente tão pequena</b>'], ['Zona IEC 60479', `<b class="${z[0] === 'AC-4' ? 'bad' : z[0] === 'AC-3' ? 'warn' : 'good'}">${z[0]}</b> — ${z[1]}`],
        ['Condição NBR 5410 (TT)', dr > 0 ? (Ra * dr <= 50 ? `<span class="good">R<sub>A</sub>·I<sub>Δn</sub> = ${K.n(Ra * dr, 3)} V ≤ 50 V ✓</span>` : `<span class="bad">R<sub>A</sub>·I<sub>Δn</sub> = ${K.n(Ra * dr, 3)} V > 50 V ✗</span>`) : '<span class="bad">no TT, o DR é praticamente indispensável</span>']]));
      cv.draw = (g, W, H) => {
        g.strokeStyle = '#9fb4d0'; g.lineWidth = 2; g.font = '12px Barlow'; g.fillStyle = '#c3d3e8'; g.textAlign = 'center';
        const yL = 40, yG = H - 40;
        g.strokeRect(30, 30, 60, 60); g.fillText('fonte', 60, 25);
        g.strokeStyle = '#ff4d6d'; g.beginPath(); g.moveTo(90, yL + 10); g.lineTo(W - 120, yL + 10); g.lineTo(W - 120, 120); g.stroke(); g.fillStyle = '#ff4d6d'; g.fillText('fase', W / 2, yL + 4);
        g.strokeStyle = '#9fb4d0'; g.strokeRect(W - 170, 120, 100, 60); g.fillStyle = '#c3d3e8'; g.fillText('massa do equipamento', W - 120, 200);
        g.strokeStyle = '#ffd166'; g.setLineDash([4, 3]); g.beginPath(); g.moveTo(W - 120, 120); g.lineTo(W - 150, 150); g.stroke(); g.setLineDash([]); g.fillStyle = '#ffd166'; g.fillText('falta', W - 145, 115);
        g.strokeStyle = '#3ddc84'; g.beginPath(); g.moveTo(W - 120, 180); g.lineTo(W - 120, yG); g.stroke(); g.fillStyle = '#3ddc84'; g.fillText(`R_A = ${Ra} Ω`, W - 75, yG - 10);
        g.strokeStyle = '#4fb3ff'; g.beginPath(); g.moveTo(60, 90); g.lineTo(60, yG); g.stroke(); g.fillStyle = '#4fb3ff'; g.fillText(`R_B = ${Rb} Ω`, 105, yG - 10);
        g.strokeStyle = '#6f8bad'; g.setLineDash([6, 4]); g.beginPath(); g.moveTo(60, yG); g.lineTo(W - 120, yG); g.stroke(); g.setLineDash([]); g.fillStyle = '#6f8bad'; g.fillText('solo (caminho de retorno da falta)', W / 2, yG + 18);
        const px = W - 210; g.strokeStyle = Uc > 50 ? '#ff4d6d' : '#c3d3e8'; g.beginPath(); g.arc(px, 130, 9, 0, 7); g.stroke(); g.beginPath(); g.moveTo(px, 139); g.lineTo(px, 175); g.moveTo(px, 150); g.lineTo(W - 170, 150); g.moveTo(px, 175); g.lineTo(px - 10, yG); g.moveTo(px, 175); g.lineTo(px + 10, yG); g.stroke();
        g.fillStyle = Uc > 50 ? '#ff4d6d' : '#c3d3e8'; g.fillText(`U_c = ${K.n(Uc, 3)} V`, px - 10, 110);
      };
      cv.redraw();
    }
    run();
  }
  const ESQ = {
    'TN-S': ['Neutro (N) e proteção (PE) separados desde a fonte; massas ligadas ao PE.', 'A falta fase-massa é um curto-circuito pelo PE → o disjuntor desliga rápido. Melhor para compatibilidade eletromagnética.', 'Disjuntor (impedância do laço baixa) + DR recomendado.'],
    'TN-C-S': ['PEN combinado até um ponto, depois separado em N e PE (comum na entrada de edificações).', 'Econômico. Uma ruptura do PEN pode energizar as massas, por isso o PEN nunca deve ser seccionado.', 'Disjuntor + DR após a separação.'],
    'TN-C': ['Um único condutor PEN faz as funções de neutro e proteção.', 'Proibido em seções menores que 10 mm² (cobre) e em instalações com DR no trecho com PEN.', 'Apenas disjuntor (o DR não funciona no PEN).'],
    TT: ['Neutro aterrado na fonte; massas em eletrodo independente.', 'A corrente de falta passa pelo solo e é limitada pelas resistências de aterramento, muitas vezes pequena demais para o disjuntor.', 'DR obrigatório na prática (R<sub>A</sub>·I<sub>Δn</sub> ≤ 50 V).'],
    IT: ['Fonte isolada da terra (ou aterrada por alta impedância); massas aterradas.', 'A 1ª falta não desliga, só sinaliza (DSI); continuidade de serviço. A 2ª falta precisa ser eliminada.', 'Dispositivo supervisor de isolamento + disjuntores/DR.'],
  };
  function secEsq(area) {
    const f = K.form([{ k: 'e', l: 'Esquema', type: 'sel', v: 'TN-S', opts: Object.keys(ESQ) }], () => run(), { cols: 1 });
    const out = h('div'), cvc = CS.card('Diagrama');
    area.append(h('div', { class: 'grid2' }, h('div', { class: 'col' }, CS.card('Esquema de aterramento (NBR 5410)', f.el), CS.card('Características', out)), cvc));
    const cv = K.canvas(cvc, 330, null);
    function run() {
      const e = f.st.e, [d, comp, prot] = ESQ[e];
      out.innerHTML = ''; out.append(CS.kv([['Descrição', d], ['Comportamento na falta', comp], ['Proteção usual', prot]]));
      cv.draw = (g, W, H) => {
        const xs = 70, xe = W - 40, ys = [50, 75, 100, 125, 150], cols = ['#ff4d6d', '#ffd166', '#c3d3e8', '#4fb3ff', '#3ddc84'];
        g.font = '12px Barlow'; g.lineWidth = 2;
        g.strokeStyle = '#9fb4d0'; g.strokeRect(20, 40, 40, 100); g.fillStyle = '#c3d3e8'; g.textAlign = 'center'; g.fillText('fonte', 40, 34);
        const lines = e === 'TN-C' ? ['L1', 'L2', 'L3', 'PEN'] : e === 'IT' ? ['L1', 'L2', 'L3', 'PE'] : e === 'TT' ? ['L1', 'L2', 'L3', 'N'] : ['L1', 'L2', 'L3', 'N', 'PE'];
        const split = e === 'TN-C-S' ? W * 0.45 : null;
        lines.forEach((nm, i) => {
          const y = ys[i], c = nm === 'PEN' ? '#3ddc84' : cols[i];
          g.strokeStyle = c; g.beginPath();
          if (e === 'TN-C-S' && nm === 'PE') { g.moveTo(split, ys[3]); g.lineTo(split, y); g.lineTo(xe, y); }
          else { g.moveTo(xs - 10, y); g.lineTo(xe, y); }
          g.stroke(); g.fillStyle = c; g.textAlign = 'left'; g.fillText(e === 'TN-C-S' && nm === 'N' ? 'PEN → N' : nm, xe - 50, y - 4);
        });
        const gnd = (x, y, lbl) => { g.strokeStyle = '#3ddc84'; g.beginPath(); g.moveTo(x, y); g.lineTo(x, H - 50); g.moveTo(x - 12, H - 50); g.lineTo(x + 12, H - 50); g.moveTo(x - 8, H - 45); g.lineTo(x + 8, H - 45); g.moveTo(x - 4, H - 40); g.lineTo(x + 4, H - 40); g.stroke(); if (lbl) { g.fillStyle = '#3ddc84'; g.textAlign = 'center'; g.fillText(lbl, x, H - 24); } };
        if (e !== 'IT') { g.strokeStyle = '#3ddc84'; g.beginPath(); g.moveTo(40, 140); g.lineTo(40, ys[3]); g.stroke(); gnd(40, 140, 'aterramento da fonte'); }
        else { g.strokeStyle = '#ffd166'; g.setLineDash([4, 3]); g.beginPath(); g.moveTo(40, 140); g.lineTo(40, H - 50); g.stroke(); g.setLineDash([]); g.fillStyle = '#ffd166'; g.textAlign = 'center'; g.fillText('isolada / alta impedância', 60, H - 24); }
        const mx = W * 0.7; g.strokeStyle = '#9fb4d0'; g.strokeRect(mx - 40, 190, 80, 50); g.fillStyle = '#c3d3e8'; g.textAlign = 'center'; g.fillText('massa', mx, 220);
        for (let i = 0; i < 3; i++) { g.strokeStyle = cols[i]; g.beginPath(); g.moveTo(mx - 25 + i * 15, ys[i]); g.lineTo(mx - 25 + i * 15, 190); g.stroke(); }
        if (e === 'TT') gnd(mx + 50, 240, 'eletrodo próprio das massas'), (g.strokeStyle = '#3ddc84', g.beginPath(), g.moveTo(mx + 40, 215), g.lineTo(mx + 50, 215), g.lineTo(mx + 50, 240), g.stroke());
        else { const pe = e === 'TN-C' ? ys[3] : e === 'IT' ? ys[3] : ys[4]; g.strokeStyle = '#3ddc84'; g.beginPath(); g.moveTo(mx + 30, pe); g.lineTo(mx + 30, 190); g.stroke(); if (e === 'IT') gnd(mx + 60, pe, 'aterramento das massas'), (g.beginPath(), g.moveTo(mx + 30, pe), g.lineTo(mx + 60, pe), g.stroke()); }
      };
      cv.redraw();
    }
    run();
  }
  const SOLOS = [['30', 'Pântano / alagadiço (≈ 30 Ω·m)'], ['100', 'Argila / terra vegetal úmida (≈ 100 Ω·m)'], ['300', 'Terra arenosa úmida (≈ 300 Ω·m)'], ['1000', 'Areia seca / cascalho (≈ 1 000 Ω·m)'], ['3000', 'Calcário / rocha fraturada (≈ 3 000 Ω·m)']];
  const LAMBDA = { 1: 0, 2: 1.0, 3: 1.66, 4: 2.15, 5: 2.54, 6: 2.87, 7: 3.15, 8: 3.39, 9: 3.61, 10: 3.81 };
  function secEletrodo(area) {
    const f = K.form([{ k: 'rho', l: 'Resistividade do solo ρ', type: 'sel', v: '100', opts: SOLOS }, { k: 'L', l: 'Comprimento da haste', u: 'm', v: '2.4' }, { k: 'd', l: 'Diâmetro da haste', u: 'mm', v: '15.9' }, { k: 'n', l: 'Hastes em linha (1–10)', u: '', v: '3' }, { k: 'a', l: 'Espaçamento entre hastes', u: 'm', v: '3' },
      { sep: 'Malha (subestação)' }, { k: 'A', l: 'Área da malha', u: 'm²', v: '400' }, { k: 'Lt', l: 'Comprimento total de condutor', u: 'm', v: '320' }, { k: 'hm', l: 'Profundidade', u: 'm', v: '0.5' }], () => run(), { cols: 2 });
    const out = h('div'), cb = CS.chartBox();
    area.append(h('div', { class: 'grid2' }, h('div', { class: 'col' }, CS.card('Dados', f.el), CS.card('Resultados', out)), CS.card('Resistência × número de hastes', cb)));
    const ch = new MS.Chart(cb, { xlabel: 'número de hastes', ylabel: 'R [Ω]', readout: (x, y) => `n = ${Math.round(x)}\nR = ${K.n(y)} Ω` });
    function run() {
      const rho = +f.st.rho, L = f.st.L, d = f.st.d / 1000, a = f.st.a;
      const R1 = rho / (2 * Math.PI * L) * (Math.log(4 * L / d) - 1);
      const Rn = n => (n <= 1 ? R1 : R1 / n * (1 + LAMBDA[Math.min(10, n)] * rho / (2 * Math.PI * a * R1)));
      const n = Math.max(1, Math.min(10, Math.round(f.st.n)));
      const ns = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      ch.set({ series: [{ x: ns, y: ns.map(Rn), color: '#3ddc84', width: 2, name: 'real (com influência mútua)' }, { x: ns, y: ns.map(k => R1 / k), color: 'rgba(159,180,208,0.5)', dash: [5, 4], width: 1.3, name: 'ideal R₁/n' }], markers: [{ x: n, y: Rn(n), shape: 'dot', color: '#ffd166', size: 6 }] });
      const Rm = rho * (1 / f.st.Lt + 1 / Math.sqrt(20 * f.st.A) * (1 + 1 / (1 + f.st.hm * Math.sqrt(20 / f.st.A))));
      out.innerHTML = '';
      out.append(CS.kv([['1 haste', `${K.n(R1)} Ω`], [`${n} hastes em linha (a = ${a} m)`, `<b>${K.n(Rn(n))} Ω</b> (eficiência ${K.n(R1 / n / Rn(n) * 100, 3)} %)`], ['Malha (Sverak)', `${K.n(Rm)} Ω`], ['Referência usual', '≤ 10 Ω em BT (meta prática); em subestações, verificar as tensões de passo e de toque']]));
    }
    run();
  }
  function secIcc(area) {
    const f = K.form([{ k: 'S', l: 'Transformador', u: 'kVA', v: '150' }, { k: 'Z', l: 'Impedância percentual Z%', u: '%', v: '4.5' }, { k: 'V', l: 'Tensão secundária (linha)', u: 'V', v: '380' },
      { k: 'sec', l: 'Seção do cabo', type: 'sel', v: '35', opts: E.SEC.map(String) }, { k: 'L', l: 'Comprimento do cabo', u: 'm', v: '50' }, { k: 'Icu', l: 'Capacidade de interrupção do disjuntor', u: 'kA', v: '10' }, { k: 'tdis', l: 'Tempo de eliminação', u: 's', v: '0.02' }], () => run(), { cols: 2 });
    const out = h('div'), cb = CS.chartBox();
    area.append(h('div', { class: 'grid2' }, h('div', { class: 'col' }, CS.card('Dados', f.el), CS.card('Resultados', out)), CS.card('I<sub>cc</sub> trifásica ao longo do cabo', cb)));
    const ch = new MS.Chart(cb, { xlabel: 'distância do transformador [m]', ylabel: 'Icc [kA]', includeOrigin: true, readout: (x, y) => `${K.n(x)} m\n${K.n(y)} kA` });
    function run() {
      const { S, Z, V, L, Icu, tdis } = f.st, sec = +f.st.sec;
      const Zt = V * V / (S * 1e3) * Z / 100, Rt = Zt * 0.3, Xt = Zt * Math.sqrt(1 - 0.09);
      const Zc = l => ({ R: 0.0225 * l / sec, X: 0.08e-3 * l });
      const I3 = l => { const c = Zc(l); return V / (Math.sqrt(3) * Math.hypot(Rt + c.R, Xt + c.X)); };
      const I1 = l => { const c = Zc(l); return (V / Math.sqrt(3)) / Math.hypot(Rt + 2 * c.R, Xt + 2 * c.X); };
      const ls = K.linspace(0, Math.max(L * 2, 50), 120);
      ch.set({ series: [{ x: ls, y: ls.map(l => I3(l) / 1e3), color: '#ff4d6d', width: 2, name: 'trifásica' }, { x: ls, y: ls.map(l => I1(l) / 1e3), color: '#4fb3ff', width: 2, name: 'fase-neutro (mínima)' }], vlines: [{ x: L, color: 'rgba(255,209,102,0.6)', label: 'fim do cabo' }] });
      const Ic0 = I3(0), IcL = I3(L), tmax = (115 * sec / Ic0) ** 2;
      out.innerHTML = '';
      out.append(CS.kv([['Corrente nominal do trafo', `${K.n(S * 1e3 / (Math.sqrt(3) * V))} A`], ['Icc nos terminais do trafo', `<b>${K.n(Ic0 / 1e3)} kA</b>`], ['Icc no fim do cabo (trifásica)', `${K.n(IcL / 1e3)} kA`], ['Icc mínima fase-neutro no fim', `${K.n(I1(L) / 1e3)} kA (deve disparar o magnético)`],
        ['Capacidade de interrupção', Icu * 1e3 >= Ic0 ? `<span class="good">${Icu} kA ≥ ${K.n(Ic0 / 1e3)} kA ✓</span>` : `<span class="bad">${Icu} kA &lt; ${K.n(Ic0 / 1e3)} kA ✗ — disjuntor insuficiente</span>`],
        ['Suportabilidade térmica do cabo', `t<sub>máx</sub> = (kS/I)² = ${K.n(tmax, 3)} s ${tmax >= tdis ? '<span class="good">✓</span>' : '<span class="bad">✗ cabo danificado antes da eliminação</span>'}`]]));
    }
    run();
  }
  function secSPDA(area) {
    const f = K.form([{ k: 'cl', l: 'Classe do SPDA', type: 'sel', v: '20', opts: [['20', 'I (R = 20 m)'], ['30', 'II (R = 30 m)'], ['45', 'III (R = 45 m)'], ['60', 'IV (R = 60 m)']] }, { k: 'hc', l: 'Altura do captor (mastro)', u: 'm', v: '15' }, { k: 'he', l: 'Altura do objeto a proteger', u: 'm', v: '5' }], () => run(), { cols: 1 });
    const out = h('div'), cvc = CS.card('Corte: esfera rolante tocando o captor e o solo');
    area.append(h('div', { class: 'grid2' }, h('div', { class: 'col' }, CS.card('Dados', f.el), CS.card('Resultados', out)), cvc));
    const cv = K.canvas(cvc, 340, null);
    const MALHA = { 20: '5 × 5 m · descidas a cada 10 m', 30: '10 × 10 m · descidas a cada 10 m', 45: '15 × 15 m · descidas a cada 15 m', 60: '20 × 20 m · descidas a cada 20 m' };
    function run() {
      const R = +f.st.cl, hc = Math.min(f.st.hc, R), he = Math.min(f.st.he, hc);
      const r0 = Math.sqrt(hc * (2 * R - hc)), rh = r0 - Math.sqrt(he * (2 * R - he));
      out.innerHTML = '';
      out.append(CS.kv([['Raio protegido no solo', `${K.n(r0)} m`], [`Raio protegido à altura de ${he} m`, `<b>${K.n(Math.max(0, rh))} m</b>`], ['Método das malhas (mesma classe)', MALHA[R]], f.st.hc > R ? ['Atenção', '<span class="warn">captor mais alto que o raio da esfera: o excedente pode receber descargas laterais</span>'] : null]));
      cv.draw = (g, W, H) => {
        const s = Math.min((W - 40) / (2 * r0 + 20), (H - 40) / (Math.max(hc, R * 0.6) + 5)), cx = W / 2, y0 = H - 25, X = x => cx + x * s, Y = y => y0 - y * s;
        g.fillStyle = '#3a2f22'; g.fillRect(0, y0, W, 25);
        g.fillStyle = 'rgba(61,220,132,0.15)'; g.beginPath(); g.moveTo(X(-r0), y0);
        for (let i = 0; i <= 60; i++) { const x = -r0 + 2 * r0 * i / 60, xc = x < 0 ? -r0 : r0, yy = R - Math.sqrt(Math.max(0, R * R - (x - xc) ** 2)); g.lineTo(X(x), Y(Math.min(hc, yy))); }
        g.lineTo(X(r0), y0); g.closePath(); g.fill();
        for (const sg of [-1, 1]) { g.strokeStyle = 'rgba(79,179,255,0.6)'; g.setLineDash([5, 4]); g.beginPath(); g.arc(X(sg * r0), Y(R), R * s, 0, 7); g.stroke(); g.setLineDash([]); }
        g.strokeStyle = '#ffd166'; g.lineWidth = 3; g.beginPath(); g.moveTo(X(0), y0); g.lineTo(X(0), Y(hc)); g.stroke(); g.lineWidth = 1;
        g.fillStyle = '#9fb4d0'; g.fillRect(X(rh) - 2 - 20, Y(he), 20, he * s);
        g.fillStyle = '#c3d3e8'; g.font = '12px Barlow'; g.textAlign = 'center'; g.fillText(`captor ${hc} m`, X(0), Y(hc) - 6); g.fillText('zona protegida', X(0), Y(hc * 0.35)); g.fillStyle = '#4fb3ff'; g.fillText(`esfera R = ${R} m`, X(r0), Y(R) - R * s - 4 > 10 ? Y(R) - R * s - 4 : 14);
      };
      cv.redraw();
    }
    run();
  }

  /* ════════════════ 4. PROJETO, INFRAESTRUTURA E EXECUÇÃO ════════════════ */
  const ROOM_T = { sala: 'Sala', quarto: 'Dormitório', cozinha: 'Cozinha / copa', banheiro: 'Banheiro', servico: 'Área de serviço', varanda: 'Varanda', corredor: 'Corredor / hall' };
  E.proj = E.proj || {
    rooms: [['Sala', 'sala', 16, 16], ['Cozinha', 'cozinha', 9, 12], ['Quarto 1', 'quarto', 12, 14], ['Quarto 2', 'quarto', 10, 13], ['Banheiro', 'banheiro', 4, 8], ['Área de serviço', 'servico', 5, 9], ['Varanda', 'varanda', 6, 10]].map(([n, t, a, p]) => ({ n, t, a, p })),
    tue: [['Chuveiro', 5400, 'Banheiro'], ['Forno micro-ondas', 1200, 'Cozinha'], ['Máquina de lavar', 1000, 'Área de serviço'], ['Ar-condicionado 12 000 BTU', 1400, 'Quarto 1']].map(([n, p, r]) => ({ n, p, r })),
  };
  E.previsao = function (rooms) {
    return rooms.map(r => {
      const il = r.a <= 6 ? 100 : 100 + 60 * Math.floor((r.a - 6) / 4);
      let n;
      if (r.t === 'banheiro') n = 1; else if (r.t === 'cozinha' || r.t === 'servico') n = Math.ceil(r.p / 3.5); else if (r.t === 'varanda') n = 1; else if (r.a <= 6) n = 1; else n = Math.ceil(r.p / 5);
      const molhado = ['banheiro', 'cozinha', 'servico'].includes(r.t);
      const va = molhado ? Math.min(n, 3) * 600 + Math.max(0, n - 3) * 100 : n * 100;
      return { ...r, il, tug: n, va };
    });
  };
  const toolProj = (host, onClean) => {
    const { body } = CS.page(host, {
      title: 'Projeto, Infraestrutura e Execução', lead: 'Previsão de cargas (NBR 5410), quadro de distribuição com balanceamento de fases, eletrodutos, cálculo luminotécnico e roteiro de ensaios e execução segura.',
      learn: `<p><b>Etapas do projeto:</b> levantamento de cargas → divisão em circuitos → dimensionamento (condutores, proteção) → quadro e balanceamento → infraestrutura (eletrodutos, caixas) → memorial, diagramas e lista de materiais → execução → ensaios (NBR 5410 seção 7) → documentação "as built".</p>
      <p><b>Previsão mínima (NBR 5410):</b> iluminação de 100 VA nos primeiros 6 m² + 60 VA a cada 4 m² inteiros. Tomadas de uso geral: banheiro ≥ 1; cozinha e área de serviço 1 a cada 3,5 m de perímetro, com 600 VA nas três primeiras; salas e dormitórios 1 a cada 5 m (100 VA). Tomadas de uso específico (TUE) com a potência do equipamento.</p>
      <p><b>Circuitos:</b> separe iluminação e tomadas; cada equipamento de mais de 10 A (chuveiro, forno, ar-condicionado) em circuito próprio; distribua as cargas entre as fases.</p>
      <p><b>Eletrodutos:</b> taxa máxima de ocupação de 53% (1 condutor), 31% (2) e 40% (3 ou mais).</p>
      <p><b>Luminotécnica (método dos lúmens):</b> N = E·A/(Φ·FU·FM). O fator de utilização FU depende do índice do recinto K = C·L/(h·(C+L)) e das refletâncias; o fator de manutenção FM considera a sujeira e a depreciação.</p>`,
    });
    onClean(K.sections(body, 'proj', [
      { id: 'prev', label: 'Previsão de cargas', render: secPrev }, { id: 'quadro', label: 'Quadro e balanceamento', render: secQuadro },
      { id: 'eletrod', label: 'Eletrodutos', render: secEletroduto }, { id: 'lum', label: 'Iluminação (lúmens)', render: secLum }, { id: 'exec', label: 'Execução e ensaios', render: secExec },
    ]));
  };
  function secPrev(area) {
    const tbl = h('div'), tue = h('div'), out = h('div');
    area.append(h('div', { class: 'grid2' }, h('div', { class: 'col' }, CS.card('Cômodos (área m², perímetro m)', tbl), CS.card('Tomadas de uso específico (TUE)', tue)), CS.card('Resultado da previsão', out)));
    const P = E.proj;
    const renderRooms = () => {
      tbl.innerHTML = '';
      P.rooms.forEach((r, i) => {
        const n = h('input', { value: r.n }), t = h('select', {}, ...Object.entries(ROOM_T).map(([k, v]) => h('option', { value: k }, v))), a = h('input', { value: r.a, class: 'sm' }), p = h('input', { value: r.p, class: 'sm' });
        t.value = r.t;
        n.addEventListener('change', () => { r.n = n.value; run(); }); t.addEventListener('change', () => { r.t = t.value; run(); });
        a.addEventListener('change', () => { r.a = MS.parseEng(a.value) || r.a; run(); }); p.addEventListener('change', () => { r.p = MS.parseEng(p.value) || r.p; run(); });
        tbl.append(h('div', { class: 'load-row' }, n, t, a, p, h('button', { class: 'btn icon sm danger', onclick: () => { P.rooms.splice(i, 1); renderRooms(); run(); } }, '✕')));
      });
      tbl.append(h('button', { class: 'btn sm', onclick: () => { P.rooms.push({ n: 'Novo cômodo', t: 'quarto', a: 9, p: 12 }); renderRooms(); run(); } }, '+ cômodo'));
    };
    const renderTue = () => {
      tue.innerHTML = '';
      P.tue.forEach((u, i) => {
        const n = h('input', { value: u.n }), p = h('input', { value: u.p, class: 'sm' });
        n.addEventListener('change', () => { u.n = n.value; run(); }); p.addEventListener('change', () => { u.p = MS.parseEng(p.value) || u.p; run(); });
        tue.append(h('div', { class: 'load-row' }, n, p, h('span', {}, 'W'), h('button', { class: 'btn icon sm danger', onclick: () => { P.tue.splice(i, 1); renderTue(); run(); } }, '✕')));
      });
      tue.append(h('button', { class: 'btn sm', onclick: () => { P.tue.push({ n: 'Equipamento', p: 1500 }); renderTue(); run(); } }, '+ TUE'));
    };
    const FD = [[1, 0.86], [2, 0.75], [3, 0.66], [4, 0.59], [5, 0.52], [6, 0.45], [7, 0.40], [8, 0.35], [9, 0.31], [10, 0.27], [Infinity, 0.24]];
    const FDT = [1, 1, 1, 0.84, 0.76, 0.70, 0.65, 0.60, 0.57, 0.54, 0.52, 0.49, 0.48];
    function run() {
      const pv = E.previsao(P.rooms);
      const il = pv.reduce((s, r) => s + r.il, 0), tug = pv.reduce((s, r) => s + r.va, 0), tueW = P.tue.reduce((s, u) => s + u.p, 0);
      const Wil = il * 1 + tug * 0.8, kW = Wil / 1000;
      const fd = FD.find(x => kW <= x[0])[1], dem = Wil * fd + tueW * FDT[Math.min(12, P.tue.length)];
      out.innerHTML = '';
      out.append(K.table(['Cômodo', 'Iluminação [VA]', 'TUG (qtde)', 'TUG [VA]'], pv.map(r => [r.n, r.il, r.tug, r.va])),
        CS.kv([['Total iluminação', `${il} VA`], ['Total TUG', `${tug} VA`], ['Total TUE', `${tueW} W`], ['Potência instalada', `<b>${K.n((Wil + tueW) / 1000, 4)} kW</b>`], ['Demanda estimada', `<b>${K.n(dem / 1000, 4)} kW</b> (fatores de demanda típicos)`],
          ['Fornecimento sugerido', dem / 1000 <= 12 ? 'monofásico (até ≈ 12 kW)' : dem / 1000 <= 25 ? 'bifásico (≈ 12–25 kW)' : 'trifásico (> 25 kW)']]), h('div', { class: 'muted small' }, 'Fatores de demanda e limites de fornecimento variam conforme a concessionária. ' + NOTE));
    }
    renderRooms(); renderTue(); run();
  }
  function secQuadro(area) {
    const f = K.form([{ k: 'forn', l: 'Fornecimento', type: 'sel', v: '2', opts: [['1', 'Monofásico 127 V'], ['2', 'Bifásico 127/220 V'], ['3', 'Trifásico 127/220 V']] }], () => run(), { cols: 1 });
    let circ = null;
    const gen = () => {
      const pv = E.previsao(E.proj.rooms), c = [];
      let il = 0; pv.forEach(r => { il += r.il; });
      for (let k = 0; il > 0; k++) { const v = Math.min(il, 1270); c.push({ n: `Iluminação ${k + 1}`, va: v, v: 127, tipo: 'ilum' }); il -= v; }
      pv.forEach(r => { if (r.va >= 1200) c.push({ n: `TUG ${r.n}`, va: r.va, v: 127, tipo: 'forca' }); });
      const rest = pv.filter(r => r.va < 1200).reduce((s, r) => s + r.va, 0); for (let k = 0, x = rest; x > 0; k++) { const v = Math.min(x, 1800); c.push({ n: `TUG geral ${k + 1}`, va: v, v: 127, tipo: 'forca' }); x -= v; }
      E.proj.tue.forEach(u => c.push({ n: u.n, va: u.p, v: u.p > 2000 ? 220 : 127, tipo: 'forca' }));
      return c;
    };
    const out = h('div'), bars = h('div');
    area.append(h('div', { class: 'row gap' }, f.el, h('button', { class: 'btn sm', onclick: () => { circ = gen(); run(); } }, '↻ gerar circuitos a partir da previsão de cargas')), CS.card('Quadro de cargas', out), CS.card('Carga por fase', bars));
    function run() {
      circ = circ || gen();
      const nf = +f.st.forn, fases = ['A', 'B', 'C'].slice(0, nf), load = Object.fromEntries(fases.map(x => [x, 0]));
      const rows = circ.slice().sort((a, b) => b.va - a.va).map(c => {
        const v = nf === 1 ? 127 : c.v;
        const d = E.dimensionar({ sist: v === 220 ? 'ff220' : 'fn127', P: c.va * (c.tipo === 'ilum' ? 1 : 0.8), fp: c.tipo === 'ilum' ? 1 : 0.8, tipo: c.tipo, met: 'B1', iso: 'pvc', T: 30, n: 3, L: 20, dvmax: 4 });
        let ph;
        if (v === 220 && nf > 1) { const pair = nf === 2 ? ['A', 'B'] : [['A', 'B'], ['B', 'C'], ['A', 'C']].sort((p, q) => (load[p[0]] + load[p[1]]) - (load[q[0]] + load[q[1]]))[0]; pair.forEach(x => { load[x] += c.va / 2; }); ph = pair.join('-'); }
        else { ph = fases.reduce((a, b) => (load[b] < load[a] ? b : a)); load[ph] += c.va; }
        return [c.n, c.va, v, K.n(d.IB, 3), d.S ? d.S.S + ' mm²' : '—', d.S ? d.S.In + ' A' : '—', ph, c.tipo === 'forca' && /TUG|Chuveiro|lavar|Banheiro|Cozinha|serviço/i.test(c.n) ? 'DR 30 mA' : ''];
      });
      out.innerHTML = ''; out.append(K.table(['Circuito', 'Potência [VA]', 'V', 'I<sub>B</sub> [A]', 'Seção', 'Disjuntor', 'Fase', 'DR'], rows), h('div', { class: 'muted small' }, 'Dimensionamento com B1, PVC, 30 °C, 3 circuitos agrupados e 20 m (ajuste caso a caso na ferramenta de dimensionamento). Os circuitos foram distribuídos nas fases do maior para o menor (balanceamento guloso).'));
      const mx = Math.max(...Object.values(load)), mn = Math.min(...Object.values(load));
      bars.innerHTML = '';
      fases.forEach(x => bars.append(h('div', { class: 'oee-row' }, h('div', { class: 'oee-name' }, 'Fase ' + x), h('div', { class: 'hbar' }, h('div', { class: 'hbar-fill', style: `width:${load[x] / mx * 100}%;background:#4fb3ff` })), h('div', { class: 'oee-val' }, K.n(load[x], 4) + ' VA'))));
      if (nf > 1) bars.append(h('div', { class: 'small', html: `Desequilíbrio: <b class="${(mx - mn) / mx < 0.1 ? 'good' : 'warn'}">${K.n((mx - mn) / mx * 100, 3)} %</b> (meta: abaixo de ~10%)` }));
    }
    run();
  }
  const DCOND = { 1.5: 3.0, 2.5: 3.6, 4: 4.2, 6: 4.8, 10: 6.0, 16: 7.0, 25: 8.7, 35: 9.9 };
  const DUTOS = [[16, 13], [20, 17], [25, 22], [32, 28.5], [40, 35.5], [50, 45], [60, 56], [75, 69], [85, 79]];
  function secEletroduto(area) {
    let conds = [{ n: 3, s: 2.5 }, { n: 3, s: 1.5 }];
    const lt = h('div'), out = h('div'), cvc = CS.card('Seção do eletroduto (ilustração)');
    area.append(h('div', { class: 'grid2' }, h('div', { class: 'col' }, CS.card('Condutores no mesmo eletroduto', lt), CS.card('Resultado', out)), cvc));
    const cv = K.canvas(cvc, 280, null);
    const render = () => {
      lt.innerHTML = '';
      conds.forEach((c, i) => {
        const n = h('input', { value: c.n, class: 'sm' }), s = h('select', {}, ...Object.keys(DCOND).map(k => h('option', { value: k }, k + ' mm²'))); s.value = String(c.s);
        n.addEventListener('change', () => { c.n = Math.max(1, Math.round(MS.parseEng(n.value) || 1)); run(); }); s.addEventListener('change', () => { c.s = +s.value; run(); });
        lt.append(h('div', { class: 'load-row' }, n, h('span', {}, 'condutores de'), s, h('button', { class: 'btn icon sm danger', onclick: () => { conds.splice(i, 1); render(); run(); } }, '✕')));
      });
      lt.append(h('button', { class: 'btn sm', onclick: () => { conds.push({ n: 2, s: 4 }); render(); run(); } }, '+ condutores'));
    };
    function run() {
      const tot = conds.reduce((s, c) => s + c.n, 0), Ac = conds.reduce((s, c) => s + c.n * Math.PI * DCOND[c.s] ** 2 / 4, 0);
      const tx = tot === 1 ? 0.53 : tot === 2 ? 0.31 : 0.40;
      const d = DUTOS.find(([, di]) => Math.PI * di * di / 4 * tx >= Ac);
      out.innerHTML = '';
      out.append(CS.kv([['Total de condutores', tot], ['Área ocupada pelos condutores', `${K.n(Ac)} mm²`], ['Taxa máxima de ocupação', `${tx * 100} %`], ['Eletroduto mínimo', d ? `<b class="good">DN ${d[0]} (Ø interno ≈ ${d[1]} mm)</b> — ocupação ${K.n(Ac / (Math.PI * d[1] ** 2 / 4) * 100, 3)} %` : '<b class="bad">acima de DN 85: divida em mais eletrodutos</b>']]), h('div', { class: 'muted small' }, 'Diâmetros externos aproximados de condutores isolados 450/750 V e diâmetros internos aproximados de eletrodutos de PVC.'));
      cv.draw = (g, W, H) => {
        if (!d) return;
        const R = Math.min(W, H) / 2 - 20, cx = W / 2, cy = H / 2, s = R / (d[1] / 2);
        g.strokeStyle = '#9fb4d0'; g.lineWidth = 3; g.beginPath(); g.arc(cx, cy, R, 0, 7); g.stroke();
        const list = []; conds.forEach(c => { for (let i = 0; i < c.n; i++) list.push(c.s); });
        let ang = 0, ring = 0, idx = 0;
        const cols = ['#ff4d6d', '#4fb3ff', '#3ddc84', '#ffd166', '#c3d3e8', '#ff9f1c'];
        for (const sec of list) {
          const r = DCOND[sec] / 2 * s, rr = Math.max(0, R - r - 2 - ring * (r * 2 + 2));
          const x = cx + rr * Math.cos(ang), y = cy + rr * Math.sin(ang);
          g.fillStyle = cols[idx % cols.length]; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); g.fillStyle = '#c87533'; g.beginPath(); g.arc(x, y, r * 0.55, 0, 7); g.fill();
          ang += (2 * r + 2) / Math.max(1, rr); if (ang > Math.PI * 2 - 0.2) { ang = 0; ring++; } idx++;
        }
      };
      cv.redraw();
    }
    render(); run();
  }
  const AMBS = [['500', 'Escritório (500 lx)'], ['300', 'Sala de aula (300 lx)'], ['500', 'Laboratório (500 lx)'], ['300', 'Oficina, trabalho médio (300 lx)'], ['750', 'Desenho técnico (750 lx)'], ['200', 'Residência, sala de estar (≈ 200 lx)'], ['100', 'Corredor, circulação (100 lx)'], ['150', 'Depósito, almoxarifado (150 lx)']];
  function secLum(area) {
    const f = K.form([{ k: 'C', l: 'Comprimento', u: 'm', v: '10' }, { k: 'L', l: 'Largura', u: 'm', v: '6' }, { k: 'hm', l: 'Altura da luminária ao plano de trabalho', u: 'm', v: '2.2' }, { k: 'E', l: 'Ambiente / iluminância', type: 'sel', v: '500', opts: AMBS.map(([v, l], i) => [v + '|' + i, l]).map(x => [x[0], x[1]]) },
      { k: 'phi', l: 'Fluxo por luminária', u: 'lm', v: '4000' }, { k: 'W', l: 'Potência por luminária', u: 'W', v: '36' }, { k: 'refl', l: 'Refletâncias (teto/parede/piso)', type: 'sel', v: 'm', opts: [['c', 'claras (70/50/20)'], ['m', 'médias (50/30/10)'], ['e', 'escuras (30/10/10)']] }, { k: 'FM', l: 'Fator de manutenção', u: '', v: '0.8' }], () => run(), { cols: 2 });
    const out = h('div'), cvc = CS.card('Planta com a distribuição das luminárias');
    area.append(h('div', { class: 'grid2' }, h('div', { class: 'col' }, CS.card('Dados', f.el), CS.card('Resultados', out)), cvc));
    const cv = K.canvas(cvc, 320, null);
    function run() {
      const { C, L, hm, phi, W, FM } = f.st, Ereq = parseFloat(f.st.E), A = C * L, Kr = A / (hm * (C + L));
      const base = { c: 0.62, m: 0.52, e: 0.42 }[f.st.refl], FU = base * (1 - Math.exp(-Kr / 1.2)) + 0.05;
      const N = Math.ceil(Ereq * A / (phi * FU * FM));
      let nx = Math.max(1, Math.round(Math.sqrt(N * C / L))), ny = Math.ceil(N / nx); if (nx * ny < N) ny++;
      const Nr = nx * ny, Er = Nr * phi * FU * FM / A;
      out.innerHTML = '';
      out.append(CS.kv([['Área', `${K.n(A)} m²`], ['Índice do recinto K', K.n(Kr, 3)], ['Fator de utilização (estimado)', K.n(FU, 3)], ['Luminárias necessárias', `${N} → arranjo ${nx} × ${ny} = <b>${Nr}</b>`], ['Iluminância média obtida', `${K.n(Er)} lx (meta ${Ereq} lx)`], ['Espaçamento', `${K.n(C / nx)} m × ${K.n(L / ny)} m (≈ ${K.n(C / nx / 2)} m das paredes)`], ['Densidade de potência', `${K.n(Nr * W / A)} W/m²`]]), h('div', { class: 'muted small' }, 'FU estimado a partir de K e das refletâncias (curva típica). Para projeto, use a tabela fotométrica do fabricante.'));
      cv.draw = (g, Wd, H) => {
        const s = Math.min((Wd - 40) / C, (H - 40) / L), x0 = (Wd - C * s) / 2, y0 = (H - L * s) / 2;
        g.fillStyle = '#0b1322'; g.fillRect(x0, y0, C * s, L * s); g.strokeStyle = '#9fb4d0'; g.lineWidth = 2; g.strokeRect(x0, y0, C * s, L * s);
        for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) { const x = x0 + (i + 0.5) * C / nx * s, y = y0 + (j + 0.5) * L / ny * s; const gr = g.createRadialGradient(x, y, 2, x, y, Math.max(C / nx, L / ny) * s * 0.8); gr.addColorStop(0, 'rgba(255,230,150,0.35)'); gr.addColorStop(1, 'rgba(255,230,150,0)'); g.fillStyle = gr; g.fillRect(x0, y0, C * s, L * s); g.fillStyle = '#ffd166'; g.fillRect(x - 10, y - 3, 20, 6); }
        g.fillStyle = '#c3d3e8'; g.font = '11px Barlow'; g.textAlign = 'center'; g.fillText(`${C} m`, x0 + C * s / 2, y0 - 6);
      };
      cv.redraw();
    }
    run();
  }
  const ENSAIOS = [
    ['Inspeção visual', 'Conformidade com o projeto, identificação dos circuitos, cores dos condutores, dispositivos adequados, sem danos.'],
    ['Continuidade dos condutores de proteção', 'Medir a continuidade do PE e das ligações equipotenciais (ohmímetro de baixa resistência).'],
    ['Resistência de isolamento', 'Megôhmetro: circuitos até 500 V → ensaio com 500 V CC, resultado ≥ 0,5 MΩ (NBR 5410, Tabela 60).'],
    ['Seccionamento automático', 'Verificar a impedância do laço de falta (TN) ou a resistência de aterramento + DR (TT).'],
    ['Funcionamento do DR', 'Botão de teste e ensaio com corrente diferencial (atua até I<sub>Δn</sub> em ≤ 300 ms).'],
    ['Polaridade', 'Os dispositivos unipolares devem seccionar a fase, não o neutro.'],
    ['Ensaio de tensão aplicada / funcional', 'Conjuntos montados no local; verificar o funcionamento dos comandos e intertravamentos.'],
    ['Queda de tensão', 'Medir nos pontos mais distantes com carga, ou verificar pelo cálculo.'],
  ];
  const DESENERG = ['Seccionamento', 'Impedimento de reenergização (bloqueio e etiquetagem)', 'Constatação da ausência de tensão (detector testado antes e depois)', 'Instalação de aterramento temporário com equipotencialização dos condutores', 'Proteção dos elementos energizados existentes na zona controlada', 'Instalação da sinalização de impedimento de reenergização'];
  function secExec(area) {
    const done = new Set();
    const mk = (title, items, key, ordered) => {
      const box = h('div'); const prog = h('div', { class: 'hbar' }, h('div', { class: 'hbar-fill', style: 'width:0%;background:#3ddc84' }));
      const upd = () => { const n = items.filter((_, i) => done.has(key + i)).length; prog.firstChild.style.width = n / items.length * 100 + '%'; };
      items.forEach((it, i) => {
        const [t, d] = Array.isArray(it) ? it : [it, ''];
        const cb = h('input', { type: 'checkbox' });
        cb.addEventListener('change', () => { if (ordered && cb.checked && i > 0 && !done.has(key + (i - 1))) { cb.checked = false; alert('Siga a sequência da NR-10: conclua a etapa anterior primeiro.'); return; } cb.checked ? done.add(key + i) : done.delete(key + i); upd(); });
        box.append(h('label', { class: 'chk-item' }, cb, h('div', {}, h('b', {}, `${ordered ? i + 1 + '. ' : ''}${t}`), d ? h('div', { class: 'muted small', html: d }) : null)));
      });
      return CS.card(title, prog, box);
    };
    area.append(h('div', { class: 'grid2' }, mk('Ensaios da verificação final (NBR 5410, seção 7)', ENSAIOS, 'e'), mk('Desenergização segura — NR-10 (10.5.1), em ordem', DESENERG, 'd', true)));
  }

  /* ════════════════ 5. APLICAÇÕES ESPECIAIS E TENDÊNCIAS ════════════════ */
  const toolApl = (host, onClean) => {
    const { body } = CS.page(host, {
      title: 'Aplicações Especiais e Tendências', lead: 'Acionamento de motores e comandos elétricos básicos, energia solar fotovoltaica, mobilidade elétrica e automação residencial.',
      learn: `<p><b>Motores de indução:</b> I<sub>n</sub> = P/(√3·V·η·cosφ); rotação síncrona n<sub>s</sub> = 120·f/p. A partida direta absorve de 6 a 8·I<sub>n</sub>. Na <b>estrela-triângulo</b>, corrente e torque de partida caem para 1/3. A <b>soft-starter</b> limita a corrente por rampa de tensão, e o <b>inversor de frequência</b> varia f e V (V/f constante), partindo com cerca de I<sub>n</sub> e controlando a velocidade.</p>
      <p><b>Comandos:</b> contatores (bobina + contatos de força e auxiliares), relé térmico (sobrecarga), botoeiras (NA liga, NF desliga), <b>selo</b> (contato auxiliar NA em paralelo com o botão liga) e <b>intertravamento</b> (contato NF de um contator impede o outro).</p>
      <p><b>Fotovoltaica:</b> potência necessária kWp = consumo/(30·HSP·PR), com HSP = horas de sol pleno (kWh/m²·dia) e PR ≈ 0,75–0,85 (perdas). A curva I-V do módulo tem um ponto de máxima potência (MPP), que o inversor rastreia (MPPT). O frio aumenta a tensão: verifique V<sub>oc</sub> na temperatura mínima contra o limite do inversor.</p>
      <p><b>Mobilidade elétrica:</b> recarga AC (modos 2 e 3, carregador de bordo até ~11–22 kW) e DC rápida (modo 4, 50–350 kW). Acima de ~80% de carga a potência DC cai (fase de tensão constante). NBR 17019: circuito dedicado e DR adequado.</p>
      <p><b>Automação residencial:</b> sensores (presença, luminosidade, temperatura) + atuadores (relés, dimmers, motores de persiana) + regras e cenas. Protocolos: Wi-Fi, Zigbee, Z-Wave, Bluetooth Mesh, Thread/Matter, KNX (cabeado).</p>`,
    });
    onClean(K.sections(body, 'apl', [
      { id: 'motor', label: 'Acionamento de motores', render: secMotor }, { id: 'cmd', label: 'Comandos básicos', render: secComandos },
      { id: 'fv', label: 'Energia solar fotovoltaica', render: secFV }, { id: 've', label: 'Mobilidade elétrica', render: secVE }, { id: 'auto', label: 'Automação residencial', render: secAutomacao },
    ]));
  };
  function secMotor(area) {
    const f = K.form([{ k: 'P', l: 'Potência', u: 'cv', v: '10' }, { k: 'V', l: 'Tensão de linha', type: 'sel', v: '380', opts: ['220', '380', '440'] }, { k: 'pol', l: 'Polos', type: 'sel', v: '4', opts: ['2', '4', '6', '8'] }, { k: 'eta', l: 'Rendimento', u: '%', v: '89' }, { k: 'fp', l: 'Fator de potência', u: '', v: '0.84' }, { k: 'ipin', l: 'Ip/In', u: '', v: '7' }, { k: 'cp', l: 'Cp/Cn (partida)', u: '', v: '2.3' }, { k: 'load', l: 'Carga', type: 'sel', v: 'q', opts: [['c', 'torque constante (esteira, compressor)'], ['q', 'torque quadrático (bomba, ventilador)']] }], () => run(), { cols: 2 });
    const out = h('div'), b1 = CS.chartBox(), b2 = CS.chartBox();
    area.append(h('div', { class: 'grid2' }, h('div', { class: 'col' }, CS.card('Motor de indução trifásico', f.el), CS.card('Resultados', out)), h('div', { class: 'col' }, CS.card('Torque × rotação', b1), CS.card('Corrente × rotação', b2))));
    const c1 = new MS.Chart(b1, { xlabel: 'rotação [rpm]', ylabel: 'T / Tn', includeOrigin: true, readout: (x, y) => `${K.n(x)} rpm\n${K.n(y)}·Tn` }), c2 = new MS.Chart(b2, { xlabel: 'rotação [rpm]', ylabel: 'I / In', includeOrigin: true, readout: (x, y) => `${K.n(x)} rpm\n${K.n(y)}·In` });
    function run() {
      const P = f.st.P * 735.5, V = +f.st.V, p = +f.st.pol, eta = f.st.eta / 100, fp = f.st.fp;
      const In = P / (Math.sqrt(3) * V * eta * fp), ns = 7200 / p, sn = 0.03, n = ns * (1 - sn), Tn = P / (n * 2 * Math.PI / 60);
      const Cmax = Math.max(f.st.cp * 1.15, 2.6);
      const A = Cmax / f.st.cp; const sm = A - Math.sqrt(A * A - 1);
      const Tk = s => 2 * Cmax / (s / sm + sm / s);
      const scale = 1 / Tk(sn);
      const ipin = f.st.ipin, sk = sn * Math.sqrt(ipin * ipin - 1), Is = s => ipin * s / Math.sqrt(s * s + sk * sk);
      const ss = K.linspace(1, 0.001, 200), rpm = ss.map(s => ns * (1 - s));
      const TL = s => (f.st.load === 'c' ? 0.9 : 0.1 + 0.8 * ((1 - s) / (1 - sn)) ** 2);
      c1.set({ series: [{ x: rpm, y: ss.map(s => Tk(s) * scale), color: '#4fb3ff', width: 2, name: 'direta' }, { x: rpm, y: ss.map(s => Tk(s) * scale / 3), color: '#ffd166', width: 2, name: 'estrela (1/3)' }, { x: rpm, y: ss.map(TL), color: '#ff4d6d', width: 2, dash: [5, 4], name: 'carga' }] });
      c2.set({ series: [{ x: rpm, y: ss.map(Is), color: '#4fb3ff', width: 2, name: 'direta' }, { x: rpm, y: ss.map(s => Is(s) / 3), color: '#ffd166', width: 2, name: 'estrela' }, { x: rpm, y: ss.map(s => Math.min(Is(s), 3)), color: '#3ddc84', width: 2, name: 'soft-starter (lim. 3·In)' }, { x: [0, ns], y: [1.2, 1.2], color: '#c77dff', width: 2, name: 'inversor (≈ In)' }] });
      const okY = Tk(1) * scale / 3 > TL(1);
      out.innerHTML = '';
      out.append(CS.kv([['Corrente nominal I<sub>n</sub>', `<b>${K.n(In)} A</b>`], ['Rotação síncrona · nominal', `${ns} · ${K.n(n)} rpm`], ['Torque nominal', `${K.n(Tn)} N·m`], ['Partida direta', `${K.n(In * ipin)} A`], ['Estrela-triângulo', `${K.n(In * ipin / 3)} A · torque ${K.n(f.st.cp / 3, 3)}·Tn ${okY ? '<span class="good">✓ vence a carga</span>' : '<span class="bad">✗ não vence a carga na partida</span>'}`], ['Soft-starter / inversor', `≈ ${K.n(3 * In)} A / ≈ ${K.n(1.2 * In)} A`],
        ['Contator (AC-3)', `≥ ${K.n(In)} A`], ['Relé térmico', `faixa contendo ${K.n(In)} A (ajuste em I<sub>n</sub>)`], ['Cabo (estimativa)', `≥ ${K.n(1.25 * In)} A de capacidade`]]));
    }
    run();
  }
  /* comandos elétricos: lógica de relés com selo, intertravamento e temporizador */
  const CMDS = {
    direta: { nome: 'Partida direta com selo', botoes: [['S0', 'NF', 'Desliga'], ['S1', 'NA', 'Liga']], ramos: [{ c: [['F7', 'NF'], ['S0', 'NF'], [['S1', 'NA'], ['K1', 'NA']]], b: 'K1' }, { c: [['K1', 'NA']], b: 'H1', lamp: '#3ddc84' }], motor: s => (s.K1 ? 1 : 0) },
    reversao: { nome: 'Reversão com intertravamento', botoes: [['S0', 'NF', 'Desliga'], ['S1', 'NA', 'Horário'], ['S2', 'NA', 'Anti-horário']], ramos: [{ c: [['S0', 'NF'], [['S1', 'NA'], ['K1', 'NA']], ['K2', 'NF']], b: 'K1' }, { c: [['S0', 'NF'], [['S2', 'NA'], ['K2', 'NA']], ['K1', 'NF']], b: 'K2' }], motor: s => (s.K1 ? 1 : s.K2 ? -1 : 0) },
    yd: { nome: 'Estrela-triângulo automática', botoes: [['S0', 'NF', 'Desliga'], ['S1', 'NA', 'Liga']], ramos: [{ c: [['S0', 'NF'], [['S1', 'NA'], ['K1', 'NA']]], b: 'K1' }, { c: [['K1', 'NA']], b: 'KT', timer: 3 }, { c: [['K1', 'NA'], ['KT', 'NF'], ['K3', 'NF']], b: 'K2' }, { c: [['K1', 'NA'], ['KT', 'NA'], ['K2', 'NF']], b: 'K3' }], motor: s => (s.K1 && s.K2 ? 0.55 : s.K1 && s.K3 ? 1 : 0) },
  };
  function secComandos(area, onClean) {
    const f = K.form([{ k: 'c', l: 'Circuito de comando', type: 'sel', v: 'direta', opts: Object.entries(CMDS).map(([k, v]) => [k, v.nome]) }], () => reset(), { cols: 1 });
    const btns = h('div', { class: 'row gap wrap' }), cvc = CS.card('Diagrama de comando (verde = energizado)');
    area.append(h('div', { class: 'row gap wrap' }, f.el, btns, h('button', { class: 'btn sm', onclick: () => { st.F7 = !st.F7; } }, 'simular sobrecarga (relé térmico F7)')), cvc);
    const cv = K.canvas(cvc, 380, null);
    let st = {}, press = {}, tStart = 0, ang = 0, w = 0;
    function reset() {
      st = { F7: false }; press = {}; ang = 0; w = 0;
      btns.innerHTML = '';
      for (const [tag, tipo, nome] of CMDS[f.st.c].botoes) {
        const b = h('button', { class: 'btn ' + (tipo === 'NF' ? 'danger' : 'run') }, `${tag} ${nome} (${tipo})`);
        b.addEventListener('pointerdown', () => { press[tag] = true; }); const up = () => { press[tag] = false; }; b.addEventListener('pointerup', up); b.addEventListener('pointerleave', up);
        btns.append(b);
      }
    }
    const val = (tag, tipo) => { let v; if (tag === 'F7') v = !!st.F7; else if (tag[0] === 'S') v = !!press[tag]; else v = !!st[tag + (tag === 'KT' ? '_done' : '')]; return tipo === 'NA' ? v : !v; };
    const evalEl = el => (Array.isArray(el[0]) ? el.some(sub => evalEl(sub)) : val(el[0], el[1]));
    function step(dt) {
      const C = CMDS[f.st.c];
      for (let it = 0; it < 4; it++) for (const r of C.ramos) { const on = r.c.every(evalEl); if (r.timer) { if (on) { st.KT_t = (st.KT_t || 0) + dt / 4; } else st.KT_t = 0; st.KT = on; st.KT_done = on && st.KT_t >= r.timer; } else st[r.b] = on; }
      const target = C.motor(st); w += (target - w) * Math.min(1, dt * 2); ang += w * dt * 12;
    }
    onClean(K.animate(cv.box, () => { step(1 / 60); cv.redraw(); }));
    cv.draw = (g, W, H) => {
      const C = CMDS[f.st.c], nr = C.ramos.length, top = 30, bot = H - 30, colW = Math.min(150, (W - 220) / nr);
      g.strokeStyle = '#ff4d6d'; g.lineWidth = 3; g.beginPath(); g.moveTo(30, top); g.lineTo(30 + nr * colW + 20, top); g.stroke(); g.fillStyle = '#ff4d6d'; g.font = '12px Barlow'; g.fillText('L', 14, top + 4);
      g.strokeStyle = '#4fb3ff'; g.beginPath(); g.moveTo(30, bot); g.lineTo(30 + nr * colW + 20, bot); g.stroke(); g.fillStyle = '#4fb3ff'; g.fillText('N', 14, bot + 4);
      C.ramos.forEach((r, i) => {
        const x = 50 + i * colW + colW / 2, n = r.c.length + 1, dy = (bot - top) / (n + 0.5);
        let y = top, live = true;
        const seg = (y1, y2, on) => { g.strokeStyle = on ? '#3ddc84' : '#4a6488'; g.lineWidth = 2; g.beginPath(); g.moveTo(x, y1); g.lineTo(x, y2); g.stroke(); };
        const contact = (tag, tipo, xx, yy, on, closed) => { g.strokeStyle = closed ? '#3ddc84' : '#8fa3bd'; g.lineWidth = 2; g.beginPath(); g.moveTo(xx, yy - 8); g.lineTo(xx, yy - 4); g.moveTo(xx, yy + 8); g.lineTo(xx, yy + 4); g.stroke(); g.beginPath(); if (closed) { g.moveTo(xx, yy - 4); g.lineTo(xx, yy + 4); } else { g.moveTo(xx, yy - 4); g.lineTo(xx + 7, yy + 4); } g.stroke(); if (tipo === 'NF') { g.beginPath(); g.moveTo(xx - 4, yy - 2); g.lineTo(xx + 4, yy - 2); g.stroke(); } g.fillStyle = '#c3d3e8'; g.font = '10px Share Tech Mono'; g.textAlign = 'left'; g.fillText(`${tag} ${tipo}`, xx + 10, yy + 3); void on; };
        r.c.forEach(el => {
          const y2 = y + dy;
          if (Array.isArray(el[0])) {
            const any = el.some(sub => val(sub[0], sub[1]));
            seg(y, y + dy * 0.3, live);
            el.forEach((sub, k) => { const xx = x + (k - (el.length - 1) / 2) * 40; const cl = val(sub[0], sub[1]); g.strokeStyle = live ? '#3ddc84' : '#4a6488'; g.beginPath(); g.moveTo(x, y + dy * 0.3); g.lineTo(xx, y + dy * 0.3); g.lineTo(xx, y + dy * 0.5 - 8); g.stroke(); contact(sub[0], sub[1], xx, y + dy * 0.5, live, cl); g.strokeStyle = live && cl ? '#3ddc84' : '#4a6488'; g.beginPath(); g.moveTo(xx, y + dy * 0.5 + 8); g.lineTo(xx, y + dy * 0.7); g.lineTo(x, y + dy * 0.7); g.stroke(); });
            live = live && any; seg(y + dy * 0.7, y2, live);
          } else { const cl = val(el[0], el[1]); seg(y, y + dy / 2 - 8, live); contact(el[0], el[1], x, y + dy / 2, live, cl); live = live && cl; seg(y + dy / 2 + 8, y2, live); }
          y = y2;
        });
        const energ = live; seg(y, y + dy * 0.2, energ);
        const yb = y + dy * 0.2;
        if (r.lamp) { g.strokeStyle = energ ? r.lamp : '#8fa3bd'; g.fillStyle = energ ? r.lamp : 'transparent'; g.beginPath(); g.arc(x, yb + 12, 11, 0, 7); g.fill(); g.stroke(); }
        else { g.fillStyle = energ ? 'rgba(61,220,132,0.3)' : 'transparent'; g.strokeStyle = energ ? '#3ddc84' : '#8fa3bd'; g.fillRect(x - 14, yb, 28, 22); g.strokeRect(x - 14, yb, 28, 22); }
        g.fillStyle = '#e8f4ff'; g.font = '11px Share Tech Mono'; g.textAlign = 'center'; g.fillText(r.b + (r.timer ? ` ${r.timer}s` : ''), x, yb + 36);
        seg(yb + 22, bot, energ);
      });
      // motor
      const mx = W - 90, my = H / 2;
      g.fillStyle = '#2b4a78'; g.beginPath(); g.arc(mx, my, 40, 0, 7); g.fill(); g.save(); g.translate(mx, my); g.rotate(ang); g.fillStyle = '#ff9f1c'; for (let k = 0; k < 3; k++) { g.rotate(Math.PI * 2 / 3); g.fillRect(-4, -34, 8, 28); } g.restore();
      g.fillStyle = '#c3d3e8'; g.font = '12px Barlow'; g.textAlign = 'center'; g.fillText(Math.abs(w) < 0.02 ? 'motor parado' : `${w > 0 ? '↻' : '↺'} ${Math.round(Math.abs(w) * 1750)} rpm`, mx, my + 60);
      if (f.st.c === 'yd') g.fillText(st.K1 && st.K2 ? 'ligação ESTRELA' : st.K1 && st.K3 ? 'ligação TRIÂNGULO' : '', mx, my + 78);
      if (st.F7) { g.fillStyle = '#ff4d6d'; g.fillText('F7 atuado (sobrecarga)', mx, my - 56); }
    };
    reset();
  }
  const HSP = [['5.5', 'Brasília (5,5)'], ['4.6', 'São Paulo (4,6)'], ['5.0', 'Rio de Janeiro (5,0)'], ['5.2', 'Belo Horizonte (5,2)'], ['5.8', 'Fortaleza (5,8)'], ['5.6', 'Recife (5,6)'], ['4.7', 'Manaus (4,7)'], ['4.5', 'Porto Alegre (4,5)'], ['4.4', 'Curitiba (4,4)'], ['5.3', 'Goiânia (5,3)']];
  function secFV(area) {
    const f = K.form([{ k: 'cons', l: 'Consumo médio', u: 'kWh/mês', v: '450' }, { k: 'hsp', l: 'Cidade (HSP kWh/m²·dia)', type: 'sel', v: '5.5', opts: HSP }, { k: 'pr', l: 'Performance ratio PR', u: '', v: '0.8' }, { k: 'tar', l: 'Tarifa', u: 'R$/kWh', v: '0.95' }, { k: 'custo', l: 'Custo instalado', u: 'R$/Wp', v: '3.5' },
      { sep: 'Módulo (STC)' }, { k: 'Pm', l: 'Potência', u: 'Wp', v: '550' }, { k: 'Voc', l: 'Voc', u: 'V', v: '49.6' }, { k: 'Isc', l: 'Isc', u: 'A', v: '14.0' }, { k: 'Vmp', l: 'Vmp', u: 'V', v: '41.7' }, { k: 'Imp', l: 'Imp', u: 'A', v: '13.2' }, { k: 'G', l: 'Irradiância (curva)', u: 'W/m²', v: '1000' }, { k: 'Tc', l: 'Temperatura da célula', u: '°C', v: '45' }, { k: 'Vinv', l: 'Tensão máx. do inversor', u: 'V', v: '600' }, { k: 'Tmin', l: 'Temperatura mínima local', u: '°C', v: '5' }], () => run(), { cols: 2 });
    const out = h('div'), b1 = CS.chartBox(), b2 = CS.chartBox('sm');
    area.append(h('div', { class: 'grid2' }, h('div', { class: 'col' }, CS.card('Dados', f.el), CS.card('Dimensionamento', out)), h('div', { class: 'col' }, CS.card('Curvas I-V e P-V do módulo', b1), CS.card('Geração mensal estimada × consumo', b2))));
    const c1 = new MS.Chart(b1, { xlabel: 'V [V]', ylabel: 'I [A] · P/40 [W]', includeOrigin: true, readout: (x, y) => `V = ${K.n(x)} V\n${K.n(y)}` }), c2 = new MS.Chart(b2, { xlabel: 'mês', ylabel: 'kWh', includeOrigin: true, readout: (x, y) => `mês ${Math.round(x)}\n${K.n(y)} kWh` });
    function run() {
      const s = f.st, hsp = +s.hsp;
      const kWp = s.cons / (30 * hsp * s.pr), nmod = Math.ceil(kWp * 1000 / s.Pm), kWr = nmod * s.Pm / 1000;
      const C2 = (s.Vmp / s.Voc - 1) / Math.log(1 - s.Imp / s.Isc), C1 = (1 - s.Imp / s.Isc) * Math.exp(-s.Vmp / (C2 * s.Voc));
      const curve = (G, T) => { const isc = s.Isc * G / 1000 * (1 + 0.0005 * (T - 25)), voc = s.Voc * (1 - 0.0029 * (T - 25)) + 0.025 * s.Voc * Math.log(Math.max(G, 1) / 1000) / Math.log(10) * 0.6; const V = K.linspace(0, Math.max(0, voc), 120); const I = V.map(v => Math.max(0, isc * (1 - C1 * (Math.exp(v / (C2 * voc)) - 1)))); return { V, I }; };
      const series = [], markers = [];
      [1000, 800, 600, 400, 200].forEach((G, k) => { const c = curve(G, s.Tc); series.push({ x: c.V, y: c.I, color: ['#ffd166', '#ffb04a', '#ff9f1c', '#f78c6b', '#c77dff'][k], width: G === Math.round(s.G / 200) * 200 ? 2.6 : 1.4, name: k === 0 ? '1000 → 200 W/m²' : undefined }); const P = c.V.map((v, i) => v * c.I[i]); const im = P.indexOf(Math.max(...P)); markers.push({ x: c.V[im], y: c.I[im], shape: 'dot', color: '#fff', size: 4 }); });
      const cg = curve(s.G, s.Tc); const Pg = cg.V.map((v, i) => v * cg.I[i]);
      series.push({ x: cg.V, y: Pg.map(p => p / 40), color: '#3ddc84', width: 2, dash: [5, 4], name: 'P/40 (no G escolhido)' });
      c1.set({ series, markers });
      const months = [...Array(12)].map((_, i) => i + 1), gen = months.map(m => kWr * hsp * (1 + 0.15 * Math.cos(2 * Math.PI * (m - 1) / 12)) * 30 * s.pr);
      c2.set({ series: [{ x: months, y: gen, color: '#ffd166', width: 2.4, name: 'geração' }, { x: [1, 12], y: [s.cons, s.cons], color: '#4fb3ff', dash: [5, 4], width: 1.5, name: 'consumo' }] });
      const VocCold = s.Voc * (1 - 0.0029 * (s.Tmin - 25)), nSerMax = Math.floor(s.Vinv / VocCold);
      const inv = kWr * 1e3 * s.custo, econ = gen.reduce((a, b) => a + b, 0) * s.tar;
      out.innerHTML = '';
      out.append(CS.kv([['Potência necessária', `${K.n(kWp, 3)} kWp`], ['Módulos', `<b>${nmod} × ${s.Pm} Wp = ${K.n(kWr, 3)} kWp</b>`], ['Área aproximada', `${K.n(nmod * 2.6, 3)} m²`], ['Geração anual estimada', `${K.n(gen.reduce((a, b) => a + b, 0), 4)} kWh`],
        ['Inversor sugerido', `≈ ${K.n(kWr * 0.9, 3)} a ${K.n(kWr * 1.1, 3)} kW`], ['Voc a ' + s.Tmin + ' °C', `${K.n(VocCold, 3)} V → máx. ${nSerMax} módulos em série (inversor de ${s.Vinv} V)`],
        ['Investimento', `R$ ${K.n(inv, 4)}`], ['Economia anual', `R$ ${K.n(econ, 4)}`], ['Retorno simples (payback)', `<b>${K.n(inv / econ, 3)} anos</b>`]]), h('div', { class: 'muted small' }, 'Modelo empírico de módulo (Isc, Voc, Imp, Vmp) com coeficientes típicos de temperatura. Sazonalidade estimada. Custo de disponibilidade e Lei 14.300 não considerados.'));
    }
    run();
  }
  const CARREG = [['3.7', 'AC 3,7 kW (tomada / wallbox monofásico)'], ['7.4', 'AC 7,4 kW (wallbox)'], ['11', 'AC 11 kW (trifásico)'], ['22', 'AC 22 kW (limitado pelo carregador de bordo)'], ['50', 'DC 50 kW (rápido)'], ['150', 'DC 150 kW (ultrarrápido)'], ['350', 'DC 350 kW (HPC)']];
  function secVE(area) {
    const f = K.form([{ k: 'bat', l: 'Bateria útil', u: 'kWh', v: '60' }, { k: 'cons', l: 'Consumo', u: 'kWh/100 km', v: '16' }, { k: 's0', l: 'Carga inicial', u: '%', v: '20' }, { k: 's1', l: 'Carga final', u: '%', v: '80' }, { k: 'ch', l: 'Carregador', type: 'sel', v: '7.4', opts: CARREG }, { k: 'obc', l: 'Carregador de bordo (AC máx.)', u: 'kW', v: '11' }, { k: 'pdc', l: 'Potência DC máx. do veículo', u: 'kW', v: '130' },
      { sep: 'Custos (por mês)' }, { k: 'km', l: 'Rodagem', u: 'km/mês', v: '1500' }, { k: 'tar', l: 'Energia', u: 'R$/kWh', v: '0.95' }, { k: 'gas', l: 'Gasolina', u: 'R$/L', v: '6.2' }, { k: 'kml', l: 'Carro a combustão', u: 'km/L', v: '12' }], () => run(), { cols: 2 });
    const out = h('div'), cb = CS.chartBox('tall');
    area.append(h('div', { class: 'grid2' }, h('div', { class: 'col' }, CS.card('Veículo e recarga', f.el), CS.card('Resultados', out)), CS.card('Estado de carga × tempo', cb)));
    const ch = new MS.Chart(cb, { xlabel: 'tempo [min]', ylabel: 'carga [%]', yrange: [0, 100], readout: (x, y) => `${K.n(x)} min\n${K.n(y)} %` });
    function run() {
      const s = f.st, Pch = +s.ch, dc = Pch >= 50;
      const pmax = soc => dc ? Math.min(Pch, s.pdc * (soc < 50 ? 1 : soc < 80 ? 1 - (soc - 50) / 30 * 0.45 : 0.55 - (soc - 80) / 20 * 0.4)) : Math.min(Pch, s.obc) * (soc < 95 ? 1 : 0.6);
      const sim = (Pc, from, to) => { let soc = from, t = 0; const ts = [0], ys = [from]; while (soc < to && t < 3000) { const P = pmax(soc) * 0.92; soc += P / s.bat * 100 / 60; t += 1; ts.push(t); ys.push(Math.min(to, soc)); } return { ts, ys, t }; };
      const r = sim(Pch, s.s0, s.s1);
      ch.set({ series: [{ x: r.ts, y: r.ys, color: dc ? '#ff9f1c' : '#3ddc84', width: 2.4, name: CARREG.find(c => c[0] === s.ch)[1] }] });
      const E = s.bat * (s.s1 - s.s0) / 100 / 0.92, aut = s.bat / s.cons * 100;
      const custoVE = s.km * s.cons / 100 * s.tar, custoComb = s.km / s.kml * s.gas, co2 = s.km / s.kml * 2.3 - s.km * s.cons / 100 * 0.08;
      out.innerHTML = '';
      out.append(CS.kv([['Tempo de recarga', `<b>${r.t < 120 ? r.t + ' min' : K.n(r.t / 60, 3) + ' h'}</b> (${s.s0}% → ${s.s1}%)`], ['Energia retirada da rede', `${K.n(E, 3)} kWh (rendimento 92%)`], ['Custo da recarga', `R$ ${K.n(E * s.tar, 3)}`], ['Autonomia (100%)', `${K.n(aut, 3)} km`], ['Autonomia ganha', `${K.n(aut * (s.s1 - s.s0) / 100, 3)} km`],
        ['Custo mensal: elétrico × combustão', `R$ ${K.n(custoVE, 4)} × R$ ${K.n(custoComb, 4)} → economia de <b class="good">R$ ${K.n(custoComb - custoVE, 4)}</b>`], ['CO₂ evitado', `≈ ${K.n(co2, 3)} kg/mês (matriz brasileira ≈ 0,08 kg/kWh)`],
        ['Modo de recarga', dc ? 'Modo 4 — DC (CCS2 / CHAdeMO)' : Pch <= 3.7 ? 'Modo 2/3 — AC (cabo com controle ou wallbox)' : 'Modo 3 — AC wallbox (Tipo 2)']]));
    }
    run();
  }
  function secAutomacao(area, onClean) {
    const RULES = [
      ['luz', 'Presença + escuro → acende a luz do cômodo', true], ['fora', 'Modo "fora" → apaga tudo e arma o alarme', true], ['ac', 'Temperatura > ajuste → liga o ar-condicionado (histerese de 1 °C)', true],
      ['pers', 'Persianas abrem às 7 h e fecham às 18 h', true], ['dormir', 'Modo "dormir" → só a luz do corredor a 10%, AC em 24 °C', true], ['alarme', 'Alarme armado + presença → sirene e notificação', true],
    ];
    const rules = Object.fromEntries(RULES.map(r => [r[0], r[2]]));
    const f = K.form([{ k: 'hora', l: 'Hora do dia', u: 'h', v: '19' }, { k: 'modo', l: 'Modo da casa', type: 'sel', v: 'casa', opts: [['casa', 'Em casa'], ['fora', 'Fora'], ['dormir', 'Dormir']] }, { k: 'Tout', l: 'Temperatura externa', u: '°C', v: '31' }, { k: 'set', l: 'Ajuste do ar-condicionado', u: '°C', v: '24' }, { k: 'vel', l: 'Velocidade da simulação', type: 'sel', v: '60', opts: [['10', '10×'], ['60', '60× (1 min/s)'], ['600', '600×']] }], () => {}, { cols: 2 });
    const rooms = [{ n: 'Sala', x: 0, y: 0, w: 0.5, h: 0.55, pres: true }, { n: 'Cozinha', x: 0.5, y: 0, w: 0.25, h: 0.55, pres: false }, { n: 'Quarto', x: 0.75, y: 0, w: 0.25, h: 0.55, pres: false }, { n: 'Corredor', x: 0, y: 0.55, w: 1, h: 0.15, pres: false }, { n: 'Banheiro', x: 0, y: 0.7, w: 0.3, h: 0.3, pres: false }, { n: 'Quarto 2', x: 0.3, y: 0.7, w: 0.7, h: 0.3, pres: false }];
    const rl = h('div'), pres = h('div', { class: 'row gap wrap' }), log = h('div', { class: 'auto-log' }), cvc = CS.card('Planta da casa (clique num cômodo para alternar a presença)'), stat = h('div');
    RULES.forEach(([k, t]) => { const cb = h('input', { type: 'checkbox', checked: rules[k] ? '' : null }); cb.addEventListener('change', () => { rules[k] = cb.checked; }); rl.append(h('label', { class: 'chk-item' }, cb, h('div', {}, t))); });
    area.append(h('div', { class: 'grid2' }, h('div', { class: 'col' }, CS.card('Cenário', f.el), CS.card('Regras (SE … ENTÃO …)', rl), CS.card('Estado', stat), CS.card('Eventos', log)), cvc));
    const cv = K.canvas(cvc, 420, null);
    let t = f.st.hora * 3600, Tin = 27, ac = false, persAberta = true, alarme = false, sirene = false, kWh = 0, lastLog = '';
    const ev = m => { if (m === lastLog) return; lastLog = m; const hh = Math.floor(t / 3600) % 24, mm = Math.floor(t / 60) % 60; log.prepend(h('div', {}, `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')} — ${m}`)); while (log.children.length > 12) log.lastChild.remove(); };
    f.inputs.hora.addEventListener('change', () => { t = f.st.hora * 3600; });
    cv.cv.addEventListener('click', e => { const r = cv.cv.getBoundingClientRect(), x = (e.clientX - r.left - 20) / (cv.W - 40), y = (e.clientY - r.top - 20) / (cv.H - 40); const rm = rooms.find(q => x >= q.x && x <= q.x + q.w && y >= q.y && y <= q.y + q.h); if (rm) { rm.pres = !rm.pres; ev(`${rm.pres ? 'presença detectada' : 'cômodo vazio'}: ${rm.n}`); } });
    onClean(K.animate(cv.box, () => {
      const dt = +f.st.vel / 60; t += dt;
      const hr = (t / 3600) % 24, sol = Math.max(0, Math.sin((hr - 6) / 12 * Math.PI)), lux = (persAberta ? 600 : 60) * sol;
      const modo = f.st.modo;
      if (rules.pers) { const should = hr >= 7 && hr < 18; if (should !== persAberta) { persAberta = should; ev(`persianas ${should ? 'abertas' : 'fechadas'}`); } }
      alarme = rules.fora && modo === 'fora';
      sirene = rules.alarme && alarme && rooms.some(r => r.pres);
      if (sirene) ev('ALARME: presença com a casa armada → sirene + notificação');
      let P = 0.15;
      rooms.forEach(r => {
        let L = 0;
        if (modo === 'fora' && rules.fora) L = 0;
        else if (modo === 'dormir' && rules.dormir) L = r.n === 'Corredor' ? 0.1 : 0;
        else if (rules.luz && r.pres && lux < 200) L = 1;
        r.L = L; P += L * 0.012;
      });
      const set = modo === 'dormir' && rules.dormir ? 24 : f.st.set;
      if (rules.ac && modo !== 'fora') { if (!ac && Tin > set + 0.5) { ac = true; ev('ar-condicionado ligado'); } if (ac && Tin < set - 0.5) { ac = false; ev('ar-condicionado desligado'); } } else if (ac) { ac = false; ev('ar-condicionado desligado'); }
      Tin += ((f.st.Tout - Tin) / 3600 * 1.2 + sol * 0.0004 * (persAberta ? 1 : 0.3) - (ac ? 0.0012 : 0)) * dt;
      P += ac ? 1.3 : 0; kWh += P * dt / 3600;
      stat.innerHTML = '';
      stat.append(CS.kv([['Hora', `${String(Math.floor(hr)).padStart(2, '0')}:${String(Math.floor(hr % 1 * 60)).padStart(2, '0')}`], ['Luminosidade interna (natural)', `${K.n(lux, 3)} lx`], ['Temperatura interna', `${K.n(Tin, 3)} °C`], ['Ar-condicionado', ac ? '<b class="good">ligado</b>' : 'desligado'], ['Alarme', sirene ? '<b class="bad">DISPARADO</b>' : alarme ? '<b class="warn">armado</b>' : 'desarmado'], ['Potência · energia', `${K.n(P, 3)} kW · ${K.n(kWh, 3)} kWh`]]));
      cv.redraw();
    }));
    cv.draw = (g, W, H) => {
      const X = x => 20 + x * (W - 40), Y = y => 20 + y * (H - 40);
      const hr = (t / 3600) % 24, sol = Math.max(0, Math.sin((hr - 6) / 12 * Math.PI));
      g.fillStyle = `rgb(${10 + 30 * sol},${15 + 40 * sol},${30 + 60 * sol})`; g.fillRect(0, 0, W, H);
      rooms.forEach(r => {
        g.fillStyle = r.L > 0 ? `rgba(255,214,120,${0.2 + 0.55 * r.L})` : 'rgba(13,24,38,0.9)'; g.fillRect(X(r.x), Y(r.y), r.w * (W - 40), r.h * (H - 40));
        g.strokeStyle = '#9fb4d0'; g.lineWidth = 2; g.strokeRect(X(r.x), Y(r.y), r.w * (W - 40), r.h * (H - 40));
        g.fillStyle = '#e8f4ff'; g.font = '12px Barlow'; g.textAlign = 'left'; g.fillText(r.n, X(r.x) + 6, Y(r.y) + 16);
        if (r.pres) { g.fillStyle = '#4fb3ff'; g.beginPath(); g.arc(X(r.x + r.w / 2), Y(r.y + r.h / 2) - 6, 6, 0, 7); g.fill(); g.fillRect(X(r.x + r.w / 2) - 4, Y(r.y + r.h / 2), 8, 14); }
      });
      g.fillStyle = persAberta ? 'rgba(255,209,102,0.7)' : '#5a6270'; g.fillRect(X(0.05), Y(0) - 6, (W - 40) * 0.4, 6); g.fillStyle = '#c3d3e8'; g.font = '10px Barlow'; g.fillText(persAberta ? 'persiana aberta' : 'persiana fechada', X(0.06), Y(0) - 9);
      if (ac) { g.fillStyle = '#4fb3ff'; g.font = '16px Barlow'; g.fillText('❄ AC', X(0.8), Y(0.08)); }
      if (sirene && Math.floor(t / 30) % 2) { g.strokeStyle = '#ff4d6d'; g.lineWidth = 6; g.strokeRect(6, 6, W - 12, H - 12); }
    };
    area.append(CS.card('Protocolos de automação', K.table(['Protocolo', 'Meio', 'Alcance', 'Topologia', 'Observações'], [['Wi-Fi', '2,4/5 GHz', '≈ 30 m', 'estrela (roteador)', 'sem hub, maior consumo'], ['Zigbee', '2,4 GHz', '10–20 m', 'malha (mesh)', 'baixo consumo, precisa de coordenador'], ['Z-Wave', '868/908 MHz', '≈ 30 m', 'malha', 'menos interferência, ecossistema certificado'], ['Bluetooth Mesh', '2,4 GHz', '10–30 m', 'malha', 'integra com celulares'], ['Thread / Matter', '2,4 GHz (IPv6)', '≈ 20 m', 'malha IP', 'padrão unificador entre fabricantes'], ['KNX', 'par trançado / RF', 'barramento', 'barramento', 'padrão predial cabeado, robusto (EN 50090)']])));
  }

  CS.registerTab('inst', {
    title: 'Instalações Elétricas',
    tools: [
      { id: 'cond', label: 'Dimensionamento de condutores', desc: 'capacidade, queda, disjuntor', render: toolCond },
      { id: 'normas', label: 'Normas Técnicas e Segurança', desc: 'NBRs, NR-10, choque, IP', render: toolNormas },
      { id: 'prot', label: 'Dispositivos de Proteção e Aterramento', desc: 'disjuntor, DR, TN/TT/IT, SPDA', render: toolProt },
      { id: 'proj', label: 'Projeto, Infraestrutura e Execução', desc: 'cargas, quadro, eletrodutos, lux', render: toolProj },
      { id: 'apl', label: 'Aplicações Especiais e Tendências', desc: 'motores, comandos, FV, VE, automação', render: toolApl },
    ],
  });
})();
