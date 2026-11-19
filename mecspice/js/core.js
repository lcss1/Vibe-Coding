/* ============================================================
   MecSPICE — núcleo: utilidades, domínios e biblioteca de componentes
   ============================================================ */
'use strict';
const MS = window.MS = window.MS || {};

/* ───────── Domínios físicos (analogia força-corrente / mobilidade) ─────────
   Variável "através" (across)  → potencial nos nós : V, ω, v
   Variável "por" (through)     → fluxo nos ramos   : I, τ, F                */
MS.DOM = {
  E: { name: 'Elétrico',      color: '#4fb3ff', across: 'Tensão',       au: 'V',     through: 'Corrente', tu: 'A' },
  R: { name: 'Rotacional',    color: '#ff9f1c', across: 'Vel. angular', au: 'rad/s', through: 'Torque',   tu: 'N·m', pos: 'Ângulo',  pu: 'rad' },
  T: { name: 'Translacional', color: '#3ddc84', across: 'Velocidade',   au: 'm/s',   through: 'Força',    tu: 'N',   pos: 'Posição', pu: 'm' },
  A: { name: 'Qualquer',      color: '#c3cad8' },
};

/* ───────── Números com prefixo SI (estilo SPICE) ─────────
   f p n u/µ m k M/meg G T   — "m" = mili, "M" ou "meg" = mega */
