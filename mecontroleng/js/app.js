/* ============================================================
   MeControlEng — Aplicação (interface, arquivos, simulação, reprodução)
   ============================================================ */
'use strict';

const $ = s => document.querySelector(s);
const el = (tag, attrs = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (k === 'html') e.innerHTML = v; else e.setAttribute(k, v);
  }
  for (const k of kids) if (k != null) e.append(k);
  return e;
};

MS.App = class {
  constructor() {
    MS.app = this;
    this.undoStack = []; this.redoStack = [];
    this.result = null; this.stale = false;
    this.practicalUnits = false;
    this.showNodeNames = true;
    this.doc = this.loadLocal() || MS.EXAMPLES[0].build();
    this.normalizeDoc();

    this.editor = new MS.Editor($('#sch'), this);
    this.plot = new MS.Plot($('#plot'), this);
    this.v3d = new MS.View3D($('#v3d'), this);
    this.player = new Player(this);

    this.buildPalette();
    this.bindUI();
    this.loadDocUI();
    this.layout();
    window.addEventListener('resize', () => this.layout());
    this.editor.refreshNetlist();
    setTimeout(() => { this.editor.fit(); this.rebuild3D(true); }, 30);
    this.log('Pronto. Abra um exemplo ou monte seu circuito. Ctrl+Enter simula.', 'ok');
  }

  normalizeDoc() {
    const d = this.doc;
    d.sim = Object.assign({ tstop: '1', dt: '1m', method: 'trap' }, d.sim || {});
    d.comps = d.comps || []; d.wires = d.wires || []; d.probes = d.probes || []; d.ui = d.ui || {};
    for (const c of d.comps) { const def = MS.DEFS[c.type]; if (!def) continue; for (const p of def.params) if (c.params[p.k] === undefined) c.params[p.k] = p.def; c.rot = c.rot || 0; }
  }

  /* ───── persistência ───── */
  loadLocal() { try { const s = localStorage.getItem('mecontroleng.doc'); return s ? JSON.parse(s) : null; } catch (e) { return null; } }
  saveLocal() { try { localStorage.setItem('mecontroleng.doc', JSON.stringify(this.doc)); } catch (e) { /* sem armazenamento */ } }

  snapshot() { this.undoStack.push(JSON.stringify(this.doc)); if (this.undoStack.length > 200) this.undoStack.shift(); this.redoStack = []; }
  undo() { if (!this.undoStack.length) return; this.redoStack.push(JSON.stringify(this.doc)); this.doc = JSON.parse(this.undoStack.pop()); this.afterDocSwap(); }
  redo() { if (!this.redoStack.length) return; this.undoStack.push(JSON.stringify(this.doc)); this.doc = JSON.parse(this.redoStack.pop()); this.afterDocSwap(); }
  afterDocSwap() { this.editor.sel.clear(); this.onSelect(null); this.loadDocUI(); this.changed(); }

  changed(light) {
    this.editor.refreshNetlist();
    if (this.result && !this.stale) { this.stale = true; this.updateStatus(); }
    clearTimeout(this._saveT); this._saveT = setTimeout(() => this.saveLocal(), 400);
    if (!light) this.rebuild3D();
    else { clearTimeout(this._r3); this._r3 = setTimeout(() => this.rebuild3D(), 250); }
    if (this.selected) this.renderProps();
  }

  rebuild3D(fit) {
    if (!this.v3d || this.v3d.disabled) return;
    this.v3d.setResult(this.stale ? null : this.result);
    this.v3d.build(this.doc);
    if (fit) this.v3d.fit();
  }

  setDoc(doc, msg) {
    this.snapshot();
    this.doc = doc; this.normalizeDoc();
    this.result = null; this.stale = false;
    this.plot.setResult(null); this.plot.traces = [];
    this.player.reset();
    this.editor.sel.clear(); this.onSelect(null);
    this.loadDocUI();
    this.editor.refreshNetlist();
    this.editor.setMode('select');
    this.editor.fit();
    this.rebuild3D(true);
    this.saveLocal();
    this.updateStatus();
    if (msg) this.log(msg, 'ok');
  }
  loadDocUI() {
    const s = this.doc.sim;
    $('#tstop').value = s.tstop; $('#dt').value = s.dt; $('#method').value = s.method;
    const ui = this.doc.ui || {};
    if (ui.practical !== undefined) { this.practicalUnits = !!ui.practical; $('#units').value = this.practicalUnits ? 'prat' : 'si'; }
    if (ui.speed) { $('#speed').value = String(ui.speed); this.player.speed = ui.speed; if (![...$('#speed').options].some(o => o.value === String(ui.speed))) $('#speed').value = '0.1'; }
    if (ui.dispScale && this.v3d) { this.v3d.dispScale = ui.dispScale; $('#dscale').value = ui.dispScale; }
    $('#doc-title').textContent = this.doc.title || 'Sem título';
  }

  /* ───── paleta ───── */
  buildPalette() {
    const host = $('#palette-list');
    host.innerHTML = '';
    const q = ($('#pal-search').value || '').toLowerCase();
    for (const cat of MS.CATS) {
      const items = Object.entries(MS.DEFS).filter(([k, d]) => d.cat === cat && (!q || d.name.toLowerCase().includes(q) || k.toLowerCase().includes(q)));
      if (!items.length) continue;
      host.append(el('div', { class: 'pal-cat' }, cat));
      const grid = el('div', { class: 'pal-grid' });
      for (const [type, d] of items) {
        const cv = el('canvas', { width: 104, height: 72 });
        this.drawIcon(cv, type);
        const item = el('button', { class: 'pal-item', title: d.name, 'data-type': type, onclick: () => this.editor.setMode('place', type) }, cv, el('span', {}, d.name));
        grid.append(item);
      }
      host.append(grid);
    }
  }
  drawIcon(cv, type) {
    const g = cv.getContext('2d'), d = MS.DEFS[type];
    const b = d.bbox, w = b[2] - b[0], h = b[3] - b[1];
    const z = Math.min((cv.width - 12) / Math.max(w, 1), (cv.height - 12) / Math.max(h, 1), 16);
    g.clearRect(0, 0, cv.width, cv.height);
    g.save();
    g.translate(cv.width / 2 - ((b[0] + b[2]) / 2) * z, cv.height / 2 - ((b[1] + b[3]) / 2) * z);
    g.scale(z, z);
    g.lineWidth = 1.6 / z; g.lineCap = 'round'; g.lineJoin = 'round';
    const col = (MS.DOM[d.pins[0][2]] || MS.DOM.A).color;
    g.strokeStyle = '#c9d6ea'; g.fillStyle = '#c9d6ea';
    const c = { type, params: {}, rot: 0, name: '' };
    for (const p of d.params) c.params[p.k] = p.def;
    d.draw(g, c, { text: (t, x, y, s = 0.8, al = 'center') => { g.save(); g.fillStyle = col; g.font = `${s}px Barlow, sans-serif`; g.textAlign = al; g.textBaseline = 'middle'; g.fillText(t, x, y); g.restore(); } });
    for (const p of d.pins) { g.fillStyle = (MS.DOM[p[2]] || MS.DOM.A).color; g.beginPath(); g.arc(p[0], p[1], 0.18, 0, Math.PI * 2); g.fill(); }
    g.restore();
  }

  /* ───── seleção / propriedades ───── */
  onSelect(obj) { this.selected = obj && obj.type ? obj : null; this.renderProps(); }
  focusProps() { const f = $('#props input, #props select'); if (f) f.focus(); }
  renderProps() {
    const host = $('#props');
    host.innerHTML = '';
    const c = this.selected;
    if (!c || !this.doc.comps.includes(c)) {
      host.append(el('div', { class: 'muted' }, 'Selecione um componente para editar seus parâmetros. Duplo-clique foca a edição.'));
      return;
    }
    const d = MS.DEFS[c.type];
    host.append(el('div', { class: 'prop-head' },
      el('span', { class: 'dom-dot', style: `background:${(MS.DOM[d.pins[0][2]] || MS.DOM.A).color}` }), d.name));
    if (d.prefix) {
      const inp = el('input', { value: c.name, spellcheck: 'false' });
      inp.addEventListener('change', () => {
        const v = inp.value.trim();
        if (!v || this.doc.comps.some(o => o !== c && o.name === v)) { inp.value = c.name; this.log('Nome inválido ou repetido.', 'warn'); return; }
        this.snapshot(); c.name = v; this.changed();
      });
      host.append(el('label', { class: 'prop' }, el('span', {}, 'Nome'), inp));
    }
    for (const p of d.params) {
      if (p.show && !p.show(c.params)) continue;
      let inp;
      if (p.type === 'sel') {
        inp = el('select', {}, ...p.opts.map(o => el('option', { value: o }, o)));
        inp.value = c.params[p.k];
        inp.addEventListener('change', () => { this.snapshot(); c.params[p.k] = inp.value; this.changed(); this.renderProps(); });
      } else {
        inp = el('input', { value: c.params[p.k], spellcheck: 'false' });
        const apply = () => {
          const v = inp.value.trim();
          if (p.type !== 'text' && !isFinite(MS.parseEng(v))) { inp.classList.add('bad'); return; }
          inp.classList.remove('bad');
          if (v === c.params[p.k]) return;
          this.snapshot(); c.params[p.k] = v; this.changed();
        };
        inp.addEventListener('change', apply);
        inp.addEventListener('keydown', e => { if (e.key === 'Enter') { apply(); inp.blur(); } });
      }
      const unit = p.u ? el('em', {}, p.u) : null;
      const val = p.type !== 'sel' && p.type !== 'text' ? el('small', { class: 'parsed' }, MS.fmt(MS.parseEng(c.params[p.k]), p.u || '')) : null;
      host.append(el('label', { class: 'prop' }, el('span', {}, p.l, unit ? ' ' : '', unit), inp, val));
    }
    host.append(el('div', { class: 'prop-btns' },
      el('button', { class: 'btn sm', onclick: () => this.editor.rotateSel() }, '⟳ Girar (R)'),
      el('button', { class: 'btn sm', onclick: () => this.editor.duplicateSel() }, '⧉ Duplicar'),
      el('button', { class: 'btn sm danger', onclick: () => this.editor.deleteSel() }, '✕ Excluir')));
    const inf = MS.INFO && MS.INFO[c.type];
    if (inf) {
      const det = el('details', { class: 'about' }, el('summary', {}, '📘 Sobre o componente'),
        inf.eq ? el('div', { class: 'about-eq' }, inf.eq) : null,
        el('p', {}, inf.txt),
        inf.an ? el('p', { class: 'muted small' }, 'Análogo: ' + inf.an) : null,
        inf.tip ? el('p', { class: 'about-tip' }, '💡 ' + inf.tip) : null);
      if (this._aboutOpen) det.open = true;
      det.addEventListener('toggle', () => { this._aboutOpen = det.open; });
      host.append(det);
    }
    const pins = d.pins.map(p => `${p[3]} (${MS.DOM[p[2]].name})`).join(' · ');
    host.append(el('div', { class: 'muted small' }, 'Pinos: ' + pins));
    if (this.result && !this.stale && this.result.compSig.has(c.id)) {
      const box = el('div', { class: 'prop-sigs' });
      for (const id of this.result.compSig.get(c.id)) {
        const s = this.result.signals.get(id);
        box.append(el('button', { class: 'chip', onclick: () => this.plot.add(id) }, '+ ' + s.label));
      }
      host.append(el('div', { class: 'muted small' }, 'Plotar:'), box);
    }
  }

  /* ───── modos ───── */
  onModeChange(m, arg) {
    document.querySelectorAll('[data-mode]').forEach(b => b.classList.toggle('on', b.dataset.mode === m));
    document.querySelectorAll('.pal-item').forEach(b => b.classList.toggle('on', m === 'place' && b.dataset.type === arg));
    const hints = {
      select: 'Selecionar: arraste para mover, caixa para seleção múltipla, roda = zoom, botão direito/meio = mover vista.',
      wire: 'Fio: clique para iniciar, clique para dobrar; termina ao tocar um pino/fio. Esc/botão direito cancela.',
      place: `Posicionar ${arg ? MS.DEFS[arg].name : ''}: clique para colocar (repete). R gira. Esc termina.`,
      probe: 'Ponta de prova: clique num fio/nó → V/ω/v; Shift+clique → ângulo/posição; clique num componente → I/τ/F.',
    };
    $('#hint').textContent = hints[m] || '';
  }

  /* ───── ponta de prova ───── */
  probeAt(gx, gy, e) {
    if (!this.result) { this.log('Execute a simulação antes de usar a ponta de prova.', 'warn'); return; }
    const nl = this.editor.nl;
    const node = this.editor.netAt(gx, gy);
    if (node > 0) {
      const nd = nl.nodes[node];
      let id = (e.shiftKey && (nd.dom === 'R' || nd.dom === 'T') ? 'p:' : 'n:') + nd.name;
      if (!this.result.signals.has(id)) { this.log(`Sinal ${id} não existe no resultado (simule novamente).`, 'warn'); return; }
      this.plot.add(id); return;
    }
    if (node === 0) { this.log('Esse nó é a referência (terra / parede / mancal): valor sempre 0.', 'warn'); return; }
    const c = this.editor.hitComp(gx, gy);
    if (c) {
      const ids = this.result.compSig.get(c.id);
      if (!ids) { this.log(`${c.name || MS.DEFS[c.type].name}: sem grandezas próprias — use a ponta de prova nos nós.`, 'warn'); return; }
      if (ids.length === 1 && !e.shiftKey) { this.plot.add(ids[0]); return; }
      this.menu(e.clientX, e.clientY, ids.map(id => ({ label: this.result.signals.get(id).label + '  [' + this.result.signals.get(id).u + ']', fn: () => this.plot.add(id) })));
    }
  }
  compMenu(c, x, y) {
    const items = [
      { label: '⟳ Girar', fn: () => this.editor.rotateSel() },
      { label: '⧉ Duplicar', fn: () => this.editor.duplicateSel() },
      { label: '✕ Excluir', fn: () => this.editor.deleteSel() },
    ];
    if (this.result && !this.stale && this.result.compSig.has(c.id)) for (const id of this.result.compSig.get(c.id)) items.push({ label: '📈 ' + this.result.signals.get(id).label, fn: () => this.plot.add(id) });
    this.menu(x, y, items);
  }
  menu(x, y, items) {
    const m = $('#ctxmenu'); m.innerHTML = '';
    for (const it of items) m.append(el('div', { class: 'ctx-item', onclick: () => { this.hideMenu(); it.fn(); } }, it.label));
    m.style.display = 'block';
    const r = m.getBoundingClientRect();
    m.style.left = Math.min(x, window.innerWidth - r.width - 8) + 'px'; m.style.top = Math.min(y, window.innerHeight - r.height - 8) + 'px';
  }
  hideMenu() { $('#ctxmenu').style.display = 'none'; }

  onTracesChange() {
    this.doc.probes = this.plot.traces.map(t => t.id);
    this.saveLocal();
  }

  /* valor de uma grandeza de componente no instante da reprodução */
  liveVal(cid, k) {
    const r = this.result;
    if (!r || this.stale) return null;
    const ids = r.compSig.get(cid); if (!ids) return null;
    const id = ids.find(i => i.endsWith(':' + k)); if (!id) return null;
    return this.plot.valueAt(r.signals.get(id), this.player.t, 1);
  }

  /* ───── simulação ───── */
  async run() {
    if (this.running) { this.cancelReq = true; return; }
    const s = this.doc.sim;
    s.tstop = $('#tstop').value.trim(); s.dt = $('#dt').value.trim(); s.method = $('#method').value;
    this.running = true; this.cancelReq = false;
    $('#run').classList.add('busy'); $('#run').textContent = '■ Parar';
    $('#progress').style.width = '0%';
    this.clearLog();
    const prevProbes = this.plot.traces.length ? this.plot.traces.map(t => t.id) : (this.doc.probes || []);
    let res;
    try {
      res = await MS.simulate(this.doc, { onProgress: f => { $('#progress').style.width = (f * 100).toFixed(1) + '%'; }, cancel: () => this.cancelReq });
    } catch (err) { res = { errors: ['Erro interno: ' + err.message], warns: [] }; console.error(err); }
    this.running = false;
    $('#run').classList.remove('busy'); $('#run').textContent = '▶ Simular';
    $('#progress').style.width = '0%';
    for (const w of res.warns || []) this.log(w, 'warn');
    if (!res.ok) { for (const e of res.errors) this.log(e, 'err'); this.updateStatus(); return; }
    this.result = res; this.stale = false;
    this.log(`Transitório concluído: ${res.steps.toLocaleString('pt-BR')} passos de ${MS.fmt(res.h, 's')}, ${res.N} incógnitas, ${res.nodes.length - 1} nós, ${res.elapsed.toFixed(0)} ms.`, 'ok');
    this.plot.setResult(res);
    this.plot.traces = [];
    for (const id of prevProbes) if (res.signals.has(id)) this.plot.add(id);
    if (!this.plot.traces.length) {
      // sugerir sinais iniciais
      const first = [...res.signals.values()].filter(s => s.kind === 'across').slice(0, 2);
      first.forEach(s => this.plot.add(s.id));
    }
    this.hasLive = this.doc.comps.some(c => MS.DEFS[c.type].live);
    this.rebuild3D();
    this.player.reset(); this.player.play();
    this.renderSignals();
    this.renderProps();
    this.updateStatus();
    if (this.editor.mode === 'select') this.editor.setMode('probe');
  }

  updateStatus() {
    const st = $('#sim-status');
    if (this.running) st.textContent = 'simulando…';
    else if (!this.result) { st.textContent = 'sem resultado'; st.className = 'pill'; }
    else if (this.stale) { st.textContent = 'resultado desatualizado'; st.className = 'pill warn'; }
    else { st.textContent = `t = 0 … ${MS.fmt(this.result.tstop, 's')}`; st.className = 'pill ok'; }
  }

  renderSignals() {
    const host = $('#signals'); host.innerHTML = '';
    if (!this.result) { host.append(el('div', { class: 'muted' }, 'Simule para listar os sinais.')); return; }
    const q = ($('#sig-search').value || '').toLowerCase();
    for (const s of this.result.signals.values()) {
      if (q && !s.label.toLowerCase().includes(q)) continue;
      const on = this.plot.has(s.id);
      host.append(el('div', { class: 'sig' + (on ? ' on' : ''), onclick: () => { on ? this.plot.remove(s.id) : this.plot.add(s.id); this.renderSignals(); } },
        el('span', { class: 'dom-dot', style: `background:${(MS.DOM[s.dom] || MS.DOM.A).color}` }), s.label, el('em', {}, s.u)));
    }
  }

  /* ───── mensagens ───── */
  log(msg, type = '') {
    const host = $('#log');
    host.append(el('div', { class: 'log-line ' + type }, msg));
    host.scrollTop = host.scrollHeight;
  }
  clearLog() { $('#log').innerHTML = ''; }

  /* ───── arquivos ───── */
  download(name, text, mime = 'application/json') {
    const a = el('a', { href: URL.createObjectURL(new Blob([text], { type: mime })), download: name });
    document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }
  save() {
    this.doc.sim.tstop = $('#tstop').value; this.doc.sim.dt = $('#dt').value; this.doc.sim.method = $('#method').value;
    const name = (this.doc.title || 'circuito').replace(/[^\w\-]+/g, '_') + '.mecontroleng.json';
    this.download(name, JSON.stringify(this.doc, null, 1));
    this.log('Arquivo salvo: ' + name, 'ok');
  }
  open() { $('#file').click(); }

  /* ───── layout / splitters ───── */
  layout() {
    this.editor.resize(); this.plot.resize(); if (this.v3d) this.v3d.resize();
  }

  bindUI() {
    $('#pal-search').addEventListener('input', () => this.buildPalette());
    $('#sig-search').addEventListener('input', () => this.renderSignals());
    document.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => this.editor.setMode(b.dataset.mode)));
    $('#btn-rot').onclick = () => this.editor.rotateSel();
    $('#btn-del').onclick = () => this.editor.deleteSel();
    $('#btn-undo').onclick = () => this.undo();
    $('#btn-redo').onclick = () => this.redo();
    $('#btn-fit').onclick = () => this.editor.fit();
    $('#run').onclick = () => this.run();
    $('#btn-new').onclick = () => { if (confirm('Começar um esquemático vazio? (o atual pode ser desfeito com Ctrl+Z)')) this.setDoc({ title: 'Novo circuito', comps: [], wires: [], sim: { tstop: '1', dt: '1m', method: 'trap' }, probes: [], ui: {} }, 'Novo esquemático.'); };
    $('#btn-open').onclick = () => this.open();
    $('#btn-save').onclick = () => this.save();
    $('#file').addEventListener('change', e => {
      const f = e.target.files[0]; if (!f) return;
      f.text().then(t => { try { const d = JSON.parse(t); if (!d.comps) throw new Error('formato'); this.setDoc(d, 'Aberto: ' + f.name); } catch (err) { this.log('Arquivo inválido: ' + err.message, 'err'); } });
      e.target.value = '';
    });
    $('#btn-ex').onclick = () => this.showExamples();
    $('#btn-net').onclick = () => this.modal('Netlist', el('pre', { class: 'netlist' }, MS.netlistText(this.doc)));
    $('#btn-help').onclick = () => this.showHelp();
    $('#btn-csv').onclick = () => { if (!this.result) return this.log('Nada a exportar — simule primeiro.', 'warn'); this.download('formas_de_onda.csv', this.plot.csv(), 'text/csv'); };
    $('#btn-clear').onclick = () => { this.plot.clear(); this.renderSignals(); };
    $('#units').onchange = e => { this.practicalUnits = e.target.value === 'prat'; this.doc.ui.practical = this.practicalUnits; this.plot.redraw(); };
    $('#toggle-names').onchange = e => { this.showNodeNames = e.target.checked; this.editor.redraw(); };
    $('#tstop').addEventListener('change', e => { this.doc.sim.tstop = e.target.value; this.saveLocal(); });
    $('#dt').addEventListener('change', e => { this.doc.sim.dt = e.target.value; this.saveLocal(); });
    $('#method').addEventListener('change', e => { this.doc.sim.method = e.target.value; this.saveLocal(); });
    $('#doc-title').addEventListener('blur', e => { this.doc.title = e.target.textContent.trim() || 'Sem título'; this.saveLocal(); });
    $('#doc-title').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); } });

    document.querySelectorAll('#tabs [data-tab]').forEach(b => b.addEventListener('click', () => this.setTab(b.dataset.tab)));
    document.querySelectorAll('#subtabs [data-sub]').forEach(b => b.addEventListener('click', () => this.setSub(b.dataset.sub)));
    $('#btn-plotinfo').onclick = () => this.modal('Visualizador de formas de onda', el('div', { class: 'help', html: MS.PLOT_HELP }));

    // reprodução 3D
    $('#play').onclick = () => this.player.toggle();
    $('#rew').onclick = () => this.player.seek(0);
    $('#speed').onchange = e => { this.player.speed = parseFloat(e.target.value); this.doc.ui.speed = this.player.speed; };
    $('#tslider').addEventListener('input', e => { if (this.result) this.player.seek(e.target.value / 1000 * this.result.tstop); });
    $('#dscale').addEventListener('change', e => { const v = parseFloat(e.target.value); if (v > 0 && this.v3d) { this.v3d.dispScale = v; this.doc.ui.dispScale = v; this.rebuild3D(); } });
    $('#btn-fit3d').onclick = () => this.v3d && this.v3d.fit();
    $('#btn-3d').onclick = () => { document.body.classList.toggle('no3d'); this.layout(); };

    // splitters
    const split = (handle, fn) => {
      handle.addEventListener('mousedown', e => {
        e.preventDefault();
        const mv = ev => { fn(ev); this.layout(); };
        const upf = () => { window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', upf); document.body.classList.remove('dragging'); };
        document.body.classList.add('dragging');
        window.addEventListener('mousemove', mv); window.addEventListener('mouseup', upf);
      });
    };
    split($('#split-v'), ev => { const r = $('#work-top').getBoundingClientRect(); const w = Math.max(200, Math.min(r.width - 250, r.right - ev.clientX)); document.documentElement.style.setProperty('--v3d-w', w + 'px'); });
    split($('#split-h'), ev => { const r = $('#work').getBoundingClientRect(); const h = Math.max(120, Math.min(r.height - 150, r.bottom - ev.clientY)); document.documentElement.style.setProperty('--plot-h', h + 'px'); });

    document.addEventListener('mousedown', e => { if (!e.target.closest('#ctxmenu')) this.hideMenu(); });

    // teclado
    window.addEventListener('keydown', e => {
      const tag = (e.target.tagName || '').toLowerCase();
      if (this.tab && this.tab !== 'sim' && !$('#modal').classList.contains('open')) return;
      if (((e.ctrlKey || e.metaKey) && e.key === 'Enter') || e.key === 'F9') {
        e.preventDefault();
        if (tag === 'input') e.target.dispatchEvent(new Event('change'));
        this.run(); return;
      }
      if (this.tab && this.tab !== 'sim') return;
      if (tag === 'input' || tag === 'select' || tag === 'textarea' || e.target.isContentEditable) return;
      if ($('#modal').classList.contains('open')) { if (e.key === 'Escape') this.closeModal(); return; }
      const k = e.key.toLowerCase(), ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && k === 'z' && !e.shiftKey) { e.preventDefault(); this.undo(); }
      else if (ctrl && (k === 'y' || (k === 'z' && e.shiftKey))) { e.preventDefault(); this.redo(); }
      else if (ctrl && k === 'd') { e.preventDefault(); this.editor.duplicateSel(); }
      else if (ctrl && k === 'a') { e.preventDefault(); this.editor.selectAll(); }
      else if (ctrl && k === 's') { e.preventDefault(); this.save(); }
      else if (ctrl && k === 'o') { e.preventDefault(); this.open(); }
      else if ((ctrl && k === 'enter') || e.key === 'F9') { e.preventDefault(); this.run(); }
      else if (ctrl) return;
      else if (k === 'escape') { this.hideMenu(); this.editor.sel.clear(); this.onSelect(null); this.editor.setMode('select'); }
      else if (k === 'w') this.editor.setMode('wire');
      else if (k === 'p') this.editor.setMode('probe');
      else if (k === 'r') this.editor.rotateSel();
      else if (k === 'f') this.editor.fit();
      else if (k === 'g') this.editor.setMode('place', 'GND');
      else if (k === ' ') { e.preventDefault(); this.player.toggle(); }
      else if (k === 'delete' || k === 'backspace') { e.preventDefault(); this.editor.deleteSel(); }
    });
  }

  /* ───── abas ───── */
  setTab(id) {
    if (!['sim', 'ctrl', 'mec', 'ele'].includes(id)) id = 'sim';
    this.tab = id;
    document.body.dataset.tab = id;
    document.querySelectorAll('#tabs [data-tab]').forEach(b => b.classList.toggle('on', b.dataset.tab === id));
    const hints = { sim: 'Esquemático multidomínio com simulação no tempo e bancada 3D', ctrl: 'Modelagem, estabilidade, frequência e CLP', mec: 'Ferramentas de engenharia mecânica (em construção)', ele: 'Ferramentas de engenharia elétrica (em construção)' };
    $('#tabs-hint').textContent = hints[id] || '';
    if (id === 'sim') requestAnimationFrame(() => this.layout());
    if (id === 'ctrl') this.setSub(this.sub || 'model');
    try { localStorage.setItem('mecontroleng.tab', id); } catch (e) { /* */ }
  }
  /* sub-abas de Controle e Automação */
  setSub(id) {
    this.sub = id;
    $('#tab-ctrl').dataset.sub = id;
    document.querySelectorAll('#subtabs [data-sub]').forEach(b => b.classList.toggle('on', b.dataset.sub === id));
    if (!document.querySelector('#tab-' + id + ' .subnav')) MS.CS.renderTab(id);
    else if (id === 'model' && MS.CS.current.model === 'sch') MS.CS.renderTab(id);
    try { localStorage.setItem('mecontroleng.sub', id); } catch (e) { /* */ }
  }

  /* ───── modais ───── */
  modal(title, body, wide) {
    const m = $('#modal');
    $('#modal-title').textContent = title;
    const b = $('#modal-body'); b.innerHTML = ''; b.append(body);
    m.classList.toggle('wide', !!wide);
    m.classList.add('open');
  }
  closeModal() { $('#modal').classList.remove('open'); }
  showExamples() {
    const grid = el('div', { class: 'ex-grid' });
    for (const ex of MS.EXAMPLES) {
      grid.append(el('button', { class: 'ex-card', onclick: () => { this.closeModal(); this.setDoc(ex.build(), 'Exemplo carregado: ' + ex.title + ' — pressione ▶ Simular.'); } },
        el('div', { class: 'ex-cat' }, ex.cat), el('div', { class: 'ex-title' }, ex.title), el('div', { class: 'ex-desc' }, ex.desc)));
    }
    this.modal('Exemplos', grid, true);
  }
  showHelp() {
    this.modal('Ajuda — MeControlEng', el('div', { class: 'help', html: MS.HELP_HTML }), true);
  }
};

