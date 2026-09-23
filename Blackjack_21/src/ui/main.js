// =====================================================================
//  ui/main.js — liga o motor à tela  (sub-passos 1.3, 1.4 e 1.5)
//
//  Responsabilidades:
//    - ler ?seed e ?rapido da URL
//    - criar a partida e começar a primeira rodada
//    - reagir aos botões HIT / STAY / PRÓXIMA RODADA / JOGAR DE NOVO
//    - traduzir cada mudança do motor em PASSOS de animação (animacao.js):
//        carta deslizando do baralho, oponente pensando, escurecimento,
//        virada lenta das ocultas, resultado, guilhotina, fim de jogo
//    - manter a "mesa visual" (sprites) que o render.js desenha
//    - um único loop requestAnimationFrame com tempo real
//
//  Segurança da carta oculta: o estado `jogo` vive só dentro deste
//  módulo. Não vai para `window` nem para o DOM. O sprite da oculta do
//  oponente é criado com valor null e só recebe o valor real no passo
//  de revelação, depois que a rodada já foi resolvida pelo motor.
//  O DOM recebe só a fase, o nome da animação e o total do próprio
//  jogador (que já está na tela), para os roteiros de captura.
// =====================================================================

import {
  criarJogo,
  iniciarRodada,
  hit,
  stay,
  podeComprar,
  verMesa,
  FASE,
  LADO,
  RESULTADO,
} from '../engine/game.js';
import { decidirAcao, ACAO } from '../engine/ai.js';
import { criarRng, seedAleatoria } from '../engine/rng.js';
import { NOMES } from '../config.js';
import { lerParametros } from './parametros.js';
import { criarRenderizador, posicaoSlot, POSICOES } from './render.js';
import { criarSequenciador, suavizar, interpolar, limitar, pausa } from './animacao.js';
import { criarLampada } from './lampada.js';

// ---------------------------------------------------------------------
//  Preparação
// ---------------------------------------------------------------------

const parametros = lerParametros(window.location.search);
const sequencia = criarSequenciador(parametros.fatorTempo);
const renderizador = criarRenderizador(document.getElementById('mesa'), { efeitos: parametros.efeitos });

const botaoHit = document.getElementById('botao-hit');
const botaoStay = document.getElementById('botao-stay');
const botaoProxima = document.getElementById('botao-proxima');
const botaoReiniciar = document.getElementById('botao-reiniciar');
const telaFinal = document.getElementById('tela-final');

let jogo = null;
let rngVisual = null;
let lampada = null;

/** Tudo que aparece na tela. O render.js só lê este objeto. */
const mesa = {
  eu: { nome: NOMES.jogador, cartas: [], dedos: 5, aposta: 0 },
  adv: { nome: NOMES.oponente, cartas: [], dedos: 5, aposta: 0 },
  emVoo: null,
  baralhoRestante: 0,
  mensagem: '',
  mensagemVermelha: false,
  pensando: false,
  cabecaAngulo: 0,
  escurecimento: 0,
  // 1.5
  guilhotina: null,   // { lado: 'eu'|'adv', progresso: 0..1, fase: 'descendo'|'impacto'|'subindo' }
  flash: 0,           // 0..1, flash vermelho
  tremor: 0,          // 0..1, tremor de tela
  telaPreta: 0,       // 0..1, escurecimento total do fim de jogo
  textoFinal: '',
  rodada: 0,
  alvo: 21,
  seed: null,
  rapido: parametros.rapido,
};

/**
 * Cria (ou recria) a partida e zera a mesa. Com ?seed na URL a mesma
 * partida se repete; sem seed, cada partida sorteia uma nova.
 */
