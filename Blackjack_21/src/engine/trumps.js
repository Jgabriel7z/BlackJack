// =====================================================================
//  trumps.js — cartas trunfo  (sub-passo 2.2)
//
//  Cartas desta etapa (as demais ficam para a Etapa 4):
//    One-Up, Two-Up, 2..7 Card, Remove, Return, Shield, Destroy,
//    Perfect Draw, Go for 17, Go for 24, Go for 27.
//
//  Como funciona:
//    - O catálogo chega PRONTO de fora (`prepararCatalogo(json)`); este
//      módulo nunca lê arquivo nem faz fetch.
//    - Cada carta tem uma lista de `effects` tipados, vindos do JSON.
//      `aplicarTrunfo` executa os efeitos na ordem.
//    - Efeito com `persistent: true` vira uma carta NA MESA, do lado de
//      quem jogou, e continua valendo enquanto estiver lá (é isso que
//      Destroy remove). Os demais efeitos acontecem na hora.
//    - Nada de DOM: só dados e funções.
//
//  Quem lê o resultado: `apostaEfetiva(jogo, lado)` e `alvoAtual(jogo)`
//  em game.js, que somam os efeitos persistentes das cartas na mesa.
// =====================================================================

import { comprar } from './deck.js';
import { TRUNFOS } from '../config.js';

/** Ids das cartas implementadas nesta etapa. */
export const CARTAS_DA_ETAPA_2 = Object.freeze([
  'one_up', 'two_up',
  'card_2', 'card_3', 'card_4', 'card_5', 'card_6', 'card_7',
  'remove', 'return', 'shield', 'destroy', 'perfect_draw',
  'go_for_17', 'go_for_24', 'go_for_27',
]);

/** Tipos de efeito que este módulo sabe executar. */
const EFEITOS_SUPORTADOS = new Set([
  'bet_mod', 'draw_trump', 'draw_specific', 'return_last_faceup',
  'destroy_last_trump', 'draw_best', 'set_target',
]);

/**
 * Prepara o catálogo a partir do JSON já carregado por quem chama.
 * Devolve { porId, disponiveis } com só as cartas desta etapa.
 * `opcoes.ids` permite outra lista (usada nos testes).
 */
export function prepararCatalogo(json, opcoes = {}) {
  const ids = opcoes.ids ?? CARTAS_DA_ETAPA_2;
  const porId = new Map();
  for (const carta of json.player_cards ?? []) {
    if (!ids.includes(carta.id)) continue;
    const naoSuportado = carta.effects.find((e) => !EFEITOS_SUPORTADOS.has(e.type));
    if (naoSuportado) {
      throw new Error(`Carta ${carta.id} usa efeito não suportado nesta etapa: ${naoSuportado.type}`);
    }
    porId.set(carta.id, carta);
  }
  const faltando = ids.filter((id) => !porId.has(id));
  if (faltando.length) throw new Error(`Cartas ausentes no catálogo: ${faltando.join(', ')}`);
  return { porId, disponiveis: [...porId.keys()] };
}

// ---------------------------------------------------------------------
//  Mão e mesa
// ---------------------------------------------------------------------

/**
 * Dá uma carta trunfo sorteada a `lado`. Devolve o id, ou null se a mão
 * estiver cheia. Acima de `TRUNFOS.maximoNaMao` o mais antigo é descartado.
 */
export function darTrunfo(jogo, lado, id = null) {
  const participante = jogo.jogadores[lado];
  const escolhido = id ?? jogo.catalogoTrunfos.disponiveis[
    Math.floor(jogo._aleatorioTrunfos() * jogo.catalogoTrunfos.disponiveis.length)
  ];
  participante.trunfos.push(escolhido);
  while (participante.trunfos.length > TRUNFOS.maximoNaMao) participante.trunfos.shift();
  return escolhido;
}

/** True se `lado` tem esse trunfo na mão e pode jogá-lo agora. */
export function podeJogarTrunfo(jogo, lado, id) {
  return jogo.fase === 'jogando'
    && jogo.turno === lado
    && jogo.jogadores[lado].trunfos.includes(id);
}

/** Cartas persistentes na mesa do lado de `lado`. */
export function trunfosNaMesa(jogo, lado) {
  return jogo.jogadores[lado].trunfosNaMesa;
}

function outro(lado) {
  return lado === 'jogador' ? 'oponente' : 'jogador';
}

// ---------------------------------------------------------------------
//  Consulta dos efeitos persistentes
// ---------------------------------------------------------------------

/**
 * Aposta efetiva de `lado`: aposta base + modificadores persistentes que
 * afetam esse lado, nunca abaixo de zero.
 *   - Shield (do próprio lado) reduz a própria aposta.
 *   - One-Up/Two-Up (do lado adversário) aumentam a aposta deste lado.
 */
export function modificadorDeAposta(jogo, lado) {
  let soma = 0;
  for (const dono of ['jogador', 'oponente']) {
    for (const carta of jogo.jogadores[dono].trunfosNaMesa) {
      for (const efeito of carta.efeitos) {
        if (efeito.type !== 'bet_mod') continue;
        const afetado = efeito.target === 'self' ? dono : outro(dono);
        if (afetado === lado) soma += efeito.amount;
      }
    }
  }
  return soma;
}

/** Alvo atual da rodada: o `set_target` mais recente na mesa, ou o alvo base. */
export function alvoDaMesa(jogo) {
  let alvo = null;
  let maisRecente = -1;
  for (const dono of ['jogador', 'oponente']) {
    for (const carta of jogo.jogadores[dono].trunfosNaMesa) {
      for (const efeito of carta.efeitos) {
        if (efeito.type === 'set_target' && carta.ordem > maisRecente) {
          maisRecente = carta.ordem;
          alvo = efeito.value;
        }
      }
    }
  }
  return alvo;
}

