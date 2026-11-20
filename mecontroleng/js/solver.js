/* ============================================================
   MeControlEng — Netlist + Solver MNA (Modified Nodal Analysis) multidomínio
   ------------------------------------------------------------
   Analogia força-corrente (mobilidade):
     nó   : tensão V  | vel. angular ω | velocidade v       (across)
     ramo : corrente I| torque τ       | força F            (through)
     R  ↔ 1/b (amortecedor)    C ↔ J, m (inércia/massa, ligada à referência)
     L  ↔ 1/k (mola)           transformador ↔ engrenagem / pinhão-cremalheira
     girador ↔ motor DC / bobina móvel (acoplamento eletromecânico)
   Integração: Trapezoidal (padrão) ou Euler implícito, passo fixo,
   Newton-Raphson para elementos não lineares (diodo).
   ============================================================ */
'use strict';

/* ───────────── NETLIST: conectividade a partir do esquemático ───────────── */
MS.netlist = function (doc) {
  const errors = [], warns = [];
  const parent = new Map();
  const key = (x, y) => x + ',' + y;
  const find = k => {
    let r = k;
    while (true) { const p = parent.get(r); if (p === undefined) { parent.set(r, r); break; } if (p === r) break; r = p; }
    let c = k; while (parent.get(c) !== r && parent.get(c) !== undefined) { const n = parent.get(c); parent.set(c, r); c = n; }
    return r;
  };
  const union = (a, b) => { a = find(a); b = find(b); if (a !== b) parent.set(a, b); };

  const pins = [];
  for (const c of doc.comps) {
    const d = MS.DEFS[c.type];
    if (!d) { errors.push(`Tipo desconhecido: ${c.type}`); continue; }
    d.pins.forEach((p, i) => {
      const w = MS.pinPos(c, i), k = key(w.x, w.y);
      find(k);
      pins.push({ c, i, x: w.x, y: w.y, dom: p[2], k });
    });
    if (d.same) for (const g of d.same) for (let j = 1; j < g.length; j++) {
      const a = MS.pinPos(c, g[0]), b = MS.pinPos(c, g[j]);
      union(key(a.x, a.y), key(b.x, b.y));
    }
  }
  for (const w of doc.wires) union(key(w.x1, w.y1), key(w.x2, w.y2));

  // junções em "T": ponto (pino/extremidade) sobre o meio de um fio
  const pts = new Map();
  for (const p of pins) pts.set(p.k, [p.x, p.y]);
  for (const w of doc.wires) { pts.set(key(w.x1, w.y1), [w.x1, w.y1]); pts.set(key(w.x2, w.y2), [w.x2, w.y2]); }
  for (const w of doc.wires) for (const [k, [x, y]] of pts) if (MS.onSegInterior(x, y, w)) union(k, key(w.x1, w.y1));

  // rótulos de nó com mesmo nome → mesmo nó
  const labelRoot = new Map();
  for (const p of pins) if (p.c.type === 'LABEL') {
    const nm = String(p.c.params.name || '').trim();
    if (!nm) continue;
    if (labelRoot.has(nm)) union(p.k, labelRoot.get(nm)); else labelRoot.set(nm, p.k);
  }

  // agrupar pinos por rede
  const nets = new Map();
  for (const p of pins) {
    const r = find(p.k);
    if (!nets.has(r)) nets.set(r, { root: r, pins: [], doms: new Set(), ground: false, label: null });
    const n = nets.get(r);
    n.pins.push(p);
    if (p.dom !== 'A') n.doms.add(p.dom);
    if (MS.DEFS[p.c.type].ground) n.ground = true;
    if (p.c.type === 'LABEL' && !n.label) n.label = String(p.c.params.name || '').trim();
  }

  const nodes = [{ name: '0', dom: '*', ground: true }];
  const rootNode = new Map();
  let auto = 1;
  for (const n of nets.values()) {
    if (n.doms.size > 1) {
      errors.push(`Conflito de domínio no nó ${n.label || ''}: liga ${[...n.doms].map(d => MS.DOM[d].name).join(' + ')} (${n.pins.map(p => p.c.name || p.c.type).join(', ')}). Use um acoplamento (motor, engrenagem, sensor...).`);
      n.bad = true;
    }
    const dom = n.doms.size ? [...n.doms][0] : null;
    if (!dom) continue;
    if (n.ground) { rootNode.set(n.root, 0); continue; }
    const real = n.pins.filter(p => p.c.type !== 'LABEL');
    if (real.length === 1) warns.push(`Pino desconectado: ${real[0].c.name || real[0].c.type}.${MS.DEFS[real[0].c.type].pins[real[0].i][3]}`);
    let name = n.label;
    if (!name) { name = 'N' + String(auto++).padStart(3, '0'); }
    rootNode.set(n.root, nodes.length);
    nodes.push({ name, dom, root: n.root });
  }
  // nomes duplicados de rótulo resolvidos pela união; verifique nomes repetidos com domínios diferentes já tratados
  const pinNode = new Map();
  for (const c of doc.comps) pinNode.set(c.id, MS.DEFS[c.type] ? MS.DEFS[c.type].pins.map(() => -1) : []);
  for (const p of pins) { const r = find(p.k); pinNode.get(p.c.id)[p.i] = rootNode.has(r) ? rootNode.get(r) : -1; }
  const wireNode = new Map();
  const wireBad = new Set();
  for (const w of doc.wires) {
    const r = find(key(w.x1, w.y1));
    wireNode.set(w.id, rootNode.has(r) ? rootNode.get(r) : -1);
    const n = nets.get(r);
    if (n && n.bad) wireBad.add(w.id);
  }
  const wireDom = new Map();
  for (const w of doc.wires) {
    const r = find(key(w.x1, w.y1)), n = nets.get(r);
    wireDom.set(w.id, n && n.doms.size === 1 ? [...n.doms][0] : (n && n.doms.size > 1 ? 'X' : 'A'));
  }
  return { nodes, pinNode, wireNode, wireDom, wireBad, errors, warns, find, key };
};

