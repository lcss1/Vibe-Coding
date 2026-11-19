/* ============================================================
   MecSPICE — Matemática de sistemas de controle
   Polinômios (coeficientes em ordem CRESCENTE: p[0] + p[1]s + ...),
   números complexos, raízes (Aberth), funções racionais, parser de
   expressões em s, espaço de estados, respostas no tempo.
   ============================================================ */
'use strict';
const CS = MS.CS = {};

/* ───────── complexos ───────── */
const cx = CS.cx = {
  c: (re, im = 0) => ({ re, im }),
  add: (a, b) => ({ re: a.re + b.re, im: a.im + b.im }),
  sub: (a, b) => ({ re: a.re - b.re, im: a.im - b.im }),
  mul: (a, b) => ({ re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re }),
  div: (a, b) => { const d = b.re * b.re + b.im * b.im; return { re: (a.re * b.re + a.im * b.im) / d, im: (a.im * b.re - a.re * b.im) / d }; },
  abs: a => Math.hypot(a.re, a.im),
  arg: a => Math.atan2(a.im, a.re),
  scale: (a, k) => ({ re: a.re * k, im: a.im * k }),
};

/* ───────── polinômios ───────── */
const P = CS.poly = {
  trim(p, rel = 1e-12) {
    p = Array.from(p);
    const mx = Math.max(1e-300, ...p.map(Math.abs));
    while (p.length > 1 && Math.abs(p[p.length - 1]) <= rel * mx) p.pop();
    return p.map(v => (Math.abs(v) <= rel * 1e-3 * mx ? 0 : v));
  },
  deg: p => P.trim(p).length - 1,
  add(a, b) { const n = Math.max(a.length, b.length), r = []; for (let i = 0; i < n; i++) r.push((a[i] || 0) + (b[i] || 0)); return P.trim(r); },
  sub(a, b) { return P.add(a, b.map(v => -v)); },
  scale: (a, k) => a.map(v => v * k),
  mul(a, b) { const r = new Array(a.length + b.length - 1).fill(0); for (let i = 0; i < a.length; i++) for (let j = 0; j < b.length; j++) r[i + j] += a[i] * b[j]; return P.trim(r); },
  pow(a, n) { let r = [1]; for (let i = 0; i < n; i++) r = P.mul(r, a); return r; },
  deriv: a => (a.length <= 1 ? [0] : a.slice(1).map((v, i) => v * (i + 1))),
  evalR(a, x) { let r = 0; for (let i = a.length - 1; i >= 0; i--) r = r * x + a[i]; return r; },
  evalC(a, z) { let re = 0, im = 0; for (let i = a.length - 1; i >= 0; i--) { const t = re * z.re - im * z.im + a[i]; im = re * z.im + im * z.re; re = t; } return { re, im }; },
  fromRoots(roots, k = 1) {
    // raízes complexas em pares conjugados → polinômio real
    let p = [k];
    const used = new Set();
    roots.forEach((r, i) => {
      if (used.has(i)) return;
      if (Math.abs(r.im) < 1e-12 * Math.max(1, Math.abs(r.re))) { p = P.mul(p, [-r.re, 1]); return; }
      const j = roots.findIndex((q, jj) => jj !== i && !used.has(jj) && Math.abs(q.re - r.re) < 1e-7 * (1 + Math.abs(r.re)) && Math.abs(q.im + r.im) < 1e-7 * (1 + Math.abs(r.im)));
      if (j >= 0) used.add(j);
      p = P.mul(p, [r.re * r.re + r.im * r.im, -2 * r.re, 1]);
    });
    return p;
  },
  divmod(a, b) {
    a = P.trim(a); b = P.trim(b);
    const q = new Array(Math.max(1, a.length - b.length + 1)).fill(0), r = a.slice();
    for (let i = a.length - b.length; i >= 0; i--) {
      const c = r[i + b.length - 1] / b[b.length - 1]; q[i] = c;
      for (let j = 0; j < b.length; j++) r[i + j] -= c * b[j];
    }
    return { q: P.trim(q), r: P.trim(r.slice(0, Math.max(1, b.length - 1))) };
  },
  lead: a => P.trim(a)[P.trim(a).length - 1],

  /* raízes pelo método de Aberth–Ehrlich (ordenadas: parte real crescente) */
  roots(a) { return P._roots(a).sort((p, q) => p.re - q.re || q.im - p.im); },
  _roots(a) {
    a = P.trim(a);
    const out = [];
    while (a.length > 1 && a[0] === 0) { out.push(cx.c(0)); a = a.slice(1); }
    const n = a.length - 1;
    if (n < 1) return out;
    const lc = a[n], c = a.map(v => v / lc);
    if (n === 1) { out.push(cx.c(-c[0])); return out; }
    if (n === 2) {
      const B = c[1], Cc = c[0], d = B * B - 4 * Cc;
      if (d >= 0) { const q = -0.5 * (B + Math.sign(B || 1) * Math.sqrt(d)); out.push(cx.c(q), cx.c(q !== 0 ? Cc / q : 0)); }
      else out.push(cx.c(-B / 2, Math.sqrt(-d) / 2), cx.c(-B / 2, -Math.sqrt(-d) / 2));
      return out;
    }
    const R0 = Math.pow(Math.abs(c[0]) || 1e-3, 1 / n);
    const z = [];
    for (let k = 0; k < n; k++) { const t = 2 * Math.PI * k / n + 0.4; z.push(cx.c(R0 * Math.cos(t), R0 * Math.sin(t))); }
    const dc = P.deriv(c);
    for (let it = 0; it < 800; it++) {
      let mxw = 0;
      for (let k = 0; k < n; k++) {
        const pv = P.evalC(c, z[k]), dv = P.evalC(dc, z[k]);
        if (pv.re === 0 && pv.im === 0) continue;
        const ratio = cx.div(pv, dv);
        let sum = cx.c(0);
        for (let j = 0; j < n; j++) if (j !== k) { const d = cx.sub(z[k], z[j]); if (d.re || d.im) sum = cx.add(sum, cx.div(cx.c(1), d)); }
        const w = cx.div(ratio, cx.sub(cx.c(1), cx.mul(ratio, sum)));
        if (!isFinite(w.re) || !isFinite(w.im)) continue;
        z[k] = cx.sub(z[k], w);
        mxw = Math.max(mxw, cx.abs(w) / Math.max(1e-300, cx.abs(z[k])));
      }
      if (mxw < 1e-15) break;
    }
    // limpeza: partes imaginárias desprezíveis
    for (const r of z) {
      const s = Math.max(1e-12, cx.abs(r));
      if (Math.abs(r.im) < 1e-8 * s) r.im = 0;
      if (Math.abs(r.re) < 1e-10 * s) r.re = 0;
    }
    return out.concat(z).sort((p, q) => p.re - q.re || q.im - p.im);
  },
};