/* ───── reprodução sincronizada (gráfico + 3D) ───── */
class Player {
  constructor(app) {
    this.app = app; this.t = 0; this.playing = false; this.speed = 0.1; this.last = null;
    const loop = ts => {
      requestAnimationFrame(loop);
      const res = this.app.result;
      if (this.playing && res && !this.app.stale) {
        if (this.last !== null) {
          this.t += Math.min(0.1, (ts - this.last) / 1000) * this.speed;
          if (this.t > res.tstop) this.t = 0;
        }
        this.last = ts;
        this.push();
      } else this.last = null;
    };
    requestAnimationFrame(loop);
  }
  push() {
    const res = this.app.result;
    if (this.app.v3d && !this.app.v3d.disabled) this.app.v3d.setTime(this.t);
    this.app.plot.cursorT = res ? this.t : null; this.app.plot.redraw();
    if (res && this.app.hasLive) this.app.editor.redraw();
    if (res) { $('#tslider').value = Math.round(this.t / res.tstop * 1000); $('#tlabel').textContent = 't = ' + MS.fmt(this.t, 's', 4); }
  }
  play() { this.playing = true; $('#play').textContent = '❚❚'; }
  pause() { this.playing = false; $('#play').textContent = '▶'; }
  toggle() { this.playing ? this.pause() : this.play(); }
  seek(t) { this.t = Math.max(0, t); this.push(); }
  reset() { this.t = 0; this.pause(); this.app.plot.cursorT = null; $('#tslider').value = 0; $('#tlabel').textContent = 't = 0 s'; if (this.app.v3d && !this.app.v3d.disabled) this.app.v3d.setTime(0); }
}

