// Testes da trapaça do anfitrião (sub-passo 4.8).
// Os dois caminhos que o grupo pediu: a trapaça acontecendo e sendo
// virada com o Love Your Enemy, e a trapaça NÃO acontecendo quando o
// jogador mata o Luiz Alberto antes. Sem DOM.

import { teste, assert, assertIgual } from './testador.js';
import catalogoJson from '../data/trump_cards.js';
import { criarBaralho } from '../src/engine/deck.js';
import { prepararCatalogo, aplicarTrunfo, CARTAS_DO_JOGADOR } from '../src/engine/trumps.js';
import {
  criarJogo,
  iniciarRodada,
  hit,
  stay,
  podeComprar,
  apostaEfetiva,
  FASE,
  LADO,
  RESULTADO,
} from '../src/engine/game.js';
import { NIVEL, TRILHO_SERRA, estaMorto } from '../src/engine/niveis.js';
import {
  criarTrapaca,
  deveTrapacear,
  serraAUmaDerrotaDoOponente,
  prepararTrapaca,
  aplicarTrapaca,
  CARTA_DA_SAIDA,
  CARTAS_DA_TRAPACA,
} from '../src/engine/trapaca.js';

const CATALOGO = prepararCatalogo(catalogoJson, {
  ids: CARTAS_DO_JOGADOR,
  extras: ['desperation'],
});

/**
 * Uma rodada do nível 3 com baralho conhecido e a serra onde o teste
 * quiser. `ordemDeCompra`: oculta J, oculta O, aberta J, aberta O.
 */
