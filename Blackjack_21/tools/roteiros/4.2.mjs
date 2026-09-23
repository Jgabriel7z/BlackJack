// Roteiro de captura do sub-passo 4.2 — o som.
//
// ATENÇÃO: o vídeo desta captura é MUDO. O Playwright grava a tela, não
// o áudio — não existe opção para isso. Então aqui o roteiro prova o som
// de outro jeito: cada efeito disparado é anotado em `body[data-som]` e
// contado em `body[data-sons]`, e o roteiro confere que a sequência
// certa aconteceu na hora certa. Como gravar com som de verdade está em
// `progresso/etapa-4/4.2/COMO-GRAVAR-COM-SOM.md`.
//
// Em velocidade normal, porque o som é feito de tempo: a carta, o
// silêncio antes da revelação, a lâmina e o impacto precisam do ritmo
// real para fazer sentido.
//
// Seed 31: João Gabriel perde a primeira rodada, então a guilhotina
// desce sobre a mão dele já na rodada 1.

const SEED = 31;

export default {
  descricao: `Som: uma rodada inteira com punição, com os eventos conferidos (seed ${SEED})`,
  video: true,

  async executar({ abrir, print, esperar, anotar, falhar, pagina }) {
    const atributo = (nome) => pagina.getAttribute('body', nome);

    /** Vai anotando os sons que passam, sem repetir o mesmo seguido. */
    const ouvidos = [];
    const escutar = async () => {
      const som = await atributo('data-som');
      if (ouvidos[ouvidos.length - 1] !== som) ouvidos.push(som);
      return som;
    };

    /** Espera até ouvir `alvo`, escutando o caminho todo. */
    const esperarSom = async (alvo, passos = 400) => {
      for (let i = 0; i < passos; i++) {
        if ((await escutar()) === alvo) return true;
        await esperar(60);
      }
      falhar(`Não ouvi "${alvo}". O que passou: ${ouvidos.join(' → ')}`);
      return false;
    };

    // ------------------------------------------------------------------
    //  O som só pode começar depois de um gesto do usuário
    // ------------------------------------------------------------------
    await abrir('/index.html', { seed: SEED });
    await pagina.waitForSelector('body[data-pronto="1"]', { timeout: 10_000 });
    if ((await atributo('data-som')) !== 'nenhum') {
      falhar('Nenhum som deveria ter tocado antes de o usuário encostar no jogo.');
    }
    await pagina.waitForSelector('body[data-titulo-pronto="1"]', { timeout: 15_000 });
    await print('titulo-com-o-aviso-do-som');

    await pagina.keyboard.press('Space');   // este é o gesto que libera o áudio
    await pagina.waitForSelector('body[data-tela="jogando"]', { timeout: 10_000 });

    // ------------------------------------------------------------------
    //  Rodada 1: cartas, silêncio, lâmina, impacto
    // ------------------------------------------------------------------
    await esperarSom('carta');
    anotar('as cartas sendo distribuídas já fazem barulho de papel');
    await pagina.waitForSelector('body[data-animacao="ocioso"]', { timeout: 30_000 });
    await esperar(200);
    await print('mesa-com-som-ligado');

    // Joga a rodada pela regra da IA até a revelação começar.
    for (let i = 0; i < 400; i++) {
      await escutar();
      const animacao = await atributo('data-animacao');
      if (animacao === 'escurecendo' || animacao === 'punicao') break;
      if (animacao !== 'ocioso') { await esperar(60); continue; }
      const fase = await atributo('data-fase');
      if (fase !== 'jogando') { await esperar(60); continue; }
      const total = Number(await atributo('data-meu-total'));
      if (total < 17) await pagina.locator('#botao-hit').click();
      else await pagina.locator('#botao-stay').click();
    }

    await esperarSom('silencio');
    anotar('os dois pararam: o ambiente cala e fica só a carta virando (B4)');
    await esperar(300);
    await print('silencio-antes-da-revelacao');

    // O ambiente só volta quando o resultado é anunciado; aí é que a
    // lâmina desce, e o impacto abafa tudo de novo.
    await esperarSom('ambiente-volta');
    anotar('anunciado o resultado, o ambiente volta');

    await esperarSom('lamina');
    anotar('a lâmina da guilhotina sendo armada');
    await esperarSom('impacto');
    anotar('impacto seco: zumbido agudo e todo o som abafado por alguns segundos');
    await esperar(250);
    await print('impacto-e-abafamento');

    const ordem = ouvidos.join(' → ');
    anotar(`sequência ouvida: ${ordem}`);
    const esperado = ['carta', 'silencio', 'ambiente-volta', 'lamina', 'impacto'];
    let procurando = 0;
    for (const som of ouvidos) {
      if (som === esperado[procurando]) procurando += 1;
    }
    if (procurando !== esperado.length) {
      falhar(`A sequência esperada era ${esperado.join(' → ')}; ouvi ${ordem}`);
    }
    anotar(`total de sons disparados até aqui: ${await atributo('data-sons')}`);

    // ------------------------------------------------------------------
    //  A tecla M
    // ------------------------------------------------------------------
    await pagina.keyboard.press('m');
    await esperar(200);
    if ((await atributo('data-mudo')) !== '1') falhar('M deveria ter mutado.');
    if ((await atributo('data-tela')) !== 'jogando') falhar('M não pode mexer na tela.');
    await print('som-desligado');
    anotar('M desliga o som e a mesa avisa no canto');

    const antes = Number(await atributo('data-sons'));
    await pagina.keyboard.press('m');
    await esperar(200);
    if ((await atributo('data-mudo')) !== '0') falhar('M de novo deveria ter religado.');
    if (Number(await atributo('data-sons')) <= antes) falhar('O contador de sons deveria ter subido.');
    anotar('M de novo religa');
    await print('som-religado');
  },
};
