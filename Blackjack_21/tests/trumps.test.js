// Testes das cartas trunfo (sub-passo 2.2). Sem DOM.
// Um teste por carta, mais os casos de borda que o grupo apontou.

import { teste, assert, assertIgual, assertLanca } from './testador.js';
import catalogoJson from '../data/trump_cards.js';
import { criarBaralho } from '../src/engine/deck.js';
import {
  prepararCatalogo,
  aplicarTrunfo,
  darTrunfo,
  podeJogarTrunfo,
  melhorCartaDoBaralho,
  CARTAS_DO_JOGADOR,
} from '../src/engine/trumps.js';
import {
  criarJogo,
  iniciarRodada,
  hit,
  stay,
  apostaEfetiva,
  alvoAtual,
  verMesa,
  LADO,
} from '../src/engine/game.js';
import { TRUNFOS } from '../src/config.js';

const CATALOGO = prepararCatalogo(catalogoJson);

// ---------------------------------------------------------------------
//  Ajudantes
// ---------------------------------------------------------------------

/**
 * Rodada com baralho de ordem conhecida e trunfos ligados.
 * `ordemDeCompra`: as 4 primeiras são oculta J, oculta O, aberta J, aberta O.
 * Depois da distribuição, as mãos de trunfo são esvaziadas para o teste
 * colocar exatamente as cartas que quer.
 */
function rodada(ordemDeCompra = [9, 8, 5, 4]) {
  const restantes = criarBaralho().filter((c) => !ordemDeCompra.includes(c));
  const baralho = [...restantes, ...[...ordemDeCompra].reverse()];
  const jogo = criarJogo({ seed: 7, embaralhar: () => [...baralho], catalogoTrunfos: CATALOGO });
  iniciarRodada(jogo);
  jogo.jogadores[LADO.JOGADOR].trunfos = [];
  jogo.jogadores[LADO.OPONENTE].trunfos = [];
  return jogo;
}

/** Coloca `id` na mão de `lado` e joga na hora. Devolve o relatório. */
function jogar(jogo, lado, id) {
  jogo.jogadores[lado].trunfos.push(id);
  const turnoAnterior = jogo.turno;
  jogo.turno = lado; // trunfos podem ser jogados no próprio turno
  const r = aplicarTrunfo(jogo, lado, id);
  jogo.turno = turnoAnterior;
  return r;
}

const abertas = (jogo, lado) => jogo.jogadores[lado].abertas;

// ---------------------------------------------------------------------
//  Catálogo
// ---------------------------------------------------------------------

teste('trunfos: catálogo traz as cartas do jogador, e só elas', () => {
  assertIgual(CATALOGO.disponiveis.length, CARTAS_DO_JOGADOR.length);
  for (const id of CARTAS_DO_JOGADOR) assert(CATALOGO.porId.has(id), `faltou ${id}`);
  assert(!CATALOGO.porId.has('curse'), 'carta de inimigo não entra na mão do jogador (4.4b)');
});

teste('trunfos: catálogo recusa carta com efeito que o motor não sabe executar', () => {
  const inventado = {
    player_cards: [{ id: 'carta_maluca', name: 'Maluca', effects: [{ type: 'efeito_inexistente' }] }],
  };
  assertLanca(() => prepararCatalogo(inventado, { ids: ['carta_maluca'] }));
});

teste('trunfos: o baralho não muda por causa dos trunfos (geradores separados)', () => {
  const maos = (comTrunfos) => {
    const jogo = criarJogo({ seed: 1234, catalogoTrunfos: comTrunfos ? CATALOGO : null });
    iniciarRodada(jogo);
    hit(jogo, LADO.JOGADOR);
    hit(jogo, LADO.OPONENTE);
    return {
      jogador: [jogo.jogadores.jogador.oculta, ...jogo.jogadores.jogador.abertas],
      oponente: [jogo.jogadores.oponente.oculta, ...jogo.jogadores.oponente.abertas],
      baralho: [...jogo.baralho],
    };
  };
  assertIgual(maos(true), maos(false), 'a mesma seed deve dar o mesmo baralho, com ou sem trunfos');
});

teste('trunfos: o motor não carrega o JSON sozinho (sem catálogo, sem trunfos)', () => {
  const jogo = criarJogo({ seed: 1 });
  iniciarRodada(jogo);
  assertIgual(jogo.catalogoTrunfos, null);
  assertIgual(jogo.jogadores.jogador.trunfos, []);
  assertIgual(apostaEfetiva(jogo, LADO.JOGADOR), jogo.jogadores.jogador.aposta);
});

