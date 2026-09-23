// Roteiro de captura do sub-passo 4.8 — a trapaça do anfitrião.
//
// Parte 1, em velocidade normal: o jogador empurra a serra até ela ficar
// a uma derrota do Luiz Alberto, e aí o Kaio não deixa a mesa acabar —
// a luz vira, a televisão grita, a música para e ele joga Perfect Draw e
// Desperation pelo oponente. A saída estava na mão desde o começo do
// nível: o Love Your Enemy obriga o Luiz a comprar mais uma carta, e a
// mão que o Perfect Draw fechou estoura.
//
// O outro caminho (matar o Luiz antes e a trapaça nunca acontecer) fica
// nos testes: ele depende de jogar as cartas de aumentar aposta na
// rodada exata, e numa captura isso vira loteria.
//
// Seed 44 no nível 3: o jogador vence as primeiras rodadas e a trapaça
// arma na rodada 4.

const SEED = 44;

export default {
  descricao: `A trapaça do anfitrião e a virada com o Love Your Enemy (seed ${SEED}, nível 3)`,
  video: true,

  async executar({ abrir, print, esperar, anotar, falhar, pagina }) {
    const atributo = (nome) => pagina.getAttribute('body', nome);
    const numero = async (nome) => Number(await atributo(nome));

    const esperarOcioso = async (passos = 600) => {
      for (let i = 0; i < passos; i++) {
        if ((await atributo('data-animacao')) === 'ocioso') return;
        await esperar(100);
      }
      falhar('A fila de animações não esvaziou.');
    };

    const naMao = async () => (await atributo('data-trunfo-slots'))
      .split(';').filter(Boolean).map((p) => p.split('@')[0]);

    const jogarCarta = async (id) => {
      const slots = (await atributo('data-trunfo-slots')).split(';').filter(Boolean);
      const alvo = slots.find((p) => p.startsWith(`${id}@`));
      if (!alvo) falhar(`A carta ${id} não está na mão: ${slots.join(' ')}`);
      const [x, y] = alvo.split('@')[1].split(',').map(Number);
      await pagina.mouse.click(x, y);
      await esperar(300);
    };

    // ==================================================================
    //  Parte 1 — a trapaça acontece, e é virada
    // ==================================================================
    await abrir('/index.html', { tela: 'jogando', seed: SEED, nivel: 3 });
    await pagina.waitForSelector('body[data-pronto="1"]', { timeout: 10_000 });
    await esperarOcioso();
    await esperar(300);

    if (!(await naMao()).includes('love_your_enemy')) {
      falhar('A carta da saída deveria estar na mão desde o começo do nível 3.');
    }
    anotar(`começo do nível 3: serra em ${await atributo('data-serra')}, com o Love Your Enemy na mão`);
    await print('a-carta-da-saida-ja-esta-na-mao');

    // Joga normalmente (sem usar trunfos) até a trapaça armar.
    let armou = false;
    for (let i = 0; i < 2500 && !armou; i++) {
      if ((await atributo('data-animacao')) === 'trapaca') { armou = true; break; }
      if ((await atributo('data-tela')) !== 'jogando') break;
      if ((await atributo('data-animacao')) !== 'ocioso') { await esperar(100); continue; }
      const fase = await atributo('data-fase');
      if (fase === 'fim_de_jogo') break;
      if (fase === 'rodada_encerrada') { await pagina.locator('#botao-proxima').click(); continue; }
      if (fase !== 'jogando') { await esperar(100); continue; }
      const total = await numero('data-meu-total');
      if (total < 17) await pagina.locator('#botao-hit').click();
      else await pagina.locator('#botao-stay').click();
    }
    if (!armou) falhar(`A trapaça não armou. Serra em ${await atributo('data-serra')}.`);
    anotar(`a serra chegou a ${await atributo('data-serra')} e o anfitrião interveio`);

    await esperar(1500);
    await print('a-luz-vira-e-a-tv-grita');
    await esperar(2600);
    await print('kaio-trapaceando');
    await esperar(3200);
    await print('as-cartas-do-anfitriao-na-mesa');

    await esperarOcioso();
    await esperar(400);
    if ((await atributo('data-trapaca')) !== '1') falhar('A trapaça deveria estar marcada.');
    anotar(`depois da trapaça: aposta do jogador e do oponente nas alturas, e a compra travada`);
    await print('a-mesa-depois-da-trapaca');

    // A virada: o Love Your Enemy obriga o Luiz a comprar mais uma.
    await jogarCarta('love_your_enemy');
    await esperarOcioso();
    await esperar(600);
    await print('love-your-enemy-jogada');
    anotar('Love Your Enemy: o oponente é obrigado a comprar, e a mão fechada dele estoura');

    // Agora é só parar.
    for (let i = 0; i < 600; i++) {
      if ((await atributo('data-tela')) !== 'jogando') break;
      if ((await atributo('data-animacao')) !== 'ocioso') { await esperar(100); continue; }
      const fase = await atributo('data-fase');
      if (fase === 'fim_de_jogo') break;
      if (fase === 'rodada_encerrada') { await pagina.locator('#botao-proxima').click(); continue; }
      if (fase !== 'jogando') { await esperar(100); continue; }
      await pagina.locator('#botao-stay').click();
    }
    await esperar(1200);
    await print('a-virada');
    anotar(`fim: ${await atributo('data-pontos')} pontos, serra em ${await atributo('data-serra')}`);

    // O outro caminho — matar o Luiz antes, e a trapaça nunca acontecer —
    // é o que os testes `trapaca.test.js` cobrem, porque depende de jogar
    // as cartas de aumentar aposta na rodada exata: numa captura isso
    // vira loteria, e num teste é uma linha.
  },
};
