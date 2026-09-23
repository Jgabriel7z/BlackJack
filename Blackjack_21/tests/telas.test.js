// Testes da máquina de telas (sub-passo 3.1).
// Tudo com relógio de mentira: nenhum navegador envolvido.

import { teste, assert, assertIgual } from './testador.js';
import { criarTelas, saiSozinha, TELA } from '../src/ui/telas.js';
import { TEMPOS_DE_TELA } from '../src/config.js';

/** Avança o relógio em passos de `passo` ms, até `ate`, anotando as trocas. */
function rodarRelogio(telas, ate, passo = 100, inicio = 0) {
  const visitadas = [];
  for (let agora = inicio; agora <= ate; agora += passo) {
    const antes = telas.atual;
    telas.atualizar(agora);
    if (telas.atual !== antes) visitadas.push({ tela: telas.atual, agora });
  }
  return visitadas;
}

// ---------------------------------------------------------------------
//  Estado inicial
// ---------------------------------------------------------------------

teste('telas: o jogo começa no título', () => {
  assertIgual(criarTelas().atual, TELA.TITULO);
});

teste('telas: dá para começar em outra tela (para captura e depuração)', () => {
  assertIgual(criarTelas({ inicial: TELA.JOGANDO }).atual, TELA.JOGANDO);
});

teste('telas: só a tela de jogo não sai sozinha', () => {
  assert(saiSozinha(TELA.TITULO));
  assert(saiSozinha(TELA.ATTRACT));
  assert(saiSozinha(TELA.HIGH_SCORES));
  assert(saiSozinha(TELA.GAME_OVER));
  assert(saiSozinha(TELA.INICIAIS), 'mesmo digitando, a máquina não pode travar');
  assert(!saiSozinha(TELA.JOGANDO), 'a tela de jogo só sai quando a partida acaba');
});

// ---------------------------------------------------------------------
//  O laço sozinho, sem ninguém mexer
// ---------------------------------------------------------------------

teste('telas: sem ninguém mexer, o laço é título → attract → pontuações → título', () => {
  const telas = criarTelas();
  const visitadas = rodarRelogio(telas, 60_000).map((v) => v.tela);
  assertIgual(visitadas.slice(0, 4), [TELA.ATTRACT, TELA.HIGH_SCORES, TELA.TITULO, TELA.ATTRACT]);
});

teste('telas: cada tela espera o tempo do config antes de trocar', () => {
  const telas = criarTelas();
  const visitadas = rodarRelogio(telas, 60_000);
  const [attract, pontuacoes, titulo] = visitadas;
  // Passo de 100 ms: a troca cai no primeiro múltiplo de 100 depois do tempo.
  assert(Math.abs(attract.agora - TEMPOS_DE_TELA.titulo) < 100, `attract em ${attract.agora}`);
  assert(Math.abs(pontuacoes.agora - (TEMPOS_DE_TELA.titulo + TEMPOS_DE_TELA.attract)) < 100);
  assert(Math.abs(titulo.agora - (TEMPOS_DE_TELA.titulo + TEMPOS_DE_TELA.attract + TEMPOS_DE_TELA.highScores)) < 100);
});

teste('telas: nenhuma tela trava — em 10 minutos o laço fecha várias voltas', () => {
  const telas = criarTelas();
  const visitadas = rodarRelogio(telas, 600_000).map((v) => v.tela);

  const voltasAoTitulo = visitadas.filter((t) => t === TELA.TITULO).length;
  assert(voltasAoTitulo >= 10, `o laço deveria fechar muitas voltas, fechou ${voltasAoTitulo}`);

  // Nenhuma tela do laço pode sumir da lista, e a de jogo nunca entra sozinha.
  for (const tela of [TELA.TITULO, TELA.ATTRACT, TELA.HIGH_SCORES]) {
    assert(visitadas.includes(tela), `a tela ${tela} nunca apareceu`);
  }
  assert(!visitadas.includes(TELA.JOGANDO), 'a tela de jogo não deveria entrar sozinha');
});

