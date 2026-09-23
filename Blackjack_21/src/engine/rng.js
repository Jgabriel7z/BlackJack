// =====================================================================
//  rng.js — gerador de números aleatórios com seed
//
//  Criado no ajuste do sub-passo 1.1. Regra do projeto (CLAUDE.md):
//  tudo que é aleatório usa este gerador, para que a mesma seed
//  reproduza a mesma partida (útil para testes e para repetir bugs).
//
//  Algoritmo: mulberry32. Pequeno, rápido e bom o suficiente para um
//  jogo de cartas. Não serve para criptografia.
// =====================================================================

/**
 * Cria uma função `aleatorio()` que devolve números em [0, 1), sempre na
 * mesma sequência para a mesma `seed` (inteiro de 32 bits).
 * A função devolvida tem a propriedade `.seed` com a seed usada.
 */
export function criarRng(seed) {
  if (!Number.isFinite(seed)) {
    throw new Error(`Seed inválida: ${seed}. Use um número inteiro.`);
  }
  let estado = seed >>> 0; // força inteiro sem sinal de 32 bits

  const aleatorio = () => {
    estado = (estado + 0x6d2b79f5) | 0;
    let t = estado;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  aleatorio.seed = seed >>> 0;
  return aleatorio;
}

/**
 * Sorteia uma seed nova. É o ÚNICO lugar do motor que usa Math.random,
 * e só quando o usuário não informou uma seed.
 */
export function seedAleatoria() {
  return Math.floor(Math.random() * 4294967296) >>> 0;
}
