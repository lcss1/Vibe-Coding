/* ============================================================
   MeControlEng — Exemplos prontos
   ============================================================ */
'use strict';

function ExBuilder(title, sim) {
  const doc = { title, comps: [], wires: [], sim: Object.assign({ tstop: '1', dt: '1m', method: 'trap' }, sim), probes: [], ui: {} };
  const P = p => (Array.isArray(p) ? MS.pinPos(p[0], p[1]) : p);
  return {
    doc,
    add(type, x, y, rot = 0, params = {}, name) {
      const c = MS.newComp(type, x, y, rot, doc);
      Object.assign(c.params, params);
      if (name) c.name = name;
      doc.comps.push(c);
      return c;
    },
    label(name, x, y) { const c = MS.newComp('LABEL', x, y, 0, doc); c.params.name = name; doc.comps.push(c); return c; },
    w(...pts) {
      for (let i = 0; i < pts.length - 1; i++) {
        const a = P(pts[i]), b = P(pts[i + 1]);
        const seg = (x1, y1, x2, y2) => { if (x1 !== x2 || y1 !== y2) doc.wires.push({ id: MS.uid(), x1, y1, x2, y2 }); };
        if (a.x === b.x || a.y === b.y) seg(a.x, a.y, b.x, b.y);
        else { seg(a.x, a.y, b.x, a.y); seg(b.x, a.y, b.x, b.y); }
      }
    },
  };
}

