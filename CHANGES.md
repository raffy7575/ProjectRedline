# Mudanças Implementadas (Atualizado)

## 3. Reorganização Modular para Expansibilidade 🏗️

**Commit:** `Organize physics modules into domain-specific subdirectories`

**Objetivo:** Estruturar o código físico em domínios especializados para facilitar expansão futura (novos pneus, aero dinâmica, combustível, dano, etc.).

### Estrutura de Diretórios Criada

```
js/
├── physics/
│   ├── tires/
│   │   ├── model.js              # Pacejka Magic Formula, slip angle, grip
│   │   └── index.js              # Re-exports
│   ├── aero/
│   │   ├── aerodynamics.js       # Downforce, drag, max speed
│   │   └── index.js              # Re-exports
│   ├── powertrain/
│   │   ├── transmission.js       # Gear ratios, RPM, torque, rev limiter
│   │   ├── gearbox.js            # Shift logic, upshift/downshift
│   │   └── index.js              # Re-exports
│   └── forces/
│       ├── longitudinal.js       # Acceleration, braking, speed integration
│       └── index.js              # Re-exports
├── race-physics.js               # Orchestrator principal
├── race-render.js
├── race.js
└── ...
```

### Funções Separadas por Domínio

#### **Tires (`physics/tires/model.js`)**
- `calculateSlipAndGrip()` - Cálculo de ângulo de slip e curva de grip Pacejka
- `detectSlidingAndLocking()` - Deteção de aquaplanagem e travamento de rodas
- `updateTireSlipAngle()` - Atualização do ângulo de slip

#### **Aerodynamics (`physics/aero/aerodynamics.js`)**
- `calculateAerodynamicContext()` - Downforce e carga aerodinâmica
- `calculateDragDeceleration()` - Desaceleração por arrasto
- `calculateMaxSpeedFromPower()` - Velocidade máxima teórica
- `getLoadSensitiveGrip()` - Grip sensível à carga (downforce + peso)

#### **Powertrain Transmission (`physics/powertrain/transmission.js`)**
- `getEffectiveGearRatio()` - Relação de marcha com modificadores
- `getShiftTimeForState()` - Duração do câmbio
- `calculateMechanicalEngineRpm()` - RPM mecânico das rodas
- `handleClutchSlipping()` - Física de embraiagem
- `handleRevLimiter()` - Limitador de rotação
- `applyEngineBrake()` - Travagem do motor
- `calculateTorqueDelivery()` - Entrega de torque do motor

#### **Gearbox Logic (`physics/powertrain/gearbox.js`)**
- `shouldUpshift()` - Decisão de cambiar para cima
- `shouldDownshiftCorner()` - Cambiar para baixo em curva
- `shouldDownshiftAccel()` - Cambiar para baixo em aceleração
- `updateRpmDuringShift()` - Sincronização RPM durante câmbio
- `syncRpmToWheels()` - Sincronização RPM pós-câmbio
- `getUpshiftThreshold()` - Limite de cambiar (contexto-dependente)

#### **Forces Longitudinal (`physics/forces/longitudinal.js`)**
- `applyLongitudinalForces()` - Integração completa de forças (aceleração, travagem, arrasto)
- `calculateWheelForceFromTorque()` - Conversão torque → força roda
- `applyBrakingForce()` - Aplicação de travagem
- `applyDragAndBraking()` - Arrasto e travagem do motor
- `clampSpeed()` - Limitador de velocidade mínima

### Refatoração de `js/race-physics.js`

**Antes:** Todas as funções inline em `race-physics.js`

**Depois:** Importação modular + chamadas através de funções especializadas

```javascript
// Exemplo: buildPhysicsContext() agora chama funções aero
let aeroContext = calculateAerodynamicContext(state, state.car, { speedMs });
let actualGrip = getLoadSensitiveGrip(baseGrip, aeroContext.aeroLoadFactor, terrainMult);

// Exemplo: applyDriverInputsAndSlip() agora chama módulo de pneus
let slipData = calculateSlipAndGrip(state, physics, currCurvature);
let tireData = detectSlidingAndLocking(state, physics, slipData, currCurvature);

// Exemplo: updateGearboxAndPreForceRpm() agora chama módulos de powertrain
if (shouldUpshift(state, physics, upshiftThreshold)) { /* ... */ }
if (shouldDownshiftCorner(state, physics, wheelRpmReal, ...)) { /* ... */ }
```

### Script Loading Order (index.html)

```html
<!-- Ordem de carregamento otimizada -->
<script src="data.js"></script>
<script src="js/state.js"></script>
<script src="save.js"></script>
<script src="js/utils.js"></script>
<script src="js/garage.js"></script>

<!-- Physics Domain Modules (em ordem de dependência) -->
<script src="js/physics/tires/model.js"></script>
<script src="js/physics/aero/aerodynamics.js"></script>
<script src="js/physics/powertrain/transmission.js"></script>
<script src="js/physics/powertrain/gearbox.js"></script>
<script src="js/physics/forces/longitudinal.js"></script>

<!-- Core Simulation & Rendering -->
<script src="js/race-physics.js"></script>
<script src="js/race-render.js"></script>
<script src="js/race.js"></script>
<script src="engine.js"></script>
```

### Benefícios para Expansibilidade

1. **Novos Pneus:** Implementar novo modelo em `tires/alternative-model.js` sem tocar resto
2. **Clima:** Adicionar `physics/weather/conditions.js` com multiplicadores de grip
3. **Combustível:** Criar `physics/fuel/consumption.js` com lógica de peso dinâmico
4. **Dano:** Adicionar `physics/damage/degradation.js` com perda de performance
5. **Suspensão:** Implementar `physics/suspension/tuning.js` para altura e rigidez
6. **IA Diferente:** Cada piloto pode ter seus próprios `computeTargetSpeedData()` customizado