MS.onSegInterior = function (x, y, w) {
  if ((x === w.x1 && y === w.y1) || (x === w.x2 && y === w.y2)) return false;
  const dx = w.x2 - w.x1, dy = w.y2 - w.y1;
  if (dx * (y - w.y1) - dy * (x - w.x1) !== 0) return false;
  const t = dx !== 0 ? (x - w.x1) / dx : (y - w.y1) / dy;
  return t > 0 && t < 1;
};

/* ───────────── LU com pivotamento parcial ───────────── */
function luFactor(A, N, LU, perm) {
  LU.set(A);
  for (let i = 0; i < N; i++) perm[i] = i;
  for (let k = 0; k < N; k++) {
    let p = k, mx = Math.abs(LU[k * N + k]);
    for (let i = k + 1; i < N; i++) { const v = Math.abs(LU[i * N + k]); if (v > mx) { mx = v; p = i; } }
    if (mx < 1e-300) return false;
    if (p !== k) {
      for (let j = 0; j < N; j++) { const t = LU[k * N + j]; LU[k * N + j] = LU[p * N + j]; LU[p * N + j] = t; }
      const t = perm[k]; perm[k] = perm[p]; perm[p] = t;
    }
    const piv = LU[k * N + k];
    for (let i = k + 1; i < N; i++) {
      const f = (LU[i * N + k] /= piv);
      if (f !== 0) for (let j = k + 1; j < N; j++) LU[i * N + j] -= f * LU[k * N + j];
    }
  }
  return true;
}
function luSolve(LU, N, perm, b, x, y) {
  for (let i = 0; i < N; i++) { let s = b[perm[i]]; for (let j = 0; j < i; j++) s -= LU[i * N + j] * y[j]; y[i] = s; }
  for (let i = N - 1; i >= 0; i--) { let s = y[i]; for (let j = i + 1; j < N; j++) s -= LU[i * N + j] * x[j]; x[i] = s / LU[i * N + i]; }
}