// ---------------------------------------------------------------------
//  Uma carta por vez
// ---------------------------------------------------------------------

teste('One-Up: +1 na aposta do oponente e compra 1 trunfo', () => {
  const jogo = rodada();
  const antes = apostaEfetiva(jogo, LADO.OPONENTE);
  const r = jogar(jogo, LADO.JOGADOR, 'one_up');
  assertIgual(apostaEfetiva(jogo, LADO.OPONENTE), antes + 1);
  assertIgual(apostaEfetiva(jogo, LADO.JOGADOR), jogo.jogadores.jogador.aposta);
  assertIgual(jogo.jogadores.jogador.trunfos.length, 1, 'deveria ter comprado 1 trunfo');
  assert(r.ficouNaMesa);
});

teste('Two-Up: +2 na aposta do oponente e compra 1 trunfo', () => {
  const jogo = rodada();
  const antes = apostaEfetiva(jogo, LADO.OPONENTE);
  jogar(jogo, LADO.JOGADOR, 'two_up');
  assertIgual(apostaEfetiva(jogo, LADO.OPONENTE), antes + 2);
  assertIgual(jogo.jogadores.jogador.trunfos.length, 1);
});

teste('Two-Up: só vale enquanto está na mesa; Destroy devolve a aposta', () => {
  const jogo = rodada();
  const base = apostaEfetiva(jogo, LADO.OPONENTE);
  jogar(jogo, LADO.JOGADOR, 'two_up');
  assertIgual(apostaEfetiva(jogo, LADO.OPONENTE), base + 2);
  jogar(jogo, LADO.OPONENTE, 'destroy');          // o oponente destrói o Two-Up
  assertIgual(apostaEfetiva(jogo, LADO.OPONENTE), base, 'a aposta deveria voltar ao normal');
  assertIgual(jogo.jogadores.jogador.trunfosNaMesa.length, 0);
});

for (const valor of [2, 3, 4, 5, 6, 7]) {
  teste(`${valor} Card: compra a carta ${valor} se ela ainda está no baralho`, () => {
    const jogo = rodada([9, 8, 11, 10]); // as cartas 2..7 continuam no baralho
    jogar(jogo, LADO.JOGADOR, `card_${valor}`);
    assert(abertas(jogo, LADO.JOGADOR).includes(valor), `deveria ter comprado o ${valor}`);
    assert(!jogo.baralho.includes(valor), 'a carta deveria sair do baralho');
  });
}

teste('5 Card: não faz nada se o 5 já saiu do baralho', () => {
  const jogo = rodada([9, 8, 5, 4]); // o 5 foi para a mão do jogador na distribuição
  assert(!jogo.baralho.includes(5));
  const antes = [...abertas(jogo, LADO.JOGADOR)];
  const r = jogar(jogo, LADO.JOGADOR, 'card_5');
  assertIgual(abertas(jogo, LADO.JOGADOR), antes, 'a mão não deveria mudar');
  assertIgual(r.acoes[0].comprada, null);
});

teste('Remove: devolve ao baralho a última carta aberta do oponente', () => {
  const jogo = rodada();
  const carta = abertas(jogo, LADO.OPONENTE).at(-1);
  jogar(jogo, LADO.JOGADOR, 'remove');
  assertIgual(abertas(jogo, LADO.OPONENTE).length, 0);
  assert(jogo.baralho.includes(carta), 'a carta deveria voltar ao baralho');
});

teste('Return: devolve ao baralho a última carta aberta de quem jogou', () => {
  const jogo = rodada();
  const carta = abertas(jogo, LADO.JOGADOR).at(-1);
  jogar(jogo, LADO.JOGADOR, 'return');
  assertIgual(abertas(jogo, LADO.JOGADOR).length, 0);
  assert(jogo.baralho.includes(carta));
});

teste('Shield: reduz a própria aposta em 1 enquanto está na mesa', () => {
  const jogo = rodada();
  jogo.jogadores[LADO.JOGADOR].aposta = 3;
  jogar(jogo, LADO.JOGADOR, 'shield');
  assertIgual(apostaEfetiva(jogo, LADO.JOGADOR), 2);
});

teste('Shield: a aposta nunca fica negativa', () => {
  const jogo = rodada();
  jogo.jogadores[LADO.JOGADOR].aposta = 1;
  jogar(jogo, LADO.JOGADOR, 'shield');
  jogo.jogadores[LADO.JOGADOR].trunfos.push('shield');
  jogo.turno = LADO.JOGADOR;
  aplicarTrunfo(jogo, LADO.JOGADOR, 'shield');   // dois Shields: -2 sobre aposta 1
  assertIgual(apostaEfetiva(jogo, LADO.JOGADOR), 0);
});

