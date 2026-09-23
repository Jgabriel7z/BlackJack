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
    │   ├── engine/              rng.js, deck.js, rules.js, game.js (1.1) · ai.js (1.2) · trumps.js, score.js (Etapa 2)
    │   └── ui/                  main.js, render.js, parametros.js (1.3) · animacao.js, lampada.js, pixelart.js (1.4) · audio.js, effects.js, screens.js (depois)
    ├── tests/                   testador.js, engine.test.js, tests.html (browser), run-node.mjs (terminal)
    ├── tools/                   servidor.mjs (http local), capturar.mjs (prints + vídeo), simular.mjs (IA×IA para achar seeds), roteiros/N.M.mjs (um por sub-passo), arte/gerar_*.py (sprites)
    ├── node_modules/            (ignorado pelo git)
    └── data/                    trump_cards.json (copiado da raiz na Etapa 2)
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
| 1 — Guilhotina | Dedos = aposta; aposta +1 por rodada | Oponente perde os 5 dedos | Não | Compra até 17 |
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
| 2.1 | Pontuação | `score.js` no engine; visor na mesa | Testes das regras de pontos; visor atualiza a cada rodada |
| 2.2 | Trunfos básicos no motor | `trumps.js` lê `data/trump_cards.json`; implementa efeitos `bet_mod`, `draw_specific`, `return_last_faceup`, `destroy_last_trump`, `draw_best`, `set_target`. Cartas: One-Up, Two-Up, 2–7 Card, Remove, Return, Shield, Destroy, Perfect Draw, Go for 17/24/27 | Teste por carta: Two-Up soma 2 na aposta do oponente só enquanto na mesa; 5 Card não faz nada se o 5 já saiu; Go for 24 substitui Go for 17 |
| 2.3 | Trunfos na interface | Mão de trunfos do jogador embaixo, cartas jogadas ficam na mesa do lado de quem jogou, texto da carta ao passar o mouse; placa central mostra o alvo atual | Jogar cada carta e ver o efeito na mesa |
| 2.4 | Níveis 2 e 3 | Máquina de níveis; medidor de choque e trilho da serra desenhados; transição de nível com fala do Anfitrião na TV | Vencer nível 1 leva ao 2; perder em qualquer nível encerra |
| 2.5 | IA por nível | `ai.js` com três níveis de dificuldade | Nível 3 estoura menos que nível 1 em 100 rodadas simuladas (teste automático) |
| 2.6 | High score (opcional) | Maior pontuação da sessão mostrada na mesa (sem persistência ainda) | Bater o recorde atualiza o visor |

### Checklist de aceite da Etapa 2
- [ ] Pontos calculados e visíveis; testes passando
- [ ] Os três níveis jogáveis em sequência
- [ ] Pelo menos 14 trunfos funcionando e testados
- [ ] Dificuldade da IA perceptível entre níveis
- [ ] Etapa 1 continua funcionando (sem regressão)

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
| 3.1 | Máquina de estados | `screens.js` com os estados acima; jogo atual vira o estado JOGANDO | Transições funcionam; nenhum estado trava |
| 3.2 | Tela de título | TV de tubo ligando, título "21" com chiado, texto "pressione qualquer tecla"; lâmpada e mesa ao fundo escuras | Espera input; qualquer tecla ou clique inicia |
| 3.3 | GAME OVER | Tela preta, som abafado (quando houver som), texto "GAME OVER" seco em fonte bitmap, pontuação final; volta ao título | Aparece ao morrer em qualquer nível; volta sozinho |
| 3.4 | High scores (opcional) | Lista das 5 melhores da sessão, aparece no loop do título | Após 15 s parada, a lista aparece e volta |
| 3.5 | Attract mode (opcional) | IA joga contra IA com câmera passeando; qualquer input interrompe | Demonstração roda e sai com input |

### Checklist de aceite da Etapa 3
- [ ] Jogo começa no título, nunca direto na mesa
- [ ] "GAME OVER" visível e retorno automático ao título
- [ ] Loop título → attract → high scores → título sem input
- [ ] Vitória final (vencer o nível 3) também volta ao título, com a fala do Anfitrião sugerindo "outro jogo" (Parte B6)

---

## Etapa 4 — Extras (em ordem de prioridade)

Cada item é independente. Fazer na ordem abaixo; parar onde o tempo acabar.

| # | Extra | Seção da atividade | O que entregar | Como testar |
|---|-------|-------------------|----------------|-------------|
| 4.1 | Persistência | 6.1 | `localStorage` para high scores e desbloqueios (recompensas da tabela A5: Go for 24 após 5 vitórias, Shield+ etc.) | Fechar e reabrir o browser mantém recorde e cartas desbloqueadas |
| 4.2 | Som | 6.4 | `audio.js` com Web Audio **sintetizado** (sem arquivos): drone grave, zumbido da lâmpada, batimento que acelera com a aposta, papel da carta, guilhotina, taser, serra, silêncio total na revelação, abafamento após punição | Ouvir cada evento; mute funciona |
| 4.3 | Efeitos visuais | 6.5 | `effects.js`: granulado, vinheta, scanlines, aberração cromática leve, tremor; intensidade cresce com a aposta e a proximidade da morte; distorção da TV quando o Anfitrião fala. Referências do grupo em `REFERENCIAS.md` (PixiJS Filters, mgGlitch) como guia de implementação, não como dependência | Efeitos visíveis e mais fortes perto da morte; opção de desligar |
| 4.4 | Trunfos restantes e variantes de oponente | 6.6 | Cartas que faltam do `trump_cards.json` (Exchange, Trump Switch, Destroy+/++, Ultimate Draw, Harvest, Love Your Enemy) + cartas inimigas; variantes Arame Farpado, Mãos Ensanguentadas, Mofado, Marcas de Contagem, Morto-Vivo, Cabeção; modo **Sobrevivência** (5 oponentes seguidos) | Cada variante usa suas cartas; Sobrevivência termina no 5º oponente |
| 4.5 | Violência reduzida (baixa prioridade: o jogo já é sem sangue por decisão do grupo) | 6.2 / B7 | Opção no título: dedos "quebrados" em vez de cortados, serra vira bomba com corte para preto | Alternar a opção muda as animações |
| 4.6 | Tema visual | 6.2 | Segundo tema (ex.: "fita VHS" ou "hospital abandonado") trocável no título; fontes e paleta por tema | Trocar tema muda cores, fonte e ruído |
| 4.7 | Multiplayer local | 6.3 | Modo 2 jogadores no mesmo teclado; a carta oculta fica escondida até o dono pressionar "olhar" | Duas pessoas jogam; a carta oculta não vaza |
| 4.8 | Trapaça roteirizada do Anfitrião | 6.6 | No nível 3: jogador recebe Love Your Enemy no início; quando a serra está a 1 do oponente, Anfitrião joga Perfect Draw + Desperation; a luz muda e a TV grita | Sequência acontece no momento certo e é vencível com Love Your Enemy |

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