/* ───────── funções racionais (num/den) ───────── */
const R = CS.rat = {
  make: (num, den = [1]) => R.norm({ num: P.trim(num), den: P.trim(den) }),
  norm(r) {
    const l = P.lead(r.den);
    if (!l) throw new Error('denominador nulo');
    return { num: P.trim(r.num.map(v => v / l)), den: P.trim(r.den.map(v => v / l)) };
  },
  mul: (a, b) => R.norm({ num: P.mul(a.num, b.num), den: P.mul(a.den, b.den) }),
  div: (a, b) => { if (P.trim(b.num).every(v => v === 0)) throw new Error('divisão por zero'); return R.norm({ num: P.mul(a.num, b.den), den: P.mul(a.den, b.num) }); },
  add: (a, b) => R.norm({ num: P.add(P.mul(a.num, b.den), P.mul(b.num, a.den)), den: P.mul(a.den, b.den) }),
  sub: (a, b) => R.add(a, { num: b.num.map(v => -v), den: b.den }),
  neg: a => ({ num: a.num.map(v => -v), den: a.den }),
  one: () => ({ num: [1], den: [1] }),
  isZero: a => P.trim(a.num).every(v => Math.abs(v) < 1e-300),
  evalC: (r, s) => cx.div(P.evalC(r.num, s), P.evalC(r.den, s)),
  feedback: (G, H, sign = -1) => R.simplify(R.div(G, R.sub(R.one(), R.scaleK(R.mul(G, H), sign)))),
  scaleK: (a, k) => ({ num: a.num.map(v => v * k), den: a.den }),
  /* cancela pares polo-zero coincidentes */
  simplify(r, tol = 1e-6) {
    if (R.isZero(r)) return { num: [0], den: [1] };
    const z = P.roots(r.num), p = P.roots(r.den);
    const k = P.lead(r.num) / P.lead(r.den);
    const zl = [], pl = p.slice();
    for (const zz of z) {
      const i = pl.findIndex(pp => cx.abs(cx.sub(pp, zz)) < tol * Math.max(1, cx.abs(pp)));
      if (i >= 0) pl.splice(i, 1); else zl.push(zz);
    }
    if (zl.length === z.length) return R.norm(r);
    return R.norm({ num: P.fromRoots(zl, k), den: P.fromRoots(pl, 1) });
  },
  zpk(r) { return { z: P.roots(r.num), p: P.roots(r.den), k: P.lead(r.num) / P.lead(r.den) }; },
  dcGain(r) {
    const n0 = r.num[0] || 0, d0 = r.den[0] || 0;
    if (Math.abs(d0) < 1e-14 * Math.max(...r.den.map(Math.abs))) return n0 === 0 ? NaN : Infinity;
    return n0 / d0;
  },
  /* tipo do sistema = nº de polos na origem */
  type(r) { let t = 0; const d = P.trim(r.den); while (t < d.length - 1 && Math.abs(d[t]) < 1e-12 * Math.max(...d.map(Math.abs))) t++; return t; },
};

