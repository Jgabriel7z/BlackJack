// Roteiro de captura do sub-passo 4.4a — as cartas trunfo que faltavam.
//
// As onze cartas novas entram no sorteio como qualquer outra, então
// esperar que elas caiam na mão seria loteria. O roteiro usa o
// `?trunfos=`, que existe desde o 2.3 justamente para isto: fixa a mão
// da primeira rodada e joga uma por uma, fotografando o efeito.
//
// A ordem importa: a Harvest entra primeiro, porque ela só paga as
// cartas jogadas DEPOIS dela.

const SEED = 7;
const MAO = 'harvest,exchange,ultimate_draw,destroy_plus_plus';

export default {
  descricao: 'Cartas trunfo novas: Harvest, Exchange, Ultimate Draw e Destroy++ jogadas em sequência',
  video: true,

  async executar({ abrir, print, esperar, anotar, falhar, pagina }) {
    const atributo = (nome) => pagina.getAttribute('body', nome);
    const numero = async (nome) => Number(await atributo(nome));

    const esperarOcioso = async (passos = 400) => {
      for (let i = 0; i < passos; i++) {
        if ((await atributo('data-animacao')) === 'ocioso') return;
        await esperar(90);
      }
      falhar('A fila de animações não esvaziou.');
    };

    /** Quais cartas estão na minha mão agora. */
    const maoAtual = async () => (await atributo('data-trunfo-slots'))
      .split(';').filter(Boolean).map((p) => p.split('@')[0]);

    /** Clica na carta `id` da mão, pela posição que o próprio jogo publica. */
    const jogarCarta = async (id) => {
      const slots = (await atributo('data-trunfo-slots')).split(';').filter(Boolean);
      const alvo = slots.find((p) => p.startsWith(`${id}@`));
      if (!alvo) falhar(`A carta ${id} não está na mão: ${slots.join(' ')}`);
      const [x, y] = alvo.split('@')[1].split(',').map(Number);
      await pagina.mouse.click(x, y);
      await esperar(250);
    };

    await abrir('/index.html', { tela: 'jogando', seed: SEED, rapido: 1, trunfos: MAO });
    await pagina.waitForSelector('body[data-pronto="1"]', { timeout: 10_000 });
    await esperarOcioso();
    await esperar(300);

    const mao = await maoAtual();
    anotar(`mão fixada pela URL: ${mao.join(', ')}`);
    for (const id of MAO.split(',')) {
      if (!mao.includes(id)) falhar(`${id} deveria estar na mão, e não está.`);
    }
    await print('mao-com-as-cartas-novas');

    // --- Harvest: fica na mesa e paga as próximas ---------------------
    await jogarCarta('harvest');
    await esperarOcioso();
    await esperar(300);
    if (!(await atributo('data-trunfos-na-mesa')).includes('harvest')) {
      falhar('A Harvest deveria ter ficado na mesa.');
    }
    await print('harvest-na-mesa');
    anotar('Harvest na mesa: daqui para a frente cada carta jogada devolve outra');

    // --- Exchange: troca a última carta virada de cada lado -----------
    const totalAntes = await numero('data-meu-total');
    const maoAntes = (await maoAtual()).length;
    await jogarCarta('exchange');
    await esperarOcioso();
    await esperar(400);
    const totalDepois = await numero('data-meu-total');
    anotar(`Exchange: minha mão foi de ${totalAntes} para ${totalDepois}`);
    if (totalDepois === totalAntes) falhar('A troca de cartas não mudou o total da mão.');
    await print('exchange-trocou-as-cartas');

    // A Harvest já devia ter pago: joguei uma carta e ganhei outra.
    const maoDepois = (await maoAtual()).length;
    anotar(`mão: ${maoAntes} cartas antes do Exchange, ${maoDepois} depois (a Harvest devolveu uma)`);
    if (maoDepois !== maoAntes) falhar(`A Harvest deveria ter reposto a carta: ${maoAntes} → ${maoDepois}.`);

    // --- Ultimate Draw: melhor carta do baralho e mais dois trunfos ---
    const antesDoUltimate = (await maoAtual()).length;
    await jogarCarta('ultimate_draw');
    await esperarOcioso();
    await esperar(400);
    const depoisDoUltimate = (await maoAtual()).length;
    anotar(`Ultimate Draw: total ${await atributo('data-meu-total')}, mão de ${antesDoUltimate} para ${depoisDoUltimate} cartas`);
    if (depoisDoUltimate <= antesDoUltimate) falhar('O Ultimate Draw deveria ter enchido a mão.');
    await print('ultimate-draw');

    // --- Destroy++: limpa a mesa dele e tranca os trunfos dele --------
    await jogarCarta('destroy_plus_plus');
    await esperarOcioso();
    await esperar(400);
    if (!(await atributo('data-trunfos-na-mesa')).includes('destroy_plus_plus')) {
      falhar('O Destroy++ deveria ter ficado na mesa.');
    }
    await print('destroy-mais-mais');
    anotar('Destroy++ na mesa: o oponente fica sem cartas e sem poder jogar trunfo');

    // --- E a rodada segue normal --------------------------------------
    for (let i = 0; i < 300; i++) {
      if ((await atributo('data-fase')) !== 'jogando') break;
      if ((await atributo('data-animacao')) !== 'ocioso') { await esperar(90); continue; }
      const total = await numero('data-meu-total');
      if (total < 17) await pagina.locator('#botao-hit').click();
      else await pagina.locator('#botao-stay').click();
    }
    await esperarOcioso(600);
    await esperar(400);
    anotar(`fim da rodada com as cartas novas: ${await atributo('data-pontos')} pontos`);
    await print('rodada-resolvida');
  },
};
