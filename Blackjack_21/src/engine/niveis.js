// =====================================================================
//  niveis.js — os três níveis e suas punições  (sub-passo 2.4)
//
//  Regras da Parte A4 do PDF:
//    1. Guilhotina — cada um tem 5 dedos; quem perde a rodada perde
//       dedos iguais à aposta. Zerou, morreu.
//    2. Choque — um medidor de 0 a 10 para cada um; quem perde tem o
//       ponteiro subindo pela aposta. Chegou a 10, morreu. Começa com
//       2 cartas trunfo para cada lado.
//    3. Serra — um trilho de 15 marcas entre os dois, com a serra no
//       meio. Quem perde puxa a serra para o seu lado, tantas marcas
//       quanto a aposta. Chegou no fim do lado dele, morreu. Empate
//       não mexe a serra (a rodada é esquecida).
//
//  A aposta começa em 1 e sobe 1 por rodada DENTRO do nível: aparelho
//  novo, contagem nova. [decisão de design]
//
//  Este módulo é só dados e funções puras, sem DOM.
// =====================================================================

export const NIVEL = Object.freeze({ GUILHOTINA: 1, CHOQUE: 2, SERRA: 3 });

/** Trilho da serra: 0 encosta no jogador, 15 encosta no oponente. */
export const TRILHO_SERRA = 15;
export const SERRA_INICIAL = 7; // meio do trilho (C7: 7,5 arredondado)

export const NIVEIS = Object.freeze({
  [NIVEL.GUILHOTINA]: Object.freeze({
    numero: 1,
    id: 'guilhotina',
    nome: 'Guilhotina',
    punicao: 'dedos',
    trunfosIniciais: 1,
    fala: [],
  }),
  [NIVEL.CHOQUE]: Object.freeze({
    numero: 2,
    id: 'choque',
    nome: 'Choque',
    punicao: 'choque',
    maximo: 10,
    trunfosIniciais: 2,
    fala: [
      'Dedos são baratos. Sobram nove.',
      'Este aqui não dá para costurar de volta. Nível dez é o último.',
    ],
  }),
  [NIVEL.SERRA]: Object.freeze({
    numero: 3,
    id: 'serra',
    nome: 'Serra',
    punicao: 'serra',
    trunfosIniciais: 2,
    fala: [
      'Vocês dois já me entediaram.',
      'Agora há uma lâmina entre vocês. Ela anda sozinha, e nunca para no meio.',
    ],
  }),
});

export function configDoNivel(numero) {
  return NIVEIS[numero] ?? NIVEIS[NIVEL.GUILHOTINA];
}

export const ULTIMO_NIVEL = NIVEL.SERRA;

// ---------------------------------------------------------------------
//  Punição
// ---------------------------------------------------------------------

/**
 * Aplica em `lado` uma punição de `quantidade` (a aposta efetiva dele).
 * Devolve um resumo do que aconteceu, que a interface usa para animar.
 */
export function aplicarPunicaoDoNivel(jogo, lado, quantidade) {
  const config = configDoNivel(jogo.nivel);
  const participante = jogo.jogadores[lado];

  if (config.punicao === 'dedos') {
    const perdidos = Math.min(quantidade, participante.dedos);
    participante.dedos -= perdidos;
    return { tipo: 'dedos', lado, quantidade: perdidos, restante: participante.dedos };
  }

  if (config.punicao === 'choque') {
    const antes = participante.choque;
    participante.choque = Math.min(config.maximo, antes + quantidade);
    return {
      tipo: 'choque',
      lado,
      quantidade: participante.choque - antes,
      de: antes,
      para: participante.choque,
      restante: participante.choque,
    };
  }

  // Serra: o perdedor puxa a lâmina para o próprio lado.
  const antes = jogo.serra;
  const direcao = lado === 'jogador' ? -1 : 1;
  jogo.serra = Math.max(0, Math.min(TRILHO_SERRA, antes + direcao * quantidade));
  return { tipo: 'serra', lado, quantidade, de: antes, para: jogo.serra, restante: jogo.serra };
}

/** True se `lado` já não pode continuar neste nível. */
export function estaMorto(jogo, lado) {
  const config = configDoNivel(jogo.nivel);
  if (config.punicao === 'dedos') return jogo.jogadores[lado].dedos <= 0;
  if (config.punicao === 'choque') return jogo.jogadores[lado].choque >= config.maximo;
  return lado === 'jogador' ? jogo.serra <= 0 : jogo.serra >= TRILHO_SERRA;
}

/** Frase seca para a tela final, conforme o aparelho que matou. */
export function descreverMorte(nivel, nomeDoMorto) {
  if (nivel === NIVEL.CHOQUE) return `${nomeDoMorto} levou o choque de nível 10.`;
  if (nivel === NIVEL.SERRA) return `A serra chegou em ${nomeDoMorto}.`;
  return `${nomeDoMorto} não tem mais dedos.`;
}

/** Zera o aparelho para começar (ou recomeçar) um nível. */
export function prepararNivel(jogo, numero) {
  jogo.nivel = numero;
  jogo.rodadaDoNivel = 0;
  jogo.serra = SERRA_INICIAL;
  for (const lado of ['jogador', 'oponente']) {
    const p = jogo.jogadores[lado];
    p.dedos = 5;
    p.choque = 0;
    p.trunfos = [];
    p.trunfosNaMesa = [];
  }
}
