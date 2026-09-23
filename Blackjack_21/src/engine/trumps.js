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
import { TRUNFOS, RARIDADES, RARIDADE_DOS_TRUNFOS } from '../config.js';

/**
 * As cartas trunfo do jogador. As 16 primeiras são da Etapa 2; as 11
 * de baixo entraram no sub-passo 4.4a e completam a lista de
 * `player_cards` do catálogo.
 */
export const CARTAS_DO_JOGADOR = Object.freeze([
  'one_up', 'two_up',
  'card_2', 'card_3', 'card_4', 'card_5', 'card_6', 'card_7',
  'remove', 'return', 'shield', 'destroy', 'perfect_draw',
  'go_for_17', 'go_for_24', 'go_for_27',
  // 4.4a
  'two_up_plus', 'shield_plus', 'exchange', 'trump_switch', 'trump_switch_plus',
  'destroy_plus', 'destroy_plus_plus', 'perfect_draw_plus', 'ultimate_draw',
  'harvest', 'love_your_enemy',
]);

/** Tipos de efeito que este módulo sabe executar. */
const EFEITOS_SUPORTADOS = new Set([
  'bet_mod', 'draw_trump', 'draw_specific', 'return_last_faceup',
  'destroy_last_trump', 'draw_best', 'set_target',
  // 4.4a
  'swap_last_faceup', 'discard_random_trumps', 'destroy_all_trumps',
  'block_trumps', 'on_trump_use_draw_trump',
  // 4.8 (a carta que o anfitrião joga)
  'block_draw',
]);

/**
 * Prepara o catálogo a partir do JSON já carregado por quem chama.
 * Devolve { porId, disponiveis } com só as cartas desta etapa.
 * `opcoes.ids` permite outra lista (usada nos testes).
 *
 * `opcoes.sorteaveis` (4.1) diz quais delas o SORTEIO pode tirar. Serve
 * para as cartas que ainda não foram desbloqueadas: o motor continua
 * conhecendo a carta (então `?trunfos=` ainda consegue forçá-la numa
 * captura), ela só não aparece sozinha na mão de ninguém.
 */
export function prepararCatalogo(json, opcoes = {}) {
  const ids = opcoes.ids ?? CARTAS_DO_JOGADOR;
  const porId = new Map();
  // `opcoes.extras` traz cartas de INIMIGO que o motor precisa conhecer
  // mas ninguém sorteia — hoje só a Desperation, que o anfitrião joga
  // na trapaça do 4.8.
  const extras = opcoes.extras ?? [];
  const fonte = [...(json.player_cards ?? []), ...(json.enemy_cards ?? [])];
  for (const carta of fonte) {
    if (!ids.includes(carta.id) && !extras.includes(carta.id)) continue;
    if (porId.has(carta.id)) continue;
    const naoSuportado = carta.effects.find((e) => !EFEITOS_SUPORTADOS.has(e.type));
    if (naoSuportado) {
      throw new Error(`Carta ${carta.id} usa efeito não suportado nesta etapa: ${naoSuportado.type}`);
    }
    porId.set(carta.id, carta);
  }
  const faltando = [...ids, ...extras].filter((id) => !porId.has(id));
  if (faltando.length) throw new Error(`Cartas ausentes no catálogo: ${faltando.join(', ')}`);

  // O sorteio nunca tira as extras: elas não são cartas de mão.
  const todas = [...porId.keys()].filter((id) => !extras.includes(id));
  const sorteaveis = opcoes.sorteaveis
    ? todas.filter((id) => opcoes.sorteaveis.includes(id))
    : todas;
  if (sorteaveis.length === 0) throw new Error('Nenhuma carta trunfo pode ser sorteada.');

  // Tabela de sorteio por peso: as boas saem menos. O acumulado é
  // calculado uma vez aqui, em cima das cartas que estão liberadas.
  let acumulado = 0;
  const faixas = sorteaveis.map((id) => {
    acumulado += pesoDaCarta(id);
    return { id, ate: acumulado };
  });
  const porcentagens = new Map(
    sorteaveis.map((id) => [id, (pesoDaCarta(id) / acumulado) * 100]),
  );

  return { porId, disponiveis: sorteaveis, faixas, pesoTotal: acumulado, porcentagens };
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
  const escolhido = id ?? sortearTrunfo(jogo.catalogoTrunfos, jogo._aleatorioTrunfos());
  participante.trunfos.push(escolhido);
  // O limite do jogador pode ser maior que o do config, por recompensa;
  // o do oponente é sempre o padrão.
  const limite = lado === 'jogador'
    ? (jogo.maximoNaMao ?? TRUNFOS.maximoNaMao)
    : TRUNFOS.maximoNaMao;
  while (participante.trunfos.length > limite) participante.trunfos.shift();
  return escolhido;
}

/**
 * Sorteia uma carta respeitando os pesos de raridade. `aleatorio` é um
 * número de 0 a 1 vindo do gerador com seed, então a mesma seed dá
 * sempre a mesma carta.
 */
export function sortearTrunfo(catalogo, aleatorio) {
  const alvo = aleatorio * catalogo.pesoTotal;
  const faixa = catalogo.faixas.find((f) => alvo < f.ate);
  return (faixa ?? catalogo.faixas[catalogo.faixas.length - 1]).id;
}

