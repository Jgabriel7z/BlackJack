# Plano de desenvolvimento — 21 (um jogo que decide se você vive ou não)

Plano incremental para a Atividade 02. Cada etapa gera uma versão **jogável e testável** antes de a próxima começar. Nenhuma etapa deve ser implementada de uma vez só: cada uma está quebrada em sub-passos, e cada sub-passo vira um prompt separado no Claude Code.

Fontes da verdade:
- Regras e cartas: `21_referencia_jogo.pdf` (Partes A, C e D) e `trump_cards.json`.
- Atmosfera: `21_referencia_jogo.pdf` (Parte B).
- Requisitos da atividade: `Agentes-Atividade02.pdf`.

---

## 0. Decisões de base (valem para todas as etapas)

| Decisão | Escolha | Motivo |
|---------|---------|--------|
| Plataforma | HTML + CSS + JavaScript puro (ES modules), Canvas 2D | Recomendação da atividade; roda no browser sem instalar nada; muito código JS no treinamento dos modelos |
| Build / dependências | Nenhuma. Servir a pasta com **Live Server** (VS Code) ou `python -m http.server 8080` | Sem instalar nada; código gerado fica fácil de ler. Atenção: o Chrome bloqueia módulos ES (`import`) em arquivos abertos por `file://`, por isso precisa de um servidor local simples |
| 3D (Three.js/Babylon) | **Não** por enquanto | O PDF de referência sugere, mas 3D multiplica o tamanho do código e dificulta analisar o que o agente gerou. A estética PS1/CRT será feita em 2D com filtros (granulado, vinheta, scanlines). Pode virar extra na Etapa 4 |
| Arquitetura | `src/engine/` = lógica pura (baralho, regras, trunfos, IA) **sem DOM**; `src/ui/` = desenho, animação, som; `index.html` na raiz | Permite testar as regras com testes automáticos antes de mexer no visual (sugestão C8 do PDF) |
| Testes | `tests/` com testes da lógica rodando no browser (página `tests.html`) ou Node | Cada sub-passo do motor tem teste; a interface é testada por checklist manual |
| Nomes dos personagens | Membros da equipe: **João Gabriel** (jogador), **Luiz Alberto** (oponente encapuzado), **Kaio** (anfitrião, a voz na TV) | Decisão do grupo no prompt 4. Clancy/Hoffman/Lucas pertencem à Capcom; nomes próprios evitam o problema. Definidos em `NOMES` no `game.js`, fácil de trocar a ordem |
| Violência | Permitida, **sem sangue**, em todo o jogo: dedos como marcas/contador, guilhotina com tremor e flash, sem gore. Tom mais tranquilo por ser trabalho acadêmico | Decisão do grupo no prompt 4. Terror vem do som e da espera, não do sangue (Parte B7). O extra 4.5 "violência reduzida" perde prioridade |
| Idioma da interface | Português | Público do trabalho |
| Versionamento | Iniciar repositório git na pasta e criar uma **tag por etapa** (`etapa-1`, `etapa-2`...) | A apresentação pede mostrar o resultado ao final de cada etapa |
| Aleatoriedade | Tudo que é aleatório usa `src/engine/rng.js` (mulberry32) com seed guardada em `jogo.seed` | Permite repetir a mesma partida para testar e reproduzir bugs |
| Configuração | Nomes dos personagens e outros ajustes do grupo ficam em `src/config.js` | Nenhum nome fixo espalhado pelo código |
| Evidências | Ao fechar cada sub-passo, rodar `node tools/capturar.mjs N.M` (Playwright + Chrome da máquina), que salva **prints e vídeo** em `progresso/etapa-N/N.M/` e falha se o console do navegador tiver erro; anotar em `progresso/LINHA_DO_TEMPO.md` | Material para a apresentação por etapa e para o relatório; a captura automática também funciona como teste de fumaça da interface |
| Regras do agente | Regras permanentes do projeto estão em `CLAUDE.md` na raiz, incluindo o fechamento obrigatório de cada sub-passo | Evita repetir instruções em todo prompt |

Estrutura de pastas prevista:

```
Andrei/                          <- documentos do relatório e referências
├── CLAUDE.md                    regras permanentes para o agente
├── PROMPTS_E_RESPOSTAS.md
├── PLANO_DE_DESENVOLVIMENTO.md
├── RELATORIO.md
├── progresso/                   LINHA_DO_TEMPO.md + prints e vídeos por sub-passo
├── 21_referencia_jogo.pdf, trump_cards.json, Agentes-Atividade02.pdf
└── Blackjack_21/                <- o jogo (código)
    ├── package.json             "type": "module", scripts e o Playwright (dev) para a captura; o jogo não usa nada disso
    ├── index.html               (Etapa 1.3) aceita ?seed=123 e ?rapido=1
    ├── src/
    │   ├── config.js            nomes dos personagens e ajustes do grupo
    │   ├── engine/              rng.js, deck.js, rules.js, game.js (1.1) · ai.js (1.2) · score.js (2.1), trumps.js (2.2), niveis.js (2.4)
    │   └── ui/                  main.js, render.js, parametros.js (1.3) · animacao.js, lampada.js, pixelart.js (1.4) · audio.js, effects.js, screens.js (depois)
    ├── tests/                   testador.js, engine.test.js, tests.html (browser), run-node.mjs (terminal)
    ├── tools/                   servidor.mjs (http local), capturar.mjs (prints + vídeo), simular.mjs (IA×IA para achar seeds), gerar_dados.mjs (JSON -> módulo), roteiros/N.M.mjs (um por sub-passo), arte/gerar_*.py (sprites)
    ├── node_modules/            (ignorado pelo git)
    └── data/                    trump_cards.js (gerado de ../trump_cards.json; a raiz continua sendo a fonte)
```

