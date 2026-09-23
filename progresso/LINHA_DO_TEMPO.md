# Linha do tempo do projeto — 21

Uma entrada por sub-passo concluído. Prints e vídeos ficam em `progresso/etapa-N/sub-passo-N.M/`.

---

## 2026-09-22 — Fase 1: planejamento
- Criados `PROMPTS_E_RESPOSTAS.md`, `PLANO_DE_DESENVOLVIMENTO.md` e `RELATORIO.md`.
- Stack decidida: HTML + JavaScript puro + Canvas 2D, lógica separada da interface.
- Nenhum código ainda.
- Evidências: nenhuma (só documentos).

## 2026-09-23 — Etapa 1, sub-passo 1.1: motor de regras (guilhotina)
- Criados `Blackjack_21/src/engine/{deck,rules,game}.js`: baralho 1..11, soma/estouro/vencedor, rodada com hit/stay, punição em dedos, fim de jogo, `verMesa`.
- Criados testes: `tests/testador.js`, `tests/engine.test.js`, `tests/tests.html`, `tests/run-node.mjs`.
- Código movido para a pasta `Blackjack_21/` a pedido do grupo.
- Decisões de regra: jogador começa; estourar não encerra a rodada; ordem de distribuição oculta/oculta/aberta/aberta.
- Testes: 32/32 passando (`node tests/run-node.mjs`).
- Evidências: nenhuma visual (não há interface neste sub-passo).

## 2026-09-23 — Ajuste do 1.1: CLAUDE.md, config.js e RNG com seed
- Criado `CLAUDE.md` na raiz com as regras permanentes do projeto e o fechamento obrigatório de sub-passo.
- Nomes dos personagens movidos de `game.js` para `Blackjack_21/src/config.js`.
- Criado `Blackjack_21/src/engine/rng.js` (mulberry32). `deck.js` e `game.js` usam o gerador; `jogo.seed` guarda a seed da partida.
- 8 testes novos, incluindo "mesma seed reproduz a partida inteira".
- Plano atualizado com as decisões de regra e a política de prints/vídeos.
- Testes: 40/40 passando.
- Evidências em `progresso/etapa-1/1.1/`:
  - `01-testes.png`: página `tests.html`, 40/40 em verde (gerado pela ferramenta de captura).
  - `video.mp4`: gravação da abertura da página de testes (3,6 s, 1280x720).
  - `testes-node.txt`: saída completa de `node tests/run-node.mjs`.
  - `captura.txt`: resumo da captura.
  - Ainda sem tela do jogo: a interface só começa no sub-passo 1.3.

## 2026-09-23 — Ferramenta de captura automática (prints e vídeo)
- Criados `Blackjack_21/tools/servidor.mjs` (http local), `tools/capturar.mjs` (Playwright: abre o jogo, executa um roteiro, tira prints, grava vídeo, converte para mp4 com ffmpeg e falha se houver erro no console) e `tools/roteiros/1.1.mjs`.
- Playwright instalado como dependência de desenvolvimento; usa o Chrome da máquina. O jogo continua sem build.
- `.gitignore` na raiz ignora `node_modules/`; `progresso/` é versionada.
- `CLAUDE.md` ganhou a seção "Requisitos para a interface" (`?seed=`, `?rapido=1`, ícone vazio, console limpo, 1280x720) para o sub-passo 1.3.
- Primeira captura real: `node tools/capturar.mjs 1.1`, sem erros. Duas correções no caminho: ffmpeg do Playwright faltando e 404 do favicon detectado pela própria ferramenta.
- Testes: 40/40 passando (sem mudança no motor).

## 2026-09-23 — Etapa 1, sub-passo 1.2: IA básica
- Criado `Blackjack_21/src/engine/ai.js`: `decidirAcao(jogo, lado)` → `"hit"` se total < 17, senão `"stay"`; baralho vazio → `"stay"`. Só decide; não executa.
- Criado `tests/ai.test.js` (9 testes), incluindo 200 partidas IA contra IA com seeds 1..200 sem travar.
- Roteiro de captura `tools/roteiros/1.2.mjs` (reaproveita o do 1.1).
- Testes: 49/49 passando.
- Evidências em `progresso/etapa-1/1.2/`: `01-testes.png` (49/49 em verde), `video.mp4`, `captura.txt`, `testes-node.txt`.
- Ainda sem tela do jogo: próximo é o 1.3 (mesa visual).

## 2026-09-23 — Etapa 1, sub-passo 1.3: primeira tela (Canvas 2D)
- Criados `Blackjack_21/index.html`, `src/ui/main.js` (fluxo e botões), `src/ui/render.js` (desenho da mesa), `src/ui/parametros.js` (`?seed`, `?rapido`).
- Visual: quase preto, lâmpada com cone de luz amarelado, mesa de madeira em perspectiva, cartas com sombra, oculta do oponente virada, oculta do jogador marcada, total, mãos com dedos (perdidos ficam só contornados), botões em Courier New.
- IA joga imediatamente após o jogador; sem animação, sem guilhotina.
- Carta oculta do oponente não vai para o DOM nem para `window`.
- Roteiro `tools/roteiros/1.3.mjs`: seed 123, mesa inicial → HIT → STAY até acabar → resultado.
- Testes: 53/53 passando (4 novos, de `parametros.js`).
- Evidências em `progresso/etapa-1/1.3/`: `01-mesa-inicial.png`, `02-apos-hit.png`, `03-resultado-rodada.png`, `video.mp4`, `captura.txt`, `testes-node.txt`.
  - Aviso: os três prints foram regenerados durante o 1.4 (checagem de regressão) e mostram a mão em pixel art e a cabeça do oponente, que são do 1.4. Cartas e valores são os do 1.3. O `video.mp4` é o original do 1.3.
