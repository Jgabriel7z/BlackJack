// =====================================================================
//  score.js — pontuação  (sub-passo 2.1)
//
//  Regras (PLANO_DE_DESENVOLVIMENTO.md, Etapa 2):
//    +100  por rodada vencida
//    +50   se o vencedor fechou exatamente no alvo (21, ou o alvo da vez)
//    +25   se venceu com o oponente estourado
//    +10   por carta trunfo usada na rodada (ainda não existem trunfos;
//          o parâmetro já está previsto)
//    ×1 / ×1,5 / ×2  multiplicador pela sequência de vitórias: 1ª vitória
//          seguida ×1, 2ª ×1,5, 3ª em diante ×2. Perder ou empatar zera.
//    +500  ao completar um nível (fora do multiplicador)
//
//  Empate e derrota não pontuam. Só o jogador humano é pontuado.
//  Lógica pura, sem DOM: quem chama passa o `resultado` de uma rodada
//  (o objeto `jogo.ultimaRodada` do motor) e recebe o detalhamento.
// =====================================================================

import { RESULTADO } from './rules.js';

export const PONTOS = Object.freeze({
  RODADA_VENCIDA: 100,
  ALVO_EXATO: 50,
  OPONENTE_ESTOUROU: 25,
  POR_TRUNFO: 10,
  NIVEL_CONCLUIDO: 500,
});

/** Multiplicador para a n-ésima vitória seguida (n >= 1). */
export function multiplicadorDaSequencia(vitoriasSeguidas) {
  if (vitoriasSeguidas <= 1) return 1;
  if (vitoriasSeguidas === 2) return 1.5;
  return 2;
}

export function criarPontuacao() {
  return {
    total: 0,
    vitoriasSeguidas: 0,
    maiorSequencia: 0,
    rodadasVencidas: 0,
    niveisConcluidos: 0,
    historico: [], // um registro por rodada pontuada
  };
}

/**
 * Pontua uma rodada resolvida. `resultado` é `jogo.ultimaRodada`;
 * `opcoes.alvo` é o alvo da rodada (padrão 21); `opcoes.trunfosUsados`
 * quantos trunfos o jogador usou na rodada (padrão 0).
 * Devolve o detalhamento e atualiza `pontuacao`.
 */
export function pontuarRodada(pontuacao, resultado, opcoes = {}) {
  const alvo = opcoes.alvo ?? 21;
  const trunfosUsados = opcoes.trunfosUsados ?? 0;

  if (resultado.vencedor !== RESULTADO.JOGADOR) {
    pontuacao.vitoriasSeguidas = 0;
    const detalhe = {
      rodada: resultado.rodada,
      venceu: false,
      base: 0, alvoExato: 0, oponenteEstourou: 0, trunfos: 0,
      multiplicador: 1, pontos: 0,
      totalDepois: pontuacao.total,
    };
    pontuacao.historico.push(detalhe);
    return detalhe;
  }

  pontuacao.vitoriasSeguidas += 1;
  pontuacao.rodadasVencidas += 1;
  pontuacao.maiorSequencia = Math.max(pontuacao.maiorSequencia, pontuacao.vitoriasSeguidas);

  const base = PONTOS.RODADA_VENCIDA;
  const alvoExato = resultado.totais.jogador === alvo ? PONTOS.ALVO_EXATO : 0;
  const oponenteEstourou = resultado.estourou.oponente ? PONTOS.OPONENTE_ESTOUROU : 0;
  const trunfos = trunfosUsados * PONTOS.POR_TRUNFO;
  const multiplicador = multiplicadorDaSequencia(pontuacao.vitoriasSeguidas);
  const pontos = Math.round((base + alvoExato + oponenteEstourou + trunfos) * multiplicador);

  pontuacao.total += pontos;
  const detalhe = {
    rodada: resultado.rodada,
    venceu: true,
    base, alvoExato, oponenteEstourou, trunfos,
    multiplicador, pontos,
    totalDepois: pontuacao.total,
  };
  pontuacao.historico.push(detalhe);
  return detalhe;
}

/** Bônus fixo por concluir um nível (não entra no multiplicador). */
export function pontuarNivel(pontuacao) {
  pontuacao.niveisConcluidos += 1;
  pontuacao.total += PONTOS.NIVEL_CONCLUIDO;
  return PONTOS.NIVEL_CONCLUIDO;
}

// ---------------------------------------------------------------------
//  Recorde da sessão  (sub-passo 2.6)
//
//  Vale enquanto a página estiver aberta: o recorde sobrevive ao "jogar
//  de novo", mas não ao recarregar. Guardar em disco é da Etapa 4.
// ---------------------------------------------------------------------

export function criarRecorde() {
  return { melhor: 0, partidas: 0 };
}

/**
 * Compara a pontuação da partida em andamento com o recorde da sessão e
 * sobe o recorde se for o caso. `bateu` só é verdadeiro quando já havia
 * um recorde anterior para superar: na primeira partida o visor apenas
 * acompanha a pontuação, sem ficar piscando o tempo todo.
 */
export function atualizarRecorde(recorde, totalDaPartida) {
  if (totalDaPartida <= recorde.melhor) {
    return { bateu: false, melhor: recorde.melhor };
  }
  const haviaRecorde = recorde.melhor > 0;
  recorde.melhor = totalDaPartida;
  return { bateu: haviaRecorde, melhor: recorde.melhor };
}

/** Conta mais uma partida terminada. */
export function registrarPartida(recorde) {
  recorde.partidas += 1;
  return recorde;
}