/** True se `lado` tem esse trunfo na mão e pode jogá-lo agora. */
export function podeJogarTrunfo(jogo, lado, id) {
  return jogo.fase === 'jogando'
    && jogo.turno === lado
    && jogo.jogadores[lado].trunfos.includes(id)
    && !trunfosBloqueados(jogo, lado);
}

/**
 * True se alguma carta na mesa proíbe `lado` de COMPRAR cartas. É a
 * Desperation, que o anfitrião joga na trapaça do 4.8.
 */
export function compraBloqueada(jogo, lado) {
  return temEfeitoContra(jogo, lado, 'block_draw');
}

/**
 * True se alguma carta na mesa proíbe `lado` de jogar trunfos. Hoje só
 * o Destroy++ faz isso, e ele vale enquanto estiver na mesa (4.4a).
 */
export function trunfosBloqueados(jogo, lado) {
  return temEfeitoContra(jogo, lado, 'block_trumps');
}

/** Procura na mesa dos dois lados um efeito persistente contra `lado`. */
function temEfeitoContra(jogo, lado, tipo) {
  for (const dono of ['jogador', 'oponente']) {
    for (const carta of jogo.jogadores[dono].trunfosNaMesa) {
      for (const efeito of carta.efeitos) {
        if (efeito.type !== tipo) continue;
        if (efeito.target === 'both') return true;
        const afetado = efeito.target === 'self' ? dono : outro(dono);
        if (afetado === lado) return true;
      }
    }
  }
  return false;
}

/** A gaveta de raridade da carta; o que não estiver na lista é comum. */
export function raridadeDaCarta(id) {
  return RARIDADES[RARIDADE_DOS_TRUNFOS[id] ?? 'comum'];
}

function pesoDaCarta(id) {
  return raridadeDaCarta(id).peso;
}

/**
 * A chance de esta carta sair num sorteio, em porcentagem, com as cartas
 * que estão liberadas agora. Devolve null se ela não entra no sorteio.
 */
export function chanceDaCarta(catalogo, id) {
  return catalogo?.porcentagens?.get(id) ?? null;
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
        // "both" é da Desperation (4.8): ela encarece os DOIS lados.
        if (efeito.target === 'both') { soma += efeito.amount; continue; }
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

  // Harvest (4.4a): "enquanto esta carta estiver na mesa, você compra uma
  // carta trunfo depois de usar uma". Conta antes de a carta nova entrar,
  // senão a própria Harvest se pagaria na hora em que é jogada.
  const colheitas = jogo.jogadores[lado].trunfosNaMesa
    .flatMap((c) => c.efeitos)
    .filter((e) => e.type === 'on_trump_use_draw_trump');

  for (const efeito of carta.effects) {
    const alvoLado = efeito.target === 'opponent' ? outro(lado) : lado;

    switch (efeito.type) {
      case 'bet_mod':
      case 'set_target':
      case 'block_trumps':
      case 'on_trump_use_draw_trump':
      case 'block_draw':
        persistentes.push(efeito);
        break;

      // --- 4.4a ---------------------------------------------------------

      case 'swap_last_faceup': {
        // Exchange: troca a última carta virada de cada lado. Se um dos
        // dois não tiver nenhuma, não acontece nada.
        const meu = jogo.jogadores[lado];
        const dele = jogo.jogadores[outro(lado)];
        if (meu.abertas.length === 0 || dele.abertas.length === 0) {
          relatorio.acoes.push({ tipo: 'swap_last_faceup', trocou: false });
          break;
        }
        const i = meu.abertas.length - 1;
        const j = dele.abertas.length - 1;
        const minhaAntes = meu.abertas[i];
        const delaAntes = dele.abertas[j];
        meu.abertas[i] = delaAntes;
        dele.abertas[j] = minhaAntes;
        relatorio.acoes.push({
          tipo: 'swap_last_faceup', trocou: true, recebi: delaAntes, entreguei: minhaAntes,
        });
        break;
      }

      case 'discard_random_trumps': {
        // Trump Switch: descarta cartas da mão no sorteio, com o gerador
        // dos trunfos, para a mesma seed dar sempre o mesmo descarte.
        const mao = jogo.jogadores[alvoLado].trunfos;
        const descartados = [];
        for (let i = 0; i < (efeito.count ?? 1) && mao.length > 0; i++) {
          const indice = Math.floor(jogo._aleatorioTrunfos() * mao.length);
          descartados.push(mao.splice(indice, 1)[0]);
        }
        relatorio.acoes.push({ tipo: 'discard_random_trumps', lado: alvoLado, descartados });
        break;
      }

      case 'destroy_all_trumps': {
        const naMesa = jogo.jogadores[alvoLado].trunfosNaMesa;
        const destruidos = naMesa.map((c) => c.id);
        naMesa.length = 0;
        relatorio.acoes.push({ tipo: 'destroy_all_trumps', lado: alvoLado, destruidos });
        break;
      }

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
  jogo.stats.trunfosNaRodada[lado] = (jogo.stats.trunfosNaRodada[lado] ?? 0) + 1;

  // E agora a Harvest que já estava na mesa devolve uma carta.
  for (const colheita of colheitas) {
    const ganhos = [];
    for (let i = 0; i < (colheita.count ?? 1); i++) ganhos.push(darTrunfo(jogo, lado));
    relatorio.acoes.push({ tipo: 'harvest', lado, trunfos: ganhos });
  }

  return relatorio;
}
