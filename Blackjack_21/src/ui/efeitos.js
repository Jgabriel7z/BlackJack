// =====================================================================
//  ui/efeitos.js — pós-processamento da tela
//  (passe visual pós-Etapa 1, completado no sub-passo 4.3)
//
//  Inspirado nos filtros de CRT/grain/vinheta do PixiJS Filters e no
//  mgGlitch que o grupo guardou em REFERENCIAS.md, reimplementado em
//  Canvas 2D sem dependência:
//    - granulado de filme: 4 ladrilhos de ruído pré-gerados, desenhados
//      em posições que mudam a cada quadro, com mistura "overlay"
//    - linhas de varredura: padrão de 1 px escuro a cada 3 px
//    - vinheta, que fecha mais quanto maior a tensão
//    - separação de cores nas bordas (4.3)
//    - distorção da imagem da TV quando o anfitrião fala (4.3)
//
//  **Desempenho** (o PDF pede atenção nisso): tudo é drawImage e
//  fillRect, nunca leitura de pixel por quadro. A separação de cores
//  seria a parte cara, porque precisa de uma cópia do quadro inteiro;
//  ela é montada num canvas em 1/3 da resolução e esticada de volta, que
//  é justamente o truque sugerido no PDF. Como a franja é uma mancha
//  suave nas bordas, esticar não estraga nada — e custa 9 vezes menos.
//  Com tudo ligado o jogo continua em 60 fps (ver `data-fps`).
// =====================================================================

const LARGURA = 1280;
const ALTURA = 720;
const TAMANHO_LADRILHO = 256;
/** A franja de cor é montada nesta fração da resolução. */
const DIVISOR_DA_FRANJA = 3;

function ruidoFixo(i) {
  const v = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
  return v - Math.floor(v);
}

function novoCanvas(largura, altura) {
  const tela = document.createElement('canvas');
  tela.width = largura;
  tela.height = altura;
  return tela;
}

function criarLadrilhoDeRuido(semente) {
  const tela = novoCanvas(TAMANHO_LADRILHO, TAMANHO_LADRILHO);
  const ctx = tela.getContext('2d');
  const imagem = ctx.createImageData(TAMANHO_LADRILHO, TAMANHO_LADRILHO);
  const d = imagem.data;
  for (let i = 0; i < TAMANHO_LADRILHO * TAMANHO_LADRILHO; i++) {
    const v = 128 + (ruidoFixo(semente * 99991 + i) - 0.5) * 255;
    d[i * 4] = v;
    d[i * 4 + 1] = v;
    d[i * 4 + 2] = v;
    d[i * 4 + 3] = 255;
  }
  ctx.putImageData(imagem, 0, 0);
  return tela;
}

function criarLinhasDeVarredura() {
  const tela = novoCanvas(4, 3);
  const ctx = tela.getContext('2d');
  ctx.fillStyle = 'rgba(0,0,0,0)';
  ctx.fillRect(0, 0, 4, 3);
  ctx.fillStyle = 'rgba(0,0,0,1)';
  ctx.fillRect(0, 2, 4, 1);
  return tela;
}

