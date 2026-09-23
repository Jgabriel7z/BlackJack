// =====================================================================
//  ui/pixelart.js — sprites em pixel art desenhados no canvas
//  (sub-passo 1.4, refeito duas vezes a pedido do grupo)
//
//  Cada "pixel" é um quadrado de `escala` px.
//
//  MÃO: vem de `sprites/mao.js` (64x36, gerada por tools/arte/gerar_mao.py
//  a partir da referência do grupo): dorso da mão espalmado na mesa,
//  dedos curvados como garras, algema de metal com corrente no pulso,
//  arranhões e hematomas. Sem sangue. Cada dedo é uma camada separada
//  para poder sumir quando é perdido (fica só um contorno pontilhado).
//  Legenda: . transparente  0 contorno  a..e pele (escuro -> claro)
//           g hematoma  r arranhão  n unha  m/M/H metal
//
//  Dois estilos de mão (só muda a paleta):
//    'humana'  pele quente e machucada — a mão de quem sofre
//    'palida'  cinza-arroxeada, como algo que já não é humano
//
//  ROSTO: sprite próprio, legenda: p pele  q sombra  k órbita  e olho
//         t dente  m boca  h cabelo  o contorno
// =====================================================================

import {
  CAMADAS as CAMADAS_MAO,
  ORDEM_DESENHO as ORDEM_DESENHO_MAO,
  LARGURA as LARGURA_MAO,
  ALTURA as ALTURA_MAO,
} from './sprites/mao.js';
import {
  CAMADAS as CAMADAS_LUIZ,
  PALETA as PALETA_LUIZ,
  ORDEM_DEDOS as ORDEM_DEDOS_LUIZ,
  LARGURA as LARGURA_LUIZ,
  ALTURA as ALTURA_LUIZ,
  LINHA_DA_MESA as LINHA_DA_MESA_LUIZ,
  PESCOCO as PESCOCO_LUIZ,
  MAO_DIREITA as MAO_DIREITA_LUIZ,
} from './sprites/luiz.js';

// ---------------------------------------------------------------------
//  Paletas
// ---------------------------------------------------------------------

export const PALETAS_MAO = {
  humana: {
    0: '#15111a',
    a: '#4a3238',
    b: '#6a4a4e',
    c: '#8a6660',
    d: '#a88478',
    e: '#c4a08e',
    g: '#6d6a52',
    r: '#7a3540',
    n: '#3a3a33',
    m: '#23242a',
    M: '#474a54',
    H: '#7e828f',
  },
  palida: {
    0: '#15111a',
    a: '#3c3444',
    b: '#574a5c',
    c: '#75657a',
    d: '#8f8290',
    e: '#a89ca4',
    g: '#5e6b5a',
    r: '#5c3a4a',
    n: '#3a4038',
    m: '#23242a',
    M: '#474a54',
    H: '#7e828f',
  },
};


/** Ordem em que os dedos são perdidos (o 1º da lista cai primeiro). */
export const ORDEM_PERDA = ['polegar', 'minimo', 'anelar', 'medio', 'indicador'];

// ---------------------------------------------------------------------
//  Mão (64 x 36 pixels de sprite, em camadas)
// ---------------------------------------------------------------------

export const TAMANHO_MAO = { largura: LARGURA_MAO, altura: ALTURA_MAO };

/**
 * Pinta uma grade de caracteres. `sprite` = { x, y, linhas } ou só { linhas }.
 * opcoes.apenasContorno: só os pixels '0'/'o', pontilhados (dedo perdido).
 * opcoes.espelhar: inverte horizontalmente dentro de `larguraTotal`.
 * opcoes.trocar: mapa de substituição de caracteres (ex.: olhos fechados).
 */
function desenharSprite(ctx, sprite, x0, y0, escala, paleta, opcoes = {}) {
  const { apenasContorno = false, trocar = null, espelhar = false, larguraTotal = 0 } = opcoes;
  const sx = sprite.x ?? 0;
  const sy = sprite.y ?? 0;
  sprite.linhas.forEach((linha, ly) => {
    for (let lx = 0; lx < linha.length; lx++) {
      let ch = linha[lx];
      if (ch === '.') continue;
      if (trocar && trocar[ch]) ch = trocar[ch];
      let px = sx + lx;
      const py = sy + ly;
      if (espelhar) px = larguraTotal - 1 - px;
      if (apenasContorno) {
        if ((ch !== '0' && ch !== 'o') || (px + py) % 2 === 1) continue; // pontilhado
        ctx.fillStyle = 'rgba(40, 20, 34, 0.55)';
      } else {
        ctx.fillStyle = paleta[ch] ?? '#ff00ff';
      }
      ctx.fillRect(x0 + px * escala, y0 + py * escala, escala, escala);
    }
  });
}

