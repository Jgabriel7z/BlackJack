// =====================================================================
//  progresso.js — o que sobrevive a fechar o jogo  (sub-passo 4.1)
//
//  Três coisas: os recordes (o melhor total e a lista das cinco
//  melhores), as estatísticas da parte C3 do PDF, e os desbloqueios da
//  tabela A5. Este arquivo é lógica pura: ele não sabe o que é
//  localStorage nem como salvar. Quem guarda é `src/ui/armazenamento.js`.
//
//  Os campos `recorde` e `placar` são os MESMOS objetos que o `score.js`
//  e o `placar.js` já mexiam: aqui eles só ganham carona para serem
//  salvos e conferidos na volta. Quem conta partida e sobe recorde
//  continua sendo o `score.js`.
//
//  `normalizar` é a porta de entrada de tudo o que vem de fora: o que
//  está guardado pode estar velho, truncado ou mexido à mão, e nada
//  disso pode derrubar o jogo.
// =====================================================================

import { TAMANHO_DO_PLACAR, normalizarIniciais } from './placar.js';

export const VERSAO = 1;

/**
 * Estatísticas da parte C3 do PDF. `trunfosNaRodada` é a única que zera
 * a cada rodada; `cabecoesDerrotados` fica em zero até as variantes de
 * oponente existirem (sub-passo 4.4b), mas está aqui porque a lista do
 * PDF a inclui.
 */
export function criarEstatisticas() {
  return {
    oponentesDerrotados: 0,          // total_defeated
    trunfosUsados: 0,                // trumps_used_total
    trunfosNaRodada: 0,              // trumps_used_this_round
    trunfosDoInimigoRemovidos: 0,    // enemy_trumps_removed_total
    alvosExatos: 0,                  // exact_21_total
    sequenciaDeAlvosExatos: 0,       // exact_21_streak
    sequenciaSemTortura: 0,          // untortured_streak
    cabecoesDerrotados: 0,           // mr_big_head_defeated
    partidasJogadas: 0,
    rodadasJogadas: 0,
  };
}

export function criarProgresso() {
  return {
    versao: VERSAO,
    recorde: { melhor: 0, partidas: 0 },
    placar: { tamanho: TAMANHO_DO_PLACAR, entradas: [] },
    estatisticas: criarEstatisticas(),
    desbloqueios: [],
    // Preferências de quem joga (4.3). Ficam aqui para atravessarem o
    // recarregar junto com o resto.
    opcoes: { efeitos: true, dificil: false },
  };
}

// ---------------------------------------------------------------------
//  Recompensas (tabela A5 do PDF)
//
//  Só entram as linhas que funcionam com as cartas que já existem. As
//  outras esperam: Two-Up+, Shield+, Exchange, Trump Switch+, Destroy+ e
//  Destroy++ dependem de cartas do sub-passo 4.4a, e as três últimas
//  linhas da tabela dependem do modo Sobrevivência (4.4c).
//
//  "Derrotar um oponente" aqui é vencer uma partida inteira: no nosso
//  jogo o Luiz Alberto é um oponente só, que atravessa os três níveis.
//  "Chegar a 21" é fechar no alvo que está na placa, que nem sempre é 21
//  depois de uma carta "Go For".
// ---------------------------------------------------------------------

export const RECOMPENSAS = Object.freeze([
  {
    id: 'go_for_24',
    tipo: 'carta',
    carta: 'go_for_24',
    nome: 'Go For 24',
    condicao: 'Vencer 5 partidas',
    progresso: (e) => `${Math.min(e.oponentesDerrotados, 5)}/5`,
    atingida: (e) => e.oponentesDerrotados >= 5,
  },
  {
    id: 'go_for_27',
    tipo: 'carta',
    carta: 'go_for_27',
    nome: 'Go For 27',
    condicao: 'Fechar no alvo exato 3 rodadas seguidas',
    progresso: (e) => `${Math.min(e.sequenciaDeAlvosExatos, 3)}/3`,
    atingida: (e) => e.sequenciaDeAlvosExatos >= 3,
  },
  {
    id: 'trunfo_inicial_alvos',
    tipo: 'trunfo_inicial',
    nome: 'Uma carta trunfo a mais no começo da rodada',
    condicao: 'Fechar no alvo exato 3 vezes no total',
    progresso: (e) => `${Math.min(e.alvosExatos, 3)}/3`,
    atingida: (e) => e.alvosExatos >= 3,
  },
  {
    id: 'trunfo_inicial_estourado',
    tipo: 'trunfo_inicial',
    nome: 'Uma carta trunfo a mais no começo da rodada',
    condicao: 'Vencer uma partida mesmo tendo estourado',
    progresso: () => '—',
    atingida: (e, evento) => evento.venceuTendoEstourado === true,
  },
]);

/** As cartas que ainda não foram desbloqueadas não entram no sorteio. */
export function cartasSorteaveis(progresso, todas) {
  const presas = new Set(
    RECOMPENSAS.filter((r) => r.tipo === 'carta' && !progresso.desbloqueios.includes(r.id))
      .map((r) => r.carta),
  );
  return todas.filter((id) => !presas.has(id));
}

