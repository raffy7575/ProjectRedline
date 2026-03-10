# Mudanças Implementadas (Atualizado)

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
