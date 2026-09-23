// =====================================================================
//  ui/render.js — desenha a mesa em Canvas 2D  (sub-passos 1.3 e 1.4)
//
//  Clima (PDF, Parte B): tudo quase preto, uma lâmpada pendurada fazendo
//  um cone de luz amarelado, mesa de madeira escura. Sem sangue.
//
//  Este arquivo só desenha. Recebe a "mesa visual" (sprites de cartas com
//  posição, face e escala; dedos; mensagem; escurecimento) e o estado da
//  lâmpada, e redesenha tudo a cada quadro. Não conhece regras nem o
//  estado real da partida. A carta oculta do oponente chega com
//  valor null até a revelação.
// =====================================================================

import {
  desenharMaoPixel,
  desenharLuizCorpo,
  desenharLuizBracos,
  TAMANHO_MAO,
  TAMANHO_LUIZ,
  LINHA_DA_MESA_LUIZ_PX,
  MAO_DIREITA_LUIZ_PX,
} from './pixelart.js';
import { criarCenario } from './cenario.js';
import { criarEfeitos } from './efeitos.js';

export const LARGURA = 1280;
export const ALTURA = 720;

const FONTE = '"Courier New", Courier, "Lucida Console", monospace';

const COR = {
  fundo: '#060505',
  texto: '#d8d2c8',
  textoApagado: '#77706a',
  vermelho: '#b8342a',
  carta: '#d9cfb8',
  cartaBorda: '#8f8570',
  cartaTinta: '#2a241f',
  verso: '#2a1d1a',
  versoLinha: '#4a3430',
};

export const CARTA = { largura: 78, altura: 110, espaco: 14 };

/** Posições fixas da mesa. As fileiras crescem para a direita a partir de fileiraX0. */
export const POSICOES = {
  fileiraX0: 470,
  advY: 228,
  euY: 420,
  baralho: { x: 1090, y: 300 },
  maoEu: { x: 30, y: 430 },
  pivoLampada: { x: 545, y: 0 }, // a lâmpada pende à esquerda do oponente, como na referência
  bordaMesaY: 165,
  luizCentroX: 680,
};

const ESCALA_MAO = 4;
const ESCALA_LUIZ = 3;

/** Canto superior esquerdo da grade do Luiz: a linha da mesa do sprite cai na borda do tampo. */
function origemLuiz() {
  return {
    x: POSICOES.luizCentroX - (TAMANHO_LUIZ.largura / 2) * ESCALA_LUIZ,
    y: POSICOES.bordaMesaY - LINHA_DA_MESA_LUIZ_PX * ESCALA_LUIZ,
  };
}

/** Onde fica a carta de índice `indice` na fileira de `lado` ('eu' | 'adv'). */
export function posicaoSlot(lado, indice) {
  return {
    x: POSICOES.fileiraX0 + indice * (CARTA.largura + CARTA.espaco),
    y: lado === 'eu' ? POSICOES.euY : POSICOES.advY,
  };
}

function interpolar(a, b, t) {
  return a + (b - a) * t;
}

// ---------------------------------------------------------------------
//  Utilidades
// ---------------------------------------------------------------------

function retanguloArredondado(ctx, x, y, largura, altura, raio) {
  ctx.beginPath();
  ctx.moveTo(x + raio, y);
  ctx.lineTo(x + largura - raio, y);
  ctx.quadraticCurveTo(x + largura, y, x + largura, y + raio);
  ctx.lineTo(x + largura, y + altura - raio);
  ctx.quadraticCurveTo(x + largura, y + altura, x + largura - raio, y + altura);
  ctx.lineTo(x + raio, y + altura);
  ctx.quadraticCurveTo(x, y + altura, x, y + altura - raio);
  ctx.lineTo(x, y + raio);
  ctx.quadraticCurveTo(x, y, x + raio, y);
  ctx.closePath();
}

/** "Aleatório" fixo para texturas: mesmo desenho em toda renderização. */
function ruidoFixo(i) {
  const v = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
  return v - Math.floor(v);
}