/** Quantas cartas trunfo a mais o jogador começa a rodada (0, 1 ou 2). */
export function trunfosIniciaisExtras(progresso) {
  return RECOMPENSAS.filter((r) => r.tipo === 'trunfo_inicial'
    && progresso.desbloqueios.includes(r.id)).length;
}

/**
 * Vê se alguma recompensa acabou de ser atingida. Devolve a lista das
 * novas (vazia quase sempre) e já as guarda em `desbloqueios`.
 */
export function conferirRecompensas(progresso, evento = {}) {
  const novas = [];
  for (const recompensa of RECOMPENSAS) {
    if (progresso.desbloqueios.includes(recompensa.id)) continue;
    if (!recompensa.atingida(progresso.estatisticas, evento)) continue;
    progresso.desbloqueios.push(recompensa.id);
    novas.push(recompensa);
  }
  return novas;
}

// ---------------------------------------------------------------------
//  Anotações
// ---------------------------------------------------------------------

/** O jogador jogou uma carta trunfo. */
export function anotarTrunfoUsado(progresso) {
  progresso.estatisticas.trunfosUsados += 1;
  progresso.estatisticas.trunfosNaRodada += 1;
}

/** Uma carta trunfo do oponente saiu da mesa por causa do jogador. */
export function anotarTrunfoRemovido(progresso) {
  progresso.estatisticas.trunfosDoInimigoRemovidos += 1;
}

/**
 * Uma rodada acabou. `evento.total` é a mão do jogador e `evento.alvo` o
 * alvo da mesa. Devolve as recompensas que isso destravou.
 */
export function anotarRodada(progresso, evento = {}) {
  const e = progresso.estatisticas;
  e.rodadasJogadas += 1;
  e.trunfosNaRodada = 0;

  if (evento.total === evento.alvo) {
    e.alvosExatos += 1;
    e.sequenciaDeAlvosExatos += 1;
  } else {
    e.sequenciaDeAlvosExatos = 0;
  }
  return conferirRecompensas(progresso, evento);
}

/**
 * Uma partida acabou. `evento.venceu`, `evento.estourouAlgumaVez` e
 * `evento.semTortura` (o jogador não perdeu nenhuma rodada).
 * Devolve as recompensas que isso destravou.
 */
export function anotarPartida(progresso, evento = {}) {
  const e = progresso.estatisticas;
  e.partidasJogadas += 1;

  if (evento.venceu) {
    e.oponentesDerrotados += 1;
    e.sequenciaSemTortura = evento.semTortura ? e.sequenciaSemTortura + 1 : 0;
  } else {
    e.sequenciaSemTortura = 0;
  }

  return conferirRecompensas(progresso, {
    ...evento,
    venceuTendoEstourado: evento.venceu === true && evento.estourouAlgumaVez === true,
  });
}

// ---------------------------------------------------------------------
//  Entrada de dados de fora
// ---------------------------------------------------------------------

const inteiro = (valor, padrao = 0) => (Number.isFinite(valor) && valor >= 0 ? Math.floor(valor) : padrao);

/**
 * Transforma qualquer coisa num progresso válido. O que estiver
 * guardado pode ser de uma versão antiga, estar cortado pela metade ou
 * ter sido mexido à mão pelo console: nada disso pode derrubar o jogo,
 * então o que não der para aproveitar simplesmente volta ao padrão.
 */
export function normalizar(dados) {
  const limpo = criarProgresso();
  if (!dados || typeof dados !== 'object') return limpo;
  if (dados.versao !== VERSAO) return limpo;   // versão de outro tempo: começa de novo

  if (dados.recorde && typeof dados.recorde === 'object') {
    limpo.recorde.melhor = inteiro(dados.recorde.melhor);
    limpo.recorde.partidas = inteiro(dados.recorde.partidas);
  }

  if (Array.isArray(dados.placar?.entradas)) {
    limpo.placar.entradas = dados.placar.entradas
      .filter((e) => e && typeof e === 'object' && Number.isFinite(e.pontos) && e.pontos > 0)
      .map((e) => ({
        iniciais: normalizarIniciais(e.iniciais),
        pontos: Math.floor(e.pontos),
        nivel: inteiro(e.nivel, 1) || 1,
        venceu: e.venceu === true,
      }))
      .sort((a, b) => b.pontos - a.pontos)
      .slice(0, limpo.placar.tamanho);
  }

  if (dados.estatisticas && typeof dados.estatisticas === 'object') {
    for (const chave of Object.keys(limpo.estatisticas)) {
      limpo.estatisticas[chave] = inteiro(dados.estatisticas[chave]);
    }
  }

  if (dados.opcoes && typeof dados.opcoes === 'object') {
    // Só `false` desliga: qualquer outra coisa deixa como está de fábrica.
    limpo.opcoes.efeitos = dados.opcoes.efeitos !== false;
    // E só `true` liga o modo difícil.
    limpo.opcoes.dificil = dados.opcoes.dificil === true;
  }

  if (Array.isArray(dados.desbloqueios)) {
    const conhecidas = new Set(RECOMPENSAS.map((r) => r.id));
    limpo.desbloqueios = [...new Set(dados.desbloqueios.filter((id) => conhecidas.has(id)))];
  }

  return limpo;
}