---

## Etapa 1 — Base do jogo

**Objetivo da atividade:** campo de jogo, elementos essenciais, controle do jogador, passagem do tempo, animações.

**Entrega:** uma partida completa contra a IA no modo **guilhotina** (História rodada 1). Sem cartas trunfo, sem pontuação, sem tela de abertura, sem som.

### Regras desta etapa
- Baralho: 11 cartas, valores 1 a 11, sem repetição, compartilhado.
- Cada jogador começa com 1 carta oculta (só o dono vê) + 1 carta aberta.
- Turno: **HIT** (comprar) ou **STAY** (passar). Dois STAY seguidos encerram a rodada.
- Alvo 21. Vence quem chegar mais perto sem passar; se os dois estourarem, vence o menor total; empate = os dois perdem.
- Aposta começa em 1 e sobe +1 para os dois a cada rodada.
- Perdedor perde dedos = aposta. Cada um tem 5 dedos. Partida termina quando alguém fica sem dedos.

### Decisões de regras tomadas onde o PDF é omisso (sub-passo 1.1)
- **O jogador sempre começa a rodada.** Mais simples e igual ao jogo original, onde o jogador age primeiro.
- **Estourar não encerra a rodada.** Quem passou de 21 continua podendo comprar ou passar; a rodada só termina com dois STAY seguidos, como no pseudocódigo C4. A IA e a interface devem tratar isso (quem estourou normalmente só passa).
- **Ordem da distribuição:** oculta do jogador, oculta do oponente, aberta do jogador, aberta do oponente.
- **Empate na guilhotina pune os dois** (C1, "Empate"). Se os dois zerarem os dedos na mesma rodada, `vencedorDoJogo` é `"ninguem"`.

### Sub-passos

| # | Sub-passo | O que entregar | Como testar |
|---|-----------|----------------|-------------|
| 1.1 ✅ | Motor de regras | `rng.js` (seed), `deck.js` (embaralhar, comprar), `rules.js` (total, estouro, vencedor), `game.js` (estado + ações hit/stay + fim de rodada + `verMesa`), `config.js` (nomes). Sem DOM | `tests.html` verde: baralho tem 11 cartas únicas; dois stays revelam; vencedor correto nos casos normal/estouro/duplo estouro/empate; dedos descontados; fim de partida; mesma seed reproduz a partida. **Feito em 2026-09-23: 40 testes passando** (`node tests/run-node.mjs`) |
| 1.2 ✅ | IA básica | `ai.js`: `decidirAcao(jogo, lado)` devolve `"hit"` se total (oculta + abertas) < 17, senão `"stay"`; baralho vazio → `"stay"`. Só decide; quem executa é quem chama, com `hit()`/`stay()` de `game.js` | Teste: com total 16 compra, com 17 passa; nunca compra com baralho vazio; 200 partidas IA×IA com seeds diferentes terminam sem travar. **Feito em 2026-09-23: 49 testes passando** |
| 1.3 ✅ | Mesa visual | `index.html` + `src/ui/{main,render,parametros}.js`: fundo quase preto, cone de luz da lâmpada, mesa de madeira, cartas do oponente em cima (oculta virada), do jogador embaixo (oculta com marca "oculta"), total do jogador, botões HIT/STAY/PRÓXIMA RODADA (HTML sobre o canvas), mão com 5 dedos de cada lado, fonte Courier New. `?seed=` e `?rapido=1` implementados; seed no rodapé | Abrir e jogar uma rodada com o mouse; carta oculta do oponente não pode ser lida (estado só em módulo, DOM expõe só `data-fase`); roteiro `tools/roteiros/1.3.mjs` captura mesa inicial, após HIT e resultado. **Feito em 2026-09-23: 53 testes passando, 3 prints + vídeo** |
| 1.4 ✅ | Tempo e animação | `src/ui/animacao.js` (fila de passos com tempo real, um só `requestAnimationFrame`), `lampada.js` (balanço com dois senos + piscar irregular sorteado com seed), `pixelart.js` + `sprites/mao.js` + `sprites/luiz.js` (gerados por `tools/arte/gerar_*.py` a partir das referências do grupo: mão do João algemada com corrente, arranhões e hematomas, dedos em camadas e tremor progressivo; Luiz Alberto de corpo inteiro com cabelo cacheado, olho esbranquiçado, camiseta rasgada, braços com veias e mão direita algemada como contador de dedos, em 6 quadros de cabeça). Candidatos anotados para etapas futuras, vindos da cena de referência: TV com chiado atrás do oponente e placares de sete segmentos com as apostas (Parte B2/B5). Carta sai do baralho desenhado à direita e desliza em arco virando no caminho; oponente encapuzado mexe a cabeça enquanto "pensa" 1–3 s; ao dois STAY a tela escurece, pausa, a oculta vira devagar e o resultado aparece. `?rapido=1` multiplica todas as durações por 0,05 | Ver as animações acontecerem; botões travados enquanto o oponente pensa; roteiro `1.4.mjs` sem `rapido` grava vídeo da rodada inteira e prints no meio do voo e da revelação. **Feito em 2026-09-23: 59 testes, 7 prints + vídeo** |
| 1.5 ✅ | Punição e fim | Ao perder, a lâmina desce sobre a mão do perdedor (vertical na do João, horizontal na do Luiz), tremor de tela + flash vermelho, os dedos somem no impacto (sem sangue), a lâmina sobe; no empate, um de cada vez. Aposta escrita junto de cada mão. Sem dedos: tela preta com texto seco ("Luiz Alberto não tem mais dedos." / "João Gabriel perdeu." / "Ninguém saiu desta mesa com dedos.") e botão JOGAR DE NOVO que recria a partida (mesma seed se veio da URL) | `tools/simular.mjs` acha seeds (IA×IA); roteiro `1.5.mjs` joga duas partidas inteiras (1617: João vence; 31: João perde), prints da guilhotina e da tela final de cada uma, e testa o reinício. **Feito em 2026-09-23: 59 testes, 5 prints + vídeo** |