/* ───────── parser de expressões em s ─────────
   Aceita: 10(s+1)/(s(s+2)(s+5)), s^2+2*s+1, 1/(0.5s+1), (s+1)^2, 2.5e-3s
   Retorna função racional {num, den}.                                       */
CS.parse = function (str) {
  const src = String(str).replace(/,/g, '.').replace(/·|×/g, '*').replace(/\s+/g, '');
  if (!src) throw new Error('expressão vazia');
  let i = 0;
  const peek = () => src[i];
  const num = v => ({ num: [v], den: [1] });
  function expr() {
    let r = term();
    while (peek() === '+' || peek() === '-') { const op = src[i++]; const t = term(); r = op === '+' ? R.add(r, t) : R.sub(r, t); }
    return r;
  }
  function term() {
    let r = unary();
    while (i < src.length) {
      const c = peek();
      if (c === '*') { i++; r = R.mul(r, unary()); }
      else if (c === '/') { i++; r = R.div(r, unary()); }
      else if (c === '(' || c === 's' || /[0-9.]/.test(c)) r = R.mul(r, unary());
      else break;
    }
    return r;
  }
  function unary() { if (peek() === '-') { i++; return R.neg(unary()); } if (peek() === '+') { i++; return unary(); } return power(); }
  function power() {
    let b = primary();
    if (peek() === '^') {
      i++;
      const m = src.slice(i).match(/^\d+/);
      if (!m) throw new Error('expoente deve ser inteiro ≥ 0');
      i += m[0].length;
      const n = +m[0];
      let r = R.one(); for (let k = 0; k < n; k++) r = R.mul(r, b); b = r;
    }
    return b;
  }
  function primary() {
    const c = peek();
    if (c === '(') { i++; const r = expr(); if (peek() !== ')') throw new Error('falta ")"'); i++; return r; }
    if (c === 's') { i++; return { num: [0, 1], den: [1] }; }
    const m = src.slice(i).match(/^(\d+\.?\d*|\.\d+)(e[-+]?\d+)?/i);
    if (m) { i += m[0].length; return num(parseFloat(m[0])); }
    throw new Error(c ? `símbolo inesperado "${c}"` : 'expressão incompleta');
  }
  const r = expr();
  if (i < src.length) throw new Error(`símbolo inesperado "${src[i]}"`);
  return R.norm(r);
};