function novaPartida() {
  jogo = criarJogo({ seed: parametros.seed ?? seedAleatoria() });
  rngVisual = criarRng((jogo.seed ^ 0x9e3779b9) >>> 0);
  lampada = criarLampada(rngVisual, parametros.fatorTempo);

  mesa.eu.cartas = [];
  mesa.adv.cartas = [];
  mesa.eu.dedos = 5;
  mesa.adv.dedos = 5;
  mesa.eu.aposta = 0;
  mesa.adv.aposta = 0;
  mesa.emVoo = null;
  mesa.baralhoRestante = 0;
  mesa.mensagem = '';
  mesa.mensagemVermelha = false;
  mesa.pensando = false;
  mesa.cabecaAngulo = 0;
  mesa.escurecimento = 0;
  mesa.guilhotina = null;
  mesa.flash = 0;
  mesa.tremor = 0;
  mesa.telaPreta = 0;
  mesa.textoFinal = '';
  mesa.rodada = 0;
  mesa.alvo = jogo.alvo;
  mesa.seed = jogo.seed;

  comecarRodada();
}

// ---------------------------------------------------------------------
//  Passos de animação
// ---------------------------------------------------------------------

/**
 * Carta sai do baralho e desliza até o próximo espaço da fileira de `lado`.
 * Se `faceFinal` for 'cima', vira no meio do caminho.
 */
function passoCartaVoando({ nome, lado, valor, faceFinal, marcaOculta = false }) {
  let sprite;
  let destino;
  return {
    nome,
    duracao: 480,
    aoIniciar() {
      mesa.baralhoRestante = Math.max(0, mesa.baralhoRestante - 1);
      destino = posicaoSlot(lado, mesa[lado].cartas.length);
      sprite = {
        valor,
        face: 'baixo',
        marcaOculta: false,
        x: POSICOES.baralho.x,
        y: POSICOES.baralho.y,
        escalaX: 1,
      };
      mesa.emVoo = sprite;
    },
    aoAtualizar(p) {
      const e = suavizar.saidaCubica(p);
      sprite.x = interpolar(POSICOES.baralho.x, destino.x, e);
      sprite.y = interpolar(POSICOES.baralho.y, destino.y, e) - Math.sin(p * Math.PI) * 26;
      if (faceFinal === 'cima') {
        const f = limitar((p - 0.30) / 0.55, 0, 1);
        sprite.escalaX = Math.abs(Math.cos(f * Math.PI));
        sprite.face = f < 0.5 ? 'baixo' : 'cima';
        sprite.marcaOculta = f >= 0.5 && marcaOculta;
      }
    },
    aoTerminar() {
      sprite.x = destino.x;
      sprite.y = destino.y;
      sprite.escalaX = 1;
      sprite.face = faceFinal;
      sprite.marcaOculta = marcaOculta && faceFinal === 'cima';
      mesa.emVoo = null;
      mesa[lado].cartas.push(sprite);
    },
  };
}

/** Só troca a mensagem (com uma pequena pausa opcional antes). */
function passoMensagem(mensagem, duracao = 0, vermelha = false) {
  return {
    nome: 'mensagem',
    duracao,
    aoTerminar() {
      mesa.mensagem = mensagem;
      mesa.mensagemVermelha = vermelha;
    },
  };
}

/** O oponente "pensa" de 1 a 3 segundos mexendo a cabeça; depois joga. */
function passoPensando() {
  return {
    nome: 'pensando',
    duracao: 1000 + rngVisual() * 2000,
    aoIniciar() {
      mesa.pensando = true;
      mesa.mensagem = `${NOMES.oponente} está pensando`;
      mesa.mensagemVermelha = false;
    },
    aoAtualizar(p) {
      mesa.cabecaAngulo = Math.sin(p * Math.PI * 3) * 0.07 * (1 - p * 0.4);
    },
    aoTerminar() {
      mesa.pensando = false;
      mesa.cabecaAngulo = 0;
      jogadaDoOponente();
    },
  };
}