- Próximo: 1.4 (tempo e animação).

## 2026-09-23 — Etapa 1, sub-passo 1.4: dar vida à mesa
- Criados `src/ui/animacao.js` (fila de passos, um só `requestAnimationFrame`, durações × `fatorTempo`), `src/ui/lampada.js` (balanço irregular e piscar sorteado com seed), `src/ui/pixelart.js` (mão em pixel art da referência, dedos perdidos pontilhados).
- `render.js` e `main.js` reescritos para sprites animados: baralho na mesa, carta deslizando em arco e virando, oponente encapuzado mexendo a cabeça enquanto pensa (1–3 s, botões travados), revelação com escurecimento → pausa → giro lento da oculta → resultado.
- Correção no caminho: corrida entre clique e atributo `data-animacao`; botões agora travam na hora do clique.
- Testes: 59/59 passando (6 novos, do sequenciador).
- Evidências em `progresso/etapa-1/1.4/` (sem `?rapido`, ritmo real): `01-distribuindo-carta.png`, `02-mesa-pronta.png`, `03-carta-deslizando.png`, `04-oponente-pensando.png`, `05-escurecendo.png`, `06-revelando-oculta.png`, `07-resultado.png`, `video.mp4` (rodada inteira), `captura.txt`, `testes-node.txt`.

## 2026-09-23 — Ajuste do 1.4: mão detalhada, rosto macabro, mão pálida
- `pixelart.js` refeito: mão 23×24 px de sprite vista de cima, com unhas, nós, veias, suor e correia de couro no pulso; paletas `humana` (João) e `palida` (Luiz, cinza).
- Tremor irregular na mão do jogador, mais forte a cada dedo perdido. A do oponente não treme.
- Rosto do oponente em pixel art (pele cinza, olhos amarelados que brilham no escuro, sorriso largo com dentes, piscar raro) no lugar do saco.
- Luminária passa a ficar na frente do rosto; cone de luz atrás.
- Testes: 59/59 (sem mudança de lógica).
- Evidências: `progresso/etapa-1/1.4/` recapturada (mesmos 7 prints e vídeo, agora com o visual novo).

## 2026-09-23 — Ajuste do 1.4: sprites da referência do grupo (mão do João e Luiz Alberto inteiro)
- Criados geradores `tools/arte/gerar_mao.py` e `tools/arte/gerar_luiz.py` (Python + Pillow): forma por cápsulas/polígonos, sombreamento pela luz, detalhes pintados por cima, exportação para `src/ui/sprites/mao.js` e `src/ui/sprites/luiz.js` com preview PNG.
- Mão do João (64×36): dorso na mesa, dedos em garra com unhas, algema com corrente, arranhões, hematomas; dedos em camadas.
- Luiz Alberto (112×64): cabelo cacheado, rosto encovado com olho esbranquiçado, camiseta rasgada e manchada, braços com veias, mãos na mesa; 6 quadros de cabeça (3 inclinações × piscar); mão direita algemada é o contador de dedos.
- Mesa reorganizada: lâmpada à esquerda do oponente, cartas dele mais baixas, rótulo junto à mão dele.
- Testes: 59/59 (sem mudança de lógica).
- Evidências: `progresso/etapa-1/1.4/` recapturada.

## 2026-09-23 — Etapa 1, sub-passo 1.5: punição e fim de jogo (Etapa 1 concluída)
- Guilhotina como passos da fila: lâmina desce, impacto com tremor de tela e flash vermelho, dedos somem (sem sangue), lâmina sobe; no empate, um de cada vez.
- Aposta escrita junto de cada mão e anunciada no início da rodada.
- Fim de jogo: tela preta, texto seco ("Luiz Alberto não tem mais dedos." / "João Gabriel perdeu."), botão JOGAR DE NOVO que recria a partida.
- `tools/simular.mjs` (IA×IA) achou as seeds 1617 (João vence) e 31 (João perde), ambas em 3 rodadas.
- Roteiro `1.5.mjs` joga as duas partidas inteiras, fotografa guilhotina e tela final de cada uma e testa o reinício.
- Testes: 59/59.
- Evidências em `progresso/etapa-1/1.5/`: `01-guilhotina-joao-vence.png`, `02-fim-joao-vence.png`, `03-guilhotina-joao-perde.png`, `04-fim-joao-perde.png`, `05-reinicio.png`, `video.mp4` (duas partidas), `captura.txt`, `testes-node.txt`.
- Próximo: passe visual e fechamento formal.

## 2026-09-23 — Passe visual com as referências e fechamento da Etapa 1
- Novos `src/ui/cenario.js` (parede de tijolos, TV com chiado, cadeira, tampo de concreto com ladrilhos, placa "21", placares de sete segmentos) e `src/ui/efeitos.js` (granulado, linhas de varredura, vinheta; `?efeitos=0` desliga). Sem mudança de lógica.
- Bug pego pela captura: laço infinito nas linhas dos ladrilhos; corrigido.
- Checklist da Etapa 1 verificado item a item com provas; `src/engine/` sem DOM (grep vazio).
- Testes: 60/60.
- Evidências em `progresso/etapa-1/final/`: `01-mesa-rodada-1.png`, `02-oponente-pensando.png`, `03-revelacao.png`, `04-guilhotina.png`, `05-tela-final.png`, `video.mp4` (partida inteira, seed 1617), `captura.txt`, `testes-node.txt`. Resumo para a apresentação em `progresso/etapa-1/RESUMO.md`.
- Repositório git iniciado; commit e tag `etapa-1`.
- **Etapa 1 fechada.** Próximo: Etapa 2 (pontuação, trunfos, níveis), só quando o grupo pedir.

