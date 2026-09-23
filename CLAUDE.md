# CLAUDE.md — regras do projeto "21" (Atividade 02)

Estas regras valem para todo prompt deste projeto. Não precisam ser repetidas.

## Onde as coisas ficam

- O **código do jogo** fica em `Blackjack_21/`. Todo caminho de código citado nos prompts (`src/engine/...`, `tests/...`) é relativo a essa pasta.
- Os **documentos do relatório** ficam na raiz: `PLANO_DE_DESENVOLVIMENTO.md`, `PROMPTS_E_RESPOSTAS.md`, `RELATORIO.md`, `CLAUDE.md`.
- **Evidências de progresso** (prints, vídeos, linha do tempo) ficam em `progresso/`, na raiz.

## Referências (fonte da verdade)

1. `PLANO_DE_DESENVOLVIMENTO.md`: etapas, sub-passos, checklists e decisões de design.
2. `21_referencia_jogo.pdf`: regras (Partes A, C, D) e atmosfera (Parte B).
3. `trump_cards.json`: catálogo de cartas trunfo (usado a partir da Etapa 2).

Se o PDF e o plano discordarem, o plano vence (ele registra as decisões do grupo). Se algo não estiver em nenhum dos dois, escolher o mais simples e anotar como decisão de design no plano.

## Escopo: um sub-passo por vez

- Implementar **somente o sub-passo pedido**. Nunca adiantar o próximo, mesmo que pareça trivial.
- Não criar arquivos, funções ou opções "para o futuro".
- No final de toda resposta, listar em duas seções: **"Ficou de fora de propósito"** (o que pertence a sub-passos futuros) e **"Fiz além do pedido"** (qualquer coisa fora do sub-passo; se nada, dizer "nada").

## Regras de código

- **`src/engine/` é lógica pura.** Nada dentro dela pode importar ou tocar em DOM, `document`, `window`, Canvas, Web Audio ou `localStorage`. Só dados e funções.
- **Só `src/ui/armazenamento.js` toca em `localStorage`** (4.1). Toda operação dele está dentro de try/catch e ele aceita um "depósito" por parâmetro, para dar para testar no terminal com um depósito de mentira. O formato do que é salvo mora em `src/engine/progresso.js`, que é puro; `normalizar` é a porta de entrada obrigatória de tudo o que volta do disco, porque aquilo pode estar velho, cortado ou mexido à mão.
- **Aleatoriedade sempre com seed.** Qualquer coisa aleatória (embaralhar, chance de trunfo, IA que sorteia, piscar de lâmpada) usa o gerador de `src/engine/rng.js` com uma seed conhecida. `Math.random` só pode ser chamado para escolher uma seed nova quando o usuário não informa uma. A seed da partida fica guardada no estado (`jogo.seed`) para permitir repetir a mesma partida.
- **Nomes dos personagens vêm de `src/config.js`** (`NOMES`). Nenhum nome de personagem fixo em outro arquivo.
- Identificadores e comentários em **português**. Comentário de cabeçalho em cada arquivo dizendo o que ele faz e de qual sub-passo veio.
- **O jogo não tem build nem dependências.** Módulos ES nativos. A única dependência do `package.json` é o Playwright (dev), usado apenas pela ferramenta de captura em `tools/`; nada do jogo importa dele.
- Todo módulo de `src/engine/` tem testes em `tests/`. Os testes rodam com `node tests/run-node.mjs` e em `tests/tests.html` (servido por `node tools/servidor.mjs`).
- `node_modules/` está no `.gitignore`. A pasta `progresso/` é versionada de propósito.

## Requisitos para a interface (a partir do sub-passo 1.3)

Necessários para a ferramenta de captura funcionar e os prints saírem sempre iguais:

