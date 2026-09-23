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
import { darTrunfo, modificadorDeAposta, alvoDaMesa, compraBloqueada } from './trumps.js';
import { TRUNFOS } from '../config.js';
import {
  NIVEL,
  ULTIMO_NIVEL,
  SERRA_INICIAL,
  configDoNivel,
  aplicarPunicaoDoNivel,
  estaMorto,
  prepararNivel,
} from './niveis.js';
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
  AGUARDANDO: 'aguardando',             // criado, nenhuma rodada começou
  JOGANDO: 'jogando',                   // rodada em andamento
  RODADA_ENCERRADA: 'rodada_encerrada', // cartas reveladas, punição aplicada
  NIVEL_CONCLUIDO: 'nivel_concluido',   // o oponente caiu, mas ainda há aparelho novo
  FIM_DE_JOGO: 'fim_de_jogo',           // o jogador caiu, ou o último nível terminou
});

// ---------------------------------------------------------------------
//  Criação
// ---------------------------------------------------------------------

function criarParticipante(nome) {
  return {
    nome,
    oculta: null,        // carta virada para baixo (só o dono vê)
    abertas: [],         // cartas viradas para cima
    aposta: 0,           // aposta base; a efetiva considera os trunfos na mesa
    dedos: DEDOS_INICIAIS,   // nível 1
    choque: 0,               // nível 2: medidor de 0 a 10
    rodadasVencidas: 0,
    trunfos: [],         // ids na mão (2.2)
    trunfosNaMesa: [],   // cartas persistentes do lado dele (2.2)
  };
}

/**
 * Cria uma partida nova.
 * `opcoes.seed`: inteiro que define toda a aleatoriedade da partida.
 *   A mesma seed reproduz exatamente as mesmas cartas. Se não vier,
 *   uma seed nova é sorteada e guardada em `jogo.seed`.
 * `opcoes.embaralhar`: substitui o embaralhamento inteiro (usado nos
 *   testes para montar um baralho com ordem conhecida).
 * `opcoes.catalogoTrunfos`: catálogo já preparado por `prepararCatalogo`.
 *   Sem ele, a partida roda sem cartas trunfo (é o modo da Etapa 1).
 */
