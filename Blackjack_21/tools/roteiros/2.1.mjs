// Roteiro de captura do sub-passo 2.1 — pontuação.
// Seed 41 (achada com a IA dos dois lados): João Gabriel vence as duas
// primeiras rodadas fechando exatamente em 21 nas duas. Prints do visor
// zerado, depois da 1ª vitória (+150) e depois da 2ª (×1,5 = +225).

const SEED = 41;

export default {
  descricao: `Visor de pontos: zerado, após 1ª vitória e após 2ª vitória seguida (seed ${SEED})`,
  video: true,

  async executar({ abrir, print, esperar, anotar, falhar, pagina }) {
    const atributo = (nome) => pagina.getAttribute('body', nome);
    const esperarSeletor = (seletor, timeout = 90_000) => pagina.waitForSelector(seletor, { timeout });

    await abrir('/index.html', { tela: 'jogando', seed: SEED });
    await esperarSeletor('body[data-pronto="1"]', 10_000);
    await esperarSeletor('body[data-animacao="ocioso"]');
    await esperar(400);
    anotar(`pontos no início: ${await atributo('data-pontos')}`);
    await print('visor-zerado');

    let resultados = 0;
    let cliques = 0;
    while (resultados < 2) {
      await esperarSeletor('body[data-animacao="ocioso"], body[data-animacao="resultado"]');
      if ((await atributo('data-animacao')) === 'resultado') {
        resultados += 1;
        await esperar(200); // o passo "resultado" dura 900 ms; o print precisa cair dentro dele
        anotar(`pontos após a rodada ${resultados}: ${await atributo('data-pontos')}`);
        await print(resultados === 1 ? 'primeira-vitoria' : 'segunda-vitoria-multiplicador');
        await esperarSeletor('body[data-animacao="ocioso"], body[data-animacao="fim"]');
        continue;
      }
      const fase = await atributo('data-fase');
      if (fase === 'fim_de_jogo') falhar('A partida acabou antes da 2ª rodada.');
      if (fase === 'rodada_encerrada') {
        await pagina.locator('#botao-proxima').click();
        continue;
      }
      const total = Number(await atributo('data-meu-total'));
      if (total < 17) await pagina.locator('#botao-hit').click();
      else await pagina.locator('#botao-stay').click();
      if (++cliques > 40) falhar('Rodadas longas demais.');
    }

    const pontos = Number(await atributo('data-pontos'));
    if (pontos !== 375) falhar(`Esperava 375 pontos (150 + 150×1,5), obtive ${pontos}.`);
    anotar('total conferido: 375 = 150 + 225');
  },
};
