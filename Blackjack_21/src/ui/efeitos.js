// =====================================================================
//  ui/efeitos.js — pós-processamento da tela  (passe visual pós-Etapa 1)
//
//  Inspirado nos filtros de CRT/grain/vinheta do PixiJS Filters que o
//  grupo guardou em REFERENCIAS.md, reimplementado em Canvas 2D sem
//  dependência:
//    - granulado de filme: 4 ladrilhos de ruído pré-gerados, desenhados
//      em posições que mudam a cada quadro, com mistura "overlay"
//    - linhas de varredura: padrão de 1 px escuro a cada 3 px
//    - vinheta forte nos cantos
//  Tudo barato por quadro (só drawImage/fillRect), sem ler pixels.
//  Desligável com ?efeitos=0.
// =====================================================================

const LARGURA = 1280;
const ALTURA = 720;
const TAMANHO_LADRILHO = 256;

function ruidoFixo(i) {
  const v = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
  return v - Math.floor(v);
}

function criarLadrilhoDeRuido(semente) {
  const tela = document.createElement('canvas');
  tela.width = TAMANHO_LADRILHO;
  tela.height = TAMANHO_LADRILHO;
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
  const tela = document.createElement('canvas');
  tela.width = 4;
  tela.height = 3;
  const ctx = tela.getContext('2d');
  ctx.fillStyle = 'rgba(0,0,0,0)';
  ctx.fillRect(0, 0, 4, 3);
  ctx.fillStyle = 'rgba(0,0,0,1)';
  ctx.fillRect(0, 2, 4, 1);
  return tela;
}

export function criarEfeitos(opcoes = {}) {
  const { ativos = true } = opcoes;
  const ladrilhos = [0, 1, 2, 3].map(criarLadrilhoDeRuido);
  const linhas = criarLinhasDeVarredura();
  let padraoLinhas = null;

  return {
    ativos,

    /**
     * Aplica granulado, linhas de varredura e vinheta sobre o quadro já desenhado.
     * `intensidade` 0..1 aumenta o granulado (ex.: perto da morte ou no escuro).
     */
    aplicar(ctx, agora, intensidade = 0) {
      if (!ativos) return;

      // Granulado: ladrilho e deslocamento mudam a cada quadro.
      const quadro = Math.floor(agora / 33);
      const ladrilho = ladrilhos[quadro % ladrilhos.length];
      const dx = Math.floor(ruidoFixo(quadro) * TAMANHO_LADRILHO);
      const dy = Math.floor(ruidoFixo(quadro + 17) * TAMANHO_LADRILHO);
      ctx.save();
      ctx.globalCompositeOperation = 'overlay';
      ctx.globalAlpha = 0.11 + 0.14 * intensidade;
      for (let y = -dy; y < ALTURA; y += TAMANHO_LADRILHO) {
        for (let x = -dx; x < LARGURA; x += TAMANHO_LADRILHO) {
          ctx.drawImage(ladrilho, x, y);
        }
      }
      ctx.restore();

      // Linhas de varredura.
      if (!padraoLinhas) padraoLinhas = ctx.createPattern(linhas, 'repeat');
      ctx.save();
      ctx.globalAlpha = 0.16;
      ctx.fillStyle = padraoLinhas;
      ctx.fillRect(0, 0, LARGURA, ALTURA);
      ctx.restore();

      // Vinheta: fecha os cantos, mas sem apagar os rótulos das bordas.
      const v = ctx.createRadialGradient(LARGURA / 2, ALTURA / 2, 340, LARGURA / 2, ALTURA / 2, 940);
      v.addColorStop(0, 'rgba(0,0,0,0)');
      v.addColorStop(1, 'rgba(0,0,0,0.58)');
      ctx.fillStyle = v;
      ctx.fillRect(0, 0, LARGURA, ALTURA);
    },
  };
}
