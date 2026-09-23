// Testes das cartas trunfo que faltavam do jogador (sub-passo 4.4a).
// Mesmo formato do 2.2: um teste por carta, mais os casos de borda.
// Sem DOM.

import { teste, assert, assertIgual } from './testador.js';
import catalogoJson from '../data/trump_cards.js';
import { criarBaralho } from '../src/engine/deck.js';
import {
  prepararCatalogo,
  aplicarTrunfo,
  podeJogarTrunfo,
  trunfosBloqueados,
  CARTAS_DO_JOGADOR,
} from '../src/engine/trumps.js';
import {
  criarJogo,
  iniciarRodada,
  apostaEfetiva,
  LADO,
} from '../src/engine/game.js';
import { TRUNFOS } from '../src/config.js';

const CATALOGO = prepararCatalogo(catalogoJson);

/** As cartas que entraram neste sub-passo. */
const NOVAS = [
  'two_up_plus', 'shield_plus', 'exchange', 'trump_switch', 'trump_switch_plus',
  'destroy_plus', 'destroy_plus_plus', 'perfect_draw_plus', 'ultimate_draw',
  'harvest', 'love_your_enemy',
];

function rodada(ordemDeCompra = [9, 8, 5, 4]) {
  const restantes = criarBaralho().filter((c) => !ordemDeCompra.includes(c));
  const baralho = [...restantes, ...[...ordemDeCompra].reverse()];
  const jogo = criarJogo({ seed: 7, embaralhar: () => [...baralho], catalogoTrunfos: CATALOGO });
  iniciarRodada(jogo);
  jogo.jogadores[LADO.JOGADOR].trunfos = [];
  jogo.jogadores[LADO.OPONENTE].trunfos = [];
  return jogo;
}

function jogar(jogo, lado, id) {
  jogo.jogadores[lado].trunfos.push(id);
  const turnoAnterior = jogo.turno;
  jogo.turno = lado;
  const r = aplicarTrunfo(jogo, lado, id);
  jogo.turno = turnoAnterior;
  return r;
}

const acao = (relatorio, tipo) => relatorio.acoes.find((a) => a.tipo === tipo);

// ---------------------------------------------------------------------
//  Todas entraram
// ---------------------------------------------------------------------

teste('4.4a: as onze cartas que faltavam entraram no catálogo', () => {
  for (const id of NOVAS) {
    assert(CARTAS_DO_JOGADOR.includes(id), `${id} não está na lista do jogador`);
    assert(CATALOGO.porId.has(id), `${id} não entrou no catálogo`);
  }
  assertIgual(CARTAS_DO_JOGADOR.length, 27);
});

teste('4.4a: o catálogo do jogador cobre todas as player_cards do arquivo', () => {
  const doArquivo = catalogoJson.player_cards.map((c) => c.id).sort();
  assertIgual([...CARTAS_DO_JOGADOR].sort(), doArquivo);
});

// ---------------------------------------------------------------------
//  Uma por uma
// ---------------------------------------------------------------------

teste('4.4a: Two-Up+ devolve a carta virada do oponente e ainda encarece a aposta dele', () => {
  const jogo = rodada();
  const antes = jogo.jogadores[LADO.OPONENTE].abertas.length;
  const apostaAntes = apostaEfetiva(jogo, LADO.OPONENTE);

  const r = jogar(jogo, LADO.JOGADOR, 'two_up_plus');
  assertIgual(jogo.jogadores[LADO.OPONENTE].abertas.length, antes - 1, 'a carta voltou para o baralho');
  assertIgual(apostaEfetiva(jogo, LADO.OPONENTE), apostaAntes + 2);
  assert(r.ficouNaMesa, 'o aumento da aposta fica na mesa');
});

teste('4.4a: Shield+ tira dois da própria aposta', () => {
  const jogo = rodada();
  jogo.jogadores[LADO.JOGADOR].aposta = 4;
  jogar(jogo, LADO.JOGADOR, 'shield_plus');
  assertIgual(apostaEfetiva(jogo, LADO.JOGADOR), 2);
});

teste('4.4a: Shield+ não deixa a aposta ficar negativa', () => {
  const jogo = rodada();
  jogo.jogadores[LADO.JOGADOR].aposta = 1;
  jogar(jogo, LADO.JOGADOR, 'shield_plus');
  assertIgual(apostaEfetiva(jogo, LADO.JOGADOR), 0);
});

teste('4.4a: Exchange troca a última carta virada de cada lado', () => {
  const jogo = rodada([9, 8, 5, 4]);   // aberta do jogador 5, do oponente 4
  const minhaAntes = jogo.jogadores[LADO.JOGADOR].abertas.at(-1);
  const delaAntes = jogo.jogadores[LADO.OPONENTE].abertas.at(-1);

  const r = jogar(jogo, LADO.JOGADOR, 'exchange');
  assertIgual(jogo.jogadores[LADO.JOGADOR].abertas.at(-1), delaAntes);
  assertIgual(jogo.jogadores[LADO.OPONENTE].abertas.at(-1), minhaAntes);
  assertIgual(acao(r, 'swap_last_faceup').trocou, true);
});

