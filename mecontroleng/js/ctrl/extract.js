/* ============================================================
   MeControlEng — Do esquemático para a função de transferência
   Monta a matriz MNA no domínio de Laplace, A(s)·X(s) = b·U(s),
   avalia det A(s) e Y(s)/U(s) em pontos do círculo |s| = ρ e
   recupera os coeficientes dos polinômios por DFT inversa.
   ============================================================ */
'use strict';

/* entradas possíveis: fontes independentes */
MS.CS.schematicInputs = function (doc) {
  return doc.comps.filter(c => ['VS', 'IS', 'TS', 'WS', 'FS', 'US', 'TSRC', 'QSRC', 'PSRC', 'FSRC'].includes(c.type))
    .map(c => ({ id: c.id, label: `${c.name} (${MS.DEFS[c.type].name})` }));
};

/* saídas possíveis: nós (V/ω/v), posições (θ/x) e grandezas de componentes */
MS.CS.schematicOutputs = function (doc) {
  const nl = MS.netlist(doc);
  const out = [];
  for (let i = 1; i < nl.nodes.length; i++) {
    const n = nl.nodes[i], D = MS.DOM[n.dom];
    const sym = { E: 'V', R: 'ω', T: 'v', H: 'T', F: 'p' }[n.dom] || 'V';
    out.push({ id: 'n:' + n.name, label: `${sym}(${n.name}) — ${D.across} [${D.au}]` });
    if (n.dom === 'R' || n.dom === 'T') out.push({ id: 'p:' + n.name, label: `${n.dom === 'R' ? 'θ' : 'x'}(${n.name}) — ${D.pos} [${D.pu}]` });
  }
  for (const c of doc.comps) {
    const q = {
      R: [['I', 'corrente']], L: [['I', 'corrente']], C: [['I', 'corrente']], VS: [['I', 'corrente']],
      MOTOR: [['I', 'corrente'], ['tau', 'torque']], VCOIL: [['I', 'corrente'], ['F', 'força']],
      K: [['F', 'força']], KR: [['tau', 'torque']], B: [['F', 'força']], BR: [['tau', 'torque']],
    }[c.type];
    if (q) for (const [k, l] of q) out.push({ id: `c:${c.id}:${k}`, label: `${l} em ${c.name}` });
  }
  return out;
};