/* ───────────── Construção dos elementos a partir dos componentes ───────────── */
MS.buildCircuit = function (doc, nl) {
  const errors = [];
  const nN = nl.nodes.length - 1;
  let nB = 0;
  const els = [];
  const quants = [];   // grandezas por componente para gráficos
  const br = () => nN + (nB++);

  for (const c of doc.comps) {
    const d = MS.DEFS[c.type];
    const nd = nl.pinNode.get(c.id) || [];
    const n = i => Math.max(0, nd[i]);
    const P = k => {
      const v = MS.parseEng(c.params[k]);
      if (!isFinite(v)) errors.push(`${c.name || d.name}: parâmetro inválido "${k}" = "${c.params[k]}"`);
      return v;
    };
    const pos = (k, v) => { if (!(v > 0)) errors.push(`${c.name}: "${k}" deve ser > 0`); return v; };
    const Q = (k, lab, u, f) => quants.push({ comp: c, k, label: `${lab}(${c.name})`, u, f });
    const dI = MS.DOM;
    const nEl0 = els.length;
    switch (c.type) {
      case 'R': { const e = { t: 'G', a: n(0), b: n(1), g: 1 / pos('R', P('R')) }; els.push(e); Q('I', 'I', 'A', X => e.g * (X(e.a) - X(e.b))); break; }
      case 'BR': { const e = { t: 'G', a: n(0), b: n(1), g: P('b') }; els.push(e); Q('tau', 'τ', 'N·m', X => e.g * (X(e.a) - X(e.b))); break; }
      case 'B': { const e = { t: 'G', a: n(0), b: n(1), g: P('b') }; els.push(e); Q('F', 'F', 'N', X => e.g * (X(e.a) - X(e.b))); break; }
      case 'C': { const e = { t: 'C', a: n(0), b: n(1), C: pos('C', P('C')), v0: P('V0') }; els.push(e); Q('I', 'I', 'A', () => e.i); break; }
      case 'J': { const e = { t: 'C', a: n(0), b: 0, C: pos('J', P('J')), v0: P('w0') }; els.push(e); Q('tau', 'τ', 'N·m', () => e.i); break; }
      case 'M': { const e = { t: 'C', a: n(0), b: 0, C: pos('m', P('m')), v0: P('v0') }; els.push(e); Q('F', 'F', 'N', () => e.i); break; }
      case 'L': { const e = { t: 'L', a: n(0), b: n(1), L: pos('L', P('L')), i0: P('I0'), k: br() }; els.push(e); Q('I', 'I', 'A', (X, x) => x[e.k]); break; }
      case 'KR': {
        const k = pos('k', P('k'));
        const e = { t: 'L', a: n(0), b: n(1), L: 1 / k, i0: k * P('th0'), k: br() }; els.push(e);
        Q('tau', 'τ', 'N·m', (X, x) => x[e.k]); Q('tw', 'Δθ', 'rad', (X, x) => x[e.k] / k); break;
      }
      case 'K': {
        const k = pos('k', P('k'));
        const e = { t: 'L', a: n(0), b: n(1), L: 1 / k, i0: k * P('x0'), k: br() }; els.push(e);
        Q('F', 'F', 'N', (X, x) => x[e.k]); Q('dx', 'Δx', 'm', (X, x) => x[e.k] / k); break;
      }
      case 'VS': case 'WS': case 'US': {
        const e = { t: 'V', a: n(0), b: n(1), fn: MS.makeWave(c), k: br() }; els.push(e);
        const [lab, u] = c.type === 'VS' ? ['I', 'A'] : c.type === 'WS' ? ['τ', 'N·m'] : ['F', 'N'];
        Q('th', lab, u, (X, x) => -x[e.k]); break;
      }
      case 'IS': case 'TS': case 'FS': {
        const e = { t: 'I', a: n(0), b: n(1), fn: MS.makeWave(c), val: 0 }; els.push(e);
        const [lab, u] = c.type === 'IS' ? ['I', 'A'] : c.type === 'TS' ? ['τ', 'N·m'] : ['F', 'N'];
        Q('th', lab, u, () => e.val); break;
      }
      case 'D': {
        const Is = pos('Is', P('Is')), nf = pos('n', P('n'));
        const vt = nf * 0.025852;
        const e = { t: 'D', a: n(0), b: n(1), Is, vt, vcrit: vt * Math.log(vt / (Math.SQRT2 * Is)), vd: 0 }; els.push(e);
        Q('I', 'I', 'A', X => { const v = X(e.a) - X(e.b); return Is * (Math.exp(Math.min(v / vt, 80)) - 1); }); break;
      }
      case 'SW': {
        const e = { t: 'SW', a: n(0), b: n(1), ton: P('ton'), toff: P('toff'), gon: 1 / pos('Ron', P('Ron')), goff: 1 / pos('Roff', P('Roff')), g: 0 };
        els.push(e); Q('I', 'I', 'A', X => e.g * (X(e.a) - X(e.b))); break;
      }
      case 'MOTOR': case 'VCOIL': {
        const isM = c.type === 'MOTOR';
        const K = isM ? P('K') : P('Bl');
        const e = { t: 'EMC', p: n(0), m: n(1), s: n(2), Ra: P('Ra'), La: pos('La', P('La')), K, k: br(), vL: 0 };
        els.push(e);
        const Jm = isM ? P('J') : P('m'), Bm = isM ? P('B') : P('b');
        if (Jm > 0) els.push({ t: 'C', a: n(2), b: 0, C: Jm, v0: 0 });
        if (Bm > 0) els.push({ t: 'G', a: n(2), b: 0, g: Bm });
        Q('I', 'I', 'A', (X, x) => x[e.k]);
        if (isM) { Q('tau', 'τ', 'N·m', (X, x) => K * x[e.k]); Q('emf', 'Ea', 'V', X => K * X(e.s)); }
        else { Q('F', 'F', 'N', (X, x) => K * x[e.k]); }
        Q('P', 'Pel', 'W', (X, x) => (X(e.p) - X(e.m)) * x[e.k]);
        break;
      }
      case 'GEAR': {
        const nr = pos('n', P('n'));
        const N = (c.params.inv === 'não' ? 1 : -1) * nr;   // ω_entrada = N · ω_saída
        const e = { t: 'XF', a: n(0), b: n(1), N, k: br() }; els.push(e);
        const J1 = P('J1'), J2 = P('J2');
        if (J1 > 0) els.push({ t: 'C', a: n(0), b: 0, C: J1, v0: 0 });
        if (J2 > 0) els.push({ t: 'C', a: n(1), b: 0, C: J2, v0: 0 });
        Q('tin', 'τin', 'N·m', (X, x) => x[e.k]); Q('tout', 'τout', 'N·m', (X, x) => N * x[e.k]); break;
      }
      case 'RACK': {
        const r = pos('r', P('r'));
        const e = { t: 'XF', a: n(0), b: n(1), N: 1 / r, k: br() }; els.push(e);
        Q('tau', 'τ', 'N·m', (X, x) => x[e.k]); Q('F', 'F', 'N', (X, x) => x[e.k] / r); break;
      }
      case 'TACHO': case 'VSENS': {
        const e = { t: 'E', o: n(1), s: n(0), K: P('K'), k: br() }; els.push(e); break;
      }
      case 'PID': {
        const e = { t: 'PID', r: n(0), f: n(1), o: n(2), Kp: P('Kp'), Ki: P('Ki'), Kd: P('Kd'), umin: P('Umin'), umax: P('Umax'), k: br(), integ: 0, eprev: null, u: 0, err: 0 };
        els.push(e);
        Q('u', 'u', 'V', () => e.u); Q('e', 'e', 'V', () => e.err); break;
      }
      default:
        if (d.build) d.build({ c, n, P, pos, Q, br, els, errors, wave: () => MS.makeWave(c), nN });
    }
    void dI;
    for (let i = nEl0; i < els.length; i++) els[i].cid = c.id;
  }
  return { els, nN, nB, N: nN + nB, quants, errors };
};

