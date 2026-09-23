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
import { desenharTextoPixel } from './fonte-pixel.js';
import { criarCenario, TV } from './cenario.js';
import { criarEfeitos } from './efeitos.js';
import { tensaoDaCena } from './tensao.js';
import { LINHA_DOS_NOS } from './sprites/mao.js';

export const LARGURA = 1280;
export const ALTURA = 720;

const FONTE = '"Courier New", Courier, "Lucida Console", monospace';

const COR = {
  fundo: '#060505',
  texto: '#ece6da',
  textoApagado: '#b0a89a',
  vermelho: '#e0554a',
  carta: '#d9cfb8',
  cartaBorda: '#8f8570',
  cartaTinta: '#2a241f',
  verso: '#2a1d1a',
  versoLinha: '#4a3430',
};

export const CARTA = { largura: 78, altura: 110, espaco: 14 };
/** Carta trunfo na mão (embaixo) e já jogada (menor, na mesa). */
// Cartas trunfo maiores (pedido do grupo depois de jogar): com a mão
// limitada a 4 sobra espaço, e o símbolo desenhado ficava pequeno demais.
export const TRUNFO = { largura: 84, altura: 112 };
export const TRUNFO_MESA = { largura: 52, altura: 72, passo: 26 };

/** Posições fixas da mesa. As fileiras crescem para a direita a partir de fileiraX0. */
export const POSICOES = {
  fileiraX0: 470,
  advY: 228,
  euY: 400,
  baralho: { x: 1090, y: 300 },
  maoEu: { x: 60, y: 504 }, // 64 linhas x 4 = 256 px: o antebraço sai pela borda de baixo
  // Dois visores lado a lado, à direita da mão e à esquerda dos trunfos.
  visorPontos: { x: 248, y: 590, largura: 156, altura: 58 },
  visorRecorde: { x: 414, y: 590, largura: 112, altura: 58 },
  // Trunfos (2.3): mão do jogador embaixo; cartas jogadas na mesa, cada uma do lado de quem jogou.
  maoTrunfos: { centroX: 768, largura: 470, y: 598 },
  // À direita da coluna de madeira da guilhotina (que termina em x≈276) e à
  // esquerda das cartas numéricas (que começam em x=470).
  mesaTrunfos: { eu: { x: 316, y: 440 }, adv: { x: 316, y: 172 } },
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

/** Onde fica a carta `indice` de uma mão de `total` trunfos. Elas se sobrepõem quando são muitas. */
export function posicaoTrunfoNaMao(indice, total) {
  const area = POSICOES.maoTrunfos;
  const passoIdeal = TRUNFO.largura + 10;
  const passo = total <= 1
    ? 0
    : Math.min(passoIdeal, (area.largura - TRUNFO.largura) / (total - 1));
  const larguraTotal = TRUNFO.largura + passo * (total - 1);
  return {
    x: area.centroX - larguraTotal / 2 + indice * passo,
    y: area.y,
    largura: TRUNFO.largura,
    altura: TRUNFO.altura,
  };
}

/** Onde fica a carta `indice` já jogada na mesa por `lado` ('eu' | 'adv'). */
export function posicaoTrunfoNaMesa(lado, indice) {
  const base = POSICOES.mesaTrunfos[lado];
  return {
    x: base.x + indice * TRUNFO_MESA.passo,
    y: base.y,
    largura: TRUNFO_MESA.largura,
    altura: TRUNFO_MESA.altura,
  };
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

/**
 * Escreve na mesa. Cada texto leva uma sombra escura atrás: a mesa é
 * quase preta em uns pontos e clara em outros, e sem a sombra as letras
 * somem no granulado e na vinheta.
 */
function texto(ctx, str, x, y, tamanho, cor = COR.texto, alinhamento = 'center', negrito = false) {
  ctx.save();
  ctx.font = `${negrito ? 'bold ' : ''}${tamanho}px ${FONTE}`;
  ctx.fillStyle = cor;
  ctx.textAlign = alinhamento;
  ctx.textBaseline = 'alphabetic';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
  ctx.shadowBlur = 5;
  ctx.fillText(str, x, y);
  ctx.restore();
}

/**
 * Texto centralizado que cabe em `larguraMaxima`: quebra em até `maxLinhas`
 * linhas por palavra e, se ainda não couber, reduz a fonte.
 */
function textoAjustado(ctx, str, x, y, tamanho, cor, larguraMaxima, maxLinhas = 2) {
  let fonte = tamanho;
  let linhas;
  for (;;) {
    ctx.font = `${fonte}px ${FONTE}`;
    linhas = [];
    let atual = '';
    for (const palavra of str.split(' ')) {
      const tentativa = atual ? `${atual} ${palavra}` : palavra;
      if (ctx.measureText(tentativa).width <= larguraMaxima || !atual) {
        atual = tentativa;
      } else {
        linhas.push(atual);
        atual = palavra;
      }
    }
    if (atual) linhas.push(atual);
    const cabe = linhas.length <= maxLinhas && linhas.every((l) => ctx.measureText(l).width <= larguraMaxima);
    if (cabe || fonte <= 11) break;
    fonte -= 1;
  }
  const alturaLinha = fonte + 6;
  const yInicial = y - ((linhas.length - 1) * alturaLinha) / 2;
  linhas.forEach((l, i) => texto(ctx, l, x, yInicial + i * alturaLinha, fonte, cor));
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

// ---------------------------------------------------------------------
//  O aparelho: duas colunas de madeira presas na mesa, uma travessa e a
//  lâmina de aço com fio diagonal que fica em repouso no alto e cai entre
//  as colunas até a base dos dedos. Um por mão. As colunas ficam sempre
//  visíveis (a mão está presa no aparelho); a lâmina se mexe só na punição.
// ---------------------------------------------------------------------

function aparelhoDoJogador() {
  const cx = POSICOES.maoEu.x + (TAMANHO_MAO.largura / 2) * ESCALA_MAO;
  return {
    cx,
    topo: 296,
    base: ALTURA,
    abertura: 212,          // distância entre as faces internas das colunas
    coluna: 22,
    alturaLamina: 58,
    yCorte: POSICOES.maoEu.y + LINHA_DOS_NOS * ESCALA_MAO,
  };
}

function aparelhoDoOponente() {
  const origem = origemLuiz();
  return {
    cx: origem.x + MAO_DIREITA_LUIZ_PX.x * ESCALA_LUIZ,
    topo: 128,
    base: origem.y + (MAO_DIREITA_LUIZ_PX.y + 9) * ESCALA_LUIZ,
    abertura: 92,
    coluna: 11,
    alturaLamina: 26,
    yCorte: origem.y + (MAO_DIREITA_LUIZ_PX.y + 2) * ESCALA_LUIZ,
  };
}

function desenharMadeira(ctx, x, y, largura, altura, semente) {
  const g = ctx.createLinearGradient(x, 0, x + largura, 0);
  g.addColorStop(0, '#1d120c');
  g.addColorStop(0.35, '#3a2618');
  g.addColorStop(0.7, '#2c1c11');
  g.addColorStop(1, '#150d08');
  ctx.fillStyle = g;
  ctx.fillRect(x, y, largura, altura);
  ctx.strokeStyle = 'rgba(0,0,0,0.45)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 3; i++) {
    const gx = x + 4 + ruidoFixo(semente + i) * (largura - 8);
    ctx.beginPath();
    ctx.moveTo(gx, y);
    ctx.lineTo(gx + (ruidoFixo(semente + 9 + i) - 0.5) * 6, y + altura);
    ctx.stroke();
  }
  ctx.strokeStyle = '#080503';
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, largura, altura);
}

/** Colunas e travessa (atrás da mão). */
function desenharColunas(ctx, ap) {
  const esq = ap.cx - ap.abertura / 2 - ap.coluna;
  const dir = ap.cx + ap.abertura / 2;
  // Sombra das colunas na mesa.
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(esq - 6, ap.topo + 10, ap.coluna + 6, ap.base - ap.topo);
  ctx.fillRect(dir - 6, ap.topo + 10, ap.coluna + 6, ap.base - ap.topo);
  desenharMadeira(ctx, esq, ap.topo, ap.coluna, ap.base - ap.topo, 11);
  desenharMadeira(ctx, dir, ap.topo, ap.coluna, ap.base - ap.topo, 23);
  // Travessa.
  desenharMadeira(ctx, esq - 6, ap.topo - ap.coluna * 0.9, ap.abertura + ap.coluna * 2 + 12, ap.coluna * 0.9, 37);
  // Ranhura por onde a lâmina desliza.
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(esq + ap.coluna - 3, ap.topo, 3, ap.base - ap.topo);
  ctx.fillRect(dir, ap.topo, 3, ap.base - ap.topo);
  // Parafusos que prendem na mesa.
  ctx.fillStyle = '#5a5e68';
  for (const px of [esq + ap.coluna / 2, dir + ap.coluna / 2]) {
    for (const py of [ap.topo + 14, ap.base - 18]) {
      if (py < ALTURA - 4) {
        ctx.beginPath();
        ctx.arc(px, py, Math.max(2, ap.coluna * 0.14), 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

/** Lâmina com o bloco de madeira em cima (na frente da mão). `progresso` 0 = em repouso no alto, 1 = no corte. */
function desenharLamina(ctx, ap, progresso, fase) {
  const esq = ap.cx - ap.abertura / 2;
  const largura = ap.abertura;
  const alturaBloco = ap.alturaLamina * 0.7;
  const yRepouso = ap.topo + 6 + alturaBloco;
  const yLamina = interpolar(yRepouso, ap.yCorte - ap.alturaLamina, progresso);

  ctx.save();
  // Sombra da lâmina sobre a mão, mais forte quanto mais perto.
  ctx.fillStyle = `rgba(0, 0, 0, ${0.15 + 0.4 * progresso})`;
  ctx.fillRect(esq + 4, yLamina + ap.alturaLamina * 0.6 + 8, largura - 8, ap.alturaLamina * 0.5);

  // Bloco de madeira (o peso) acima da lâmina.
  desenharMadeira(ctx, esq + 2, yLamina - alturaBloco, largura - 4, alturaBloco, 53);
  ctx.fillStyle = '#5a5e68';
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.arc(esq + 14 + i * (largura - 28) / 2, yLamina - alturaBloco / 2, Math.max(2, ap.alturaLamina * 0.06), 0, Math.PI * 2);
    ctx.fill();
  }

  // Lâmina trapezoidal: fio diagonal, mais baixo à direita.
  const yEsq = yLamina + ap.alturaLamina * 0.55;
  const yDir = yLamina + ap.alturaLamina;
  ctx.beginPath();
  ctx.moveTo(esq, yLamina);
  ctx.lineTo(esq + largura, yLamina);
  ctx.lineTo(esq + largura, yDir);
  ctx.lineTo(esq, yEsq);
  ctx.closePath();
  const aco = ctx.createLinearGradient(0, yLamina, 0, yDir);
  aco.addColorStop(0, '#3a3d45');
  aco.addColorStop(0.4, '#7d838f');
  aco.addColorStop(0.75, '#b9bec8');
  aco.addColorStop(1, '#e6e9ef');
  ctx.fillStyle = aco;
  ctx.fill();
  ctx.strokeStyle = '#0e0f12';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // Fio: linha clara ao longo da diagonal, mais forte no impacto.
  ctx.strokeStyle = `rgba(245, 247, 252, ${fase === 'impacto' ? 1 : 0.7})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(esq + 2, yEsq - 1);
  ctx.lineTo(esq + largura - 2, yDir - 1);
  ctx.stroke();
  // Manchas escuras no aço.
  ctx.fillStyle = 'rgba(40, 30, 30, 0.35)';
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.ellipse(esq + 20 + ruidoFixo(i + 70) * (largura - 40), yLamina + 6 + ruidoFixo(i + 80) * ap.alturaLamina * 0.4,
      6 + ruidoFixo(i) * 8, 3, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function progressoDaLamina(mesa, lado) {
  if (!mesa.punicao || mesa.punicao.tipo !== 'dedos' || mesa.punicao.lado !== lado) {
    return { progresso: 0, fase: 'repouso' };
  }
  return { progresso: mesa.punicao.progresso, fase: mesa.punicao.fase };
}

// ---------------------------------------------------------------------
//  Nível 2 — taser: braçadeira sobre a mão e medidor de ponteiro (2.4)
// ---------------------------------------------------------------------

/** Onde fica o medidor de cada lado. */
const MEDIDOR = {
  eu: { x: 142, y: 424, raio: 58 },
  adv: { x: 906, y: 196, raio: 42 },
};

/** Braçadeira de metal com dois eletrodos, presa sobre a mão. */
function desenharTaser(ctx, mesa, lado, agora) {
  const grande = lado === 'eu';
  const centro = grande
    ? { x: POSICOES.maoEu.x + (TAMANHO_MAO.largura / 2) * ESCALA_MAO, y: POSICOES.maoEu.y + 44 }
    : (() => {
      const o = origemLuiz();
      return { x: o.x + MAO_DIREITA_LUIZ_PX.x * ESCALA_LUIZ, y: o.y + (MAO_DIREITA_LUIZ_PX.y - 2) * ESCALA_LUIZ };
    })();
  const largura = grande ? 208 : 92;
  const altura = grande ? 26 : 13;
  const x = centro.x - largura / 2;
  const y = centro.y - altura / 2;

  const descarregando = mesa.punicao?.tipo === 'choque' && mesa.punicao.lado === lado
    && mesa.punicao.fase === 'descarga';
  const carregando = mesa.punicao?.tipo === 'choque' && mesa.punicao.lado === lado
    && mesa.punicao.fase === 'carregando';

  ctx.save();
  // Sombra e barra de metal.
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(x - 4, y + altura, largura + 8, altura * 0.5);
  const metal = ctx.createLinearGradient(0, y, 0, y + altura);
  metal.addColorStop(0, '#6b7079');
  metal.addColorStop(0.5, '#3a3e45');
  metal.addColorStop(1, '#1b1e22');
  retanguloArredondado(ctx, x, y, largura, altura, 4);
  ctx.fillStyle = metal;
  ctx.fill();
  ctx.strokeStyle = '#0d0f12';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Eletrodos nas pontas, acesos quando o aparelho carrega ou dispara.
  const brilho = descarregando ? 1 : carregando ? 0.35 + 0.35 * Math.abs(Math.sin(agora / 70)) : 0.12;
  for (const ex of [x + altura * 0.7, x + largura - altura * 0.7]) {
    ctx.beginPath();
    ctx.arc(ex, y + altura / 2, altura * 0.34, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(150, 220, 255, ${0.25 + 0.75 * brilho})`;
    ctx.shadowColor = `rgba(120, 200, 255, ${brilho})`;
    ctx.shadowBlur = 18 * brilho;
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  // Arco elétrico entre os eletrodos durante a descarga.
  if (descarregando) {
    ctx.strokeStyle = 'rgba(210, 240, 255, 0.95)';
    ctx.lineWidth = 2;
    const x0 = x + altura * 0.7;
    const x1 = x + largura - altura * 0.7;
    const passos = grande ? 14 : 8;
    for (let repeticao = 0; repeticao < 2; repeticao++) {
      ctx.beginPath();
      for (let i = 0; i <= passos; i++) {
        const t = i / passos;
        const px = interpolar(x0, x1, t);
        const desvio = i === 0 || i === passos
          ? 0
          : (ruidoFixo(Math.floor(agora / 28) + i * 7 + repeticao * 91) - 0.5) * altura * 1.6;
        if (i === 0) ctx.moveTo(px, y + altura / 2);
        else ctx.lineTo(px, y + altura / 2 + desvio);
      }
      ctx.stroke();
    }
  }

  // Cabo saindo para fora da mesa.
  ctx.strokeStyle = '#15181c';
  ctx.lineWidth = grande ? 6 : 3;
  ctx.beginPath();
  ctx.moveTo(x + largura, y + altura / 2);
  ctx.quadraticCurveTo(x + largura + (grande ? 70 : 34), y + altura, x + largura + (grande ? 40 : 20), y + (grande ? 120 : 52));
  ctx.stroke();
  ctx.restore();
}

/** Medidor analógico de 0 a 10, com ponteiro e zona vermelha no fim. */
function desenharMedidor(ctx, lado, valor, nome) {
  const { x, y, raio } = MEDIDOR[lado];
  const anguloInicial = Math.PI * 0.78;
  const anguloFinal = Math.PI * 2.22;
  const proporcao = Math.max(0, Math.min(1, valor / 10));

  ctx.save();
  // Caixa.
  ctx.beginPath();
  ctx.arc(x, y, raio, 0, Math.PI * 2);
  const caixa = ctx.createLinearGradient(x, y - raio, x, y + raio);
  caixa.addColorStop(0, '#3c3a37');
  caixa.addColorStop(1, '#16151400');
  ctx.fillStyle = '#20201e';
  ctx.fill();
  ctx.strokeStyle = '#0a0908';
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.strokeStyle = '#575249';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(x, y, raio - 3, 0, Math.PI * 2);
  ctx.stroke();

  // Mostrador de papel velho.
  ctx.beginPath();
  ctx.arc(x, y, raio - 7, 0, Math.PI * 2);
  ctx.fillStyle = '#c6bda4';
  ctx.fill();

  // Zona vermelha de 8 a 10.
  ctx.beginPath();
  ctx.arc(x, y, raio - 12, interpolar(anguloInicial, anguloFinal, 0.8), anguloFinal);
  ctx.lineWidth = 6;
  ctx.strokeStyle = 'rgba(180, 40, 30, 0.75)';
  ctx.stroke();

  // Marcas de 0 a 10.
  for (let i = 0; i <= 10; i++) {
    const ang = interpolar(anguloInicial, anguloFinal, i / 10);
    const interno = raio - (i % 5 === 0 ? 20 : 15);
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(ang) * interno, y + Math.sin(ang) * interno);
    ctx.lineTo(x + Math.cos(ang) * (raio - 9), y + Math.sin(ang) * (raio - 9));
    ctx.strokeStyle = '#2c2721';
    ctx.lineWidth = i % 5 === 0 ? 2.5 : 1;
    ctx.stroke();
    if (i % 5 === 0 && raio > 50) {
      texto(ctx, String(i), x + Math.cos(ang) * (raio - 30), y + Math.sin(ang) * (raio - 30) + 4, 11, '#2c2721');
    }
  }

  // Ponteiro.
  const ang = interpolar(anguloInicial, anguloFinal, proporcao);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  ctx.beginPath();
  ctx.moveTo(-raio * 0.12, 0);
  ctx.lineTo(raio - 12, -2);
  ctx.lineTo(raio - 12, 2);
  ctx.closePath();
  ctx.fillStyle = proporcao >= 0.8 ? '#a8231b' : '#1e1a16';
  ctx.fill();
  ctx.restore();
  ctx.beginPath();
  ctx.arc(x, y, raio * 0.09, 0, Math.PI * 2);
  ctx.fillStyle = '#2c2721';
  ctx.fill();

  // Vidro e legenda.
  const vidro = ctx.createLinearGradient(x - raio, y - raio, x + raio, y + raio);
  vidro.addColorStop(0, 'rgba(255,255,255,0.13)');
  vidro.addColorStop(0.5, 'rgba(255,255,255,0)');
  ctx.beginPath();
  ctx.arc(x, y, raio - 7, 0, Math.PI * 2);
  ctx.fillStyle = vidro;
  ctx.fill();
  ctx.restore();

  texto(ctx, nome, x, y + raio + 16, 11, COR.textoApagado);
  texto(ctx, `${valor.toFixed(0)} / 10`, x, y + raio + 32, 13,
    valor >= 8 ? COR.vermelho : COR.texto);
}

// ---------------------------------------------------------------------
//  Nível 3 — serra: trilho de 15 marcas e a lâmina circular (2.4)
// ---------------------------------------------------------------------

const TRILHO = { x: 150, yOponente: 196, yJogador: 528, marcas: 15 };

/** Posição vertical da serra para uma posição do trilho (0 = jogador, 15 = oponente). */
function yDaSerra(posicao) {
  return interpolar(TRILHO.yJogador, TRILHO.yOponente, posicao / TRILHO.marcas);
}

/** O trilho riscado na mesa, com as 15 marcas. Desenhado antes das mãos. */
function desenharTrilho(ctx, nomeJogador, nomeOponente) {
  ctx.save();
  // Sulco na mesa e a barra de metal do trilho.
  ctx.strokeStyle = 'rgba(0,0,0,0.6)';
  ctx.lineWidth = 16;
  ctx.beginPath();
  ctx.moveTo(TRILHO.x, TRILHO.yOponente);
  ctx.lineTo(TRILHO.x, TRILHO.yJogador);
  ctx.stroke();
  const barra = ctx.createLinearGradient(TRILHO.x - 6, 0, TRILHO.x + 6, 0);
  barra.addColorStop(0, '#2b2e34');
  barra.addColorStop(0.4, '#878d99');
  barra.addColorStop(0.7, '#4a4e56');
  barra.addColorStop(1, '#1c1f24');
  ctx.strokeStyle = barra;
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.moveTo(TRILHO.x, TRILHO.yOponente);
  ctx.lineTo(TRILHO.x, TRILHO.yJogador);
  ctx.stroke();
  // Suportes parafusados nas duas pontas.
  for (const y of [TRILHO.yOponente, TRILHO.yJogador]) {
    ctx.fillStyle = '#3c4048';
    ctx.fillRect(TRILHO.x - 13, y - 5, 26, 10);
    ctx.fillStyle = '#7e828f';
    ctx.beginPath();
    ctx.arc(TRILHO.x, y, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // As 15 marcas riscadas a faca, mais fundas de 5 em 5.
  for (let i = 0; i <= TRILHO.marcas; i++) {
    const y = yDaSerra(i);
    const forte = i % 5 === 0;
    ctx.strokeStyle = forte ? 'rgba(215, 205, 180, 0.8)' : 'rgba(180, 168, 145, 0.5)';
    ctx.lineWidth = forte ? 2.5 : 1.5;
    const comprimento = forte ? 24 : 15;
    ctx.beginPath();
    ctx.moveTo(TRILHO.x + 9, y + (ruidoFixo(i) - 0.5) * 1.5);
    ctx.lineTo(TRILHO.x + 9 + comprimento, y + (ruidoFixo(i + 9) - 0.5) * 2);
    ctx.stroke();
    if (forte) texto(ctx, String(i), TRILHO.x + 42, y + 4, 11, 'rgba(210, 200, 178, 0.7)', 'left');
  }

  texto(ctx, nomeOponente, TRILHO.x, TRILHO.yOponente - 16, 12, COR.textoApagado);
  texto(ctx, nomeJogador, TRILHO.x, TRILHO.yJogador + 24, 12, COR.textoApagado);
  ctx.restore();
}

/** A lâmina circular sobre o trilho. Desenhada depois das mãos. */
function desenharSerra(ctx, mesa, agora) {
  const y = yDaSerra(mesa.serraPos);
  const x = TRILHO.x;
  const andando = mesa.punicao?.tipo === 'serra';
  const raio = 62;
  const giro = (agora / (andando ? 90 : 260)) % (Math.PI * 2);

  ctx.save();
  // Sombra na mesa.
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.beginPath();
  ctx.ellipse(x + 10, y + 14, raio * 0.95, raio * 0.4, 0, 0, Math.PI * 2);
  ctx.fill();

  // Motor: caixa atrás da lâmina.
  retanguloArredondado(ctx, x - 22, y - 18, 44, 36, 5);
  const caixa = ctx.createLinearGradient(x - 22, 0, x + 22, 0);
  caixa.addColorStop(0, '#4a4038');
  caixa.addColorStop(1, '#241e1a');
  ctx.fillStyle = caixa;
  ctx.fill();
  ctx.strokeStyle = '#0d0b0a';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Disco com dentes.
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(giro);
  const dentes = 22;
  ctx.beginPath();
  for (let i = 0; i < dentes; i++) {
    const a0 = (i / dentes) * Math.PI * 2;
    const a1 = ((i + 0.5) / dentes) * Math.PI * 2;
    ctx.lineTo(Math.cos(a0) * raio, Math.sin(a0) * raio);
    ctx.lineTo(Math.cos(a1) * (raio - 10), Math.sin(a1) * (raio - 10));
  }
  ctx.closePath();
  const aco = ctx.createLinearGradient(-raio, -raio, raio, raio);
  aco.addColorStop(0, '#585d66');
  aco.addColorStop(0.45, '#c3c8d2');
  aco.addColorStop(0.6, '#8d929c');
  aco.addColorStop(1, '#3a3e45');
  ctx.fillStyle = aco;
  ctx.fill();
  ctx.strokeStyle = '#111316';
  ctx.lineWidth = 1;
  ctx.stroke();
  // Furo central, parafuso e três rasgos no disco.
  ctx.beginPath();
  ctx.arc(0, 0, raio * 0.2, 0, Math.PI * 2);
  ctx.fillStyle = '#20232a';
  ctx.fill();
  ctx.strokeStyle = 'rgba(30, 34, 40, 0.8)';
  ctx.lineWidth = 5;
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(0, 0, raio * 0.55, a, a + 0.9);
    ctx.stroke();
  }
  ctx.restore();

  // Poeira de madeira enquanto anda.
  if (andando) {
    ctx.fillStyle = 'rgba(190, 170, 130, 0.5)';
    for (let i = 0; i < 10; i++) {
      const t = ruidoFixo(Math.floor(agora / 40) + i * 13);
      const t2 = ruidoFixo(Math.floor(agora / 40) + i * 29);
      ctx.fillRect(x - 24 + t * 48, y + 6 + t2 * 26, 2, 2);
    }
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
  // Número do canto de baixo, girado 180°. Depois do giro os dígitos crescem
  // para BAIXO a partir da linha de base, então ela fica a 20 px da borda
  // (e não a 8), senão o número vaza para fora da carta.
  ctx.save();
  ctx.translate(largura - 9, altura - 20);
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

// ---------------------------------------------------------------------
//  Cartas trunfo (2.3)
// ---------------------------------------------------------------------

const COR_TRUNFO = {
  fundo: '#191014',
  fundoClaro: '#2a1b20',
  borda: '#6b4a3a',
  bordaViva: '#c9a06a',
  tinta: '#d8c4a0',
  tintaFraca: 'rgba(216, 196, 160, 0.55)',
};

/** Traço trêmulo, como desenhado à mão: a linha desvia um pouco do caminho reto. */
function tracoTremido(ctx, pontos, semente = 0, desvio = 1.4) {
  ctx.beginPath();
  pontos.forEach(([x, y], i) => {
    const jx = (ruidoFixo(semente + i * 7) - 0.5) * 2 * desvio;
    const jy = (ruidoFixo(semente + i * 13 + 3) - 0.5) * 2 * desvio;
    if (i === 0) ctx.moveTo(x + jx, y + jy);
    else ctx.lineTo(x + jx, y + jy);
  });
  ctx.stroke();
}

function circuloTremido(ctx, cx, cy, raio, semente = 0, desvio = 1.2) {
  const pontos = [];
  for (let i = 0; i <= 18; i++) {
    const a = (i / 18) * Math.PI * 2;
    pontos.push([cx + Math.cos(a) * raio, cy + Math.sin(a) * raio]);
  }
  tracoTremido(ctx, pontos, semente, desvio);
}

function setaTremida(ctx, x0, y0, x1, y1, semente) {
  tracoTremido(ctx, [[x0, y0], [x1, y1]], semente);
  const ang = Math.atan2(y1 - y0, x1 - x0);
  const p = 6;
  tracoTremido(ctx, [
    [x1 - Math.cos(ang - 0.5) * p, y1 - Math.sin(ang - 0.5) * p],
    [x1, y1],
    [x1 - Math.cos(ang + 0.5) * p, y1 - Math.sin(ang + 0.5) * p],
  ], semente + 31);
}

/** Símbolo meio desenhado à mão de cada carta, centrado em (cx, cy). */
function desenharSimboloTrunfo(ctx, id, cx, cy, tamanho) {
  const u = tamanho / 2;            // meia altura útil do símbolo
  const semente = id.length * 17;
  ctx.save();
  ctx.strokeStyle = COR_TRUNFO.tinta;
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.rotate((ruidoFixo(semente) - 0.5) * 0.06);

  const numero = (n, raio = u * 0.82) => {
    circuloTremido(ctx, cx, cy, raio, semente);
    texto(ctx, String(n), cx, cy + raio * 0.42, raio * 1.15, COR_TRUNFO.tinta, 'center', true);
  };
  const cartinha = (dx = 0, dy = 0, escala = 1) => {
    const l = u * 0.62 * escala;
    const a = u * 0.86 * escala;
    tracoTremido(ctx, [
      [cx + dx - l / 2, cy + dy - a / 2], [cx + dx + l / 2, cy + dy - a / 2],
      [cx + dx + l / 2, cy + dy + a / 2], [cx + dx - l / 2, cy + dy + a / 2],
      [cx + dx - l / 2, cy + dy - a / 2],
    ], semente + 5);
  };

  // As cartas "+" e "++" (4.4a) desenham o mesmo símbolo da irmã menor,
  // com uma ou duas cruzinhas no canto.
  const grau = id.endsWith('_plus_plus') ? 2 : id.endsWith('_plus') ? 1 : 0;
  const base = id.replace(/_plus_plus$|_plus$/, '');
  if (grau > 0) {
    const marca = grau === 2 ? '++' : '+';
    texto(ctx, marca, cx + u * 0.82, cy - u * 0.62, u * 0.75, COR_TRUNFO.tinta, 'center', true);
  }

  switch (base) {
    case 'one_up':
    case 'two_up': {
      const n = base === 'one_up' ? 1 : 2;
      setaTremida(ctx, cx, cy + u * 0.75, cx, cy - u * 0.55, semente);
      texto(ctx, `+${n}`, cx + u * 0.55, cy - u * 0.05, u * 0.95, COR_TRUNFO.tinta, 'center', true);
      break;
    }
    case 'remove':
      cartinha(-u * 0.3, 0);
      setaTremida(ctx, cx + u * 0.05, cy, cx + u * 0.85, cy, semente + 9);
      break;
    case 'return':
      cartinha(u * 0.3, 0);
      setaTremida(ctx, cx - u * 0.05, cy, cx - u * 0.85, cy, semente + 9);
      break;
    case 'shield':
      tracoTremido(ctx, [
        [cx - u * 0.7, cy - u * 0.7], [cx + u * 0.7, cy - u * 0.7],
        [cx + u * 0.7, cy + u * 0.1], [cx, cy + u * 0.85],
        [cx - u * 0.7, cy + u * 0.1], [cx - u * 0.7, cy - u * 0.7],
      ], semente);
      tracoTremido(ctx, [[cx, cy - u * 0.5], [cx, cy + u * 0.5]], semente + 4, 0.8);
      break;
    case 'destroy':
      cartinha(0, 0);
      ctx.strokeStyle = '#c05040';
      tracoTremido(ctx, [[cx - u * 0.55, cy - u * 0.7], [cx + u * 0.55, cy + u * 0.7]], semente + 2, 2);
      tracoTremido(ctx, [[cx + u * 0.55, cy - u * 0.7], [cx - u * 0.55, cy + u * 0.7]], semente + 6, 2);
      break;
    case 'perfect_draw': {
      cartinha(0, u * 0.1, 0.9);
      const pontas = [];
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i / 10) * Math.PI * 2;
        const r = i % 2 === 0 ? u * 0.5 : u * 0.22;
        pontas.push([cx + Math.cos(a) * r, cy + u * 0.1 + Math.sin(a) * r]);
      }
      pontas.push(pontas[0]);
      tracoTremido(ctx, pontas, semente + 11, 0.7);
      break;
    }
    case 'go_for_17': numero(17, u * 0.9); circuloTremido(ctx, cx, cy, u * 1.02, semente + 3); break;
    case 'go_for_24': numero(24, u * 0.9); circuloTremido(ctx, cx, cy, u * 1.02, semente + 3); break;
    case 'go_for_27': numero(27, u * 0.9); circuloTremido(ctx, cx, cy, u * 1.02, semente + 3); break;
    // --- 4.4a ---------------------------------------------------------
    case 'exchange':
      // Duas cartas trocando de lugar.
      cartinha(-u * 0.42, u * 0.12, 0.8);
      cartinha(u * 0.42, -u * 0.12, 0.8);
      setaTremida(ctx, cx - u * 0.1, cy - u * 0.55, cx + u * 0.5, cy - u * 0.55, semente + 3);
      setaTremida(ctx, cx + u * 0.1, cy + u * 0.55, cx - u * 0.5, cy + u * 0.55, semente + 7);
      break;

    case 'trump_switch':
      // Uma carta saindo e outra entrando.
      cartinha(0, 0, 0.9);
      setaTremida(ctx, cx - u * 0.95, cy - u * 0.5, cx - u * 0.3, cy - u * 0.5, semente + 2);
      setaTremida(ctx, cx + u * 0.3, cy + u * 0.5, cx + u * 0.95, cy + u * 0.5, semente + 8);
      break;

    case 'harvest': {
      // Um monte de cartas e uma seta caindo dentro dele.
      cartinha(-u * 0.30, u * 0.26, 0.72);
      cartinha(0, u * 0.26, 0.72);
      cartinha(u * 0.30, u * 0.26, 0.72);
      setaTremida(ctx, cx, cy - u * 0.95, cx, cy - u * 0.28, semente + 4);
      break;
    }

    case 'ultimate_draw': {
      // A estrela do Perfect Draw com cartas atrás.
      cartinha(-u * 0.34, u * 0.05, 0.75);
      cartinha(u * 0.34, u * 0.05, 0.75);
      const pontas = [];
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i / 10) * Math.PI * 2;
        const r = i % 2 === 0 ? u * 0.52 : u * 0.23;
        pontas.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
      }
      pontas.push(pontas[0]);
      tracoTremido(ctx, pontas, semente + 11, 0.7);
      break;
    }

    case 'love_your_enemy': {
      // Um coração torto, que é o que a carta é: um presente ao inimigo.
      const pontos = [[cx, cy + u * 0.78]];
      for (let i = 0; i <= 24; i++) {
        const t = Math.PI + (i / 24) * Math.PI;
        pontos.push([cx - u * 0.46 + Math.cos(t) * u * 0.42, cy - u * 0.20 + Math.sin(t) * u * 0.42]);
      }
      for (let i = 0; i <= 24; i++) {
        const t = Math.PI + (i / 24) * Math.PI;
        pontos.push([cx + u * 0.46 + Math.cos(t) * u * 0.42, cy - u * 0.20 + Math.sin(t) * u * 0.42]);
      }
      pontos.push([cx, cy + u * 0.78]);
      tracoTremido(ctx, pontos, semente + 13, 0.5);
      break;
    }

    default: {
      const valor = /^card_(\d+)$/.exec(base)?.[1];
      if (valor) numero(valor);
      else texto(ctx, '?', cx, cy + u * 0.4, u, COR_TRUNFO.tinta, 'center', true);
    }
  }
  ctx.restore();
}

/**
 * Carta trunfo: fundo escuro, moldura trêmula e o símbolo à mão.
 * `carta` = { id, nome }. `opcoes.destacada` levanta a carta (mouse em cima).
 */
function desenharCartaTrunfo(ctx, carta, x, y, largura, altura, opcoes = {}) {
  const { destacada = false, escala = 1, comNome = true } = opcoes;
  ctx.save();
  ctx.translate(x + largura / 2, y + altura / 2);
  ctx.scale(escala, escala);
  ctx.translate(-largura / 2, -altura / 2);

  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.7)';
  ctx.shadowBlur = destacada ? 20 : 12;
  ctx.shadowOffsetY = destacada ? 4 : 6;
  retanguloArredondado(ctx, 0, 0, largura, altura, 6);
  const fundo = ctx.createLinearGradient(0, 0, 0, altura);
  fundo.addColorStop(0, COR_TRUNFO.fundoClaro);
  fundo.addColorStop(1, COR_TRUNFO.fundo);
  ctx.fillStyle = fundo;
  ctx.fill();
  ctx.restore();

  retanguloArredondado(ctx, 0, 0, largura, altura, 6);
  ctx.strokeStyle = destacada ? COR_TRUNFO.bordaViva : COR_TRUNFO.borda;
  ctx.lineWidth = destacada ? 2 : 1.5;
  ctx.stroke();

  // Moldura interna trêmula, como riscada à mão.
  ctx.strokeStyle = destacada ? 'rgba(201, 160, 106, 0.8)' : 'rgba(150, 110, 80, 0.55)';
  ctx.lineWidth = 1;
  const m = 5;
  tracoTremido(ctx, [
    [m, m], [largura - m, m], [largura - m, altura - m], [m, altura - m], [m, m],
  ], carta.id.length * 3, 1.1);

  const alturaSimbolo = comNome ? altura * 0.52 : altura * 0.62;
  desenharSimboloTrunfo(ctx, carta.id, largura / 2, alturaSimbolo * 0.92 + 6, alturaSimbolo * 0.7);

  if (comNome) {
    const nome = carta.nome.toUpperCase();
    const tamanho = nome.length > 9 ? 8 : 9;
    texto(ctx, nome, largura / 2, altura - 10, tamanho, COR_TRUNFO.tintaFraca);
  }
  ctx.restore();
}

/** Caixa com o nome e o texto em português da carta sob o cursor. */
function desenharDica(ctx, dica) {
  const largura = 300;
  const margem = 12;
  ctx.font = `12px ${FONTE}`;

  const linhas = [];
  let atual = '';
  for (const palavra of dica.texto.split(' ')) {
    const tentativa = atual ? `${atual} ${palavra}` : palavra;
    if (ctx.measureText(tentativa).width <= largura - margem * 2 || !atual) atual = tentativa;
    else { linhas.push(atual); atual = palavra; }
  }
  if (atual) linhas.push(atual);

  const temRaridade = Boolean(dica.raridade);
  const altura = margem * 2 + 18 + linhas.length * 16 + (temRaridade ? 18 : 0);
  const x = Math.max(12, Math.min(LARGURA - largura - 12, dica.x - largura / 2));
  const y = Math.max(12, dica.y - altura - 14);

  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.8)';
  ctx.shadowBlur = 18;
  retanguloArredondado(ctx, x, y, largura, altura, 6);
  ctx.fillStyle = 'rgba(14, 10, 9, 0.96)';
  ctx.fill();
  ctx.restore();
  retanguloArredondado(ctx, x, y, largura, altura, 6);
  ctx.strokeStyle = COR_TRUNFO.borda;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  texto(ctx, dica.titulo.toUpperCase(), x + margem, y + margem + 12, 13, COR_TRUNFO.bordaViva, 'left', true);
  linhas.forEach((linha, i) => {
    texto(ctx, linha, x + margem, y + margem + 32 + i * 16, 12, COR.texto, 'left');
  });

  // Raridade e a chance de a carta sair num sorteio (pedido do grupo).
  if (temRaridade) {
    const base = y + margem + 32 + linhas.length * 16 + 4;
    texto(ctx, dica.raridade.nome.toUpperCase(), x + margem, base + 8, 11,
      dica.raridade.cor, 'left', true);
    if (dica.chance !== null && dica.chance !== undefined) {
      const numero = dica.chance < 10
        ? dica.chance.toFixed(1).replace('.', ',')
        : String(Math.round(dica.chance));
      texto(ctx, `${numero}% de chance de sair`, x + largura - margem, base + 8, 11,
        COR.textoApagado, 'right');
    }
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
// ---------------------------------------------------------------------
//  Demonstração: a câmera e o selo (3.5)
//
//  A mesa é a mesma do jogo; o que muda é que a "câmera" passeia devagar
//  por ela, como um vídeo de vitrine. O zoom respira e o alvo desliza;
//  os períodos são números primos entre si, então o movimento demora
//  muito para repetir e nunca fica parado.
//
//  O passeio nunca pode mostrar fora da tela: o quanto a câmera pode
//  deslizar sai do próprio zoom (quanto mais perto, mais sobra), com uma
//  folga de 10%.
// ---------------------------------------------------------------------

const CAMERA = {
  zoomMinimo: 1.06,
  zoomMaximo: 1.28,
  periodoZoom: 19000,
  periodoX: 23000,
  periodoY: 15000,
  folga: 0.9,
};

function aplicarCameraDaDemonstracao(ctx, tempo) {
  const onda = (periodo, atraso = 0) => Math.sin(((tempo + atraso) / periodo) * Math.PI * 2);
  const zoom = CAMERA.zoomMinimo
    + ((onda(CAMERA.periodoZoom) + 1) / 2) * (CAMERA.zoomMaximo - CAMERA.zoomMinimo);

  const sobraX = (LARGURA / 2) * (1 - 1 / zoom) * CAMERA.folga;
  const sobraY = (ALTURA / 2) * (1 - 1 / zoom) * CAMERA.folga;
  const focoX = LARGURA / 2 + onda(CAMERA.periodoX) * sobraX;
  const focoY = ALTURA / 2 + onda(CAMERA.periodoY, CAMERA.periodoY / 3) * sobraY;

  ctx.translate(LARGURA / 2, ALTURA / 2);
  ctx.scale(zoom, zoom);
  ctx.translate(-focoX, -focoY);
}

/**
 * O selo por cima da mesa: o que é aquilo e como sair. Fica fora do
 * passeio da câmera, parado nos cantos, como a tarja de um vídeo.
 */
function desenharSeloDaDemonstracao(ctx, mesa, agora) {
  // Um véu leve, para o selo se ler sobre qualquer parte da mesa.
  ctx.fillStyle = 'rgba(0, 0, 0, 0.32)';
  ctx.fillRect(0, 0, LARGURA, ALTURA);

  const piscando = Math.floor(agora / 700) % 2 === 0;

  // Tarja de cima: o que está acontecendo.
  ctx.fillStyle = 'rgba(0, 0, 0, 0.62)';
  ctx.fillRect(0, 26, 470, 74);
  texto(ctx, 'DEMONSTRAÇÃO', 40, 62, 24, piscando ? COR.texto : COR.textoApagado, 'left', true);
  texto(ctx, `nível ${mesa.nivel}  ·  a casa joga contra ela mesma`, 40, 88, 14, COR.textoApagado, 'left');

  // Tarja de baixo: como sair.
  ctx.fillStyle = 'rgba(0, 0, 0, 0.62)';
  ctx.fillRect(0, ALTURA - 46, LARGURA, 46);
  if (piscando) {
    texto(ctx, 'PRESSIONE QUALQUER TECLA PARA JOGAR', LARGURA / 2, ALTURA - 16, 19, COR.texto, 'center', true);
  }
}

// ---------------------------------------------------------------------
//  O que está guardado (4.1)
//
//  Duas coisas aparecem por causa da persistência: o rodapé do título,
//  que diz quantas recompensas já saíram e como apagar tudo, e a linha
//  de "desbloqueado" no fim da partida.
// ---------------------------------------------------------------------

function desenharRodapeDosDados(ctx, mesa) {
  const dados = mesa.dados;
  if (!dados) return;
  const y = 534;

  if (dados.pedindoApagar) {
    texto(ctx, 'APAGAR RECORDE, ESTATÍSTICAS E DESBLOQUEIOS?', LARGURA / 2, y, 17, COR.vermelho, 'center', true);
    texto(ctx, 'DEL de novo confirma  ·  qualquer outra tecla desiste',
      LARGURA / 2, y + 24, 14, COR.textoApagado);
    return;
  }

  if (dados.apagadoHa !== null) {
    texto(ctx, 'dados apagados', LARGURA / 2, y, 16, COR.textoApagado);
    return;
  }

  const partes = [];
  if (mesa.recorde.valor > 0) partes.push(`recorde ${mesa.recorde.valor}`);
  partes.push(`desbloqueios ${dados.desbloqueadas}/${dados.total}`);
  texto(ctx, partes.join('   ·   '), LARGURA / 2, y, 14, COR.textoApagado);

  // O modo difícil é escolhido aqui, no menu inicial.
  if (mesa.dificil) {
    texto(ctx, 'MODO DIFÍCIL LIGADO', LARGURA / 2, y - 44, 15, COR.vermelho, 'center', true);
    texto(ctx, 'o oponente joga no máximo desde o nível 1   ·   o monte vem inteiro   ·   nenhuma recompensa vale',
      LARGURA / 2, y - 24, 12, COR.textoApagado);
  } else {
    texto(ctx, 'modo normal   ·   H liga o modo difícil',
      LARGURA / 2, y - 26, 14, COR.textoApagado);
  }

  if (dados.salvando) {
    const efeitos = mesa.efeitos?.ligados === false ? 'E liga os efeitos' : 'E desliga os efeitos';
    texto(ctx, `M liga e desliga o som   ·   ${efeitos}   ·   DEL apaga os dados salvos`,
      LARGURA / 2, y + 22, 12, 'rgba(140, 132, 122, 0.75)');
  } else {
    texto(ctx, 'este navegador não está guardando nada; o que você jogar some ao recarregar',
      LARGURA / 2, y + 22, 12, COR.vermelho);
  }
}

/**
 * A tarja com a fala do anfitrião durante a rodada. Fica no alto, presa
 * na largura do texto, e tremula de leve como legenda de transmissão.
 */
function desenharComentarioDoAnfitriao(ctx, fala, agora) {
  const tamanho = 17;
  ctx.font = `${tamanho}px ${FONTE}`;
  const rotulo = `${NOME_ANFITRIAO.toUpperCase()}  ·  `;
  ctx.font = `bold 12px ${FONTE}`;
  const larguraRotulo = ctx.measureText(rotulo).width;
  ctx.font = `${tamanho}px ${FONTE}`;
  const larguraFala = ctx.measureText(fala).width;

  const margem = 18;
  const largura = Math.min(LARGURA - 80, larguraRotulo + larguraFala + margem * 2);
  const x = (LARGURA - largura) / 2;
  const y = 14;
  const altura = 40;

  ctx.save();
  // Um tremor de um pixel, no ritmo do chiado: é legenda de TV velha.
  ctx.translate(0, Math.round(Math.sin(agora / 140) * 0.5));
  retanguloArredondado(ctx, x, y, largura, altura, 4);
  ctx.fillStyle = 'rgba(10, 8, 8, 0.86)';
  ctx.fill();
  retanguloArredondado(ctx, x, y, largura, altura, 4);
  ctx.strokeStyle = 'rgba(120, 40, 36, 0.75)';
  ctx.lineWidth = 1;
  ctx.stroke();

  texto(ctx, rotulo, x + margem, y + 26, 12, COR.vermelho, 'left', true);
  texto(ctx, fala, x + margem + larguraRotulo, y + 26, tamanho, COR.texto, 'left');
  ctx.restore();
}

/**
 * True nos primeiros segundos depois de a aposta daquele lado mudar. É o
 * que faz o visor piscar quando uma carta trunfo mexe no valor — sem
 * isso o número trocava em silêncio e ninguém via.
 */
const DURACAO_DO_PISCA_DA_APOSTA = 2400;
function apostaAcabouDeMudar(lado, agora) {
  if (lado.apostaMudouEm === null || lado.apostaMudouEm === undefined) return false;
  return agora - lado.apostaMudouEm < DURACAO_DO_PISCA_DA_APOSTA;
}

/** A linha de recompensa nova, no fim da partida. */
function desenharDesbloqueios(ctx, mesa, y) {
  if (!mesa.desbloqueios || mesa.desbloqueios.length === 0) return;
  desenharTextoPixel(ctx, 'DESBLOQUEADO', LARGURA / 2, y, 3, '#8e857a', 'center');
  mesa.desbloqueios.forEach((nome, i) => {
    texto(ctx, nome, LARGURA / 2, y + 34 + i * 20, 15, COR.texto);
  });
}

// ---------------------------------------------------------------------
//  Tela de título (3.2)
//
//  A tela inteira se comporta como uma televisão de tubo sendo ligada:
//  primeiro uma linha branca fina que se abre na horizontal, depois a
//  imagem crescendo na vertical, com chiado forte que vai sumindo. Só
//  quando o tubo estabiliza é que o título aparece. A mesa e a lâmpada
//  ficam lá atrás, bem escuras.
// ---------------------------------------------------------------------

/** Texto com franja colorida dos dois lados, como uma tela mal sintonizada. */
function textoComAberracao(ctx, str, x, y, tamanho, cor, deslocamento, negrito = false) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  texto(ctx, str, x - deslocamento, y, tamanho, 'rgba(150, 20, 30, 0.75)', 'center', negrito);
  texto(ctx, str, x + deslocamento, y, tamanho, 'rgba(20, 90, 150, 0.75)', 'center', negrito);
  ctx.restore();
  texto(ctx, str, x, y, tamanho, cor, 'center', negrito);
}

function desenharTelaDeTitulo(ctx, mesa, agora, cenario) {
  const p = Math.max(0, Math.min(1, mesa.tempoNaTela / mesa.duracaoDoLigar));
  const meio = ALTURA / 2;

  // A sala fica quase apagada atrás do título.
  ctx.fillStyle = 'rgba(0, 0, 0, 0.86)';
  ctx.fillRect(0, 0, LARGURA, ALTURA);

  // Chiado forte no começo, sumindo conforme o tubo estabiliza.
  cenario.desenharChiadoCheio(ctx, agora, p < 0.85 ? 0.42 * (1 - p / 0.85) + 0.05 : 0.04);

  // 1) Até 18%: tudo preto, só uma linha branca abrindo na horizontal.
  // 2) Até 45%: a imagem se abre na vertical a partir do centro.
  if (p < 0.45) {
    const alturaAberta = p < 0.18 ? 0 : ALTURA * ((p - 0.18) / 0.27) ** 1.4;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, LARGURA, meio - alturaAberta / 2);
    ctx.fillRect(0, meio + alturaAberta / 2, LARGURA, ALTURA);

    const larguraLinha = p < 0.18 ? LARGURA * (p / 0.18) ** 0.5 : LARGURA;
    const brilho = p < 0.18 ? 1 : Math.max(0, 1 - (p - 0.18) / 0.2);
    if (brilho > 0) {
      ctx.save();
      ctx.shadowColor = 'rgba(255,255,255,0.9)';
      ctx.shadowBlur = 22 * brilho;
      ctx.fillStyle = `rgba(255, 255, 255, ${brilho})`;
      ctx.fillRect(LARGURA / 2 - larguraLinha / 2, meio - 1.5, larguraLinha, 3);
      ctx.restore();
    }
  }

  // 3) A partir de 55%, o título aparece.
  const aparecendo = Math.max(0, Math.min(1, (p - 0.55) / 0.35));
  if (aparecendo > 0) {
    ctx.save();
    ctx.globalAlpha = aparecendo;
    const tremida = (1 - aparecendo) * 6;
    const desloc = 2 + (1 - aparecendo) * 5;

    textoComAberracao(ctx, '21', LARGURA / 2, meio - 30 + tremida, 128, '#f2ece0', desloc, true);
    texto(ctx, TITULO_SUBTITULO, LARGURA / 2, meio + 26, 19, COR.textoApagado);
    ctx.restore();
  }

  // 4) Com o tubo já estável: o convite piscando devagar e a assinatura.
  if (p >= 1) {
    const aceso = Math.floor(agora / mesa.piscaConvite) % 2 === 0;
    if (aceso) {
      texto(ctx, 'PRESSIONE QUALQUER TECLA', LARGURA / 2, meio + 108, 20, COR.texto, 'center', true);
    }
    desenharRodapeDosDados(ctx, mesa);
    texto(ctx, EQUIPE_NO_RODAPE, LARGURA / 2, ALTURA - 54, 13, COR.textoApagado);
    texto(ctx, 'Atividade 02 · jogo feito com agente de codificação', LARGURA / 2, ALTURA - 34, 11, 'rgba(140, 132, 122, 0.75)');
  }

  // Linhas de varredura mais marcadas que as do jogo.
  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
  for (let y = 0; y < ALTURA; y += 3) ctx.fillRect(0, y, LARGURA, 1);
  ctx.restore();
}

// ---------------------------------------------------------------------
//  Tela de fim de jogo (3.3)
//
//  Tela preta, "GAME OVER" em pixels sem cor nem brilho, e embaixo o
//  necessário: como acabou e quanto o jogador fez. Nada mais. O PDF
//  (Parte B6) é explícito: "Morte: tela preta, som abafado, e um texto
//  seco. Nada de 'Game Over' colorido."
// ---------------------------------------------------------------------

function desenharTelaDeGameOver(ctx, mesa) {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, LARGURA, ALTURA);

  const cinza = '#b9b4ab';
  desenharTextoPixel(ctx, 'GAME OVER', LARGURA / 2, 250, 11, cinza, 'center');

  if (mesa.textoFinal) {
    texto(ctx, mesa.textoFinal, LARGURA / 2, 392, 17, COR.textoApagado);
  }
  desenharTextoPixel(ctx, `${mesa.pontos.total} PONTOS`, LARGURA / 2, 432, 4, cinza, 'center');
  if (mesa.recorde.valor > mesa.pontos.total) {
    desenharTextoPixel(ctx, `RECORDE ${mesa.recorde.valor}`, LARGURA / 2, 476, 3, '#6d685f', 'center');
  }
  desenharDesbloqueios(ctx, mesa, 510);
  texto(ctx, 'qualquer tecla volta ao início', LARGURA / 2, 606, 13, '#5d584f');
}