export function criarEfeitos(opcoes = {}) {
  let ativos = opcoes.ativos ?? true;
  const ladrilhos = [0, 1, 2, 3].map(criarLadrilhoDeRuido);
  const linhas = criarLinhasDeVarredura();
  let padraoLinhas = null;

  // Canvas pequeno onde a franja de cor é montada, e a máscara que a
  // prende nas bordas (criada uma vez só: ela nunca muda).
  const franjaL = Math.round(LARGURA / DIVISOR_DA_FRANJA);
  const franjaA = Math.round(ALTURA / DIVISOR_DA_FRANJA);
  const franja = novoCanvas(franjaL, franjaA);
  const ctxFranja = franja.getContext('2d');
  const mascaraDaBorda = (() => {
    const g = ctxFranja.createRadialGradient(
      franjaL / 2, franjaA / 2, franjaA * 0.30,
      franjaL / 2, franjaA / 2, franjaA * 0.78,
    );
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,1)');
    return g;
  })();

  // Canvas do tamanho da tela da TV, para distorcê-la sem borrar.
  let copiaDaTv = null;

  /**
   * As bordas respirando vermelho, do modo difícil: uma fumaça que entra
   * pelos cantos e nunca chega ao meio da mesa. É luz, não sangue — o
   * jogo continua sem mostrar ferida nenhuma (Parte B7 do PDF).
   */
  function bordasDeMedo(ctx, agora, forca) {
    if (forca <= 0.01) return;
    // Duas respirações de períodos diferentes: a mancha nunca pulsa
    // certinho, o que deixa o movimento incômodo em vez de decorativo.
    const respiro = 0.72
      + 0.18 * Math.sin(agora / 1900)
      + 0.10 * Math.sin(agora / 730 + 1.1);
    const alfa = Math.min(0.62, forca * respiro);

    const raio = ALTURA * (0.62 - 0.06 * Math.sin(agora / 2300));
    const g = ctx.createRadialGradient(
      LARGURA / 2, ALTURA / 2, raio * 0.52,
      LARGURA / 2, ALTURA / 2, ALTURA * 1.05,
    );
    g.addColorStop(0, 'rgba(120, 0, 0, 0)');
    g.addColorStop(0.55, `rgba(110, 6, 6, ${alfa * 0.45})`);
    g.addColorStop(1, `rgba(150, 10, 10, ${alfa})`);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, LARGURA, ALTURA);
    ctx.restore();

    // E um escurecimento por cima, para a fumaça não clarear a cena.
    const escuro = ctx.createRadialGradient(
      LARGURA / 2, ALTURA / 2, raio * 0.70,
      LARGURA / 2, ALTURA / 2, ALTURA * 1.02,
    );
    escuro.addColorStop(0, 'rgba(0,0,0,0)');
    escuro.addColorStop(1, `rgba(20, 0, 0, ${alfa * 0.75})`);
    ctx.fillStyle = escuro;
    ctx.fillRect(0, 0, LARGURA, ALTURA);
  }

  /**
   * Separação de cores nas bordas: o quadro é redesenhado deslocado
   * para os lados, uma vez só no vermelho e uma no ciano, preso às
   * bordas por uma máscara. Montado em resolução baixa.
   */
  function separacaoDeCores(ctx, forca) {
    if (forca <= 0.002) return;
    const desloc = (0.8 + 3.4 * forca) / DIVISOR_DA_FRANJA;

    for (const [dx, cor, alfa] of [[-desloc, '#ff2020', 0.55], [desloc, '#20e0ff', 0.45]]) {
      ctxFranja.globalCompositeOperation = 'source-over';
      ctxFranja.clearRect(0, 0, franjaL, franjaA);
      ctxFranja.drawImage(ctx.canvas, 0, 0, LARGURA, ALTURA, dx, 0, franjaL, franjaA);

      // Sobra só o canal desta cor.
      ctxFranja.globalCompositeOperation = 'multiply';
      ctxFranja.fillStyle = cor;
      ctxFranja.fillRect(0, 0, franjaL, franjaA);

      // E ela só vale perto das bordas.
      ctxFranja.globalCompositeOperation = 'destination-in';
      ctxFranja.fillStyle = mascaraDaBorda;
      ctxFranja.fillRect(0, 0, franjaL, franjaA);

      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = alfa * forca;
      ctx.drawImage(franja, 0, 0, franjaL, franjaA, 0, 0, LARGURA, ALTURA);
      ctx.restore();
    }
  }

  /**
   * A imagem da TV rasgando em fatias horizontais, com uma barra de
   * sincronismo subindo — é o que se vê quando o anfitrião fala.
   */
  function distorcerTv(ctx, agora, forca, area) {
    if (forca <= 0.01 || !area) return;
    const { x, y, largura, altura } = area;
    if (!copiaDaTv) copiaDaTv = novoCanvas(largura, altura);
    const ctxTv = copiaDaTv.getContext('2d');
    ctxTv.clearRect(0, 0, largura, altura);
    ctxTv.drawImage(ctx.canvas, x, y, largura, altura, 0, 0, largura, altura);

    const fatias = 9;
    const passo = altura / fatias;
    const quadro = Math.floor(agora / 70);
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    for (let i = 0; i < fatias; i++) {
      const desloc = (ruidoFixo(quadro * 37 + i * 11) - 0.5) * 22 * forca;
      ctx.drawImage(
        copiaDaTv, 0, i * passo, largura, passo,
        x + desloc, y + i * passo, largura, passo,
      );
    }

    // Barra de sincronismo, clareando uma faixa que sobe devagar.
    const barra = altura - ((agora / 9) % (altura + 40));
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = `rgba(120, 130, 140, ${0.22 * forca})`;
    ctx.fillRect(x, y + barra, largura, 10);
    ctx.restore();
  }

  return {
    get ativos() { return ativos; },

    /** Liga/desliga o pós-processamento (opção do título, 4.3). */
    definirAtivos(valor) { ativos = valor === true; },

    /**
     * Aplica tudo sobre o quadro já desenhado.
     *   `tensao`  0..1: quanto mais, mais granulado, franja e vinheta
     *   `extras.tvForca` 0..1 e `extras.tvArea`: a TV distorcendo
     */
    aplicar(ctx, agora, tensao = 0, extras = {}) {
      if (!ativos) return;
      const t = Math.min(Math.max(tensao, 0), 1);

      distorcerTv(ctx, agora, extras.tvForca ?? 0, extras.tvArea);
      separacaoDeCores(ctx, t);

      // Granulado: ladrilho e deslocamento mudam a cada quadro.
      const quadro = Math.floor(agora / 33);
      const ladrilho = ladrilhos[quadro % ladrilhos.length];
      const dx = Math.floor(ruidoFixo(quadro) * TAMANHO_LADRILHO);
      const dy = Math.floor(ruidoFixo(quadro + 17) * TAMANHO_LADRILHO);
      ctx.save();
      ctx.globalCompositeOperation = 'overlay';
      ctx.globalAlpha = 0.11 + 0.20 * t;
      for (let y = -dy; y < ALTURA; y += TAMANHO_LADRILHO) {
        for (let x = -dx; x < LARGURA; x += TAMANHO_LADRILHO) {
          ctx.drawImage(ladrilho, x, y);
        }
      }
      ctx.restore();

      // Linhas de varredura, um tico mais marcadas com a tensão.
      if (!padraoLinhas) padraoLinhas = ctx.createPattern(linhas, 'repeat');
      ctx.save();
      ctx.globalAlpha = 0.16 + 0.10 * t;
      ctx.fillStyle = padraoLinhas;
      ctx.fillRect(0, 0, LARGURA, ALTURA);
      ctx.restore();

      // Vinheta: fecha os cantos, e fecha mais quando aperta.
      const v = ctx.createRadialGradient(
        LARGURA / 2, ALTURA / 2, 340 - 120 * t,
        LARGURA / 2, ALTURA / 2, 940,
      );
      v.addColorStop(0, 'rgba(0,0,0,0)');
      v.addColorStop(1, `rgba(0,0,0,${0.58 + 0.30 * t})`);
      ctx.fillStyle = v;
      ctx.fillRect(0, 0, LARGURA, ALTURA);

      bordasDeMedo(ctx, agora, extras.medo ?? 0);
    },
  };
}
