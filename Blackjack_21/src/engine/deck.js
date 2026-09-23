// =====================================================================
//  deck.js — o baralho do 21  (sub-passo 1.1)
//
//  Regra (21_referencia_jogo.pdf, C1): o baralho tem 11 cartas, com os
//  valores de 1 a 11, UMA de cada. Os dois jogadores compram do mesmo
//  baralho. Não existe naipe: uma carta é só o seu número.
//
//  Este arquivo não conhece nada de tela (DOM), só arrays de números.
//  O embaralhamento usa o gerador com seed de rng.js.
// =====================================================================

import { criarRng, seedAleatoria } from './rng.js';

export const VALOR_MINIMO = 1;
export const VALOR_MAXIMO = 11;

/** Cria um baralho novo, em ordem, com as cartas 1..11. */
export function criarBaralho() {
  const cartas = [];
  for (let valor = VALOR_MINIMO; valor <= VALOR_MAXIMO; valor++) {
    cartas.push(valor);
  }
  return cartas;
}

/**
 * Devolve uma CÓPIA embaralhada do array recebido (Fisher-Yates).
 * `aleatorio` é uma função que devolve números em [0, 1), normalmente
 * criada por `criarRng(seed)`. Se não for informada, uma seed nova é
 * sorteada, mas nesse caso o resultado não é reproduzível; prefira
 * passar o gerador da partida.
 */
export function embaralhar(cartas, aleatorio = criarRng(seedAleatoria())) {
  const copia = [...cartas];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(aleatorio() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

/** Atalho: embaralha com uma seed numérica. Mesma seed, mesmo baralho. */
export function embaralharComSeed(cartas, seed) {
  return embaralhar(cartas, criarRng(seed));
}

/**
 * Tira a carta do TOPO do baralho e a devolve. O topo é o fim do array,
 * então esta função altera o array recebido (remove um elemento).
 * Lança erro se o baralho estiver vazio: quem chama deve checar antes
 * com `baralho.length > 0`.
 */
export function comprar(baralho) {
  if (baralho.length === 0) {
    throw new Error('O baralho está vazio; não há carta para comprar.');
  }
  return baralho.pop();
}
