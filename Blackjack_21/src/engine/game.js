// =====================================================================
//  game.js — o estado de uma partida do 21 no modo GUILHOTINA
//
//  Escopo deste arquivo (sub-passo 1.1 do plano): apenas as regras.
//  Nada de tela, animação, som, IA, pontuação ou cartas trunfo.
//
//  Como funciona uma partida (21_referencia_jogo.pdf, A4 "Rodada 1"):
//    - Cada jogador tem 5 dedos. Perder todos = fim de jogo.
//    - A cada rodada, cada um recebe 1 carta OCULTA (só o dono vê) e
//      1 carta ABERTA. Depois os dois se alternam entre HIT (comprar)
//      e STAY (passar).
//    - Dois STAY seguidos encerram a rodada: as ocultas são reveladas
//      e as regras de rules.js decidem quem venceu.
//    - O perdedor perde dedos iguais à sua aposta. No empate os dois
//      perdem. A aposta começa em 1 e sobe +1 para os dois a cada rodada.
//
//  Uso típico (quem chama controla o ritmo, o motor só valida):
//    const jogo = criarJogo({ seed: 42 }); // sem seed: sorteia e guarda em jogo.seed
//    iniciarRodada(jogo);
//    hit(jogo, 'jogador');   // compra e passa a vez
//    stay(jogo, 'oponente'); // passa
//    stay(jogo, 'jogador');  // segundo stay seguido -> rodada resolvida
//    jogo.ultimaRodada       // quem venceu, totais, dedos perdidos
// =====================================================================

import { criarBaralho, embaralhar, comprar } from './deck.js';
import { criarRng, seedAleatoria } from './rng.js';
import {
  ALVO_PADRAO,
  LADO,
  RESULTADO,
  somarMao,
  estourou,
  decidirVencedor,
  outroLado,
} from './rules.js';
import { NOMES } from '../config.js';

export { LADO, RESULTADO };

export const DEDOS_INICIAIS = 5;
export const APOSTA_INICIAL = 1;

/** Fases pelas quais o jogo passa. */
export const FASE = Object.freeze({
  AGUARDANDO: 'aguardando',           // criado, nenhuma rodada começou
  JOGANDO: 'jogando',                 // rodada em andamento
  RODADA_ENCERRADA: 'rodada_encerrada', // cartas reveladas, punição aplicada
  FIM_DE_JOGO: 'fim_de_jogo',         // alguém ficou sem dedos
});

// ---------------------------------------------------------------------
//  Criação
// ---------------------------------------------------------------------

function criarParticipante(nome) {
  return {
    nome,
    oculta: null,      // carta virada para baixo (só o dono vê)
    abertas: [],       // cartas viradas para cima
    aposta: 0,         // quantos dedos perde se perder a rodada
    dedos: DEDOS_INICIAIS,
    rodadasVencidas: 0,
  };
}

/**
 * Cria uma partida nova.
 * `opcoes.seed`: inteiro que define toda a aleatoriedade da partida.
 *   A mesma seed reproduz exatamente as mesmas cartas. Se não vier,
 *   uma seed nova é sorteada e guardada em `jogo.seed`.
 * `opcoes.embaralhar`: substitui o embaralhamento inteiro (usado nos
 *   testes para montar um baralho com ordem conhecida).
 */
export function criarJogo(opcoes = {}) {
  const seed = opcoes.seed ?? seedAleatoria();
  const aleatorio = criarRng(seed);
  const funcaoEmbaralhar = opcoes.embaralhar ?? ((cartas) => embaralhar(cartas, aleatorio));

  return {
    modo: 'guilhotina',
    seed,
    alvo: ALVO_PADRAO,
    rodada: 0,
    fase: FASE.AGUARDANDO,
    turno: LADO.JOGADOR,
    staysSeguidos: 0,
    baralho: [],
    jogadores: {
      [LADO.JOGADOR]: criarParticipante(NOMES.jogador),
      [LADO.OPONENTE]: criarParticipante(NOMES.oponente),
    },
    ultimaRodada: null,   // resumo da última rodada resolvida
    vencedorDoJogo: null, // 'jogador' | 'oponente' | 'ninguem'
    _embaralhar: funcaoEmbaralhar,
  };
}

// ---------------------------------------------------------------------
//  Rodada
// ---------------------------------------------------------------------

/**
 * Começa uma rodada: novo baralho embaralhado, 1 oculta + 1 aberta para
 * cada um, aposta = número da rodada, jogador começa.
 */
export function iniciarRodada(jogo) {
  if (jogo.fase === FASE.FIM_DE_JOGO) {
    throw new Error('O jogo já terminou; crie um jogo novo.');
  }
  if (jogo.fase === FASE.JOGANDO) {
    throw new Error('Já existe uma rodada em andamento.');
  }

  jogo.rodada += 1;
  jogo.baralho = jogo._embaralhar(criarBaralho());

  const jogador = jogo.jogadores[LADO.JOGADOR];
  const oponente = jogo.jogadores[LADO.OPONENTE];

  // Distribuição: ocultas primeiro, depois abertas, alternando os lados.
  jogador.oculta = comprar(jogo.baralho);
  oponente.oculta = comprar(jogo.baralho);
  jogador.abertas = [comprar(jogo.baralho)];
  oponente.abertas = [comprar(jogo.baralho)];

  // Aposta sobe 1 por rodada, para os dois (A4, Rodada 1).
  jogador.aposta = APOSTA_INICIAL + (jogo.rodada - 1);
  oponente.aposta = APOSTA_INICIAL + (jogo.rodada - 1);

  jogo.staysSeguidos = 0;
  jogo.turno = LADO.JOGADOR;
  jogo.fase = FASE.JOGANDO;
  jogo.ultimaRodada = null;
  return jogo;
}