### Validação

- ✅ Nenhum erro de sintaxe detectado
- ✅ Todas as funções transferidas mantêm assinatura original
- ✅ API externa de `race-physics.js` não muda
- ✅ Comportamento físico preservado (apenas reorganização de código)
- ✅ Script loading order sem dependências circulares

---

## 1. Botão Skip Simulation ⏭️

**Ficheiro:** `index.html` e `engine.js`


**Como funciona:**

**Implementação técnica:**
  - Remover limite de frame (`MAX_FRAME_DT`) durante skip
  - Multiplicar `dt` por `SKIP_SIM_SPEED`
  - Desativar renderização gráfica (sem `renderCars()`)
  - Manter atualização do leaderboard em tempo real


## 2. Background Execution (Jogo Continua em Background) 🔄

**Ficheiro:** `engine.js`


**Mudança:**
```javascript
// Antes:
if (rawDt < 0 || rawDt > MAX_FRAME_DT) { /* skip frame */ }

// Depois:
if (!isSkippingSimulation && (rawDt < 0 || rawDt > MAX_FRAME_DT)) { /* skip frame */ }
```



## Resumo das Constantes Adicionadas

```javascript
let isSkippingSimulation = false;        // Flag para rastrear estado
const SKIP_SIM_SPEED = 50.0;            // Multiplicador de velocidade (50x mais rápido)
```


## Como Usar

1. **Começar corrida:** Seleciona carro → clica "Enter Race"
2. **Pular corrida:** Clica botão "⏭️ Skip Simulation" (até 50x mais rápido)
3. **Continuar em background:** Muda de aba, o jogo segue a rodar
4. **Resultado:** Corrida termina assim que todos os carros completam


## Benefícios

✅ Corridas com carros fracos deixam de ser entediantes  
✅ Ganha tempo durante testes e farm de money  
✅ Jogo segue a correr mesmo sem estar em foco  
✅ Sem impacto na performance quando não está em skip
const SKIP_SIM_SPEED = 50.0;            // Multiplicador de velocidade (50x mais rápido)

---

## Refatoração de Arquitetura (10-03-2026)

### Estrutura modular atual
- data.js -> dados base
- save.js -> persistência
- js/state.js -> estado global e constantes
- js/utils.js -> utilitários
- js/garage.js -> UI de progressão (garagem/tuning/skills)
- js/race-physics.js -> física e evolução dos carros
- js/race-render.js -> render de pista/carros/leaderboard
- js/race.js -> loop principal e fluxo da corrida
- engine.js -> bootstrap

### O que cada função faz

#### save.js
- `cloneSkillsTemplate()` -> clona o template de skills.
- `sanitizePlayerName(name)` -> valida/normaliza nome do piloto.
- `askPlayerName(initialName)` -> modal assíncrono para recolher nome.
- `buildSavePayload()` -> cria objeto de save persistível.
- `saveGameState()` -> grava save em localStorage.
- `loadGameState()` -> restaura estado persistido e valida dados.
- `initializePersistentState()` -> inicia app a partir de save ou setup inicial.

#### js/utils.js
- `formatLapTime(seconds)` -> formata tempo para `MM:SS.cc`.

#### js/garage.js
- `completeInitialization()` -> inicialização visual principal após load.
- `openTab(tabId, btn)` -> troca de tabs da interface.
- `updateHUD()` -> atualiza nome e dinheiro no HUD.
- `getCarStats(car)` -> calcula stats finais com upgrades.
- `rollRandomTrack()` -> sorteia e apresenta evento/pista.
- `buildGarage()` -> desenha lista de carros e estado de compra.
- `buyCar(carId, price)` -> compra carro e atualiza estado.
- `generateStatHTML(label, totalVal, baseVal)` -> cria barras de stats.
- `selectCar(car)` -> define carro ativo do jogador.
- `buildTuningShop()` -> renderiza catálogo de upgrades.
- `buyUpgrade(itemId, cost)` -> compra e aplica upgrade.
- `buildSkillTree()` -> renderiza árvore de skills.
- `buySkill(skillKey)` -> compra nível de skill.

#### js/race-physics.js
- `createRaceEntry(car, isPlayer, trackTarmac, trackDirt)` -> estado inicial por carro na corrida.
- `buildRaceState()` -> monta toda a grelha (`raceState`).
- `generateTrackPath()` -> spline da pista + curvatura por ponto.
- `getGapToNextCarAhead(currentState)` -> gap para o próximo carro à frente.
- `updateVehicleState(state, dt, draftWindow)` -> passo de física por frame (grip, travagem, caixa, rpm, avanço).

#### js/race-render.js
- `renderTrack(ctx)` -> desenha pista e linha de meta.
- `renderCars(ctx)` -> desenha carros no canvas.
- `createLeaderboardRow(state, statusDisplay)` -> cria linha visual da classificação.
- `updateLiveUI(sortedRacers)` -> atualiza overlay e leaderboard ao vivo.

#### js/race.js
- `startSimulation()` -> inicia corrida e loop de animação.
- `gameLoop(currentTime)` -> coordena dt, física, render e fim de corrida.
- `endRace(sortedRacers)` -> fecha corrida e calcula prémio.
- `skipSimulation()` -> fast-forward síncrono.
- `showResetModal()` -> mostra modal de reset.
- `cancelReset()` -> fecha modal de reset.
- `confirmReset()` -> limpa save e reinicializa jogo.
- `resetGame()` -> prepara próximo evento após resultados.
