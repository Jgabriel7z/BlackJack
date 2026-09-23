// Testes de quando o Kaio abre a boca (ajuste depois de jogar).
// A escolha é pura e presa ao gerador com seed, então dá para testar no
// terminal: a mesma partida tem de dar sempre os mesmos comentários.

import { teste, assert, assertIgual } from './testador.js';
import {
  criarAnfitriao,
  comentar,
  comentarSobre,
  escolherSituacao,
  SITUACOES_POR_INTERESSE,
  CHANCE_DE_COMENTAR,
} from '../src/engine/anfitriao.js';
import { criarRng } from '../src/engine/rng.js';
import { FALAS_DO_ANFITRIAO } from '../src/config.js';

/** Um anfitrião que sempre resolve falar, para testar o resto. */
const sempreFala = () => criarAnfitriao(() => 0);
/** Um que nunca resolve falar. */
const nuncaFala = () => criarAnfitriao(() => 1);

// ---------------------------------------------------------------------
//  As falas
// ---------------------------------------------------------------------

teste('anfitrião: toda situação da lista tem fala escrita', () => {
  const vazias = SITUACOES_POR_INTERESSE.filter(
    (s) => !FALAS_DO_ANFITRIAO[s] || FALAS_DO_ANFITRIAO[s].length === 0,
  );
  assertIgual(vazias, [], `situações sem fala: ${vazias.join(', ')}`);
});

teste('anfitrião: nenhuma fala descreve ferida, sangue ou corte', () => {
  // A regra do grupo continua valendo: ele é cruel de boca, mas o jogo
  // não mostra nem descreve mutilação.
  const proibidas = ['sangue', 'sangra', 'ferida', 'corta', 'cortad', 'decepa', 'mutil', 'carne', 'osso'];
  const problemas = [];
  for (const [situacao, falas] of Object.entries(FALAS_DO_ANFITRIAO)) {
    for (const fala of falas) {
      const minuscula = fala.toLowerCase();
      for (const palavra of proibidas) {
        if (minuscula.includes(palavra)) problemas.push(`${situacao}: ${fala}`);
      }
    }
  }
  assertIgual(problemas, [], `falas fora da regra: ${problemas.join(' | ')}`);
});

teste('anfitrião: nenhuma fala repetida entre as situações', () => {
  const todas = Object.values(FALAS_DO_ANFITRIAO).flat();
  assertIgual(todas.length, new Set(todas).size, 'tem fala duplicada no config');
});

// ---------------------------------------------------------------------
//  A escolha da situação
// ---------------------------------------------------------------------

teste('anfitrião: entre várias situações, fala da mais interessante', () => {
  assertIgual(
    escolherSituacao(['jogadorVenceuRodada', 'jogadorEstourou', 'apostaAlta']),
    'jogadorEstourou',
  );
  assertIgual(
    escolherSituacao(['jogadorPerdeuRodada', 'jogadorQuaseMorto']),
    'jogadorQuaseMorto',
    'estar a um passo do fim vem antes de tudo',
  );
});

teste('anfitrião: situação desconhecida ou lista vazia não quebra', () => {
  assertIgual(escolherSituacao([]), null);
  assertIgual(escolherSituacao(['coisa_que_nao_existe']), null);
  assertIgual(comentar(sempreFala(), null, 1), null);
  assertIgual(comentar(sempreFala(), 'coisa_que_nao_existe', 1), null);
});

// ---------------------------------------------------------------------
//  O ritmo
// ---------------------------------------------------------------------

teste('anfitrião: no máximo uma fala por rodada', () => {
  const kaio = sempreFala();
  assert(comentar(kaio, 'jogadorEstourou', 3) !== null, 'a primeira sai');
  assertIgual(comentar(kaio, 'empate', 3), null, 'a segunda, na mesma rodada, não');
  assert(comentar(kaio, 'empate', 4) !== null, 'na rodada seguinte volta a falar');
});

teste('anfitrião: às vezes ele fica calado', () => {
  assertIgual(comentar(nuncaFala(), 'jogadorEstourou', 1), null);
  assert(CHANCE_DE_COMENTAR < 1, 'a chance tem de deixar espaço para o silêncio');
});

teste('anfitrião: não repete fala enquanto houver outra guardada', () => {
  const kaio = sempreFala();
  const banco = FALAS_DO_ANFITRIAO.jogadorEstourou;
  const ditas = [];
  for (let rodada = 1; rodada <= banco.length; rodada++) {
    ditas.push(comentar(kaio, 'jogadorEstourou', rodada));
  }
  assertIgual(ditas.length, new Set(ditas).size, `repetiu: ${ditas.join(' | ')}`);
  assertIgual(new Set(ditas).size, banco.length, 'usou o banco inteiro antes de repetir');
});

teste('anfitrião: esgotado o banco, ele recomeça em vez de emudecer', () => {
  const kaio = sempreFala();
  const banco = FALAS_DO_ANFITRIAO.empate;
  for (let rodada = 1; rodada <= banco.length; rodada++) comentar(kaio, 'empate', rodada);
  const depois = comentar(kaio, 'empate', banco.length + 1);
  assert(depois !== null, 'ele volta a falar');
  assert(banco.includes(depois));
});

teste('anfitrião: falas de situações diferentes não travam umas às outras', () => {
  const kaio = sempreFala();
  const banco = FALAS_DO_ANFITRIAO.jogadorEstourou;
  for (let rodada = 1; rodada <= banco.length; rodada++) comentar(kaio, 'jogadorEstourou', rodada);
  const outra = comentar(kaio, 'alvoExato', 99);
  assert(FALAS_DO_ANFITRIAO.alvoExato.includes(outra), `disse: ${outra}`);
});

// ---------------------------------------------------------------------
//  Preso à seed
// ---------------------------------------------------------------------

teste('anfitrião: a mesma seed dá sempre os mesmos comentários', () => {
  const rodar = () => {
    const kaio = criarAnfitriao(criarRng(4242));
    const ditas = [];
    for (let rodada = 1; rodada <= 12; rodada++) {
      ditas.push(comentarSobre(kaio, ['jogadorPerdeuRodada', 'apostaAlta'], rodada));
    }
    return ditas;
  };
  assertIgual(rodar(), rodar());
});

teste('anfitrião: seeds diferentes dão conversas diferentes', () => {
  const rodar = (seed) => {
    const kaio = criarAnfitriao(criarRng(seed));
    const ditas = [];
    for (let rodada = 1; rodada <= 15; rodada++) {
      ditas.push(comentarSobre(kaio, ['jogadorPerdeuRodada'], rodada));
    }
    return ditas.join('|');
  };
  assert(rodar(1) !== rodar(2), 'duas partidas não podem ter a mesma conversa');
});

teste('anfitrião: numa partida longa ele fala bastante, mas não sempre', () => {
  const kaio = criarAnfitriao(criarRng(7));
  let falou = 0;
  const rodadas = 60;
  for (let rodada = 1; rodada <= rodadas; rodada++) {
    if (comentarSobre(kaio, ['jogadorVenceuRodada', 'apostaAlta'], rodada)) falou += 1;
  }
  assert(falou > rodadas * 0.5, `falou só ${falou} de ${rodadas}`);
  assert(falou < rodadas, 'e não falou em todas');
});
