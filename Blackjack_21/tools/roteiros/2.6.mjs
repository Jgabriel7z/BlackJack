// Roteiro de captura do sub-passo 2.6 — recorde da sessão.
//
// Duas partidas seguidas, sem recarregar a página (o recorde vive na
// memória e sobrevive ao "jogar de novo", mas não a um reload).
//   Partida 1: o roteiro joga mal de propósito, comprando só abaixo de
//     11, para fechar com pontuação baixa e deixar um recorde modesto.
//   Partida 2: joga com a regra da IA (até 17) e passa daquele valor,
//     e é aí que o visor RECORDE pisca.

const SEED = 21;

export default {
  descricao: `Recorde da sessão: duas partidas, a segunda batendo o recorde (seed ${SEED})`,
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

    /**
     * Joga uma partida inteira até a tela final, comprando enquanto o
     * total estiver abaixo de `limite`. Devolve os pontos do fim.
     */
    const jogarPartida = async (limite, passos = 2000) => {
      for (let i = 0; i < passos; i++) {
        const animacao = await atributo('data-animacao');
        if (animacao !== 'ocioso') { await esperar(110); continue; }

        const fase = await atributo('data-fase');
        if (fase === 'fim_de_jogo') return Number(await atributo('data-pontos'));
        if (fase === 'rodada_encerrada') { await pagina.locator('#botao-proxima').click(); continue; }
        const total = Number(await atributo('data-meu-total'));
        if (total < limite) await pagina.locator('#botao-hit').click();
        else await pagina.locator('#botao-stay').click();
      }
      falhar('A partida não terminou.');
      return 0;
    };

    await abrir('/index.html', { seed: SEED });
    await pagina.waitForSelector('body[data-pronto="1"]', { timeout: 10_000 });
    await esperarOcioso();
    await esperar(300);
    anotar(`começo: pontos ${await atributo('data-pontos')}, recorde ${await atributo('data-recorde')}`);
    await print('visores-zerados');

    // ---- Partida 1: jogando mal, para deixar um recorde baixo ----
    const pontos1 = await jogarPartida(11);
    await esperarOcioso();
    await esperar(400);
    const recorde1 = Number(await atributo('data-recorde'));
    anotar(`partida 1 (comprando abaixo de 11): ${pontos1} pontos, recorde ${recorde1}`);
    if (recorde1 <= 0) falhar('A primeira partida não pontuou; escolha outra seed.');
    if ((await atributo('data-recorde-piscando')) === '1') {
      falhar('A primeira partida não deveria piscar: não havia recorde anterior.');
    }
    await print('fim-da-partida-1');

    // ---- Partida 2: jogando bem, para passar do recorde ----
    await pagina.locator('#botao-reiniciar').click();
    await esperarOcioso();
    await esperar(300);
    if (Number(await atributo('data-recorde')) !== recorde1) {
      falhar('O recorde deveria atravessar o "jogar de novo".');
    }
    if (Number(await atributo('data-pontos')) !== 0) falhar('Os pontos deveriam zerar na partida nova.');
    anotar(`partida 2 começa: pontos 0, recorde ${recorde1}`);
    await print('partida-2-comecando');

    // Joga até o momento em que o visor começa a piscar.
    let piscou = false;
    for (let i = 0; i < 2000 && !piscou; i++) {
      if ((await atributo('data-recorde-piscando')) === '1') { piscou = true; break; }
      const animacao = await atributo('data-animacao');
      if (animacao !== 'ocioso') { await esperar(110); continue; }
      const fase = await atributo('data-fase');
      if (fase === 'fim_de_jogo') break;
      if (fase === 'rodada_encerrada') { await pagina.locator('#botao-proxima').click(); continue; }
      const total = Number(await atributo('data-meu-total'));
      if (total < 17) await pagina.locator('#botao-hit').click();
      else await pagina.locator('#botao-stay').click();
    }
    if (!piscou) falhar(`A partida 2 não passou do recorde de ${recorde1}.`);

    await esperar(250);
    const recorde2 = Number(await atributo('data-recorde'));
    anotar(`recorde batido: ${recorde1} -> ${recorde2}, visor piscando`);
    await print('visor-piscando');
    await esperar(700);
    await print('visor-piscando-outro-instante');

    if (recorde2 <= recorde1) falhar(`O recorde deveria ter subido, ficou em ${recorde2}.`);
  },
};