/**
 * Desenha a mão com `dedos` presentes (0..5), canto superior esquerdo em
 * (x, y). Tamanho final: 64*escala por 36*escala.
 * opcoes.estilo: 'humana' | 'palida'
 * opcoes.espelhar: true = pulso à esquerda, dedos para a direita (padrão)
 */
export function desenharMaoPixel(ctx, x, y, dedos, opcoes = {}) {
  const { escala = 4, estilo = 'humana', espelhar = true } = opcoes;
  const paleta = PALETAS_MAO[estilo] ?? PALETAS_MAO.humana;
  const perdidos = new Set(ORDEM_PERDA.slice(0, 5 - Math.max(0, Math.min(5, dedos))));
  const comum = { espelhar, larguraTotal: LARGURA_MAO };

  ctx.save();
  ctx.imageSmoothingEnabled = false;

  // Sombra chapada sob a mão, deslocada para baixo e para a direita.
  ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
  ctx.beginPath();
  ctx.ellipse(
    x + (LARGURA_MAO / 2) * escala + escala * 2,
    y + (ALTURA_MAO / 2) * escala + escala * 3,
    (LARGURA_MAO / 2) * escala * 0.9,
    (ALTURA_MAO / 2) * escala * 0.7,
    0, 0, Math.PI * 2,
  );
  ctx.fill();

  desenharSprite(ctx, { linhas: CAMADAS_MAO.base }, x, y, escala, paleta, comum);
  for (const nome of ORDEM_DESENHO_MAO) {
    desenharSprite(ctx, { linhas: CAMADAS_MAO[nome] }, x, y, escala, paleta, {
      ...comum,
      apenasContorno: perdidos.has(nome),
    });
  }
  ctx.restore();
}

// ---------------------------------------------------------------------
//  Luiz Alberto (112 x 64 pixels de sprite, em camadas e quadros)
// ---------------------------------------------------------------------

export const TAMANHO_LUIZ = { largura: LARGURA_LUIZ, altura: ALTURA_LUIZ };
export const LINHA_DA_MESA_LUIZ_PX = LINHA_DA_MESA_LUIZ;
export const PESCOCO_LUIZ_PX = PESCOCO_LUIZ;
export const MAO_DIREITA_LUIZ_PX = MAO_DIREITA_LUIZ;

/**
 * Parte de cima do Luiz (tronco, camiseta, cabeça), desenhada ANTES do
 * tampo da mesa. (x, y) é o canto superior esquerdo da grade.
 * opcoes.inclinacao: 'neutra' | 'esq' | 'dir'  (quadro da cabeça)
 * opcoes.piscando: olhos fechados
 */
export function desenharLuizCorpo(ctx, x, y, opcoes = {}) {
  const { escala = 3, inclinacao = 'neutra', piscando = false } = opcoes;
  const quadro = `cabeca_${inclinacao}${piscando ? '_piscando' : ''}`;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  desenharSprite(ctx, { linhas: CAMADAS_LUIZ.corpo }, x, y, escala, PALETA_LUIZ);
  desenharSprite(ctx, { linhas: CAMADAS_LUIZ[quadro] ?? CAMADAS_LUIZ.cabeca_neutra }, x, y, escala, PALETA_LUIZ);
  ctx.restore();
}

/**
 * Antebraços e mãos do Luiz sobre a mesa, desenhados DEPOIS do tampo.
 * A mão direita (do lado direito da tela) é a que está em jogo: `dedos`
 * presentes (0..5); os perdidos ficam só com contorno pontilhado.
 */
export function desenharLuizBracos(ctx, x, y, dedos, opcoes = {}) {
  const { escala = 3 } = opcoes;
  const perdidos = new Set(ORDEM_PERDA.slice(0, 5 - Math.max(0, Math.min(5, dedos))));
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  desenharSprite(ctx, { linhas: CAMADAS_LUIZ.antebracos }, x, y, escala, PALETA_LUIZ);
  desenharSprite(ctx, { linhas: CAMADAS_LUIZ.mao_dir_base }, x, y, escala, PALETA_LUIZ);
  for (const nome of ORDEM_DEDOS_LUIZ) {
    desenharSprite(ctx, { linhas: CAMADAS_LUIZ[`mao_dir_${nome}`] }, x, y, escala, PALETA_LUIZ, {
      apenasContorno: perdidos.has(nome),
    });
  }
  ctx.restore();
}