teste('Shield: com a aposta zerada, perder a rodada não tira dedo', () => {
  const jogo = rodada([9, 8, 2, 11]); // jogador 11, oponente 19 -> jogador perde
  jogar(jogo, LADO.JOGADOR, 'shield');
  stay(jogo, jogo.turno);
  const resultado = stay(jogo, jogo.turno).resultado;
  assertIgual(resultado.vencedor, 'oponente');
  assertIgual(jogo.jogadores.jogador.dedos, 5, 'Shield deveria ter absorvido a punição');
});

teste('Destroy: remove a última carta trunfo que o oponente pôs na mesa', () => {
  const jogo = rodada();
  jogar(jogo, LADO.OPONENTE, 'shield');
  jogar(jogo, LADO.OPONENTE, 'one_up');
  const r = jogar(jogo, LADO.JOGADOR, 'destroy');
  assertIgual(r.acoes[0].destruido, 'one_up', 'deveria destruir a mais recente');
  assertIgual(jogo.jogadores.oponente.trunfosNaMesa.map((c) => c.id), ['shield']);
});

teste('Destroy: sem trunfos do oponente na mesa, não faz nada', () => {
  const jogo = rodada();
  const r = jogar(jogo, LADO.JOGADOR, 'destroy');
  assertIgual(r.acoes[0].destruido, null);
});

teste('Perfect Draw: compra a carta que chega mais perto do alvo sem passar', () => {
  const jogo = rodada([9, 8, 5, 4]); // jogador tem 9 + 5 = 14; falta 7 para 21
  jogar(jogo, LADO.JOGADOR, 'perfect_draw');
  assertIgual(abertas(jogo, LADO.JOGADOR).at(-1), 7);
});

teste('Perfect Draw: se todas estouram, pega a menor carta', () => {
  const jogo = rodada([9, 8, 11, 4]);
  jogo.baralho = [6, 9, 10];             // jogador tem 20; qualquer carta estoura
  jogo.jogadores[LADO.JOGADOR].abertas = [11];
  jogar(jogo, LADO.JOGADOR, 'perfect_draw');
  assertIgual(abertas(jogo, LADO.JOGADOR).at(-1), 6);
});

teste('melhorCartaDoBaralho: casos diretos', () => {
  assertIgual(melhorCartaDoBaralho([2, 5, 9], 14, 21), 7 - 2, 'com 14, o 5 chega a 19');
  assertIgual(melhorCartaDoBaralho([8, 9, 10], 15, 21), 8, 'nenhuma cabe: a menor, que estoura menos');
  assertIgual(melhorCartaDoBaralho([6, 7], 14, 21), 7, 'o 7 fecha exatamente em 21');
  assertIgual(melhorCartaDoBaralho([], 10, 21), null);
});

teste('Go for 17: muda o alvo da rodada para 17', () => {
  const jogo = rodada();
  assertIgual(alvoAtual(jogo), 21);
  jogar(jogo, LADO.OPONENTE, 'go_for_17');
  assertIgual(alvoAtual(jogo), 17);
});

teste('Go for 24 substitui o Go for 17 que já estava na mesa', () => {
  const jogo = rodada();
  jogar(jogo, LADO.OPONENTE, 'go_for_17');
  assertIgual(alvoAtual(jogo), 17);
  jogar(jogo, LADO.JOGADOR, 'go_for_24');
  assertIgual(alvoAtual(jogo), 24);
  assertIgual(jogo.jogadores.oponente.trunfosNaMesa.length, 0, 'o Go for 17 deveria sair da mesa');
  assertIgual(jogo.jogadores.jogador.trunfosNaMesa.map((c) => c.id), ['go_for_24']);
});

teste('Go for 27: vira o alvo e substitui a Go For anterior', () => {
  const jogo = rodada();
  jogar(jogo, LADO.JOGADOR, 'go_for_24');
  jogar(jogo, LADO.JOGADOR, 'go_for_27');
  assertIgual(alvoAtual(jogo), 27);
  assertIgual(jogo.jogadores.jogador.trunfosNaMesa.length, 1);
});

teste('Go For: o alvo novo vale na hora de decidir a rodada', () => {
  const jogo = rodada([9, 8, 5, 4]);   // jogador 14, oponente 12
  jogar(jogo, LADO.JOGADOR, 'go_for_17');
  stay(jogo, jogo.turno);
  const r = stay(jogo, jogo.turno).resultado;
  assertIgual(r.alvo, 17);
  assertIgual(r.vencedor, 'jogador');  // 14 é o mais perto de 17 sem passar
});

