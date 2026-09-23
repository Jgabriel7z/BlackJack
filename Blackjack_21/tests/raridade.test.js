// Testes da raridade das cartas trunfo: as melhores têm de ser mais
// difíceis de conseguir. Pedido do grupo depois de jogar. Sem DOM.

import { teste, assert, assertIgual } from './testador.js';
import catalogoJson from '../data/trump_cards.js';
import {
  prepararCatalogo,
  sortearTrunfo,
  raridadeDaCarta,
  chanceDaCarta,
  darTrunfo,
  CARTAS_DO_JOGADOR,
} from '../src/engine/trumps.js';
import { criarJogo, iniciarRodada, LADO } from '../src/engine/game.js';
import { criarRng } from '../src/engine/rng.js';
import { RARIDADES, RARIDADE_DOS_TRUNFOS } from '../src/config.js';

const CATALOGO = prepararCatalogo(catalogoJson);

const LENDARIAS = ['destroy_plus_plus', 'perfect_draw_plus', 'ultimate_draw', 'love_your_enemy'];

// ---------------------------------------------------------------------
//  A tabela de raridade
// ---------------------------------------------------------------------

teste('raridade: toda carta do jogador tem uma gaveta', () => {
  const semGaveta = CARTAS_DO_JOGADOR.filter((id) => !RARIDADE_DOS_TRUNFOS[id]);
  assertIgual(semGaveta, [], `sem raridade: ${semGaveta.join(', ')}`);
});

teste('raridade: quanto melhor a carta, menor o peso', () => {
  assert(RARIDADES.comum.peso > RARIDADES.incomum.peso);
  assert(RARIDADES.incomum.peso > RARIDADES.rara.peso);
  assert(RARIDADES.rara.peso > RARIDADES.lendaria.peso);
});

teste('raridade: as quatro que viram a rodada sozinhas são lendárias', () => {
  for (const id of LENDARIAS) {
    assertIgual(raridadeDaCarta(id), RARIDADES.lendaria, `${id} deveria ser lendária`);
  }
});

teste('raridade: carta desconhecida cai como comum, sem quebrar', () => {
  assertIgual(raridadeDaCarta('carta_que_nao_existe'), RARIDADES.comum);
});

teste('raridade: a chance de cada carta é publicada pelo catálogo', () => {
  const comum = chanceDaCarta(CATALOGO, 'shield');
  const lendaria = chanceDaCarta(CATALOGO, 'ultimate_draw');
  assert(comum > lendaria * 5, `comum ${comum}% contra lendária ${lendaria}%`);
  assertIgual(chanceDaCarta(CATALOGO, 'carta_que_nao_existe'), null);
});

teste('raridade: as chances somam 100%', () => {
  const soma = CATALOGO.disponiveis.reduce((s, id) => s + chanceDaCarta(CATALOGO, id), 0);
  assert(Math.abs(soma - 100) < 0.0001, `somou ${soma}`);
});

// ---------------------------------------------------------------------
//  O sorteio de verdade
// ---------------------------------------------------------------------

teste('raridade: no sorteio, as comuns saem muito mais que as lendárias', () => {
  const aleatorio = criarRng(2026);
  const contagem = {};
  for (let i = 0; i < 20000; i++) {
    const id = sortearTrunfo(CATALOGO, aleatorio());
    contagem[id] = (contagem[id] ?? 0) + 1;
  }
  const porGaveta = { comum: 0, incomum: 0, rara: 0, lendaria: 0 };
  for (const [id, n] of Object.entries(contagem)) {
    porGaveta[RARIDADE_DOS_TRUNFOS[id] ?? 'comum'] += n;
  }
  assert(porGaveta.comum > porGaveta.incomum, `comuns ${porGaveta.comum}, incomuns ${porGaveta.incomum}`);
  assert(porGaveta.incomum > porGaveta.rara, `incomuns ${porGaveta.incomum}, raras ${porGaveta.rara}`);
  assert(porGaveta.rara > porGaveta.lendaria, `raras ${porGaveta.rara}, lendárias ${porGaveta.lendaria}`);
});

teste('raridade: uma lendária sai perto da porcentagem anunciada', () => {
  const aleatorio = criarRng(77);
  const alvo = 'ultimate_draw';
  const esperado = chanceDaCarta(CATALOGO, alvo);
  let saiu = 0;
  const rodadas = 40000;
  for (let i = 0; i < rodadas; i++) {
    if (sortearTrunfo(CATALOGO, aleatorio()) === alvo) saiu += 1;
  }
  const medido = (saiu / rodadas) * 100;
  assert(Math.abs(medido - esperado) < 0.4, `anunciado ${esperado.toFixed(2)}%, medido ${medido.toFixed(2)}%`);
});

teste('raridade: toda carta liberada consegue sair', () => {
  const aleatorio = criarRng(5);
  const vistas = new Set();
  for (let i = 0; i < 60000; i++) vistas.add(sortearTrunfo(CATALOGO, aleatorio()));
  const nuncaSairam = CATALOGO.disponiveis.filter((id) => !vistas.has(id));
  assertIgual(nuncaSairam, [], `nunca saíram: ${nuncaSairam.join(', ')}`);
});

teste('raridade: o sorteio continua preso à seed', () => {
  const tirar = () => {
    const jogo = criarJogo({ seed: 909, catalogoTrunfos: CATALOGO });
    iniciarRodada(jogo);
    return [...jogo.jogadores[LADO.JOGADOR].trunfos];
  };
  assertIgual(tirar(), tirar());
});

teste('raridade: a carta pedida na mão ignora o sorteio', () => {
  const jogo = criarJogo({ seed: 1, catalogoTrunfos: CATALOGO });
  iniciarRodada(jogo);
  jogo.jogadores[LADO.JOGADOR].trunfos = [];
  darTrunfo(jogo, LADO.JOGADOR, 'ultimate_draw');
  assertIgual(jogo.jogadores[LADO.JOGADOR].trunfos, ['ultimate_draw']);
});

teste('raridade: com uma carta presa, as chances das outras sobem', () => {
  const semLendarias = prepararCatalogo(catalogoJson, {
    sorteaveis: CARTAS_DO_JOGADOR.filter((id) => !LENDARIAS.includes(id)),
  });
  assertIgual(chanceDaCarta(semLendarias, 'ultimate_draw'), null, 'presa, não entra no sorteio');
  assert(chanceDaCarta(semLendarias, 'shield') > chanceDaCarta(CATALOGO, 'shield'),
    'com menos cartas no monte, cada uma das que ficam sai mais');
});
