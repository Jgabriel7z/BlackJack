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
  atualizarRecorde,
  registrarPartida,
} from '../engine/score.js';
import {
  normalizar as normalizarProgresso,
  criarEstatisticas,
  anotarRodada,
  anotarPartida,
  anotarTrunfoUsado,
  anotarTrunfoRemovido,
  cartasSorteaveis,
  vagasAMaisNaMao,
  RECOMPENSAS,
} from '../engine/progresso.js';
import {
  criarTrapaca,
  deveTrapacear,
  prepararTrapaca,
  aplicarTrapaca,
} from '../engine/trapaca.js';
import { criarAnfitriao, comentarSobre } from '../engine/anfitriao.js';
import { criarArmazenamento } from './armazenamento.js';
import { criarAudio } from './audio.js';
import { tensaoDaCena, intensidadeDoPerigo } from './tensao.js';
import {
  posicaoNoPlacar,
  registrar as registrarNoPlacar,
  criarEntradaDeIniciais,
  teclarIniciais,
  textoDasIniciais,
} from '../engine/placar.js';
import {
  prepararCatalogo,
  aplicarTrunfo,
  podeJogarTrunfo,
  raridadeDaCarta,
  chanceDaCarta,
  CARTAS_DO_JOGADOR,
} from '../engine/trumps.js';
import catalogoJson from '../../data/trump_cards.js';
import { NOMES, EQUIPE, TITULO, TRUNFOS, FALA_DA_VITORIA, FALA_DA_TRAPACA } from '../config.js';
import { lerParametros } from './parametros.js';
import {
  criarRenderizador,
  posicaoSlot,
  posicaoTrunfoNaMao,
  posicaoTrunfoNaMesa,
  POSICOES,
  TRUNFO,
  ALTURA,
  definirNomeDoAnfitriao,
  definirTextosDoTitulo,
} from './render.js';
import { criarSequenciador, suavizar, interpolar, limitar, pausa } from './animacao.js';
import { criarLampada } from './lampada.js';
import { criarTelas, TELA } from './telas.js';

// ---------------------------------------------------------------------
//  Preparação
// ---------------------------------------------------------------------

const parametros = lerParametros(window.location.search);
const sequencia = criarSequenciador(parametros.fatorTempo);
const canvas = document.getElementById('mesa');
/**
 * Todo o som (4.2). Só liga depois de um gesto do usuário, porque o
 * navegador não deixa tocar antes disso.
 */
const audio = criarAudio();
function garantirSom() {
  if (!audio.ligado && !audio.falhou) {
    audio.ligar();
    mesa.som.ligado = audio.ligado;
  }
}
// `?efeitos=0` desliga na marra; sem ele vale o que estiver guardado (4.3).
const renderizador = criarRenderizador(canvas, { efeitos: parametros.efeitos });

/**
 * O que estava guardado da última vez (4.1). Se o localStorage não
 * funcionar, `normalizarProgresso(null)` devolve um progresso zerado e o
 * jogo segue na memória — o título avisa que não dá para salvar.
 */
const guarda = criarArmazenamento();
const progresso = normalizarProgresso(guarda.carregar());

/**
 * Catálogo de cartas trunfo, carregado aqui e entregue pronto ao motor.
 * As cartas que ainda não foram desbloqueadas ficam fora do SORTEIO, mas
 * continuam no catálogo: assim `?trunfos=` ainda consegue forçá-las.
 */
let catalogo = montarCatalogo();

function montarCatalogo() {
  return prepararCatalogo(catalogoJson, {
    sorteaveis: cartasSorteaveis(progresso, CARTAS_DO_JOGADOR),
    // A Desperation não é carta de mão: só o anfitrião joga, na trapaça.
    extras: ['desperation'],
  });
}
const descricaoDoTrunfo = (id) => {
  const carta = catalogo.porId.get(id);
  return { id, nome: carta?.name ?? id, texto: carta?.text_pt ?? '' };
};

const botaoHit = document.getElementById('botao-hit');
const botaoStay = document.getElementById('botao-stay');
const botaoProxima = document.getElementById('botao-proxima');
const botaoReiniciar = document.getElementById('botao-reiniciar');
const botaoTelaCheia = document.getElementById('botao-tela-cheia');
const palco = document.getElementById('palco');
const telaFinal = document.getElementById('tela-final');

let jogo = null;
let rngVisual = null;
/** Duas coisas que a partida inteira precisa lembrar, para as recompensas. */
let estourouNaPartida = false;
let levouPunicaoNaPartida = false;
/** O estado da trapaça do anfitrião nesta partida (4.8). */
let trapaca = criarTrapaca();
/** Quem decide quando o Kaio abre a boca durante a rodada. */
let anfitriao = null;
/** Quanto tempo um comentário dele fica na tela. */
const DURACAO_DO_COMENTARIO = 5200;
let lampada = null;
let pontuacao = null;

/**
 * O recorde fica FORA de `novaPartida`, então sobrevive ao "jogar de
 * novo" — e, desde o 4.1, também a fechar o navegador: ele é o mesmo
 * objeto que vai para o localStorage.
 */
const recordeDaSessao = progresso.recorde;
/** Quanto tempo o visor de recorde fica piscando depois de ser batido. */
const DURACAO_DO_PISCA = 5000;

/**
 * As cinco melhores (3.4). Desde o 4.1 são os mesmos objetos guardados
 * em `progresso`, então atravessam o recarregar da página.
 * `entradaIniciais` só existe enquanto o jogador digita as três letras.
 */
const placarDaSessao = progresso.placar;
let entradaIniciais = null;

/**
 * Demonstração (attract mode, 3.5): a máquina joga contra ela mesma
 * enquanto ninguém encosta. Usa a mesma mesa, as mesmas animações e o
 * mesmo motor da partida de verdade — só que os dois lados são a IA, e
 * nada do que acontece ali entra no recorde nem na lista das melhores.
 */
