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
import { TRUNFOS } from '../config.js';

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
  // Teto de cartas por rodada: sem ele, uma Harvest na mesa repondo o que
  // sai da mão deixaria a IA jogando para sempre no mesmo turno.
  if ((jogo.stats.trunfosNaRodada?.[lado] ?? 0) >= TRUNFOS.maximoPorRodada) return null;

  const mao = jogo.jogadores[lado].trunfos;
  if (mao.length === 0) return null;

  const visao = verMesa(jogo, lado);
  const meuTotal = visao.eu.totalVisivel;
  const alvo = visao.alvo;
  const visivelDele = visao.adversario.abertas.reduce((soma, carta) => soma + carta, 0);
  const ultimaDele = visao.adversario.abertas.at(-1) ?? 0;
  const minhaUltima = visao.eu.abertas.at(-1) ?? 0;

  const tem = (id) => mao.includes(id);
  /** A melhor carta disponível de uma família, da mais forte para a mais fraca. */
  const melhorDe = (...ids) => ids.find(tem) ?? null;

  if (nivel >= 3) {
    // Limpar a mesa dele: usa a versão mais forte que tiver na mão.
    if (ameacaNaMesaDoAdversario(jogo, lado)) {
      const destruir = melhorDe('destroy_plus_plus', 'destroy_plus', 'destroy');
      if (destruir) return destruir;
    }

    // Love Your Enemy: obrigar o adversário a comprar só vale quando ele
    // já está no limite — aí a carta a mais estoura a mão dele. Como a
    // oculta dele é secreta, a conta é pelas cartas à mostra.
    if (tem('love_your_enemy') && visivelDele >= alvo - 1) return 'love_your_enemy';

    // Fechar a própria mão com a melhor carta do baralho. O Perfect
    // Draw+ vem primeiro porque ainda encarece a derrota dele.
    if (meuTotal <= alvo - 2) {
      const comprar = melhorDe('perfect_draw_plus', 'ultimate_draw', 'perfect_draw');
      if (comprar) return comprar;
    }

    // Atrasar o adversário: devolver ao baralho a carta grande que ele
    // acabou de virar. O Two-Up+ faz isso e ainda encarece a aposta dele.
    if (ultimaDele >= 8) {
      const atrasar = melhorDe('two_up_plus', 'remove');
      if (atrasar) return atrasar;
    }

    // Exchange: trocar a minha última carta pela dele quando a dele é
    // melhor e a troca não me estoura.
    if (tem('exchange') && ultimaDele > minhaUltima
      && meuTotal + (ultimaDele - minhaUltima) <= alvo) {
      return 'exchange';
    }

    // "Go For" só se o alvo novo for melhor para a mão dele: salva quem
    // estourou, ou deixa o total dele exatamente no alvo.
    const goFors = mao.filter((id) => alvoDaCarta(jogo, id) !== null);
    const melhorGoFor = goFors
      .map((id) => ({ id, alvo: alvoDaCarta(jogo, id) }))
      .filter(({ alvo: novo }) => novo !== alvo && meuTotal <= novo && meuTotal > visivelDele)
      .sort((a, b) => (a.alvo - meuTotal) - (b.alvo - meuTotal))[0];
    if (melhorGoFor && (meuTotal > alvo || meuTotal === melhorGoFor.alvo)) {
      return melhorGoFor.id;
    }

    // Harvest cedo: ela não faz nada sozinha, paga o que vier depois.
    if (tem('harvest') && mao.length > 1
      && !jaTemNaMesa(jogo, lado, 'on_trump_use_draw_trump')) {
      return 'harvest';
    }
  }

  // Níveis 2 e 3: proteção e pressão.
  // Escudo quando a derrota sairia cara e ele ainda não tem um na mesa.
  if (apostaEfetiva(jogo, lado) >= APOSTA_CARA && !jaTemNaMesa(jogo, lado, 'bet_mod')) {
    const escudo = melhorDe('shield_plus', 'shield');
    if (escudo) return escudo;
  }
  // Encarecer a derrota dele quando está na frente pelas cartas à mostra.
  if (meuTotal > visivelDele && meuTotal <= alvo) {
    const pressao = melhorDe('two_up_plus', 'two_up', 'one_up');
    if (pressao) return pressao;
  }

  // Último recurso, só no nível 3: a mão só tem carta que ele não sabe
  // usar, então troca o que dá por outras.
  if (nivel >= 3) {
    const trocar = melhorDe('trump_switch_plus', 'trump_switch');
    if (trocar && mao.every((id) => id === trocar || !SABE_USAR.has(id))) return trocar;
  }

  return null;
}

/**
 * As cartas para as quais existe regra aí em cima. Serve para a IA
 * saber quando a mão dela só tem carta inútil e vale trocar tudo.
 */
const SABE_USAR = new Set([
  'destroy', 'destroy_plus', 'destroy_plus_plus',
  'love_your_enemy', 'perfect_draw', 'perfect_draw_plus', 'ultimate_draw',
  'remove', 'two_up_plus', 'exchange', 'harvest',
  'go_for_17', 'go_for_24', 'go_for_27',
  'shield', 'shield_plus', 'two_up', 'one_up',
]);