MS.parseEng = function (s) {
  if (typeof s === 'number') return s;
  if (s == null) return NaN;
  const str = String(s).trim().replace(',', '.');
  const m = str.match(/^([-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?)(.*)$/);
  if (!m) return NaN;
  const v = parseFloat(m[1]);
  const rest = m[2].trim();
  if (!rest) return v;
  if (/^meg/i.test(rest)) return v * 1e6;
  const mult = { f: 1e-15, p: 1e-12, n: 1e-9, u: 1e-6, 'µ': 1e-6, 'μ': 1e-6, m: 1e-3, k: 1e3, K: 1e3, M: 1e6, G: 1e9, T: 1e12 };
  return rest[0] in mult ? v * mult[rest[0]] : v;
};

MS.fmt = function (v, unit = '', dig = 3) {
  if (v === undefined || v === null || Number.isNaN(v)) return '—';
  if (!isFinite(v)) return (v > 0 ? '+∞ ' : '−∞ ') + unit;
  const u = unit ? unit : '';
  if (v === 0) return '0 ' + u;
  const pre = [[1e12, 'T'], [1e9, 'G'], [1e6, 'M'], [1e3, 'k'], [1, ''], [1e-3, 'm'], [1e-6, 'µ'], [1e-9, 'n'], [1e-12, 'p'], [1e-15, 'f']];
  const a = Math.abs(v);
  for (const [m, p] of pre) {
    if (a >= m * 0.99995) {
      let s = (v / m).toPrecision(dig);
      if (s.includes('.') && !s.includes('e')) s = s.replace(/0+$/, '').replace(/\.$/, '');
      return s + ' ' + p + u;
    }
  }
  return v.toExponential(2) + ' ' + u;
};

MS.rotPt = function (x, y, rot) {
  for (let i = 0; i < ((rot % 4) + 4) % 4; i++) { const t = x; x = -y; y = t; }
  return { x, y };
};
MS.pinPos = function (c, i) {
  const p = MS.DEFS[c.type].pins[i];
  const r = MS.rotPt(p[0], p[1], c.rot || 0);
  return { x: c.x + r.x, y: c.y + r.y };
};

/* ───────── Formas de onda das fontes ───────── */
const WAVE = (u, defVal) => [
  { k: 'forma', l: 'Forma de onda', type: 'sel', opts: ['DC', 'DEGRAU', 'SENO', 'PULSO'], def: 'DC' },
  { k: 'val', l: 'Valor (DC / final / pico)', u, def: defVal },
  { k: 'v0', l: 'Valor inicial / offset', u, def: '0', show: p => p.forma !== 'DC' },
  { k: 't0', l: 'Instante / atraso', u: 's', def: '0', show: p => p.forma !== 'DC' },
  { k: 'freq', l: 'Frequência', u: 'Hz', def: '1', show: p => p.forma === 'SENO' },
  { k: 'tr', l: 'Tempo de subida', u: 's', def: '1m', show: p => p.forma === 'PULSO' },
  { k: 'tf', l: 'Tempo de descida', u: 's', def: '1m', show: p => p.forma === 'PULSO' },
  { k: 'ton', l: 'Largura do pulso', u: 's', def: '0.5', show: p => p.forma === 'PULSO' },
  { k: 'per', l: 'Período', u: 's', def: '1', show: p => p.forma === 'PULSO' },
];
MS.makeWave = function (c) {
  const P = k => MS.parseEng(c.params[k]);
  const f = c.params.forma || 'DC';
  const val = P('val'), v0 = P('v0'), t0 = P('t0') || 0;
  if (f === 'DC') return () => val;
  if (f === 'DEGRAU') return t => (t < t0 ? v0 : val);
  if (f === 'SENO') { const fr = P('freq'); return t => (t < t0 ? v0 : v0 + val * Math.sin(2 * Math.PI * fr * (t - t0))); }
  const tr = P('tr') || 0, tf = P('tf') || 0, ton = P('ton') || 0, per = P('per') || 0;
  return t => {
    if (t < t0) return v0;
    let tt = t - t0;
    if (per > 0) tt %= per;
    if (tt < tr) return v0 + (val - v0) * tt / tr;
    if (tt < tr + ton) return val;
    if (tt < tr + ton + tf) return val + (v0 - val) * (tt - tr - ton) / tf;
    return v0;
  };
};
function waveText(c, u) {
  const p = c.params;
  switch (p.forma) {
    case 'DEGRAU': return `DEGRAU ${p.v0}→${p.val}${u} @${p.t0}s`;
    case 'SENO': return `SIN(${p.v0} ${p.val} ${p.freq}Hz)`;
    case 'PULSO': return `PULSO(${p.v0} ${p.val} ${p.ton}/${p.per}s)`;
    default: return p.val + ' ' + u;
  }
}

/* ───────── Primitivas de desenho (coordenadas locais em unidades de grade) ───────── */
const D = {
  line(g, ...p) { g.beginPath(); g.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) g.lineTo(p[i], p[i + 1]); g.stroke(); },
  circle(g, x, y, r, fill) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); if (fill) { g.fillStyle = fill; g.fill(); } g.stroke(); },
  rect(g, x, y, w, h, fill) { g.beginPath(); g.rect(x, y, w, h); if (fill) { g.fillStyle = fill; g.fill(); } g.stroke(); },
  zigH(g, x1, x2, y, n, a) { g.beginPath(); g.moveTo(x1, y); const s = (x2 - x1) / (2 * n); for (let i = 0; i < 2 * n; i++) g.lineTo(x1 + s * (i + 0.5), y + (i % 2 ? a : -a)); g.lineTo(x2, y); g.stroke(); },
  zigV(g, y1, y2, x, n, a) { g.beginPath(); g.moveTo(x, y1); const s = (y2 - y1) / (2 * n); for (let i = 0; i < 2 * n; i++) g.lineTo(x + (i % 2 ? -a : a), y1 + s * (i + 0.5)); g.lineTo(x, y2); g.stroke(); },
  arrow(g, x1, y1, x2, y2, h = 0.3) {
    D.line(g, x1, y1, x2, y2);
    const a = Math.atan2(y2 - y1, x2 - x1);
    g.beginPath(); g.moveTo(x2, y2);
    g.lineTo(x2 - h * Math.cos(a - 0.45), y2 - h * Math.sin(a - 0.45));
    g.lineTo(x2 - h * Math.cos(a + 0.45), y2 - h * Math.sin(a + 0.45));
    g.closePath(); g.fillStyle = g.strokeStyle; g.fill();
  },
  curlArrow(g, x, y, r) {
    g.beginPath(); g.arc(x, y, r, -Math.PI * 0.9, Math.PI * 0.55); g.stroke();
    const a = Math.PI * 0.55, ex = x + r * Math.cos(a), ey = y + r * Math.sin(a);
    const t = a + Math.PI / 2;
    g.beginPath(); g.moveTo(ex, ey);
    g.lineTo(ex - 0.3 * Math.cos(t - 0.5), ey - 0.3 * Math.sin(t - 0.5));
    g.lineTo(ex - 0.3 * Math.cos(t + 0.5), ey - 0.3 * Math.sin(t + 0.5));
    g.closePath(); g.fillStyle = g.strokeStyle; g.fill();
  },
  hatchGround(g) {
    D.line(g, 0, 0, 0, 0.6); D.line(g, -1, 0.6, 1, 0.6);
    for (let x = -0.8; x <= 1.01; x += 0.4) D.line(g, x, 0.6, x - 0.35, 1.0);
  },
  gearCircle(g, x, y, r, teeth) {
    D.circle(g, x, y, r);
    for (let i = 0; i < teeth; i++) {
      const a = (i / teeth) * Math.PI * 2;
      D.line(g, x + r * Math.cos(a), y + r * Math.sin(a), x + (r + 0.18) * Math.cos(a), y + (r + 0.18) * Math.sin(a));
    }
  },
  dashpot(g) {
    D.line(g, -2, 0, -0.9, 0);
    D.line(g, 0.6, -0.65, -0.9, -0.65, -0.9, 0.65, 0.6, 0.65);
    D.line(g, 0.1, -0.45, 0.1, 0.45);
    D.line(g, 0.1, 0, 2, 0);
  },
};
MS.Draw = D;