## 2026-09-23 — Etapa 2, sub-passo 2.1: pontuação (+ ajustes visuais)
- Visual: mão do João refeita saindo da borda de baixo (pulso algemado, dedos para cima, 7 tons com dithering); guilhotina virou aparelho de madeira com lâmina diagonal, um em cada mão.
- `src/engine/score.js` com as regras do plano (100 / +50 / +25 / +10 por trunfo / ×1, ×1,5, ×2 / +500 por nível) e 12 testes.
- Visor de sete segmentos de 6 dígitos ao lado da mão do João; mensagem mostra "+N pontos ×M".
- Testes: 72/72.
- Evidências em `progresso/etapa-2/2.1/`: `01-visor-zerado.png`, `02-primeira-vitoria.png` (+150), `03-segunda-vitoria-multiplicador.png` (+225 ×1,5 = 375), `video.mp4`, `captura.txt`, `testes-node.txt`.
- Pendência visual: Luiz Alberto em resolução maior (ou PNG do grupo).
- Próximo: 2.2 (trunfos básicos no motor).

## 2026-09-23 — Etapa 2, sub-passo 2.2: cartas trunfo (só lógica)
- `src/engine/trumps.js` com 16 cartas (One-Up, Two-Up, 2–7 Card, Remove, Return, Shield, Destroy, Perfect Draw, Go for 17/24/27). O catálogo chega pronto de fora; o motor nunca lê arquivo.
- Carta com efeito persistente fica na mesa do lado de quem jogou; Destroy a remove e a aposta volta ao normal.
- `game.js` ganhou `apostaEfetiva` (nunca negativa) e `alvoAtual`; trunfo inicial por rodada e 30% de chance ao comprar.
- Números do C7 (30%, máximo 8, 1 inicial) em `config.js`; `data/trump_cards.js` gerado de `../trump_cards.json` por `tools/gerar_dados.mjs`.
- Testes: 106/106 (34 novos, um por carta mais as bordas pedidas pelo grupo).
- Evidências em `progresso/etapa-2/2.2/`: `01-testes.png` (106/106 em verde), `video.mp4`, `captura.txt`, `testes-node.txt`.
- Sem tela de trunfos ainda: isso é o 2.3.
- Próximo: 2.3 (trunfos na interface).

## 2026-09-23 — Etapa 2, sub-passo 2.3: cartas trunfo na tela
- Mão de trunfos embaixo, com fundo escuro e símbolo desenhado à mão (traço trêmulo) diferente por carta; clique joga.
- A carta voa da mão para a mesa e fica do lado de quem jogou; passar o mouse mostra nome e texto em português.
- Placa do alvo troca com "estalo": tranco, número virando de lado e clarão, quando uma Go For entra.
- `?trunfos=two_up,shield,go_for_24` fixa a mão inicial, para a captura não depender de sorteio.
- Correção de layout vista nos prints: placa e cartas jogadas saíram de trás da coluna da guilhotina.
- Testes: 107/107.
- Evidências em `progresso/etapa-2/2.3/`: `01-mao-de-trunfos.png`, `02-dica-no-mouse.png`, `03-jogou-two-up.png`, `04-jogou-shield.png`, `05-estalo-da-placa.png`, `06-jogou-go-for-24.png`, `video.mp4`, `captura.txt`, `testes-node.txt`.
- Próximo: 2.4 (níveis 2 e 3: choque e serra).

## 2026-09-23 — Etapa 2, sub-passo 2.4: níveis 2 (choque) e 3 (serra)
- `src/engine/niveis.js` com os três aparelhos; `game.js` ganhou a fase `NIVEL_CONCLUIDO` e `avancarNivel`.
- Nível 2: braçadeira de taser sobre as mãos, arco elétrico na descarga, medidor de ponteiro 0–10, flash branco e tremor; 2 trunfos iniciais; empate choca os dois.
- Nível 3: trilho de metal com 15 marcas riscadas, serra circular grande girando; empate não mexe a serra; chegada corta para preto.
- Troca de nível: escurece, a TV acende por cima e o Kaio fala duas frases como legenda.
- `?nivel=2` e `?nivel=3` começam direto no aparelho.
- Correções: `perigo` declarado duas vezes travava a página; geradores de baralho e de trunfos separados (a mesma seed volta a dar o mesmo baralho, e a simulação prevê a partida real); roteiro passou a observar `data-animacao` em vez de supor a ordem dos passos. Número do canto de baixo das cartas vazava para fora; corrigido. Serra aumentada a pedido do grupo.
- Nova ferramenta: `tools/depurar.mjs`, que joga sozinho e imprime cada mudança de estado.
- Testes: 125/125 (18 novos de níveis).
- Evidências em `progresso/etapa-2/2.4/`: `01-nivel-2-choque.png`, `02-nivel-2-punicao.png`, `03-nivel-3-serra.png`, `04-nivel-3-punicao.png`, `05-nivel-1-guilhotina.png`, `06-kaio-falando.png`, `07-mesa-do-nivel-2.png`, `video.mp4` (1min47), `captura.txt`, `testes-node.txt`.
- Pendência: o grupo pediu sangue na serra, o que contraria a regra de violência sem sangue do projeto; aguarda confirmação.
- Próximo: 2.5 (IA por nível).