/** Escurece, pausa, vira a oculta do oponente devagar, anuncia o resultado. */
function adicionarRevelacao(resultado) {
  const ocultaAdv = mesa.adv.cartas[0];
  const ocultaEu = mesa.eu.cartas[0];

  sequencia.adicionar({
    nome: 'escurecendo',
    duracao: 700,
    aoIniciar() {
      mesa.mensagem = '';
    },
    aoAtualizar(p) {
      mesa.escurecimento = 0.55 * suavizar.entradaSaida(p);
    },
  });
  sequencia.adicionar(pausa('escurecendo', 900));

  sequencia.adicionar({
    nome: 'revelando',
    duracao: 1200,
    aoIniciar() {
      // Só agora, com a rodada resolvida, o valor real chega à interface.
      ocultaAdv.valor = resultado.cartas.oponente.oculta;
    },
    aoAtualizar(p) {
      const f = suavizar.entradaSaida(p);
      ocultaAdv.escalaX = Math.abs(Math.cos(f * Math.PI));
      ocultaAdv.face = f < 0.5 ? 'baixo' : 'cima';
    },
    aoTerminar() {
      ocultaAdv.escalaX = 1;
      ocultaAdv.face = 'cima';
      ocultaEu.marcaOculta = false;
    },
  });
  sequencia.adicionar(pausa('revelando', 700));

  sequencia.adicionar({
    nome: 'resultado',
    duracao: 900,
    aoIniciar() {
      mesa.mensagem = descreverResultado(resultado);
      mesa.mensagemVermelha = resultado.vencedor !== RESULTADO.JOGADOR;
    },
    aoAtualizar(p) {
      mesa.escurecimento = interpolar(0.55, 0.15, suavizar.entradaSaida(p));
    },
  });

  adicionarPunicao(resultado);

  if (jogo.fase === FASE.FIM_DE_JOGO) {
    adicionarFimDeJogo();
  }
}

/**
 * Guilhotina em quem perdeu (nos dois, no empate): a lâmina desce, bate
 * com tremor e flash vermelho, os dedos somem, a lâmina sobe.
 */
function adicionarPunicao(resultado) {
  for (const punicao of resultado.punicoes) {
    if (punicao.dedosPerdidos === 0) continue;
    const lado = punicao.lado === LADO.JOGADOR ? 'eu' : 'adv';
    const nome = lado === 'eu' ? 'a sua mão' : `a mão de ${NOMES.oponente}`;

    sequencia.adicionar({
      nome: 'guilhotina',
      duracao: 520,
      aoIniciar() {
        mesa.guilhotina = { lado, progresso: 0, fase: 'descendo' };
        mesa.mensagem = `A lâmina desce sobre ${nome}.`;
        mesa.mensagemVermelha = true;
      },
      aoAtualizar(p) {
        mesa.guilhotina.progresso = suavizar.entradaCubica(p);
      },
    });
    sequencia.adicionar({
      nome: 'guilhotina',
      duracao: 420,
      aoIniciar() {
        mesa.guilhotina.fase = 'impacto';
        mesa.guilhotina.progresso = 1;
        mesa[lado].dedos = punicao.dedosRestantes;   // o dedo simplesmente some
        mesa.flash = 1;
        mesa.tremor = 1;
      },
      aoAtualizar(p) {
        mesa.flash = (1 - p) ** 2;
        mesa.tremor = 1 - p;
      },
      aoTerminar() {
        mesa.flash = 0;
        mesa.tremor = 0;
      },
    });
    sequencia.adicionar({
      nome: 'guilhotina',
      duracao: 800,
      aoIniciar() {
        mesa.guilhotina.fase = 'subindo';
      },
      aoAtualizar(p) {
        mesa.guilhotina.progresso = 1 - suavizar.entradaSaida(p);
      },
      aoTerminar() {
        mesa.guilhotina = null;
      },
    });
    sequencia.adicionar(pausa('guilhotina', 350));
  }
}

/** Tela preta e um texto seco. O botão de jogar de novo aparece quando a fila esvazia. */
function adicionarFimDeJogo() {
  sequencia.adicionar(pausa('fim', 600));
  sequencia.adicionar({
    nome: 'fim',
    duracao: 1400,
    aoIniciar() {
      mesa.mensagem = '';
    },
    aoAtualizar(p) {
      mesa.telaPreta = suavizar.entradaSaida(p);
    },
    aoTerminar() {
      mesa.telaPreta = 1;
      mesa.textoFinal = descreverFim();
    },
  });
  sequencia.adicionar(pausa('fim', 900));
}

