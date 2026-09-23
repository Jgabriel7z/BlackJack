// Testes da IA básica (sub-passo 1.2).

import { teste, assert, assertIgual } from './testador.js';
import { criarBaralho } from '../src/engine/deck.js';
import catalogoJson from '../data/trump_cards.js';
import { prepararCatalogo } from '../src/engine/trumps.js';
import {
  decidirAcao,
  decidirTrunfo,
  cartasNaoVistas,
  riscoDeEstourar,
  riscoDePerderParado,
  ameacaNaMesaDoAdversario,
  ACAO,
  LIMITE_COMPRA,
  APOSTA_CARA,
} from '../src/engine/ai.js';
import { criarJogo, iniciarRodada, hit, stay, avancarNivel, verMesa, FASE, LADO } from '../src/engine/game.js';
import { NIVEL } from '../src/engine/niveis.js';

const CATALOGO = prepararCatalogo(catalogoJson);

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

/**
 * Joga uma partida inteira IA contra IA, passando por todos os níveis.
 * Devolve o número de ações.
 */
function partidaIAcontraIA(seed, limiteDeAcoes = 2000) {
  const jogo = criarJogo({ seed });
  let acoes = 0;
  while (jogo.fase !== FASE.FIM_DE_JOGO) {
    if (jogo.fase === FASE.NIVEL_CONCLUIDO) { avancarNivel(jogo); continue; }
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
  return { acoes, rodadas: jogo.rodada, nivel: jogo.nivel, vencedor: jogo.vencedorDoJogo };
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
    assert(r.nivel >= 1 && r.nivel <= 3, `seed ${seed}: nível fora da faixa`);
    vencedores[r.vencedor] += 1;
  }
  assertIgual(vencedores.jogador + vencedores.oponente + vencedores.ninguem, 200);
});

teste('IA contra IA: mesma seed dá a mesma partida', () => {
  assertIgual(partidaIAcontraIA(4242), partidaIAcontraIA(4242));
});

// ---------------------------------------------------------------------
//  Nível 3 — a conta de risco (2.5)
// ---------------------------------------------------------------------

/** Rodada com baralho de ordem conhecida, no nível pedido, com trunfos. */
function rodadaNoNivel(nivel, ordemDeCompra = [9, 8, 5, 4]) {
  const restantes = criarBaralho().filter((c) => !ordemDeCompra.includes(c));
  const baralho = [...restantes, ...[...ordemDeCompra].reverse()];
  const jogo = criarJogo({ seed: 7, nivel, embaralhar: () => [...baralho], catalogoTrunfos: CATALOGO });
  iniciarRodada(jogo);
  jogo.jogadores[LADO.JOGADOR].trunfos = [];
  jogo.jogadores[LADO.OPONENTE].trunfos = [];
  return jogo;
}

teste('IA nível 3: só conta as cartas que ela ainda não viu (a oculta do outro entra)', () => {
  const jogo = rodadaNoNivel(NIVEL.SERRA, [9, 8, 5, 4]);
  // Do ponto de vista do oponente: ele vê a própria mão (8 e 4) e a aberta do jogador (5).
  const visao = verMesa(jogo, LADO.OPONENTE);
  const naoVistas = cartasNaoVistas(visao);
  assert(!naoVistas.includes(8) && !naoVistas.includes(4), 'ele conhece a própria mão');
  assert(!naoVistas.includes(5), 'ele viu a carta aberta do jogador');
  assert(naoVistas.includes(9), 'a carta oculta do jogador continua desconhecida para ele');
  assertIgual(naoVistas.length, 8);
});

teste('IA nível 3: risco de estourar sai da contagem de cartas', () => {
  // Com 18 e alvo 21, estouram as cartas acima de 3: o 4, o 5 e o 6, ou seja 3 de 6.
  assertIgual(riscoDeEstourar(18, 21, [1, 2, 3, 4, 5, 6]), 3 / 6);
  assertIgual(riscoDeEstourar(5, 21, [1, 2, 3]), 0, 'com total baixo não há risco');
  assertIgual(riscoDeEstourar(22, 21, [1]), 1, 'quem já estourou tem risco total');
});

