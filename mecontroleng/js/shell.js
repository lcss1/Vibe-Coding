/* ============================================================
   MeControlEng — Shell da interface
   Ícones vetoriais, barra de menus, paleta de comandos (Ctrl+K),
   tela Início, trilha de navegação (breadcrumb), barra de status,
   painel de ferramentas recolhível e exportação de gráficos.
   Camada puramente de interface: não altera cálculos nem a lógica
   dos módulos; apenas chama as ações que já existem.
   ============================================================ */
'use strict';
(function () {
  const CS = MS.CS, h = CS.h, $ = s => document.querySelector(s);

  /* ───────── ícones (traço 1,7 px, grade 24) ───────── */
  const P = {
    home: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h5v-6h4v6h5V10"/>',
    circuit: '<path d="M2 12h4l2-5 3 10 3-10 2 5h6"/><circle cx="20" cy="12" r="1.2" fill="currentColor"/>',
    control: '<circle cx="6" cy="12" r="2.5"/><rect x="10" y="9" width="6" height="6" rx="1"/><path d="M8.5 12H10M16 12h5M18.5 12v6H6v-3.5"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2.5 12h3M18.5 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/><circle cx="12" cy="12" r="6.5"/>',
    bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.7v.5"/><circle cx="12" cy="17" r=".6" fill="currentColor"/>',
    file: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M12 11v6M9 14h6"/>',
    folder: '<path d="M3 6.5A1.5 1.5 0 0 1 4.5 5H9l2 2h8.5A1.5 1.5 0 0 1 21 8.5V18a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18z"/>',
    save: '<path d="M5 3h11l3 3v15H5z"/><path d="M8 3v5h7V3M8 21v-7h8v7"/>',
    grid: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
    undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>',
    redo: '<path d="M15 14l5-5-5-5"/><path d="M20 9H9a5 5 0 0 0 0 10h3"/>',
    pointer: '<path d="M5 3l14 7-6 2-2 6z"/>',
    wire: '<circle cx="5" cy="18" r="2"/><circle cx="19" cy="6" r="2"/><path d="M7 18h5V6h5"/>',
    probe: '<path d="M14 4l6 6-8.5 8.5a3 3 0 0 1-4.2 0l-1.8-1.8a3 3 0 0 1 0-4.2z"/><path d="M5.5 18.5L3 21"/>',
    rotate: '<path d="M20 12a8 8 0 1 1-2.4-5.7"/><path d="M20 4v5h-5"/>',
    trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
    fit: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/><rect x="8.5" y="8.5" width="7" height="7" rx="1"/>',
    list: '<path d="M8 6h12M8 12h12M8 18h12"/><circle cx="4" cy="6" r="1" fill="currentColor"/><circle cx="4" cy="12" r="1" fill="currentColor"/><circle cx="4" cy="18" r="1" fill="currentColor"/>',
    cube: '<path d="M12 2.5l8.5 4.8v9.4L12 21.5l-8.5-4.8V7.3z"/><path d="M3.5 7.3L12 12l8.5-4.7M12 12v9.5"/>',
    layers: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>',
    wave: '<path d="M2 12c2.5-7 5-7 7.5 0s5 7 7.5 0 3-4.5 5-3"/>',
    sliders: '<path d="M4 6h10M18 6h2M4 12h3M11 12h9M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
    terminal: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 9l3 3-3 3M12 15h5"/>',
    fx: '<path d="M14 4h-2a2 2 0 0 0-2 2v12a2 2 0 0 1-2 2H6M7 10h6"/><path d="M15 12l5 6M20 12l-5 6"/>',
    stability: '<path d="M3 20h18"/><path d="M12 4v16"/><circle cx="7" cy="10" r="1.6"/><circle cx="7" cy="14" r="1.6"/><path d="M15 8l3 3m0-3l-3 3"/>',
    bode: '<path d="M3 3v18h18"/><path d="M5 7h6c3 0 4 4 9 10"/>',
    ladder: '<path d="M4 3v18M20 3v18M4 8h4M11 8h2M16 8h4M8 5.5v5M11 5.5v5M4 16h5M15 16h5"/><circle cx="12" cy="16" r="2.5"/>',
    beam: '<path d="M3 9h18v4H3z"/><path d="M5 13l-2 5h4zM19 13l-2 5h4z"/><path d="M12 3v4M10.5 5.5L12 7l1.5-1.5"/>',
    flame: '<path d="M12 3c1 3 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-6 1-9z"/>',
    factory: '<path d="M3 21V10l5 3V10l5 3V10l5 3V4h3v17z"/><path d="M7 17h2M12 17h2M17 17h2"/>',
    plug: '<path d="M9 3v5M15 3v5M6 8h12v3a6 6 0 0 1-12 0z"/><path d="M12 17v4"/>',
    chip: '<rect x="6" y="6" width="12" height="12" rx="1.5"/><rect x="9.5" y="9.5" width="5" height="5"/><path d="M9 3v3M12 3v3M15 3v3M9 18v3M12 18v3M15 18v3M3 9h3M3 12h3M3 15h3M18 9h3M18 12h3M18 15h3"/>',
    power: '<path d="M3 12h3l2-6 4 12 2-6h7"/><path d="M17 5l2 2 2-2"/>',
    antenna: '<path d="M12 12v9M8.5 21h7"/><circle cx="12" cy="10" r="1.5"/><path d="M8.5 6.5a5 5 0 0 0 0 7M15.5 6.5a5 5 0 0 1 0 7M5.5 3.5a9 9 0 0 0 0 13M18.5 3.5a9 9 0 0 1 0 13"/>',
    book: '<path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H19v16H5.5A1.5 1.5 0 0 0 4 20.5z"/><path d="M4 20.5A1.5 1.5 0 0 0 5.5 22H19v-3"/>',
    chevron: '<path d="M9 6l6 6-6 6"/>',
    collapse: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16M15 10l-2 2 2 2"/>',
    download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
    keyboard: '<rect x="2.5" y="6" width="19" height="12" rx="2"/><path d="M6 10h1M10 10h1M14 10h1M18 10h0M6 14h12"/>',
    play: '<path d="M7 4l13 8-13 8z"/>',
    tool: '<path d="M14.5 6.5a4 4 0 0 0 5 5L12 19a2.1 2.1 0 0 1-3-3z"/><path d="M14.5 6.5L17 4l3 3-2.5 2.5"/>',
    flask: '<path d="M9 3h6M10 3v6L4.5 19a1.5 1.5 0 0 0 1.3 2h12.4a1.5 1.5 0 0 0 1.3-2L14 9V3"/><path d="M7 15h10"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6"/><circle cx="12" cy="7.5" r=".6" fill="currentColor"/>',
    lightbulb: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/>',
    component: '<rect x="7" y="8" width="10" height="8" rx="1"/><path d="M2 12h5M17 12h5"/>',
  };
  const icon = (name, cls = 'ic') => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${P[name] || P.tool}</svg>`;
  MS.icon = icon;
  const applyIcons = (root = document) => root.querySelectorAll('[data-icon]').forEach(el => {
    if (el.dataset.iconDone) return; el.dataset.iconDone = '1';
    const svg = icon(el.dataset.icon);
    if (!el.childNodes.length) el.innerHTML = svg; else el.insertAdjacentHTML('afterbegin', svg);
  });
  MS.applyIcons = applyIcons;

  /* ───────── módulos (fonte única para Início, menus e busca) ───────── */
  const MODS = [
    { id: 'sim', name: 'Simulação', icon: 'circuit', c: '#3fb5ff', desc: 'Esquemático multidomínio (elétrico, mecânico, térmico e fluídico) com simulação no tempo e bancada 3D' },
    { id: 'ctrl', name: 'Controle e Automação', icon: 'control', c: '#b794ff', desc: 'Laplace, funções de transferência, Routh, lugar das raízes, Bode, Nyquist e CLP' },
    { id: 'mec', name: 'Mecânica', icon: 'gear', c: '#ffab40', desc: 'Resistência dos materiais, vibrações, elementos de máquinas, termofluidos e fabricação' },
    { id: 'ele', name: 'Elétrica', icon: 'bolt', c: '#3ddc84', desc: 'Instalações (NBR 5410), embarcados, eletrônica de potência, alta tensão e telecomunicações' },
  ];
  const subsOf = mid => [...document.querySelectorAll(`#tab-${mid} .subtabs [data-sub]`)].map(b => ({ id: b.dataset.sub, name: b.textContent.trim(), icon: b.dataset.icon }));
  const modOfSub = sid => { const v = document.getElementById('tab-' + sid); return v ? v.closest('.tabview').id.slice(4) : null; };
  const app = () => MS.app;
  const goSim = () => { if (app().tab !== 'sim') app().setTab('sim'); };
  const click = id => { const b = document.getElementById(id); if (b) b.click(); };
  const norm = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const strip = s => String(s).replace(/<[^>]+>/g, '');

  /* ───────── ações (reaproveitam os botões e métodos existentes) ───────── */
  const ACT = {
    newDoc: () => { goSim(); click('btn-new'); }, open: () => { goSim(); click('btn-open'); }, save: () => { goSim(); click('btn-save'); },
    examples: () => { goSim(); click('btn-ex'); }, csv: () => { goSim(); click('btn-csv'); }, run: () => { goSim(); click('run'); },
    netlist: () => { goSim(); click('btn-net'); }, toggle3d: () => { goSim(); click('btn-3d'); }, clear: () => { goSim(); click('btn-clear'); },
    undo: () => { goSim(); app().undo(); }, redo: () => { goSim(); app().redo(); },
    selAll: () => { goSim(); app().editor.selectAll(); }, dup: () => { goSim(); app().editor.duplicateSel(); }, rot: () => { goSim(); app().editor.rotateSel(); },
    del: () => { goSim(); app().editor.deleteSel(); }, fit: () => { goSim(); app().editor.fit(); },
    help: () => app().showHelp(), keys: () => showKeys(), about: () => showAbout(), cmd: () => openCmd(),
    nav: () => toggleNav(), learn: () => { CS.learnPinned = !CS.learnPinned; document.querySelectorAll('.tool-wrap').forEach(w => w.classList.toggle('learn-open', !!CS.learnPinned)); try { localStorage.setItem('mecontroleng.learn', CS.learnPinned ? '1' : ''); } catch (e) { /* */ } },
  };

  /* ───────── barra de menus ───────── */
  const MENUS = [
    ['Arquivo', [['file', 'Novo esquemático', '', ACT.newDoc], ['folder', 'Abrir…', 'Ctrl+O', ACT.open], ['save', 'Salvar', 'Ctrl+S', ACT.save], 0, ['grid', 'Galeria de exemplos…', '', ACT.examples], ['download', 'Exportar formas de onda (CSV)', '', ACT.csv]]],
    ['Editar', [['undo', 'Desfazer', 'Ctrl+Z', ACT.undo], ['redo', 'Refazer', 'Ctrl+Y', ACT.redo], 0, ['pointer', 'Selecionar tudo', 'Ctrl+A', ACT.selAll], ['layers', 'Duplicar seleção', 'Ctrl+D', ACT.dup], ['rotate', 'Girar', 'R', ACT.rot], ['trash', 'Excluir', 'Del', ACT.del]]],
    ['Exibir', [{ head: 'Módulos' }, ['home', 'Início', '', () => app().setTab('home')], ...MODS.map(m => [m.icon, m.name, '', () => app().setTab(m.id)]), 0, ['cube', 'Bancada 3D', '', ACT.toggle3d], ['fit', 'Enquadrar esquemático', 'F', ACT.fit], ['collapse', 'Recolher lista de ferramentas', '', ACT.nav], ['book', 'Manter painel "Entenda" aberto', '', ACT.learn]]],
    ['Simulação', [['play', 'Executar simulação', 'Ctrl+Enter', ACT.run], ['list', 'Netlist', '', ACT.netlist], ['wave', 'Limpar traços do gráfico', '', ACT.clear]]],
    ['Ajuda', [['search', 'Buscar ferramentas e comandos', 'Ctrl+K', ACT.cmd], ['keyboard', 'Atalhos de teclado', '', ACT.keys], ['help', 'Guia do programa', 'F1', ACT.help], 0, ['info', 'Sobre o MeControlEng', '', ACT.about]]],
  ];
  function buildMenus() {
    const bar = $('#menubar'); bar.innerHTML = '';
    for (const [name, items] of MENUS) {
      const drop = h('div', { class: 'mb-drop', role: 'menu' });
      for (const it of items) {
        if (it === 0) { drop.append(h('div', { class: 'mb-sep' })); continue; }
        if (it.head) { drop.append(h('div', { class: 'mb-head' }, it.head)); continue; }
        const [ic, label, k, fn] = it;
        drop.append(h('button', { class: 'mb-row', role: 'menuitem', onclick: () => { closeMenus(); fn(); } }, h('span', { 'data-icon': ic }), label, k ? h('span', { class: 'mb-k' }, k) : null));
      }
      const item = h('div', { class: 'mb-item' }, h('button', { class: 'mb-btn', 'aria-haspopup': 'true' }, name), drop);
      const btn = item.firstChild;
      btn.addEventListener('click', e => { e.stopPropagation(); const was = item.classList.contains('open'); closeMenus(); if (!was) item.classList.add('open'); });
      btn.addEventListener('mouseenter', () => { if (bar.querySelector('.mb-item.open') && !item.classList.contains('open')) { closeMenus(); item.classList.add('open'); } });
      bar.append(item);
    }
    applyIcons(bar);
    document.addEventListener('mousedown', e => { if (!e.target.closest('#menubar')) closeMenus(); });
  }
  const closeMenus = () => document.querySelectorAll('.mb-item.open').forEach(i => i.classList.remove('open'));

  /* ───────── paleta de comandos ───────── */
  let cmdItems = [], cmdSel = 0, cmdShown = [];
  function collectCmds() {
    const out = [];
    out.push({ g: 'Módulos', ic: 'home', t: 'Início', d: 'Visão geral dos módulos', fn: () => app().setTab('home') });
    for (const m of MODS) {
      out.push({ g: 'Módulos', ic: m.icon, t: m.name, d: m.desc, fn: () => app().setTab(m.id) });
      for (const s of subsOf(m.id)) {
        out.push({ g: 'Áreas', ic: s.icon, t: s.name, d: m.name, fn: () => { app().setTab(m.id); app().setSub(s.id); } });
        const def = CS.TABS[s.id];
        if (def) for (const t of def.tools) out.push({ g: 'Ferramentas', ic: s.icon, t: strip(t.label), d: `${m.name} › ${s.name}${t.desc ? ' — ' + strip(t.desc) : ''}`, fn: () => CS.openTool(s.id, t.id) });
      }
    }
    for (const [, items] of MENUS) for (const it of items) if (Array.isArray(it)) out.push({ g: 'Comandos', ic: it[0], t: it[1], d: '', k: it[2], fn: it[3] });
    for (const ex of MS.EXAMPLES || []) out.push({ g: 'Exemplos de simulação', ic: 'flask', t: ex.title, d: `${ex.cat} — ${ex.desc}`, fn: () => { app().setTab('sim'); app().setDoc(ex.build(), 'Exemplo carregado: ' + ex.title + ' — pressione ▶ Simular.'); } });
    for (const [k, d] of Object.entries(MS.DEFS || {})) if (d.name && d.cat) out.push({ g: 'Componentes', ic: 'component', t: d.name, d: `${d.cat} — inserir no esquemático`, fn: () => { app().setTab('sim'); app().editor.setMode('place', k); } });
    return out.map(o => ({ ...o, hay: norm(o.t + ' ' + o.d + ' ' + o.g) }));
  }
  function openCmd() {
    closeMenus();
    if (!cmdItems.length) cmdItems = collectCmds();
    const box = $('#cmdk');
    box.innerHTML = '';
    const inp = h('input', { placeholder: 'Buscar ferramenta, área, exemplo, componente ou comando…', spellcheck: 'false', 'aria-label': 'Buscar' });
    const list = h('div', { class: 'ck-list', role: 'listbox' });
    box.append(h('div', { class: 'ck-box', onclick: e => e.stopPropagation() }, h('div', { class: 'ck-in', html: icon('search') }, inp), list,
      h('div', { class: 'ck-foot', html: '<span><kbd>↑</kbd> <kbd>↓</kbd> navegar</span><span><kbd>Enter</kbd> abrir</span><span><kbd>Esc</kbd> fechar</span>' })));
    box.querySelector('.ck-in').append(inp);
    box.hidden = false;
    box.onclick = closeCmd;
    const render = () => {
      const q = norm(inp.value.trim()), toks = q.split(/\s+/).filter(Boolean);
      let res = cmdItems.filter(o => toks.every(t => o.hay.includes(t)));
      if (toks.length) res = res.map(o => ({ o, s: (norm(o.t).startsWith(toks[0]) ? 0 : norm(o.t).includes(toks[0]) ? 1 : 2) + ['Ferramentas', 'Áreas', 'Módulos', 'Comandos', 'Exemplos de simulação', 'Componentes'].indexOf(o.g) * 0.1 })).sort((a, b) => a.s - b.s).map(x => x.o);
      else res = res.filter(o => o.g !== 'Componentes' && o.g !== 'Exemplos de simulação');
      cmdShown = res.slice(0, 80); cmdSel = 0;
      list.innerHTML = '';
      if (!cmdShown.length) { list.append(h('div', { class: 'ck-empty' }, 'Nada encontrado. Tente outro termo (ex.: "bode", "condutor", "arduino", "viga").')); return; }
      const hl = s => { let r = s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]); if (!toks[0]) return r; const i = norm(s).indexOf(toks[0]); return i < 0 ? r : s.slice(0, i) + '<mark>' + s.slice(i, i + toks[0].length) + '</mark>' + s.slice(i + toks[0].length); };
      let g = null;
      cmdShown.forEach((o, i) => {
        if (o.g !== g) { g = o.g; list.append(h('div', { class: 'ck-grp' }, g)); }
        list.append(h('div', { class: 'ck-row' + (i === 0 ? ' on' : ''), 'data-i': i, role: 'option', onclick: () => runCmd(i), onmousemove: () => setSel(i) },
          h('span', { class: 'ck-ic', html: icon(o.ic) }), h('span', { class: 'ck-t' }, h('b', { html: hl(o.t) }), o.d ? h('small', {}, o.d) : null), o.k ? h('kbd', { class: 'ck-k' }, o.k) : null));
      });
    };
    const setSel = i => { cmdSel = i; list.querySelectorAll('.ck-row').forEach(r => r.classList.toggle('on', +r.dataset.i === i)); const r = list.querySelector(`.ck-row[data-i="${i}"]`); if (r) r.scrollIntoView({ block: 'nearest' }); };
    inp.addEventListener('input', render);
    inp.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown') { e.preventDefault(); setSel(Math.min(cmdShown.length - 1, cmdSel + 1)); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setSel(Math.max(0, cmdSel - 1)); }
      else if (e.key === 'Enter') { e.preventDefault(); runCmd(cmdSel); }
      else if (e.key === 'Escape') { e.preventDefault(); closeCmd(); }
    });
    render(); inp.focus();
  }
  function runCmd(i) { const o = cmdShown[i]; closeCmd(); if (o) setTimeout(() => o.fn(), 0); }
  function closeCmd() { const b = $('#cmdk'); b.hidden = true; b.innerHTML = ''; }
  MS.openCmd = openCmd;

  /* ───────── janelas auxiliares ───────── */
  function showKeys() {
    const rows = [['Ctrl + K', 'Buscar ferramentas, exemplos, componentes e comandos'], ['F1', 'Guia do programa'], ['Ctrl + Enter / F9', 'Executar simulação'], ['Ctrl + S / Ctrl + O', 'Salvar / abrir esquemático'], ['Ctrl + Z / Ctrl + Y', 'Desfazer / refazer'], ['Ctrl + A / Ctrl + D', 'Selecionar tudo / duplicar'], ['W · P · G', 'Fio · ponta de prova · terra'], ['R · Del · F', 'Girar · excluir · enquadrar'], ['Espaço', 'Reproduzir / pausar a bancada 3D'], ['Esc', 'Cancelar / voltar à seleção'], ['Roda do mouse', 'Zoom nos gráficos e no esquemático'], ['Duplo clique (gráfico)', 'Restaurar a escala']];
    app().modal('Atalhos de teclado', h('table', { class: 'tbl' }, h('tr', {}, h('th', {}, 'Tecla'), h('th', {}, 'Ação')), ...rows.map(([k, d]) => h('tr', {}, h('td', {}, ...k.split(' ').map(p => (/^[+·/]$/.test(p) ? ` ${p} ` : h('kbd', {}, p)))), h('td', {}, d)))));
  }
  function showAbout() {
    const n = Object.values(CS.TABS).reduce((s, d) => s + d.tools.length, 0);
    app().modal('Sobre', h('div', { class: 'help', html: `<p><b>MeControlEng 2.0</b> — ambiente de engenharia multidomínio para estudo e pré-projeto.</p><p>${MODS.length} módulos · ${n} ferramentas · ${Object.keys(MS.DEFS || {}).length} componentes de simulação · ${(MS.EXAMPLES || []).length} exemplos.</p><p class="muted">Roda inteiramente no navegador, sem instalação. Os resultados são de referência didática e de pré-dimensionamento: verifique sempre as normas e os dados de fabricante no projeto real.</p>` }));
  }

  /* ───────── tela Início ───────── */
  function buildHome() {
    const host = $('#tab-home'); host.innerHTML = '';
    const nTools = Object.values(CS.TABS).reduce((s, d) => s + d.tools.length, 0);
    const wrap = h('div', { class: 'home' });
    wrap.append(h('section', { class: 'home-hero' },
      h('div', {}, h('h1', { html: 'MeControl<span>Eng</span> — engenharia multidomínio' }),
        h('p', {}, 'Simule circuitos elétricos, mecânicos, térmicos e fluídicos num único esquemático, analise sistemas de controle e use ferramentas de projeto de mecânica e elétrica, com explicações didáticas sempre à mão.'),
        h('div', { class: 'home-cta' },
          h('button', { class: 'btn primary', onclick: () => app().setTab('sim'), html: icon('circuit') + 'Abrir o simulador' }),
          h('button', { class: 'btn', onclick: ACT.examples, html: icon('flask') + 'Galeria de exemplos' }),
          h('button', { class: 'btn', onclick: openCmd, html: icon('search') + 'Buscar ferramenta <kbd>Ctrl K</kbd>' }))),
      h('div', { class: 'home-stats' }, ...[[MODS.length, 'módulos'], [nTools, 'ferramentas'], [Object.keys(MS.DEFS || {}).length, 'componentes'], [(MS.EXAMPLES || []).length, 'exemplos']].map(([v, l]) => h('div', {}, h('b', {}, String(v)), h('small', {}, l))))));
    wrap.append(h('div', { class: 'home-sec' }, h('h2', {}, 'Módulos'), h('span', { class: 'muted small' }, 'Clique numa área para abrir diretamente')));
    const grid = h('div', { class: 'home-grid' });
    for (const m of MODS) {
      const card = h('div', { class: 'mod-card', style: `--c:${m.c}` },
        h('div', { class: 'mod-card-head', onclick: () => app().setTab(m.id) }, h('span', { class: 'mi', html: icon(m.icon) }), h('div', {}, h('b', {}, m.name), h('small', {}, m.desc)), h('span', { class: 'go', html: icon('chevron') })));
      const subs = h('div', { class: 'mod-subs' });
      if (m.id === 'sim') {
        subs.append(...[['flask', 'Galeria de exemplos', ACT.examples, (MS.EXAMPLES || []).length], ['file', 'Novo esquemático', ACT.newDoc, ''], ['component', 'Biblioteca de componentes', () => app().setTab('sim'), Object.keys(MS.DEFS || {}).length]].map(([ic, t, fn, n]) => h('button', { class: 'mod-sub', onclick: fn }, h('span', { 'data-icon': ic }), t, n !== '' ? h('span', { class: 'n' }, String(n)) : null)));
      } else for (const s of subsOf(m.id)) {
        const def = CS.TABS[s.id];
        subs.append(h('button', { class: 'mod-sub', onclick: () => { app().setTab(m.id); app().setSub(s.id); } }, h('span', { 'data-icon': s.icon }), s.name, def ? h('span', { class: 'n' }, `${def.tools.length} ferramentas`) : null));
      }
      card.append(subs); grid.append(card);
    }
    wrap.append(grid);
    const exs = (MS.EXAMPLES || []).slice(0, 8);
    if (exs.length) {
      wrap.append(h('div', { class: 'home-sec' }, h('h2', {}, 'Comece por um exemplo'), h('button', { class: 'btn sm ghost', onclick: ACT.examples }, 'ver todos →')));
      wrap.append(h('div', { class: 'home-ex' }, ...exs.map(ex => h('button', { class: 'ex-card', onclick: () => { app().setTab('sim'); app().setDoc(ex.build(), 'Exemplo carregado: ' + ex.title + ' — pressione ▶ Simular.'); } }, h('div', { class: 'ex-cat' }, ex.cat), h('div', { class: 'ex-title' }, ex.title), h('div', { class: 'ex-desc' }, ex.desc)))));
    }
    wrap.append(h('div', { class: 'home-sec' }, h('h2', {}, 'Dicas')));
    wrap.append(h('div', { class: 'home-tips' }, ...[
      ['search', '<b>Ctrl + K</b> abre a busca global: encontre qualquer ferramenta, exemplo ou componente pelo nome.'],
      ['book', 'O botão <b>Entenda</b> em cada ferramenta abre a teoria, as fórmulas e as hipóteses usadas no cálculo.'],
      ['wave', 'Nos gráficos: <b>roda</b> = zoom, <b>arrastar</b> = mover, <b>duplo clique</b> = restaurar. Passe o mouse para ler os valores e use o botão de download para exportar em PNG.'],
      ['sliders', 'Os campos aceitam prefixos de engenharia: <b>4k7</b>, <b>10m</b>, <b>2.2u</b>, <b>1M</b>. Confirme com Enter.'],
    ].map(([ic, t]) => h('div', { class: 'tip-card' }, h('span', { 'data-icon': ic }), h('div', { html: t })))));
    host.append(wrap);
    applyIcons(host);
  }

  /* ───────── trilha (breadcrumb) e status ───────── */
  function crumbParts() {
    const a = app(); const tab = a.tab || 'home';
    if (tab === 'home') return ['Início'];
    const m = MODS.find(x => x.id === tab); const parts = [m ? m.name : tab];
    if (tab === 'sim') { parts.push((a.doc && a.doc.title) || 'Sem título'); return parts; }
    const sub = (a.subs || {})[tab]; const s = subsOf(tab).find(x => x.id === sub);
    if (s) { parts.push(s.name); const def = CS.TABS[sub], t = def && def.tools.find(x => x.id === CS.current[sub]); if (t) parts.push(strip(t.label)); }
    return parts;
  }
  function updateStatus() {
    const parts = crumbParts();
    $('#sb-crumb').innerHTML = parts.map((p, i) => (i === parts.length - 1 ? `<b>${p}</b>` : p)).join('<span class="sep">›</span>');
    const a = app(), info = $('#sb-info');
    if (a.tab === 'sim' && a.doc) info.textContent = `${a.doc.comps.length} componentes · ${a.doc.wires.length} fios · ${a.doc.sim.method === 'be' ? 'Euler implícito' : 'trapezoidal'}`;
    else if (a.tab !== 'home' && a.subs && CS.TABS[a.subs[a.tab]]) info.textContent = `${CS.TABS[a.subs[a.tab]].tools.length} ferramentas nesta área`;
    else info.textContent = '';
    document.title = parts.length > 1 ? `${parts[parts.length - 1]} — MeControlEng` : 'MeControlEng';
  }

  /* ───────── painel de ferramentas recolhível ───────── */
  let navCollapsed = false;
  try { navCollapsed = localStorage.getItem('mecontroleng.navc') === '1'; CS.learnPinned = localStorage.getItem('mecontroleng.learn') === '1'; } catch (e) { /* */ }
  function toggleNav() { navCollapsed = !navCollapsed; document.querySelectorAll('.subnav').forEach(n => n.classList.toggle('collapsed', navCollapsed)); try { localStorage.setItem('mecontroleng.navc', navCollapsed ? '1' : ''); } catch (e) { /* */ } }
  function decorateNav(host) {
    const nav = host.querySelector('.subnav'); if (!nav || nav.dataset.dec) return;
    nav.dataset.dec = '1'; nav.classList.toggle('collapsed', navCollapsed);
    const t = nav.querySelector('.subnav-title');
    if (t) { const txt = t.textContent; t.innerHTML = ''; t.append(h('span', {}, txt), h('button', { class: 'nav-tog', title: 'Recolher / expandir lista', onclick: toggleNav, html: icon('collapse') })); }
    nav.querySelectorAll('.sub-item').forEach(b => { const t = b.querySelector('b'), d = b.querySelector('small'); b.title = (t ? t.textContent : '') + (d && d.textContent ? ' — ' + d.textContent : ''); });
  }

  /* ───────── exportação de gráficos em PNG ───────── */
  function exportCanvas(cv, name) {
    try {
      const out = document.createElement('canvas'); out.width = cv.width; out.height = cv.height;
      const g = out.getContext('2d'); g.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--plot-bg').trim() || '#0a0e14'; g.fillRect(0, 0, out.width, out.height); g.drawImage(cv, 0, 0);
      const a = document.createElement('a'); a.download = (name || 'grafico').replace(/[^\w\-]+/g, '_').replace(/_+/g, '_') + '.png'; a.href = out.toDataURL('image/png'); a.click();
    } catch (e) { console.warn(e); }
  }
  const toolName = el => { const tm = el.closest('.tool-main'); const t = tm && tm.querySelector('.tool-head h2'); const c = el.closest('.card'); const ct = c && c.querySelector('.card-title'); return [t && t.textContent, ct && ct.textContent].filter(Boolean).join(' - '); };
  const addTools = box => {
    if (box.querySelector(':scope > .chart-tools')) return;
    box.append(h('div', { class: 'chart-tools' }, h('button', { title: 'Exportar imagem (PNG)', html: icon('download'), onclick: e => { e.stopPropagation(); const cv = box.querySelector('canvas'); if (cv) exportCanvas(cv, toolName(box)); } })));
  };
  const origChartBox = CS.chartBox;
  CS.chartBox = (cls = '') => { const b = origChartBox(cls); addTools(b); return b; };
  if (MS.MK && MS.MK.canvas) { const oc = MS.MK.canvas; MS.MK.canvas = function (...a) { const o = oc.apply(this, a); addTools(o.box); return o; }; }

  /* ───────── integração com a navegação existente ───────── */
  const origRender = CS.renderTab;
  CS.renderTab = function (tabId, toolId) {
    const r = origRender.call(this, tabId, toolId);
    const host = document.getElementById('tab-' + tabId);
    if (host) {
      decorateNav(host);
      const head = host.querySelector('.tool-head > div');
      const def = CS.TABS[tabId], mid = modOfSub(tabId), m = MODS.find(x => x.id === mid), s = subsOf(mid).find(x => x.id === tabId);
      if (head && !head.querySelector('.tool-crumb') && m) head.prepend(h('div', { class: 'tool-crumb', html: `${m.name}<span>›</span><b>${s ? s.name : def.title}</b>` }));
      const lb = host.querySelector('.learn-btn'); if (lb && !lb.dataset.iconDone) { lb.dataset.iconDone = 1; lb.innerHTML = icon('book') + 'Entenda'; }
      const lh = host.querySelector('.learn-head'); if (lh && !lh.dataset.iconDone) { lh.dataset.iconDone = 1; lh.firstChild.textContent = 'Entenda — teoria e hipóteses'; }
    }
    updateStatus();
    return r;
  };

  window.addEventListener('DOMContentLoaded', () => {
    const a = app(); if (!a) return;
    applyIcons();
    buildMenus();
    buildHome();
    const st = a.setTab.bind(a), ss = a.setSub.bind(a);
    let simFitted = a.tab === 'sim';
    a.setTab = id => {
      st(id); updateStatus();
      if (id === 'sim' && !simFitted) { simFitted = true; setTimeout(() => { a.layout(); a.editor.fit(); if (a.v3d && !a.v3d.disabled && a.v3d.fit) a.v3d.fit(); }, 60); }
    };
    a.setSub = id => { ss(id); updateStatus(); };
    $('#btn-cmd').addEventListener('click', openCmd);
    $('#doc-title').addEventListener('blur', () => setTimeout(updateStatus, 0));
    document.querySelectorAll('.subnav').forEach(n => n.parentElement && decorateNav(n.parentElement));
    window.addEventListener('keydown', e => {
      const k = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && k === 'k') { e.preventDefault(); e.stopPropagation(); $('#cmdk').hidden ? openCmd() : closeCmd(); }
      else if (e.key === 'F1') { e.preventDefault(); ACT.help(); }
      else if (e.key === 'Escape') { if (!$('#cmdk').hidden) closeCmd(); closeMenus(); if ($('#modal').classList.contains('open') && a.tab !== 'sim') a.closeModal(); }
    }, true);
    setInterval(() => { if (a.tab === 'sim') updateStatus(); }, 1500);
    updateStatus();
  });
})();