## 2026-09-23 — Etapa 2, sub-passo 2.5: IA diferente por nível
- `ai.js` reescrito com a ideia de cada nível comentada em português: nível 1 conta até 17; nível 2 soma Shield e Two-Up; nível 3 compara o risco de estourar com o risco de perder parado, guarda o Destroy e usa Go For quando o alvo novo ajuda.
- A IA só usa `verMesa`, então nunca enxerga a carta oculta do jogador.
- Na tela, o oponente joga uma carta trunfo antes de comprar ou parar.
- Números (1000 rodadas, mesmo baralho, só a cabeça do oponente muda): estouros 31,5% → 19,2%, vitórias 45,7% → 48,7%. Em `comparacao-ia.txt`.
- Iteração: a primeira versão estourava menos mas não ganhava mais; passou a ganhar ao prever que o adversário compra até 17.
- Textos clareados a pedido do grupo: cores mais vivas, sombra atrás de todo texto, vinheta e granulado mais fracos.
- Testes: 138/138 (14 novos de IA).
- Evidências em `progresso/etapa-2/2.5/`: `01-nivel-3-antes.png`, `02-joguei-two-up.png`, `03-luiz-jogando-trunfo.png`, `04-depois-do-trunfo-dele.png`, `video.mp4` (12 s), `comparacao-ia.txt`, `captura.txt`, `testes-node.txt`.
- Próximo: 2.6 (high score na tela, opcional) ou fechar a Etapa 2.

## 2026-09-23 — Etapa 2, sub-passo 2.6: recorde da sessão
- `score.js` ganhou `criarRecorde`, `atualizarRecorde` e `registrarPartida`; o recorde vive fora da partida e atravessa o "jogar de novo", mas some ao recarregar.
- Segundo visor de sete segmentos, menor, escrito RECORDE, ao lado do de PONTOS; pisca por 5 s com "NOVO RECORDE" quando um recorde anterior é superado. Na primeira partida só acompanha.
- Captura com duas partidas seguidas: a primeira jogando mal (125 pontos), a segunda com a regra da IA (313), com o visor piscando.
- Testes: 143/143 (5 novos de recorde).
- Evidências em `progresso/etapa-2/2.6/`: `01-visores-zerados.png`, `02-fim-da-partida-1.png`, `03-partida-2-comecando.png`, `04-visor-piscando.png`, `05-visor-piscando-outro-instante.png`, `video.mp4` (2min12), `captura.txt`, `testes-node.txt`.
- **Etapa 2 completa**: os seis sub-passos e o opcional. Falta a captura final da etapa e o `RESUMO.md` para fechar formalmente, quando o grupo pedir.

## 2026-09-23 — Fechamento da Etapa 2
- Checklist da Etapa 2 verificado item a item com prova.
- Regressão: a partida da Etapa 1 (seed 1617) termina igual, 3 rodadas e 2x0, em `progresso/etapa-2/regressao/`. A evidência original da Etapa 1 não foi tocada.
- Trunfos: 16 implementados, 16 com teste próprio (meta era 14).
- Ajuste pequeno para o vídeo: passos de animação podem levar `ritmoReal: true` e ignorar o `?rapido`; as trocas de nível usam isso.
- Testes: 144/144.
- Evidências em `progresso/etapa-2/final/`: 9 prints da partida pelos três níveis, `video.mp4` (44 s), `captura.txt`, `testes-node.txt`. Resumo da etapa em `progresso/etapa-2/RESUMO.md`.
- Commit e tag `etapa-2`.
- Próximo: Etapa 3 (tela de abertura, GAME OVER e retorno, attract mode e high scores como opcionais).

## 2026-09-23 — Etapa 3, sub-passo 3.1: o jogo organizado em telas
- `src/ui/telas.js`: máquina das cinco telas do diagrama (título, jogando, fim de jogo, attract, pontuações), sem DOM.
- Tempos em `config.js` e multiplicados pelo `?rapido`; 15 testes com relógio simulado, incluindo 10 minutos sem nenhuma tela travar.
- Título, attract e pontuações são texto provisório sobre a mesa escurecida; o fim de jogo usa a tela do 1.5 e agora volta ao título sozinho.
- O jogo passa a abrir no título: os 11 roteiros antigos ganharam `tela: 'jogando'`, e a regressão continua dando 3 rodadas e 2x0.
- Testes: 161/161.
- Evidências em `progresso/etapa-3/3.1/`: `01-tela-titulo.png`, `02-tela-attract.png`, `03-tela-high_scores.png`, `04-tela-jogando.png`, `video.mp4` (6 s, laço com 3 voltas), `captura.txt`, `testes-node.txt`.
- Próximo: 3.2 (tela de título com cara própria).

## 2026-09-23 — Etapa 3, sub-passo 3.2: a tela de título
- A tela inteira acende como uma televisão de tubo: linha branca abrindo, imagem crescendo na vertical, chiado sumindo, título se firmando.
- "21" com franja colorida, subtítulo "um jogo que decide se você vive ou não", convite piscando devagar, nomes da equipe no rodapé, mesa e lâmpada quase apagadas ao fundo.
- Corrigido um bug do 3.1: o relógio da primeira tela partia de zero em vez do primeiro quadro, encurtando a primeira espera.
- Chiado de tela cheia em resolução maior (320×180); a seed no rodapé só aparece com a mesa em jogo.
- Testes: 162/162.
- Evidências em `progresso/etapa-3/3.2/`: `01-tv-acendendo-linha.png`, `02-tv-acendendo-abrindo.png`, `03-tv-acendendo-surgindo.png`, `04-titulo-pronto.png`, `05-titulo-convite-no-outro-tempo.png`, `06-depois-da-tecla.png`, `video.mp4` (10 s), `captura.txt`, `testes-node.txt`.
- Próximo: 3.3 (tela de GAME OVER).