teste('IA nível 3: o risco de parar leva em conta que o outro ainda compra', () => {
  // Adversário com 3 à mostra: parado ele não me passa, mas ele vai comprar até 17.
  const naoVistas = [2, 4, 6, 8, 10];
  const risco = riscoDePerderParado(16, 3, 21, naoVistas);
  assert(risco > 0.5, `esperava risco alto de perder parado em 16, veio ${risco}`);
});

teste('IA nível 3: compra quando estourar é menos provável que perder parado', () => {
  const jogo = rodadaNoNivel(NIVEL.SERRA, [9, 8, 1, 2]); // oponente com 8 + 2 = 10
  jogo.turno = LADO.OPONENTE;
  assertIgual(decidirAcao(jogo, LADO.OPONENTE), ACAO.HIT, 'com 10 ele tem de arriscar');
});

teste('IA nível 3: para quando já estourou', () => {
  const jogo = rodadaNoNivel(NIVEL.SERRA);
  jogo.turno = LADO.OPONENTE;
  jogo.jogadores[LADO.OPONENTE].abertas = [11, 11];
  assertIgual(decidirAcao(jogo, LADO.OPONENTE), ACAO.STAY);
});

teste('IA: o nível pode ser escolhido na chamada, sem mexer no jogo', () => {
  const jogo = rodadaNoNivel(NIVEL.SERRA, [9, 8, 1, 6]); // oponente com 8 + 6 = 14
  jogo.turno = LADO.OPONENTE;
  assertIgual(decidirAcao(jogo, LADO.OPONENTE, 1), ACAO.HIT, 'a regra do 17 compra com 14');
  assertIgual(jogo.nivel, NIVEL.SERRA, 'a chamada não muda o jogo');
});

// ---------------------------------------------------------------------
//  Cartas trunfo por nível (2.5)
// ---------------------------------------------------------------------

teste('IA nível 1: não usa cartas trunfo', () => {
  const jogo = rodadaNoNivel(NIVEL.GUILHOTINA);
  jogo.turno = LADO.OPONENTE;
  jogo.jogadores[LADO.OPONENTE].trunfos = ['shield', 'two_up', 'destroy'];
  jogo.jogadores[LADO.OPONENTE].aposta = 5;
  assertIgual(decidirTrunfo(jogo, LADO.OPONENTE), null);
});

teste('IA nível 2: joga Shield quando a aposta dele está cara', () => {
  const jogo = rodadaNoNivel(NIVEL.CHOQUE);
  jogo.turno = LADO.OPONENTE;
  jogo.jogadores[LADO.OPONENTE].trunfos = ['shield'];
  jogo.jogadores[LADO.OPONENTE].aposta = 1;
  assertIgual(decidirTrunfo(jogo, LADO.OPONENTE), null, 'com aposta barata ele guarda');
  jogo.jogadores[LADO.OPONENTE].aposta = APOSTA_CARA;
  assertIgual(decidirTrunfo(jogo, LADO.OPONENTE), 'shield');
});

teste('IA nível 2: joga Two-Up quando está na frente', () => {
  // Oponente 8 + 4 = 12; jogador mostra só o 5.
  const jogo = rodadaNoNivel(NIVEL.CHOQUE, [9, 8, 5, 4]);
  jogo.turno = LADO.OPONENTE;
  jogo.jogadores[LADO.OPONENTE].trunfos = ['two_up'];
  assertIgual(decidirTrunfo(jogo, LADO.OPONENTE), 'two_up');

  // Agora o jogador mostra 11 e 5: com 16 à vista ele passou o oponente, que tem 12.
  jogo.jogadores[LADO.JOGADOR].abertas = [11, 5];
  assertIgual(decidirTrunfo(jogo, LADO.OPONENTE), null);
});

