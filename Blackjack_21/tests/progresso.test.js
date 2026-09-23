// Testes do que sobrevive a fechar o jogo (sub-passo 4.1): estatísticas
// da parte C3, recompensas da tabela A5, e o guarda-volumes aguentando
// um localStorage quebrado. Nada de navegador: o depósito é de mentira.

import { teste, assert, assertIgual } from './testador.js';
import {
  criarProgresso,
  normalizar,
  anotarRodada,
  anotarPartida,
  anotarTrunfoUsado,
  anotarTrunfoRemovido,
  conferirRecompensas,
  cartasSorteaveis,
  cartasDoSorteio,
  vagasAMaisNaMao,
  RECOMPENSAS,
  VERSAO,
} from '../src/engine/progresso.js';
import { criarArmazenamento } from '../src/ui/armazenamento.js';

/** Depósito de mentira, com a mesma cara do localStorage. */
function depositoFalso(inicial = {}) {
  const dados = { ...inicial };
  return {
    getItem: (c) => (c in dados ? dados[c] : null),
    setItem: (c, v) => { dados[c] = String(v); },
    removeItem: (c) => { delete dados[c]; },
    _dados: dados,
  };
}

/** Depósito que explode em tudo, como numa janela anônima bloqueada. */
function depositoQuebrado() {
  const explodir = () => { throw new Error('acesso negado'); };
  return { getItem: explodir, setItem: explodir, removeItem: explodir };
}

const idsDesbloqueados = (p) => [...p.desbloqueios].sort();

// ---------------------------------------------------------------------
//  Estatísticas (parte C3)
// ---------------------------------------------------------------------

teste('progresso: começa zerado e sem nada desbloqueado', () => {
  const p = criarProgresso();
  assertIgual(p.versao, VERSAO);
  assertIgual(p.recorde, { melhor: 0, partidas: 0 });
  assertIgual(p.desbloqueios, []);
  assertIgual(p.estatisticas.oponentesDerrotados, 0);
  assertIgual(p.estatisticas.cabecoesDerrotados, 0);
});

teste('progresso: conta trunfos usados e trunfos do inimigo removidos', () => {
  const p = criarProgresso();
  anotarTrunfoUsado(p);
  anotarTrunfoUsado(p);
  anotarTrunfoRemovido(p);
  assertIgual(p.estatisticas.trunfosUsados, 2);
  assertIgual(p.estatisticas.trunfosNaRodada, 2);
  assertIgual(p.estatisticas.trunfosDoInimigoRemovidos, 1);
});

teste('progresso: o contador de trunfos da rodada zera quando ela acaba', () => {
  const p = criarProgresso();
  anotarTrunfoUsado(p);
  anotarRodada(p, { total: 20, alvo: 21 });
  assertIgual(p.estatisticas.trunfosNaRodada, 0);
  assertIgual(p.estatisticas.trunfosUsados, 1, 'o total não zera');
});

teste('progresso: fechar no alvo conta, e errar quebra a sequência', () => {
  const p = criarProgresso();
  anotarRodada(p, { total: 21, alvo: 21 });
  anotarRodada(p, { total: 21, alvo: 21 });
  assertIgual(p.estatisticas.alvosExatos, 2);
  assertIgual(p.estatisticas.sequenciaDeAlvosExatos, 2);
  anotarRodada(p, { total: 19, alvo: 21 });
  assertIgual(p.estatisticas.alvosExatos, 2, 'o total não desce');
  assertIgual(p.estatisticas.sequenciaDeAlvosExatos, 0, 'a sequência sim');
});

teste('progresso: o alvo da mesa vale, mesmo quando não é 21', () => {
  const p = criarProgresso();
  anotarRodada(p, { total: 24, alvo: 24 });   // depois de uma carta Go For 24
  assertIgual(p.estatisticas.alvosExatos, 1);
});

