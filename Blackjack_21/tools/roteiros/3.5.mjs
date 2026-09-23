// Roteiro de captura do sub-passo 3.5 — a demonstração (attract mode).
//
// Em velocidade normal, de propósito: a graça da vitrine é o tempo dela.
// O roteiro abre o jogo e não toca em nada; passados os 15 s do título a
// demonstração entra sozinha, e aí ele só fotografa a câmera passeando
// enquanto a IA joga contra ela mesma. Antes de sair, confere que nada
// daquilo encostou no recorde nem na lista das melhores.

// Seed escolhida com um script de busca: nela a primeira rodada da
// demonstração é curta e o lado do jogador vence, então dá para provar
// que a pontuação sobe na vitrine sem o recorde se mexer.
const SEED = 153;

export default {
  descricao: `Demonstração: a IA jogando contra ela mesma com a câmera passeando (seed ${SEED})`,
  video: true,

  async executar({ abrir, print, esperar, anotar, falhar, pagina }) {
    const atributo = (nome) => pagina.getAttribute('body', nome);

    await abrir('/index.html', { seed: SEED });
    await pagina.waitForSelector('body[data-pronto="1"]', { timeout: 10_000 });
    if ((await atributo('data-tela')) !== 'titulo') falhar('O jogo deveria abrir no título.');
    if ((await atributo('data-demonstracao')) !== '0') falhar('O título não é demonstração.');

    // Ninguém mexe: o título entrega a vez à demonstração sozinho.
    const entrou = Date.now();
    await pagina.waitForSelector('body[data-tela="attract"]', { timeout: 30_000 });
    anotar(`o título chamou a demonstração sozinho depois de ${((Date.now() - entrou) / 1000).toFixed(1)} s`);
    if ((await atributo('data-demonstracao')) !== '1') falhar('A demonstração não começou.');

    await esperar(2500);
    anotar(`demonstração: rodada ${await atributo('data-rodada')}, nível ${await atributo('data-nivel')}`);
    await print('demonstracao-comeco');

    await esperar(5000);
    await print('demonstracao-camera-em-outro-ponto');

    // Espera a demonstração pontuar: é o que torna a conferência seguinte
    // alguma coisa (não adianta provar que 0 não virou recorde).
    let pontuou = false;
    for (let i = 0; i < 110 && !pontuou; i++) {
      pontuou = (await atributo('data-pontos')) !== '0';
      if (!pontuou) await esperar(100);
    }
    if (!pontuou) falhar('A demonstração não pontuou a tempo; escolha outra seed.');
    await esperar(600);
    await print('demonstracao-pontuando');

    // Nada do que a máquina fez sozinha pode ter virado recorde.
    const pontos = await atributo('data-pontos');
    const recorde = await atributo('data-recorde');
    const placar = await atributo('data-placar');
    anotar(`na demonstração: ${pontos} pontos na mesa, recorde ${recorde}, lista "${placar}"`);
    if (recorde !== '0') falhar(`A demonstração mexeu no recorde: ${recorde}.`);
    if (placar !== '') falhar(`A demonstração escreveu na lista: ${placar}.`);
    if ((await atributo('data-fase')) === 'fim_de_jogo') {
      anotar('a partida da demonstração chegou ao fim e outra começou no lugar');
    }

    // Qualquer tecla interrompe e devolve o título.
    await pagina.keyboard.press('Space');
    await pagina.waitForSelector('body[data-tela="titulo"]', { timeout: 10_000 });
    if ((await atributo('data-demonstracao')) !== '0') falhar('A demonstração continuou depois da tecla.');
    // A volta ao título reacende o tubo do começo: o print sai com a
    // imagem se formando, que é o que se vê logo depois da tecla.
    await pagina.waitForSelector('body[data-titulo-fase="surgindo"]', { timeout: 10_000 });
    await esperar(900);   // deixa o "21" se formar antes do print
    await print('a-tecla-cortou-a-demonstracao');
    anotar('uma tecla devolveu o título, com a mesa limpa e a demonstração desligada');

    await pagina.waitForSelector('body[data-titulo-pronto="1"]', { timeout: 20_000 });
    await esperar(200);
    await print('titulo-de-volta');

    // E a tecla no título continua levando ao jogo de verdade.
    await pagina.keyboard.press('Space');
    await pagina.waitForSelector('body[data-tela="jogando"]', { timeout: 10_000 });
    await pagina.waitForSelector('body[data-animacao="ocioso"]', { timeout: 40_000 });
    await esperar(250);
    if ((await atributo('data-rodada')) !== '1') falhar('A partida de verdade deveria começar na rodada 1.');
    if ((await atributo('data-pontos')) !== '0') falhar('A partida de verdade deveria começar zerada.');
    await print('partida-de-verdade-depois-da-demonstracao');
    anotar('a partida de verdade começa zerada, na rodada 1');

    // Atalho para quem for mexer na vitrine depois: ?tela=attract cai
    // direto nela, sem esperar os 15 s do título.
    await abrir('/index.html', { tela: 'attract', seed: SEED });
    await pagina.waitForSelector('body[data-pronto="1"]', { timeout: 10_000 });
    if ((await atributo('data-demonstracao')) !== '1') {
      falhar('?tela=attract deveria cair direto na demonstração.');
    }
    await esperar(1500);
    await print('atalho-tela-attract');
    anotar('?tela=attract abre direto na demonstração, já jogando');
  },
};
