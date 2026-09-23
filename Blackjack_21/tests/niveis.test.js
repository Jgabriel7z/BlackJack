// Testes dos três níveis e suas punições (sub-passo 2.4). Sem DOM.

import { teste, assert, assertIgual, assertLanca } from './testador.js';
import { criarBaralho } from '../src/engine/deck.js';
import {
  NIVEL,
  NIVEIS,
  TRILHO_SERRA,
  SERRA_INICIAL,
  configDoNivel,
  aplicarPunicaoDoNivel,
  estaMorto,
  descreverMorte,
} from '../src/engine/niveis.js';
import {
  criarJogo,
  iniciarRodada,
  stay,
  avancarNivel,
  FASE,
  LADO,
} from '../src/engine/game.js';

/** Rodada com baralho de ordem conhecida, no nível pedido. */
function rodadaNoNivel(nivel, ordemDeCompra = [10, 9, 8, 7]) {
  const restantes = criarBaralho().filter((c) => !ordemDeCompra.includes(c));
  const baralho = [...restantes, ...[...ordemDeCompra].reverse()];
  const jogo = criarJogo({ seed: 5, nivel, embaralhar: () => [...baralho] });
  iniciarRodada(jogo);
  return jogo;
}

/** Encerra a rodada com dois stays. Com esta ordem, o jogador vence (18 x 16). */
function encerrar(jogo) {
  stay(jogo, jogo.turno);
  return stay(jogo, jogo.turno).resultado;
}

// ---------------------------------------------------------------------
//  Configuração
// ---------------------------------------------------------------------

teste('níveis: os três existem, com aparelho e trunfos iniciais próprios', () => {
  assertIgual(configDoNivel(1).punicao, 'dedos');
  assertIgual(configDoNivel(2).punicao, 'choque');
  assertIgual(configDoNivel(3).punicao, 'serra');
  // Depois de jogar, o grupo fechou a torneira: uma carta por rodada em
  // todos os níveis, e nada mais cai sozinho no meio dela.
  assertIgual(configDoNivel(2).trunfosIniciais, 1, 'no choque também é uma');
  assertIgual(configDoNivel(3).trunfosIniciais, 1);
  assertIgual(configDoNivel(2).maximo, 10, 'o medidor vai até 10');
  assert(NIVEIS[NIVEL.CHOQUE].fala.length >= 1, 'o Kaio precisa ter o que falar');
  assert(NIVEIS[NIVEL.SERRA].fala.length >= 1);
});

teste('níveis: jogo novo começa no 1, ou no que a opção pedir', () => {
  assertIgual(criarJogo({ seed: 1 }).nivel, 1);
  assertIgual(criarJogo({ seed: 1, nivel: 3 }).nivel, 3);
  assertIgual(criarJogo({ seed: 1, nivel: 3 }).serra, SERRA_INICIAL);
});

// ---------------------------------------------------------------------
//  Nível 2 — choque
// ---------------------------------------------------------------------

teste('choque: o medidor sobe pela aposta e não passa de 10', () => {
  const jogo = criarJogo({ seed: 1, nivel: NIVEL.CHOQUE });
  assertIgual(aplicarPunicaoDoNivel(jogo, LADO.JOGADOR, 3).para, 3);
  assertIgual(jogo.jogadores.jogador.choque, 3);
  assertIgual(aplicarPunicaoDoNivel(jogo, LADO.JOGADOR, 4).para, 7);
  const ultima = aplicarPunicaoDoNivel(jogo, LADO.JOGADOR, 9);
  assertIgual(ultima.para, 10, 'o medidor trava em 10');
  assertIgual(ultima.quantidade, 3, 'só conta o que coube');
});

teste('choque: chegar a 10 é morte; abaixo disso não', () => {
  const jogo = criarJogo({ seed: 1, nivel: NIVEL.CHOQUE });
  jogo.jogadores.jogador.choque = 9;
  assert(!estaMorto(jogo, LADO.JOGADOR));
  jogo.jogadores.jogador.choque = 10;
  assert(estaMorto(jogo, LADO.JOGADOR));
});

teste('choque: perder a rodada sobe o medidor de quem perdeu', () => {
  const jogo = rodadaNoNivel(NIVEL.CHOQUE);
  const r = encerrar(jogo);
  assertIgual(r.vencedor, 'jogador');
  assertIgual(r.punicoes[0].tipo, 'choque');
  assertIgual(jogo.jogadores.oponente.choque, 1, 'aposta 1 na primeira rodada');
  assertIgual(jogo.jogadores.jogador.choque, 0);
  assertIgual(jogo.jogadores.oponente.dedos, 5, 'no choque ninguém perde dedo');
});

teste('choque: empate leva os dois ao choque', () => {
  const jogo = rodadaNoNivel(NIVEL.CHOQUE, [10, 9, 6, 7]); // 16 x 16
  const r = encerrar(jogo);
  assertIgual(r.vencedor, 'empate');
  assertIgual(r.punicoes.length, 2);
  assertIgual(jogo.jogadores.jogador.choque, 1);
  assertIgual(jogo.jogadores.oponente.choque, 1);
});