/* ───────────── Simulação transitória ───────────── */
MS.simulate = async function (doc, opt = {}) {
  const t0clock = performance.now();
  const nl = MS.netlist(doc);
  if (nl.errors.length) return { errors: nl.errors, warns: nl.warns };
  const ck = MS.buildCircuit(doc, nl);
  if (ck.errors.length) return { errors: ck.errors, warns: nl.warns };
  if (!doc.comps.some(c => !MS.DEFS[c.type].ground && c.type !== 'LABEL')) return { errors: ['Esquemático vazio.'], warns: [] };

  const { els, nN, N } = ck;
  const tstop = MS.parseEng(doc.sim.tstop);
  let h = MS.parseEng(doc.sim.dt);
  if (!(tstop > 0)) return { errors: ['Tempo de parada inválido.'], warns: [] };
  if (!(h > 0)) h = tstop / 5000;
  let steps = Math.ceil(tstop / h - 1e-9);
  if (steps > 3e6) return { errors: [`Passos demais (${steps}). Aumente o passo de tempo.`], warns: [] };
  const method = doc.sim.method === 'be' ? 'be' : 'trap';
  const MAXREC = 8000;
  const recEvery = Math.max(1, Math.ceil(steps / MAXREC));
  const nRec = Math.floor(steps / recEvery) + 1;

  const nonlinear = els.some(e => e.t === 'D' || e.t === 'NL');
  const timevar = els.some(e => e.t === 'SW' || (e.t === 'CTRL' && !e.rhsOnly) || e.var);

  const A = new Float64Array(N * N), rhs = new Float64Array(N);
  const LU = new Float64Array(N * N), perm = new Int32Array(N), ytmp = new Float64Array(N);
  let x = new Float64Array(N), xPrev = new Float64Array(N), xIt = new Float64Array(N);
  const pos = new Float64Array(nN + 1);
  const GMIN = 1e-12;

  // estados iniciais
  for (const e of els) {
    if (e.t === 'C') { e.v = e.v0 || 0; e.i = 0; if (e.b === 0 && e.a > 0) xPrev[e.a - 1] = e.v; else if (e.a === 0 && e.b > 0) xPrev[e.b - 1] = -e.v; }
    if (e.t === 'L') { e.j = e.i0 || 0; e.v = 0; xPrev[e.k] = e.j; }
    if (e.t === 'EMC') { e.j = 0; e.vL = 0; }
    if (e.t === 'XFMR') { e.j1 = 0; e.j2 = 0; e.vL1 = 0; e.vL2 = 0; }
    if (e.init) e.init();
  }

  // armazenamento de resultados
  const T = new Float64Array(nRec);
  const nodeData = []; const posData = [];
  for (let i = 0; i <= nN; i++) { nodeData.push(new Float64Array(nRec)); posData.push(new Float64Array(nRec)); }
  const qData = ck.quants.map(() => new Float64Array(nRec));
  let rec = 0;
  const record = (t, xv) => {
    T[rec] = t;
    for (let i = 1; i <= nN; i++) { nodeData[i][rec] = xv[i - 1]; posData[i][rec] = pos[i]; }
    const X = nd => (nd > 0 ? xv[nd - 1] : 0);
    for (let q = 0; q < ck.quants.length; q++) qData[q][rec] = ck.quants[q].f(X, xv);
    rec++;
  };
  // ponto t=0
  for (const e of els) if (e.t === 'PID') { e.u = 0; }
  record(0, xPrev);

  const aA = (r, c, v) => { if (r >= 0 && c >= 0) A[r * N + c] += v; };
  const aB = (r, v) => { if (r >= 0) rhs[r] += v; };
  const G = (a, b, g) => { const ra = a - 1, rb = b - 1; aA(ra, ra, g); aA(rb, rb, g); aA(ra, rb, -g); aA(rb, ra, -g); };
  const inj = (a, b, v) => { aB(a - 1, v); aB(b - 1, -v); };   // injeta v no nó a, retira do nó b
  const branchKCL = (a, b, k) => { aA(a - 1, k, 1); aA(b - 1, k, -1); aA(k, a - 1, 1); aA(k, b - 1, -1); };

  let factoredFor = null;
  let newtonFail = 0;
  let lastYield = performance.now();
  const X = (v, nd) => (nd > 0 ? v[nd - 1] : 0);

  for (let step = 1; step <= steps; step++) {
    const t = step * h;
    const m = (step === 1 || method === 'be') ? 'be' : 'trap';

    // controladores PID (amostrados: usam a solução do passo anterior)
    for (const e of els) if (e.t === 'PID') {
      const err = X(xPrev, e.r) - X(xPrev, e.f);
      if (e.eprev === null) e.eprev = err;
      let integ = e.integ + e.Ki * err * h;
      const der = e.Kd * (err - e.eprev) / h;
      let u = e.Kp * err + integ + der;
      if (u > e.umax) { u = e.umax; if (err > 0) integ = e.integ; }
      else if (u < e.umin) { u = e.umin; if (err < 0) integ = e.integ; }
      e.integ = integ; e.eprev = err; e.u = u; e.err = err;
    }
    const Xp = nd => (nd > 0 ? xPrev[nd - 1] : 0);
    for (const e of els) if (e.t === 'CTRL') e.pre(t, Xp, h, xPrev);
    for (const e of els) {
      if ((e.t === 'I' || e.t === 'V') && e.fn) e.val = e.fn(t);
      if (e.t === 'SW') e.g = (t >= e.ton && t < e.toff) ? e.gon : e.goff;
    }

    xIt.set(xPrev);
    let converged = false;
    for (let it = 0; it < 80; it++) {
      A.fill(0); rhs.fill(0);
      for (let i = 0; i < nN; i++) A[i * N + i] += GMIN;
      for (const e of els) {
        switch (e.t) {
          case 'G': G(e.a, e.b, e.g); break;
          case 'SW': G(e.a, e.b, e.g); break;
          case 'C': {
            e.geq = m === 'be' ? e.C / h : 2 * e.C / h;
            e.ieq = m === 'be' ? e.geq * e.v : e.geq * e.v + e.i;
            G(e.a, e.b, e.geq); inj(e.a, e.b, e.ieq); break;
          }
          case 'L': {
            const req = m === 'be' ? e.L / h : 2 * e.L / h;
            branchKCL(e.a, e.b, e.k); aA(e.k, e.k, -req);
            aB(e.k, m === 'be' ? -req * e.j : -req * e.j - e.v); break;
          }
          case 'V': branchKCL(e.a, e.b, e.k); aB(e.k, e.val); break;
          case 'I': inj(e.a, e.b, e.val); break;
          case 'D': {
            let v = X(xIt, e.a) - X(xIt, e.b);
            if (it > 0 || true) {
              const vold = e.vd;
              if (v > e.vcrit && Math.abs(v - vold) > 2 * e.vt) {
                if (vold > 0) { const arg = 1 + (v - vold) / e.vt; v = arg > 0 ? vold + e.vt * Math.log(arg) : e.vcrit; }
                else v = e.vt * Math.log(Math.max(v / e.vt, 1e-30));
              }
            }
            e.vd = v;
            const ex = Math.exp(Math.min(v / e.vt, 80));
            const id = e.Is * (ex - 1), gd = e.Is / e.vt * ex + GMIN;
            G(e.a, e.b, gd); inj(e.a, e.b, -(id - gd * v)); break;
          }
          case 'EMC': {
            const req = m === 'be' ? e.La / h : 2 * e.La / h;
            aA(e.p - 1, e.k, 1); aA(e.m - 1, e.k, -1); aA(e.s - 1, e.k, -e.K);
            aA(e.k, e.p - 1, 1); aA(e.k, e.m - 1, -1); aA(e.k, e.s - 1, -e.K); aA(e.k, e.k, -(e.Ra + req));
            aB(e.k, m === 'be' ? -req * e.j : -req * e.j - e.vL); break;
          }
          case 'XF': {
            aA(e.a - 1, e.k, 1); aA(e.b - 1, e.k, -e.N); aA(e.k, e.a - 1, 1); aA(e.k, e.b - 1, -e.N); break;
          }
          case 'E': { aA(e.o - 1, e.k, 1); aA(e.k, e.o - 1, 1); aA(e.k, e.s - 1, -e.K); break; }
          case 'PID': { aA(e.o - 1, e.k, 1); aA(e.k, e.o - 1, 1); aB(e.k, e.u); break; }
          case 'GY': for (const [r, c2, v] of e.ent) aA(r - 1, c2 - 1, v); break;
          case 'NL': {
            const vv = e.nodes.map(nd => X(xIt, nd));
            const r = e.ev(vv, true);
            e.v0 = r.v0;
            const nn = e.nodes.length;
            for (let k = 0; k < nn; k++) {
              const rk = e.nodes[k] - 1; if (rk < 0) continue;
              let sacc = r.i[k];
              for (let j = 0; j < nn; j++) { const gkj = r.G[k][j]; if (gkj) { aA(rk, e.nodes[j] - 1, gkj); sacc -= gkj * r.v0[j]; } }
              aB(rk, -sacc);
            }
            break;
          }
          case 'XFMR': {
            const c1 = m === 'be' ? 1 / h : 2 / h;
            aA(e.p1 - 1, e.k1, 1); aA(e.p2 - 1, e.k1, -1); aA(e.s1 - 1, e.k2, 1); aA(e.s2 - 1, e.k2, -1);
            aA(e.k1, e.p1 - 1, 1); aA(e.k1, e.p2 - 1, -1); aA(e.k2, e.s1 - 1, 1); aA(e.k2, e.s2 - 1, -1);
            aA(e.k1, e.k1, -(e.R1 + c1 * e.L1)); aA(e.k1, e.k2, -c1 * e.M);
            aA(e.k2, e.k2, -(e.R2 + c1 * e.L2)); aA(e.k2, e.k1, -c1 * e.M);
            aB(e.k1, -c1 * (e.L1 * e.j1 + e.M * e.j2) - (m === 'be' ? 0 : e.vL1));
            aB(e.k2, -c1 * (e.L2 * e.j2 + e.M * e.j1) - (m === 'be' ? 0 : e.vL2));
            break;
          }
        }
      }
      const key = m;
      if (nonlinear || timevar || factoredFor !== key) {
        if (!luFactor(A, N, LU, perm)) {
          return { errors: [`Matriz singular em t = ${MS.fmt(t, 's')}. Verifique fontes de tensão/velocidade em paralelo, laços de molas/indutores ou engrenagens com eixos travados.`], warns: nl.warns };
        }
        factoredFor = (nonlinear || timevar) ? null : key;
      }
      luSolve(LU, N, perm, rhs, x, ytmp);
      if (!nonlinear) { converged = true; break; }
      let ok = true;
      for (let i = 0; i < N; i++) { if (Math.abs(x[i] - xIt[i]) > 1e-6 + 1e-4 * Math.abs(x[i])) { ok = false; break; } }
      if (ok) for (const e of els) if (e.t === 'NL') { for (let k = 0; k < e.nodes.length; k++) { const xv = X(x, e.nodes[k]); if (Math.abs(xv - e.v0[k]) > 1e-6 + 1e-5 * Math.abs(xv)) { ok = false; break; } } if (!ok) break; }
      if (ok) for (const e of els) if (e.t === 'D') { if (Math.abs((X(x, e.a) - X(x, e.b)) - e.vd) > 1e-5) { ok = false; break; } }
      xIt.set(x);
      if (ok && it > 0) { converged = true; break; }
    }
    if (!converged) newtonFail++;
    for (let i = 0; i < N; i++) if (!isFinite(x[i])) return { errors: [`Solução divergiu em t = ${MS.fmt(t, 's')} (valores infinitos). Reduza o passo de tempo ou reveja ganhos.`], warns: nl.warns };

    // atualizar estados
    for (const e of els) {
      if (e.t === 'C') { const v = X(x, e.a) - X(x, e.b); e.i = e.geq * v - e.ieq; e.v = v; }
      else if (e.t === 'L') { e.j = x[e.k]; e.v = X(x, e.a) - X(x, e.b); }
      else if (e.t === 'EMC') { e.j = x[e.k]; e.vL = X(x, e.p) - X(x, e.m) - e.K * X(x, e.s) - e.Ra * e.j; }
      else if (e.t === 'XFMR') {
        e.j1 = x[e.k1]; e.j2 = x[e.k2];
        e.vL1 = X(x, e.p1) - X(x, e.p2) - e.R1 * e.j1; e.vL2 = X(x, e.s1) - X(x, e.s2) - e.R2 * e.j2;
      }
      if (e.post) e.post(t, nd => X(x, nd), x);
    }
    for (let i = 1; i <= nN; i++) pos[i] += 0.5 * (xPrev[i - 1] + x[i - 1]) * h;

    if (step % recEvery === 0) record(t, x);
    const sw = xPrev; xPrev = x; x = sw;

    if ((step & 255) === 0 && performance.now() - lastYield > 40) {
      if (opt.onProgress) opt.onProgress(step / steps);
      if (opt.cancel && opt.cancel()) return { errors: ['Simulação cancelada.'], warns: [] };
      await new Promise(r => setTimeout(r, 0));
      lastYield = performance.now();
    }
  }

  // ─ registrar sinais ─
  const signals = new Map();
  const nodeSig = [], posSig = [];
  for (let i = 1; i <= nN; i++) {
    const nd = nl.nodes[i];
    const D = MS.DOM[nd.dom];
    const sym = { E: 'V', R: 'ω', T: 'v', H: 'T', F: 'p' }[nd.dom] || 'V';
    const id = 'n:' + nd.name;
    signals.set(id, { id, label: `${sym}(${nd.name})`, u: D.au, dom: nd.dom, data: nodeData[i].subarray(0, rec), kind: 'across' });
    nodeSig[i] = id;
    if (nd.dom === 'R' || nd.dom === 'T') {
      const pid = 'p:' + nd.name;
      signals.set(pid, { id: pid, label: `${nd.dom === 'R' ? 'θ' : 'x'}(${nd.name})`, u: D.pu, dom: nd.dom, data: posData[i].subarray(0, rec), kind: 'pos' });
      posSig[i] = pid;
    }
  }
  const compSig = new Map();
  ck.quants.forEach((q, i) => {
    const id = 'c:' + q.comp.name + ':' + q.k;
    signals.set(id, { id, label: q.label, u: q.u, data: qData[i].subarray(0, rec), kind: 'comp', comp: q.comp.id });
    if (!compSig.has(q.comp.id)) compSig.set(q.comp.id, []);
    compSig.get(q.comp.id).push(id);
  });
  const warns = [...nl.warns];
  if (newtonFail) warns.push(`Newton-Raphson não convergiu em ${newtonFail} passo(s). Reduza o passo de tempo.`);
  return {
    ok: true, errors: [], warns, t: T.subarray(0, rec), n: rec, tstop, h, steps,
    nodes: nl.nodes, nl, signals, nodeSig, posSig, compSig, elapsed: performance.now() - t0clock, N,
  };
};

/* ───────────── Netlist textual (estilo SPICE) ───────────── */
MS.netlistText = function (doc) {
  const nl = MS.netlist(doc);
  const nm = i => (i < 0 ? '?' : nl.nodes[i].name);
  const lines = ['* MeControlEng — netlist multidomínio (analogia força-corrente)', '* nós: V (elétrico) | ω (rotacional) | v (translacional)', ''];
  for (const c of doc.comps) {
    const d = MS.DEFS[c.type];
    if (d.ground || c.type === 'LABEL') continue;
    const nodes = (nl.pinNode.get(c.id) || []).map(nm).join(' ');
    const ps = d.params.filter(p => !p.show || p.show(c.params)).map(p => `${p.k}=${c.params[p.k]}`).join(' ');
    lines.push(`${c.name.padEnd(6)} ${nodes.padEnd(18)} ${c.type.padEnd(6)} ${ps}`);
  }
  lines.push('', `.tran ${doc.sim.dt} ${doc.sim.tstop} ${doc.sim.method === 'be' ? 'method=euler' : 'method=trap'}`, '.end');
  if (nl.errors.length) lines.push('', '* ERROS:', ...nl.errors.map(e => '* ' + e));
  return lines.join('\n');
};