teste('progresso: a sequência sem tortura só conta vitórias limpas e seguidas', () => {
  const p = criarProgresso();
  anotarPartida(p, { venceu: true, semTortura: true });
  assertIgual(p.estatisticas.sequenciaSemTortura, 1);
  anotarPartida(p, { venceu: true, semTortura: false });
  assertIgual(p.estatisticas.sequenciaSemTortura, 0, 'apanhar quebra a sequência');
  anotarPartida(p, { venceu: true, semTortura: true });
  anotarPartida(p, { venceu: false, semTortura: true });
  assertIgual(p.estatisticas.sequenciaSemTortura, 0, 'perder também');
  assertIgual(p.estatisticas.oponentesDerrotados, 3);
  assertIgual(p.estatisticas.partidasJogadas, 4);
});

teste('progresso: o recorde é o mesmo objeto que o score.js já mexia', () => {
  // Quem sobe o recorde continua sendo `atualizarRecorde` do score.js;
  // aqui ele só pega carona para ser salvo e conferido na volta.
  const p = criarProgresso();
  p.recorde.melhor = 300;
  p.recorde.partidas = 4;
  const voltou = normalizar(JSON.parse(JSON.stringify(p)));
  assertIgual(voltou.recorde, { melhor: 300, partidas: 4 });
});

// ---------------------------------------------------------------------
//  Recompensas (tabela A5)
// ---------------------------------------------------------------------

teste('progresso: as quatro recompensas possíveis hoje estão listadas', () => {
  assertIgual(RECOMPENSAS.map((r) => r.id).sort(),
    ['go_for_24', 'go_for_27', 'trunfo_inicial_alvos', 'trunfo_inicial_estourado']);
});

teste('progresso: Go For 24 sai depois de vencer 5 partidas', () => {
  const p = criarProgresso();
  for (let i = 0; i < 4; i++) anotarPartida(p, { venceu: true });
  assert(!p.desbloqueios.includes('go_for_24'), `4 vitórias ainda não bastam (${idsDesbloqueados(p)})`);
  const novas = anotarPartida(p, { venceu: true });
  assert(p.desbloqueios.includes('go_for_24'));
  assert(novas.some((r) => r.id === 'go_for_24'), 'a recompensa nova é anunciada');
});

teste('progresso: Go For 27 sai com três alvos exatos seguidos', () => {
  const p = criarProgresso();
  anotarRodada(p, { total: 21, alvo: 21 });
  anotarRodada(p, { total: 19, alvo: 21 });
  anotarRodada(p, { total: 21, alvo: 21 });
  anotarRodada(p, { total: 21, alvo: 21 });
  assert(!p.desbloqueios.includes('go_for_27'), 'a sequência foi quebrada no meio');
  const novas = anotarRodada(p, { total: 21, alvo: 21 });
  assert(novas.some((r) => r.id === 'go_for_27'));
});

teste('progresso: três alvos exatos no total dão uma vaga a mais na mão', () => {
  const p = criarProgresso();
  for (let i = 0; i < 2; i++) {
    anotarRodada(p, { total: 21, alvo: 21 });
    anotarRodada(p, { total: 15, alvo: 21 });   // quebra a sequência de propósito
  }
  assertIgual(vagasAMaisNaMao(p), 0);
  anotarRodada(p, { total: 21, alvo: 21 });
  assert(p.desbloqueios.includes('trunfo_inicial_alvos'));
  assertIgual(vagasAMaisNaMao(p), 1);
});

teste('progresso: vencer tendo estourado dá outra vaga a mais na mão', () => {
  const p = criarProgresso();
  anotarPartida(p, { venceu: false, estourouAlgumaVez: true });
  assertIgual(vagasAMaisNaMao(p), 0, 'perder não vale');
  anotarPartida(p, { venceu: true, estourouAlgumaVez: false });
  assertIgual(vagasAMaisNaMao(p), 0, 'vencer sem estourar também não');
  anotarPartida(p, { venceu: true, estourouAlgumaVez: true });
  assert(p.desbloqueios.includes('trunfo_inicial_estourado'));
  assertIgual(vagasAMaisNaMao(p), 1);
});

teste('progresso: as duas recompensas de vaga se somam', () => {
  const p = criarProgresso();
  for (let i = 0; i < 3; i++) anotarRodada(p, { total: 21, alvo: 21 });
  anotarPartida(p, { venceu: true, estourouAlgumaVez: true });
  assertIgual(vagasAMaisNaMao(p), 2);
});

// ---------------------------------------------------------------------
//  O modê difícil: tudo liberado, nenhum bônus
// ---------------------------------------------------------------------