/* ───────── formatação ───────── */
CS.fmtNum = function (v, d = 4) {
  if (!isFinite(v)) return v > 0 ? '∞' : v < 0 ? '−∞' : '—';
  if (Math.abs(v) < 1e-12) return '0';
  const a = Math.abs(v);
  let s = (a >= 1e5 || a < 1e-3) ? v.toExponential(d - 1).replace(/\.?0+e/, 'e') : String(+v.toPrecision(d));
  return s.replace('-', '−');
};
CS.fmtC = function (z, d = 4) {
  if (Math.abs(z.im) < 1e-12) return CS.fmtNum(z.re, d);
  return `${CS.fmtNum(z.re, d)} ${z.im >= 0 ? '+' : '−'} j${CS.fmtNum(Math.abs(z.im), d)}`;
};
/* polinômio em HTML (ordem decrescente) */
CS.polyHTML = function (p, v = 's') {
  p = P.trim(p);
  const terms = [];
  for (let k = p.length - 1; k >= 0; k--) {
    const c = p[k]; if (Math.abs(c) < 1e-14 * Math.max(...p.map(Math.abs))) continue;
    const a = Math.abs(c), sign = c < 0 ? '−' : '+';
    let coef = (Math.abs(a - 1) < 1e-12 && k > 0) ? '' : CS.fmtNum(a);
    const pw = k === 0 ? '' : k === 1 ? v : `${v}<sup>${k}</sup>`;
    terms.push({ sign, t: coef + pw });
  }
  if (!terms.length) return '0';
  return terms.map((t, i) => (i === 0 ? (t.sign === '−' ? '−' : '') : ` ${t.sign} `) + t.t).join('');
};
CS.polyText = p => CS.polyHTML(p).replace(/<sup>(\d+)<\/sup>/g, '^$1');
CS.ratHTML = function (r, name) {
  const n = CS.polyHTML(r.num), d = CS.polyHTML(r.den);
  const lhs = name ? `<span class="tf-name">${name}</span> = ` : '';
  if (P.trim(r.den).length === 1 && Math.abs(r.den[0] - 1) < 1e-12) return `${lhs}<span class="tf-inline">${n}</span>`;
  return `${lhs}<span class="frac"><span class="fn">${n}</span><span class="fd">${d}</span></span>`;
};
/* forma fatorada: K (s−z1)(s²+...)/((s−p1)...) */
CS.factorHTML = function (r) {
  const { z, p, k } = R.zpk(r);
  const fac = roots => {
    const parts = [], used = new Set();
    const cnt = new Map();
    roots.forEach((q, i) => {
      if (used.has(i)) return;
      let txt;
      if (q.im === 0) {
        txt = q.re === 0 ? 's' : `(s ${q.re < 0 ? '+' : '−'} ${CS.fmtNum(Math.abs(q.re))})`;
      } else {
        const j = roots.findIndex((w, jj) => jj !== i && !used.has(jj) && Math.abs(w.re - q.re) < 1e-6 * (1 + Math.abs(q.re)) && Math.abs(w.im + q.im) < 1e-6 * (1 + Math.abs(q.im)));
        if (j >= 0) used.add(j);
        const a = -2 * q.re, b = q.re * q.re + q.im * q.im;
        txt = `(s<sup>2</sup> ${a < 0 ? '−' : '+'} ${CS.fmtNum(Math.abs(a))}s + ${CS.fmtNum(b)})`;
      }
      cnt.set(txt, (cnt.get(txt) || 0) + 1);
    });
    for (const [t, n] of cnt) parts.push(n > 1 ? `${t}<sup>${n}</sup>` : t);
    return parts.join('');
  };
  const nTxt = (Math.abs(k - 1) < 1e-12 && z.length ? '' : CS.fmtNum(k)) + fac(z);
  const dTxt = fac(p) || '1';
  if (dTxt === '1') return nTxt || '1';
  return `<span class="frac"><span class="fn">${nTxt || '1'}</span><span class="fd">${dTxt}</span></span>`;
};