## 2026-09-23 — Etapa 3, sub-passo 3.3: a tela de GAME OVER
- Novo `src/ui/fonte-pixel.js` com alfabeto 5×7 desenhado com quadrados cheios, sem sombra nem suavização.
- Tela preta com "GAME OVER" em pixels, a frase de como acabou, a pontuação e o recorde; volta ao título em 5 s ou com qualquer tecla. Substituiu a tela provisória do 1.5; o botão "jogar de novo" saiu.
- Vitória no nível 3 não passa pelo GAME OVER: a televisão acende e o anfitrião fala duas frases sugerindo outro jogo, e então o jogo volta ao título.
- `tools/simular.mjs` ganhou o modo `--fiel`, que imita o que os roteiros fazem na interface; foi assim que se achou a seed 44 (vitória começando no nível 3).
- Os roteiros `1.5`, `1.final` e `2.6` passaram a recomeçar pelo título, sem o botão removido. O `1.final` ficou marcado como histórico: desde a Etapa 2 ele atravessa os três níveis e não reproduz mais a Etapa 1.
- Testes: 162/162.
- Evidências em `progresso/etapa-3/3.3/`: `01-game-over.png`, `02-voltou-ao-titulo.png`, `03-anfitriao-na-tv.png`, `04-anfitriao-segunda-fala.png`, `05-titulo-depois-da-vitoria.png`, `video.mp4` (2min10), `captura.txt`, `testes-node.txt`.
- Próximo: 3.4 (tela de melhores pontuações, opcional).

## 2026-09-23 — Etapa 3, sub-passo 3.4: as cinco melhores da sessão
- Novo `src/engine/placar.js`, lógica pura: tabela de cinco lugares, desempate pela ordem de chegada (quem empata entra abaixo), pontuação zero não entra, e a digitação das três letras como máquina de estados (letras do teclado, setas, Backspace, Enter).
- Nova tela `iniciais` na máquina de telas, entre o GAME OVER e as melhores pontuações, e só quando a pontuação entra na lista. Ela não sai com "qualquer tecla" (ali as teclas são o nome) e não é encurtada pelo `?rapido=1`; 20 s sem ninguém digitar valem o que estiver escrito, para a máquina nunca travar.
- A tela de melhores pontuações deixou de ser provisória: cinco linhas com posição, iniciais, pontos e até onde a partida chegou, a linha recém-gravada piscando, lugares vazios com tracinhos.
- Vitória e derrota levam à mesma tela de assinar; a sala só reaparece quando o jogo volta ao título, então GAME OVER → iniciais → melhores acontece todo no escuro.
- A fonte de pixels passou a arredondar as coordenadas: em escala grande as letras caíam em meio pixel e ficavam com costuras por dentro.
- Testes: 186/186 (21 novos: 17 do placar e 7 da nova tela, menos os que já existiam).
- Evidências em `progresso/etapa-3/3.4/`: `01-iniciais-em-branco.png`, `02-iniciais-digitadas.png`, `03-tabela-com-uma-linha.png`, `04-iniciais-lembram-a-partida-anterior.png`, `05-tabela-com-as-duas.png`, `06-tabela-linha-nova-piscando.png`, `07-tabela-de-volta-pelo-laco.png`, `video.mp4` (42 s), `captura.txt`, `testes-node.txt`.
- Próximo: 3.5 (attract mode, opcional).

## 2026-09-23 — Etapa 3, sub-passo 3.5: a demonstração (attract mode)
- A vitrine usa a mesa, as animações e o motor da partida de verdade: o que muda é que os **dois lados** são a IA do nível 2, e o lado do jogador ganhou o espelho do que o oponente já tinha (pensar, jogar trunfo, comprar ou parar).
- A "câmera" passeia: o zoom respira entre 1,06 e 1,28 e o alvo desliza, com os períodos escolhidos para o movimento demorar a repetir. O quanto ela pode deslizar sai do próprio zoom, então o passeio nunca mostra fora da tela.
- Selo `DEMONSTRAÇÃO` numa tarja em cima e `PRESSIONE QUALQUER TECLA PARA JOGAR` piscando numa tarja embaixo; os dois ficam fora do passeio, parados como a tarja de um vídeo.
- Nada da demonstração encosta no recorde nem na lista das melhores; a captura prova isso com a vitrine marcando 100 pontos enquanto o visor RECORDE segue em 0 e a lista, vazia.
- Qualquer tecla ou clique devolve o título, com a mesa já limpa. `?tela=attract` abre direto na vitrine. As telas provisórias do 3.1 acabaram: todas as cinco são de verdade agora.
- Na vitrine a mesa deixou de falar em segunda pessoa ("Você venceu" virou "João Gabriel venceu"), porque ali não há um "você".
- Testes: 186/186.
- Evidências em `progresso/etapa-3/3.5/`: `01-demonstracao-comeco.png`, `02-demonstracao-camera-em-outro-ponto.png`, `03-demonstracao-pontuando.png`, `04-a-tecla-cortou-a-demonstracao.png`, `05-titulo-de-volta.png`, `06-partida-de-verdade-depois-da-demonstracao.png`, `07-atalho-tela-attract.png`, `video.mp4` (1min), `captura.txt`, `testes-node.txt`.
- Próximo: fechamento da Etapa 3 (roteiro `3.final`, `3.regressao`, `RESUMO.md`, commit e tag `etapa-3`), quando o grupo pedir.