teste('difícil: o monte entra inteiro, mesmo sem ter desbloqueado nada', () => {
  const todas = ['one_up', 'shield', 'go_for_24', 'go_for_27'];
  const normal = criarProgresso();
  const dificil = criarProgresso();
  dificil.opcoes.dificil = true;

  assertIgual(cartasDoSorteio(normal, todas), ['one_up', 'shield'], 'no normal as premiadas ficam presas');
  assertIgual(cartasDoSorteio(dificil, todas), todas, 'no difícil sai tudo');
});

teste('difícil: nenhuma recompensa vale, nem as já ganhas', () => {
  const p = criarProgresso();
  for (let i = 0; i < 3; i++) anotarRodada(p, { total: 21, alvo: 21 });
  anotarPartida(p, { venceu: true, estourouAlgumaVez: true });
  assertIgual(vagasAMaisNaMao(p), 2, 'no normal as duas contam');

  p.opcoes.dificil = true;
  assertIgual(vagasAMaisNaMao(p), 0, 'no difícil não conta nenhuma');
});

teste('difícil: as recompensas continuam guardadas para quando ele voltar ao normal', () => {
  const p = criarProgresso();
  p.opcoes.dificil = true;
  for (let i = 0; i < 5; i++) anotarPartida(p, { venceu: true });
  assert(p.desbloqueios.includes('go_for_24'), 'ganhar no difícil ainda desbloqueia');
  p.opcoes.dificil = false;
  assert(cartasDoSorteio(p, ['go_for_24']).includes('go_for_24'));
});

teste('progresso: recompensa nenhuma dá carta a mais por rodada', () => {
  // O grupo fechou a entrada em uma carta por rodada; a recompensa da
  // tabela A5 que dava outra virou vaga na mão justamente para não
  // furar essa regra.
  const daCartaPorRodada = RECOMPENSAS.filter((r) => r.tipo === 'trunfo_inicial');
  assertIgual(daCartaPorRodada, []);
});

teste('progresso: uma recompensa só é anunciada uma vez', () => {
  const p = criarProgresso();
  for (let i = 0; i < 5; i++) anotarPartida(p, { venceu: true });
  const denovo = anotarPartida(p, { venceu: true });
  assertIgual(denovo.filter((r) => r.id === 'go_for_24').length, 0);
  assertIgual(p.desbloqueios.filter((id) => id === 'go_for_24').length, 1);
});

teste('progresso: as cartas presas ficam fora do sorteio até serem ganhas', () => {
  const p = criarProgresso();
  const todas = ['one_up', 'shield', 'go_for_24', 'go_for_27'];
  assertIgual(cartasSorteaveis(p, todas), ['one_up', 'shield']);

  for (let i = 0; i < 5; i++) anotarPartida(p, { venceu: true });
  assertIgual(cartasSorteaveis(p, todas), ['one_up', 'shield', 'go_for_24']);
});

teste('progresso: conferir recompensas não inventa nada sem motivo', () => {
  const p = criarProgresso();
  assertIgual(conferirRecompensas(p), []);
  assertIgual(p.desbloqueios, []);
});

// ---------------------------------------------------------------------
//  Dados vindos de fora
// ---------------------------------------------------------------------

teste('progresso: lixo no lugar dos dados vira um progresso zerado', () => {
  for (const lixo of [null, undefined, 42, 'texto', [], { versao: 999 }]) {
    assertIgual(normalizar(lixo), criarProgresso(), `entrada: ${JSON.stringify(lixo)}`);
  }
});

teste('progresso: dados bons atravessam inteiros', () => {
  const p = criarProgresso();
  p.recorde.melhor = 900;
  for (let i = 0; i < 5; i++) anotarPartida(p, { venceu: true });
  p.placar.entradas = [{ iniciais: 'JOA', pontos: 900, nivel: 3, venceu: true }];

  const voltou = normalizar(JSON.parse(JSON.stringify(p)));
  assertIgual(voltou.recorde.melhor, 900);
  assertIgual(voltou.placar.entradas, p.placar.entradas);
  assertIgual(voltou.estatisticas.oponentesDerrotados, 5);
  assert(voltou.desbloqueios.includes('go_for_24'));
});

