// Roteiro de captura do sub-passo 2.3 — cartas trunfo na tela.
// A mão inicial vem fixa pela URL (?trunfos=...), então a captura não
// depende de sorte. Joga Two-Up, Shield e Go for 24, com print depois de
// cada uma, e um print com a descrição aberta no mouse.

const SEED = 41;
const MAO = ['two_up', 'shield', 'go_for_24'];

export default {
  descricao: `Mão de trunfos, cartas na mesa, dica no mouse e o estalo da placa (seed ${SEED})`,
  video: true,

  async executar({ abrir, print, esperar, anotar, falhar, pagina }) {
    const atributo = (nome) => pagina.getAttribute('body', nome);
    const esperarOcioso = (timeout = 30_000) =>
      pagina.waitForSelector('body[data-animacao="ocioso"]', { timeout });

    /** Centro da carta `id` na mão, lido do próprio jogo. */
    const posicaoDe = async (id) => {
      const slots = (await atributo('data-trunfo-slots')) ?? '';
      const achado = slots.split(';').map((s) => s.trim()).find((s) => s.startsWith(`${id}@`));
      if (!achado) falhar(`A carta ${id} não está na mão. Mão atual: ${slots}`);
      const [x, y] = achado.split('@')[1].split(',').map(Number);
      return { x, y };
    };

    await abrir('/index.html', { seed: SEED, trunfos: MAO.join(',') });
    await pagina.waitForSelector('body[data-pronto="1"]', { timeout: 10_000 });
    await esperarOcioso();
    await esperar(300);
    anotar(`mão inicial: ${await atributo('data-trunfo-slots')}`);
    await print('mao-de-trunfos');

    // Descrição no mouse, sobre a primeira carta.
    const pTwoUp = await posicaoDe('two_up');
    await pagina.mouse.move(pTwoUp.x, pTwoUp.y);
    await esperar(250);
    await print('dica-no-mouse');

    // 1) Two-Up: sobe a aposta dele e fica na mesa.
    await pagina.mouse.click(pTwoUp.x, pTwoUp.y);
    await esperarOcioso();
    await esperar(300);
    anotar(`depois do Two-Up, na minha mesa: ${await atributo('data-trunfos-na-mesa')}`);
    await print('jogou-two-up');

    // 2) Shield: reduz a minha aposta.
    const pShield = await posicaoDe('shield');
    await pagina.mouse.click(pShield.x, pShield.y);
    await esperarOcioso();
    await esperar(300);
    await print('jogou-shield');

    // 3) Go for 24: a placa do alvo troca com estalo.
    const pGoFor = await posicaoDe('go_for_24');
    const alvoAntes = await atributo('data-alvo');
    await pagina.mouse.click(pGoFor.x, pGoFor.y);
    await pagina.waitForSelector('body[data-animacao="trocando-alvo"]', { timeout: 20_000 });
    await esperar(330); // no meio da virada
    await print('estalo-da-placa');
    await esperarOcioso();
    await esperar(300);
    await print('jogou-go-for-24');

    const alvoDepois = await atributo('data-alvo');
    anotar(`alvo: ${alvoAntes} -> ${alvoDepois}`);
    if (alvoDepois !== '24') falhar(`O alvo deveria ser 24, está ${alvoDepois}.`);
    const naMesa = await atributo('data-trunfos-na-mesa');
    if (naMesa !== 'two_up,shield,go_for_24') falhar(`Mesa inesperada: ${naMesa}`);
  },
};
