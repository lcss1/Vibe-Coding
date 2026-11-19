/* ============================================================
   MecSPICE — Informações didáticas sobre cada componente
   eq: equação constitutiva · an: análogo nos outros domínios ·
   txt: explicação curta · tip: dica prática
   ============================================================ */
'use strict';
MS.INFO = {
  R: { eq: 'v = R·i', an: 'amortecedor (b = 1/R)', txt: 'Dissipa energia como calor (efeito Joule, P = R·i²). Não armazena energia: a resposta é instantânea.', tip: 'Em série com um capacitor forma um filtro passa-baixas com τ = RC.' },
  C: { eq: 'i = C·dv/dt', an: 'massa m · inércia J', txt: 'Armazena energia no campo elétrico (E = ½Cv²). A tensão não muda instantaneamente.', tip: 'Em Laplace: impedância 1/(sC). Em CC (s → 0), é um circuito aberto.' },
  L: { eq: 'v = L·di/dt', an: 'mola (L = 1/k)', txt: 'Armazena energia no campo magnético (E = ½Li²). A corrente não muda instantaneamente.', tip: 'Em Laplace: impedância sL. Em CC, é um curto-circuito.' },
  VS: { eq: 'v = v(t) imposta', an: 'fonte de velocidade', txt: 'Impõe a tensão entre seus terminais, seja qual for a corrente. Formas DC, degrau, seno e pulso.', tip: 'Duas fontes de tensão em paralelo, ou uma fonte em paralelo com um capacitor sem resistência, tornam o circuito singular.' },
  IS: { eq: 'i = i(t) imposta', an: 'fonte de força / torque', txt: 'Impõe a corrente, seja qual for a tensão. A seta indica o sentido (entra no pino +).', tip: 'Uma fonte de corrente em série com um indutor gera conflito: o sistema fica singular.' },
  D: { eq: 'i = Is·(e^(v/nVt) − 1)', an: '—', txt: 'Conduz em um sentido (do ânodo para o cátodo). É não linear e resolvido por Newton-Raphson a cada passo de tempo.', tip: 'Queda de cerca de 0,6–0,7 V quando conduz. Na extração de G(s), é linearizado (cortado).' },
  SW: { eq: 'R = Ron ou Roff', an: 'embreagem (ideia)', txt: 'Muda de resistência nos instantes programados. Útil para ligar/desligar cargas ou fontes.', tip: 'Chaveamentos bruscos com indutores geram picos de tensão. O método de Euler implícito amortece oscilações numéricas.' },
  GND: { eq: 'v = 0', an: 'parede · mancal fixo', txt: 'Referência de tensão. Todo circuito elétrico precisa de pelo menos um terra.', tip: '' },
  J: { eq: 'τ = J·dω/dt', an: 'capacitor ligado ao terra', txt: 'Volante/inércia: resiste a mudanças de velocidade angular e armazena energia cinética ½Jω².', tip: 'Inércia refletida por um redutor de relação n: J_eq = J/n² do lado rápido.' },
  KR: { eq: 'τ = k·Δθ', an: 'indutor (L = 1/k)', txt: 'Eixo flexível ou mola de torção: o torque é proporcional à torção entre as extremidades. Armazena ½kΔθ².', tip: 'Com inércias nas pontas cria ressonância torcional em ω ≈ √(k/J).' },
  BR: { eq: 'τ = b·Δω', an: 'resistor (R = 1/b)', txt: 'Atrito viscoso rotacional: o torque é proporcional à diferença de velocidades. Dissipa energia.', tip: 'Atrito de Coulomb (constante) não é linear e não está modelado aqui.' },
  TS: { eq: 'τ = τ(t) imposto', an: 'fonte de corrente', txt: 'Aplica um torque entre o eixo (+) e a referência. Valor negativo representa uma carga que freia.', tip: '' },
  WS: { eq: 'ω = ω(t) imposta', an: 'fonte de tensão', txt: 'Impõe a velocidade angular, como um motor ideal com controle perfeito.', tip: '' },
  RGND: { eq: 'ω = 0', an: 'terra elétrico', txt: 'Referência rotacional: carcaça ou mancal fixo ao chão.', tip: '' },
  GEAR: { eq: 'ω₁ = n·ω₂ · τ₂ = n·τ₁', an: 'transformador ideal', txt: 'Reduz a velocidade e multiplica o torque na mesma proporção, conservando a potência. Um par externo inverte o sentido de rotação.', tip: 'Do lado do motor, a carga aparece dividida por n² (inércia e atrito).' },
  M: { eq: 'F = m·dv/dt', an: 'capacitor ligado ao terra', txt: '2ª lei de Newton: a massa sempre se refere ao referencial inercial, por isso tem um terminal "implícito" no terra.', tip: 'Os dois pinos são o mesmo nó (ligue a mola de um lado e o amortecedor do outro, se quiser).' },
  K: { eq: 'F = k·Δx', an: 'indutor (L = 1/k)', txt: 'Lei de Hooke: força proporcional à deformação entre as extremidades. Armazena ½kΔx².', tip: 'Com uma massa: frequência natural ωn = √(k/m).' },
  B: { eq: 'F = b·Δv', an: 'resistor (R = 1/b)', txt: 'Amortecedor viscoso: força proporcional à velocidade relativa. É ele que faz as oscilações decaírem.', tip: 'ζ = b/(2√(km)). ζ < 1 oscila, ζ = 1 é crítico, ζ > 1 é superamortecido.' },
  FS: { eq: 'F = F(t) imposta', an: 'fonte de corrente', txt: 'Aplica uma força sobre o nó (+). Use valor negativo para uma força contrária, como o peso.', tip: '' },
  US: { eq: 'v = v(t) imposta', an: 'fonte de tensão', txt: 'Impõe a velocidade, como um atuador ideal com movimento prescrito.', tip: '' },
  TGND: { eq: 'v = 0', an: 'terra elétrico', txt: 'Parede ou base fixa: referência de velocidade e posição.', tip: '' },
  MOTOR: { eq: 'Va = Ra·i + La·di/dt + K·ω · τ = K·i', an: 'girador elétrico ↔ rotacional', txt: 'Converte energia elétrica em mecânica. A força contraeletromotriz K·ω cresce com a velocidade e limita a corrente.', tip: 'Velocidade a vazio ≈ V/K; corrente de partida ≈ V/Ra; constante mecânica τm = J·Ra/K².' },
  VCOIL: { eq: 'V = R·i + L·di/dt + Bl·v · F = Bl·i', an: 'girador elétrico ↔ translacional', txt: 'Bobina móvel num campo magnético (como um alto-falante): força proporcional à corrente.', tip: '' },
  RACK: { eq: 'v = r·ω · F = τ/r', an: 'transformador rot. ↔ trans.', txt: 'Converte rotação em translação. A massa m vista pelo motor equivale a uma inércia m·r².', tip: '' },
  PID: { eq: 'u = Kp·e + Ki∫e dt + Kd·de/dt', an: 'C(s) = Kp + Ki/s + Kd·s', txt: 'Controlador: e = ref − med. P reage ao erro atual, I elimina o erro em regime e D antecipa a tendência.', tip: 'Saída saturada em [Umin, Umax] com anti-windup. Ki alto tende a gerar sobressinal; Kd amplifica ruído.' },
  TACHO: { eq: 'V = K·ω', an: 'sensor', txt: 'Mede a velocidade angular e entrega uma tensão proporcional, sem carregar o eixo. Fecha a malha de controle.', tip: '' },
  VSENS: { eq: 'V = K·v', an: 'sensor', txt: 'Mede a velocidade linear e entrega uma tensão proporcional.', tip: '' },
  LABEL: { eq: '', an: '', txt: 'Dá nome a um nó. Rótulos com o mesmo nome estão conectados, mesmo sem fio entre eles.', tip: '' },
};