- **`?seed=123` na URL** define a seed da partida (`criarJogo({ seed })`). Sem o parâmetro, sorteia normalmente. Mostrar a seed em algum canto discreto da tela ajuda a reproduzir bugs.
- **`?rapido=1` na URL** acelera todas as animações e pausas (multiplicador de tempo, por exemplo 0,05×), só para captura e testes. O jogo normal ignora.
- **`?efeitos=0` na URL** desliga o pós-processamento (granulado, linhas de varredura, vinheta de `efeitos.js`), útil para comparar prints ou depurar o desenho.
- **`?trunfos=two_up,shield,go_for_24` na URL** fixa a mão de trunfos da primeira rodada, para a captura não depender de sorteio.
- **`?nivel=2` ou `?nivel=3` na URL** começa direto no aparelho de choque ou na serra.
- **`?tela=jogando` na URL** pula a tela de título e cai direto na mesa. O jogo normal começa no título (requisito da Etapa 3), então **todo roteiro que quer ir direto ao jogo precisa passar isso**. `?tela=attract` cai direto na demonstração, já jogando, sem esperar os 15 s do título.
- **`<link rel="icon" href="data:,">`** em todo HTML, para o navegador não pedir `/favicon.ico`.
- **Console limpo:** nenhum `console.error`, exceção ou requisição 404 durante o uso normal. A captura falha se houver.
- **Layout pensado para 1280x720**, que é o viewport dos prints e do vídeo.
- Ações do jogador acessíveis por elementos com `id` ou `data-acao` estáveis (ex.: `#botao-hit`, `#botao-stay`, `#botao-proxima`) para os roteiros clicarem sem depender de texto.
- **Ganchos para roteiros:** `body[data-pronto="1"]` depois do primeiro desenho, `body[data-fase]` com a fase do jogo, `body[data-animacao]` com o passo atual, e `body[data-meu-total]`, `data-meus-dedos`, `data-dedos-dele`, `data-pontos`, `data-alvo`, `data-nivel`, `data-medidor-meu`, `data-medidor-dele`, `data-serra`, `data-iniciais` (as três letras sendo digitadas), `data-placar` (`INI:pontos;...`), `data-demonstracao`, `data-salvando`, `data-desbloqueios`, `data-partidas-jogadas`, `data-trunfos-na-mesa` e `data-trunfo-slots` (`id@x,y` de cada carta da minha mão, para os roteiros clicarem) — tudo já visível na tela. Nunca expor as cartas do oponente nem o objeto `jogo` no DOM ou em `window`: a carta oculta dele não pode ser descoberta pelo inspetor nem pelo console.

## Arte em pixel art

- Os sprites grandes (mão do João, Luiz Alberto) **não são digitados à mão**: vêm dos geradores em `tools/arte/gerar_*.py` (Python + Pillow), que rasterizam a forma, sombreiam e exportam grades de caracteres para `src/ui/sprites/*.js` mais um `preview_*.png`. Para mudar um sprite: editar o gerador, rodar `python tools/arte/gerar_<nome>.py`, abrir o preview, iterar. Retoques pixel a pixel podem ser feitos direto no `.js`, mas se o gerador rodar de novo eles se perdem.
- Cada parte que pode sumir ou se mexer (dedo, cabeça) é uma **camada separada**; animação de personagem é por **quadros** (grades alternativas), não por rotação no canvas, para manter os pixels nítidos.
- Python só é usado nas ferramentas de arte; o jogo continua sem dependências.

## Som (a partir da Etapa 4)

- Tudo sintetizado em `src/ui/audio.js`; **nenhum arquivo de áudio** entra no projeto.
- O som só acorda depois de um gesto do usuário (regra do navegador) e **nunca pode derrubar o jogo**: sem Web Audio, ou com ele falhando, o jogo roda mudo.
- **O Playwright não grava áudio.** Todo vídeo de captura é mudo, e isso não é defeito. Para provar som num roteiro, conferir `body[data-som]` (último efeito) e `body[data-sons]` (quantos já tocaram). Para gravar com som de verdade: `progresso/etapa-4/4.2/COMO-GRAVAR-COM-SOM.md`.