MS.HELP_HTML = `
<h3>O que é</h3>
<p>O <b>MeControlEng</b> é um ambiente de engenharia com um simulador multidomínio no estilo LTspice. Numa única matriz MNA ele trata os domínios <b style="color:#4fb3ff">elétrico</b>, <b style="color:#ff9f1c">rotacional</b>, <b style="color:#3ddc84">translacional</b>, <b style="color:#ff6b6b">térmico</b> e <b style="color:#2dd4bf">fluídico</b>, acoplados por motores, engrenagens, bombas, cilindros, aquecedores e sensores. Os resultados aparecem em gráficos e numa bancada <b>3D animada</b>.</p>
<h3>Abas</h3>
<table>
<tr><td><b>⚡ Simulação</b></td><td>esquemático, simulação no tempo, gráficos e bancada 3D (aba principal)</td></tr>
<tr><td><b>◎ Controle e Automação</b></td><td><b>Modelagem matemática</b> (G(s), Laplace, blocos ↔ fluxo de sinal, espaço de estados, G(s) do esquemático) · <b>Estabilidade</b> (Routh-Hurwitz, lugar das raízes) · <b>Frequência</b> (resposta em frequência, Bode, Nyquist) · <b>CLP</b> (Ladder com simulação e plantas virtuais)</td></tr>
<tr><td><b>⚙ Mecânica</b> · <b>⌁ Elétrica</b></td><td>reservadas para as próximas ferramentas</td></tr>
</table>
<p>O botão <b>📘 Entenda</b> abre a teoria resumida de cada ferramenta, e <b>📘 Sobre o componente</b> (nas propriedades) explica cada peça do esquemático.</p>
<h3>Analogia usada (força-corrente / mobilidade)</h3>
<table>
<tr><th></th><th>Elétrico</th><th>Rotacional</th><th>Translacional</th><th>Térmico</th><th>Fluídico</th></tr>
<tr><td>Nó (across)</td><td>tensão V</td><td>vel. angular ω</td><td>velocidade v</td><td>temperatura T</td><td>pressão p</td></tr>
<tr><td>Ramo (through)</td><td>corrente I</td><td>torque τ</td><td>força F</td><td>fluxo de calor q</td><td>vazão Q</td></tr>
<tr><td>"Capacitor"</td><td>C</td><td>inércia J</td><td>massa m</td><td>m·c</td><td>tanque A/(ρg)</td></tr>
<tr><td>"Indutor"</td><td>L</td><td>mola 1/k</td><td>mola 1/k</td><td>—</td><td>inertância ρL/A</td></tr>
<tr><td>"Resistor"</td><td>R</td><td>1/b</td><td>1/b</td><td>Rθ, 1/(hA)</td><td>válvula/tubo</td></tr>
</table>
<p>Acoplamentos: motor DC e bobina móvel (giradores), engrenagem e pinhão-cremalheira (transformadores), bomba (ω → Q) e cilindro (p → F), aquecedor (V²/R → calor), sensores (tacômetro, LM35, nível). Cada nó tem um único domínio; para passar de um a outro, use um acoplamento.</p>
<h3>Atalhos</h3>
<table>
<tr><td><kbd>W</kbd></td><td>desenhar fio</td><td><kbd>R</kbd></td><td>girar</td></tr>
<tr><td><kbd>P</kbd></td><td>ponta de prova</td><td><kbd>G</kbd></td><td>terra elétrico</td></tr>
<tr><td><kbd>Del</kbd></td><td>excluir</td><td><kbd>Ctrl+D</kbd></td><td>duplicar</td></tr>
<tr><td><kbd>Ctrl+Z / Ctrl+Y</kbd></td><td>desfazer / refazer</td><td><kbd>F</kbd></td><td>enquadrar</td></tr>
<tr><td><kbd>Ctrl+Enter</kbd> / <kbd>F9</kbd></td><td>simular</td><td><kbd>Espaço</kbd></td><td>play/pausa 3D</td></tr>
<tr><td><kbd>Ctrl+S / Ctrl+O</kbd></td><td>salvar / abrir</td><td><kbd>Esc</kbd></td><td>modo seleção</td></tr>
</table>
<h3>Valores</h3>
<p>Use prefixos SPICE: <code>f p n u/µ m k M meg G</code> — ex.: <code>4.7u</code>, <code>10k</code>, <code>2meg</code>. Atenção: <code>m</code> = mili, <code>M</code> ou <code>meg</code> = mega.</p>
<h3>Gráficos</h3>
<p>Após simular, o editor entra no modo ponta de prova. Clique num fio para plotar V/ω/v; <b>Shift+clique</b> plota o ângulo θ ou a posição x; clique num componente para corrente, torque ou força. Arraste no gráfico para dar zoom, duplo-clique para restaurar, clique na legenda para remover o traço. Clique simples no gráfico posiciona a animação 3D naquele instante.</p>
<h3>Vista 3D</h3>
<p>Arraste para orbitar, Shift/botão direito para deslocar, roda para zoom, duplo-clique para enquadrar. A <b>escala de deslocamento</b> amplia os movimentos lineares (unidades de grade por metro). Use velocidades de reprodução baixas para motores rápidos (efeito estroboscópico). Convenção: sentido positivo = +x/+z da bancada; rotação positiva pela regra da mão direita.</p>
<h3>Integração numérica</h3>
<p>Passo fixo com Trapezoidal (padrão, como no LTspice) ou Euler implícito (mais amortecido, robusto com chaves). Não lineares (diodo) usam Newton-Raphson com limitação de junção. O PID é amostrado a cada passo (controlador digital ideal) com anti-windup por integração condicional.</p>
`;

