/* ============================================================
   MeControlEng — Elétrica › Telecomunicações
   Sinais e amostragem · Modulação analógica · Modulação digital ·
   Enlaces e propagação · Linhas de transmissão e antenas ·
   Sistemas e redes
   ============================================================ */
'use strict';
(function () {
  const CS = MS.CS, h = CS.h, K = MS.MK;
  const E = MS.EL = MS.EL || {};
  const TAU = 2 * Math.PI;

  E.erfc = x => { const z = Math.abs(x), t = 1 / (1 + 0.5 * z); const r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277))))))))); return x >= 0 ? r : 2 - r; };
  E.Q = x => 0.5 * E.erfc(x / Math.SQRT2);
  E.besselJ = (n, b) => { const M = 400; let s = 0; for (let i = 0; i <= M; i++) { const t = Math.PI * i / M, w = i === 0 || i === M ? 1 : i % 2 ? 4 : 2; s += w * Math.cos(n * t - b * Math.sin(t)); } return s * (Math.PI / M) / 3 / Math.PI; };
  const gauss = () => { let u = 0; while (!u) u = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * Math.random()); };
  const stems = (fx, ay) => { const x = [], y = []; fx.forEach((f, i) => { x.push(f, f, NaN); y.push(0, ay[i], NaN); }); return { x, y }; };
  const dB = x => 10 * Math.log10(x);
  /* números complexos mínimos */
  const C = { add: (a, b) => [a[0] + b[0], a[1] + b[1]], sub: (a, b) => [a[0] - b[0], a[1] - b[1]], mul: (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]], div: (a, b) => { const d = b[0] * b[0] + b[1] * b[1]; return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d]; }, abs: a => Math.hypot(a[0], a[1]), exp: th => [Math.cos(th), Math.sin(th)] };
  E.C = C;

  /* ════════════════ 1. SINAIS E AMOSTRAGEM ════════════════ */
  const toolSinais = (host, onClean) => {
    const { body } = CS.page(host, {
      title: 'Sinais, Fourier e amostragem', lead: 'Síntese de Fourier (fenômeno de Gibbs), amostragem e <i>aliasing</i> (teorema de Nyquist) e quantização (SQNR).',
      learn: `<p><b>Série de Fourier:</b> todo sinal periódico é uma soma de senoides nas frequências múltiplas da fundamental. A onda quadrada contém só harmônicos ímpares com amplitude 4/(πn); a triangular, ímpares com 8/(π²n²) (converge muito mais rápido).</p>
      <p><b>Fenômeno de Gibbs:</b> perto das descontinuidades a soma parcial ultrapassa o valor em ≈ 9%, qualquer que seja o número de termos.</p>
      <p><b>Teorema da amostragem (Nyquist-Shannon):</b> um sinal limitado em banda a f<sub>máx</sub> é reconstruído exatamente se f<sub>s</sub> &gt; 2·f<sub>máx</sub>. Abaixo disso ocorre <b>aliasing</b>: a frequência aparece "dobrada" em |f − k·f<sub>s</sub>|. Por isso os ADCs têm um filtro anti-aliasing antes da amostragem.</p>
      <p><b>Quantização:</b> com n bits, a relação sinal-ruído de quantização de uma senoide em escala cheia é SQNR ≈ 6,02·n + 1,76 dB (áudio de CD: 16 bits → 98 dB).</p>`,
    });
    onClean(K.sections(body, 'sinais', [{ id: 'fourier', label: 'Série de Fourier', render: secFourier }, { id: 'amostra', label: 'Amostragem e aliasing', render: secAmostra }, { id: 'quant', label: 'Quantização', render: secQuant }]));
  };
  const FOUR = { sq: ['Quadrada', n => (n % 2 ? 4 / (Math.PI * n) : 0), 0], tri: ['Triangular', n => (n % 2 ? 8 / (Math.PI * Math.PI * n * n) * (((n - 1) / 2) % 2 ? -1 : 1) : 0), 0], saw: ['Dente de serra', n => 2 / (Math.PI * n) * (n % 2 ? 1 : -1), 0], ret: ['Retificada (onda completa)', n => (n % 2 ? 0 : -4 / (Math.PI * (n * n - 1))), 2 / Math.PI] };
  function secFourier(area) {
    const f = K.form([{ k: 'w', l: 'Forma de onda', type: 'sel', v: 'sq', opts: Object.entries(FOUR).map(([k, v]) => [k, v[0]]) }, { k: 'N', l: 'Número de harmônicos', u: '', v: '7' }], () => run(), { cols: 2 });
    const b1 = CS.chartBox(), b2 = CS.chartBox('sm'), out = h('div');
    area.append(h('div', { class: 'grid2' }, h('div', { class: 'col' }, CS.card('Síntese', f.el, out), CS.card('Espectro de amplitudes', b2)), CS.card('Soma parcial', b1)));
    const c1 = new MS.Chart(b1, { xlabel: 't / T', ylabel: 'amplitude', readout: (x, y) => `${K.n(x)}\n${K.n(y)}` }), c2 = new MS.Chart(b2, { xlabel: 'harmônico', ylabel: '|cₙ|', includeOrigin: true, readout: (x, y) => `n = ${Math.round(x)}\n${K.n(y)}` });
    function run() {
      const [, co, dc] = FOUR[f.st.w], N = Math.max(1, Math.min(200, Math.round(f.st.N))), ts = K.linspace(0, 2, 1200);
      const fn = f.st.w === 'ret' ? (t => dc + [...Array(N)].reduce((s, _, k) => s + co(2 * (k + 1)) * Math.cos(TAU * (k + 1) * t), 0)) : (t => [...Array(N)].reduce((s, _, k) => { const n = k + 1, a = co(n); return s + (f.st.w === 'tri' ? a * Math.sin(TAU * n * t) : a * Math.sin(TAU * n * t)); }, 0));
      const ideal = { sq: t => (t % 1 < 0.5 ? 1 : -1), tri: t => { const u = (t + 0.25) % 1; return u < 0.5 ? 4 * u - 1 : 3 - 4 * u; }, saw: t => { const u = (t + 0.5) % 1; return 2 * u - 1; }, ret: t => Math.abs(Math.sin(Math.PI * t)) }[f.st.w];
      const y = ts.map(fn);
      c1.set({ series: [{ x: ts, y: ts.map(ideal), color: 'rgba(159,180,208,0.45)', width: 1.2, name: 'ideal' }, { x: ts, y, color: '#ffd166', width: 2, name: `${N} termos` }] });
      const ns = [...Array(f.st.w === 'ret' ? N : N)].map((_, k) => (f.st.w === 'ret' ? 2 * (k + 1) : k + 1)), st = stems(ns, ns.map(n => Math.abs(co(n))));
      c2.set({ series: [{ x: st.x, y: st.y, color: '#4fb3ff', width: 4 }] });
      out.innerHTML = '';
      out.append(CS.kv([['Valor máximo da soma', `${K.n(Math.max(...y), 4)}`], f.st.w === 'sq' || f.st.w === 'saw' ? ['Sobressinal (Gibbs)', `${K.n((Math.max(...y) - 1) * 100, 3)} % (→ 8,95% para N → ∞)`] : null, ['Decaimento dos coeficientes', f.st.w === 'tri' || f.st.w === 'ret' ? '1/n² (sinal contínuo)' : '1/n (sinal com saltos)']]));
    }
    run();
  }
  function secAmostra(area) {
    const f = K.form([{ k: 'f', l: 'Frequência do sinal', u: 'Hz', v: '9' }, { k: 'fs', l: 'Frequência de amostragem', u: 'Hz', v: '10' }], () => run(), { cols: 2 });
    const out = h('div'), b1 = CS.chartBox('tall'), b2 = CS.chartBox('sm');
    area.append(h('div', { class: 'grid2' }, h('div', { class: 'col' }, CS.card('Amostragem', f.el, out), CS.card('Frequência aparente × frequência real', b2)), CS.card('Sinal, amostras e senoide reconstruída', b1)));
    const c1 = new MS.Chart(b1, { xlabel: 't [s]', ylabel: '', readout: (x, y) => `${K.n(x)} s\n${K.n(y)}` }), c2 = new MS.Chart(b2, { xlabel: 'f real [Hz]', ylabel: 'f aparente [Hz]', includeOrigin: true, readout: (x, y) => `${K.n(x)} Hz → ${K.n(y)} Hz` });
    function run() {
      const { f: fr, fs } = f.st, fa = Math.abs(fr - Math.round(fr / fs) * fs), T = Math.max(3 / Math.max(fa, 0.2), 4 / fr, 1);
      const ts = K.linspace(0, Math.min(T, 4), 2000), n = Math.floor(Math.min(T, 4) * fs), sx = [...Array(n + 1)].map((_, i) => i / fs);
      const sgn = Math.sign(Math.sin(TAU * fr / fs)) || 1;
      c1.set({ series: [{ x: ts, y: ts.map(t => Math.sin(TAU * fr * t)), color: 'rgba(79,179,255,0.6)', width: 1.4, name: `real ${fr} Hz` }, { x: ts, y: ts.map(t => sgn * Math.sin(TAU * fa * t) * (fa === 0 ? 0 : 1)), color: '#ff4d6d', width: 2, dash: [6, 4], name: `reconstruída ${K.n(fa)} Hz` }], markers: sx.map(t => ({ x: t, y: Math.sin(TAU * fr * t), shape: 'dot', color: '#ffd166', size: 5 })) });
      const fs2 = K.linspace(0, 3 * fs, 600);
      c2.set({ series: [{ x: fs2, y: fs2.map(x => Math.abs(x - Math.round(x / fs) * fs)), color: '#3ddc84', width: 2 }], vlines: [{ x: fs / 2, color: 'rgba(255,209,102,0.6)', label: 'fs/2' }], markers: [{ x: fr, y: fa, shape: 'dot', color: '#ff4d6d', size: 6 }] });
      out.innerHTML = '';
      out.append(CS.kv([['Frequência de Nyquist f<sub>s</sub>/2', `${K.n(fs / 2)} Hz`], ['Situação', fr < fs / 2 ? '<b class="good">amostragem correta (f &lt; f<sub>s</sub>/2)</b>' : '<b class="bad">aliasing!</b>'], ['Frequência aparente', `<b>${K.n(fa)} Hz</b>`], ['Amostras por período', K.n(fs / fr, 3)]]), h('div', { class: 'muted small' }, 'Experimente f = 9 Hz e fs = 10 Hz: as amostras descrevem uma senoide de 1 Hz. É o mesmo efeito das rodas de carro que parecem girar ao contrário nos vídeos.'));
    }
    run();
  }
  function secQuant(area) {
    const f = K.form([{ k: 'n', l: 'Bits do conversor', u: '', v: '3' }, { k: 'A', l: 'Amplitude do sinal (fração da escala)', u: '', v: '1' }], () => run(), { cols: 2 });
    const out = h('div'), b1 = CS.chartBox(), b2 = CS.chartBox('sm');
    area.append(h('div', { class: 'grid2' }, h('div', { class: 'col' }, CS.card('Quantização uniforme', f.el, out), CS.card('Erro de quantização', b2)), CS.card('Sinal original e quantizado', b1)));
    const c1 = new MS.Chart(b1, { xlabel: 't', ylabel: 'amplitude', readout: (x, y) => `${K.n(x)}\n${K.n(y)}` }), c2 = new MS.Chart(b2, { xlabel: 't', ylabel: 'erro', readout: (x, y) => `${K.n(x)}\n${K.n(y)}` });
    function run() {
      const n = Math.max(1, Math.min(16, Math.round(f.st.n))), L = 2 ** n, q = 2 / L, ts = K.linspace(0, 1, 1000);
      const x = ts.map(t => f.st.A * Math.sin(TAU * t)), xq = x.map(v => Math.max(-1 + q / 2, Math.min(1 - q / 2, (Math.floor(v / q) + 0.5) * q)));
      const err = x.map((v, i) => xq[i] - v), Ps = x.reduce((s, v) => s + v * v, 0) / x.length, Pn = err.reduce((s, v) => s + v * v, 0) / err.length;
      c1.set({ series: [{ x: ts, y: x, color: 'rgba(79,179,255,0.6)', width: 1.5 }, { x: ts, y: xq, color: '#ffd166', width: 2 }] });
      c2.set({ series: [{ x: ts, y: err, color: '#ff4d6d', width: 1.4 }], hlines: [{ y: q / 2, color: 'rgba(159,180,208,0.4)' }, { y: -q / 2, color: 'rgba(159,180,208,0.4)' }] });
      out.innerHTML = '';
      out.append(CS.kv([['Níveis', L], ['Passo q', `${K.n(q / 2 * 100, 3)} % da amplitude máxima`], ['SQNR medida', `<b>${K.n(dB(Ps / Pn), 3)} dB</b>`], ['SQNR teórica (6,02n + 1,76)', `${K.n(6.02 * n + 1.76, 3)} dB`], ['Taxa de bits (áudio 44,1 kHz)', `${K.n(44.1 * n, 4)} kbps por canal`]]));
    }
    run();
  }

  /* ════════════════ 2. MODULAÇÃO ANALÓGICA ════════════════ */
  const toolAnalog = (host, onClean) => {
    const { body } = CS.page(host, {
      title: 'Modulação analógica (AM e FM)', lead: 'Formas de onda e espectros de AM (índice de modulação, sobremodulação, eficiência) e FM (índice β, raias de Bessel e regra de Carson).',
      learn: `<p><b>Modulação</b> desloca a informação (mensagem) para uma frequência alta (portadora), adequada às antenas e ao compartilhamento do espectro.</p>
      <p><b>AM-DSB:</b> s(t) = A<sub>c</sub>[1 + m·cos(ω<sub>m</sub>t)]·cos(ω<sub>c</sub>t). Espectro: portadora + duas bandas laterais em f<sub>c</sub> ± f<sub>m</sub>; banda B = 2f<sub>m</sub>. Com m &gt; 1 há <b>sobremodulação</b> e o detector de envoltória distorce. Eficiência η = m²/(2 + m²) ≤ 33%: a maior parte da potência fica na portadora (por isso existem DSB-SC e SSB).</p>
      <p><b>FM:</b> a frequência instantânea varia com a mensagem: f = f<sub>c</sub> + Δf·cos(ω<sub>m</sub>t). Índice β = Δf/f<sub>m</sub>. O espectro tem infinitas raias em f<sub>c</sub> ± n·f<sub>m</sub> com amplitudes J<sub>n</sub>(β) (funções de Bessel). <b>Regra de Carson:</b> B ≈ 2(Δf + f<sub>m</sub>). FM é mais imune a ruído de amplitude: rádio FM comercial usa Δf = 75 kHz e canais de 200 kHz.</p>`,
    });
    onClean(K.sections(body, 'anal', [{ id: 'am', label: 'AM', render: secAM }, { id: 'fm', label: 'FM', render: secFM }]));
  };
  function secAM(area) {
    const f = K.form([{ k: 'm', l: 'Índice de modulação m', u: '', v: '0.7' }, { k: 'fc', l: 'Portadora f<sub>c</sub>', u: 'kHz', v: '20' }, { k: 'fm', l: 'Mensagem f<sub>m</sub>', u: 'kHz', v: '1' }, { k: 'tipo', l: 'Tipo', type: 'sel', v: 'dsb', opts: [['dsb', 'AM-DSB (com portadora)'], ['sc', 'DSB-SC (portadora suprimida)'], ['ssb', 'SSB (banda lateral superior)']] }], () => run(), { cols: 2 });
    const out = h('div'), b1 = CS.chartBox(), b2 = CS.chartBox('sm');
    area.append(h('div', { class: 'grid2' }, h('div', { class: 'col' }, CS.card('Modulador', f.el, out), CS.card('Espectro', b2)), CS.card('Sinal modulado e envoltória', b1)));
    const c1 = new MS.Chart(b1, { xlabel: 't [ms]', ylabel: '', readout: (x, y) => `${K.n(x)} ms\n${K.n(y)}` }), c2 = new MS.Chart(b2, { xlabel: 'f [kHz]', ylabel: 'amplitude', includeOrigin: true, readout: (x, y) => `${K.n(x)} kHz\n${K.n(y)}` });
    function run() {
      const { m, fc, fm } = f.st, ts = K.linspace(0, 2 / fm, 3000), t = f.st.tipo;
      const s = ts.map(x => t === 'dsb' ? (1 + m * Math.cos(TAU * fm * x)) * Math.cos(TAU * fc * x) : t === 'sc' ? m * Math.cos(TAU * fm * x) * Math.cos(TAU * fc * x) : m / 2 * Math.cos(TAU * (fc + fm) * x));
      const env = ts.map(x => t === 'dsb' ? 1 + m * Math.cos(TAU * fm * x) : t === 'sc' ? Math.abs(m * Math.cos(TAU * fm * x)) : m / 2);
      c1.set({ series: [{ x: ts, y: s, color: '#4fb3ff', width: 1 }, { x: ts, y: env, color: '#ffd166', width: 2, name: 'envoltória' }, { x: ts, y: env.map(v => -v), color: '#ffd166', width: 2 }] });
      const fr = t === 'dsb' ? [fc - fm, fc, fc + fm] : t === 'sc' ? [fc - fm, fc + fm] : [fc + fm], am = t === 'dsb' ? [m / 2, 1, m / 2] : t === 'sc' ? [m / 2, m / 2] : [m / 2], st = stems(fr, am);
      c2.set({ series: [{ x: st.x, y: st.y, color: '#ff9f1c', width: 4 }] });
      const eta = m * m / (2 + m * m);
      out.innerHTML = '';
      out.append(CS.kv([['Banda ocupada', `${K.n(t === 'ssb' ? fm : 2 * fm)} kHz`], t === 'dsb' ? ['Eficiência de potência', `${K.n(eta * 100, 3)} %`] : ['Eficiência de potência', '100% (sem portadora)'], ['Sobremodulação', t === 'dsb' && m > 1 ? '<b class="bad">sim: a envoltória cruza o zero e o detector distorce</b>' : 'não'], ['Demodulação', t === 'dsb' ? 'detector de envoltória (diodo + RC)' : 'detecção coerente (precisa recuperar a portadora)']]));
    }
    run();
  }
  function secFM(area) {
    const f = K.form([{ k: 'b', l: 'Índice β = Δf/f<sub>m</sub>', u: '', v: '2.4' }, { k: 'fc', l: 'Portadora f<sub>c</sub>', u: 'kHz', v: '20' }, { k: 'fm', l: 'Mensagem f<sub>m</sub>', u: 'kHz', v: '1' }], () => run(), { cols: 2 });
    const out = h('div'), b1 = CS.chartBox(), b2 = CS.chartBox('sm'), b3 = CS.chartBox('sm');
    area.append(h('div', { class: 'grid2' }, h('div', { class: 'col' }, CS.card('Modulador FM', f.el, out), CS.card('Espectro (raias de Bessel)', b2)), h('div', { class: 'col' }, CS.card('Sinal FM e mensagem', b1), CS.card('J<sub>n</sub>(β) × β', b3))));
    const c1 = new MS.Chart(b1, { xlabel: 't [ms]', ylabel: '', readout: (x, y) => `${K.n(x)} ms\n${K.n(y)}` }), c2 = new MS.Chart(b2, { xlabel: 'f [kHz]', ylabel: '|Jn(β)|', includeOrigin: true, readout: (x, y) => `${K.n(x)} kHz\n${K.n(y)}` }), c3 = new MS.Chart(b3, { xlabel: 'β', ylabel: 'Jn', readout: (x, y) => `β = ${K.n(x)}\n${K.n(y)}` });
    function run() {
      const { b, fc, fm } = f.st, ts = K.linspace(0, 2 / fm, 3000);
      c1.set({ series: [{ x: ts, y: ts.map(x => Math.cos(TAU * fc * x + b * Math.sin(TAU * fm * x))), color: '#4fb3ff', width: 1 }, { x: ts, y: ts.map(x => 1.3 * Math.cos(TAU * fm * x)), color: '#ffd166', width: 2, name: 'mensagem' }] });
      const nmax = Math.ceil(b + 4), fr = [], am = [];
      for (let n = -nmax; n <= nmax; n++) { fr.push(fc + n * fm); am.push(Math.abs(E.besselJ(Math.abs(n), b))); }
      const st = stems(fr, am); c2.set({ series: [{ x: st.x, y: st.y, color: '#ff9f1c', width: 4 }], vlines: [{ x: fc - (b + 1) * fm, color: 'rgba(61,220,132,0.5)', label: 'Carson' }, { x: fc + (b + 1) * fm, color: 'rgba(61,220,132,0.5)' }] });
      const bs = K.linspace(0, 10, 200);
      c3.set({ series: [0, 1, 2, 3].map(n => ({ x: bs, y: bs.map(x => E.besselJ(n, x)), color: ['#ffd166', '#4fb3ff', '#3ddc84', '#c77dff'][n], width: 1.8, name: `J${n}` })), vlines: [{ x: b, color: 'rgba(255,255,255,0.4)' }] });
      const J0 = E.besselJ(0, b), sig = am.filter(a => a >= 0.01).length;
      out.innerHTML = '';
      out.append(CS.kv([['Desvio de frequência Δf', `${K.n(b * fm)} kHz`], ['Banda de Carson 2(Δf + f<sub>m</sub>)', `<b>${K.n(2 * (b + 1) * fm)} kHz</b>`], ['Raias significativas (≥ 1%)', sig], ['Potência na portadora J₀²', `${K.n(J0 * J0 * 100, 3)} %`], Math.abs(J0) < 0.02 ? ['Observação', '<b class="good">portadora nula (β ≈ 2,405): usado para calibrar desvios!</b>'] : null]));
    }
    run();
  }

  /* ════════════════ 3. MODULAÇÃO DIGITAL ════════════════ */
  E.constel = M => {
    if (M === 2) return [[-1, 0], [1, 0]];
    if (M === 4 || M === 8) return [...Array(M)].map((_, i) => C.exp(TAU * i / M + (M === 4 ? Math.PI / 4 : 0)));
    const L = Math.sqrt(M), pts = []; for (let i = 0; i < L; i++) for (let j = 0; j < L; j++) pts.push([2 * i - L + 1, 2 * j - L + 1]);
    const es = pts.reduce((s, p) => s + p[0] * p[0] + p[1] * p[1], 0) / M; return pts.map(p => [p[0] / Math.sqrt(es), p[1] / Math.sqrt(es)]);
  };
  E.berTheory = (mod, ebn0) => {
    const g = 10 ** (ebn0 / 10);
    if (mod === 'bpsk' || mod === 'qpsk') return E.Q(Math.sqrt(2 * g));
    if (mod === 'bfsk' || mod === 'ask') return E.Q(Math.sqrt(g));
    if (mod === '8psk') return 2 / 3 * E.Q(Math.sqrt(2 * 3 * g) * Math.sin(Math.PI / 8));
    const M = mod === '16qam' ? 16 : 64, k = Math.log2(M); return 4 / k * (1 - 1 / Math.sqrt(M)) * E.Q(Math.sqrt(3 * k * g / (M - 1)));
  };
  const MODS = { bpsk: ['BPSK', 2], qpsk: ['QPSK', 4], '8psk': ['8-PSK', 8], '16qam': ['16-QAM', 16], '64qam': ['64-QAM', 64] };
  const toolDigital = (host, onClean) => {
    const { body } = CS.page(host, {
      title: 'Modulação digital', lead: 'Formas de onda ASK/FSK/PSK para uma sequência de bits, constelações com ruído (AWGN) e curvas de taxa de erro de bit (BER × E<sub>b</sub>/N₀).',
      learn: `<p>Na modulação digital, cada <b>símbolo</b> carrega log₂M bits, escolhendo amplitude (ASK), frequência (FSK), fase (PSK) ou amplitude e fase (QAM) da portadora.</p>
      <p><b>Constelação:</b> representa os símbolos no plano I/Q (em fase e quadratura). O ruído espalha os pontos; o receptor decide pelo símbolo mais próximo. Usa-se <b>código Gray</b> (vizinhos diferem em 1 bit), de modo que um erro de símbolo costuma gerar só 1 bit errado.</p>
      <p><b>Compromisso:</b> M maior → mais bits/s por Hz (eficiência espectral), mas os pontos ficam mais próximos e exigem mais E<sub>b</sub>/N₀ para a mesma BER. O Wi-Fi e o 4G/5G usam <b>modulação adaptativa</b>: 64/256/1024-QAM com sinal forte e QPSK com sinal fraco.</p>
      <p><b>BER de BPSK/QPSK:</b> P<sub>b</sub> = Q(√(2E<sub>b</sub>/N₀)). Para P<sub>b</sub> = 10⁻⁶ são necessários ≈ 10,5 dB.</p>`,
    });
    onClean(K.sections(body, 'dig', [{ id: 'ondas', label: 'Formas de onda', render: secOndasDig }, { id: 'const', label: 'Constelação e ruído', render: secConst }, { id: 'ber', label: 'BER × Eb/N0', render: secBER }]));
  };
  function secOndasDig(area) {
    const bits = h('input', { value: '1011001', class: 'tf-input', style: 'max-width:240px' });
    const b1 = CS.chartBox('sm'), b2 = CS.chartBox('sm'), b3 = CS.chartBox('sm'), b4 = CS.chartBox('sm');
    area.append(h('div', { class: 'row gap' }, h('span', {}, 'Bits:'), bits), h('div', { class: 'grid2' }, CS.card('Dados (NRZ)', b1), CS.card('ASK (OOK)', b2), CS.card('FSK', b3), CS.card('BPSK', b4)));
    const mk = b => new MS.Chart(b, { xlabel: 'tempo de bit', ylabel: '', yrange: [-1.4, 1.4], readout: (x, y) => `${K.n(x)}\n${K.n(y)}` });
    const cs = [mk(b1), mk(b2), mk(b3), mk(b4)];
    function run() {
      const bs = (bits.value.replace(/[^01]/g, '') || '1').split('').map(Number), n = bs.length, ts = K.linspace(0, n, n * 120);
      const bit = t => bs[Math.min(n - 1, Math.floor(t))], fc = 3;
      cs[0].set({ series: [{ x: ts, y: ts.map(t => bit(t)), color: '#ffd166', width: 2 }], texts: bs.map((b, i) => ({ x: i + 0.45, y: 1.2, text: String(b), color: '#c3d3e8' })) });
      cs[1].set({ series: [{ x: ts, y: ts.map(t => bit(t) * Math.sin(TAU * fc * t)), color: '#4fb3ff', width: 1.5 }] });
      cs[2].set({ series: [{ x: ts, y: ts.map(t => Math.sin(TAU * (bit(t) ? 4 : 2) * t)), color: '#3ddc84', width: 1.5 }] });
      cs[3].set({ series: [{ x: ts, y: ts.map(t => Math.sin(TAU * fc * t + (bit(t) ? 0 : Math.PI))), color: '#c77dff', width: 1.5 }] });
    }
    bits.addEventListener('input', run); run();
  }
  function secConst(area) {
    const f = K.form([{ k: 'mod', l: 'Modulação', type: 'sel', v: '16qam', opts: Object.entries(MODS).map(([k, v]) => [k, v[0]]) }, { k: 'eb', l: 'E<sub>b</sub>/N₀', u: 'dB', v: '12' }, { k: 'N', l: 'Símbolos simulados', u: '', v: '3000' }], () => run(), { cols: 1 });
    const out = h('div'), cb = CS.chartBox('tall');
    area.append(h('div', { class: 'grid2' }, h('div', { class: 'col' }, CS.card('Canal AWGN', f.el, h('button', { class: 'btn sm', onclick: () => run() }, '↻ nova realização')), CS.card('Resultados (Monte Carlo × teoria)', out)), CS.card('Diagrama de constelação (I × Q)', cb)));
    const ch = new MS.Chart(cb, { equal: true, xlabel: 'I', ylabel: 'Q', readout: (x, y) => `I = ${K.n(x)}\nQ = ${K.n(y)}` });
    function run() {
      const [nm, M] = MODS[f.st.mod], k = Math.log2(M), pts = E.constel(M), N = Math.max(100, Math.min(20000, Math.round(f.st.N)));
      const sig = Math.sqrt(1 / (2 * k * 10 ** (f.st.eb / 10)));
      const rx = [], ry = []; let se = 0;
      for (let i = 0; i < N; i++) {
        const s = Math.floor(Math.random() * M), p = pts[s], r = [p[0] + sig * gauss(), M === 2 ? p[1] + sig * gauss() : p[1] + sig * gauss()];
        if (i < 4000) { rx.push(r[0]); ry.push(r[1]); }
        let best = 0, bd = Infinity; pts.forEach((q, j) => { const d = (q[0] - r[0]) ** 2 + (q[1] - r[1]) ** 2; if (d < bd) { bd = d; best = j; } });
        if (best !== s) se++;
      }
      const ser = se / N, ber = E.berTheory(f.st.mod, f.st.eb);
      ch.set({ series: [], markers: pts.map(p => ({ x: p[0], y: p[1], shape: 'plus', color: '#ffd166', size: 6 })).concat(rx.slice(0, 1500).map((x, i) => ({ x, y: ry[i], shape: 'dot', color: 'rgba(79,179,255,0.45)', size: 2.5, noFit: true }))) });
      out.innerHTML = '';
      out.append(CS.kv([['Bits por símbolo', `${k} (${nm})`], ['Eficiência espectral (ideal)', `${k} bit/s/Hz`], ['Taxa de erro de símbolo (simulada)', `<b>${ser === 0 ? '< ' + K.n(1 / N, 2) : K.n(ser, 3)}</b>`], ['BER aproximada (SER/k, código Gray)', ser === 0 ? '—' : K.n(ser / k, 3)], ['BER teórica', K.n(ber, 3)]]));
    }
    run();
  }
  function secBER(area) {
    const f = K.form([{ k: 'alvo', l: 'BER desejada', type: 'sel', v: '1e-6', opts: ['1e-3', '1e-4', '1e-5', '1e-6', '1e-9'] }], () => run(), { cols: 1 });
    const out = h('div'), cb = CS.chartBox('tall');
    area.append(h('div', { class: 'grid2' }, h('div', { class: 'col' }, CS.card('Requisito', f.el), CS.card('E<sub>b</sub>/N₀ necessário', out)), CS.card('Curvas de BER (canal AWGN, detecção coerente)', cb)));
    const ch = new MS.Chart(cb, { ylog: true, xlabel: 'Eb/N0 [dB]', ylabel: 'BER', yrange: [1e-10, 0.5], readout: (x, y) => `${K.n(x)} dB\nBER ${K.n(y, 3)}` });
    const all = { bpsk: 'BPSK/QPSK', bfsk: 'BFSK / OOK', '8psk': '8-PSK', '16qam': '16-QAM', '64qam': '64-QAM' }, cols = ['#ffd166', '#ff4d6d', '#3ddc84', '#4fb3ff', '#c77dff'];
    function run() {
      const xs = K.linspace(0, 24, 200), alvo = +f.st.alvo;
      ch.set({ series: Object.entries(all).map(([m, nm], i) => ({ x: xs, y: xs.map(x => E.berTheory(m, x)), color: cols[i], width: 2, name: nm })), hlines: [{ y: alvo, color: 'rgba(255,255,255,0.4)', label: 'alvo' }] });
      out.innerHTML = '';
      out.append(CS.kv(Object.entries(all).map(([m, nm]) => [nm, `${K.n(K.solve(x => Math.log(E.berTheory(m, x)) - Math.log(alvo), 0, 40), 3)} dB`])));
    }
    run();
  }

  /* ════════════════ 4. ENLACES E PROPAGAÇÃO ════════════════ */
  const toolEnlace = (host, onClean) => {
    const { body } = CS.page(host, {
      title: 'Enlaces e propagação', lead: 'Orçamento de potência (Friis), perda no espaço livre, zona de Fresnel e altura de antenas, capacidade de Shannon e enlace de fibra óptica.',
      learn: `<p><b>Decibéis:</b> dBm = 10·log(P/1 mW); dBi = ganho em relação à antena isotrópica. No orçamento do enlace, tudo vira soma: P<sub>r</sub> = P<sub>t</sub> + G<sub>t</sub> + G<sub>r</sub> − L<sub>espaço</sub> − L<sub>cabos</sub> − L<sub>outras</sub>.</p>
      <p><b>Perda no espaço livre (Friis):</b> FSPL = 20·log(d<sub>km</sub>) + 20·log(f<sub>MHz</sub>) + 32,44 dB. Dobrar a distância custa 6 dB.</p>
      <p><b>Zona de Fresnel:</b> elipsoide em torno da linha de visada. Para não haver perda significativa, ≥ 60% do 1º raio de Fresnel deve estar livre de obstáculos, considerando também a curvatura da Terra (fator k = 4/3 para a refração atmosférica).</p>
      <p><b>Shannon:</b> a capacidade máxima de um canal com banda B e relação sinal-ruído S/N é C = B·log₂(1 + S/N). Nenhuma modulação a supera, apenas se aproxima dela (códigos LDPC/turbo).</p>
      <p><b>Ruído térmico:</b> N = k·T·B → −174 dBm/Hz a 290 K, mais a figura de ruído do receptor.</p>`,
    });
    onClean(K.sections(body, 'enl', [{ id: 'budget', label: 'Orçamento do enlace', render: secBudget }, { id: 'fresnel', label: 'Fresnel e visada', render: secFresnel }, { id: 'shannon', label: 'Shannon', render: secShannon }, { id: 'fibra', label: 'Fibra óptica', render: secFibra }]));
  };
  E.fspl = (dkm, fMHz) => 20 * Math.log10(dkm) + 20 * Math.log10(fMHz) + 32.44;
  function secBudget(area) {
    const f = K.form([{ k: 'Pt', l: 'Potência do transmissor', u: 'dBm', v: '20' }, { k: 'Gt', l: 'Ganho da antena TX', u: 'dBi', v: '24' }, { k: 'Gr', l: 'Ganho da antena RX', u: 'dBi', v: '24' }, { k: 'f', l: 'Frequência', u: 'MHz', v: '5800' }, { k: 'd', l: 'Distância', u: 'km', v: '15' }, { k: 'Lc', l: 'Perdas em cabos e conectores (total)', u: 'dB', v: '3' }, { k: 'Lo', l: 'Outras perdas (chuva, vegetação…)', u: 'dB', v: '2' }, { k: 'S', l: 'Sensibilidade do receptor', u: 'dBm', v: '-80' }], () => run(), { cols: 2 });
    const out = h('div'), cb = CS.chartBox(), bars = h('div');
    area.append(h('div', { class: 'grid2' }, h('div', { class: 'col' }, CS.card('Enlace ponto a ponto', f.el), CS.card('Resultados', out)), h('div', { class: 'col' }, CS.card('Potência recebida × distância', cb), CS.card('Balanço (dB)', bars))));
    const ch = new MS.Chart(cb, { xlog: true, xlabel: 'd [km]', ylabel: 'Pr [dBm]', readout: (x, y) => `${K.n(x)} km\n${K.n(y)} dBm` });
    function run() {
      const s = f.st, L = E.fspl(s.d, s.f), Pr = d => s.Pt + s.Gt + s.Gr - E.fspl(d, s.f) - s.Lc - s.Lo, M = Pr(s.d) - s.S, dmax = s.d * 10 ** (M / 20);
      const ds = CS.logspace(0.1, 200, 100);
      ch.set({ series: [{ x: ds, y: ds.map(Pr), color: '#4fb3ff', width: 2 }], hlines: [{ y: s.S, color: '#ff4d6d', label: 'sensibilidade' }, { y: s.S + 10, color: 'rgba(255,209,102,0.5)', label: '+10 dB margem' }], markers: [{ x: s.d, y: Pr(s.d), shape: 'dot', color: '#ffd166', size: 6 }] });
      out.innerHTML = '';
      out.append(CS.kv([['Perda no espaço livre', `${K.n(L)} dB`], ['EIRP', `${K.n(s.Pt + s.Gt - s.Lc / 2)} dBm (${MS.fmt(10 ** ((s.Pt + s.Gt - s.Lc / 2 - 30) / 10), 'W', 3)})`], ['Potência recebida', `<b>${K.n(Pr(s.d))} dBm</b> (${MS.fmt(10 ** ((Pr(s.d) - 30) / 10), 'W', 3)})`], ['Margem de desvanecimento', M >= 10 ? `<b class="good">${K.n(M)} dB ✓</b>` : M >= 0 ? `<b class="warn">${K.n(M)} dB (baixa)</b>` : `<b class="bad">${K.n(M)} dB ✗ enlace não fecha</b>`], ['Alcance máximo (margem 0)', `${K.n(dmax)} km`]]));
      const items = [['P<sub>t</sub>', s.Pt], ['+G<sub>t</sub>', s.Gt], ['+G<sub>r</sub>', s.Gr], ['−FSPL', -L], ['−cabos', -s.Lc], ['−outras', -s.Lo]], mx = Math.max(...items.map(i => Math.abs(i[1])));
      bars.innerHTML = '';
      items.forEach(([n, v]) => bars.append(h('div', { class: 'oee-row' }, h('div', { class: 'oee-name', html: n }), h('div', { class: 'hbar' }, h('div', { class: 'hbar-fill', style: `width:${Math.abs(v) / mx * 100}%;background:${v >= 0 ? '#3ddc84' : '#ff4d6d'}` })), h('div', { class: 'oee-val' }, `${v >= 0 ? '+' : ''}${K.n(v)} dB`))));
    }
    run();
  }
  function secFresnel(area) {
    const f = K.form([{ k: 'd', l: 'Distância do enlace', u: 'km', v: '20' }, { k: 'f', l: 'Frequência', u: 'GHz', v: '5.8' }, { k: 'k', l: 'Fator k (refração)', u: '', v: '1.333' }, { k: 'ho', l: 'Obstáculo no meio do enlace', u: 'm', v: '15' }, { k: 'clr', l: 'Desobstrução exigida da 1ª zona', u: '%', v: '60' }], () => run(), { cols: 2 });
    const out = h('div'), cvc = CS.card('Perfil do enlace (alturas exageradas)');
    area.append(h('div', { class: 'grid2' }, CS.card('Visada', f.el, out), cvc));
    const cv = K.canvas(cvc, 300, null);
    function run() {
      const s = f.st, r1 = 17.32 * Math.sqrt((s.d / 2) * (s.d / 2) / (s.f * s.d)), bulge = (s.d / 2) ** 2 / (12.74 * s.k), hreq = s.ho + bulge + r1 * s.clr / 100;
      out.innerHTML = '';
      out.append(CS.kv([['Raio da 1ª zona de Fresnel no meio', `${K.n(r1)} m`], ['Flecha da Terra (k = ' + K.n(s.k, 3) + ')', `${K.n(bulge)} m`], ['Altura mínima das antenas (iguais)', `<b>${K.n(hreq)} m</b>`], ['Horizonte de rádio para essa altura', `${K.n(2 * 4.12 * Math.sqrt(hreq))} km (entre duas antenas)`]]));
      cv.draw = (g, W, H) => {
        const L = 30, R = W - 30, base = H - 30, top = 30, xs = x => L + (R - L) * x / s.d, sy = (base - top) / (hreq * 1.3), Y = hh => base - hh * sy;
        g.fillStyle = '#3a2f22'; g.beginPath(); g.moveTo(L, base);
        for (let i = 0; i <= 50; i++) { const x = s.d * i / 50, b = x * (s.d - x) / (12.74 * s.k); g.lineTo(xs(x), Y(b)); } g.lineTo(R, base + 30); g.lineTo(L, base + 30); g.fill();
        const bx = s.d / 2; g.fillStyle = '#2f6b3a'; g.beginPath(); g.moveTo(xs(bx) - 25, Y(bulge)); g.lineTo(xs(bx), Y(bulge + s.ho)); g.lineTo(xs(bx) + 25, Y(bulge)); g.fill();
        g.strokeStyle = '#9fb4d0'; g.lineWidth = 3; g.beginPath(); g.moveTo(L, base); g.lineTo(L, Y(hreq)); g.moveTo(R, base); g.lineTo(R, Y(hreq)); g.stroke();
        g.strokeStyle = '#ffd166'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(L, Y(hreq)); g.lineTo(R, Y(hreq)); g.stroke();
        g.fillStyle = 'rgba(79,179,255,0.15)'; g.strokeStyle = 'rgba(79,179,255,0.7)'; g.beginPath();
        for (let i = 0; i <= 60; i++) { const x = s.d * i / 60, rr = 17.32 * Math.sqrt(Math.max(0, x * (s.d - x)) / (s.f * s.d)); g.lineTo(xs(x), Y(hreq + rr)); }
        for (let i = 60; i >= 0; i--) { const x = s.d * i / 60, rr = 17.32 * Math.sqrt(Math.max(0, x * (s.d - x)) / (s.f * s.d)); g.lineTo(xs(x), Y(hreq - rr)); }
        g.closePath(); g.fill(); g.stroke();
        g.fillStyle = '#c3d3e8'; g.font = '11px Barlow'; g.textAlign = 'center'; g.fillText('1ª zona de Fresnel', xs(s.d * 0.25), Y(hreq) - 6); g.fillText(`${K.n(hreq, 3)} m`, L + 22, Y(hreq) - 6);
      };
      cv.redraw();
    }
    run();
  }
  function secShannon(area) {
    const f = K.form([{ k: 'B', l: 'Largura de banda', u: 'Hz', v: '20M' }, { k: 'snr', l: 'Relação sinal-ruído', u: 'dB', v: '25' }], () => run(), { cols: 2 });
    const out = h('div'), cb = CS.chartBox();
    area.append(h('div', { class: 'grid2' }, CS.card('Capacidade do canal', f.el, out), CS.card('Eficiência espectral × SNR (limite de Shannon)', cb)));
    const ch = new MS.Chart(cb, { xlabel: 'SNR [dB]', ylabel: 'bit/s/Hz', includeOrigin: true, readout: (x, y) => `${K.n(x)} dB\n${K.n(y)} bit/s/Hz` });
    function run() {
      const s = f.st, c = Math.log2(1 + 10 ** (s.snr / 10)), xs = K.linspace(-5, 40, 100);
      const mods = [['BPSK', 1, 6.8], ['QPSK', 2, 9.8], ['16-QAM', 4, 16.5], ['64-QAM', 6, 22.5], ['256-QAM', 8, 28.5], ['1024-QAM', 10, 34.5]];
      ch.set({ series: [{ x: xs, y: xs.map(x => Math.log2(1 + 10 ** (x / 10))), color: '#3ddc84', width: 2.2, name: 'limite de Shannon' }], markers: mods.map(([n, b, sn]) => ({ x: sn, y: b, shape: 'sq', color: '#ffd166', size: 4, label: n })).concat([{ x: s.snr, y: c, shape: 'dot', color: '#ff4d6d', size: 6 }]) });
      out.innerHTML = '';
      out.append(CS.kv([['Capacidade', `<b>${MS.fmt(s.B * c, 'bit/s', 4)}</b>`], ['Eficiência espectral', `${K.n(c, 3)} bit/s/Hz`], ['Potência de ruído térmico (290 K, NF = 0)', `${K.n(-174 + 10 * Math.log10(s.B))} dBm`]]), h('div', { class: 'muted small' }, 'Os quadrados indicam a SNR aproximada necessária para cada modulação com BER ≈ 10⁻⁶ sem codificação; os códigos corretores reduzem essa distância ao limite.'));
    }
    run();
  }
  const JANELAS = [['3', '850 nm multimodo (≈ 3 dB/km)'], ['0.35', '1310 nm monomodo (≈ 0,35 dB/km)'], ['0.22', '1550 nm monomodo (≈ 0,22 dB/km)']];
  function secFibra(area) {
    const f = K.form([{ k: 'Pt', l: 'Potência do laser', u: 'dBm', v: '0' }, { k: 'S', l: 'Sensibilidade do receptor', u: 'dBm', v: '-28' }, { k: 'a', l: 'Janela / fibra', type: 'sel', v: '0.22', opts: JANELAS }, { k: 'nc', l: 'Conectores', u: '', v: '4' }, { k: 'ns', l: 'Emendas por fusão', u: '', v: '10' }, { k: 'mg', l: 'Margem de segurança', u: 'dB', v: '3' }, { k: 'L', l: 'Comprimento do enlace', u: 'km', v: '60' }], () => run(), { cols: 2 });
    const out = h('div');
    area.append(h('div', { class: 'grid2' }, CS.card('Orçamento óptico', f.el, out), CS.card('Por que fibra?', h('ul', {}, ...['Atenuação muito baixa (0,2 dB/km em 1550 nm): enlaces de 80–100 km sem repetidor', 'Banda enorme: dezenas de Tbit/s com multiplexação por comprimento de onda (DWDM)', 'Imune a interferência eletromagnética (ótima para subestações)', 'Reflexão interna total: núcleo com índice de refração maior que a casca', 'Monomodo (núcleo de 9 µm) para longas distâncias; multimodo (50/62,5 µm) para redes locais', 'OPGW: cabo para-raios com fibras, usado nas linhas de transmissão'].map(x => h('li', {}, x))))));
    function run() {
      const s = f.st, a = parseFloat(s.a), perdas = a * s.L + s.nc * 0.5 + s.ns * 0.1 + s.mg, Pr = s.Pt - perdas, Lmax = (s.Pt - s.S - s.nc * 0.5 - s.ns * 0.1 - s.mg) / a;
      out.innerHTML = '';
      out.append(CS.kv([['Perda na fibra', `${K.n(a * s.L)} dB`], ['Conectores (0,5 dB) + emendas (0,1 dB)', `${K.n(s.nc * 0.5 + s.ns * 0.1)} dB`], ['Potência recebida', `<b>${K.n(Pr)} dBm</b>`], ['Folga sobre a sensibilidade', Pr >= s.S ? `<b class="good">${K.n(Pr - s.S)} dB ✓</b>` : `<b class="bad">${K.n(Pr - s.S)} dB ✗</b>`], ['Alcance máximo', `${K.n(Lmax)} km`]]));
    }
    run();
  }

  /* ════════════════ 5. LINHAS DE TRANSMISSÃO E ANTENAS ════════════════ */
  const toolLinhas = (host, onClean) => {
    const { body } = CS.page(host, {
      title: 'Linhas de transmissão e antenas', lead: 'Coeficiente de reflexão, ROE (VSWR) e ondas estacionárias animadas, carta de Smith com impedância de entrada ao longo da linha, impedância de cabos coaxiais e diagramas de irradiação de dipolos e arranjos.',
      learn: `<p>Em altas frequências, o comprimento do cabo é comparável ao comprimento de onda λ = v/f, e ele passa a se comportar como uma <b>linha de transmissão</b> de impedância característica Z₀ (50 Ω em RF, 75 Ω em TV).</p>
      <p><b>Reflexão:</b> Γ = (Z<sub>L</sub> − Z₀)/(Z<sub>L</sub> + Z₀). Com carga casada (Z<sub>L</sub> = Z₀) não há reflexão. <b>ROE</b> = (1 + |Γ|)/(1 − |Γ|); perda de retorno RL = −20·log|Γ|. A onda incidente e a refletida formam uma <b>onda estacionária</b>, com máximos e mínimos a cada λ/4.</p>
      <p><b>Impedância de entrada:</b> Z<sub>in</sub> = Z₀·(Z<sub>L</sub> + jZ₀ tan βℓ)/(Z₀ + jZ<sub>L</sub> tan βℓ). Na <b>carta de Smith</b>, andar ao longo da linha é girar em torno do centro (meia volta a cada λ/4). O transformador de λ/4 casa cargas resistivas com Z<sub>T</sub> = √(Z₀Z<sub>L</sub>).</p>
      <p><b>Antenas:</b> o dipolo de meia onda tem 73 Ω e ganho de 2,15 dBi. Arranjos de N elementos com espaçamento d e defasagem progressiva δ direcionam o feixe eletronicamente (antenas phased array, 5G massive MIMO, radares).</p>`,
    });
    onClean(K.sections(body, 'lt', [{ id: 'refl', label: 'Reflexão e ROE', render: secRefl }, { id: 'smith', label: 'Carta de Smith', render: secSmith }, { id: 'coax', label: 'Cabo coaxial', render: secCoax }, { id: 'ant', label: 'Antenas e arranjos', render: secAntena }]));
  };
  function secRefl(area, onClean) {
    const f = K.form([{ k: 'Z0', l: 'Z₀', u: 'Ω', v: '50' }, { k: 'RL', l: 'Carga R<sub>L</sub>', u: 'Ω', v: '100' }, { k: 'XL', l: 'Carga X<sub>L</sub>', u: 'Ω', v: '0' }], () => run(), { cols: 3 });
    const out = h('div'), cb = CS.chartBox('tall');
    area.append(h('div', { class: 'grid2' }, CS.card('Linha sem perdas terminada em Z<sub>L</sub>', f.el, out), CS.card('Onda estacionária (animada) e envoltória |V(z)|', cb)));
    const ch = new MS.Chart(cb, { xlabel: 'distância da carga [λ]', ylabel: 'V / V⁺', yrange: [-2.1, 2.1], readout: (x, y) => `${K.n(x)} λ\n${K.n(y)}` });
    let G = [0, 0];
    const zs = K.linspace(0, 1.25, 300);
    function run() {
      G = C.div(C.sub([f.st.RL, f.st.XL], [f.st.Z0, 0]), C.add([f.st.RL, f.st.XL], [f.st.Z0, 0]));
      const g = C.abs(G), vswr = (1 + g) / (1 - g);
      out.innerHTML = '';
      out.append(CS.kv([['Γ', `${K.n(g, 3)} ∠ ${K.n(Math.atan2(G[1], G[0]) * 180 / Math.PI, 3)}°`], ['ROE (VSWR)', `<b>${g >= 0.9999 ? '∞' : K.n(vswr, 3)}</b>`], ['Perda de retorno', g > 0 ? `${K.n(-20 * Math.log10(g), 3)} dB` : '∞ (casado)'], ['Potência refletida', `${K.n(g * g * 100, 3)} %`], ['Perda por descasamento', `${K.n(-10 * Math.log10(1 - g * g), 3)} dB`]]), h('div', { class: 'muted small' }, 'Teste R<sub>L</sub> = 50 (casada: só onda progressiva), R<sub>L</sub> = 0 (curto) ou um valor muito alto (aberto): onda estacionária pura com nós fixos.'));
    }
    let t = 0;
    onClean(K.animate(cb, () => {
      t += 0.05;
      const env = zs.map(z => C.abs(C.add([1, 0], C.mul(G, C.exp(-2 * TAU * z)))));
      const inst = zs.map(z => { const v = C.add(C.exp(TAU * z), C.mul(G, C.exp(-TAU * z))); return C.mul(v, C.exp(t))[0]; });
      ch.set({ series: [{ x: zs, y: env, color: 'rgba(255,209,102,0.7)', width: 1.5, name: '|V|' }, { x: zs, y: env.map(v => -v), color: 'rgba(255,209,102,0.7)', width: 1.5 }, { x: zs, y: inst, color: '#4fb3ff', width: 2.2, name: 'v(z,t)' }] });
    }));
    run();
  }
  function smithGrid(g, cx, cy, R) {
    g.save(); g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.clip();
    g.strokeStyle = 'rgba(159,180,208,0.25)'; g.lineWidth = 1;
    for (const r of [0, 0.2, 0.5, 1, 2, 5]) { g.beginPath(); g.arc(cx + R * r / (1 + r), cy, R / (1 + r), 0, TAU); g.stroke(); }
    for (const x of [0.2, 0.5, 1, 2, 5]) for (const sg of [1, -1]) { g.beginPath(); g.arc(cx + R, cy - sg * R / x, R / x, 0, TAU); g.stroke(); }
    g.beginPath(); g.moveTo(cx - R, cy); g.lineTo(cx + R, cy); g.stroke(); g.restore();
    g.strokeStyle = '#9fb4d0'; g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.stroke();
    g.fillStyle = 'rgba(159,180,208,0.7)'; g.font = '10px Barlow'; g.textAlign = 'center';
    for (const r of [0.2, 0.5, 1, 2, 5]) g.fillText(String(r), cx + R * (r - 1) / (r + 1), cy - 3);
    for (const x of [0.5, 1, 2]) for (const sg of [1, -1]) { const z = [0, sg * x], G = C.div(C.sub(z, [1, 0]), C.add(z, [1, 0])); g.fillText(`${sg > 0 ? '+' : '−'}j${x}`, cx + G[0] * R * 1.08, cy - G[1] * R * 1.08 + 4); }
  }
  function secSmith(area) {
    const f = K.form([{ k: 'Z0', l: 'Z₀', u: 'Ω', v: '50' }, { k: 'RL', l: 'R<sub>L</sub>', u: 'Ω', v: '25' }, { k: 'XL', l: 'X<sub>L</sub>', u: 'Ω', v: '40' }, { k: 'l', l: 'Comprimento da linha ℓ', u: 'λ', v: '0.15' }], () => run(), { cols: 2 });
    const out = h('div'), cvc = CS.card('Carta de Smith (gira no sentido horário ao se afastar da carga)');
    area.append(h('div', { class: 'grid2' }, CS.card('Impedância de entrada', f.el, out), cvc));
    const cv = K.canvas(cvc, 420, null);
    function run() {
      const s = f.st, zl = [s.RL / s.Z0, s.XL / s.Z0], GL = C.div(C.sub(zl, [1, 0]), C.add(zl, [1, 0]));
      const Gin = l => C.mul(GL, C.exp(-2 * TAU * l)), zin = l => { const g = Gin(l); return C.div(C.add([1, 0], g), C.sub([1, 0], g)); };
      const zi = zin(s.l), Zi = [zi[0] * s.Z0, zi[1] * s.Z0], g = C.abs(GL);
      const lmin = (((Math.atan2(GL[1], GL[0]) + Math.PI) / (2 * TAU)) % 0.5 + 0.5) % 0.5;
      out.innerHTML = '';
      out.append(CS.kv([['z<sub>L</sub> normalizada', `${K.n(zl[0], 3)} ${zl[1] >= 0 ? '+' : '−'} j${K.n(Math.abs(zl[1]), 3)}`], ['Γ<sub>L</sub>', `${K.n(g, 3)} ∠ ${K.n(Math.atan2(GL[1], GL[0]) * 180 / Math.PI, 3)}°`], ['Z<sub>in</sub> a ℓ = ' + s.l + ' λ', `<b>${K.n(Zi[0], 4)} ${Zi[1] >= 0 ? '+' : '−'} j${K.n(Math.abs(Zi[1]), 4)} Ω</b>`], ['ROE', K.n((1 + g) / (1 - g), 3)], ['1º mínimo de tensão', `${K.n(lmin, 3)} λ da carga (Z<sub>in</sub> real = Z₀/ROE)`], ['Transformador λ/4 nesse ponto', `Z<sub>T</sub> = √(Z₀·Z₀/ROE) = ${K.n(s.Z0 / Math.sqrt((1 + g) / (1 - g)))} Ω`]]));
      cv.draw = (gx, W, H) => {
        const R = Math.min(W, H) / 2 - 24, cx = W / 2, cy = H / 2;
        smithGrid(gx, cx, cy, R);
        gx.strokeStyle = 'rgba(255,209,102,0.4)'; gx.setLineDash([4, 4]); gx.beginPath(); gx.arc(cx, cy, g * R, 0, TAU); gx.stroke(); gx.setLineDash([]);
        gx.strokeStyle = '#3ddc84'; gx.lineWidth = 2.5; gx.beginPath();
        for (let i = 0; i <= 100; i++) { const G = Gin(s.l * i / 100); const x = cx + G[0] * R, y = cy - G[1] * R; i ? gx.lineTo(x, y) : gx.moveTo(x, y); } gx.stroke(); gx.lineWidth = 1;
        const P = (G, c, t) => { gx.fillStyle = c; gx.beginPath(); gx.arc(cx + G[0] * R, cy - G[1] * R, 5, 0, TAU); gx.fill(); gx.font = '12px Barlow'; gx.textAlign = 'left'; gx.fillText(t, cx + G[0] * R + 8, cy - G[1] * R - 6); };
        P(GL, '#ff4d6d', 'Z_L'); P(Gin(s.l), '#3ddc84', 'Z_in');
        gx.fillStyle = '#c3d3e8'; gx.font = '11px Barlow'; gx.textAlign = 'center'; gx.fillText('curto', cx - R, cy + 16); gx.fillText('aberto', cx + R, cy + 16); gx.fillText('indutivo (+jX)', cx, cy - R - 6); gx.fillText('capacitivo (−jX)', cx, cy + R + 16);
      };
      cv.redraw();
    }
    run();
  }
  const DIELS = [['1', 'ar (εr = 1)'], ['2.25', 'polietileno sólido (2,25)'], ['1.5', 'polietileno expandido (≈ 1,5)'], ['2.1', 'PTFE / teflon (2,1)']];
  function secCoax(area) {
    const f = K.form([{ k: 'd', l: 'Diâmetro do condutor interno d', u: 'mm', v: '0.9' }, { k: 'D', l: 'Diâmetro interno da malha D', u: 'mm', v: '2.95' }, { k: 'er', l: 'Dielétrico', type: 'sel', v: '2.25', opts: DIELS }, { k: 'f', l: 'Frequência', u: 'MHz', v: '100' }], () => run(), { cols: 2 });
    const out = h('div');
    area.append(h('div', { class: 'grid2' }, CS.card('Parâmetros do cabo coaxial', f.el, out), CS.card('Cabos comuns', K.table(['Cabo', 'Z₀', 'Uso'], [['RG-58', '50 Ω', 'rádio, laboratório'], ['RG-213 / LMR-400', '50 Ω', 'antenas de rádio, baixas perdas'], ['RG-6', '75 Ω', 'TV a cabo / satélite'], ['RG-59', '75 Ω', 'CFTV, vídeo'], ['Par trançado Cat6', '100 Ω (diferencial)', 'Ethernet'], ['Linha de fita (twin-lead)', '300 Ω', 'antenas de TV antigas']]))));
    function run() {
      const s = f.st, er = parseFloat(s.er), Z0 = 60 / Math.sqrt(er) * Math.log(s.D / s.d), vf = 1 / Math.sqrt(er), Cpm = TAU * 8.854e-12 * er / Math.log(s.D / s.d), Lpm = 4e-7 * Math.PI / TAU * Math.log(s.D / s.d), lam = 3e8 * vf / (s.f * 1e6);
      out.innerHTML = '';
      out.append(CS.kv([['Impedância característica Z₀ = (60/√εr)·ln(D/d)', `<b>${K.n(Z0)} Ω</b>`], ['Fator de velocidade', `${K.n(vf, 3)} (v = ${K.n(vf * 300)} m/µs)`], ['Capacitância', `${K.n(Cpm * 1e12)} pF/m`], ['Indutância', `${K.n(Lpm * 1e9)} nH/m`], ['λ no cabo', `${K.n(lam)} m (λ/4 = ${K.n(lam / 4)} m)`], ['Atraso', `${K.n(1 / (vf * 0.3))} ns/m`]]), h('div', { class: 'muted small' }, 'Z₀ de 50 Ω é um compromisso entre mínima atenuação (≈ 77 Ω) e máxima potência (≈ 30 Ω) em cabos com dielétrico de ar.'));
    }
    run();
  }
  function secAntena(area) {
    const f = K.form([{ k: 'N', l: 'Elementos no arranjo', u: '', v: '4' }, { k: 'd', l: 'Espaçamento d', u: 'λ', v: '0.5' }, { k: 'st', l: 'Direção do feixe (steering)', u: '°', v: '30' }, { k: 'el', l: 'Elemento', type: 'sel', v: 'iso', opts: [['iso', 'isotrópico'], ['dip', 'dipolo λ/2 (eixo vertical)']] }, { k: 'f', l: 'Frequência (para dimensões)', u: 'MHz', v: '2400' }], () => run(), { cols: 2 });
    const out = h('div'), cvc = CS.card('Diagrama de irradiação (plano do arranjo, escala em dB)');
    area.append(h('div', { class: 'grid2' }, CS.card('Arranjo linear uniforme', f.el, out), cvc));
    const cv = K.canvas(cvc, 420, null);
    function run() {
      const s = f.st, N = Math.max(1, Math.round(s.N)), kd = TAU * s.d, th0 = s.st * Math.PI / 180, delta = -kd * Math.sin(th0);
      const AF = th => { const psi = kd * Math.sin(th) + delta; const den = N * Math.sin(psi / 2); return Math.abs(den) < 1e-9 ? 1 : Math.abs(Math.sin(N * psi / 2) / den); };
      const EL = th => (s.el === 'dip' ? Math.abs(Math.cos(Math.PI / 2 * Math.sin(th)) / (Math.cos(th) || 1e-9)) : 1);
      const P = th => AF(th) * EL(th);
      const ths = K.linspace(-Math.PI, Math.PI, 721), vals = ths.map(P), mx = Math.max(...vals);
      let hp = 0; { const i0 = ths.reduce((b, t, i) => (vals[i] > vals[b] ? i : b), 0); let a = i0, b = i0; while (a > 0 && vals[a] > mx / Math.SQRT2) a--; while (b < 720 && vals[b] > mx / Math.SQRT2) b++; hp = (ths[b] - ths[a]) * 180 / Math.PI; }
      const lam = 300 / s.f;
      const grating = s.d * (1 + Math.abs(Math.sin(th0))) >= 1;
      out.innerHTML = '';
      out.append(CS.kv([['Defasagem progressiva δ', `${K.n(delta * 180 / Math.PI)}°`], ['Largura de feixe a −3 dB', `≈ ${K.n(hp, 3)}°`], ['Diretividade aproximada do arranjo', `${K.n(10 * Math.log10(N * (s.el === 'dip' ? 1.64 : 1)), 3)} dBi`], ['λ · dipolo λ/2', `${K.n(lam * 100)} cm · ${K.n(lam * 50 * 0.95)} cm (fator de encurtamento 0,95)`], ['Espaçamento físico', `${K.n(s.d * lam * 100)} cm`], grating ? ['Lóbulos de grade', '<b class="warn">sim: reduza d para evitar feixes indesejados</b>'] : null]));
      cv.draw = (g, W, H) => {
        const cx = W / 2, cy = H / 2, R = Math.min(W, H) / 2 - 20, dbmin = -30, r = v => R * Math.max(0, (20 * Math.log10(Math.max(v / mx, 1e-6)) - dbmin) / -dbmin);
        g.strokeStyle = 'rgba(159,180,208,0.2)'; g.fillStyle = 'rgba(159,180,208,0.6)'; g.font = '10px Barlow';
        for (const db of [0, -10, -20]) { g.beginPath(); g.arc(cx, cy, R * (db - dbmin) / -dbmin, 0, TAU); g.stroke(); g.fillText(`${db} dB`, cx + 3, cy - R * (db - dbmin) / -dbmin + 12); }
        for (let a = 0; a < 360; a += 30) { const t = a * Math.PI / 180; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + R * Math.sin(t), cy - R * Math.cos(t)); g.stroke(); g.fillText(`${a > 180 ? a - 360 : a}°`, cx + (R + 10) * Math.sin(t) - 8, cy - (R + 10) * Math.cos(t) + 4); }
        g.fillStyle = 'rgba(61,220,132,0.2)'; g.strokeStyle = '#3ddc84'; g.lineWidth = 2; g.beginPath();
        ths.forEach((t, i) => { const rr = r(vals[i]), x = cx + rr * Math.sin(t), y = cy - rr * Math.cos(t); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.closePath(); g.fill(); g.stroke(); g.lineWidth = 1;
        for (let i = 0; i < N; i++) { g.fillStyle = '#ffd166'; g.fillRect(cx - (N - 1) * 6 + i * 12 - 3, cy - 3, 6, 6); }
      };
      cv.redraw();
    }
    run();
  }

  /* ════════════════ 6. SISTEMAS E REDES ════════════════ */
  const toolSist = (host, onClean) => {
    const { body } = CS.page(host, {
      title: 'Sistemas e redes de comunicação', lead: 'Espectro de radiofrequência, gerações de telefonia móvel, Wi-Fi, IoT de longo alcance e modelo de camadas OSI/TCP-IP.',
      learn: `<p>Um sistema de comunicação tem <b>fonte → codificação de fonte (compressão) → codificação de canal (correção de erros) → modulação → canal (ruído, interferência, desvanecimento) → receptor</b>.</p>
      <p><b>Acesso múltiplo:</b> FDMA (frequência), TDMA (tempo), CDMA (código, 3G), OFDMA (subportadoras ortogonais, 4G/5G/Wi-Fi 6).</p>
      <p><b>MIMO:</b> várias antenas no transmissor e no receptor multiplicam a capacidade usando caminhos espaciais independentes.</p>
      <p>No Brasil, a <b>Anatel</b> regula o uso do espectro e homologa os equipamentos de radiocomunicação.</p>`,
    });
    onClean(K.sections(body, 'sist', [
      { id: 'esp', label: 'Espectro', render: a => a.append(CS.card('Faixas do espectro de radiofrequência', K.table(['Faixa', 'Frequência', 'λ', 'Propagação', 'Aplicações'], [['VLF/LF', '3–300 kHz', '100–1 km', 'onda de superfície', 'navegação, rádio-relógio, submarinos'], ['MF', '300 kHz–3 MHz', '1 km–100 m', 'superfície / ionosfera à noite', 'rádio AM (530–1700 kHz)'], ['HF', '3–30 MHz', '100–10 m', 'reflexão ionosférica (longas distâncias)', 'radioamador, ondas curtas, aviação'], ['VHF', '30–300 MHz', '10–1 m', 'visada direta', 'FM (88–108 MHz), TV, rádio marítimo'], ['UHF', '300 MHz–3 GHz', '1 m–10 cm', 'visada, penetra prédios', 'TV digital, 4G/5G, Wi-Fi 2,4 GHz, GPS'], ['SHF', '3–30 GHz', '10–1 cm', 'visada, atenuação por chuva', 'Wi-Fi 5/6 GHz, satélite, radar, micro-ondas'], ['EHF', '30–300 GHz', '10–1 mm', 'curta distância, absorção atmosférica', '5G mmWave, radar automotivo 77 GHz']]))) },
      { id: 'cel', label: 'Telefonia móvel', render: a => a.append(CS.card('Gerações', K.table(['Geração', 'Tecnologia', 'Acesso', 'Taxa típica', 'Marco'], [['1G', 'AMPS', 'FDMA analógico', 'voz', 'anos 1980'], ['2G', 'GSM / GPRS / EDGE', 'TDMA', '≤ 200 kbps', 'SMS, voz digital'], ['3G', 'UMTS / HSPA', 'WCDMA', '≤ 42 Mbps', 'internet móvel'], ['4G', 'LTE / LTE-A', 'OFDMA + MIMO', '≤ 1 Gbps', 'vídeo, apps'], ['5G', 'NR (sub-6 GHz e mmWave)', 'OFDMA, massive MIMO, beamforming', '≤ 10–20 Gbps', 'baixa latência (1 ms), IoT massiva, fatiamento de rede'], ['6G (pesquisa)', 'THz, IA nativa', '—', '≈ 1 Tbps', 'previsto para ~2030']]))) },
      { id: 'wifi', label: 'Wi-Fi e IoT', render: a => a.append(h('div', { class: 'grid2' }, CS.card('Wi-Fi (IEEE 802.11)', K.table(['Padrão', 'Nome', 'Faixas', 'Taxa máx.'], [['802.11b/g', '—', '2,4 GHz', '11 / 54 Mbps'], ['802.11n', 'Wi-Fi 4', '2,4/5 GHz', '600 Mbps'], ['802.11ac', 'Wi-Fi 5', '5 GHz', '6,9 Gbps'], ['802.11ax', 'Wi-Fi 6/6E', '2,4/5/6 GHz', '9,6 Gbps'], ['802.11be', 'Wi-Fi 7', '2,4/5/6 GHz', '46 Gbps']])), CS.card('IoT e redes de baixa potência', K.table(['Tecnologia', 'Alcance', 'Taxa', 'Uso'], [['Bluetooth LE', '10–100 m', '1–2 Mbps', 'wearables, sensores'], ['Zigbee / Thread', '10–100 m (mesh)', '250 kbps', 'automação residencial'], ['LoRaWAN', '2–15 km', '0,3–50 kbps', 'agro, medição, cidades inteligentes'], ['NB-IoT / LTE-M', 'cobertura celular', '≤ 1 Mbps', 'medidores, rastreadores'], ['Sigfox', '10–40 km', '100 bps', 'mensagens curtas']])))) },
      { id: 'osi', label: 'Modelo OSI', render: a => a.append(CS.card('Camadas', K.table(['#', 'OSI', 'TCP/IP', 'Exemplos'], [['7', 'Aplicação', 'Aplicação', 'HTTP, MQTT, Modbus TCP, DNS'], ['6', 'Apresentação', '', 'TLS, codificação'], ['5', 'Sessão', '', 'controle de diálogo'], ['4', 'Transporte', 'Transporte', 'TCP (confiável), UDP (rápido)'], ['3', 'Rede', 'Internet', 'IP, roteamento'], ['2', 'Enlace', 'Acesso à rede', 'Ethernet, Wi-Fi (MAC), PPP'], ['1', 'Física', '', 'cabos, fibra, rádio, modulação']]))) },
    ]));
  };

  CS.registerTab('tel', {
    title: 'Telecomunicações',
    tools: [
      { id: 'sinais', label: 'Sinais e amostragem', desc: 'Fourier, Nyquist, quantização', render: toolSinais },
      { id: 'anal', label: 'Modulação analógica', desc: 'AM, DSB-SC, SSB, FM', render: toolAnalog },
      { id: 'dig', label: 'Modulação digital', desc: 'PSK, QAM, constelação, BER', render: toolDigital },
      { id: 'enl', label: 'Enlaces e propagação', desc: 'Friis, Fresnel, Shannon, fibra', render: toolEnlace },
      { id: 'lt', label: 'Linhas e antenas', desc: 'ROE, Smith, coaxial, arranjos', render: toolLinhas },
      { id: 'sist', label: 'Sistemas e redes', desc: 'espectro, 5G, Wi-Fi, OSI', render: toolSist },
    ],
  });
})();
