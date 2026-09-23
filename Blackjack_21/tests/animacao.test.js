// Testes do sequenciador de animação (sub-passo 1.4). Sem DOM.

import { teste, assert, assertIgual } from './testador.js';
import { criarSequenciador, suavizar, interpolar, limitar, pausa } from '../src/ui/animacao.js';

teste('sequenciador: começa ocioso e roda um passo até o fim', () => {
  const seq = criarSequenciador(1);
  assert(!seq.ocupado);
  const progressos = [];
  seq.adicionar({ nome: 'a', duracao: 100, aoAtualizar: (p) => progressos.push(p) });
  assert(seq.ocupado);
  seq.atualizar(0);
  assertIgual(seq.nomeAtual, 'a');
  seq.atualizar(50);
  seq.atualizar(100);
  assertIgual(progressos, [0, 0.5, 1]);
  assert(!seq.ocupado);
  assertIgual(seq.nomeAtual, null);
});

teste('sequenciador: chama aoIniciar e aoTerminar uma vez cada, na ordem', () => {
  const seq = criarSequenciador(1);
  const eventos = [];
  seq.adicionar({ nome: 'a', duracao: 10, aoIniciar: () => eventos.push('inicio a'), aoTerminar: () => eventos.push('fim a') });
  seq.adicionar({ nome: 'b', duracao: 10, aoIniciar: () => eventos.push('inicio b'), aoTerminar: () => eventos.push('fim b') });
  seq.atualizar(0);
  seq.atualizar(10);   // termina a
  seq.atualizar(10);   // começa b
  seq.atualizar(20);   // termina b
  assertIgual(eventos, ['inicio a', 'fim a', 'inicio b', 'fim b']);
});

teste('sequenciador: fatorTempo encurta a duração (?rapido=1)', () => {
  const seq = criarSequenciador(0.05);
  seq.adicionar({ nome: 'a', duracao: 1000 });
  seq.atualizar(0);
  seq.atualizar(25);   // 1000 * 0.05 = 50 ms -> meio caminho
  assertIgual(seq.nomeAtual, 'a');
  seq.atualizar(50);
  assert(!seq.ocupado, 'deveria ter terminado em 50 ms');
});

teste('sequenciador: aoTerminar pode enfileirar o próximo passo (reação da IA)', () => {
  const seq = criarSequenciador(1);
  seq.adicionar({ nome: 'pensando', duracao: 10, aoTerminar() { seq.adicionar(pausa('comprando', 10)); } });
  seq.atualizar(0);
  seq.atualizar(10);
  assert(seq.ocupado, 'o passo enfileirado no fim deveria manter a sequência ocupada');
  seq.atualizar(10);
  assertIgual(seq.nomeAtual, 'comprando');
});

teste('sequenciador: passo com ritmoReal ignora o fatorTempo', () => {
  const seq = criarSequenciador(0.05);
  seq.adicionar({ nome: 'fala', duracao: 1000, ritmoReal: true });
  seq.atualizar(0);
  seq.atualizar(500);
  assertIgual(seq.nomeAtual, 'fala', 'aos 500 ms ainda está no meio, mesmo no modo rápido');
  seq.atualizar(1000);
  assert(!seq.ocupado, 'termina em 1000 ms, a duração cheia');
});

teste('sequenciador: duração zero termina no mesmo quadro', () => {
  const seq = criarSequenciador(1);
  let terminou = false;
  seq.adicionar({ nome: 'msg', duracao: 0, aoTerminar: () => { terminou = true; } });
  seq.atualizar(123);
  assert(terminou);
});

teste('suavização e utilidades: extremos e limites', () => {
  for (const f of Object.values(suavizar)) {
    assertIgual(Math.round(f(0) * 1000) / 1000, 0);
    assertIgual(Math.round(f(1) * 1000) / 1000, 1);
  }
  assertIgual(interpolar(10, 20, 0.25), 12.5);
  assertIgual(limitar(5, 0, 1), 1);
  assertIgual(limitar(-3, 0, 1), 0);
});