let demonstracao = false;
/** A cabeça de IA usada nos DOIS lados na demonstração. */
const NIVEL_DA_DEMO = 2;
/** Gerador só das seeds da demonstração: com ?seed a vitrine também se repete. */
const rngDemo = criarRng(((parametros.seed ?? seedAleatoria()) ^ 0xc2b2ae35) >>> 0);
const proximaSeedDaDemo = () => Math.floor(rngDemo() * 0xffffffff) >>> 0;
/** As letras da ultima vez, para a proxima partida ja vir com elas. */
let ultimasIniciais = 'AAA';

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
  // O Kaio comentando a rodada: { texto, ate } enquanto está no ar.
  comentario: null,
  // 4.8
  trapaca: { forca: 0 },   // 0..1, a luz virando e a TV gritando
  // ajuste depois de jogar
  dificil: false,     // o Luiz Alberto na cabeça do nível 3 desde o começo
  // 4.3
  tremorAmbiente: 0,
  efeitos: { ligados: true },
  // 4.2
  som: { ligado: false, mudo: false },
  // 4.1
  desbloqueios: [],   // nomes das recompensas ganhas nesta partida
  dados: {            // o estado do que está guardado, para o título
    salvando: true,
    pedindoApagar: false,
    apagadoHa: null,
    desbloqueadas: 0,
    total: RECOMPENSAS.length,
  },
  // 3.4
  placar: { entradas: [], destaque: -1 },
  iniciais: null,     // { letras, cursor, linha, pontos, restante } enquanto digita
  // 3.1 e 3.2
  tela: TELA.TITULO,
  tempoNaTela: 0,
  duracaoDoLigar: TITULO.ligarTv * parametros.fatorTempo,
  piscaConvite: TITULO.piscaConvite,
  rodada: 0,
  alvo: 21,
  seed: null,
  rapido: parametros.rapido,
};

/**
 * Cria (ou recria) a partida e zera a mesa. Com ?seed na URL a mesma
 * partida se repete; sem seed, cada partida sorteia uma nova.
 */
function novaPartida(opcoes = {}) {
  jogo = criarJogo({
    seed: opcoes.seed ?? parametros.seed ?? seedAleatoria(),
    catalogoTrunfos: catalogo,
    nivel: parametros.nivel ?? 1,
    // Recompensa da tabela A5: vagas a mais na mão de trunfos.
    maximoNaMao: TRUNFOS.maximoNaMao + (demonstracao ? 0 : vagasAMaisNaMao(progresso)),
  });
  rngVisual = criarRng((jogo.seed ^ 0x9e3779b9) >>> 0);
  // Gerador só das falas: assim mudar o que ele diz não mexe no piscar
  // da lâmpada nem no tempo que o oponente leva pensando.
  anfitriao = criarAnfitriao(criarRng((jogo.seed ^ 0x5bd1e995) >>> 0));
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
  mesa.desbloqueios = [];
  estourouNaPartida = false;
  levouPunicaoNaPartida = false;
  trapaca = criarTrapaca();
  mesa.trapaca = { forca: 0 };
  mesa.comentario = null;
  // Começando direto no nível 3 (?nivel=3), a carta da saída já vem.
  prepararTrapaca(jogo);

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
      audio.carta();
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
      // Os dois pararam: corta o ambiente e fica só a carta virando (B4).
      audio.silencioDaRevelacao();
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
      audio.voltarDoSilencio();
      // Pontuação da rodada (só o jogador pontua; derrota e empate zeram a sequência).
      const detalhe = pontuarRodada(pontuacao, resultado, { alvo: jogo.alvo });
      mesa.pontos.total = pontuacao.total;
      mesa.pontos.multiplicador = pontuacao.vitoriasSeguidas >= 2 ? detalhe.multiplicador : 1;
      mesa.pontos.ultimo = detalhe;
      if (!demonstracao) {
        conferirRecorde();
        // Estatísticas e recompensas (4.1). O alvo é o da placa, que pode
        // não ser 21 depois de uma carta "Go For".
        if (resultado.estourou.jogador) estourouNaPartida = true;
        if (resultado.punicoes.some((p) => p.lado === LADO.JOGADOR && p.quantidade > 0)) {
          levouPunicaoNaPartida = true;
        }
        anunciarNovidades(anotarRodada(progresso, {
          total: resultado.totais.jogador,
          alvo: mesa.alvo,
        }));
        salvarProgresso();
      }
      mesa.mensagem = descreverResultado(resultado) + descreverPontos(detalhe);
      mesa.mensagemVermelha = resultado.vencedor !== RESULTADO.JOGADOR;
    },
    aoAtualizar(p) {
      mesa.escurecimento = interpolar(0.55, 0.15, suavizar.entradaSaida(p));
    },
  });

  adicionarPunicao(resultado);

  // Só agora, com a lâmina já tendo descido e a mesa atualizada, ele
  // comenta. Antes disso ele estaria falando por cima do resultado.
  sequencia.adicionar({
    nome: 'comentario',
    duracao: 0,
    aoTerminar() { comentarARodada(resultado); },
  });

  if (jogo.fase === FASE.FIM_DE_JOGO) adicionarFimDeJogo();
  else if (jogo.fase === FASE.NIVEL_CONCLUIDO) adicionarTrocaDeNivel();
  // Na demonstração ninguém aperta "próxima rodada": ela vem sozinha.
  else if (demonstracao) {
    sequencia.adicionar({ nome: 'proxima-rodada', duracao: 1600, aoTerminar: comecarRodada });
  }
}

