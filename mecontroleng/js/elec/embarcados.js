/* ============================================================
   MeControlEng — Elétrica › Sistemas Embarcados
   Simulador Arduino (subconjunto de C/C++ com placa virtual),
   plataformas e pinagens, protocolos (UART, I²C, SPI) e
   calculadoras de hardware.
   ============================================================ */
'use strict';
(function () {
  const CS = MS.CS, h = CS.h, K = MS.MK;
  const E = MS.EL = MS.EL || {};

  /* ───────── transpilador: subconjunto de C/C++ do Arduino → JavaScript assíncrono ───────── */
  E.transpile = function (src) {
    let s = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    const strs = [];
    s = s.replace(/"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)'/g, m => { strs.push(m); return `__S${strs.length - 1}__`; });
    s = s.replace(/^\s*#include.*$/gm, '');
    s = s.replace(/^\s*#define\s+(\w+)\s+(.+)$/gm, 'const $1 = $2;');
    const T = '(?:(?:unsigned|signed|static|volatile)\\s+)*(?:void|int|long|float|double|bool|boolean|byte|char|String|word|short|size_t|u?int(?:8|16|32)_t)';
    const fnames = [];
    s = s.replace(new RegExp(`\\b${T}\\s+(\\w+)\\s*\\(([^)]*)\\)\\s*\\{`, 'g'), (m, name, params) => {
      fnames.push(name);
      const p = params.trim();
      const ps = !p || p === 'void' ? '' : p.split(',').map(x => { const t = x.trim().replace(/\[\s*\]/g, '').split(/[\s&*]+/); return t[t.length - 1]; }).join(', ');
      return `async function __DEF_${name}(${ps}) {`;
    });
    s = s.replace(new RegExp(`\\b${T}\\s+\\w+\\s*\\([^)]*\\)\\s*;`, 'g'), '');
    s = s.replace(/\bServo\s+(\w+)\s*;/g, 'let $1 = new Servo();');
    s = s.replace(/sizeof\s*\(\s*(\w+)\s*\)\s*\/\s*sizeof\s*\(\s*\1\s*\[\s*0\s*\]\s*\)/g, '$1.length');
    s = s.replace(/\((?:unsigned\s+)?(?:int|long|byte)\)\s*(?=\()/g, 'Math.trunc');
    s = s.replace(/\((?:unsigned\s+)?(?:int|long|byte|float|double)\)\s*/g, '');
    s = s.replace(new RegExp(`\\bconst\\s+${T}\\s+`, 'g'), 'const ');
    s = s.replace(new RegExp(`\\b${T}\\s+(?=[A-Za-z_])`, 'g'), 'let ');
    s = s.replace(/\b(let|const)\s+(\w+)\s*\[[^\]]*\](?:\s*\[[^\]]*\])?\s*=\s*\{([^;]*)\}\s*;/g, (m, k, n, body) => `${k} ${n} = [${body.replace(/\{/g, '[').replace(/\}/g, ']')}];`);
    s = s.replace(/\blet\s+(\w+)\s*\[\s*(\w+)\s*\]\s*;/g, 'let $1 = new Array($2).fill(0);');
    s = s.replace(/\blet\s+(\w+)\s*;/g, 'let $1 = 0;');
    for (const n of fnames) s = s.replace(new RegExp(`(?<![\\w.])${n}\\s*\\(`, 'g'), `await ${n}(`);
    s = s.replace(/__DEF_/g, '');
    s = s.replace(/(?<![\w.])(delay|delayMicroseconds)\s*\(/g, 'await $1(');
    const PAR = '\\((?:[^()]|\\((?:[^()]|\\([^()]*\\))*\\))*\\)';
    s = s.replace(new RegExp(`(?<!\\}\\s*)\\bwhile(\\s*${PAR})\\s*;`, 'g'), 'while$1 { await __y(); }');
    s = s.replace(new RegExp(`\\b(while|for)(\\s*${PAR}\\s*)\\{`, 'g'), '$1$2{ await __y();');
    s = s.replace(/\bdo\s*\{/g, 'do { await __y();');
    s = s.replace(/__S(\d+)__/g, (m, i) => strs[+i]);
    return { js: s, fnames };
  };

  /* ───────── máquina virtual (tempo virtual, placa e periféricos) ───────── */
  const BTN = { 2: 'B1', 7: 'B2' };
  const LEDC = { 13: '#ffb04a', 12: '#ff4d6d', 11: '#ffd166', 10: '#3ddc84', 9: '#4fb3ff', 8: '#ff4d6d', 6: '#3ddc84', 5: '#4fb3ff', 4: '#c77dff', 3: '#ff4d6d', 2: '#ffd166', 7: '#ffd166' };
  const PWM_PINS = [3, 5, 6, 9, 10, 11];
  class ArduinoVM {
    constructor(io) { this.io = io; this.gen = 0; this.reset(); }
    reset() {
      this.gen++; this.pins = [...Array(20)].map(() => ({ mode: 'INPUT', out: 0, pwm: null })); this.vt = 0; this.vtLimit = 0; this.ops = 0;
      this.pending = null; this.notify = null; this.running = false; this.servos = []; this.toneF = 0; this.toneEnd = Infinity; this.rx = []; this.err = null; this.trace = [];
    }
    api() {
      const vm = this, io = this.io, P = this.pins, gen = this.gen;
      const pinIdx = p => (typeof p === 'number' ? p : 0);
      const fmt = (x, d) => (typeof x === 'number' && !Number.isInteger(x) ? x.toFixed(d == null ? 2 : d) : typeof x === 'boolean' ? (x ? 1 : 0) : String(x));
      class Servo { constructor() { this.pin = -1; this.a = 90; vm.servos.push(this); } attach(p) { this.pin = p; } write(a) { this.a = Math.max(0, Math.min(180, a)); } read() { return Math.round(this.a); } detach() { this.pin = -1; } attached() { return this.pin >= 0; } }
      return {
        HIGH: 1, LOW: 0, INPUT: 'INPUT', OUTPUT: 'OUTPUT', INPUT_PULLUP: 'INPUT_PULLUP', LED_BUILTIN: 13, A0: 14, A1: 15, A2: 16, A3: 17, A4: 18, A5: 19, PI: Math.PI, DEC: 10, HEX: 16, BIN: 2, true: true, false: false,
        pinMode: (p, m) => { P[pinIdx(p)].mode = m; },
        digitalWrite: (p, v) => { const q = P[pinIdx(p)]; q.out = v ? 1 : 0; q.pwm = null; vm.log(p); },
        digitalRead: p => {
          p = pinIdx(p); const q = P[p];
          if (q.mode === 'OUTPUT') return q.out;
          if (BTN[p]) { const pr = io.btn[p]; return q.mode === 'INPUT_PULLUP' ? (pr ? 0 : 1) : (pr ? 1 : 0); }
          if (p >= 14) return io.analog(p) > 512 ? 1 : 0;
          return q.mode === 'INPUT_PULLUP' ? 1 : 0;
        },
        analogRead: p => { p = pinIdx(p); if (p < 14) p += 14; return Math.round(Math.max(0, Math.min(1023, io.analog(p)))); },
        analogWrite: (p, v) => { const q = P[pinIdx(p)]; v = Math.max(0, Math.min(255, Math.round(v))); q.out = v > 127 ? 1 : 0; q.pwm = PWM_PINS.includes(p) ? v / 255 : null; if (!PWM_PINS.includes(p)) q.out = v >= 128 ? 1 : 0; vm.log(p); },
        millis: () => Math.floor(vm.vt), micros: () => Math.floor(vm.vt * 1000),
        delay: ms => vm.wait(+ms || 0, gen), delayMicroseconds: us => vm.wait((+us || 0) / 1000, gen),
        map: (x, a, b, c, d) => Math.trunc((x - a) * (d - c) / (b - a) + c), constrain: (x, a, b) => Math.max(a, Math.min(b, x)),
        random: (a, b) => (b === undefined ? Math.floor(Math.random() * a) : a + Math.floor(Math.random() * (b - a))), randomSeed: () => {},
        abs: Math.abs, min: Math.min, max: Math.max, pow: Math.pow, sqrt: Math.sqrt, sq: x => x * x, sin: Math.sin, cos: Math.cos, tan: Math.tan, round: Math.round, floor: Math.floor, ceil: Math.ceil, log: Math.log, exp: Math.exp, isnan: isNaN,
        tone: (p, f, d) => { vm.toneF = f; vm.tonePin = p; vm.toneEnd = d ? vm.vt + d : Infinity; },
        noTone: () => { vm.toneF = 0; },
        F: x => x, String, Servo,
        Serial: { begin: () => {}, print: (x, d) => io.serial(fmt(x, d)), println: (x = '', d) => io.serial(fmt(x, d) + '\n'), available: () => vm.rx.length, read: () => (vm.rx.length ? vm.rx.shift() : -1), write: x => io.serial(typeof x === 'number' ? String.fromCharCode(x) : x), parseInt: () => { const t = vm.rx.splice(0).map(c => String.fromCharCode(c)).join(''); return parseInt(t, 10) || 0; }, readStringUntil: () => vm.rx.splice(0).map(c => String.fromCharCode(c)).join('').replace(/\n$/, ''), flush: () => {} },
        __y: () => { vm.vt += 0.004; vm.ops++; if (vm.vt > vm.vtLimit || vm.ops % 4000 === 0) return vm.wait(0, gen); return undefined; },
      };
    }
    log(p) { this.trace.push([this.vt, p, this.pins[p].pwm != null ? this.pins[p].pwm : this.pins[p].out]); if (this.trace.length > 4000) this.trace.splice(0, 1000); }
    wait(ms, gen) {
      if (gen !== this.gen) return new Promise(() => {});
      return new Promise(r => { this.pending = { t: this.vt + ms, r }; const n = this.notify; this.notify = null; n && n(); });
    }
    load(src) {
      this.reset();
      const { js } = E.transpile(src);
      this.js = js;
      const fac = new Function('__api', `with (__api) { return (function () {\n${js}\n;return { setup: typeof setup === 'function' ? setup : null, loop: typeof loop === 'function' ? loop : null }; })(); }`);
      this.prog = fac(this.api());
      if (!this.prog.loop) throw new Error('o programa precisa de uma função void loop()');
    }
    start() {
      const gen = this.gen; this.running = true;
      const finish = e => { if (gen !== this.gen) return; if (e) { this.err = e; this.io.error(e); } this.running = false; const n = this.notify; this.notify = null; n && n(); };
      (async () => { if (this.prog.setup) await this.prog.setup(); for (;;) { if (gen !== this.gen) return; await this.prog.loop(); const y = this.api().__y(); if (y) await y; } })().catch(finish);
    }
    async frame(dtms) {
      if (!this.running) return;
      this.vtLimit += dtms;
      let n = 0;
      while (this.running && this.pending && this.pending.t <= this.vtLimit && n < 3000) {
        const p = this.pending; this.pending = null; this.vt = Math.max(this.vt, p.t); n++;
        await new Promise(res => { this.notify = res; p.r(); setTimeout(res, 50); });
      }
      if (this.pending) this.vt = Math.max(this.vt, Math.min(this.pending.t, this.vtLimit));
      if (this.toneF && this.vt >= this.toneEnd) this.toneF = 0;
    }
  }
  E.ArduinoVM = ArduinoVM;

  const EXEMPLOS = {
    blink: ['Blink (LED pisca)', `// Pisca o LED da placa (pino 13) a cada 0,5 s
void setup() {
  pinMode(LED_BUILTIN, OUTPUT);
}

void loop() {
  digitalWrite(LED_BUILTIN, HIGH);  // acende
  delay(500);
  digitalWrite(LED_BUILTIN, LOW);   // apaga
  delay(500);
}`],
    botao: ['Botão (liga/desliga com borda)', `// Botão B1 no pino 2 (INPUT_PULLUP: solto = HIGH, pressionado = LOW)
const int BOTAO = 2;
const int LED = 12;
bool ligado = false;
int anterior = HIGH;

void setup() {
  pinMode(BOTAO, INPUT_PULLUP);
  pinMode(LED, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  int agora = digitalRead(BOTAO);
  if (anterior == HIGH && agora == LOW) {   // borda de descida = clique
    ligado = !ligado;
    digitalWrite(LED, ligado);
    Serial.print("LED ");
    Serial.println(ligado ? "ligado" : "desligado");
    delay(30);                              // anti-repique (debounce)
  }
  anterior = agora;
}`],
    fade: ['Fade (PWM)', `// Brilho do LED no pino 9 varia com PWM (analogWrite 0..255)
int brilho = 0;
int passo = 5;

void setup() {
  pinMode(9, OUTPUT);
}

void loop() {
  analogWrite(9, brilho);
  brilho = brilho + passo;
  if (brilho <= 0 || brilho >= 255) {
    passo = -passo;
  }
  delay(30);
}`],
    pot: ['Potenciômetro → LED e Serial Plotter', `// Lê o potenciômetro (A0) e ajusta o brilho do LED no pino 10
void setup() {
  Serial.begin(9600);
  pinMode(10, OUTPUT);
}

void loop() {
  int leitura = analogRead(A0);           // 0..1023
  int pwm = map(leitura, 0, 1023, 0, 255);
  analogWrite(10, pwm);
  float tensao = leitura * 5.0 / 1023.0;
  Serial.println(tensao);                 // números aparecem no plotter
  delay(100);
}`],
    semaforo: ['Semáforo', `// Semáforo: vermelho (12), amarelo (11), verde (10)
const int VERM = 12, AMAR = 11, VERDE = 10;

void acende(int pino, int tempo) {
  digitalWrite(VERM, LOW);
  digitalWrite(AMAR, LOW);
  digitalWrite(VERDE, LOW);
  digitalWrite(pino, HIGH);
  delay(tempo);
}

void setup() {
  pinMode(VERM, OUTPUT);
  pinMode(AMAR, OUTPUT);
  pinMode(VERDE, OUTPUT);
}

void loop() {
  acende(VERDE, 4000);
  acende(AMAR, 1500);
  acende(VERM, 4000);
}`],
    servo: ['Servo controlado pelo potenciômetro', `#include <Servo.h>
// Servo no pino 9; posição definida pelo potenciômetro em A0
Servo motor;

void setup() {
  motor.attach(9);
  Serial.begin(9600);
}

void loop() {
  int angulo = map(analogRead(A0), 0, 1023, 0, 180);
  motor.write(angulo);
  Serial.print("angulo = ");
  Serial.println(angulo);
  delay(50);
}`],
    lm35: ['Termômetro LM35 com alarme', `// LM35 em A1: 10 mV/°C. Alarme (LED 12 + buzzer 8) acima do limite
const float LIMITE = 35.0;

void setup() {
  Serial.begin(9600);
  pinMode(12, OUTPUT);
}

float lerTemperatura() {
  int adc = analogRead(A1);
  return adc * (5.0 / 1023.0) * 100.0;    // V -> °C
}

void loop() {
  float t = lerTemperatura();
  Serial.println(t);
  if (t > LIMITE) {
    digitalWrite(12, HIGH);
    tone(8, 1000);
  } else {
    digitalWrite(12, LOW);
    noTone(8);
  }
  delay(250);
}`],
    millis: ['Multitarefa com millis()', `// Dois LEDs piscando em ritmos diferentes, sem delay()
unsigned long t1 = 0, t2 = 0;
bool e1 = false, e2 = false;

void setup() {
  pinMode(13, OUTPUT);
  pinMode(9, OUTPUT);
}

void loop() {
  unsigned long agora = millis();
  if (agora - t1 >= 300) { t1 = agora; e1 = !e1; digitalWrite(13, e1); }
  if (agora - t2 >= 1100) { t2 = agora; e2 = !e2; digitalWrite(9, e2); }
}`],
    ldr: ['LDR: luz automática', `// LDR em A2 (divisor de tensão). Escuro -> acende os LEDs 4 a 6
int pinos[] = {4, 5, 6};

void setup() {
  for (int i = 0; i < 3; i++) pinMode(pinos[i], OUTPUT);
  Serial.begin(9600);
}

void loop() {
  int luz = analogRead(A2);
  int n = 0;
  if (luz < 600) n = 1;
  if (luz < 400) n = 2;
  if (luz < 200) n = 3;
  for (int i = 0; i < 3; i++) {
    digitalWrite(pinos[i], i < n ? HIGH : LOW);
  }
  Serial.println(luz);
  delay(200);
}`],
    serial: ['Comandos pela Serial', `// Digite um número (0..255) no monitor serial para ajustar o LED 11
void setup() {
  Serial.begin(9600);
  pinMode(11, OUTPUT);
  Serial.println("Digite o brilho (0..255):");
}

void loop() {
  if (Serial.available() > 0) {
    int v = Serial.parseInt();
    v = constrain(v, 0, 255);
    analogWrite(11, v);
    Serial.print("brilho = ");
    Serial.println(v);
  }
  delay(20);
}`],
  };

  /* ════════════════ 1. SIMULADOR ARDUINO ════════════════ */
  const toolArduino = (host, onClean) => {
    const { body } = CS.page(host, {
      title: 'Simulador Arduino', lead: 'Escreva um <i>sketch</i> (C/C++ do Arduino), rode na <b>placa virtual</b> com LEDs, botões, potenciômetro, sensores, servo e buzzer, e acompanhe o <b>Monitor/Plotter Serial</b>.',
      learn: `<p><b>Estrutura de um sketch:</b> <code>setup()</code> roda uma vez ao ligar (configura pinos e a Serial); <code>loop()</code> se repete para sempre.</p>
      <p><b>Funções principais:</b> <code>pinMode(pino, OUTPUT|INPUT|INPUT_PULLUP)</code>, <code>digitalWrite</code>/<code>digitalRead</code> (0 ou 1), <code>analogRead</code> (ADC de 10 bits: 0–1023 para 0–5 V), <code>analogWrite</code> (PWM de 8 bits nos pinos ~3, 5, 6, 9, 10, 11), <code>delay(ms)</code>, <code>millis()</code>, <code>map()</code>, <code>Serial.print/println</code>, <code>tone()</code> e a biblioteca <code>Servo</code>.</p>
      <p><b>Placa virtual:</b> B1 no pino 2 e B2 no pino 7 (botões ao GND: use <code>INPUT_PULLUP</code>, que lê LOW quando pressionado); potenciômetro em A0; LM35 em A1 (10 mV/°C); LDR em A2; LEDs aparecem em todo pino configurado como saída; buzzer com <code>tone()</code>; servos com <code>Servo.attach()</code>.</p>
      <p><b>delay × millis:</b> <code>delay()</code> bloqueia o processador. Para fazer várias coisas "ao mesmo tempo", compare <code>millis()</code> com o último instante (exemplo <i>Multitarefa</i>).</p>
      <p><b>Repique (bounce):</b> contatos mecânicos oscilam por alguns milissegundos; filtre por software (atraso ou leitura repetida) ou por hardware (RC + Schmitt).</p>
      <p class="muted">O simulador interpreta um subconjunto da linguagem (variáveis, vetores, funções, if/for/while, Serial, Servo). Divisões entre inteiros não truncam e ponteiros/structs não são suportados. O tempo é virtual: a velocidade pode ser acelerada.</p>`,
    });
    const sel = h('select', {}, ...Object.entries(EXEMPLOS).map(([k, v]) => h('option', { value: k }, v[0])));
    const code = h('textarea', { class: 'ard-code', spellcheck: 'false' });
    const speed = h('select', {}, ...[['0.25', '0,25×'], ['1', '1×'], ['4', '4×'], ['20', '20×']].map(([v, l]) => h('option', { value: v }, l))); speed.value = '1';
    const bRun = h('button', { class: 'btn run' }, '▶ Carregar e rodar'), bStop = h('button', { class: 'btn' }, '■ Parar');
    const stat = h('span', { class: 'muted small' }, 'parado');
    const serial = h('div', { class: 'ard-serial' }), sin = h('input', { placeholder: 'enviar para a Serial…', style: 'flex:1' });
    const io = {
      btn: {}, pot: 512, temp: 25, luz: 60,
      analog: p => (p === 14 ? io.pot : p === 15 ? io.temp * 1023 / 500 : p === 16 ? 1023 * (io.luz / 100) ** 0.7 : 0),
      serial: txt => { serialBuf += txt; },
      error: e => { serialBuf += `\n⚠ erro: ${e.message}\n`; stat.textContent = 'erro'; },
    };
    let serialBuf = '', serialShown = '', plotLine = '';
    const vm = new ArduinoVM(io);
    const btns = h('div', { class: 'ard-ctrls' });
    for (const [p, nm] of Object.entries(BTN)) { const b = h('button', { class: 'btn' }, `${nm} (pino ${p})`); const dn = () => { io.btn[p] = true; b.classList.add('on'); }, up = () => { io.btn[p] = false; b.classList.remove('on'); }; b.addEventListener('pointerdown', dn); b.addEventListener('pointerup', up); b.addEventListener('pointerleave', up); btns.append(b); }
    const slider = (lbl, min, max, v, fn, unit) => { const r = h('input', { type: 'range', min, max, value: v }), o = h('b', {}, v + unit); r.addEventListener('input', () => { fn(+r.value); o.textContent = r.value + unit; }); return h('label', {}, lbl + ' ', r, ' ', o); };
    btns.append(slider('Pot A0', 0, 1023, 512, v => { io.pot = v; }, ''), slider('LM35 A1', 0, 100, 25, v => { io.temp = v; }, ' °C'), slider('Luz A2', 0, 100, 60, v => { io.luz = v; }, ' %'));
    const cvc = h('div'), pb = CS.chartBox('sm');
    const left = h('div', { class: 'col' }, h('div', { class: 'row gap wrap' }, h('span', {}, 'Exemplo:'), sel, bRun, bStop, h('span', {}, 'velocidade'), speed, stat), code);
    const right = h('div', { class: 'col' }, CS.card('Placa virtual (Arduino Uno)', cvc, btns), CS.card('Monitor Serial', serial, h('div', { class: 'row gap' }, sin, h('button', { class: 'btn sm', onclick: () => { serialBuf = ''; serialShown = ''; serial.textContent = ''; } }, 'limpar'))), CS.card('Plotter Serial (números impressos com println)', pb));
    body.append(h('div', { class: 'ard-wrap' }, left, right));
    const cv = K.canvas(cvc, 250, null);
    const plot = new MS.Chart(pb, { xlabel: 't [s]', ylabel: 'valor', readout: (x, y) => `${K.n(x)} s\n${K.n(y)}` });
    const ps = [[], [], []], pt = [];
    const load = k => { code.value = EXEMPLOS[k][1]; };
    sel.addEventListener('change', () => { load(sel.value); run(); });
    sin.addEventListener('keydown', e => { if (e.key === 'Enter') { for (const c of sin.value + '\n') vm.rx.push(c.charCodeAt(0)); serialBuf += '> ' + sin.value + '\n'; sin.value = ''; } });
    code.addEventListener('keydown', e => { if (e.key === 'Tab') { e.preventDefault(); const a = code.selectionStart; code.setRangeText('  ', a, code.selectionEnd, 'end'); } });
    function run() {
      serialBuf = ''; serialShown = ''; serial.textContent = ''; plotLine = ''; ps.forEach(a => (a.length = 0)); pt.length = 0;
      try { vm.load(code.value); vm.start(); stat.textContent = 'rodando'; } catch (e) { vm.running = false; io.error(e); serial.textContent = serialBuf; console.warn(e); }
    }
    bRun.addEventListener('click', run);
    bStop.addEventListener('click', () => { vm.reset(); stat.textContent = 'parado'; });
    let busy = false, last = performance.now(), plotTick = 0;
    onClean(K.animate(cv.box, async () => {
      const now = performance.now(), dt = Math.min(50, now - last); last = now;
      if (!busy) { busy = true; try { await vm.frame(dt * +speed.value); } finally { busy = false; } }
      if (serialBuf !== serialShown) {
        const add = serialBuf.slice(serialShown.length); serialShown = serialBuf;
        if (serialBuf.length > 20000) { serialBuf = serialShown = serialBuf.slice(-10000); serial.textContent = serialBuf; } else serial.textContent += add;
        serial.scrollTop = serial.scrollHeight;
        plotLine += add; const lines = plotLine.split('\n'); plotLine = lines.pop();
        for (const ln of lines) { const nums = ln.split(/[\s,;\t]+/).map(Number).filter((x, i, a) => a.length && isFinite(x) && ln.trim() !== ''); if (!nums.length || !/^[\s\d.,;\t+-eE]+$/.test(ln)) continue; pt.push(vm.vt / 1000); for (let i = 0; i < 3; i++) ps[i].push(nums[i] ?? NaN); if (pt.length > 300) { pt.shift(); ps.forEach(a => a.shift()); } }
      }
      if (++plotTick % 6 === 0 && pt.length) plot.set({ series: ps.map((a, i) => ({ x: pt, y: a, color: ['#3ddc84', '#4fb3ff', '#ffd166'][i], width: 1.8 })).filter(s => s.y.some(isFinite)) });
      if (vm.running) stat.textContent = `rodando · t = ${K.n(vm.vt / 1000, 4)} s`;
      cv.redraw();
    }));
    cv.draw = (g, W, H) => {
      const bx = 10, by = 70, bw = Math.min(W - 150, 380), bh = H - 90;
      g.fillStyle = '#0f5f8c'; g.beginPath(); g.roundRect ? g.roundRect(bx, by, bw, bh, 8) : g.rect(bx, by, bw, bh); g.fill();
      g.fillStyle = '#d7e6f5'; g.font = 'bold 14px Barlow'; g.textAlign = 'left'; g.fillText('UNO (virtual)', bx + 14, by + bh - 14);
      g.fillStyle = '#222'; g.fillRect(bx + bw * 0.35, by + bh * 0.4, bw * 0.4, bh * 0.25); g.fillStyle = '#9fb4d0'; g.font = '10px Share Tech Mono'; g.fillText('ATmega328P', bx + bw * 0.38, by + bh * 0.55);
      const step = (bw - 30) / 14;
      for (let p = 0; p <= 13; p++) {
        const x = bx + bw - 15 - (p + 0.5) * step, y = by + 10, q = vm.pins[p];
        g.fillStyle = '#111'; g.fillRect(x - 5, y - 4, 10, 10);
        g.fillStyle = '#d7e6f5'; g.font = '10px Share Tech Mono'; g.textAlign = 'center'; g.fillText((PWM_PINS.includes(p) ? '~' : '') + p, x, y + 18);
        if (q.mode === 'OUTPUT' || q.pwm != null) {
          const lv = q.pwm != null ? q.pwm : q.out, c = LEDC[p] || '#ff4d6d';
          g.strokeStyle = '#555'; g.beginPath(); g.moveTo(x, y - 4); g.lineTo(x, y - 30); g.stroke();
          g.globalAlpha = 0.25 + 0.75 * lv; g.fillStyle = lv > 0.02 ? c : '#3a4250'; g.beginPath(); g.arc(x, y - 40, 8, 0, 7); g.fill();
          if (lv > 0.02) { const gr = g.createRadialGradient(x, y - 40, 2, x, y - 40, 24); gr.addColorStop(0, c); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.globalAlpha = 0.5 * lv; g.fillStyle = gr; g.beginPath(); g.arc(x, y - 40, 24, 0, 7); g.fill(); }
          g.globalAlpha = 1;
        } else if (BTN[p]) { g.fillStyle = io.btn[p] ? '#ffd166' : '#6f8bad'; g.font = '10px Barlow'; g.fillText(BTN[p], x, y - 12); }
      }
      g.fillStyle = '#d7e6f5'; g.font = '10px Share Tech Mono'; g.textAlign = 'center';
      ['A0 pot', 'A1 LM35', 'A2 LDR'].forEach((t, i) => g.fillText(t, bx + 50 + i * 70, by + bh - 34));
      const rx = bx + bw + 20;
      g.textAlign = 'left'; g.font = '12px Barlow';
      vm.servos.filter(s => s.pin >= 0).slice(0, 2).forEach((s, i) => {
        const cx = rx + 50, cy = by + 30 + i * 90;
        g.fillStyle = '#1d3557'; g.fillRect(cx - 30, cy - 15, 60, 30); g.save(); g.translate(cx, cy); g.rotate(-(s.a - 90) * Math.PI / 180 - Math.PI / 2); g.fillStyle = '#f1faee'; g.fillRect(-4, -4, 42, 8); g.restore();
        g.fillStyle = '#c3d3e8'; g.fillText(`servo (pino ${s.pin}): ${Math.round(s.a)}°`, cx - 45, cy + 32);
      });
      const by2 = H - 40;
      g.fillStyle = vm.toneF ? '#ffd166' : '#3a4250'; g.beginPath(); g.arc(rx + 20, by2, 14, 0, 7); g.fill(); g.fillStyle = '#111'; g.beginPath(); g.arc(rx + 20, by2, 4, 0, 7); g.fill();
      g.fillStyle = '#c3d3e8'; g.fillText(vm.toneF ? `♪ ${vm.toneF} Hz` : 'buzzer', rx + 40, by2 + 4);
    };
    load('blink'); run();
    onClean(() => vm.reset());
  };

  /* ════════════════ 2. PLATAFORMAS ════════════════ */
  const PLAT = [
    ['Arduino Uno R3', 'ATmega328P (AVR 8 bits)', '16 MHz', '32 KB / 2 KB', '14 (6 PWM) · 6 ADC 10 bits', '5 V', '—', 'Ensino, prototipagem, enorme comunidade e bibliotecas.'],
    ['Arduino Nano', 'ATmega328P', '16 MHz', '32 KB / 2 KB', '14 (6 PWM) · 8 ADC', '5 V', '—', 'Mesmo chip do Uno em formato pequeno, para protoboard.'],
    ['Arduino Mega 2560', 'ATmega2560', '16 MHz', '256 KB / 8 KB', '54 (15 PWM) · 16 ADC · 4 UART', '5 V', '—', 'Projetos com muitos pinos (impressoras 3D, robôs).'],
    ['Arduino Uno R4 WiFi', 'Renesas RA4M1 (Cortex-M4) + ESP32-S3', '48 MHz', '256 KB / 32 KB', '14 · DAC 12 bits · CAN', '5 V', 'Wi-Fi, BLE', 'Sucessor do Uno com matriz de LED e conectividade.'],
    ['ESP8266 (NodeMCU)', 'Tensilica L106 32 bits', '80/160 MHz', '4 MB flash / 80 KB', '11 GPIO · 1 ADC', '3,3 V', 'Wi-Fi', 'IoT barato; ainda comum em automação residencial.'],
    ['ESP32 (DevKit)', 'Xtensa LX6 dual-core', '240 MHz', '4 MB flash / 520 KB', '34 GPIO · 18 ADC 12 bits · 2 DAC · toque', '3,3 V', 'Wi-Fi, BLE', 'IoT, FreeRTOS nativo, ótimo custo-benefício.'],
    ['ESP32-C3 / S3', 'RISC-V / Xtensa LX7', '160 / 240 MHz', 'até 16 MB', 'USB nativo (S3), IA (S3)', '3,3 V', 'Wi-Fi, BLE 5', 'Versões modernas da família ESP32.'],
    ['Raspberry Pi Pico (RP2040/RP2350)', 'Dual Cortex-M0+ / M33', '133–150 MHz', '2–4 MB / 264–520 KB', '26 GPIO · 3 ADC · PIO', '3,3 V', 'Wi-Fi/BLE (Pico W)', 'PIO programável, MicroPython e C/C++.'],
    ['STM32 (Blue Pill / Nucleo)', 'ARM Cortex-M3/M4/M7', '72–480 MHz', '64 KB–2 MB', 'timers avançados, CAN, USB, DMA', '3,3 V', '—', 'Indústria; HAL/CubeMX; controle de motores.'],
    ['PIC / dsPIC (Microchip)', 'PIC 8/16/32 bits', 'até 200 MHz', 'variados', 'periféricos de controle de potência', '3,3–5 V', '—', 'Muito usado na indústria e em fontes chaveadas.'],
    ['Raspberry Pi 4/5', 'Cortex-A72/A76 quad-core (Linux)', '1,5–2,4 GHz', '2–8 GB RAM', '40 pinos GPIO · I²C · SPI · UART', '3,3 V', 'Wi-Fi, BLE, Ethernet', 'Computador completo: visão, servidores, IHM.'],
    ['BeagleBone / Jetson Nano', 'Cortex-A8 + PRU / GPU NVIDIA', '1 GHz / 1,4 GHz', '512 MB–4 GB', 'PRU tempo real / CUDA', '3,3 V', 'Ethernet', 'Tempo real em Linux / IA embarcada.'],
  ];
  const toolPlat = (host, onClean) => {
    const { body } = CS.page(host, {
      title: 'Plataformas e pinagens', lead: 'Comparativo dos principais microcontroladores e placas, pinagem do Arduino Uno e conceitos de arquitetura.',
      learn: `<p><b>Microcontrolador × microprocessador:</b> o microcontrolador (MCU) integra CPU, memória Flash/RAM e periféricos (GPIO, ADC, timers, UART, I²C, SPI) num chip e roda um único programa sem sistema operacional (<i>bare metal</i>) ou com RTOS. O microprocessador (SBC como a Raspberry Pi) roda Linux e precisa de memória externa.</p>
      <p><b>Memórias:</b> Flash (programa, não volátil), SRAM (variáveis, volátil), EEPROM (dados persistentes).</p>
      <p><b>Periféricos:</b> GPIO (entrada/saída digital), ADC (conversor analógico-digital), PWM (modulação por largura de pulso), timers, interrupções (resposta imediata a eventos), watchdog (reinicia o sistema se travar), DMA (transferência sem a CPU).</p>
      <p><b>Níveis lógicos:</b> placas de 3,3 V (ESP32, Pico, STM32) <b>não toleram 5 V</b> na maioria dos pinos: use conversor de nível ou divisor.</p>
      <p><b>RTOS:</b> sistemas operacionais de tempo real (FreeRTOS, Zephyr) permitem tarefas concorrentes com prioridades e prazos determinísticos.</p>`,
    });
    onClean(K.sections(body, 'plat', [
      { id: 'cmp', label: 'Comparativo', render: a => a.append(CS.card('Placas e microcontroladores', K.table(['Placa', 'Núcleo', 'Clock', 'Flash / RAM', 'E/S', 'Lógica', 'Rádio', 'Uso típico'], PLAT))), },
      { id: 'pin', label: 'Pinagem Arduino Uno', render: secPinout },
      { id: 'ard', label: 'Arquitetura e conceitos', render: secArq },
    ]));
  };
  function secPinout(area) {
    const cvc = CS.card('Arduino Uno R3 — pinagem');
    area.append(h('div', { class: 'grid2' }, cvc, CS.card('Funções especiais', K.table(['Pino', 'Função'], [['0 / 1', 'RX / TX (UART, também usados pela USB)'], ['2 / 3', 'interrupções externas INT0 / INT1'], ['~3, 5, 6, 9, 10, 11', 'PWM (analogWrite) — 490 Hz (5 e 6: 980 Hz)'], ['10 / 11 / 12 / 13', 'SPI: SS / MOSI / MISO / SCK'], ['13', 'LED_BUILTIN'], ['A0–A5', 'ADC 10 bits (também GPIO 14–19)'], ['A4 / A5', 'I²C: SDA / SCL'], ['AREF', 'referência externa do ADC'], ['5V / 3V3 / GND / VIN', 'alimentação (VIN 7–12 V pelo regulador)'], ['Corrente', 'máx. 40 mA por pino (recomendado ≤ 20 mA), 200 mA no total']], 'pin-tbl'))));
    const cv = K.canvas(cvc, 330, (g, W, H) => {
      const bw = Math.min(W - 40, 460), bh = 250, x0 = (W - bw) / 2, y0 = 40;
      g.fillStyle = '#0f5f8c'; g.fillRect(x0, y0, bw, bh); g.fillStyle = '#b5b5b5'; g.fillRect(x0 - 12, y0 + 30, 40, 50); g.fillStyle = '#222'; g.fillRect(x0 - 8, y0 + bh - 70, 34, 45);
      g.fillStyle = '#d7e6f5'; g.font = '10px Barlow'; g.textAlign = 'left'; g.fillText('USB', x0 - 6, y0 + 25); g.fillText('jack 7–12 V', x0 - 8, y0 + bh - 74);
      g.fillStyle = '#222'; g.fillRect(x0 + bw * 0.4, y0 + bh * 0.45, bw * 0.38, 40); g.fillStyle = '#9fb4d0'; g.font = '11px Share Tech Mono'; g.fillText('ATmega328P', x0 + bw * 0.45, y0 + bh * 0.45 + 24);
      const top = ['AREF', 'GND', '13', '12', '~11', '~10', '~9', '8', '7', '~6', '~5', '4', '~3', '2', 'TX1', 'RX0'];
      const bot = ['IOREF', 'RST', '3V3', '5V', 'GND', 'GND', 'VIN', 'A0', 'A1', 'A2', 'A3', 'A4', 'A5'];
      const col = t => (t.includes('GND') ? '#888' : /5V|3V3|VIN|IOREF/.test(t) ? '#ff4d6d' : t[0] === 'A' && t !== 'AREF' ? '#3ddc84' : t[0] === '~' ? '#ffd166' : /TX|RX/.test(t) ? '#c77dff' : '#4fb3ff');
      const st = (bw - 60) / top.length;
      top.forEach((t, i) => { const x = x0 + 50 + i * st; g.fillStyle = '#111'; g.fillRect(x - 5, y0 + 4, 10, 10); g.save(); g.translate(x + 3, y0 - 4); g.rotate(-Math.PI / 3); g.fillStyle = col(t); g.font = '10px Share Tech Mono'; g.fillText(t, 0, 0); g.restore(); });
      const sb = (bw - 120) / bot.length;
      bot.forEach((t, i) => { const x = x0 + 100 + i * sb; g.fillStyle = '#111'; g.fillRect(x - 5, y0 + bh - 14, 10, 10); g.save(); g.translate(x - 3, y0 + bh + 6); g.rotate(Math.PI / 3); g.fillStyle = col(t); g.font = '10px Share Tech Mono'; g.fillText(t, 0, 0); g.restore(); });
      const leg = [['digital', '#4fb3ff'], ['PWM', '#ffd166'], ['analógico', '#3ddc84'], ['UART', '#c77dff'], ['alimentação', '#ff4d6d']];
      leg.forEach(([t, c], i) => { g.fillStyle = c; g.fillRect(10 + i * 90, H - 16, 10, 10); g.fillStyle = '#c3d3e8'; g.font = '11px Barlow'; g.fillText(t, 24 + i * 90, H - 7); });
    });
    void cv;
  }
  function secArq(area) {
    area.append(h('div', { class: 'grid2' },
      CS.card('Ciclo de desenvolvimento', h('ol', {}, ...['Requisitos (entradas, saídas, tempo de resposta, consumo)', 'Escolha do MCU e dos sensores/atuadores', 'Esquema elétrico (alimentação, proteção, níveis lógicos)', 'Firmware: drivers → lógica (máquina de estados) → comunicação', 'Testes em bancada (osciloscópio, analisador lógico, depurador)', 'PCB, gabinete, certificação (EMC) e produção'].map(x => h('li', {}, x)))),
      CS.card('Boas práticas de firmware', h('ul', {}, ...['Evite delay() longos: use millis(), interrupções ou RTOS', 'Máquinas de estado para lógicas sequenciais', 'Watchdog para recuperar de travamentos', 'Debounce em botões; filtros (média móvel) em leituras analógicas', 'Modos de baixo consumo (sleep) em equipamentos a bateria', 'Atualização remota (OTA) com verificação de integridade em IoT'].map(x => h('li', {}, x)))),
      CS.card('Linguagens e ferramentas', K.table(['Ferramenta', 'Uso'], [['Arduino IDE / PlatformIO', 'C/C++ com bibliotecas Arduino'], ['ESP-IDF', 'framework oficial do ESP32 (FreeRTOS)'], ['STM32CubeIDE', 'HAL, configuração gráfica de pinos e clocks'], ['MicroPython / CircuitPython', 'Python em MCUs (Pico, ESP32)'], ['Zephyr / FreeRTOS', 'sistemas operacionais de tempo real'], ['Rust embarcado', 'segurança de memória (embassy, RTIC)']])),
      CS.card('Sensores e atuadores comuns', K.table(['Dispositivo', 'Interface'], [['DHT22 (temp./umidade)', '1 fio próprio'], ['DS18B20 (temperatura)', '1-Wire'], ['BMP280 / BME280 (pressão)', 'I²C / SPI'], ['MPU-6050 (acel./giroscópio)', 'I²C'], ['HC-SR04 (ultrassom)', 'pulso (trigger/echo)'], ['Display OLED SSD1306', 'I²C / SPI'], ['Módulo relé', 'GPIO (via transistor)'], ['Ponte H L298N / driver A4988', 'PWM + direção / passo'], ['RFID RC522', 'SPI'], ['GPS NEO-6M', 'UART']]))));
  }

  /* ════════════════ 3. PROTOCOLOS ════════════════ */
  const toolProto = (host, onClean) => {
    const { body } = CS.page(host, {
      title: 'Protocolos de comunicação', lead: 'Diagramas de tempo gerados para o byte que você escolher: <b>UART</b>, <b>I²C</b> e <b>SPI</b>, mais um comparativo com CAN, RS-485, 1-Wire e USB.',
      learn: `<p><b>UART (serial assíncrona):</b> 2 fios (TX/RX), sem clock. Cada quadro tem 1 bit de início (0), 5–9 bits de dados (LSB primeiro), paridade opcional e 1–2 bits de parada (1). Os dois lados combinam a taxa (baud), por exemplo 9600 ou 115200 bps.</p>
      <p><b>I²C:</b> 2 fios (SDA, SCL) com <i>pull-ups</i>, mestre e escravos endereçados (7 bits). START = SDA cai com SCL alto; cada byte é seguido de um ACK (0) do receptor; STOP = SDA sobe com SCL alto. Velocidades de 100 kHz, 400 kHz e 1 MHz.</p>
      <p><b>SPI:</b> 4 fios (SCK, MOSI, MISO, CS), full-duplex e rápido (dezenas de MHz). O CS em nível baixo seleciona o escravo. Os modos 0–3 definem a polaridade (CPOL) e a fase (CPHA) do clock.</p>
      <p><b>Escolha:</b> UART para depuração/GPS/módulos; I²C para muitos sensores com poucos fios; SPI para displays, cartões SD e ADCs rápidos; CAN/RS-485 para ambientes industriais e veiculares (diferencial, longas distâncias).</p>`,
    });
    onClean(K.sections(body, 'proto', [{ id: 'uart', label: 'UART', render: secUART }, { id: 'i2c', label: 'I²C', render: secI2C }, { id: 'spi', label: 'SPI', render: secSPI }, { id: 'cmp', label: 'Comparativo', render: secProtoCmp }]));
  };
  /* desenha formas de onda digitais: traces = [{name, color, seg:[[t0,t1,v]], ann:[[t,text]]}] */
  function drawTraces(g, W, H, traces, T, marks = []) {
    const L = 60, R = W - 10, n = traces.length, hh = (H - 30) / n, X = t => L + (R - L) * t / T;
    g.font = '11px Share Tech Mono';
    traces.forEach((tr, i) => {
      const y0 = 15 + i * hh, yH = y0 + hh * 0.2, yL = y0 + hh * 0.65;
      g.fillStyle = tr.color; g.textAlign = 'right'; g.fillText(tr.name, L - 8, (yH + yL) / 2 + 4);
      g.strokeStyle = 'rgba(159,180,208,0.15)'; g.beginPath(); g.moveTo(L, yL); g.lineTo(R, yL); g.stroke();
      g.strokeStyle = tr.color; g.lineWidth = 2; g.beginPath();
      let prev = null;
      for (const [t0, t1, v] of tr.seg) { const y = v ? yH : yL; if (prev === null) g.moveTo(X(t0), y); else g.lineTo(X(t0), y); g.lineTo(X(t1), y); prev = y; }
      g.stroke(); g.lineWidth = 1;
      g.textAlign = 'center'; for (const [t, txt, c] of tr.ann || []) { g.fillStyle = c || '#c3d3e8'; g.fillText(txt, X(t), yL + 14); }
    });
    for (const [t0, t1, txt, c] of marks) { g.fillStyle = c; g.globalAlpha = 0.1; g.fillRect(X(t0), 8, X(t1) - X(t0), H - 22); g.globalAlpha = 1; g.fillStyle = c; g.textAlign = 'center'; g.font = '10px Barlow'; g.fillText(txt, (X(t0) + X(t1)) / 2, H - 4); }
  }
  const parseByte = v => { const s = String(v).trim(); if (/^0x/i.test(s)) return parseInt(s, 16) & 255; if (/^0b/i.test(s)) return parseInt(s.slice(2), 2) & 255; if (/^\d+$/.test(s)) return (+s) & 255; return s.charCodeAt(0) & 255; };
  const bin8 = b => b.toString(2).padStart(8, '0');
  function secUART(area) {
    const f = K.form([{ k: 'd', l: 'Dado (caractere, 0x.. ou decimal)', type: 'txt', v: 'A' }, { k: 'baud', l: 'Taxa', type: 'sel', v: '9600', opts: ['1200', '9600', '19200', '57600', '115200'] }, { k: 'par', l: 'Paridade', type: 'sel', v: 'N', opts: [['N', 'nenhuma'], ['E', 'par (even)'], ['O', 'ímpar (odd)']] }, { k: 'stop', l: 'Bits de parada', type: 'sel', v: '1', opts: ['1', '2'] }], () => run(), { cols: 2 });
    const out = h('div'), cvc = CS.card('Linha TX (repouso em nível alto)');
    area.append(h('div', { class: 'grid2' }, CS.card('Configuração (ex.: 8N1)', f.el, out), cvc));
    const txt = h('input', { value: 'A' }); f.el.querySelectorAll('input')[0].replaceWith(txt); txt.addEventListener('input', run);
    const cv = K.canvas(cvc, 200, null);
    function run() {
      const b = parseByte(txt.value || 'A'), bits = [0], ann = [[0.5, 'S', '#ffd166']];
      for (let i = 0; i < 8; i++) { bits.push((b >> i) & 1); ann.push([1.5 + i, `D${i}=${(b >> i) & 1}`, '#c3d3e8']); }
      const ones = bin8(b).split('').filter(x => x === '1').length;
      if (f.st.par !== 'N') { const p = f.st.par === 'E' ? ones % 2 : 1 - ones % 2; bits.push(p); ann.push([bits.length - 0.5, 'P=' + p, '#c77dff']); }
      for (let i = 0; i < +f.st.stop; i++) { bits.push(1); ann.push([bits.length - 0.5, 'Stop', '#ffd166']); }
      const T = bits.length + 2, seg = [[0, 1, 1], ...bits.map((v, i) => [1 + i, 2 + i, v]), [bits.length + 1, T, 1]];
      ann.forEach(a => (a[0] += 1));
      const tb = 1 / +f.st.baud;
      out.innerHTML = '';
      out.append(CS.kv([['Byte', `0x${b.toString(16).toUpperCase().padStart(2, '0')} = ${b} = 0b${bin8(b)} ('${b >= 32 && b < 127 ? String.fromCharCode(b) : '·'}')`], ['Formato', `8${f.st.par}${f.st.stop}`], ['Tempo de bit', `${K.n(tb * 1e6, 4)} µs`], ['Bits por quadro', bits.length], ['Vazão útil', `${K.n(+f.st.baud * 8 / bits.length / 8, 4)} bytes/s`]]), h('div', { class: 'muted small' }, 'Note que o bit menos significativo (D0) é transmitido primeiro.'));
      cv.draw = (g, W, H) => drawTraces(g, W, H, [{ name: 'TX', color: '#3ddc84', seg, ann }], T);
      cv.redraw();
    }
    run();
  }
  function secI2C(area) {
    const f = K.form([{ k: 'addr', l: 'Endereço (7 bits, hex)', type: 'sel', v: '0x68', opts: [['0x68', '0x68 (MPU-6050, RTC DS3231)'], ['0x76', '0x76 (BMP280)'], ['0x3C', '0x3C (OLED SSD1306)'], ['0x27', '0x27 (LCD com PCF8574)'], ['0x48', '0x48 (ADS1115)']] }, { k: 'rw', l: 'Operação', type: 'sel', v: '0', opts: [['0', 'escrita (W = 0)'], ['1', 'leitura (R = 1)']] }, { k: 'd', l: 'Byte de dados', type: 'sel', v: '0x6B', opts: ['0x6B', '0x00', '0xA5', '0xFF', '0x3C'] }, { k: 'clk', l: 'Clock', type: 'sel', v: '100', opts: [['100', '100 kHz (standard)'], ['400', '400 kHz (fast)'], ['1000', '1 MHz (fast plus)']] }], () => run(), { cols: 2 });
    const out = h('div'), cvc = CS.card('SCL e SDA');
    area.append(h('div', { class: 'grid2' }, CS.card('Transação', f.el, out), cvc));
    const cv = K.canvas(cvc, 230, null);
    function run() {
      const a = parseInt(f.st.addr, 16), d = parseInt(f.st.d, 16), rw = +f.st.rw;
      const bits = [];
      for (let i = 6; i >= 0; i--) bits.push([(a >> i) & 1, `A${i}`, '#4fb3ff']);
      bits.push([rw, rw ? 'R' : 'W', '#c77dff']); bits.push([0, 'ACK', '#3ddc84']);
      for (let i = 7; i >= 0; i--) bits.push([(d >> i) & 1, `D${i}`, '#ffd166']);
      bits.push([rw ? 1 : 0, rw ? 'NACK' : 'ACK', rw ? '#ff4d6d' : '#3ddc84']);
      const scl = [[0, 1, 1]], sda = [[0, 0.5, 1], [0.5, 1, 0]];
      bits.forEach(([v], i) => { const t = 1 + i; scl.push([t, t + 0.5, 0], [t + 0.5, t + 1, 1]); sda.push([t, t + 1, v]); });
      const te = 1 + bits.length; scl.push([te, te + 0.5, 0], [te + 0.5, te + 2, 1]); sda.push([te, te + 1, 0], [te + 1, te + 2, 1]);
      const T = te + 2;
      const ann = bits.map(([v, l, c], i) => [1.5 + i, l, c]);
      cv.draw = (g, W, H) => drawTraces(g, W, H, [{ name: 'SCL', color: '#4fb3ff', seg: scl }, { name: 'SDA', color: '#ffd166', seg: sda, ann }], T, [[0, 1, 'START', '#3ddc84'], [1, 9, 'endereço + R/W', '#4fb3ff'], [10, 18, 'dado', '#ffd166'], [te, T, 'STOP', '#ff4d6d']]);
      cv.redraw();
      out.innerHTML = '';
      out.append(CS.kv([['Primeiro byte (endereço « 1 | R/W)', `0x${((a << 1) | rw).toString(16).toUpperCase()} = 0b${bin8((a << 1) | rw)}`], ['Dado', `0x${d.toString(16).toUpperCase().padStart(2, '0')} = 0b${bin8(d)}`], ['Duração (≈ 20 ciclos)', `${K.n(20 / (+f.st.clk * 1e3) * 1e6, 4)} µs`], ['Pull-up típico', +f.st.clk >= 400 ? '2,2 kΩ' : '4,7 kΩ']]), h('div', { class: 'muted small' }, 'SDA só muda com SCL baixo, exceto em START/STOP. MSB primeiro. O 9º pulso é o ACK do receptor.'));
    }
    run();
  }
  function secSPI(area) {
    const f = K.form([{ k: 'mode', l: 'Modo', type: 'sel', v: '0', opts: [['0', '0 (CPOL 0, CPHA 0)'], ['1', '1 (CPOL 0, CPHA 1)'], ['2', '2 (CPOL 1, CPHA 0)'], ['3', '3 (CPOL 1, CPHA 1)']] }, { k: 'mosi', l: 'MOSI (mestre → escravo)', type: 'sel', v: '0x9F', opts: ['0x9F', '0x03', '0xA5', '0x55'] }, { k: 'miso', l: 'MISO (escravo → mestre)', type: 'sel', v: '0xEF', opts: ['0xEF', '0x00', '0x3C', '0xC2'] }, { k: 'f', l: 'Clock', u: 'MHz', v: '8' }], () => run(), { cols: 2 });
    const out = h('div'), cvc = CS.card('CS, SCK, MOSI e MISO');
    area.append(h('div', { class: 'grid2' }, CS.card('Transferência (full-duplex)', f.el, out), cvc));
    const cv = K.canvas(cvc, 280, null);
    function run() {
      const m = +f.st.mode, cpol = m >> 1, cpha = m & 1, mo = parseInt(f.st.mosi, 16), mi = parseInt(f.st.miso, 16);
      const T = 10, cs = [[0, 0.6, 1], [0.6, 9.4, 0], [9.4, T, 1]], sck = [[0, 1, cpol]], a = [], b = [], ann1 = [], ann2 = [];
      for (let i = 0; i < 8; i++) { const t = 1 + i; sck.push([t, t + 0.5, 1 - cpol], [t + 0.5, t + 1, cpol]); const off = cpha ? 0.5 : 0; a.push([t + off - (i === 0 && !cpha ? 0.4 : 0), t + 1 + off, (mo >> (7 - i)) & 1]); b.push([t + off - (i === 0 && !cpha ? 0.4 : 0), t + 1 + off, (mi >> (7 - i)) & 1]); ann1.push([t + 0.5 + off, String((mo >> (7 - i)) & 1)]); ann2.push([t + 0.5 + off, String((mi >> (7 - i)) & 1)]); }
      sck.push([9, T, cpol]);
      const pad = arr => [[0, arr[0][0], 1], ...arr, [arr[arr.length - 1][1], T, 1]];
      const samp = [...Array(8)].map((_, i) => 1 + i + (cpha ? 0.5 : 0) + 0.0);
      cv.draw = (g, W, H) => { drawTraces(g, W, H, [{ name: 'CS', color: '#ff4d6d', seg: cs }, { name: 'SCK', color: '#4fb3ff', seg: sck }, { name: 'MOSI', color: '#3ddc84', seg: pad(a), ann: ann1 }, { name: 'MISO', color: '#ffd166', seg: pad(b), ann: ann2 }], T); g.strokeStyle = 'rgba(199,125,255,0.5)'; g.setLineDash([3, 3]); for (const t of samp) { const x = 60 + (W - 70) * (t + 0.5) / T; g.beginPath(); g.moveTo(x, 10); g.lineTo(x, H - 15); g.stroke(); } g.setLineDash([]); };
      cv.redraw();
      out.innerHTML = '';
      out.append(CS.kv([['SCK em repouso', cpol ? 'alto' : 'baixo'], ['Amostragem', `na ${cpha ? '2ª' : '1ª'} borda do clock (linhas tracejadas)`], ['Enviado / recebido', `${f.st.mosi} → ← ${f.st.miso}`], ['Tempo do byte', `${K.n(8 / f.st.f, 4)} µs`], ['Vazão máx.', `${K.n(f.st.f / 8 * 1e3, 4)} kB/s`]]), h('div', { class: 'muted small' }, 'A cada pulso, o mestre envia um bit (MOSI) e recebe outro (MISO) ao mesmo tempo: na prática, os registradores de deslocamento trocam seus conteúdos.'));
    }
    run();
  }
  function secProtoCmp(area) {
    area.append(CS.card('Comparativo de barramentos', K.table(['Protocolo', 'Fios', 'Topologia', 'Velocidade típica', 'Distância', 'Uso'], [
      ['UART / RS-232', '2 (+GND)', 'ponto a ponto', '9,6–115,2 kbps (até Mbps)', 'até ~15 m (RS-232)', 'depuração, GPS, Bluetooth HC-05'],
      ['RS-485', '2 (diferencial)', 'barramento multiponto (32+ nós)', 'até 10 Mbps', 'até 1 200 m', 'Modbus RTU, automação industrial'],
      ['I²C', '2 (SDA, SCL)', 'barramento endereçado', '100 k / 400 k / 1 MHz', 'placa (< 1 m)', 'sensores, EEPROM, displays'],
      ['SPI', '4 (+1 CS por escravo)', 'mestre/escravos', '1–50 MHz', 'placa', 'SD, displays TFT, ADCs, flash'],
      ['CAN / CAN FD', '2 (diferencial)', 'barramento multimestre', '125 k–1 Mbps (FD: 5–8 Mbps)', '40 m a 1 Mbps; 500 m a 125 kbps', 'automotivo, máquinas, CANopen'],
      ['1-Wire', '1 (+GND)', 'barramento endereçado (64 bits)', '16 kbps', 'dezenas de metros', 'DS18B20, iButton'],
      ['USB', '2 dados + alimentação', 'host/dispositivo', '12 Mbps–40 Gbps', '5 m', 'periféricos, programação'],
      ['Ethernet / Wi-Fi', 'cabo / rádio', 'estrela', '10 Mbps–10 Gbps', '100 m / ~50 m', 'IoT, Modbus TCP, MQTT'],
    ])));
  }

  /* ════════════════ 4. CALCULADORAS ════════════════ */
  const E12 = [1, 1.2, 1.5, 1.8, 2.2, 2.7, 3.3, 3.9, 4.7, 5.6, 6.8, 8.2];
  E.nearestE = (R, up = true) => { const d = Math.floor(Math.log10(R)); let best = null; for (const k of [d - 1, d, d + 1]) for (const m of E12) { const v = m * 10 ** k; if (up ? v >= R * 0.999 : true) if (!best || Math.abs(v - R) < Math.abs(best - R)) best = v; } return best; };
  const toolCalc = (host, onClean) => {
    const { body } = CS.page(host, {
      title: 'Calculadoras de hardware', lead: 'Resistor de LED, divisor de tensão e ADC, timers/PWM do ATmega328P, acionamento de cargas por transistor e autonomia de bateria.',
      learn: `<p><b>LED:</b> R = (V<sub>cc</sub> − V<sub>f</sub>)/I<sub>f</sub>. Use o valor comercial imediatamente acima (série E12) e verifique a potência P = R·I².</p>
      <p><b>ADC:</b> resolução = V<sub>ref</sub>/2<sup>n</sup>. Um ADC de 10 bits com 5 V distingue ≈ 4,9 mV. Use divisor de tensão para medir tensões maiores que V<sub>ref</sub>.</p>
      <p><b>PWM por timer:</b> f = f<sub>clk</sub>/(N·(TOP+1)) no modo Fast PWM; a razão cíclica é OCR/(TOP+1).</p>
      <p><b>Transistor como chave:</b> o pino fornece poucos mA. Para relés, motores e fitas de LED use um NPN/MOSFET: I<sub>B</sub> ≥ I<sub>C</sub>/β<sub>sat</sub> (β<sub>sat</sub> ≈ 10–20). Em cargas indutivas, use o diodo de roda-livre!</p>
      <p><b>Bateria:</b> autonomia = capacidade/corrente média; a corrente média pondera o tempo ativo e o tempo em sono (deep sleep).</p>`,
    });
    onClean(K.sections(body, 'ecalc', [{ id: 'led', label: 'Resistor de LED', render: secLED }, { id: 'adc', label: 'Divisor e ADC', render: secADC }, { id: 'pwm', label: 'Timer / PWM', render: secTimer }, { id: 'tr', label: 'Transistor como chave', render: secTrans }, { id: 'bat', label: 'Bateria', render: secBat }]));
  };
  const LEDV = [['1.8', 'vermelho (1,8 V)'], ['2.1', 'amarelo (2,1 V)'], ['2.2', 'verde comum (2,2 V)'], ['3.1', 'verde/azul/branco (3,1 V)'], ['1.2', 'infravermelho (1,2 V)']];
  function secLED(area) {
    const f = K.form([{ k: 'Vcc', l: 'Tensão de alimentação', u: 'V', v: '5' }, { k: 'Vf', l: 'LED', type: 'sel', v: '1.8', opts: LEDV }, { k: 'If', l: 'Corrente desejada', u: 'mA', v: '15' }, { k: 'n', l: 'LEDs em série', u: '', v: '1' }], () => run(), { cols: 2 });
    const out = h('div'); area.append(CS.card('Resistor limitador', f.el, out));
    function run() {
      const Vf = parseFloat(f.st.Vf) * f.st.n, I = f.st.If / 1000, R = (f.st.Vcc - Vf) / I;
      out.innerHTML = '';
      if (R <= 0) { out.append(h('div', { class: 'bad' }, 'A tensão de alimentação não é suficiente para os LEDs em série.')); return; }
      const Rc = E.nearestE(R), Ir = (f.st.Vcc - Vf) / Rc, P = Ir * Ir * Rc;
      out.append(CS.kv([['R calculado', `${K.n(R)} Ω`], ['Valor comercial (E12)', `<b>${MS.fmt(Rc, 'Ω', 3)}</b>`], ['Corrente real', `${K.n(Ir * 1000)} mA`], ['Potência no resistor', `${K.n(P * 1000)} mW → ${P < 0.125 ? '1/8 W' : P < 0.25 ? '1/4 W' : P < 0.5 ? '1/2 W' : '1 W ou mais'}`], ['Pino do Arduino', Ir * 1000 <= 20 ? '<span class="good">OK (≤ 20 mA)</span>' : '<span class="warn">acima de 20 mA: use transistor</span>']]));
    }
    run();
  }
  function secADC(area) {
    const f = K.form([{ k: 'Vin', l: 'Tensão a medir (máx.)', u: 'V', v: '12' }, { k: 'R1', l: 'R1 (superior)', u: 'Ω', v: '10k' }, { k: 'R2', l: 'R2 (inferior)', u: 'Ω', v: '4.7k' }, { k: 'bits', l: 'Resolução do ADC', type: 'sel', v: '10', opts: [['10', '10 bits (Uno)'], ['12', '12 bits (ESP32, STM32)'], ['16', '16 bits (ADS1115)']] }, { k: 'Vref', l: 'Referência', u: 'V', v: '5' }], () => run(), { cols: 2 });
    const out = h('div'), cb = CS.chartBox('sm');
    area.append(h('div', { class: 'grid2' }, CS.card('Divisor de tensão + ADC', f.el, out), CS.card('Código digital × tensão de entrada (quantização)', cb)));
    const ch = new MS.Chart(cb, { xlabel: 'Vin [V]', ylabel: 'código', includeOrigin: true, readout: (x, y) => `${K.n(x)} V\ncódigo ${Math.round(y)}` });
    function run() {
      const { Vin, R1, R2, Vref } = f.st, n = +f.st.bits, k = R2 / (R1 + R2), Vout = Vin * k, N = 2 ** n, code = Math.min(N - 1, Math.floor(Vout / Vref * N));
      const vs = K.linspace(0, Vin * 1.1, 400);
      ch.set({ series: [{ x: vs, y: vs.map(v => Math.min(N - 1, Math.floor(v * k / Vref * N))), color: '#4fb3ff', width: 1.6 }], markers: [{ x: Vin, y: code, shape: 'dot', color: '#ffd166', size: 6 }] });
      out.innerHTML = '';
      out.append(CS.kv([['Fator do divisor', K.n(k)], ['Tensão no pino', Vout <= Vref ? `<span class="good">${K.n(Vout)} V ≤ ${Vref} V</span>` : `<span class="bad">${K.n(Vout)} V &gt; V<sub>ref</sub>: risco ao pino!</span>`], ['Leitura do ADC', `${code} de ${N - 1}`], ['Resolução no pino', `${K.n(Vref / N * 1000)} mV`], ['Resolução na entrada', `${K.n(Vref / N / k * 1000)} mV`], ['Corrente no divisor', `${K.n(Vin / (R1 + R2) * 1e6)} µA`], ['Conversão no código', `V = leitura × ${K.n(Vref / N / k, 5)}`]]));
    }
    run();
  }
  function secTimer(area) {
    const f = K.form([{ k: 'fclk', l: 'Clock da CPU', u: 'Hz', v: '16M' }, { k: 'fd', l: 'Frequência desejada', u: 'Hz', v: '20k' }, { k: 'duty', l: 'Razão cíclica', u: '%', v: '25' }, { k: 'tm', l: 'Timer', type: 'sel', v: '16', opts: [['8', 'Timer0/2 (8 bits)'], ['16', 'Timer1 (16 bits)']] }], () => run(), { cols: 2 });
    const out = h('div'), cvc = CS.card('Contador (rampa) e saída PWM');
    area.append(h('div', { class: 'grid2' }, CS.card('Fast PWM (ATmega328P)', f.el, out), cvc));
    const cv = K.canvas(cvc, 230, null);
    function run() {
      const max = f.st.tm === '16' ? 65535 : 255, pres = f.st.tm === '16' ? [1, 8, 64, 256, 1024] : [1, 8, 32, 64, 128, 256, 1024];
      let best = null;
      for (const N of pres) { const top = Math.round(f.st.fclk / (N * f.st.fd)) - 1; if (top < 1 || top > max) continue; const fr = f.st.fclk / (N * (top + 1)); if (!best || top > best.top) best = { N, top, fr }; }
      out.innerHTML = '';
      if (!best) { out.append(h('div', { class: 'bad' }, 'Frequência fora do alcance deste timer.')); return; }
      const ocr = Math.round(best.top * f.st.duty / 100);
      out.append(CS.kv([['Prescaler N', best.N], ['TOP (ICR1/OCR0A)', best.top], ['OCR (comparação)', ocr], ['Frequência obtida', `<b>${K.n(best.fr)} Hz</b> (erro ${K.n((best.fr / f.st.fd - 1) * 100, 3)} %)`], ['Resolução do PWM', `${K.n(Math.log2(best.top + 1), 3)} bits (${best.top + 1} níveis)`]]),
        h('pre', { class: 'small' }, f.st.tm === '16' ? `// Timer1, Fast PWM modo 14 (TOP = ICR1), saída OC1A (pino 9)\nTCCR1A = _BV(COM1A1) | _BV(WGM11);\nTCCR1B = _BV(WGM13) | _BV(WGM12) | ${({ 1: '_BV(CS10)', 8: '_BV(CS11)', 64: '_BV(CS11) | _BV(CS10)', 256: '_BV(CS12)', 1024: '_BV(CS12) | _BV(CS10)' })[best.N]};\nICR1 = ${best.top};\nOCR1A = ${ocr};` : `// Timer2, Fast PWM com TOP = OCR2A, saída OC2B (pino 3)\nOCR2A = ${best.top};\nOCR2B = ${ocr};`));
      cv.draw = (g, W, H) => {
        const L = 20, R = W - 10, per = 3, X = t => L + (R - L) * t / per, top = 30, mid = H * 0.55, lo = H - 20, d = ocr / (best.top + 1);
        g.strokeStyle = '#4fb3ff'; g.lineWidth = 2; g.beginPath(); for (let k = 0; k < per; k++) { g.moveTo(X(k), mid); g.lineTo(X(k + 1), top); g.lineTo(X(k + 1), mid); } g.stroke();
        g.strokeStyle = '#ffd166'; g.setLineDash([4, 3]); g.beginPath(); g.moveTo(L, mid - (mid - top) * d); g.lineTo(R, mid - (mid - top) * d); g.stroke(); g.setLineDash([]);
        g.strokeStyle = '#3ddc84'; g.beginPath(); for (let k = 0; k < per; k++) { g.moveTo(X(k), lo - 30); g.lineTo(X(k + d), lo - 30); g.lineTo(X(k + d), lo); g.lineTo(X(k + 1), lo); g.lineTo(X(k + 1), lo - 30); } g.stroke();
        g.fillStyle = '#c3d3e8'; g.font = '11px Barlow'; g.fillText('TCNT (0 → TOP)', L + 4, top - 8); g.fillStyle = '#ffd166'; g.fillText('OCR', R - 30, mid - (mid - top) * d - 4); g.fillStyle = '#3ddc84'; g.fillText('saída', L + 4, lo - 36);
      };
      cv.redraw();
    }
    run();
  }
  function secTrans(area) {
    const f = K.form([{ k: 'tipo', l: 'Chave', type: 'sel', v: 'npn', opts: [['npn', 'NPN (ex.: BC548, TIP120)'], ['mos', 'MOSFET nível lógico (ex.: IRLZ44N)']] }, { k: 'Vl', l: 'Tensão da carga', u: 'V', v: '12' }, { k: 'Il', l: 'Corrente da carga', u: 'A', v: '0.3' }, { k: 'Vio', l: 'Nível lógico do pino', u: 'V', v: '5' }, { k: 'beta', l: 'β de saturação forçado', u: '', v: '10' }, { k: 'rds', l: 'R<sub>DS(on)</sub> do MOSFET', u: 'Ω', v: '0.035' }, { k: 'ind', l: 'Carga', type: 'sel', v: '1', opts: [['1', 'indutiva (relé, motor, solenoide)'], ['0', 'resistiva (LED, aquecedor)']] }], () => run(), { cols: 2 });
    const out = h('div'); area.append(CS.card('Acionamento de carga por um pino', f.el, out));
    function run() {
      const s = f.st; out.innerHTML = '';
      if (s.tipo === 'npn') {
        const Ib = s.Il / s.beta, Rb = (s.Vio - 0.7) / Ib, Rbc = E.nearestE(Rb, false), P = s.Il * 0.2;
        out.append(CS.kv([['Corrente de base', `${K.n(Ib * 1000)} mA ${Ib > 0.02 ? '<span class="warn">(> 20 mA: use Darlington ou MOSFET)</span>' : ''}`], ['Resistor de base', `${K.n(Rb)} Ω → <b>${MS.fmt(Rbc, 'Ω', 3)}</b>`], ['Dissipação (V<sub>CE(sat)</sub> ≈ 0,2 V)', `${K.n(P * 1000)} mW`], s.ind === '1' ? ['Diodo de roda-livre', '<b>obrigatório</b>: 1N4007 em antiparalelo com a carga'] : null]));
      } else {
        const P = s.Il * s.Il * s.rds;
        out.append(CS.kv([['Gate', `resistor série ≈ 100–220 Ω + pull-down de 10 kΩ`], ['Nível lógico', s.Vio < 4.5 ? '<span class="warn">3,3 V: confirme R<sub>DS(on)</sub> com V<sub>GS</sub> = 2,5–3,3 V (MOSFET "logic level")</span>' : '<span class="good">5 V adequado para MOSFET de nível lógico</span>'], ['Dissipação I²·R<sub>DS(on)</sub>', `${K.n(P * 1000)} mW ${P > 1 ? '<span class="warn">(dissipador)</span>' : ''}`], s.ind === '1' ? ['Diodo de roda-livre', '<b>obrigatório</b> (ou diodo Schottky para PWM rápido)'] : null]));
      }
    }
    run();
  }
  function secBat(area) {
    const f = K.form([{ k: 'C', l: 'Capacidade da bateria', u: 'mAh', v: '2000' }, { k: 'Ia', l: 'Corrente ativa', u: 'mA', v: '80' }, { k: 'ta', l: 'Tempo ativo por ciclo', u: 's', v: '2' }, { k: 'Is', l: 'Corrente em sono', u: 'µA', v: '10' }, { k: 'per', l: 'Período do ciclo', u: 's', v: '300' }, { k: 'ef', l: 'Fator de aproveitamento', u: '', v: '0.8' }], () => run(), { cols: 2 });
    const out = h('div'), cb = CS.chartBox('sm');
    area.append(h('div', { class: 'grid2' }, CS.card('Sensor IoT a bateria (acorda, mede, transmite, dorme)', f.el, out), CS.card('Autonomia × período de transmissão', cb)));
    const ch = new MS.Chart(cb, { xlog: true, xlabel: 'período [s]', ylabel: 'autonomia [dias]', includeOrigin: true, readout: (x, y) => `${K.n(x)} s\n${K.n(y)} dias` });
    function run() {
      const s = f.st, avg = p => (s.Ia * s.ta + s.Is / 1000 * Math.max(0, p - s.ta)) / p, life = p => s.C * s.ef / avg(p) / 24;
      const ps = CS.logspace(Math.max(s.ta * 1.01, 1), 86400, 80);
      ch.set({ series: [{ x: ps, y: ps.map(life), color: '#3ddc84', width: 2 }], markers: [{ x: s.per, y: life(s.per), shape: 'dot', color: '#ffd166', size: 6 }] });
      out.innerHTML = '';
      out.append(CS.kv([['Corrente média', `${K.n(avg(s.per) * 1000)} µA`], ['Autonomia', `<b>${K.n(life(s.per))} dias</b> (${K.n(life(s.per) / 365, 3)} anos)`], ['Sempre ativo (sem sono)', `${K.n(s.C * s.ef / s.Ia, 3)} h`]]));
    }
    run();
  }

  CS.registerTab('emb', {
    title: 'Sistemas Embarcados',
    tools: [
      { id: 'ard', label: 'Simulador Arduino', desc: 'sketch, placa virtual, serial', render: toolArduino },
      { id: 'plat', label: 'Plataformas e pinagens', desc: 'Arduino, ESP32, Pico, STM32, RPi', render: toolPlat },
      { id: 'proto', label: 'Protocolos de comunicação', desc: 'UART, I²C, SPI, CAN', render: toolProto },
      { id: 'calc', label: 'Calculadoras de hardware', desc: 'LED, ADC, PWM, transistor, bateria', render: toolCalc },
    ],
  });
})();