## 2026-09-23 — Etapa 3 fechada
- Checklist de aceite verificado item a item, cada um com print e teste apontados: abre no título, GAME OVER com volta automática, laço fechando sozinho e vitória final com a despedida do anfitrião.
- Captura final do **ciclo completo** (roteiro `3.final`, seed 177, velocidade normal, sem `?rapido` e sem `?tela`): título acendendo → partida → GAME OVER → três letras → melhores pontuações → título → demonstração → melhores → título. Depois de digitar as iniciais o roteiro larga o teclado: o resto acontece sozinho.
- Regressão (`3.regressao`): a partida conhecida desde a Etapa 1 (seed 1617) continua dando 3 rodadas e dedos 2×0 no nível 1.
- Capturas finais das Etapas 1 e 2 rodadas de novo, com `--sem-video`, e as evidências originais restauradas pelo git em seguida. A da Etapa 2 deu números idênticos (0 / 313 / 963 pontos, duas trocas). A da Etapa 1 continua sendo histórica: desde a Etapa 2 a partida atravessa três níveis.
- Testes: 186/186.
- Evidências em `progresso/etapa-3/`: `final/` (10 prints + `video.mp4` de 2min18), `regressao/` (3 prints) e `RESUMO.md`.
- Commit e tag `etapa-3`.
- Próximo: Etapa 4, começando pelo 4.1 (persistência), quando o grupo pedir.

## 2026-09-23 — Etapa 4, sub-passo 4.1: o que sobrevive a fechar o jogo
- Novo `src/engine/progresso.js`, puro: estatísticas da parte C3 do PDF, as recompensas da tabela A5 que funcionam com as cartas de hoje, e um `normalizar` que aceita qualquer coisa vinda de fora sem quebrar.
- Novo `src/ui/armazenamento.js`, o único arquivo do projeto que toca em `localStorage`. Toda operação dentro de try/catch: com o depósito quebrado o jogo continua na memória e o título avisa em vermelho.
- Recorde, lista das cinco melhores, estatísticas e desbloqueios passaram a atravessar o recarregar da página. O `recorde` e o `placar` viraram os mesmos objetos que já viviam em `score.js` e `placar.js`, sem duplicata.
- Quatro recompensas da A5: Go For 24, Go For 27 e duas de "uma carta trunfo a mais no começo da rodada". As duas cartas premiadas **saem do sorteio** até serem ganhas — continuam no catálogo, então o `?trunfos=` ainda as força numa captura.
- No título, DEL apaga tudo, em dois tempos: a primeira vez pergunta, a segunda apaga. Qualquer outra tecla desiste, e a pergunta não começa a partida.
- Testes: 211/211 (26 novos, incluindo um depósito de mentira que explode em toda operação).
- Evidências em `progresso/etapa-4/4.1/`: 8 prints, `video.mp4` (40 s), `captura.txt`, `testes-node.txt`.
- Regressão conferida depois da mudança no sorteio: a seed 1617 continua dando 3 rodadas e 2×0 no nível 1.
- Próximo: 4.2 (som), quando o grupo pedir.

## 2026-09-23 — Etapa 4, sub-passo 4.2: o som
- Novo `src/ui/audio.js`: tudo sintetizado com Web Audio, sem nenhum arquivo de áudio. Drone grave, zumbido da lâmpada que sobe quando ela pisca, coração de 52 a 142 bpm conforme a aposta e a morte se aproximando, papel da carta, metal da lâmina, capacitor, descarga, motor da serra e chiado da TV.
- Dois barramentos (ambiente e foley) passando por um abafador: na revelação o ambiente cala e fica só a carta virando; depois da punição o abafador fecha para tudo por 3,5 s, com um zumbido agudo por fora dele.
- **M** liga e desliga, em qualquer tela menos a de digitar as iniciais, onde M é uma letra do nome. O som só acorda depois de um gesto do usuário, como o navegador exige.
- 18 testes novos: as contas puras e um `AudioContext` de mentira, que prova que o caminho do som monta inteiro e que nenhum efeito lança erro — sem navegador.
- **O vídeo da captura é mudo**: o Playwright grava tela, não áudio. O roteiro prova o som conferindo `body[data-som]`, e `COMO-GRAVAR-COM-SOM.md` na pasta da evidência ensina a gravar à mão.
- Testes: 229/229.
- Evidências em `progresso/etapa-4/4.2/`: 6 prints, `video.mp4` (mudo), `COMO-GRAVAR-COM-SOM.md`, `captura.txt`, `testes-node.txt`.
- Próximo: 4.3 (efeitos visuais).

## 2026-09-23 — Etapa 4, sub-passo 4.3: efeitos visuais
- `src/ui/efeitos.js` ganhou separação de cores nas bordas e a distorção da TV; granulado, linhas de varredura e vinheta passaram a crescer com a tensão da cena, e o tremor virou constante (sub-pixel no começo, visível perto da morte).
- A conta da tensão saiu para `src/ui/tensao.js`, puro e com 10 testes: o som (4.2) e os efeitos usam a mesma. A aposta pesa até 0,45 e a morte chegando até 0,75, então estar a um passo do fim já aperta quase tudo mesmo apostando pouco.
- **Desempenho**: a separação de cores é a única parte cara, porque precisa de uma cópia do quadro; é montada em 1/3 da resolução e esticada de volta — o truque que o próprio PDF sugere. Medido na captura: **86 fps com os efeitos e 86 fps sem eles**.
- **E** liga e desliga o pós-processamento, e a escolha é salva junto com o progresso. O `?efeitos=0` continua mandando mais que a tecla.
- A TV rasga em nove fatias horizontais com uma barra de sincronismo subindo, só enquanto o anfitrião fala.
- Testes: 239/239.
- Evidências em `progresso/etapa-4/4.3/`: 6 prints, `comparacao-tensao.png` (as duas cenas lado a lado), `video.mp4`, `captura.txt`, `testes-node.txt`.
- Próximo: 4.4a (as cartas trunfo que faltam).

