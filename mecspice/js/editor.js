/* ============================================================
   MecSPICE — Editor de esquemático (canvas 2D)
   ============================================================ */
'use strict';

MS.Editor = class {
  constructor(canvas, app) {
    this.cv = canvas; this.ctx = canvas.getContext('2d'); this.app = app;
    this.view = { ox: 200, oy: 150, z: 20 };
    this.mode = 'select';            // select | wire | place | probe
    this.placing = null;              // {type, rot}
    this.wireStart = null;            // {x,y}
    this.sel = new Set();             // objetos selecionados (comps e wires)
    this.mouse = { x: 0, y: 0, gx: 0, gy: 0, sx: 0, sy: 0 };
    this.drag = null;
    this.hoverNet = -1;
    this.nl = null;
    this.needDraw = true;
    this._bind();
    const loop = () => { if (this.needDraw) { this.needDraw = false; this.draw(); } requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  }
  get doc() { return this.app.doc; }
  redraw() { this.needDraw = true; }
  refreshNetlist() { this.nl = MS.netlist(this.doc); this.redraw(); }

  /* ── coordenadas ── */
  toScreen(x, y) { return { x: x * this.view.z + this.view.ox, y: y * this.view.z + this.view.oy }; }
  toGrid(sx, sy) { return { x: (sx - this.view.ox) / this.view.z, y: (sy - this.view.oy) / this.view.z }; }

  resize() {
    const r = this.cv.parentElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.cv.width = Math.max(10, r.width * dpr); this.cv.height = Math.max(10, r.height * dpr);
    this.cv.style.width = r.width + 'px'; this.cv.style.height = r.height + 'px';
    this.dpr = dpr; this.W = r.width; this.H = r.height; this.redraw();
  }

  fit() {
    const b = this.bounds();
    if (!b) { this.view = { ox: this.W / 2, oy: this.H / 2, z: 20 }; this.redraw(); return; }
    const w = b.x1 - b.x0 + 6, h = b.y1 - b.y0 + 6;
    const z = Math.max(6, Math.min(40, Math.min(this.W / w, this.H / h)));
    this.view.z = z;
    this.view.ox = this.W / 2 - ((b.x0 + b.x1) / 2) * z;
    this.view.oy = this.H / 2 - ((b.y0 + b.y1) / 2) * z;
    this.redraw();
  }
  bounds() {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    const add = (x, y) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); };
    for (const c of this.doc.comps) { const bb = this.compBox(c); add(bb.x0, bb.y0); add(bb.x1, bb.y1); }
    for (const w of this.doc.wires) { add(w.x1, w.y1); add(w.x2, w.y2); }
    return isFinite(x0) ? { x0, y0, x1, y1 } : null;
  }
  compBox(c) {
    const b = MS.DEFS[c.type].bbox;
    const p1 = MS.rotPt(b[0], b[1], c.rot), p2 = MS.rotPt(b[2], b[3], c.rot);
    return { x0: c.x + Math.min(p1.x, p2.x), y0: c.y + Math.min(p1.y, p2.y), x1: c.x + Math.max(p1.x, p2.x), y1: c.y + Math.max(p1.y, p2.y) };
  }

  /* ── hit tests ── */
  hitComp(gx, gy) {
    for (let i = this.doc.comps.length - 1; i >= 0; i--) {
      const c = this.doc.comps[i], b = this.compBox(c);
      if (gx >= b.x0 - 0.2 && gx <= b.x1 + 0.2 && gy >= b.y0 - 0.2 && gy <= b.y1 + 0.2) return c;
    }
    return null;
  }
  hitWire(gx, gy) {
    const tol = Math.max(0.25, 6 / this.view.z);
    let best = null, bd = tol;
    for (const w of this.doc.wires) {
      const d = segDist(gx, gy, w.x1, w.y1, w.x2, w.y2);
      if (d < bd) { bd = d; best = w; }
    }
    return best;
  }
  hitPin(gx, gy) {
    const tol = Math.max(0.3, 6 / this.view.z);
    for (const c of this.doc.comps) {
      const d = MS.DEFS[c.type];
      for (let i = 0; i < d.pins.length; i++) { const p = MS.pinPos(c, i); if (Math.hypot(p.x - gx, p.y - gy) < tol) return { c, i, x: p.x, y: p.y }; }
    }
    return null;
  }
  isConnPoint(x, y) {
    for (const c of this.doc.comps) { const d = MS.DEFS[c.type]; for (let i = 0; i < d.pins.length; i++) { const p = MS.pinPos(c, i); if (p.x === x && p.y === y) return true; } }
    for (const w of this.doc.wires) { if ((w.x1 === x && w.y1 === y) || (w.x2 === x && w.y2 === y) || MS.onSegInterior(x, y, w)) return true; }
    return false;
  }
  netAt(gx, gy) {
    if (!this.nl) return -1;
    const pin = this.hitPin(gx, gy);
    if (pin) return this.nl.pinNode.get(pin.c.id)[pin.i];
    const w = this.hitWire(gx, gy);
    if (w) return this.nl.wireNode.get(w.id);
    return -1;
  }

  /* ── modos ── */
  setMode(m, arg) {
    this.mode = m;
    this.wireStart = null;
    this.placing = m === 'place' ? { type: arg, rot: 0 } : null;
    this.cv.style.cursor = m === 'wire' ? 'crosshair' : m === 'probe' ? 'none' : m === 'place' ? 'copy' : 'default';
    this.app.onModeChange(m, arg);
    this.redraw();
  }

  rotateSel() {
    if (this.mode === 'place' && this.placing) { this.placing.rot = (this.placing.rot + 1) % 4; this.redraw(); return; }
    const comps = [...this.sel].filter(o => o.type);
    if (!comps.length) return;
    this.app.snapshot();
    for (const c of comps) c.rot = (c.rot + 1) % 4;
    this.app.changed();
  }
  deleteSel() {
    if (!this.sel.size) return;
    this.app.snapshot();
    this.doc.comps = this.doc.comps.filter(c => !this.sel.has(c));
    this.doc.wires = this.doc.wires.filter(w => !this.sel.has(w));
    this.sel.clear();
    this.app.onSelect(null);
    this.app.changed();
  }
  duplicateSel() {
    const comps = [...this.sel].filter(o => o.type);
    const wires = [...this.sel].filter(o => !o.type);
    if (!comps.length && !wires.length) return;
    this.app.snapshot();
    const nsel = new Set();
    for (const c of comps) { const n = MS.newComp(c.type, c.x + 3, c.y + 3, c.rot, this.doc); n.params = { ...c.params }; this.doc.comps.push(n); nsel.add(n); }
    for (const w of wires) { const n = { id: MS.uid(), x1: w.x1 + 3, y1: w.y1 + 3, x2: w.x2 + 3, y2: w.y2 + 3 }; this.doc.wires.push(n); nsel.add(n); }
    this.sel = nsel;
    this.app.onSelect(comps.length === 1 ? [...nsel][0] : null);
    this.app.changed();
  }
  selectAll() { this.sel = new Set([...this.doc.comps, ...this.doc.wires]); this.redraw(); }

  addWirePath(a, b) {
    // rota em L: primeiro no eixo de maior deslocamento
    const segs = [];
    if (a.x === b.x || a.y === b.y) segs.push([a.x, a.y, b.x, b.y]);
    else if (Math.abs(b.x - a.x) >= Math.abs(b.y - a.y)) { segs.push([a.x, a.y, b.x, a.y]); segs.push([b.x, a.y, b.x, b.y]); }
    else { segs.push([a.x, a.y, a.x, b.y]); segs.push([a.x, b.y, b.x, b.y]); }
    for (const s of segs) if (s[0] !== s[2] || s[1] !== s[3]) this.doc.wires.push({ id: MS.uid(), x1: s[0], y1: s[1], x2: s[2], y2: s[3] });
  }

  /* ── eventos ── */
  _bind() {
    const cv = this.cv;
    cv.addEventListener('contextmenu', e => e.preventDefault());
    cv.addEventListener('wheel', e => {
      e.preventDefault();
      const f = Math.exp(-e.deltaY * 0.0015);
      const z = Math.max(4, Math.min(80, this.view.z * f));
      const r = cv.getBoundingClientRect(), sx = e.clientX - r.left, sy = e.clientY - r.top;
      this.view.ox = sx - (sx - this.view.ox) * z / this.view.z;
      this.view.oy = sy - (sy - this.view.oy) * z / this.view.z;
      this.view.z = z; this.redraw();
    }, { passive: false });

    cv.addEventListener('mousedown', e => {
      cv.focus();
      const r = cv.getBoundingClientRect(), sx = e.clientX - r.left, sy = e.clientY - r.top;
      const g = this.toGrid(sx, sy), gx = Math.round(g.x), gy = Math.round(g.y);
      this.app.hideMenu();
      if (e.button === 1 || e.button === 2) {
        if (e.button === 2 && this.mode === 'wire' && this.wireStart) { this.wireStart = null; this.redraw(); return; }
        if (e.button === 2 && (this.mode === 'place' || this.mode === 'wire') ) { this.setMode('select'); return; }
        this.drag = { kind: 'pan', sx, sy, ox: this.view.ox, oy: this.view.oy, moved: false, btn: e.button };
        return;
      }
      if (this.mode === 'place') {
        this.app.snapshot();
        const c = MS.newComp(this.placing.type, gx, gy, this.placing.rot, this.doc);
        this.doc.comps.push(c);
        this.sel = new Set([c]); this.app.onSelect(c);
        this.app.changed();
        if (!e.shiftKey && MS.DEFS[c.type].ground === undefined && false) this.setMode('select');
        return;
      }
      if (this.mode === 'wire') {
        if (!this.wireStart) { this.wireStart = { x: gx, y: gy }; this.redraw(); return; }
        if (gx === this.wireStart.x && gy === this.wireStart.y) { this.wireStart = null; this.redraw(); return; }
        this.app.snapshot();
        const end = { x: gx, y: gy };
        const connected = this.isConnPoint(gx, gy);
        this.addWirePath(this.wireStart, end);
        this.wireStart = connected ? null : end;
        this.app.changed();
        return;
      }
      if (this.mode === 'probe') { this.app.probeAt(g.x, g.y, e); return; }
      // select
      const c = this.hitComp(g.x, g.y);
      const w = c ? null : this.hitWire(g.x, g.y);
      const obj = c || w;
      if (obj) {
        if (e.shiftKey || e.ctrlKey) { if (this.sel.has(obj)) this.sel.delete(obj); else this.sel.add(obj); }
        else if (!this.sel.has(obj)) this.sel = new Set([obj]);
        this.app.onSelect(this.sel.size === 1 ? [...this.sel][0] : null);
        // preparar arrasto
        const comps = [...this.sel].filter(o => o.type), wires = [...this.sel].filter(o => !o.type);
        const pinSet = new Set();
        for (const cc of comps) MS.DEFS[cc.type].pins.forEach((p, i) => { const q = MS.pinPos(cc, i); pinSet.add(q.x + ',' + q.y); });
        const ends = [];
        for (const ww of this.doc.wires) {
          if (this.sel.has(ww)) continue;
          if (pinSet.has(ww.x1 + ',' + ww.y1)) ends.push([ww, 1, ww.x1, ww.y1]);
          if (pinSet.has(ww.x2 + ',' + ww.y2)) ends.push([ww, 2, ww.x2, ww.y2]);
        }
        this.drag = {
          kind: 'move', gx, gy, moved: false, snap: false,
          comps: comps.map(cc => [cc, cc.x, cc.y]), wires: wires.map(ww => [ww, ww.x1, ww.y1, ww.x2, ww.y2]), ends,
        };
      } else {
        if (!e.shiftKey) { this.sel.clear(); this.app.onSelect(null); }
        this.drag = { kind: 'box', x0: g.x, y0: g.y, x1: g.x, y1: g.y };
      }
      this.redraw();
    });

    window.addEventListener('mousemove', e => {
      const r = cv.getBoundingClientRect(), sx = e.clientX - r.left, sy = e.clientY - r.top;
      const g = this.toGrid(sx, sy);
      this.mouse = { sx, sy, x: g.x, y: g.y, gx: Math.round(g.x), gy: Math.round(g.y), inside: sx >= 0 && sy >= 0 && sx <= this.W && sy <= this.H };
      const d = this.drag;
      if (d) {
        if (d.kind === 'pan') { this.view.ox = d.ox + sx - d.sx; this.view.oy = d.oy + sy - d.sy; d.moved = true; }
        else if (d.kind === 'move') {
          const dx = this.mouse.gx - d.gx, dy = this.mouse.gy - d.gy;
          if ((dx || dy) && !d.snap) { this.app.snapshot(); d.snap = true; }
          if (d.snap) {
            for (const [c, x, y] of d.comps) { c.x = x + dx; c.y = y + dy; }
            for (const [w, a, b, c2, d2] of d.wires) { w.x1 = a + dx; w.y1 = b + dy; w.x2 = c2 + dx; w.y2 = d2 + dy; }
            for (const [w, which, x, y] of d.ends) { if (which === 1) { w.x1 = x + dx; w.y1 = y + dy; } else { w.x2 = x + dx; w.y2 = y + dy; } }
            d.moved = true;
            this.app.changed(true);
          }
        } else if (d.kind === 'box') { d.x1 = g.x; d.y1 = g.y; }
      }
      if (this.mode === 'probe' && this.mouse.inside) {
        const n = this.netAt(g.x, g.y);
        if (n !== this.hoverNet) this.hoverNet = n;
      }
      if (this.mouse.inside || d) this.redraw();
    });

    window.addEventListener('mouseup', e => {
      const d = this.drag; this.drag = null;
      if (!d) return;
      if (d.kind === 'box') {
        const x0 = Math.min(d.x0, d.x1), x1 = Math.max(d.x0, d.x1), y0 = Math.min(d.y0, d.y1), y1 = Math.max(d.y0, d.y1);
        if (x1 - x0 > 0.3 || y1 - y0 > 0.3) {
          for (const c of this.doc.comps) if (c.x >= x0 && c.x <= x1 && c.y >= y0 && c.y <= y1) this.sel.add(c);
          for (const w of this.doc.wires) if (Math.min(w.x1, w.x2) >= x0 && Math.max(w.x1, w.x2) <= x1 && Math.min(w.y1, w.y2) >= y0 && Math.max(w.y1, w.y2) <= y1) this.sel.add(w);
          this.app.onSelect(this.sel.size === 1 ? [...this.sel][0] : null);
        }
      }
      if (d.kind === 'move' && d.moved) { this.cleanupWires(); this.app.changed(); }
      if (d.kind === 'pan' && !d.moved && d.btn === 2 && this.mode === 'select') {
        const c = this.hitComp(this.mouse.x, this.mouse.y);
        if (c) { this.sel = new Set([c]); this.app.onSelect(c); this.app.compMenu(c, e.clientX, e.clientY); }
      }
      this.redraw();
    });

    cv.addEventListener('dblclick', e => {
      if (this.mode === 'wire') { this.wireStart = null; this.redraw(); return; }
      if (this.mode !== 'select') return;
      const c = this.hitComp(this.mouse.x, this.mouse.y);
      if (c) this.app.focusProps();
    });
  }

  cleanupWires() {
    // remove fios de comprimento zero
    this.doc.wires = this.doc.wires.filter(w => w.x1 !== w.x2 || w.y1 !== w.y2);
  }

  /* ── desenho ── */
  draw() {
    const g = this.ctx, z = this.view.z, dpr = this.dpr || 1;
    const css = getComputedStyle(document.documentElement);
    const col = n => css.getPropertyValue(n).trim();
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = col('--sch-bg'); g.fillRect(0, 0, this.W, this.H);

    // grade
    const step = z < 8 ? 5 : 1;
    const a = this.toGrid(0, 0), b = this.toGrid(this.W, this.H);
    g.fillStyle = col('--sch-grid');
    const ds = z < 12 ? 1 : 1.5;
    for (let x = Math.floor(a.x / step) * step; x <= b.x; x += step)
      for (let y = Math.floor(a.y / step) * step; y <= b.y; y += step) {
        const s = this.toScreen(x, y); g.fillRect(s.x - ds / 2, s.y - ds / 2, ds, ds);
      }

    const nl = this.nl || MS.netlist(this.doc);
    const sim = this.app.result;

    // fios
    const wireW = Math.max(1.2, z * 0.09);
    for (const w of this.doc.wires) {
      const dom = nl.wireDom.get(w.id);
      const node = nl.wireNode.get(w.id);
      let c = dom === 'X' ? '#ff4d6d' : (MS.DOM[dom] || MS.DOM.A).color;
      const hl = this.mode === 'probe' && node > 0 && node === this.hoverNet;
      g.strokeStyle = this.sel.has(w) ? col('--sel') : c;
      g.globalAlpha = hl ? 1 : 0.85;
      g.lineWidth = hl ? wireW * 2.2 : wireW;
      g.lineCap = 'round';
      const p1 = this.toScreen(w.x1, w.y1), p2 = this.toScreen(w.x2, w.y2);
      g.beginPath(); g.moveTo(p1.x, p1.y); g.lineTo(p2.x, p2.y); g.stroke();
    }
    g.globalAlpha = 1;

    // junções
    const cnt = new Map();
    const inc = (x, y, n = 1) => { const k = x + ',' + y; cnt.set(k, (cnt.get(k) || 0) + n); };
    for (const w of this.doc.wires) { inc(w.x1, w.y1); inc(w.x2, w.y2); }
    const pinPts = [];
    for (const c of this.doc.comps) MS.DEFS[c.type].pins.forEach((p, i) => { const q = MS.pinPos(c, i); inc(q.x, q.y); pinPts.push([q.x, q.y, p[2]]); });
    for (const w of this.doc.wires) for (const k of cnt.keys()) { const [x, y] = k.split(',').map(Number); if (MS.onSegInterior(x, y, w)) inc(x, y, 2); }
    for (const [k, n] of cnt) if (n >= 3) {
      const [x, y] = k.split(',').map(Number), s = this.toScreen(x, y);
      g.fillStyle = col('--junction'); g.beginPath(); g.arc(s.x, s.y, Math.max(2.5, z * 0.18), 0, Math.PI * 2); g.fill();
    }

    // componentes
    for (const c of this.doc.comps) this.drawComp(g, c, this.sel.has(c) ? col('--sel') : null, 1, sim);

    // pinos soltos
    for (const [x, y, dom] of pinPts) {
      if (cnt.get(x + ',' + y) === 1) {
        const s = this.toScreen(x, y), r = Math.max(2, z * 0.14);
        g.strokeStyle = (MS.DOM[dom] || MS.DOM.A).color; g.lineWidth = 1;
        g.strokeRect(s.x - r, s.y - r, 2 * r, 2 * r);
      }
    }

    // nomes de nós (após simulação)
    if (sim && this.app.showNodeNames) {
      g.font = `${Math.max(9, z * 0.5)}px "Share Tech Mono", monospace`;
      g.fillStyle = col('--txt3');
      const done = new Set();
      for (const w of this.doc.wires) {
        const n = nl.wireNode.get(w.id);
        if (n > 0 && !done.has(n)) { done.add(n); const s = this.toScreen((w.x1 + w.x2) / 2, (w.y1 + w.y2) / 2); g.fillText(nl.nodes[n].name, s.x + 3, s.y - 3); }
      }
    }

    // fantasma de posicionamento
    if (this.mode === 'place' && this.placing && this.mouse.inside) {
      const ghost = { type: this.placing.type, x: this.mouse.gx, y: this.mouse.gy, rot: this.placing.rot, name: '', params: {} };
      for (const p of MS.DEFS[ghost.type].params) ghost.params[p.k] = p.def;
      this.drawComp(g, ghost, col('--sel'), 0.55);
    }
    // fio em construção
    if (this.mode === 'wire' && this.mouse.inside) {
      const m = { x: this.mouse.gx, y: this.mouse.gy };
      const s = this.toScreen(m.x, m.y);
      g.strokeStyle = col('--sel'); g.lineWidth = 1;
      g.beginPath(); g.moveTo(s.x - 8, s.y); g.lineTo(s.x + 8, s.y); g.moveTo(s.x, s.y - 8); g.lineTo(s.x, s.y + 8); g.stroke();
      if (this.wireStart) {
        const a0 = this.wireStart;
        let mid;
        if (a0.x === m.x || a0.y === m.y) mid = null;
        else mid = Math.abs(m.x - a0.x) >= Math.abs(m.y - a0.y) ? { x: m.x, y: a0.y } : { x: a0.x, y: m.y };
        g.setLineDash([4, 3]); g.lineWidth = wireW;
        const p0 = this.toScreen(a0.x, a0.y);
        g.beginPath(); g.moveTo(p0.x, p0.y);
        if (mid) { const pm = this.toScreen(mid.x, mid.y); g.lineTo(pm.x, pm.y); }
        g.lineTo(s.x, s.y); g.stroke(); g.setLineDash([]);
      }
    }
    // cursor de ponta de prova
    if (this.mode === 'probe' && this.mouse.inside) this.drawProbeCursor(g, this.mouse.sx, this.mouse.sy, this.hoverNet > 0 ? nl.nodes[this.hoverNet] : null);
    // caixa de seleção
    if (this.drag && this.drag.kind === 'box') {
      const d = this.drag, p0 = this.toScreen(d.x0, d.y0), p1 = this.toScreen(d.x1, d.y1);
      g.strokeStyle = col('--sel'); g.setLineDash([4, 3]); g.lineWidth = 1;
      g.strokeRect(p0.x, p0.y, p1.x - p0.x, p1.y - p0.y); g.setLineDash([]);
      g.fillStyle = 'rgba(255,214,102,0.05)'; g.fillRect(p0.x, p0.y, p1.x - p0.x, p1.y - p0.y);
    }
  }

  drawProbeCursor(g, x, y, node) {
    const c = node ? (MS.DOM[node.dom] || MS.DOM.A).color : '#ff4d6d';
    g.save(); g.translate(x, y); g.rotate(-Math.PI / 4);
    g.fillStyle = c; g.strokeStyle = '#000'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(0, 0); g.lineTo(-4, 8); g.lineTo(-4, 26); g.lineTo(4, 26); g.lineTo(4, 8); g.closePath(); g.fill(); g.stroke();
    g.restore();
    if (node) {
      g.font = '11px "Share Tech Mono", monospace';
      const sym = node.dom === 'E' ? 'V' : node.dom === 'R' ? 'ω' : 'v';
      const t = `${sym}(${node.name})`;
      g.fillStyle = 'rgba(0,0,0,0.75)'; g.fillRect(x + 12, y - 22, g.measureText(t).width + 8, 16);
      g.fillStyle = c; g.fillText(t, x + 16, y - 10);
    }
  }

  drawComp(g, c, selColor, alpha = 1, sim) {
    const d = MS.DEFS[c.type], z = this.view.z, s = this.toScreen(c.x, c.y);
    const domc = (MS.DOM[d.pins[0][2]] || MS.DOM.A).color;
    const css = getComputedStyle(document.documentElement);
    g.save();
    g.globalAlpha = alpha;
    g.translate(s.x, s.y); g.scale(z, z); g.rotate(c.rot * Math.PI / 2);
    g.lineWidth = Math.max(1.3, z * 0.085) / z;
    g.lineJoin = 'round'; g.lineCap = 'round';
    const base = selColor || css.getPropertyValue('--sym').trim();
    g.strokeStyle = base; g.fillStyle = base;
    const S = {
      text: (t, x, y, size = 0.8, align = 'center') => {
        g.save(); g.translate(x, y); g.rotate(-c.rot * Math.PI / 2);
        g.fillStyle = selColor || domc; g.font = `${size}px Barlow, sans-serif`;
        g.textAlign = align; g.textBaseline = 'middle'; g.fillText(t, 0, 0); g.restore();
      },
    };
    d.draw(g, c, S);
    // marca de domínio nos pinos
    for (const p of d.pins) { g.fillStyle = (MS.DOM[p[2]] || MS.DOM.A).color; g.beginPath(); g.arc(p[0], p[1], 0.11, 0, Math.PI * 2); g.fill(); }
    g.restore();

    // rótulos
    if (d.lbl && z >= 7) {
      const an = MS.rotPt(d.lbl[0], d.lbl[1], c.rot);
      const p = this.toScreen(c.x + an.x, c.y + an.y);
      const fs = Math.max(9, Math.min(15, z * 0.6));
      g.save(); g.globalAlpha = alpha;
      g.textBaseline = 'middle';
      g.textAlign = Math.abs(an.x) > Math.abs(an.y) ? (an.x > 0 ? 'left' : 'right') : 'center';
      g.font = `600 ${fs}px Barlow, sans-serif`; g.fillStyle = selColor || css.getPropertyValue('--lbl').trim();
      const val = d.val(c);
      const vertical = Math.abs(an.x) > Math.abs(an.y);
      const above = !vertical && an.y < 0;
      g.fillText(c.name, p.x, p.y + (above && val ? -fs * 0.55 : 0));
      if (val) {
        g.font = `${fs * 0.9}px "Share Tech Mono", monospace`; g.fillStyle = selColor || css.getPropertyValue('--val').trim();
        g.fillText(val, p.x, p.y + (above ? fs * 0.55 : fs * 1.1));
      }
      g.restore();
    }
  }
};

function segDist(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1, l = dx * dx + dy * dy;
  let t = l ? ((px - x1) * dx + (py - y1) * dy) / l : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}
