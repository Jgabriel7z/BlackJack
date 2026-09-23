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
  avancarNivel,
  FASE,
  LADO,
  RESULTADO,
} from '../engine/game.js';
import { configDoNivel, descreverMorte, SERRA_INICIAL, TRILHO_SERRA } from '../engine/niveis.js';
import { decidirAcao, decidirTrunfo, ACAO } from '../engine/ai.js';
import { criarRng, seedAleatoria } from '../engine/rng.js';
import {
  criarPontuacao,
  pontuarRodada,
  pontuarNivel,
  criarRecorde,
  atualizarRecorde,
  registrarPartida,
} from '../engine/score.js';
import { prepararCatalogo, aplicarTrunfo, podeJogarTrunfo } from '../engine/trumps.js';
import catalogoJson from '../../data/trump_cards.js';
import { NOMES } from '../config.js';
import { lerParametros } from './parametros.js';
import {
  criarRenderizador,
  posicaoSlot,
  posicaoTrunfoNaMao,
  posicaoTrunfoNaMesa,
  POSICOES,
  TRUNFO,
  definirNomeDoAnfitriao,
} from './render.js';
import { criarSequenciador, suavizar, interpolar, limitar, pausa } from './animacao.js';
import { criarLampada } from './lampada.js';

// ---------------------------------------------------------------------
//  Preparação
// ---------------------------------------------------------------------

const parametros = lerParametros(window.location.search);
const sequencia = criarSequenciador(parametros.fatorTempo);
const canvas = document.getElementById('mesa');
const renderizador = criarRenderizador(canvas, { efeitos: parametros.efeitos });

/** Catálogo de cartas trunfo, carregado aqui e entregue pronto ao motor. */
const catalogo = prepararCatalogo(catalogoJson);
const descricaoDoTrunfo = (id) => {
  const carta = catalogo.porId.get(id);
  return { id, nome: carta?.name ?? id, texto: carta?.text_pt ?? '' };
};

const botaoHit = document.getElementById('botao-hit');
const botaoStay = document.getElementById('botao-stay');
const botaoProxima = document.getElementById('botao-proxima');
const botaoReiniciar = document.getElementById('botao-reiniciar');
const telaFinal = document.getElementById('tela-final');

let jogo = null;
let rngVisual = null;
let lampada = null;
let pontuacao = null;

/**
 * Recorde da sessão: fica FORA de `novaPartida`, então sobrevive ao
 * "jogar de novo". Some ao recarregar a página; guardar em disco é da
 * Etapa 4.
 */
const recordeDaSessao = criarRecorde();
/** Quanto tempo o visor de recorde fica piscando depois de ser batido. */
const DURACAO_DO_PISCA = 5000;

