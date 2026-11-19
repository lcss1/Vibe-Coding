/* ============================================================
   MecSPICE — Aba "Análise e projeto na frequência"
   Resposta em frequência · Bode · Nyquist
   ============================================================ */
'use strict';
(function () {
  const CS = MS.CS, h = CS.h, P = CS.poly, R = CS.rat, cx = CS.cx;
  const D2R = Math.PI / 180;

  /* ───────── cálculo de Bode ───────── */
  CS.bode = function (rat, w0, w1, n = 700) {
    const w = CS.logspace(w0, w1, n), mag = [], ph = [];
    let prev = null, off = 0;
    for (const wi of w) {
      const v = R.evalC(rat, { re: 0, im: wi });
      mag.push(20 * Math.log10(Math.max(cx.abs(v), 1e-300)));
      let a = cx.arg(v) * 180 / Math.PI;
      if (prev !== null) { while (a + off - prev > 180) off -= 360; while (a + off - prev < -180) off += 360; }
      a += off; ph.push(a); prev = a;
    }
    // alinhamento: fase em baixa frequência coerente com o nº de integradores
    return { w, mag, ph };
  };
  /* aproximação assintótica (retas) */
  CS.bodeAsym = function (rat, w) {
    const { z, p, k } = R.zpk(rat);
    const mag = [], ph = [];
    const phRoot = (r, wi) => {
      const wc = cx.abs(r);
      if (wc < 1e-12) return 90;
      const a0 = Math.atan2(-r.im, -r.re) * 180 / Math.PI, end = 90;   // ∠(jω − r): de ∠(−r) até +90°
      const lo = wc / 10, hi = wc * 10;
      if (wi <= lo) return a0; if (wi >= hi) return end;
      return a0 + (end - a0) * (Math.log10(wi / lo) / 2);
    };
    for (const wi of w) {
      let m = Math.log10(Math.abs(k));
      for (const r of z) m += Math.log10(Math.max(cx.abs(r), wi));
      for (const r of p) m -= Math.log10(Math.max(cx.abs(r), wi));
      mag.push(20 * m);
      let a = k < 0 ? 180 : 0;
      for (const r of z) a += phRoot(r, wi);
      for (const r of p) a -= phRoot(r, wi);
      ph.push(a);
    }
    return { mag, ph };
  };
  /* margens de ganho e de fase */
  CS.margins = function (rat, w0, w1) {
    const b = CS.bode(rat, w0, w1, 2000);
    const res = { gm: Infinity, pm: Infinity, wcg: null, wcp: null };
    const refine = (f, a, c) => { let fa = f(a); for (let i = 0; i < 60; i++) { const m = Math.sqrt(a * c), fm = f(m); if (Math.sign(fm) === Math.sign(fa)) { a = m; fa = fm; } else c = m; } return Math.sqrt(a * c); };
    const magAt = wv => 20 * Math.log10(cx.abs(R.evalC(rat, { re: 0, im: wv })));
    const phAt = (wv, ref) => { let a = cx.arg(R.evalC(rat, { re: 0, im: wv })) * 180 / Math.PI; while (a - ref > 180) a -= 360; while (a - ref < -180) a += 360; return a; };
    for (let i = 1; i < b.w.length; i++) {
      if (Math.sign(b.mag[i]) !== Math.sign(b.mag[i - 1])) {
        const wc = refine(magAt, b.w[i - 1], b.w[i]);
        const pm = 180 + phAt(wc, b.ph[i]);
        const pmN = ((pm + 180) % 360 + 360) % 360 - 180;
        if (Math.abs(pmN) < Math.abs(res.pm)) { res.pm = pmN; res.wcg = wc; }
      }
      const c0 = Math.floor((b.ph[i - 1] + 180) / 360), c1 = Math.floor((b.ph[i] + 180) / 360);
      if (c0 !== c1) {
        const k = Math.max(c0, c1), target = -180 + 360 * k;
        const wc = refine(wv => phAt(wv, b.ph[i]) - target, b.w[i - 1], b.w[i]);
        const gm = -magAt(wc);
        if (Math.abs(gm) < Math.abs(res.gm)) { res.gm = gm; res.wcp = wc; }
      }
    }
    return res;
  };

  const toolBode = (host, onClean) => {
    const { body } = CS.page(host, {
      title: 'Diagramas de Bode', lead: 'Módulo (dB) e fase (°) de G(jω) em escala logarítmica de frequência. Margens de ganho e de fase indicam o quão longe a malha está da instabilidade.',
      learn: `<p><b>Por que log:</b> em dB, produtos viram somas. O Bode de G₁·G₂ é a soma dos Bodes individuais, e cada fator vira um traçado simples de retas (assíntotas).</p>
      <p><b>Assíntotas</b> (linha tracejada):<br>• ganho K: reta de 20log|K| dB;<br>• integrador 1/s: −20 dB/déc e −90°;<br>• polo real 1/(s/ω<sub>c</sub>+1): 0 dB até ω<sub>c</sub>, depois −20 dB/déc; a fase vai de 0 a −90° entre ω<sub>c</sub>/10 e 10ω<sub>c</sub>;<br>• zero real: o espelho do polo (+20 dB/déc, +90°);<br>• par complexo: −40 dB/déc após ω<sub>n</sub>, com pico de ressonância se ζ &lt; 0,707.<br>O erro máximo da aproximação de um polo real é 3 dB, em ω = ω<sub>c</sub>.</p>
      <p><b>Margens</b> (da malha aberta L = KGH):<br>• <i>Margem de fase</i> MF = 180° + ∠L(jω<sub>cg</sub>), em que |L| = 0 dB;<br>• <i>Margem de ganho</i> MG = −|L(jω<sub>cp</sub>)|<sub>dB</sub>, em que ∠L = −180°.<br>Malha fechada estável (para L estável em malha aberta) ⇔ MG &gt; 0 e MF &gt; 0. Valores típicos de projeto: MF de 45° a 60°, MG &gt; 6 dB. Aproximação útil: ζ ≈ MF/100.</p>
      <p><b>Malha fechada:</b> a largura de banda (−3 dB) mede a rapidez e o pico M<sub>r</sub> mede a oscilação.</p>`,
    });
    const sb = h('div'); onClean(CS.sysBar(sb));
    const which = h('div', { class: 'seg' }, h('button', { 'data-w': 'L', class: 'on', title: 'L(s) = K·G(s)·H(s)' }, 'Malha aberta K·G·H'), h('button', { 'data-w': 'T', title: 'T(s) = KG/(1+KGH)' }, 'Malha fechada T'), h('button', { 'data-w': 'G', title: 'Somente a planta' }, 'G(s)'));
    const asy = h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: '' }), ' assíntotas');
    const mBox = CS.chartBox(), pBox = CS.chartBox();
    const info = h('div');
    body.append(CS.card(null, sb),
      h('div', { class: 'grid-rl' },
        CS.card(null, h('div', { class: 'row gap' }, which, asy), h('div', { class: 'bode-stack' }, mBox, pBox)),
        h('div', { class: 'col' }, CS.card('Margens e medidas', info))));
    let w = 'L';
    let mc, pc;
    const link = v => { mc && mc.setXView(v.x0, v.x1); pc && pc.setXView(v.x0, v.x1); };
    mc = new MS.Chart(mBox, { xlog: true, ylabel: '|G| [dB]', onView: link, readout: (x) => readAt(x) });
    pc = new MS.Chart(pBox, { xlog: true, ylabel: '∠G [°]', xlabel: 'ω [rad/s]', onView: link, readout: (x) => readAt(x) });
    let cur = null;
    const readAt = wv => { if (!cur) return ''; const v = R.evalC(cur, { re: 0, im: wv }); return `ω = ${CS.fmtNum(wv, 4)} rad/s\n|G| = ${CS.fmtNum(20 * Math.log10(cx.abs(v)), 4)} dB (${CS.fmtNum(cx.abs(v), 3)})\n∠G = ${CS.fmtNum(cx.arg(v) / D2R, 4)}°`; };
    which.addEventListener('click', e => { if (!e.target.dataset.w) return; w = e.target.dataset.w; which.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.w === w)); run(); });
    asy.querySelector('input').addEventListener('change', () => run());
    const run = () => {
      info.innerHTML = '';
      let s; try { s = CS.sys(); } catch (e) { info.append(h('div', { class: 'err' }, e.message)); return; }
      cur = w === 'L' ? s.L : w === 'T' ? s.T : s.G;
      const [w0, w1] = CS.freqRange(cur);
      const b = CS.bode(cur, w0, w1);
      // fase inicial consistente com ∠ em ω→0
      const ms = { series: [{ x: b.w, y: b.mag, color: '#4fb3ff', width: 2, name: '|G(jω)|' }], hlines: [{ y: 0, color: 'rgba(255,255,255,0.3)', dash: [3, 3] }], vlines: [], markers: [] };
      const ps = { series: [{ x: b.w, y: b.ph, color: '#ff9f1c', width: 2, name: '∠G(jω)' }], hlines: [], vlines: [], markers: [] };
      if (asy.querySelector('input').checked) {
        const a = CS.bodeAsym(cur, b.w);
        const sh = Math.round((b.ph[0] - a.ph[0]) / 360) * 360;
        ms.series.push({ x: b.w, y: a.mag, color: 'rgba(79,179,255,0.55)', dash: [6, 4], width: 1.3, name: 'assíntotas', noFit: true });
        ps.series.push({ x: b.w, y: a.ph.map(v => v + sh), color: 'rgba(255,159,28,0.55)', dash: [6, 4], width: 1.3, noFit: true });
      }
      const rows = [];
      if (w === 'L') {
        const mg = CS.margins(cur, w0, w1);
        for (let k = Math.ceil(Math.min(...b.ph) / 360 - 0.5); k <= Math.floor(Math.max(...b.ph) / 360 + 0.5); k++) ps.hlines.push({ y: -180 + 360 * k, color: 'rgba(255,77,109,0.45)', dash: [4, 4], label: '−180°' });
        if (mg.wcg) {
          ms.vlines.push({ x: mg.wcg, color: '#3ddc84', label: 'ω_cg' }); ps.vlines.push({ x: mg.wcg, color: '#3ddc84' });
          const phc = b.ph[b.w.findIndex(v => v >= mg.wcg)] ?? -180;
          ps.series.push({ x: [mg.wcg, mg.wcg], y: [phc, phc - mg.pm], color: '#3ddc84', width: 3, noFit: true });
        }
        if (mg.wcp) { ms.vlines.push({ x: mg.wcp, color: '#ff4d6d', label: 'ω_cp' }); ps.vlines.push({ x: mg.wcp, color: '#ff4d6d' }); ms.series.push({ x: [mg.wcp, mg.wcp], y: [0, -mg.gm], color: '#ff4d6d', width: 3, noFit: true }); }
        const olP = P.roots(cur.den), olRHP = olP.filter(p => p.re > 1e-9).length;
        rows.push(
          ['Margem de fase', mg.wcg ? `<b class="${mg.pm > 0 ? 'good' : 'bad'}">${CS.fmtNum(mg.pm, 4)}°</b> em ω<sub>cg</sub> = ${CS.fmtNum(mg.wcg, 4)} rad/s` : '∞ (|L| não cruza 0 dB)'],
          ['Margem de ganho', mg.wcp ? `<b class="${mg.gm > 0 ? 'good' : 'bad'}">${CS.fmtNum(mg.gm, 4)} dB</b> (×${CS.fmtNum(Math.pow(10, mg.gm / 20), 3)}) em ω<sub>cp</sub> = ${CS.fmtNum(mg.wcp, 4)} rad/s` : '∞ (fase não cruza −180°)'],
          ['ζ estimado (≈ MF/100)', mg.wcg && mg.pm > 0 && mg.pm < 70 ? CS.fmtNum(mg.pm / 100, 2) : '—'],
          ['Malha fechada', CS.stableText(P.roots(s.T.den)) + (olRHP ? `<br><span class="warn small">L tem ${olRHP} polo(s) instável(is): as margens não bastam, use Nyquist.</span>` : '')],
        );
      } else {
        const dc = 20 * Math.log10(Math.abs(R.dcGain(cur)));
        let pk = -Infinity, wpk = 0; b.mag.forEach((m, i) => { if (m > pk) { pk = m; wpk = b.w[i]; } });
        let bw = null; if (isFinite(dc)) { for (let i = 0; i < b.w.length; i++) if (b.mag[i] < dc - 3) { bw = b.w[i]; break; } }
        if (bw) { ms.vlines.push({ x: bw, color: '#c77dff', label: 'BW' }); ms.hlines.push({ y: dc - 3, color: 'rgba(199,125,255,0.5)', label: '−3 dB' }); }
        rows.push(['Ganho DC', isFinite(dc) ? CS.fmtNum(dc, 4) + ' dB' : '∞'], ['Largura de banda (−3 dB)', bw ? CS.fmtNum(bw, 4) + ' rad/s' : '—'],
          ['Pico de ressonância M<sub>r</sub>', pk > dc + 0.05 ? `${CS.fmtNum(pk - dc, 3)} dB em ω<sub>r</sub> = ${CS.fmtNum(wpk, 4)} rad/s` : 'sem pico']);
      }
      mc.set(ms); pc.set(ps);
      info.append(CS.kv(rows), h('div', { class: 'muted small' }, 'Roda do mouse dá zoom e arrastar move os gráficos (as escalas de ω ficam ligadas). Duplo-clique restaura.'));
    };
    const fn = () => run(); CS.onChange(fn); onClean(() => CS.offChange(fn));
    run();
  };

  /* ───────── Nyquist ───────── */
  CS.nyquist = function (L) {
    const poles = P.roots(L.den);
    const jw = poles.filter(p => Math.abs(p.re) < 1e-9 * Math.max(1, cx.abs(p)));
    const [w0, w1] = CS.freqRange(L);
    const Rbig = w1 * 10;
    const eps = Math.max(1e-6, Math.min(w0 / 10, ...jw.map(p => 1e-3 * Math.max(1, Math.abs(p.im))))) ;
    // contorno no sentido horário: −j∞ → +j∞ (eixo jω), arco grande de +j∞ a −j∞ pela direita
    const pts = [];   // {s, w (para leitura), part}
    const wGrid = [...CS.logspace(w0 / 10, Rbig, 900)];
    let axis = [...wGrid.map(v => -v), ...wGrid];
    for (const p of jw) for (const d of CS.logspace(eps * 1.01, Math.max(eps * 20, w0), 80)) axis.push(p.im - d, p.im + d);
    axis = axis.sort((a, b) => a - b);
    const near = (wv) => jw.find(p => Math.abs(wv - p.im) < eps * 1.0001);
    let prevW = null;
    const pushAxis = wv => pts.push({ s: { re: 0, im: wv }, w: wv, part: 'axis' });
    for (const wv of axis) {
      const p = jw.find(q => prevW !== null && ((prevW < q.im && wv > q.im) || Math.abs(prevW - q.im) < 1e-15));
      if (p && prevW !== null && prevW < p.im && wv > p.im) {
        // indentação: semicírculo pela direita em torno de jω_p
        for (let k = 0; k <= 60; k++) { const th = -Math.PI / 2 + Math.PI * k / 60; pts.push({ s: { re: eps * Math.cos(th), im: p.im + eps * Math.sin(th) }, w: p.im, part: 'indent' }); }
      }
      if (!near(wv)) pushAxis(wv);
      prevW = wv;
    }
    if (jw.some(p => Math.abs(p.im) < 1e-12) && !pts.some(q => q.part === 'indent')) {
      // polo na origem com malha simétrica (já coberto pelo laço acima); garantia
    }
    const arc = []; for (let k = 0; k <= 80; k++) { const th = Math.PI / 2 - Math.PI * k / 80; arc.push({ s: { re: Rbig * Math.cos(th), im: Rbig * Math.sin(th) }, part: 'arc' }); }
    const all = [...pts, ...arc];
    const vals = all.map(q => R.evalC(L, q.s));
    // número de voltas de 1+L em torno da origem (anti-horário positivo)
    let tot = 0;
    for (let i = 1; i < vals.length; i++) { let d = Math.atan2(vals[i].im, vals[i].re + 1) - Math.atan2(vals[i - 1].im, vals[i - 1].re + 1); while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; tot += d; }
    const ccw = Math.round(tot / (2 * Math.PI));
    const Pn = poles.filter(p => p.re > 1e-9).length;
    const N = -ccw;            // voltas no sentido horário
    return { all, vals, N, P: Pn, Z: N + Pn, jw, eps };
  };
  // compressão que preserva a escala dentro do círculo unitário: r' = r (r ≤ 1), 1 + log10(r) (r > 1)
  const compress = z => { const r = cx.abs(z); if (r <= 1) return z; const k = (1 + Math.log10(r)) / r; return { re: z.re * k, im: z.im * k }; };

  const toolNyquist = (host, onClean) => {
    const { body } = CS.page(host, {
      title: 'Critério de Nyquist', lead: 'Traça L(jω) = K·G·H no plano complexo e conta quantas vezes a curva envolve o ponto <b>−1</b>: <b>Z = N + P</b>.',
      learn: `<p><b>Princípio do argumento:</b> quando s percorre um contorno fechado no sentido horário, a curva 1 + L(s) envolve a origem N = Z − P vezes. Aqui Z = zeros de 1+L (os polos de malha fechada) e P = polos de 1+L (os polos de malha aberta) dentro do contorno.</p>
      <p><b>Contorno de Nyquist:</b> todo o eixo jω mais um semicírculo de raio ∞ envolvendo o semiplano direito. Polos sobre o eixo jω são contornados por pequenos semicírculos ("indentações"), que viram arcos de raio infinito no plano L.</p>
      <p><b>Envolver a origem por 1+L</b> equivale a <b>L envolver −1</b>. Portanto:</p>
      <p style="text-align:center"><b>Z = N + P</b><br>N = voltas horárias de L em torno de −1<br>P = polos de L no semiplano direito</p>
      <p>Malha fechada estável ⇔ Z = 0. Se L é estável (P = 0), a curva <i>não pode</i> envolver −1.</p>
      <p><b>Margens no plano de Nyquist:</b> a margem de ganho é 1/|a|, em que a é o ponto onde a curva cruza o eixo real negativo. A margem de fase é o ângulo entre −1 e o ponto onde |L| = 1 (círculo unitário).</p>
      <p><b>Compressão log:</b> quando a curva vai ao infinito (polos em jω), raios maiores que 1 são desenhados como 1 + log₁₀|L|. Dentro do círculo unitário, inclusive em torno de −1, a escala é a real. As voltas não mudam.</p>`,
    });
    const sb = h('div'); onClean(CS.sysBar(sb));
    const comp = h('label', { class: 'chk' }, h('input', { type: 'checkbox' }), ' compressão log do raio');
    const neg = h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: '' }), ' mostrar ω < 0 (espelho)');
    const box = CS.chartBox('tall'), info = h('div');
    body.append(CS.card(null, sb), h('div', { class: 'grid-rl' }, CS.card(null, h('div', { class: 'row gap' }, comp, neg), box), h('div', { class: 'col' }, CS.card('Contagem', info))));
    let ny = null;
    const ch = new MS.Chart(box, {
      equal: true, xlabel: 'Re L', ylabel: 'Im L', pad: 0.12,
      readout: (x, y) => {
        if (!ny) return '';
        let bi = -1, bd = Infinity;
        ny.disp.forEach((z, i) => { const d = Math.hypot(z.re - x, z.im - y); if (d < bd) { bd = d; bi = i; } });
        const v = ch.view; if (bi < 0 || bd > 0.05 * (v.x1 - v.x0)) return `(${CS.fmtNum(x, 3)}, ${CS.fmtNum(y, 3)})`;
        const q = ny.all[bi], z = ny.vals[bi];
        return `${q.part === 'axis' ? `ω = ${CS.fmtNum(q.w, 4)} rad/s` : q.part === 'indent' ? 'indentação (polo em jω)' : 'arco |s|→∞'}\nL = ${CS.fmtC(z, 3)}\n|L| = ${CS.fmtNum(cx.abs(z), 3)}, ∠ = ${CS.fmtNum(cx.arg(z) / D2R, 4)}°`;
      },
    });
    const run = () => {
      info.innerHTML = '';
      let s; try { s = CS.sys(); ny = CS.nyquist(s.L); } catch (e) { info.append(h('div', { class: 'err' }, e.message)); return; }
      const maxR = Math.max(...ny.vals.map(cx.abs).filter(isFinite));
      const auto = maxR > 60;
      if (auto && !comp.dataset.touched) comp.querySelector('input').checked = true;
      const useC = comp.querySelector('input').checked;
      ny.disp = ny.vals.map(z => (useC ? compress(z) : z));
      const pos = [], negp = [], other = [];
      ny.all.forEach((q, i) => { const z = ny.disp[i]; (q.part === 'axis' ? (q.w >= 0 ? pos : negp) : other).push([i, z]); });
      const ser = (arr, color, dash, arrows) => ({ x: arr.map(a => a[1].re), y: arr.map(a => a[1].im), color, dash, width: 2, arrows, breakAt: k => k > 0 && arr[k][0] !== arr[k - 1][0] + 1 });
      const m1 = useC ? compress({ re: -1, im: 0 }) : { re: -1, im: 0 };
      const circ = { x: [], y: [] }; for (let k = 0; k <= 120; k++) { const t = 2 * Math.PI * k / 120; const z = useC ? compress({ re: Math.cos(t), im: Math.sin(t) }) : { re: Math.cos(t), im: Math.sin(t) }; circ.x.push(z.re); circ.y.push(z.im); }
      const series = [{ ...circ, color: 'rgba(255,255,255,0.15)', dash: [3, 4], width: 1, noFit: true }, ser(pos, '#4fb3ff', [], 4)];
      if (neg.querySelector('input').checked) series.push(ser(negp, 'rgba(79,179,255,0.5)', [6, 4], 4));
      if (other.length) series.push(ser(other, 'rgba(255,159,28,0.8)', [2, 3], 0));
      ch.set({ series, markers: [{ x: m1.re, y: m1.im, shape: 'plus', color: '#ff4d6d', size: 8, label: '−1' }] });
      const clR = P.roots(P.add(s.L.den, s.L.num));
      const Zcl = clR.filter(p => p.re > 1e-9).length;
      const marg = Zcl === 0 && clR.some(p => Math.abs(p.re) <= 1e-7 * Math.max(1, cx.abs(p)));
      info.append(CS.kv([
        ['P (polos de L no SPD)', `<b>${ny.P}</b>`],
        ['N (voltas horárias em −1)', `<b>${ny.N}</b>`],
        ['Z = N + P', `<b class="${ny.Z === 0 ? 'good' : 'bad'}">${ny.Z}</b> polo(s) de malha fechada no SPD`],
        ['Veredito', marg ? '<b class="warn">Marginal: a curva passa sobre −1</b>' : ny.Z === 0 ? '<b class="good">Malha fechada estável</b>' : '<b class="bad">Malha fechada instável</b>'],
        ['Conferência pelas raízes', `${Zcl} polo(s) instável(is)`],
        ny.jw.length ? ['Polos de L em jω', ny.jw.map(p => CS.fmtC(p)).join(', ') + ' (indentados pela direita)'] : null,
      ]),
      h('div', { class: 'muted small' }, 'Linha cheia: ω de 0 a +∞; tracejada: ω < 0 (espelho); laranja pontilhada: indentações/arco infinito. Círculo pontilhado: |L| = 1.'));
    };
    comp.addEventListener('change', () => { comp.dataset.touched = 1; run(); });
    neg.addEventListener('change', run);
    const fn = () => { delete comp.dataset.touched; run(); }; CS.onChange(fn); onClean(() => CS.offChange(fn));
    run();
  };

  /* ───────── Resposta em frequência (conceito) ───────── */
  CS.simulateInput = function (r, u, tEnd, N = 1500) {
    const sys = CS.ss.fromTF(r), n = sys.n, hh = tEnd / N;
    const t = [], y = [], uu = [];
    if (!n) { for (let i = 0; i <= N; i++) { t.push(i * hh); uu.push(u(i * hh)); y.push(sys.D[0][0] * u(i * hh)); } return { t, y, u: uu }; }
    const M = CS.mat.zeros(n + 1, n + 1);
    for (let i = 0; i < n; i++) { for (let j = 0; j < n; j++) M[i][j] = sys.A[i][j] * hh; M[i][n] = sys.B[i][0] * hh; }
    const E = CS.mat.expm(M);
    let x = new Array(n).fill(0);
    for (let i = 0; i <= N; i++) {
      const ti = i * hh; t.push(ti); uu.push(u(ti));
      y.push(sys.C[0].reduce((s, c, k) => s + c * x[k], 0) + sys.D[0][0] * u(ti));
      const um = u(ti + hh / 2);
      const nx = new Array(n).fill(0);
      for (let a = 0; a < n; a++) { let s = E[a][n] * um; for (let b = 0; b < n; b++) s += E[a][b] * x[b]; nx[a] = s; }
      x = nx;
    }
    return { t, y, u: uu };
  };
  const toolFR = (host, onClean) => {
    const { body } = CS.page(host, {
      title: 'Resposta em frequência', lead: 'Uma senoide de frequência ω na entrada de um sistema linear estável gera, em regime, outra senoide de <b>mesma frequência</b>, com amplitude multiplicada por |G(jω)| e defasada de ∠G(jω).',
      learn: `<p><b>Por quê:</b> e<sup>jωt</sup> é autofunção dos sistemas lineares: sai G(jω)·e<sup>jωt</sup>. Uma senoide é a soma de duas exponenciais complexas.</p>
      <p><b>Transitório + regime:</b> logo após aplicar a senoide aparece também a resposta natural (os modos dos polos). Se o sistema é estável, ela se extingue e sobra apenas a senoide de regime.</p>
      <p><b>Como medir na prática:</b> aplique senos de várias frequências, meça a razão de amplitudes e a defasagem, e marque os pontos: é exatamente o diagrama de Bode.</p>
      <p><b>Leitura:</b> |G| &gt; 1 amplifica e |G| &lt; 1 atenua. Fase negativa significa que a saída se atrasa em relação à entrada (atraso de Δt = −∠G/ω).</p>`,
    });
    const sb = h('div'); onClean(CS.sysBar(sb));
    const which = h('div', { class: 'seg' }, h('button', { 'data-w': 'T', class: 'on' }, 'Malha fechada T'), h('button', { 'data-w': 'G', }, 'G(s)'));
    const sl = h('input', { type: 'range', min: 0, max: 1000, value: 500, class: 'k-slider' });
    const wv = h('span', { class: 'mono' });
    const tBox = CS.chartBox('tall'), bBox = CS.chartBox(), info = h('div');
    body.append(CS.card(null, sb),
      h('div', { class: 'grid-rl' },
        CS.card(null, h('div', { class: 'row gap center' }, which, h('b', {}, 'ω'), sl, wv), tBox),
        h('div', { class: 'col' }, CS.card('No ω escolhido', info), CS.card('Posição no Bode (módulo)', bBox))));
    let w = 'T';
    const tc = new MS.Chart(tBox, { xlabel: 't [s]', ylabel: 'sinais', readout: (t, y) => `t = ${CS.fmtNum(t)}\n${CS.fmtNum(y)}` });
    const bc = new MS.Chart(bBox, { xlog: true, ylabel: 'dB', xlabel: 'ω' });
    which.addEventListener('click', e => { if (!e.target.dataset.w) return; w = e.target.dataset.w; which.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.w === w)); run(); });
    sl.addEventListener('input', () => run(true));
    const run = (keepB) => {
      info.innerHTML = '';
      let s; try { s = CS.sys(); } catch (e) { info.append(h('div', { class: 'err' }, e.message)); return; }
      const G = w === 'T' ? s.T : s.G;
      const [w0, w1] = CS.freqRange(G);
      const om = Math.pow(10, Math.log10(w0 * 10) + (Math.log10(w1 / 10) - Math.log10(w0 * 10)) * sl.value / 1000);
      wv.textContent = `${CS.fmtNum(om, 3)} rad/s (${CS.fmtNum(om / (2 * Math.PI), 3)} Hz)`;
      const gv = R.evalC(G, { re: 0, im: om }), A = cx.abs(gv);
      // fase contínua (desenrolada desde baixas frequências), como no Bode
      const bb = CS.bode(G, Math.min(w0, om / 10), om, 300), ph = bb.ph[bb.ph.length - 1] * D2R;
      const stable = CS.polesStable(P.roots(G.den));
      const dom = CS.dominant(G);
      const settle = dom ? (dom.kind === 1 ? 5 * dom.tau : 4 / (dom.zeta * dom.wn)) : 0;
      const tEnd = Math.min(Math.max(6 * 2 * Math.PI / om, settle * 1.3), 400 * 2 * Math.PI / om);
      const sim = CS.simulateInput(G, t => Math.sin(om * t), tEnd, 2000);
      const yss = sim.t.map(t => A * Math.sin(om * t + ph));
      tc.set({ series: [
        { x: sim.t, y: sim.u, color: 'rgba(255,255,255,0.45)', width: 1.4, name: 'entrada sen(ωt)' },
        stable ? { x: sim.t, y: yss, color: 'rgba(61,220,132,0.6)', width: 1.2, dash: [5, 4], name: 'regime |G|sen(ωt+∠G)' } : null,
        { x: sim.t, y: sim.y, color: '#4fb3ff', width: 2, name: 'saída y(t)' }].filter(Boolean) });
      if (!keepB) { const b = CS.bode(G, w0, w1, 400); bc.set({ series: [{ x: b.w, y: b.mag, color: '#4fb3ff', width: 2 }], markers: [{ x: om, y: 20 * Math.log10(A), shape: 'dot', color: '#ffd166', size: 6 }] }); }
      else { bc.data.markers = [{ x: om, y: 20 * Math.log10(A), shape: 'dot', color: '#ffd166', size: 6 }]; bc.draw(); }
      info.append(CS.kv([
        ['|G(jω)|', `${CS.fmtNum(A, 4)} (${CS.fmtNum(20 * Math.log10(A), 4)} dB)`],
        ['∠G(jω)', `${CS.fmtNum(ph / D2R, 4)}°`],
        ['Atraso equivalente', `${CS.fmtNum(-ph / om, 3)} s`],
        ['Sistema', stable ? '<span class="good">estável: transitório desaparece</span>' : '<span class="bad">não estável: não há regime senoidal</span>'],
      ]));
    };
    const fn = () => run(); CS.onChange(fn); onClean(() => CS.offChange(fn));
    run();
  };

  CS.registerTab('freq', {
    title: 'Análise na frequência',
    tools: [
      { id: 'fresp', label: 'Resposta em frequência', desc: 'o que |G(jω)| e ∠G(jω) significam', render: toolFR },
      { id: 'bode', label: 'Diagramas de Bode', desc: 'assíntotas, margens, banda', render: toolBode },
      { id: 'nyquist', label: 'Critério de Nyquist', desc: 'Z = N + P', render: toolNyquist },
    ],
  });
})();