### Checklist de aceite da Etapa 1 — concluída em 2026-09-23
- [x] Abre no browser via `node tools/servidor.mjs`, sem erro no console (a captura falha se houver)
- [x] Partida completa do início ao fim, vitória e derrota (roteiro 1.5, seeds 1617 e 31)
- [x] Regras de vencedor corretas (59 testes automáticos passando)
- [x] Oponente age sozinho após uma pausa de 1–3 s
- [x] Nada além do escopo (sem trunfos, sem pontos, sem menu)
- [x] Código separado em `engine/` e `ui/`; `engine/` não importa nada de DOM
- Evidências: `progresso/etapa-1/1.1` a `1.5`, mais `progresso/etapa-1/final/` (partida inteira com o visual final) e `progresso/etapa-1/RESUMO.md` para a apresentação. Tag git `etapa-1`.
- **Ajustes visuais na abertura da Etapa 2** (a pedido do grupo): a mão do João passou a sair da borda de baixo da tela (pulso algemado, dedos para o oponente, luz vinda da lâmpada, 7 tons com dithering); a guilhotina virou um aparelho de madeira preso na mesa (duas colunas, travessa, lâmina de aço com fio diagonal em repouso no alto), um em cada mão. **Pendência visual:** o grupo ainda considera o Luiz Alberto abaixo do esperado; o próximo passo é regenerá-lo em resolução dobrada (fator 2 no gerador) ou trocar por sprites PNG feitos/gerados pelo grupo, para os quais o jogo precisaria de um carregador de imagem.
- **Passe visual pós-1.5** (a pedido do grupo, com as referências de `REFERENCIAS.md`): `src/ui/cenario.js` (parede de tijolos, TV com chiado, cadeira, tampo de concreto com ladrilhos, placa "21", placares de sete segmentos com as apostas) e `src/ui/efeitos.js` (granulado, linhas de varredura, vinheta; `?efeitos=0` desliga). Isso adianta a Etapa 4.3 e os itens B2/B5 do PDF; o que sobra para a 4.3 é aberração cromática, tremor por tensão e a distorção da TV quando o Anfitrião falar.

### Prompt sugerido para começar a Etapa 1 (colar no Claude Code)

> Leia `PLANO_DE_DESENVOLVIMENTO.md` e a Parte C de `21_referencia_jogo.pdf`. Implemente **somente o sub-passo 1.1** (motor de regras do modo guilhotina) em `src/engine/`, sem nenhum código de interface, mais os testes em `tests/tests.html`. Não implemente cartas trunfo, pontuação, IA, tela de abertura ou som. Ao terminar, me mostre como rodar os testes e liste o que ficou de fora de propósito.

Depois, um prompt por sub-passo (1.2, 1.3...), sempre terminando com "não avance para o próximo sub-passo".

---

## Etapa 2 — Níveis e pontuação

**Objetivo da atividade:** cálculo de pontuação, terminar níveis e passar para níveis mais difíceis. Opcional: high score na tela.

**Entrega:** três níveis com punições diferentes, cartas trunfo básicas, pontuação visível na mesa.

### Níveis (mapeados dos modos do 21)

| Nível | Punição | Condição para avançar | Trunfos | IA |
|-------|---------|----------------------|---------|----|
| 1 — Guilhotina | Dedos = aposta; aposta +1 por rodada | Oponente perde os 5 dedos | Sim, 1 por rodada (o plano previa "não", mas o grupo pediu os trunfos jogáveis já no nível 1, no 2.3) | Compra até 17 |
| 2 — Choque | Medidor 0–10 sobe conforme a aposta; 10 = morte | Oponente chega a 10 | Sim, 2 no início + chance ao comprar | Compra até 17, usa trunfos simples (Shield quando aposta alta, Two-Up quando está na frente) |
| 3 — Serra | Trilho de 15 unidades; serra avança em direção ao perdedor | Serra chega no oponente | Sim, oponente com trunfos mais fortes | Calcula probabilidade de estourar com o baralho restante; guarda Destroy para cartas perigosas |

O jogador perde a partida (GAME OVER) se for ele quem chega ao limite do nível.