MS.EXAMPLES = [
  {
    id: 'pi-motor', title: 'Controle PI de velocidade — motor DC', cat: 'Eletromecânico + controle',
    desc: 'Malha fechada: referência → PID → motor DC → inércia; tacômetro realimenta ω. Degrau de carga em t = 1,5 s (o integrador elimina o erro).',
    build() {
      const B = ExBuilder('Controle PI de velocidade — motor DC', { tstop: '3', dt: '0.1m' });
      const vr = B.add('VS', 0, 0, 0, { forma: 'DEGRAU', v0: '0', val: '1.5708', t0: '0.1' }, 'Vref');
      B.add('GND', 0, 2);
      const pid = B.add('PID', 6, -1, 0, { Kp: '300', Ki: '500', Kd: '0', Umin: '-2', Umax: '24' });
      const mot = B.add('MOTOR', 14, 0, 0, { Ra: '2', La: '10m', K: '0.07', J: '100u', B: '100u' });
      B.add('GND', 11, 2);
      const J = B.add('J', 21, 0, 0, { J: '2m' }, 'Jcarga');
      const br = B.add('BR', 27, 0, 0, { b: '1m' });
      B.add('RGND', 29, 0, 3);
      const tq = B.add('TS', 25, 4, 0, { forma: 'DEGRAU', v0: '0', val: '-0.08', t0: '1.5' }, 'Tcarga');
      B.add('RGND', 25, 6);
      const tg = B.add('TACHO', 21, 5, 2, { K: '10m' });
      B.w([vr, 0], [pid, 0]);
      B.w([pid, 2], [mot, 0]);
      B.w([mot, 1], { x: 11, y: 2 });
      B.w([mot, 2], [J, 0]);
      B.w([J, 1], [br, 0]);
      B.w({ x: 25, y: 0 }, [tq, 0]);
      B.w([J, 1], [tg, 0]);
      B.w([tg, 1], { x: 3, y: 5 }, [pid, 1]);
      B.label('ref', 2, -2); B.label('u', 10, -1); B.label('eixo', 18, 0); B.label('med', 12, 5);
      B.doc.probes = ['n:eixo', 'n:ref', 'n:med', 'c:MOT1:I', 'c:PID1:u'];
      B.doc.ui = { practical: true, speed: 0.05, dispScale: 10 };
      return B.doc;
    },
  },
  {
    id: 'motor-ol', title: 'Motor DC + volante (malha aberta)', cat: 'Eletromecânico',
    desc: 'Degrau de 12 V no motor; volante com atrito viscoso. Em t = 1,5 s entra uma carga — sem controle, a velocidade cai permanentemente.',
    build() {
      const B = ExBuilder('Motor DC + volante (malha aberta)', { tstop: '3', dt: '0.2m' });
      const v = B.add('VS', 0, 0, 0, { forma: 'DEGRAU', v0: '0', val: '12', t0: '0.1' });
      B.add('GND', 0, 4);
      const m = B.add('MOTOR', 6, 0);
      const J = B.add('J', 13, 0, 0, { J: '2m' });
      const br = B.add('BR', 17, 0, 0, { b: '1m' });
      B.add('RGND', 19, 0, 3);
      const tq = B.add('TS', 15, 4, 0, { forma: 'DEGRAU', v0: '0', val: '-0.05', t0: '1.5' });
      B.add('RGND', 15, 6);
      B.w([v, 0], [m, 0]);
      B.w([m, 1], { x: 3, y: 2 }, [v, 1]);
      B.w([v, 1], { x: 0, y: 4 });
      B.w([m, 2], [J, 0]);
      B.w({ x: 15, y: 0 }, [tq, 0]);
      B.label('eixo', 10, 0);
      B.doc.probes = ['n:eixo', 'c:MOT1:I', 'c:MOT1:tau'];
      B.doc.ui = { practical: true, speed: 0.05, dispScale: 10 };
      return B.doc;
    },
  },
  {
    id: 'msd', title: 'Massa-mola-amortecedor', cat: 'Translacional',
    desc: 'Sistema de 2ª ordem clássico: m = 1 kg, k = 100 N/m, b = 2 N·s/m (ζ = 0,1). Degrau de força de 10 N → deslocamento final 0,1 m.',
    build() {
      const B = ExBuilder('Massa-mola-amortecedor', { tstop: '6', dt: '1m' });
      B.add('TGND', 0, 0, 1);
      const k = B.add('K', 4, -2, 0, { k: '100' });
      const b = B.add('B', 4, 2, 0, { b: '2' });
      const m = B.add('M', 10, 0, 0, { m: '1' });
      const f = B.add('FS', 16, 3, 0, { forma: 'DEGRAU', v0: '0', val: '10', t0: '0.2' });
      B.add('TGND', 16, 5);
      B.w({ x: 0, y: 0 }, { x: 0, y: -2 }, [k, 0]);
      B.w({ x: 0, y: 0 }, { x: 0, y: 2 }, [b, 0]);
      B.w([k, 1], { x: 8, y: -2 }, [m, 0]);
      B.w([b, 1], { x: 8, y: 2 }, [m, 0]);
      B.w([m, 1], { x: 16, y: 0 }, [f, 0]);
      B.label('massa', 12, 0);
      B.doc.probes = ['p:massa', 'n:massa', 'c:K1:F', 'c:B1:F'];
      B.doc.ui = { speed: 0.5, dispScale: 12 };
      return B.doc;
    },
  },
  {
    id: 'gear-tors', title: 'Redutor + eixo flexível (vibração torcional)', cat: 'Rotacional',
    desc: 'Motor → engrenagem 1:5 → mola torcional → volante. A flexibilidade do eixo gera oscilação torcional amortecida.',
    build() {
      const B = ExBuilder('Redutor + eixo flexível', { tstop: '4', dt: '0.2m' });
      const v = B.add('VS', 0, 0, 0, { forma: 'DEGRAU', v0: '0', val: '12', t0: '0.05' });
      B.add('GND', 0, 2);
      const m = B.add('MOTOR', 6, 0);
      const g = B.add('GEAR', 12, 1, 0, { n: '5', inv: 'sim' });
      const kr = B.add('KR', 17, 2, 0, { k: '2' });
      const J = B.add('J', 21, 2, 0, { J: '10m' });
      const br = B.add('BR', 25, 2, 0, { b: '5m' });
      B.add('RGND', 27, 2, 3);
      B.w([v, 0], [m, 0]);
      B.w([m, 1], { x: 3, y: 2 }, [v, 1]);
      void g; void kr; void br; void J;
      B.label('motor', 9, 0); B.label('redutor', 15, 2); B.label('volante', 19, 2);
      B.doc.probes = ['n:motor', 'n:redutor', 'n:volante', 'c:KR1:tau'];
      B.doc.ui = { practical: true, speed: 0.1, dispScale: 10 };
      return B.doc;
    },
  },
  {
    id: 'rack', title: 'Pinhão-cremalheira + massa + mola', cat: 'Eletromecânico',
    desc: 'Motor alimentado com tensão senoidal aciona uma cremalheira que empurra uma massa presa a uma mola: conversão rotação → translação.',
    build() {
      const B = ExBuilder('Pinhão-cremalheira + massa + mola', { tstop: '6', dt: '0.5m' });
      const v = B.add('VS', 0, 0, 0, { forma: 'SENO', v0: '0', val: '6', freq: '0.5', t0: '0' });
      B.add('GND', 0, 2);
      const m = B.add('MOTOR', 6, 0);
      const rp = B.add('RACK', 12, 0, 0, { r: '30m' });
      const ms = B.add('M', 13, 6, 1, { m: '0.5' });
      const k = B.add('K', 13, 11, 1, { k: '100' });
      B.add('TGND', 13, 13);
      B.w([v, 0], [m, 0]);
      B.w([m, 1], { x: 3, y: 2 }, [v, 1]);
      B.w([rp, 1], [ms, 0]);
      B.w([ms, 1], [k, 0]);
      void k;
      B.label('massa', 13, 4);
      B.doc.probes = ['p:massa', 'c:MOT1:I', 'c:K1:F'];
      B.doc.ui = { speed: 0.5, dispScale: 40 };
      return B.doc;
    },
  },
  {
    id: 'analog', title: 'Analogia: RLC paralelo × massa-mola-amortecedor', cat: 'Didático',
    desc: 'Pela analogia força-corrente, C ↔ m, L ↔ 1/k, R ↔ 1/b, fonte de corrente ↔ força. As duas curvas (V e v) são idênticas.',
    build() {
      const B = ExBuilder('Analogia elétrica × mecânica', { tstop: '5', dt: '1m' });
      const is = B.add('IS', 0, 0, 0, { forma: 'DEGRAU', v0: '0', val: '10', t0: '0.2' });
      B.add('C', 4, 0, 0, { C: '1' }); B.add('L', 8, 0, 0, { L: '10m' }); B.add('R', 12, 0, 0, { R: '0.5' });
      B.w([is, 0], { x: 12, y: -2 });
      B.w([is, 1], { x: 12, y: 2 });
      B.add('GND', 6, 2);
      B.label('v_el', 2, -2);
      // mecânico
      B.add('TGND', 0, 12, 1);
      const k = B.add('K', 4, 10, 0, { k: '100' });
      const b = B.add('B', 4, 14, 0, { b: '2' });
      const m = B.add('M', 10, 12, 0, { m: '1' });
      const f = B.add('FS', 16, 15, 0, { forma: 'DEGRAU', v0: '0', val: '10', t0: '0.2' });
      B.add('TGND', 16, 17);
      B.w({ x: 0, y: 12 }, { x: 0, y: 10 }, [k, 0]);
      B.w({ x: 0, y: 12 }, { x: 0, y: 14 }, [b, 0]);
      B.w([k, 1], { x: 8, y: 10 }, [m, 0]);
      B.w([b, 1], { x: 8, y: 14 }, [m, 0]);
      B.w([m, 1], { x: 16, y: 12 }, [f, 0]);
      B.label('v_mec', 12, 12);
      B.doc.probes = ['n:v_el', 'n:v_mec', 'c:L1:I', 'c:K1:F'];
      B.doc.ui = { speed: 0.5, dispScale: 12 };
      return B.doc;
    },
  },
  {
    id: 'rc', title: 'Circuito RC — onda quadrada', cat: 'Elétrico',
    desc: 'Carga e descarga de um capacitor (τ = RC = 1 ms) alimentado por uma onda quadrada de 5 V.',
    build() {
      const B = ExBuilder('Circuito RC', { tstop: '30m', dt: '10u' });
      const v = B.add('VS', 0, 4, 0, { forma: 'PULSO', v0: '0', val: '5', t0: '1m', tr: '1u', tf: '1u', ton: '5m', per: '10m' });
      const r = B.add('R', 4, 0, 1, { R: '1k' });
      const c = B.add('C', 8, 4, 0, { C: '1u' });
      B.w([v, 0], { x: 0, y: 0 }, [r, 1]);
      B.w([r, 0], { x: 8, y: 0 }, [c, 0]);
      B.w([v, 1], { x: 0, y: 8 }, { x: 8, y: 8 }, [c, 1]);
      B.add('GND', 4, 8);
      B.label('in', 0, 0); B.label('out', 8, 0);
      B.doc.probes = ['n:in', 'n:out', 'c:C1:I'];
      B.doc.ui = { speed: 0.01 };
      return B.doc;
    },
  },
  {
    id: 'rect', title: 'Retificador de meia onda com filtro', cat: 'Elétrico',
    desc: 'Diodo (modelo de Shockley, resolvido por Newton-Raphson) + capacitor de filtro + carga resistiva.',
    build() {
      const B = ExBuilder('Retificador de meia onda', { tstop: '100m', dt: '20u' });
      const v = B.add('VS', 0, 0, 0, { forma: 'SENO', v0: '0', val: '10', freq: '60', t0: '0' });
      B.add('GND', 0, 2);
      const d = B.add('D', 3, -2, 3);
      const c = B.add('C', 8, 0, 0, { C: '100u' });
      const r = B.add('R', 12, 0, 0, { R: '1k' });
      B.w([v, 0], [d, 0]);
      B.w([d, 1], [r, 0]);
      B.w([v, 1], [r, 1]);
      void c;
      B.label('in', 0, -2); B.label('out', 10, -2);
      B.doc.probes = ['n:in', 'n:out', 'c:D1:I'];
      B.doc.ui = { speed: 0.01 };
      return B.doc;
    },
  },
];

