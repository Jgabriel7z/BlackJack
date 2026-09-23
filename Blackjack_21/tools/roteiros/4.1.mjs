// Roteiro de captura do sub-passo 4.1 — o que sobrevive a recarregar.
//
// Uma partida curta que ganha, entra na lista das cinco melhores e ainda
// destrava uma recompensa da tabela A5; depois a página é RECARREGADA e
// o roteiro confere que tudo continua lá. No fim, apaga tudo pelo título
// e recarrega de novo para provar que o apagar foi mesmo para o disco.
//
// Seed 44 no nível 3 (a mesma do 3.3): João Gabriel vence em 4 rodadas
// tendo estourado pelo menos uma vez, que é a condição de "Vencer uma
// partida mesmo tendo estourado".

const SEED = 44;
const NIVEL = 3;
const INICIAIS = 'joa';

export default {
  descricao: `Persistência: partida, recarregar a página e o recorde continua lá (seed ${SEED}, nível ${NIVEL})`,
  video: true,

  async executar({ abrir, print, esperar, anotar, falhar, pagina }) {
    const atributo = (nome) => pagina.getAttribute('body', nome);

    const esperarTela = async (alvo, limite = 40_000) => {
      await pagina.waitForSelector(`body[data-tela="${alvo}"]`, { timeout: limite });
    };

    /** Joga sozinho até sair da mesa, comprando abaixo de 17. */
    const jogarPartida = async (passos = 2500) => {
      for (let i = 0; i < passos; i++) {
        if ((await atributo('data-tela')) !== 'jogando') return;
        if ((await atributo('data-animacao')) !== 'ocioso') { await esperar(100); continue; }
        const fase = await atributo('data-fase');
        if (fase === 'fim_de_jogo') { await esperar(100); continue; }
        if (fase === 'rodada_encerrada') { await pagina.locator('#botao-proxima').click(); continue; }
        if (fase !== 'jogando') { await esperar(100); continue; }
        const total = Number(await atributo('data-meu-total'));
        if (total < 17) await pagina.locator('#botao-hit').click();
        else await pagina.locator('#botao-stay').click();
      }
      falhar('A partida não terminou.');
    };

    // ------------------------------------------------------------------
    //  1. Uma partida que deixa rastro
    // ------------------------------------------------------------------
    await abrir('/index.html', { tela: 'jogando', seed: SEED, nivel: NIVEL, rapido: 1 });
    await pagina.waitForSelector('body[data-pronto="1"]', { timeout: 10_000 });
    if ((await atributo('data-salvando')) !== '1') falhar('O navegador da captura deveria salvar.');
    if ((await atributo('data-recorde')) !== '0') falhar('A captura deveria começar com tudo zerado.');
    if ((await atributo('data-desbloqueios')) !== '') falhar('Nada deveria estar desbloqueado ainda.');

    await jogarPartida();
    await esperarTela('iniciais');
    await esperar(500);

    const pontos = await atributo('data-pontos');
    const desbloqueios = await atributo('data-desbloqueios');
    anotar(`partida: ${pontos} pontos, desbloqueios "${desbloqueios}"`);
    if (desbloqueios === '') falhar('A vitória com estouro deveria ter destravado uma recompensa.');
    await print('recompensa-e-iniciais');

    for (const letra of INICIAIS) {
      await pagina.keyboard.press(letra);
      await esperar(200);
    }
    await pagina.keyboard.press('Enter');
    await esperarTela('high_scores');
    await esperar(400);

    const placar = await atributo('data-placar');
    const recorde = await atributo('data-recorde');
    const partidas = await atributo('data-partidas-jogadas');
    anotar(`antes de recarregar: recorde ${recorde}, lista "${placar}", ${partidas} partida(s)`);
    await print('antes-de-recarregar');

    // ------------------------------------------------------------------
    //  2. Recarregar a página do zero
    // ------------------------------------------------------------------
    await abrir('/index.html', { seed: SEED, nivel: NIVEL, rapido: 1 });
    await pagina.waitForSelector('body[data-pronto="1"]', { timeout: 10_000 });
    if ((await atributo('data-tela')) !== 'titulo') falhar('Recarregar deveria cair no título.');
    await pagina.waitForSelector('body[data-titulo-pronto="1"]', { timeout: 15_000 });
    await esperar(300);

    const recordeDepois = await atributo('data-recorde');
    const placarDepois = await atributo('data-placar');
    const desbloqueiosDepois = await atributo('data-desbloqueios');
    const partidasDepois = await atributo('data-partidas-jogadas');
    anotar(`depois de recarregar: recorde ${recordeDepois}, lista "${placarDepois}", desbloqueios "${desbloqueiosDepois}", ${partidasDepois} partida(s)`);

    if (recordeDepois !== recorde) falhar(`O recorde era ${recorde} e virou ${recordeDepois}.`);
    if (placarDepois !== placar) falhar(`A lista era "${placar}" e virou "${placarDepois}".`);
    if (desbloqueiosDepois !== desbloqueios) falhar('Os desbloqueios não sobreviveram.');
    if (partidasDepois !== partidas) falhar('A conta de partidas não sobreviveu.');
    await print('titulo-depois-de-recarregar');

    // A lista das melhores também volta cheia, e o laço passa pela
    // demonstração no caminho — que não pode mexer em nada.
    await esperarTela('high_scores');
    await esperar(400);
    if ((await atributo('data-placar')) !== placar) falhar('A demonstração mexeu na lista.');
    if ((await atributo('data-recorde')) !== recorde) falhar('A demonstração mexeu no recorde.');
    await print('melhores-depois-de-recarregar');
    anotar('a lista sobreviveu ao recarregar e à demonstração');

    // ------------------------------------------------------------------
    //  3. Apagar tudo pelo título
    //
    //  Agora SEM ?rapido: com ele o título dura menos de um segundo antes
    //  de chamar a demonstração, e não daria tempo de apertar as teclas.
    //  De quebra, é mais um recarregar com os dados voltando do disco.
    // ------------------------------------------------------------------
    await abrir('/index.html', { seed: SEED, nivel: NIVEL });
    await pagina.waitForSelector('body[data-pronto="1"]', { timeout: 10_000 });
    await pagina.waitForSelector('body[data-titulo-pronto="1"]', { timeout: 20_000 });
    await esperar(300);
    if ((await atributo('data-recorde')) !== recorde) falhar('O recorde sumiu no terceiro carregamento.');
    await print('titulo-com-os-dados-salvos');

    await pagina.keyboard.press('Delete');
    await esperar(300);
    if ((await atributo('data-tela')) !== 'titulo') falhar('DEL não podia começar a partida.');
    await print('pergunta-antes-de-apagar');

    await pagina.keyboard.press('Delete');
    await esperar(300);
    if ((await atributo('data-recorde')) !== '0') falhar('O recorde deveria ter sido apagado.');
    if ((await atributo('data-placar')) !== '') falhar('A lista deveria ter sido apagada.');
    if ((await atributo('data-desbloqueios')) !== '') falhar('Os desbloqueios deveriam ter sido apagados.');
    await print('dados-apagados');
    anotar('DEL duas vezes apagou recorde, lista, estatísticas e desbloqueios');

    // ------------------------------------------------------------------
    //  4. E o apagar também foi para o disco
    // ------------------------------------------------------------------
    await abrir('/index.html', { seed: SEED, nivel: NIVEL });
    await pagina.waitForSelector('body[data-pronto="1"]', { timeout: 10_000 });
    await pagina.waitForSelector('body[data-titulo-pronto="1"]', { timeout: 20_000 });
    await esperar(300);
    if ((await atributo('data-recorde')) !== '0') falhar('O apagar não foi para o disco.');
    if ((await atributo('data-partidas-jogadas')) !== '0') falhar('As estatísticas voltaram do disco.');
    await print('titulo-limpo-depois-de-recarregar');
    anotar('recarregando de novo, continua tudo zerado: o apagar foi para o disco');
  },
};