// ---------------------------------------------------------------------
//  Mão, chance ao comprar e limites
// ---------------------------------------------------------------------

teste('trunfos: cada lado recebe uma carta no começo da rodada', () => {
  const jogo = criarJogo({ seed: 3, catalogoTrunfos: CATALOGO });
  iniciarRodada(jogo);
  assertIgual(jogo.jogadores.jogador.trunfos.length, TRUNFOS.porRodada);
  assertIgual(jogo.jogadores.oponente.trunfos.length, TRUNFOS.porRodada);
  assertIgual(TRUNFOS.porRodada, 1, 'depois de jogar, o grupo fechou em uma por rodada');
});

teste('trunfos: a mesa é limpa entre rodadas, a mão não', () => {
  const jogo = rodada();
  jogar(jogo, LADO.JOGADOR, 'shield');
  jogo.jogadores[LADO.JOGADOR].trunfos.push('destroy');
  stay(jogo, jogo.turno);
  stay(jogo, jogo.turno);
  iniciarRodada(jogo);
  assertIgual(jogo.jogadores.jogador.trunfosNaMesa, []);
  assert(jogo.jogadores.jogador.trunfos.includes('destroy'), 'a mão deveria continuar');
});

teste('trunfos: a mão não passa do máximo do config', () => {
  const jogo = rodada();
  for (let i = 0; i < TRUNFOS.maximoNaMao + 4; i++) darTrunfo(jogo, LADO.JOGADOR, 'shield');
  assertIgual(jogo.jogadores.jogador.trunfos.length, TRUNFOS.maximoNaMao);
});

teste('trunfos: comprar carta não dá mais trunfo nenhum', () => {
  // A torneira fechou depois de jogar: a única carta da rodada é a do
  // começo. O que ainda traz carta é efeito de outra carta, que é jogada.
  assertIgual(TRUNFOS.chanceAoComprar, 0);
  const jogo = criarJogo({ seed: 5, catalogoTrunfos: CATALOGO });
  iniciarRodada(jogo);
  const antes = jogo.jogadores[LADO.JOGADOR].trunfos.length;
  for (let i = 0; i < 5; i++) {
    if (jogo.turno !== LADO.JOGADOR) jogo.turno = LADO.JOGADOR;
    const r = hit(jogo, LADO.JOGADOR);
    assertIgual(r.trunfoGanho, null, 'nenhuma carta cai ao comprar');
  }
  assertIgual(jogo.jogadores[LADO.JOGADOR].trunfos.length, antes);
});

teste('trunfos: não dá para jogar carta que não está na mão nem fora do turno', () => {
  const jogo = rodada();
  assert(!podeJogarTrunfo(jogo, LADO.JOGADOR, 'shield'));
  assertLanca(() => aplicarTrunfo(jogo, LADO.JOGADOR, 'shield'));
  jogo.jogadores[LADO.JOGADOR].trunfos.push('shield');
  jogo.turno = LADO.OPONENTE;
  assertLanca(() => aplicarTrunfo(jogo, LADO.JOGADOR, 'shield'), 'fora do turno deveria falhar');
});

teste('trunfos: usar carta conta nas estatísticas (para a pontuação)', () => {
  const jogo = rodada();
  jogar(jogo, LADO.JOGADOR, 'shield');
  jogar(jogo, LADO.JOGADOR, 'return');
  assertIgual(jogo.stats.trunfosUsados.jogador, 2);
  assertIgual(jogo.stats.trunfosUsados.oponente, 0);
});

teste('verMesa: mostra a mesa do adversário, mas esconde a mão de trunfos dele', () => {
  const jogo = rodada();
  jogar(jogo, LADO.OPONENTE, 'shield');
  jogo.jogadores[LADO.OPONENTE].trunfos = ['destroy', 'one_up'];
  jogo.jogadores[LADO.JOGADOR].trunfos = ['return'];

  const visao = verMesa(jogo, LADO.JOGADOR);
  assertIgual(visao.eu.trunfos, ['return'], 'a minha mão vem com os ids');
  assertIgual(visao.adversario.trunfos, 2, 'a mão dele vem só como quantidade');
  assertIgual(visao.adversario.trunfosNaMesa.map((c) => c.id), ['shield'], 'a mesa dele é pública');
  assertIgual(visao.adversario.apostaEfetiva, apostaEfetiva(jogo, LADO.OPONENTE));
});