const srcLeads = g => { D.line(g, 0, -2, 0, -1); D.line(g, 0, 1, 0, 2); D.circle(g, 0, 0, 1); };

/* ───────── Biblioteca de componentes ─────────
   pins: [x, y, domínio, nome]   (posição em unidades de grade, rot = 0)
   same: grupos de pinos internamente conectados (mesmo nó)
   bbox: [x0,y0,x1,y1] local para seleção
   lbl : âncora do rótulo (nome/valor)                                            */
const V2 = [[0, -2], [0, 2]], H2 = [[-2, 0], [2, 0]];
const pins2 = (pp, d, n = ['+', '−']) => pp.map((p, i) => [p[0], p[1], d, n[i]]);

MS.DEFS = {
  /* ═════════ ELÉTRICO ═════════ */
  R: {
    name: 'Resistor', cat: 'Elétrico', prefix: 'R', key: '', pins: pins2(V2, 'E', ['A', 'B']), bbox: [-0.6, -2, 0.6, 2], lbl: [0.9, -0.5],
    params: [{ k: 'R', l: 'Resistência', u: 'Ω', def: '1k' }],
    val: c => c.params.R + 'Ω',
    draw(g) { D.line(g, 0, -2, 0, -1.3); D.zigV(g, -1.3, 1.3, 0, 4, 0.4); D.line(g, 0, 1.3, 0, 2); },
  },
  C: {
    name: 'Capacitor', cat: 'Elétrico', prefix: 'C', pins: pins2(V2, 'E', ['A', 'B']), bbox: [-0.9, -2, 0.9, 2], lbl: [1.1, -0.5],
    params: [{ k: 'C', l: 'Capacitância', u: 'F', def: '1u' }, { k: 'V0', l: 'Tensão inicial', u: 'V', def: '0' }],
    val: c => c.params.C + 'F',
    draw(g) { D.line(g, 0, -2, 0, -0.25); D.line(g, -0.9, -0.25, 0.9, -0.25); D.line(g, -0.9, 0.25, 0.9, 0.25); D.line(g, 0, 0.25, 0, 2); },
  },
  L: {
    name: 'Indutor', cat: 'Elétrico', prefix: 'L', pins: pins2(V2, 'E', ['A', 'B']), bbox: [-0.4, -2, 0.7, 2], lbl: [1.0, -0.5],
    params: [{ k: 'L', l: 'Indutância', u: 'H', def: '1m' }, { k: 'I0', l: 'Corrente inicial', u: 'A', def: '0' }],
    val: c => c.params.L + 'H',
    draw(g) {
      D.line(g, 0, -2, 0, -1.2); D.line(g, 0, 1.2, 0, 2);
      for (let k = 0; k < 4; k++) { g.beginPath(); g.arc(0, -0.9 + 0.6 * k, 0.3, -Math.PI / 2, Math.PI / 2); g.stroke(); }
    },
  },
  VS: {
    name: 'Fonte de tensão', cat: 'Elétrico', prefix: 'V', pins: pins2(V2, 'E'), bbox: [-1, -2, 1, 2], lbl: [1.3, -0.5],
    params: WAVE('V', '12'), val: c => waveText(c, 'V'),
    draw(g, c, S) { srcLeads(g); S.text('+', 0, -0.45, 0.7); S.text('−', 0, 0.5, 0.7); },
  },
  IS: {
    name: 'Fonte de corrente', cat: 'Elétrico', prefix: 'I', pins: pins2(V2, 'E'), bbox: [-1, -2, 1, 2], lbl: [1.3, -0.5],
    params: WAVE('A', '1'), val: c => waveText(c, 'A'),
    draw(g) { srcLeads(g); D.arrow(g, 0, 0.6, 0, -0.6); },
  },
  D: {
    name: 'Diodo', cat: 'Elétrico', prefix: 'D', pins: pins2(V2, 'E', ['A', 'K']), bbox: [-0.7, -2, 0.7, 2], lbl: [0.9, -0.5],
    params: [{ k: 'Is', l: 'Corrente de saturação', u: 'A', def: '10f' }, { k: 'n', l: 'Fator de idealidade', u: '', def: '1' }],
    val: () => '',
    draw(g) {
      D.line(g, 0, -2, 0, -0.5); D.line(g, 0, 0.5, 0, 2);
      g.beginPath(); g.moveTo(-0.6, -0.5); g.lineTo(0.6, -0.5); g.lineTo(0, 0.5); g.closePath(); g.stroke();
      D.line(g, -0.6, 0.5, 0.6, 0.5);
    },
  },
  SW: {
    name: 'Chave temporizada', cat: 'Elétrico', prefix: 'S', pins: pins2(V2, 'E', ['A', 'B']), bbox: [-0.8, -2, 0.6, 2], lbl: [0.9, -0.5],
    params: [{ k: 'ton', l: 'Fecha em', u: 's', def: '0' }, { k: 'toff', l: 'Abre em', u: 's', def: '1e9' },
      { k: 'Ron', l: 'R fechada', u: 'Ω', def: '10m' }, { k: 'Roff', l: 'R aberta', u: 'Ω', def: '100meg' }],
    val: c => `on ${c.params.ton}s / off ${c.params.toff}s`,
    draw(g) { D.line(g, 0, -2, 0, -0.8); D.circle(g, 0, -0.8, 0.1); D.line(g, 0, 0.8, -0.7, -0.6); D.circle(g, 0, 0.8, 0.1); D.line(g, 0, 0.8, 0, 2); },
  },
  GND: {
    name: 'Terra elétrico', cat: 'Elétrico', prefix: '', pins: [[0, 0, 'E', 'GND']], bbox: [-0.8, 0, 0.8, 1.3], lbl: null, ground: true,
    params: [], val: () => '',
    draw(g) { D.line(g, 0, 0, 0, 0.6); D.line(g, -0.8, 0.6, 0.8, 0.6); D.line(g, -0.5, 0.9, 0.5, 0.9); D.line(g, -0.2, 1.2, 0.2, 1.2); },
  },

  /* ═════════ ROTACIONAL ═════════ */
  J: {
    name: 'Inércia (volante)', cat: 'Rotacional', prefix: 'J', pins: pins2(H2, 'R', ['eixo', 'eixo']), same: [[0, 1]], bbox: [-2, -1.5, 2, 1.5], lbl: [0, -2.0],
    params: [{ k: 'J', l: 'Momento de inércia', u: 'kg·m²', def: '10m' }, { k: 'w0', l: 'Velocidade inicial', u: 'rad/s', def: '0' }],
    val: c => c.params.J + ' kg·m²',
    draw(g) { D.line(g, -2, 0, 2, 0); D.rect(g, -0.35, -1.5, 0.7, 3, 'rgba(255,159,28,0.18)'); D.line(g, -0.35, -1.5, 0.35, 1.5); D.line(g, 0.35, -1.5, -0.35, 1.5); },
  },
  KR: {
    name: 'Mola torcional', cat: 'Rotacional', prefix: 'KR', pins: pins2(H2, 'R', ['1', '2']), bbox: [-2, -0.8, 2, 0.8], lbl: [0, -1.3],
    params: [{ k: 'k', l: 'Rigidez torcional', u: 'N·m/rad', def: '1' }, { k: 'th0', l: 'Torção inicial', u: 'rad', def: '0' }],
    val: c => c.params.k + ' N·m/rad',
    draw(g) {
      D.line(g, -2, 0, -1.3, 0); D.line(g, 1.3, 0, 2, 0);
      g.beginPath();
      for (let i = 0; i <= 120; i++) { const s = i / 120 * 4; const x = -1.3 + 0.65 * s + 0.3 * (Math.cos(2 * Math.PI * s) - 1) * (s < 3.75 ? 1 : (4 - s) / 0.25); const y = -0.6 * Math.sin(2 * Math.PI * s); i ? g.lineTo(x, y) : g.moveTo(x, y); }
      g.stroke();
    },
  },
  BR: {
    name: 'Amortecedor rotacional', cat: 'Rotacional', prefix: 'BR', pins: pins2(H2, 'R', ['1', '2']), bbox: [-2, -0.8, 2, 0.8], lbl: [0, -1.3],
    params: [{ k: 'b', l: 'Coef. de atrito viscoso', u: 'N·m·s/rad', def: '10m' }],
    val: c => c.params.b + ' N·m·s/rad',
    draw(g) { D.dashpot(g); D.curlArrow(g, 1.3, 0, 0.35); },
  },
  TS: {
    name: 'Fonte de torque', cat: 'Rotacional', prefix: 'TQ', pins: pins2(V2, 'R'), bbox: [-1, -2, 1, 2], lbl: [1.3, -0.5],
    params: WAVE('N·m', '0.1'), val: c => waveText(c, 'N·m'),
    draw(g) { srcLeads(g); D.curlArrow(g, 0, 0, 0.55); },
  },
  WS: {
    name: 'Fonte de vel. angular', cat: 'Rotacional', prefix: 'W', pins: pins2(V2, 'R'), bbox: [-1, -2, 1, 2], lbl: [1.3, -0.5],
    params: WAVE('rad/s', '100'), val: c => waveText(c, 'rad/s'),
    draw(g, c, S) { srcLeads(g); S.text('ω', 0, 0.05, 1.0); },
  },
  RGND: {
    name: 'Mancal fixo (ref. rot.)', cat: 'Rotacional', prefix: '', pins: [[0, 0, 'R', 'ref']], bbox: [-1, 0, 1, 1.1], lbl: null, ground: true,
    params: [], val: () => '',
    draw(g) { D.hatchGround(g); D.circle(g, 0, 0.3, 0.12); },
  },
  GEAR: {
    name: 'Engrenagem / redutor', cat: 'Rotacional', prefix: 'GR', pins: [[-3, -1, 'R', 'entrada'], [3, 1, 'R', 'saída']], bbox: [-3, -2.2, 3, 2.2], lbl: [0, -2.7],
    params: [{ k: 'n', l: 'Relação n = z_saída / z_entrada', u: '', def: '5' },
      { k: 'inv', l: 'Inverte sentido (par externo)', type: 'sel', opts: ['sim', 'não'], def: 'sim' },
      { k: 'J1', l: 'Inércia pinhão (entrada)', u: 'kg·m²', def: '10u' },
      { k: 'J2', l: 'Inércia coroa (saída)', u: 'kg·m²', def: '100u' }],
    val: c => '1:' + c.params.n,
    draw(g) { D.gearCircle(g, 0, -1, 0.9, 10); D.gearCircle(g, 0, 1, 0.9, 10); D.line(g, -3, -1, 0, -1); D.line(g, 0, 1, 3, 1); D.circle(g, 0, -1, 0.1); D.circle(g, 0, 1, 0.1); },
  },

  /* ═════════ TRANSLACIONAL ═════════ */
  M: {
    name: 'Massa', cat: 'Translacional', prefix: 'M', pins: pins2(H2, 'T', ['1', '2']), same: [[0, 1]], bbox: [-2, -1, 2, 1], lbl: [0, -1.5],
    params: [{ k: 'm', l: 'Massa', u: 'kg', def: '1' }, { k: 'v0', l: 'Velocidade inicial', u: 'm/s', def: '0' }],
    val: c => c.params.m + ' kg',
    draw(g, c, S) { D.line(g, -2, 0, -1, 0); D.line(g, 1, 0, 2, 0); D.rect(g, -1, -1, 2, 2, 'rgba(61,220,132,0.15)'); S.text('m', 0, 0.05, 0.9); },
  },
  K: {
    name: 'Mola', cat: 'Translacional', prefix: 'K', pins: pins2(H2, 'T', ['1', '2']), bbox: [-2, -0.6, 2, 0.6], lbl: [0, -1.1],
    params: [{ k: 'k', l: 'Rigidez', u: 'N/m', def: '100' }, { k: 'x0', l: 'Deformação inicial', u: 'm', def: '0' }],
    val: c => c.params.k + ' N/m',
    draw(g) { D.line(g, -2, 0, -1.3, 0); D.zigH(g, -1.3, 1.3, 0, 5, 0.5); D.line(g, 1.3, 0, 2, 0); },
  },
  B: {
    name: 'Amortecedor', cat: 'Translacional', prefix: 'B', pins: pins2(H2, 'T', ['1', '2']), bbox: [-2, -0.8, 2, 0.8], lbl: [0, -1.3],
    params: [{ k: 'b', l: 'Coef. de amortecimento', u: 'N·s/m', def: '2' }],
    val: c => c.params.b + ' N·s/m',
    draw(g) { D.dashpot(g); },
  },
  FS: {
    name: 'Fonte de força', cat: 'Translacional', prefix: 'F', pins: pins2(V2, 'T'), bbox: [-1, -2, 1, 2], lbl: [1.3, -0.5],
    params: WAVE('N', '10'), val: c => waveText(c, 'N'),
    draw(g, c, S) { srcLeads(g); D.arrow(g, 0, 0.6, 0, -0.6); S.text('F', 0.45, 0.25, 0.6); },
  },
  US: {
    name: 'Fonte de velocidade', cat: 'Translacional', prefix: 'U', pins: pins2(V2, 'T'), bbox: [-1, -2, 1, 2], lbl: [1.3, -0.5],
    params: WAVE('m/s', '0.1'), val: c => waveText(c, 'm/s'),
    draw(g, c, S) { srcLeads(g); S.text('v', 0, 0.05, 1.0); },
  },
  TGND: {
    name: 'Parede (ref. fixa)', cat: 'Translacional', prefix: '', pins: [[0, 0, 'T', 'ref']], bbox: [-1, 0, 1, 1.1], lbl: null, ground: true,
    params: [], val: () => '',
    draw(g) { D.hatchGround(g); },
  },

  /* ═════════ ELETROMECÂNICO ═════════ */
  MOTOR: {
    name: 'Motor DC (ímã permanente)', cat: 'Eletromecânico', prefix: 'MOT',
    pins: [[-3, -1, 'E', '+'], [-3, 1, 'E', '−'], [3, 0, 'R', 'eixo']], bbox: [-3, -1.6, 3, 1.6], lbl: [0, -2.5],
    params: [{ k: 'Ra', l: 'Resistência de armadura', u: 'Ω', def: '2' },
      { k: 'La', l: 'Indutância de armadura', u: 'H', def: '10m' },
      { k: 'K', l: 'Constante Kt = Ke', u: 'N·m/A', def: '0.07' },
      { k: 'J', l: 'Inércia do rotor', u: 'kg·m²', def: '100u' },
      { k: 'B', l: 'Atrito viscoso do rotor', u: 'N·m·s/rad', def: '100u' }],
    val: c => `Ra=${c.params.Ra} K=${c.params.K}`,
    draw(g, c, S) {
      D.circle(g, 0, 0, 1.5, 'rgba(79,179,255,0.10)');
      D.line(g, -3, -1, -1.12, -1); D.line(g, -3, 1, -1.12, 1);
      g.save(); g.lineWidth *= 2.2; D.line(g, 1.5, 0, 3, 0); g.restore();
      S.text('M', 0, 0.05, 1.3); S.text('+', -2.5, -1.45, 0.6);
    },
  },
  VCOIL: {
    name: 'Atuador linear (bobina móvel)', cat: 'Eletromecânico', prefix: 'ACT',
    pins: [[-3, -1, 'E', '+'], [-3, 1, 'E', '−'], [3, 0, 'T', 'haste']], bbox: [-3, -1.6, 3, 1.6], lbl: [0, -2.1],
    params: [{ k: 'Ra', l: 'Resistência da bobina', u: 'Ω', def: '4' },
      { k: 'La', l: 'Indutância da bobina', u: 'H', def: '1m' },
      { k: 'Bl', l: 'Fator de força Bl', u: 'N/A', def: '5' },
      { k: 'm', l: 'Massa móvel', u: 'kg', def: '20m' },
      { k: 'b', l: 'Amortecimento interno', u: 'N·s/m', def: '0.5' }],
    val: c => `Bl=${c.params.Bl}`,
    draw(g, c, S) {
      D.rect(g, -1.5, -1.5, 3, 3, 'rgba(61,220,132,0.08)');
      D.line(g, -3, -1, -1.5, -1); D.line(g, -3, 1, -1.5, 1);
      D.zigV(g, -1, 1, -0.6, 3, 0.35);
      g.save(); g.lineWidth *= 2.2; D.line(g, 0.2, 0, 3, 0); g.restore();
      S.text('+', -2.5, -1.45, 0.6);
    },
  },
  RACK: {
    name: 'Pinhão-cremalheira', cat: 'Eletromecânico', prefix: 'RP',
    pins: [[-3, 0, 'R', 'pinhão'], [1, 3, 'T', 'cremalheira']], bbox: [-3, -2.3, 1.5, 3], lbl: [-1, -2.7],
    params: [{ k: 'r', l: 'Raio primitivo do pinhão', u: 'm', def: '50m' }],
    val: c => 'r=' + c.params.r + 'm',
    draw(g) {
      D.gearCircle(g, 0, 0, 0.75, 9); D.circle(g, 0, 0, 0.1); D.line(g, -3, 0, 0, 0);
      D.rect(g, 0.95, -2.2, 0.4, 4.2, 'rgba(61,220,132,0.15)');
      for (let y = -2; y <= 1.9; y += 0.4) D.line(g, 0.95, y, 0.8, y + 0.2);
      D.line(g, 1, 2, 1, 3);
    },
  },

  /* ═════════ CONTROLE & SENSORES ═════════ */
  PID: {
    name: 'Controlador PID', cat: 'Controle & sensores', prefix: 'PID',
    pins: [[-3, -1, 'E', 'ref'], [-3, 1, 'E', 'med'], [3, 0, 'E', 'u']], bbox: [-3, -1.8, 3, 1.8], lbl: [0, -2.8],
    params: [{ k: 'Kp', l: 'Ganho proporcional Kp', u: '', def: '1' },
      { k: 'Ki', l: 'Ganho integral Ki', u: '1/s', def: '0' },
      { k: 'Kd', l: 'Ganho derivativo Kd', u: 's', def: '0' },
      { k: 'Umin', l: 'Saída mínima', u: 'V', def: '-24' },
      { k: 'Umax', l: 'Saída máxima', u: 'V', def: '24' }],
    val: c => `Kp=${c.params.Kp} Ki=${c.params.Ki} Kd=${c.params.Kd}`,
    draw(g, c, S) {
      D.rect(g, -2, -1.8, 4, 3.6, 'rgba(199,125,255,0.10)');
      D.line(g, -3, -1, -2, -1); D.line(g, -3, 1, -2, 1); D.line(g, 2, 0, 3, 0);
      S.text('PID', 0.2, 0.05, 0.9); S.text('+', -1.5, -1, 0.6); S.text('−', -1.5, 1, 0.6);
    },
  },
  TACHO: {
    name: 'Tacômetro (ω → V)', cat: 'Controle & sensores', prefix: 'TG',
    pins: [[-2, 0, 'R', 'eixo'], [2, 0, 'E', 'saída']], bbox: [-2, -0.9, 2, 0.9], lbl: [0, -1.4],
    params: [{ k: 'K', l: 'Ganho', u: 'V/(rad/s)', def: '10m' }],
    val: c => c.params.K + ' V/(rad/s)',
    draw(g, c, S) { D.line(g, -2, 0, -1, 0); D.line(g, 1, 0, 2, 0); D.rect(g, -1, -0.8, 2, 1.6, 'rgba(255,159,28,0.10)'); S.text('TG', 0, 0.05, 0.7); },
  },
  VSENS: {
    name: 'Sensor de velocidade (v → V)', cat: 'Controle & sensores', prefix: 'SV',
    pins: [[-2, 0, 'T', 'haste'], [2, 0, 'E', 'saída']], bbox: [-2, -0.9, 2, 0.9], lbl: [0, -1.4],
    params: [{ k: 'K', l: 'Ganho', u: 'V/(m/s)', def: '1' }],
    val: c => c.params.K + ' V/(m/s)',
    draw(g, c, S) { D.line(g, -2, 0, -1, 0); D.line(g, 1, 0, 2, 0); D.rect(g, -1, -0.8, 2, 1.6, 'rgba(61,220,132,0.10)'); S.text('v→V', 0, 0.05, 0.55); },
  },
  LABEL: {
    name: 'Rótulo de nó', cat: 'Controle & sensores', prefix: '', pins: [[0, 0, 'A', 'nó']], bbox: [-0.3, -0.9, 2.5, 0.3], lbl: null,
    params: [{ k: 'name', l: 'Nome do nó', u: '', def: 'saida', type: 'text' }],
    val: () => '',
    draw(g, c, S) {
      g.beginPath(); g.moveTo(0, 0); g.lineTo(0.3, -0.35); g.lineTo(0, -0.7); g.lineTo(-0.3, -0.35); g.closePath(); g.stroke();
      S.text(c.params.name, 0.45, -0.35, 0.75, 'left');
    },
  },
};

MS.CATS = ['Elétrico', 'Rotacional', 'Translacional', 'Eletromecânico', 'Controle & sensores'];

MS.newComp = function (type, x, y, rot, doc) {
  const d = MS.DEFS[type];
  const params = {};
  for (const p of d.params) params[p.k] = p.def;
  let name = '';
  if (d.prefix && doc) {
    let n = 1;
    const used = new Set(doc.comps.map(c => c.name));
    while (used.has(d.prefix + n)) n++;
    name = d.prefix + n;
  }
  return { id: MS.uid(), type, x, y, rot: rot || 0, name, params };
};
MS.uid = () => Math.random().toString(36).slice(2, 10);