teste('telas: nenhuma tela fica mais que o tempo dela', () => {
  const telas = criarTelas();
  let entrouEm = 0;
  let anterior = telas.atual;
  for (let agora = 0; agora <= 300_000; agora += 50) {
    telas.atualizar(agora);
    if (telas.atual !== anterior) {
      const limite = criarTelas({ inicial: anterior }).duracaoDaTelaAtual();
      const ficou = agora - entrouEm;
      assert(ficou <= limite + 50, `${anterior} ficou ${ficou} ms, o limite é ${limite}`);
      anterior = telas.atual;
      entrouEm = agora;
    }
  }
});

// ---------------------------------------------------------------------
//  Interação
// ---------------------------------------------------------------------

teste('telas: mexer no título começa o jogo', () => {
  const telas = criarTelas();
  assert(telas.interagir(1000));
  assertIgual(telas.atual, TELA.JOGANDO);
});

teste('telas: mexer no attract ou nas pontuações volta ao título', () => {
  for (const tela of [TELA.ATTRACT, TELA.HIGH_SCORES]) {
    const telas = criarTelas({ inicial: tela });
    telas.interagir(500);
    assertIgual(telas.atual, TELA.TITULO);
  }
});

teste('telas: mexer durante o jogo não troca de tela', () => {
  const telas = criarTelas({ inicial: TELA.JOGANDO });
  assertIgual(telas.interagir(1000), false);
  assertIgual(telas.atual, TELA.JOGANDO);
});

teste('telas: a tela de jogo não sai com o tempo, só quando a partida acaba', () => {
  const telas = criarTelas({ inicial: TELA.JOGANDO });
  rodarRelogio(telas, 600_000);
  assertIgual(telas.atual, TELA.JOGANDO, 'ficou jogando o tempo todo');
  telas.fimDePartida(600_000);
  assertIgual(telas.atual, TELA.GAME_OVER);
});

teste('telas: o fim de jogo volta ao título sozinho, ou antes se alguém mexer', () => {
  const sozinho = criarTelas({ inicial: TELA.GAME_OVER });
  rodarRelogio(sozinho, TEMPOS_DE_TELA.gameOver + 200);
  assertIgual(sozinho.atual, TELA.TITULO);

  const comTecla = criarTelas({ inicial: TELA.GAME_OVER });
  comTecla.atualizar(300);
  comTecla.interagir(300);
  assertIgual(comTecla.atual, TELA.TITULO, 'a tecla corta a espera');
});

// ---------------------------------------------------------------------
//  Tempo e avisos
// ---------------------------------------------------------------------

teste('telas: o fator de tempo encurta a espera (?rapido=1)', () => {
  const telas = criarTelas({ fatorTempo: 0.05 });
  assertIgual(telas.duracaoDaTelaAtual(), TEMPOS_DE_TELA.titulo * 0.05);
  telas.atualizar(0);   // primeiro quadro: o relógio da tela começa aqui
  telas.atualizar(TEMPOS_DE_TELA.titulo * 0.05);
  assertIgual(telas.atual, TELA.ATTRACT);
});

teste('telas: avisa cada troca, dizendo de onde veio', () => {
  const trocas = [];
  const telas = criarTelas({ aoTrocar: (nova, anterior) => trocas.push(`${anterior}->${nova}`) });
  telas.interagir(100);
  telas.fimDePartida(200);
  telas.interagir(300);
  assertIgual(trocas, ['titulo->jogando', 'jogando->game_over', 'game_over->titulo']);
});