// ---------------------------------------------------------------------
//  Digitar as iniciais e a tabela das melhores (3.4)
//
//  As duas herdam o tom da tela de fim de jogo: fundo preto e a fonte de
//  pixels, sem cor e sem brilho. Aqui a máquina não está mais matando
//  ninguém — está anotando quem passou por ela.
// ---------------------------------------------------------------------

const PLACAR = {
  cinza: '#b9b4ab',
  apagado: '#6d685f',
  vazio: '#3b3832',
  aceso: '#efe7d8',
  // Linhas da tabela: onde fica o meio de cada uma e as três colunas.
  linha0: 285,
  passo: 70,
  xPosicao: 300,
  xIniciais: 380,
  xPontos: 880,
  xDetalhe: 916,
};

/** Ordinal curto: 1º, 2º... Só para a tela; a lógica não sabe disso. */
function ordinal(linha) {
  return `${linha + 1}º`;
}

/** O que a partida alcançou, em duas palavras, do lado da pontuação. */
function detalheDaEntrada(entrada) {
  if (entrada.venceu) return 'saiu inteiro';
  return `parou no nível ${entrada.nivel}`;
}

function desenharTelaDeIniciais(ctx, mesa, agora) {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, LARGURA, ALTURA);

  const iniciais = mesa.iniciais;
  if (!iniciais) return;

  texto(ctx, `VOCÊ ENTROU NA LISTA · ${ordinal(iniciais.linha)} LUGAR`, LARGURA / 2, 152, 21, PLACAR.cinza, 'center', true);
  desenharTextoPixel(ctx, `${iniciais.pontos} PONTOS`, LARGURA / 2, 186, 4, PLACAR.apagado, 'center');

  // As três casas, bem grandes. A casa em que o cursor está pisca.
  const escala = 15;
  const passo = 150;
  const y = 268;
  const piscando = Math.floor(agora / 380) % 2 === 0;

  iniciais.letras.forEach((letra, i) => {
    const x = LARGURA / 2 + (i - 1) * passo;
    const naVez = i === iniciais.cursor;
    const cor = naVez && piscando ? PLACAR.aceso : PLACAR.cinza;
    desenharTextoPixel(ctx, letra, x, y, escala, cor, 'center');

    // Risco embaixo de cada casa; o da casa atual é mais forte.
    ctx.fillStyle = naVez ? cor : PLACAR.vazio;
    ctx.fillRect(x - 48, y + 7 * escala + 18, 96, naVez ? 7 : 4);
  });

  desenharDesbloqueios(ctx, mesa, 436);
  texto(ctx, 'digite as três letras  ·  as setas também mudam  ·  ENTER confirma',
    LARGURA / 2, 506, 15, COR.textoApagado);
  if (iniciais.restante !== null) {
    texto(ctx, `${Math.ceil(iniciais.restante)} s`, LARGURA / 2, 556, 18, PLACAR.apagado);
  }
}

