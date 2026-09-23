// Captura final da Etapa 1 — uma partida inteira em velocidade normal,
// do começo à tela final, com prints dos momentos principais.
//
// HISTÓRICO: este roteiro retrata o jogo como ele era no fim da Etapa 1,
// quando havia um aparelho só. Da Etapa 2 em diante a partida atravessa
// três níveis, então rodá-lo hoje dá outro resultado (a tela final vem
// do nível 3, não da guilhotina). A evidência original está guardada em
// progresso/etapa-1/final/. Para conferir que o NÍVEL 1 continua igual,
// use `node tools/capturar.mjs 2.regressao`.
// Seed 1617: João Gabriel vence em 3 rodadas perdendo 3 dedos no caminho,
// então aparecem as duas guilhotinas. A regra da IA decide HIT/STAY por ele.
// Saída: progresso/etapa-1/final/

const SEED = 1617;

export default {
  descricao: `Partida inteira em velocidade normal (seed ${SEED}) até a tela final`,
  video: true,

  async executar({ abrir, print, esperar, anotar, falhar, pagina }) {
    const atributo = (nome) => pagina.getAttribute('body', nome);
    const esperarSeletor = (seletor, timeout = 90_000) => pagina.waitForSelector(seletor, { timeout });

    await abrir('/index.html', { tela: 'jogando', seed: SEED });
    await esperarSeletor('body[data-pronto="1"]', 10_000);

    // 1) Mesa pronta na primeira rodada.
    await esperarSeletor('body[data-animacao="ocioso"]');
    await esperar(400);
    await print('mesa-rodada-1');

    const fotografados = new Set();
    let cliques = 0;

    for (;;) {
      await esperarSeletor(
        'body[data-animacao="ocioso"], body[data-animacao="pensando"], body[data-animacao="revelando"], body[data-animacao="guilhotina"]',
      );
      const animacao = await atributo('data-animacao');

      // 2) Oponente pensando (uma vez).
      if (animacao === 'pensando') {
        if (!fotografados.has('pensando')) {
          await esperar(500);
          await print('oponente-pensando');
          fotografados.add('pensando');
        }
        await esperarSeletor('body:not([data-animacao="pensando"])');
        continue;
      }
      // 3) Revelação da carta oculta (uma vez).
      if (animacao === 'revelando') {
        if (!fotografados.has('revelando')) {
          await esperar(550);
          await print('revelacao');
          fotografados.add('revelando');
        }
        await esperarSeletor('body:not([data-animacao="revelando"])');
        continue;
      }
      // 4) Guilhotina (uma vez).
      if (animacao === 'guilhotina') {
        if (!fotografados.has('guilhotina')) {
          await esperar(600);
          await print('guilhotina');
          fotografados.add('guilhotina');
        }
        await esperarSeletor('body[data-animacao="ocioso"], body[data-animacao="fim"]');
        continue;
      }

      const fase = await atributo('data-fase');
      if (fase === 'fim_de_jogo') break;
      if (fase === 'rodada_encerrada') {
        await pagina.locator('#botao-proxima').click();
        continue;
      }
      const total = Number(await atributo('data-meu-total'));
      if (total < 17) await pagina.locator('#botao-hit').click();
      else await pagina.locator('#botao-stay').click();
      if (++cliques > 80) falhar('Partida longa demais.');
    }

    // 5) Tela final.
    await esperar(600);
    await print('tela-final');
    anotar(`seed ${SEED}: dedos João ${await atributo('data-meus-dedos')} x Luiz ${await atributo('data-dedos-dele')}`);
    if ((await atributo('data-partida-acabou')) !== '1') falhar('A partida deveria ter acabado.');
  },
};
