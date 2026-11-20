/* ============================================================
   MeControlEng — Visualizador de formas de onda (estilo LTspice)
   Painéis empilhados por unidade, cursor, zoom por arrasto.
   ============================================================ */
'use strict';

MS.TRACE_COLORS = ['#4fb3ff', '#ff9f1c', '#3ddc84', '#ff4d6d', '#c77dff', '#ffd166', '#06d6a0', '#f78c6b', '#7aa2ff', '#ef476f', '#a0e426', '#ff70a6'];

MS.Plot = class {
  constructor(canvas, app) {
    this.cv = canvas; this.ctx = canvas.getContext('2d'); this.app = app;
    this.traces = [];       // {id, color}
    this.res = null;
    this.view = null;       // {t0,t1}
    this.hover = null;      // {x,y}
    this.drag = null;
    this.cursorT = null;    // tempo da reprodução 3D
    this.legendHits = [];
    this.needDraw = true;
    this._bind();
    const loop = () => { if (this.needDraw) { this.needDraw = false; this.draw(); } requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  }
  redraw() { this.needDraw = true; }
  resize() {
    const r = this.cv.parentElement.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    this.cv.width = Math.max(10, r.width * dpr); this.cv.height = Math.max(10, r.height * dpr);
    this.cv.style.width = r.width + 'px'; this.cv.style.height = r.height + 'px';
    this.dpr = dpr; this.W = r.width; this.H = r.height; this.redraw();
  }
  setResult(res) {
    this.res = res;
    this.traces = this.traces.filter(t => res && res.signals.has(t.id));
    this.view = res ? { t0: 0, t1: res.t[res.n - 1] || res.tstop } : null;
    this.redraw();
  }
  has(id) { return this.traces.some(t => t.id === id); }
  add(id) {
    if (!this.res || !this.res.signals.has(id) || this.has(id)) return;
    const used = new Set(this.traces.map(t => t.color));
    const color = MS.TRACE_COLORS.find(c => !used.has(c)) || MS.TRACE_COLORS[this.traces.length % MS.TRACE_COLORS.length];
    this.traces.push({ id, color });
    this.redraw(); this.app.onTracesChange();
  }
  remove(id) { this.traces = this.traces.filter(t => t.id !== id); this.redraw(); this.app.onTracesChange(); }
  clear() { this.traces = []; this.redraw(); this.app.onTracesChange(); }

  /* conversão de unidades práticas (RPM, graus) */
  conv(sig) {
    if (this.app.practicalUnits) {
      if (sig.u === 'rad/s') return { k: 60 / (2 * Math.PI), u: 'RPM' };
      if (sig.u === 'rad') return { k: 180 / Math.PI, u: '°' };
    }
    return { k: 1, u: sig.u };
  }

  panes() {
    const groups = new Map();
    for (const tr of this.traces) {
      const s = this.res.signals.get(tr.id); if (!s) continue;
      const cv = this.conv(s);
      if (!groups.has(cv.u)) groups.set(cv.u, []);
      groups.get(cv.u).push({ tr, s, k: cv.k });
    }
    return [...groups.entries()].map(([u, items]) => ({ u, items }));
  }

  idxAt(t) {
    const T = this.res.t, n = this.res.n;
    let lo = 0, hi = n - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (T[m] <= t) lo = m; else hi = m; }
    return (t - T[lo] > T[hi] - t) ? hi : lo;
  }
  valueAt(s, t, k) {
    const T = this.res.t, n = this.res.n;
    let lo = 0, hi = n - 1;
    if (t <= T[0]) return s.data[0] * k;
    if (t >= T[n - 1]) return s.data[n - 1] * k;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (T[m] <= t) lo = m; else hi = m; }
    const f = (t - T[lo]) / (T[hi] - T[lo] || 1);
    return (s.data[lo] + (s.data[hi] - s.data[lo]) * f) * k;
  }

  _bind() {
    const cv = this.cv;
    cv.addEventListener('mousemove', e => {
      const r = cv.getBoundingClientRect();
      this.hover = { x: e.clientX - r.left, y: e.clientY - r.top };
      if (this.drag) this.drag.x1 = this.hover.x;
      cv.style.cursor = this.legendHits.some(h => this._in(h, this.hover)) ? 'pointer' : 'crosshair';
      this.redraw();
    });
    cv.addEventListener('mouseleave', () => { this.hover = null; this.redraw(); });
    cv.addEventListener('mousedown', e => {
      if (!this.res) return;
      const r = cv.getBoundingClientRect(), p = { x: e.clientX - r.left, y: e.clientY - r.top };
      const hit = this.legendHits.find(h => this._in(h, p));
      if (hit) { this.remove(hit.id); return; }
      if (p.x > this.ML) this.drag = { x0: p.x, x1: p.x };
    });
    window.addEventListener('mouseup', () => {
      const d = this.drag; this.drag = null;
      if (!d || !this.res) return;
      if (Math.abs(d.x1 - d.x0) > 6) {
        const a = this.xToT(Math.min(d.x0, d.x1)), b = this.xToT(Math.max(d.x0, d.x1));
        if (b - a > 1e-12) this.view = { t0: a, t1: b };
      } else if (this.app.player) {
        this.app.player.seek(this.xToT(d.x0));
      }
      this.redraw();
    });
    cv.addEventListener('dblclick', () => { if (this.res) { this.view = { t0: 0, t1: this.res.t[this.res.n - 1] }; this.redraw(); } });
  }
  _in(h, p) { return p.x >= h.x && p.x <= h.x + h.w && p.y >= h.y && p.y <= h.y + h.h; }
  xToT(x) { const v = this.view; return v.t0 + (x - this.ML) / (this.W - this.ML - this.MR) * (v.t1 - v.t0); }
  tToX(t) { const v = this.view; return this.ML + (t - v.t0) / (v.t1 - v.t0) * (this.W - this.ML - this.MR); }

  draw() {
    const g = this.ctx, dpr = this.dpr || 1;
    const css = getComputedStyle(document.documentElement), col = n => css.getPropertyValue(n).trim();
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = col('--plot-bg'); g.fillRect(0, 0, this.W, this.H);
    this.ML = 64; this.MR = 14;
    const MB = 22;
    this.legendHits = [];
    g.font = '12px Inter, Barlow, sans-serif';
    if (!this.res || !this.traces.length) {
      g.fillStyle = col('--txt3'); g.textAlign = 'center'; g.textBaseline = 'middle';
      g.font = '13px Inter, Barlow, sans-serif';
      g.fillText(this.res ? 'Clique em um fio/nó do esquemático (ponta de prova) para plotar. Shift+clique: posição/ângulo. Clique num componente: corrente/força/torque.'
        : 'Execute a simulação (▶ ou Ctrl+Enter) para ver as formas de onda.', this.W / 2, this.H / 2);
      return;
    }
    const panes = this.panes();
    const ph = (this.H - MB) / panes.length;
    const v = this.view;
    const T = this.res.t, n = this.res.n;
    const pw = this.W - this.ML - this.MR;
    let i0 = Math.max(0, this.idxAt(v.t0) - 1), i1 = Math.min(n - 1, this.idxAt(v.t1) + 1);
    const hoverT = this.hover && this.hover.x > this.ML ? this.xToT(this.hover.x) : null;

    panes.forEach((pane, pi) => {
      const y0 = pi * ph + 6, h = ph - 10, top = y0 + 18, bh = h - 20;
      // faixa de valores
      let mn = Infinity, mx = -Infinity;
      for (const it of pane.items) for (let i = i0; i <= i1; i++) { const val = it.s.data[i] * it.k; if (val < mn) mn = val; if (val > mx) mx = val; }
      if (!isFinite(mn)) { mn = -1; mx = 1; }
      if (mx - mn < 1e-12 * Math.max(1, Math.abs(mx))) { const d = Math.abs(mx) * 0.1 || 1; mn -= d; mx += d; }
      const pad = (mx - mn) * 0.06; mn -= pad; mx += pad;
      const ty = val => top + bh - (val - mn) / (mx - mn) * bh;

      // moldura e grade
      g.strokeStyle = col('--plot-frame'); g.lineWidth = 1;
      g.strokeRect(this.ML + 0.5, top + 0.5, pw, bh);
      const yt = niceTicks(mn, mx, Math.max(2, Math.floor(bh / 34)));
      g.font = '10px "JetBrains Mono", "Share Tech Mono", monospace'; g.textAlign = 'right'; g.textBaseline = 'middle';
      for (const t of yt) {
        const y = Math.round(ty(t)) + 0.5;
        g.strokeStyle = col('--plot-grid'); g.beginPath(); g.moveTo(this.ML, y); g.lineTo(this.ML + pw, y); g.stroke();
        g.fillStyle = col('--txt2'); g.fillText(MS.fmt(t, '', 3).trim(), this.ML - 5, y);
      }
      g.save(); g.translate(12, top + bh / 2); g.rotate(-Math.PI / 2); g.textAlign = 'center'; g.fillStyle = col('--txt2'); g.font = '11px Inter, Barlow, sans-serif'; g.fillText(pane.u || '—', 0, 0); g.restore();
      if (mn < 0 && mx > 0) { g.strokeStyle = col('--plot-zero'); g.setLineDash([3, 3]); g.beginPath(); g.moveTo(this.ML, ty(0)); g.lineTo(this.ML + pw, ty(0)); g.stroke(); g.setLineDash([]); }
      const xt = niceTicks(v.t0, v.t1, Math.max(2, Math.floor(pw / 90)));
      for (const t of xt) { const x = Math.round(this.tToX(t)) + 0.5; g.strokeStyle = col('--plot-grid'); g.beginPath(); g.moveTo(x, top); g.lineTo(x, top + bh); g.stroke(); }

      // curvas
      g.save(); g.beginPath(); g.rect(this.ML, top, pw, bh); g.clip();
      for (const it of pane.items) {
        g.strokeStyle = it.tr.color; g.lineWidth = 1.5; g.beginPath();
        const step = Math.max(1, Math.floor((i1 - i0) / (pw * 2)));
        if (step > 1) {
          // decimação min/max por coluna
          for (let i = i0; i <= i1; i += step) {
            let a = Infinity, b = -Infinity; const e = Math.min(i1, i + step - 1);
            for (let j = i; j <= e; j++) { const val = it.s.data[j] * it.k; if (val < a) a = val; if (val > b) b = val; }
            const x = this.tToX(T[i]);
            if (i === i0) g.moveTo(x, ty(a)); else g.lineTo(x, ty(a));
            g.lineTo(x, ty(b));
          }
        } else {
          for (let i = i0; i <= i1; i++) { const x = this.tToX(T[i]), y = ty(it.s.data[i] * it.k); if (i === i0) g.moveTo(x, y); else g.lineTo(x, y); }
        }
        g.stroke();
      }
      g.restore();

      // cursores
      const drawCursor = (t, color, dash) => {
        const x = this.tToX(t); if (x < this.ML || x > this.ML + pw) return;
        g.strokeStyle = color; g.setLineDash(dash); g.beginPath(); g.moveTo(x + 0.5, top); g.lineTo(x + 0.5, top + bh); g.stroke(); g.setLineDash([]);
        for (const it of pane.items) { const val = this.valueAt(it.s, t, 1) * it.k; g.fillStyle = it.tr.color; g.beginPath(); g.arc(x, ty(val), 3, 0, Math.PI * 2); g.fill(); }
      };
      if (this.cursorT !== null) drawCursor(this.cursorT, col('--cursor-play'), [2, 2]);
      if (hoverT !== null) drawCursor(hoverT, col('--txt2'), []);

      // legenda
      let lx = this.ML + 4;
      g.textAlign = 'left'; g.textBaseline = 'middle'; g.font = '12px Inter, Barlow, sans-serif';
      const tRead = hoverT !== null ? hoverT : this.cursorT;
      for (const it of pane.items) {
        let txt = it.s.label;
        if (tRead !== null) txt += ' = ' + MS.fmt(this.valueAt(it.s, tRead, 1) * it.k, pane.u, 4);
        const w = g.measureText(txt).width + 22;
        g.fillStyle = it.tr.color; g.fillRect(lx, y0 + 4, 10, 10);
        g.fillText(txt, lx + 14, y0 + 9);
        this.legendHits.push({ x: lx, y: y0, w, h: 16, id: it.tr.id });
        lx += w;
      }
      if (pi === panes.length - 1) {
        g.fillStyle = col('--txt2'); g.textAlign = 'center'; g.textBaseline = 'top'; g.font = '10px "JetBrains Mono", "Share Tech Mono", monospace';
        for (const t of xt) g.fillText(MS.fmt(t, 's', 3), this.tToX(t), top + bh + 4);
      }
    });
    if (hoverT !== null) {
      g.fillStyle = col('--txt'); g.textAlign = 'right'; g.textBaseline = 'top'; g.font = '11px "JetBrains Mono", "Share Tech Mono", monospace';
      g.fillText('t = ' + MS.fmt(hoverT, 's', 5), this.W - this.MR - 2, 4);
    }
    if (this.drag && Math.abs(this.drag.x1 - this.drag.x0) > 2) {
      g.fillStyle = 'rgba(255,214,102,0.12)';
      g.fillRect(Math.min(this.drag.x0, this.drag.x1), 0, Math.abs(this.drag.x1 - this.drag.x0), this.H - MB);
    }
  }

  csv() {
    if (!this.res) return '';
    const ids = this.traces.length ? this.traces.map(t => t.id) : [...this.res.signals.keys()];
    const sigs = ids.map(id => this.res.signals.get(id));
    const rows = ['t[s];' + sigs.map(s => `${s.label}[${s.u}]`).join(';')];
    for (let i = 0; i < this.res.n; i++) rows.push([this.res.t[i], ...sigs.map(s => s.data[i])].map(v => String(+v.toPrecision(8))).join(';'));
    return rows.join('\n');
  }
};

function niceTicks(a, b, n) {
  const span = b - a; if (!(span > 0)) return [a];
  const raw = span / n, mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const f = raw / mag, step = (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * mag;
  const out = [];
  for (let t = Math.ceil(a / step) * step; t <= b + step * 1e-9; t += step) out.push(Math.abs(t) < step * 1e-9 ? 0 : t);
  return out;
}
MS.niceTicks = niceTicks;