teste('4.4a: Exchange não faz nada se um dos lados não tem carta virada', () => {
  const jogo = rodada();
  jogo.jogadores[LADO.OPONENTE].abertas = [];
  const minhaAntes = [...jogo.jogadores[LADO.JOGADOR].abertas];

  const r = jogar(jogo, LADO.JOGADOR, 'exchange');
  assertIgual(jogo.jogadores[LADO.JOGADOR].abertas, minhaAntes);
  assertIgual(acao(r, 'swap_last_faceup').trocou, false);
});

teste('4.4a: Trump Switch descarta 2 da mão e compra 3', () => {
  const jogo = rodada();
  jogo.jogadores[LADO.JOGADOR].trunfos = ['shield', 'destroy', 'one_up'];

  const r = jogar(jogo, LADO.JOGADOR, 'trump_switch');
  // Começou com 3 + a própria carta; a carta jogada sai, 2 são descartadas, 3 entram.
  assertIgual(acao(r, 'discard_random_trumps').descartados.length, 2);
  assertIgual(jogo.jogadores[LADO.JOGADOR].trunfos.length, 4);
});

teste('4.4a: Trump Switch+ descarta só 1 e compra 4, respeitando o limite da mão', () => {
  const jogo = rodada();
  jogo.jogadores[LADO.JOGADOR].trunfos = ['shield', 'destroy'];

  const r = jogar(jogo, LADO.JOGADOR, 'trump_switch_plus');
  assertIgual(acao(r, 'discard_random_trumps').descartados.length, 1);
  // Daria 5 cartas, mas a mão só comporta `TRUNFOS.maximoNaMao`: as mais
  // antigas caem. É o limite de 4 que o grupo pediu depois de jogar.
  assertIgual(jogo.jogadores[LADO.JOGADOR].trunfos.length, TRUNFOS.maximoNaMao);
});

teste('4.4a: Trump Switch com a mão vazia não quebra', () => {
  const jogo = rodada();
  const r = jogar(jogo, LADO.JOGADOR, 'trump_switch');
  assertIgual(acao(r, 'discard_random_trumps').descartados, []);
  assertIgual(jogo.jogadores[LADO.JOGADOR].trunfos.length, 3, 'as três compradas estão lá');
});

teste('4.4a: o descarte do Trump Switch é sempre o mesmo com a mesma seed', () => {
  const descartar = () => {
    const jogo = rodada();
    jogo.jogadores[LADO.JOGADOR].trunfos = ['shield', 'destroy', 'one_up', 'remove'];
    return acao(jogar(jogo, LADO.JOGADOR, 'trump_switch'), 'discard_random_trumps').descartados;
  };
  assertIgual(descartar(), descartar());
});

teste('4.4a: Destroy+ limpa a mesa inteira do oponente', () => {
  const jogo = rodada();
  jogar(jogo, LADO.OPONENTE, 'shield');
  jogar(jogo, LADO.OPONENTE, 'one_up');
  assertIgual(jogo.jogadores[LADO.OPONENTE].trunfosNaMesa.length, 2);

  const r = jogar(jogo, LADO.JOGADOR, 'destroy_plus');
  assertIgual(jogo.jogadores[LADO.OPONENTE].trunfosNaMesa.length, 0);
  assertIgual(acao(r, 'destroy_all_trumps').destruidos.length, 2);
});

teste('4.4a: Destroy+ com a mesa dele vazia não quebra', () => {
  const jogo = rodada();
  const r = jogar(jogo, LADO.JOGADOR, 'destroy_plus');
  assertIgual(acao(r, 'destroy_all_trumps').destruidos, []);
});

teste('4.4a: Destroy++ limpa a mesa e ainda tranca os trunfos do oponente', () => {
  const jogo = rodada();
  jogar(jogo, LADO.OPONENTE, 'shield');
  jogo.jogadores[LADO.OPONENTE].trunfos = ['destroy'];

  jogar(jogo, LADO.JOGADOR, 'destroy_plus_plus');
  assertIgual(jogo.jogadores[LADO.OPONENTE].trunfosNaMesa.length, 0);
  assert(trunfosBloqueados(jogo, LADO.OPONENTE), 'o oponente está trancado');
  assert(!trunfosBloqueados(jogo, LADO.JOGADOR), 'quem jogou não se tranca');

  jogo.turno = LADO.OPONENTE;
  assert(!podeJogarTrunfo(jogo, LADO.OPONENTE, 'destroy'), 'e por isso ele não pode jogar');
});