teste('IA nível 3: guarda o Destroy e só usa contra carta perigosa na mesa', () => {
  const jogo = rodadaNoNivel(NIVEL.SERRA, [9, 8, 5, 4]);
  jogo.turno = LADO.OPONENTE;
  jogo.jogadores[LADO.OPONENTE].trunfos = ['destroy'];
  assert(!ameacaNaMesaDoAdversario(jogo, LADO.OPONENTE), 'mesa limpa, nenhuma ameaça');
  assertIgual(decidirTrunfo(jogo, LADO.OPONENTE), null, 'sem ameaça ele guarda a carta');

  // O jogador joga um Two-Up, que encarece a aposta do oponente.
  jogo.jogadores[LADO.JOGADOR].trunfosNaMesa.push({
    id: 'two_up',
    nome: 'Two-Up',
    efeitos: [{ type: 'bet_mod', target: 'opponent', amount: 2, persistent: true }],
    ordem: 1,
  });
  assert(ameacaNaMesaDoAdversario(jogo, LADO.OPONENTE));
  assertIgual(decidirTrunfo(jogo, LADO.OPONENTE), 'destroy');
});

teste('IA nível 3: usa Go For quando o alvo novo salva a mão dele', () => {
  const jogo = rodadaNoNivel(NIVEL.SERRA, [9, 5, 1, 11]);
  jogo.turno = LADO.OPONENTE;
  jogo.jogadores[LADO.OPONENTE].oculta = 11;
  jogo.jogadores[LADO.OPONENTE].abertas = [11]; // 22: estourou no alvo 21
  jogo.jogadores[LADO.OPONENTE].trunfos = ['go_for_24'];
  assertIgual(decidirTrunfo(jogo, LADO.OPONENTE), 'go_for_24', 'o alvo 24 tira ele do estouro');
});

teste('IA nível 3: não troca o alvo quando isso não ajuda', () => {
  const jogo = rodadaNoNivel(NIVEL.SERRA, [9, 8, 5, 4]); // oponente com 12, dentro do alvo
  jogo.turno = LADO.OPONENTE;
  jogo.jogadores[LADO.OPONENTE].trunfos = ['go_for_17'];
  assertIgual(decidirTrunfo(jogo, LADO.OPONENTE), null);
});

// ---------------------------------------------------------------------
//  A IA do nível 3 é mais difícil? (2.5)
// ---------------------------------------------------------------------

teste('IA nível 3 contra nível 1: em 1000 rodadas, estoura menos e ganha mais', () => {
  const RODADAS = 1000;

  /** Joga uma rodada com o oponente pensando no nível pedido; do outro lado, sempre o nível 1. */
  const medir = (nivelDoOponente) => {
    let vitorias = 0;
    let estouros = 0;
    for (let seed = 1; seed <= RODADAS; seed++) {
      // Sem cartas trunfo: assim o que muda é só a decisão de comprar ou parar.
      const jogo = criarJogo({ seed });
      iniciarRodada(jogo);
      while (jogo.fase === FASE.JOGANDO) {
        const lado = jogo.turno;
        const nivel = lado === LADO.OPONENTE ? nivelDoOponente : 1;
        if (decidirAcao(jogo, lado, nivel) === ACAO.HIT) hit(jogo, lado);
        else stay(jogo, lado);
      }
      if (jogo.ultimaRodada.vencedor === LADO.OPONENTE) vitorias++;
      if (jogo.ultimaRodada.estourou.oponente) estouros++;
    }
    return { vitorias, estouros };
  };

  const facil = medir(1);
  const dificil = medir(3);

  assert(
    dificil.estouros < facil.estouros * 0.75,
    `o nível 3 deveria estourar bem menos: ${dificil.estouros} contra ${facil.estouros}`,
  );
  assert(
    dificil.vitorias > facil.vitorias,
    `o nível 3 deveria vencer mais: ${dificil.vitorias} contra ${facil.vitorias}`,
  );
});
