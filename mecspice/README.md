# MecSPICE — simulador multidomínio (elétrico + mecânico) estilo LTspice

Simulador de circuitos **elétricos, mecânicos rotacionais, mecânicos translacionais e eletromecânicos** num único esquemático, com análise transitória, visualizador de formas de onda e uma **bancada 3D animada** (Three.js). Evolução do simulador de controle de velocidade de motor DC do Grupo 8: o motor, o PI e o tacômetro agora são componentes que você liga como quiser.

![MecSPICE](docs/screenshot.png)

> Abra `index.html` no navegador (funciona offline, inclusive via `file://`). Não precisa de servidor nem de instalação.

## Recursos

- **Editor de esquemático** com grade, fios ortogonais, junções em T, rótulos de nó, girar/duplicar/excluir, seleção por caixa, desfazer/refazer, zoom e pan.
- **Solver MNA** (Modified Nodal Analysis), o mesmo princípio do SPICE, estendido para vários domínios:
  - integração **Trapezoidal** (padrão) ou **Euler implícito**, com passo fixo;
  - **Newton-Raphson** com limitação de junção para não lineares (diodo);
  - fatoração LU reaproveitada quando o circuito é linear (rápido: ~30 000 passos em ~0,2 s).
- **Formas de onda** em painéis por unidade, cursor com leitura, zoom por arrasto e exportação em CSV. Opção de unidades práticas (RPM, graus).
- **Ponta de prova** como no LTspice: clique num fio para ver V / ω / v, Shift+clique para θ / x e clique num componente para I / τ / F.
- **Bancada 3D**: eixos giram com θ(t), engrenagens engrenam, molas esticam e torcem, massas deslizam, amortecedores mostram o pistão, motores esquentam (emissivo) com a corrente, e a chave liga e desliga. A reprodução fica sincronizada com o cursor do gráfico.
- **Netlist textual**, salvar/abrir em JSON e salvamento automático no navegador.
- **8 exemplos**: controle PI de motor DC, motor em malha aberta, massa-mola-amortecedor, redutor com eixo flexível, pinhão-cremalheira, analogia RLC × massa-mola, RC e retificador.

## Abas de análise e projeto de controle

Além da simulação (aba principal), há três abas opcionais. Elas compartilham um mesmo sistema de controle, com **G(s)**, **H(s)** e **K** editáveis em qualquer uma delas, e **G(s) pode vir direto do esquemático**:

| Aba | Ferramentas |
|---|---|
| **ƒ Modelagem matemática** | Função de transferência (forma polinomial e fatorada, polos e zeros, tipo, ζ e ωn, respostas ao degrau, impulso e rampa, Mp, tr, ts) · Transformada de Laplace (tabela, propriedades, inversa por frações parciais inclusive com polos repetidos/complexos, valor inicial e final) · Diagrama de blocos ↔ grafo de fluxo de sinal com **regra de Mason** passo a passo (caminhos, laços, laços que não se tocam, Δ e Δk) · Espaço de estados (formas canônicas, G(s) ⇄ A,B,C,D, controlabilidade e observabilidade) · **Do esquemático → G(s)** |
| **⚖ Estabilidade** | Routh-Hurwitz (tabela, ε e linha nula, faixa de K estável, frequência de oscilação) · Lugar das raízes (assíntotas, separação, ângulos de partida, cruzamento com jω, linhas de ζ, K por clique, resposta em malha fechada) |
| **∿ Frequência** | Resposta em frequência (senoide de entrada × saída, transitório e regime) · Bode (exato e assintótico, margens de ganho e fase, largura de banda, Mr) · Nyquist (contorno com indentações, contagem de voltas, Z = N + P, compressão logarítmica) |

**Parte didática:** cada ferramenta tem um painel **📘 Entenda** recolhido por padrão, com a teoria resumida, fórmulas e simplificações. Cada componente do esquemático tem uma seção **📘 Sobre o componente**, com equação constitutiva, análogo nos outros domínios e uma dica prática. O botão ⓘ do visualizador explica os tipos de sinal e de gráfico.

**Esquemático → G(s):** monta a MNA em s (A(s)·X = b·U), avalia det A(s) e Y/U em pontos de um círculo e recupera os polinômios por DFT. Subcircuitos desacoplados são descartados e pares polo-zero coincidentes são cancelados. As simplificações aplicadas (linearização, superposição, CI nulas) são listadas junto ao resultado.

## Biblioteca de componentes

| Domínio | Componentes |
|---|---|
| Elétrico | Resistor, Capacitor, Indutor, Fonte de tensão, Fonte de corrente, Diodo, Chave temporizada, Terra |
| Rotacional | Inércia (volante), Mola torcional, Amortecedor rotacional, Fonte de torque, Fonte de vel. angular, Mancal fixo, Engrenagem/redutor |
| Translacional | Massa, Mola, Amortecedor, Fonte de força, Fonte de velocidade, Parede |
| Eletromecânico | Motor DC (Ra, La, K, J, B), Atuador linear de bobina móvel (Bl), Pinhão-cremalheira |
| Controle e sensores | Controlador PID (com saturação e anti-windup), Tacômetro (ω → V), Sensor de velocidade (v → V), Rótulo de nó |

Fontes aceitam as formas **DC, DEGRAU, SENO e PULSO**.

## Como funciona: a analogia força-corrente