/* ───────── álgebra de matrizes (pequenas) ───────── */
const Mx = CS.mat = {
  zeros: (n, m) => Array.from({ length: n }, () => new Array(m).fill(0)),
  eye: n => Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))),
  mul(A, B) { const n = A.length, m = B[0].length, k = B.length, C = Mx.zeros(n, m); for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) { let s = 0; for (let l = 0; l < k; l++) s += A[i][l] * B[l][j]; C[i][j] = s; } return C; },
  add: (A, B) => A.map((r, i) => r.map((v, j) => v + B[i][j])),
  scale: (A, k) => A.map(r => r.map(v => v * k)),
  T: A => A[0].map((_, j) => A.map(r => r[j])),
  trace: A => A.reduce((s, r, i) => s + r[i], 0),
  rank(A, tol = 1e-9) {
    const M = A.map(r => r.slice()); const n = M.length, m = M[0].length;
    const mx = Math.max(1e-300, ...M.flat().map(Math.abs));
    let rank = 0;
    for (let c = 0; c < m && rank < n; c++) {
      let p = rank; for (let i = rank + 1; i < n; i++) if (Math.abs(M[i][c]) > Math.abs(M[p][c])) p = i;
      if (Math.abs(M[p][c]) <= tol * mx) continue;
      [M[p], M[rank]] = [M[rank], M[p]];
      for (let i = rank + 1; i < n; i++) { const f = M[i][c] / M[rank][c]; for (let j = c; j < m; j++) M[i][j] -= f * M[rank][j]; }
      rank++;
    }
    return rank;
  },
  /* exponencial de matriz: escalonamento e quadratura + Taylor */
  expm(A) {
    const n = A.length;
    const nrm = Math.max(...A.map(r => r.reduce((s, v) => s + Math.abs(v), 0)));
    const sq = Math.max(0, Math.ceil(Math.log2(nrm || 1)) + 1);
    const As = Mx.scale(A, 1 / Math.pow(2, sq));
    let E = Mx.eye(n), term = Mx.eye(n);
    for (let k = 1; k <= 18; k++) { term = Mx.scale(Mx.mul(term, As), 1 / k); E = Mx.add(E, term); }
    for (let k = 0; k < sq; k++) E = Mx.mul(E, E);
    return E;
  },
  parse(str) {
    const rows = String(str).trim().replace(/[\[\]]/g, '').split(/;|\n/).map(r => r.trim()).filter(Boolean);
    const M = rows.map(r => r.split(/[\s,]+/).filter(Boolean).map(v => { const x = MS.parseEng(v.replace('−', '-')); if (!isFinite(x)) throw new Error(`valor inválido "${v}"`); return x; }));
    if (!M.length) throw new Error('matriz vazia');
    if (M.some(r => r.length !== M[0].length)) throw new Error('linhas com tamanhos diferentes');
    return M;
  },
  str: M => M.map(r => r.map(v => CS.fmtNum(v)).join('  ')).join('; '),
};