/** Punição de quem perdeu, conforme o aparelho do nível (nos dois, no empate). */
function adicionarPunicao(resultado) {
  for (const punicao of resultado.punicoes) {
    if (punicao.quantidade === 0) continue;
    const lado = punicao.lado === LADO.JOGADOR ? 'eu' : 'adv';
    const dono = lado === 'eu' ? maoDeCa() : `a mão de ${NOMES.oponente}`;

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
      audio.lamina();
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
      audio.impacto();
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
      audio.capacitor(0.9);
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
      audio.descarga();
      audio.impacto();
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
      audio.passoDaSerra();
      mesa.punicao = { tipo: 'serra', lado, progresso: 0, fase: 'andando' };
      const alvoDaSerra = lado === 'eu' ? ladoDeCa() : NOMES.oponente;
      mesa.mensagem = lado === 'eu' && !demonstracao
        ? 'A serra anda na sua direção.'
        : `A serra anda na direção de ${alvoDaSerra}.`;
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
        audio.impacto();
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
        audio.voz(fala);
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
      // Entrando na serra, o jogador ganha a carta que pode salvá-lo (4.8).
      prepararTrapaca(jogo);
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

/**
 * A partida acabou. A sala apaga e então:
 *   - perdeu: vai para a tela de fim de jogo, que volta ao título sozinha;
 *   - venceu o último nível: antes de voltar ao título, o anfitrião
 *     aparece na televisão sugerindo que vem outro jogo (como no 21).
 */
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
      // A demonstração não mexe no recorde, na lista das melhores, nas
      // estatísticas nem nos desbloqueios.
      if (!demonstracao) {
        conferirRecorde();
        registrarPartida(recordeDaSessao);
        anunciarNovidades(anotarPartida(progresso, {
          venceu: jogo.vitoriaFinal === true,
          estourouAlgumaVez: estourouNaPartida,
          semTortura: !levouPunicaoNaPartida,
        }));
        prepararIniciais();
        salvarProgresso();
      }
    },
    aoAtualizar(p) {
      mesa.telaPreta = suavizar.entradaSaida(p);
    },
    aoTerminar() {
      mesa.telaPreta = 1;
      mesa.textoFinal = descreverFim();
    },
  });

  // Na demonstração a partida acabada simplesmente dá lugar a outra.
  if (demonstracao) {
    sequencia.adicionar({
      nome: 'fim',
      duracao: 1800,
      aoTerminar() { comecarDemonstracao(); },
    });
    return;
  }

  if (jogo.vitoriaFinal) adicionarDespedidaDoAnfitriao();
  else {
    sequencia.adicionar({
      nome: 'fim',
      duracao: 0,
      aoTerminar() {
        // A máquina de telas assume: mostra o GAME OVER e, se a pontuação
        // entrou nas cinco melhores, manda digitar as iniciais antes do título.
        telas.fimDePartida(performance.now(), { paraIniciais: mesa.iniciais !== null });
        mesa.tela = telas.atual;
      },
    });
  }
}

/** A televisão acende e o anfitrião deixa claro que isto não acabou. */
function adicionarDespedidaDoAnfitriao() {
  sequencia.adicionar(pausa('despedida', 900));
  sequencia.adicionar({
    nome: 'despedida',
    duracao: 1200,
    ritmoReal: true,
    aoIniciar() { mesa.textoFinal = ''; },
    aoAtualizar(p) {
      mesa.tvForte = suavizar.entradaSaida(p);
      // A sala volta a aparecer um pouco: a televisão é a única luz, mas
      // a mesa vazia atrás dela é parte da cena.
      mesa.telaPreta = interpolar(1, 0.72, suavizar.entradaSaida(p));
    },
  });

  for (const fala of FALA_DA_VITORIA) {
    sequencia.adicionar({
      nome: 'despedida',
      duracao: 3000,
      ritmoReal: true,
      aoIniciar() {
        mesa.kaio = fala;
        mesa.tvForte = 1;
        audio.voz(fala);
      },
    });
  }

  sequencia.adicionar({
    nome: 'despedida',
    duracao: 1400,
    ritmoReal: true,
    aoIniciar() { mesa.kaio = null; },
    aoAtualizar(p) {
      mesa.tvForte = 1 - suavizar.entradaSaida(p);
      mesa.telaPreta = interpolar(0.72, 1, suavizar.entradaSaida(p));
    },
    aoTerminar() {
      mesa.tvForte = 0;
      mesa.telaPreta = 0;
      // Vitória não passa pelo GAME OVER: vai assinar a lista, se entrou
      // nela, e de lá para o início.
      telas.ir(mesa.iniciais ? TELA.INICIAIS : TELA.TITULO, performance.now());
      mesa.tela = telas.atual;
    },
  });
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
const TRUNFO_MESA_ESCALA = 52 / 84; // largura da carta na mesa dividida pela da mão

/**
 * A carta trunfo da rodada entrando na mão: sobe pela borda de baixo até
 * o lugar dela, com um exagero no fim. É a única que o jogador ganha por
 * rodada, então ela merece ser vista chegando.
 */
function passoTrunfoChegando(carta, indice, total) {
  let destino;
  const saida = ALTURA + 60;
  return {
    nome: 'ganhando-trunfo',
    duracao: 560,
    aoIniciar() {
      destino = posicaoTrunfoNaMao(indice, total);
      mesa.trunfoEmVoo = { carta, lado: 'eu', x: destino.x, y: saida, escala: 1 };
      audio.carta();
      mesa.mensagem = `Você recebeu ${carta.nome}.`;
      mesa.mensagemVermelha = false;
    },
    aoAtualizar(p) {
      const e = suavizar.saidaCubica(p);
      // Passa um pouco do lugar e volta: dá peso à chegada.
      const exagero = Math.sin(p * Math.PI) * 14;
      mesa.trunfoEmVoo.y = interpolar(saida, destino.y, e) - exagero;
      mesa.trunfoEmVoo.escala = 1 + Math.sin(p * Math.PI) * 0.10;
    },
    aoTerminar() {
      mesa.trunfoEmVoo = null;
      mesa.eu.trunfosNaMao = [...mesa.eu.trunfosNaMao, carta];
    },
  };
}

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
  // Estatísticas da parte C3 (4.1): quantos trunfos o jogador já usou e
  // quantos ele já tirou da mesa do oponente.
  anotarTrunfoUsado(progresso);
  if (relatorio.acoes.some((a) => a.tipo === 'destroy_last_trump'
    && a.lado === LADO.OPONENTE && a.destruido)) {
    anotarTrunfoRemovido(progresso);
  }
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
    // Raridade e chance de sair no sorteio, com as cartas liberadas agora.
    raridade: raridadeDaCarta(achado.carta.id),
    chance: chanceDaCarta(catalogo, achado.carta.id),
    x: caixa.x + caixa.largura / 2,
    y: caixa.y,
    origem: achado.origem,
  };
  canvas.style.cursor = naMao && podeAgir() ? 'pointer' : 'default';
}

function aoClicarNoCanvas(evento) {
  garantirSom();
  // Fora da mesa, o clique só serve para sair da tela em que está.
  if (telas.atual !== TELA.JOGANDO) {
    // Com a pergunta do apagar no ar, o clique desiste em vez de jogar.
    if (mesa.dados.pedindoApagar) { mesa.dados.pedindoApagar = false; return; }
    aoInteragirComATela();
    return;
  }
  const achado = trunfoSobOCursor(pontoNoCanvas(evento));
  if (achado?.origem.startsWith('mao-')) aoClicarEmTrunfo(achado.indice);
  atualizarBotoes();
}

// ---------------------------------------------------------------------
//  Textos
// ---------------------------------------------------------------------

/**
 * Como a mesa se dirige ao lado de cá. Jogando, é "você"; na
 * demonstração ninguém está jogando, então vale o nome.
 */