## 2026-09-23 — Etapa 4, sub-passo 4.4a: as cartas trunfo que faltavam
- As 11 cartas que faltavam do jogador entraram: Two-Up+, Shield+, Exchange, Trump Switch, Trump Switch+, Destroy+, Destroy++, Perfect Draw+, Ultimate Draw, Harvest e Love Your Enemy. O catálogo do jogador passou de 16 para 27 cartas, e agora cobre todas as `player_cards` do arquivo.
- Cinco tipos de efeito novos no motor: trocar a última carta virada dos dois lados, descartar cartas da mão no sorteio (com o gerador dos trunfos, então o descarte se repete com a mesma seed), limpar a mesa inteira do oponente, **trancar** os trunfos dele enquanto a carta estiver na mesa, e devolver uma carta a cada jogada (Harvest, que nunca paga a si mesma).
- Cada carta nova ganhou símbolo desenhado à mão; as versões "+" reusam o símbolo da irmã menor com uma ou duas cruzinhas no canto.
- 22 testes novos, um por carta mais os casos de borda. Total: 262.
- **Regressão conferida depois de mexer no sorteio**: mesmo com 11 cartas a mais no monte, a seed 1617 continua dando 3 rodadas e 2×0 no nível 1 — porque no nível 1 ninguém joga trunfo, e o baralho tem gerador separado.
- Evidências em `progresso/etapa-4/4.4a/`: 6 prints, `video.mp4`, `captura.txt`, `testes-node.txt`.
- Próximo: 4.8 (a trapaça do Kaio). As partes b e c do 4.4 (variantes e Sobrevivência) ficaram para depois.

## 2026-09-23 — Etapa 4, sub-passo 4.8: a trapaça do anfitrião
- Novo `src/engine/trapaca.js`, puro: ao entrar no nível 3 o jogador recebe o **Love Your Enemy**, e quando a serra fica a uma derrota de encostar no Luiz Alberto o Kaio joga **Perfect Draw** e **Desperation** por ele — emprestando o turno, porque o anfitrião não espera a vez de ninguém.
- A Desperation pediu dois efeitos novos no motor: aposta `both` (as duas sobem 100, então a próxima derrota mata) e `block_draw` (o jogador não pode mais comprar). O `prepararCatalogo` ganhou `extras`, para o motor conhecer uma carta de inimigo sem ela entrar no sorteio.
- A saída já estava na mão: o Love Your Enemy obriga o Luiz a comprar mais uma carta, e a mão que o Perfect Draw tinha fechado estoura.
- Na tela: a sala inteira vira vermelha, a TV rasga e grita (ruído descendo, que é o que sobra de uma voz num alto-falante velho), a música para e o tremor sobe.
- 14 testes, os dois caminhos que o grupo pediu: a trapaça acontecendo e sendo virada, e a trapaça não acontecendo quando o Luiz morre antes.
- Testes: 276/276.
- Evidências em `progresso/etapa-4/4.8/`: 7 prints, `video.mp4` (velocidade normal), `captura.txt`, `testes-node.txt`. Na captura a trapaça arma na rodada 4, com a serra a 4 marcas do Luiz, e a virada fecha em 1000 pontos.
- Próximo: o fechamento da Etapa 4 e do trabalho.

## 2026-09-23 — Etapa 4 e trabalho fechados
- Tudo rodado de novo: **276/276 testes** e todas as capturas finais.
- **Quebrou uma coisa, e era previsível**: a captura final da Etapa 2 (seed 21) não se reproduz mais, porque as 11 cartas trunfo do 4.4a mudaram o sorteio e aquela partida agora termina no nível 2. O roteiro `2.final` foi marcado como histórico, como o `1.final` já tinha sido; a evidência original continua guardada.
- **Não quebrou o que importa**: a partida de referência desde a Etapa 1 (seed 1617) continua dando 3 rodadas e 2×0 no nível 1, pela quarta etapa seguida, e o ciclo completo da Etapa 3 (seed 177) dá os mesmos 175 pontos e a mesma lista `JOA:175`.
- **`progresso/index.html`**: a evolução etapa por etapa, com 136 prints e 24 vídeos em ordem, gerada por `tools/gerar_index_progresso.py` a partir das pastas de evidência e das datas desta linha do tempo. É a página para abrir na apresentação.
- `progresso/etapa-4/RESUMO.md` escrito. Commit e tag `etapa-4`; o trabalho também foi publicado em github.com/Jgabriel7z/BlackJack.
- Números finais: 16.673 linhas de código, 276 testes, 29 prompts registrados.

## 2026-09-23 — Ajustes depois de jogar
Primeira rodada de mudanças pedidas jogando, não planejando.

- **Mão de trunfos limitada a 4** (era 8) e menos cartas caindo: a chance de ganhar trunfo ao comprar foi de 30% para 18%.
- **Raridade com porcentagem**: as cartas viraram quatro gavetas — comum 6,25%, incomum 3,13%, rara 1,56% e lendária 0,78% cada. As quatro lendárias são as que viram a rodada sozinhas (Destroy++, Perfect Draw+, Ultimate Draw e Love Your Enemy). O sorteio passou a ser por peso, e a dica da carta mostra a raridade e a chance de ela sair.
- **O Luiz aprendeu o resto das cartas.** Ele usava 6 das 27; agora tem regra para quase todas: prefere a versão forte da família, obriga o jogador a comprar com Love Your Enemy quando ele já está no limite, devolve ao baralho a carta grande que ele virou, troca a carta ruim pela boa com Exchange e recicla a mão com Trump Switch quando ela só tem lixo.
- **Teto de 3 trunfos por rodada** para cada lado. Sem ele a Harvest repunha a mão e a IA jogava para sempre no mesmo turno — tem teste que prova isso.
- **Modo difícil no título (tecla H)**: o oponente joga com a cabeça do nível 3 desde a guilhotina, e as bordas da tela respiram vermelho, como fumaça. É luz, não sangue: nenhuma ferida é desenhada.
- **Cartas trunfo maiores** (66×92 → 84×112) e **botão de tela cheia** no canto, clicável em qualquer tela, com a tecla F junto.
- **`jogar.cmd`**: dois cliques sobem o servidor e abrem o navegador sozinho, sem ninguém precisar copiar endereço.
- Medido em 400 partidas com os dois lados usando trunfos: o Luiz vence 67,9% no normal e 81,1% no difícil.
- Testes: 306/306 (12 novos da raridade, 18 da IA com trunfos). A regressão da seed 1617 e a captura do ciclo completo (seed 177) continuam iguais.