MS.PLOT_HELP = `
<p>Cada <b>painel</b> agrupa os traços de mesma unidade, como no LTspice. A unidade aparece no eixo vertical.</p>
<table>
<tr><th>Sinal</th><th>O que é</th><th>Como obter</th></tr>
<tr><td>V(nó), ω(nó), v(nó)</td><td>variável <i>através</i> (across): tensão, velocidade angular, velocidade</td><td>clique num fio</td></tr>
<tr><td>θ(nó), x(nó)</td><td>ângulo / posição = integral da velocidade</td><td>Shift + clique num fio mecânico</td></tr>
<tr><td>I, τ, F (componente)</td><td>variável <i>por</i> (through): corrente, torque, força no componente</td><td>clique no componente</td></tr>
<tr><td>Δθ, Δx (mola)</td><td>deformação da mola = força/k</td><td>clique na mola</td></tr>
<tr><td>Pel, Ea (motor)</td><td>potência elétrica de entrada; força contraeletromotriz</td><td>clique no motor</td></tr>
</table>
<p><b>Leitura:</b> passe o mouse para ver os valores no instante. Arraste na horizontal para dar zoom e use duplo-clique para restaurar. A linha amarela tracejada é o instante mostrado na bancada 3D.</p>
<p><b>Convenção de sinais:</b> a corrente (ou força/torque) é positiva quando entra pelo 1º pino do componente. Por isso, girar um componente em 180° inverte o sinal do gráfico.</p>
<p><b>Unidades práticas:</b> converte rad/s → RPM e rad → graus.</p>`;

window.addEventListener('DOMContentLoaded', () => {
  window.app = new MS.App();
  let t = 'sim'; try { t = localStorage.getItem('mecontroleng.tab') || 'sim'; window.app.sub = localStorage.getItem('mecontroleng.sub') || 'model'; } catch (e) { /* */ }
  window.app.setTab(t);
});
