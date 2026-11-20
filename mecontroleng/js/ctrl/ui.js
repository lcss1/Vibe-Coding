/* ============================================================
   MeControlEng — Infraestrutura das abas de Controle
   Estado compartilhado do sistema (G, H, K), barra do sistema,
   páginas com painel "Entenda" recolhível.
   ============================================================ */
'use strict';
(function () {
  const CS = MS.CS;
  const h = (tag, attrs = {}, ...kids) => {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v === undefined || v === null || v === false) continue;
      if (k === 'class') e.className = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (k === 'html') e.innerHTML = v; else e.setAttribute(k, v);
    }
    for (const k of kids.flat()) if (k != null && k !== false) e.append(k);
    return e;
  };
  CS.h = h;

  /* ───────── estado compartilhado ───────── */
  const DEF = { G: '1/(s(s+2)(s+4))', H: '1', K: '10', name: 'Tipo 1, 3ª ordem' };
  const st = CS.state = (() => { try { return Object.assign({}, DEF, JSON.parse(localStorage.getItem('mecontroleng.cs') || '{}')); } catch (e) { return { ...DEF }; } })();
  const listeners = new Set();
  CS.onChange = fn => listeners.add(fn);
  CS.offChange = fn => listeners.delete(fn);
  CS.setSys = (patch, silent) => {
    Object.assign(st, patch);
    try { localStorage.setItem('mecontroleng.cs', JSON.stringify(st)); } catch (e) { /* */ }
    if (!silent) for (const fn of listeners) fn(st);
  };
  /* objetos racionais do sistema atual */
  CS.sys = () => {
    const G = CS.parse(st.G), H = CS.parse(st.H || '1'), K = MS.parseEng(st.K);
    if (!isFinite(K)) throw new Error('K inválido');
    const GH = CS.rat.mul(G, H);
    const L = CS.rat.scaleK(GH, K);
    const T = CS.rat.simplify(CS.rat.div(CS.rat.scaleK(G, K), CS.rat.add(CS.rat.one(), L)));
    return { G, H, K, GH, L, T };
  };

  CS.PRESETS = [
    { name: '1ª ordem', G: '1/(s+1)', H: '1', K: '1' },
    { name: '2ª ordem subamortecida', G: '4/(s^2+2s+4)', H: '1', K: '1' },
    { name: 'Tipo 1, 3ª ordem', G: '1/(s(s+2)(s+4))', H: '1', K: '10' },
    { name: 'Com zero no semiplano esquerdo', G: '(s+3)/(s(s+1)(s+2))', H: '1', K: '2' },
    { name: 'Instável em malha aberta', G: '(s+2)/((s-1)(s+3))', H: '1', K: '4' },
    { name: 'Fase não mínima', G: '(1-s)/((s+1)(s+2))', H: '1', K: '1' },
    { name: 'Ressonante (pouco amortecido)', G: '100/(s^2+0.4s+100)', H: '1', K: '1' },
    { name: 'Integrador duplo + avanço', G: '(s+1)/(s^2(s+10))', H: '1', K: '20' },
    { name: 'Realimentação com sensor', G: '20/(s(s+5))', H: '1/(0.1s+1)', K: '1' },
  ];

  /* ───────── barra do sistema ─────────
     Exibe e edita G(s), H(s) e K; usada nas abas de estabilidade e frequência */
  CS.sysBar = function (host, opts = {}) {
    const bar = h('div', { class: 'sysbar' });
    const inputs = {};
    const mk = (key, label, w, tip) => {
      const inp = inputs[key] = h('input', { value: st[key], spellcheck: 'false', style: `width:${w}`, title: tip });
      inp.addEventListener('change', () => {
        try { if (key === 'K') { if (!isFinite(MS.parseEng(inp.value))) throw new Error('número inválido'); } else CS.parse(inp.value); inp.classList.remove('bad'); CS.setSys({ [key]: inp.value.trim(), name: '' }); }
        catch (e) { inp.classList.add('bad'); inp.title = e.message; }
      });
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') inp.dispatchEvent(new Event('change')); });
      return h('label', { class: 'sb-field' }, h('span', { html: label }), inp);
    };
    const preset = h('select', { title: 'Sistemas de exemplo' }, h('option', { value: '' }, 'Exemplos…'), ...CS.PRESETS.map((p, i) => h('option', { value: i }, p.name)));
    preset.addEventListener('change', () => { const p = CS.PRESETS[+preset.value]; if (p) CS.setSys({ ...p }); preset.value = ''; });
    bar.append(...[
      h('div', { class: 'sb-diagram', html: loopSVG(), title: 'Malha de controle considerada: realimentação negativa' }),
      mk('G', 'G(s) =', '210px', 'Planta (processo). Ex.: 10(s+1)/(s(s+2))'),
      opts.noH ? null : mk('H', 'H(s) =', '110px', 'Realimentação (sensor). Use 1 para realimentação unitária.'),
      opts.noK ? null : mk('K', 'K =', '62px', 'Ganho proporcional do controlador'),
      preset,
      h('button', { class: 'btn sm', title: 'Obter G(s) do esquemático da aba Simulação', onclick: () => CS.openTool('model', 'sch') }, '⇄ do esquemático'),
    ].filter(Boolean));
    const pretty = h('div', { class: 'sb-pretty' });
    const upd = () => {
      try {
        const s = CS.sys();
        pretty.innerHTML = `${CS.ratHTML(s.G, 'G(s)')}${st.H !== '1' && !opts.noH ? '&emsp;' + CS.ratHTML(s.H, 'H(s)') : ''}${opts.noK ? '' : `&emsp;<span class="tf-name">K</span> = ${CS.fmtNum(s.K)}`}`;
      } catch (e) { pretty.innerHTML = `<span class="err">${e.message}</span>`; }
    };
    upd();
    host.append(bar, pretty);
    const fn = () => { for (const [k, inp] of Object.entries(inputs)) { inp.value = st[k]; inp.classList.remove('bad'); } upd(); };
    CS.onChange(fn);
    return () => CS.offChange(fn);
  };
  function loopSVG() {
    return `<svg viewBox="0 0 150 46" width="150" height="46"><g fill="none" stroke="currentColor" stroke-width="1.2">
      <path d="M2 14h14"/><circle cx="20" cy="14" r="4"/><path d="M24 14h12"/><rect x="36" y="7" width="22" height="14" rx="2"/>
      <path d="M58 14h12"/><rect x="70" y="7" width="26" height="14" rx="2"/><path d="M96 14h30"/>
      <path d="M112 14v22h-30"/><rect x="58" y="29" width="24" height="14" rx="2"/><path d="M58 36H20v-18"/></g>
      <g fill="currentColor" font-size="8" font-family="Barlow"><text x="42" y="17">K</text><text x="76" y="17">G(s)</text><text x="62" y="39">H(s)</text>
      <text x="128" y="12">Y</text><text x="0" y="11">R</text><text x="22" y="26">−</text></g>
      <path d="M126 14l-4-2.5v5z M36 14l-4-2.5v5z" fill="currentColor"/></svg>`;
  }

  /* ───────── página padrão de ferramenta ───────── */
  CS.page = function (host, { title, lead, learn }) {
    host.innerHTML = '';
    const learnBox = h('aside', { class: 'learn' }, h('div', { class: 'learn-head' }, '📘 Entenda', h('button', { class: 'btn icon sm', onclick: () => wrap.classList.remove('learn-open') }, '✕')), h('div', { class: 'learn-body', html: learn || '' }));
    const head = h('div', { class: 'tool-head' },
      h('div', {}, h('h2', {}, title), lead ? h('p', { class: 'lead', html: lead }) : null),
      learn ? h('button', { class: 'btn learn-btn', onclick: () => wrap.classList.toggle('learn-open') }, '📘 Entenda') : null);
    const body = h('div', { class: 'tool-body' });
    const main = h('div', { class: 'tool-main' }, head, body);
    const wrap = h('div', { class: 'tool-wrap' + (CS.learnPinned ? ' learn-open' : '') }, main, learnBox);
    host.append(wrap);
    return { body, wrap };
  };
  CS.card = (title, ...kids) => h('div', { class: 'card' }, title ? h('div', { class: 'card-title', html: title }) : null, ...kids);
  CS.kv = rows => h('div', { class: 'kv' }, ...rows.filter(Boolean).map(([k, v, tip]) => h('div', { class: 'kv-row', title: tip || '' }, h('span', { class: 'k', html: k }), h('span', { class: 'v', html: v }))));
  CS.tip = (txt) => h('span', { class: 'tip', title: txt }, 'ⓘ');
  CS.chartBox = (cls = '') => h('div', { class: 'chart-box ' + cls });

  /* ───────── abas e ferramentas ───────── */
  CS.TABS = {};
  CS.registerTab = (id, def) => { CS.TABS[id] = def; };
  CS.current = {};
  CS.openTool = (tabId, toolId) => {
    const mv = document.getElementById('tab-' + tabId).closest('.tabview');
    MS.app.setTab(mv.id.slice(4)); MS.app.setSub(tabId);
    CS.renderTab(tabId, toolId);
  };
  CS.renderTab = (tabId, toolId) => {
    const def = CS.TABS[tabId]; if (!def) return;
    const host = document.getElementById('tab-' + tabId);
    toolId = toolId || CS.current[tabId] || def.tools[0].id;
    CS.current[tabId] = toolId;
    if (!host.querySelector('.subnav')) {
      host.innerHTML = '';
      const nav = h('nav', { class: 'subnav' }, h('div', { class: 'subnav-title' }, def.title));
      for (const t of def.tools) nav.append(h('button', { class: 'sub-item', 'data-tool': t.id, onclick: () => CS.renderTab(tabId, t.id) }, h('b', {}, t.label), h('small', {}, t.desc)));
      host.append(nav, h('div', { class: 'tool-host' }));
    }
    host.querySelectorAll('.sub-item').forEach(b => b.classList.toggle('on', b.dataset.tool === toolId));
    const th = host.querySelector('.tool-host');
    if (th._cleanup) th._cleanup.forEach(f => f());
    th._cleanup = [];
    const tool = def.tools.find(t => t.id === toolId);
    try { tool.render(th, f => th._cleanup.push(f)); }
    catch (e) { th.innerHTML = `<div class="err pad">Erro: ${e.message}</div>`; console.error(e); }
  };

  /* utilidades numéricas comuns */
  CS.logspace = (a, b, n) => { const out = [], la = Math.log10(a), lb = Math.log10(b); for (let i = 0; i < n; i++) out.push(Math.pow(10, la + (lb - la) * i / (n - 1))); return out; };
  CS.freqRange = function (rat) {
    const rs = [...CS.poly.roots(rat.num), ...CS.poly.roots(rat.den)].map(CS.cx.abs).filter(v => v > 1e-9);
    if (!rs.length) return [1e-2, 1e2];
    return [Math.pow(10, Math.floor(Math.log10(Math.min(...rs))) - 2), Math.pow(10, Math.ceil(Math.log10(Math.max(...rs))) + 2)];
  };
  CS.polesStable = poles => poles.every(p => p.re < -1e-9);
  CS.stableText = poles => {
    const rhp = poles.filter(p => p.re > 1e-9).length, jw = poles.filter(p => Math.abs(p.re) <= 1e-9).length;
    if (rhp) return `<b class="bad">Instável</b> — ${rhp} polo(s) no semiplano direito`;
    if (jw) return `<b class="warn">Marginalmente estável</b> — ${jw} polo(s) sobre o eixo jω`;
    return '<b class="good">Estável</b> — todos os polos no semiplano esquerdo';
  };
})();