### Pontuação (proposta inicial, ajustável)
- +100 por rodada vencida
- +50 se terminou exatamente no alvo (21, 17, 24 ou 27)
- +25 se venceu com o oponente estourado
- +10 por trunfo usado
- Multiplicador de sequência: ×1, ×1,5, ×2 para 1, 2, 3+ rodadas seguidas
- +500 ao completar um nível
- Mostrada em um visor de sete segmentos velho ao lado do jogador (interface diegética, Parte B5)

### Sub-passos

| # | Sub-passo | O que entregar | Como testar |
|---|-----------|----------------|-------------|
| 2.1 ✅ | Pontuação | `src/engine/score.js`: `criarPontuacao`, `pontuarRodada(pontuacao, resultado, { alvo, trunfosUsados })`, `pontuarNivel`, `multiplicadorDaSequencia`. +100 vitória, +50 alvo exato, +25 oponente estourado, +10 por trunfo (parâmetro pronto), ×1/×1,5/×2 por sequência, +500 por nível (fora do multiplicador). Derrota e empate zeram a sequência. Visor velho de sete segmentos (6 dígitos, segmentos apagados visíveis) ao lado da mão do João; mensagem de resultado mostra "+N pontos ×M"; "sequência ×M" sob o visor; total na tela final | 12 testes de `score.js`; roteiro `2.1.mjs` (seed 41, duas vitórias com 21 exato): visor zerado, +150, depois +225 com ×1,5 = 375, conferido pelo roteiro. **Feito em 2026-09-23: 72 testes, 3 prints + vídeo** |
| 2.2 ✅ | Trunfos básicos no motor | `src/engine/trumps.js` **recebe** o catálogo pronto (`prepararCatalogo`), nunca lê arquivo. Efeitos `bet_mod`, `draw_trump`, `draw_specific`, `return_last_faceup`, `destroy_last_trump`, `draw_best`, `set_target`. 16 cartas: One-Up, Two-Up, 2–7 Card, Remove, Return, Shield, Destroy, Perfect Draw, Go for 17/24/27. Efeito persistente vira carta na mesa (Destroy tira). `apostaEfetiva` e `alvoAtual` no `game.js`. Números do C7 em `config.js` (`TRUNFOS`: 30% ao comprar, máximo 8 na mão, 1 inicial por rodada). `data/trump_cards.js` gerado de `../trump_cards.json` por `tools/gerar_dados.mjs` | 34 testes, um por carta mais bordas: Two-Up volta ao normal com Destroy; 5 Card não faz nada se o 5 saiu; Go for 24 substitui Go for 17; Shield não deixa a aposta negativa; Perfect Draw pega a menor quando todas estouram. **Feito em 2026-09-23: 106 testes, print do tests.html + vídeo** |
| 2.3 ✅ | Trunfos na interface | Mão do jogador embaixo (fundo escuro, moldura e símbolo trêmulos, desenhados à mão por carta); clique joga, a carta voa para a mesa e fica do lado de quem jogou (menor, empilhada); dica com nome e texto em português ao passar o mouse, na mão e na mesa; placa de papel com o alvo troca com "estalo" (tranco, número virando de lado, clarão) quando uma Go For entra. `?trunfos=a,b,c` fixa a mão inicial da 1ª rodada | Roteiro `2.3.mjs` (seed 41, mão fixa) joga Two-Up, Shield e Go for 24, com print de cada uma, da dica e do estalo; confere alvo 24 e as três cartas na mesa. **Feito em 2026-09-23: 107 testes, 6 prints + vídeo** |
| 2.4 ✅ | Níveis 2 e 3 | `src/engine/niveis.js`: config dos três aparelhos, `aplicarPunicaoDoNivel`, `estaMorto`, `prepararNivel`, `descreverMorte`. Fase nova `NIVEL_CONCLUIDO` + `avancarNivel` no `game.js`; aposta recomeça em 1 a cada nível. **Nível 2**: braçadeira de taser sobre cada mão, arco elétrico na descarga, medidor de ponteiro 0–10 com zona vermelha, flash branco e tremor; 2 trunfos iniciais; empate choca os dois. **Nível 3**: trilho de metal com 15 marcas riscadas entre os dois, serra circular grande girando, poeira ao andar, empate não mexe a serra, chegada corta para preto. Transição: tela escurece, a TV acende por cima do escurecimento e o Kaio fala duas frases como legenda. `?nivel=2` e `?nivel=3` começam direto | 18 testes em `niveis.test.js`; roteiro `2.4.mjs` (seed 21, que vence os três níveis): print de cada nível, de uma punição em cada e do Kaio falando, mais vídeo da troca. **Feito em 2026-09-23: 125 testes, 7 prints + vídeo de 1min47** |
| 2.5 ✅ | IA por nível | `ai.js` com uma cabeça por nível, comentada em português. **1**: conta até 17, sem trunfos. **2**: mesma conta, mais Shield quando a aposta dele passa de 3 e Two-Up quando está na frente. **3**: `decidirAcao` compara o risco de estourar (cartas que ela ainda não viu, a oculta do jogador incluída) com o risco de perder parado (supondo que o outro compra até 17); guarda o Destroy para quando o jogador põe carta perigosa na mesa e usa Go For quando o alvo novo salva a mão dela. `decidirAcao(jogo, lado, nivel)` aceita o nível na chamada, para comparar as duas cabeças sobre o mesmo baralho | 14 testes novos, incluindo 1000 rodadas nível 3 contra nível 1 com o mesmo baralho: **estouros 31,5% → 19,2%, vitórias 45,7% → 48,7%**. `tools/comparar_ia.mjs` imprime a tabela. **Feito em 2026-09-23: 138 testes, 4 prints + vídeo** |
| 2.6 ✅ | High score (opcional) | `criarRecorde`, `atualizarRecorde` e `registrarPartida` em `score.js`; o recorde vive fora de `novaPartida`, então atravessa o "jogar de novo" e some ao recarregar (guardar em disco é 4.1). Segundo visor de sete segmentos, menor, escrito RECORDE, ao lado do de PONTOS; pisca por 5 s e mostra "NOVO RECORDE" quando um recorde anterior é superado. Na primeira partida o visor só acompanha, sem piscar | 5 testes de recorde; roteiro `2.6.mjs` joga duas partidas seguidas sem recarregar (a 1ª comprando abaixo de 11, a 2ª com a regra da IA): 125 pontos → recorde batido em 313, com print do visor piscando. **Feito em 2026-09-23: 143 testes, 5 prints + vídeo** |