MS.CS.fromSchematic = function (doc, inputId, outputId) {
  const CS = MS.CS, cx = CS.cx, P = CS.poly;
  const notes = [];
  const nl = MS.netlist(doc);
  if (nl.errors.length) throw new Error(nl.errors[0]);
  const ck = MS.buildCircuit(doc, nl);
  if (ck.errors.length) throw new Error(ck.errors[0]);
  const { els, nN, N } = ck;
  const inComp = doc.comps.find(c => c.id === inputId);
  if (!inComp) throw new Error('Escolha uma fonte de entrada.');

  // mapear elemento de entrada: buildCircuit cria os elementos na ordem dos componentes;
  // localizamos pelo vínculo nós+tipo
  const inEl = els.find(e => e.cid === inComp.id && (e.t === 'V' || e.t === 'I'));

  if (els.some(e => e.t === 'NL')) notes.push('Dispositivos não lineares (transistores, LEDs, Zener, reguladores, AmpOp…) linearizados em torno de 0 V (modelo de pequenos sinais nesse ponto: junções cortadas, AmpOp na região linear).');
  if (els.some(e => e.t === 'CTRL')) notes.push('Elementos digitais/amostrados (555, portas lógicas, relés, válvulas proporcionais) congelados no estado inicial.');
  if (els.some(e => e.t === 'D')) notes.push('Diodo(s) linearizado(s) no ponto de operação de 0 V (praticamente aberto).');
  if (els.some(e => e.t === 'SW')) notes.push('Chave(s) consideradas no estado em t = 0.');
  if (els.some(e => e.t === 'PID')) notes.push('PID tratado como C(s) = Kp + Ki/s + Kd·s, sem saturação (modelo linear).');
  if (els.filter(e => e.t === 'V' || e.t === 'I').length > 1) notes.push('As demais fontes independentes foram zeradas (superposição): fontes de esforço viram curto, de fluxo viram aberto.');
  notes.push('Condições iniciais nulas (definição de função de transferência).');

  // saída
  let outFn, extraS = 0;
  const [kind, a, b] = outputId.split(':');
  const nodeIdx = name => { const i = nl.nodes.findIndex((n, k) => k > 0 && n.name === name); if (i < 1) throw new Error('Nó de saída inexistente.'); return i; };
  const X = (x, n) => (n > 0 ? x[n - 1] : cx.c(0));
  if (kind === 'n' || kind === 'p') {
    const i = nodeIdx(a);
    outFn = x => X(x, i);
    if (kind === 'p') extraS = 1;   // posição = velocidade / s
  } else {
    const comp = doc.comps.find(c => c.id === a);
    const nd = nl.pinNode.get(comp.id).map(v => Math.max(0, v));
    const P_ = k => MS.parseEng(comp.params[k]);
    const brOf = () => { const e = els.find(e => e.cid === comp.id && e.k !== undefined); if (!e) throw new Error('ramo não encontrado'); return e.k; };
    switch (comp.type) {
      case 'R': outFn = x => cx.scale(cx.sub(X(x, nd[0]), X(x, nd[1])), 1 / P_('R')); break;
      case 'B': case 'BR': outFn = x => cx.scale(cx.sub(X(x, nd[0]), X(x, nd[1])), P_('b')); break;
      case 'C': outFn = (x, s) => cx.mul(cx.scale(s, P_('C')), cx.sub(X(x, nd[0]), X(x, nd[1]))); break;
      case 'L': case 'K': case 'KR': { const k = brOf(); outFn = x => x[k]; break; }
      case 'VS': { const k = brOf(); outFn = x => cx.scale(x[k], -1); break; }
      case 'MOTOR': case 'VCOIL': { const k = brOf(); const g = b === 'I' ? 1 : (comp.type === 'MOTOR' ? P_('K') : P_('Bl')); outFn = x => cx.scale(x[k], g); break; }
      default: throw new Error('Saída não suportada.');
    }
  }

  // montagem de A(s) e b para um s complexo
  const GMIN = 1e-12;
  const build = s => {
    const A = Array.from({ length: N }, () => Array.from({ length: N }, () => cx.c(0)));
    const rhs = Array.from({ length: N }, () => cx.c(0));
    const add = (r, c, v) => { if (r >= 0 && c >= 0) { A[r][c].re += v.re; A[r][c].im += v.im; } };
    const re = v => cx.c(v);
    const G = (a, b, y) => { add(a - 1, a - 1, y); add(b - 1, b - 1, y); add(a - 1, b - 1, cx.scale(y, -1)); add(b - 1, a - 1, cx.scale(y, -1)); };
    const kcl = (a, b, k) => { add(a - 1, k, re(1)); add(b - 1, k, re(-1)); add(k, a - 1, re(1)); add(k, b - 1, re(-1)); };
    for (let i = 0; i < nN; i++) add(i, i, re(GMIN));
    for (const e of els) {
      switch (e.t) {
        case 'G': G(e.a, e.b, re(e.g)); break;
        case 'SW': G(e.a, e.b, re(0 >= e.ton && 0 < e.toff ? e.gon : e.goff)); break;
        case 'D': G(e.a, e.b, re(e.Is / e.vt + GMIN)); break;
        case 'C': G(e.a, e.b, cx.scale(s, e.C)); break;
        case 'L': kcl(e.a, e.b, e.k); add(e.k, e.k, cx.scale(s, -e.L)); break;
        case 'V': kcl(e.a, e.b, e.k); if (e === inEl) rhs[e.k] = re(1); break;
        case 'I': if (e === inEl) { if (e.a > 0) rhs[e.a - 1] = cx.add(rhs[e.a - 1], re(1)); if (e.b > 0) rhs[e.b - 1] = cx.add(rhs[e.b - 1], re(-1)); } break;
        case 'EMC':
          add(e.p - 1, e.k, re(1)); add(e.m - 1, e.k, re(-1)); add(e.s - 1, e.k, re(-e.K));
          add(e.k, e.p - 1, re(1)); add(e.k, e.m - 1, re(-1)); add(e.k, e.s - 1, re(-e.K));
          add(e.k, e.k, cx.add(re(-e.Ra), cx.scale(s, -e.La))); break;
        case 'GY': for (const [r, c2, v] of e.ent) add(r - 1, c2 - 1, re(v)); break;
        case 'NL': {
          const lin = e._lin || (e._lin = e.ev(e.nodes.map(() => 0), false));
          e.nodes.forEach((rn, k) => e.nodes.forEach((cn, j) => { if (lin.G[k][j]) add(rn - 1, cn - 1, re(lin.G[k][j])); }));
          break;
        }
        case 'XFMR': {
          add(e.p1 - 1, e.k1, re(1)); add(e.p2 - 1, e.k1, re(-1)); add(e.s1 - 1, e.k2, re(1)); add(e.s2 - 1, e.k2, re(-1));
          add(e.k1, e.p1 - 1, re(1)); add(e.k1, e.p2 - 1, re(-1)); add(e.k2, e.s1 - 1, re(1)); add(e.k2, e.s2 - 1, re(-1));
          add(e.k1, e.k1, cx.add(re(-e.R1), cx.scale(s, -e.L1))); add(e.k1, e.k2, cx.scale(s, -e.M));
          add(e.k2, e.k2, cx.add(re(-e.R2), cx.scale(s, -e.L2))); add(e.k2, e.k1, cx.scale(s, -e.M)); break;
        }
        case 'XF': add(e.a - 1, e.k, re(1)); add(e.b - 1, e.k, re(-e.N)); add(e.k, e.a - 1, re(1)); add(e.k, e.b - 1, re(-e.N)); break;
        case 'E': add(e.o - 1, e.k, re(1)); add(e.k, e.o - 1, re(1)); add(e.k, e.s - 1, re(-e.K)); break;
        case 'PID': {
          // s·Vo − (Kd s² + Kp s + Ki)(Vr − Vf) = 0
          const c = cx.add(cx.add(cx.scale(cx.mul(s, s), e.Kd), cx.scale(s, e.Kp)), re(e.Ki));
          add(e.o - 1, e.k, re(1)); add(e.k, e.o - 1, s);
          add(e.k, e.r - 1, cx.scale(c, -1)); add(e.k, e.f - 1, c); break;
        }
      }
    }
    return { A, rhs };
  };
  // eliminação gaussiana complexa: retorna det e solução
  const solve = (A, b) => {
    const n = A.length; let det = cx.c(1);
    A = A.map(r => r.map(v => ({ ...v }))); b = b.map(v => ({ ...v }));
    for (let k = 0; k < n; k++) {
      let p = k, mx = cx.abs(A[k][k]);
      for (let i = k + 1; i < n; i++) { const v = cx.abs(A[i][k]); if (v > mx) { mx = v; p = i; } }
      if (mx === 0) return { det: cx.c(0), x: null };
      if (p !== k) { [A[p], A[k]] = [A[k], A[p]]; [b[p], b[k]] = [b[k], b[p]]; det = cx.scale(det, -1); }
      det = cx.mul(det, A[k][k]);
      for (let i = k + 1; i < n; i++) {
        const f = cx.div(A[i][k], A[k][k]);
        if (!f.re && !f.im) continue;
        for (let j = k; j < n; j++) A[i][j] = cx.sub(A[i][j], cx.mul(f, A[k][j]));
        b[i] = cx.sub(b[i], cx.mul(f, b[k]));
      }
    }
    const x = new Array(n);
    for (let i = n - 1; i >= 0; i--) { let s = b[i]; for (let j = i + 1; j < n; j++) s = cx.sub(s, cx.mul(A[i][j], x[j])); x[i] = cx.div(s, A[i][i]); }
    return { det, x };
  };

  // reduzir ao bloco acoplado à entrada (subcircuitos independentes não afetam G(s))
  const keep = (() => {
    const s0 = cx.c(0.731, 1.37);
    const { A, rhs } = build(s0);
    const adj = Array.from({ length: N }, () => []);
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) if (i !== j && (A[i][j].re || A[i][j].im)) { adj[i].push(j); adj[j].push(i); }
    const seen = new Array(N).fill(false), st = [];
    rhs.forEach((v, i) => { if (v.re || v.im) { seen[i] = true; st.push(i); } });
    while (st.length) { const i = st.pop(); for (const j of adj[i]) if (!seen[j]) { seen[j] = true; st.push(j); } }
    return seen.map((v, i) => (v ? i : -1)).filter(i => i >= 0);
  })();
  const full = build;
  const buildR = s => {
    const { A, rhs } = full(s);
    return { A: keep.map(i => keep.map(j => A[i][j])), rhs: keep.map(i => rhs[i]) };
  };
  const expand = xr => { const x = Array.from({ length: N }, () => cx.c(0)); keep.forEach((i, k) => { x[i] = xr[k]; }); return x; };

  const nDyn = els.filter(e => ['C', 'L', 'EMC'].includes(e.t)).length + 2 * els.filter(e => e.t === 'XFMR').length + 2 * els.filter(e => e.t === 'PID').length;
  const M = Math.max(16, 1 << Math.ceil(Math.log2(nDyn + 4)));
  const interp = rho => {
    const dv = [], nv = [];
    for (let j = 0; j < M; j++) {
      const th = 2 * Math.PI * j / M, s = cx.c(rho * Math.cos(th), rho * Math.sin(th));
      const { A, rhs } = buildR(s);
      const { det, x } = solve(A, rhs);
      if (!x) throw new Error('Sistema singular (verifique fontes em paralelo/laços de molas).');
      dv.push(det); nv.push(cx.mul(det, outFn(expand(x), s)));
    }
    const idft = vals => {
      const c = [];
      for (let k = 0; k < M; k++) {
        let re = 0;
        for (let j = 0; j < M; j++) { const th = -2 * Math.PI * j * k / M; re += vals[j].re * Math.cos(th) - vals[j].im * Math.sin(th); }
        c.push(re / M / Math.pow(rho, k));
      }
      return c;
    };
    const ratio = Math.max(...nv.map((v, j) => cx.abs(v) / Math.max(1e-300, cx.abs(dv[j]))));
    if (ratio < 1e-10) return { den: [1], num: [0], zero: true };
    const cut = (c) => { const sc = c.map((v, k) => Math.abs(v) * Math.pow(rho, k)); const mx = Math.max(...sc); return c.map((v, k) => (sc[k] < 1e-9 * mx ? 0 : v)); };
    return { den: P.trim(cut(idft(dv))), num: P.trim(cut(idft(nv))) };
  };
  // 1ª passada com ρ = 1, depois ρ = média geométrica do módulo dos polos
  let r1 = interp(1);
  const pr = P.roots(r1.den).map(cx.abs).filter(v => v > 1e-6);
  if (pr.length) {
    const rho = Math.exp(pr.reduce((s, v) => s + Math.log(v), 0) / pr.length);
    if (rho > 0 && isFinite(rho) && Math.abs(Math.log10(rho)) > 0.3) r1 = interp(rho);
  }
  if (r1.zero) { notes.unshift('A saída não depende da entrada no modelo linearizado (G(s) = 0).'); return { G: { num: [0], den: [1] }, notes }; }
  let G = CS.rat.make(r1.num, r1.den);
  if (extraS) G = CS.rat.make(G.num, P.mul(G.den, [0, 1]));
  // polos/zeros ~ 0 vindos de GMIN viram exatamente 0; cancela pares coincidentes
  const snap = poly => { const r = P.roots(poly); const sc = Math.max(1, ...r.map(cx.abs)); return r.map(z => (cx.abs(z) < 1e-7 * sc ? cx.c(0) : z)); };
  const k = P.lead(G.num) / P.lead(G.den);
  G = CS.rat.simplify(CS.rat.make(P.fromRoots(snap(G.num), k), P.fromRoots(snap(G.den), 1)), 1e-5);
  return { G, notes };
};
