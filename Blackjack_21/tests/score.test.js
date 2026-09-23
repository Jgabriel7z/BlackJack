// Testes da pontuação (sub-passo 2.1). Sem DOM.

import { teste, assert, assertIgual } from './testador.js';
import {
  criarPontuacao,
  pontuarRodada,
  pontuarNivel,
  multiplicadorDaSequencia,
  criarRecorde,
  atualizarRecorde,
  registrarPartida,
  PONTOS,
} from '../src/engine/score.js';
import { RESULTADO } from '../src/engine/rules.js';

/** Monta um resultado de rodada como o motor devolve em `jogo.ultimaRodada`. */
function resultado({ vencedor = RESULTADO.JOGADOR, jogador = 18, oponente = 16, rodada = 1 } = {}) {
  return {
    rodada,
    vencedor,
    totais: { jogador, oponente },
    estourou: { jogador: jogador > 21, oponente: oponente > 21 },
    cartas: { jogador: { oculta: 1, abertas: [] }, oponente: { oculta: 1, abertas: [] } },
    punicoes: [],
  };
}

teste('pontuação: começa zerada', () => {
  const p = criarPontuacao();
  assertIgual(p.total, 0);
  assertIgual(p.vitoriasSeguidas, 0);
  assertIgual(p.historico, []);
});

teste('pontuação: rodada vencida simples vale 100', () => {
  const p = criarPontuacao();
  const d = pontuarRodada(p, resultado({ jogador: 18, oponente: 16 }));
  assertIgual(d.pontos, 100);
  assertIgual(d.multiplicador, 1);
  assertIgual(p.total, 100);
});

teste('pontuação: +50 ao fechar exatamente no alvo', () => {
  const p = criarPontuacao();
  const d = pontuarRodada(p, resultado({ jogador: 21, oponente: 16 }));
  assertIgual(d.alvoExato, PONTOS.ALVO_EXATO);
  assertIgual(d.pontos, 150);
});

teste('pontuação: alvo diferente de 21 (cartas Go For) conta o alvo informado', () => {
  const p = criarPontuacao();
  const d = pontuarRodada(p, resultado({ jogador: 17, oponente: 12 }), { alvo: 17 });
  assertIgual(d.alvoExato, 50);
  const q = criarPontuacao();
  assertIgual(pontuarRodada(q, resultado({ jogador: 21, oponente: 12 }), { alvo: 17 }).alvoExato, 0);
});

teste('pontuação: +25 ao vencer com o oponente estourado', () => {
  const p = criarPontuacao();
  const d = pontuarRodada(p, resultado({ jogador: 15, oponente: 24 }));
  assertIgual(d.oponenteEstourou, PONTOS.OPONENTE_ESTOUROU);
  assertIgual(d.pontos, 125);
});

teste('pontuação: +10 por trunfo usado (parâmetro já previsto)', () => {
  const p = criarPontuacao();
  const d = pontuarRodada(p, resultado(), { trunfosUsados: 3 });
  assertIgual(d.trunfos, 30);
  assertIgual(d.pontos, 130);
});

teste('multiplicador: 1x, 1,5x e 2x pela sequência de vitórias', () => {
  assertIgual(multiplicadorDaSequencia(0), 1);
  assertIgual(multiplicadorDaSequencia(1), 1);
  assertIgual(multiplicadorDaSequencia(2), 1.5);
  assertIgual(multiplicadorDaSequencia(3), 2);
  assertIgual(multiplicadorDaSequencia(7), 2);
});

teste('pontuação: duas vitórias seguidas aplicam ×1,5 na segunda', () => {
  const p = criarPontuacao();
  pontuarRodada(p, resultado({ rodada: 1 }));
  const d = pontuarRodada(p, resultado({ rodada: 2 }));
  assertIgual(d.multiplicador, 1.5);
  assertIgual(d.pontos, 150);
  assertIgual(p.total, 250);
  assertIgual(p.maiorSequencia, 2);
});

