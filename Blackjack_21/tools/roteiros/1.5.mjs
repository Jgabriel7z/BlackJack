// Roteiro de captura do sub-passo 1.5 — punição e fim de jogo.
// Joga DUAS partidas inteiras no ritmo real, com a mesma regra da IA
// decidindo pelo João (compra abaixo de 17), lendo o total dele em
// body[data-meu-total]. As seeds vieram de `node tools/simular.mjs`:
//   1617 -> João vence em 3 rodadas (perdendo 3 dedos no caminho)
//   31   -> João perde em 3 rodadas (Luiz também perde dedos)
// Prints: guilhotina e tela final de cada partida, e o reinício.

const PARTIDAS = [
  { nome: 'joao-vence', seed: 1617 },
  { nome: 'joao-perde', seed: 31 },
];

export default {
  descricao: 'Duas partidas completas (seeds 1617 e 31): guilhotina, tela final e jogar de novo',
  video: true,

  async executar({ abrir, print, esperar, anotar, falhar, pagina }) {
    const atributo = (nome) => pagina.getAttribute('body', nome);
    const esperarSeletor = (seletor, timeout = 90_000) => pagina.waitForSelector(seletor, { timeout });

    for (const partida of PARTIDAS) {
      await abrir('/index.html', { seed: partida.seed });
      await esperarSeletor('body[data-pronto="1"]', 10_000);

      let jaFotografouGuilhotina = false;
      let cliques = 0;

      for (;;) {
        await esperarSeletor('body[data-animacao="ocioso"], body[data-animacao="guilhotina"]');

        if ((await atributo('data-animacao')) === 'guilhotina') {
          if (!jaFotografouGuilhotina) {
            await esperar(600); // lâmina encostando: tremor e flash
            await print(`guilhotina-${partida.nome}`);
            jaFotografouGuilhotina = true;
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

        // Minha vez: a mesma regra da IA.
        const total = Number(await atributo('data-meu-total'));
        if (total < 17) await pagina.locator('#botao-hit').click();
        else await pagina.locator('#botao-stay').click();
        if (++cliques > 80) falhar(`Partida ${partida.nome} longa demais.`);
      }

      await esperar(500);
      await print(`fim-${partida.nome}`);
      anotar(`${partida.nome}: seed ${partida.seed}, dedos João ${await atributo('data-meus-dedos')} x Luiz ${await atributo('data-dedos-dele')}`);
      if (!(await pagina.locator('#botao-reiniciar').isVisible())) falhar('Botão "jogar de novo" não apareceu.');
    }

    // "Jogar de novo" zera tudo.
    await pagina.locator('#botao-reiniciar').click();
    await esperarSeletor('body[data-fase="jogando"]', 20_000);
    await esperarSeletor('body[data-animacao="ocioso"]', 20_000);
    await esperar(300);
    if ((await atributo('data-meus-dedos')) !== '5' || (await atributo('data-dedos-dele')) !== '5') {
      falhar('Reiniciar não devolveu os 5 dedos aos dois.');
    }
    await print('reinicio');
    anotar('reinício: rodada 1, 5/5 dedos para os dois');
  },
};