// ---------------------------------------------------------------------
//  Textos
// ---------------------------------------------------------------------

function plural(n, singular, pluralTexto) {
  return `${n} ${n === 1 ? singular : pluralTexto}`;
}

function descreverResultado(r) {
  const tj = r.totais.jogador;
  const to = r.totais.oponente;
  const perda = r.punicoes[0].dedosPerdidos;

  if (r.vencedor === RESULTADO.EMPATE) {
    return `Empate: ${tj} a ${to}. Os dois perdem ${plural(perda, 'dedo', 'dedos')}.`;
  }
  if (r.vencedor === RESULTADO.JOGADOR) {
    const detalhe = r.estourou.oponente ? ' (ele estourou)' : '';
    return `Você venceu: ${tj} contra ${to}${detalhe}. ${NOMES.oponente} perde ${plural(perda, 'dedo', 'dedos')}.`;
  }
  const detalhe = r.estourou.jogador ? ' (você estourou)' : '';
  return `${NOMES.oponente} venceu: ${to} contra ${tj}${detalhe}. Você perde ${plural(perda, 'dedo', 'dedos')}.`;
}

function descreverFim() {
  if (jogo.vencedorDoJogo === 'ninguem') return 'Ninguém saiu desta mesa com dedos.';
  if (jogo.vencedorDoJogo === LADO.JOGADOR) return `${NOMES.oponente} não tem mais dedos.`;
  return `${NOMES.jogador} perdeu.`;
}

// ---------------------------------------------------------------------
//  Fluxo da partida
// ---------------------------------------------------------------------

function comecarRodada() {
  iniciarRodada(jogo);
  const visao = verMesa(jogo, LADO.JOGADOR);

  mesa.rodada = visao.rodada;
  mesa.eu.aposta = visao.eu.aposta;
  mesa.adv.aposta = visao.adversario.aposta;
  mesa.eu.cartas = [];
  mesa.adv.cartas = [];
  mesa.baralhoRestante = visao.cartasNoBaralho + 4;
  mesa.escurecimento = 0;
  mesa.mensagem = `Rodada ${visao.rodada}. Aposta: ${plural(visao.eu.aposta, 'dedo', 'dedos')}.`;
  mesa.mensagemVermelha = false;

  sequencia.adicionar(pausa('distribuindo', 350));
  sequencia.adicionar(passoCartaVoando({ nome: 'distribuindo', lado: 'eu', valor: visao.eu.oculta, faceFinal: 'cima', marcaOculta: true }));
  sequencia.adicionar(passoCartaVoando({ nome: 'distribuindo', lado: 'adv', valor: null, faceFinal: 'baixo' }));
  sequencia.adicionar(passoCartaVoando({ nome: 'distribuindo', lado: 'eu', valor: visao.eu.abertas[0], faceFinal: 'cima' }));
  sequencia.adicionar(passoCartaVoando({ nome: 'distribuindo', lado: 'adv', valor: visao.adversario.abertas[0], faceFinal: 'cima' }));
  sequencia.adicionar(passoMensagem('Sua vez: comprar (HIT) ou parar (STAY)?', 150));
}

function jogadaDoOponente() {
  if (decidirAcao(jogo, LADO.OPONENTE) === ACAO.HIT) {
    const { carta } = hit(jogo, LADO.OPONENTE);
    mesa.mensagem = `${NOMES.oponente} compra uma carta.`;
    sequencia.adicionar(passoCartaVoando({ nome: 'comprando', lado: 'adv', valor: carta, faceFinal: 'cima' }));
    sequencia.adicionar(passoMensagem('Sua vez.', 250));
    return;
  }

  const { resultado } = stay(jogo, LADO.OPONENTE);
  mesa.mensagem = `${NOMES.oponente} passou.`;
  if (resultado) {
    sequencia.adicionar(pausa('passou', 700));
    adicionarRevelacao(resultado);
  } else {
    sequencia.adicionar(passoMensagem(`${NOMES.oponente} passou. Sua vez.`, 500));
  }
}

