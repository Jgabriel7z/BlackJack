// Roteiro de captura do sub-passo 2.5 — a IA por nível.
// Vídeo curto do Luiz Alberto no nível 3 jogando uma carta trunfo.
// O jogador entra com Two-Up na mesa de propósito: é a carta perigosa
// que faz a IA do nível 3 gastar o Destroy que ela estava guardando.

const SEED = 21;
const MINHA_MAO = ['two_up'];

export default {
  descricao: `Luiz Alberto no nível 3 usando carta trunfo (seed ${SEED})`,
  video: true,

  async executar({ abrir, print, esperar, anotar, falhar, pagina }) {
    const atributo = (nome) => pagina.getAttribute('body', nome);

    const esperarOcioso = async (passos = 400) => {
      for (let i = 0; i < passos; i++) {
        if ((await atributo('data-animacao')) === 'ocioso') return;
        await esperar(120);
      }
      falhar('A fila de animações não esvaziou.');
    };

    await abrir('/index.html', { seed: SEED, nivel: 3, trunfos: MINHA_MAO.join(',') });
    await pagina.waitForSelector('body[data-pronto="1"]', { timeout: 10_000 });
    await esperarOcioso();
    await esperar(300);
    anotar(`nível ${await atributo('data-nivel')}, serra na marca ${await atributo('data-serra')}`);
    await print('nivel-3-antes');

    // Jogo o Two-Up: encarece a aposta dele e vira a ameaça na mesa.
    const slots = (await atributo('data-trunfo-slots')) ?? '';
    const meu = slots.split(';').find((s) => s.startsWith('two_up@'));
    if (!meu) falhar(`Two-Up não está na minha mão. Mão: ${slots}`);
    const [x, y] = meu.split('@')[1].split(',').map(Number);
    await pagina.mouse.click(x, y);
    await esperarOcioso();
    await esperar(300);
    await print('joguei-two-up');

    // Agora é a vez dele: a IA do nível 3 deve responder com o Destroy.
    await pagina.locator('#botao-stay').click();

    let viuTrunfoDele = false;
    for (let i = 0; i < 400 && !viuTrunfoDele; i++) {
      const animacao = await atributo('data-animacao');
      if (animacao === 'jogando-trunfo') {
        await esperar(260);   // a carta dele no meio do voo
        await print('luiz-jogando-trunfo');
        viuTrunfoDele = true;
        break;
      }
      if (animacao === 'ocioso') {
        const fase = await atributo('data-fase');
        if (fase !== 'jogando') break;
        const total = Number(await atributo('data-meu-total'));
        if (total < 17) await pagina.locator('#botao-hit').click();
        else await pagina.locator('#botao-stay').click();
        continue;
      }
      await esperar(100);
    }
    if (!viuTrunfoDele) falhar('O Luiz Alberto não jogou nenhuma carta trunfo.');

    await esperar(900);
    await print('depois-do-trunfo-dele');
    const naMinhaMesa = await atributo('data-trunfos-na-mesa');
    anotar(`na minha mesa depois da resposta dele: "${naMinhaMesa}"`);
    if (naMinhaMesa.includes('two_up')) {
      falhar('O Destroy dele deveria ter tirado o meu Two-Up da mesa.');
    }
  },
};