/** Tudo que aparece na tela. O render.js só lê este objeto. */
const mesa = {
  eu: { nome: NOMES.jogador, cartas: [], dedos: 5, medidor: 0, aposta: 0, trunfosNaMao: [], trunfosNaMesa: [] },
  adv: { nome: NOMES.oponente, cartas: [], dedos: 5, medidor: 0, aposta: 0, trunfosNaMao: [], trunfosNaMesa: [] },
  // 2.4
  nivel: 1,
  serraPos: SERRA_INICIAL,
  punicao: null,      // { tipo: 'dedos'|'choque'|'serra', lado, fase, progresso }
  kaio: null,         // fala na TV durante a troca de nível
  tvForte: 0,         // 0..1, a TV acesa
  emVoo: null,
  // 2.3
  trunfoEmVoo: null,     // { carta, lado, x, y, escala }
  dica: null,            // { titulo, texto, x, y, origem }
  podeJogarTrunfo: false,
  trocaDeAlvo: null,     // { anterior, progresso } — o "estalo" da placa
  baralhoRestante: 0,
  mensagem: '',
  mensagemVermelha: false,
  pensando: false,
  cabecaAngulo: 0,
  escurecimento: 0,
  // 1.5
  flash: 0,           // 0..1, flash vermelho (ou branco no choque)
  flashBranco: false,
  tremor: 0,          // 0..1, tremor de tela
  telaPreta: 0,       // 0..1, escurecimento total do fim de jogo
  textoFinal: '',
  // 2.1
  pontos: { total: 0, multiplicador: 1, ultimo: null },
  // 2.6
  recorde: { valor: 0, piscando: false, piscandoDesde: null },
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
  jogo = criarJogo({
    seed: parametros.seed ?? seedAleatoria(),
    catalogoTrunfos: catalogo,
    nivel: parametros.nivel ?? 1,
  });
  rngVisual = criarRng((jogo.seed ^ 0x9e3779b9) >>> 0);
  lampada = criarLampada(rngVisual, parametros.fatorTempo);
  pontuacao = criarPontuacao();
  mesa.pontos = { total: 0, multiplicador: 1, ultimo: null };
  // O recorde continua de uma partida para a outra; só o piscar é zerado.
  mesa.recorde = { valor: recordeDaSessao.melhor, piscando: false, piscandoDesde: null };
  mesa.eu.trunfosNaMao = [];
  mesa.eu.trunfosNaMesa = [];
  mesa.adv.trunfosNaMesa = [];
  mesa.trunfoEmVoo = null;
  mesa.dica = null;
  mesa.trocaDeAlvo = null;

  mesa.eu.cartas = [];
  mesa.adv.cartas = [];
  mesa.eu.dedos = 5;
  mesa.adv.dedos = 5;
  mesa.eu.medidor = 0;
  mesa.adv.medidor = 0;
  mesa.eu.aposta = 0;
  mesa.adv.aposta = 0;
  mesa.nivel = jogo.nivel;
  mesa.serraPos = jogo.serra;
  mesa.punicao = null;
  mesa.kaio = null;
  mesa.tvForte = 0;
  mesa.emVoo = null;
  mesa.baralhoRestante = 0;
  mesa.mensagem = '';
  mesa.mensagemVermelha = false;
  mesa.pensando = false;
  mesa.cabecaAngulo = 0;
  mesa.escurecimento = 0;
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
      // Pontuação da rodada (só o jogador pontua; derrota e empate zeram a sequência).
      const detalhe = pontuarRodada(pontuacao, resultado, { alvo: jogo.alvo });
      mesa.pontos.total = pontuacao.total;
      mesa.pontos.multiplicador = pontuacao.vitoriasSeguidas >= 2 ? detalhe.multiplicador : 1;
      mesa.pontos.ultimo = detalhe;
      conferirRecorde();
      mesa.mensagem = descreverResultado(resultado) + descreverPontos(detalhe);
      mesa.mensagemVermelha = resultado.vencedor !== RESULTADO.JOGADOR;
    },
    aoAtualizar(p) {
      mesa.escurecimento = interpolar(0.55, 0.15, suavizar.entradaSaida(p));
    },
  });

  adicionarPunicao(resultado);

  if (jogo.fase === FASE.FIM_DE_JOGO) adicionarFimDeJogo();
  else if (jogo.fase === FASE.NIVEL_CONCLUIDO) adicionarTrocaDeNivel();
}

/** Punição de quem perdeu, conforme o aparelho do nível (nos dois, no empate). */
function adicionarPunicao(resultado) {
  for (const punicao of resultado.punicoes) {
    if (punicao.quantidade === 0) continue;
    const lado = punicao.lado === LADO.JOGADOR ? 'eu' : 'adv';
    const dono = lado === 'eu' ? 'a sua mão' : `a mão de ${NOMES.oponente}`;

    if (punicao.tipo === 'dedos') adicionarGuilhotina(lado, dono, punicao);
    else if (punicao.tipo === 'choque') adicionarChoque(lado, dono, punicao);
    else adicionarSerra(lado, punicao);
  }
}