### Checklist de aceite da Etapa 2
- [x] Pontos calculados e visíveis; testes passando (12 testes de pontuação, visor de sete segmentos)
- [x] Os três níveis jogáveis em sequência, com troca de nível e fala do anfitrião
- [x] Pelo menos 14 trunfos funcionando e testados (16 cartas, 34 testes)
- [x] Dificuldade da IA perceptível entre níveis (medida: estouros 31,5% → 19,2%, vitórias 45,7% → 48,7%)
- [x] Etapa 1 continua funcionando (143 testes no total, os da Etapa 1 incluídos)
- [x] Opcional feito: recorde da sessão com visor próprio
- [x] Regressão do nível 1: a partida da Etapa 1 (seed 1617) termina igual, 3 rodadas e 2x0 (`progresso/etapa-2/regressao/`)
- Evidências: `progresso/etapa-2/2.1` a `2.6`, mais `final/` (partida pelos três níveis) e `RESUMO.md`. Tag git `etapa-2`.

---

## Etapa 3 — Tela de abertura e GAME OVER

**Objetivo da atividade:** tela inicial que espera interação; "GAME OVER" ao fim; volta para a abertura. Opcionais: tela de high scores, attract mode.

**Entrega:** loop completo de arcade.

### Máquina de estados

```
TITULO --(clique/tecla)--> JOGANDO --(morte)--> GAME_OVER --(3-5 s ou tecla)--> TITULO
  |                                                                              ^
  +--(15 s sem input)--> ATTRACT (IA vs IA) --(20 s)--> HIGH_SCORES --(8 s)------+
                              +---------- qualquer input ----------> TITULO
```

### Sub-passos

