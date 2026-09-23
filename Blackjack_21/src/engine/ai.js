// =====================================================================
//  ai.js — a IA do oponente  (sub-passos 1.2 e 2.5)
//
//  Uma cabeça diferente para cada nível. Em todos eles a IA só enxerga
//  o que qualquer jogador enxergaria: ela decide a partir de
//  `verMesa(jogo, lado)`, que já esconde a carta oculta do adversário.
//
//  NÍVEL 1 — conta até 17.
//    Regra fixa de cassino: compra enquanto a soma da mão for menor que
//    17, senão para. Não olha o adversário nem usa cartas trunfo.
//
//  NÍVEL 2 — conta até 17 e se protege.
//    Mesma regra de compra, mas agora joga dois trunfos simples:
//    Shield quando a aposta dele está cara, e Two-Up quando está na
//    frente, para o adversário pagar mais caro pela derrota.
//
//  NÍVEL 3 — compara dois riscos e briga pelas cartas.
//    Em vez de um número fixo, estima com as cartas que ainda não
//    apareceram (o baralho mais a carta oculta do adversário, que ele
//    não vê): qual a chance de estourar se comprar, e qual a chance de
//    perder se parar. Compra quando estourar é menos provável que
//    perder parado. Além disso guarda o Destroy para o momento em que
//    o adversário coloca uma carta perigosa na mesa, e joga uma carta
//    "Go For" quando o alvo novo favorece a mão dele.
//
//  A IA só DECIDE; quem executa é quem chama, com `hit`, `stay` e
//  `aplicarTrunfo`. Assim dá para testá-la sem tocar em nenhuma partida.
// =====================================================================

import { somarMao } from './rules.js';
import { podeComprar, verMesa, apostaEfetiva } from './game.js';
import { VALOR_MINIMO, VALOR_MAXIMO } from './deck.js';

/** Total a partir do qual a IA dos níveis 1 e 2 para de comprar. */
export const LIMITE_COMPRA = 17;

/** As duas decisões possíveis de jogada. */
export const ACAO = Object.freeze({
  HIT: 'hit',
  STAY: 'stay',
});

/** Aposta a partir da qual o nível 2 considera que vale gastar um Shield. */
export const APOSTA_CARA = 3;

// ---------------------------------------------------------------------
//  Leitura da mesa
// ---------------------------------------------------------------------

/**
 * As cartas que a IA ainda não viu: todas menos a mão dela e as cartas
 * abertas do adversário. A carta oculta do adversário está aqui dentro,
 * misturada com o baralho — é justamente o que ela não sabe.
 */
export function cartasNaoVistas(visao) {
  const vistas = new Set([
    visao.eu.oculta,
    ...visao.eu.abertas,
    ...visao.adversario.abertas,
  ]);
  const restantes = [];
  for (let valor = VALOR_MINIMO; valor <= VALOR_MAXIMO; valor++) {
    if (!vistas.has(valor)) restantes.push(valor);
  }
  return restantes;
}

/** Chance de estourar se comprar mais uma carta, entre 0 e 1. */
export function riscoDeEstourar(total, alvo, naoVistas) {
  if (naoVistas.length === 0) return 1;
  const estouram = naoVistas.filter((carta) => total + carta > alvo).length;
  return estouram / naoVistas.length;
}

/**
 * Chance de perder se parar agora. Duas coisas entram na conta: o
 * adversário tem uma carta oculta que ele não vê, e o adversário ainda
 * vai continuar jogando. Para cada carta oculta possível, ele supõe que
 * o outro compra cartas de valor médio até chegar a 17 — que é a regra
 * de quem está do outro lado da mesa.
 */
export function riscoDePerderParado(meuTotal, visivelDoAdversario, alvo, naoVistas) {
  if (naoVistas.length === 0) return 0;
  const soma = naoVistas.reduce((total, carta) => total + carta, 0);

  const passamNaFrente = naoVistas.filter((oculta) => {
    const restantes = naoVistas.filter((carta) => carta !== oculta);
    const cartaMedia = restantes.length > 0 ? (soma - oculta) / restantes.length : 0;

    let total = visivelDoAdversario + oculta;
    let compras = 0;
    while (total < LIMITE_COMPRA && cartaMedia > 0 && compras < restantes.length) {
      total += cartaMedia;
      compras += 1;
    }
    return total > meuTotal && total <= alvo;
  }).length;

  return passamNaFrente / naoVistas.length;
}

// ---------------------------------------------------------------------
//  Comprar ou parar
// ---------------------------------------------------------------------

/**
 * Decide o que `lado` faria agora. Devolve ACAO.HIT ou ACAO.STAY.
 * Não altera o estado. `nivel` permite testar uma cabeça diferente da
 * do jogo em andamento (é assim que a comparação de dificuldade roda as
 * duas IAs sobre o mesmo baralho).
 */