## Dados guardados (a partir da Etapa 4)

- Recorde, lista das cinco melhores, estatísticas (parte C3 do PDF) e desbloqueios (tabela A5) ficam no `localStorage`. **Nada disso pode ser obrigatório**: com o armazenamento quebrado o jogo joga igual, só não guarda, e o título avisa.
- **A demonstração não escreve nada**: nem recorde, nem lista, nem estatística, nem desbloqueio.
- **Desbloquear uma carta tira ela do sorteio até ser ganha**, mas ela continua no catálogo, então `?trunfos=` ainda consegue forçá-la numa captura.
- **Mexer no sorteio muda partidas antigas.** Ao acrescentar ou prender cartas, medir antes: um script que simula as seeds de referência (1617 da regressão, 177 da captura final da Etapa 3) e depois rodar `3.regressao`. Cartas a mais entregues por recompensa vêm num laço separado, DEPOIS do sorteio normal, para que sem recompensa nenhuma a sequência de sorteios seja idêntica à de antes.
- Cada captura roda num perfil de navegador novo, então o `localStorage` começa vazio: dentro de uma mesma captura, porém, ele atravessa os `abrir()` — é assim que o roteiro do 4.1 prova a persistência.

## Telas (a partir da Etapa 3)

- O laço é `título → attract → melhores pontuações → título`, com `jogando`, `fim de jogo` e `iniciais` entrando por fora. Quem manda é `src/ui/telas.js`, que é puro e testado com relógio de mentira.
- **A máquina nunca pode travar numa tela.** Toda tela de espera sai sozinha com o tempo; a de digitar as iniciais também sai, valendo o que estiver escrito.
- Telas que esperam alguém digitar **não são encurtadas pelo `?rapido=1`** (`RITMO_REAL` no `telas.js`), senão numa captura acelerada não dá tempo de escrever.
- **A demonstração (attract) não pode mudar nada**: nem recorde, nem lista das melhores, nem a partida de verdade. Ela usa uma partida só dela, com seed tirada de um gerador próprio.

## Conteúdo e tom

- **Violência sem sangue.** Dedos podem cair, o medidor de choque pode subir, a serra pode avançar, mas nunca desenhar sangue, feridas ou mutilação detalhada. O terror vem do som, da espera e do que não é mostrado (Parte B7 do PDF).
- Atmosfera escura e tensa (Parte B), mas o trabalho é acadêmico: nada gratuito.
- Interface em português.

## Fechamento de sub-passo (fazer sempre, sem que precise ser pedido)

Ao terminar qualquer sub-passo:

1. **Rodar os testes** com `node tests/run-node.mjs` e colar a saída na resposta.
2. **Prints e vídeo** com a ferramenta de captura do projeto (Playwright, em `Blackjack_21/tools/`):
   - Escrever ou atualizar o roteiro do sub-passo em `tools/roteiros/N.M.mjs` (modelo: `tools/roteiros/1.1.mjs`). O roteiro abre a página, faz as ações (clicar, esperar) e chama `print('nome')` em cada estado visual novo.
   - Rodar, dentro de `Blackjack_21/`: `node tools/capturar.mjs N.M`. Ele sobe o servidor sozinho, grava vídeo, salva em `progresso/etapa-N/N.M/` (`01-nome.png`, `02-...`, `video.mp4`, `captura.txt`) e **falha se houver qualquer erro no console do navegador**. Uma captura que falha não conta como sub-passo concluído.
   - Ao fechar uma etapa inteira: roteiro `tools/roteiros/N.final.mjs` (partida inteira), `node tools/capturar.mjs N.final` salva em `progresso/etapa-N/final/`; escrever `progresso/etapa-N/RESUMO.md` com os prints e 5 linhas do que a etapa entregou; verificar o checklist do plano item a item com provas; rodar um roteiro `N.regressao` que repete uma partida conhecida da etapa anterior e confere o mesmo resultado (salva em `progresso/etapa-N/regressao/`, sem sobrescrever a evidência antiga); então `git commit` e `git tag etapa-N`.
   - Um passo de animação pode levar `ritmoReal: true` para ignorar o `?rapido=1`. É o caso da fala do anfitrião: numa captura acelerada ela ainda precisa dar tempo de ler.
   - Salvar também a saída de `node tests/run-node.mjs` em `progresso/etapa-N/N.M/testes-node.txt`.
   - **Abrir as imagens geradas** (ferramenta Read) e conferir se mostram o que deveriam; se não, corrigir o roteiro ou o jogo e capturar de novo.
   - **Não recapturar sub-passos antigos** depois que o código mudou: a pasta `progresso/etapa-N/N.M/` é o retrato daquele momento. Para checar regressão de um roteiro antigo, rodar com `--sem-video` e depois restaurar os arquivos (ou, melhor, versionar com git e usar `git checkout` na pasta).
   - **Animações têm nome:** cada passo da fila (`animacao.js`) aparece em `body[data-animacao]` (`distribuindo`, `comprando`, `pensando`, `passou`, `escurecendo`, `revelando`, `resultado`, `punicao`, `trocando-nivel`, `jogando-trunfo`, `trocando-alvo`, `fim`, `despedida`, `proxima-rodada`, `mensagem`, `aguardando`, `ocioso`). Os roteiros esperam por esses nomes em vez de usar tempos fixos.
   - Prints saem sempre em 1280x720. Para o resultado ser igual em toda captura, o roteiro passa `{ seed: 123, rapido: 1 }` em `abrir()` (ver a seção "Requisitos para a interface").
   - Para achar uma seed com um desfecho específico (vitória, derrota, empate, partida curta), usar `node tools/simular.mjs <quantidade> <seed inicial> [nível] [--fiel]`: joga IA×IA e lista as partidas mais curtas por desfecho. **Use `--fiel` quando a seed for para um roteiro de captura**: ele liga as cartas trunfo, faz o oponente jogar como na interface e o jogador comprar abaixo de 17, que é o que o roteiro clica. Sem o flag os números não batem com o jogo real. Lembre também que começar num nível diferente muda o baralho: uma seed que vence os três níveis em sequência pode perder se a partida começar no nível 3. O roteiro reproduz a partida decidindo HIT/STAY pela mesma regra da IA a partir de `body[data-meu-total]`. A simulação só vale porque o baralho usa um gerador separado do sorteio de trunfos: a mesma seed dá o mesmo baralho com ou sem trunfos.
   - Um roteiro **nunca deve supor a ordem dos passos nem usar esperas fixas** entre eles: deve observar `body[data-animacao]` num laço até ver o que procura. A troca de nível, por exemplo, vem logo depois da punição e some rápido. Dê folga no número de passos: uma rodada no ritmo real leva uns 15 s.
   - Quando a captura falhar por tempo esgotado sem erro de console, use `node tools/depurar.mjs <seed> <nível>`: ele joga sozinho e imprime cada mudança de estado, mostrando onde parou.
3. **Linha do tempo:** acrescentar uma entrada em `progresso/LINHA_DO_TEMPO.md` com data, sub-passo, o que mudou em 3 a 6 linhas, caminho dos prints/vídeo e resultado dos testes.
4. **Registro de prompts:** acrescentar em `PROMPTS_E_RESPOSTAS.md` o prompt exato, um resumo da resposta, os arquivos criados/alterados, observações (retrabalho, decisões, o que ficou de fora) e um campo **"Impressões da equipe:"** vazio, para o grupo preencher depois.
5. Atualizar o `PLANO_DE_DESENVOLVIMENTO.md` se alguma decisão de design foi tomada ou se um sub-passo foi concluído (marcar com ✅).