/** Nível 1: a lâmina desce, bate com tremor e flash, os dedos somem, a lâmina sobe. */
function adicionarGuilhotina(lado, dono, punicao) {
  sequencia.adicionar({
    nome: 'punicao',
    duracao: 520,
    aoIniciar() {
      mesa.punicao = { tipo: 'dedos', lado, progresso: 0, fase: 'descendo' };
      mesa.mensagem = `A lâmina desce sobre ${dono}.`;
      mesa.mensagemVermelha = true;
    },
    aoAtualizar(p) { mesa.punicao.progresso = suavizar.entradaCubica(p); },
  });
  sequencia.adicionar({
    nome: 'punicao',
    duracao: 420,
    aoIniciar() {
      mesa.punicao.fase = 'impacto';
      mesa.punicao.progresso = 1;
      mesa[lado].dedos = punicao.restante;   // o dedo simplesmente some
      mesa.flashBranco = false;
      mesa.flash = 1;
      mesa.tremor = 1;
    },
    aoAtualizar(p) {
      mesa.flash = (1 - p) ** 2;
      mesa.tremor = 1 - p;
    },
    aoTerminar() { mesa.flash = 0; mesa.tremor = 0; },
  });
  sequencia.adicionar({
    nome: 'punicao',
    duracao: 800,
    aoIniciar() { mesa.punicao.fase = 'subindo'; },
    aoAtualizar(p) { mesa.punicao.progresso = 1 - suavizar.entradaSaida(p); },
    aoTerminar() { mesa.punicao = null; },
  });
  sequencia.adicionar(pausa('punicao', 350));
}

/** Nível 2: o aparelho carrega, dispara com flash branco e tremor, e o ponteiro sobe. */
function adicionarChoque(lado, dono, punicao) {
  sequencia.adicionar({
    nome: 'punicao',
    duracao: 900,
    aoIniciar() {
      mesa.punicao = { tipo: 'choque', lado, progresso: 0, fase: 'carregando' };
      mesa.mensagem = `O aparelho carrega sobre ${dono}.`;
      mesa.mensagemVermelha = true;
    },
    aoAtualizar(p) { mesa.punicao.progresso = p; },
  });
  sequencia.adicionar({
    nome: 'punicao',
    duracao: 700,
    aoIniciar() {
      mesa.punicao.fase = 'descarga';
      mesa.flashBranco = true;
      mesa.flash = 1;
      mesa.tremor = 1;
      mesa.mensagem = `Nível ${punicao.para}.`;
    },
    aoAtualizar(p) {
      // o ponteiro sobe junto com a descarga
      mesa[lado].medidor = interpolar(punicao.de, punicao.para, suavizar.saidaCubica(p));
      mesa.flash = (1 - p) ** 1.6 * (0.6 + 0.4 * Math.abs(Math.sin(p * 40)));
      mesa.tremor = (1 - p) * 0.9;
    },
    aoTerminar() {
      mesa[lado].medidor = punicao.para;
      mesa.flash = 0;
      mesa.tremor = 0;
      mesa.flashBranco = false;
    },
  });
  sequencia.adicionar({
    nome: 'punicao',
    duracao: 600,
    aoTerminar() { mesa.punicao = null; },
  });
}

/** Nível 3: a serra anda pelo trilho na direção de quem perdeu. */
function adicionarSerra(lado, punicao) {
  const chegou = punicao.para <= 0 || punicao.para >= TRILHO_SERRA;
  sequencia.adicionar({
    nome: 'punicao',
    duracao: 400 + Math.abs(punicao.para - punicao.de) * 260,
    aoIniciar() {
      mesa.punicao = { tipo: 'serra', lado, progresso: 0, fase: 'andando' };
      mesa.mensagem = lado === 'eu'
        ? 'A serra anda na sua direção.'
        : `A serra anda na direção de ${NOMES.oponente}.`;
      mesa.mensagemVermelha = true;
    },
    aoAtualizar(p) {
      mesa.punicao.progresso = p;
      mesa.serraPos = interpolar(punicao.de, punicao.para, suavizar.entradaSaida(p));
      mesa.tremor = chegou ? p * 0.5 : 0;
    },
    aoTerminar() {
      mesa.serraPos = punicao.para;
      mesa.tremor = 0;
      // Chegou no fim do trilho: corta para preto, sem mostrar nada.
      if (chegou) {
        mesa.telaPreta = 1;
        mesa.mensagem = '';
      }
    },
  });
  sequencia.adicionar({
    nome: 'punicao',
    duracao: chegou ? 900 : 400,
    aoTerminar() { mesa.punicao = null; },
  });
}

