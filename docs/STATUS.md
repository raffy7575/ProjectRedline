# Project Redline — estado do upgrade e o que falta

Documento de passagem de testemunho. Atualizado no fim de cada bloco de trabalho.
Branch: `claude/serene-galileo-gqhx3u`.

## 1. Resumo do audit (versão que estava no `main`)

Medido a correr o jogo num browser headless e a física em Node, não só por leitura.

| # | Gravidade | Problema | Evidência |
|---|-----------|----------|-----------|
| 1 | Crítico | **O jogo está partido desde os commits de calibração da pista.** Todos os carros ficam presos no piso mínimo de velocidade (`state.speed = max(0.2, …)`), que depois da calibração de `METERS_PER_PROGRESS_STEP` equivale a 149 km/h constantes. | Em todas as pistas e carros: velocidade mín = máx = 149 km/h, cada volta demora exatamente 532 s, os três carros acabam com o mesmo tempo. |
| 2 | Crítico | Corrida de 5 voltas demora 44 minutos em tempo real e o resultado é um empate decidido pela ordem do array. | `finalTotalTime` = 2660 s para os três carros. |
| 3 | Crítico | O jogador não tem nenhuma decisão durante a corrida. Só existe o botão "Skip". | `js/race.js` |
| 4 | Alto | As 4 pistas usam todas o mesmo traçado (`setCustomTrackPath` ignora `currentTrack.waypoints`). | `js/race.js:29` |
| 5 | Alto | Imagem da pista aponta para `assets/serpent.png`, que não existe. O ficheiro real tem 8,9 MB, outro nome, e não é copiado para `dist/`. | `js/race-render.js:21` |
| 6 | Alto | `gameShop` não existe (devia ser `shopItems`): `ReferenceError` na inspeção técnica assim que o carro tem um upgrade. | `js/career.js:466` |
| 7 | Alto | Features dos tiers 3 e 4 (desgaste, rival intel, special offers) são inalcançáveis: só existem 2 ligas. | `FEATURE_REQUIREMENTS` vs `leagues` |
| 8 | Alto | Restrições `maxHp` não fazem nada: os upgrades nunca alteram `hp`. | `js/career.js`, `data.js` |
| 9 | Médio | Conteúdo: 3 carros, 4 eventos, 3 pilotos na grelha. Com $10 000 iniciais compram-se os 3 carros de imediato. | `data.js` |
| 10 | Médio | Os rivais são "todos os carros do catálogo que não são o do jogador": comprar um carro do dealer punha um carro de 1000 cv na liga amadora. | `buildRaceState()` |
| 11 | Médio | Skip usa `dt` de 0,83 s por passo: resultados diferentes dos da corrida em tempo real. | `SKIP_SIM_SPEED` |
| 12 | Médio | Repetir eventos paga o prémio inteiro sempre (farm infinito); os pontos só contam na primeira tentativa. | `endRace()`, `recordCareerRaceResult()` |
| 13 | Baixo | `updateLiveUI` recria o DOM do leaderboard a cada frame; `buildGarage`/`selectCar` chamam-se mutuamente; `ownedCount++` duplicado; `alert()` para feedback. | vários |
| 14 | Baixo | Sem testes, sem README, sem CI. O plugin Vite à medida existe só para contornar scripts globais. `fix_targetspeed.txt` e `CHANGES.md` são restos. | raiz do repo |

Conclusão: o núcleo de corrida não era recuperável com ajustes (unidades internas incoerentes, curvatura normalizada com constantes mágicas). Foi reescrito em unidades SI.

## 2. O que já está feito (em `src/`, ainda NÃO ligado ao `index.html`)

Verificado com simulações headless (tempos por volta plausíveis, ultrapassagens, erros, desgaste).

- `src/sim/track.js` — geometria real: spline, reamostragem a 2 m, curvatura em 1/m, zonas de terra, lista de curvas.
- `src/sim/vehicle.js` — ficha técnica → curva de binário, caixa, grip, travagem, aero, top speed.
- `src/sim/profile.js` — perfil de velocidade ideal (curva + travagem + motor) e tempo por volta.
- `src/sim/race.js` — corrida em passo fixo de 1/60 s: semáforos e arranque com tempo de reação, tráfego/ultrapassagens, cone de ar, nitro, desgaste de pneus, erros, modos de ritmo (Save/Race/Push), classificação. Skip dá o mesmo resultado que tempo real.
- `src/data/*` — 15 carros em 4 classes, 10 categorias de upgrades, 9 pistas distintas, 4 ligas × 4 eventos, 12 rivais com personalidade, 6 skills, 20 conquistas.
- `src/core/store.js` — estado único, save/load, migração do save antigo (`projectRedlineSaveV1`), export/import.
- `src/game/*` — Performance Index medido por simulação, garagem (comprar/vender/pintar/equipar/reparar), carreira (desbloqueios, classificação, qualificação, bounty, prémios, recordes), economia dos rivais, XP/níveis/conquistas, desafio diário, ofertas especiais rotativas.
- `public/img/serpent-city.webp` — o mapa da cidade comprimido de 8,9 MB para 0,4 MB.

## 3. O que falta

### Bloqueante (sem isto o jogo novo não corre no browser)
- [ ] **UI nova** em `src/ui/`: cabeçalho (dinheiro, nível, som, definições), ecrãs Career, Garage, Dealer, Tuning, Driver, modal de pré-corrida (grelha), ecrã de resultados, toasts.
- [ ] **Renderização da corrida** em `src/render/`: pista procedural por tema, carros desenhados, câmara de perseguição + minimapa, partículas, HUD (posição, volta, gaps, RPM, pneus, nitro, botões de ritmo, velocidade 1x/2x/4x, skip).
- [ ] **Input**: Espaço = arranque/nitro, 1/2/3 = ritmo, C = câmara; botões táteis equivalentes.
- [ ] Novo `index.html` + CSS; `src/main.js` como entrada real.
- [ ] Apagar o código antigo: `js/`, `data.js`, `save.js`, `engine.js`, `css/` antigo, `assets/*.png` (8,9 MB), `fix_targetspeed.txt`, `CHANGES.md`.
- [ ] Simplificar `vite.config.js` (remover plugin de scripts clássicos e `terser`), `base: './'`.

### Equilíbrio (medido, por corrigir)
- [ ] PI de série acima do teto da classe em alguns carros (Grip Master 305 e Kettle 301 > 300; Kaido RS 401 > 400): ajustar fichas ou tetos.
- [ ] Piloto automático do jogador com carro de série acaba em 7º–8º nas ligas C/B/A: os rivais chegam demasiado afinados. Reduzir orçamento inicial dos rivais e/ou `rivalSkill`.
- [ ] Colossus SRT e Zenith R são sempre últimos na sua classe: rever fichas.
- [ ] Duração das corridas A (até 385 s) é longa: reduzir voltas.
- [ ] Rivais acumulam dinheiro sem o gastar quando batem no teto de PI (Nyx com $82k): limitar ou ignorar.

### Qualidade
- [ ] Testes (`vitest`) para sim, carreira, save/migração, economia.
- [ ] Áudio (WebAudio): motor, semáforos, nitro, com botão de mute.
- [ ] `README.md` novo, CI (build + testes), `netlify.toml`.
- [ ] Verificação final com Playwright: carreira completa de ponta a ponta, screenshots.

## 4. Como retomar

```bash
npm ci
```

```bash
npm run dev
```

O jogo servido ainda é o antigo até a UI nova estar ligada. Os módulos novos testam-se em Node diretamente (são ES modules sem dependências de DOM, exceto `store.js`, que aceita storage falso via `setStorage`).
