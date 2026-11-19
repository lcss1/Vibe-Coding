/* ============================================================
   MecSPICE — Diagrama de blocos ↔ Grafo de fluxo de sinal + Mason
   ============================================================ */
'use strict';
(function () {
  const CS = MS.CS, h = CS.h, R = CS.rat;

  /* ───────── geometria dos blocos (unidades de grade) ───────── */
  const geo = {
    outPort(b) {
      if (b.t === 'tf') return { x: b.x + (b.flip ? -2 : 2), y: b.y, dx: b.flip ? -1 : 1, dy: 0 };
      if (b.t === 'sum') return { x: b.x + (b.flip ? -0.7 : 0.7), y: b.y, dx: b.flip ? -1 : 1, dy: 0 };
      if (b.t === 'in') return { x: b.x + 0.8, y: b.y, dx: 1, dy: 0 };
      return null;
    },
    inPorts(b) {
      if (b.t === 'tf') return [{ x: b.x + (b.flip ? 2 : -2), y: b.y, dx: b.flip ? 1 : -1, dy: 0 }];
      if (b.t === 'sum') return [{ x: b.x + (b.flip ? 0.7 : -0.7), y: b.y, dx: b.flip ? 1 : -1, dy: 0 }, { x: b.x, y: b.y + 0.7, dx: 0, dy: 1 }, { x: b.x, y: b.y - 0.7, dx: 0, dy: -1 }];
      if (b.t === 'out') return [{ x: b.x - 0.8, y: b.y, dx: -1, dy: 0 }];
      return [];
    },
    box(b) {
      if (b.t === 'tf') return { x0: b.x - 2, y0: b.y - 1, x1: b.x + 2, y1: b.y + 1 };
      if (b.t === 'sum') return { x0: b.x - 0.7, y0: b.y - 0.7, x1: b.x + 0.7, y1: b.y + 0.7 };
      return { x0: b.x - 0.9, y0: b.y - 0.6, x1: b.x + 0.9, y1: b.y + 0.6 };
    },
  };
  const route = (o, i) => {
    const a = { x: o.x + o.dx * 0.8, y: o.y }, b = { x: i.x + i.dx * 0.8, y: i.y + i.dy * 0.8 };
    const pts = [{ x: o.x, y: o.y }, a];
    if (i.dy !== 0) pts.push({ x: b.x, y: a.y });
    else if ((b.x - a.x) * o.dx > 0 || Math.abs(a.y - b.y) < 1e-9) { const mx = (a.x + b.x) / 2; pts.push({ x: mx, y: a.y }, { x: mx, y: b.y }); }
    else { pts.push({ x: a.x, y: b.y }); }
    pts.push(b, { x: i.x, y: i.y });
    return pts;
  };

  /* ───────── exemplos ───────── */
  const PRE = {
    fb: {
      name: 'Realimentação negativa G–H', blocks: [
        { id: 'r', t: 'in', x: 0, y: 0 }, { id: 's1', t: 'sum', x: 4, y: 0, signs: ['+', '-', '+'] },
        { id: 'g1', t: 'tf', x: 9, y: 0, name: 'G1', expr: '10/(s(s+2))' }, { id: 'y', t: 'out', x: 15, y: 0 },
        { id: 'h1', t: 'tf', x: 9, y: 4, name: 'H1', expr: '1/(0.1s+1)', flip: true }],
      links: [['r', 's1', 0], ['s1', 'g1', 0], ['g1', 'y', 0], ['g1', 'h1', 0], ['h1', 's1', 1]],
    },
    pid: {
      name: 'Controlador + planta (unitária)', blocks: [
        { id: 'r', t: 'in', x: 0, y: 0 }, { id: 's1', t: 'sum', x: 3, y: 0, signs: ['+', '-', '+'] },
        { id: 'c', t: 'tf', x: 7.5, y: 0, name: 'C', expr: '5(s+1)/s' }, { id: 'g', t: 'tf', x: 13, y: 0, name: 'G', expr: '1/((s+2)(s+3))' },
        { id: 'y', t: 'out', x: 18.5, y: 0 }],
      links: [['r', 's1', 0], ['s1', 'c', 0], ['c', 'g', 0], ['g', 'y', 0], ['g', 's1', 1]],
    },
    two: {
      name: 'Duas malhas (interna e externa)', blocks: [
        { id: 'r', t: 'in', x: 0, y: 0 }, { id: 's1', t: 'sum', x: 3, y: 0, signs: ['+', '-', '+'] },
        { id: 'g1', t: 'tf', x: 7, y: 0, name: 'G1', expr: '4' }, { id: 's2', t: 'sum', x: 11, y: 0, signs: ['+', '-', '+'] },
        { id: 'g2', t: 'tf', x: 15, y: 0, name: 'G2', expr: '1/(s+1)' }, { id: 'g3', t: 'tf', x: 20.5, y: 0, name: 'G3', expr: '1/s' },
        { id: 'y', t: 'out', x: 25.5, y: 0 },
        { id: 'h1', t: 'tf', x: 15, y: 3.5, name: 'H1', expr: '2', flip: true }, { id: 'h2', t: 'tf', x: 15, y: 7, name: 'H2', expr: '1', flip: true }],
      links: [['r', 's1', 0], ['s1', 'g1', 0], ['g1', 's2', 0], ['s2', 'g2', 0], ['g2', 'g3', 0], ['g3', 'y', 0], ['g2', 'h1', 0], ['h1', 's2', 1], ['g3', 'h2', 0], ['h2', 's1', 1]],
    },
    nt: {
      name: 'Laços que não se tocam', blocks: [
        { id: 'r', t: 'in', x: 0, y: 0 }, { id: 's1', t: 'sum', x: 3, y: 0, signs: ['+', '-', '+'] },
        { id: 'g1', t: 'tf', x: 7, y: 0, name: 'G1', expr: '1/(s+1)' }, { id: 'g2', t: 'tf', x: 12, y: 0, name: 'G2', expr: '5' },
        { id: 's2', t: 'sum', x: 16, y: 0, signs: ['+', '-', '+'] }, { id: 'g3', t: 'tf', x: 20, y: 0, name: 'G3', expr: '1/s' },
        { id: 'y', t: 'out', x: 25, y: 0 },
        { id: 'h1', t: 'tf', x: 7, y: 3.5, name: 'H1', expr: '2', flip: true }, { id: 'h2', t: 'tf', x: 20, y: 3.5, name: 'H2', expr: '3', flip: true }],
      links: [['r', 's1', 0], ['s1', 'g1', 0], ['g1', 'g2', 0], ['g2', 's2', 0], ['s2', 'g3', 0], ['g3', 'y', 0], ['g1', 'h1', 0], ['h1', 's1', 1], ['g3', 'h2', 0], ['h2', 's2', 1]],
    },
    par: {
      name: 'Ramos em paralelo + realimentação', blocks: [
        { id: 'r', t: 'in', x: 0, y: 0 }, { id: 's1', t: 'sum', x: 3, y: 0, signs: ['+', '-', '+'] },
        { id: 'g1', t: 'tf', x: 8, y: 0, name: 'G1', expr: '2/(s+1)' }, { id: 'g2', t: 'tf', x: 8, y: -3.5, name: 'G2', expr: '1/(s+3)' },
        { id: 's2', t: 'sum', x: 13, y: 0, signs: ['+', '+', '+'] }, { id: 'y', t: 'out', x: 17, y: 0 },
        { id: 'h1', t: 'tf', x: 8, y: 3.5, name: 'H', expr: '0.5', flip: true }],
      links: [['r', 's1', 0], ['s1', 'g1', 0], ['s1', 'g2', 0], ['g1', 's2', 0], ['g2', 's2', 2], ['s2', 'y', 0], ['s2', 'h1', 0], ['h1', 's1', 1]],
    },
  };
  const fromPreset = key => {
    const p = PRE[key];
    return { blocks: p.blocks.map(b => ({ ...b })), links: p.links.map(([f, t, port]) => ({ id: MS.uid(), from: f, to: t, port })) };
  };
  CS.BD_PRESETS = PRE;
  const load = () => { try { const d = JSON.parse(localStorage.getItem('mecspice.bd')); if (d && d.blocks) return d; } catch (e) { /* */ } return fromPreset('fb'); };
  CS.bd = load();
  const save = () => { try { localStorage.setItem('mecspice.bd', JSON.stringify(CS.bd)); } catch (e) { /* */ } };

  /* ───────── diagrama → grafo de fluxo de sinal ───────── */
  CS.bdToSFG = function (bd) {
    const B = new Map(bd.blocks.map(b => [b.id, b]));
    const ins = bd.blocks.filter(b => b.t === 'in'), outs = bd.blocks.filter(b => b.t === 'out');
    if (ins.length !== 1) throw new Error('O diagrama precisa de exatamente uma entrada R(s).');
    if (outs.length < 1) throw new Error('Adicione uma saída Y(s).');
    const nodes = [], nodeOf = new Map();
    const add = (id, name, x, y) => { nodeOf.set(id, nodes.length); nodes.push({ id, name, x, y }); };
    const inP = geo.outPort(ins[0]);
    add(ins[0].id, 'R', inP.x - 0.8, inP.y);
    let xi = 1;
    for (const b of bd.blocks) if (b.t === 'tf' || b.t === 'sum') { const o = geo.outPort(b); add(b.id, 'x' + (xi++), o.x, o.y); }
    const out = outs[0];
    add(out.id, 'Y', out.x, out.y);
    const edges = [];
    const incoming = new Map();
    for (const l of bd.links) {
      const a = B.get(l.from), b = B.get(l.to);
      if (!a || !b) continue;
      const key = l.to + ':' + l.port;
      if (incoming.has(key)) throw new Error(`Porta de entrada com mais de uma ligação em ${b.name || b.t}. Use um somador.`);
      incoming.set(key, true);
      if (!nodeOf.has(a.id) || !nodeOf.has(b.id)) continue;
      const from = nodeOf.get(a.id), to = nodeOf.get(b.id);
      if (b.t === 'tf') {
        let g; try { g = CS.parse(b.expr); } catch (e) { throw new Error(`${b.name}: ${e.message}`); }
        edges.push({ from, to, g, label: b.name, sign: 1 });
      } else if (b.t === 'sum') {
        const sg = (b.signs || ['+', '+', '+'])[l.port] === '-' ? -1 : 1;
        edges.push({ from, to, g: R.make([sg]), label: sg < 0 ? '−1' : '1', sign: sg, unit: true });
      } else if (b.t === 'out') edges.push({ from, to, g: R.one(), label: '1', sign: 1, unit: true });
    }
    for (const b of bd.blocks) if (b.t === 'tf' && !incoming.has(b.id + ':0')) throw new Error(`${b.name} está sem entrada.`);
    if (!incoming.has(out.id + ':0')) throw new Error('A saída Y(s) não está ligada.');
    return { nodes, edges, src: 0, dst: nodeOf.get(out.id) };
  };

  /* ───────── regra de Mason ───────── */
  CS.mason = function (sfg) {
    const { nodes, edges, src, dst } = sfg;
    const out = new Map(); nodes.forEach((_, i) => out.set(i, []));
    edges.forEach((e, k) => out.get(e.from).push(k));
    // caminhos diretos
    const paths = [];
    const dfs = (u, vis, es) => {
      if (u === dst) { paths.push({ nodes: new Set(vis), edges: es.slice() }); return; }
      for (const k of out.get(u)) { const v = edges[k].to; if (vis.has(v)) continue; vis.add(v); es.push(k); dfs(v, vis, es); es.pop(); vis.delete(v); }
    };
    dfs(src, new Set([src]), []);
    // laços (ciclos elementares): menor índice do ciclo é o início
    const loops = [];
    for (let s = 0; s < nodes.length; s++) {
      const go = (u, vis, es) => {
        for (const k of out.get(u)) {
          const v = edges[k].to;
          if (v === s) { loops.push({ nodes: new Set(vis), edges: [...es, k] }); continue; }
          if (v < s || vis.has(v)) continue;
          vis.add(v); es.push(k); go(v, vis, es); es.pop(); vis.delete(v);
        }
      };
      go(s, new Set([s]), []);
    }
    const gainOf = es => es.reduce((g, k) => R.mul(g, edges[k].g), R.one());
    const labelOf = es => {
      let sign = 1; const names = [];
      for (const k of es) { const e = edges[k]; if (e.unit) sign *= e.sign; else names.push(e.label); }
      return (sign < 0 ? '−' : '') + (names.join('·') || '1');
    };
    paths.forEach((p, i) => { p.g = gainOf(p.edges); p.label = labelOf(p.edges); p.name = `P${i + 1}`; });
    loops.forEach((l, i) => { l.g = gainOf(l.edges); l.label = labelOf(l.edges); l.name = `L${i + 1}`; });
    const disjoint = (a, b) => { for (const n of a) if (b.has(n)) return false; return true; };
    // combinações de laços que não se tocam
    const combos = [];   // {idx:[...], size}
    const rec = (start, chosen, used) => {
      for (let i = start; i < loops.length; i++) {
        if (!disjoint(loops[i].nodes, used)) continue;
        const c = [...chosen, i];
        combos.push(c);
        const u2 = new Set([...used, ...loops[i].nodes]);
        rec(i + 1, c, u2);
      }
    };
    rec(0, [], new Set());
    const delta = (exclude) => {
      let d = R.one();
      const terms = [];
      for (const c of combos) {
        if (exclude && c.some(i => !disjoint(loops[i].nodes, exclude))) continue;
        const g = c.reduce((acc, i) => R.mul(acc, loops[i].g), R.one());
        d = c.length % 2 ? R.sub(d, g) : R.add(d, g);
        terms.push(c);
      }
      return { d, terms };
    };
    const D = delta(null);
    let num = { num: [0], den: [1] };
    paths.forEach(p => { const dk = delta(p.nodes); p.delta = dk; num = R.add(num, R.mul(p.g, dk.d)); });
    const T = paths.length ? R.simplify(R.div(num, D.d)) : { num: [0], den: [1] };
    const deltaText = terms => {
      if (!terms.length) return '1';
      const bySize = new Map();
      for (const c of terms) { if (!bySize.has(c.length)) bySize.set(c.length, []); bySize.get(c.length).push(c.map(i => loops[i].name).join('')); }
      let s = '1';
      for (const [n, arr] of [...bySize.entries()].sort((a, b) => a[0] - b[0])) s += ` ${n % 2 ? '−' : '+'} (${arr.join(' + ')})`;
      return s;
    };
    const pairs = combos.filter(c => c.length >= 2).map(c => c.map(i => loops[i].name).join('·'));
    return { paths, loops, T, D: D.d, deltaText: deltaText(D.terms), pathDeltaText: paths.map(p => deltaText(p.delta.terms)), pairs };
  };

  /* ───────── editor (canvas) ───────── */
  CS.BlockEditor = class {
    constructor(host, onChange) {
      this.host = host; this.onChange = onChange;
      this.cv = h('canvas', { class: 'bd-cv', tabindex: 0 }); host.append(this.cv);
      this.g = this.cv.getContext('2d');
      this.view = { z: 32, ox: 40, oy: 120 };
      this.sel = null; this.drag = null; this.mode = 'blocks';
      this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(host);
      this._bind(); this.resize(); this.fit();
    }
    get bd() { return CS.bd; }
    resize() {
      const r = this.host.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
      if (r.width < 5) return;
      this.W = r.width; this.H = r.height; this.dpr = dpr;
      this.cv.width = r.width * dpr; this.cv.height = r.height * dpr; this.cv.style.width = r.width + 'px'; this.cv.style.height = r.height + 'px';
      this.draw();
    }
    fit() {
      if (!this.W || !this.bd.blocks.length) return;
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const b of this.bd.blocks) { const bx = geo.box(b); x0 = Math.min(x0, bx.x0); y0 = Math.min(y0, bx.y0); x1 = Math.max(x1, bx.x1); y1 = Math.max(y1, bx.y1); }
      x0 -= 1.5; x1 += 1.5; y0 -= 2; y1 += 2;
      const z = Math.min(44, this.W / (x1 - x0), this.H / (y1 - y0));
      this.view = { z, ox: this.W / 2 - (x0 + x1) / 2 * z, oy: this.H / 2 - (y0 + y1) / 2 * z };
      this.draw();
    }
    S(x, y) { return { x: x * this.view.z + this.view.ox, y: y * this.view.z + this.view.oy }; }
    G(px, py) { return { x: (px - this.view.ox) / this.view.z, y: (py - this.view.oy) / this.view.z }; }
    changed() { save(); this.draw(); this.onChange && this.onChange(); }
    hitBlock(p) { for (let i = this.bd.blocks.length - 1; i >= 0; i--) { const b = this.bd.blocks[i], bx = geo.box(b); if (p.x >= bx.x0 && p.x <= bx.x1 && p.y >= bx.y0 && p.y <= bx.y1) return b; } return null; }
    hitOut(p) { for (const b of this.bd.blocks) { const o = geo.outPort(b); if (o && Math.hypot(o.x - p.x, o.y - p.y) < 0.45) return b; } return null; }
    hitIn(p) { for (const b of this.bd.blocks) { const ps = geo.inPorts(b); for (let i = 0; i < ps.length; i++) if (Math.hypot(ps[i].x - p.x, ps[i].y - p.y) < 0.5) return { b, port: i }; } return null; }
    hitLink(p) {
      for (const l of this.bd.links) {
        const a = this.bd.blocks.find(b => b.id === l.from), b = this.bd.blocks.find(x => x.id === l.to); if (!a || !b) continue;
        const pts = route(geo.outPort(a), geo.inPorts(b)[l.port]);
        for (let i = 0; i < pts.length - 1; i++) if (segD(p, pts[i], pts[i + 1]) < 0.25) return l;
      }
      return null;
    }
    _bind() {
      const cv = this.cv;
      const pos = e => { const r = cv.getBoundingClientRect(); return this.G(e.clientX - r.left, e.clientY - r.top); };
      cv.addEventListener('mousedown', e => {
        cv.focus();
        if (this.mode !== 'blocks') { this.drag = { pan: true, sx: e.clientX, sy: e.clientY, ox: this.view.ox, oy: this.view.oy }; return; }
        const p = pos(e);
        if (e.button !== 0) { this.drag = { pan: true, sx: e.clientX, sy: e.clientY, ox: this.view.ox, oy: this.view.oy }; return; }
        const ob = this.hitOut(p);
        if (ob) { this.drag = { wire: ob, p }; return; }
        const b = this.hitBlock(p);
        if (b) { this.sel = b; this.drag = { block: b, dx: p.x - b.x, dy: p.y - b.y }; this.onSelect && this.onSelect(b); this.draw(); return; }
        const l = this.hitLink(p);
        this.sel = l || null; this.onSelect && this.onSelect(this.sel);
        if (!l) this.drag = { pan: true, sx: e.clientX, sy: e.clientY, ox: this.view.ox, oy: this.view.oy };
        this.draw();
      });
      cv.addEventListener('contextmenu', e => e.preventDefault());
      window.addEventListener('mousemove', e => {
        const d = this.drag; if (!d) { if (this.mode === 'blocks') { const p = pos(e); const hov = this.hitOut(p) || this.hitIn(p); cv.style.cursor = hov ? 'crosshair' : this.hitBlock(p) ? 'move' : 'default'; } return; }
        if (d.pan) { this.view.ox = d.ox + e.clientX - d.sx; this.view.oy = d.oy + e.clientY - d.sy; this.draw(); return; }
        const p = pos(e);
        if (d.block) { d.block.x = Math.round((p.x - d.dx) * 2) / 2; d.block.y = Math.round((p.y - d.dy) * 2) / 2; d.moved = true; this.draw(); }
        if (d.wire) { d.p = p; this.draw(); }
      });
      window.addEventListener('mouseup', e => {
        const d = this.drag; this.drag = null; if (!d) return;
        if (d.block && d.moved) this.changed();
        if (d.wire) {
          const t = this.hitIn(pos(e));
          if (t && t.b !== d.wire) {
            this.bd.links = this.bd.links.filter(l => !(l.to === t.b.id && l.port === t.port));
            this.bd.links.push({ id: MS.uid(), from: d.wire.id, to: t.b.id, port: t.port });
            this.changed();
          } else this.draw();
        }
      });
      cv.addEventListener('wheel', e => {
        e.preventDefault();
        const r = cv.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top;
        const z = Math.max(8, Math.min(90, this.view.z * Math.exp(-e.deltaY * 0.0015)));
        this.view.ox = px - (px - this.view.ox) * z / this.view.z; this.view.oy = py - (py - this.view.oy) * z / this.view.z; this.view.z = z; this.draw();
      }, { passive: false });
      cv.addEventListener('keydown', e => {
        if ((e.key === 'Delete' || e.key === 'Backspace') && this.sel) { this.remove(this.sel); e.preventDefault(); }
        if (e.key.toLowerCase() === 'f' && this.sel && this.sel.t) { this.sel.flip = !this.sel.flip; this.changed(); }
      });
      cv.addEventListener('dblclick', () => { if (this.sel && this.sel.t === 'tf' && this.onEdit) this.onEdit(this.sel); });
    }
    remove(o) {
      if (o.t) { this.bd.blocks = this.bd.blocks.filter(b => b !== o); this.bd.links = this.bd.links.filter(l => l.from !== o.id && l.to !== o.id); }
      else this.bd.links = this.bd.links.filter(l => l !== o);
      this.sel = null; this.onSelect && this.onSelect(null); this.changed();
    }
    addBlock(t) {
      const ys = this.bd.blocks.map(b => b.y);
      const y = (ys.length ? Math.max(...ys) : 0) + 3.5;
      const n = this.bd.blocks.filter(b => b.t === 'tf').length + 1;
      const b = { id: MS.uid(), t, x: 6, y };
      if (t === 'tf') { b.name = 'G' + n; while (this.bd.blocks.some(o => o.name === b.name)) b.name += "'"; b.expr = '1/(s+1)'; }
      if (t === 'sum') b.signs = ['+', '-', '+'];
      this.bd.blocks.push(b); this.sel = b; this.onSelect && this.onSelect(b); this.changed(); this.fit();
      return b;
    }

    draw() {
      if (!this.W) return;
      const g = this.g, css = getComputedStyle(document.documentElement), col = n => css.getPropertyValue(n).trim();
      g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      g.fillStyle = col('--sch-bg'); g.fillRect(0, 0, this.W, this.H);
      const z = this.view.z;
      // pontos da grade
      g.fillStyle = col('--sch-grid');
      const a = this.G(0, 0), b = this.G(this.W, this.H);
      if (z > 12) for (let x = Math.floor(a.x); x <= b.x; x++) for (let y = Math.floor(a.y); y <= b.y; y++) { const s = this.S(x, y); g.fillRect(s.x - 0.75, s.y - 0.75, 1.5, 1.5); }
      if (this.mode === 'sfg') return this.drawSFG(g, col);
      const fg = col('--sym'), acc = col('--acc'), sel = col('--sel');
      g.lineWidth = 1.6; g.lineCap = 'round'; g.lineJoin = 'round';
      // ligações
      const fanout = new Map();
      for (const l of this.bd.links) fanout.set(l.from, (fanout.get(l.from) || 0) + 1);
      for (const l of this.bd.links) {
        const A = this.bd.blocks.find(x => x.id === l.from), B = this.bd.blocks.find(x => x.id === l.to);
        if (!A || !B) continue;
        const pts = route(geo.outPort(A), geo.inPorts(B)[l.port]);
        g.strokeStyle = this.sel === l ? sel : col('--bd-wire');
        g.beginPath(); pts.forEach((p, i) => { const s = this.S(p.x, p.y); i ? g.lineTo(s.x, s.y) : g.moveTo(s.x, s.y); }); g.stroke();
        const e = this.S(pts[pts.length - 1].x, pts[pts.length - 1].y), pr = this.S(pts[pts.length - 2].x, pts[pts.length - 2].y);
        arrowHead(g, pr, e, g.strokeStyle);
        if (fanout.get(l.from) > 1) { const s = this.S(pts[1].x, pts[1].y); g.fillStyle = col('--bd-wire'); g.beginPath(); g.arc(s.x, s.y, 3.5, 0, Math.PI * 2); g.fill(); }
      }
      // fio sendo puxado
      if (this.drag && this.drag.wire) {
        const o = geo.outPort(this.drag.wire), s0 = this.S(o.x, o.y), s1 = this.S(this.drag.p.x, this.drag.p.y);
        g.strokeStyle = sel; g.setLineDash([5, 4]); g.beginPath(); g.moveTo(s0.x, s0.y); g.lineTo(s1.x, s1.y); g.stroke(); g.setLineDash([]);
      }
      // blocos
      for (const bl of this.bd.blocks) {
        const isSel = this.sel === bl;
        g.strokeStyle = isSel ? sel : fg; g.fillStyle = col('--bd-fill');
        const c = this.S(bl.x, bl.y);
        if (bl.t === 'tf') {
          const p0 = this.S(bl.x - 2, bl.y - 1);
          g.beginPath(); g.roundRect ? g.roundRect(p0.x, p0.y, 4 * z, 2 * z, 4) : g.rect(p0.x, p0.y, 4 * z, 2 * z); g.fill(); g.stroke();
          g.fillStyle = isSel ? sel : acc; g.font = `600 ${Math.max(10, z * 0.42)}px Barlow, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
          g.fillText(bl.name, c.x, c.y - z * 0.38);
          g.fillStyle = col('--txt'); g.font = `${Math.max(9, z * 0.34)}px "Share Tech Mono", monospace`;
          const ex = bl.expr.length > 18 ? bl.expr.slice(0, 17) + '…' : bl.expr;
          g.fillText(ex, c.x, c.y + z * 0.3);
        } else if (bl.t === 'sum') {
          g.beginPath(); g.arc(c.x, c.y, 0.7 * z, 0, Math.PI * 2); g.fill(); g.stroke();
          g.beginPath(); g.moveTo(c.x - 0.3 * z, c.y); g.lineTo(c.x + 0.3 * z, c.y); g.moveTo(c.x, c.y - 0.3 * z); g.lineTo(c.x, c.y + 0.3 * z); g.stroke();
          const used = new Set(this.bd.links.filter(l => l.to === bl.id).map(l => l.port));
          g.font = `bold ${Math.max(11, z * 0.45)}px Barlow, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
          geo.inPorts(bl).forEach((p, i) => {
            if (!used.has(i)) return;
            const sgn = (bl.signs || [])[i] === '-' ? '−' : '+';
            const s = this.S(p.x + (p.dy ? 0.45 : p.dx * 0.25), p.y + (p.dy ? p.dy * 0.15 : -0.45));
            g.fillStyle = sgn === '−' ? col('--red') : col('--grn'); g.fillText(sgn, s.x, s.y);
          });
        } else {
          g.fillStyle = isSel ? sel : col('--ylw'); g.font = `600 ${Math.max(11, z * 0.45)}px Barlow, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
          g.fillText(bl.t === 'in' ? 'R(s)' : 'Y(s)', c.x, c.y);
        }
        // portas
        const o = geo.outPort(bl); if (o) { const s = this.S(o.x, o.y); g.fillStyle = acc; g.beginPath(); g.arc(s.x, s.y, 3, 0, Math.PI * 2); g.fill(); }
        if (bl.t !== 'sum') for (const p of geo.inPorts(bl)) { const s = this.S(p.x, p.y); g.strokeStyle = acc; g.beginPath(); g.arc(s.x, s.y, 3, 0, Math.PI * 2); g.stroke(); }
      }
    }
    drawSFG(g, col) {
      let sfg, ms;
      try { sfg = CS.bdToSFG(this.bd); ms = CS.mason(sfg); } catch (e) { g.fillStyle = col('--red'); g.font = '13px Barlow'; g.fillText(e.message, 20, 30); return; }
      const z = this.view.z;
      const hl = this.highlight;   // {edges:Set, color}
      // arestas
      const pairCount = new Map();
      sfg.edges.forEach((e, k) => {
        const A = sfg.nodes[e.from], B = sfg.nodes[e.to];
        const a = this.S(A.x, A.y), b = this.S(B.x, B.y);
        const key = Math.min(e.from, e.to) + '-' + Math.max(e.from, e.to);
        const n = pairCount.get(key) || 0; pairCount.set(key, n + 1);
        const back = B.x < A.x - 1e-6 || (Math.abs(B.x - A.x) < 1e-6 && e.to < e.from);
        const dist = Math.hypot(b.x - a.x, b.y - a.y);
        let bend = back ? 0.35 * dist + 18 : (Math.abs(a.y - b.y) > 2 ? 0 : 12 * n);
        if (!back && Math.abs(A.y - B.y) > 0.1) bend = 0.12 * dist;
        const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, nx = -(b.y - a.y) / (dist || 1), ny = (b.x - a.x) / (dist || 1);
        const cx = mx + nx * bend * (back ? -1 : 1), cy = my + ny * bend * (back ? -1 : 1);
        const on = hl && hl.edges.has(k);
        g.strokeStyle = on ? hl.color : col('--bd-wire'); g.lineWidth = on ? 3 : 1.6;
        g.beginPath(); g.moveTo(a.x, a.y); g.quadraticCurveTo(cx, cy, b.x, b.y); g.stroke();
        // seta no meio
        const t = 0.55, px = (1 - t) * (1 - t) * a.x + 2 * (1 - t) * t * cx + t * t * b.x, py = (1 - t) * (1 - t) * a.y + 2 * (1 - t) * t * cy + t * t * b.y;
        const tx = 2 * (1 - t) * (cx - a.x) + 2 * t * (b.x - cx), ty = 2 * (1 - t) * (cy - a.y) + 2 * t * (b.y - cy);
        arrowHead(g, { x: px - tx * 0.01, y: py - ty * 0.01 }, { x: px, y: py }, g.strokeStyle);
        const lx = 0.25 * a.x + 0.5 * cx + 0.25 * b.x, ly = 0.25 * a.y + 0.5 * cy + 0.25 * b.y;
        g.font = `600 ${Math.max(10, z * 0.38)}px Barlow, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'bottom';
        g.fillStyle = e.unit ? (e.sign < 0 ? col('--red') : col('--txt2')) : col('--acc');
        g.fillText(e.label, lx, ly - 4);
      });
      // nós
      for (const n of sfg.nodes) {
        const s = this.S(n.x, n.y);
        g.fillStyle = n.name === 'R' || n.name === 'Y' ? col('--ylw') : col('--sym');
        g.beginPath(); g.arc(s.x, s.y, 5, 0, Math.PI * 2); g.fill();
        g.font = `${Math.max(10, z * 0.38)}px "Share Tech Mono", monospace`; g.textAlign = 'center'; g.textBaseline = 'top';
        g.fillText(n.name, s.x, s.y + 8);
      }
      void ms;
    }
  };
  function arrowHead(g, p, e, color) {
    const a = Math.atan2(e.y - p.y, e.x - p.x);
    g.fillStyle = color; g.beginPath(); g.moveTo(e.x, e.y);
    g.lineTo(e.x - 9 * Math.cos(a - 0.4), e.y - 9 * Math.sin(a - 0.4)); g.lineTo(e.x - 9 * Math.cos(a + 0.4), e.y - 9 * Math.sin(a + 0.4)); g.closePath(); g.fill();
  }
  function segD(p, a, b) { const dx = b.x - a.x, dy = b.y - a.y, l = dx * dx + dy * dy; let t = l ? ((p.x - a.x) * dx + (p.y - a.y) * dy) / l : 0; t = Math.max(0, Math.min(1, t)); return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy); }
  CS.bdFromPreset = fromPreset;
  CS.bdSave = save;
})();