function desenharTelaDeMelhores(ctx, mesa, agora) {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, LARGURA, ALTURA);

  desenharTextoPixel(ctx, 'MELHORES', LARGURA / 2, 96, 8, PLACAR.cinza, 'center');
  texto(ctx, 'as cinco maiores pontuações desta sessão', LARGURA / 2, 208, 16, COR.textoApagado);

  const entradas = mesa.placar?.entradas ?? [];
  const destaque = mesa.placar?.destaque ?? -1;
  const piscando = Math.floor(agora / 420) % 2 === 0;

  for (let linha = 0; linha < 5; linha++) {
    const meio = PLACAR.linha0 + linha * PLACAR.passo;
    const entrada = entradas[linha];
    const realcada = linha === destaque && piscando;
    const cor = !entrada ? PLACAR.vazio : realcada ? PLACAR.aceso : PLACAR.cinza;

    desenharTextoPixel(ctx, ordinal(linha).replace('º', ''), PLACAR.xPosicao, meio - 14, 4, entrada ? PLACAR.apagado : PLACAR.vazio);
    desenharTextoPixel(ctx, entrada?.iniciais ?? '---', PLACAR.xIniciais, meio - 21, 6, cor);
    desenharTextoPixel(ctx, entrada ? String(entrada.pontos) : '----', PLACAR.xPontos, meio - 17, 5, cor, 'right');
    if (entrada) {
      texto(ctx, detalheDaEntrada(entrada), PLACAR.xDetalhe, meio + 6, 13, PLACAR.apagado, 'left');
    }
  }

  if (entradas.length === 0) {
    texto(ctx, 'ninguém saiu desta mesa ainda', LARGURA / 2, 632, 15, PLACAR.apagado);
  } else {
    texto(ctx, 'qualquer tecla volta ao início', LARGURA / 2, 632, 13, '#5d584f');
  }
}

