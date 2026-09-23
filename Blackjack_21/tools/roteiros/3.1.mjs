// Roteiro de captura do sub-passo 3.1 — o laço de telas.
//
// Ninguém mexe em nada: o roteiro só observa a tela trocar sozinha,
// título → attract → melhores pontuações → título, e confere que o laço
// fecha pelo menos duas voltas. Com ?rapido=1 os tempos do config são
// multiplicados por 0,05, então a volta inteira leva uns 2 s.
//
// No fim, uma tecla no título leva à mesa, para mostrar que a tela de
// jogo continua ali.

export default {
  descricao: 'Laço de telas sozinho: título, attract, pontuações e de volta ao título',
  video: true,

  async executar({ abrir, print, esperar, anotar, falhar, pagina }) {
    const telaAtual = () => pagina.getAttribute('body', 'data-tela');

    await abrir('/index.html', { rapido: 1 });
    await pagina.waitForSelector('body[data-pronto="1"]', { timeout: 10_000 });
    if ((await telaAtual()) !== 'titulo') falhar('O jogo deveria abrir no título.');

    const vistas = [];
    const fotografadas = new Set();
    let anterior = null;

    // Observa o laço por tempo suficiente para fechar umas três voltas.
    for (let passo = 0; passo < 900; passo++) {
      const tela = await telaAtual();
      if (tela !== anterior) {
        vistas.push(tela);
        anterior = tela;
        if (!fotografadas.has(tela)) {
          await esperar(140);   // deixa a tela assentar antes do print
          await print(`tela-${tela}`);
          fotografadas.add(tela);
        }
      }
      if (vistas.filter((t) => t === 'titulo').length >= 3) break;
      await esperar(40);
    }

    anotar(`ordem das telas: ${vistas.join(' -> ')}`);

    // A primeira volta tem de ser exatamente a do diagrama do plano.
    const esperado = ['titulo', 'attract', 'high_scores', 'titulo'];
    const inicio = vistas.slice(0, 4);
    if (inicio.join(',') !== esperado.join(',')) {
      falhar(`Laço fora de ordem. Esperava ${esperado.join(' -> ')}, veio ${inicio.join(' -> ')}.`);
    }
    const voltas = vistas.filter((t) => t === 'titulo').length;
    if (voltas < 2) falhar(`O laço deveria fechar pelo menos 2 voltas, fechou ${voltas}.`);
    anotar(`voltas ao título: ${voltas}`);

    // Uma tecla no título começa o jogo: a tela de jogo é a mesa de sempre.
    for (let passo = 0; passo < 200 && (await telaAtual()) !== 'titulo'; passo++) await esperar(40);
    await pagina.keyboard.press('Space');
    await pagina.waitForSelector('body[data-tela="jogando"]', { timeout: 10_000 });
    await pagina.waitForSelector('body[data-animacao="ocioso"]', { timeout: 20_000 });
    await esperar(250);
    await print('tela-jogando');
    anotar('uma tecla no título leva à mesa');
  },
};
