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