/**
 * Entre um nível e outro: a tela escurece, a TV liga com chiado, o Kaio
 * fala uma ou duas frases como legenda, e a mesa volta com o aparelho novo.
 */
function adicionarTrocaDeNivel() {
  const proximo = configDoNivel(jogo.nivel + 1);

  // A troca de nível roda sempre em velocidade normal, mesmo com ?rapido=1:
  // é preciso dar tempo de ler a fala do anfitrião.
  sequencia.adicionar({ ...pausa('trocando-nivel', 500), ritmoReal: true });
  sequencia.adicionar({
    nome: 'trocando-nivel',
    duracao: 1100,
    ritmoReal: true,
    aoIniciar() {
      mesa.mensagem = '';
      mesa.dica = null;
    },
    aoAtualizar(p) {
      mesa.escurecimento = interpolar(0.15, 0.88, suavizar.entradaSaida(p));
      mesa.tvForte = suavizar.entradaSaida(p);
    },
  });

  for (const fala of proximo.fala) {
    sequencia.adicionar({
      nome: 'trocando-nivel',
      duracao: 2600,
      ritmoReal: true,
      aoIniciar() {
        mesa.kaio = fala;
        mesa.tvForte = 1;
      },
    });
  }

  sequencia.adicionar({
    nome: 'trocando-nivel',
    duracao: 900,
    ritmoReal: true,
    aoIniciar() {
      mesa.kaio = null;
      // Só agora o motor troca o aparelho: a mesa volta já com o novo.
      avancarNivel(jogo);
      mesa.nivel = jogo.nivel;
      mesa.eu.dedos = 5;
      mesa.adv.dedos = 5;
      mesa.eu.medidor = 0;
      mesa.adv.medidor = 0;
      mesa.serraPos = jogo.serra;
      mesa.eu.cartas = [];
      mesa.adv.cartas = [];
      sincronizarTrunfos();
    },
    aoAtualizar(p) {
      mesa.escurecimento = interpolar(0.88, 0, suavizar.entradaSaida(p));
      mesa.tvForte = 1 - suavizar.entradaSaida(p);
    },
    aoTerminar() {
      mesa.escurecimento = 0;
      mesa.tvForte = 0;
      mesa.mensagem = `Nível ${jogo.nivel}: ${proximo.nome}.`;
      mesa.mensagemVermelha = false;
    },
  });
  sequencia.adicionar({ ...pausa('trocando-nivel', 700), ritmoReal: true });
  sequencia.adicionar({
    nome: 'trocando-nivel',
    duracao: 0,
    aoTerminar() { comecarRodada(); },
  });
}