/* ───────── espaço de estados ───────── */
CS.ss = {
  /* G(s) → forma canônica controlável */
  fromTF(r, form = 'ctrl') {
    const den = P.trim(r.den), n = den.length - 1;
    const a = den.map(v => v / den[n]);
    let num = P.trim(r.num).map(v => v / den[n]);
    if (num.length - 1 > n) throw new Error('G(s) imprópria (grau do numerador > denominador)');
    const D = num.length - 1 === n ? num[n] : 0;
    const b = []; for (let i = 0; i < n; i++) b.push((num[i] || 0) - D * a[i]);
    if (n === 0) return { A: [], B: [], C: [], D: [[D]], n: 0 };
    const A = Mx.zeros(n, n);
    for (let i = 0; i < n - 1; i++) A[i][i + 1] = 1;
    for (let j = 0; j < n; j++) A[n - 1][j] = -a[j];
    const B = Mx.zeros(n, 1); B[n - 1][0] = 1;
    const C = [b.slice()];
    let sys = { A, B, C, D: [[D]], n };
    if (form === 'obs') sys = { A: Mx.T(A), B: Mx.T(C), C: Mx.T(B), D: [[D]], n };
    return sys;
  },
  /* polinômio característico e adjunta (Faddeev–LeVerrier) → G(s) */
  toTF(sys) {
    const { A, B, C, D } = sys, n = A.length;
    if (!n) return R.make([D[0][0]]);
    const c = new Array(n + 1).fill(0); c[n] = 1;
    let M = Mx.zeros(n, n);
    const Ms = [];
    for (let k = 1; k <= n; k++) {
      M = Mx.add(Mx.mul(A, M), Mx.scale(Mx.eye(n), c[n - k + 1]));
      Ms.push(M);
      c[n - k] = -Mx.trace(Mx.mul(A, M)) / k;
    }
    // adj(sI−A) = Σ M_k s^{n−k}
    const num = new Array(n + 1).fill(0);
    Ms.forEach((Mk, idx) => { const k = idx + 1; const v = Mx.mul(Mx.mul(C, Mk), B)[0][0]; num[n - k] += v; });
    const Dv = D && D[0] ? D[0][0] : 0;
    for (let i = 0; i <= n; i++) num[i] += Dv * c[i];
    return R.make(num, c);
  },
  ctrb(A, B) { const n = A.length; let M = B.map(r => r.slice()); let cur = B; for (let k = 1; k < n; k++) { cur = Mx.mul(A, cur); M = M.map((r, i) => r.concat(cur[i])); } return M; },
  obsv(A, C) { const n = A.length; let M = C.map(r => r.slice()); let cur = C; for (let k = 1; k < n; k++) { cur = Mx.mul(cur, A); M = M.concat(cur); } return M; },
};

/* ───────── respostas no tempo (discretização exata ZOH) ───────── */
CS.autoTime = function (r) {
  const p = P.roots(r.den);
  let tmax = 0;
  for (const q of p) {
    const m = cx.abs(q);
    if (q.re < -1e-9) tmax = Math.max(tmax, 5 / -q.re, q.im ? 0 : 0);
    else tmax = Math.max(tmax, m > 1e-9 ? 8 / m : 10);
  }
  if (!tmax) tmax = 10;
  const fast = Math.max(...p.map(cx.abs), 1e-6);
  return Math.min(tmax, 2000 / fast * 50, 1e6);
};
CS.response = function (r, kind = 'step', tEnd, N = 600) {
  const sys = CS.ss.fromTF(r);
  tEnd = tEnd || CS.autoTime(r);
  const h = tEnd / N, n = sys.n;
  const t = [], y = [];
  const Dv = sys.D[0][0];
  if (n === 0) { for (let i = 0; i <= N; i++) { t.push(i * h); y.push(kind === 'impulse' ? 0 : Dv * (kind === 'ramp' ? i * h : 1)); } return { t, y }; }
  // matriz aumentada [[A B],[0 0]] → Φ, Γ
  const Mau = Mx.zeros(n + 1, n + 1);
  for (let i = 0; i < n; i++) { for (let j = 0; j < n; j++) Mau[i][j] = sys.A[i][j] * h; Mau[i][n] = sys.B[i][0] * h; }
  const E = Mx.expm(Mau);
  let x = new Array(n).fill(0);
  if (kind === 'impulse') x = sys.B.map(r0 => r0[0]);
  const out = () => sys.C[0].reduce((s, c, i) => s + c * x[i], 0);
  for (let i = 0; i <= N; i++) {
    const ti = i * h, u = kind === 'step' ? 1 : kind === 'ramp' ? ti : 0;
    t.push(ti); y.push(out() + Dv * u);
    const uk = kind === 'ramp' ? ti + h / 2 : u;
    const nx = new Array(n).fill(0);
    for (let a = 0; a < n; a++) { let s = E[a][n] * uk; for (let b = 0; b < n; b++) s += E[a][b] * x[b]; nx[a] = s; }
    x = nx;
    if (x.some(v => !isFinite(v) || Math.abs(v) > 1e150)) break;
  }
  return { t, y };
};
/* métricas da resposta ao degrau */
CS.stepInfo = function (r, resp) {
  const { t, y } = resp;
  const p = P.roots(r.den);
  const stable = p.every(q => q.re < -1e-9);
  const out = { stable };
  if (!stable) return out;
  const yf = R.dcGain(r); out.yf = yf;
  if (!isFinite(yf) || Math.abs(yf) < 1e-15) return out;
  let pk = -Infinity, tp = 0;
  for (let i = 0; i < y.length; i++) if (y[i] / yf > pk) { pk = y[i] / yf; tp = t[i]; }
  out.Mp = Math.max(0, (pk - 1) * 100); out.tp = out.Mp > 0.05 ? tp : NaN;
  const cross = lvl => { for (let i = 1; i < y.length; i++) if (y[i] / yf >= lvl) { const f = (lvl - y[i - 1] / yf) / ((y[i] - y[i - 1]) / yf || 1); return t[i - 1] + f * (t[i] - t[i - 1]); } return NaN; };
  out.tr = cross(0.9) - cross(0.1);
  let ts = 0; for (let i = y.length - 1; i >= 0; i--) if (Math.abs(y[i] / yf - 1) > 0.02) { ts = t[Math.min(y.length - 1, i + 1)]; break; }
  out.ts = ts;
  return out;
};