function podeAgir() {
  return !sequencia.ocupado && jogo.fase === FASE.JOGANDO && jogo.turno === LADO.JOGADOR;
}

function aoClicarHit() {
  if (!podeAgir() || !podeComprar(jogo, LADO.JOGADOR)) return;
  const { carta } = hit(jogo, LADO.JOGADOR);
  mesa.mensagem = 'Você compra uma carta.';
  sequencia.adicionar(passoCartaVoando({ nome: 'comprando', lado: 'eu', valor: carta, faceFinal: 'cima' }));
  sequencia.adicionar(passoPensando());
}

function aoClicarStay() {
  if (!podeAgir()) return;
  const { resultado } = stay(jogo, LADO.JOGADOR);
  mesa.mensagem = 'Você passou.';
  mesa.mensagemVermelha = false;
  if (resultado) {
    sequencia.adicionar(pausa('passou', 600));
    adicionarRevelacao(resultado);
  } else {
    sequencia.adicionar(pausa('passou', 400));
    sequencia.adicionar(passoPensando());
  }
}

function aoClicarProxima() {
  if (sequencia.ocupado || jogo.fase !== FASE.RODADA_ENCERRADA) return;
  comecarRodada();
}

function aoClicarReiniciar() {
  if (sequencia.ocupado || jogo.fase !== FASE.FIM_DE_JOGO) return;
  novaPartida();
}

// ---------------------------------------------------------------------
//  Loop de animação
// ---------------------------------------------------------------------

function atualizarBotoes() {
  const jogando = jogo.fase === FASE.JOGANDO;
  const livre = podeAgir();
  const acabou = jogo.fase === FASE.FIM_DE_JOGO && !sequencia.ocupado;

  botaoHit.hidden = !jogando;
  botaoStay.hidden = !jogando;
  botaoHit.disabled = !livre || !podeComprar(jogo, LADO.JOGADOR);
  botaoStay.disabled = !livre;
  botaoProxima.hidden = !(jogo.fase === FASE.RODADA_ENCERRADA && !sequencia.ocupado);
  telaFinal.hidden = !acabou;
  botaoReiniciar.hidden = !acabou;

  // Para o DOM só vai o que os roteiros precisam e que já está na tela:
  // fase, nome da animação e o total do PRÓPRIO jogador. Nunca as cartas do oponente.
  document.body.dataset.fase = jogo.fase;
  document.body.dataset.animacao = sequencia.ocupado
    ? (sequencia.nomeAtual ?? 'aguardando')
    : 'ocioso';
  document.body.dataset.meuTotal = String(mesa.eu.cartas.reduce((s, c) => s + (c.valor ?? 0), 0));
  document.body.dataset.meusDedos = String(mesa.eu.dedos);
  document.body.dataset.dedosDele = String(mesa.adv.dedos);
}

function quadro(agora) {
  lampada.atualizar(agora);
  sequencia.atualizar(agora);
  renderizador.desenhar(mesa, lampada.estado, agora);
  atualizarBotoes();
  document.body.dataset.pronto = '1';
  requestAnimationFrame(quadro);
}

// Depois de cada clique os botões travam na hora, sem esperar o próximo quadro.
botaoHit.addEventListener('click', () => { aoClicarHit(); atualizarBotoes(); });
botaoStay.addEventListener('click', () => { aoClicarStay(); atualizarBotoes(); });
botaoProxima.addEventListener('click', () => { aoClicarProxima(); atualizarBotoes(); });
botaoReiniciar.addEventListener('click', () => { aoClicarReiniciar(); atualizarBotoes(); });

novaPartida();
requestAnimationFrame(quadro);