export function criarJogo(opcoes = {}) {
  const seed = opcoes.seed ?? seedAleatoria();
  const aleatorio = criarRng(seed);
  const funcaoEmbaralhar = opcoes.embaralhar ?? ((cartas) => embaralhar(cartas, aleatorio));

  return {
    seed,
    alvo: ALVO_PADRAO,
    nivel: opcoes.nivel ?? NIVEL.GUILHOTINA,
    rodadaDoNivel: 0,
    serra: SERRA_INICIAL,
    vitoriaFinal: false,
    catalogoTrunfos: opcoes.catalogoTrunfos ?? null,
    // Quantas cartas trunfo a mão do JOGADOR comporta. O padrão vem do
    // config; as recompensas da tabela A5 aumentam esse número (4.1).
    maximoNaMao: opcoes.maximoNaMao ?? TRUNFOS.maximoNaMao,
    // Dois geradores separados, os dois vindos da seed: assim sortear cartas
    // trunfo não muda o embaralhamento, e a mesma seed dá sempre o mesmo
    // baralho, com trunfos ligados ou não.
    _aleatorio: aleatorio,
    _aleatorioTrunfos: criarRng((seed ^ 0x85ebca6b) >>> 0),
    _ordemTrunfo: 0,
    stats: {
      trunfosUsados: { [LADO.JOGADOR]: 0, [LADO.OPONENTE]: 0 },
      // Quantos cada lado jogou NESTA rodada: zera a cada rodada e
      // segura o limite de `TRUNFOS.maximoPorRodada`.
      trunfosNaRodada: { [LADO.JOGADOR]: 0, [LADO.OPONENTE]: 0 },
    },
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
  if (jogo.fase === FASE.NIVEL_CONCLUIDO) {
    throw new Error('O nível acabou; chame avancarNivel antes de outra rodada.');
  }

  jogo.rodada += 1;
  jogo.rodadaDoNivel += 1;
  jogo.stats.trunfosNaRodada[LADO.JOGADOR] = 0;
  jogo.stats.trunfosNaRodada[LADO.OPONENTE] = 0;
  jogo.baralho = jogo._embaralhar(criarBaralho());

  const jogador = jogo.jogadores[LADO.JOGADOR];
  const oponente = jogo.jogadores[LADO.OPONENTE];

  // Distribuição: ocultas primeiro, depois abertas, alternando os lados.
  jogador.oculta = comprar(jogo.baralho);
  oponente.oculta = comprar(jogo.baralho);
  jogador.abertas = [comprar(jogo.baralho)];
  oponente.abertas = [comprar(jogo.baralho)];

  // Aposta sobe 1 por rodada dentro do nível, para os dois (A4, Rodada 1).
  jogador.aposta = APOSTA_INICIAL + (jogo.rodadaDoNivel - 1);
  oponente.aposta = APOSTA_INICIAL + (jogo.rodadaDoNivel - 1);

  // Trunfos: a mesa é limpa e cada um recebe os iniciais do nível (A4, C4).
  jogador.trunfosNaMesa = [];
  oponente.trunfosNaMesa = [];
  if (jogo.catalogoTrunfos) {
    for (let i = 0; i < configDoNivel(jogo.nivel).trunfosIniciais; i++) {
      darTrunfo(jogo, LADO.JOGADOR);
      darTrunfo(jogo, LADO.OPONENTE);
    }
  }

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
  return jogo.fase === FASE.JOGANDO
    && jogo.turno === lado
    && jogo.baralho.length > 0
    // A Desperation na mesa proíbe este lado de comprar (4.8).
    && !compraBloqueada(jogo, lado);
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

  // Chance de ganhar 1 trunfo ao comprar (C7: ~30%, ajustável no config).
  let trunfoGanho = null;
  if (jogo.catalogoTrunfos && jogo._aleatorioTrunfos() < TRUNFOS.chanceAoComprar) {
    trunfoGanho = darTrunfo(jogo, lado);
  }

  passarTurno(jogo);
  return { acao: 'hit', lado, carta, trunfoGanho };
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

/**
 * Aposta que vale de verdade para `lado`: a base mais os modificadores
 * das cartas trunfo que estão na mesa. Nunca fica negativa (Shield não
 * pode "devolver" dedos).
 */
export function apostaEfetiva(jogo, lado) {
  const base = jogo.jogadores[lado].aposta;
  if (!jogo.catalogoTrunfos) return base;
  return Math.max(0, base + modificadorDeAposta(jogo, lado));
}

/** Alvo válido agora: o das cartas "Go For" na mesa, ou o alvo base. */
export function alvoAtual(jogo) {
  if (!jogo.catalogoTrunfos) return jogo.alvo;
  return alvoDaMesa(jogo) ?? jogo.alvo;
}

/**
 * Pune `lado` conforme o aparelho do nível. O campo `dedosPerdidos` é
 * mantido por compatibilidade com quem já lia o resultado da Etapa 1;
 * `tipo` e `quantidade` valem para qualquer nível.
 */
function punir(jogo, lado) {
  const punicao = aplicarPunicaoDoNivel(jogo, lado, apostaEfetiva(jogo, lado));
  return {
    ...punicao,
    dedosPerdidos: punicao.tipo === 'dedos' ? punicao.quantidade : 0,
    dedosRestantes: jogo.jogadores[lado].dedos,
  };
}

function resolverRodada(jogo) {
  const jogador = jogo.jogadores[LADO.JOGADOR];
  const oponente = jogo.jogadores[LADO.OPONENTE];

  const alvo = alvoAtual(jogo);
  const totalJogador = somarMao(jogador);
  const totalOponente = somarMao(oponente);
  const vencedor = decidirVencedor(totalJogador, totalOponente, alvo);

  const punicoes = [];
  if (vencedor === RESULTADO.EMPATE) {
    // Empate: guilhotina e choque punem os dois; a serra fica onde está
    // e a rodada é esquecida (A4, Rodada Final).
    if (jogo.nivel !== NIVEL.SERRA) {
      punicoes.push(punir(jogo, LADO.JOGADOR));
      punicoes.push(punir(jogo, LADO.OPONENTE));
    }
  } else {
    jogo.jogadores[vencedor].rodadasVencidas += 1;
    punicoes.push(punir(jogo, outroLado(vencedor)));
  }

  jogo.ultimaRodada = {
    rodada: jogo.rodada,
    nivel: jogo.nivel,
    vencedor,
    alvo,
    totais: { jogador: totalJogador, oponente: totalOponente },
    estourou: {
      jogador: estourou(totalJogador, alvo),
      oponente: estourou(totalOponente, alvo),
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
  const jogadorMorreu = estaMorto(jogo, LADO.JOGADOR);
  const oponenteMorreu = estaMorto(jogo, LADO.OPONENTE);
  if (!jogadorMorreu && !oponenteMorreu) return;

  if (jogadorMorreu) {
    // Se os dois caem na mesma rodada, ninguém sai da mesa.
    jogo.fase = FASE.FIM_DE_JOGO;
    jogo.vencedorDoJogo = oponenteMorreu ? 'ninguem' : LADO.OPONENTE;
    return;
  }

  // Só o oponente caiu: ou vem outro aparelho, ou o jogo acabou em vitória.
  if (jogo.nivel < ULTIMO_NIVEL) {
    jogo.fase = FASE.NIVEL_CONCLUIDO;
  } else {
    jogo.fase = FASE.FIM_DE_JOGO;
    jogo.vencedorDoJogo = LADO.JOGADOR;
    jogo.vitoriaFinal = true;
  }
}

/**
 * Passa para o nível seguinte: aparelho novo, vida cheia, aposta de volta
 * ao 1 e mãos de trunfo limpas. Só pode depois de `FASE.NIVEL_CONCLUIDO`.
 */
export function avancarNivel(jogo) {
  if (jogo.fase !== FASE.NIVEL_CONCLUIDO) {
    throw new Error('Só dá para avançar de nível quando o nível foi concluído.');
  }
  prepararNivel(jogo, jogo.nivel + 1);
  jogo.fase = FASE.AGUARDANDO;
  jogo.ultimaRodada = null;
  return jogo;
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
      apostaEfetiva: apostaEfetiva(jogo, dono),
      dedos: p.dedos,
      choque: p.choque,
      // A mão de trunfos do adversário é segredo; a mesa dele é pública.
      trunfos: dono === lado ? [...p.trunfos] : p.trunfos.length,
      trunfosNaMesa: p.trunfosNaMesa.map((c) => ({ id: c.id, nome: c.nome })),
      totalVisivel: (podeVerOculta ? (p.oculta ?? 0) : 0)
        + p.abertas.reduce((s, c) => s + c, 0),
    };
  };
  return {
    rodada: jogo.rodada,
    rodadaDoNivel: jogo.rodadaDoNivel,
    nivel: jogo.nivel,
    serra: jogo.serra,
    alvo: alvoAtual(jogo),
    fase: jogo.fase,
    turno: jogo.turno,
    cartasNoBaralho: jogo.baralho.length,
    eu: montar(lado),
    adversario: montar(outroLado(lado)),
  };
}
