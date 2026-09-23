// Testes da IA usando as cartas trunfo, depois do ajuste pedido pelo
// grupo: o Luiz Alberto estava com a mão cheia de carta que ele não
// sabia jogar. Agora ele usa as versões fortes, as que mexem com o
// adversário, e tem um teto por rodada. Sem DOM.

import { teste, assert, assertIgual } from './testador.js';
import { criarBaralho } from '../src/engine/deck.js';
import catalogoJson from '../data/trump_cards.js';
import { prepararCatalogo, aplicarTrunfo, CARTAS_DO_JOGADOR } from '../src/engine/trumps.js';
import { decidirTrunfo } from '../src/engine/ai.js';
import { criarJogo, iniciarRodada, LADO } from '../src/engine/game.js';
import { NIVEL } from '../src/engine/niveis.js';
import { TRUNFOS } from '../src/config.js';

const CATALOGO = prepararCatalogo(catalogoJson, {
  ids: CARTAS_DO_JOGADOR,
  extras: ['desperation'],
});

/**
 * Uma rodada com baralho conhecido, no turno do OPONENTE, com a mão de
 * trunfos dele escolhida pelo teste.
 * `ordemDeCompra`: oculta J, oculta O, aberta J, aberta O.
 */
function mesa({ mao = [], ordemDeCompra = [5, 9, 6, 8], nivel = NIVEL.SERRA, aposta = null } = {}) {
  const restantes = criarBaralho().filter((c) => !ordemDeCompra.includes(c));
  const baralho = [...restantes, ...[...ordemDeCompra].reverse()];
  const jogo = criarJogo({
    seed: 11, nivel, embaralhar: () => [...baralho], catalogoTrunfos: CATALOGO,
  });
  iniciarRodada(jogo);
  jogo.jogadores[LADO.JOGADOR].trunfos = [];
  jogo.jogadores[LADO.OPONENTE].trunfos = [...mao];
  jogo.turno = LADO.OPONENTE;
  if (aposta !== null) {
    jogo.jogadores[LADO.JOGADOR].aposta = aposta;
    jogo.jogadores[LADO.OPONENTE].aposta = aposta;
  }
  return jogo;
}

const escolha = (jogo, nivel) => decidirTrunfo(jogo, LADO.OPONENTE, nivel ?? jogo.nivel);

// ---------------------------------------------------------------------
//  Quando ele usa e quando não usa
// ---------------------------------------------------------------------

teste('IA trunfos: no nível 1 ele não joga nada, como sempre', () => {
  const jogo = mesa({ mao: ['shield', 'two_up', 'destroy_plus_plus'], nivel: NIVEL.GUILHOTINA });
  assertIgual(escolha(jogo), null);
});

teste('IA trunfos: a mesma mão, na cabeça do nível 3, ele usa', () => {
  // É exatamente isto que o modo difícil faz: passa a cabeça do nível 3
  // desde o primeiro aparelho.
  const jogo = mesa({ mao: ['shield', 'two_up', 'destroy_plus_plus'], nivel: NIVEL.GUILHOTINA });
  assert(escolha(jogo, 3) !== null, 'no difícil ele joga desde o nível 1');
});

teste('IA trunfos: mão vazia não inventa jogada', () => {
  assertIgual(escolha(mesa({ mao: [] })), null);
});

teste('IA trunfos: passado o teto da rodada, ele para', () => {
  const jogo = mesa({ mao: ['shield_plus', 'two_up_plus', 'perfect_draw', 'destroy'] });
  jogo.stats.trunfosNaRodada[LADO.OPONENTE] = TRUNFOS.maximoPorRodada;
  assertIgual(escolha(jogo), null, 'com o teto batido, nem olha a mão');
  jogo.stats.trunfosNaRodada[LADO.OPONENTE] = TRUNFOS.maximoPorRodada - 1;
  assert(escolha(jogo) !== null, 'faltando uma, ainda joga');
});

teste('IA trunfos: o teto existe para ele não jogar para sempre com a Harvest', () => {
  // Com a Harvest na mesa cada carta jogada repõe outra: sem teto, a
  // mão nunca esvazia e o turno dele não acaba.
  const jogo = mesa({ mao: ['harvest', 'shield_plus', 'two_up_plus', 'perfect_draw'], aposta: 4 });
  let jogadas = 0;
  for (let i = 0; i < 40; i++) {
    const id = escolha(jogo);
    if (!id) break;
    aplicarTrunfo(jogo, LADO.OPONENTE, id);
    jogadas += 1;
  }
  assertIgual(jogadas, TRUNFOS.maximoPorRodada);
});

