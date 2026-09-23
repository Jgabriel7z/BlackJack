// Testes do motor de regras (sub-passo 1.1). Sem interface.

import { teste, assert, assertIgual, assertLanca } from './testador.js';
import { criarRng, seedAleatoria } from '../src/engine/rng.js';
import { criarBaralho, embaralhar, embaralharComSeed, comprar } from '../src/engine/deck.js';
import { somarMao, estourou, decidirVencedor, RESULTADO } from '../src/engine/rules.js';
import { NOMES } from '../src/config.js';
import {
  criarJogo,
  iniciarRodada,
  hit,
  stay,
  podeComprar,
  podePassar,
  verMesa,
  FASE,
  LADO,
  DEDOS_INICIAIS,
} from '../src/engine/game.js';

// ---------------------------------------------------------------------
//  Ajudantes
// ---------------------------------------------------------------------

/**
 * Cria um jogo cujo baralho sai numa ordem conhecida.
 * `ordemDeCompra` lista as cartas na ordem em que serão COMPRADAS.
 * A distribuição inicial compra 4 cartas nesta ordem:
 *   1ª = oculta do jogador, 2ª = oculta do oponente,
 *   3ª = aberta do jogador, 4ª = aberta do oponente.
 * As demais ficam no baralho para os HITs. Cartas não listadas são
 * colocadas embaixo, em ordem crescente.
 */
function jogoComBaralho(ordemDeCompra) {
  const restantes = criarBaralho().filter((c) => !ordemDeCompra.includes(c));
  // comprar() tira do fim do array, então a ordem de compra fica invertida.
  const baralho = [...restantes, ...[...ordemDeCompra].reverse()];
  return criarJogo({ embaralhar: () => [...baralho] });
}

/** Encerra a rodada atual com dois stays, respeitando o turno. */
function encerrarComDoisStays(jogo) {
  const primeiro = jogo.turno;
  stay(jogo, primeiro);
  return stay(jogo, jogo.turno).resultado;
}

// ---------------------------------------------------------------------
//  rng.js
// ---------------------------------------------------------------------

teste('rng: mesma seed gera a mesma sequência', () => {
  const a = criarRng(12345);
  const b = criarRng(12345);
  const seqA = [a(), a(), a(), a(), a()];
  const seqB = [b(), b(), b(), b(), b()];
  assertIgual(seqA, seqB);
});

teste('rng: seeds diferentes geram sequências diferentes', () => {
  const a = criarRng(1);
  const b = criarRng(2);
  assert(a() !== b(), 'primeiros valores iguais para seeds diferentes');
});

teste('rng: valores ficam em [0, 1) e a seed fica guardada', () => {
  const r = criarRng(2024);
  for (let i = 0; i < 1000; i++) {
    const v = r();
    assert(v >= 0 && v < 1, `valor fora do intervalo: ${v}`);
  }
  assertIgual(r.seed, 2024);
});

teste('rng: seed inválida lança erro; seedAleatoria devolve inteiro de 32 bits', () => {
  assertLanca(() => criarRng('abc'));
  assertLanca(() => criarRng(undefined));
  const s = seedAleatoria();
  assert(Number.isInteger(s) && s >= 0 && s < 4294967296, `seed fora do intervalo: ${s}`);
});

// ---------------------------------------------------------------------
//  deck.js
// ---------------------------------------------------------------------

