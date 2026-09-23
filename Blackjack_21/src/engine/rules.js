// =====================================================================
//  rules.js — as regras de contagem e de vitória do 21
//
//  Fonte: 21_referencia_jogo.pdf, Parte C1 e C4.
//    - Total de uma mão = carta oculta + todas as cartas abertas.
//    - "Estourar" = passar do alvo (21 por padrão).
//    - Vence quem chega mais perto do alvo SEM passar.
//    - Se os dois passarem, vence quem tem o MENOR total.
//    - Totais iguais (os dois abaixo ou os dois estourados) = empate.
//
//  Funções puras: recebem números e devolvem números/strings.
// =====================================================================

export const ALVO_PADRAO = 21;

/** Identificadores dos dois lados da mesa. */
export const LADO = Object.freeze({
  JOGADOR: 'jogador',
  OPONENTE: 'oponente',
});

/** Resultado possível de uma rodada. */
export const RESULTADO = Object.freeze({
  JOGADOR: 'jogador',
  OPONENTE: 'oponente',
  EMPATE: 'empate',
});

/**
 * Soma uma mão. A mão tem o formato { oculta: número|null, abertas: número[] }.
 * Uma mão sem carta oculta (ainda não distribuída) conta a oculta como 0.
 */
export function somarMao(mao) {
  const oculta = mao.oculta ?? 0;
  const abertas = mao.abertas.reduce((soma, carta) => soma + carta, 0);
  return oculta + abertas;
}

/** True se o total passou do alvo. */
export function estourou(total, alvo = ALVO_PADRAO) {
  return total > alvo;
}

/**
 * Decide o vencedor de uma rodada a partir dos dois totais.
 * Devolve RESULTADO.JOGADOR, RESULTADO.OPONENTE ou RESULTADO.EMPATE.
 */
export function decidirVencedor(totalJogador, totalOponente, alvo = ALVO_PADRAO) {
  const jogadorEstourou = estourou(totalJogador, alvo);
  const oponenteEstourou = estourou(totalOponente, alvo);

  // Só um estourou: o outro vence.
  if (jogadorEstourou && !oponenteEstourou) return RESULTADO.OPONENTE;
  if (oponenteEstourou && !jogadorEstourou) return RESULTADO.JOGADOR;

  // Totais iguais: empate (vale tanto para os dois abaixo quanto os dois acima).
  if (totalJogador === totalOponente) return RESULTADO.EMPATE;

  // Os dois estouraram: vence o MENOR total.
  if (jogadorEstourou && oponenteEstourou) {
    return totalJogador < totalOponente ? RESULTADO.JOGADOR : RESULTADO.OPONENTE;
  }

  // Nenhum estourou: vence o MAIOR total (mais perto do alvo).
  return totalJogador > totalOponente ? RESULTADO.JOGADOR : RESULTADO.OPONENTE;
}

/** Devolve o lado oposto ao informado. */
export function outroLado(lado) {
  return lado === LADO.JOGADOR ? LADO.OPONENTE : LADO.JOGADOR;
}
