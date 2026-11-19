/* ============================================================
   MecSPICE — Gráfico 2D genérico (Bode, Nyquist, lugar das raízes,
   respostas no tempo, mapa de polos e zeros)
   Roda do mouse = zoom · arrastar = mover · duplo-clique = restaurar
   ============================================================ */
'use strict';

MS.Chart = class {
  constructor(host, opts = {}) {
    this.host = host;
    this.cv = document.createElement('canvas');
    this.cv.className = 'chart-cv';
    host.append(this.cv);
    this.g = this.cv.getContext('2d');
    this.o = Object.assign({ xlog: false, equal: false, xlabel: '', ylabel: '', pad: 0.06 }, opts);
    this.data = { series: [], markers: [], hlines: [], vlines: [], texts: [], regions: [] };
    this.view = null; this.hover = null;
    this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(host);
    this._bind();
    this.resize();
  }
  set(data, keepView) {
    this.data = Object.assign({ series: [], markers: [], hlines: [], vlines: [], texts: [], regions: [] }, data);
    if (!keepView || !this.view) this.view = this.autoRange();
    this.draw();
  }
  resize() {
    const r = this.host.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    if (r.width < 5 || r.height < 5) return;
    this.W = r.width; this.H = r.height; this.dpr = dpr;
    this.cv.width = r.width * dpr; this.cv.height = r.height * dpr;
    this.cv.style.width = r.width + 'px'; this.cv.style.height = r.height + 'px';
    if (this.view && this.o.equal) this.view = this.fixAspect(this.view);
    this.draw();
  }
  fx(x) { return this.o.xlog ? Math.log10(Math.max(x, 1e-300)) : x; }
  ifx(u) { return this.o.xlog ? Math.pow(10, u) : u; }
  autoRange() {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    const acc = (x, y) => { if (!isFinite(x) || !isFinite(y)) return; const u = this.fx(x); x0 = Math.min(x0, u); x1 = Math.max(x1, u); y0 = Math.min(y0, y); y1 = Math.max(y1, y); };
    for (const s of this.data.series) if (!s.noFit) for (let i = 0; i < s.x.length; i++) acc(s.x[i], s.y[i]);
    for (const m of this.data.markers) if (!m.noFit) acc(m.x, m.y);
    if (this.o.xrange) { x0 = this.fx(this.o.xrange[0]); x1 = this.fx(this.o.xrange[1]); }
    if (this.o.yrange) { y0 = this.o.yrange[0]; y1 = this.o.yrange[1]; }
    if (this.o.includeOrigin) { x0 = Math.min(x0, 0); x1 = Math.max(x1, 0); y0 = Math.min(y0, 0); y1 = Math.max(y1, 0); }
    if (!isFinite(x0)) { x0 = this.o.xlog ? -1 : -1; x1 = 1; y0 = -1; y1 = 1; }
    if (x1 - x0 < 1e-12) { x0 -= 1; x1 += 1; }
    if (y1 - y0 < 1e-12 * Math.max(1, Math.abs(y1))) { const d = Math.abs(y1) * 0.1 || 1; y0 -= d; y1 += d; }
    const px = (x1 - x0) * (this.o.xlog ? 0 : this.o.pad), py = (y1 - y0) * this.o.pad;
    let v = { x0: x0 - px, x1: x1 + px, y0: y0 - py, y1: y1 + py };
    if (this.o.equal) v = this.fixAspect(v);
    return v;
  }
  fixAspect(v) {
    const pw = this.W - this.ML - this.MR, ph = this.H - this.MT - this.MB;
    if (pw <= 0 || ph <= 0) return v;
    const sx = (v.x1 - v.x0) / pw, sy = (v.y1 - v.y0) / ph, s = Math.max(sx, sy);
    const cx = (v.x0 + v.x1) / 2, cy = (v.y0 + v.y1) / 2;
    return { x0: cx - s * pw / 2, x1: cx + s * pw / 2, y0: cy - s * ph / 2, y1: cy + s * ph / 2 };
  }
  get ML() { return 56; } get MR() { return 12; } get MT() { return 10; } get MB() { return 30; }
  X(x) { const v = this.view; return this.ML + (this.fx(x) - v.x0) / (v.x1 - v.x0) * (this.W - this.ML - this.MR); }
  Y(y) { const v = this.view; return this.MT + (v.y1 - y) / (v.y1 - v.y0) * (this.H - this.MT - this.MB); }
  invX(px) { const v = this.view; return this.ifx(v.x0 + (px - this.ML) / (this.W - this.ML - this.MR) * (v.x1 - v.x0)); }
  invY(py) { const v = this.view; return v.y1 - (py - this.MT) / (this.H - this.MT - this.MB) * (v.y1 - v.y0); }

  _bind() {
    const cv = this.cv;
    let drag = null;
    cv.addEventListener('mousemove', e => {
      const r = cv.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top;
      if (drag) {
        const v = drag.v, dxu = (px - drag.px) / (this.W - this.ML - this.MR) * (v.x1 - v.x0), dyu = (py - drag.py) / (this.H - this.MT - this.MB) * (v.y1 - v.y0);
        this.view = { x0: v.x0 - dxu, x1: v.x1 - dxu, y0: v.y0 + dyu, y1: v.y1 + dyu };
        drag.moved = true;
        if (this.o.onView) this.o.onView(this.view);
      }
      this.hover = { px, py };
      if (this.o.onHover) this.o.onHover(this.invX(px), this.invY(py));
      this.draw();
    });
    cv.addEventListener('mouseleave', () => { this.hover = null; if (this.o.onHover) this.o.onHover(null); this.draw(); });
    cv.addEventListener('mousedown', e => { const r = cv.getBoundingClientRect(); drag = { px: e.clientX - r.left, py: e.clientY - r.top, v: { ...this.view }, moved: false }; });
    window.addEventListener('mouseup', e => {
      if (drag && !drag.moved && this.o.onClick) { const r = cv.getBoundingClientRect(); this.o.onClick(this.invX(e.clientX - r.left), this.invY(e.clientY - r.top)); }
      drag = null;
    });
    cv.addEventListener('wheel', e => {
      e.preventDefault();
      const r = cv.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top;
      const f = Math.exp(e.deltaY * 0.0015), v = this.view;
      const ux = this.fx(this.invX(px)), uy = this.invY(py);
      const zy = !e.shiftKey || this.o.equal, zx = !e.altKey || this.o.equal;
      this.view = {
        x0: zx ? ux - (ux - v.x0) * f : v.x0, x1: zx ? ux + (v.x1 - ux) * f : v.x1,
        y0: zy ? uy - (uy - v.y0) * f : v.y0, y1: zy ? uy + (v.y1 - uy) * f : v.y1,
      };
      if (this.o.onView) this.o.onView(this.view);
      this.draw();
    }, { passive: false });
    cv.addEventListener('dblclick', () => { this.view = this.autoRange(); if (this.o.onView) this.o.onView(this.view); this.draw(); });
  }
  setXView(x0, x1) { if (!this.view) return; this.view = { ...this.view, x0, x1 }; this.draw(); }

  draw() {
    if (!this.view || !this.W) return;
    const g = this.g, css = getComputedStyle(document.documentElement), col = n => css.getPropertyValue(n).trim();
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    g.fillStyle = col('--plot-bg'); g.fillRect(0, 0, this.W, this.H);
    const v = this.view, L = this.ML, T = this.MT, PW = this.W - this.ML - this.MR, PH = this.H - this.MT - this.MB;
    g.save(); g.beginPath(); g.rect(L, T, PW, PH); g.clip();
    // regiões sombreadas (ex.: semiplano direito)
    for (const rg of this.data.regions) {
      const x0 = rg.x0 === -Infinity ? L : this.X(rg.x0), x1 = rg.x1 === Infinity ? L + PW : this.X(rg.x1);
      const y0 = rg.y1 === Infinity ? T : this.Y(rg.y1), y1 = rg.y0 === -Infinity ? T + PH : this.Y(rg.y0);
      g.fillStyle = rg.color; g.fillRect(x0, y0, x1 - x0, y1 - y0);
    }
    // grade
    g.lineWidth = 1; g.font = '10px "Share Tech Mono", monospace';
    const xt = this.o.xlog ? logTicks(v.x0, v.x1) : MS.niceTicks(v.x0, v.x1, Math.max(2, Math.floor(PW / 80))).map(t => ({ u: t, major: true }));
    const yt = MS.niceTicks(v.y0, v.y1, Math.max(2, Math.floor(PH / 40)));
    for (const t of xt) { const x = Math.round(L + (t.u - v.x0) / (v.x1 - v.x0) * PW) + 0.5; g.strokeStyle = t.major ? col('--plot-grid') : col('--plot-grid2'); g.beginPath(); g.moveTo(x, T); g.lineTo(x, T + PH); g.stroke(); }
    for (const t of yt) { const y = Math.round(this.Y(t)) + 0.5; g.strokeStyle = col('--plot-grid'); g.beginPath(); g.moveTo(L, y); g.lineTo(L + PW, y); g.stroke(); }
    // eixos x=0 / y=0
    g.strokeStyle = col('--plot-zero');
    if (v.y0 < 0 && v.y1 > 0) { const y = Math.round(this.Y(0)) + 0.5; g.beginPath(); g.moveTo(L, y); g.lineTo(L + PW, y); g.stroke(); }
    if (!this.o.xlog && v.x0 < 0 && v.x1 > 0) { const x = Math.round(this.X(0)) + 0.5; g.beginPath(); g.moveTo(x, T); g.lineTo(x, T + PH); g.stroke(); }
    for (const h of this.data.hlines) { g.strokeStyle = h.color; g.setLineDash(h.dash || [5, 4]); g.beginPath(); g.moveTo(L, this.Y(h.y)); g.lineTo(L + PW, this.Y(h.y)); g.stroke(); g.setLineDash([]); if (h.label) { g.fillStyle = h.color; g.textAlign = 'right'; g.fillText(h.label, L + PW - 4, this.Y(h.y) - 4); } }
    for (const h of this.data.vlines) { g.strokeStyle = h.color; g.setLineDash(h.dash || [5, 4]); g.beginPath(); g.moveTo(this.X(h.x), T); g.lineTo(this.X(h.x), T + PH); g.stroke(); g.setLineDash([]); if (h.label) { g.fillStyle = h.color; g.textAlign = 'left'; g.fillText(h.label, this.X(h.x) + 4, T + 12); } }
    // séries
    for (const s of this.data.series) {
      g.strokeStyle = s.color; g.lineWidth = s.width || 1.8; g.setLineDash(s.dash || []); g.globalAlpha = s.alpha || 1;
      g.beginPath(); let pen = false;
      for (let i = 0; i < s.x.length; i++) {
        const x = this.X(s.x[i]), y = this.Y(s.y[i]);
        if (!isFinite(x) || !isFinite(y) || Math.abs(y) > 1e6 || (s.breakAt && s.breakAt(i))) { pen = false; continue; }
        if (!pen) { g.moveTo(x, y); pen = true; } else g.lineTo(x, y);
      }
      g.stroke(); g.setLineDash([]); g.globalAlpha = 1;
      if (s.arrows) this._arrows(s);
    }
    // marcadores
    for (const m of this.data.markers) {
      if (m.hidden) continue;
      const x = this.X(m.x), y = this.Y(m.y), r = m.size || 5;
      g.strokeStyle = m.color; g.fillStyle = m.color; g.lineWidth = 2;
      if (m.shape === 'x') { g.beginPath(); g.moveTo(x - r, y - r); g.lineTo(x + r, y + r); g.moveTo(x + r, y - r); g.lineTo(x - r, y + r); g.stroke(); }
      else if (m.shape === 'o') { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.stroke(); }
      else if (m.shape === 'sq') { g.strokeRect(x - r, y - r, 2 * r, 2 * r); }
      else if (m.shape === 'plus') { g.beginPath(); g.moveTo(x - r, y); g.lineTo(x + r, y); g.moveTo(x, y - r); g.lineTo(x, y + r); g.stroke(); }
      else { g.beginPath(); g.arc(x, y, r * 0.75, 0, Math.PI * 2); g.fill(); }
      if (m.label) { g.font = '11px Barlow, sans-serif'; g.textAlign = 'left'; g.fillText(m.label, x + r + 3, y - r - 2); }
    }
    for (const t of this.data.texts) { g.fillStyle = t.color || col('--txt2'); g.font = (t.size || 11) + 'px Barlow, sans-serif'; g.textAlign = t.align || 'left'; g.fillText(t.text, this.X(t.x) + (t.dx || 0), this.Y(t.y) + (t.dy || 0)); }
    g.restore();
    // moldura e rótulos
    g.strokeStyle = col('--plot-frame'); g.lineWidth = 1; g.strokeRect(L + 0.5, T + 0.5, PW, PH);
    g.fillStyle = col('--txt2'); g.font = '10px "Share Tech Mono", monospace';
    g.textAlign = 'center'; g.textBaseline = 'top';
    let lastX = -1e9;
    for (const t of xt) if (t.major) { const x = L + (t.u - v.x0) / (v.x1 - v.x0) * PW; if (x - lastX < 34) continue; lastX = x; g.fillText(this.o.xlog ? fmtLog(t.u) : MS.CS.fmtNum(t.u, 3), x, T + PH + 4); }
    g.textAlign = 'right'; g.textBaseline = 'middle';
    for (const t of yt) g.fillText(MS.CS.fmtNum(t, 3), L - 5, this.Y(t));
    g.textBaseline = 'alphabetic';
    if (this.o.xlabel) { g.textAlign = 'right'; g.fillStyle = col('--txt3'); g.font = '11px Barlow, sans-serif'; g.fillText(this.o.xlabel, L + PW - 2, T + PH - 4); }
    if (this.o.ylabel) { g.save(); g.translate(12, T + PH / 2); g.rotate(-Math.PI / 2); g.textAlign = 'center'; g.fillStyle = col('--txt2'); g.font = '11px Barlow, sans-serif'; g.fillText(this.o.ylabel, 0, 0); g.restore(); }
    // legenda
    const leg = this.data.series.filter(s => s.name);
    if (leg.length) {
      g.font = '11px Barlow, sans-serif'; g.textAlign = 'left';
      let lx = L + 8; const ly = T + 12;
      for (const s of leg) { g.fillStyle = s.color; g.fillRect(lx, ly - 7, 12, 3); g.fillStyle = col('--txt'); g.fillText(s.name, lx + 16, ly - 2); lx += g.measureText(s.name).width + 34; }
    }
    // cursor
    if (this.hover && this.hover.px > L && this.hover.px < L + PW && this.hover.py > T && this.hover.py < T + PH) {
      g.strokeStyle = col('--txt3'); g.setLineDash([2, 3]);
      g.beginPath(); g.moveTo(this.hover.px + 0.5, T); g.lineTo(this.hover.px + 0.5, T + PH); g.stroke(); g.setLineDash([]);
      const txt = this.o.readout ? this.o.readout(this.invX(this.hover.px), this.invY(this.hover.py)) : `${MS.CS.fmtNum(this.invX(this.hover.px))}, ${MS.CS.fmtNum(this.invY(this.hover.py))}`;
      if (txt) {
        g.font = '11px "Share Tech Mono", monospace';
        const lines = txt.split('\n'), w = Math.max(...lines.map(l => g.measureText(l).width)) + 10;
        let bx = this.hover.px + 10, by = this.hover.py + 10;
        if (bx + w > L + PW) bx = this.hover.px - w - 10;
        if (by + lines.length * 14 + 6 > T + PH) by = this.hover.py - lines.length * 14 - 16;
        g.fillStyle = 'rgba(4,7,13,0.88)'; g.fillRect(bx, by, w, lines.length * 14 + 6);
        g.fillStyle = col('--txt'); g.textAlign = 'left';
        lines.forEach((l, i) => g.fillText(l, bx + 5, by + 14 + i * 14));
      }
    }
  }
  _arrows(s) {
    const g = this.g, n = s.x.length;
    const every = Math.max(4, Math.floor(n / (s.arrows === true ? 6 : s.arrows)));
    for (let i = every; i < n - 1; i += every) {
      const x0 = this.X(s.x[i - 1]), y0 = this.Y(s.y[i - 1]), x1 = this.X(s.x[i]), y1 = this.Y(s.y[i]);
      if (![x0, y0, x1, y1].every(isFinite) || Math.hypot(x1 - x0, y1 - y0) < 0.5) continue;
      const a = Math.atan2(y1 - y0, x1 - x0);
      g.fillStyle = s.color; g.beginPath(); g.moveTo(x1, y1);
      g.lineTo(x1 - 9 * Math.cos(a - 0.4), y1 - 9 * Math.sin(a - 0.4)); g.lineTo(x1 - 9 * Math.cos(a + 0.4), y1 - 9 * Math.sin(a + 0.4));
      g.closePath(); g.fill();
    }
  }
};

function logTicks(u0, u1) {
  const out = [];
  for (let d = Math.floor(u0); d <= Math.ceil(u1); d++) for (let k = 1; k < 10; k++) {
    const u = d + Math.log10(k);
    if (u >= u0 && u <= u1) out.push({ u, major: k === 1 });
  }
  return out;
}
function fmtLog(u) { const v = Math.pow(10, Math.round(u)); return v >= 1e4 || v < 1e-2 ? '10^' + Math.round(u) : String(+v.toPrecision(3)); }