| # | Sub-passo | O que entregar | Como testar |
|---|-----------|----------------|-------------|
| 3.1 ✅ | Máquina de estados | `src/ui/telas.js` (puro, sem DOM): as cinco telas do diagrama, saídas por tempo e por interação, `fimDePartida` e aviso de troca. Tempos em `config.js` (`TEMPOS_DE_TELA`: título 15 s, attract 20 s, pontuações 8 s, fim de jogo 5 s), multiplicados pelo `?rapido`. O jogo que já existia virou a tela JOGANDO; título, attract e pontuações são texto provisório sobre a mesa escurecida. `?tela=jogando` pula a abertura, e os roteiros das Etapas 1 e 2 passaram a usar isso | 15 testes com relógio simulado, sem navegador: laço na ordem certa, nenhuma tela travando em 10 minutos, nenhuma passando do tempo dela, interação em cada tela. Roteiro `3.1.mjs` grava o laço sozinho e confere 3 voltas ao título. **Feito em 2026-09-23: 161 testes, 4 prints + vídeo** |
| 3.2 ✅ | Tela de título | A tela inteira acende como um tubo: linha branca fina abrindo na horizontal, imagem crescendo na vertical a partir do centro, chiado forte que vai sumindo, e então "21" com franja colorida de tela mal sintonizada, o subtítulo "um jogo que decide se você vive ou não" e "PRESSIONE QUALQUER TECLA" piscando devagar. Mesa e lâmpada quase apagadas ao fundo, linhas de varredura marcadas, nomes da equipe no rodapé. Tempos e subtítulo em `config.js` (`TITULO`), acelerados pelo `?rapido`. `body[data-titulo-fase]` expõe a fase do acendimento | Roteiro `3.2.mjs` em velocidade normal: print de cada fase do acendimento, dois do título pronto (convite aceso e apagado) e um depois da tecla, conferindo que a partida começa na rodada 1 e zerada. **Feito em 2026-09-23: 162 testes, 6 prints + vídeo** |
| 3.3 ✅ | GAME OVER | `src/ui/fonte-pixel.js`: alfabeto 5×7 desenhado com quadrados cheios, sem sombra nem antisserrilhado (A–Z, 0–9 e alguns sinais). Tela preta com "GAME OVER" em pixels cinza, a frase seca de como acabou, a pontuação e o recorde; volta ao título em 5 s ou com qualquer tecla. Substituiu a tela provisória do 1.5, e o botão "jogar de novo" saiu: o caminho é o título. **Vitória no nível 3**: em vez do GAME OVER, a televisão acende e o anfitrião fala duas frases sugerindo outro jogo (`FALA_DA_VITORIA` no config), com a sala voltando a aparecer atrás; depois vai direto ao título | Roteiro `3.3.mjs`: derrota no nível 1 (seed 31) com print do GAME OVER e a volta sozinha em 4,9 s; vitória começando no nível 3 (seed 44, achada com `simular.mjs --fiel`) com os prints das duas falas. **Feito em 2026-09-23: 162 testes, 5 prints + vídeo** |
| 3.4 ✅ | High scores (opcional) | `src/engine/placar.js` (puro): tabela de cinco lugares, empate resolvido pela ordem de chegada, pontuação zero fora, e a digitação das três letras (teclado, setas, Backspace, Enter) como estado testável. Nova tela `iniciais` entre o GAME OVER e a lista, só para quem entra no top 5 — nela as teclas são o nome, não um "pule a tela", e o `?rapido=1` não a encurta; passados 20 s vale o que estiver escrito, para nada travar. A tela de melhores pontuações virou definitiva: posição, iniciais, pontos e até onde a partida chegou, com a linha nova piscando e os lugares vazios em tracinhos. Vitória e derrota assinam pela mesma porta. Ainda sem salvar em disco (4.1) | Roteiro `3.4.mjs`: duas partidas na mesma página (seed 44 no nível 3), uma derrota e uma vitória, as iniciais digitadas nas duas, a tabela conferida em `data-placar` e um último print da lista voltando sozinha pelo laço do título. **Feito em 2026-09-23: 186 testes, 7 prints + vídeo** |
| 3.5 ✅ | Attract mode (opcional) | A vitrine reaproveita a mesa, as animações e o motor do jogo: os **dois lados** passam a ser a IA do nível 2 (o lado do jogador ganhou o espelho do que o oponente já fazia — pensar, jogar trunfo, comprar ou parar), a rodada seguinte vem sozinha e, no fim da partida, outra começa no lugar. A "câmera" passeia: zoom respirando entre 1,06 e 1,28 e o alvo deslizando, com o alcance do passeio saindo do próprio zoom para nunca mostrar fora da tela. Tarja `DEMONSTRAÇÃO` em cima e `PRESSIONE QUALQUER TECLA PARA JOGAR` piscando embaixo, as duas fora do passeio. Qualquer tecla ou clique devolve o título com a mesa limpa. Nada dali entra no recorde nem na lista. `?tela=attract` abre direto na vitrine | Roteiro `3.5.mjs` em velocidade normal: o título chama a demonstração sozinho em 15,2 s, três prints da câmera em pontos diferentes, e a prova de que a vitrine não suja nada — 100 pontos na mesa com o visor RECORDE em 0 e a lista vazia. Depois a tecla corta, o título volta e a partida de verdade começa zerada. **Feito em 2026-09-23: 186 testes, 7 prints + vídeo** |

### Checklist de aceite da Etapa 3 — verificado em 2026-09-23

- [x] **Jogo começa no título, nunca direto na mesa.** `criarTelas` começa em `TELA.TITULO` (teste "telas: o jogo começa no título"); o roteiro `3.final` abre `/index.html?seed=177` sem `?tela` e falha se não for o título. Prints `etapa-3/final/01` e `02`.
- [x] **"GAME OVER" visível e retorno automático ao título.** Prints `etapa-3/3.3/01-game-over.png` e `etapa-3/final/05`. Sem ninguém tocar em nada: 4,8 s medidos no 3.3 (o config manda 5 s). Testes do `telas.js` cobrem a saída por tempo e por tecla.
- [x] **Laço título → attract → melhores → título sem input.** O roteiro `3.1` observou três voltas e confere a ordem; o `3.final` registra o laço com o teclado largado (prints `08`, `09`, `10`). Testes: a ordem do laço e "nenhuma tela trava — em 10 minutos".
- [x] **Vitória final volta ao título, com o Anfitrião sugerindo "outro jogo".** Prints `etapa-3/3.3/03` e `04` com as duas frases de `FALA_DA_VITORIA`, e `05` com o título de volta sem passar pelo GAME OVER.

**Regressão:** a partida conhecida desde a Etapa 1 (seed 1617) continua dando 3 rodadas e 2×0 no nível 1 (`etapa-3/regressao/`), e a captura final da Etapa 2 rodada de novo deu os mesmos números (0 / 313 / 963 pontos, duas trocas de nível). A da Etapa 1 não reproduz mais a etapa dela desde a Etapa 2, como já estava registrado: o roteiro é histórico.

**Fechada em 2026-09-23 com 186 testes, tag `etapa-3`.** Resumo em `progresso/etapa-3/RESUMO.md`.

---

## Etapa 4 — Extras (em ordem de prioridade)

Cada item é independente. Fazer na ordem abaixo; parar onde o tempo acabar.

