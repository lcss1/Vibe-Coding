/* ============================================================
   MeControlEng — CLP: editor Ladder + simulação do ciclo de varredura
   Endereços (estilo IEC/Siemens): I0.0–I0.7 entradas · Q0.0–Q0.7 saídas ·
   M0.0–M1.7 memórias · T0–T7 temporizadores · C0–C7 contadores
   ============================================================ */
'use strict';
(function () {
  const CS = MS.CS, h = CS.h;
  const C = 8, CW = 78, CH = 52, RAIL = 12, OW = 104;

  /* ───────── endereços ───────── */
  const ADDR = {
    I: [...Array(8)].map((_, i) => 'I0.' + i),
    Q: [...Array(8)].map((_, i) => 'Q0.' + i),
    M: [...Array(16)].map((_, i) => `M${i >> 3}.${i & 7}`),
    T: [...Array(8)].map((_, i) => 'T' + i),
    C: [...Array(8)].map((_, i) => 'C' + i),
  };
  const ALL = [...ADDR.I, ...ADDR.Q, ...ADDR.M, ...ADDR.T, ...ADDR.C];
  const GROUPS = [['I', 'Entradas (I)'], ['Q', 'Saídas (Q)'], ['M', 'Memórias (M)'], ['T', 'Temporizadores (T)'], ['C', 'Contadores (C)']];

  const TOOLS = [
    ['SEL', '⬚', 'Selecionar / editar'], ['NO', '┤ ├', 'Contato NA (normalmente aberto)'], ['NC', '┤/├', 'Contato NF (normalmente fechado)'],
    ['P', '┤P├', 'Contato de borda de subida'], ['N', '┤N├', 'Contato de borda de descida'], ['H', '──', 'Fio horizontal'], ['VL', '┃', 'Ligação vertical (ramo paralelo) — clique na célula à direita da ligação'],
    ['OUT', '( )', 'Bobina'], ['NOT', '(/)', 'Bobina negada'], ['S', '(S)', 'Bobina SET (liga e mantém)'], ['R', '(R)', 'Bobina RESET (desliga / zera T e C)'],
    ['TON', 'TON', 'Temporizador com atraso na ligação'], ['TOF', 'TOF', 'Temporizador com atraso no desligamento'], ['CTU', 'CTU', 'Contador crescente'], ['DEL', '⌫', 'Apagar elemento'],
  ];
  const isCoil = t => ['OUT', 'NOT', 'S', 'R', 'TON', 'TOF', 'CTU'].includes(t);

  /* ───────── plantas virtuais ───────── */
  const PLANTS = {
    painel: { name: 'Painel (botões e lâmpadas)', auto: [], init: () => ({}), step() {}, draw: null },
    motor: {
      name: 'Partida de motor', auto: [],
      init: () => ({ ang: 0, w: 0 }),
      step(st, dt, Q) { const tgt = Q['Q0.0'] ? 1 : 0; st.w += (tgt - st.w) * Math.min(1, dt * 2.5); st.ang += st.w * dt * 25; },
      draw(g, W, H, st, Q) {
        const cx = W / 2, cy = H / 2 + 6;
        g.fillStyle = '#1b2a44'; g.fillRect(cx - 70, cy - 32, 100, 64); g.fillStyle = '#2b4a78'; g.fillRect(cx - 66, cy - 28, 92, 56);
        g.fillStyle = '#9aa7b8'; g.fillRect(cx + 30, cy - 4, 30, 8);
        g.save(); g.translate(cx + 66, cy); g.rotate(st.ang); g.fillStyle = '#ff9f1c';
        for (let i = 0; i < 3; i++) { g.rotate(Math.PI * 2 / 3); g.beginPath(); g.ellipse(0, -14, 6, 14, 0, 0, Math.PI * 2); g.fill(); }
        g.restore();
        lamp(g, cx - 60, 20, Q['Q0.0'], '#3ddc84', 'K1');
        g.fillStyle = '#c3d3e8'; g.font = '12px Barlow'; g.textAlign = 'center'; g.fillText(`${Math.round(st.w * 1750)} RPM`, cx - 20, H - 10);
      },
    },
    tanque: {
      name: 'Tanque com bomba e válvula', auto: ['I0.2', 'I0.3'],
      init: () => ({ lvl: 0.1, t: 0 }),
      step(st, dt, Q, I) { st.t += dt; st.lvl += ((Q['Q0.0'] ? 0.07 : 0) - (Q['Q0.1'] ? 0.045 : 0)) * dt; st.lvl = Math.max(0, Math.min(1, st.lvl)); I['I0.2'] = st.lvl > 0.2; I['I0.3'] = st.lvl > 0.8; },
      draw(g, W, H, st, Q) {
        const x0 = W / 2 - 50, y0 = 22, w = 100, hh = H - 50;
        g.fillStyle = 'rgba(47,127,214,0.75)'; g.fillRect(x0, y0 + hh * (1 - st.lvl), w, hh * st.lvl);
        g.strokeStyle = '#9fb4d0'; g.lineWidth = 2; g.strokeRect(x0, y0, w, hh);
        for (const [lv, ad] of [[0.2, 'I0.2'], [0.8, 'I0.3']]) { const y = y0 + hh * (1 - lv); g.strokeStyle = 'rgba(255,209,102,0.6)'; g.setLineDash([4, 3]); g.beginPath(); g.moveTo(x0 - 6, y); g.lineTo(x0 + w + 6, y); g.stroke(); g.setLineDash([]); g.fillStyle = (lv === 0.2 ? st.lvl > 0.2 : st.lvl > 0.8) ? '#3ddc84' : '#33404f'; g.beginPath(); g.arc(x0 + w + 14, y, 5, 0, 7); g.fill(); g.fillStyle = '#9fb4d0'; g.font = '10px Barlow'; g.textAlign = 'left'; g.fillText(ad, x0 + w + 22, y + 3); }
        g.fillStyle = Q['Q0.0'] ? '#3ddc84' : '#33404f'; g.beginPath(); g.arc(x0 - 26, y0 + 10, 11, 0, 7); g.fill(); g.fillStyle = '#c3d3e8'; g.font = '10px Barlow'; g.textAlign = 'center'; g.fillText('bomba', x0 - 26, y0 + 32);
        g.fillStyle = Q['Q0.1'] ? '#3ddc84' : '#33404f'; g.fillRect(x0 + w / 2 - 8, y0 + hh + 4, 16, 10); g.fillStyle = '#c3d3e8'; g.fillText('válvula', x0 + w / 2, y0 + hh + 24);
        if (Q['Q0.0']) { g.fillStyle = 'rgba(47,127,214,0.8)'; g.fillRect(x0 + 6, y0 + 2, 5, hh * (1 - st.lvl)); }
        g.fillStyle = '#e8f4ff'; g.font = '12px Barlow'; g.fillText(Math.round(st.lvl * 100) + ' %', x0 + w / 2, y0 + hh / 2);
      },
    },
    semaforo: {
      name: 'Semáforo', auto: [],
      init: () => ({}), step() {},
      draw(g, W, H, st, Q) {
        const cx = W / 2; g.fillStyle = '#15181f'; g.fillRect(cx - 26, 12, 52, H - 24);
        [['Q0.0', '#ff3b3b'], ['Q0.1', '#ffd23b'], ['Q0.2', '#3dff7a']].forEach(([a, c], i) => lamp(g, cx, 36 + i * ((H - 48) / 3), Q[a], c, a, 18));
      },
    },
  };
  function lamp(g, x, y, on, color, label, r = 12) {
    if (on) { g.shadowColor = color; g.shadowBlur = 18; }
    g.fillStyle = on ? color : '#2a313c'; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); g.shadowBlur = 0;
    if (label && r < 15) { g.fillStyle = '#c3d3e8'; g.font = '10px Barlow'; g.textAlign = 'center'; g.fillText(label, x, y + r + 12); }
  }

  /* ───────── programas de exemplo ───────── */
  const row = (cells, out, ext = {}) => ({ cells: [...cells, ...Array(C - cells.length).fill(null)].slice(0, C), out: out || null, ...ext });
  const c_ = (t, a) => ({ t, a });
  const fillH = r => { let last = -1; r.cells.forEach((x, i) => { if (x) last = i; }); if (r.out) for (let i = last + 1; i < C; i++) r.cells[i] = { t: 'H' }; return r; };
  const rung = (rows, vl = [], comment = '') => {
    rows.forEach(fillH);
    const V = rows.map(() => Array(C + 1).fill(false));
    for (const [r, b] of vl) V[r][b] = true;
    return { rows, vl: V, comment };
  };
  const EXAMPLES = {
    selo: {
      name: 'Partida direta com selo (liga/desliga)', plant: 'motor',
      tags: { 'I0.0': 'Botão LIGA', 'I0.1': 'Botão DESLIGA', 'Q0.0': 'Contator K1 (motor)' },
      rungs: [rung([row([c_('NO', 'I0.0'), c_('NC', 'I0.1')], c_('OUT', 'Q0.0')), row([c_('NO', 'Q0.0')])], [[0, 0], [0, 1]], 'Selo: o contato Q0.0 em paralelo com o botão LIGA mantém o motor ligado.')],
    },
    pisca: {
      name: 'Pisca-pisca com dois temporizadores', plant: 'painel',
      tags: { 'I0.0': 'Chave habilita', 'Q0.0': 'Lâmpada', 'T0': 'Tempo apagada', 'T1': 'Tempo acesa' },
      rungs: [
        rung([row([c_('NO', 'I0.0'), c_('NC', 'T1')], { t: 'TON', a: 'T0', p: '1' })], [], 'T0 conta 1 s; quando T1 termina, T0 é reiniciado.'),
        rung([row([c_('NO', 'T0')], { t: 'TON', a: 'T1', p: '1' })]),
        rung([row([c_('NO', 'T0')], c_('OUT', 'Q0.0'))], [], 'A lâmpada acende enquanto T1 conta.'),
      ],
    },
    semaforo: {
      name: 'Semáforo (sequência temporizada)', plant: 'semaforo',
      tags: { 'I0.0': 'Chave liga semáforo', 'Q0.0': 'Vermelho', 'Q0.1': 'Amarelo', 'Q0.2': 'Verde', 'T0': 'Verde 5 s', 'T1': 'Amarelo 2 s', 'T2': 'Vermelho 5 s' },
      rungs: [
        rung([row([c_('NO', 'I0.0'), c_('NC', 'T2')], { t: 'TON', a: 'T0', p: '5' })], [], 'Cadeia de temporizadores: T0 → T1 → T2 → reinicia.'),
        rung([row([c_('NO', 'T0')], { t: 'TON', a: 'T1', p: '2' })]),
        rung([row([c_('NO', 'T1')], { t: 'TON', a: 'T2', p: '5' })]),
        rung([row([c_('NO', 'I0.0'), c_('NC', 'T0')], c_('OUT', 'Q0.2'))]),
        rung([row([c_('NO', 'T0'), c_('NC', 'T1')], c_('OUT', 'Q0.1'))]),
        rung([row([c_('NO', 'T1')], c_('OUT', 'Q0.0')), row([c_('NC', 'I0.0')])], [[0, 0], [0, 1]], 'Vermelho também com o semáforo desligado.'),
      ],
    },
    tanque: {
      name: 'Controle liga/desliga de nível (SET/RESET)', plant: 'tanque',
      tags: { 'I0.0': 'Chave consumo', 'I0.2': 'Sensor nível baixo', 'I0.3': 'Sensor nível alto', 'Q0.0': 'Bomba', 'Q0.1': 'Válvula de saída' },
      rungs: [
        rung([row([c_('NC', 'I0.2')], c_('S', 'Q0.0'))], [], 'Abaixo do nível baixo: liga a bomba (SET).'),
        rung([row([c_('NO', 'I0.3')], c_('R', 'Q0.0'))], [], 'Acima do nível alto: desliga a bomba (RESET).'),
        rung([row([c_('NO', 'I0.0')], c_('OUT', 'Q0.1'))], [], 'Consumo manual pela válvula de saída.'),
      ],
    },
    contador: {
      name: 'Contador de peças (CTU)', plant: 'painel',
      tags: { 'I0.0': 'Botão sensor de peça', 'I0.1': 'Botão zerar', 'Q0.0': 'Lâmpada lote completo', 'C0': 'Peças (5)' },
      rungs: [
        rung([row([c_('NO', 'I0.0')], { t: 'CTU', a: 'C0', p: '5' })], [], 'Cada pulso em I0.0 incrementa C0.'),
        rung([row([c_('NO', 'C0')], c_('OUT', 'Q0.0'))], [], 'Lote completo quando C0 ≥ 5.'),
        rung([row([c_('NO', 'I0.1')], c_('R', 'C0'))]),
      ],
    },
    reversao: {
      name: 'Reversão de motor com intertravamento', plant: 'painel',
      tags: { 'I0.0': 'Botão HORÁRIO', 'I0.1': 'Botão ANTI-HORÁRIO', 'I0.2': 'Botão PARAR', 'Q0.0': 'K1 horário', 'Q0.1': 'K2 anti-horário' },
      rungs: [
        rung([row([c_('NO', 'I0.0'), c_('NC', 'I0.2'), c_('NC', 'Q0.1')], c_('OUT', 'Q0.0')), row([c_('NO', 'Q0.0')])], [[0, 0], [0, 1]], 'Intertravamento: K1 só liga se K2 estiver desligado.'),
        rung([row([c_('NO', 'I0.1'), c_('NC', 'I0.2'), c_('NC', 'Q0.0')], c_('OUT', 'Q0.1')), row([c_('NO', 'Q0.1')])], [[0, 0], [0, 1]]),
      ],
    },
  };

  /* ───────── estado ───────── */
  const load = () => { try { const d = JSON.parse(localStorage.getItem('mecontroleng.plc')); if (d && d.rungs) return d; } catch (e) { /* */ } return clone(EXAMPLES.selo); };
  function clone(ex) { return JSON.parse(JSON.stringify({ rungs: ex.rungs, tags: ex.tags || {}, plant: ex.plant || 'painel', modes: {} })); }
  CS.plc = load();
  const save = () => { try { localStorage.setItem('mecontroleng.plc', JSON.stringify(CS.plc)); } catch (e) { /* */ } };

  const E = CS.plcEngine = {
    running: false, scanMs: 50, scans: 0,
    reset() {
      this.mem = {}; ALL.forEach(a => { this.mem[a] = false; });
      this.tim = {}; ADDR.T.forEach(a => { this.tim[a] = { et: 0, pt: 0, dn: false, on: false }; });
      this.cnt = {}; ADDR.C.forEach(a => { this.cnt[a] = { cv: 0, pv: 0, dn: false, prev: false }; });
      this.edge = {}; this.btn = {}; this.pow = null; this.scans = 0;
      const P = PLANTS[CS.plc.plant] || PLANTS.painel; this.plantSt = P.init();
    },
    bit(a) { return a && a[0] === 'T' ? this.tim[a] && this.tim[a].dn : a && a[0] === 'C' ? this.cnt[a] && this.cnt[a].dn : !!this.mem[a]; },
    /* um ciclo de varredura: entradas → programa → saídas */
    scan(dt) {
      const P = PLANTS[CS.plc.plant] || PLANTS.painel;
      const Qimg = {}; ADDR.Q.forEach(a => { Qimg[a] = this.mem[a]; });
      const Iimg = {};
      ADDR.I.forEach(a => { Iimg[a] = !!this.btn[a]; });
      P.step(this.plantSt, dt, Qimg, Iimg);
      ADDR.I.forEach(a => { this.mem[a] = Iimg[a]; });
      const pow = [];
      CS.plc.rungs.forEach((rg, ri) => {
        const R = rg.rows.length;
        const pass = rg.rows.map((rw, r) => rw.cells.map((cell, c) => {
          if (!cell) return false;
          if (cell.t === 'H') return true;
          const v = this.bit(cell.a);
          if (cell.t === 'NO') return v;
          if (cell.t === 'NC') return !v;
          const key = `${ri}.${r}.${c}`, prev = this.edge[key] || false; this.edge[key] = v;
          return cell.t === 'P' ? v && !prev : !v && prev;
        }));
        const p = rg.rows.map(() => Array(C + 1).fill(false));
        p[0][0] = true;
        for (let it = 0; it < (C + 2) * (R + 1); it++) {
          let ch = false;
          for (let r = 0; r < R; r++) {
            for (let b = 0; b < C; b++) if (p[r][b] && pass[r][b] && !p[r][b + 1]) { p[r][b + 1] = true; ch = true; }
            if (r < R - 1) for (let b = 0; b <= C; b++) if (rg.vl[r][b] && p[r][b] !== p[r + 1][b]) { p[r][b] = p[r + 1][b] = true; ch = true; }
          }
          if (!ch) break;
        }
        rg.rows.forEach((rw, r) => { if (rw.out) this.exec(rw.out, p[r][C], dt); });
        pow.push({ p, pass });
      });
      this.pow = pow; this.scans++;
    },
    exec(o, on, dt) {
      const a = o.a, pr = MS.parseEng(o.p) || 0;
      switch (o.t) {
        case 'OUT': this.mem[a] = on; break;
        case 'NOT': this.mem[a] = !on; break;
        case 'S': if (on) this.mem[a] = true; break;
        case 'R': if (on) { if (a[0] === 'T') Object.assign(this.tim[a], { et: 0, dn: false }); else if (a[0] === 'C') Object.assign(this.cnt[a], { cv: 0, dn: false }); else this.mem[a] = false; } break;
        case 'TON': { const t = this.tim[a]; if (!t) break; t.pt = pr; t.on = on; if (on) { t.et = Math.min(pr, t.et + dt); t.dn = t.et >= pr - 1e-9; } else { t.et = 0; t.dn = false; } break; }
        case 'TOF': { const t = this.tim[a]; if (!t) break; t.pt = pr; if (on) { t.et = 0; t.dn = true; t.armed = true; } else if (t.armed) { t.et = Math.min(pr, t.et + dt); t.dn = t.et < pr - 1e-9; } t.on = on; break; }
        case 'CTU': { const k = this.cnt[a]; if (!k) break; k.pv = pr; if (on && !k.prev) k.cv++; k.prev = on; k.dn = k.cv >= pr; break; }
      }
    },
  };
  E.reset();

  /* ───────── desenho das células (SVG) ───────── */
  const COLW = '#4a6488', COLP = '#3ddc84';
  const tagOf = a => (CS.plc.tags[a] || '');
  const esc = s => String(s).replace(/[&<>"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
  function cellSVG(cell, L, Rp, pass, w = CW) {
    const m = CH / 2, lc = L ? COLP : COLW, rc = Rp ? COLP : COLW;
    if (!cell) return '';
    if (cell.t === 'H') return `<svg width="${w}" height="${CH}"><line x1="0" y1="${m}" x2="${w}" y2="${m}" stroke="${L ? COLP : COLW}" stroke-width="2"/></svg>`;
    const a = esc(cell.a || '?'), tag = esc(tagOf(cell.a)).slice(0, 14);
    const cc = pass ? COLP : '#8fa3bd';
    let sym = `<line x1="0" y1="${m}" x2="30" y2="${m}" stroke="${lc}" stroke-width="2"/><line x1="48" y1="${m}" x2="${w}" y2="${m}" stroke="${rc}" stroke-width="2"/>
      <line x1="30" y1="${m - 11}" x2="30" y2="${m + 11}" stroke="${cc}" stroke-width="2.4"/><line x1="48" y1="${m - 11}" x2="48" y2="${m + 11}" stroke="${cc}" stroke-width="2.4"/>`;
    if (cell.t === 'NC') sym += `<line x1="27" y1="${m + 11}" x2="51" y2="${m - 11}" stroke="${cc}" stroke-width="1.8"/>`;
    if (cell.t === 'P' || cell.t === 'N') sym += `<text x="39" y="${m + 4}" text-anchor="middle" fill="${cc}" font-size="11" font-family="Share Tech Mono">${cell.t}</text>`;
    if (pass) sym += `<rect x="31" y="${m - 9}" width="16" height="18" fill="rgba(61,220,132,0.15)"/>`;
    return `<svg width="${w}" height="${CH}">${sym}<text x="39" y="10" text-anchor="middle" class="ad">${a}</text><text x="39" y="${CH - 2}" text-anchor="middle" class="tg">${tag}</text></svg>`;
  }
  function outSVG(o, L, eng) {
    const m = CH / 2, w = OW, lc = L ? COLP : COLW;
    if (!o) return '';
    const a = esc(o.a || '?'), tag = esc(tagOf(o.a)).slice(0, 16);
    if (['TON', 'TOF', 'CTU'].includes(o.t)) {
      let info = '', frac = 0;
      if (o.t === 'CTU') { const k = eng.cnt[o.a]; info = k ? `${k.cv}/${o.p}` : `PV ${o.p}`; frac = k ? Math.min(1, k.cv / (MS.parseEng(o.p) || 1)) : 0; }
      else { const t = eng.tim[o.a]; info = t ? `${t.et.toFixed(1)}/${o.p}s` : `PT ${o.p}s`; frac = t ? t.et / (MS.parseEng(o.p) || 1) : 0; }
      const dn = eng.bit(o.a);
      return `<svg width="${w}" height="${CH}"><line x1="0" y1="${m}" x2="18" y2="${m}" stroke="${lc}" stroke-width="2"/>
        <rect x="18" y="5" width="${w - 24}" height="${CH - 10}" rx="3" fill="${dn ? 'rgba(61,220,132,0.15)' : 'rgba(255,255,255,0.03)'}" stroke="${L ? COLP : '#8fa3bd'}" stroke-width="1.6"/>
        <text x="${w / 2 + 3}" y="17" text-anchor="middle" class="ad">${o.t} ${a}</text>
        <rect x="24" y="${CH - 20}" width="${(w - 36) * Math.max(0, Math.min(1, frac))}" height="5" fill="#ffd166"/>
        <text x="${w / 2 + 3}" y="${CH - 25}" text-anchor="middle" class="tg">${info}</text></svg>`;
    }
    const on = o.t === 'S' || o.t === 'R' ? L : eng.bit(o.a);
    const inner = { OUT: '', NOT: '/', S: 'S', R: 'R' }[o.t];
    return `<svg width="${w}" height="${CH}"><line x1="0" y1="${m}" x2="${w / 2 - 12}" y2="${m}" stroke="${lc}" stroke-width="2"/><line x1="${w / 2 + 12}" y1="${m}" x2="${w}" y2="${m}" stroke="${lc}" stroke-width="2"/>
      <path d="M${w / 2 - 6} ${m - 12} Q${w / 2 - 14} ${m} ${w / 2 - 6} ${m + 12} M${w / 2 + 6} ${m - 12} Q${w / 2 + 14} ${m} ${w / 2 + 6} ${m + 12}" fill="none" stroke="${on ? COLP : '#8fa3bd'}" stroke-width="2.2"/>
      ${on ? `<circle cx="${w / 2}" cy="${m}" r="7" fill="rgba(61,220,132,0.35)"/>` : ''}
      <text x="${w / 2}" y="${m + 4}" text-anchor="middle" fill="#e8f4ff" font-size="11" font-family="Share Tech Mono">${inner}</text>
      <text x="${w / 2}" y="10" text-anchor="middle" class="ad">${a}</text><text x="${w / 2}" y="${CH - 2}" text-anchor="middle" class="tg">${tag}</text></svg>`;
  }

  /* ───────── ferramenta: editor Ladder ───────── */
  let tool = 'SEL', sel = null, lastAddr = { c: 'I0.0', o: 'Q0.0' };
  let timer = null, lastT = 0;
  const listeners = new Set();
  const notify = () => listeners.forEach(f => f());
  const startStop = () => {
    if (E.running) { E.running = false; clearInterval(timer); timer = null; }
    else { E.reset(); E.running = true; lastT = performance.now(); timer = setInterval(() => { const t = performance.now(); const dt = Math.min(0.2, (t - lastT) / 1000); lastT = t; E.scan(dt); notify(); }, E.scanMs); }
    notify();
  };

  const toolLadder = (host, onClean) => {
    const { body } = CS.page(host, {
      title: 'CLP — Programação em Ladder', lead: 'Monte a lógica com contatos e bobinas, clique em <b>▶ RUN</b> e acione as entradas no painel. O programa roda em ciclos de varredura, como num CLP real.',
      learn: `<p><b>CLP</b> (Controlador Lógico Programável) é um computador industrial que repete sem parar o <b>ciclo de varredura</b>:</p>
      <ol><li>lê todas as entradas (I) para uma imagem;</li><li>executa o programa, rung por rung, de cima para baixo e da esquerda para a direita;</li><li>atualiza as saídas (Q).</li></ol>
      <p><b>Ladder</b> (diagrama de contatos) imita os antigos painéis de relés: a "energia" flui do trilho esquerdo para o direito.</p>
      <ul><li><b>┤ ├ NA</b>: fecha quando o bit vale 1.</li><li><b>┤/├ NF</b>: fecha quando o bit vale 0.</li>
      <li>Contatos <b>em série</b> = E (AND); <b>em paralelo</b> (ligação vertical) = OU (OR).</li>
      <li><b>( )</b> bobina: o bit recebe o estado do rung. <b>(S)/(R)</b>: liga e mantém / desliga.</li>
      <li><b>Selo</b>: um contato da própria saída em paralelo com o botão mantém a saída ligada depois que o botão é solto.</li>
      <li><b>TON</b>: o bit T vai a 1 depois de o rung ficar energizado por PT segundos. <b>TOF</b>: segura em 1 por PT segundos após desenergizar.</li>
      <li><b>CTU</b>: conta as bordas de subida; o bit C vai a 1 quando a contagem ≥ PV. Zere com (R) no Cn.</li>
      <li><b>P/N</b>: contato de borda, fecha só por uma varredura na subida/descida do bit.</li></ul>
      <p><b>Botão NF físico:</b> se o botão de parada é NF no campo, a entrada vale 1 em repouso. Aqui os botões são NA; por isso usamos contato NF no programa.</p>
      <p><b>Intertravamento:</b> contatos NF cruzados impedem que duas saídas incompatíveis (como as de uma reversão) liguem juntas.</p>`,
    });
    const ex = h('select', {}, h('option', { value: '' }, 'Exemplos…'), ...Object.entries(EXAMPLES).map(([k, e]) => h('option', { value: k }, e.name)));
    const run = h('button', { class: 'btn run-plc', onclick: startStop });
    const scanInfo = h('span', { class: 'mono muted small' });
    const tb = h('div', { class: 'plc-tools' }, ...TOOLS.map(([id, sym, tip]) => h('button', { class: 'ptool', 'data-t': id, title: tip, onclick: () => { tool = id; paintTools(); } }, h('span', { class: 'ps' }, sym), h('small', {}, tip.split(' (')[0].split(' —')[0]))));
    const ladder = h('div', { class: 'ladder' });
    const props = h('div'), panel = h('div', { class: 'plc-panel' }), cvBox = h('div', { class: 'plant-box' });
    const plantSel = h('select', {}, ...Object.entries(PLANTS).map(([k, p]) => h('option', { value: k }, p.name)));
    plantSel.value = CS.plc.plant;
    const cv = h('canvas', { width: 300, height: 190 }); cvBox.append(cv);
    body.append(
      CS.card(null, h('div', { class: 'row gap wrap' }, run, scanInfo, ex,
        h('button', { class: 'btn sm', onclick: () => { CS.plc.rungs.push(emptyRung()); save(); renderLadder(); } }, '+ Rung'),
        h('button', { class: 'btn sm', onclick: () => { if (confirm('Apagar todo o programa?')) { CS.plc.rungs = [emptyRung()]; save(); renderLadder(); } } }, 'Limpar'),
        h('button', { class: 'btn sm', onclick: () => download() }, 'Exportar'),
        h('button', { class: 'btn sm', onclick: () => upload() }, 'Importar')), tb),
      h('div', { class: 'grid-plc' },
        CS.card('Programa', ladder),
        h('div', { class: 'col' },
          CS.card('Planta / painel virtual', plantSel, cvBox, panel),
          CS.card('Elemento selecionado', props))));
    plantSel.addEventListener('change', () => { CS.plc.plant = plantSel.value; save(); E.reset(); renderPanel(); notify(); });
    ex.addEventListener('change', () => {
      const e = EXAMPLES[ex.value]; ex.value = ''; if (!e) return;
      if (E.running) startStop();
      CS.plc = clone(e); save(); E.reset(); plantSel.value = CS.plc.plant; sel = null; renderAll();
    });
    const paintTools = () => tb.querySelectorAll('.ptool').forEach(b => b.classList.toggle('on', b.dataset.t === tool));

    function emptyRung() { return { rows: [{ cells: Array(C).fill(null), out: null }], vl: [Array(C + 1).fill(false)], comment: '' }; }
    const renderLadder = () => {
      const pw = E.running ? E.pow : null;
      let html = '';
      CS.plc.rungs.forEach((rg, ri) => {
        const R = rg.rows.length, W = RAIL + C * CW + OW + RAIL;
        html += `<div class="rung"><div class="rung-head"><b>${ri + 1}</b><input class="rcomment" data-ri="${ri}" value="${esc(rg.comment || '')}" placeholder="comentário do rung…"/>
          <button class="btn icon sm" data-act="row" data-ri="${ri}" title="Adicionar ramo paralelo">+ramo</button>
          <button class="btn icon sm" data-act="up" data-ri="${ri}" title="Mover para cima">↑</button>
          <button class="btn icon sm danger" data-act="delr" data-ri="${ri}" title="Apagar rung">✕</button></div>
          <div class="rung-body" style="width:${W}px;height:${R * CH}px">
          <div class="rail" style="left:0;height:${R * CH}px"></div><div class="rail" style="left:${W - 4}px;height:${R * CH}px"></div>`;
        rg.rows.forEach((rw, r) => {
          const P = pw && pw[ri] ? pw[ri] : null;
          for (let c = 0; c < C; c++) {
            const L = P ? P.p[r][c] : false, Rr = P ? P.p[r][c + 1] : false, ps = P ? P.pass[r][c] : false;
            const isSel = sel && sel.ri === ri && sel.r === r && sel.c === c;
            html += `<div class="lcell${isSel ? ' sel' : ''}${rw.cells[c] ? '' : ' empty'}" data-ri="${ri}" data-r="${r}" data-c="${c}" style="left:${RAIL + c * CW}px;top:${r * CH}px;width:${CW}px">${cellSVG(rw.cells[c], L, Rr && L && ps, ps)}</div>`;
          }
          const Lo = P ? P.p[r][C] : false;
          const isSelO = sel && sel.ri === ri && sel.r === r && sel.c === 'out';
          html += `<div class="lcell out${isSelO ? ' sel' : ''}${rw.out ? '' : ' empty'}" data-ri="${ri}" data-r="${r}" data-c="out" style="left:${RAIL + C * CW}px;top:${r * CH}px;width:${OW}px">${outSVG(rw.out, Lo, E)}</div>`;
          if (r < R - 1) for (let b = 0; b <= C; b++) if (rg.vl[r][b]) {
            const on = P && (P.p[r][b] || P.p[r + 1][b]);
            html += `<div class="vl${on ? ' on' : ''}" style="left:${RAIL + b * CW - 1}px;top:${r * CH + CH / 2}px;height:${CH}px"></div>`;
          }
        });
        html += '</div></div>';
      });
      ladder.innerHTML = html;
      run.textContent = E.running ? '■ STOP' : '▶ RUN'; run.classList.toggle('on', E.running);
      scanInfo.textContent = E.running ? `varredura ${E.scanMs} ms · ciclos: ${E.scans}` : 'parado';
    };
    ladder.addEventListener('mousedown', e => {
      const btn = e.target.closest('[data-act]');
      if (btn) {
        const ri = +btn.dataset.ri, rg = CS.plc.rungs[ri];
        if (btn.dataset.act === 'row') { rg.rows.push({ cells: Array(C).fill(null), out: null }); rg.vl.push(Array(C + 1).fill(false)); }
        if (btn.dataset.act === 'delr') { CS.plc.rungs.splice(ri, 1); if (!CS.plc.rungs.length) CS.plc.rungs.push(emptyRung()); sel = null; }
        if (btn.dataset.act === 'up' && ri > 0) { const t = CS.plc.rungs[ri - 1]; CS.plc.rungs[ri - 1] = rg; CS.plc.rungs[ri] = t; }
        save(); renderLadder(); renderProps(); e.preventDefault(); return;
      }
      const cell = e.target.closest('.lcell'); if (!cell) return;
      e.preventDefault();
      const ri = +cell.dataset.ri, r = +cell.dataset.r, c = cell.dataset.c === 'out' ? 'out' : +cell.dataset.c;
      edit(ri, r, c);
    });
    ladder.addEventListener('change', e => { const t = e.target; if (t.classList.contains('rcomment')) { CS.plc.rungs[+t.dataset.ri].comment = t.value; save(); } });

    const edit = (ri, r, c) => {
      const rg = CS.plc.rungs[ri], rw = rg.rows[r];
      const ensureRow = () => { if (r === rg.rows.length - 1) { rg.rows.push({ cells: Array(C).fill(null), out: null }); rg.vl.push(Array(C + 1).fill(false)); } };
      if (tool === 'SEL') { sel = { ri, r, c }; }
      else if (tool === 'DEL') { if (c === 'out') rw.out = null; else rw.cells[c] = null; sel = null; }
      else if (tool === 'VL') { const b = c === 'out' ? C : c; ensureRow(); rg.vl[r][b] = !rg.vl[r][b]; }
      else if (tool === 'H') { if (c !== 'out') rw.cells[c] = { t: 'H' }; }
      else if (isCoil(tool)) {
        const a = ['TON', 'TOF'].includes(tool) ? 'T0' : tool === 'CTU' ? 'C0' : lastAddr.o;
        rw.out = { t: tool, a, p: ['TON', 'TOF'].includes(tool) ? '2' : tool === 'CTU' ? '5' : undefined };
        let last = -1; rw.cells.forEach((x, i) => { if (x) last = i; });
        if (last >= 0 || r === 0) for (let i = last + 1; i < C; i++) rw.cells[i] = { t: 'H' };
        sel = { ri, r, c: 'out' };
      } else if (c !== 'out') {
        rw.cells[c] = { t: tool, a: lastAddr.c };
        // completa com fio para a esquerda até o elemento anterior (ou trilho/ligação)
        let prev = -1; for (let i = c - 1; i >= 0; i--) if (rw.cells[i]) { prev = i; break; }
        let start = prev + 1;
        if (r > 0 && prev < 0) { let b = -1; for (let k = c; k >= 0; k--) if (rg.vl[r - 1][k]) { b = k; break; } start = b < 0 ? c : b; }
        for (let i = start; i < c; i++) if (!rw.cells[i]) rw.cells[i] = { t: 'H' };
        sel = { ri, r, c };
      }
      save(); renderLadder(); renderProps();
    };

    const renderProps = () => {
      props.innerHTML = '';
      if (!sel || !CS.plc.rungs[sel.ri] || !CS.plc.rungs[sel.ri].rows[sel.r]) { props.append(h('div', { class: 'muted small' }, 'Escolha uma ferramenta acima e clique nas células do rung. Com ⬚ você seleciona um elemento para editar.')); return; }
      const rw = CS.plc.rungs[sel.ri].rows[sel.r];
      const el = sel.c === 'out' ? rw.out : rw.cells[sel.c];
      if (!el || el.t === 'H') { props.append(h('div', { class: 'muted small' }, 'Célula vazia ou fio.')); return; }
      const name = TOOLS.find(t => t[0] === el.t);
      const allowed = ['TON', 'TOF'].includes(el.t) ? ['T'] : el.t === 'CTU' ? ['C'] : el.t === 'R' ? ['Q', 'M', 'T', 'C'] : sel.c === 'out' ? ['Q', 'M'] : ['I', 'Q', 'M', 'T', 'C'];
      const s = h('select', {}, ...GROUPS.filter(([k]) => allowed.includes(k)).map(([k, l]) => { const og = h('optgroup', { label: l }); ADDR[k].forEach(a => og.append(h('option', { value: a }, a + (CS.plc.tags[a] ? ' — ' + CS.plc.tags[a] : '')))); return og; }));
      s.value = el.a;
      s.addEventListener('change', () => { el.a = s.value; if (sel.c === 'out') lastAddr.o = s.value; else lastAddr.c = s.value; save(); renderLadder(); renderProps(); });
      const tag = h('input', { value: CS.plc.tags[el.a] || '', placeholder: 'ex.: Botão liga' });
      tag.addEventListener('change', () => { CS.plc.tags[el.a] = tag.value; save(); renderLadder(); renderPanel(); });
      props.append(h('div', { class: 'prop-head' }, `${name ? name[1] : el.t} — ${name ? name[2] : ''}`),
        h('label', { class: 'prop' }, h('span', {}, 'Endereço'), s), h('label', { class: 'prop' }, h('span', {}, 'Nome (tag) do endereço'), tag));
      if (['TON', 'TOF', 'CTU'].includes(el.t)) {
        const p = h('input', { value: el.p || '' });
        p.addEventListener('change', () => { el.p = p.value; save(); renderLadder(); });
        props.append(h('label', { class: 'prop' }, h('span', {}, el.t === 'CTU' ? 'Valor de preset PV (contagens)' : 'Tempo de preset PT [s]'), p));
      }
    };

    const renderPanel = () => {
      panel.innerHTML = '';
      const P = PLANTS[CS.plc.plant] || PLANTS.painel;
      cvBox.style.display = P.draw ? '' : 'none';
      const ins = h('div', { class: 'io-col' }, h('div', { class: 'k' }, 'Entradas'));
      ADDR.I.forEach(a => {
        const auto = P.auto.includes(a);
        const tg = CS.plc.tags[a] || '';
        const mode = CS.plc.modes[a] || (/^bot/i.test(tg) ? 'pulso' : 'chave');
        const b = h('button', { class: 'io-btn', 'data-a': a, disabled: auto ? '' : null, title: auto ? 'Entrada acionada pela planta (sensor)' : mode === 'pulso' ? 'Botão de pulso: segure para manter acionado' : 'Chave: clique para alternar' },
          h('span', { class: 'led' }), h('b', {}, a), h('span', { class: 'tg' }, tg || (auto ? 'sensor' : '—')));
        if (!auto) {
          if (mode === 'pulso') {
            b.addEventListener('pointerdown', () => { E.btn[a] = true; notify(); });
            const up = () => { E.btn[a] = false; notify(); }; b.addEventListener('pointerup', up); b.addEventListener('pointerleave', up);
          } else b.addEventListener('click', () => { E.btn[a] = !E.btn[a]; notify(); });
          const mb = h('span', { class: 'mode', title: 'Alternar entre botão (pulso) e chave', onclick: ev => { ev.stopPropagation(); CS.plc.modes[a] = mode === 'pulso' ? 'chave' : 'pulso'; save(); renderPanel(); } }, mode === 'pulso' ? '◉' : '⇄');
          b.append(mb);
        }
        ins.append(b);
      });
      const outs = h('div', { class: 'io-col' }, h('div', { class: 'k' }, 'Saídas'));
      ADDR.Q.forEach(a => outs.append(h('div', { class: 'io-out', 'data-a': a }, h('span', { class: 'led' }), h('b', {}, a), h('span', { class: 'tg' }, CS.plc.tags[a] || '—'))));
      panel.append(ins, outs);
      paintIO();
    };
    const paintIO = () => {
      panel.querySelectorAll('[data-a]').forEach(x => { const a = x.dataset.a; const on = a[0] === 'I' ? (E.running ? E.mem[a] : E.btn[a]) : E.mem[a]; x.classList.toggle('on', !!on); });
      const P = PLANTS[CS.plc.plant] || PLANTS.painel;
      if (P.draw) {
        const g = cv.getContext('2d'); g.clearRect(0, 0, cv.width, cv.height);
        g.fillStyle = '#060b14'; g.fillRect(0, 0, cv.width, cv.height);
        const Q = {}; ADDR.Q.forEach(a => { Q[a] = E.mem[a]; }); P.draw(g, cv.width, cv.height, E.plantSt, Q);
      }
    };
    const download = () => { const a = h('a', { href: URL.createObjectURL(new Blob([JSON.stringify(CS.plc, null, 1)], { type: 'application/json' })), download: 'programa.ladder.json' }); document.body.append(a); a.click(); a.remove(); };
    const upload = () => { const inp = h('input', { type: 'file', accept: '.json' }); inp.addEventListener('change', () => { const f = inp.files[0]; if (!f) return; f.text().then(t => { try { const d = JSON.parse(t); if (!d.rungs) throw new Error(); CS.plc = Object.assign({ tags: {}, plant: 'painel', modes: {} }, d); save(); E.reset(); renderAll(); } catch (e) { alert('Arquivo inválido.'); } }); }); inp.click(); };
    const renderAll = () => { paintTools(); renderLadder(); renderProps(); renderPanel(); plantSel.value = CS.plc.plant; };
    const tick = () => { renderLadder(); paintIO(); };
    listeners.add(tick); onClean(() => listeners.delete(tick));
    renderAll();
  };

  /* ───────── ferramenta: tabela de variáveis ───────── */
  const toolVars = (host, onClean) => {
    const { body } = CS.page(host, {
      title: 'CLP — Tabela de variáveis', lead: 'Endereços, nomes (tags) e valores em tempo real. Os nomes aparecem no Ladder e no painel.',
      learn: `<p><b>Endereçamento</b> (estilo IEC 61131-3 / Siemens):</p><ul><li><b>I</b>x.y: entradas digitais (sensores, botões);</li><li><b>Q</b>x.y: saídas digitais (contatores, lâmpadas, válvulas);</li><li><b>M</b>x.y: memórias internas (bits auxiliares);</li><li><b>T</b>n: temporizadores (bit "done", ET = tempo decorrido, PT = preset);</li><li><b>C</b>n: contadores (bit "done", CV = contagem, PV = preset).</li></ul><p><b>Boa prática:</b> sempre dê nomes (tags) significativos. O programa fica autoexplicativo e a manutenção mais fácil.</p>`,
    });
    const tbl = h('table', { class: 'tbl plc-vars' });
    body.append(CS.card(null, h('div', { class: 'row gap' }, h('span', { class: 'muted small' }, 'Edite os nomes diretamente na tabela. Valores atualizam com o CLP em RUN.')), tbl));
    const render = () => {
      tbl.innerHTML = '<tr><th>Endereço</th><th>Nome (tag)</th><th>Valor</th><th>Detalhe</th></tr>';
      for (const [k, l] of GROUPS) {
        tbl.append(h('tr', {}, h('td', { colspan: 4, class: 'grp' }, l)));
        for (const a of ADDR[k]) {
          const inp = h('input', { value: CS.plc.tags[a] || '', class: 'tag-in' });
          inp.addEventListener('change', () => { CS.plc.tags[a] = inp.value; save(); });
          const det = k === 'T' ? h('span', { class: 'det', 'data-d': a }) : k === 'C' ? h('span', { class: 'det', 'data-d': a }) : '';
          tbl.append(h('tr', {}, h('td', { class: 'mono' }, a), h('td', {}, inp), h('td', {}, h('span', { class: 'bitv', 'data-v': a })), h('td', {}, det)));
        }
      }
      paint();
    };
    const paint = () => {
      tbl.querySelectorAll('[data-v]').forEach(x => { const v = E.bit(x.dataset.v); x.textContent = v ? '1' : '0'; x.classList.toggle('on', !!v); });
      tbl.querySelectorAll('[data-d]').forEach(x => { const a = x.dataset.d; x.textContent = a[0] === 'T' ? `ET ${E.tim[a].et.toFixed(2)} s / PT ${E.tim[a].pt} s` : `CV ${E.cnt[a].cv} / PV ${E.cnt[a].pv}`; });
    };
    listeners.add(paint); onClean(() => listeners.delete(paint));
    render();
  };

  CS.registerTab('plc', {
    title: 'CLP',
    tools: [
      { id: 'ladder', label: 'Ladder', desc: 'editor, simulação e plantas', render: toolLadder },
      { id: 'vars', label: 'Tabela de variáveis', desc: 'endereços, tags e valores', render: toolVars },
    ],
  });
  CS.PLC_EXAMPLES = EXAMPLES;
})();