// ---------------------------------------------------------------------
//  Ele prefere a versão forte
// ---------------------------------------------------------------------

teste('IA trunfos: Shield+ antes de Shield', () => {
  const jogo = mesa({ mao: ['shield', 'shield_plus'], aposta: 4 });
  assertIgual(escolha(jogo), 'shield_plus');
});

teste('IA trunfos: Two-Up+ antes de Two-Up e One-Up', () => {
  const jogo = mesa({ mao: ['one_up', 'two_up', 'two_up_plus'], ordemDeCompra: [2, 9, 3, 2] });
  assertIgual(escolha(jogo), 'two_up_plus');
});

teste('IA trunfos: Destroy++ antes de Destroy+ e Destroy', () => {
  const jogo = mesa({ mao: ['destroy', 'destroy_plus', 'destroy_plus_plus'] });
  // O jogador põe uma carta perigosa na mesa: é a deixa para limpar.
  jogo.turno = LADO.JOGADOR;
  aplicarTrunfo(jogo, LADO.JOGADOR, (jogo.jogadores[LADO.JOGADOR].trunfos.push('two_up'), 'two_up'));
  jogo.turno = LADO.OPONENTE;
  assertIgual(escolha(jogo), 'destroy_plus_plus');
});

// ---------------------------------------------------------------------
//  As cartas que mexem com o adversário
// ---------------------------------------------------------------------

teste('IA trunfos: Love Your Enemy só quando o adversário já está no limite', () => {
  const longe = mesa({ mao: ['love_your_enemy'], ordemDeCompra: [2, 9, 3, 8] });
  assertIgual(escolha(longe), null, 'com ele em 5 à mostra, dar carta ajudaria');

  const noLimite = mesa({ mao: ['love_your_enemy'], ordemDeCompra: [2, 9, 11, 8] });
  noLimite.jogadores[LADO.JOGADOR].abertas = [11, 10];   // 21 à mostra
  assertIgual(escolha(noLimite), 'love_your_enemy', 'no limite, a carta a mais estoura ele');
});

teste('IA trunfos: devolve ao baralho a carta grande que o adversário virou', () => {
  const jogo = mesa({ mao: ['remove'] });
  jogo.jogadores[LADO.JOGADOR].abertas = [11];
  assertIgual(escolha(jogo), 'remove');

  const pequena = mesa({ mao: ['remove'] });
  pequena.jogadores[LADO.JOGADOR].abertas = [3];
  assertIgual(escolha(pequena), null, 'carta pequena não vale a carta trunfo');
});

teste('IA trunfos: Exchange quando a carta dele é melhor que a minha', () => {
  const jogo = mesa({ mao: ['exchange'] });
  jogo.jogadores[LADO.OPONENTE].oculta = 2;
  jogo.jogadores[LADO.OPONENTE].abertas = [2];
  jogo.jogadores[LADO.JOGADOR].abertas = [10];
  assertIgual(escolha(jogo), 'exchange');
});

teste('IA trunfos: Exchange não é jogada quando a troca estouraria a mão dele', () => {
  const jogo = mesa({ mao: ['exchange'] });
  jogo.jogadores[LADO.OPONENTE].oculta = 11;
  jogo.jogadores[LADO.OPONENTE].abertas = [9];   // 20: trocar o 9 pelo 11 dá 22
  jogo.jogadores[LADO.JOGADOR].abertas = [11];
  assertIgual(escolha(jogo), null);
});

teste('IA trunfos: fecha a própria mão com a melhor carta do baralho', () => {
  const jogo = mesa({ mao: ['perfect_draw', 'perfect_draw_plus', 'ultimate_draw'] });
  jogo.jogadores[LADO.OPONENTE].oculta = 5;
  jogo.jogadores[LADO.OPONENTE].abertas = [4];   // 9, longe do alvo
  assertIgual(escolha(jogo), 'perfect_draw_plus', 'a versão que também encarece a dele');
});

teste('IA trunfos: com a mão já fechada, não gasta carta para comprar', () => {
  const jogo = mesa({ mao: ['perfect_draw'] });
  jogo.jogadores[LADO.OPONENTE].oculta = 11;
  jogo.jogadores[LADO.OPONENTE].abertas = [9];   // 20
  assertIgual(escolha(jogo), null);
});

