// Roteiro de captura do sub-passo 1.4 — mesa com vida.
// Roda SEM ?rapido, para o vídeo mostrar o ritmo real. Os prints pegam
// a carta no meio do voo, o oponente pensando, a virada da oculta e o
// resultado.

const SEED = 123;

export default {
  descricao: `Rodada inteira com animações no ritmo real (seed ${SEED}, sem rapido)`,
  video: true,

  async executar({ abrir, print, esperar, anotar, falhar, pagina }) {
    await abrir('/index.html', { tela: 'jogando', seed: SEED });
    await pagina.waitForSelector('body[data-pronto="1"]', { timeout: 10_000 });

    const animacao = () => pagina.getAttribute('body', 'data-animacao');
    const fase = () => pagina.getAttribute('body', 'data-fase');
    const esperarAnimacao = (nome, timeout = 15_000) =>
      pagina.waitForSelector(`body[data-animacao="${nome}"]`, { timeout });
    const esperarOcioso = (timeout = 20_000) =>
      pagina.waitForSelector('body[data-animacao="ocioso"]', { timeout });

    // Distribuição inicial: print de uma carta deslizando.
    await esperarAnimacao('distribuindo');
    await esperar(1100); // pausa inicial (350) + 1ª carta (480) + meio da 2ª carta
    await print('distribuindo-carta');
    await esperarOcioso();
    await esperar(300);
    await print('mesa-pronta');

    // HIT: carta do jogador voando, depois o oponente pensa.
    await pagina.locator('#botao-hit').click();
    await esperarAnimacao('comprando');
    await esperar(180);
    await print('carta-deslizando');
    await esperarAnimacao('pensando');
    await esperar(600);
    anotar(`HIT desabilitado enquanto pensa: ${await pagina.locator('#botao-hit').isDisabled()}`);
    await print('oponente-pensando');
    await esperarOcioso();

    // STAY até a rodada acabar (o oponente pode comprar e devolver a vez).
    for (let i = 0; i < 10 && (await fase()) === 'jogando'; i++) {
      await pagina.locator('#botao-stay').click();
      // Espera a vez voltar (ocioso) ou a revelação começar.
      await pagina.waitForSelector(
        'body[data-animacao="ocioso"], body[data-animacao="passou"], body[data-animacao="escurecendo"]',
        { timeout: 20_000 },
      );
      if ((await animacao()) !== 'ocioso') break;
    }

    // Revelação: escurecimento e virada lenta.
    await esperarAnimacao('escurecendo');
    await esperar(1200);
    await print('escurecendo');
    await esperarAnimacao('revelando');
    await esperar(550); // carta de perfil, no meio do giro
    await print('revelando-oculta');
    await esperarOcioso(30_000);
    await esperar(400);
    await print('resultado');

    const faseFinal = await fase();
    if (faseFinal === 'jogando') falhar('A rodada não terminou.');
    anotar(`fase final: ${faseFinal}`);
  },
};
