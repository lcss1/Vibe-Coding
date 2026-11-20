/* ============================================================
   MeControlEng — Elétrica › Eletrônica de Potência
   Retificadores · Conversores CC-CC · Inversores (PWM) ·
   Semicondutores e perdas · Alta Tensão
   ============================================================ */
'use strict';
(function () {
  const CS = MS.CS, h = CS.h, K = MS.MK;
  const E = MS.EL = MS.EL || {};
  const TAU = 2 * Math.PI;

  /* harmônicos de um sinal com exatamente `cyc` períodos amostrados (N potência de 2) */
  E.harmonics = function (y, cyc, hmax = 60) {
    const sp = K.spectrum(y, 1), out = [0];
    for (let k = 1; k <= hmax; k++) out.push(sp.a[k * cyc] || 0);
    const dc = sp.a[0], thd = Math.sqrt(out.slice(2).reduce((s, a) => s + a * a, 0)) / (out[1] || 1e-12);
    return { h: out, dc, thd };
  };
  const stems = (hs, from = 1) => { const x = [], y = []; for (let k = from; k < hs.length; k++) { if (hs[k] < 1e-9) continue; x.push(k, k, NaN); y.push(0, hs[k], NaN); } return { x, y }; };
  const rms = a => Math.sqrt(a.reduce((s, v) => s + v * v, 0) / a.length);
  const mean = a => a.reduce((s, v) => s + v, 0) / a.length;

  /* ════════════════ 1. RETIFICADORES ════════════════ */
  E.rectify = function (o) {
    const N = 2048, cyc = 2, Vm = o.V * Math.SQRT2, al = o.alpha * Math.PI / 180;
    const th = [...Array(N)].map((_, i) => i / N * cyc * TAU);
    const vo = [], ia = [], vs = [];
    for (const t of th) {
      const ph = [0, -TAU / 3, TAU / 3].map(p => Vm * Math.sin(t + p)), phd = [0, -TAU / 3, TAU / 3].map(p => Math.sin(t - al + p));
      let v = 0, s = 0;
      if (o.tipo === 'm1') { const tm = ((t % TAU) + TAU) % TAU; const on = tm >= al && tm <= Math.PI; v = on ? ph[0] : 0; s = on ? 1 : 0; }
      else if (o.tipo === 'm2') { const sg = Math.sin(t - al) >= 0 ? 1 : -1; v = ph[0] * sg; s = sg; if (o.carga === 'R' && v < 0) { v = 0; s = 0; } }
      else {
        const top = phd.indexOf(Math.max(...phd)), bot = phd.indexOf(Math.min(...phd));
        v = ph[top] - ph[bot]; s = top === 0 ? 1 : bot === 0 ? -1 : 0;
        if (o.carga === 'R' && v < 0) { v = 0; s = 0; }
      }
      vo.push(v); vs.push(o.tipo === 'm6' ? ph[0] : ph[0]);
      ia.push(o.carga === 'R' ? s * Math.abs(v) / o.R : s);
    }
    const Vdc = mean(vo), Vrms = rms(vo);
    const Id = o.carga === 'R' ? Vdc / o.R : Vdc / o.R;
    const iin = o.carga === 'R' ? ia : ia.map(x => x * Id);
    const H = E.harmonics(iin, cyc, 40);
    const Is = rms(iin), I1 = H.h[1] / Math.SQRT2;
    const P = o.carga === 'R' ? Vrms * Vrms / o.R : Vdc * Id, S = (o.tipo === 'm6' ? 3 : 1) * o.V * Is;
    return { th, vo, vs, iin, Vdc, Vrms, Id, H, Is, I1, FP: P / S, ripple: Math.sqrt(Math.max(0, Vrms * Vrms - Vdc * Vdc)) / Math.abs(Vdc || 1e-9) };
  };
  const RET = { m1: 'Monofásico meia-onda', m2: 'Monofásico em ponte (onda completa)', m6: 'Trifásico em ponte (6 pulsos)' };
  const toolRet = (host) => {
    const { body } = CS.page(host, {
      title: 'Retificadores (não controlados e controlados)', lead: 'Formas de onda de saída e da corrente de entrada, tensão média, fator de potência e harmônicos para retificadores a diodo (α = 0°) e a tiristor (SCR, α > 0°).',
      learn: `<p><b>Retificador</b> converte CA em CC. Com <b>diodos</b> a saída é fixa; com <b>tiristores (SCR)</b> o disparo é atrasado de um ângulo α, o que controla a tensão média.</p>
      <p><b>Tensões médias</b> (V<sub>m</sub> = pico de fase, V<sub>LL</sub> = tensão de linha eficaz):</p>
      <ul><li>Meia-onda: V<sub>dc</sub> = V<sub>m</sub>(1+cos α)/2π</li><li>Ponte monofásica, carga R: V<sub>m</sub>(1+cos α)/π · carga altamente indutiva: 2V<sub>m</sub>cos α/π</li><li>Ponte trifásica (indutiva): V<sub>dc</sub> = 1,35·V<sub>LL</sub>·cos α. Com α &gt; 90° a tensão média fica negativa: o conversor opera como <b>inversor</b> (devolve energia à rede, base do HVDC).</li></ul>
      <p><b>Corrente de entrada:</b> não é senoidal. A ponte de 6 pulsos gera harmônicos de ordem h = 6k ± 1 (5ª, 7ª, 11ª, 13ª…), com amplitude ≈ I₁/h. Retificadores de 12 pulsos eliminam a 5ª e a 7ª.</p>
      <p><b>Fator de potência</b> = P/S = (I₁/I<sub>rms</sub>)·cos φ₁: diminui com α (deslocamento) e com os harmônicos (distorção).</p>
      <p class="muted">Modelo ideal: sem comutação (indutância da fonte nula). "Carga indutiva" = corrente CC perfeitamente lisa.</p>`,
    });
    const f = K.form([{ k: 'tipo', l: 'Topologia', type: 'sel', v: 'm6', opts: Object.entries(RET) }, { k: 'carga', l: 'Carga', type: 'sel', v: 'L', opts: [['R', 'resistiva'], ['L', 'altamente indutiva (I contínua)']] }, { k: 'V', l: 'Tensão eficaz (fase-neutro)', u: 'V', v: '127' }, { k: 'R', l: 'Resistência de carga', u: 'Ω', v: '10' }, { k: 'alpha', l: 'Ângulo de disparo α', u: '°', v: '30' }], () => run(), { cols: 2 });
    const out = h('div'), b1 = CS.chartBox(), b2 = CS.chartBox('sm'), b3 = CS.chartBox('sm'), b4 = CS.chartBox('sm');
    body.append(h('div', { class: 'grid2' }, h('div', { class: 'col' }, CS.card('Retificador', f.el), CS.card('Resultados', out), CS.card('V<sub>dc</sub> × α', b4)), h('div', { class: 'col' }, CS.card('Tensão de saída v<sub>o</sub> (e fase da rede)', b1), CS.card('Corrente na fase A da rede', b2), CS.card('Espectro da corrente de entrada (% de I₁)', b3))));
    const c1 = new MS.Chart(b1, { xlabel: 'ωt [°]', ylabel: 'V', readout: (x, y) => `${K.n(x)}°\n${K.n(y)} V` }), c2 = new MS.Chart(b2, { xlabel: 'ωt [°]', ylabel: 'A', readout: (x, y) => `${K.n(x)}°\n${K.n(y)} A` }), c3 = new MS.Chart(b3, { xlabel: 'ordem harmônica', ylabel: '%', includeOrigin: true, readout: (x, y) => `h = ${Math.round(x)}\n${K.n(y)} %` }), c4 = new MS.Chart(b4, { xlabel: 'α [°]', ylabel: 'Vdc [V]', readout: (x, y) => `α = ${K.n(x)}°\n${K.n(y)} V` });
    function run() {
      const o = { ...f.st }, r = E.rectify(o), deg = r.th.map(t => t * 180 / Math.PI);
      c1.set({ series: [{ x: deg, y: r.vs, color: 'rgba(159,180,208,0.5)', width: 1.2, name: 'fase A' }, { x: deg, y: r.vo, color: '#ffd166', width: 2.2, name: 'v_o' }], hlines: [{ y: r.Vdc, color: '#3ddc84', label: `Vdc = ${K.n(r.Vdc)} V` }] });
      c2.set({ series: [{ x: deg, y: r.iin, color: '#4fb3ff', width: 2, name: 'i_a' }] });
      const st = stems(r.H.h.map(a => a / (r.H.h[1] || 1) * 100));
      c3.set({ series: [{ x: st.x, y: st.y, color: '#ff9f1c', width: 4 }] });
      const as = K.linspace(0, 180, 61);
      c4.set({ series: [{ x: as, y: as.map(a => E.rectify({ ...o, alpha: a }).Vdc), color: '#3ddc84', width: 2 }], markers: [{ x: o.alpha, y: r.Vdc, shape: 'dot', color: '#ffd166', size: 6 }], hlines: [{ y: 0, color: 'rgba(159,180,208,0.4)' }] });
      out.innerHTML = '';
      out.append(CS.kv([['Tensão média V<sub>dc</sub>', `<b>${K.n(r.Vdc)} V</b>`], ['Tensão eficaz de saída', `${K.n(r.Vrms)} V`], ['Fator de ondulação', K.n(r.ripple, 3)], ['Corrente CC', `${K.n(r.Id)} A`], ['Corrente de entrada (rms) · I₁', `${K.n(r.Is)} A · ${K.n(r.I1)} A`], ['THD da corrente', `${K.n(r.H.thd * 100, 3)} %`], ['Fator de potência', K.n(r.FP, 3)], ['Modo', r.Vdc < -1e-6 ? '<b class="warn">inversor (α > 90°): energia volta para a rede</b>' : 'retificador']]));
    }
    run();
  };

  /* ════════════════ 2. CONVERSORES CC-CC ════════════════ */
  E.dcdc = function (o) {
    const T = 1 / o.f, n = 200, dt = T / n, D = o.D;
    let iL = 0, vC = 0;
    const tau = Math.max(o.R * o.C, Math.sqrt(o.L * o.C), o.L / o.R);
    const per = Math.min(3000, Math.max(60, Math.ceil(12 * tau / T)));
    const up = [], last = { t: [], iL: [], vo: [], sw: [] }, dec = Math.max(1, Math.floor(per * n / 1500));
    for (let k = 0; k < per * n; k++) {
      const t = k * dt, on = (k % n) < D * n;
      let vL, iC;
      if (o.top === 'buck') { vL = on ? o.Vin - vC : (iL > 0 ? -vC : 0); iC = iL - vC / o.R; }
      else if (o.top === 'boost') { if (on) { vL = o.Vin; iC = -vC / o.R; } else { vL = iL > 0 ? o.Vin - vC : 0; iC = (iL > 0 ? iL : 0) - vC / o.R; } }
      else { if (on) { vL = o.Vin; iC = -vC / o.R; } else { vL = iL > 0 ? -vC : 0; iC = (iL > 0 ? iL : 0) - vC / o.R; } }
      iL = Math.max(0, iL + vL / o.L * dt); vC += iC / o.C * dt;
      if (k % dec === 0) up.push([t, vC, iL]);
      if (k >= (per - 3) * n) { last.t.push((k - (per - 3) * n) * dt * 1e6); last.iL.push(iL); last.vo.push(vC); last.sw.push(on ? 1 : 0); }
    }
    const Vth = o.top === 'buck' ? D * o.Vin : o.top === 'boost' ? o.Vin / (1 - D) : o.Vin * D / (1 - D);
    const Lc = o.top === 'buck' ? (1 - D) * o.R / (2 * o.f) : o.top === 'boost' ? D * (1 - D) ** 2 * o.R / (2 * o.f) : (1 - D) ** 2 * o.R / (2 * o.f);
    const dV = o.top === 'buck' ? (1 - D) * Vth / (8 * o.L * o.C * o.f * o.f) : Vth * D / (o.R * o.C * o.f);
    const Vo = mean(last.vo), ILmin = Math.min(...last.iL), ILmax = Math.max(...last.iL);
    return { up, last, Vth, Lc, dV, Vo, ILmin, ILmax, dVsim: Math.max(...last.vo) - Math.min(...last.vo), dcm: ILmin < 1e-6 * Math.max(1e-9, ILmax) || o.L < Lc };
  };
  const toolDCDC = (host) => {
    const { body } = CS.page(host, {
      title: 'Conversores CC-CC chaveados', lead: 'Buck, boost e buck-boost simulados chave a chave: partida, corrente no indutor, ondulação da saída e modos contínuo (MCC) e descontínuo (MCD).',
      learn: `<p>Um conversor chaveado liga e desliga um transistor a uma frequência f com razão cíclica D (tempo ligado/período). O indutor e o capacitor filtram a energia e o rendimento passa de 90%, ao contrário de um regulador linear, que dissipa (V<sub>in</sub> − V<sub>o</sub>)·I.</p>
      <ul><li><b>Buck</b> (abaixador): V<sub>o</sub> = D·V<sub>in</sub></li><li><b>Boost</b> (elevador): V<sub>o</sub> = V<sub>in</sub>/(1 − D)</li><li><b>Buck-boost</b> (inversor de polaridade): |V<sub>o</sub>| = V<sub>in</sub>·D/(1 − D)</li></ul>
      <p><b>Balanço volt-segundo:</b> em regime, a tensão média no indutor é zero; daí saem as relações acima (no MCC).</p>
      <p><b>MCC × MCD:</b> se L &lt; L<sub>crítico</sub>, a corrente do indutor zera a cada ciclo (descontínuo) e V<sub>o</sub> passa a depender da carga.</p>
      <p><b>Ondulação:</b> buck ΔV/V = (1−D)/(8LCf²); boost e buck-boost ΔV ≈ V<sub>o</sub>·D/(RCf). Aumentar f reduz L e C (fontes menores), mas aumenta as perdas de chaveamento.</p>`,
    });
    const f = K.form([{ k: 'top', l: 'Topologia', type: 'sel', v: 'buck', opts: [['buck', 'Buck (abaixador)'], ['boost', 'Boost (elevador)'], ['bb', 'Buck-boost (inversor)']] }, { k: 'Vin', l: 'Tensão de entrada', u: 'V', v: '24' }, { k: 'D', l: 'Razão cíclica D', u: '', v: '0.5' }, { k: 'f', l: 'Frequência de chaveamento', u: 'Hz', v: '50k' }, { k: 'L', l: 'Indutância', u: 'H', v: '100u' }, { k: 'C', l: 'Capacitância', u: 'F', v: '47u' }, { k: 'R', l: 'Carga', u: 'Ω', v: '5' }], () => run(), { cols: 2 });
    const out = h('div'), b1 = CS.chartBox('sm'), b2 = CS.chartBox(), cvc = CS.card('Circuito');
    body.append(h('div', { class: 'grid2' }, h('div', { class: 'col' }, CS.card('Conversor', f.el), CS.card('Resultados', out), cvc), h('div', { class: 'col' }, CS.card('Partida: tensão de saída e corrente no indutor', b1), CS.card('Regime: 3 períodos (chave, i<sub>L</sub>, v<sub>o</sub>)', b2))));
    const c1 = new MS.Chart(b1, { xlabel: 't [ms]', ylabel: 'V · A', includeOrigin: true, readout: (x, y) => `${K.n(x)} ms\n${K.n(y)}` }), c2 = new MS.Chart(b2, { xlabel: 't [µs]', ylabel: 'A · V', readout: (x, y) => `${K.n(x)} µs\n${K.n(y)}` });
    const cv = K.canvas(cvc, 170, null);
    function run() {
      const o = { ...f.st }; o.D = Math.max(0.02, Math.min(0.95, o.D));
      const r = E.dcdc(o);
      c1.set({ series: [{ x: r.up.map(p => p[0] * 1e3), y: r.up.map(p => p[1]), color: '#ffd166', width: 2, name: 'v_o' }, { x: r.up.map(p => p[0] * 1e3), y: r.up.map(p => p[2]), color: '#4fb3ff', width: 1.2, name: 'i_L' }], hlines: [{ y: r.Vth, color: 'rgba(61,220,132,0.6)', label: 'ideal MCC' }] });
      const mxI = r.ILmax || 1;
      c2.set({ series: [{ x: r.last.t, y: r.last.sw.map(s => s * mxI * 0.3 - mxI * 0.45), color: '#c77dff', width: 1.5, name: 'chave' }, { x: r.last.t, y: r.last.iL, color: '#4fb3ff', width: 2, name: 'i_L [A]' }, { x: r.last.t, y: r.last.vo, color: '#ffd166', width: 2, name: 'v_o [V]' }] });
      out.innerHTML = '';
      out.append(CS.kv([['V<sub>o</sub> ideal (MCC)', `${K.n(r.Vth)} V`], ['V<sub>o</sub> simulada', `<b>${K.n(r.Vo)} V</b>`], ['Corrente de carga', `${K.n(r.Vo / o.R)} A`], ['i<sub>L</sub> mín. / máx.', `${K.n(r.ILmin)} / ${K.n(r.ILmax)} A`], ['L crítico', `${MS.fmt(r.Lc, 'H', 3)} → <b class="${r.dcm ? 'warn' : 'good'}">${r.dcm ? 'modo descontínuo' : 'modo contínuo'}</b>`], ['Ondulação ΔV<sub>o</sub>', `${MS.fmt(r.dVsim, 'V', 3)} (fórmula ${MS.fmt(r.dV, 'V', 3)})`], ['Esforço na chave', `V = ${K.n(o.top === 'buck' ? o.Vin : o.top === 'boost' ? r.Vo : o.Vin + r.Vo)} V · I<sub>pico</sub> = ${K.n(r.ILmax)} A`]]));
      cv.draw = (g, W, H) => {
        g.strokeStyle = '#9fb4d0'; g.lineWidth = 2; g.font = '12px Barlow'; g.fillStyle = '#c3d3e8'; g.textAlign = 'center';
        const y1 = 40, y2 = H - 30, x = [30, W * 0.3, W * 0.55, W * 0.75, W - 30];
        const line = (pts) => { g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); pts.slice(1).forEach(p => g.lineTo(p[0], p[1])); g.stroke(); };
        const lbl = (t, px, py, c = '#c3d3e8') => { g.fillStyle = c; g.fillText(t, px, py); };
        line([[x[0], y2], [x[4], y2]]); lbl('Vin', x[0], (y1 + y2) / 2 + 4, '#ff4d6d'); g.strokeRect(x[0] - 10, y1 + 25, 20, y2 - y1 - 50);
        const sw = (px, py, v) => { g.strokeStyle = '#c77dff'; line([[px - 15, py], [px - 5, py], [px + 8, py - 9]]); line([[px + 10, py], [px + 15, py]]); lbl('S', px, py - 12, '#c77dff'); g.strokeStyle = '#9fb4d0'; void v; };
        const ind = (px, py) => { g.strokeStyle = '#4fb3ff'; g.beginPath(); for (let k = 0; k < 4; k++) g.arc(px - 15 + k * 10 + 5, py, 5, Math.PI, 0); g.stroke(); lbl('L', px, py - 10, '#4fb3ff'); g.strokeStyle = '#9fb4d0'; };
        const dio = (px, py1, py2, up) => { g.strokeStyle = '#3ddc84'; line([[px, py1], [px, py2]]); const m = (py1 + py2) / 2, d = up ? -1 : 1; g.beginPath(); g.moveTo(px - 8, m - 6 * d); g.lineTo(px + 8, m - 6 * d); g.lineTo(px, m + 6 * d); g.closePath(); g.stroke(); line([[px - 8, m + 6 * d], [px + 8, m + 6 * d]]); g.strokeStyle = '#9fb4d0'; };
        const cap = (px) => { line([[px, y1], [px, (y1 + y2) / 2 - 4]]); line([[px - 10, (y1 + y2) / 2 - 4], [px + 10, (y1 + y2) / 2 - 4]]); line([[px - 10, (y1 + y2) / 2 + 4], [px + 10, (y1 + y2) / 2 + 4]]); line([[px, (y1 + y2) / 2 + 4], [px, y2]]); lbl('C', px + 18, (y1 + y2) / 2 + 4); };
        const res = (px) => { g.strokeRect(px - 7, y1 + 30, 14, y2 - y1 - 60); line([[px, y1], [px, y1 + 30]]); line([[px, y2 - 30], [px, y2]]); lbl('R', px + 18, (y1 + y2) / 2 + 4, '#ffd166'); };
        g.strokeStyle = '#9fb4d0';
        if (o.top === 'buck') { line([[x[0], y1], [x[1] - 15, y1]]); sw(x[1], y1); line([[x[1] + 15, y1], [x[2] - 20, y1]]); ind(x[2], y1); line([[x[2] + 20, y1], [x[4], y1]]); dio((x[1] + x[2]) / 2, y2, y1, true); }
        else if (o.top === 'boost') { line([[x[0], y1], [x[1] - 20, y1]]); ind(x[1], y1); line([[x[1] + 20, y1], [x[2] - 20, y1]]); g.strokeStyle = '#3ddc84'; line([[x[2] - 20, y1], [x[2] + 20, y1]]); lbl('D ▶', x[2], y1 - 8, '#3ddc84'); g.strokeStyle = '#9fb4d0'; line([[x[2] + 20, y1], [x[4], y1]]); line([[(x[1] + x[2]) / 2 + 10, y1], [(x[1] + x[2]) / 2 + 10, (y1 + y2) / 2 - 10]]); sw((x[1] + x[2]) / 2 + 10, (y1 + y2) / 2); line([[(x[1] + x[2]) / 2 + 10, (y1 + y2) / 2 + 10], [(x[1] + x[2]) / 2 + 10, y2]]); }
        else { line([[x[0], y1], [x[1] - 15, y1]]); sw(x[1], y1); line([[x[1] + 15, y1], [x[2] + 20, y1]]); g.strokeStyle = '#3ddc84'; line([[x[2] + 20, y1], [x[3] - 20, y1]]); lbl('◀ D', (x[2] + x[3]) / 2, y1 - 8, '#3ddc84'); g.strokeStyle = '#9fb4d0'; line([[x[3] - 20, y1], [x[4], y1]]); line([[x[2], y1], [x[2], (y1 + y2) / 2 - 20]]); g.save(); g.translate(x[2], (y1 + y2) / 2); g.rotate(Math.PI / 2); ind(0, 0); g.restore(); line([[x[2], (y1 + y2) / 2 + 20], [x[2], y2]]); lbl('(saída negativa)', x[4] - 50, y2 + 18, '#ff9f1c'); }
        g.strokeStyle = '#9fb4d0'; cap(x[3]); res(x[4]);
      };
      cv.redraw();
    }
    run();
  };

  /* ════════════════ 3. INVERSORES ════════════════ */
  E.inverter = function (o) {
    const N = 4096, cyc = 1, T = 1 / o.f1, ph3 = o.tipo === '3f';
    const tri = x => { const u = ((x % 1) + 1) % 1; return u < 0.5 ? 4 * u - 1 : 3 - 4 * u; };
    const t = [], va = [], car = [], ref = [];
    for (let i = 0; i < N; i++) {
      const tt = i / N * T, c = tri(i / N * o.mf + 0.25), rA = o.ma * Math.sin(TAU * o.f1 * tt);
      let v;
      if (o.tipo === 'q') v = rA >= 0 ? o.Vdc : -o.Vdc;
      else if (o.tipo === 'bip') v = rA > c ? o.Vdc : -o.Vdc;
      else if (o.tipo === 'uni') { const a = rA > c ? 1 : 0, b = -rA > c ? 1 : 0; v = (a - b) * o.Vdc; }
      else { const sw = k => (o.ma * Math.sin(TAU * o.f1 * tt - k * TAU / 3) > c ? 1 : 0); const sa = sw(0), sb = sw(1); v = (sa - sb) * o.Vdc; }
      t.push(tt * 1e3); va.push(v); car.push(c); ref.push(rA);
    }
    const H = E.harmonics(va, cyc, 120);
    // corrente RL (simulação por alguns ciclos)
    let i = 0; const dt = T / N, ia = [];
    const Zf = ph3 ? Math.sqrt(3) : 1;
    for (let c = 0; c < 6; c++) for (let k = 0; k < N; k++) { const v = va[k] / Zf; i += (v - o.R * i) / o.L * dt; if (c === 5) ia.push(i); }
    const Hi = E.harmonics(ia, cyc, 120);
    return { t, va, car, ref, H, ia, Hi, Vrms: rms(va) };
  };
  const INV = { q: 'Monofásico onda quadrada', bip: 'Monofásico SPWM bipolar', uni: 'Monofásico SPWM unipolar', '3f': 'Trifásico SPWM (tensão de linha)' };
  const toolInv = (host) => {
    const { body } = CS.page(host, {
      title: 'Inversores (CC → CA) com PWM senoidal', lead: 'Compare onda quadrada e SPWM: portadora × referência, tensão de saída, corrente numa carga RL e espectro harmônico com THD.',
      learn: `<p>O inversor sintetiza CA a partir de um barramento CC chaveando transistores (IGBT, MOSFET). No <b>SPWM</b>, uma senoide de referência é comparada com uma portadora triangular de alta frequência.</p>
      <ul><li><b>Índice de modulação de amplitude</b> m<sub>a</sub> = V<sub>ref</sub>/V<sub>tri</sub>. Na região linear (m<sub>a</sub> ≤ 1) a fundamental vale m<sub>a</sub>·V<sub>dc</sub> (pico, ponte monofásica) ou 0,612·m<sub>a</sub>·V<sub>dc</sub> (eficaz de linha, trifásico). Acima de 1 há <b>sobremodulação</b>, com mais harmônicos de baixa ordem.</li>
      <li><b>Índice de frequência</b> m<sub>f</sub> = f<sub>tri</sub>/f₁. Os harmônicos aparecem em torno de m<sub>f</sub>, 2m<sub>f</sub>…, longe da fundamental e fáceis de filtrar. Use m<sub>f</sub> ímpar (e múltiplo de 3 no trifásico).</li>
      <li><b>Unipolar</b> dobra a frequência efetiva dos harmônicos (aparecem em torno de 2m<sub>f</sub>).</li></ul>
      <p>A <b>carga indutiva</b> (motor) filtra naturalmente: a corrente é bem mais senoidal que a tensão. Os inversores de frequência dos motores usam V/f constante e frequências de chaveamento de 2 a 16 kHz.</p>`,
    });
    const f = K.form([{ k: 'tipo', l: 'Tipo', type: 'sel', v: 'bip', opts: Object.entries(INV) }, { k: 'Vdc', l: 'Barramento CC (por braço: ±Vdc)', u: 'V', v: '311' }, { k: 'f1', l: 'Frequência de saída f₁', u: 'Hz', v: '60' }, { k: 'mf', l: 'm<sub>f</sub> (portadora/f₁)', u: '', v: '21' }, { k: 'ma', l: 'm<sub>a</sub> (amplitude)', u: '', v: '0.8' }, { k: 'R', l: 'Carga R', u: 'Ω', v: '10' }, { k: 'L', l: 'Carga L', u: 'H', v: '20m' }], () => run(), { cols: 2 });
    const out = h('div'), b0 = CS.chartBox('sm'), b1 = CS.chartBox('sm'), b2 = CS.chartBox('sm'), b3 = CS.chartBox('sm');
    body.append(h('div', { class: 'grid2' }, h('div', { class: 'col' }, CS.card('Inversor', f.el), CS.card('Resultados', out), CS.card('Espectro da tensão (% da fundamental)', b3)), h('div', { class: 'col' }, CS.card('Portadora e referência', b0), CS.card('Tensão de saída', b1), CS.card('Corrente na carga RL', b2))));
    const opt = (yl, u) => ({ xlabel: 't [ms]', ylabel: yl, readout: (x, y) => `${K.n(x)} ms\n${K.n(y)} ${u}` });
    const c0 = new MS.Chart(b0, opt('', '')), c1 = new MS.Chart(b1, opt('V', 'V')), c2 = new MS.Chart(b2, opt('A', 'A')), c3 = new MS.Chart(b3, { xlabel: 'ordem harmônica', ylabel: '%', includeOrigin: true, readout: (x, y) => `h = ${Math.round(x)}\n${K.n(y)} %` });
    function run() {
      const o = { ...f.st }; o.mf = Math.max(3, Math.round(o.mf));
      const r = E.inverter(o);
      c0.set({ series: [{ x: r.t, y: r.car, color: 'rgba(159,180,208,0.7)', width: 1 }, { x: r.t, y: r.ref, color: '#ffd166', width: 2 }] });
      const V1 = r.H.h[1];
      c1.set({ series: [{ x: r.t, y: r.va, color: '#4fb3ff', width: 1.3 }, { x: r.t, y: r.t.map(tt => V1 * Math.sin(TAU * o.f1 * tt / 1e3)), color: '#ffd166', width: 2, name: 'fundamental' }] });
      c2.set({ series: [{ x: r.t, y: r.ia, color: '#3ddc84', width: 2 }] });
      const st = stems(r.H.h.map(a => a / (V1 || 1) * 100));
      c3.set({ series: [{ x: st.x, y: st.y, color: '#ff9f1c', width: 3 }] });
      out.innerHTML = '';
      out.append(CS.kv([['Fundamental (pico · eficaz)', `<b>${K.n(V1)} V · ${K.n(V1 / Math.SQRT2)} V</b>`], ['Teórico (região linear)', o.tipo === 'q' ? `4V<sub>dc</sub>/π = ${K.n(4 * o.Vdc / Math.PI)} V` : o.tipo === '3f' ? `√3/2·m<sub>a</sub>·V<sub>dc</sub> = ${K.n(Math.sqrt(3) / 2 * o.ma * o.Vdc)} V (pico de linha, ±V<sub>dc</sub> por braço = 2V<sub>dc</sub> de barramento)` : `m<sub>a</sub>·V<sub>dc</sub> = ${K.n(o.ma * o.Vdc)} V`], ['Frequência da portadora', `${K.n(o.mf * o.f1)} Hz`], ['THD da tensão', `<b>${K.n(r.H.thd * 100, 3)} %</b>`], ['THD da corrente', `<b class="good">${K.n(r.Hi.thd * 100, 3)} %</b> (a indutância filtra)`], ['Região', o.ma > 1 ? '<span class="warn">sobremodulação (m<sub>a</sub> > 1)</span>' : 'linear']]));
    }
    run();
  };

  /* ════════════════ 4. SEMICONDUTORES DE POTÊNCIA ════════════════ */
  const DEV = {
    igbt: ['IGBT Si (1200 V)', 1.0, 0.012, 9e-3, 600, 100], sic: ['MOSFET SiC (1200 V)', 0, 0.016, 2.2e-3, 600, 100], gan: ['GaN HEMT (650 V)', 0, 0.025, 0.25e-3, 400, 30], mos: ['MOSFET Si (650 V)', 0, 0.045, 1.2e-3, 400, 30],
  };
  const toolSemi = (host, onClean) => {
    const { body } = CS.page(host, {
      title: 'Semicondutores de potência, perdas e dissipação', lead: 'Comparativo dos dispositivos (diodo, SCR, GTO, TRIAC, MOSFET, IGBT, SiC, GaN, IGCT), mapa potência × frequência e cálculo de perdas e dissipador.',
      learn: `<p><b>Dispositivos não controlados:</b> diodo. <b>Semicontrolados:</b> SCR (liga pelo gatilho e desliga quando a corrente zera), TRIAC (bidirecional, dimmers). <b>Totalmente controlados:</b> GTO/IGCT (alta potência), BJT, MOSFET (rápido, baixa tensão), IGBT (média/alta tensão, até dezenas de kHz).</p>
      <p><b>Banda larga (WBG):</b> SiC e GaN suportam campos elétricos ~10× maiores que o silício: menos perdas, chaveamento mais rápido, maior temperatura. São usados em veículos elétricos, inversores solares e carregadores rápidos.</p>
      <p><b>Perdas:</b> condução P<sub>c</sub> = V<sub>0</sub>·I<sub>méd</sub> + r·I<sub>rms</sub>² (no MOSFET, R<sub>DS(on)</sub>·I²); chaveamento P<sub>sw</sub> = (E<sub>on</sub> + E<sub>off</sub>)·f<sub>sw</sub>, escalonadas pela tensão e corrente.</p>
      <p><b>Térmica:</b> T<sub>j</sub> = T<sub>a</sub> + P·(R<sub>jc</sub> + R<sub>cs</sub> + R<sub>sa</sub>). O dissipador deve ter R<sub>sa</sub> ≤ (T<sub>j,máx</sub> − T<sub>a</sub>)/P − R<sub>jc</sub> − R<sub>cs</sub>.</p>`,
    });
    onClean(K.sections(body, 'semi', [{ id: 'cmp', label: 'Comparativo', render: secSemiCmp }, { id: 'mapa', label: 'Mapa potência × frequência', render: secMapa }, { id: 'perdas', label: 'Perdas e dissipador', render: secPerdas }]));
  };
  function secSemiCmp(area) {
    area.append(CS.card('Dispositivos', K.table(['Dispositivo', 'Controle', 'Tensão / corrente típicas', 'Frequência', 'Aplicações'], [
      ['Diodo (rápido, Schottky, SiC)', 'nenhum', 'até 10 kV / kA', '— (recuperação reversa ns–µs)', 'retificadores, roda-livre'],
      ['SCR (tiristor)', 'liga pelo gatilho', 'até 8–12 kV / 5 kA', '50/60 Hz', 'retificadores controlados, HVDC LCC, soft-starters'],
      ['TRIAC', 'liga pelo gatilho (bidirecional)', '≤ 1 kV / 40 A', '50/60 Hz', 'dimmers, controle de aquecedores'],
      ['GTO / IGCT', 'liga e desliga', '4,5–10 kV / 4–6 kA', '≤ 1 kHz', 'tração ferroviária, acionamentos MT'],
      ['MOSFET Si', 'tensão (gate)', '≤ 900 V / 100 A', '10 kHz–1 MHz', 'fontes chaveadas, conversores CC-CC'],
      ['IGBT Si', 'tensão (gate)', '600 V–6,5 kV / até 3,6 kA', '1–50 kHz', 'inversores de motores, solar, tração, HVDC VSC'],
      ['MOSFET SiC', 'tensão (gate)', '650 V–3,3 kV / centenas de A', '20–200 kHz', 'veículos elétricos, carregadores rápidos, solar'],
      ['GaN HEMT', 'tensão (gate)', '≤ 650 V / dezenas de A', '100 kHz–10 MHz', 'carregadores USB-C, data centers, LiDAR'],
    ])));
  }
  function secMapa(area) {
    const cvc = CS.card('Regiões de aplicação (aproximadas, escala log)');
    area.append(cvc);
    K.canvas(cvc, 400, (g, W, H) => {
      const L = 60, B = H - 40, R = W - 20, T = 20, fx = f => L + (R - L) * (Math.log10(f) - 1) / 6, py = p => B - (B - T) * (Math.log10(p) - 2) / 7;
      g.strokeStyle = 'rgba(159,180,208,0.2)'; g.fillStyle = '#9fb4d0'; g.font = '11px Barlow'; g.textAlign = 'center';
      for (let e = 1; e <= 7; e++) { const x = fx(10 ** e); g.beginPath(); g.moveTo(x, T); g.lineTo(x, B); g.stroke(); g.fillText(['10 Hz', '100 Hz', '1 kHz', '10 kHz', '100 kHz', '1 MHz', '10 MHz'][e - 1], x, B + 14); }
      g.textAlign = 'right'; for (let e = 2; e <= 9; e++) { const y = py(10 ** e); g.beginPath(); g.moveTo(L, y); g.lineTo(R, y); g.stroke(); g.fillText(['100 W', '1 kW', '10 kW', '100 kW', '1 MW', '10 MW', '100 MW', '1 GW'][e - 2], L - 4, y + 4); }
      const reg = [['SCR', 30, 1e3, 1e5, 1e9, '#ff4d6d'], ['GTO/IGCT', 100, 3e3, 1e5, 3e7, '#ff9f1c'], ['IGBT', 500, 5e4, 1e3, 1e7, '#ffd166'], ['SiC', 5e3, 3e5, 1e3, 1e6, '#3ddc84'], ['MOSFET Si', 1e4, 1e6, 100, 3e4, '#4fb3ff'], ['GaN', 5e4, 1e7, 100, 1e4, '#c77dff']];
      for (const [n, f0, f1, p0, p1, c] of reg) { g.fillStyle = c; g.globalAlpha = 0.18; g.fillRect(fx(f0), py(p1), fx(f1) - fx(f0), py(p0) - py(p1)); g.globalAlpha = 0.9; g.strokeStyle = c; g.strokeRect(fx(f0), py(p1), fx(f1) - fx(f0), py(p0) - py(p1)); g.fillStyle = c; g.textAlign = 'left'; g.font = 'bold 12px Barlow'; g.fillText(n, fx(f0) + 4, py(p1) + 14); }
      g.globalAlpha = 1; g.fillStyle = '#c3d3e8'; g.textAlign = 'center'; g.font = '12px Barlow'; g.fillText('frequência de chaveamento', (L + R) / 2, H - 6);
    });
  }
  function secPerdas(area) {
    const f = K.form([{ k: 'dev', l: 'Dispositivo', type: 'sel', v: 'igbt', opts: Object.entries(DEV).map(([k, v]) => [k, v[0]]) }, { k: 'V', l: 'Tensão chaveada', u: 'V', v: '600' }, { k: 'I', l: 'Corrente (média na condução)', u: 'A', v: '50' }, { k: 'D', l: 'Razão cíclica', u: '', v: '0.5' }, { k: 'fsw', l: 'Frequência de chaveamento', u: 'Hz', v: '20k' }, { k: 'Ta', l: 'Temperatura ambiente', u: '°C', v: '40' }, { k: 'Tj', l: 'T<sub>j</sub> máxima admitida', u: '°C', v: '125' }, { k: 'Rjc', l: 'R<sub>jc</sub>', u: 'K/W', v: '0.3' }, { k: 'Rcs', l: 'R<sub>cs</sub> (pasta térmica)', u: 'K/W', v: '0.1' }], () => run(), { cols: 2 });
    const out = h('div'), cb = CS.chartBox();
    area.append(h('div', { class: 'grid2' }, h('div', { class: 'col' }, CS.card('Ponto de operação', f.el), CS.card('Perdas e dissipador', out)), CS.card('Perda total × frequência (mesmo ponto de operação)', cb)));
    const ch = new MS.Chart(cb, { xlog: true, xlabel: 'f_sw [Hz]', ylabel: 'P [W]', includeOrigin: true, readout: (x, y) => `${K.n(x)} Hz\n${K.n(y)} W` });
    const loss = (d, s, fsw) => { const [, V0, r, Esw, Vr, Ir] = DEV[d]; const Pc = s.D * (V0 * s.I + r * s.I * s.I); const Ps = Esw * fsw * (s.V / Vr) * (s.I / Ir); return { Pc, Ps, P: Pc + Ps }; };
    function run() {
      const s = f.st, L = loss(s.dev, s, s.fsw), Rsa = (s.Tj - s.Ta) / L.P - s.Rjc - s.Rcs;
      const fs = CS.logspace(1e3, 1e6, 80);
      ch.set({ series: Object.keys(DEV).map((d, i) => ({ x: fs, y: fs.map(fr => loss(d, s, fr).P), color: ['#ffd166', '#3ddc84', '#c77dff', '#4fb3ff'][i], width: d === s.dev ? 2.6 : 1.3, name: DEV[d][0] })), markers: [{ x: s.fsw, y: L.P, shape: 'dot', color: '#fff', size: 6 }] });
      out.innerHTML = '';
      out.append(CS.kv([['Perda de condução', `${K.n(L.Pc)} W`], ['Perda de chaveamento', `${K.n(L.Ps)} W`], ['Total', `<b>${K.n(L.P)} W</b>`], ['Dissipador necessário', Rsa > 0 ? `R<sub>sa</sub> ≤ <b>${K.n(Rsa, 3)} K/W</b> ${Rsa < 0.3 ? '(ventilação forçada ou refrigeração líquida)' : Rsa < 1.5 ? '(dissipador de alumínio com ventilação)' : '(dissipador natural)'}` : '<b class="bad">impossível: reduza f<sub>sw</sub>, a corrente ou use um dispositivo melhor</b>'], ['Rendimento aproximado', `${K.n((1 - L.P / (s.V * s.I * s.D + L.P)) * 100, 4)} % (só esta chave)`]]), h('div', { class: 'muted small' }, 'Parâmetros típicos ilustrativos (V₀, r, E<sub>on+off</sub> na condição de referência). Use as curvas do fabricante para projeto.'));
    }
    run();
  }

  /* ════════════════ 5. ALTA TENSÃO ════════════════ */
  const toolAT = (host, onClean) => {
    const { body } = CS.page(host, {
      title: 'Alta Tensão', lead: 'Campos e isolamento, ruptura em gases (Paschen), efeito corona (Peek), impulsos atmosféricos e gerador de Marx, ondas viajantes, cadeias de isoladores, coordenação de isolamento, HVDC e equipamentos de AT.',
      learn: `<p><b>Por que alta tensão?</b> Para transmitir a mesma potência, P = V·I: tensões maiores reduzem a corrente e as perdas I²R. No Brasil: distribuição 13,8–34,5 kV, subtransmissão 69–138 kV, transmissão 230, 345, 440, 500, 765 kV CA e ±600/±800 kV CC.</p>
      <p><b>Isolamento:</b> o projeto busca manter o campo elétrico máximo abaixo da rigidez dielétrica do meio (ar ≈ 3 kV/mm em campo uniforme, SF₆ ≈ 2,5× o ar, óleo ≈ 10–15 kV/mm, XLPE ≈ 20–30 kV/mm). Campos não uniformes (pontas, condutores finos) iniciam descargas parciais e corona.</p>
      <p><b>Solicitações:</b> tensão de frequência industrial, sobretensões temporárias, de manobra (250/2500 µs) e atmosféricas (1,2/50 µs). A <b>coordenação de isolamento</b> escolhe os níveis suportáveis (NBI) e os para-raios para que a proteção atue antes da ruptura.</p>
      <p><b>Ensaios de AT:</b> tensão aplicada, impulso (gerador de Marx), descargas parciais, fator de perdas (tan δ), resistência de isolamento.</p>`,
    });
    onClean(K.sections(body, 'at', [
      { id: 'campo', label: 'Campo elétrico', render: secCampo }, { id: 'paschen', label: 'Paschen', render: secPaschen }, { id: 'corona', label: 'Corona (Peek)', render: secCorona },
      { id: 'imp', label: 'Impulso e Marx', render: secImpulso }, { id: 'ondas', label: 'Ondas viajantes', render: secOndas }, { id: 'isol', label: 'Cadeia de isoladores', render: secIsoladores },
      { id: 'coord', label: 'Coordenação de isolamento', render: secCoord }, { id: 'hvdc', label: 'HVDC', render: secHVDC }, { id: 'equip', label: 'Equipamentos de AT', render: secEquip },
    ]));
  };
  const DIEL = [['3', 'Ar, 1 atm (3 kV/mm)'], ['8.9', 'SF₆, 1 bar (8,9 kV/mm)'], ['12', 'Óleo mineral (≈ 12 kV/mm)'], ['20', 'XLPE (≈ 20 kV/mm, curto prazo)'], ['5', 'XLPE, tensão de trabalho (≈ 5 kV/mm)']];
  function secCampo(area) {
    const f = K.form([{ k: 'V', l: 'Tensão (pico) entre condutores', u: 'kV', v: '100' }, { k: 'R', l: 'Raio externo R', u: 'mm', v: '50' }, { k: 'r', l: 'Raio interno r', u: 'mm', v: '10' }, { k: 'Eb', l: 'Dielétrico', type: 'sel', v: '8.9', opts: DIEL }], () => run(), { cols: 2 });
    const out = h('div'), b1 = CS.chartBox('sm'), b2 = CS.chartBox('sm');
    area.append(h('div', { class: 'grid2' }, h('div', { class: 'col' }, CS.card('Geometria coaxial (cabo, barramento blindado GIS)', f.el), CS.card('Resultados', out)), h('div', { class: 'col' }, CS.card('Campo E(x) entre os condutores', b1), CS.card('E<sub>máx</sub> × r/R (R fixo) — ótimo em r/R = 1/e', b2))));
    const c1 = new MS.Chart(b1, { xlabel: 'x [mm]', ylabel: 'E [kV/mm]', includeOrigin: true, readout: (x, y) => `${K.n(x)} mm\n${K.n(y)} kV/mm` }), c2 = new MS.Chart(b2, { xlabel: 'r/R', ylabel: 'Emax [kV/mm]', readout: (x, y) => `r/R = ${K.n(x, 3)}\n${K.n(y)} kV/mm` });
    function run() {
      const { V, R, r } = f.st, Eb = parseFloat(f.st.Eb);
      if (r >= R) { out.innerHTML = '<div class="bad">r deve ser menor que R</div>'; return; }
      const E = x => V / (x * Math.log(R / r)), xs = K.linspace(r, R, 100), Emax = E(r);
      c1.set({ series: [{ x: xs, y: xs.map(E), color: '#ffd166', width: 2 }], hlines: [{ y: Eb, color: '#ff4d6d', label: 'rigidez' }] });
      const ks = K.linspace(0.02, 0.95, 120);
      c2.set({ series: [{ x: ks, y: ks.map(k => V / (k * R * Math.log(1 / k))), color: '#4fb3ff', width: 2 }], markers: [{ x: 1 / Math.E, y: V * Math.E / R, shape: 'dot', color: '#3ddc84', size: 6, label: 'ótimo' }, { x: r / R, y: Emax, shape: 'dot', color: '#ffd166', size: 6 }], hlines: [{ y: Eb, color: '#ff4d6d' }] });
      const Vmax = Eb * r * Math.log(R / r), Vopt = Eb * R / Math.E;
      out.innerHTML = '';
      out.append(CS.kv([['E<sub>máx</sub> (no condutor interno)', `<b>${K.n(Emax)} kV/mm</b>`], ['E<sub>mín</sub> (no externo)', `${K.n(E(R))} kV/mm`], ['Fator de utilização η = E<sub>méd</sub>/E<sub>máx</sub>', K.n(V / (R - r) / Emax, 3)], ['Margem (rigidez/E<sub>máx</sub>)', Emax < Eb ? `<span class="good">${K.n(Eb / Emax, 3)} ✓</span>` : `<span class="bad">${K.n(Eb / Emax, 3)} ✗ ruptura</span>`], ['Tensão suportável desta geometria', `${K.n(Vmax)} kV`], ['Com r ótimo = R/e', `r = ${K.n(R / Math.E)} mm → ${K.n(Vopt)} kV`]]));
    }
    run();
  }
  E.paschen = (pd, g = 0.01, A = 15, B = 365) => { const d = Math.log(A * pd) - Math.log(Math.log(1 + 1 / g)); return d > 0 ? B * pd / d : NaN; };
  function secPaschen(area) {
    const f = K.form([{ k: 'p', l: 'Pressão', u: 'Torr', v: '760' }, { k: 'd', l: 'Distância entre eletrodos', u: 'cm', v: '0.1' }, { k: 'g', l: 'Coeficiente γ (emissão secundária)', u: '', v: '0.01' }], () => run(), { cols: 1 });
    const out = h('div'), cb = CS.chartBox('tall');
    area.append(h('div', { class: 'grid2' }, h('div', { class: 'col' }, CS.card('Ar entre placas paralelas', f.el), CS.card('Resultados', out)), CS.card('Curva de Paschen (ar)', cb)));
    const ch = new MS.Chart(cb, { xlog: true, ylog: true, xlabel: 'p·d [Torr·cm]', ylabel: 'V ruptura [V]', xrange: [0.1, 1e4], yrange: [100, 1e7], readout: (x, y) => `pd = ${K.n(x)} Torr·cm\n${K.n(y)} V` });
    function run() {
      const pd = f.st.p * f.st.d, V = E.paschen(pd, f.st.g), xs = CS.logspace(0.1, 1e4, 300), ys = xs.map(x => E.paschen(x, f.st.g));
      const fin = ys.map((y, i) => [xs[i], y]).filter(p => isFinite(p[1]) && p[1] > 0), mn = fin.reduce((a, b) => (b[1] < a[1] ? b : a));
      ch.set({ series: [{ x: xs, y: ys, color: '#4fb3ff', width: 2.2 }], markers: [{ x: mn[0], y: mn[1], shape: 'o', color: '#3ddc84', size: 6, label: `mínimo ≈ ${K.n(mn[1], 3)} V` }, isFinite(V) ? { x: pd, y: V, shape: 'dot', color: '#ffd166', size: 6, label: 'ponto' } : null].filter(Boolean) });
      out.innerHTML = '';
      out.append(CS.kv([['p·d', `${K.n(pd)} Torr·cm`], ['Tensão de ruptura', isFinite(V) ? `<b>${K.n(V / 1000)} kV</b>` : 'fora do domínio do modelo (pd muito pequeno)'], ['Campo médio', isFinite(V) ? `${K.n(V / 1000 / (f.st.d * 10))} kV/mm` : '—'], ['Mínimo de Paschen', `${K.n(mn[1], 3)} V em pd ≈ ${K.n(mn[0], 3)} Torr·cm`]]), h('div', { class: 'muted small', html: 'V = B·pd / [ln(A·pd) − ln(ln(1 + 1/γ))], com A = 15 (cm·Torr)⁻¹ e B = 365 V/(cm·Torr). À esquerda do mínimo, <b>reduzir a pressão aumenta a rigidez</b> (vácuo — disjuntores a vácuo); à direita, aumentar a pressão aumenta a rigidez (SF₆ pressurizado, GIS).' }));
    }
    run();
  }
  function secCorona(area) {
    const f = K.form([{ k: 'V', l: 'Tensão de linha (eficaz)', u: 'kV', v: '230' }, { k: 'dc', l: 'Diâmetro do condutor', u: 'cm', v: '2.5' }, { k: 'D', l: 'Espaçamento entre fases', u: 'm', v: '7' }, { k: 'm', l: 'Fator de superfície m', type: 'sel', v: '0.85', opts: [['1', 'liso e polido (1,0)'], ['0.9', 'novo, levemente rugoso (0,9)'], ['0.85', 'cabo encordoado (0,85)'], ['0.7', 'sujo / envelhecido (0,7)']] }, { k: 'T', l: 'Temperatura', u: '°C', v: '25' }, { k: 'b', l: 'Pressão', u: 'cmHg', v: '76' }, { k: 'f', l: 'Frequência', u: 'Hz', v: '60' }, { k: 'nf', l: 'Condutores por fase (feixe)', type: 'sel', v: '1', opts: ['1', '2', '3', '4'] }], () => run(), { cols: 2 });
    const out = h('div'), cb = CS.chartBox();
    area.append(h('div', { class: 'grid2' }, h('div', { class: 'col' }, CS.card('Linha de transmissão', f.el), CS.card('Resultados (fórmulas de Peek)', out)), CS.card('Perda corona × tensão de linha', cb)));
    const ch = new MS.Chart(cb, { xlabel: 'V linha [kV]', ylabel: 'kW/km (3 fases)', includeOrigin: true, readout: (x, y) => `${K.n(x)} kV\n${K.n(y)} kW/km` });
    function run() {
      const s = f.st, r = s.dc / 2, Dcm = s.D * 100, delta = 3.92 * s.b / (273 + s.T), m = parseFloat(s.m), n = +s.nf;
      const req = n === 1 ? r : Math.pow(n * r * Math.pow(45 / (2 * Math.sin(Math.PI / n)), n - 1), 1 / n);
      const Ec = 30 * m * delta * (1 + 0.301 / Math.sqrt(delta * r));
      const V0 = 21.1 * m * delta * req * Math.log(Dcm / req) * (n === 1 ? 1 : 1 + 0.1 * (n - 1)) * Math.sqrt(3);
      const loss = Vl => { const Vf = Vl / Math.sqrt(3), V0f = V0 / Math.sqrt(3); return Vf > V0f ? 3 * 241e-5 * (s.f + 25) / delta * Math.sqrt(req / Dcm) * (Vf - V0f) ** 2 : 0; };
      const vs = K.linspace(0, Math.max(s.V * 1.6, V0 * 1.4), 120);
      ch.set({ series: [{ x: vs, y: vs.map(loss), color: '#c77dff', width: 2 }], vlines: [{ x: V0, color: 'rgba(61,220,132,0.6)', label: 'V₀ crítica' }], markers: [{ x: s.V, y: loss(s.V), shape: 'dot', color: '#ffd166', size: 6 }] });
      out.innerHTML = '';
      out.append(CS.kv([['Densidade relativa do ar δ', K.n(delta, 3)], ['Gradiente crítico (pico)', `${K.n(Ec, 3)} kV/cm`], ['Tensão crítica disruptiva (linha)', `<b>${K.n(V0)} kV</b>`], ['Situação', s.V > V0 ? `<b class="warn">há corona: perda ≈ ${K.n(loss(s.V))} kW/km</b>` : '<b class="good">abaixo do limiar: corona desprezível em tempo bom</b>'], n > 1 ? ['Raio equivalente do feixe', `${K.n(req, 3)} cm (espaçamento 45 cm)`] : null]),
        h('div', { class: 'muted small' }, 'O corona produz perdas, ruído audível, interferência de rádio e ozônio. Soluções: condutores de maior diâmetro e feixes de subcondutores (2 a 4 por fase em 345–765 kV).'));
    }
    run();
  }
  E.impulse = (o) => {
    const a = 1 / (o.R1 * o.C1) + 1 / (o.R1 * o.C2) + 1 / (o.R2 * o.C1), b = 1 / (o.R1 * o.R2 * o.C1 * o.C2);
    const disc = Math.sqrt(a * a - 4 * b), al = (a - disc) / 2, be = (a + disc) / 2;
    const k = 1 / (o.R1 * o.C2 * (be - al));
    const V0 = o.n * o.Vs;
    const v = t => V0 * k * (Math.exp(-al * t) - Math.exp(-be * t));
    const tmax = Math.log(be / al) / (be - al), Vp = v(tmax);
    const find = (lev, lo, hi) => K.solve(t => v(t) - lev * Vp, lo, hi);
    const t30 = find(0.3, 0, tmax), t90 = find(0.9, 0, tmax), T1 = 1.67 * (t90 - t30), t0 = t30 - 0.3 * T1, t50 = find(0.5, tmax, tmax * 2000);
    return { v, Vp, eta: Vp / V0, T1, T2: t50 - t0, tmax, t0 };
  };
  function secImpulso(area) {
    const f = K.form([{ k: 'n', l: 'Estágios do gerador de Marx', u: '', v: '8' }, { k: 'Vs', l: 'Tensão de carga por estágio', u: 'kV', v: '100' }, { k: 'C1', l: 'C₁ (capacitância de impulso equivalente)', u: 'F', v: '125n' }, { k: 'C2', l: 'C₂ (carga + divisor)', u: 'F', v: '1n' }, { k: 'R1', l: 'R₁ (frente)', u: 'Ω', v: '403' }, { k: 'R2', l: 'R₂ (cauda)', u: 'Ω', v: '567' }], () => run(), { cols: 2 });
    const out = h('div'), cb = CS.chartBox('tall'), cvc = CS.card('Gerador de Marx: carga em paralelo, descarga em série');
    area.append(h('div', { class: 'grid2' }, h('div', { class: 'col' }, CS.card('Gerador de impulso', f.el), CS.card('Forma de onda', out), cvc), CS.card('Tensão de impulso v(t)', cb)));
    const ch = new MS.Chart(cb, { xlabel: 't [µs]', ylabel: 'kV', includeOrigin: true, readout: (x, y) => `${K.n(x)} µs\n${K.n(y)} kV` });
    const cv = K.canvas(cvc, 200, null);
    function run() {
      const o = f.st, r = E.impulse(o), ts = K.linspace(0, Math.max(100e-6, r.T2 * 2.2), 600);
      const ok = Math.abs(r.T1 / 1.2e-6 - 1) <= 0.3 && Math.abs(r.T2 / 50e-6 - 1) <= 0.2;
      ch.set({ series: [{ x: ts.map(t => t * 1e6), y: ts.map(r.v), color: '#ffd166', width: 2.2 }], hlines: [{ y: r.Vp * 0.5, color: 'rgba(159,180,208,0.4)', label: '50%' }], vlines: [{ x: (r.t0 + r.T2) * 1e6, color: 'rgba(79,179,255,0.5)', label: 'T₂' }] });
      out.innerHTML = '';
      out.append(CS.kv([['Tensão de carga total', `${K.n(o.n * o.Vs)} kV`], ['Pico', `<b>${K.n(r.Vp)} kV</b> (eficiência ${K.n(r.eta * 100, 3)} %)`], ['Tempo de frente T₁', `${K.n(r.T1 * 1e6, 3)} µs`], ['Tempo até meio valor T₂', `${K.n(r.T2 * 1e6, 3)} µs`], ['Forma normalizada 1,2/50 µs', ok ? '<b class="good">dentro da tolerância (±30% / ±20%)</b>' : '<b class="warn">fora da tolerância: ajuste R₁ (frente) e R₂ (cauda)</b>'], ['Energia armazenada', `${K.n(0.5 * o.C1 / o.n * (o.n * o.Vs * 1e3) ** 2 / 1e3 * o.n, 3)} kJ (aprox.)`]]));
      cv.draw = (g, W, H) => {
        const n = Math.min(6, Math.round(o.n)), dx = (W - 80) / n;
        g.font = '11px Barlow'; g.lineWidth = 2;
        for (let i = 0; i < n; i++) {
          const x = 40 + i * dx, yb = H - 40 - i * ((H - 80) / n), yt = yb - (H - 80) / n;
          g.strokeStyle = '#4fb3ff'; g.beginPath(); g.moveTo(x, yb); g.lineTo(x, (yb + yt) / 2 + 4); g.moveTo(x - 10, (yb + yt) / 2 + 4); g.lineTo(x + 10, (yb + yt) / 2 + 4); g.moveTo(x - 10, (yb + yt) / 2 - 4); g.lineTo(x + 10, (yb + yt) / 2 - 4); g.moveTo(x, (yb + yt) / 2 - 4); g.lineTo(x, yt); g.stroke();
          g.strokeStyle = '#ffd166'; g.beginPath(); g.arc(x + dx / 2 - 6, yt, 4, 0, 7); g.arc(x + dx / 2 + 6, yt - 0.01, 4, 0, 7); g.stroke();
          g.strokeStyle = '#6f8bad'; g.setLineDash([3, 3]); g.beginPath(); g.moveTo(x, yt); g.lineTo(x + dx / 2 - 10, yt); g.moveTo(x + dx / 2 + 10, yt); g.lineTo(x + dx, yt - (H - 80) / n + (H - 80) / n); g.stroke(); g.setLineDash([]);
        }
        g.fillStyle = '#c3d3e8'; g.textAlign = 'left'; g.fillText('capacitores carregados em paralelo (via resistores); os centelhadores disparam e os ligam em série: V ≈ n·V_estágio', 10, 16);
      };
      cv.redraw();
    }
    run();
  }
  function secOndas(area) {
    const f = K.form([{ k: 'V', l: 'Onda incidente (degrau)', u: 'kV', v: '500' }, { k: 'Z1', l: 'Z₁ linha aérea', u: 'Ω', v: '400' }, { k: 'Z2', l: 'Z₂ cabo', u: 'Ω', v: '40' }, { k: 'len', l: 'Comprimento do cabo', u: 'm', v: '300' }, { k: 'vp', l: 'Velocidade no cabo', u: 'm/µs', v: '150' }, { k: 'term', l: 'Terminação do cabo', type: 'sel', v: 'open', opts: [['open', 'aberto (transformador em vazio ≈ capacitivo)'], ['short', 'curto-circuito'], ['match', 'casado (R = Z₂)']] }], () => run(), { cols: 2 });
    const out = h('div'), cb = CS.chartBox(), cvc = CS.card('Diagrama de treliça (Bewley)');
    area.append(h('div', { class: 'grid2' }, h('div', { class: 'col' }, CS.card('Junção linha aérea → cabo', f.el), CS.card('Coeficientes', out)), h('div', { class: 'col' }, CS.card('Tensões na junção e no fim do cabo', cb), cvc)));
    const ch = new MS.Chart(cb, { xlabel: 't [µs]', ylabel: 'kV', includeOrigin: true, readout: (x, y) => `${K.n(x)} µs\n${K.n(y)} kV` });
    const cv = K.canvas(cvc, 260, null);
    function run() {
      const s = f.st, tau = s.len / s.vp, T12 = 2 * s.Z2 / (s.Z1 + s.Z2), G21 = (s.Z1 - s.Z2) / (s.Z1 + s.Z2), Ge = { open: 1, short: -1, match: 0 }[s.term];
      const tmax = 20 * tau, ts = K.linspace(0, tmax, 800);
      const vend = t => { let v = 0; for (let k = 0; (2 * k + 1) * tau <= t; k++) v += T12 * s.V * (1 + Ge) * (Ge * G21) ** k; return v; };
      const vj = t => { let v = t >= 0 ? T12 * s.V : 0; for (let k = 1; 2 * k * tau <= t; k++) v += T12 * s.V * Ge ** k * G21 ** (k - 1) * (1 + G21); return v; };
      ch.set({ series: [{ x: ts, y: ts.map(vj), color: '#4fb3ff', width: 2, name: 'junção' }, { x: ts, y: ts.map(vend), color: '#ffd166', width: 2, name: 'fim do cabo' }], hlines: [{ y: s.V * (1 + Ge === 0 ? 0 : 1) * (s.term === 'open' ? 2 * s.Z1 / (s.Z1 + s.Z1) : 1), color: 'rgba(159,180,208,0.3)' }] });
      const peak = Math.max(...ts.map(vend));
      out.innerHTML = '';
      out.append(CS.kv([['Coef. de transmissão linha → cabo', K.n(T12, 3)], ['Coef. de reflexão na junção (lado do cabo)', K.n(G21, 3)], ['Coef. de reflexão no fim', Ge], ['Tempo de trânsito no cabo τ', `${K.n(tau, 3)} µs`], ['Onda que entra no cabo', `${K.n(T12 * s.V)} kV`], ['Pico no fim do cabo', `<b>${K.n(peak)} kV</b>`], ['Valor final (regime)', `${K.n(vend(1e9 * tau) || 0)} kV`]]), h('div', { class: 'muted small' }, 'Γ = (Z₂ − Z₁)/(Z₂ + Z₁) e T = 1 + Γ. Um cabo curto entre a linha aérea e o equipamento reduz a onda que entra, mas as reflexões sucessivas a fazem crescer em degraus: por isso os para-raios ficam o mais perto possível do equipamento.'));
      cv.draw = (g, W, H) => {
        const xL = 70, xR = W - 70, top = 25, bot = H - 15, K2 = 9, dy = (bot - top) / K2;
        g.strokeStyle = '#9fb4d0'; g.lineWidth = 2; g.beginPath(); g.moveTo(xL, top); g.lineTo(xL, bot); g.moveTo(xR, top); g.lineTo(xR, bot); g.stroke();
        g.fillStyle = '#c3d3e8'; g.font = '11px Barlow'; g.textAlign = 'center'; g.fillText('junção', xL, top - 8); g.fillText('fim', xR, top - 8); g.fillText('t ↓', 20, top + 10);
        let amp = T12 * s.V;
        for (let k = 0; k < K2; k++) {
          const y0 = top + k * dy, y1 = y0 + dy, right = k % 2 === 0;
          g.strokeStyle = right ? '#ffd166' : '#4fb3ff'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(right ? xL : xR, y0); g.lineTo(right ? xR : xL, y1); g.stroke();
          g.fillStyle = g.strokeStyle; g.textAlign = 'center'; g.fillText(`${K.n(amp, 3)}`, (xL + xR) / 2 + (right ? 18 : -18), (y0 + y1) / 2);
          amp *= right ? Ge : G21; if (Math.abs(amp) < 1e-6) break;
          g.fillStyle = '#6f8bad'; g.textAlign = right ? 'left' : 'right'; g.fillText(`${(k + 1)}τ`, right ? xR + 6 : xL - 6, y1 + 4);
        }
      };
      cv.redraw();
    }
    run();
  }
  function secIsoladores(area) {
    const f = K.form([{ k: 'n', l: 'Número de discos', u: '', v: '6' }, { k: 'm', l: 'Relação C<sub>terra</sub>/C<sub>disco</sub> (m)', u: '', v: '0.1' }, { k: 'V', l: 'Tensão fase-terra', u: 'kV', v: '76' }, { k: 'Vd', l: 'Suportabilidade por disco', u: 'kV', v: '17' }], () => run(), { cols: 2 });
    const out = h('div'), cb = CS.chartBox();
    area.append(h('div', { class: 'grid2' }, h('div', { class: 'col' }, CS.card('Cadeia de isoladores de disco', f.el), CS.card('Resultados', out)), CS.card('Tensão em cada disco (1 = junto à cruzeta, n = junto ao condutor)', cb)));
    const ch = new MS.Chart(cb, { xlabel: 'disco', ylabel: 'kV', includeOrigin: true, readout: (x, y) => `disco ${Math.round(x)}\n${K.n(y)} kV` });
    function run() {
      const n = Math.max(2, Math.round(f.st.n)), m = f.st.m, V = [1];
      for (let k = 1; k < n; k++) V.push(V[k - 1] + m * V.slice(0, k).reduce((a, b) => a + b, 0));
      const S = V.reduce((a, b) => a + b, 0), Vk = V.map(v => v / S * f.st.V), eff = f.st.V / (n * Vk[n - 1]);
      const ks = [...Array(n)].map((_, i) => i + 1), st = stems([0, ...Vk]);
      ch.set({ series: [{ x: st.x, y: st.y, color: '#4fb3ff', width: 10 }, { x: [0.5, n + 0.5], y: [f.st.V / n, f.st.V / n], color: 'rgba(61,220,132,0.6)', dash: [5, 4], width: 1.5, name: 'distribuição uniforme' }], hlines: [{ y: f.st.Vd, color: '#ff4d6d', label: 'limite por disco' }] });
      void ks;
      out.innerHTML = '';
      out.append(CS.kv([['Disco mais solicitado (junto ao condutor)', `<b>${K.n(Vk[n - 1])} kV</b> (${K.n(Vk[n - 1] / f.st.V * 100, 3)} %)`], ['Disco menos solicitado', `${K.n(Vk[0])} kV`], ['Eficiência da cadeia', `<b>${K.n(eff * 100, 3)} %</b>`], ['Verificação', Vk[n - 1] <= f.st.Vd ? '<span class="good">todos os discos abaixo do limite ✓</span>' : '<span class="bad">disco junto ao condutor sobrecarregado ✗ (aumente n ou use anel equalizador)</span>']]), h('div', { class: 'muted small' }, 'As capacitâncias parasitas dos discos para a torre (aterrada) desviam corrente, e por isso os discos próximos ao condutor recebem mais tensão. O anel equalizador (anel de guarda) e cadeias mais longas melhoram a distribuição.'));
    }
    run();
  }
  const NIVEIS = [[3.6, 10, 40], [7.2, 20, 60], [12, 28, 75], [15, 34, 110], [24.2, 50, 125], [36.2, 70, 170], [72.5, 140, 350], [145, 275, 650], [245, 460, 1050], [362, '—', 1175], [550, '—', 1550], [800, '—', 2100]];
  function secCoord(area) {
    const f = K.form([{ k: 'Um', l: 'Tensão máxima do equipamento U<sub>m</sub>', type: 'sel', v: '145', opts: NIVEIS.map(r => [String(r[0]), r[0] + ' kV']) }, { k: 'Up', l: 'Nível de proteção do para-raios (impulso)', u: 'kV', v: '330' }, { k: 'S', l: 'Taxa de crescimento da frente', u: 'kV/µs', v: '1000' }, { k: 'd', l: 'Distância para-raios → equipamento', u: 'm', v: '15' }], () => run(), { cols: 2 });
    const out = h('div');
    area.append(h('div', { class: 'grid2' }, CS.card('Proteção por para-raios (ZnO)', f.el, out), CS.card('Níveis de isolamento normalizados (IEC 60071 / NBR 6939)', K.table(['U<sub>m</sub> [kV]', 'Freq. industrial 1 min [kV]', 'NBI (impulso atmosférico) [kV]'], NIVEIS))));
    function run() {
      const row = NIVEIS.find(r => String(r[0]) === f.st.Um), BIL = row[2];
      const Vt = f.st.Up + 2 * f.st.S * f.st.d / 300, mp = BIL / Vt;
      out.innerHTML = '';
      out.append(CS.kv([['NBI do equipamento', `${BIL} kV`], ['Tensão no equipamento (efeito da distância)', `V = U<sub>p</sub> + 2·S·d/v = <b>${K.n(Vt)} kV</b>`], ['Margem de proteção NBI/V', mp >= 1.2 ? `<b class="good">${K.n(mp, 3)} ≥ 1,20 ✓</b>` : `<b class="bad">${K.n(mp, 3)} &lt; 1,20 ✗</b>`], ['Distância máxima (margem 1,2)', `${K.n(Math.max(0, (BIL / 1.2 - f.st.Up) * 300 / (2 * f.st.S)))} m`]]), h('div', { class: 'muted small' }, 'Velocidade de propagação v ≈ 300 m/µs. A margem mínima recomendada para impulso atmosférico é de 20% (IEC 60071-2).'));
    }
    run();
  }
  function secHVDC(area) {
    const f = K.form([{ k: 'P', l: 'Potência', u: 'MW', v: '3000' }, { k: 'cac', l: 'Custo de linha CA', u: 'M$/km', v: '1.2' }, { k: 'cdc', l: 'Custo de linha CC', u: 'M$/km', v: '0.8' }, { k: 'tac', l: 'Subestações CA', u: 'M$', v: '150' }, { k: 'tdc', l: 'Conversoras CC (as duas)', u: 'M$', v: '600' },
      { sep: 'Cabo CA: limite pela corrente de carregamento' }, { k: 'Vc', l: 'Tensão do cabo', u: 'kV', v: '230' }, { k: 'Cc', l: 'Capacitância do cabo', u: 'µF/km', v: '0.25' }, { k: 'In', l: 'Corrente nominal do cabo', u: 'A', v: '1000' }], () => run(), { cols: 2 });
    const out = h('div'), cb = CS.chartBox();
    area.append(h('div', { class: 'grid2' }, h('div', { class: 'col' }, CS.card('Comparação CA × CC', f.el), CS.card('Resultados', out)), h('div', { class: 'col' }, CS.card('Custo total × distância', cb), CS.card('LCC × VSC', K.table(['', 'LCC (tiristores)', 'VSC (IGBT)'], [['Potência', 'até 8–12 GW', 'até ~2–3 GW'], ['Reativos', 'consome (filtros + compensação)', 'controla P e Q independentemente'], ['Rede fraca / black start', 'não', 'sim'], ['Inversão de fluxo', 'invertendo a polaridade', 'invertendo a corrente (bom para cabos XLPE)'], ['Exemplos', 'Madeira–Araraquara (±600 kV), Belo Monte (±800 kV)', 'eólicas offshore, interligações multiterminais']])))));
    const ch = new MS.Chart(cb, { xlabel: 'distância [km]', ylabel: 'custo [M$]', includeOrigin: true, readout: (x, y) => `${K.n(x)} km\n${K.n(y)} M$` });
    function run() {
      const s = f.st, ds = K.linspace(0, 2000, 100), ac = d => s.tac + s.cac * d, dc = d => s.tdc + s.cdc * d, be = (s.tdc - s.tac) / (s.cac - s.cdc);
      ch.set({ series: [{ x: ds, y: ds.map(ac), color: '#4fb3ff', width: 2, name: 'CA' }, { x: ds, y: ds.map(dc), color: '#ffd166', width: 2, name: 'CC (HVDC)' }], vlines: be > 0 && be < 2000 ? [{ x: be, color: 'rgba(61,220,132,0.6)', label: 'equilíbrio' }] : [] });
      const Ic = d => 2 * Math.PI * 60 * s.Cc * 1e-6 * d * s.Vc * 1e3 / Math.sqrt(3), Lc = s.In / (2 * Math.PI * 60 * s.Cc * 1e-6 * s.Vc * 1e3 / Math.sqrt(3));
      out.innerHTML = '';
      out.append(CS.kv([['Distância de equilíbrio', be > 0 ? `<b>${K.n(be)} km</b> (acima disso, HVDC é mais econômico)` : 'CC sempre mais cara com esses dados'], ['Corrente de carregamento do cabo CA', `${K.n(Ic(1))} A/km`], ['Comprimento crítico do cabo CA', `<b>${K.n(Lc)} km</b> (toda a capacidade gasta com reativos)`], ['Vantagens do HVDC', 'menos condutores, sem limite de estabilidade/reativos, interliga sistemas assíncronos (50/60 Hz), controle rápido do fluxo']]));
    }
    run();
  }
  function secEquip(area) {
    area.append(CS.card('Equipamentos de alta tensão', K.table(['Equipamento', 'Função', 'Tecnologias / observações'], [
      ['Disjuntor', 'interrompe correntes de carga e de curto-circuito', 'SF₆ (puffer, autossopro), vácuo (até ~145 kV), ar comprimido (antigos); alternativas ao SF₆: g³ e ar seco'],
      ['Seccionadora', 'isola visivelmente um trecho (sem carga)', 'abertura central, dupla, pantográfica; lâmina de terra'],
      ['Para-raios (ZnO)', 'limita sobretensões atmosféricas e de manobra', 'varistores de óxido de zinco, invólucro polimérico ou de porcelana'],
      ['Transformador de corrente (TC)', 'reduz a corrente para medição e proteção', 'relações 600-5 A; classe de exatidão (0,3) e de proteção (10P20)'],
      ['Transformador de potencial (TP/TPC)', 'reduz a tensão para medição', 'indutivo ou capacitivo (TPC, também usado em carrier/PLC)'],
      ['Bucha (bushing)', 'passa o condutor através de paredes e tanques', 'condensiva (papel-óleo, RIP) para equalizar o campo'],
      ['Isoladores', 'suportam e isolam os condutores', 'vidro temperado, porcelana, poliméricos (silicone); distância de escoamento conforme a poluição'],
      ['Reator / banco de capacitores', 'compensação de reativos', 'reatores em derivação para linhas longas; SVC e STATCOM'],
      ['GIS (subestação isolada a gás)', 'subestação compacta blindada', 'SF₆ pressurizado: ~10% da área de uma convencional'],
      ['Cabos de AT', 'transmissão subterrânea/submarina', 'XLPE, óleo fluido; blindagem e aterramento das capas'],
      ['Transformador de potência', 'eleva/abaixa tensões', 'óleo mineral/vegetal, comutador sob carga (OLTC), monitoramento de gases dissolvidos (DGA)'],
    ])), CS.card('Ensaios em equipamentos de AT', K.table(['Ensaio', 'Objetivo'], [['Tensão aplicada (freq. industrial)', 'verificar a isolação principal'], ['Impulso atmosférico 1,2/50 µs e de manobra 250/2500 µs', 'suportabilidade a sobretensões'], ['Descargas parciais (pC)', 'detectar vazios e defeitos no isolante'], ['Fator de perdas tan δ e capacitância', 'envelhecimento e umidade da isolação'], ['Resistência de isolamento / índice de polarização', 'condição geral (megôhmetro 5–10 kV)'], ['Análise de gases dissolvidos (DGA)', 'falhas internas em transformadores']])));
  }

  CS.registerTab('pot', {
    title: 'Eletrônica de Potência',
    tools: [
      { id: 'ret', label: 'Retificadores', desc: 'diodo e SCR, mono e trifásico', render: toolRet },
      { id: 'dcdc', label: 'Conversores CC-CC', desc: 'buck, boost, buck-boost', render: toolDCDC },
      { id: 'inv', label: 'Inversores PWM', desc: 'SPWM, harmônicos, THD', render: toolInv },
      { id: 'semi', label: 'Semicondutores e perdas', desc: 'IGBT, SiC, GaN, dissipador', render: toolSemi },
      { id: 'at', label: 'Alta Tensão', desc: 'campo, Paschen, corona, impulso, HVDC', render: toolAT },
    ],
  });
})();