teste('progresso: campos mexidos à mão são consertados, não aceitos', () => {
  const voltou = normalizar({
    versao: VERSAO,
    recorde: { melhor: -50, partidas: 'muitas' },
    placar: { entradas: [
      { iniciais: 'joão gabriel', pontos: 300, nivel: 9 },
      { iniciais: 'XYZ', pontos: -10 },
      'isto não é uma entrada',
      { iniciais: 'ABC', pontos: 800, venceu: true },
    ] },
    estatisticas: { oponentesDerrotados: 3.7, trunfosUsados: -1, inventada: 99 },
    desbloqueios: ['go_for_24', 'go_for_24', 'carta_que_nao_existe'],
  });

  assertIgual(voltou.recorde, { melhor: 0, partidas: 0 }, 'número negativo e texto viram zero');
  assertIgual(voltou.placar.entradas.map((e) => e.iniciais), ['ABC', 'JOO'], 'em ordem, com as iniciais consertadas e sem as inválidas');
  assertIgual(voltou.estatisticas.oponentesDerrotados, 3, 'quebrado vira inteiro');
  assertIgual(voltou.estatisticas.trunfosUsados, 0, 'negativo vira zero');
  assertIgual(voltou.estatisticas.inventada, undefined, 'campo inventado não entra');
  assertIgual(voltou.desbloqueios, ['go_for_24'], 'sem repetido e sem id desconhecido');
});

teste('progresso: a lista guardada nunca passa de cinco', () => {
  const entradas = [];
  for (let i = 0; i < 20; i++) entradas.push({ iniciais: 'AAA', pontos: 100 + i });
  const voltou = normalizar({ versao: VERSAO, placar: { entradas } });
  assertIgual(voltou.placar.entradas.length, 5);
  assertIgual(voltou.placar.entradas[0].pontos, 119, 'ficam as maiores, em ordem');
});

// ---------------------------------------------------------------------
//  O guarda-volumes
// ---------------------------------------------------------------------

teste('armazenamento: guarda e devolve o que foi guardado', () => {
  const deposito = depositoFalso();
  const guarda = criarArmazenamento('teste', deposito);
  assertIgual(guarda.carregar(), null, 'começa vazio');
  assert(guarda.salvar({ versao: VERSAO, oi: 1 }));
  assertIgual(guarda.carregar(), { versao: VERSAO, oi: 1 });
  assert(guarda.disponivel);
});

teste('armazenamento: apagar limpa só a chave do jogo', () => {
  const deposito = depositoFalso({ outraCoisa: 'fica' });
  const guarda = criarArmazenamento('teste', deposito);
  guarda.salvar({ a: 1 });
  assert(guarda.apagar());
  assertIgual(guarda.carregar(), null);
  assertIgual(deposito._dados.outraCoisa, 'fica');
});

teste('armazenamento: depósito que explode não derruba nada', () => {
  const guarda = criarArmazenamento('teste', depositoQuebrado());
  assertIgual(guarda.carregar(), null, 'devolve null em vez de lançar');
  assertIgual(guarda.salvar({ a: 1 }), false);
  assertIgual(guarda.apagar(), false);
  assert(!guarda.disponivel, 'o jogo fica sabendo que não dá para salvar');
  assert(guarda.motivo.includes('acesso negado'), `motivo: ${guarda.motivo}`);
});

teste('armazenamento: texto corrompido não derruba nada', () => {
  const deposito = depositoFalso({ teste: '{isto não é json' });
  const guarda = criarArmazenamento('teste', deposito);
  assertIgual(guarda.carregar(), null);
  assert(!guarda.disponivel);
});

teste('armazenamento: o jogo continua de pé com o depósito quebrado', () => {
  // É o caminho completo: não deu para carregar, então começa zerado, e
  // o que for jogado continua valendo na memória.
  const guarda = criarArmazenamento('teste', depositoQuebrado());
  const progresso = normalizar(guarda.carregar());
  progresso.recorde.melhor = 500;
  anotarPartida(progresso, { venceu: true });
  guarda.salvar(progresso);
  assertIgual(progresso.recorde.melhor, 500, 'a partida em andamento não perde nada');
  assertIgual(progresso.estatisticas.oponentesDerrotados, 1);
});
