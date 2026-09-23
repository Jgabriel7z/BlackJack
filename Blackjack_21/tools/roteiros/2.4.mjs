// Roteiro de captura do sub-passo 2.4 — os três níveis.
//   ?nivel=2 e ?nivel=3 mostram cada aparelho e uma punição.
//   A seed 21 vence os três níveis com a regra da IA, então serve para
//   gravar a troca de nível com o Kaio falando na televisão.
//
// O roteiro observa `body[data-animacao]` o tempo todo em vez de supor a
// ordem dos passos: a troca de nível vem logo depois da punição e some
// rápido se o roteiro ficar esperando o jogo ficar ocioso.

const SEED = 21;

export default {
  descricao: 'Níveis 2 (choque) e 3 (serra), uma punição em cada e a troca de nível com o Kaio',
  video: true,

  async executar({ abrir, print, esperar, anotar, falhar, pagina }) {
    const atributo = (nome) => pagina.getAttribute('body', nome);

    /**
     * Joga sozinho (mesma regra da IA) até uma das animações de `alvos`
     * aparecer. Devolve o nome da animação, ou null se o jogo acabar.
     */
    // Uma rodada no ritmo real leva uns 15 s, e o nível 1 precisa de 3
    // rodadas antes da troca: o limite tem de ser generoso.
    const jogarAte = async (alvos, passos = 1500) => {
      for (let i = 0; i < passos; i++) {
        const animacao = await atributo('data-animacao');
        if (alvos.includes(animacao)) return animacao;
        if (animacao !== 'ocioso') { await esperar(120); continue; }

        const fase = await atributo('data-fase');
        if (fase === 'fim_de_jogo') return null;
        if (fase === 'rodada_encerrada') { await pagina.locator('#botao-proxima').click(); continue; }
        const total = Number(await atributo('data-meu-total'));
        if (total < 17) await pagina.locator('#botao-hit').click();
        else await pagina.locator('#botao-stay').click();
      }
      falhar(`Passei de ${passos} passos esperando por ${alvos.join(' ou ')}.`);
      return null;
    };

    const esperarOcioso = async (passos = 600) => {
      for (let i = 0; i < passos; i++) {
        if ((await atributo('data-animacao')) === 'ocioso') return;
        await esperar(120);
      }
      falhar('A fila de animações não esvaziou.');
    };

    const abrirJogo = async (parametrosDaUrl) => {
      await abrir('/index.html', parametrosDaUrl);
      await pagina.waitForSelector('body[data-pronto="1"]', { timeout: 10_000 });
      await esperarOcioso();
      await esperar(400);
    };

    // ------------------------------------------------------------------
    //  Nível 2 — choque: aparelho de taser e medidores de ponteiro
    // ------------------------------------------------------------------
    await abrirJogo({ seed: SEED, nivel: 2 });
    if ((await atributo('data-nivel')) !== '2') falhar('Deveria abrir no nível 2.');
    anotar(`nível 2: medidores em ${await atributo('data-medidor-meu')} e ${await atributo('data-medidor-dele')}`);
    await print('nivel-2-choque');

    if (!(await jogarAte(['punicao']))) falhar('A partida do nível 2 acabou antes de alguma punição.');
    await esperar(1000);   // passa o carregamento e pega a descarga
    await print('nivel-2-punicao');
    await esperarOcioso();
    anotar(`depois do choque: medidores em ${await atributo('data-medidor-meu')} e ${await atributo('data-medidor-dele')}`);

    // ------------------------------------------------------------------
    //  Nível 3 — serra: trilho de 15 marcas
    // ------------------------------------------------------------------
    await abrirJogo({ seed: SEED, nivel: 3 });
    if ((await atributo('data-nivel')) !== '3') falhar('Deveria abrir no nível 3.');
    const serraInicial = await atributo('data-serra');
    anotar(`nível 3: serra na marca ${serraInicial} de 15`);
    await print('nivel-3-serra');

    if (!(await jogarAte(['punicao']))) falhar('A partida do nível 3 acabou antes de alguma punição.');
    await esperar(600);    // a lâmina no meio do caminho
    await print('nivel-3-punicao');
    await esperarOcioso();
    const serraDepois = await atributo('data-serra');
    anotar(`depois da rodada: serra ${serraInicial} -> ${serraDepois}`);
    if (serraDepois === serraInicial) falhar('A serra não andou.');

    // ------------------------------------------------------------------
    //  Troca de nível: do 1 para o 2, com o Kaio falando na televisão
    // ------------------------------------------------------------------
    await abrirJogo({ seed: SEED });
    if ((await atributo('data-nivel')) !== '1') falhar('Deveria abrir no nível 1.');
    await print('nivel-1-guilhotina');

    if (!(await jogarAte(['trocando-nivel']))) falhar('A partida acabou antes da troca de nível.');
    await esperar(2300);   // a tela já escureceu e a primeira fala está no ar
    await print('kaio-falando');

    await esperarOcioso();
    await esperar(400);
    const nivelDepois = await atributo('data-nivel');
    anotar(`depois da troca: nível ${nivelDepois}, medidores zerados em ${await atributo('data-medidor-meu')}/${await atributo('data-medidor-dele')}`);
    if (nivelDepois !== '2') falhar(`Deveria ter ido para o nível 2, foi para ${nivelDepois}.`);
    await print('mesa-do-nivel-2');
  },
};
