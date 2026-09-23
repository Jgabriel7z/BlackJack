// Captura final da Etapa 2 — uma partida passando pelos três níveis.
//
// Roda com ?rapido=1 para o vídeo não ficar longo demais, mas as trocas
// de nível são marcadas com `ritmoReal` no código e continuam na
// velocidade normal: dá para ler a fala do anfitrião.
//
// Seed 21: com a regra da IA, João Gabriel vence os três níveis.
// Saída: progresso/etapa-2/final/

const SEED = 21;

export default {
  descricao: `Partida inteira pelos três níveis (seed ${SEED}, rápido, trocas em velocidade normal)`,
  video: true,

  async executar({ abrir, print, esperar, anotar, falhar, pagina }) {
    const atributo = (nome) => pagina.getAttribute('body', nome);
    const fotografados = new Set();

    const print1 = async (nome, espera = 0) => {
      if (fotografados.has(nome)) return;
      if (espera) await esperar(espera);
      await print(nome);
      fotografados.add(nome);
    };

    await abrir('/index.html', { tela: 'jogando', seed: SEED, rapido: 1 });
    await pagina.waitForSelector('body[data-pronto="1"]', { timeout: 10_000 });

    // A troca é contada uma vez por bloco. Olhar só o nível daria duas
    // fotos da mesma troca (o nível muda no meio dela), e olhar a borda
    // da animação também: entre dois passos ela passa por "aguardando"
    // durante um quadro, o que reabriria o bloco.
    let dentroDaTroca = false;
    let trocas = 0;

    for (let passo = 0; passo < 3000; passo++) {
      const animacao = await atributo('data-animacao');
      const nivel = await atributo('data-nivel');
      if (animacao === 'trocando-nivel' && !dentroDaTroca) {
        dentroDaTroca = true;
        trocas += 1;
      } else if (animacao !== 'trocando-nivel' && animacao !== 'aguardando') {
        dentroDaTroca = false;
      }

      // Um print da mesa de cada nível, assim que ele começa.
      if (animacao === 'ocioso' && !fotografados.has(`mesa-nivel-${nivel}`)) {
        await print1(`mesa-nivel-${nivel}`, 200);
        anotar(`nível ${nivel}: pontos ${await atributo('data-pontos')}, recorde ${await atributo('data-recorde')}`);
      }
      // Um print da punição de cada nível.
      if (animacao === 'punicao' && !fotografados.has(`punicao-nivel-${nivel}`)) {
        await print1(`punicao-nivel-${nivel}`, nivel === '2' ? 900 : 500);
      }
      // Um print da fala do anfitrião em cada troca.
      if (dentroDaTroca) await print1(`troca-para-nivel-${trocas + 1}`, 2300);

      if (animacao !== 'ocioso') { await esperar(90); continue; }

      const fase = await atributo('data-fase');
      if (fase === 'fim_de_jogo') break;
      if (fase === 'rodada_encerrada') { await pagina.locator('#botao-proxima').click(); continue; }
      const total = Number(await atributo('data-meu-total'));
      if (total < 17) await pagina.locator('#botao-hit').click();
      else await pagina.locator('#botao-stay').click();
    }

    if ((await atributo('data-fase')) !== 'fim_de_jogo') falhar('A partida não terminou.');
    await esperar(700);
    await print('tela-final');

    const pontos = await atributo('data-pontos');
    anotar(`fim: nível ${await atributo('data-nivel')}, ${pontos} pontos, recorde ${await atributo('data-recorde')}`);
    anotar(`trocas de nível vistas: ${trocas}`);
    if (trocas !== 2) falhar(`Esperava 2 trocas de nível, contei ${trocas}.`);
    for (const obrigatorio of ['mesa-nivel-1', 'mesa-nivel-2', 'mesa-nivel-3', 'troca-para-nivel-2', 'troca-para-nivel-3']) {
      if (!fotografados.has(obrigatorio)) falhar(`Faltou o print "${obrigatorio}".`);
    }
  },
};