teste('telas: o relógio da primeira tela começa no primeiro quadro, não no zero', () => {
  // No navegador o relógio já vale centenas de ms quando a página carrega.
  const telas = criarTelas();
  telas.atualizar(4000);                       // primeiro quadro, bem depois do zero
  assertIgual(telas.tempoNaTela(4000), 0, 'a tela acabou de entrar');
  assertIgual(telas.atual, TELA.TITULO, 'não pode trocar já no primeiro quadro');

  telas.atualizar(4000 + TEMPOS_DE_TELA.titulo - 1);
  assertIgual(telas.atual, TELA.TITULO, 'ainda dentro do tempo');
  telas.atualizar(4000 + TEMPOS_DE_TELA.titulo);
  assertIgual(telas.atual, TELA.ATTRACT, 'a espera contou a partir do primeiro quadro');
});

teste('telas: ir para a tela em que já está não conta como troca', () => {
  let trocas = 0;
  const telas = criarTelas({ aoTrocar: () => { trocas += 1; } });
  telas.ir(TELA.TITULO, 500);
  assertIgual(trocas, 0);
  assertIgual(telas.desde, 0, 'o relógio da tela não reinicia à toa');
});

// ---------------------------------------------------------------------
//  Desvio pelas iniciais (3.4)
// ---------------------------------------------------------------------

teste('telas: entrando nas cinco melhores, o fim de jogo leva a digitar as iniciais', () => {
  const telas = criarTelas({ inicial: TELA.JOGANDO });
  telas.fimDePartida(1000, { paraIniciais: true });
  assertIgual(telas.atual, TELA.GAME_OVER);
  rodarRelogio(telas, 1000 + TEMPOS_DE_TELA.gameOver + 200, 100, 1000);
  assertIgual(telas.atual, TELA.INICIAIS);
});

teste('telas: sem entrar na lista, o fim de jogo volta ao título como antes', () => {
  const telas = criarTelas({ inicial: TELA.JOGANDO });
  telas.fimDePartida(1000);
  rodarRelogio(telas, 1000 + TEMPOS_DE_TELA.gameOver + 200, 100, 1000);
  assertIgual(telas.atual, TELA.TITULO);
});

teste('telas: a tecla que corta o fim de jogo leva ao mesmo destino da espera', () => {
  const telas = criarTelas({ inicial: TELA.JOGANDO });
  telas.fimDePartida(1000, { paraIniciais: true });
  telas.interagir(1200);
  assertIgual(telas.atual, TELA.INICIAIS, 'quem se apressa não perde a vez de assinar');
});

teste('telas: o desvio vale só para a partida que acabou de terminar', () => {
  const telas = criarTelas({ inicial: TELA.JOGANDO });
  telas.fimDePartida(1000, { paraIniciais: true });
  telas.interagir(1100);                       // vai para as iniciais
  telas.ir(TELA.JOGANDO, 2000);                // outra partida
  telas.fimDePartida(3000);                    // desta vez não pontuou
  telas.interagir(3100);
  assertIgual(telas.atual, TELA.TITULO);
});

teste('telas: digitar as iniciais não é "mexer": a tela não sai com tecla', () => {
  const telas = criarTelas({ inicial: TELA.INICIAIS });
  assertIgual(telas.interagir(500), false, 'as teclas ali são as letras do nome');
  assertIgual(telas.atual, TELA.INICIAIS);
});

teste('telas: quem sai para tomar um café não trava a máquina nas iniciais', () => {
  const telas = criarTelas({ inicial: TELA.INICIAIS });
  rodarRelogio(telas, TEMPOS_DE_TELA.iniciais + 200);
  assertIgual(telas.atual, TELA.HIGH_SCORES);
});

teste('telas: o ?rapido=1 não encurta o tempo de digitar as iniciais', () => {
  const telas = criarTelas({ inicial: TELA.INICIAIS, fatorTempo: 0.05 });
  assertIgual(telas.duracaoDaTelaAtual(), TEMPOS_DE_TELA.iniciais);
  const rapida = criarTelas({ inicial: TELA.GAME_OVER, fatorTempo: 0.05 });
  assertIgual(rapida.duracaoDaTelaAtual(), TEMPOS_DE_TELA.gameOver * 0.05, 'as outras continuam encurtadas');
});
