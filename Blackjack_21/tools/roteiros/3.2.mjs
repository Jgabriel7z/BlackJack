// Roteiro de captura do sub-passo 3.2 — a tela de título.
//
// Em velocidade normal, para o vídeo mostrar a televisão acendendo: a
// linha branca abrindo, a imagem crescendo, o chiado sumindo e o título
// se firmando. Depois, uma tecla começa o jogo.

export default {
  descricao: 'Tela de título: a televisão acendendo, o título pronto e a primeira tecla',
  video: true,

  async executar({ abrir, print, esperar, anotar, falhar, pagina }) {
    const atributo = (nome) => pagina.getAttribute('body', nome);

    await abrir('/index.html');
    await pagina.waitForSelector('body[data-pronto="1"]', { timeout: 10_000 });
    if ((await atributo('data-tela')) !== 'titulo') falhar('Deveria abrir no título.');

    // Três instantes do tubo acendendo. O roteiro espera pela FASE em vez
    // de cravar tempos: entre o carregamento e o primeiro quadro passa um
    // tempo que varia de máquina para máquina.
    for (const fase of ['linha', 'abrindo', 'surgindo']) {
      await pagina.waitForSelector(`body[data-titulo-fase="${fase}"]`, { timeout: 15_000 });
      await esperar(90);   // deixa a fase avançar um tico antes do print
      await print(`tv-acendendo-${fase}`);
    }

    // Com o tubo estável, o título pronto. O convite pisca, então o
    // roteiro tira dois prints separados por meio ciclo para garantir um
    // com o texto aceso.
    await pagina.waitForSelector('body[data-titulo-pronto="1"]', { timeout: 10_000 });
    await esperar(200);
    await print('titulo-pronto');
    await esperar(1100);
    await print('titulo-convite-no-outro-tempo');
    anotar('título pronto: convite piscando, assinatura da equipe no rodapé');

    // Qualquer tecla começa o jogo.
    await pagina.keyboard.press('Enter');
    await pagina.waitForSelector('body[data-tela="jogando"]', { timeout: 10_000 });
    anotar('a tecla levou para a tela de jogo');
    await pagina.waitForSelector('body[data-animacao="ocioso"]', { timeout: 30_000 });
    await esperar(250);
    await print('depois-da-tecla');

    if ((await atributo('data-rodada')) !== '1') falhar('A partida deveria começar na rodada 1.');
    if ((await atributo('data-pontos')) !== '0') falhar('A partida deveria começar zerada.');
  },
};