/* ───────── frações parciais (resíduos, inclusive polos repetidos) ───────── */
CS.partialFractions = function (r) {
  r = R.simplify(r);
  let num = P.trim(r.num), den = P.trim(r.den);
  let direct = [0];
  if (num.length >= den.length) { const d = P.divmod(num, den); direct = d.q; num = d.r; }
  const roots = P.roots(den);
  // agrupar polos repetidos
  const groups = [];
  for (const q of roots) {
    const g = groups.find(gg => cx.abs(cx.sub(gg.p, q)) < 1e-4 * Math.max(1, cx.abs(q)));
    if (g) { g.m++; g.p = cx.scale(cx.add(cx.scale(g.p, g.m - 1), q), 1 / g.m); } else groups.push({ p: { ...q }, m: 1 });
  }
  const lc = P.lead(den);
  const terms = [];
  for (const g of groups) {
    // F(s)(s−p)^m = N(s)/(lc·Π_{outros}(s−q)^mq) ; coeficientes via derivadas numéricas por série
    const others = groups.filter(o => o !== g);
    const phi = s => { let d = cx.c(lc); for (const o of others) for (let k = 0; k < o.m; k++) d = cx.mul(d, cx.sub(s, o.p)); return cx.div(P.evalC(num, s), d); };
    // derivadas por fórmula de Cauchy (contorno circular pequeno)
    const rad = 0.05 * Math.max(1e-3, Math.min(...others.map(o => cx.abs(cx.sub(o.p, g.p))), cx.abs(g.p) || 1, 1));
    const M = 64;
    const coef = [];
    for (let k = 0; k < g.m; k++) {
      let acc = cx.c(0);
      for (let j = 0; j < M; j++) {
        const th = 2 * Math.PI * j / M;
        const e = cx.c(Math.cos(th), Math.sin(th));
        const v = phi(cx.add(g.p, cx.scale(e, rad)));
        const ek = cx.c(Math.cos(-k * th), Math.sin(-k * th));
        acc = cx.add(acc, cx.mul(v, ek));
      }
      coef.push(cx.scale(acc, 1 / (M * Math.pow(rad, k))));   // = φ^(k)(p)/k!
    }
    // termo A_j/(s−p)^j com j = m−k
    for (let k = 0; k < g.m; k++) terms.push({ p: g.p, j: g.m - k, A: coef[k] });
  }
  return { terms, direct: P.trim(direct) };
};
/* f(t) a partir das frações parciais (texto) */
CS.inverseText = function (pf) {
  const parts = [];
  const done = new Set();
  pf.terms.forEach((tm, i) => {
    if (done.has(i)) return;
    const { p, j, A } = tm;
    const tpow = j > 1 ? (j - 1 === 1 ? 't·' : `t<sup>${j - 1}</sup>/${fact(j - 1)}·`) : '';
    if (Math.abs(p.im) < 1e-10) {
      const a = A.re;
      if (Math.abs(a) < 1e-12) return;
      const ex = expTxt(p.re);
      const body = (tpow + ex).replace(/·$/, '');
      const ca = Math.abs(a), cTxt = Math.abs(ca - 1) < 1e-9 && body ? '' : CS.fmtNum(ca) + (body ? '·' : '');
      parts.push({ v: a, txt: cTxt + body });
    } else {
      const k = pf.terms.findIndex((o, jj) => jj !== i && !done.has(jj) && o.j === j && Math.abs(o.p.re - p.re) < 1e-6 * (1 + Math.abs(p.re)) && Math.abs(o.p.im + p.im) < 1e-6 * (1 + Math.abs(p.im)));
      if (k >= 0) done.add(k);
      // A e^{pt} + Ā e^{p̄t} = 2e^{σt}(Re A cos ωt − Im A sin ωt)
      const w = Math.abs(p.im), sg = p.im > 0 ? 1 : -1;
      const c1 = 2 * A.re, c2 = -2 * A.im * sg;
      const ex = expTxt(p.re) ? expTxt(p.re) + '·' : '';
      const trig = [];
      const wt = (Math.abs(w - 1) < 1e-9 ? '' : CS.fmtNum(w)) + 't';
      if (Math.abs(c1) > 1e-12) trig.push(`${CS.fmtNum(c1)}·cos(${wt})`);
      if (Math.abs(c2) > 1e-12) trig.push((trig.length ? (c2 < 0 ? '− ' : '+ ') : (c2 < 0 ? '−' : '')) + `${CS.fmtNum(Math.abs(c2))}·sen(${wt})`);
      parts.push({ v: 1, txt: `${tpow}${ex}[${trig.join(' ')}]` });
    }
    done.add(i);
  });
  const d = pf.direct;
  let s = parts.map((p, i) => (i === 0 ? (p.v < 0 ? '−' : '') : (p.v < 0 ? ' − ' : ' + ')) + p.txt).join('');
  if (!s) s = '0';
  const imp = d.some(v => Math.abs(v) > 1e-12) ? d.map((v, k) => Math.abs(v) > 1e-12 ? `${CS.fmtNum(v)}·δ${k ? `<sup>(${k})</sup>` : ''}(t)` : '').filter(Boolean).join(' + ') + ' + ' : '';
  return imp + s + ' &nbsp;(t ≥ 0)';
};
function expTxt(re) {
  if (Math.abs(re) < 1e-12) return '';
  const a = Math.abs(re), c = Math.abs(a - 1) < 1e-9 ? '' : CS.fmtNum(a);
  return `e<sup>${re < 0 ? '−' : ''}${c}t</sup>`;
}
function fact(n) { let r = 1; for (let i = 2; i <= n; i++) r *= i; return r; }

/* ───────── características de 2ª ordem dos polos dominantes ───────── */
CS.dominant = function (r) {
  const p = P.roots(r.den).filter(q => q.re < 0);
  if (!p.length) return null;
  p.sort((a, b) => b.re - a.re);
  const q = p[0];
  if (q.im === 0) return { kind: 1, tau: -1 / q.re, p: q };
  const wn = cx.abs(q), zeta = -q.re / wn;
  return { kind: 2, wn, zeta, wd: Math.abs(q.im), p: q };
};