function texto(ctx, str, x, y, tamanho, cor = COR.texto, alinhamento = 'center', negrito = false) {
  ctx.font = `${negrito ? 'bold ' : ''}${tamanho}px ${FONTE}`;
  ctx.fillStyle = cor;
  ctx.textAlign = alinhamento;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(str, x, y);
}

// ---------------------------------------------------------------------
//  Cenário
// ---------------------------------------------------------------------

/** Cone de luz, desenhado antes do oponente (a luz cai sobre ele). */
function desenharConeDeLuz(ctx, lampada) {
  const { angulo, intensidade } = lampada;
  const pivo = POSICOES.pivoLampada;
  const cx = pivo.x;

  ctx.save();
  ctx.translate(pivo.x, pivo.y);
  ctx.rotate(angulo);
  ctx.translate(-pivo.x, -pivo.y);
  ctx.beginPath();
  ctx.moveTo(cx - 46, 58);
  ctx.lineTo(cx - 560, ALTURA + 60);
  ctx.lineTo(cx + 560, ALTURA + 60);
  ctx.lineTo(cx + 46, 58);
  ctx.closePath();
  const cone = ctx.createRadialGradient(cx, 60, 10, cx, 60, 760);
  cone.addColorStop(0, `rgba(255, 224, 160, ${0.40 * intensidade})`);
  cone.addColorStop(0.20, `rgba(255, 212, 140, ${0.14 * intensidade})`);
  cone.addColorStop(0.55, `rgba(255, 200, 120, ${0.05 * intensidade})`);
  cone.addColorStop(1, 'rgba(255, 200, 120, 0)');
  ctx.fillStyle = cone;
  ctx.fill();
  ctx.restore();
}

