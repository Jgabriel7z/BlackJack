// Captura final da Etapa 3 — o ciclo de fliperama inteiro, numa tacada.
//
// Em velocidade normal, sem ?rapido e sem ?tela: o jogo abre no título,
// como abre para quem chega nele. O roteiro dá uma tecla, joga a partida
// até o fim e depois LARGA o teclado: daí em diante tudo o que acontece
// acontece sozinho — GAME OVER, as três letras, a lista das melhores, a
// volta ao título, a demonstração e a lista de novo.
//
// Seed 177, achada com uma busca que replica o que o roteiro clica: João
// Gabriel perde no nível 1 em 3 rodadas, mas vence uma delas e fecha com
// 175 pontos. Precisa pontuar: é o que faz a tela de assinar aparecer.
//
// Saída: progresso/etapa-3/final/

const SEED = 177;
const PONTOS_ESPERADOS = '175';
const INICIAIS = 'joa';

export default {
  descricao: `Ciclo completo: título, partida, GAME OVER, iniciais, melhores, título e o laço sozinho (seed ${SEED})`,
  video: true,

  async executar({ abrir, print, esperar, anotar, falhar, pagina }) {
    const atributo = (nome) => pagina.getAttribute('body', nome);

    /** Espera a tela virar `alvo`, anotando quanto tempo levou sozinha. */
    const esperarTela = async (alvo, limite = 40_000) => {
      const comecou = Date.now();
      await pagina.waitForSelector(`body[data-tela="${alvo}"]`, { timeout: limite });
      return ((Date.now() - comecou) / 1000).toFixed(1);
    };

    // ------------------------------------------------------------------
    //  1. O jogo abre no título
    // ------------------------------------------------------------------
    await abrir('/index.html', { seed: SEED });
    await pagina.waitForSelector('body[data-pronto="1"]', { timeout: 10_000 });
    if ((await atributo('data-tela')) !== 'titulo') falhar('O jogo tem de abrir no título.');

    await pagina.waitForSelector('body[data-titulo-fase="surgindo"]', { timeout: 15_000 });
    await esperar(500);
    await print('titulo-acendendo');
    await pagina.waitForSelector('body[data-titulo-pronto="1"]', { timeout: 15_000 });
    await esperar(300);
    await print('titulo-pronto');

    // ------------------------------------------------------------------
    //  2. Uma tecla e a partida
    // ------------------------------------------------------------------
    await pagina.keyboard.press('Space');
    await esperarTela('jogando', 10_000);
    await pagina.waitForSelector('body[data-animacao="ocioso"]', { timeout: 30_000 });
    await esperar(250);
    await print('mesa-rodada-1');
    anotar(`partida começou: rodada ${await atributo('data-rodada')}, ${await atributo('data-pontos')} pontos`);

    let fotografouPunicao = false;
    for (let passo = 0; passo < 2500; passo++) {
      if ((await atributo('data-tela')) !== 'jogando') break;
      const animacao = await atributo('data-animacao');

      if (animacao === 'punicao' && !fotografouPunicao) {
        await esperar(600);   // a lâmina encostando: tremor e clarão
        await print('a-guilhotina-desce');
        fotografouPunicao = true;
        continue;
      }
      if (animacao !== 'ocioso') { await esperar(100); continue; }

      const fase = await atributo('data-fase');
      if (fase === 'fim_de_jogo') { await esperar(100); continue; }
      if (fase === 'rodada_encerrada') { await pagina.locator('#botao-proxima').click(); continue; }
      if (fase !== 'jogando') { await esperar(100); continue; }
      const total = Number(await atributo('data-meu-total'));
      if (total < 17) await pagina.locator('#botao-hit').click();
      else await pagina.locator('#botao-stay').click();
    }
    if (!fotografouPunicao) falhar('Nenhuma punição apareceu na partida.');

    // ------------------------------------------------------------------
    //  3. Daqui em diante ninguém mexe em nada (menos as três letras)
    // ------------------------------------------------------------------
    await esperarTela('game_over', 20_000);
    await esperar(600);
    const pontos = await atributo('data-pontos');
    anotar(`fim da partida: ${pontos} pontos, ${await atributo('data-meus-dedos')} dedos`);
    if (pontos !== PONTOS_ESPERADOS) {
      falhar(`A seed ${SEED} deveria fechar com ${PONTOS_ESPERADOS} pontos, deu ${pontos}.`);
    }
    await print('game-over');

    const ateIniciais = await esperarTela('iniciais', 20_000);
    anotar(`o GAME OVER passou a vez para as iniciais em ${ateIniciais} s, sozinho`);
    await esperar(400);
    for (const letra of INICIAIS) {
      await pagina.keyboard.press(letra);
      await esperar(220);
    }
    if ((await atributo('data-iniciais')) !== INICIAIS.toUpperCase()) {
      falhar(`Digitei ${INICIAIS.toUpperCase()} e a tela mostra ${await atributo('data-iniciais')}.`);
    }
    await print('digitando-as-iniciais');
    await pagina.keyboard.press('Enter');

    await esperarTela('high_scores', 10_000);
    await esperar(400);
    const tabela = await atributo('data-placar');
    anotar(`lista das melhores: ${tabela}`);
    if (tabela !== `${INICIAIS.toUpperCase()}:${PONTOS_ESPERADOS}`) {
      falhar(`A lista deveria ter só ${INICIAIS.toUpperCase()}:${PONTOS_ESPERADOS}, tem "${tabela}".`);
    }
    await print('melhores-pontuacoes');

    const ateTitulo = await esperarTela('titulo', 20_000);
    anotar(`a lista devolveu o título em ${ateTitulo} s, sozinha`);
    await pagina.waitForSelector('body[data-titulo-pronto="1"]', { timeout: 20_000 });
    await esperar(300);
    await print('de-volta-ao-titulo');

    // ------------------------------------------------------------------
    //  4. O laço, com o teclado largado
    // ------------------------------------------------------------------
    const ateAttract = await esperarTela('attract', 30_000);
    anotar(`o título chamou a demonstração em ${ateAttract} s`);
    if ((await atributo('data-demonstracao')) !== '1') falhar('A demonstração não começou.');
    await esperar(6000);
    await print('demonstracao-no-laco');

    const ateMelhores = await esperarTela('high_scores', 40_000);
    anotar(`a demonstração passou a vez para a lista em ${ateMelhores} s`);
    await esperar(400);
    if ((await atributo('data-placar')) !== `${INICIAIS.toUpperCase()}:${PONTOS_ESPERADOS}`) {
      falhar('A demonstração mexeu na lista das melhores.');
    }
    await print('melhores-no-laco');

    const fechouOLaco = await esperarTela('titulo', 20_000);
    anotar(`o laço fechou: a lista devolveu o título em ${fechouOLaco} s`);
    anotar('ciclo completo: título → partida → GAME OVER → iniciais → melhores → título → demonstração → melhores → título');
  },
};