const ladoDeCa = () => (demonstracao ? NOMES.jogador : 'Você');
const maoDeCa = () => (demonstracao ? `a mão de ${NOMES.jogador}` : 'a sua mão');

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
    return `${ladoDeCa()} venceu: ${tj} contra ${to}${detalhe}. ${NOMES.oponente} ${verbo} ${custo}.`;
  }
  const quemEstourou = demonstracao ? `${NOMES.jogador} estourou` : 'você estourou';
  const detalhe = r.estourou.jogador ? ` (${quemEstourou})` : '';
  return `${NOMES.oponente} venceu: ${to} contra ${tj}${detalhe}. ${ladoDeCa()} ${verbo} ${custo}.`;
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

// ---------------------------------------------------------------------
//  Demonstração: a IA jogando pelos dois lados (3.5)
// ---------------------------------------------------------------------

/** Começa (ou recomeça) a vitrine, com uma partida nova só dela. */
function comecarDemonstracao() {
  demonstracao = true;
  mesa.iniciais = null;
  sequencia.limpar();
  novaPartida({ seed: proximaSeedDaDemo() });
}

/**
 * Sai da vitrine. A mesa volta ao estado de espera, como no carregamento
 * da página: partida nova e fila vazia, para nada ficar animando por
 * trás do título.
 */
function pararDemonstracao() {
  demonstracao = false;
  sequencia.limpar();
  novaPartida();
  sequencia.limpar();
}

/**
 * Qual cabeça de IA o Luiz Alberto está usando. No modo difícil ele joga
 * com a do nível 3 (a que calcula risco e briga pelas cartas) desde o
 * primeiro aparelho; no normal, a do nível em que a partida está.
 */
function nivelDaIa() {
  return mesa.dificil ? 3 : jogo.nivel;
}

/** Na demonstração o jogador também pensa antes de jogar. */
function passoPensandoDoJogador() {
  return {
    nome: 'pensando',
    duracao: 900 + rngVisual() * 1400,
    aoIniciar() {
      mesa.mensagem = `${NOMES.jogador} está pensando`;
      mesa.mensagemVermelha = false;
    },
    aoTerminar() { jogadaDoJogador(); },
  };
}

/** Carta trunfo pelo lado do jogador, quando a IA acha que vale. */
function trunfoDoJogador() {
  const id = decidirTrunfo(jogo, LADO.JOGADOR, NIVEL_DA_DEMO);
  if (!id) return false;

  const carta = descricaoDoTrunfo(id);
  const indice = mesa.eu.trunfosNaMao.findIndex((c) => c.id === id);
  const totalAntes = mesa.eu.trunfosNaMao.length;
  const alvoAntes = mesa.alvo;

  const relatorio = aplicarTrunfo(jogo, LADO.JOGADOR, id);
  sincronizarTrunfos();
  mesa.mensagem = `${NOMES.jogador} jogou ${carta.nome}. ${carta.texto}`;
  mesa.mensagemVermelha = false;

  if (relatorio.ficouNaMesa && indice >= 0) {
    sequencia.adicionar(passoTrunfoVoando(carta, posicaoTrunfoNaMao(indice, totalAntes), 'eu'));
  }
  if (mesa.alvo !== alvoAntes) sequencia.adicionar(passoTrocaDeAlvo(alvoAntes, mesa.alvo));
  sequencia.adicionar(pausa('jogando-trunfo', 700));
  redesenharMinhasCartas(verMesa(jogo, LADO.JOGADOR));
  return true;
}

/** O mesmo que `jogadaDoOponente`, só que do lado de cá da mesa. */
function jogadaDoJogador() {
  if (trunfoDoJogador()) {
    sequencia.adicionar({ nome: 'jogando-trunfo', duracao: 0, aoTerminar: jogadaDoJogador });
    return;
  }

  const querComprar = decidirAcao(jogo, LADO.JOGADOR, NIVEL_DA_DEMO) === ACAO.HIT;
  if (querComprar && podeComprar(jogo, LADO.JOGADOR)) {
    const { carta, trunfoGanho } = hit(jogo, LADO.JOGADOR);
    mesa.mensagem = `${NOMES.jogador} compra uma carta.`;
    sequencia.adicionar(passoCartaVoando({ nome: 'comprando', lado: 'eu', valor: carta, faceFinal: 'cima' }));
    if (trunfoGanho) sequencia.adicionar({ nome: 'comprando', duracao: 0, aoTerminar: sincronizarTrunfos });
    sequencia.adicionar(passoPensando());
    return;
  }

  const { resultado } = stay(jogo, LADO.JOGADOR);
  mesa.mensagem = `${NOMES.jogador} passou.`;
  mesa.mensagemVermelha = false;
  if (resultado) {
    sequencia.adicionar(pausa('passou', 600));
    adicionarRevelacao(resultado);
  } else {
    sequencia.adicionar(pausa('passou', 400));
    sequencia.adicionar(passoPensando());
  }
}

/** Devolve a vez: na demonstração quem joga é a IA, não os botões. */
function devolverAVez() {
  if (demonstracao) sequencia.adicionar(passoPensandoDoJogador());
}

// ---------------------------------------------------------------------
//  O que fica guardado (4.1)
// ---------------------------------------------------------------------

/** Quando o jogador apagou os dados, para o aviso sumir sozinho. */
let apagadoEm = null;

/**
 * Média de quadros por segundo do último segundo. Serve para conferir
 * que os efeitos do 4.3 não derrubaram o desempenho; aparece em
 * `body[data-fps]`.
 */
let fps = 0;
let quadrosContados = 0;
let janelaDeFps = 0;
function medirFps(agora) {
  quadrosContados += 1;
  if (janelaDeFps === 0) { janelaDeFps = agora; return; }
  const decorrido = agora - janelaDeFps;
  if (decorrido >= 1000) {
    fps = Math.round((quadrosContados * 1000) / decorrido);
    quadrosContados = 0;
    janelaDeFps = agora;
  }
}

/**
 * Escreve o progresso no localStorage. Se não der, o jogo continua na
 * memória e o título passa a avisar — nada aqui pode interromper a
 * partida.
 */
function salvarProgresso() {
  guarda.salvar(progresso);
  mesa.dados.salvando = guarda.disponivel;
}

/**
 * Recompensas recém-ganhas viram uma linha na tela de fim de partida.
 * A carta destravada só entra no sorteio da PRÓXIMA partida: o catálogo
 * é montado uma vez e entregue pronto ao motor.
 */