/** Fio, cúpula e lâmpada, desenhados depois do oponente (ficam na frente). */
function desenharLuminaria(ctx, lampada) {
  const { angulo, intensidade } = lampada;
  const pivo = POSICOES.pivoLampada;
  const cx = pivo.x;

  ctx.save();
  ctx.translate(pivo.x, pivo.y);
  ctx.rotate(angulo);
  ctx.translate(-pivo.x, -pivo.y);

  ctx.strokeStyle = '#1c1816';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx, 0);
  ctx.lineTo(cx, 22);
  ctx.stroke();

  ctx.fillStyle = '#17120f';
  ctx.beginPath();
  ctx.moveTo(cx - 22, 22);
  ctx.lineTo(cx + 22, 22);
  ctx.lineTo(cx + 52, 58);
  ctx.lineTo(cx - 52, 58);
  ctx.closePath();
  ctx.fill();

  // Lâmpada.
  ctx.shadowColor = `rgba(255, 230, 170, ${0.9 * intensidade})`;
  ctx.shadowBlur = 30 * intensidade;
  ctx.fillStyle = intensidade > 0.6 ? '#ffe9b8' : '#c9b48a';
  ctx.beginPath();
  ctx.ellipse(cx, 60, 16, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function desenharPocaDeLuz(ctx, lampada) {
  const deslocamento = Math.tan(lampada.angulo) * 430;
  ctx.save();
  ctx.translate(POSICOES.pivoLampada.x + 70 + deslocamento, 430);
  ctx.scale(1, 0.48);
  const poca = ctx.createRadialGradient(0, 0, 40, 0, 0, 560);
  poca.addColorStop(0, `rgba(255, 210, 135, ${0.26 * lampada.intensidade})`);
  poca.addColorStop(0.5, `rgba(255, 200, 120, ${0.10 * lampada.intensidade})`);
  poca.addColorStop(1, 'rgba(255, 200, 120, 0)');
  ctx.fillStyle = poca;
  ctx.beginPath();
  ctx.arc(0, 0, 560, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Piscar raro e irregular do oponente: olhos fechados por ~120 ms. */
function oponentePiscando(agora) {
  const janela = Math.floor(agora / 2600);
  return ruidoFixo(janela) < 0.22 && (agora % 2600) < 120;
}

/** Respiração lenta demais: o corpo sobe e desce 1 pixel de sprite. */
function respiracaoOponente(agora) {
  return Math.round(Math.sin(agora / 1000 * 0.6) * 0.6) * ESCALA_LUIZ;
}

/** Quadro da cabeça a partir do ângulo de "pensando": frames, não rotação, para manter os pixels. */
function quadroCabeca(angulo) {
  if (angulo > 0.02) return 'dir';
  if (angulo < -0.02) return 'esq';
  return 'neutra';
}

/** O oponente atrás da mesa: tronco, camiseta rasgada e cabeça (antes do tampo). */
function desenharOponente(ctx, mesa, agora) {
  const origem = origemLuiz();
  desenharLuizCorpo(ctx, origem.x, origem.y + respiracaoOponente(agora), {
    escala: ESCALA_LUIZ,
    inclinacao: quadroCabeca(mesa.cabecaAngulo),
    piscando: oponentePiscando(agora),
  });
}

/** Os braços do oponente sobre a mesa; a mão direita é o contador de dedos dele. */
function desenharBracosDoOponente(ctx, mesa, agora) {
  const origem = origemLuiz();
  desenharLuizBracos(ctx, origem.x, origem.y + respiracaoOponente(agora), mesa.adv.dedos, { escala: ESCALA_LUIZ });
}

/**
 * A lâmina da guilhotina. Para a mão do jogador (deitada, dedos para a
 * direita) a lâmina é uma barra vertical que cai sobre a base dos dedos;
 * para a mão do oponente (dedos para baixo) é uma barra horizontal.
 * `g.progresso` 0 = fora da tela, 1 = encostada na mão.
 */
function desenharGuilhotina(ctx, g, agora) {
  let alvo;
  if (g.lado === 'eu') {
    const x = POSICOES.maoEu.x + 40 * ESCALA_MAO;      // base dos dedos (sprite espelhado)
    alvo = { x, y: POSICOES.maoEu.y - 30, largura: 34, altura: TAMANHO_MAO.altura * ESCALA_MAO + 60, vertical: true };
  } else {
    const origem = origemLuiz();
    const cx = origem.x + MAO_DIREITA_LUIZ_PX.x * ESCALA_LUIZ;
    const y = origem.y + (MAO_DIREITA_LUIZ_PX.y + 2) * ESCALA_LUIZ;
    alvo = { x: cx - 70, y, largura: 140, altura: 26, vertical: false };
  }

  // Posição atual: vem de cima da tela até o alvo.
  const yInicio = -alvo.altura - 60;
  const y = interpolar(yInicio, alvo.y, g.progresso);
  const x = alvo.x;

  ctx.save();
  // Sombra da lâmina sobre a mesa, mais forte quanto mais perto.
  ctx.fillStyle = `rgba(0, 0, 0, ${0.45 * g.progresso})`;
  ctx.fillRect(x + 6, alvo.y + 8, alvo.largura, alvo.altura);

  // Corpo de metal.
  const grad = alvo.vertical
    ? ctx.createLinearGradient(x, 0, x + alvo.largura, 0)
    : ctx.createLinearGradient(0, y, 0, y + alvo.altura);
  grad.addColorStop(0, '#2a2c33');
  grad.addColorStop(0.45, '#8a8f9a');
  grad.addColorStop(0.55, '#c9ccd4');
  grad.addColorStop(1, '#1e2026');
  ctx.fillStyle = grad;
  ctx.fillRect(x, y, alvo.largura, alvo.altura);
  ctx.strokeStyle = '#0e0f12';
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, alvo.largura, alvo.altura);

  // Fio da lâmina: uma linha clara no lado que corta, tremendo no impacto.
  const brilho = g.fase === 'impacto' ? 1 : 0.6;
  ctx.strokeStyle = `rgba(235, 238, 245, ${brilho})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  if (alvo.vertical) {
    ctx.moveTo(x + 3, y + 4);
    ctx.lineTo(x + 3, y + alvo.altura - 4);
  } else {
    ctx.moveTo(x + 4, y + alvo.altura - 3);
    ctx.lineTo(x + alvo.largura - 4, y + alvo.altura - 3);
  }
  ctx.stroke();

  // Rebites.
  ctx.fillStyle = '#5a5e68';
  const n = alvo.vertical ? Math.floor(alvo.altura / 40) : Math.floor(alvo.largura / 40);
  for (let i = 0; i < n; i++) {
    const rx = alvo.vertical ? x + alvo.largura / 2 : x + 20 + i * 40;
    const ry = alvo.vertical ? y + 20 + i * 40 : y + alvo.altura / 2;
    ctx.beginPath();
    ctx.arc(rx, ry, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** Tremor irregular da mão do jogador: piora conforme perde dedos. */
function tremorDaMao(agora, dedos) {
  const amplitude = 1.2 + (5 - dedos) * 0.9;
  const crise = ruidoFixo(Math.floor(agora / 900)) > 0.45 ? 1 : 0.3; // tremores vêm em ondas
  const passo = Math.floor(agora / 55);
  return {
    x: (ruidoFixo(passo) - 0.5) * 2 * amplitude * crise,
    y: (ruidoFixo(passo + 7) - 0.5) * 2 * amplitude * crise * 0.6,
  };
}

function desenharVinheta(ctx) {
  const v = ctx.createRadialGradient(LARGURA / 2, ALTURA / 2, 260, LARGURA / 2, ALTURA / 2, 820);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,0.82)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, LARGURA, ALTURA);
}

// ---------------------------------------------------------------------
//  Cartas
// ---------------------------------------------------------------------

/**
 * sprite = { valor: número|null, face: 'cima'|'baixo', marcaOculta: bool,
 *            x, y, escalaX: 0..1 (1 = normal; 0 = de perfil, no meio do giro) }
 */
function desenharCarta(ctx, sprite) {
  const { largura, altura } = CARTA;
  const escalaX = Math.max(0.02, sprite.escalaX ?? 1);

  ctx.save();
  ctx.translate(sprite.x + largura / 2, sprite.y + altura / 2);
  ctx.scale(escalaX, 1);
  ctx.translate(-largura / 2, -altura / 2);

  const virada = sprite.face === 'baixo';

  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.65)';
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = 7;
  retanguloArredondado(ctx, 0, 0, largura, altura, 7);
  ctx.fillStyle = virada ? COR.verso : COR.carta;
  ctx.fill();
  ctx.restore();

  retanguloArredondado(ctx, 0, 0, largura, altura, 7);
  ctx.strokeStyle = virada ? '#0e0a09' : COR.cartaBorda;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  if (virada) {
    ctx.save();
    retanguloArredondado(ctx, 7, 7, largura - 14, altura - 14, 4);
    ctx.strokeStyle = COR.versoLinha;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.clip();
    ctx.strokeStyle = 'rgba(90, 62, 56, 0.55)';
    for (let d = -altura; d < largura + altura; d += 8) {
      ctx.beginPath();
      ctx.moveTo(d, 0);
      ctx.lineTo(d - altura, altura);
      ctx.stroke();
    }
    ctx.restore();
    ctx.restore();
    return;
  }

  const valor = sprite.valor === null ? '?' : String(sprite.valor);
  texto(ctx, valor, largura / 2, altura / 2 + 15, 40, COR.cartaTinta, 'center', true);
  texto(ctx, valor, 9, 20, 14, COR.cartaTinta, 'left', true);
  ctx.save();
  ctx.translate(largura - 9, altura - 8);
  ctx.rotate(Math.PI);
  texto(ctx, valor, 0, 0, 14, COR.cartaTinta, 'left', true);
  ctx.restore();

  if (sprite.marcaOculta) {
    ctx.save();
    ctx.setLineDash([4, 3]);
    ctx.strokeStyle = 'rgba(120, 40, 30, 0.75)';
    ctx.lineWidth = 1;
    retanguloArredondado(ctx, 5, 5, largura - 10, altura - 10, 4);
    ctx.stroke();
    ctx.restore();
    texto(ctx, 'oculta', largura / 2, altura - 12, 10, 'rgba(120, 40, 30, 0.9)');
  }
  ctx.restore();
}

function desenharBaralho(ctx, restantes) {
  const { x, y } = POSICOES.baralho;
  if (restantes <= 0) {
    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = 'rgba(120, 100, 90, 0.35)';
    retanguloArredondado(ctx, x, y, CARTA.largura, CARTA.altura, 7);
    ctx.stroke();
    ctx.restore();
  } else {
    const camadas = Math.min(4, restantes);
    for (let i = camadas - 1; i >= 0; i--) {
      desenharCarta(ctx, { valor: null, face: 'baixo', x: x + i * 2, y: y - i * 2, escalaX: 1 });
    }
  }
  texto(ctx, `baralho · ${restantes}`, x + CARTA.largura / 2, y + CARTA.altura + 24, 13, COR.textoApagado);
}

// ---------------------------------------------------------------------
//  Renderizador
// ---------------------------------------------------------------------

/**
 * mesa = {
 *   eu:  { nome, cartas: [sprite], dedos, aposta },
 *   adv: { nome, cartas: [sprite], dedos, aposta },
 *   emVoo: sprite|null, baralhoRestante,
 *   mensagem, mensagemVermelha, pensando,
 *   cabecaAngulo, escurecimento: 0..1,
 *   rodada, alvo, seed, rapido
 * }
 */
export function criarRenderizador(canvas, opcoes = {}) {
  canvas.width = LARGURA;
  canvas.height = ALTURA;
  const ctx = canvas.getContext('2d');
  const cenario = criarCenario();
  const efeitos = criarEfeitos({ ativos: opcoes.efeitos ?? true });

  function desenhar(mesa, lampada, agora) {
    ctx.fillStyle = COR.fundo;
    ctx.fillRect(0, 0, LARGURA, ALTURA);

    // Tremor de tela (impacto da guilhotina): desloca tudo alguns pixels.
    ctx.save();
    if (mesa.tremor > 0) {
      const passo = Math.floor(agora / 16);
      const forca = 14 * mesa.tremor;
      ctx.translate(
        Math.round((ruidoFixo(passo) - 0.5) * 2 * forca),
        Math.round((ruidoFixo(passo + 31) - 0.5) * 2 * forca * 0.7),
      );
    }

    cenario.desenharParede(ctx, lampada, POSICOES.pivoLampada.x);
    desenharConeDeLuz(ctx, lampada);
    cenario.desenharFundoDaSala(ctx, agora, lampada, POSICOES.luizCentroX);
    desenharOponente(ctx, mesa, agora);
    desenharLuminaria(ctx, lampada);
    cenario.desenharTampo(ctx);
    desenharPocaDeLuz(ctx, lampada);
    desenharBracosDoOponente(ctx, mesa, agora);

    desenharBaralho(ctx, mesa.baralhoRestante);
    cenario.desenharPlaca(ctx, mesa.alvo, mesa.rodada);

    // --- Lado do oponente ---
    for (const c of mesa.adv.cartas) desenharCarta(ctx, c);
    const centroMao = (TAMANHO_MAO.largura * ESCALA_MAO) / 2;
    const baseMao = TAMANHO_MAO.altura * ESCALA_MAO;
    // Contador de dedos e placar da aposta dele, ao lado da mão algemada.
    const origem = origemLuiz();
    const maoDir = {
      x: origem.x + MAO_DIREITA_LUIZ_PX.x * ESCALA_LUIZ,
      y: origem.y + TAMANHO_LUIZ.altura * ESCALA_LUIZ,
    };
    texto(ctx, mesa.adv.nome.toUpperCase(), maoDir.x + 84, maoDir.y - 12, 14, COR.textoApagado, 'left');
    texto(ctx, `${mesa.adv.dedos}/5 dedos`, maoDir.x + 84, maoDir.y + 8, 13, mesa.adv.dedos <= 2 ? COR.vermelho : COR.texto, 'left');
    cenario.desenharPlacar(ctx, 1020, 176, 74, 40, mesa.adv.aposta, { digitos: 2, rotulo: 'APOSTA DELE', agora });

    // --- Lado do jogador ---
    for (const c of mesa.eu.cartas) desenharCarta(ctx, c);
    texto(ctx, mesa.eu.nome.toUpperCase(), 640, 568, 15, COR.textoApagado);
    cenario.desenharPlacar(ctx, 1010, 470, 112, 62, mesa.eu.aposta, {
      digitos: 2, rotulo: 'SUA APOSTA', destaque: mesa.eu.aposta >= 3, agora,
    });

    const total = mesa.eu.cartas.reduce((s, c) => s + (c.valor ?? 0), 0);
    if (mesa.eu.cartas.length > 0) {
      const estourou = total > mesa.alvo;
      texto(ctx, `TOTAL ${total}${estourou ? '   ·   ESTOUROU' : ''}`, 640, 606, 26, estourou ? COR.vermelho : COR.texto, 'center', true);
    }
    // A sua mão: presa, suando, tremendo mais a cada dedo perdido.
    const tremor = tremorDaMao(agora, mesa.eu.dedos);
    desenharMaoPixel(ctx, POSICOES.maoEu.x + tremor.x, POSICOES.maoEu.y + tremor.y, mesa.eu.dedos, { escala: ESCALA_MAO, estilo: 'humana' });
    texto(ctx, mesa.eu.nome.split(' ')[0], POSICOES.maoEu.x + centroMao, POSICOES.maoEu.y + baseMao + 18, 13, COR.textoApagado);
    texto(ctx, `${mesa.eu.dedos}/5 dedos`, POSICOES.maoEu.x + centroMao, POSICOES.maoEu.y + baseMao + 36, 13, mesa.eu.dedos <= 2 ? COR.vermelho : COR.texto);
    // A aposta, escrita junto da mão que está em jogo (o placar vermelho repete o número).
    texto(ctx, `aposta: ${mesa.eu.aposta} ${mesa.eu.aposta === 1 ? 'dedo' : 'dedos'}`, POSICOES.maoEu.x + centroMao, POSICOES.maoEu.y + baseMao + 54, 13, mesa.eu.aposta >= 3 ? COR.vermelho : COR.textoApagado);

    // Guilhotina, por cima da mão punida.
    if (mesa.guilhotina) desenharGuilhotina(ctx, mesa.guilhotina, agora);

    // Carta em movimento, por cima de tudo.
    if (mesa.emVoo) desenharCarta(ctx, mesa.emVoo);

    // --- Escurecimento (revelação) ---
    if (mesa.escurecimento > 0) {
      ctx.fillStyle = `rgba(0, 0, 0, ${mesa.escurecimento})`;
      ctx.fillRect(0, 0, LARGURA, ALTURA);
    }

    // --- Mensagem central ---
    let mensagem = mesa.mensagem;
    if (mesa.pensando) mensagem += '.'.repeat(1 + (Math.floor(agora / 400) % 3));
    texto(ctx, mensagem, 640, 385, 18, mesa.mensagemVermelha ? COR.vermelho : COR.texto);

    desenharVinheta(ctx);

    // Flash vermelho do impacto.
    if (mesa.flash > 0) {
      ctx.fillStyle = `rgba(150, 20, 15, ${0.55 * mesa.flash})`;
      ctx.fillRect(-40, -40, LARGURA + 80, ALTURA + 80);
    }

    ctx.restore(); // fim do tremor

    // Fim de jogo: tela preta e um texto seco.
    if (mesa.telaPreta > 0) {
      ctx.fillStyle = `rgba(0, 0, 0, ${mesa.telaPreta})`;
      ctx.fillRect(0, 0, LARGURA, ALTURA);
      if (mesa.textoFinal) {
        texto(ctx, mesa.textoFinal, LARGURA / 2, ALTURA / 2 - 10, 28, COR.texto);
        texto(ctx, `rodada ${mesa.rodada}   ·   ${mesa.eu.nome.split(' ')[0]} ${mesa.eu.dedos}/5   ·   ${mesa.adv.nome.split(' ')[0]} ${mesa.adv.dedos}/5`,
          LARGURA / 2, ALTURA / 2 + 26, 13, COR.textoApagado);
      }
    }

    // Pós-processamento: granulado, linhas de varredura e vinheta, mais fortes
    // quando a tela escurece ou o jogador está perto de perder tudo.
    const perigo = (5 - mesa.eu.dedos) / 5;
    efeitos.aplicar(ctx, agora, Math.max(mesa.escurecimento, perigo * 0.6));

    const rodape = `seed ${mesa.seed ?? '?'}${mesa.rapido ? '   ·   rápido' : ''}${efeitos.ativos ? '' : '   ·   sem efeitos'}`;
    texto(ctx, rodape, 16, ALTURA - 14, 12, 'rgba(120, 112, 105, 0.7)', 'left');
  }

  return { desenhar };
}
