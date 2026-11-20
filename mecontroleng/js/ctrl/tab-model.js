/* ============================================================
   MeControlEng — Aba "Modelagem matemática"
   Função de transferência · Laplace · Blocos & fluxo de sinal ·
   Espaço de estados · Do esquemático
   ============================================================ */
'use strict';
(function () {
  const CS = MS.CS, h = CS.h, P = CS.poly, R = CS.rat, cx = CS.cx;
  const COL = { a: '#4fb3ff', b: '#ff9f1c', c: '#3ddc84', d: '#c77dff', r: '#ff4d6d', y: '#ffd166' };

  /* ───────── componentes de visualização reutilizáveis ───────── */
  CS.pzChart = function (host, rat, opts = {}) {
    const ch = new MS.Chart(host, { equal: true, xlabel: 'Re(s)', ylabel: 'Im(s)', includeOrigin: true, pad: 0.25,
      readout: (x, y) => `s = ${CS.fmtC({ re: x, im: y }, 3)}` });
    const { z, p } = R.zpk(rat);
    ch.set({
      regions: [{ x0: 0, x1: Infinity, y0: -Infinity, y1: Infinity, color: 'rgba(255,77,109,0.07)' }],
      markers: [...p.map(q => ({ x: q.re, y: q.im, shape: 'x', color: COL.r, size: 6 })), ...z.map(q => ({ x: q.re, y: q.im, shape: 'o', color: COL.a, size: 6 })), ...(opts.extra || [])],
      texts: [{ x: 0, y: 0, text: 'instável →', dx: 6, dy: -6, color: 'rgba(255,77,109,0.6)' }],
    });
    return ch;
  };
  CS.respChart = function (host, rat, kind = 'step', opts = {}) {
    const ch = new MS.Chart(host, { xlabel: 't [s]', ylabel: opts.ylabel || 'y(t)', readout: (t, y) => `t = ${CS.fmtNum(t)} s\ny = ${CS.fmtNum(y)}` });
    const upd = (r, k, tEnd) => {
      let resp;
      try { resp = CS.response(r, k, tEnd); } catch (e) { ch.set({ texts: [{ x: 0, y: 0, text: e.message, color: COL.r }] }); return null; }
      const data = { series: [{ x: resp.t, y: resp.y, color: opts.color || COL.a, width: 2 }], hlines: [], vlines: [], markers: [] };
      if (k === 'step') data.series.unshift({ x: [0, resp.t[resp.t.length - 1]], y: [1, 1], color: 'rgba(255,255,255,0.25)', dash: [4, 4], width: 1, noFit: false });
      if (k === 'ramp') data.series.unshift({ x: resp.t, y: resp.t, color: 'rgba(255,255,255,0.25)', dash: [4, 4], width: 1, noFit: true });
      let info = null;
      if (k === 'step') {
        info = CS.stepInfo(r, resp);
        if (info.stable && isFinite(info.yf)) {
          data.hlines.push({ y: info.yf, color: 'rgba(61,220,132,0.6)', label: 'regime' });
          if (info.Mp > 0.1) data.markers.push({ x: info.tp, y: info.yf * (1 + info.Mp / 100), shape: 'dot', color: COL.y, label: `Mp ${CS.fmtNum(info.Mp, 3)}%` });
          if (info.ts) data.vlines.push({ x: info.ts, color: 'rgba(199,125,255,0.6)', label: 'ts (2%)' });
        }
      }
      ch.set(data);
      return info;
    };
    return { ch, upd };
  };
  const metricsKV = (r, info) => {
    const dom = CS.dominant(r);
    return CS.kv([
      ['Estabilidade', CS.stableText(P.roots(r.den))],
      ['Ganho DC', CS.fmtNum(R.dcGain(r)), 'G(0): valor de regime para entrada degrau unitário'],
      dom && dom.kind === 2 ? ['ζ, ω<sub>n</sub> (dominantes)', `${CS.fmtNum(dom.zeta, 3)}, ${CS.fmtNum(dom.wn, 3)} rad/s`, 'Amortecimento e frequência natural do par de polos mais lento'] : null,
      dom && dom.kind === 1 ? ['τ (dominante)', `${CS.fmtNum(dom.tau, 3)} s`, 'Constante de tempo do polo real mais lento'] : null,
      info && info.stable && isFinite(info.tr) ? ['Tempo de subida (10–90%)', CS.fmtNum(info.tr, 3) + ' s'] : null,
      info && info.stable ? ['Sobressinal M<sub>p</sub>', CS.fmtNum(info.Mp || 0, 3) + ' %'] : null,
      info && info.stable && info.Mp > 0.05 ? ['Tempo de pico', CS.fmtNum(info.tp, 3) + ' s'] : null,
      info && info.stable ? ['Acomodação (2%)', CS.fmtNum(info.ts, 3) + ' s'] : null,
    ]);
  };
  const tfInput = (value, onOk, ph = 'ex.: 10(s+1)/(s(s+2)(s+5))') => {
    const inp = h('input', { class: 'tf-input', value, spellcheck: 'false', placeholder: ph });
    const err = h('span', { class: 'err small' });
    const go = () => { try { const r = CS.parse(inp.value); inp.classList.remove('bad'); err.textContent = ''; onOk(r, inp.value.trim()); } catch (e) { inp.classList.add('bad'); err.textContent = e.message; } };
    inp.addEventListener('change', go); inp.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
    return { el: h('div', { class: 'tf-input-row' }, inp, err), go, inp };
  };

  /* ───────── 1. Função de transferência ───────── */
  const toolTF = (host, onClean) => {
    const { body } = CS.page(host, {
      title: 'Função de transferência', lead: 'G(s) = Y(s)/U(s) com condições iniciais nulas. Digite a expressão em <code>s</code>; o resto é calculado.',
      learn: `<p><b>O que é.</b> A razão entre a transformada de Laplace da saída e a da entrada de um sistema <i>linear e invariante no tempo</i>, com condições iniciais nulas.</p>
      <p><b>Polos</b> (×): raízes do denominador. Definem os modos naturais e<sup>pt</sup>: a parte real dá o decaimento, a imaginária dá a oscilação.<br><b>Zeros</b> (○): raízes do numerador. Alteram o "peso" de cada modo, mas não a estabilidade.</p>
      <p><b>Estável</b> ⇔ todos os polos com Re &lt; 0 (semiplano esquerdo).</p>
      <p><b>Tipo</b> = nº de polos na origem (integradores). Define o erro em regime: tipo 0 tem erro finito ao degrau; tipo 1 tem erro nulo ao degrau.</p>
      <p><b>2ª ordem padrão:</b> G = ω<sub>n</sub>²/(s² + 2ζω<sub>n</sub>s + ω<sub>n</sub>²)<br>M<sub>p</sub> = e<sup>−ζπ/√(1−ζ²)</sup> · t<sub>s</sub>(2%) ≈ 4/(ζω<sub>n</sub>) · t<sub>p</sub> = π/ω<sub>d</sub></p>
      <p><b>Polos dominantes:</b> os mais próximos do eixo jω. Como são os mais lentos, dominam a resposta; polos ≥ 5× mais distantes podem ser desprezados (simplificação usual).</p>`,
    });
    let cur = { expr: CS.state.G };
    const top = h('div', { class: 'row gap' });
    const ti = tfInput(cur.expr, (r, e) => { cur.expr = e; render(); });
    const useBtn = h('button', { class: 'btn sm', title: 'Copiar para a barra do sistema (abas Estabilidade/Frequência)', onclick: () => CS.setSys({ G: cur.expr }) }, '→ usar como G(s) do sistema');
    const fromBtn = h('button', { class: 'btn sm', onclick: () => { ti.inp.value = CS.state.G; ti.go(); } }, '← G(s) do sistema');
    top.append(h('label', { class: 'lbl' }, 'G(s) ='), ti.el, fromBtn, useBtn);
    const forms = h('div', { class: 'forms' });
    const kindSel = h('div', { class: 'seg' }, ...[['step', 'Degrau'], ['impulse', 'Impulso'], ['ramp', 'Rampa']].map(([k, l]) => h('button', { 'data-k': k, onclick: () => { kind = k; render(); } }, l)));
    let kind = 'step';
    const pzBox = CS.chartBox('sq'), rBox = CS.chartBox();
    const info = h('div');
    body.append(CS.card(null, top, forms),
      h('div', { class: 'grid2' },
        CS.card('Mapa de polos e zeros ' + '<span class="muted small">× polo · ○ zero · área vermelha = instável</span>', pzBox),
        CS.card('Resposta no tempo', kindSel, rBox)),
      CS.card('Características', info));
    let pz = null; const rc = CS.respChart(rBox, R.one());
    const render = () => {
      let r; try { r = CS.parse(cur.expr); } catch (e) { return; }
      const zpk = R.zpk(r);
      forms.innerHTML = '';
      forms.append(
        h('div', { class: 'form-item' }, h('small', {}, 'polinomial'), h('div', { class: 'math', html: CS.ratHTML(r) })),
        h('div', { class: 'form-item' }, h('small', {}, 'fatorada (zpk)'), h('div', { class: 'math', html: CS.factorHTML(r) })),
        h('div', { class: 'form-item' }, h('small', {}, 'polos'), h('div', { class: 'mono', html: zpk.p.map(q => CS.fmtC(q)).join('<br>') || '—' })),
        h('div', { class: 'form-item' }, h('small', {}, 'zeros'), h('div', { class: 'mono', html: zpk.z.map(q => CS.fmtC(q)).join('<br>') || '—' })),
        h('div', { class: 'form-item' }, h('small', {}, 'ordem · tipo'), h('div', { class: 'mono' }, `${P.deg(r.den)} · ${R.type(r)}`)),
      );
      kindSel.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.k === kind));
      pzBox.innerHTML = ''; pz = CS.pzChart(pzBox, r);
      const inf = rc.upd(r, kind);
      info.innerHTML = ''; info.append(metricsKV(r, kind === 'step' ? inf : CS.stepInfo(r, CS.response(r, 'step'))));
    };
    render();
    void onClean; void pz;
  };

  /* ───────── 2. Laplace ───────── */
  const PAIRS = [
    ['δ(t) — impulso', '1'], ['u(t) — degrau', '1/s'], ['t — rampa', '1/s²'], ['tⁿ', 'n!/sⁿ⁺¹'],
    ['e<sup>−at</sup>', '1/(s+a)'], ['t·e<sup>−at</sup>', '1/(s+a)²'], ['sen(ωt)', 'ω/(s²+ω²)'], ['cos(ωt)', 's/(s²+ω²)'],
    ['e<sup>−at</sup>sen(ωt)', 'ω/((s+a)²+ω²)'], ['e<sup>−at</sup>cos(ωt)', '(s+a)/((s+a)²+ω²)'],
  ];
  const PROPS = [
    ['Linearidade', 'a·f + b·g ⟷ a·F + b·G'], ['Derivada', 'f′(t) ⟷ sF(s) − f(0)'], ['Integral', '∫₀ᵗ f dτ ⟷ F(s)/s'],
    ['Atraso', 'f(t−T)u(t−T) ⟷ e<sup>−sT</sup>F(s)'], ['Deslocamento em s', 'e<sup>−at</sup>f(t) ⟷ F(s+a)'], ['Convolução', 'f ∗ g ⟷ F·G'],
    ['Valor inicial', 'f(0⁺) = lim<sub>s→∞</sub> sF(s)'], ['Valor final', 'f(∞) = lim<sub>s→0</sub> sF(s) (se sF(s) for estável)'],
  ];
  const toolLaplace = (host) => {
    const { body } = CS.page(host, {
      title: 'Transformada de Laplace', lead: 'Transforma equações diferenciais em equações algébricas em <code>s</code>. Aqui: tabela de referência e transformada inversa por frações parciais.',
      learn: `<p><b>Definição:</b> F(s) = ∫₀<sup>∞</sup> f(t)e<sup>−st</sup> dt, com s = σ + jω.</p>
      <p><b>Por que usar:</b> derivar vira multiplicar por s e integrar vira dividir por s. Uma EDO linear com condições iniciais nulas vira uma razão de polinômios: a função de transferência.</p>
      <p><b>Exemplo:</b> massa-mola-amortecedor m·ẍ + b·ẋ + k·x = F ⟶ (ms² + bs + k)X(s) = F(s) ⟶ X/F = 1/(ms² + bs + k).</p>
      <p><b>Inversa por frações parciais:</b> decompomos F(s) = Σ A<sub>i</sub>/(s − p<sub>i</sub>) e cada termo volta para A<sub>i</sub>e<sup>p<sub>i</sub>t</sup> pela tabela. Os resíduos são A<sub>i</sub> = lim (s − p<sub>i</sub>)F(s). Polos complexos conjugados se juntam em senos e cossenos amortecidos; polos repetidos geram termos t<sup>k</sup>e<sup>pt</sup>.</p>`,
    });
    const tbl = h('table', { class: 'tbl' }, h('tr', {}, h('th', {}, 'f(t), t ≥ 0'), h('th', {}, 'F(s)')), ...PAIRS.map(([a, b]) => h('tr', {}, h('td', { html: a }), h('td', { html: b }))));
    const tbl2 = h('table', { class: 'tbl' }, h('tr', {}, h('th', {}, 'Propriedade'), h('th', {}, '')), ...PROPS.map(([a, b]) => h('tr', {}, h('td', {}, a), h('td', { html: b }))));
    const out = h('div'), fBox = CS.chartBox();
    const ti = tfInput('(s+3)/(s(s+1)(s+2))', r => run(r), 'F(s), ex.: (s+3)/(s(s+1)(s+2))');
    const ch = new MS.Chart(fBox, { xlabel: 't [s]', ylabel: 'f(t)', readout: (t, y) => `t = ${CS.fmtNum(t)}\nf = ${CS.fmtNum(y)}` });
    const run = r => {
      out.innerHTML = '';
      let pf;
      try { pf = CS.partialFractions(r); } catch (e) { out.textContent = e.message; return; }
      const rows = pf.terms.map(t => h('tr', {}, h('td', { class: 'mono' }, CS.fmtC(t.p)), h('td', { class: 'mono' }, t.j > 1 ? `(s − p)<sup>${t.j}</sup>` : 's − p'), h('td', { class: 'mono' }, CS.fmtC(t.A))));
      rows.forEach(rw => { rw.children[1].innerHTML = rw.children[1].textContent.replace(/\((.*)\)(\d)/, '($1)<sup>$2</sup>'); });
      const sr = R.simplify(r);
      const fin = (() => { const sF = R.mul(sr, R.make([0, 1])); const pp = P.roots(R.simplify(sF).den); if (!pp.every(q => q.re < -1e-9)) return 'não se aplica (sF(s) tem polos fora do SPE)'; return CS.fmtNum(R.dcGain(R.simplify(sF))); })();
      out.append(
        h('div', { class: 'math big', html: 'f(t) = ' + CS.inverseText(pf) }),
        h('table', { class: 'tbl' }, h('tr', {}, h('th', {}, 'polo p'), h('th', {}, 'termo'), h('th', {}, 'resíduo A')), ...rows),
        CS.kv([['Valor final f(∞)', fin, 'Teorema do valor final'], ['Valor inicial f(0⁺)', P.deg(sr.num) < P.deg(sr.den) - 1 ? '0' : P.deg(sr.num) === P.deg(sr.den) - 1 ? CS.fmtNum(P.lead(sr.num) / P.lead(sr.den)) : '∞ (impulso)', 'Teorema do valor inicial']]),
      );
      if (P.deg(sr.num) < P.deg(sr.den)) { const resp = CS.response(sr, 'impulse'); ch.set({ series: [{ x: resp.t, y: resp.y, color: COL.c, width: 2 }] }); }
      else ch.set({ texts: [{ x: 0, y: 0, text: 'F(s) imprópria: f(t) contém impulsos', color: COL.r }] });
    };
    body.append(
      h('div', { class: 'grid2' },
        CS.card('Inversa por frações parciais', h('div', { class: 'row gap' }, h('label', { class: 'lbl' }, 'F(s) ='), ti.el), out),
        CS.card('f(t) — calculada', fBox)),
      h('details', { class: 'card' }, h('summary', { class: 'card-title' }, 'Tabela de transformadas e propriedades'), h('div', { class: 'grid2' }, tbl, tbl2)),
    );
    ti.go();
  };

  /* ───────── 3. Diagramas de blocos & fluxo de sinal ───────── */
  const toolBlocks = (host) => {
    const { body } = CS.page(host, {
      title: 'Diagrama de blocos & grafo de fluxo de sinal', lead: 'Monte o diagrama. Ele é convertido automaticamente em grafo de fluxo de sinal e resolvido pela <b>regra de Mason</b>.',
      learn: `<p><b>Diagrama de blocos:</b> cada bloco multiplica seu sinal de entrada por G(s); o somador soma (+) ou subtrai (−) sinais; um ponto de ramificação copia o sinal.</p>
      <p><b>Regras de redução:</b></p><ul>
      <li>Série: G₁ → G₂ = G₁·G₂</li><li>Paralelo: G₁ + G₂</li>
      <li>Realimentação negativa: G/(1 + G·H)</li><li>Mover um somador para antes de G: divida o ramo por G. Para depois: multiplique por G.</li></ul>
      <p><b>Grafo de fluxo de sinal:</b> os <i>nós</i> são sinais e os <i>ramos</i> são ganhos. É a mesma informação, mais compacta.</p>
      <p><b>Mason:</b> T = Σ P<sub>k</sub>Δ<sub>k</sub> / Δ, com Δ = 1 − ΣL<sub>i</sub> + ΣL<sub>i</sub>L<sub>j</sub> − … (produtos só de laços que <i>não se tocam</i>). Δ<sub>k</sub> é o Δ calculado só com os laços que não tocam o caminho P<sub>k</sub>.</p>
      <p><b>Como usar o editor:</b> arraste da bolinha azul de saída de um bloco até a entrada de outro. Duplo-clique edita o bloco, <kbd>F</kbd> inverte o sentido e <kbd>Del</kbd> apaga.</p>`,
    });
    const tb = h('div', { class: 'row gap wrap' });
    const seg = h('div', { class: 'seg' }, h('button', { class: 'on', 'data-m': 'blocks' }, 'Diagrama de blocos'), h('button', { 'data-m': 'sfg' }, 'Fluxo de sinal'));
    const pre = h('select', {}, h('option', { value: '' }, 'Exemplos…'), ...Object.entries(CS.BD_PRESETS).map(([k, p]) => h('option', { value: k }, p.name)));
    const edHost = h('div', { class: 'bd-host' });
    const props = h('div', { class: 'bd-props' });
    const result = h('div', { class: 'bd-result' });
    body.append(CS.card(null, tb, h('div', { class: 'bd-layout' }, edHost, props)), CS.card('Resultado (regra de Mason)', result));
    const ed = new CS.BlockEditor(edHost, () => { solve(); });
    tb.append(seg,
      h('button', { class: 'btn sm', onclick: () => ed.addBlock('tf') }, '+ Bloco G(s)'),
      h('button', { class: 'btn sm', onclick: () => ed.addBlock('sum') }, '+ Somador'),
      h('button', { class: 'btn sm', onclick: () => { if (!CS.bd.blocks.some(b => b.t === 'in')) ed.addBlock('in'); } }, '+ Entrada'),
      h('button', { class: 'btn sm', onclick: () => { if (!CS.bd.blocks.some(b => b.t === 'out')) ed.addBlock('out'); } }, '+ Saída'),
      pre, h('button', { class: 'btn sm', onclick: () => ed.fit() }, 'Enquadrar'),
      h('span', { class: 'muted small' }, 'arraste da saída (●) para a entrada (○) · duplo-clique edita · F inverte · Del apaga'));
    seg.addEventListener('click', e => { const m = e.target.dataset.m; if (!m) return; ed.mode = m; seg.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.m === m)); ed.highlight = null; ed.draw(); });
    pre.addEventListener('change', () => { if (!pre.value) return; CS.bd = CS.bdFromPreset(pre.value); CS.bdSave(); pre.value = ''; ed.sel = null; renderProps(null); ed.fit(); solve(); });
    const renderProps = b => {
      props.innerHTML = '';
      if (!b || !b.t) { props.append(h('div', { class: 'muted small' }, 'Selecione um bloco para editar.')); return; }
      if (b.t === 'tf') {
        const nm = h('input', { value: b.name }), ex = h('input', { value: b.expr, class: 'mono' });
        nm.addEventListener('change', () => { b.name = nm.value.trim() || b.name; ed.changed(); });
        ex.addEventListener('change', () => { try { CS.parse(ex.value); b.expr = ex.value.trim(); ex.classList.remove('bad'); ed.changed(); } catch (e) { ex.classList.add('bad'); ex.title = e.message; } });
        props.append(h('label', { class: 'prop' }, h('span', {}, 'Nome'), nm), h('label', { class: 'prop' }, h('span', {}, 'G(s)'), ex));
        ed.onEdit = () => ex.focus();
      } else if (b.t === 'sum') {
        ['esquerda', 'baixo', 'cima'].forEach((pn, i) => {
          const s = h('select', {}, h('option', { value: '+' }, '+'), h('option', { value: '-' }, '−'));
          s.value = (b.signs || [])[i] || '+';
          s.addEventListener('change', () => { b.signs[i] = s.value; ed.changed(); });
          props.append(h('label', { class: 'prop' }, h('span', {}, 'Sinal — entrada ' + pn), s));
        });
      } else props.append(h('div', { class: 'muted small' }, b.t === 'in' ? 'Entrada de referência R(s)' : 'Saída Y(s)'));
      if (b.t === 'tf' || b.t === 'sum') props.append(h('button', { class: 'btn sm', onclick: () => { b.flip = !b.flip; ed.changed(); } }, '⇄ Inverter sentido'));
      props.append(h('button', { class: 'btn sm danger', onclick: () => ed.remove(b) }, '✕ Excluir'));
    };
    ed.onSelect = renderProps; renderProps(null);
    const solve = () => {
      result.innerHTML = '';
      let sfg, m;
      try { sfg = CS.bdToSFG(CS.bd); m = CS.mason(sfg); } catch (e) { result.append(h('div', { class: 'err' }, e.message)); return; }
      const hlBtn = (label, edges, color) => h('button', { class: 'chip', onmouseenter: () => { if (ed.mode !== 'sfg') return; ed.highlight = { edges: new Set(edges), color }; ed.draw(); }, onmouseleave: () => { ed.highlight = null; ed.draw(); } }, label);
      const tf = CS.parse('1'); void tf;
      const list = (title, items) => h('div', { class: 'mason-col' }, h('div', { class: 'k' }, title), ...(items.length ? items : [h('span', { class: 'muted' }, 'nenhum')]));
      result.append(
        h('div', { class: 'mason' },
          list('Caminhos diretos', m.paths.map(p => hlBtn(`${p.name} = ${p.label}`, p.edges, '#3ddc84'))),
          list('Laços', m.loops.map(l => hlBtn(`${l.name} = ${l.label}`, l.edges, '#ff9f1c'))),
          list('Laços que não se tocam', m.pairs.map(t => h('span', { class: 'chip' }, t))),
          list('Determinantes', [h('div', { class: 'mono' }, 'Δ = ' + m.deltaText), ...m.paths.map((p, i) => h('div', { class: 'mono' }, `Δ${i + 1} = ${m.pathDeltaText[i]}`))])),
        h('div', { class: 'row gap center' }, h('div', { class: 'math big', html: CS.ratHTML(m.T, 'T(s) = Y/R') }),
          h('button', { class: 'btn sm', onclick: () => { CS.setSys({ G: CS.polyText(m.T.num).replace(/−/g, '-') === '0' ? '0' : `(${CS.polyText(m.T.num).replace(/−/g, '-')})/(${CS.polyText(m.T.den).replace(/−/g, '-')})`, H: '1', K: '1', name: 'Do diagrama de blocos' }); } }, '→ usar T(s) como G(s) do sistema')),
        h('div', { class: 'muted small' }, 'Na vista "Fluxo de sinal", passe o mouse sobre um caminho ou laço para destacá-lo.'),
      );
    };
    solve();
  };

  /* ───────── 4. Espaço de estados ───────── */
  const toolSS = (host) => {
    const { body } = CS.page(host, {
      title: 'Espaço de estados', lead: 'ẋ = A·x + B·u &nbsp;·&nbsp; y = C·x + D·u. Converta de/para G(s) e verifique controlabilidade e observabilidade.',
      learn: `<p><b>Estado</b> é o menor conjunto de variáveis (x) que, junto com a entrada, determina todo o futuro do sistema. Em sistemas físicos, os estados naturais são as variáveis dos elementos que armazenam energia: tensão no capacitor, corrente no indutor, velocidade da massa, força na mola.</p>
      <p><b>De EE para G(s):</b> G(s) = C(sI − A)<sup>−1</sup>B + D. Os <b>autovalores de A</b> são os polos.</p>
      <p><b>Formas canônicas:</b> a <i>controlável</i> (companheira) coloca os coeficientes do denominador na última linha de A; a <i>observável</i> é a transposta. Uma mesma G(s) tem infinitas realizações; elas diferem por uma mudança de base x = T·z.</p>
      <p><b>Controlabilidade:</b> posto[B AB … Aⁿ⁻¹B] = n (a entrada consegue levar o estado a qualquer valor). <b>Observabilidade:</b> posto[C; CA; …] = n (o estado pode ser deduzido da saída).</p>
      <p><b>Exemplo massa-mola-amortecedor:</b> x₁ = posição, x₂ = velocidade ⟶ A = [0 1; −k/m −b/m], B = [0; 1/m], C = [1 0].</p>`,
    });
    const tA = h('textarea', { rows: 4, spellcheck: 'false' }), tB = h('textarea', { rows: 4, spellcheck: 'false' }), tC = h('textarea', { rows: 2, spellcheck: 'false' }), tD = h('textarea', { rows: 1, spellcheck: 'false' });
    const set = s => { tA.value = s.A.map(r => r.map(v => CS.fmtNum(v, 6).replace('−', '-')).join(' ')).join('\n'); tB.value = s.B.map(r => CS.fmtNum(r[0], 6).replace('−', '-')).join('\n'); tC.value = s.C[0].map(v => CS.fmtNum(v, 6).replace('−', '-')).join(' '); tD.value = CS.fmtNum(s.D[0][0], 6).replace('−', '-'); };
    const out = h('div'), rBox = CS.chartBox();
    const rc = CS.respChart(rBox, R.one());
    const fromG = form => { try { set(CS.ss.fromTF(CS.parse(CS.state.G), form)); calc(); } catch (e) { out.innerHTML = `<div class="err">${e.message}</div>`; } };
    const calc = () => {
      out.innerHTML = '';
      try {
        const A = CS.mat.parse(tA.value), B = CS.mat.parse(tB.value), C = CS.mat.parse(tC.value), D = CS.mat.parse(tD.value || '0');
        const n = A.length;
        if (A[0].length !== n) throw new Error('A deve ser quadrada');
        if (B.length !== n || B[0].length !== 1) throw new Error('B deve ser n×1 (uma entrada)');
        if (C.length !== 1 || C[0].length !== n) throw new Error('C deve ser 1×n (uma saída)');
        const sys = { A, B, C, D, n };
        const G = CS.ss.toTF(sys);
        const eig = P.roots(G.den.length > 1 ? CS.ss.toTF({ A, B: B, C: [new Array(n).fill(0)], D: [[1]] }).den : [1]);
        const rc_ = CS.mat.rank(CS.ss.ctrb(A, B)), ro = CS.mat.rank(CS.ss.obsv(A, C));
        const Gs = R.simplify(G);
        out.append(
          h('div', { class: 'math big', html: CS.ratHTML(G, 'G(s)') }),
          CS.kv([
            ['Autovalores de A (polos)', eig.map(q => CS.fmtC(q)).join(', ')],
            ['Estabilidade', CS.stableText(eig)],
            ['Controlável?', rc_ === n ? `<b class="good">sim</b> (posto ${rc_} = n)` : `<b class="bad">não</b> (posto ${rc_} &lt; ${n})`],
            ['Observável?', ro === n ? `<b class="good">sim</b> (posto ${ro} = n)` : `<b class="bad">não</b> (posto ${ro} &lt; ${n})`],
            P.deg(Gs.den) < n ? ['Cancelamento', `<span class="warn">G(s) mínima tem ordem ${P.deg(Gs.den)} &lt; ${n}: há modos não controláveis ou não observáveis</span>`] : null,
          ]),
          h('button', { class: 'btn sm', onclick: () => CS.setSys({ G: `(${CS.polyText(G.num).replace(/−/g, '-')})/(${CS.polyText(G.den).replace(/−/g, '-')})`, name: '' }) }, '→ usar G(s) no sistema'));
        rc.upd(Gs, 'step');
      } catch (e) { out.append(h('div', { class: 'err' }, e.message)); }
    };
    [tA, tB, tC, tD].forEach(t => t.addEventListener('change', calc));
    body.append(
      h('div', { class: 'grid2' },
        CS.card('Matrizes <span class="muted small">(linhas separadas por Enter ou ;)</span>',
          h('div', { class: 'row gap wrap' }, h('button', { class: 'btn sm', onclick: () => fromG('ctrl') }, '← G(s) do sistema: forma controlável'), h('button', { class: 'btn sm', onclick: () => fromG('obs') }, 'forma observável'), h('button', { class: 'btn sm', onclick: calc }, 'Calcular')),
          h('div', { class: 'ss-grid' }, h('label', {}, 'A', tA), h('label', {}, 'B', tB), h('label', {}, 'C', tC), h('label', {}, 'D', tD))),
        CS.card('Resultado', out)),
      CS.card('Resposta ao degrau', rBox));
    set({ A: [[0, 1], [-100, -2]], B: [[0], [1]], C: [[1, 0]], D: [[0]] });
    calc();
  };

  /* ───────── 5. Do esquemático ───────── */
  const toolSch = (host) => {
    const { body } = CS.page(host, {
      title: 'Do esquemático para G(s)', lead: 'Escolha uma fonte (entrada) e um sinal (saída) do circuito da aba <b>Simulação</b>: a função de transferência é obtida direto do modelo físico.',
      learn: `<p><b>Como é calculado:</b> cada componente vira sua impedância (ou admitância) em s, pela analogia força-corrente:</p>
      <table class="tbl"><tr><th>Componente</th><th>Admitância</th></tr><tr><td>R / amortecedor b</td><td>1/R · b</td></tr><tr><td>C / massa m / inércia J</td><td>sC · sm · sJ</td></tr><tr><td>L / mola k</td><td>1/(sL) · k/s</td></tr></table>
      <p>Monta-se a matriz MNA A(s)·X = b·U e G(s) = Y/U por regra de Cramer. O determinante det A(s) é o <b>polinômio característico</b> do circuito.</p>
      <p><b>Simplificações aplicadas</b> (necessárias para haver uma G(s)): o sistema é linearizado (diodo e chaves no ponto de operação, PID sem saturação), as demais fontes são zeradas (superposição) e as condições iniciais são nulas. Subcircuitos que não se ligam à entrada são ignorados.</p>
      <p><b>Posição ⟷ velocidade:</b> x(s) = v(s)/s. Por isso a saída "posição" ganha um polo extra na origem.</p>`,
    });
    const doc = MS.app.doc;
    const ins = CS.schematicInputs(doc), outs = CS.schematicOutputs(doc);
    if (!ins.length) { body.append(CS.card(null, h('div', { class: 'muted' }, 'O esquemático atual não tem fontes independentes. Abra um exemplo na aba Simulação (ex.: "Motor DC + volante").'))); return; }
    const si = h('select', {}, ...ins.map(i => h('option', { value: i.id }, i.label)));
    const so = h('select', {}, ...outs.map(o => h('option', { value: o.id }, o.label)));
    const pref = outs.find(o => /^(p|n):(eixo|massa|out|volante)/.test(o.id)) || outs.find(o => o.id.startsWith('n:'));
    if (pref) so.value = pref.id;
    const out = h('div'), pzB = CS.chartBox('sq'), rB = CS.chartBox();
    const rc = CS.respChart(rB, R.one());
    let pz = null;
    const go = () => {
      out.innerHTML = ''; pzB.innerHTML = '';
      try {
        const { G, notes } = CS.fromSchematic(doc, si.value, so.value);
        const expr = `(${CS.polyText(G.num).replace(/−/g, '-')})/(${CS.polyText(G.den).replace(/−/g, '-')})`;
        out.append(
          h('div', { class: 'math big', html: CS.ratHTML(G, 'G(s)') }),
          h('div', { class: 'math', html: '= ' + CS.factorHTML(G) }),
          CS.kv([['Polos', R.zpk(G).p.map(q => CS.fmtC(q)).join(', ') || '—'], ['Zeros', R.zpk(G).z.map(q => CS.fmtC(q)).join(', ') || '—'], ['Ganho DC', CS.fmtNum(R.dcGain(G))], ['Estabilidade', CS.stableText(P.roots(G.den))]]),
          h('details', { class: 'notes' }, h('summary', {}, `Simplificações aplicadas (${notes.length})`), h('ul', {}, ...notes.map(n => h('li', {}, n)))),
          h('div', { class: 'row gap' },
            h('button', { class: 'btn sm', onclick: () => { CS.setSys({ G: expr, H: '1', K: '1', name: 'Do esquemático' }); MS.app.log && MS.app.log('G(s) do esquemático enviada às abas de controle.', 'ok'); } }, '→ usar como G(s) do sistema'),
            h('button', { class: 'btn sm', onclick: () => CS.openTool('freq', 'bode') }, 'Ver Bode'),
            h('button', { class: 'btn sm', onclick: () => CS.openTool('stab', 'rlocus') }, 'Ver lugar das raízes')));
        pz = CS.pzChart(pzB, G);
        rc.upd(G, 'step');
      } catch (e) { out.append(h('div', { class: 'err' }, e.message)); }
    };
    si.addEventListener('change', go); so.addEventListener('change', go);
    body.append(
      CS.card(`Circuito: <b>${doc.title || 'sem título'}</b>`, h('div', { class: 'row gap wrap' }, h('label', { class: 'lbl' }, 'Entrada U(s):'), si, h('label', { class: 'lbl' }, 'Saída Y(s):'), so)),
      h('div', { class: 'grid2' }, CS.card('Função de transferência', out), CS.card('Polos e zeros', pzB)),
      CS.card('Resposta ao degrau unitário da entrada (modelo linear)', rB));
    go(); void pz;
  };

  CS.registerTab('model', {
    title: 'Modelagem matemática',
    tools: [
      { id: 'tf', label: 'Função de transferência', desc: 'polos, zeros, respostas', render: toolTF },
      { id: 'laplace', label: 'Transformada de Laplace', desc: 'tabela e inversa', render: toolLaplace },
      { id: 'blocks', label: 'Blocos & fluxo de sinal', desc: 'editor + regra de Mason', render: toolBlocks },
      { id: 'ss', label: 'Espaço de estados', desc: 'A, B, C, D ⇄ G(s)', render: toolSS },
      { id: 'sch', label: 'Do esquemático', desc: 'circuito → G(s)', render: toolSch },
    ],
  });
})();