teste('pontuação: terceira vitória seguida dobra, com bônus dentro do multiplicador', () => {
  const p = criarPontuacao();
  pontuarRodada(p, resultado());
  pontuarRodada(p, resultado());
  const d = pontuarRodada(p, resultado({ jogador: 21, oponente: 25 }));
  assertIgual(d.multiplicador, 2);
  assertIgual(d.pontos, (100 + 50 + 25) * 2);
  assertIgual(p.total, 100 + 150 + 350);
});

teste('pontuação: derrota e empate não pontuam e zeram a sequência', () => {
  const p = criarPontuacao();
  pontuarRodada(p, resultado());
  pontuarRodada(p, resultado());
  const derrota = pontuarRodada(p, resultado({ vencedor: RESULTADO.OPONENTE, jogador: 12, oponente: 19 }));
  assertIgual(derrota.pontos, 0);
  assertIgual(p.vitoriasSeguidas, 0);
  const empate = pontuarRodada(p, resultado({ vencedor: RESULTADO.EMPATE, jogador: 18, oponente: 18 }));
  assertIgual(empate.pontos, 0);
  assertIgual(p.total, 250);
  // a sequência recomeça do ×1
  assertIgual(pontuarRodada(p, resultado()).multiplicador, 1);
});

teste('pontuação: +500 por nível concluído, fora do multiplicador', () => {
  const p = criarPontuacao();
  pontuarRodada(p, resultado());
  pontuarRodada(p, resultado());
  assertIgual(pontuarNivel(p), 500);
  assertIgual(p.total, 750);
  assertIgual(p.niveisConcluidos, 1);
});

// ---------------------------------------------------------------------
//  Recorde da sessão (2.6)
// ---------------------------------------------------------------------

teste('recorde: começa zerado', () => {
  assertIgual(criarRecorde(), { melhor: 0, partidas: 0 });
});

teste('recorde: a primeira partida sobe o valor mas não conta como "bateu"', () => {
  const recorde = criarRecorde();
  const r = atualizarRecorde(recorde, 300);
  assertIgual(r.melhor, 300, 'o visor acompanha a pontuação da primeira partida');
  assertIgual(r.bateu, false, 'não havia recorde anterior para superar');
});

teste('recorde: superar um recorde anterior conta como "bateu"', () => {
  const recorde = criarRecorde();
  atualizarRecorde(recorde, 300);      // primeira partida
  const r = atualizarRecorde(recorde, 301);
  assertIgual(r.bateu, true);
  assertIgual(r.melhor, 301);
});

teste('recorde: pontuação menor ou igual não mexe no recorde', () => {
  const recorde = criarRecorde();
  atualizarRecorde(recorde, 500);
  assertIgual(atualizarRecorde(recorde, 500), { bateu: false, melhor: 500 });
  assertIgual(atualizarRecorde(recorde, 120), { bateu: false, melhor: 500 });
  assertIgual(recorde.melhor, 500);
});

teste('recorde: o recorde atravessa várias partidas e conta quantas foram', () => {
  const recorde = criarRecorde();
  for (const total of [200, 150, 640, 90]) {
    atualizarRecorde(recorde, total);
    registrarPartida(recorde);
  }
  assertIgual(recorde.melhor, 640);
  assertIgual(recorde.partidas, 4);
});

teste('pontuação: histórico guarda um registro por rodada com o total acumulado', () => {
  const p = criarPontuacao();
  pontuarRodada(p, resultado({ rodada: 1 }));
  pontuarRodada(p, resultado({ rodada: 2, vencedor: RESULTADO.OPONENTE, jogador: 10, oponente: 20 }));
  assertIgual(p.historico.length, 2);
  assertIgual(p.historico[0].totalDepois, 100);
  assertIgual(p.historico[1].venceu, false);
  assert(p.historico[1].totalDepois === 100);
});
