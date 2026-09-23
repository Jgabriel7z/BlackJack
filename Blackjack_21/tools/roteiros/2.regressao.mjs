// Regressão do nível 1, para o fechamento da Etapa 2.
//
// Repete a partida da Etapa 1 (seed 1617) e confere que o nível 1
// terminou igual: 3 rodadas, João Gabriel com 2 dedos e Luiz Alberto
// com 0. As cartas trunfo entraram no jogo depois, mas usam um gerador
// separado do baralho, então o curso da partida tem de ser o mesmo.
//
// Salva em progresso/etapa-2/regressao/ para não sobrescrever a
// evidência original da Etapa 1.

const SEED = 1617;

export default {
  descricao: `Regressão: o nível 1 com a seed ${SEED} termina como na Etapa 1 (3 rodadas, 2x0)`,
  video: false,

  async executar({ abrir, print, esperar, anotar, falhar, pagina }) {
    const atributo = (nome) => pagina.getAttribute('body', nome);

    await abrir('/index.html', { tela: 'jogando', seed: SEED });
    await pagina.waitForSelector('body[data-pronto="1"]', { timeout: 10_000 });

    let viuGuilhotina = false;
    let rodadas = 0;
    let ultimaRodadaVista = '0';

    for (let passo = 0; passo < 1500; passo++) {
      const animacao = await atributo('data-animacao');

      if (animacao === 'trocando-nivel') break;   // o nível 1 acabou
      if (animacao === 'punicao' && !viuGuilhotina) {
        await esperar(600);
        await print('guilhotina-nivel-1');
        viuGuilhotina = true;
        continue;
      }
      if (animacao !== 'ocioso') { await esperar(110); continue; }

      const fase = await atributo('data-fase');
      if (fase === 'fim_de_jogo') falhar('O jogador perdeu: o nível 1 mudou de comportamento.');
      if (fase === 'rodada_encerrada') { await pagina.locator('#botao-proxima').click(); continue; }

      const rodadaAtual = await atributo('data-rodada');
      if (rodadaAtual !== ultimaRodadaVista) {
        rodadas += 1;
        ultimaRodadaVista = rodadaAtual;
        if (rodadas === 1) await print('mesa-rodada-1');
      }

      const total = Number(await atributo('data-meu-total'));
      if (total < 17) await pagina.locator('#botao-hit').click();
      else await pagina.locator('#botao-stay').click();
    }

    const meusDedos = await atributo('data-meus-dedos');
    const dedosDele = await atributo('data-dedos-dele');
    anotar(`nível 1 com a seed ${SEED}: ${rodadas} rodadas, dedos João ${meusDedos} x Luiz ${dedosDele}`);
    anotar('registro da Etapa 1: 3 rodadas, dedos João 2 x Luiz 0');

    if (rodadas !== 3) falhar(`A Etapa 1 fechou com 3 rodadas; agora deu ${rodadas}.`);
    if (meusDedos !== '2' || dedosDele !== '0') {
      falhar(`A Etapa 1 fechou com 2x0; agora deu ${meusDedos}x${dedosDele}.`);
    }
    await print('fim-do-nivel-1');
  },
};