// ---------------------------------------------------------------------
//  Nível 3 — serra
// ---------------------------------------------------------------------

teste('serra: começa no meio do trilho de 15', () => {
  const jogo = criarJogo({ seed: 1, nivel: NIVEL.SERRA });
  assertIgual(jogo.serra, SERRA_INICIAL);
  assertIgual(TRILHO_SERRA, 15);
  assert(!estaMorto(jogo, LADO.JOGADOR));
  assert(!estaMorto(jogo, LADO.OPONENTE));
});

teste('serra: quem perde puxa a lâmina para o próprio lado', () => {
  const jogo = criarJogo({ seed: 1, nivel: NIVEL.SERRA });
  aplicarPunicaoDoNivel(jogo, LADO.JOGADOR, 3);
  assertIgual(jogo.serra, SERRA_INICIAL - 3, 'perdeu o jogador: a serra vem para ele');
  aplicarPunicaoDoNivel(jogo, LADO.OPONENTE, 5);
  assertIgual(jogo.serra, SERRA_INICIAL + 2, 'perdeu o oponente: a serra volta e passa do meio');
});

teste('serra: chegar na ponta do trilho mata o lado de lá', () => {
  const jogo = criarJogo({ seed: 1, nivel: NIVEL.SERRA });
  aplicarPunicaoDoNivel(jogo, LADO.JOGADOR, 20);
  assertIgual(jogo.serra, 0, 'não passa da ponta');
  assert(estaMorto(jogo, LADO.JOGADOR));
  assert(!estaMorto(jogo, LADO.OPONENTE));

  const outro = criarJogo({ seed: 1, nivel: NIVEL.SERRA });
  aplicarPunicaoDoNivel(outro, LADO.OPONENTE, 20);
  assertIgual(outro.serra, TRILHO_SERRA);
  assert(estaMorto(outro, LADO.OPONENTE));
});

teste('serra: empate não mexe a lâmina', () => {
  const jogo = rodadaNoNivel(NIVEL.SERRA, [10, 9, 6, 7]); // 16 x 16
  const r = encerrar(jogo);
  assertIgual(r.vencedor, 'empate');
  assertIgual(r.punicoes, [], 'ninguém é punido');
  assertIgual(jogo.serra, SERRA_INICIAL);
});

// ---------------------------------------------------------------------
//  Passagem de nível
// ---------------------------------------------------------------------

teste('nível: vencer o 1 leva a NIVEL_CONCLUIDO, e avancarNivel prepara o 2', () => {
  const jogo = rodadaNoNivel(NIVEL.GUILHOTINA);
  jogo.jogadores.oponente.dedos = 1;
  encerrar(jogo);
  assertIgual(jogo.fase, FASE.NIVEL_CONCLUIDO);

  avancarNivel(jogo);
  assertIgual(jogo.nivel, 2);
  assertIgual(jogo.fase, FASE.AGUARDANDO);
  assertIgual(jogo.rodadaDoNivel, 0);
  assertIgual(jogo.jogadores.oponente.dedos, 5, 'vida cheia no aparelho novo');
  assertIgual(jogo.jogadores.jogador.choque, 0);
  assertIgual(jogo.jogadores.jogador.trunfosNaMesa, []);

  iniciarRodada(jogo);
  assertIgual(jogo.jogadores.jogador.aposta, 1, 'a aposta recomeça no nível novo');
});

teste('nível: vencer o 3 é vitória final, não tem próximo nível', () => {
  const jogo = rodadaNoNivel(NIVEL.SERRA);
  jogo.serra = TRILHO_SERRA - 1;
  encerrar(jogo); // o jogador vence: a serra anda para o oponente
  assertIgual(jogo.fase, FASE.FIM_DE_JOGO);
  assertIgual(jogo.vencedorDoJogo, LADO.JOGADOR);
  assertIgual(jogo.vitoriaFinal, true);
  assertLanca(() => avancarNivel(jogo), 'não há nível depois do último');
});

teste('nível: o jogador cair encerra o jogo em qualquer nível', () => {
  const jogo = rodadaNoNivel(NIVEL.CHOQUE, [9, 10, 7, 8]); // o jogador perde
  jogo.jogadores.jogador.choque = 9;
  encerrar(jogo);
  assertIgual(jogo.fase, FASE.FIM_DE_JOGO);
  assertIgual(jogo.vencedorDoJogo, LADO.OPONENTE);
  assertIgual(jogo.vitoriaFinal, false);
});

teste('nível: avancarNivel só vale depois de concluir o nível', () => {
  const jogo = rodadaNoNivel(NIVEL.GUILHOTINA);
  assertLanca(() => avancarNivel(jogo));
});

// ---------------------------------------------------------------------
//  Texto da morte
// ---------------------------------------------------------------------

teste('morte: a frase final combina com o aparelho', () => {
  assert(descreverMorte(NIVEL.GUILHOTINA, 'Luiz').includes('dedos'));
  assert(descreverMorte(NIVEL.CHOQUE, 'Luiz').includes('choque'));
  assert(descreverMorte(NIVEL.SERRA, 'Luiz').includes('serra'));
});