teste('baralho novo tem 11 cartas únicas de 1 a 11', () => {
  const b = criarBaralho();
  assertIgual(b.length, 11);
  assertIgual([...new Set(b)].sort((x, y) => x - y), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
});

teste('embaralhar não perde nem repete cartas e não altera o original', () => {
  const original = criarBaralho();
  const copiaAntes = [...original];
  const emb = embaralhar(original);
  assertIgual(original, copiaAntes, 'original mudou');
  assertIgual([...emb].sort((x, y) => x - y), copiaAntes);
});

teste('embaralhar com função aleatória fixa é previsível', () => {
  const a = embaralhar(criarBaralho(), () => 0.5);
  const b = embaralhar(criarBaralho(), () => 0.5);
  assertIgual(a, b);
});

teste('mesma seed dá o mesmo baralho; seed diferente dá baralho diferente', () => {
  const a = embaralharComSeed(criarBaralho(), 777);
  const b = embaralharComSeed(criarBaralho(), 777);
  const c = embaralharComSeed(criarBaralho(), 778);
  assertIgual(a, b, 'mesma seed deveria dar a mesma ordem');
  assert(JSON.stringify(a) !== JSON.stringify(c), 'seeds diferentes deram a mesma ordem');
  assertIgual([...a].sort((x, y) => x - y), criarBaralho(), 'embaralhado perdeu cartas');
});

teste('embaralhar sem gerador ainda funciona (seed sorteada)', () => {
  const emb = embaralhar(criarBaralho());
  assertIgual([...emb].sort((x, y) => x - y), criarBaralho());
});

teste('comprar tira a carta do topo e falha com baralho vazio', () => {
  const b = [3, 7, 11];
  assertIgual(comprar(b), 11);
  assertIgual(b, [3, 7]);
  assertLanca(() => comprar([]), 'deveria falhar com baralho vazio');
});

// ---------------------------------------------------------------------
//  rules.js
// ---------------------------------------------------------------------

teste('somarMao soma oculta + abertas', () => {
  assertIgual(somarMao({ oculta: 5, abertas: [3, 8] }), 16);
  assertIgual(somarMao({ oculta: null, abertas: [3] }), 3);
});

teste('estourou só acima do alvo', () => {
  assert(!estourou(21));
  assert(estourou(22));
  assert(estourou(18, 17));
});

teste('vencedor: nenhum estourou, maior total vence', () => {
  assertIgual(decidirVencedor(20, 18), RESULTADO.JOGADOR);
  assertIgual(decidirVencedor(15, 21), RESULTADO.OPONENTE);
});

teste('vencedor: um estourou, o outro vence', () => {
  assertIgual(decidirVencedor(25, 4), RESULTADO.OPONENTE);
  assertIgual(decidirVencedor(10, 30), RESULTADO.JOGADOR);
});

teste('vencedor: os dois estouraram, menor total vence', () => {
  assertIgual(decidirVencedor(23, 27), RESULTADO.JOGADOR);
  assertIgual(decidirVencedor(29, 22), RESULTADO.OPONENTE);
});

teste('vencedor: totais iguais é empate (abaixo e acima do alvo)', () => {
  assertIgual(decidirVencedor(18, 18), RESULTADO.EMPATE);
  assertIgual(decidirVencedor(25, 25), RESULTADO.EMPATE);
});

teste('vencedor respeita alvo diferente de 21', () => {
  assertIgual(decidirVencedor(17, 18, 17), RESULTADO.JOGADOR);
});

// ---------------------------------------------------------------------
//  game.js — início de rodada
// ---------------------------------------------------------------------

teste('jogo novo começa aguardando, com 5 dedos cada e nomes vindos do config', () => {
  const jogo = criarJogo();
  assertIgual(jogo.fase, FASE.AGUARDANDO);
  assertIgual(jogo.rodada, 0);
  assertIgual(jogo.jogadores.jogador.dedos, DEDOS_INICIAIS);
  assertIgual(jogo.jogadores.oponente.dedos, DEDOS_INICIAIS);
  assertIgual(jogo.jogadores.jogador.nome, NOMES.jogador);
  assertIgual(jogo.jogadores.oponente.nome, NOMES.oponente);
});

teste('jogo sem seed sorteia uma e guarda em jogo.seed', () => {
  const jogo = criarJogo();
  assert(Number.isInteger(jogo.seed), 'seed deveria ser inteiro');
});

teste('mesma seed reproduz a mesma partida inteira', () => {
  const jogar = (seed) => {
    const jogo = criarJogo({ seed });
    const historico = [];
    while (jogo.fase !== FASE.FIM_DE_JOGO) {
      iniciarRodada(jogo);
      // roteiro fixo: jogador compra uma vez, depois os dois passam
      if (podeComprar(jogo, LADO.JOGADOR)) hit(jogo, LADO.JOGADOR);
      encerrarComDoisStays(jogo);
      historico.push(JSON.stringify(jogo.ultimaRodada));
    }
    return historico;
  };
  assertIgual(jogar(99), jogar(99));
  assertIgual(criarJogo({ seed: 99 }).seed, 99);
});

teste('iniciarRodada dá 1 oculta + 1 aberta para cada e deixa 7 no baralho', () => {
  const jogo = jogoComBaralho([10, 9, 8, 7]);
  iniciarRodada(jogo);
  assertIgual(jogo.fase, FASE.JOGANDO);
  assertIgual(jogo.rodada, 1);
  assertIgual(jogo.turno, LADO.JOGADOR);
  assertIgual(jogo.jogadores.jogador.oculta, 10);
  assertIgual(jogo.jogadores.oponente.oculta, 9);
  assertIgual(jogo.jogadores.jogador.abertas, [8]);
  assertIgual(jogo.jogadores.oponente.abertas, [7]);
  assertIgual(jogo.baralho.length, 7);
});

teste('aposta começa em 1 e sobe 1 por rodada para os dois', () => {
  const jogo = criarJogo();
  iniciarRodada(jogo);
  assertIgual(jogo.jogadores.jogador.aposta, 1);
  assertIgual(jogo.jogadores.oponente.aposta, 1);
  encerrarComDoisStays(jogo);
  iniciarRodada(jogo);
  assertIgual(jogo.jogadores.jogador.aposta, 2);
  assertIgual(jogo.jogadores.oponente.aposta, 2);
});

teste('não dá para iniciar rodada com outra em andamento', () => {
  const jogo = criarJogo();
  iniciarRodada(jogo);
  assertLanca(() => iniciarRodada(jogo));
});

// ---------------------------------------------------------------------
//  game.js — turnos
// ---------------------------------------------------------------------

teste('hit compra uma carta aberta, zera stays e passa a vez', () => {
  const jogo = jogoComBaralho([1, 2, 3, 4, 5]);
  iniciarRodada(jogo);
  const r = hit(jogo, LADO.JOGADOR);
  assertIgual(r.carta, 5);
  assertIgual(jogo.jogadores.jogador.abertas, [3, 5]);
  assertIgual(jogo.turno, LADO.OPONENTE);
  assertIgual(jogo.staysSeguidos, 0);
  assertIgual(jogo.baralho.length, 6);
});

teste('agir fora do turno lança erro', () => {
  const jogo = criarJogo();
  iniciarRodada(jogo);
  assertLanca(() => hit(jogo, LADO.OPONENTE));
  assertLanca(() => stay(jogo, LADO.OPONENTE));
  assertLanca(() => hit(jogo, 'alguem'));
});

teste('agir sem rodada em andamento lança erro', () => {
  const jogo = criarJogo();
  assertLanca(() => hit(jogo, LADO.JOGADOR));
  assertLanca(() => stay(jogo, LADO.JOGADOR));
});

teste('um stay só passa a vez; hit no meio zera a contagem', () => {
  const jogo = criarJogo();
  iniciarRodada(jogo);
  const r1 = stay(jogo, LADO.JOGADOR);
  assertIgual(r1.resultado, null);
  assertIgual(jogo.turno, LADO.OPONENTE);
  assertIgual(jogo.staysSeguidos, 1);
  hit(jogo, LADO.OPONENTE);
  assertIgual(jogo.staysSeguidos, 0);
  assertIgual(jogo.fase, FASE.JOGANDO);
});

teste('dois stays seguidos resolvem a rodada', () => {
  const jogo = criarJogo();
  iniciarRodada(jogo);
  stay(jogo, LADO.JOGADOR);
  const r = stay(jogo, LADO.OPONENTE);
  assert(r.resultado !== null, 'deveria ter resultado');
  assert(jogo.fase === FASE.RODADA_ENCERRADA || jogo.fase === FASE.FIM_DE_JOGO);
});

teste('com baralho vazio não dá para comprar, só passar', () => {
  const jogo = criarJogo();
  iniciarRodada(jogo);
  // 7 cartas sobram após a distribuição; alterna hits até acabar.
  while (jogo.baralho.length > 0) hit(jogo, jogo.turno);
  assert(!podeComprar(jogo, jogo.turno));
  assert(podePassar(jogo, jogo.turno));
  assertLanca(() => hit(jogo, jogo.turno));
});

// ---------------------------------------------------------------------
//  game.js — resolução e punição
// ---------------------------------------------------------------------

teste('vitória normal: perdedor perde dedos = aposta, vencedor conta rodada', () => {
  // jogador: 10 + 8 = 18 ; oponente: 9 + 7 = 16 -> jogador vence
  const jogo = jogoComBaralho([10, 9, 8, 7]);
  iniciarRodada(jogo);
  const r = encerrarComDoisStays(jogo);
  assertIgual(r.vencedor, RESULTADO.JOGADOR);
  assertIgual(r.totais, { jogador: 18, oponente: 16 });
  assertIgual(r.estourou, { jogador: false, oponente: false });
  assertIgual(r.punicoes, [{ lado: 'oponente', dedosPerdidos: 1, dedosRestantes: 4 }]);
  assertIgual(jogo.jogadores.jogador.dedos, 5);
  assertIgual(jogo.jogadores.oponente.dedos, 4);
  assertIgual(jogo.jogadores.jogador.rodadasVencidas, 1);
  assertIgual(jogo.fase, FASE.RODADA_ENCERRADA);
});

teste('estouro: quem passa de 21 perde', () => {
  // jogador: 11 + 5 + 8 = 24 (estoura) ; oponente: 1 + 2 = 3
  const jogo = jogoComBaralho([11, 1, 5, 2, 8]);
  iniciarRodada(jogo);
  hit(jogo, LADO.JOGADOR); // compra o 8 -> 24
  const r = encerrarComDoisStays(jogo);
  assertIgual(r.vencedor, RESULTADO.OPONENTE);
  assertIgual(r.estourou.jogador, true);
  assertIgual(jogo.jogadores.jogador.dedos, 4);
});

teste('duplo estouro: menor total vence', () => {
  // jogador: 11 + 10 + 1 = 22 ; oponente: 9 + 8 + 7 = 24 -> jogador vence
  const jogo = jogoComBaralho([11, 9, 10, 8, 1, 7]);
  iniciarRodada(jogo);
  hit(jogo, LADO.JOGADOR);  // 1  -> 22
  hit(jogo, LADO.OPONENTE); // 7  -> 24
  const r = encerrarComDoisStays(jogo);
  assertIgual(r.totais, { jogador: 22, oponente: 24 });
  assertIgual(r.vencedor, RESULTADO.JOGADOR);
  assertIgual(jogo.jogadores.oponente.dedos, 4);
});

teste('empate: os dois perdem dedos', () => {
  // jogador: 10 + 6 = 16 ; oponente: 9 + 7 = 16
  const jogo = jogoComBaralho([10, 9, 6, 7]);
  iniciarRodada(jogo);
  const r = encerrarComDoisStays(jogo);
  assertIgual(r.vencedor, RESULTADO.EMPATE);
  assertIgual(jogo.jogadores.jogador.dedos, 4);
  assertIgual(jogo.jogadores.oponente.dedos, 4);
  assertIgual(r.punicoes.length, 2);
});

teste('resumo da rodada expõe as cartas ocultas dos dois', () => {
  const jogo = jogoComBaralho([10, 9, 8, 7]);
  iniciarRodada(jogo);
  const r = encerrarComDoisStays(jogo);
  assertIgual(r.cartas.jogador, { oculta: 10, abertas: [8] });
  assertIgual(r.cartas.oponente, { oculta: 9, abertas: [7] });
});

teste('dedos nunca ficam negativos', () => {
  const jogo = jogoComBaralho([10, 9, 8, 7]); // jogador sempre vence com esta ordem
  jogo.jogadores.oponente.dedos = 1;
  jogo.rodada = 2; // próxima rodada será a 3ª, aposta 3 > 1 dedo
  iniciarRodada(jogo);
  encerrarComDoisStays(jogo);
  assertIgual(jogo.jogadores.oponente.dedos, 0);
});

// ---------------------------------------------------------------------
//  game.js — fim de jogo
// ---------------------------------------------------------------------

teste('partida termina quando alguém perde todos os dedos', () => {
  // Ordem fixa: jogador vence toda rodada (18 x 16). Apostas 1, 2, 3 -> 6 >= 5.
  const jogo = jogoComBaralho([10, 9, 8, 7]);
  let rodadas = 0;
  while (jogo.fase !== FASE.FIM_DE_JOGO) {
    iniciarRodada(jogo);
    encerrarComDoisStays(jogo);
    rodadas++;
  }
  assertIgual(rodadas, 3);
  assertIgual(jogo.jogadores.oponente.dedos, 0);
  assertIgual(jogo.vencedorDoJogo, LADO.JOGADOR);
  assertLanca(() => iniciarRodada(jogo), 'não deveria iniciar rodada após o fim');
});

teste('empate final: os dois zerados, ninguém vence', () => {
  const jogo = jogoComBaralho([10, 9, 6, 7]); // empate 16 x 16
  jogo.jogadores.jogador.dedos = 1;
  jogo.jogadores.oponente.dedos = 1;
  iniciarRodada(jogo);
  encerrarComDoisStays(jogo);
  assertIgual(jogo.fase, FASE.FIM_DE_JOGO);
  assertIgual(jogo.vencedorDoJogo, 'ninguem');
});

// ---------------------------------------------------------------------
//  game.js — visão da mesa
// ---------------------------------------------------------------------

teste('verMesa esconde a oculta do adversário durante a rodada', () => {
  const jogo = jogoComBaralho([10, 9, 8, 7]);
  iniciarRodada(jogo);
  const visao = verMesa(jogo, LADO.JOGADOR);
  assertIgual(visao.eu.oculta, 10);
  assertIgual(visao.adversario.oculta, null);
  assertIgual(visao.eu.totalVisivel, 18);
  assertIgual(visao.adversario.totalVisivel, 7);
  assertIgual(visao.cartasNoBaralho, 7);
});

teste('verMesa revela tudo depois da rodada resolvida', () => {
  const jogo = jogoComBaralho([10, 9, 8, 7]);
  iniciarRodada(jogo);
  encerrarComDoisStays(jogo);
  const visao = verMesa(jogo, LADO.OPONENTE);
  assertIgual(visao.adversario.oculta, 10);
  assertIgual(visao.eu.oculta, 9);
});

teste('verMesa não altera o estado', () => {
  const jogo = jogoComBaralho([10, 9, 8, 7]);
  iniciarRodada(jogo);
  const antes = JSON.stringify(jogo);
  verMesa(jogo, LADO.JOGADOR);
  verMesa(jogo, LADO.OPONENTE);
  assertIgual(JSON.stringify(jogo), antes);
});
