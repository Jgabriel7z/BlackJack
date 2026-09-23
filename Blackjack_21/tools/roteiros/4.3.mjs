// Roteiro de captura do sub-passo 4.3 — efeitos visuais.
//
// A parte B3 do PDF pede que os efeitos apertem junto com a aposta e com
// a morte chegando perto. O roteiro fotografa a MESMA mesa em dois
// momentos da mesma partida — rodada 1, aposta 1, cinco dedos; e a
// última rodada, aposta alta e quase sem mão — e confere pelos números
// (`body[data-tensao]`) que a tensão realmente subiu. Depois desliga
// tudo com E para dar para comparar, e mede o desempenho em `data-fps`.
//
// No fim, uma segunda partida só para pegar a televisão distorcendo
// enquanto o Kaio fala, na troca de nível.
//
// Seed 177: João Gabriel perde no nível 1 em 3 rodadas, então a aposta
// sobe e a mão dele vai embora na mesma mesa.
// Seed 21: atravessa os três níveis, então tem troca de nível com o Kaio.

const SEED = 177;
const SEED_COM_TROCA = 21;

export default {
  descricao: `Efeitos visuais: a mesma mesa com pouca e com muita tensão, e a TV distorcendo (seeds ${SEED} e ${SEED_COM_TROCA})`,
  video: true,

  async executar({ abrir, print, esperar, anotar, falhar, pagina }) {
    const atributo = (nome) => pagina.getAttribute('body', nome);
    const numero = async (nome) => Number(await atributo(nome));

    // ------------------------------------------------------------------
    //  Começo da partida: aposta 1, mão inteira
    // ------------------------------------------------------------------
    await abrir('/index.html', { tela: 'jogando', seed: SEED, rapido: 1 });
    await pagina.waitForSelector('body[data-pronto="1"]', { timeout: 10_000 });
    await pagina.waitForSelector('body[data-animacao="ocioso"]', { timeout: 30_000 });
    await esperar(300);

    if ((await atributo('data-efeitos')) !== '1') falhar('Os efeitos deveriam começar ligados.');
    const tensaoBaixa = await numero('data-tensao');
    anotar(`rodada 1: aposta ${await atributo('data-meus-dedos')} dedos inteiros, tensão ${tensaoBaixa}`);
    await print('tensao-baixa');

    // ------------------------------------------------------------------
    //  Joga até a mesa apertar
    // ------------------------------------------------------------------
    // Para assim que a mesa estiver bem apertada, mas AINDA em jogo: a
    // partida não pode acabar, senão a próxima tela é a de digitar as
    // iniciais, onde a tecla E é uma letra do nome e não o atalho.
    const TENSAO_ALVO = 0.45;
    let apertou = false;
    for (let i = 0; i < 2500 && !apertou; i++) {
      if ((await atributo('data-tela')) !== 'jogando') break;
      if ((await atributo('data-animacao')) !== 'ocioso') { await esperar(90); continue; }
      if ((await numero('data-tensao')) >= TENSAO_ALVO) { apertou = true; break; }

      const fase = await atributo('data-fase');
      if (fase === 'fim_de_jogo') break;
      if (fase === 'rodada_encerrada') { await pagina.locator('#botao-proxima').click(); continue; }
      if (fase !== 'jogando') { await esperar(90); continue; }
      const total = await numero('data-meu-total');
      if (total < 17) await pagina.locator('#botao-hit').click();
      else await pagina.locator('#botao-stay').click();
    }
    if (!apertou) falhar('A partida acabou antes de a mesa apertar; escolha outra seed.');

    await esperar(400);
    const tensaoFinal = await numero('data-tensao');
    anotar(`perto do fim: ${await atributo('data-meus-dedos')} dedo(s), tensão ${tensaoFinal}`);
    if (tensaoFinal <= tensaoBaixa) {
      falhar(`A tensão deveria ter subido: começou em ${tensaoBaixa} e está em ${tensaoFinal}.`);
    }
    await print('tensao-alta');

    // ------------------------------------------------------------------
    //  A tecla E desliga tudo, para dar para comparar
    // ------------------------------------------------------------------
    await pagina.keyboard.press('e');
    await esperar(300);
    if ((await atributo('data-efeitos')) !== '0') falhar('E deveria ter desligado os efeitos.');
    if ((await atributo('data-tela')) !== 'jogando') falhar('E não pode mexer na tela.');
    await print('mesma-cena-sem-efeitos');
    anotar('E desliga o pós-processamento: a mesma cena, limpa');

    const fpsSemEfeitos = await numero('data-fps');
    await pagina.keyboard.press('e');
    await esperar(1500);   // um segundo para a média de fps se refazer
    if ((await atributo('data-efeitos')) !== '1') falhar('E de novo deveria ter religado.');
    const fpsComEfeitos = await numero('data-fps');
    anotar(`desempenho: ${fpsComEfeitos} fps com os efeitos, ${fpsSemEfeitos} fps sem eles`);
    if (fpsComEfeitos < 30) falhar(`Com os efeitos o jogo caiu para ${fpsComEfeitos} fps.`);
    await print('efeitos-religados');

    // ------------------------------------------------------------------
    //  A televisão distorcendo enquanto o Kaio fala
    // ------------------------------------------------------------------
    await abrir('/index.html', { tela: 'jogando', seed: SEED_COM_TROCA, rapido: 1 });
    await pagina.waitForSelector('body[data-pronto="1"]', { timeout: 10_000 });

    let achouTroca = false;
    for (let i = 0; i < 3000 && !achouTroca; i++) {
      const animacao = await atributo('data-animacao');
      if (animacao === 'trocando-nivel') { achouTroca = true; break; }
      if (animacao !== 'ocioso') { await esperar(90); continue; }
      const fase = await atributo('data-fase');
      if (fase === 'fim_de_jogo') break;
      if (fase === 'rodada_encerrada') { await pagina.locator('#botao-proxima').click(); continue; }
      if (fase !== 'jogando') { await esperar(90); continue; }
      const total = await numero('data-meu-total');
      if (total < 17) await pagina.locator('#botao-hit').click();
      else await pagina.locator('#botao-stay').click();
    }
    if (!achouTroca) falhar('A troca de nível não aconteceu, então o Kaio não falou.');

    await esperar(2400);   // a televisão acesa e a primeira fala no ar
    await print('tv-distorcendo-com-o-kaio');
    await esperar(700);
    await print('tv-distorcendo-outro-instante');
    anotar('a imagem da TV rasga em fatias enquanto o anfitrião fala');
  },
};