function anunciarNovidades(novas) {
  if (novas.length === 0) return;
  for (const recompensa of novas) mesa.desbloqueios.push(recompensa.nome);
  catalogo = montarCatalogo();
  mesa.dados.desbloqueadas = progresso.desbloqueios.length;
}

/**
 * Liga ou desliga o pós-processamento e guarda a escolha (4.3). Com
 * `?efeitos=0` na URL o desligamento é forçado e a tecla não reacende.
 */
function alternarEfeitos() {
  if (!parametros.efeitos) return;
  const ligados = !renderizador.efeitos.ativos;
  renderizador.efeitos.definirAtivos(ligados);
  mesa.efeitos.ligados = ligados;
  progresso.opcoes.efeitos = ligados;
  salvarProgresso();
}

/** Liga ou desliga o modo difícil e guarda a escolha. */
function alternarDificil() {
  mesa.dificil = !mesa.dificil;
  progresso.opcoes.dificil = mesa.dificil;
  salvarProgresso();
}

/** Apaga tudo o que o jogo guardou. Só o título chama isto. */
function apagarTudo() {
  guarda.apagar();
  progresso.recorde.melhor = 0;
  progresso.recorde.partidas = 0;
  progresso.placar.entradas.length = 0;
  Object.assign(progresso.estatisticas, criarEstatisticas());
  progresso.desbloqueios.length = 0;
  catalogo = montarCatalogo();

  mesa.recorde = { valor: 0, piscando: false, piscandoDesde: null };
  mesa.placar = { entradas: placarDaSessao.entradas, destaque: -1 };
  mesa.pontos = { total: 0, multiplicador: 1, ultimo: null };
  mesa.desbloqueios = [];
  mesa.dados.pedindoApagar = false;
  mesa.dados.desbloqueadas = 0;
  apagadoEm = performance.now();
}

/**
 * No título, DEL apaga os dados salvos — em dois tempos, porque isso não
 * tem volta. Devolve true se a tecla foi consumida aqui (e portanto não
 * deve começar uma partida).
 */