Todo nó tem uma variável **"através"** (across) e todo ramo uma variável **"por"** (through):

| | Elétrico | Rotacional | Translacional |
|---|---|---|---|
| Nó (across) | V | ω | v |
| Ramo (through) | I | τ | F |
| Armazena energia cinética | C (ao terra) | J (ao referencial) | m (ao referencial) |
| Armazena energia potencial | L | mola: L = 1/k | mola: L = 1/k |
| Dissipa | R | amortecedor: R = 1/b | amortecedor: R = 1/b |

Os acoplamentos entram como **ramos extras** da matriz MNA:

- **Engrenagem** (transformador ideal): `ω_ent = n·ω_saí` e `τ_saí = n·τ_ent`. Com "inverte sentido = sim", n fica negativo, como num par externo.
- **Pinhão-cremalheira**: transformador com `n = 1/r`, ou seja, `v = r·ω` e `F = τ/r`.
- **Motor DC** (girador): `Va − Vb = Ra·i + La·di/dt + K·ω` e `τ = K·i`. A carcaça fica presa ao referencial.
- **Tacômetro / sensor**: fonte de tensão controlada `V = K·ω`, sem carregar o eixo.
- **PID**: controlador digital amostrado a cada passo, `u = Kp·e + ∫Ki·e dt + Kd·de/dt`, com saturação [Umin, Umax] e integração condicional.

Ângulos e posições (θ, x) vêm da integração trapezoidal das velocidades dos nós. São eles que movem a animação 3D.

## Arquitetura dos arquivos

```
mecspice/
├── index.html          interface
├── css/style.css       tema escuro
├── js/core.js          utilidades, prefixos SI, formas de onda, biblioteca de componentes (símbolos)
├── js/solver.js        netlist (conectividade), montagem MNA, LU, transitório, Newton
├── js/editor.js        editor de esquemático (canvas 2D)
├── js/plot.js          visualizador de formas de onda
├── js/view3d.js        bancada 3D (Three.js)
├── js/examples.js      exemplos prontos
├── js/app.js           integração da interface, arquivos, reprodução, atalhos, abas
├── js/info.js          textos didáticos dos componentes
├── js/ctrl/math.js     polinômios, raízes (Aberth), parser de G(s), frações parciais, espaço de estados, respostas
├── js/ctrl/extract.js  esquemático → G(s)
├── js/ctrl/chart.js    gráfico genérico (log, zoom, leitura)
├── js/ctrl/ui.js       sistema compartilhado (G, H, K), barra do sistema, páginas e painel "Entenda"
├── js/ctrl/blockdiag.js editor de diagrama de blocos, grafo de fluxo de sinal e regra de Mason
├── js/ctrl/tab-model.js aba Modelagem
├── js/ctrl/tab-stab.js  aba Estabilidade (Routh, lugar das raízes)
├── js/ctrl/tab-freq.js  aba Frequência (resposta em frequência, Bode, Nyquist)
└── vendor/three.min.js Three.js r149 (MIT), embutido para funcionar offline
```

### Para adicionar um componente novo

1. Em `core.js`, crie uma entrada em `MS.DEFS` com pinos `[x, y, domínio, nome]`, parâmetros e a função `draw`.
2. Em `solver.js`, dentro de `MS.buildCircuit`, traduza o componente em elementos primitivos (`G`, `C`, `L`, `V`, `I`, `D`, `XF`, `EMC`, `E`...) e declare as grandezas plotáveis com `Q(...)`.
3. Se quiser, em `view3d.js`, acrescente um `case` com a geometria 3D e a função de atualização.

## Atalhos

`W` fio · `R` girar · `P` ponta de prova · `G` terra · `Del` excluir · `Ctrl+D` duplicar · `Ctrl+Z / Ctrl+Y` desfazer/refazer · `F` enquadrar · `Ctrl+Enter` ou `F9` simular · `Espaço` play/pausa · `Ctrl+S / Ctrl+O` salvar/abrir.

Valores usam prefixos SPICE: `f p n u µ m k M meg G` (atenção: `m` = mili, `M`/`meg` = mega).

## Validação

O solver confere com as soluções analíticas:

- massa-mola-amortecedor (m = 1, k = 100, b = 2, F = 10 N): pico de 0,17292 m, contra 0,17292 m da fórmula `x∞·(1 + e^(−πζ/√(1−ζ²)))`;
- circuito RC: V(τ) = 3,151 V, contra o teórico 5·(1 − e⁻¹) = 3,161 V com passo de 10 µs;
- redutor 1:5 invertido: ω_saída = −ω_motor/5, exato;
- analogia: V(v_el) e v(v_mec) idênticos amostra a amostra;
- esquemático → G(s): massa-mola dá 1/(s² + 2s + 100), RC dá 1000/(s + 1000) e o circuito da analogia elétrica dá s/(s² + 2s + 100);
- K/(s(s+2)(s+4)): Routh e lugar das raízes dão K crítico = 48 e ω = 2,83 rad/s; com K = 10, Bode dá MG = 13,6 dB = 20·log(48/10) e MF = 47°;
- Nyquist de (s+2)/((s−1)(s+3)) com K = 4: P = 1, N = −1, Z = 0 (estável), conferido pelas raízes;
- Mason confere com a redução de blocos, inclusive com laços que não se tocam (Δ = 1 − (L1+L2) + L1·L2).
