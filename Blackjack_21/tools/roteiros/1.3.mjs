// Roteiro de captura do sub-passo 1.3 — primeira tela (mesa em Canvas 2D).
// Abre com seed fixa, print da mesa inicial, HIT, print, STAY até a rodada
// acabar, print do resultado.

const SEED = 123;

export default {
  descricao: `Mesa visual: inicial, após HIT e resultado da rodada (seed ${SEED})`,
  video: true,

  async executar({ abrir, print, esperar, anotar, falhar, pagina }) {
    await abrir('/index.html', { tela: 'jogando', seed: SEED, rapido: 1 });
    await pagina.waitForSelector('body[data-pronto="1"]', { timeout: 10_000 });
    await esperar(250);
    await print('mesa-inicial');

    const botaoHit = pagina.locator('#botao-hit');
    const botaoStay = pagina.locator('#botao-stay');
    const fase = () => pagina.getAttribute('body', 'data-fase');

    if (await botaoHit.isDisabled()) falhar('HIT deveria estar habilitado no início da rodada.');
    await botaoHit.click();
    await esperar(250);
    anotar(`fase após HIT: ${await fase()}`);
    await print('apos-hit');

    // STAY até a rodada acabar (o oponente pode comprar e devolver a vez).
    for (let i = 0; i < 10 && (await fase()) === 'jogando'; i++) {
      await botaoStay.click();
      await esperar(150);
    }
    const faseFinal = await fase();
    if (faseFinal === 'jogando') falhar('A rodada não terminou depois de 10 STAY.');
    await esperar(250);
    await print('resultado-rodada');

    const temProxima = await pagina.locator('#botao-proxima').isVisible();
    anotar(`fase final: ${faseFinal}; botão "próxima rodada" ${temProxima ? 'visível' : 'oculto'}`);
  },
};