/** Preenchidos pelo main.js a partir do config. */
let TITULO_SUBTITULO = '';
let EQUIPE_NO_RODAPE = '';
export function definirTextosDoTitulo(subtitulo, equipe) {
  TITULO_SUBTITULO = subtitulo;
  EQUIPE_NO_RODAPE = equipe.join('   ·   ');
}

/** Nome de quem fala na TV; preenchido pelo main.js a partir do config. */
export let NOME_ANFITRIAO = 'Kaio';
export function definirNomeDoAnfitriao(nome) { NOME_ANFITRIAO = nome; }

export function criarRenderizador(canvas, opcoes = {}) {
  canvas.width = LARGURA;
  canvas.height = ALTURA;
  const ctx = canvas.getContext('2d');
  const cenario = criarCenario();
  const efeitos = criarEfeitos({ ativos: opcoes.efeitos ?? true });

  function desenhar(mesa, lampada, agora) {
    ctx.fillStyle = COR.fundo;
    ctx.fillRect(0, 0, LARGURA, ALTURA);

    // Tremor de tela: o do impacto, e por baixo dele um tremor constante
    // que cresce com a tensão da cena (4.3) — quase nada no começo da
    // partida, visível quando a morte está perto.
    ctx.save();
    const tremorTotal = Math.max(mesa.tremor, mesa.tremorAmbiente ?? 0);
    if (tremorTotal > 0) {
      const passo = Math.floor(agora / 16);
      const forca = 14 * tremorTotal;
      ctx.translate(
        Math.round((ruidoFixo(passo) - 0.5) * 2 * forca),
        Math.round((ruidoFixo(passo + 31) - 0.5) * 2 * forca * 0.7),
      );
    }

    // Câmera da demonstração (3.5): entra aqui e sai no mesmo `restore` do
    // tremor, então as telas e o pós-processamento ficam de fora do passeio.
    if (mesa.tela === 'attract') aplicarCameraDaDemonstracao(ctx, mesa.tempoNaTela);

    cenario.desenharParede(ctx, lampada, POSICOES.pivoLampada.x);
    desenharConeDeLuz(ctx, lampada);
    cenario.desenharFundoDaSala(ctx, agora, lampada, POSICOES.luizCentroX, mesa.tvForte);
    desenharOponente(ctx, mesa, agora);
    desenharLuminaria(ctx, lampada);
    cenario.desenharTampo(ctx);
    desenharPocaDeLuz(ctx, lampada);
    // --- Aparelho do nível, na parte do oponente ---
    const primeiroNome = (n) => n.split(' ')[0];
    const apAdv = aparelhoDoOponente();
    if (mesa.nivel === 1) desenharColunas(ctx, apAdv);
    if (mesa.nivel === 3) desenharTrilho(ctx, primeiroNome(mesa.eu.nome), primeiroNome(mesa.adv.nome));
    desenharBracosDoOponente(ctx, mesa, agora);
    if (mesa.nivel === 1) {
      const { progresso, fase } = progressoDaLamina(mesa, 'adv');
      desenharLamina(ctx, apAdv, progresso, fase);
    }
    if (mesa.nivel === 2) {
      desenharTaser(ctx, mesa, 'adv', agora);
      desenharMedidor(ctx, 'adv', mesa.adv.medidor, primeiroNome(mesa.adv.nome));
    }

    desenharBaralho(ctx, mesa.baralhoRestante);
    cenario.desenharPlaca(ctx, mesa.alvo, mesa.rodada, mesa.trocaDeAlvo);

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
    const estadoDele = mesa.nivel === 1 ? `${mesa.adv.dedos}/5 dedos`
      : mesa.nivel === 2 ? `choque ${mesa.adv.medidor.toFixed(0)}/10`
        : `serra a ${(15 - mesa.serraPos).toFixed(1).replace('.0', '')} dele`;
    const aflito = mesa.nivel === 1 ? mesa.adv.dedos <= 2
      : mesa.nivel === 2 ? mesa.adv.medidor >= 8 : (15 - mesa.serraPos) <= 3;
    texto(ctx, estadoDele, maoDir.x + 84, maoDir.y + 8, 13, aflito ? COR.vermelho : COR.texto, 'left');
    cenario.desenharPlacar(ctx, 1020, 176, 74, 40, mesa.adv.aposta, {
      digitos: 2, rotulo: 'APOSTA DELE', agora, destaque: apostaAcabouDeMudar(mesa.adv, agora),
    });

    // --- Lado do jogador ---
    for (const c of mesa.eu.cartas) desenharCarta(ctx, c);
    texto(ctx, mesa.eu.nome.toUpperCase(), 640, 536, 15, COR.textoApagado);
    cenario.desenharPlacar(ctx, 1010, 470, 112, 62, mesa.eu.aposta, {
      digitos: 2, rotulo: 'SUA APOSTA', agora,
      destaque: mesa.eu.aposta >= 3 || apostaAcabouDeMudar(mesa.eu, agora),
    });

    const total = mesa.eu.cartas.reduce((s, c) => s + (c.valor ?? 0), 0);
    if (mesa.eu.cartas.length > 0) {
      const estourou = total > mesa.alvo;
      texto(ctx, `TOTAL ${total}${estourou ? '   ·   ESTOUROU' : ''}`, 640, 566, 26, estourou ? COR.vermelho : COR.texto, 'center', true);
    }
    // A sua mão: presa no aparelho, saindo da borda de baixo, tremendo mais a cada dedo perdido.
    const apEu = aparelhoDoJogador();
    if (mesa.nivel === 1) desenharColunas(ctx, apEu);
    // Quanto pior a situação, mais a mão treme (o tremor usa uma escala de 0 a 5).
    const folgaDaMao = mesa.nivel === 1 ? mesa.eu.dedos
      : mesa.nivel === 2 ? 5 - Math.round(mesa.eu.medidor / 2)
        : Math.min(5, Math.round(mesa.serraPos / 1.5));
    const tremor = tremorDaMao(agora, folgaDaMao);
    desenharMaoPixel(ctx, POSICOES.maoEu.x + tremor.x, POSICOES.maoEu.y + tremor.y, mesa.eu.dedos, { escala: ESCALA_MAO, estilo: 'humana' });
    if (mesa.nivel === 1) {
      const { progresso, fase } = progressoDaLamina(mesa, 'eu');
      desenharLamina(ctx, apEu, progresso, fase);
    }
    if (mesa.nivel === 2) {
      desenharTaser(ctx, mesa, 'eu', agora);
      desenharMedidor(ctx, 'eu', mesa.eu.medidor, primeiroNome(mesa.eu.nome));
    }
    if (mesa.nivel === 3) desenharSerra(ctx, mesa, agora);

    // Rótulos à direita do aparelho.
    const rotuloX = apEu.cx + apEu.abertura / 2 + apEu.coluna + 14;
    texto(ctx, primeiroNome(mesa.eu.nome), rotuloX, 522, 13, COR.textoApagado, 'left');
    if (mesa.nivel === 1) {
      texto(ctx, `${mesa.eu.dedos}/5 dedos`, rotuloX, 540, 13, mesa.eu.dedos <= 2 ? COR.vermelho : COR.texto, 'left');
    } else if (mesa.nivel === 2) {
      texto(ctx, `choque ${mesa.eu.medidor.toFixed(0)}/10`, rotuloX, 540, 13, mesa.eu.medidor >= 8 ? COR.vermelho : COR.texto, 'left');
    } else {
      const ate = mesa.serraPos.toFixed(1).replace('.0', '');
      texto(ctx, `serra a ${ate} de você`, rotuloX, 540, 13, mesa.serraPos <= 3 ? COR.vermelho : COR.texto, 'left');
    }
    const unidade = mesa.nivel === 1 ? (mesa.eu.aposta === 1 ? 'dedo' : 'dedos')
      : mesa.nivel === 2 ? 'de choque' : 'marcas';
    texto(ctx, `aposta: ${mesa.eu.aposta} ${unidade}`, rotuloX, 558, 13, mesa.eu.aposta >= 3 ? COR.vermelho : COR.textoApagado, 'left');

    // Visor velho de pontos, ao lado da mão do jogador (2.1).
    const visor = POSICOES.visorPontos;
    cenario.desenharPlacar(ctx, visor.x, visor.y, visor.largura, visor.altura, mesa.pontos.total, {
      digitos: 6, rotulo: 'PONTOS', agora,
    });
    if (mesa.pontos.multiplicador > 1) {
      texto(ctx, `sequência ×${String(mesa.pontos.multiplicador).replace('.', ',')}`, visor.x + visor.largura / 2, visor.y + visor.altura + 30, 12, COR.vermelho);
    }

    // Visor menor com o recorde da sessão; pisca quando é batido (2.6).
    const visorRecorde = POSICOES.visorRecorde;
    cenario.desenharPlacar(ctx, visorRecorde.x, visorRecorde.y, visorRecorde.largura, visorRecorde.altura, mesa.recorde.valor, {
      digitos: 5, rotulo: 'RECORDE', destaque: mesa.recorde.piscando, agora,
    });
    if (mesa.recorde.piscando) {
      texto(ctx, 'NOVO RECORDE', visorRecorde.x + visorRecorde.largura / 2, visorRecorde.y + visorRecorde.altura + 30, 12, COR.vermelho, 'center', true);
    }

    // --- Cartas trunfo já jogadas, na mesa, do lado de quem jogou ---
    for (const lado of ['adv', 'eu']) {
      const jogadas = mesa[lado].trunfosNaMesa;
      // A última fica escondida enquanto a carta ainda está voando para a mesa.
      const visiveis = mesa.trunfoEmVoo?.lado === lado ? jogadas.slice(0, -1) : jogadas;
      visiveis.forEach((carta, i) => {
        const p = posicaoTrunfoNaMesa(lado, i);
        desenharCartaTrunfo(ctx, carta, p.x, p.y, p.largura, p.altura, {
          comNome: false,
          destacada: mesa.dica?.origem === `mesa-${lado}-${i}`,
        });
      });
      if (visiveis.length > 0) {
        const p = posicaoTrunfoNaMesa(lado, 0);
        texto(ctx, lado === 'eu' ? 'suas cartas na mesa' : 'cartas dele na mesa',
          p.x, p.y - 8, 11, COR.textoApagado, 'left');
      }
    }

    // --- Mão de trunfos do jogador, embaixo ---
    mesa.eu.trunfosNaMao.forEach((carta, i) => {
      const p = posicaoTrunfoNaMao(i, mesa.eu.trunfosNaMao.length);
      const destacada = mesa.dica?.origem === `mao-${i}`;
      desenharCartaTrunfo(ctx, carta, p.x, p.y - (destacada ? 10 : 0), p.largura, p.altura, { destacada });
    });
    // A dica de clique não vale na demonstração: ali ninguém está esperando a vez.
    if (mesa.eu.trunfosNaMao.length > 0 && mesa.tela !== 'attract') {
      const p = posicaoTrunfoNaMao(0, mesa.eu.trunfosNaMao.length);
      texto(ctx, mesa.podeJogarTrunfo ? 'clique para jogar' : 'aguarde sua vez',
        POSICOES.maoTrunfos.centroX, p.y - 10, 11, COR.textoApagado);
    }

    // Trunfo voando da mão para a mesa.
    if (mesa.trunfoEmVoo) {
      const v = mesa.trunfoEmVoo;
      desenharCartaTrunfo(ctx, v.carta, v.x, v.y, TRUNFO.largura, TRUNFO.altura, {
        escala: v.escala, comNome: false,
      });
    }

    // Carta em movimento, por cima de tudo.
    if (mesa.emVoo) desenharCarta(ctx, mesa.emVoo);

    // --- Escurecimento (revelação) ---
    if (mesa.escurecimento > 0) {
      ctx.fillStyle = `rgba(0, 0, 0, ${mesa.escurecimento})`;
      ctx.fillRect(0, 0, LARGURA, ALTURA);
    }

    // --- Mensagem central ---
    // Cabe entre a placa "21" (x≈400) e o baralho (x≈1080): até duas linhas.
    let mensagem = mesa.mensagem;
    if (mesa.pensando) mensagem += '.'.repeat(1 + (Math.floor(agora / 400) % 3));
    textoAjustado(ctx, mensagem, 640, 385, 18, mesa.mensagemVermelha ? COR.vermelho : COR.texto, 640);

    desenharVinheta(ctx);

    // Flash do impacto: vermelho na guilhotina, branco azulado no choque.
    if (mesa.flash > 0) {
      ctx.fillStyle = mesa.flashBranco
        ? `rgba(225, 240, 255, ${0.72 * mesa.flash})`
        : `rgba(150, 20, 15, ${0.55 * mesa.flash})`;
      ctx.fillRect(-40, -40, LARGURA + 80, ALTURA + 80);
    }

    ctx.restore(); // fim do tremor

    // Escurecimento total: a sala apaga antes da tela de fim de jogo.
    if (mesa.telaPreta > 0) {
      ctx.fillStyle = `rgba(0, 0, 0, ${mesa.telaPreta})`;
      ctx.fillRect(0, 0, LARGURA, ALTURA);
    }

    // A tela de fim de jogo, quando a máquina de telas chega nela (3.3),
    // e o que vem depois dela quando a pontuação entrou na lista (3.4).
    if (mesa.tela === 'game_over') desenharTelaDeGameOver(ctx, mesa);
    else if (mesa.tela === 'iniciais') desenharTelaDeIniciais(ctx, mesa, agora);
    else if (mesa.tela === 'high_scores') desenharTelaDeMelhores(ctx, mesa, agora);

    // As duas telas que se desenham por cima da mesa, em vez de apagarem
    // a sala: o título (3.2) e o selo da demonstração (3.5).
    if (mesa.tela === 'titulo') desenharTelaDeTitulo(ctx, mesa, agora, cenario);
    else if (mesa.tela === 'attract') desenharSeloDaDemonstracao(ctx, mesa, agora);

    // A TV continua acesa mesmo com a sala escurecida, quando o anfitrião fala.
    cenario.desenharTvAcesa(ctx, agora, mesa.tvForte);

    // Fala do Kaio na troca de nível: legenda em cima da tela escurecida.
    if (mesa.kaio) {
      const painel = 96;
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(0, ALTURA - painel - 40, LARGURA, painel);
      texto(ctx, `${NOME_ANFITRIAO} · na televisão`, LARGURA / 2, ALTURA - painel - 16, 12, COR.textoApagado);
      textoAjustado(ctx, mesa.kaio, LARGURA / 2, ALTURA - painel + 26, 20, COR.texto, 940, 2);
    }

    // Dica da carta sob o cursor, acima de tudo menos os efeitos.
    if (mesa.dica) desenharDica(ctx, mesa.dica);

    // Pós-processamento: granulado, linhas de varredura, separação de cores
    // nas bordas e vinheta, tudo mais forte conforme a aposta sobe e a morte
    // se aproxima (parte B3 do PDF). A imagem da TV rasga quando o
    // anfitrião fala.
    const tensao = mesa.tela === 'jogando' ? tensaoDaCena(mesa) : 0;
    efeitos.aplicar(ctx, agora, Math.max(mesa.escurecimento, tensao), {
      tvForca: mesa.kaio ? 0.45 + 0.55 * mesa.tvForte : (mesa.comentario ? 0.35 : 0),
      tvArea: TV,
      // No modo difícil as bordas respiram vermelho o tempo todo, e
      // apertam junto com a tensão da mesa.
      medo: mesa.dificil && mesa.tela === 'jogando' ? 0.45 + 0.55 * tensao : 0,
    });

    // O Kaio comentando a rodada: uma tarja de televisão no alto, que é
    // de onde a voz dele vem.
    if (mesa.comentario) desenharComentarioDoAnfitriao(ctx, mesa.comentario.texto, agora);

    // A trapaça do anfitrião (4.8): a luz da sala vira vermelha.
    if (mesa.trapaca?.forca > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = `rgba(255, 120, 95, ${1 - 0.55 * mesa.trapaca.forca})`;
      ctx.fillRect(0, 0, LARGURA, ALTURA);
      ctx.restore();
      ctx.fillStyle = `rgba(120, 10, 10, ${0.20 * mesa.trapaca.forca})`;
      ctx.fillRect(0, 0, LARGURA, ALTURA);
    }

    // Som desligado: um aviso discreto, no canto de cima.
    if (mesa.som?.mudo) {
      texto(ctx, 'SOM DESLIGADO  ·  M', LARGURA - 16, 26, 12, 'rgba(150, 140, 130, 0.8)', 'right');
    }
    // E, na mesa, lembrar que o oponente está no máximo.
    if (mesa.dificil && mesa.tela === 'jogando') {
      texto(ctx, 'DIFÍCIL', 16, 26, 12, COR.vermelho, 'left', true);
    }

    // A seed é informação de bastidor: só aparece com a mesa em jogo.
    if (mesa.tela === 'jogando' || mesa.tela === 'game_over') {
      const rodape = `seed ${mesa.seed ?? '?'}${mesa.rapido ? '   ·   rápido' : ''}${efeitos.ativos ? '' : '   ·   sem efeitos'}`;
      texto(ctx, rodape, 16, ALTURA - 14, 12, 'rgba(120, 112, 105, 0.7)', 'left');
    }
  }

  // O `efeitos` sai junto para o main.js poder ligar e desligar o
  // pós-processamento pela tecla E (4.3).
  return { desenhar, efeitos };
}