teste('4.4a: Perfect Draw+ compra a melhor carta e encarece muito a aposta dele', () => {
  const jogo = rodada();
  const antes = jogo.jogadores[LADO.JOGADOR].abertas.length;
  const apostaAntes = apostaEfetiva(jogo, LADO.OPONENTE);

  jogar(jogo, LADO.JOGADOR, 'perfect_draw_plus');
  assertIgual(jogo.jogadores[LADO.JOGADOR].abertas.length, antes + 1);
  assertIgual(apostaEfetiva(jogo, LADO.OPONENTE), apostaAntes + 5);
});

teste('4.4a: Ultimate Draw compra a melhor carta e mais duas cartas trunfo', () => {
  const jogo = rodada();
  const cartasAntes = jogo.jogadores[LADO.JOGADOR].abertas.length;

  const r = jogar(jogo, LADO.JOGADOR, 'ultimate_draw');
  assertIgual(jogo.jogadores[LADO.JOGADOR].abertas.length, cartasAntes + 1);
  assertIgual(acao(r, 'draw_trump').trunfos.length, 2);
  assertIgual(jogo.jogadores[LADO.JOGADOR].trunfos.length, 2);
});

teste('4.4a: com a mão já fechada, Perfect Draw+ compra a carta que estoura menos', () => {
  // A regra de "melhor carta" vem do 2.2: a que mais chega perto do alvo
  // sem passar, e, se nenhuma couber, a MENOR do baralho. Ou seja, no 21
  // a carta ainda vem — e estoura. É o preço de jogar essa carta na hora
  // errada, e o teste registra isso em vez de fingir que não acontece.
  const jogo = rodada();
  jogo.jogadores[LADO.JOGADOR].abertas = [11];
  jogo.jogadores[LADO.JOGADOR].oculta = 10;   // já está em 21
  jogar(jogo, LADO.JOGADOR, 'perfect_draw_plus');
  const comprada = jogo.jogadores[LADO.JOGADOR].abertas.at(-1);
  assertIgual(comprada, Math.min(comprada, ...jogo.baralho), 'veio a menor que sobrou');
});

teste('4.4a: Harvest devolve uma carta trunfo a cada carta jogada depois dela', () => {
  const jogo = rodada();
  jogar(jogo, LADO.JOGADOR, 'harvest');
  assertIgual(jogo.jogadores[LADO.JOGADOR].trunfos.length, 0, 'ela mesma não se paga');

  const r = jogar(jogo, LADO.JOGADOR, 'shield');
  assertIgual(acao(r, 'harvest').trunfos.length, 1);
  assertIgual(jogo.jogadores[LADO.JOGADOR].trunfos.length, 1, 'veio uma carta atrás');
});

teste('4.4a: a Harvest do oponente não paga o jogador', () => {
  const jogo = rodada();
  jogar(jogo, LADO.OPONENTE, 'harvest');
  const r = jogar(jogo, LADO.JOGADOR, 'shield');
  assertIgual(acao(r, 'harvest'), undefined);
  assertIgual(jogo.jogadores[LADO.JOGADOR].trunfos.length, 0);
});

teste('4.4a: Love Your Enemy dá a melhor carta ao OPONENTE', () => {
  const jogo = rodada();
  const minhas = jogo.jogadores[LADO.JOGADOR].abertas.length;
  const dele = jogo.jogadores[LADO.OPONENTE].abertas.length;

  const r = jogar(jogo, LADO.JOGADOR, 'love_your_enemy');
  assertIgual(jogo.jogadores[LADO.OPONENTE].abertas.length, dele + 1, 'ele comprou');
  assertIgual(jogo.jogadores[LADO.JOGADOR].abertas.length, minhas, 'e eu não');
  assertIgual(acao(r, 'draw_best').lado, LADO.OPONENTE);
});

// ---------------------------------------------------------------------
//  As novas convivem com as antigas
// ---------------------------------------------------------------------

teste('4.4a: nenhuma das cartas novas lança erro ao ser jogada', () => {
  for (const id of NOVAS) {
    const jogo = rodada();
    jogo.jogadores[LADO.OPONENTE].trunfos = ['shield'];
    jogar(jogo, LADO.JOGADOR, id);
  }
  assert(true, 'todas rodaram');
});

teste('4.4a: o bloqueio do Destroy++ acaba quando a mesa é limpa', () => {
  const jogo = rodada();
  jogar(jogo, LADO.JOGADOR, 'destroy_plus_plus');
  assert(trunfosBloqueados(jogo, LADO.OPONENTE));
  // A mesa é limpa a cada rodada nova (regra A4/C4).
  jogo.jogadores[LADO.JOGADOR].trunfosNaMesa = [];
  assert(!trunfosBloqueados(jogo, LADO.OPONENTE), 'rodada nova, mesa limpa, trava solta');
});

teste('4.4a: o baralho continua sem depender dos trunfos', () => {
  const maos = (comTrunfos) => {
    const jogo = criarJogo({ seed: 4242, catalogoTrunfos: comTrunfos ? CATALOGO : null });
    iniciarRodada(jogo);
    return [...jogo.baralho];
  };
  assertIgual(maos(true), maos(false));
});