function exigirTurno(jogo, lado) {
  if (jogo.fase !== FASE.JOGANDO) {
    throw new Error('Não há rodada em andamento.');
  }
  if (lado !== LADO.JOGADOR && lado !== LADO.OPONENTE) {
    throw new Error(`Lado inválido: ${lado}`);
  }
  if (jogo.turno !== lado) {
    throw new Error(`Não é o turno de ${lado}.`);
  }
}

function passarTurno(jogo) {
  jogo.turno = outroLado(jogo.turno);
}

/** True se `lado` pode comprar agora (é seu turno e ainda há cartas). */
export function podeComprar(jogo, lado) {
  return jogo.fase === FASE.JOGANDO && jogo.turno === lado && jogo.baralho.length > 0;
}

/** True se `lado` pode passar agora (é seu turno). */
export function podePassar(jogo, lado) {
  return jogo.fase === FASE.JOGANDO && jogo.turno === lado;
}

/**
 * HIT: `lado` compra a carta do topo (fica aberta) e a vez passa.
 * Zera a contagem de stays seguidos. Devolve a carta comprada.
 */
export function hit(jogo, lado) {
  exigirTurno(jogo, lado);
  if (jogo.baralho.length === 0) {
    throw new Error('Não há mais cartas no baralho; só é possível passar.');
  }
  const carta = comprar(jogo.baralho);
  jogo.jogadores[lado].abertas.push(carta);
  jogo.staysSeguidos = 0;
  passarTurno(jogo);
  return { acao: 'hit', lado, carta };
}

/**
 * STAY: `lado` passa a vez. Se for o segundo stay seguido, a rodada é
 * resolvida na hora e o resumo vem em `resultado`; senão `resultado` é null.
 */
export function stay(jogo, lado) {
  exigirTurno(jogo, lado);
  jogo.staysSeguidos += 1;

  if (jogo.staysSeguidos >= 2) {
    const resultado = resolverRodada(jogo);
    return { acao: 'stay', lado, resultado };
  }

  passarTurno(jogo);
  return { acao: 'stay', lado, resultado: null };
}

// ---------------------------------------------------------------------
//  Resolução e punição
// ---------------------------------------------------------------------

function punir(jogo, lado) {
  const participante = jogo.jogadores[lado];
  const dedosPerdidos = Math.min(participante.aposta, participante.dedos);
  participante.dedos -= dedosPerdidos;
  return { lado, dedosPerdidos, dedosRestantes: participante.dedos };
}

function resolverRodada(jogo) {
  const jogador = jogo.jogadores[LADO.JOGADOR];
  const oponente = jogo.jogadores[LADO.OPONENTE];

  const totalJogador = somarMao(jogador);
  const totalOponente = somarMao(oponente);
  const vencedor = decidirVencedor(totalJogador, totalOponente, jogo.alvo);

  const punicoes = [];
  if (vencedor === RESULTADO.EMPATE) {
    // Empate na guilhotina: os dois são punidos (C1, "Empate").
    punicoes.push(punir(jogo, LADO.JOGADOR));
    punicoes.push(punir(jogo, LADO.OPONENTE));
  } else {
    jogo.jogadores[vencedor].rodadasVencidas += 1;
    punicoes.push(punir(jogo, outroLado(vencedor)));
  }

  jogo.ultimaRodada = {
    rodada: jogo.rodada,
    vencedor,
    totais: { jogador: totalJogador, oponente: totalOponente },
    estourou: {
      jogador: estourou(totalJogador, jogo.alvo),
      oponente: estourou(totalOponente, jogo.alvo),
    },
    cartas: {
      jogador: { oculta: jogador.oculta, abertas: [...jogador.abertas] },
      oponente: { oculta: oponente.oculta, abertas: [...oponente.abertas] },
    },
    punicoes,
  };

  jogo.fase = FASE.RODADA_ENCERRADA;
  verificarFimDeJogo(jogo);
  return jogo.ultimaRodada;
}

function verificarFimDeJogo(jogo) {
  const jogadorMorreu = jogo.jogadores[LADO.JOGADOR].dedos === 0;
  const oponenteMorreu = jogo.jogadores[LADO.OPONENTE].dedos === 0;
  if (!jogadorMorreu && !oponenteMorreu) return;

  jogo.fase = FASE.FIM_DE_JOGO;
  if (jogadorMorreu && oponenteMorreu) {
    jogo.vencedorDoJogo = 'ninguem';
  } else {
    jogo.vencedorDoJogo = jogadorMorreu ? LADO.OPONENTE : LADO.JOGADOR;
  }
}

// ---------------------------------------------------------------------
//  Consulta
// ---------------------------------------------------------------------

/**
 * O que `lado` consegue ver da mesa. A carta oculta do adversário vem
 * como null enquanto a rodada está em andamento; depois de resolvida,
 * tudo fica visível. Não altera o estado.
 */
export function verMesa(jogo, lado) {
  const rodadaAberta = jogo.fase === FASE.JOGANDO;
  const montar = (dono) => {
    const p = jogo.jogadores[dono];
    const podeVerOculta = dono === lado || !rodadaAberta;
    return {
      nome: p.nome,
      oculta: podeVerOculta ? p.oculta : null,
      abertas: [...p.abertas],
      aposta: p.aposta,
      dedos: p.dedos,
      totalVisivel: (podeVerOculta ? (p.oculta ?? 0) : 0)
        + p.abertas.reduce((s, c) => s + c, 0),
    };
  };
  return {
    rodada: jogo.rodada,
    alvo: jogo.alvo,
    fase: jogo.fase,
    turno: jogo.turno,
    cartasNoBaralho: jogo.baralho.length,
    eu: montar(lado),
    adversario: montar(outroLado(lado)),
  };
}
