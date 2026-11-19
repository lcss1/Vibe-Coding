/* ============================================================
   MecSPICE — Aba "Análise de estabilidade"
   Critério de Routh-Hurwitz · Lugar das raízes
   ============================================================ */
'use strict';
(function () {
  const CS = MS.CS, h = CS.h, P = CS.poly, R = CS.rat, cx = CS.cx;

  /* ───────── tabela de Routh ───────── */
  CS.routh = function (asc) {
    const a = P.trim(asc).slice().reverse();          // ordem decrescente
    const n = a.length - 1;
    const scale = Math.max(...a.map(Math.abs)) || 1;
    const EPS = 1e-6 * scale;
    const W = Math.ceil((n + 1) / 2);
    const rows = [];
    const r0 = [], r1 = [];
    for (let i = 0; i < W; i++) { r0.push(a[2 * i] || 0); r1.push(a[2 * i + 1] || 0); }
    rows.push({ p: n, v: r0, flag: '' });
    if (n >= 1) rows.push({ p: n - 1, v: r1, flag: '' });
    const notes = [];
    const tiny = v => Math.abs(v) < 1e-10 * scale;
    // linha 1 pode ser nula
    const fixRow = (k) => {
      const row = rows[k], prev = rows[k - 1];
      if (row.v.every(tiny)) {
        // linha nula → polinômio auxiliar da linha anterior
        const pw = prev.p;
        const aux = [];   // decrescente: coef de s^pw, s^(pw-2), ...
        prev.v.forEach((c, i) => { aux.push({ c, e: pw - 2 * i }); });
        row.v = prev.v.map((c, i) => c * (pw - 2 * i)).concat([0]).slice(0, W);
        row.flag = 'aux';
        const auxAsc = []; aux.forEach(t => { if (t.e >= 0) auxAsc[t.e] = t.c; });
        for (let i = 0; i < auxAsc.length; i++) auxAsc[i] = auxAsc[i] || 0;
        row.aux = auxAsc;
        notes.push(`Linha s<sup>${row.p}</sup> inteira nula → usa-se a derivada do polinômio auxiliar P(s) = ${CS.polyHTML(auxAsc)}. Indica raízes simétricas em relação à origem (por exemplo, pares ±jω).`);
      } else if (tiny(row.v[0])) {
        row.v[0] = EPS; row.flag = 'eps';
        notes.push(`Primeiro elemento da linha s<sup>${row.p}</sup> é zero → substituído por ε → 0⁺ (caso especial).`);
      }
    };
    if (rows[1]) fixRow(1);
    for (let k = 2; k <= n; k++) {
      const A = rows[k - 2].v, B = rows[k - 1].v;
      const v = [];
      for (let i = 0; i < W; i++) v.push(((B[0] * (A[i + 1] || 0)) - (A[0] * (B[i + 1] || 0))) / B[0]);
      rows.push({ p: n - k, v, flag: '' });
      fixRow(k);
    }
    const col = rows.map(r => r.v[0]);
    let changes = 0;
    for (let i = 1; i < col.length; i++) if (Math.sign(col[i]) !== Math.sign(col[i - 1]) && col[i] !== 0) changes++;
    const auxRow = rows.find(r => r.flag === 'aux');
    let jw = 0;
    if (auxRow) jw = P.roots(auxRow.aux).filter(z => Math.abs(z.re) < 1e-6 * Math.max(1, cx.abs(z))).length;
    return { rows, changes, notes, n, jw, W };
  };

  /* faixa de K (K>0) em que 1 + K·G·H é estável — varredura + bissecção */
  CS.kRange = function (GH) {
    const N = GH.num, D = GH.den;
    const stab = K => P.roots(P.add(D, P.scale(N, K))).every(z => z.re < -1e-9);
    const Ks = CS.logspace(1e-4, 1e6, 241);
    const out = [];
    let prev = stab(Ks[0]), start = prev ? 0 : null;
    const bis = (a, b, sa) => { for (let i = 0; i < 60; i++) { const m = Math.sqrt(a * b); if (stab(m) === sa) a = m; else b = m; } return Math.sqrt(a * b); };
    for (let i = 1; i < Ks.length; i++) {
      const s = stab(Ks[i]);
      if (s !== prev) { const kb = bis(Ks[i - 1], Ks[i], prev); if (s) start = kb; else { out.push([start, kb]); start = null; } }
      prev = s;
    }
    if (start !== null) out.push([start, Infinity]);
    // frequência de cruzamento do eixo jω nas fronteiras
    const cross = out.flatMap(([a, b]) => [a, b]).filter(k => k > 0 && isFinite(k)).map(k => {
      const z = P.roots(P.add(D, P.scale(N, k))).filter(q => Math.abs(q.re) < 1e-3 * Math.max(1, cx.abs(q)));
      return { K: k, w: z.length ? Math.max(...z.map(q => Math.abs(q.im))) : 0 };
    });
    return { ranges: out, cross };
  };
  const rangesText = rg => {
    if (!rg.ranges.length) return '<b class="bad">instável para todo K &gt; 0</b>';
    return rg.ranges.map(([a, b]) => `${a === 0 ? '0' : CS.fmtNum(a)} &lt; K &lt; ${isFinite(b) ? CS.fmtNum(b) : '∞'}`).join('  ou  ');
  };

  /* ───────── 1. Routh-Hurwitz ───────── */
  const toolRouth = (host, onClean) => {
    const { body } = CS.page(host, {
      title: 'Critério de Routh-Hurwitz', lead: 'Conta quantas raízes do polinômio característico estão no semiplano direito <i>sem calculá-las</i>, pelas trocas de sinal da 1ª coluna.',
      learn: `<p><b>Ideia:</b> a estabilidade em malha fechada depende das raízes de 1 + K·G·H = 0, ou seja, do polinômio característico Δ(s) = D(s) + K·N(s).</p>
      <p><b>Condição necessária:</b> todos os coeficientes presentes e com o mesmo sinal. Se faltar algum coeficiente ou houver troca de sinal, o sistema é instável (ou, no máximo, marginal).</p>
      <p><b>Montagem:</b> as duas primeiras linhas recebem os coeficientes alternados. Cada novo elemento vem de um "determinante cruzado":<br>b₁ = (a₁a₂ − a₀a₃)/a₁.</p>
      <p><b>Leitura:</b> nº de trocas de sinal na 1ª coluna = nº de raízes com Re &gt; 0.</p>
      <p><b>Casos especiais:</b><br>• <i>Zero na 1ª coluna</i>: substitua por ε pequeno e positivo e continue.<br>• <i>Linha inteira nula</i>: forme o polinômio auxiliar com a linha anterior e use sua derivada. As raízes do auxiliar são simétricas (pares ±jω indicam oscilação sustentada).</p>
      <p><b>Projeto:</b> fazendo a tabela com K literal, as condições "1ª coluna &gt; 0" dão a faixa de K estável. O limite superior é o <i>ganho crítico</i>, e a frequência de oscilação sai do polinômio auxiliar.</p>`,
    });
    const modeSel = h('div', { class: 'seg' }, h('button', { 'data-m': 'sys', class: 'on' }, '1 + K·G·H do sistema'), h('button', { 'data-m': 'poly' }, 'polinômio livre'));
    const polyIn = h('input', { class: 'tf-input', value: 's^4+2s^3+3s^2+4s+5', spellcheck: 'false' });
    const sb = h('div');
    const top = CS.card(null, modeSel, sb, h('div', { class: 'row gap poly-row', style: 'display:none' }, h('label', { class: 'lbl' }, 'Δ(s) ='), polyIn));
    const tableHost = h('div'), concl = h('div'), krange = h('div');
    body.append(top, h('div', { class: 'grid2' }, CS.card('Tabela de Routh', tableHost), CS.card('Conclusão', concl, krange)));
    let mode = 'sys';
    onClean(CS.sysBar(sb));
    modeSel.addEventListener('click', e => { if (!e.target.dataset.m) return; mode = e.target.dataset.m; modeSel.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.m === mode)); sb.style.display = mode === 'sys' ? '' : 'none'; top.querySelector('.poly-row').style.display = mode === 'poly' ? '' : 'none'; run(); });
    polyIn.addEventListener('change', () => run());
    const run = () => {
      tableHost.innerHTML = ''; concl.innerHTML = ''; krange.innerHTML = '';
      let chr, s = null;
      try {
        if (mode === 'sys') { s = CS.sys(); chr = P.add(s.L.den, s.L.num); }
        else { const r = CS.parse(polyIn.value); if (P.deg(r.den) > 0) throw new Error('digite um polinômio (sem divisão por s)'); chr = r.num.map(v => v / r.den[0]); }
      } catch (e) { tableHost.append(h('div', { class: 'err' }, e.message)); return; }
      chr = P.trim(chr);
      if (P.deg(chr) < 1) { tableHost.append(h('div', { class: 'muted' }, 'Polinômio de grau 0.')); return; }
      const rt = CS.routh(chr);
      const tbl = h('table', { class: 'tbl routh' });
      rt.rows.forEach((r, i) => {
        const prevS = i ? Math.sign(rt.rows[i - 1].v[0]) : Math.sign(r.v[0]);
        const flip = i && Math.sign(r.v[0]) !== prevS;
        tbl.append(h('tr', { class: r.flag },
          h('th', { html: `s<sup>${r.p}</sup>` }),
          ...r.v.map((v, j) => h('td', { class: j === 0 ? (v < 0 ? 'neg first' : 'first') + (flip ? ' flip' : '') : '', html: r.flag === 'eps' && j === 0 ? 'ε' : CS.fmtNum(v, 4) })),
          h('td', { class: 'flag', html: r.flag === 'aux' ? '← derivada do aux.' : r.flag === 'eps' ? '← ε' : flip ? '← troca de sinal' : '' })));
      });
      tableHost.append(h('div', { class: 'math', html: 'Δ(s) = ' + CS.polyHTML(chr) }), tbl, ...rt.notes.map(n => h('div', { class: 'note', html: n })));
      const missing = chr.some(v => v === 0) || chr.some(v => Math.sign(v) !== Math.sign(chr[chr.length - 1]));
      const roots = P.roots(chr);
      concl.append(CS.kv([
        ['Condição necessária', missing ? '<b class="bad">violada</b> (coeficiente nulo ou com sinal diferente)' : '<b class="good">ok</b> (todos os coeficientes com o mesmo sinal)'],
        ['Trocas de sinal na 1ª coluna', `<b>${rt.changes}</b> ⇒ ${rt.changes} raiz(es) no semiplano direito`],
        rt.jw ? ['Raízes sobre o eixo jω', `${rt.jw} (do polinômio auxiliar)`] : null,
        ['Veredito', rt.changes ? '<b class="bad">Instável</b>' : rt.jw ? '<b class="warn">Marginalmente estável</b>' : '<b class="good">Estável</b>'],
        ['Conferência (raízes)', roots.map(q => CS.fmtC(q, 3)).join(', ')],
      ]));
      if (s) {
        const rg = CS.kRange(s.GH);
        krange.append(h('div', { class: 'card-title' }, 'Faixa de ganho estável'), CS.kv([
          ['K estável', rangesText(rg), 'Obtida variando K e verificando a 1ª coluna (equivalente a resolver as desigualdades de Routh)'],
          ...rg.cross.filter(c => c.w > 0).map(c => [`Cruza jω em K = ${CS.fmtNum(c.K)}`, `ω = ${CS.fmtNum(c.w)} rad/s (oscilação sustentada)`]),
          ['K atual', `${CS.fmtNum(s.K)} → ${rg.ranges.some(([a, b]) => s.K > a && s.K < b) ? '<b class="good">dentro</b>' : '<b class="bad">fora</b>'} da faixa`],
        ]));
      }
    };
    const fn = () => { if (mode === 'sys') run(); };
    CS.onChange(fn); onClean(() => CS.offChange(fn));
    run();
  };

  /* ───────── lugar das raízes ───────── */
  CS.rootLocus = function (GH) {
    const N = P.trim(GH.num), D = P.trim(GH.den);
    const n = P.deg(D), m = P.deg(N);
    if (m > n) throw new Error('G·H imprópria: o lugar das raízes exige grau(num) ≤ grau(den).');
    const poles = P.roots(D), zeros = P.roots(N);
    const kScale = Math.abs(P.lead(D) / P.lead(N)) * Math.pow(Math.max(1, ...poles.map(cx.abs), ...zeros.map(cx.abs)), n - m);
    const chr = K => P.roots(P.add(D, P.scale(N, K)));
    const Ks = [0, ...CS.logspace(kScale * 1e-6, kScale * 1e5, 260)];
    const branches = poles.map(p => ({ pts: [{ ...p }], K: [0] }));
    let prev = poles.map(p => ({ ...p }));
    const span = Math.max(1, ...poles.map(cx.abs), ...zeros.map(cx.abs));
    const match = (pr, nx) => {
      const used = new Set(), res = [];
      for (const p of pr) { let bi = -1, bd = Infinity; nx.forEach((q, i) => { if (used.has(i)) return; const d = cx.abs(cx.sub(p, q)); if (d < bd) { bd = d; bi = i; } }); used.add(bi); res.push(nx[bi]); }
      return res;
    };
    const step = (K0, K1, depth) => {
      const r = chr(K1);
      if (r.length !== prev.length) return;
      const mm = match(prev, r);
      const jump = Math.max(...mm.map((q, i) => cx.abs(cx.sub(q, prev[i]))));
      if (jump > span * 0.04 && depth < 6) { const Km = K0 === 0 ? K1 / 10 : Math.sqrt(K0 * K1); step(K0, Km, depth + 1); step(Km, K1, depth + 1); return; }
      mm.forEach((q, i) => { branches[i].pts.push(q); branches[i].K.push(K1); });
      prev = mm;
    };
    for (let i = 1; i < Ks.length; i++) step(Ks[i - 1], Ks[i], 0);
    // assíntotas
    const na = n - m;
    const centroid = na > 0 ? (poles.reduce((s, p) => s + p.re, 0) - zeros.reduce((s, z) => s + z.re, 0)) / na : null;
    const angles = []; for (let q = 0; q < na; q++) angles.push((2 * q + 1) * 180 / na);
    // pontos de separação/chegada: N·D' − N'·D = 0, reais, K>0
    const bpoly = P.sub(P.mul(N, P.deriv(D)), P.mul(P.deriv(N), D));
    const breaks = P.roots(bpoly).filter(z => Math.abs(z.im) < 1e-6).map(z => ({ s: z.re, K: -P.evalR(D, z.re) / P.evalR(N, z.re) })).filter(b => b.K > 0 && isFinite(b.K));
    // ângulos de partida (polos complexos)
    const dep = poles.filter(p => p.im > 1e-9).map(p => {
      let a = 180;
      for (const z of zeros) a += cx.arg(cx.sub(p, z)) * 180 / Math.PI;
      for (const q of poles) if (q !== p) a -= cx.arg(cx.sub(p, q)) * 180 / Math.PI;
      return { p, a: ((a % 360) + 540) % 360 - 180 };
    });
    return { branches, poles, zeros, centroid, angles, breaks, dep, n, m, kScale, chr };
  };

  const toolRL = (host, onClean) => {
    const { body } = CS.page(host, {
      title: 'Lugar das raízes', lead: 'Trajetória dos polos de malha fechada, raízes de 1 + K·G(s)H(s) = 0, quando K varia de 0 a ∞. Arraste o controle de K ou clique sobre o lugar.',
      learn: `<p><b>Condições:</b> s está no lugar se ∠G(s)H(s) = 180°(2q+1) (<i>condição de ângulo</i>); o K correspondente vem de |K·G·H| = 1 (<i>condição de módulo</i>).</p>
      <p><b>Regras de esboço:</b></p><ol>
      <li>Nº de ramos = nº de polos de malha aberta (n).</li>
      <li>Os ramos começam nos polos (K = 0) e terminam nos zeros (K → ∞). Os n − m ramos restantes vão ao infinito.</li>
      <li>No eixo real, pertencem ao lugar os trechos à <i>esquerda de um número ímpar</i> de polos + zeros reais.</li>
      <li>Assíntotas: ângulos (2q+1)·180°/(n−m), centradas em σ = (Σpolos − Σzeros)/(n−m).</li>
      <li>Pontos de separação/chegada: raízes de dK/ds = 0, ou seja, N·D′ − N′·D = 0.</li>
      <li>Cruzamento com jω: pelo critério de Routh (ganho crítico).</li>
      <li>Ângulo de partida de um polo complexo: 180° + Σ∠zeros − Σ∠outros polos.</li></ol>
      <p><b>Leitura para projeto:</b> as linhas radiais são de ζ constante (ζ = cos θ). Escolha K onde os polos dominantes têm o ζ desejado (por exemplo, ζ = 0,5 ⇒ M<sub>p</sub> ≈ 16%).</p>`,
    });
    const sb = h('div'); onClean(CS.sysBar(sb, { noK: true }));
    const kIn = h('input', { type: 'range', min: 0, max: 1000, value: 500, class: 'k-slider' });
    const kVal = h('input', { class: 'k-val', value: CS.state.K, spellcheck: 'false' });
    const zg = h('label', { class: 'chk' }, h('input', { type: 'checkbox' }), ' linhas de ζ constante');
    const box = CS.chartBox('tall'), sBox = CS.chartBox();
    const rules = h('div'), info = h('div');
    body.append(CS.card(null, sb),
      h('div', { class: 'grid-rl' },
        CS.card(null, h('div', { class: 'row gap center' }, h('b', {}, 'K'), kIn, kVal, zg), box),
        h('div', { class: 'col' }, CS.card('Polos de malha fechada no K escolhido', info), CS.card('Resposta ao degrau em malha fechada', sBox), CS.card('Regras de construção (calculadas)', rules))));
    let rl = null, ch = null, rc = CS.respChart(sBox, R.one());
    const kFromSlider = () => rl.kScale * Math.pow(10, -4 + 8 * kIn.value / 1000);
    const sliderFromK = K => { kIn.value = Math.max(0, Math.min(1000, (Math.log10(K / rl.kScale) + 4) / 8 * 1000)); };
    ch = new MS.Chart(box, {
      equal: true, xlabel: 'Re(s)', ylabel: 'Im(s)', pad: 0.02,
      readout: (x, y) => { if (!rl) return ''; const s = { re: x, im: y }; const gh = R.evalC(CS.sys().GH, s); const K = 1 / cx.abs(gh); const ang = cx.arg(gh) * 180 / Math.PI; return `s = ${CS.fmtC(s, 3)}\n∠GH = ${CS.fmtNum(ang, 4)}°\nK = 1/|GH| = ${CS.fmtNum(K, 3)}`; },
      onClick: (x, y) => {
        if (!rl) return;
        let best = null, bd = Infinity;
        for (const b of rl.branches) b.pts.forEach((p, i) => { const d = Math.hypot(p.re - x, p.im - y); if (d < bd) { bd = d; best = b.K[i]; } });
        if (best !== null && best > 0) { setK(best); }
      },
    });
    const setK = K => { CS.setSys({ K: String(+K.toPrecision(4)) }, true); kVal.value = String(+K.toPrecision(4)); sliderFromK(K); draw(true); };
    kIn.addEventListener('input', () => { const K = kFromSlider(); kVal.value = String(+K.toPrecision(4)); CS.setSys({ K: kVal.value }, true); draw(true); });
    kVal.addEventListener('change', () => { const K = MS.parseEng(kVal.value); if (K > 0) setK(K); });
    zg.querySelector('input').addEventListener('change', () => draw(true));
    const COLS = ['#4fb3ff', '#ff9f1c', '#3ddc84', '#c77dff', '#ffd166', '#06d6a0', '#f78c6b', '#7aa2ff'];
    const compute = () => {
      rules.innerHTML = '';
      try { rl = CS.rootLocus(CS.sys().GH); } catch (e) { rl = null; rules.append(h('div', { class: 'err' }, e.message)); ch.set({}); return; }
      const rg = CS.kRange(CS.sys().GH);
      rl.cross = rg.cross.filter(c => c.w > 0);
      rules.append(CS.kv([
        ['Ramos', `${rl.n} (n = ${rl.n} polos, m = ${rl.m} zeros)`],
        rl.n - rl.m > 0 ? ['Assíntotas', `${rl.angles.map(a => CS.fmtNum(a, 4) + '°').join(', ')} a partir de σ = ${CS.fmtNum(rl.centroid, 4)}`] : ['Assíntotas', 'nenhuma (n = m)'],
        ['Separação / chegada', rl.breaks.length ? rl.breaks.map(b => `s = ${CS.fmtNum(b.s, 4)} (K = ${CS.fmtNum(b.K, 3)})`).join('<br>') : '—'],
        ['Partida de polos complexos', rl.dep.length ? rl.dep.map(d => `${CS.fmtC(d.p, 3)}: ${CS.fmtNum(d.a, 4)}°`).join('<br>') : '—'],
        ['Cruzamento com jω', rg.cross.filter(c => c.w > 0).map(c => `K = ${CS.fmtNum(c.K)}, ω = ±${CS.fmtNum(c.w)} rad/s`).join('<br>') || '—'],
        ['Faixa estável', rangesText(rg)],
      ]));
      sliderFromK(MS.parseEng(CS.state.K) || rl.kScale); kVal.value = CS.state.K;
      draw(false);
    };
    const draw = (keep) => {
      if (!rl) return;
      const K = MS.parseEng(kVal.value) || 0;
      const series = rl.branches.map((b, i) => ({ x: b.pts.map(p => p.re), y: b.pts.map(p => p.im), color: COLS[i % COLS.length], width: 2, arrows: 3, noFit: true }));
      // região de interesse: polos, zeros, separação, cruzamentos com jω e centróide
      const key = [...rl.poles, ...rl.zeros, ...rl.breaks.map(b => ({ re: b.s, im: 0 })), ...(rl.cross || []).flatMap(c => [{ re: 0, im: c.w }, { re: 0, im: -c.w }])];
      if (rl.centroid !== null) key.push({ re: rl.centroid, im: 0 });
      const cxm = key.reduce((s, q) => s + q.re, 0) / key.length;
      const Rk = Math.max(1, ...key.map(q => Math.hypot(q.re - cxm, q.im))) * 1.35;
      const fit = [{ x: cxm - Rk, y: -Rk, hidden: true }, { x: cxm + Rk, y: Rk, hidden: true }];
      const markers = [
        ...rl.poles.map(p => ({ x: p.re, y: p.im, shape: 'x', color: '#ff4d6d', size: 7, noFit: true })),
        ...rl.zeros.map(z => ({ x: z.re, y: z.im, shape: 'o', color: '#4fb3ff', size: 7, noFit: true })),
        ...rl.breaks.map(b => ({ x: b.s, y: 0, shape: 'dot', color: '#ffd166', size: 5, noFit: true })),
        ...(rl.cross || []).flatMap(c => [{ x: 0, y: c.w, shape: 'dot', color: '#ff4d6d', size: 4 }, { x: 0, y: -c.w, shape: 'dot', color: '#ff4d6d', size: 4 }]),
        ...fit,
      ];
      const cl = rl.chr(K);
      markers.push(...cl.map(q => ({ x: q.re, y: q.im, shape: 'sq', color: '#ffffff', size: 5, noFit: true })));
      // assíntotas
      const v = ch.view || { x0: -10, x1: 10, y0: -10, y1: 10 };
      const L = 4 * Math.max(Math.abs(v.x1 - v.x0), Math.abs(v.y1 - v.y0), 10);
      if (rl.centroid !== null) for (const a of rl.angles) { const t = a * Math.PI / 180; series.push({ x: [rl.centroid, rl.centroid + L * Math.cos(t)], y: [0, L * Math.sin(t)], color: 'rgba(255,255,255,0.22)', dash: [6, 5], width: 1, noFit: true }); }
      if (zg.querySelector('input').checked) for (const z of [0.2, 0.4, 0.6, 0.707, 0.8, 0.9]) { const t = Math.acos(z); series.push({ x: [0, -L * Math.cos(t)], y: [0, L * Math.sin(t)], color: 'rgba(199,125,255,0.3)', dash: [2, 4], width: 1, noFit: true }, { x: [0, -L * Math.cos(t)], y: [0, -L * Math.sin(t)], color: 'rgba(199,125,255,0.3)', dash: [2, 4], width: 1, noFit: true }); }
      const texts = zg.querySelector('input').checked ? [0.2, 0.4, 0.6, 0.707, 0.8].map(z => ({ x: -Math.cos(Math.acos(z)) * (v.y1 - v.y0) * 0.42, y: Math.sin(Math.acos(z)) * (v.y1 - v.y0) * 0.42, text: 'ζ=' + z, color: 'rgba(199,125,255,0.7)', size: 10 })) : [];
      ch.set({ series, markers, regions: [{ x0: 0, x1: Infinity, y0: -Infinity, y1: Infinity, color: 'rgba(255,77,109,0.07)' }], texts }, keep);
      // info
      const T = CS.sys().T;
      info.innerHTML = '';
      const dom = CS.dominant(T);
      info.append(CS.kv([
        ['K', CS.fmtNum(K, 4)],
        ['Polos (□)', cl.map(q => CS.fmtC(q, 3)).join('<br>')],
        ['Estabilidade', CS.stableText(cl)],
        dom && dom.kind === 2 ? ['ζ, ω<sub>n</sub> dominantes', `${CS.fmtNum(dom.zeta, 3)}, ${CS.fmtNum(dom.wn, 3)} rad/s`] : null,
      ]));
      rc.upd(T, 'step');
    };
    const fn = () => compute();
    CS.onChange(fn); onClean(() => CS.offChange(fn));
    compute();
  };

  CS.registerTab('stab', {
    title: 'Análise de estabilidade',
    tools: [
      { id: 'routh', label: 'Routh-Hurwitz', desc: 'tabela, casos especiais, faixa de K', render: toolRouth },
      { id: 'rlocus', label: 'Lugar das raízes', desc: 'polos × K, regras, projeto', render: toolRL },
    ],
  });
})();
