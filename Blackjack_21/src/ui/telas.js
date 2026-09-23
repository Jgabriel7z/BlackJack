// =====================================================================
//  ui/telas.js — em que tela o jogo está  (sub-passo 3.1)
//
//  O laço de fliperama do plano:
//
//    TÍTULO ──(tecla/clique)──► JOGANDO ──(fim)──► FIM DE JOGO
//      │                                                │
//      │ 15 s parado                        5 s ou tecla│
//      ▼                                                │
//    ATTRACT ──20 s──► MELHORES PONTUAÇÕES ──8 s──► TÍTULO ◄┘
//      └──────────── qualquer tecla ou clique ──────────┘
//
//  Desvio do 3.4: se a pontuação entrou nas cinco melhores, o fim de
//  jogo não volta ao título — passa pela tela de digitar as iniciais e
//  de lá para as melhores pontuações. Quem decide é quem chama
//  `fimDePartida`, que conhece a pontuação; aqui só se guarda a saída.
//
//  Só o relógio e as interações mandam aqui: este arquivo não desenha
//  nada e não conhece DOM, então dá para testá-lo no terminal passando
//  um relógio de mentira.
// =====================================================================

import { TEMPOS_DE_TELA } from '../config.js';

export const TELA = Object.freeze({
  TITULO: 'titulo',
  JOGANDO: 'jogando',
  GAME_OVER: 'game_over',
  INICIAIS: 'iniciais',
  ATTRACT: 'attract',
  HIGH_SCORES: 'high_scores',
});

/**
 * Para onde cada tela vai sozinha quando o tempo acaba, e qual tempo do
 * config usar. JOGANDO não está aqui: ela só sai quando a partida termina.
 */
const POR_TEMPO = Object.freeze({
  [TELA.TITULO]: { proxima: TELA.ATTRACT, tempo: 'titulo' },
  [TELA.ATTRACT]: { proxima: TELA.HIGH_SCORES, tempo: 'attract' },
  [TELA.HIGH_SCORES]: { proxima: TELA.TITULO, tempo: 'highScores' },
  [TELA.GAME_OVER]: { proxima: TELA.TITULO, tempo: 'gameOver' },
  // Ninguém fica preso digitando: passado o tempo, vale o que estiver escrito.
  [TELA.INICIAIS]: { proxima: TELA.HIGH_SCORES, tempo: 'iniciais' },
});

/** Para onde cada tela vai quando alguém mexe (tecla ou clique). */
// A de digitar as iniciais não está aqui de propósito: lá as teclas são
// as letras do nome, não um "pule esta tela".
const POR_INTERACAO = Object.freeze({
  [TELA.TITULO]: TELA.JOGANDO,
  [TELA.ATTRACT]: TELA.TITULO,
  [TELA.HIGH_SCORES]: TELA.TITULO,
  [TELA.GAME_OVER]: TELA.TITULO,
});

/**
 * Telas que esperam alguém digitar não são encurtadas pelo `?rapido=1`:
 * uma captura acelerada ainda precisa dar tempo de escrever as letras.
 */
const RITMO_REAL = new Set([TELA.INICIAIS]);

/** True se a tela sai sozinha com o tempo. */
export function saiSozinha(tela) {
  return Object.hasOwn(POR_TEMPO, tela);
}

/**
 * Cria o controlador de telas.
 *   opcoes.inicial     tela em que o jogo começa (padrão: título)
 *   opcoes.tempos      tabela de tempos (padrão: a do config)
 *   opcoes.fatorTempo  multiplica os tempos; 0,05 com ?rapido=1
 *   opcoes.aoTrocar    chamado a cada troca, com (nova, anterior)
 */
export function criarTelas(opcoes = {}) {
  const tempos = opcoes.tempos ?? TEMPOS_DE_TELA;
  const fatorTempo = opcoes.fatorTempo ?? 1;
  const aoTrocar = opcoes.aoTrocar ?? (() => {});

  let atual = opcoes.inicial ?? TELA.TITULO;
  // Para onde o fim de jogo vai: título, ou a tela das iniciais quando a
  // pontuação entrou nas cinco melhores (3.4).
  let saidaDoFimDeJogo = TELA.TITULO;
  // O relógio da primeira tela só começa a contar no primeiro quadro: no
  // navegador `performance.now()` já vale centenas de ms quando a página
  // carrega, e começar em zero comeria um pedaço da primeira espera.
  let desde = null;

  /** Quanto tempo esta tela espera antes de trocar sozinha, ou null. */
  function duracaoDaTelaAtual() {
    const saida = POR_TEMPO[atual];
    if (!saida) return null;
    return tempos[saida.tempo] * (RITMO_REAL.has(atual) ? 1 : fatorTempo);
  }

  /** Para onde a tela vai sozinha. Só o fim de jogo tem dois destinos. */
  function proximaPorTempo(tela) {
    if (tela === TELA.GAME_OVER) return saidaDoFimDeJogo;
    return POR_TEMPO[tela]?.proxima ?? null;
  }

  function ir(tela, agora) {
    if (tela === atual) return atual;
    const anterior = atual;
    atual = tela;
    desde = agora;
    aoTrocar(atual, anterior);
    return atual;
  }

  return {
    get atual() { return atual; },
    get desde() { return desde ?? 0; },

    /** Há quanto tempo o jogo está nesta tela. */
    tempoNaTela(agora) { return desde === null ? 0 : agora - desde; },
    duracaoDaTelaAtual,

    /** Avança o relógio; troca de tela se o tempo da atual tiver acabado. */
    atualizar(agora) {
      if (desde === null) { desde = agora; return atual; }
      const duracao = duracaoDaTelaAtual();
      if (duracao !== null && agora - desde >= duracao) {
        ir(proximaPorTempo(atual), agora);
      }
      return atual;
    },

    /** Alguém mexeu: tecla ou clique. Devolve true se isso trocou a tela. */
    interagir(agora) {
      // Cortar a espera do fim de jogo leva ao mesmo lugar que esperar.
      const destino = atual === TELA.GAME_OVER ? saidaDoFimDeJogo : POR_INTERACAO[atual];
      if (!destino) return false;
      ir(destino, agora);
      return true;
    },

    /**
     * A partida acabou: vai para a tela de fim de jogo. Com
     * `opcoes.paraIniciais`, de lá o jogo segue para digitar as três
     * letras em vez de voltar direto ao título (3.4).
     */
    fimDePartida(agora, opcoes = {}) {
      saidaDoFimDeJogo = opcoes.paraIniciais ? TELA.INICIAIS : TELA.TITULO;
      return ir(TELA.GAME_OVER, agora);
    },

    ir,
  };
}