export function decidirAcao(jogo, lado, nivel = jogo.nivel ?? 1) {
  if (!podeComprar(jogo, lado)) return ACAO.STAY; // baralho vazio, fora de turno ou fora de fase

  if (nivel < 3) {
    // Níveis 1 e 2: a conta simples até 17.
    return somarMao(jogo.jogadores[lado]) < LIMITE_COMPRA ? ACAO.HIT : ACAO.STAY;
  }

  // Nível 3: compara o risco de estourar com o risco de perder parado.
  const visao = verMesa(jogo, lado);
  const naoVistas = cartasNaoVistas(visao);
  const meuTotal = visao.eu.totalVisivel;
  const visivelDele = visao.adversario.abertas.reduce((soma, carta) => soma + carta, 0);

  const estourar = riscoDeEstourar(meuTotal, visao.alvo, naoVistas);
  const perderParado = riscoDePerderParado(meuTotal, visivelDele, visao.alvo, naoVistas);
  return estourar < perderParado ? ACAO.HIT : ACAO.STAY;
}

// ---------------------------------------------------------------------
//  Cartas trunfo
// ---------------------------------------------------------------------

const outroLado = (lado) => (lado === 'jogador' ? 'oponente' : 'jogador');

/** True se `lado` já tem na mesa uma carta com esse efeito (para não repetir). */
function jaTemNaMesa(jogo, lado, tipoDeEfeito) {
  return jogo.jogadores[lado].trunfosNaMesa
    .some((carta) => carta.efeitos.some((efeito) => efeito.type === tipoDeEfeito));
}

/**
 * True se o adversário colocou na mesa alguma carta que atrapalha `lado`:
 * ou encarece a aposta dele, ou mudou o valor-alvo. É o gatilho do Destroy.
 */
export function ameacaNaMesaDoAdversario(jogo, lado) {
  const adversario = outroLado(lado);
  return jogo.jogadores[adversario].trunfosNaMesa.some((carta) => carta.efeitos.some((efeito) => {
    if (efeito.type === 'set_target') return true;
    if (efeito.type !== 'bet_mod' || efeito.amount <= 0) return false;
    // A carta é do adversário: "self" afeta ele mesmo, "opponent" afeta `lado`.
    return (efeito.target === 'self' ? adversario : lado) === lado;
  }));
}

/** O alvo que a carta "Go For" instalaria, ou null se não for uma delas. */
function alvoDaCarta(jogo, id) {
  const carta = jogo.catalogoTrunfos?.porId.get(id);
  return carta?.effects.find((efeito) => efeito.type === 'set_target')?.value ?? null;
}

/**
 * Escolhe uma carta trunfo para `lado` jogar agora, ou null para não
 * jogar nada. Uma carta por turno: o motor aplica e a vez segue.
 */
export function decidirTrunfo(jogo, lado, nivel = jogo.nivel ?? 1) {
  if (nivel < 2 || !jogo.catalogoTrunfos) return null;      // no nível 1 ele não usa trunfos
  if (jogo.fase !== 'jogando' || jogo.turno !== lado) return null;

  const mao = jogo.jogadores[lado].trunfos;
  if (mao.length === 0) return null;

  const visao = verMesa(jogo, lado);
  const meuTotal = visao.eu.totalVisivel;
  const visivelDele = visao.adversario.abertas.reduce((soma, carta) => soma + carta, 0);
  const tem = (id) => mao.includes(id);

  if (nivel >= 3) {
    // Guardou o Destroy justamente para isto: tirar da mesa a carta que
    // o adversário acabou de usar contra ele.
    if (tem('destroy') && ameacaNaMesaDoAdversario(jogo, lado)) return 'destroy';

    // "Go For" só se o alvo novo for melhor para a mão dele: salva quem
    // estourou, ou deixa o total dele exatamente no alvo.
    const goFors = mao.filter((id) => alvoDaCarta(jogo, id) !== null);
    const melhorGoFor = goFors
      .map((id) => ({ id, alvo: alvoDaCarta(jogo, id) }))
      .filter(({ alvo }) => alvo !== visao.alvo && meuTotal <= alvo && meuTotal > visivelDele)
      .sort((a, b) => (a.alvo - meuTotal) - (b.alvo - meuTotal))[0];
    if (melhorGoFor && (meuTotal > visao.alvo || meuTotal === melhorGoFor.alvo)) {
      return melhorGoFor.id;
    }
  }

  // Níveis 2 e 3: proteção e pressão.
  // Shield quando a derrota sairia cara e ele ainda não tem um na mesa.
  if (tem('shield') && apostaEfetiva(jogo, lado) >= APOSTA_CARA && !jaTemNaMesa(jogo, lado, 'bet_mod')) {
    return 'shield';
  }
  // Two-Up quando está na frente pelas cartas à mostra: encarece a derrota dele.
  if (tem('two_up') && meuTotal > visivelDele && meuTotal <= visao.alvo) return 'two_up';
  if (tem('one_up') && meuTotal > visivelDele && meuTotal <= visao.alvo) return 'one_up';

  return null;
}