| # | Extra | Seção da atividade | O que entregar | Como testar |
|---|-------|-------------------|----------------|-------------|
| 4.1 ✅ | Persistência | 6.1 | `src/engine/progresso.js` (puro): as estatísticas da parte C3, as recompensas da A5 que funcionam com as cartas de hoje, e um `normalizar` que transforma qualquer coisa vinda de fora num progresso válido. `src/ui/armazenamento.js` é o **único** arquivo que toca em `localStorage`, com try/catch em toda operação: se falhar, o jogo segue na memória e o título avisa. Recorde, lista das cinco melhores, estatísticas e desbloqueios atravessam o recarregar. **Quatro recompensas**: Go For 24 (vencer 5 partidas), Go For 27 (3 alvos exatos seguidos) e duas de "uma carta trunfo a mais no começo da rodada" (3 alvos exatos no total; vencer tendo estourado). As duas cartas premiadas saem do sorteio até serem ganhas. No título, DEL apaga tudo, em dois tempos | 26 testes novos, incluindo um depósito de mentira que explode em toda operação. Roteiro `4.1.mjs`: partida, recarregar a página, conferir recorde/lista/desbloqueios/estatísticas, apagar pelo título e recarregar de novo. **Feito em 2026-09-23: 211 testes, 8 prints + vídeo** |
| 4.2 ✅ | Som | 6.4 | `src/ui/audio.js`, tudo sintetizado, sem um único arquivo de áudio. Dois barramentos (ambiente e foley) passando por um **abafador** passa-baixa até o mestre: na revelação o ambiente cala e fica só a carta virando; depois da punição o abafador fecha para tudo por 3,5 s, com um zumbido agudo de 3,7 kHz por fora dele (dentro do ouvido). Drone de três osciladores com respiração lenta, zumbido elétrico que sobe quando a lâmpada pisca, coração de 52 a 142 bpm conforme a aposta e a proximidade da morte, papel da carta, metal da lâmina, capacitor, descarga, motor da serra mais alto quanto mais perto, chiado da TV quando o Kaio fala. **M** liga e desliga (menos digitando as iniciais, onde M é letra). Só acorda depois de um gesto do usuário, e some sem quebrar nada se não houver Web Audio | 18 testes: as contas puras (bpm, perigo, abafamento) e um `AudioContext` de mentira que prova que o caminho do som monta inteiro e que nenhum efeito lança erro. Roteiro `4.2.mjs` confere a sequência `carta → silêncio → ambiente volta → lâmina → impacto` por `body[data-som]`. **O vídeo é mudo: o Playwright não grava áudio** — como gravar à mão está em `progresso/etapa-4/4.2/COMO-GRAVAR-COM-SOM.md`. **Feito em 2026-09-23: 229 testes, 6 prints + vídeo** |
| 4.3 ✅ | Efeitos visuais | 6.5 | `src/ui/efeitos.js` completado: granulado, linhas de varredura, vinheta, **separação de cores nas bordas** e **tremor constante**, todos crescendo com a tensão da cena; a imagem da TV **rasga em fatias** com barra de sincronismo enquanto o Kaio fala. A conta da tensão saiu para `src/ui/tensao.js` (puro), porque o som (4.2) e os efeitos usam a mesma: aposta pesa até 0,45 e a morte chegando até 0,75. **Desempenho**: a separação de cores é montada em 1/3 da resolução e esticada, o truque que o próprio PDF sugere — medido em **86 fps com e sem efeitos**. **E** liga e desliga, e a escolha fica salva com o resto do progresso (4.1) | 10 testes da tensão. Roteiro `4.3.mjs`: a mesma mesa com tensão 0,00 e 0,53 (montadas lado a lado em `comparacao-tensao.png`), a cena sem efeitos, o fps medido nos dois casos, e a TV distorcendo na troca de nível. **Feito em 2026-09-23: 239 testes, 6 prints + comparação + vídeo** |
| 4.4a ✅ | Trunfos restantes do jogador | 6.6 | As **11 cartas que faltavam** entraram: Two-Up+, Shield+, Exchange, Trump Switch, Trump Switch+, Destroy+, Destroy++, Perfect Draw+, Ultimate Draw, Harvest e Love Your Enemy. Cinco tipos de efeito novos no motor: `swap_last_faceup`, `discard_random_trumps` (com o gerador dos trunfos, então o descarte é reproduzível), `destroy_all_trumps`, `block_trumps` (o Destroy++ tranca os trunfos do oponente enquanto estiver na mesa) e `on_trump_use_draw_trump` (a Harvest paga as cartas jogadas depois dela, nunca a si mesma). Cada carta ganhou símbolo desenhado; as "+" reusam o símbolo da irmã menor com uma ou duas cruzinhas | 22 testes novos, um por carta mais os casos de borda (mão vazia, mesa vazia, só um lado com carta virada, descarte reproduzível). Roteiro `4.4a.mjs` fixa a mão com `?trunfos=` e joga Harvest, Exchange, Ultimate Draw e Destroy++ em sequência. **Feito em 2026-09-23: 262 testes, 6 prints + vídeo** |
| 4.4b | Variantes de oponente | 6.6 | Cartas inimigas e as versões do Luiz Alberto (arame farpado, mãos ensanguentadas, mofado, marcas de contagem, morto-vivo, cabeção), cada uma com visual próprio e sem sangue | Cada variante usa suas cartas |
| 4.4c | Modo Sobrevivência | 6.6 | 5 oponentes seguidos, aposta que não sobe, e o quinto é o mofado jogando Curse logo no começo | Sobrevivência termina no 5º oponente |
| 4.5 | Violência reduzida (baixa prioridade: o jogo já é sem sangue por decisão do grupo) | 6.2 / B7 | Opção no título: dedos "quebrados" em vez de cortados, serra vira bomba com corte para preto | Alternar a opção muda as animações |
| 4.6 | Tema visual | 6.2 | Segundo tema (ex.: "fita VHS" ou "hospital abandonado") trocável no título; fontes e paleta por tema | Trocar tema muda cores, fonte e ruído |
| 4.7 | Multiplayer local | 6.3 | Modo 2 jogadores no mesmo teclado; a carta oculta fica escondida até o dono pressionar "olhar" | Duas pessoas jogam; a carta oculta não vaza |
| 4.8 ✅ | Trapaça roteirizada do Anfitrião | 6.6 | `src/engine/trapaca.js` (puro): ao entrar no nível 3 o jogador recebe **Love Your Enemy**; quando a serra fica a **uma derrota** de encostar no Luiz Alberto (`serra + aposta dele >= 15`, conferido no começo de cada rodada), o Kaio joga **Perfect Draw** e **Desperation** por ele, sem esperar a vez. A Desperation exigiu dois efeitos novos: `bet_mod` com alvo `both` (as duas apostas sobem 100, então a próxima derrota mata) e `block_draw` (o jogador não pode mais comprar). A saída é o Love Your Enemy: obriga o Luiz a comprar mais uma carta e estoura a mão que o Perfect Draw fechou. Na tela a luz da sala vira vermelha, a TV rasga e grita, a música para | 14 testes, **os dois caminhos**: a trapaça armando e sendo virada, e a trapaça NÃO acontecendo quando o jogador mata o Luiz encarecendo a aposta dele dentro da rodada. Roteiro `4.8.mjs` em velocidade normal, seed 44 no nível 3: a trapaça arma na rodada 4 e a virada fecha em 1000 pontos. **Feito em 2026-09-23: 276 testes, 7 prints + vídeo** |

