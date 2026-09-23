// Testes da IA básica (sub-passo 1.2).

import { teste, assert, assertIgual } from './testador.js';
import { criarBaralho } from '../src/engine/deck.js';
import { decidirAcao, ACAO, LIMITE_COMPRA } from '../src/engine/ai.js';
import { criarJogo, iniciarRodada, hit, stay, FASE, LADO } from '../src/engine/game.js';

// ---------------------------------------------------------------------
//  Ajudantes
// ---------------------------------------------------------------------

/** Mesmo ajudante de engine.test.js: baralho com ordem de compra conhecida. */
function jogoComBaralho(ordemDeCompra) {
  const restantes = criarBaralho().filter((c) => !ordemDeCompra.includes(c));
  const baralho = [...restantes, ...[...ordemDeCompra].reverse()];
  return criarJogo({ embaralhar: () => [...baralho] });
}

/**
 * Cria uma rodada em que o oponente tem exatamente `totalOponente`
 * (oculta + aberta) e é o turno dele. O jogador passa primeiro.
 */
function rodadaComOponenteEm(totalOponente) {
  // ordem: oculta J, oculta O, aberta J, aberta O
  const ocultaO = Math.min(11, totalOponente - 1);
  const abertaO = totalOponente - ocultaO;
  const ocultaJ = [1, 2, 3, 4].find((c) => c !== ocultaO && c !== abertaO);
  const abertaJ = [1, 2, 3, 4, 5].find((c) => c !== ocultaO && c !== abertaO && c !== ocultaJ);
  const jogo = jogoComBaralho([ocultaJ, ocultaO, abertaJ, abertaO]);
  iniciarRodada(jogo);
  stay(jogo, LADO.JOGADOR); // agora é o turno do oponente
  return jogo;
}

/** Joga uma partida inteira IA contra IA. Devolve o número de ações. */
function partidaIAcontraIA(seed, limiteDeAcoes = 2000) {
  const jogo = criarJogo({ seed });
  let acoes = 0;
  while (jogo.fase !== FASE.FIM_DE_JOGO) {
    iniciarRodada(jogo);
    while (jogo.fase === FASE.JOGANDO) {
      const lado = jogo.turno;
      const acao = decidirAcao(jogo, lado);
      if (acao === ACAO.HIT) hit(jogo, lado);
      else stay(jogo, lado);
      acoes += 1;
      if (acoes > limiteDeAcoes) {
        throw new Error(`seed ${seed}: passou de ${limiteDeAcoes} ações; parece travada`);
      }
    }
  }
  return { acoes, rodadas: jogo.rodada, vencedor: jogo.vencedorDoJogo };
}

// ---------------------------------------------------------------------
//  Regra de decisão
// ---------------------------------------------------------------------

teste('IA: limite de compra é 17', () => {
  assertIgual(LIMITE_COMPRA, 17);
});

teste('IA: com 16 compra', () => {
  const jogo = rodadaComOponenteEm(16);
  assertIgual(jogo.jogadores.oponente.oculta + jogo.jogadores.oponente.abertas[0], 16);
  assertIgual(decidirAcao(jogo, LADO.OPONENTE), ACAO.HIT);
});

teste('IA: com 17 para', () => {
  const jogo = rodadaComOponenteEm(17);
  assertIgual(jogo.jogadores.oponente.oculta + jogo.jogadores.oponente.abertas[0], 17);
  assertIgual(decidirAcao(jogo, LADO.OPONENTE), ACAO.STAY);
});

teste('IA: com mais de 17 (inclusive estourado) para', () => {
  assertIgual(decidirAcao(rodadaComOponenteEm(20), LADO.OPONENTE), ACAO.STAY);
  const estourado = rodadaComOponenteEm(16);
  hit(estourado, LADO.OPONENTE); // compra qualquer carta -> 17 ou mais
  stay(estourado, LADO.JOGADOR);
  assert(estourado.fase === FASE.JOGANDO, 'rodada deveria continuar');
  assertIgual(decidirAcao(estourado, LADO.OPONENTE), ACAO.STAY);
});

teste('IA: com baralho vazio para, mesmo com total baixo', () => {
  const jogo = rodadaComOponenteEm(5);
  jogo.baralho = [];
  assertIgual(decidirAcao(jogo, LADO.OPONENTE), ACAO.STAY);
});

teste('IA: decidir não altera o estado', () => {
  const jogo = rodadaComOponenteEm(16);
  const antes = JSON.stringify(jogo);
  decidirAcao(jogo, LADO.OPONENTE);
  assertIgual(JSON.stringify(jogo), antes);
});

teste('IA: funciona para qualquer lado (também decide pelo jogador)', () => {
  const jogo = jogoComBaralho([10, 9, 6, 7]); // jogador 16, oponente 16
  iniciarRodada(jogo);
  assertIgual(decidirAcao(jogo, LADO.JOGADOR), ACAO.HIT);
});

// ---------------------------------------------------------------------
//  Partidas completas
// ---------------------------------------------------------------------

teste('IA contra IA: 200 partidas com seeds diferentes terminam sem erro nem travar', () => {
  const vencedores = { jogador: 0, oponente: 0, ninguem: 0 };
  for (let seed = 1; seed <= 200; seed++) {
    const r = partidaIAcontraIA(seed);
    assert(r.rodadas >= 1, `seed ${seed}: nenhuma rodada jogada`);
    vencedores[r.vencedor] += 1;
  }
  assertIgual(vencedores.jogador + vencedores.oponente + vencedores.ninguem, 200);
});

teste('IA contra IA: mesma seed dá a mesma partida', () => {
  assertIgual(partidaIAcontraIA(4242), partidaIAcontraIA(4242));
});
