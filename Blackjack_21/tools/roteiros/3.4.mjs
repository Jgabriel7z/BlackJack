// Roteiro de captura do sub-passo 3.4 — as cinco melhores da sessão.
//
// Duas partidas na MESMA página (a tabela vive na memória: recarregar
// apagaria tudo). Como a seed é a mesma, o que muda o resultado é o jeito
// de jogar, igual ao roteiro do 2.6:
//   Partida 1: compra só abaixo de 14, joga mal e morre na serra.
//   Partida 2: compra abaixo de 17, a regra da IA, e sai inteiro.
// Assim a captura passa pelos dois caminhos que levam às iniciais: o do
// GAME OVER e o da vitória, em que o anfitrião se despede antes. No fim o
// roteiro larga o jogo sozinho e espera a tabela aparecer de novo pelo
// laço do título.
//
// Seed 44 no nível 3 é a mesma do 3.3, achada com `simular.mjs --fiel`.

const SEED = 44;
const NIVEL = 3;

export default {
  descricao: `Melhores pontuações: uma derrota e uma vitória, iniciais digitadas e a tabela no laço do título (seed ${SEED}, nível ${NIVEL})`,
  video: true,

  async executar({ abrir, print, esperar, anotar, falhar, pagina }) {
    const atributo = (nome) => pagina.getAttribute('body', nome);

    const esperarOcioso = async (passos = 600) => {
      for (let i = 0; i < passos; i++) {
        if ((await atributo('data-animacao')) === 'ocioso') return;
        await esperar(110);
      }
      falhar('A fila de animações não esvaziou.');
    };

    /** Joga até sair da mesa, comprando enquanto o total estiver abaixo de `limite`. */
    const jogarPartida = async (limite, passos = 2500) => {
      for (let i = 0; i < passos; i++) {
        if ((await atributo('data-tela')) !== 'jogando') return;
        if ((await atributo('data-animacao')) !== 'ocioso') { await esperar(100); continue; }

        const fase = await atributo('data-fase');
        if (fase === 'fim_de_jogo') { await esperar(100); continue; }
        if (fase === 'rodada_encerrada') { await pagina.locator('#botao-proxima').click(); continue; }
        if (fase !== 'jogando') { await esperar(100); continue; }
        const total = Number(await atributo('data-meu-total'));
        if (total < limite) await pagina.locator('#botao-hit').click();
        else await pagina.locator('#botao-stay').click();
      }
      falhar('A partida não terminou.');
    };

    /**
     * Volta à mesa a partir de qualquer tela de espera. Com o ?rapido=1 o
     * laço anda depressa, então não dá para supor em que tela a tecla vai
     * cair: aperta e confere até a partida começar.
     */
    const comecarPartida = async () => {
      for (let i = 0; i < 300; i++) {
        const tela = await atributo('data-tela');
        if (tela === 'jogando') return;
        await pagina.keyboard.press('Space');
        await esperar(90);
      }
      falhar('Não consegui começar uma partida nova.');
    };

    /** Digita as três letras e confirma com ENTER. */
    const digitar = async (letras) => {
      for (const letra of letras) {
        await pagina.keyboard.press(letra);
        await esperar(180);
      }
      const escrito = await atributo('data-iniciais');
      if (escrito !== letras.toUpperCase()) {
        falhar(`Digitei ${letras.toUpperCase()} e a tela mostra ${escrito}.`);
      }
    };

    // ------------------------------------------------------------------
    //  Partida 1: jogando mal de propósito
    // ------------------------------------------------------------------
    await abrir('/index.html', { tela: 'jogando', seed: SEED, nivel: NIVEL, rapido: 1 });
    await pagina.waitForSelector('body[data-pronto="1"]', { timeout: 10_000 });
    await esperarOcioso();

    await jogarPartida(14);
    await pagina.waitForSelector('body[data-tela="iniciais"]', { timeout: 30_000 });
    await esperar(300);
    const pontos1 = Number(await atributo('data-pontos'));
    anotar(`partida 1 (comprando abaixo de 14): ${pontos1} pontos, entrou na lista`);
    if (pontos1 <= 0) falhar('A partida 1 não pontuou; escolha outra seed.');
    await print('iniciais-em-branco');

    await digitar('lui');
    await print('iniciais-digitadas');
    await pagina.keyboard.press('Enter');

    await pagina.waitForSelector('body[data-tela="high_scores"]', { timeout: 10_000 });
    await esperar(300);
    anotar(`tabela depois da partida 1: ${await atributo('data-placar')}`);
    await print('tabela-com-uma-linha');

    // ------------------------------------------------------------------
    //  Partida 2: jogando pela regra da IA, para passar da primeira
    // ------------------------------------------------------------------
    await comecarPartida();
    await esperarOcioso();
    if (Number(await atributo('data-pontos')) !== 0) falhar('A partida nova deveria começar zerada.');

    await jogarPartida(17);
    await pagina.waitForSelector('body[data-tela="iniciais"]', { timeout: 60_000 });
    await esperar(300);
    const pontos2 = Number(await atributo('data-pontos'));
    anotar(`partida 2 (comprando abaixo de 17): ${pontos2} pontos`);
    if (pontos2 <= pontos1) falhar(`A partida 2 deveria render mais: ${pontos2} contra ${pontos1}.`);
    if ((await atributo('data-iniciais')) !== 'LUI') {
      falhar('A tela deveria abrir já com as letras da partida anterior.');
    }
    if (!(await atributo('data-placar')).startsWith('LUI')) falhar('A lista perdeu a partida 1.');
    await print('iniciais-lembram-a-partida-anterior');

    await digitar('joa');
    await pagina.keyboard.press('Enter');
    await pagina.waitForSelector('body[data-tela="high_scores"]', { timeout: 10_000 });
    await esperar(300);

    const tabela = await atributo('data-placar');
    anotar(`tabela depois da partida 2: ${tabela}`);
    if (tabela !== `JOA:${pontos2};LUI:${pontos1}`) {
      falhar(`A tabela deveria ser JOA:${pontos2};LUI:${pontos1}, e é ${tabela}.`);
    }
    await print('tabela-com-as-duas');
    await esperar(450);
    await print('tabela-linha-nova-piscando');

    // ------------------------------------------------------------------
    //  O laço: ninguém mexe e a tabela volta sozinha
    // ------------------------------------------------------------------
    await pagina.waitForSelector('body[data-tela="titulo"]', { timeout: 20_000 });
    anotar('sem ninguém mexer, a tabela saiu e o título voltou');

    const vistas = [];
    let voltou = false;
    for (let i = 0; i < 1200; i++) {
      const tela = await atributo('data-tela');
      if (vistas[vistas.length - 1] !== tela) vistas.push(tela);
      if (tela === 'high_scores') { voltou = true; break; }
      await esperar(40);
    }
    if (!voltou) falhar(`A tabela não voltou pelo laço. Telas vistas: ${vistas.join(' → ')}`);
    await print('tabela-de-volta-pelo-laco');
    anotar(`laço observado: ${vistas.join(' → ')}`);
  },
};