teste('IA trunfos: Harvest entra cedo, e só uma vez', () => {
  const jogo = mesa({ mao: ['harvest', 'shield'] });
  jogo.jogadores[LADO.OPONENTE].oculta = 11;
  jogo.jogadores[LADO.OPONENTE].abertas = [9];   // mão fechada: não compra
  assertIgual(escolha(jogo), 'harvest');
  aplicarTrunfo(jogo, LADO.OPONENTE, 'harvest');
  assert(escolha(jogo) !== 'harvest', 'com uma na mesa, não põe outra');
});

teste('IA trunfos: mão só de carta inútil vira Trump Switch', () => {
  const jogo = mesa({ mao: ['card_2', 'card_3', 'trump_switch'] });
  jogo.jogadores[LADO.OPONENTE].oculta = 11;
  jogo.jogadores[LADO.OPONENTE].abertas = [9];
  assertIgual(escolha(jogo), 'trump_switch');
});

teste('IA trunfos: com carta boa na mão, não desperdiça o Trump Switch', () => {
  const jogo = mesa({ mao: ['shield_plus', 'trump_switch'], aposta: 4 });
  assertIgual(escolha(jogo), 'shield_plus');
});

// ---------------------------------------------------------------------
//  O resultado geral: a mão dele não fica morta
// ---------------------------------------------------------------------

teste('IA trunfos: no nível 3 nenhuma carta fica morta na mão dele', () => {
  // Uma carta só faz sentido na mesa certa, então o teste monta algumas
  // mesas típicas e cobra que cada carta seja jogada em PELO MENOS uma.
  // O `card_2` entra junto só para a mão ter duas cartas (a Harvest não
  // é jogada com a mão quase vazia) sem virar concorrente.
  const mesas = {
    'atrás no placar': (jogo) => {
      jogo.jogadores[LADO.OPONENTE].oculta = 4;
      jogo.jogadores[LADO.OPONENTE].abertas = [5];    // 9
      jogo.jogadores[LADO.JOGADOR].abertas = [11];
    },
    'na frente': (jogo) => {
      jogo.jogadores[LADO.OPONENTE].oculta = 10;
      jogo.jogadores[LADO.OPONENTE].abertas = [9];    // 19
      jogo.jogadores[LADO.JOGADOR].abertas = [3];
    },
    'ele no limite': (jogo) => {
      jogo.jogadores[LADO.OPONENTE].oculta = 10;
      jogo.jogadores[LADO.OPONENTE].abertas = [9];
      jogo.jogadores[LADO.JOGADOR].abertas = [11, 10];  // 21 à mostra
    },
    'estourado, precisando de um alvo maior': (jogo) => {
      jogo.jogadores[LADO.OPONENTE].oculta = 11;
      jogo.jogadores[LADO.OPONENTE].abertas = [11];   // 22, já passou de 21
      jogo.jogadores[LADO.JOGADOR].abertas = [3];
    },
    'parado exatamente em 17': (jogo) => {
      jogo.jogadores[LADO.OPONENTE].oculta = 8;
      jogo.jogadores[LADO.OPONENTE].abertas = [9];    // 17 cravado
      jogo.jogadores[LADO.JOGADOR].abertas = [3];
    },
    'com ameaça na mesa dele': (jogo) => {
      jogo.jogadores[LADO.OPONENTE].oculta = 10;
      jogo.jogadores[LADO.OPONENTE].abertas = [9];
      jogo.turno = LADO.JOGADOR;
      jogo.jogadores[LADO.JOGADOR].trunfos.push('two_up');
      aplicarTrunfo(jogo, LADO.JOGADOR, 'two_up');
      jogo.turno = LADO.OPONENTE;
    },
  };

  const cartas = [
    'shield', 'shield_plus', 'one_up', 'two_up', 'two_up_plus', 'remove',
    'destroy', 'destroy_plus', 'destroy_plus_plus', 'perfect_draw',
    'perfect_draw_plus', 'ultimate_draw', 'love_your_enemy', 'exchange',
    'harvest', 'go_for_24', 'go_for_17',
  ];

  const mortas = [];
  for (const id of cartas) {
    const usada = Object.values(mesas).some((montar) => {
      const jogo = mesa({ mao: [id, 'card_2'], aposta: 4 });
      montar(jogo);
      return escolha(jogo) === id;
    });
    if (!usada) mortas.push(id);
  }
  assertIgual(mortas, [], `cartas que ele ainda não sabe usar: ${mortas.join(', ')}`);
});