// ---------------------------------------------------------------------
//  Execução
// ---------------------------------------------------------------------

/** A "melhor carta possível" (C7): a que deixa o total mais perto do alvo sem passar; se todas estouram, a menor. */
export function melhorCartaDoBaralho(baralho, totalAtual, alvo) {
  if (baralho.length === 0) return null;
  let melhor = null;
  for (const carta of baralho) {
    const total = totalAtual + carta;
    if (total > alvo) continue;
    if (melhor === null || total > totalAtual + melhor) melhor = carta;
  }
  if (melhor !== null) return melhor;
  return Math.min(...baralho); // todas estouram: a que estoura menos
}

function tirarDoBaralho(baralho, valor) {
  const i = baralho.indexOf(valor);
  if (i === -1) return null;
  baralho.splice(i, 1);
  return valor;
}

/** Devolve ao baralho a última carta ABERTA de `lado`. Devolve o valor ou null. */
function devolverUltimaAberta(jogo, lado) {
  const mao = jogo.jogadores[lado];
  if (mao.abertas.length === 0) return null;
  const carta = mao.abertas.pop();
  jogo.baralho.push(carta);
  return carta;
}

/** Remove da mesa a última carta persistente que `lado` colocou. Devolve o id ou null. */
function destruirUltimoTrunfo(jogo, lado) {
  const mesa = jogo.jogadores[lado].trunfosNaMesa;
  if (mesa.length === 0) return null;
  return mesa.pop().id;
}

/**
 * Joga o trunfo `id` por `lado`. Tira da mão, executa os efeitos e, se
 * houver efeito persistente, deixa a carta na mesa.
 * Devolve um relatório do que aconteceu (útil para a interface e os testes).
 * Lança erro se não for possível jogar.
 */
export function aplicarTrunfo(jogo, lado, id) {
  if (!podeJogarTrunfo(jogo, lado, id)) {
    throw new Error(`${lado} não pode jogar o trunfo ${id} agora.`);
  }
  const carta = jogo.catalogoTrunfos.porId.get(id);
  if (!carta) throw new Error(`Trunfo desconhecido: ${id}`);

  const mao = jogo.jogadores[lado];
  mao.trunfos.splice(mao.trunfos.indexOf(id), 1);

  const relatorio = { id, lado, nome: carta.name, acoes: [], ficouNaMesa: false };
  const persistentes = [];

  for (const efeito of carta.effects) {
    const alvoLado = efeito.target === 'opponent' ? outro(lado) : lado;

    switch (efeito.type) {
      case 'bet_mod':
      case 'set_target':
        persistentes.push(efeito);
        break;

      case 'draw_trump': {
        const ganhos = [];
        for (let i = 0; i < (efeito.count ?? 1); i++) ganhos.push(darTrunfo(jogo, alvoLado));
        relatorio.acoes.push({ tipo: 'draw_trump', lado: alvoLado, trunfos: ganhos });
        break;
      }

      case 'draw_specific': {
        // "Se ela não estiver mais no baralho, nada acontece."
        const comprada = tirarDoBaralho(jogo.baralho, efeito.value);
        if (comprada !== null) jogo.jogadores[alvoLado].abertas.push(comprada);
        relatorio.acoes.push({ tipo: 'draw_specific', lado: alvoLado, valor: efeito.value, comprada });
        break;
      }

      case 'draw_best': {
        const soma = (jogo.jogadores[alvoLado].oculta ?? 0)
          + jogo.jogadores[alvoLado].abertas.reduce((s, c) => s + c, 0);
        const melhor = melhorCartaDoBaralho(jogo.baralho, soma, alvoDaMesa(jogo) ?? jogo.alvo);
        if (melhor !== null) {
          tirarDoBaralho(jogo.baralho, melhor);
          jogo.jogadores[alvoLado].abertas.push(melhor);
        }
        relatorio.acoes.push({ tipo: 'draw_best', lado: alvoLado, comprada: melhor });
        break;
      }

      case 'return_last_faceup': {
        const devolvida = devolverUltimaAberta(jogo, alvoLado);
        relatorio.acoes.push({ tipo: 'return_last_faceup', lado: alvoLado, devolvida });
        break;
      }

      case 'destroy_last_trump': {
        const destruido = destruirUltimoTrunfo(jogo, alvoLado);
        relatorio.acoes.push({ tipo: 'destroy_last_trump', lado: alvoLado, destruido });
        break;
      }

      default:
        throw new Error(`Efeito não suportado: ${efeito.type}`);
    }
  }

  if (persistentes.length > 0) {
    // "Go For" substitui outra "Go For" que já esteja na mesa (qualquer lado).
    const substitui = persistentes.find((e) => e.replaces_tag)?.replaces_tag;
    if (substitui) {
      for (const dono of ['jogador', 'oponente']) {
        const mesa = jogo.jogadores[dono].trunfosNaMesa;
        for (let i = mesa.length - 1; i >= 0; i--) {
          if (mesa[i].efeitos.some((e) => e.replaces_tag === substitui)) mesa.splice(i, 1);
        }
      }
    }
    jogo.jogadores[lado].trunfosNaMesa.push({
      id,
      nome: carta.name,
      efeitos: persistentes,
      ordem: jogo._ordemTrunfo++,
    });
    relatorio.ficouNaMesa = true;
  }

  jogo.stats.trunfosUsados[lado] += 1;
  return relatorio;
}