/** Tela preta e um texto seco. O botão de jogar de novo aparece quando a fila esvazia. */
function adicionarFimDeJogo() {
  sequencia.adicionar(pausa('fim', 600));
  sequencia.adicionar({
    nome: 'fim',
    duracao: 1400,
    aoIniciar() {
      mesa.mensagem = '';
      // Vencer o último nível: +500, fora do multiplicador.
      if (jogo.vencedorDoJogo === LADO.JOGADOR) {
        pontuarNivel(pontuacao);
        mesa.pontos.total = pontuacao.total;
      }
      conferirRecorde();
      registrarPartida(recordeDaSessao);
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
//  Cartas trunfo na tela (2.3)
// ---------------------------------------------------------------------

/** Copia do motor para a mesa visual o que é público: minha mão e as duas mesas. */
function sincronizarTrunfos() {
  const visao = verMesa(jogo, LADO.JOGADOR);
  mesa.eu.trunfosNaMao = visao.eu.trunfos.map(descricaoDoTrunfo);
  mesa.eu.trunfosNaMesa = visao.eu.trunfosNaMesa.map((c) => descricaoDoTrunfo(c.id));
  mesa.adv.trunfosNaMesa = visao.adversario.trunfosNaMesa.map((c) => descricaoDoTrunfo(c.id));
  mesa.alvo = visao.alvo;
}

/**
 * A carta sai de onde estava, voa até a mesa de quem jogou e encolhe.
 * `inicio` é o canto de onde ela parte: a mão do jogador, ou as mãos do
 * oponente (a mão de trunfos dele é secreta, então não há de onde sair).
 */
function passoTrunfoVoando(carta, inicio, lado = 'eu') {
  let destino;
  return {
    nome: 'jogando-trunfo',
    duracao: 520,
    aoIniciar() {
      destino = posicaoTrunfoNaMesa(lado, Math.max(0, mesa[lado].trunfosNaMesa.length - 1));
      mesa.trunfoEmVoo = { carta, lado, x: inicio.x, y: inicio.y, escala: 1 };
    },
    aoAtualizar(p) {
      const e = suavizar.saidaCubica(p);
      const escala = interpolar(1, TRUNFO_MESA_ESCALA, e);
      // mira o centro do destino, compensando a carta ter encolhido
      const alvoX = destino.x + destino.largura / 2 - (TRUNFO.largura * escala) / 2;
      const alvoY = destino.y + destino.altura / 2 - (TRUNFO.altura * escala) / 2;
      mesa.trunfoEmVoo.x = interpolar(inicio.x, alvoX, e);
      mesa.trunfoEmVoo.y = interpolar(inicio.y, alvoY, e) - Math.sin(p * Math.PI) * 30;
      mesa.trunfoEmVoo.escala = escala;
    },
    aoTerminar() {
      mesa.trunfoEmVoo = null;
    },
  };
}
const TRUNFO_MESA_ESCALA = 40 / 66; // largura da carta na mesa dividida pela da mão

/** O "estalo" da placa quando uma carta Go For muda o alvo. */
function passoTrocaDeAlvo(anterior, novo) {
  return {
    nome: 'trocando-alvo',
    duracao: 700,
    aoIniciar() {
      mesa.alvo = novo;
      mesa.trocaDeAlvo = { anterior, progresso: 0 };
      mesa.mensagem = `O alvo agora é ${novo}.`;
      mesa.mensagemVermelha = false;
    },
    aoAtualizar(p) {
      mesa.trocaDeAlvo.progresso = p;
    },
    aoTerminar() {
      mesa.trocaDeAlvo = null;
    },
  };
}

function aoClicarEmTrunfo(indice) {
  if (!podeAgir()) return;
  const carta = mesa.eu.trunfosNaMao[indice];
  if (!carta || !podeJogarTrunfo(jogo, LADO.JOGADOR, carta.id)) return;

  const totalAntes = mesa.eu.trunfosNaMao.length;
  const alvoAntes = mesa.alvo;

  const relatorio = aplicarTrunfo(jogo, LADO.JOGADOR, carta.id);
  mesa.dica = null;
  sincronizarTrunfos();

  mesa.mensagem = `Você jogou ${carta.nome}. ${carta.texto}`;
  mesa.mensagemVermelha = false;

  if (relatorio.ficouNaMesa) {
    sequencia.adicionar(passoTrunfoVoando(carta, posicaoTrunfoNaMao(indice, totalAntes), 'eu'));
  }
  if (mesa.alvo !== alvoAntes) {
    sequencia.adicionar(passoTrocaDeAlvo(alvoAntes, mesa.alvo));
  }
  // Cartas que compram (2..7 Card, Perfect Draw) mudam a mão numérica na hora.
  const visao = verMesa(jogo, LADO.JOGADOR);
  redesenharMinhasCartas(visao);
}

/** Recria os sprites das minhas cartas numéricas depois de um efeito que mexeu nelas. */
function redesenharMinhasCartas(visao) {
  const ocultaAnterior = mesa.eu.cartas[0];
  mesa.eu.cartas = [
    { valor: visao.eu.oculta, face: 'cima', marcaOculta: ocultaAnterior?.marcaOculta ?? true, escalaX: 1, x: 0, y: 0 },
    ...visao.eu.abertas.map((v) => ({ valor: v, face: 'cima', marcaOculta: false, escalaX: 1, x: 0, y: 0 })),
  ];
  mesa.eu.cartas.forEach((carta, i) => {
    const p = posicaoSlot('eu', i);
    carta.x = p.x;
    carta.y = p.y;
  });
  mesa.adv.cartas.forEach((carta, i) => {
    const p = posicaoSlot('adv', i);
    carta.x = p.x;
    carta.y = p.y;
  });
  mesa.baralhoRestante = visao.cartasNoBaralho;
}

// ---------------------------------------------------------------------
//  Mouse
// ---------------------------------------------------------------------

function pontoNoCanvas(evento) {
  const r = canvas.getBoundingClientRect();
  return {
    x: (evento.clientX - r.left) * (canvas.width / r.width),
    y: (evento.clientY - r.top) * (canvas.height / r.height),
  };
}

const dentro = (p, caixa) => p.x >= caixa.x && p.x <= caixa.x + caixa.largura
  && p.y >= caixa.y && p.y <= caixa.y + caixa.altura;

/** Descobre qual carta trunfo está sob o cursor. Devolve { origem, carta, indice } ou null. */
function trunfoSobOCursor(p) {
  const mao = mesa.eu.trunfosNaMao;
  for (let i = mao.length - 1; i >= 0; i--) {   // de cima para baixo (as últimas ficam por cima)
    if (dentro(p, posicaoTrunfoNaMao(i, mao.length))) {
      return { origem: `mao-${i}`, carta: mao[i], indice: i };
    }
  }
  for (const lado of ['eu', 'adv']) {
    const jogadas = mesa[lado].trunfosNaMesa;
    for (let i = jogadas.length - 1; i >= 0; i--) {
      if (dentro(p, posicaoTrunfoNaMesa(lado, i))) {
        return { origem: `mesa-${lado}-${i}`, carta: jogadas[i], indice: i };
      }
    }
  }
  return null;
}

function aoMoverMouse(evento) {
  const p = pontoNoCanvas(evento);
  const achado = trunfoSobOCursor(p);
  if (!achado) {
    mesa.dica = null;
    canvas.style.cursor = 'default';
    return;
  }
  const naMao = achado.origem.startsWith('mao-');
  const caixa = naMao
    ? posicaoTrunfoNaMao(achado.indice, mesa.eu.trunfosNaMao.length)
    : posicaoTrunfoNaMesa(achado.origem.split('-')[1], achado.indice);
  mesa.dica = {
    titulo: achado.carta.nome,
    texto: achado.carta.texto,
    x: caixa.x + caixa.largura / 2,
    y: caixa.y,
    origem: achado.origem,
  };
  canvas.style.cursor = naMao && podeAgir() ? 'pointer' : 'default';
}

function aoClicarNoCanvas(evento) {
  const achado = trunfoSobOCursor(pontoNoCanvas(evento));
  if (achado?.origem.startsWith('mao-')) aoClicarEmTrunfo(achado.indice);
  atualizarBotoes();
}

// ---------------------------------------------------------------------
//  Textos
// ---------------------------------------------------------------------

function plural(n, singular, pluralTexto) {
  return `${n} ${n === 1 ? singular : pluralTexto}`;
}

/** O que a punição custa neste nível, em palavras. */
function custoDaPunicao(punicao) {
  if (!punicao) return 'nada';
  if (punicao.tipo === 'dedos') return plural(punicao.quantidade, 'dedo', 'dedos');
  if (punicao.tipo === 'choque') return `um choque de nível ${punicao.para}`;
  return `${plural(punicao.quantidade, 'marca', 'marcas')} de serra`;
}

function descreverResultado(r) {
  const tj = r.totais.jogador;
  const to = r.totais.oponente;
  const primeira = r.punicoes[0];
  const custo = custoDaPunicao(primeira);
  const verbo = primeira?.tipo === 'choque' ? 'leva' : 'perde';

  if (r.vencedor === RESULTADO.EMPATE) {
    if (!primeira) return `Empate: ${tj} a ${to}. A serra não se mexe.`;
    return `Empate: ${tj} a ${to}. Os dois ${verbo}m ${custo}.`;
  }
  if (r.vencedor === RESULTADO.JOGADOR) {
    const detalhe = r.estourou.oponente ? ' (ele estourou)' : '';
    return `Você venceu: ${tj} contra ${to}${detalhe}. ${NOMES.oponente} ${verbo} ${custo}.`;
  }
  const detalhe = r.estourou.jogador ? ' (você estourou)' : '';
  return `${NOMES.oponente} venceu: ${to} contra ${tj}${detalhe}. Você ${verbo} ${custo}.`;
}

/**
 * Compara a pontuação atual com o recorde da sessão. O visor acompanha a
 * pontuação, e começa a piscar quando um recorde anterior é superado.
 */
function conferirRecorde() {
  const { bateu, melhor } = atualizarRecorde(recordeDaSessao, pontuacao.total);
  mesa.recorde.valor = melhor;
  if (bateu) mesa.recorde.piscandoDesde = performance.now();
}

/** Sufixo da mensagem de resultado com os pontos da rodada. */
function descreverPontos(detalhe) {
  if (!detalhe.venceu) return '';
  const mult = detalhe.multiplicador > 1 ? ` ×${String(detalhe.multiplicador).replace('.', ',')}` : '';
  return ` +${detalhe.pontos} pontos${mult}.`;
}

function descreverFim() {
  if (jogo.vitoriaFinal) return `${NOMES.jogador} saiu da mesa inteiro.`;
  if (jogo.vencedorDoJogo === 'ninguem') return 'Ninguém saiu desta mesa.';
  if (jogo.vencedorDoJogo === LADO.OPONENTE) return `${NOMES.jogador} perdeu.`;
  return descreverMorte(jogo.nivel, NOMES.oponente);
}

// ---------------------------------------------------------------------
//  Fluxo da partida
// ---------------------------------------------------------------------

function comecarRodada() {
  iniciarRodada(jogo);

  // ?trunfos=two_up,shield,go_for_24 fixa a mão da primeira rodada (testes e captura).
  if (parametros.trunfos && jogo.rodada === 1) {
    jogo.jogadores[LADO.JOGADOR].trunfos = parametros.trunfos.filter((id) => catalogo.porId.has(id));
  }

  const visao = verMesa(jogo, LADO.JOGADOR);

  mesa.rodada = visao.rodada;
  mesa.eu.aposta = visao.eu.aposta;
  mesa.adv.aposta = visao.adversario.aposta;
  mesa.eu.cartas = [];
  mesa.adv.cartas = [];
  mesa.alvo = visao.alvo;
  mesa.trocaDeAlvo = null;
  sincronizarTrunfos();
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

/**
 * A partir do nível 2 o oponente joga uma carta trunfo antes de decidir
 * comprar ou parar. Devolve true se jogou (e a vez dele continua depois).
 */
function trunfoDoOponente() {
  const id = decidirTrunfo(jogo, LADO.OPONENTE);
  if (!id) return false;

  const carta = descricaoDoTrunfo(id);
  const relatorio = aplicarTrunfo(jogo, LADO.OPONENTE, id);
  const alvoAntes = mesa.alvo;
  sincronizarTrunfos();

  mesa.mensagem = `${NOMES.oponente} jogou ${carta.nome}. ${carta.texto}`;
  mesa.mensagemVermelha = true;

  if (relatorio.ficouNaMesa) {
    // A mão de trunfos dele é secreta: a carta sai de perto das mãos dele.
    sequencia.adicionar(passoTrunfoVoando(carta, { x: POSICOES.luizCentroX - 33, y: 150 }, 'adv'));
  }
  if (mesa.alvo !== alvoAntes) sequencia.adicionar(passoTrocaDeAlvo(alvoAntes, mesa.alvo));
  sequencia.adicionar(pausa('jogando-trunfo', 700));
  redesenharMinhasCartas(verMesa(jogo, LADO.JOGADOR));
  return true;
}

function jogadaDoOponente() {
  // Primeiro a carta trunfo, depois a jogada. Uma carta por vez dele.
  if (trunfoDoOponente()) {
    sequencia.adicionar({ nome: 'jogando-trunfo', duracao: 0, aoTerminar: jogadaDoOponente });
    return;
  }

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
  const { carta, trunfoGanho } = hit(jogo, LADO.JOGADOR);
  mesa.mensagem = trunfoGanho
    ? 'Você compra uma carta, e veio uma carta trunfo junto.'
    : 'Você compra uma carta.';
  sequencia.adicionar(passoCartaVoando({ nome: 'comprando', lado: 'eu', valor: carta, faceFinal: 'cima' }));
  if (trunfoGanho) sequencia.adicionar({ nome: 'comprando', duracao: 0, aoTerminar: sincronizarTrunfos });
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
  mesa.podeJogarTrunfo = livre;

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
  document.body.dataset.pontos = String(mesa.pontos.total);
  document.body.dataset.recorde = String(mesa.recorde.valor);
  document.body.dataset.recordePiscando = mesa.recorde.piscando ? '1' : '0';
  document.body.dataset.alvo = String(mesa.alvo);
  document.body.dataset.nivel = String(mesa.nivel);
  document.body.dataset.rodada = String(mesa.rodada);
  document.body.dataset.medidorMeu = mesa.eu.medidor.toFixed(0);
  document.body.dataset.medidorDele = mesa.adv.medidor.toFixed(0);
  document.body.dataset.serra = String(jogo.serra);
  // Minha mão de trunfos e onde cada carta está na tela — tudo já visível para
  // quem joga; serve para os roteiros de captura clicarem sem adivinhar posição.
  document.body.dataset.trunfoSlots = mesa.eu.trunfosNaMao.map((carta, i) => {
    const p = posicaoTrunfoNaMao(i, mesa.eu.trunfosNaMao.length);
    return `${carta.id}@${Math.round(p.x + p.largura / 2)},${Math.round(p.y + p.altura / 2)}`;
  }).join(';');
  document.body.dataset.trunfosNaMesa = mesa.eu.trunfosNaMesa.map((c) => c.id).join(',');
}

function quadro(agora) {
  // O visor do recorde pisca por alguns segundos depois de ser batido.
  if (mesa.recorde.piscandoDesde !== null) {
    const decorrido = agora - mesa.recorde.piscandoDesde;
    mesa.recorde.piscando = decorrido < DURACAO_DO_PISCA * parametros.fatorTempo;
    if (!mesa.recorde.piscando) mesa.recorde.piscandoDesde = null;
  }

  lampada.atualizar(agora);
  sequencia.atualizar(agora);
  renderizador.desenhar(mesa, lampada.estado, agora);
  atualizarBotoes();
  document.body.dataset.pronto = '1';
  requestAnimationFrame(quadro);
}

canvas.addEventListener('mousemove', aoMoverMouse);
canvas.addEventListener('mouseleave', () => { mesa.dica = null; });
canvas.addEventListener('click', aoClicarNoCanvas);

// Depois de cada clique os botões travam na hora, sem esperar o próximo quadro.
botaoHit.addEventListener('click', () => { aoClicarHit(); atualizarBotoes(); });
botaoStay.addEventListener('click', () => { aoClicarStay(); atualizarBotoes(); });
botaoProxima.addEventListener('click', () => { aoClicarProxima(); atualizarBotoes(); });
botaoReiniciar.addEventListener('click', () => { aoClicarReiniciar(); atualizarBotoes(); });

definirNomeDoAnfitriao(NOMES.anfitriao);
novaPartida();
requestAnimationFrame(quadro);