function tratarApagarNoTitulo(evento) {
  if (evento.key === 'Delete') {
    evento.preventDefault();
    if (mesa.dados.pedindoApagar) apagarTudo();
    else mesa.dados.pedindoApagar = true;
    return true;
  }
  if (mesa.dados.pedindoApagar) {
    evento.preventDefault();
    mesa.dados.pedindoApagar = false;   // qualquer outra tecla desiste
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------
//  As cinco melhores da sessão (3.4)
// ---------------------------------------------------------------------

/**
 * Chamado quando a partida acaba: se a pontuação cabe nas cinco
 * melhores, prepara as três letras. Devolve true se vai ter digitação.
 */
function prepararIniciais() {
  const linha = posicaoNoPlacar(placarDaSessao, pontuacao.total);
  if (linha < 0) {
    entradaIniciais = null;
    mesa.iniciais = null;
    return false;
  }
  entradaIniciais = criarEntradaDeIniciais(ultimasIniciais);
  mesa.iniciais = {
    letras: entradaIniciais.letras,   // a mesma lista: o que for digitado já aparece
    cursor: entradaIniciais.cursor,
    linha,
    pontos: pontuacao.total,
    restante: null,
  };
  return true;
}

/**
 * Sai da tela de digitar, por Enter ou porque o tempo acabou: o que
 * estiver escrito entra na tabela. Passa por aqui nos dois casos.
 */
function gravarNoPlacar() {
  if (!entradaIniciais) return;
  const letras = textoDasIniciais(entradaIniciais);
  ultimasIniciais = letras;
  const { linha } = registrarNoPlacar(placarDaSessao, letras, mesa.iniciais.pontos, {
    nivel: jogo.nivel,
    venceu: jogo.vitoriaFinal,
  });
  mesa.placar = { entradas: placarDaSessao.entradas, destaque: linha };
  entradaIniciais = null;
  mesa.iniciais = null;
  salvarProgresso();
}

/** True se este lado está a uma derrota de sair da mesa. */
function quaseMorto(lado) {
  if (mesa.nivel === 2) return mesa[lado].medidor >= 8;
  if (mesa.nivel === 3) return lado === 'eu' ? mesa.serraPos <= 2 : mesa.serraPos >= 13;
  return mesa[lado].dedos <= 1;
}

/**
 * O Kaio comentando a rodada que acabou de ser resolvida. Ele escolhe a
 * situação mais interessante da lista e pode muito bem ficar calado.
 */
function comentarARodada(resultado) {
  const situacoes = [];
  if (resultado.estourou.jogador) situacoes.push('jogadorEstourou');
  if (resultado.estourou.oponente) situacoes.push('oponenteEstourou');
  if (resultado.totais.jogador === mesa.alvo) situacoes.push('alvoExato');
  if (resultado.vencedor === RESULTADO.EMPATE) situacoes.push('empate');
  else if (resultado.vencedor === RESULTADO.JOGADOR) situacoes.push('jogadorVenceuRodada');
  else situacoes.push('jogadorPerdeuRodada');
  if (quaseMorto('eu') || intensidadeDoPerigo(mesa) >= 0.8) situacoes.push('jogadorQuaseMorto');
  if (quaseMorto('adv')) situacoes.push('oponenteQuaseMorto');
  if (mesa.eu.aposta >= 3) situacoes.push('apostaAlta');

  const fala = comentarSobre(anfitriao, situacoes, mesa.rodada);
  if (!fala) return;
  mesa.comentario = { texto: fala, ate: performance.now() + DURACAO_DO_COMENTARIO };
  audio.voz(fala);
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
  const trunfosAntes = jogo.jogadores[LADO.JOGADOR].trunfos.length;
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

  // As cartas que acabaram de chegar ficam FORA da mão visível até a
  // animação de chegada rodar, lá embaixo.
  const ganhasAgora = Math.max(0, visao.eu.trunfos.length - trunfosAntes);
  const chegando = ganhasAgora > 0
    ? mesa.eu.trunfosNaMao.slice(-ganhasAgora)
    : [];
  if (ganhasAgora > 0) {
    mesa.eu.trunfosNaMao = mesa.eu.trunfosNaMao.slice(0, -ganhasAgora);
  }

  mesa.baralhoRestante = visao.cartasNoBaralho + 4;
  mesa.escurecimento = 0;
  mesa.mensagem = `Rodada ${visao.rodada}. Aposta: ${plural(visao.eu.aposta, 'dedo', 'dedos')}.`;
  mesa.mensagemVermelha = false;

  sequencia.adicionar(pausa('distribuindo', 350));
  sequencia.adicionar(passoCartaVoando({ nome: 'distribuindo', lado: 'eu', valor: visao.eu.oculta, faceFinal: 'cima', marcaOculta: true }));
  sequencia.adicionar(passoCartaVoando({ nome: 'distribuindo', lado: 'adv', valor: null, faceFinal: 'baixo' }));
  sequencia.adicionar(passoCartaVoando({ nome: 'distribuindo', lado: 'eu', valor: visao.eu.abertas[0], faceFinal: 'cima' }));
  sequencia.adicionar(passoCartaVoando({ nome: 'distribuindo', lado: 'adv', valor: visao.adversario.abertas[0], faceFinal: 'cima' }));

  // E só então a carta trunfo da rodada sobe para a mão.
  const totalNaMao = mesa.eu.trunfosNaMao.length + chegando.length;
  chegando.forEach((carta, i) => {
    sequencia.adicionar(passoTrunfoChegando(carta, mesa.eu.trunfosNaMao.length + i, totalNaMao));
  });
  if (demonstracao) {
    sequencia.adicionar(passoMensagem('A casa joga contra ela mesma.', 150));
    sequencia.adicionar(passoPensandoDoJogador());
  } else {
    sequencia.adicionar(passoMensagem('Sua vez: comprar (HIT) ou parar (STAY)?', 150));
    // A serra a uma derrota do Luiz Alberto: o anfitrião não deixa acabar.
    if (deveTrapacear(jogo, trapaca)) adicionarTrapacaDoAnfitriao();
  }
}

/**
 * A cena da trapaça (4.8): a luz vira, a televisão grita, a música
 * para, e o anfitrião joga duas cartas pelo Luiz Alberto. Só acontece
 * uma vez, quando a serra está a uma derrota de encostar nele.
 */
function adicionarTrapacaDoAnfitriao() {
  sequencia.adicionar({ ...pausa('trapaca', 400), ritmoReal: true });

  sequencia.adicionar({
    nome: 'trapaca',
    duracao: 1400,
    ritmoReal: true,
    aoIniciar() {
      audio.silencioDaRevelacao();   // a música para
      audio.grito();
      mesa.mensagem = '';
      mesa.dica = null;
    },
    aoAtualizar(p) {
      const e = suavizar.entradaSaida(p);
      mesa.trapaca.forca = e;
      mesa.tvForte = e;
      mesa.tremor = e * 0.35;
    },
    aoTerminar() { mesa.tremor = 0; },
  });

  for (const fala of FALA_DA_TRAPACA) {
    sequencia.adicionar({
      nome: 'trapaca',
      duracao: 2800,
      ritmoReal: true,
      aoIniciar() {
        mesa.kaio = fala;
        mesa.tvForte = 1;
        mesa.trapaca.forca = 1;
        audio.voz(fala);
      },
    });
  }

  sequencia.adicionar({
    nome: 'trapaca',
    duracao: 900,
    ritmoReal: true,
    aoIniciar() {
      mesa.kaio = null;
      // Só agora as cartas entram na mesa, com o motor.
      const relatorios = aplicarTrapaca(jogo, trapaca);
      sincronizarTrunfos();
      redesenharMinhasCartas(verMesa(jogo, LADO.JOGADOR));
      mesa.adv.cartas = [];
      const visao = verMesa(jogo, LADO.JOGADOR);
      // As cartas dele viram de novo: a oculta continua oculta.
      mesa.adv.cartas = [
        { valor: null, face: 'baixo', marcaOculta: false, escalaX: 1, x: 0, y: 0 },
        ...visao.adversario.abertas.map((v) => ({
          valor: v, face: 'cima', marcaOculta: false, escalaX: 1, x: 0, y: 0,
        })),
      ];
      mesa.adv.cartas.forEach((carta, i) => {
        const pos = posicaoSlot('adv', i);
        carta.x = pos.x;
        carta.y = pos.y;
      });
      mesa.eu.aposta = visao.eu.aposta;
      mesa.adv.aposta = visao.adversario.aposta;
      mesa.mensagem = `${NOMES.anfitriao} jogou ${relatorios.map((r) => r.nome).join(' e ')} por ${NOMES.oponente}.`;
      mesa.mensagemVermelha = true;
    },
    aoAtualizar(p) {
      mesa.tvForte = 1 - suavizar.entradaSaida(p);
    },
  });

  sequencia.adicionar({
    ...pausa('trapaca', 2200),
    ritmoReal: true,
    aoTerminar() {
      audio.voltarDoSilencio();
      mesa.mensagem = 'Sua vez. Ele não pode mais perder, e você não pode mais comprar.';
      mesa.mensagemVermelha = true;
    },
  });
}

/**
 * A partir do nível 2 o oponente joga uma carta trunfo antes de decidir
 * comprar ou parar. Devolve true se jogou (e a vez dele continua depois).
 */
function trunfoDoOponente() {
  const id = decidirTrunfo(jogo, LADO.OPONENTE, nivelDaIa());
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

  if (decidirAcao(jogo, LADO.OPONENTE, nivelDaIa()) === ACAO.HIT) {
    const { carta } = hit(jogo, LADO.OPONENTE);
    mesa.mensagem = `${NOMES.oponente} compra uma carta.`;
    sequencia.adicionar(passoCartaVoando({ nome: 'comprando', lado: 'adv', valor: carta, faceFinal: 'cima' }));
    sequencia.adicionar(passoMensagem('Sua vez.', 250));
    devolverAVez();
    return;
  }

  const { resultado } = stay(jogo, LADO.OPONENTE);
  mesa.mensagem = `${NOMES.oponente} passou.`;
  if (resultado) {
    sequencia.adicionar(pausa('passou', 700));
    adicionarRevelacao(resultado);
  } else {
    sequencia.adicionar(passoMensagem(`${NOMES.oponente} passou. Sua vez.`, 500));
    devolverAVez();
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

/** Atalho de depuração: recomeçar sem passar pelo título. */
function aoClicarReiniciar() {
  if (jogo.fase !== FASE.FIM_DE_JOGO) return;
  telas.ir(TELA.JOGANDO, performance.now());
  mesa.tela = telas.atual;
}

// ---------------------------------------------------------------------
//  Loop de animação
// ---------------------------------------------------------------------

function atualizarBotoes() {
  // Fora da tela de jogo nenhum botão da mesa aparece.
  const naMesa = telas.atual === TELA.JOGANDO || telas.atual === TELA.GAME_OVER;
  const jogando = naMesa && jogo.fase === FASE.JOGANDO;
  const livre = naMesa && podeAgir();
  const acabou = naMesa && jogo.fase === FASE.FIM_DE_JOGO && !sequencia.ocupado;
  mesa.podeJogarTrunfo = livre;

  botaoHit.hidden = !jogando;
  botaoStay.hidden = !jogando;
  botaoHit.disabled = !livre || !podeComprar(jogo, LADO.JOGADOR);
  botaoStay.disabled = !livre;
  botaoProxima.hidden = !(telas.atual === TELA.JOGANDO && jogo.fase === FASE.RODADA_ENCERRADA && !sequencia.ocupado);
  // A tela de fim de jogo não tem botão: ela volta ao título sozinha ou
  // com qualquer tecla. O `acabou` segue servindo para os roteiros.
  telaFinal.hidden = true;
  botaoReiniciar.hidden = true;
  document.body.dataset.partidaAcabou = acabou ? '1' : '0';

  document.body.dataset.tela = telas.atual;
  // Em que ponto está a televisão acendendo, para os roteiros esperarem
  // por fase em vez de cravar tempos.
  if (telas.atual !== TELA.TITULO) {
    document.body.dataset.tituloFase = 'fora';
  } else {
    const p = mesa.tempoNaTela / mesa.duracaoDoLigar;
    document.body.dataset.tituloFase = p < 0.18 ? 'linha'
      : p < 0.45 ? 'abrindo'
        : p < 1 ? 'surgindo' : 'pronto';
  }
  document.body.dataset.tituloPronto = document.body.dataset.tituloFase === 'pronto' ? '1' : '0';

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
  // As três letras sendo digitadas e a tabela como ela está na tela (3.4).
  document.body.dataset.iniciais = mesa.iniciais ? mesa.iniciais.letras.join('') : '';
  document.body.dataset.demonstracao = demonstracao ? '1' : '0';
  // O que está guardado, para o roteiro conferir depois de recarregar (4.1).
  document.body.dataset.salvando = mesa.dados.salvando ? '1' : '0';
  // Som (4.2): o Playwright não grava áudio, então o roteiro confere os
  // eventos por aqui — qual foi o último e quantos já tocaram.
  document.body.dataset.som = audio.ultimoSom;
  document.body.dataset.sons = String(audio.totalDeSons);
  document.body.dataset.mudo = mesa.som.mudo ? '1' : '0';
  // Efeitos visuais (4.3): se estão ligados, o quanto a cena está tensa,
  // e o desempenho com tudo isso rodando.
  document.body.dataset.efeitos = mesa.efeitos.ligados ? '1' : '0';
  document.body.dataset.dificil = mesa.dificil ? '1' : '0';
  document.body.dataset.tensao = tensaoDaCena(mesa).toFixed(2);
  document.body.dataset.fps = String(fps);
  // A trapaça do anfitrião (4.8), para o roteiro de captura.
  document.body.dataset.trapaca = trapaca.aconteceu ? '1' : '0';
  document.body.dataset.comentario = mesa.comentario ? mesa.comentario.texto : '';
  document.body.dataset.desbloqueios = progresso.desbloqueios.join(',');
  document.body.dataset.partidasJogadas = String(progresso.estatisticas.partidasJogadas);
  document.body.dataset.placar = placarDaSessao.entradas
    .map((e) => `${e.iniciais}:${e.pontos}`).join(';');
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
  // Qual tela está no ar. As de espera trocam sozinhas com o relógio.
  telas.atualizar(agora);
  mesa.tela = telas.atual;
  mesa.tempoNaTela = telas.tempoNaTela(agora);

  // O visor do recorde pisca por alguns segundos depois de ser batido.
  if (mesa.recorde.piscandoDesde !== null) {
    const decorrido = agora - mesa.recorde.piscandoDesde;
    mesa.recorde.piscando = decorrido < DURACAO_DO_PISCA * parametros.fatorTempo;
    if (!mesa.recorde.piscando) mesa.recorde.piscandoDesde = null;
  }

  // A fala do Kaio sai da tela sozinha.
  if (mesa.comentario && agora >= mesa.comentario.ate) mesa.comentario = null;

  // O aviso de "dados apagados" fica alguns segundos e some.
  if (apagadoEm !== null) {
    const decorrido = agora - apagadoEm;
    mesa.dados.apagadoHa = decorrido < 4000 ? decorrido : null;
    if (mesa.dados.apagadoHa === null) apagadoEm = null;
  }

  // Quanto falta para a tela de digitar sair sozinha, para o visor.
  if (mesa.iniciais) {
    const falta = (telas.duracaoDaTelaAtual() ?? 0) - telas.tempoNaTela(agora);
    mesa.iniciais.restante = telas.atual === TELA.INICIAIS ? Math.max(0, falta) / 1000 : null;
  }

  // Tremor constante da câmera, que cresce com a tensão (4.3). O 0,12
  // segura em menos de dois pixels: é para sentir, não para enjoar.
  mesa.tremorAmbiente = mesa.tela === 'jogando' ? tensaoDaCena(mesa) * 0.12 : 0;
  medirFps(agora);

  lampada.atualizar(agora);
  audio.atualizar(mesa, lampada.estado, agora);
  sequencia.atualizar(agora);
  renderizador.desenhar(mesa, lampada.estado, agora);
  atualizarBotoes();
  document.body.dataset.pronto = '1';
  requestAnimationFrame(quadro);
}

// ---------------------------------------------------------------------
//  Tela cheia
//
//  O palco é fixo em 1280x720 (o mesmo tamanho dos prints), então em
//  tela cheia ele não estica sozinho: é uma escala CSS por cima, que
//  mantém a proporção e deixa o canvas nítido. Vale em qualquer tela,
//  inclusive no título e no GAME OVER.
// ---------------------------------------------------------------------

function emTelaCheia() {
  return document.fullscreenElement !== null && document.fullscreenElement !== undefined;
}

function ajustarEscalaDoPalco() {
  const fator = emTelaCheia()
    ? Math.min(window.innerWidth / 1280, window.innerHeight / 720)
    : 1;
  palco.style.transform = fator === 1 ? '' : `scale(${fator})`;
  botaoTelaCheia.textContent = emTelaCheia() ? 'SAIR DA TELA CHEIA' : 'TELA CHEIA';
}

function alternarTelaCheia() {
  try {
    if (emTelaCheia()) document.exitFullscreen?.();
    else document.documentElement.requestFullscreen?.().catch(() => {});
  } catch { /* navegador que não deixa: o jogo segue na janela */ }
}

botaoTelaCheia.addEventListener('click', (evento) => {
  evento.stopPropagation();
  garantirSom();
  alternarTelaCheia();
});
document.addEventListener('fullscreenchange', ajustarEscalaDoPalco);
window.addEventListener('resize', ajustarEscalaDoPalco);
ajustarEscalaDoPalco();

canvas.addEventListener('mousemove', aoMoverMouse);
canvas.addEventListener('mouseleave', () => { mesa.dica = null; });
canvas.addEventListener('click', aoClicarNoCanvas);

// Depois de cada clique os botões travam na hora, sem esperar o próximo quadro.
botaoHit.addEventListener('click', () => { garantirSom(); aoClicarHit(); atualizarBotoes(); });
botaoStay.addEventListener('click', () => { aoClicarStay(); atualizarBotoes(); });
botaoProxima.addEventListener('click', () => { aoClicarProxima(); atualizarBotoes(); });
botaoReiniciar.addEventListener('click', () => { aoClicarReiniciar(); atualizarBotoes(); });

// ---------------------------------------------------------------------
//  Telas (3.1)
// ---------------------------------------------------------------------

const telas = criarTelas({
  inicial: parametros.tela ?? TELA.TITULO,
  fatorTempo: parametros.fatorTempo,
  aoTrocar(nova, anterior) {
    mesa.tela = nova;
    // Saiu da tela de digitar (pelo Enter ou pelo tempo): grava as letras.
    if (anterior === TELA.INICIAIS) gravarNoPlacar();
    // Sair do título com a pergunta do apagar no ar é desistir dela.
    if (anterior === TELA.TITULO) mesa.dados.pedindoApagar = false;
    // Entrou ou saiu da vitrine.
    if (anterior === TELA.ATTRACT) pararDemonstracao();
    if (nova === TELA.ATTRACT) comecarDemonstracao();
    // A sala só volta a aparecer quando o jogo recomeça: a sequência
    // GAME OVER → iniciais → melhores pontuações acontece toda no escuro.
    if (nova === TELA.TITULO || nova === TELA.JOGANDO) {
      mesa.telaPreta = 0;
      mesa.textoFinal = '';
      sequencia.limpar();
    }
    // Entrar no jogo vindo de fora sempre começa uma partida nova.
    if (nova === TELA.JOGANDO && anterior !== TELA.JOGANDO) novaPartida();
  },
});
mesa.tela = telas.atual;

/** Tecla ou clique fora da mesa: só vale nas telas que não são a do jogo. */
function aoInteragirComATela() {
  if (telas.atual === TELA.JOGANDO) return false;
  return telas.interagir(performance.now());
}

/**
 * Na tela das iniciais as teclas são as letras do nome, e não um "pule a
 * tela": elas vão para a entrada e o Enter confirma. Em qualquer outra
 * tela, tecla é interação.
 */
function aoTeclar(evento) {
  garantirSom();

  // M liga e desliga o som, em qualquer tela — menos enquanto o jogador
  // digita as iniciais, onde M é uma letra do nome.
  if ((evento.key === 'm' || evento.key === 'M') && telas.atual !== TELA.INICIAIS) {
    evento.preventDefault();
    mesa.som.mudo = audio.alternarMudo();
    return;
  }

  // F entra e sai da tela cheia, em qualquer tela.
  if ((evento.key === 'f' || evento.key === 'F') && telas.atual !== TELA.INICIAIS) {
    evento.preventDefault();
    alternarTelaCheia();
    return;
  }

  // E liga e desliga os efeitos visuais, nas mesmas condições do M.
  if ((evento.key === 'e' || evento.key === 'E') && telas.atual !== TELA.INICIAIS) {
    evento.preventDefault();
    alternarEfeitos();
    return;
  }

  // H liga e desliga o modo difícil, e só no título: trocar a cabeça do
  // oponente no meio de uma partida seria trapaça ao contrário.
  if ((evento.key === 'h' || evento.key === 'H') && telas.atual === TELA.TITULO) {
    evento.preventDefault();
    alternarDificil();
    return;
  }

  // No título o DEL é do apagar, não do "qualquer tecla começa o jogo".
  if (telas.atual === TELA.TITULO && tratarApagarNoTitulo(evento)) return;

  if (telas.atual === TELA.INICIAIS && entradaIniciais) {
    const { mudou, confirmou } = teclarIniciais(entradaIniciais, evento.key);
    if (mudou || confirmou) evento.preventDefault();
    mesa.iniciais.cursor = entradaIniciais.cursor;
    if (confirmou) {
      telas.ir(TELA.HIGH_SCORES, performance.now());
      mesa.tela = telas.atual;
    }
    return;
  }
  aoInteragirComATela();
}

window.addEventListener('keydown', aoTeclar);

// O que veio do disco já aparece antes da primeira partida: a lista das
// melhores, o visor de recorde e a conta de desbloqueios.
mesa.placar = { entradas: placarDaSessao.entradas, destaque: -1 };
mesa.dados.salvando = guarda.disponivel;
mesa.dados.desbloqueadas = progresso.desbloqueios.length;

// A preferência de efeitos visuais vem do disco; `?efeitos=0` vence.
mesa.efeitos.ligados = parametros.efeitos && progresso.opcoes.efeitos;
renderizador.efeitos.definirAtivos(mesa.efeitos.ligados);
mesa.dificil = progresso.opcoes.dificil === true;

definirNomeDoAnfitriao(NOMES.anfitriao);
definirTextosDoTitulo(TITULO.subtitulo, EQUIPE);
novaPartida();
// Abrir direto na vitrine (?tela=attract) precisa ligá-la na mão: no
// carregamento ninguém "troca" de tela, então o aviso de troca não corre.
if (telas.atual === TELA.ATTRACT) comecarDemonstracao();
else if (telas.atual !== TELA.JOGANDO) sequencia.limpar();  // nada de animar por trás do título
requestAnimationFrame(quadro);
