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

## 2. O que foi feito

O jogo foi reconstruído em módulos ES sob `src/` e o código do protótipo foi removido.

**Núcleo de corrida (`src/sim/`)**, em unidades SI e passo fixo de 1/60 s:
- Geometria real das pistas (spline, amostras de 2 m, curvatura em 1/m, zonas de terra).
- Ficha técnica → curva de binário, caixa, grip, travagem, aero.
- Perfil de velocidade ideal por carro e pista (curva, travagem, motor).
- Corrida: semáforos e arranque com tempo de reação, tráfego e ultrapassagens, cone de ar, nitro, desgaste de pneus, erros de travagem, modos de ritmo. Skip e 4x dão o mesmo resultado que tempo real.

**Decisões do jogador durante a corrida:** arranque (Espaço ao apagar das luzes), nitro (segurar Espaço), ritmo Save/Race/Push (1/2/3), câmara (C), pausa (P), velocidade 1x/2x/4x, skip.

**Conteúdo:** 15 carros em 4 classes, 10 categorias de upgrades, 9 pistas distintas (mais versões invertidas), 4 ligas × 4 eventos com grelha de 8, 12 rivais com personalidade que compram peças, 6 skills, 20 conquistas, desafio diário com streak, ofertas especiais rotativas, recordes de volta.

**Sistemas:** Performance Index medido por simulação com teto por liga; XP e níveis; desgaste e manutenção (a partir da Semi-Pro); bounty por evento; prémio de repetição a 50%; classificação conta o melhor resultado por evento.

**Técnico:** save novo com migração do `projectRedlineSaveV1` (nome, dinheiro, carros iniciais e peças), export/import; 37 testes vitest; CI em GitHub Actions; build Vite sem plugins (bundle 107 kB, mapa da cidade de 8,9 MB → 0,4 MB); `netlify.toml`; layout responsivo; áudio sintetizado com mute.

**Verificado:** `npm test` (37/37), `npm run build`, e jogado num browser headless em desktop e iPhone: criação de perfil, compra, tuning, liga amadora, resultados, persistência após reload, sem erros de consola.

## 3. O que falta

### Não verificado nesta sessão
- [ ] **Som**: o código corre sem erros, mas ninguém o ouviu (browser headless). Rever volumes e timbre do motor.
- [ ] **Equilíbrio das ligas C, B e A com um humano a jogar.** Só foi medido com piloto automático: carro de série acaba em 3º–5º no primeiro evento de cada liga e desce para 6º–8º se não for afinado. Falta confirmar que tuning + jogo ativo chegam para ganhar, e que o grind entre ligas não é excessivo.
- [ ] Jogo em dispositivos táteis reais (o botão NITRO usa pointer events; testado só em emulação).
- [ ] Corrida completa em tempo real a 1x numa pista longa (testado com 4x + skip).

### Problemas conhecidos
- [ ] Dusty Ranger é o último em asfalto (7º–8º) e o Grip Master o último em terra: é intencional, mas o primeiro carro pode prender um jogador no evento 3 da liga D sem dinheiro para pneus de terra ($1 000). Há um aviso no cartão do evento; considerar garantir esse dinheiro ou emprestar pneus.
- [ ] Travões, aero, caixa e nitro quase não mexem no PI (+0 a +2), porque o circuito de referência é limitado pelo grip dos pneus de série. São melhorias "grátis" sob o teto. Decidir se é desejado.
- [ ] Zenith R é claramente o pior carro da classe A; Colossus SRT o pior da B. Estão mais baratos, mas rever.
- [ ] Sem colisões: os carros bloqueiam-se e ultrapassam por faixas, mas os desenhos podem sobrepor-se na grelha e em curvas apertadas.
- [ ] Carros iguais comprados duas vezes não se distinguem na garagem (falta nome ou número).

### Ideias para a seguir
- [ ] Multiplayer assíncrono: tabela global de recordes por pista e desafio diário partilhado (o seed já é igual para todos). Há Supabase ligado à conta, serviria de backend.
- [ ] Meteorologia (chuva muda o grip a meio da corrida) e paragens nas boxes em corridas longas.
- [ ] Patrocinadores com objetivos por corrida.
- [ ] Editor de pistas (as pistas são só listas de pontos).
- [ ] Mais ligas ou um modo "endurance" depois da Elite.

## 4. Como retomar

```bash
npm ci
```

```bash
npm run dev
```

```bash
npm test
```

Mapa do código e instruções para acrescentar carros, pistas e eventos estão no `README.md`.