## 2026-09-23 — O Kaio ganhou boca
- Novo `src/engine/anfitriao.js` (puro): decide **quando** e **qual** fala, com o gerador de seed vindo de fora. As falas moram no `config.js`, junto com os nomes — 35 delas, em 9 situações.
- Ele comenta **depois da punição**, não junto com o resultado: a lâmina desce primeiro, aí ele fala. E a fala aparece numa tarja de televisão no alto da tela, tremulando de leve, que é de onde a voz dele vem.
- Duas regras para ele não virar barulho de fundo: no máximo **uma fala por rodada**, e ele não repete enquanto houver outra daquela situação guardada. Com 72% de chance de falar quando poderia, ele às vezes fica calado — e o silêncio dele pesa mais que a fala.
- Ordem de interesse: estar a um passo do fim vem antes de estourar, que vem antes de ganhar. Ele comenta o que é mais engraçado para ele, não o que é mais importante para você.
- As falas entre os níveis ganharam uma terceira linha cada, no mesmo tom.
- **A regra de violência sem sangue virou teste**: um teste varre todas as falas atrás de palavras como sangue, ferida, corte, carne e osso, e falha se alguma aparecer. Ele é cruel de boca; o jogo continua não descrevendo mutilação.
- Testes: 319/319 (13 novos).

## 2026-09-23 — Torneira fechada e a voz do Kaio
- **Uma carta trunfo por rodada**, e só. Os níveis 2 e 3 davam duas no começo e ainda caía carta a cada compra (18% de chance); agora é uma no começo de cada rodada em todos os níveis, e comprar não traz mais nada. O que ainda enche a mão é efeito de outra carta (Harvest, Ultimate Draw, Trump Switch) — isso é jogada, não sorte.
- **A carta chega com animação**: sobe pela borda de baixo até o lugar dela na mão, passa um pouco do ponto e volta. Como agora é a única da rodada, ela merecia ser vista chegando; a mensagem da mesa diz qual foi.
- **O Kaio ganhou voz**: nenhuma palavra, só grunhidos graves com chiado de alto-falante por cima, no espírito do que o grupo pediu. O ritmo dos grunhidos sai do próprio texto da fala (soma dos códigos das letras), sem `Math.random` — então a mesma fala soa sempre igual e nenhuma soa como a outra. Vale para os comentários da rodada, as trocas de nível, a despedida e a trapaça.
- Testes: 321/321. A regressão da seed 1617 e o ciclo completo (seed 177) continuam iguais.

## 2026-09-23 — A recompensa que furava a regra nova
- O grupo continuava ganhando **duas** cartas por rodada depois da mudança. A causa não era o config: era a recompensa da tabela A5 **"Vencer uma partida mesmo tendo estourado"**, desbloqueada jogando, que dava "uma carta trunfo a mais no começo da rodada" — exatamente o que tinha acabado de ser proibido.
- As duas recompensas desse tipo viraram **uma vaga a mais na mão** (4 → 5 → 6). Continuam valendo, porque guardar carta boa para a hora certa é vantagem real, e param de furar a regra de uma carta por rodada.
- O limite da mão passou a viver na partida (`jogo.maximoNaMao`), e vale só para o jogador: o do oponente é sempre o padrão do config.
- Dois testes novos travam isso: nenhuma recompensa é do tipo que dá carta por rodada, e mesmo com a mão maior continua chegando uma só.
- Testes: 324/324. A regressão da seed 1617 continua igual.

## 2026-09-23 — O modo difícil sem muletas
- No difícil **nenhuma recompensa vale** — nem as já ganhas — e em troca o **monte de trunfos entra inteiro**, inclusive as cartas que ainda não foram desbloqueadas. Quem escolhe o difícil quer o jogo cheio e sem empurrão.
- As recompensas continuam sendo ganhas e guardadas no difícil; elas só voltam a valer quando o jogador desliga o modo.
- A regra ficou no módulo puro (`cartasDoSorteio` e `vagasAMaisNaMao` em `progresso.js`), com três testes, em vez de espalhada pela interface.
- O rodapé do título passou a dizer o que o difícil muda, em três partes: oponente no máximo, monte inteiro, nenhuma recompensa.
- Testes: 327/327.

## 2026-09-23 — A mensagem de trunfo do oponente durava 0,7 s
- Jogando, o grupo viu que a explicação da carta trunfo que o Luiz Alberto joga sumia antes de dar para ler: a pausa era fixa em 700 ms e logo em seguida a mensagem era trocada pela jogada seguinte dele.
- A pausa passou a acompanhar o tamanho do texto da carta: de 1,1 s (carta curta) a 4,2 s (as mais longas, como o Destroy++). Vale para os dois lados, inclusive na demonstração.
- Conferida de quebra a mesa do print que o grupo mandou: 313 pontos = 125 (vitória com o oponente estourado) + 188 (a mesma coisa ×1,5 pela segunda vitória seguida), e a aposta de 3 dedos na rodada 3 = 3 de base +1 do One-Up dele −1 do Shield do jogador. O motor estava certo.
