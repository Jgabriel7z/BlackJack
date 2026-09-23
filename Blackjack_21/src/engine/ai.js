// =====================================================================
//  ai.js — a IA do oponente  (sub-passo 1.2)
//
//  Regra desta etapa (a mais simples possível, como no plano):
//    - Soma as próprias cartas (a oculta + as abertas).
//    - Se o total for MENOR que 17, compra ("hit").
//    - Senão, para ("stay").
//    - Com o baralho vazio, sempre para: não dá para comprar.
//
//  A IA só OLHA o estado e devolve a decisão como texto. Quem executa a
//  ação é quem chama, usando `hit()` ou `stay()` de game.js. Assim a IA
//  pode ser testada sem mexer em nenhuma partida, e a interface decide
//  quando (e com quanta pausa dramática) aplicar a jogada.
//
//  Ela não enxerga a carta oculta do adversário: usa só a própria mão.
// =====================================================================

import { somarMao } from './rules.js';
import { podeComprar } from './game.js';

/** Total a partir do qual a IA para de comprar. */
export const LIMITE_COMPRA = 17;

/** As duas decisões possíveis. */
export const ACAO = Object.freeze({
  HIT: 'hit',
  STAY: 'stay',
});

/**
 * Decide o que `lado` faria agora. Devolve ACAO.HIT ou ACAO.STAY.
 * Não altera o estado. Não verifica de quem é o turno: quem chama
 * decide o momento de aplicar.
 */
export function decidirAcao(jogo, lado) {
  if (!podeComprar(jogo, lado)) return ACAO.STAY; // baralho vazio (ou fora de turno/fase)

  const total = somarMao(jogo.jogadores[lado]);
  return total < LIMITE_COMPRA ? ACAO.HIT : ACAO.STAY;
}
