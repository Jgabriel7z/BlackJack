// =====================================================================
//  trapaca.js — a trapaça do anfitrião  (sub-passo 4.8)
//
//  O momento roteirizado do fim da história (partes A4 e B6 do PDF).
//  No nível 3, quando a serra está a uma derrota de encostar no Luiz
//  Alberto, o Kaio não deixa o jogo acabar: ele joga pelo oponente duas
//  cartas que o jogador não tem como responder no braço —
//  **Perfect Draw** (o Luiz compra a melhor carta do baralho) e
//  **Desperation** (as apostas dos dois sobem 100, então a próxima
//  derrota mata, e o jogador fica proibido de comprar).
//
//  A saída existe e é dada de antemão: ao entrar no nível 3 o jogador
//  recebe **Love Your Enemy**, que obriga o oponente a comprar a melhor
//  carta possível. Com a mão dele já fechada pelo Perfect Draw, essa
//  carta a mais estoura — e quem morre é ele.
//
//  E se o jogador matar o Luiz antes de a serra chegar a esse ponto
//  (encarecendo a aposta dele com One-Up/Two-Up, por exemplo), a
//  trapaça simplesmente não acontece: ela é uma carta na manga do
//  anfitrião, não um gatilho obrigatório.
//
//  Lógica pura: nada de tela nem de som aqui.
// =====================================================================

import { LADO, apostaEfetiva } from './game.js';
import { NIVEL, TRILHO_SERRA } from './niveis.js';
import { darTrunfo, aplicarTrunfo } from './trumps.js';

/** O que o anfitrião joga, nesta ordem. */
export const CARTAS_DA_TRAPACA = Object.freeze(['perfect_draw', 'desperation']);

/** A carta que o jogador ganha ao entrar no nível 3, a saída da armadilha. */
export const CARTA_DA_SAIDA = 'love_your_enemy';

export function criarTrapaca() {
  return { aconteceu: false, rodada: null };
}

/**
 * True se a serra está a UMA derrota de encostar no oponente: se ele
 * perder esta rodada pela aposta que está valendo, acabou para ele.
 */
export function serraAUmaDerrotaDoOponente(jogo) {
  if (jogo.nivel !== NIVEL.SERRA) return false;
  return jogo.serra + apostaEfetiva(jogo, LADO.OPONENTE) >= TRILHO_SERRA;
}

/** True se é a hora da trapaça. Acontece uma vez só na partida. */
export function deveTrapacear(jogo, trapaca) {
  if (trapaca.aconteceu) return false;
  if (jogo.fase !== 'jogando') return false;
  return serraAUmaDerrotaDoOponente(jogo);
}

/**
 * Dá ao jogador a carta que vai salvá-lo, ao entrar no nível 3.
 * Devolve true se a carta foi entregue.
 */
export function prepararTrapaca(jogo) {
  if (jogo.nivel !== NIVEL.SERRA || !jogo.catalogoTrunfos) return false;
  if (!jogo.catalogoTrunfos.porId.has(CARTA_DA_SAIDA)) return false;
  const mao = jogo.jogadores[LADO.JOGADOR].trunfos;
  if (mao.includes(CARTA_DA_SAIDA)) return true;
  darTrunfo(jogo, LADO.JOGADOR, CARTA_DA_SAIDA);
  return true;
}

/**
 * O anfitrião joga as duas cartas pelo oponente. Ele não espera a vez
 * de ninguém — é justamente esse o ponto da cena —, então o turno é
 * emprestado e devolvido.
 * Devolve a lista de relatórios das cartas jogadas.
 */
export function aplicarTrapaca(jogo, trapaca) {
  const relatorios = [];
  const turnoAnterior = jogo.turno;

  for (const id of CARTAS_DA_TRAPACA) {
    if (!jogo.catalogoTrunfos?.porId.has(id)) continue;
    darTrunfo(jogo, LADO.OPONENTE, id);
    jogo.turno = LADO.OPONENTE;
    relatorios.push(aplicarTrunfo(jogo, LADO.OPONENTE, id));
  }

  jogo.turno = turnoAnterior;
  trapaca.aconteceu = true;
  trapaca.rodada = jogo.rodada;
  return relatorios;
}
