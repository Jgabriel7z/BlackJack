// Roteiro de captura do sub-passo 3.3 — a tela de fim de jogo.
//
// Parte 1: uma derrota no nível 1 (seed 31, em que João Gabriel perde em
//   3 rodadas). Print do GAME OVER e vídeo até a tela voltar ao título
//   sozinha, sem ninguém apertar nada.
// Parte 2: uma vitória começando do nível 3 (?nivel=3), para gravar o
//   anfitrião aparecendo na televisão antes de o jogo voltar ao início.

const SEED_DERROTA = 31;   // João Gabriel perde no nível 1 em 3 rodadas
// Achada com `node tools/simular.mjs 600 1 3 --fiel`: começando no nível
// 3, o baralho é outro, e nesta seed o jogador vence em 4 rodadas.
const SEED_VITORIA = 44;

export default {
  descricao: 'Fim de jogo: derrota com GAME OVER e volta ao título; vitória com a despedida do anfitrião',
  video: true,

  async executar({ abrir, print, esperar, anotar, falhar, pagina }) {
    const atributo = (nome) => pagina.getAttribute('body', nome);

    /** Joga sozinho até uma das telas pedidas aparecer. */
    const jogarAte = async (telasAlvo, passos = 1500) => {
      for (let i = 0; i < passos; i++) {
        const tela = await atributo('data-tela');
        if (telasAlvo.includes(tela)) return tela;
        if ((await atributo('data-animacao')) !== 'ocioso') { await esperar(100); continue; }
        if (tela !== 'jogando') { await esperar(100); continue; }

        const fase = await atributo('data-fase');
        if (fase === 'rodada_encerrada') { await pagina.locator('#botao-proxima').click(); continue; }
        if (fase !== 'jogando') { await esperar(100); continue; }
        const total = Number(await atributo('data-meu-total'));
        if (total < 17) await pagina.locator('#botao-hit').click();
        else await pagina.locator('#botao-stay').click();
      }
      falhar(`Passei de ${passos} passos esperando por ${telasAlvo.join(' ou ')}.`);
      return null;
    };

    // ------------------------------------------------------------------
    //  Derrota no nível 1
    // ------------------------------------------------------------------
    await abrir('/index.html', { tela: 'jogando', seed: SEED_DERROTA });
    await pagina.waitForSelector('body[data-pronto="1"]', { timeout: 10_000 });

    await jogarAte(['game_over']);
    await esperar(400);
    anotar(`derrota: ${await atributo('data-pontos')} pontos, recorde ${await atributo('data-recorde')}`);
    await print('game-over');

    // Ninguém aperta nada: a tela tem de voltar ao título sozinha.
    const entrou = Date.now();
    await pagina.waitForSelector('body[data-tela="titulo"]', { timeout: 20_000 });
    const segundos = ((Date.now() - entrou) / 1000).toFixed(1);
    anotar(`o fim de jogo voltou ao título sozinho em ${segundos} s`);
    if (Number(segundos) > 8) falhar(`Demorou demais para voltar: ${segundos} s.`);
    await pagina.waitForSelector('body[data-titulo-pronto="1"]', { timeout: 20_000 });
    await esperar(200);
    await print('voltou-ao-titulo');

    // ------------------------------------------------------------------
    //  Vitória no nível 3: a despedida do anfitrião
    // ------------------------------------------------------------------
    await abrir('/index.html', { tela: 'jogando', seed: SEED_VITORIA, nivel: 3 });
    await pagina.waitForSelector('body[data-pronto="1"]', { timeout: 10_000 });

    // Espera a fila entrar na despedida, que só existe quando se vence.
    let viuDespedida = false;
    for (let i = 0; i < 1500 && !viuDespedida; i++) {
      if ((await atributo('data-animacao')) === 'despedida') { viuDespedida = true; break; }
      const tela = await atributo('data-tela');
      if (tela === 'game_over') falhar('Era para vencer o nível 3, não perder.');
      if ((await atributo('data-animacao')) !== 'ocioso') { await esperar(100); continue; }
      const fase = await atributo('data-fase');
      if (fase === 'rodada_encerrada') { await pagina.locator('#botao-proxima').click(); continue; }
      if (fase !== 'jogando') { await esperar(100); continue; }
      const total = Number(await atributo('data-meu-total'));
      if (total < 17) await pagina.locator('#botao-hit').click();
      else await pagina.locator('#botao-stay').click();
    }
    if (!viuDespedida) falhar('A despedida do anfitrião não apareceu.');

    await esperar(2600);   // televisão acesa e a primeira fala no ar
    await print('anfitriao-na-tv');
    await esperar(3000);
    await print('anfitriao-segunda-fala');

    // Desde o 3.4 uma vitória entra nas cinco melhores, então antes do
    // título o jogo pede as três letras. ENTER aceita as que estiverem lá.
    await pagina.waitForSelector('body[data-tela="iniciais"]', { timeout: 30_000 });
    await pagina.keyboard.press('Enter');
    await pagina.waitForSelector('body[data-tela="titulo"]', { timeout: 30_000 });
    anotar('depois da despedida o jogo voltou ao título, sem passar pelo GAME OVER');
    await pagina.waitForSelector('body[data-titulo-pronto="1"]', { timeout: 20_000 });
    await esperar(200);
    await print('titulo-depois-da-vitoria');
  },
};
