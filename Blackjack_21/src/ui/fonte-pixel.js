// =====================================================================
//  ui/fonte-pixel.js — alfabeto de pixels 5x7  (sub-passo 3.3)
//
//  Serve para os textos que precisam ser secos: "GAME OVER" e as
//  pontuações. Cada letra é uma grade de 5 por 7, desenhada com
//  quadrados cheios — sem sombra, sem brilho, sem antisserrilhado.
//  É de propósito: o PDF (Parte B6) pede que a morte apareça como um
//  texto seco, nada de "Game Over" colorido.
// =====================================================================

const L = (...linhas) => linhas;

const GLIFOS = {
  A: L('.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'),
  B: L('####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'),
  C: L('.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'),
  D: L('####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'),
  E: L('#####', '#....', '#....', '####.', '#....', '#....', '#####'),
  F: L('#####', '#....', '#....', '####.', '#....', '#....', '#....'),
  G: L('.###.', '#...#', '#....', '#.###', '#...#', '#...#', '.###.'),
  H: L('#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'),
  I: L('.###.', '..#..', '..#..', '..#..', '..#..', '..#..', '.###.'),
  J: L('..###', '...#.', '...#.', '...#.', '...#.', '#..#.', '.##..'),
  K: L('#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'),
  L: L('#....', '#....', '#....', '#....', '#....', '#....', '#####'),
  M: L('#...#', '##.##', '#.#.#', '#...#', '#...#', '#...#', '#...#'),
  N: L('#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#', '#...#'),
  O: L('.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'),
  P: L('####.', '#...#', '#...#', '####.', '#....', '#....', '#....'),
  Q: L('.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'),
  R: L('####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'),
  S: L('.####', '#....', '#....', '.###.', '....#', '....#', '####.'),
  T: L('#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'),
  U: L('#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'),
  V: L('#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'),
  W: L('#...#', '#...#', '#...#', '#...#', '#.#.#', '##.##', '#...#'),
  X: L('#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'),
  Y: L('#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'),
  Z: L('#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'),
  0: L('.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'),
  1: L('..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'),
  2: L('.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'),
  3: L('####.', '....#', '....#', '.###.', '....#', '....#', '####.'),
  4: L('...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'),
  5: L('#####', '#....', '####.', '....#', '....#', '#...#', '.###.'),
  6: L('.###.', '#...#', '#....', '####.', '#...#', '#...#', '.###.'),
  7: L('#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'),
  8: L('.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'),
  9: L('.###.', '#...#', '#...#', '.####', '....#', '#...#', '.###.'),
  ' ': L('.....', '.....', '.....', '.....', '.....', '.....', '.....'),
  '.': L('.....', '.....', '.....', '.....', '.....', '.##..', '.##..'),
  ':': L('.....', '.##..', '.##..', '.....', '.##..', '.##..', '.....'),
  '-': L('.....', '.....', '.....', '#####', '.....', '.....', '.....'),
  '!': L('..#..', '..#..', '..#..', '..#..', '..#..', '.....', '..#..'),
  '?': L('.###.', '#...#', '....#', '...#.', '..#..', '.....', '..#..'),
};

export const LARGURA_GLIFO = 5;
export const ALTURA_GLIFO = 7;
const ESPACO_ENTRE_LETRAS = 1;

/** Largura em pixels de sprite de um texto, sem escala. */
export function larguraDoTexto(str) {
  if (str.length === 0) return 0;
  return str.length * LARGURA_GLIFO + (str.length - 1) * ESPACO_ENTRE_LETRAS;
}

/**
 * Escreve com a fonte de pixels. `x` e `y` são o canto superior esquerdo;
 * com `alinhamento` 'center' ou 'right', `x` é o centro ou a borda direita
 * (a coluna de pontos da tabela de melhores alinha por ali).
 * Não usa sombra nem brilho: é só quadrado cheio.
 */
export function desenharTextoPixel(ctx, str, x, y, escala, cor, alinhamento = 'left') {
  const letras = str.toUpperCase();
  const largura = larguraDoTexto(letras) * escala;
  let cursor = x;
  if (alinhamento === 'center') cursor = x - largura / 2;
  else if (alinhamento === 'right') cursor = x - largura;
  // Arredondar é o que mantém a letra sem antisserrilhado: um quadrado
  // que começa em meio pixel sai borrado e cria costuras dentro do traço.
  cursor = Math.round(cursor);
  const topo = Math.round(y);

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.shadowBlur = 0;
  ctx.fillStyle = cor;

  for (const caractere of letras) {
    const glifo = GLIFOS[caractere] ?? GLIFOS['?'];
    glifo.forEach((linha, ly) => {
      for (let lx = 0; lx < linha.length; lx++) {
        if (linha[lx] === '#') {
          ctx.fillRect(cursor + lx * escala, topo + ly * escala, escala, escala);
        }
      }
    });
    cursor += (LARGURA_GLIFO + ESPACO_ENTRE_LETRAS) * escala;
  }
  ctx.restore();
}