/* ───────── exemplos de eletrônica, térmico e fluídico ───────── */
MS.EXAMPLES.push(
  {
    id: 'zener', title: 'Regulador Zener com medidores', cat: 'Eletrônica',
    desc: 'Fonte com ondulação → resistor série → Zener 5,1 V. O amperímetro mede a corrente na carga e o voltímetro mostra a tensão estabilizada.',
    build() {
      const B = ExBuilder('Regulador Zener', { tstop: '100m', dt: '50u' });
      const v = B.add('VS', 0, 0, 0, { forma: 'SENO', v0: '12', val: '2', freq: '60' });
      B.add('GND', 0, 4);
      const rs = B.add('R', 4, -4, 1, { R: '220' });
      const dz = B.add('ZENER', 8, 0, 0, { Vz: '5.1' });
      const am = B.add('AMETER', 11, -4, 3);
      const rl = B.add('R', 14, 0, 0, { R: '1k' }, 'RL');
      const vm = B.add('VMETER', 17, 0);
      B.w([v, 0], { x: 0, y: -4 }, [rs, 1]);
      B.w([rs, 0], { x: 8, y: -4 }, [dz, 0]);
      B.w({ x: 8, y: -4 }, [am, 0]);
      B.w([am, 1], { x: 14, y: -4 }, [rl, 0]);
      B.w({ x: 14, y: -4 }, { x: 17, y: -4 }, [vm, 0]);
      B.w([v, 1], { x: 0, y: 4 }, { x: 17, y: 4 });
      B.w([dz, 1], { x: 8, y: 4 }); B.w([rl, 1], { x: 14, y: 4 }); B.w([vm, 1], { x: 17, y: 4 });
      B.label('entrada', 1, -4); B.label('saida', 16, -4);
      B.doc.probes = ['n:entrada', 'n:saida', 'c:DZ1:I'];
      B.doc.ui = { speed: 0.02 };
      return B.doc;
    },
  },
  {
    id: 'fonte', title: 'Fonte de alimentação: transformador + ponte + filtro + 7805', cat: 'Eletrônica',
    desc: 'Rede de 127 V/60 Hz → transformador 10:1 → retificador em ponte → capacitor de filtro → regulador 7805 → LED. O voltímetro mostra os 5 V regulados.',
    build() {
      const B = ExBuilder('Fonte de alimentação 5 V', { tstop: '120m', dt: '20u' });
      const v = B.add('VS', 0, 0, 0, { forma: 'SENO', v0: '0', val: '179.6', freq: '60' }, 'Rede');
      B.add('GND', 0, 2);
      const t = B.add('XFMR', 5, 0, 0, { Lp: '2', n: '0.1' });
      B.w([v, 0], [t, 0]); B.w([v, 1], [t, 1]);
      const d1 = B.add('D', 12, -4, 2), d2 = B.add('D', 12, 4, 2), d3 = B.add('D', 16, -4, 2), d4 = B.add('D', 16, 4, 2);
      B.w([t, 2], [d1, 0]); B.w([d1, 0], [d2, 1]);
      B.w([t, 3], { x: 10, y: 2 }, { x: 10, y: 0 }, { x: 16, y: 0 });
      B.w([d3, 0], [d4, 1]);
      const c = B.add('C', 20, 0, 0, { C: '2200u' });
      const u = B.add('REG', 25, -6, 0, { Vreg: '5' });
      B.w([d1, 1], [d3, 1]); B.w([d3, 1], { x: 20, y: -6 }, [u, 0]);
      B.w({ x: 20, y: -6 }, [c, 0]);
      B.w([d2, 0], [d4, 0]); B.w([d4, 0], { x: 32, y: 6 });
      B.w([c, 1], { x: 20, y: 6 }); B.w([u, 1], { x: 25, y: 6 });
      B.add('GND', 14, 6);
      const vm = B.add('VMETER', 28, 0);
      const r = B.add('R', 32, -4, 0, { R: '220' });
      const led = B.add('LED', 32, 0, 0, { cor: 'verde' });
      B.w([u, 2], { x: 32, y: -6 }, [r, 0]); B.w({ x: 28, y: -6 }, [vm, 0]);
      B.w([vm, 1], { x: 28, y: 6 }); B.w([led, 1], { x: 32, y: 6 });
      B.label('retificada', 18, -6); B.label('saida', 30, -6);
      B.doc.probes = ['n:retificada', 'n:saida', 'c:LED1:I'];
      B.doc.ui = { speed: 0.01 };
      return B.doc;
    },
  },
  {
    id: 'astavel', title: '555 astável piscando LED', cat: 'Eletrônica',
    desc: 'Temporizador 555 em modo astável: f = 1,44/((RA + 2RB)·C) ≈ 1 Hz. O capacitor oscila entre Vcc/3 e 2Vcc/3.',
    build() {
      const B = ExBuilder('555 astável', { tstop: '5', dt: '0.5m' });
      build555(B, '10k', '68k', '10u');
      const r = B.add('R', 13, 2, 0, { R: '470' });
      const led = B.add('LED', 13, 6, 0, { cor: 'vermelho' });
      B.w({ x: 11, y: 0 }, [r, 0]); B.w([led, 1], { x: 13, y: 9 });
      B.doc.probes = ['n:cap', 'n:saida555', 'c:LED1:I'];
      B.doc.ui = { speed: 1 };
      return B.doc;
    },
  },
  {
    id: 'contador', title: 'Contador 0–9: 555 → 4026 → display de 7 segmentos', cat: 'Eletrônica',
    desc: 'O 555 gera pulsos de clock (~2 Hz); o CI 4026 conta e já decodifica para 7 segmentos; o display mostra o dígito.',
    build() {
      const B = ExBuilder('Contador com display de 7 segmentos', { tstop: '6', dt: '1m' });
      build555(B, '10k', '33k', '10u');
      const cn = B.add('C4026', 16, 1);
      B.add('SEG7', 22, 1, 0, { cor: 'vermelho' });
      B.w({ x: 11, y: 0 }, { x: 12, y: 0 }, { x: 12, y: -1 }, [cn, 0]);
      B.w([cn, 1], { x: 12, y: 3 }, { x: 12, y: 9 });
      B.w({ x: 22, y: 6 }, { x: 22, y: 9 }, { x: 13, y: 9 });
      B.doc.probes = ['n:saida555', 'c:U2:n'];
      B.doc.ui = { speed: 1 };
      return B.doc;
    },
  },
  {
    id: 'rele', title: 'Transistor NPN acionando relé', cat: 'Eletrônica',
    desc: 'Um pulso de 5 V satura o transistor, a bobina do relé atraca e troca o contato: o LED do NA acende e o do NF apaga. O diodo de roda livre protege o transistor.',
    build() {
      const B = ExBuilder('Relé acionado por transistor', { tstop: '4', dt: '0.2m' });
      const vcc = B.add('VS', -10, 0, 0, { val: '12' }, 'Vcc');
      const k = B.add('RELAY', 4, -3);
      const d = B.add('D', -1, -3, 2);
      const q = B.add('NPN', 1, 2);
      const rb = B.add('R', -3, 2, 1, { R: '1k' }, 'Rb');
      const vin = B.add('VS', -7, 5, 0, { forma: 'PULSO', v0: '0', val: '5', t0: '0.3', tr: '1m', tf: '1m', ton: '1', per: '2' }, 'Vin');
      B.w([vcc, 0], { x: -10, y: -8 }, { x: 7, y: -8 });
      B.w([k, 0], { x: 1, y: -8 });
      B.w([d, 1], { x: -1, y: -6 }, { x: 1, y: -6 });
      B.w([d, 0], { x: -1, y: -1 }, { x: 1, y: -1 }, [k, 1]);
      B.w([q, 0], { x: 1, y: -1 });
      B.w([q, 1], [rb, 0]); B.w([rb, 1], { x: -7, y: 2 }, [vin, 0]);
      B.w([k, 2], { x: 7, y: -8 });
      const r1 = B.add('R', 12, -1, 0, { R: '680' }), l1 = B.add('LED', 12, 3, 0, { cor: 'verde' });
      const r2 = B.add('R', 9, 1, 0, { R: '680' }), l2 = B.add('LED', 9, 5, 0, { cor: 'vermelho' });
      B.w([k, 3], { x: 12, y: -3 }, [r1, 0]); B.w([k, 4], { x: 9, y: -1 }, [r2, 0]);
      B.w([vcc, 1], { x: -10, y: 8 }, { x: 12, y: 8 });
      B.w([vin, 1], { x: -7, y: 8 }); B.w([q, 2], { x: 1, y: 8 }); B.w([l2, 1], { x: 9, y: 8 }); B.w([l1, 1], { x: 12, y: 8 });
      B.add('GND', -4, 8);
      B.label('base', -1, 2);
      B.doc.probes = ['n:base', 'c:K1:I', 'c:LED1:I', 'c:LED2:I'];
      B.doc.ui = { speed: 0.5 };
      return B.doc;
    },
  },
  {
    id: 'ampop', title: 'Amplificador inversor com AmpOp', cat: 'Eletrônica',
    desc: 'Ganho = −Rf/Rin = −10. Aumente a amplitude da entrada para ver a saída saturar perto de ±15 V.',
    build() {
      const B = ExBuilder('Amplificador inversor', { tstop: '3m', dt: '2u' });
      const v = B.add('VS', 0, 2, 0, { forma: 'SENO', v0: '0', val: '0.5', freq: '1k' }, 'Vin');
      B.add('GND', 0, 4);
      const ri = B.add('R', 3, 0, 1, { R: '1k' }, 'Rin');
      const op = B.add('OPAMP', 10, 1);
      const rf = B.add('R', 10, -3, 1, { R: '10k' }, 'Rf');
      B.w([v, 0], [ri, 1]); B.w([ri, 0], [op, 0]);
      B.w([op, 1], { x: 7, y: 4 }); B.add('GND', 7, 4);
      B.w({ x: 6, y: 0 }, { x: 6, y: -3 }, [rf, 1]);
      B.w([rf, 0], { x: 14, y: -3 }, { x: 14, y: 1 }, [op, 2]);
      B.label('vin', 0, 0); B.label('vout', 14, 1);
      B.doc.probes = ['n:vin', 'n:vout'];
      B.doc.ui = { speed: 0.001 };
      return B.doc;
    },
  },
  {
    id: 'pwm', title: 'MOSFET acionando motor com PWM', cat: 'Eletrônica',
    desc: 'PWM de 500 Hz com 60% de razão cíclica no gate: o motor "vê" a tensão média (~7 V). O diodo de roda livre conduz quando o MOSFET abre.',
    build() {
      const B = ExBuilder('PWM com MOSFET', { tstop: '0.6', dt: '20u' });
      const v = B.add('VS', 0, 0, 0, { val: '12' });
      const m = B.add('MOTOR', 8, -4);
      const d = B.add('D', 3, -4, 2);
      const q = B.add('NMOS', 5, 1);
      const rg = B.add('R', 1, 1, 1, { R: '100' }, 'Rg');
      const pw = B.add('VS', -4, 4, 0, { forma: 'PULSO', v0: '0', val: '10', t0: '0', tr: '10u', tf: '10u', ton: '1.2m', per: '2m' }, 'PWM');
      const J = B.add('J', 15, -4, 0, { J: '1m' });
      B.w([v, 0], { x: 0, y: -5 }, [m, 0]);
      B.w([d, 1], { x: 3, y: -6 }, { x: 5, y: -6 }, [m, 0]);
      B.w([d, 0], { x: 5, y: -2 }, [m, 1]);
      B.w({ x: 5, y: -2 }, [q, 0]);
      B.w([q, 1], [rg, 0]); B.w([rg, 1], { x: -4, y: 1 }, [pw, 0]);
      B.w([m, 2], [J, 0]);
      B.w([pw, 1], { x: -4, y: 8 }, { x: 5, y: 8 }); B.w([v, 1], { x: 0, y: 8 }); B.w([q, 2], { x: 5, y: 8 });
      B.add('GND', 2, 8);
      B.label('eixo', 12, -4); B.label('gate', 3, 1);
      B.doc.probes = ['n:eixo', 'c:MOT1:I', 'n:gate'];
      B.doc.ui = { practical: true, speed: 0.05 };
      return B.doc;
    },
  },
  {
    id: 'foto', title: 'Fotodiodo: sensor de luz', cat: 'Eletrônica',
    desc: 'Polarizado reversamente, o fotodiodo gera corrente proporcional à iluminância. No resistor, ela vira uma tensão que o voltímetro mede.',
    build() {
      const B = ExBuilder('Sensor de luz com fotodiodo', { tstop: '3', dt: '1m' });
      const v = B.add('VS', 0, 0, 0, { val: '5' });
      B.add('GND', 0, 2);
      const pd = B.add('PHOTO', 5, 0, 0, { forma: 'SENO', v0: '500', val: '400', freq: '1', S: '100n' });
      const r = B.add('R', 5, 4, 0, { R: '47k' });
      const vm = B.add('VMETER', 8, 4);
      B.w([v, 0], [pd, 0]); B.w([pd, 1], [r, 0]);
      B.w([r, 1], { x: 5, y: 6 }, { x: 0, y: 6 }, [v, 1]);
      B.w([pd, 1], { x: 8, y: 2 }, [vm, 0]); B.w([vm, 1], { x: 8, y: 6 }, { x: 5, y: 6 });
      B.label('sinal', 6, 2);
      B.doc.probes = ['n:sinal', 'c:PD1:lux'];
      B.doc.ui = { speed: 0.5 };
      return B.doc;
    },
  },
  {
    id: 'termico', title: 'Aquecimento de um bloco (sistema térmico)', cat: 'Térmico',
    desc: 'Resistor de aquecimento (24 W) → bloco de alumínio (C = m·c = 450 J/K) → convecção para o ambiente (R = 1 K/W). Resposta de 1ª ordem: ΔT = P·R = 24 °C com τ = R·C = 450 s. O LM35 converte T em tensão.',
    build() {
      const B = ExBuilder('Aquecimento de um bloco', { tstop: '2500', dt: '1' });
      const v = B.add('VS', 0, 0, 0, { forma: 'DEGRAU', v0: '0', val: '24', t0: '50' });
      B.add('GND', 0, 2);
      const ht = B.add('HEATER', 5, -1, 0, { R: '24' });
      const cb = B.add('CTH', 11, -1, 0, { m: '0.5', cp: '900', T0: '25' }, 'Bloco');
      const cv = B.add('CONV', 15, -1, 0, { h: '10', A: '0.1' });
      const ta = B.add('TSRC', 17, 1, 0, { val: '25' }, 'Tamb');
      B.add('HGND', 17, 3);
      const ts = B.add('TSENS', 11, 3);
      const vm = B.add('VMETER', 15, 5);
      B.w([v, 0], [ht, 0]); B.w([ht, 1], { x: 2, y: 2 }, { x: 0, y: 2 });
      B.w([ht, 2], [cb, 0]);
      B.w([ts, 0], { x: 9, y: -1 });
      B.w([ts, 1], [vm, 0]); B.add('GND', 15, 7);
      void cv; void ta;
      B.label('bloco', 9, -1);
      B.doc.probes = ['n:bloco', 'c:RH1:P', 'c:Rh1:q'];
      B.doc.ui = { speed: 100 };
      return B.doc;
    },
  },
  {
    id: 'termopid', title: 'Controle de temperatura com PID', cat: 'Térmico',
    desc: 'Malha fechada térmica: referência de 0,6 V (60 °C no LM35) → PID → aquecedor → bloco. O sensor realimenta a temperatura, e o integrador elimina o erro.',
    build() {
      const B = ExBuilder('Controle de temperatura PID', { tstop: '2500', dt: '0.5' });
      const vr = B.add('VS', -10, 0, 0, { val: '0.6' }, 'Vref');
      B.add('GND', -10, 2);
      const pid = B.add('PID', -4, -1, 0, { Kp: '200', Ki: '1', Kd: '0', Umin: '0', Umax: '24' });
      const ht = B.add('HEATER', 4, -1, 0, { R: '8' });
      const cb = B.add('CTH', 10, -1, 0, { m: '0.5', cp: '900', T0: '25' }, 'Bloco');
      B.add('CONV', 14, -1, 0, { h: '10', A: '0.1' });
      B.add('TSRC', 16, 1, 0, { val: '25' }, 'Tamb'); B.add('HGND', 16, 3);
      const ts = B.add('TSENS', 10, 4);
      B.w([vr, 0], [pid, 0]);
      B.w([pid, 2], { x: 0, y: -1 }, { x: 0, y: -2 }, [ht, 0]);
      B.w([ht, 1], { x: 1, y: 2 }); B.add('GND', 1, 2);
      B.w([ht, 2], [cb, 0]);
      B.w([ts, 0], { x: 8, y: -1 });
      B.w([ts, 1], { x: 12, y: 6 }, { x: -8, y: 6 }, { x: -8, y: 0 }, [pid, 1]);
      B.label('med', 0, 6); B.label('bloco', 8, -1); B.label('u', 0, -1);
      B.doc.probes = ['n:bloco', 'n:med', 'c:PID1:u', 'c:RH1:P'];
      B.doc.ui = { speed: 100 };
      return B.doc;
    },
  },
  {
    id: 'tanque', title: 'Nível de tanque: bomba + válvula de saída', cat: 'Fluídico',
    desc: 'Vazão de 2 L/s entra num tanque de 0,5 m², que descarrega por uma válvula. O nível sobe exponencialmente até h = Q·R/(ρg) ≈ 1 m (τ = R·A/(ρg)).',
    build() {
      const B = ExBuilder('Nível de tanque', { tstop: '1200', dt: '0.5' });
      const p = B.add('FSRC', 0, 1, 0, { forma: 'DEGRAU', v0: '0', val: '2m', t0: '20' }, 'Bomba');
      B.add('FGND', 0, 3);
      const tk = B.add('TANK', 6, -1, 0, { A: '0.5', h0: '0', hmax: '1.5' });
      const rv = B.add('RHYD', 10, 1, 0, { R: '5meg' }, 'Rsaida');
      B.add('FGND', 12, 1);
      const ls = B.add('LSENS', 6, 5);
      const vm = B.add('VMETER', 10, 7);
      B.w([p, 0], { x: 4, y: -1 }, [tk, 0]);
      B.w([ls, 0], { x: 4, y: 1 });
      B.w([ls, 1], [vm, 0]); B.add('GND', 10, 9);
      void rv;
      B.label('fundo', 8, 1);
      B.doc.probes = ['c:TQ1:h', 'c:Rsaida:Q'];
      B.doc.ui = { speed: 50 };
      return B.doc;
    },
  },
  {
    id: 'nivelpid', title: 'Controle de nível com PID e válvula proporcional', cat: 'Fluídico',
    desc: 'O sensor de nível realimenta o PID, que comanda a abertura da válvula de entrada. Referência de 1 V equivale a 1 m de nível.',
    build() {
      const B = ExBuilder('Controle de nível PID', { tstop: '800', dt: '0.2' });
      const vr = B.add('VS', -10, 0, 0, { forma: 'DEGRAU', v0: '0', val: '1', t0: '10' }, 'Vref');
      B.add('GND', -10, 2);
      const pid = B.add('PID', -4, -1, 0, { Kp: '20', Ki: '0.2', Kd: '0', Umin: '0', Umax: '10' });
      const ps = B.add('PSRC', 2, 4, 0, { val: '50k' }, 'Psup');
      B.add('FGND', 2, 6);
      const pv = B.add('PVALVE', 5, 2, 0, { Rmin: '2meg', Vmax: '10' });
      const tk = B.add('TANK', 11, 0, 0, { A: '0.5', hmax: '1.5' });
      const ro = B.add('RHYD', 15, 2, 0, { R: '5meg' }, 'Rsaida'); B.add('FGND', 17, 2);
      const ls = B.add('LSENS', 11, 6);
      B.w([vr, 0], [pid, 0]);
      B.w([pid, 2], { x: 5, y: -1 }, [pv, 2]);
      B.w([ps, 0], [pv, 0]); B.w([pv, 1], [tk, 0]);
      B.w([ls, 0], { x: 9, y: 2 });
      B.w([ls, 1], { x: 13, y: 8 }, { x: -8, y: 8 }, { x: -8, y: 0 }, [pid, 1]);
      void ro;
      B.label('med', 0, 8);
      B.doc.probes = ['c:TQ1:h', 'n:med', 'c:VP1:ab'];
      B.doc.ui = { speed: 20 };
      return B.doc;
    },
  },
  {
    id: 'cilindro', title: 'Cilindro hidráulico empurrando massa-mola', cat: 'Fluídico',
    desc: 'Pressão de 200 kPa num pistão de 20 cm² gera 400 N. Um orifício limita a vazão (velocidade) e a mola equilibra em x = F/k = 2 cm.',
    build() {
      const B = ExBuilder('Cilindro hidráulico', { tstop: '1', dt: '0.5m' });
      const ps = B.add('PSRC', 0, 2, 0, { forma: 'DEGRAU', v0: '0', val: '200k', t0: '0.05' });
      B.add('FGND', 0, 4);
      B.add('RHYD', 3, 0, 0, { R: '1G' }, 'Orificio');
      const cy = B.add('CYL', 8, 0, 0, { A: '2m' });
      const m = B.add('M', 13, 0, 0, { m: '10' });
      B.add('K', 17, 0, 0, { k: '20k' });
      const b = B.add('B', 17, 3, 0, { b: '2k' });
      B.add('TGND', 19, 0, 3);
      B.w([ps, 0], { x: 1, y: 0 });
      void cy; void m;
      B.w({ x: 15, y: 0 }, [b, 0]); B.w([b, 1], { x: 19, y: 0 });
      B.label('haste', 11, 0);
      B.doc.probes = ['p:haste', 'c:CL1:F'];
      B.doc.ui = { speed: 0.25, dispScale: 60 };
      return B.doc;
    },
  },
);

/* 555 astável comum aos exemplos (VCC 9 V, saída no pino (11,0), terra em y = 9) */
function build555(B, RA, RB, C) {
  const v = B.add('VS', -6, 0, 0, { val: '9' }, 'Vcc');
  const u = B.add('T555', 8, 0);
  const ra = B.add('R', 2, -5, 0, { R: RA }, 'RA');
  const rb = B.add('R', 2, 0, 0, { R: RB }, 'RB');
  const c = B.add('C', 2, 5, 0, { C });
  B.w([v, 0], { x: -6, y: -7 }, { x: 8, y: -7 }, [u, 0]);
  B.w([ra, 1], { x: 2, y: -2 }, [u, 2]);
  B.w([rb, 1], { x: 5, y: 2 });
  B.w([u, 3], { x: 4, y: 0 }, { x: 4, y: 2 });
  B.w([rb, 1], [c, 0]);
  B.w([v, 1], { x: -6, y: 9 }, { x: 13, y: 9 });
  B.w([c, 1], { x: 2, y: 9 }); B.w([u, 1], { x: 8, y: 9 });
  B.add('GND', 0, 9);
  B.label('cap', 3, 2); B.label('saida555', 11, 0);
  void ra;
}