function rodadaNaSerra({ serra = 13, ordemDeCompra = [9, 10, 5, 8] } = {}) {
  const restantes = criarBaralho().filter((c) => !ordemDeCompra.includes(c));
  const baralho = [...restantes, ...[...ordemDeCompra].reverse()];
  const jogo = criarJogo({
    seed: 7,
    nivel: NIVEL.SERRA,
    embaralhar: () => [...baralho],
    catalogoTrunfos: CATALOGO,
  });
  jogo.serra = serra;
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

const total = (jogo, lado) => jogo.jogadores[lado].oculta
  + jogo.jogadores[lado].abertas.reduce((s, c) => s + c, 0);

// ---------------------------------------------------------------------
//  Quando ela arma
// ---------------------------------------------------------------------

teste('trapaça: a carta da saída chega ao jogador ao entrar no nível 3', () => {
  const jogo = rodadaNaSerra();
  assert(prepararTrapaca(jogo));
  assert(jogo.jogadores[LADO.JOGADOR].trunfos.includes(CARTA_DA_SAIDA));
});

teste('trapaça: a carta da saída não é entregue duas vezes', () => {
  const jogo = rodadaNaSerra();
  prepararTrapaca(jogo);
  prepararTrapaca(jogo);
  const quantas = jogo.jogadores[LADO.JOGADOR].trunfos.filter((id) => id === CARTA_DA_SAIDA).length;
  assertIgual(quantas, 1);
});

teste('trapaça: nos níveis 1 e 2 nada disso acontece', () => {
  for (const nivel of [NIVEL.GUILHOTINA, NIVEL.CHOQUE]) {
    const jogo = criarJogo({ seed: 3, nivel, catalogoTrunfos: CATALOGO });
    iniciarRodada(jogo);
    assert(!prepararTrapaca(jogo), `nível ${nivel} não entrega a carta`);
    assert(!serraAUmaDerrotaDoOponente(jogo), `nível ${nivel} não tem serra`);
    assert(!deveTrapacear(jogo, criarTrapaca()));
  }
});

teste('trapaça: só arma quando a serra está a uma derrota do Luiz Alberto', () => {
  // Aposta 1 na primeira rodada do nível: precisa da serra em 14.
  assert(!serraAUmaDerrotaDoOponente(rodadaNaSerra({ serra: 13 })), 'de 13 com aposta 1, não chega');
  assert(serraAUmaDerrotaDoOponente(rodadaNaSerra({ serra: 14 })), 'de 14 com aposta 1, chega');
  assert(serraAUmaDerrotaDoOponente(rodadaNaSerra({ serra: 15 })), 'já encostada');
});

teste('trapaça: a aposta dele conta, não a distância crua', () => {
  const jogo = rodadaNaSerra({ serra: 12 });
  assert(!serraAUmaDerrotaDoOponente(jogo), 'com aposta 1 ainda falta');
  jogar(jogo, LADO.JOGADOR, 'two_up');   // a aposta dele sobe 2
  assert(serraAUmaDerrotaDoOponente(jogo), 'com a aposta encarecida, uma derrota basta');
});

teste('trapaça: acontece uma vez só na partida', () => {
  const jogo = rodadaNaSerra({ serra: 14 });
  const trapaca = criarTrapaca();
  assert(deveTrapacear(jogo, trapaca));
  aplicarTrapaca(jogo, trapaca);
  assert(trapaca.aconteceu);
  assert(!deveTrapacear(jogo, trapaca), 'não arma de novo');
});

// ---------------------------------------------------------------------
//  O que ela faz
// ---------------------------------------------------------------------

teste('trapaça: o anfitrião joga Perfect Draw e Desperation pelo oponente', () => {
  const jogo = rodadaNaSerra({ serra: 14 });
  const turnoAntes = jogo.turno;
  const totalDeleAntes = total(jogo, LADO.OPONENTE);

  const relatorios = aplicarTrapaca(jogo, criarTrapaca());
  assertIgual(relatorios.map((r) => r.id), [...CARTAS_DA_TRAPACA]);
  assert(total(jogo, LADO.OPONENTE) > totalDeleAntes, 'ele comprou a melhor carta');
  assertIgual(jogo.turno, turnoAntes, 'o turno volta para quem era');
});

teste('trapaça: com a Desperation na mesa, a próxima derrota mata qualquer um', () => {
  const jogo = rodadaNaSerra({ serra: 14 });
  aplicarTrapaca(jogo, criarTrapaca());
  assert(apostaEfetiva(jogo, LADO.JOGADOR) >= 100, 'a aposta do jogador explodiu');
  assert(apostaEfetiva(jogo, LADO.OPONENTE) >= 100, 'e a dele também');
});

teste('trapaça: com a Desperation na mesa, o jogador não pode mais comprar', () => {
  const jogo = rodadaNaSerra({ serra: 14 });
  jogo.turno = LADO.JOGADOR;
  assert(podeComprar(jogo, LADO.JOGADOR), 'antes, podia');
  aplicarTrapaca(jogo, criarTrapaca());
  jogo.turno = LADO.JOGADOR;
  assert(!podeComprar(jogo, LADO.JOGADOR), 'depois, não pode');
});

// ---------------------------------------------------------------------
//  Caminho 1: a virada com o Love Your Enemy
// ---------------------------------------------------------------------

teste('trapaça: o Love Your Enemy estoura a mão que o Perfect Draw fechou', () => {
  const jogo = rodadaNaSerra({ serra: 14 });
  prepararTrapaca(jogo);
  aplicarTrapaca(jogo, criarTrapaca());

  const antes = total(jogo, LADO.OPONENTE);
  jogar(jogo, LADO.JOGADOR, CARTA_DA_SAIDA);
  const depois = total(jogo, LADO.OPONENTE);
  assert(depois > antes, 'ele foi obrigado a comprar mais uma');
  assert(depois > 21, `e estourou: ficou com ${depois}`);
});

teste('trapaça: dá para ganhar a partida usando o Love Your Enemy', () => {
  const jogo = rodadaNaSerra({ serra: 14 });
  prepararTrapaca(jogo);
  aplicarTrapaca(jogo, criarTrapaca());
  jogar(jogo, LADO.JOGADOR, CARTA_DA_SAIDA);

  // Os dois param: com ele estourado, o jogador vence a rodada.
  jogo.turno = LADO.JOGADOR;
  stay(jogo, LADO.JOGADOR);
  const { resultado } = stay(jogo, LADO.OPONENTE);

  assertIgual(resultado.vencedor, RESULTADO.JOGADOR, 'a rodada é do jogador');
  assert(estaMorto(jogo, LADO.OPONENTE), 'e a serra encostou nele');
  assertIgual(jogo.fase, FASE.FIM_DE_JOGO);
  assert(jogo.vitoriaFinal, 'João Gabriel saiu inteiro');
});

teste('trapaça: sem o Love Your Enemy, quem morre é o jogador', () => {
  const jogo = rodadaNaSerra({ serra: 14 });
  aplicarTrapaca(jogo, criarTrapaca());
  // Sem a carta da saída, a mão fechada do oponente ganha e a aposta de
  // 100 da Desperation leva a serra até o fim do trilho.
  jogo.turno = LADO.JOGADOR;
  stay(jogo, LADO.JOGADOR);
  const { resultado } = stay(jogo, LADO.OPONENTE);

  assertIgual(resultado.vencedor, RESULTADO.OPONENTE);
  assert(estaMorto(jogo, LADO.JOGADOR), 'a serra atravessou o trilho inteiro');
  assert(!jogo.vitoriaFinal);
});

// ---------------------------------------------------------------------
//  Caminho 2: matar o Luiz antes, e a trapaça não acontecer
// ---------------------------------------------------------------------

teste('trapaça: matando o Luiz antes da hora, ela nunca acontece', () => {
  // A serra em 12 e a aposta dele encarecida em 3: ele morre nesta
  // rodada, e o gatilho da trapaça nunca chega a ser conferido depois.
  const jogo = rodadaNaSerra({ serra: 12, ordemDeCompra: [10, 9, 11, 9] });
  const trapaca = criarTrapaca();
  jogar(jogo, LADO.JOGADOR, 'one_up');
  jogar(jogo, LADO.JOGADOR, 'two_up');
  assertIgual(apostaEfetiva(jogo, LADO.OPONENTE), 4, 'aposta base 1 mais 3');

  // Ele estoura, o jogador para: a serra anda 4 e passa do fim do trilho.
  jogo.turno = LADO.OPONENTE;
  hit(jogo, LADO.OPONENTE);
  jogo.turno = LADO.JOGADOR;
  stay(jogo, LADO.JOGADOR);
  if (jogo.fase === FASE.JOGANDO) stay(jogo, LADO.OPONENTE);

  assert(estaMorto(jogo, LADO.OPONENTE), `serra em ${jogo.serra}, precisava de ${TRILHO_SERRA}`);
  assert(!trapaca.aconteceu, 'o anfitrião não chegou a jogar nada');
  assert(jogo.vitoriaFinal, 'e o jogador saiu inteiro sem precisar da carta');
});

teste('trapaça: a partida acabada não arma mais nada', () => {
  const jogo = rodadaNaSerra({ serra: 14 });
  jogo.fase = FASE.FIM_DE_JOGO;
  assert(!deveTrapacear(jogo, criarTrapaca()), 'com a partida encerrada, não há o que trapacear');
});
