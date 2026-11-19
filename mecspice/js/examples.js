/* ============================================================
   MecSPICE — Exemplos prontos
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