---

## Processo em cada sub-passo (repetir sempre)

1. **Colar o prompt** do sub-passo no Claude Code. As regras permanentes (escopo, código, fechamento) já estão em `CLAUDE.md`.
2. **Testar** com o checklist e os testes automáticos. Anotar o que quebrou.
3. **Fechamento pelo agente** (definido em `CLAUDE.md`): rodar testes, salvar prints/vídeo em `progresso/`, atualizar `progresso/LINHA_DO_TEMPO.md` e registrar o prompt em `PROMPTS_E_RESPOSTAS.md` com o campo "Impressões da equipe:" vazio.
4. **Ler o código gerado** (pelo menos os arquivos novos do engine) e preencher "Impressões da equipe:" e 2–3 linhas no `RELATORIO.md`, seção da etapa: ficou legível? entendemos? o que faríamos diferente?
5. Ao fechar uma etapa inteira: `git tag etapa-N` e juntar os prints/vídeos da pasta `progresso/etapa-N/` para a apresentação.

## Prompts de controle úteis

- "Antes de implementar, me diga em 5 linhas o que você vai mudar e em quais arquivos. Não escreva código ainda."
- "Implemente só X. Não toque em Y e Z."
- "Explique este trecho de código como para alguém que nunca viu JavaScript." (para o relatório sobre déficit de compreensão)
- "Rode os testes e me mostre a saída."
- "Liste o que você fez além do que pedi." (para detectar escopo extra)

---

## Números finais (2026-09-23)

Levantados com `find`/`wc` sobre o repositório, para o relatório.

### Linhas de código por pasta

| Pasta | Linhas | Arquivos | O que é |
|---|---:|---:|---|
| `Blackjack_21/src/engine/` | 1.911 | 11 | as regras, tudo puro e sem DOM |
| `Blackjack_21/src/ui/` | 5.485 | 13 | desenho, som, telas, efeitos, armazenamento |
| `Blackjack_21/src/ui/sprites/` | 1.385 | 2 | as grades de pixel art geradas pelo Python |
| `Blackjack_21/tests/` | 3.204 | 16 | os 276 testes |
| `Blackjack_21/tools/roteiros/` | 2.188 | 26 | um roteiro de captura por sub-passo |
| `Blackjack_21/tools/arte/` | 905 | 3 | geradores de pixel art (Python) |
| `Blackjack_21/tools/` | 673 | 6 | captura, servidor, simulador, comparador de IA |
| `Blackjack_21/data/` | 709 | 1 | o catálogo de cartas trunfo |
| HTML (`index.html`, `tests/tests.html`) | 213 | 2 | |
| **Total de código** | **16.673** | **80** | |

Documentos do relatório (`CLAUDE.md`, `PLANO_DE_DESENVOLVIMENTO.md`, `PROMPTS_E_RESPOSTAS.md`, `REFERENCIAS.md`, `RELATORIO.md`, `progresso/LINHA_DO_TEMPO.md`): **1.597 linhas**, fora os resumos de etapa.

### O resto

| | |
|---|---:|
| Testes automáticos | 276 |
| Prompts registrados | 29 |
| Commits | 4 (um por etapa) |
| Prints de evidência | 136 |
| Vídeos de captura | 24 |
| Sub-passos concluídos | 21 |
| Cartas trunfo implementadas | 27 das 27 do jogador |

A relação entre código de jogo (`src/`, 8.781 linhas) e código de apoio (testes e ferramentas, 6.970 linhas) ficou perto de 1,3 para 1 — quase tanto esforço em provar que funciona quanto em fazer funcionar.
