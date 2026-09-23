// =====================================================================
//  ui/cenario.js — o cômodo e os objetos da mesa  (passe visual pós-Etapa 1)
//
//  Baseado na cena de referência do grupo e na Parte B do PDF:
//    - parede de tijolos quase invisível na sombra, iluminada pela lâmpada
//    - TV de tubo com chiado numa mesinha atrás, à esquerda do oponente
//    - cadeira atrás do oponente
//    - tampo de concreto sujo com ladrilhos em perspectiva e manchas
//    - placa de papel dobrada com o alvo ("21") em pé na mesa
//    - placares de sete segmentos vermelhos com a aposta de cada lado
//
//  Tudo desenhado em Canvas 2D. O que é estático fica em canvas separados,
//  desenhados uma vez; o que se mexe (chiado, dígitos) é redesenhado por quadro.
// =====================================================================

const LARGURA = 1280;
const ALTURA = 720;
const FONTE = '"Courier New", Courier, "Lucida Console", monospace';

/** "Aleatório" fixo em função de um índice: mesmo desenho sempre. */
function ruidoFixo(i) {
  const v = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
  return v - Math.floor(v);
}

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

function novoCanvas(largura, altura) {
  const c = document.createElement('canvas');
  c.width = largura;
  c.height = altura;
  return c;
}

// ---------------------------------------------------------------------
//  Parede de tijolos (estática)
// ---------------------------------------------------------------------

function criarParede() {
  const tela = novoCanvas(LARGURA, 200);
  const ctx = tela.getContext('2d');
  const alturaTijolo = 14;
  const larguraTijolo = 34;
  for (let fila = 0; fila * alturaTijolo < 200; fila++) {
    const deslocamento = fila % 2 ? larguraTijolo / 2 : 0;
    for (let col = -1; col * larguraTijolo < LARGURA + larguraTijolo; col++) {
      const x = col * larguraTijolo + deslocamento;
      const y = fila * alturaTijolo;
      const tom = 14 + ruidoFixo(fila * 131 + col) * 10;
      ctx.fillStyle = `rgb(${tom + 6}, ${tom + 2}, ${tom})`;
      ctx.fillRect(x + 1, y + 1, larguraTijolo - 2, alturaTijolo - 2);
    }
  }
  // Argamassa mais escura entre os tijolos já é o fundo; manchas de umidade.
  for (let i = 0; i < 18; i++) {
    const x = ruidoFixo(i + 500) * LARGURA;
    const y = ruidoFixo(i + 900) * 200;
    const r = 30 + ruidoFixo(i + 77) * 60;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(0,0,0,0.35)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  return tela;
}

// ---------------------------------------------------------------------
//  Tampo de concreto sujo (estático)
// ---------------------------------------------------------------------

export const BORDA_MESA = { yTopo: 165, xTopoEsq: 150, xTopoDir: 1130 };

function criarTampo() {
  const tela = novoCanvas(LARGURA, ALTURA);
  const ctx = tela.getContext('2d');
  const { yTopo, xTopoEsq, xTopoDir } = BORDA_MESA;

  ctx.beginPath();
  ctx.moveTo(xTopoEsq, yTopo);
  ctx.lineTo(xTopoDir, yTopo);
  ctx.lineTo(LARGURA, ALTURA);
  ctx.lineTo(0, ALTURA);
  ctx.closePath();
  ctx.clip();

  // Base: concreto acinzentado, mais escuro no fundo e nas bordas.
  const base = ctx.createLinearGradient(0, yTopo, 0, ALTURA);
  base.addColorStop(0, '#2a2723');
  base.addColorStop(0.4, '#403b35');
  base.addColorStop(1, '#2b2823');
  ctx.fillStyle = base;
  ctx.fillRect(0, yTopo, LARGURA, ALTURA - yTopo);

  // Granulado do concreto.
  for (let i = 0; i < 9000; i++) {
    const x = ruidoFixo(i) * LARGURA;
    const y = yTopo + ruidoFixo(i + 12345) * (ALTURA - yTopo);
    const claro = ruidoFixo(i + 777) > 0.5;
    ctx.fillStyle = claro ? 'rgba(120, 112, 100, 0.10)' : 'rgba(0, 0, 0, 0.14)';
    ctx.fillRect(x, y, 2, 2);
  }

  // Ladrilhos em perspectiva: linhas convergindo para um ponto acima da mesa.
  const fuga = { x: LARGURA / 2, y: -900 };
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.28)';
  ctx.lineWidth = 1.5;
  for (let x = -640; x <= LARGURA + 640; x += 128) {
    ctx.beginPath();
    ctx.moveTo(x, ALTURA);
    ctx.lineTo(fuga.x + (x - fuga.x) * ((yTopo - fuga.y) / (ALTURA - fuga.y)), yTopo);
    ctx.stroke();
  }
  // Linhas horizontais cada vez mais juntas ao fundo; passo mínimo garante que o laço termina.
  let y = ALTURA;
  let passo = 96;
  while (y > yTopo) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(LARGURA, y);
    ctx.stroke();
    passo = Math.max(passo * 0.82, 7);
    y -= passo;
  }

  // Manchas e riscos.
  for (let i = 0; i < 14; i++) {
    const x = ruidoFixo(i + 31) * LARGURA;
    const yy = yTopo + 40 + ruidoFixo(i + 61) * (ALTURA - yTopo - 60);
    const r = 24 + ruidoFixo(i + 91) * 70;
    const g = ctx.createRadialGradient(x, yy, 0, x, yy, r);
    g.addColorStop(0, `rgba(15, 10, 6, ${0.22 + ruidoFixo(i) * 0.2})`);
    g.addColorStop(1, 'rgba(15, 10, 6, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(x, yy, r * 1.4, r * 0.7, ruidoFixo(i + 5) * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 30; i++) {
    const x = ruidoFixo(i + 200) * LARGURA;
    const yy = yTopo + ruidoFixo(i + 300) * (ALTURA - yTopo);
    ctx.beginPath();
    ctx.moveTo(x, yy);
    ctx.lineTo(x + (ruidoFixo(i + 400) - 0.5) * 90, yy + (ruidoFixo(i + 600) - 0.5) * 30);
    ctx.stroke();
  }

  // Borda da frente.
  ctx.restore();
  ctx.strokeStyle = 'rgba(0,0,0,0.7)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(xTopoEsq, yTopo);
  ctx.lineTo(xTopoDir, yTopo);
  ctx.stroke();
  return tela;
}

// ---------------------------------------------------------------------
//  TV de tubo com chiado
// ---------------------------------------------------------------------

export const TV = { x: 205, y: 48, largura: 150, altura: 118 };

function criarTvEstatica() {
  const tela = novoCanvas(64, 48); // resolução baixa do chiado, ampliada sem suavização
  return { tela, ctx: tela.getContext('2d'), imagem: tela.getContext('2d').createImageData(64, 48) };
}

function desenharTv(ctx, ruido, agora, intensidadeLampada) {
  const { x, y, largura, altura } = TV;

  // Mesinha da TV (a mesa grande cobre as pernas).
  ctx.fillStyle = '#17120f';
  ctx.fillRect(x - 24, y + altura + 2, largura + 48, 8);
  ctx.fillRect(x - 18, y + altura + 10, 8, 20);
  ctx.fillRect(x + largura + 10, y + altura + 10, 8, 20);

  // Caixa da TV.
  retanguloArredondado(ctx, x, y, largura, altura, 8);
  const plastico = ctx.createLinearGradient(x, y, x + largura, y + altura);
  plastico.addColorStop(0, '#3a332d');
  plastico.addColorStop(1, '#1c1815');
  ctx.fillStyle = plastico;
  ctx.fill();
  ctx.strokeStyle = '#0c0a09';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Botões e alto-falante à direita.
  ctx.fillStyle = '#0f0d0b';
  for (let i = 0; i < 4; i++) ctx.fillRect(x + largura - 22, y + 16 + i * 14, 12, 6);
  ctx.beginPath();
  ctx.arc(x + largura - 16, y + altura - 22, 6, 0, Math.PI * 2);
  ctx.fill();

  // Chiado: ruído em função do quadro (muda a cada ~50 ms).
  const quadro = Math.floor(agora / 50);
  const dados = ruido.imagem.data;
  const rolo = Math.floor(ruidoFixo(quadro * 0.37) * 48); // faixa mais escura rolando
  for (let py = 0; py < 48; py++) {
    for (let px = 0; px < 64; px++) {
      let v = 40 + ruidoFixo(quadro * 3071 + py * 64 + px) * 180;
      if (Math.abs(((py - rolo + 48) % 48) - 6) < 5) v *= 0.55;
      if (py % 2 === 0) v *= 0.8; // linhas de varredura
      const i = (py * 64 + px) * 4;
      dados[i] = v * 0.95;
      dados[i + 1] = v;
      dados[i + 2] = v * 1.05;
      dados[i + 3] = 255;
    }
  }
  ruido.ctx.putImageData(ruido.imagem, 0, 0);

  const telaX = x + 12;
  const telaY = y + 12;
  const telaL = largura - 44;
  const telaA = altura - 26;
  ctx.save();
  retanguloArredondado(ctx, telaX, telaY, telaL, telaA, 10);
  ctx.clip();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(ruido.tela, telaX - 2, telaY - 2, telaL + 4, telaA + 4);
  // Vidro curvo: brilho no canto e escurecimento nas bordas.
  const vidro = ctx.createRadialGradient(telaX + telaL * 0.35, telaY + telaA * 0.3, 4, telaX + telaL / 2, telaY + telaA / 2, telaL * 0.8);
  vidro.addColorStop(0, 'rgba(255,255,255,0.10)');
  vidro.addColorStop(0.6, 'rgba(0,0,0,0)');
  vidro.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = vidro;
  ctx.fillRect(telaX, telaY, telaL, telaA);
  ctx.restore();

  // Luz azulada da TV sobre a mesinha e a parede.
  const brilho = ctx.createRadialGradient(x + largura / 2, y + altura / 2, 20, x + largura / 2, y + altura / 2, 200);
  brilho.addColorStop(0, `rgba(170, 190, 220, ${0.10 * (1.2 - intensidadeLampada * 0.4)})`);
  brilho.addColorStop(1, 'rgba(170, 190, 220, 0)');
  ctx.fillStyle = brilho;
  ctx.fillRect(x - 200, y - 150, largura + 400, altura + 300);
}

// ---------------------------------------------------------------------
//  Cadeira atrás do oponente
// ---------------------------------------------------------------------

function desenharCadeira(ctx, centroX) {
  ctx.fillStyle = '#120e0b';
  ctx.fillRect(centroX - 112, 62, 12, 110);
  ctx.fillRect(centroX + 100, 62, 12, 110);
  ctx.fillRect(centroX - 112, 62, 224, 14);
  ctx.fillRect(centroX - 112, 96, 224, 8);
  ctx.strokeStyle = 'rgba(60, 45, 35, 0.5)';
  ctx.lineWidth = 1;
  ctx.strokeRect(centroX - 112, 62, 224, 14);
}

// ---------------------------------------------------------------------
//  Placa dobrada com o alvo
// ---------------------------------------------------------------------

export const PLACA = { x: 300, y: 250, largura: 96, altura: 78 };

function desenharPlaca(ctx, alvo, rodada) {
  const { x, y, largura, altura } = PLACA;
  // Sombra.
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.beginPath();
  ctx.ellipse(x + largura / 2 + 8, y + altura + 4, largura * 0.7, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  // Face de trás (mais escura), levemente inclinada.
  ctx.fillStyle = '#8f8570';
  ctx.beginPath();
  ctx.moveTo(x + 10, y - 8);
  ctx.lineTo(x + largura - 6, y - 10);
  ctx.lineTo(x + largura + 8, y + altura - 2);
  ctx.lineTo(x + largura - 2, y + altura);
  ctx.closePath();
  ctx.fill();
  // Face da frente: papel envelhecido.
  const papel = ctx.createLinearGradient(x, y, x, y + altura);
  papel.addColorStop(0, '#d9cfb3');
  papel.addColorStop(1, '#b9ad91');
  ctx.fillStyle = papel;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + largura, y - 2);
  ctx.lineTo(x + largura - 2, y + altura);
  ctx.lineTo(x + 2, y + altura + 2);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(60, 45, 30, 0.7)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // Sujeira nos cantos.
  for (let i = 0; i < 6; i++) {
    const sx = x + ruidoFixo(i + 40) * largura;
    const sy = y + ruidoFixo(i + 80) * altura;
    ctx.fillStyle = `rgba(70, 55, 35, ${0.08 + ruidoFixo(i) * 0.12})`;
    ctx.beginPath();
    ctx.arc(sx, sy, 6 + ruidoFixo(i + 3) * 10, 0, Math.PI * 2);
    ctx.fill();
  }
  // Número do alvo.
  ctx.font = `bold 44px ${FONTE}`;
  ctx.fillStyle = '#1f1a16';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(String(alvo), x + largura / 2, y + altura - 22);
  ctx.font = `11px ${FONTE}`;
  ctx.fillStyle = 'rgba(40, 30, 22, 0.8)';
  ctx.fillText('ALVO', x + largura / 2, y + 16);
  // Rodada, riscada a giz na mesa ao lado.
  ctx.font = `12px ${FONTE}`;
  ctx.fillStyle = 'rgba(200, 190, 170, 0.45)';
  ctx.fillText(`rodada ${rodada}`, x + largura / 2, y + altura + 26);
}

// ---------------------------------------------------------------------
//  Placar de sete segmentos
// ---------------------------------------------------------------------

const SEGMENTOS = {
  0: 'abcdef', 1: 'bc', 2: 'abdeg', 3: 'abcdg', 4: 'bcfg',
  5: 'acdfg', 6: 'acdefg', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg',
};

function desenharDigito(ctx, x, y, largura, altura, digito, aceso, apagado) {
  const e = Math.max(2, largura * 0.16); // espessura
  const ligados = SEGMENTOS[digito] ?? '';
  const seg = {
    a: [x + e, y, largura - 2 * e, e],
    b: [x + largura - e, y + e, e, altura / 2 - 1.5 * e],
    c: [x + largura - e, y + altura / 2 + e / 2, e, altura / 2 - 1.5 * e],
    d: [x + e, y + altura - e, largura - 2 * e, e],
    e: [x, y + altura / 2 + e / 2, e, altura / 2 - 1.5 * e],
    f: [x, y + e, e, altura / 2 - 1.5 * e],
    g: [x + e, y + altura / 2 - e / 2, largura - 2 * e, e],
  };
  for (const [nome, [sx, sy, sl, sa]] of Object.entries(seg)) {
    const on = ligados.includes(nome);
    ctx.fillStyle = on ? aceso : apagado;
    ctx.fillRect(sx, sy, sl, sa);
  }
}

/**
 * Caixa escura com dígitos vermelhos, como na cena de referência.
 * `valor` número inteiro; `digitos` quantos mostrar (com zeros à esquerda apagados).
 */
export function desenharPlacar(ctx, x, y, largura, altura, valor, opcoes = {}) {
  const { digitos = 2, rotulo = 'APOSTA', destaque = false, agora = 0 } = opcoes;
  // Caixa com bisel.
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(x + 5, y + 6, largura, altura);
  retanguloArredondado(ctx, x, y, largura, altura, 4);
  const caixa = ctx.createLinearGradient(x, y, x, y + altura);
  caixa.addColorStop(0, '#3c3a37');
  caixa.addColorStop(1, '#1a1917');
  ctx.fillStyle = caixa;
  ctx.fill();
  ctx.strokeStyle = '#0a0908';
  ctx.lineWidth = 2;
  ctx.stroke();
  // Visor.
  const margem = altura * 0.16;
  const vx = x + margem;
  const vy = y + margem;
  const vl = largura - margem * 2;
  const va = altura - margem * 2;
  ctx.fillStyle = '#0b0507';
  ctx.fillRect(vx, vy, vl, va);

  const texto = String(Math.max(0, Math.floor(valor)));
  const n = Math.max(digitos, texto.length);
  const preenchido = texto.padStart(n, ' ');
  const larguraDigito = (vl - (n + 1) * 6) / n;
  const alturaDigito = va - 12;
  const pisca = destaque ? 0.7 + 0.3 * Math.abs(Math.sin(agora / 180)) : 1;
  const aceso = `rgba(226, 42, 30, ${pisca})`;
  const apagado = 'rgba(80, 18, 14, 0.35)';

  ctx.save();
  ctx.shadowColor = `rgba(255, 60, 40, ${0.7 * pisca})`;
  ctx.shadowBlur = 10;
  for (let i = 0; i < n; i++) {
    const ch = preenchido[i];
    const dx = vx + 6 + i * (larguraDigito + 6);
    if (ch === ' ') {
      desenharDigito(ctx, dx, vy + 6, larguraDigito, alturaDigito, -1, aceso, apagado);
    } else {
      desenharDigito(ctx, dx, vy + 6, larguraDigito, alturaDigito, Number(ch), aceso, apagado);
    }
  }
  ctx.restore();

  if (rotulo) {
    ctx.font = `10px ${FONTE}`;
    ctx.fillStyle = 'rgba(160, 150, 135, 0.7)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(rotulo, x + largura / 2, y + altura + 14);
  }
}

// ---------------------------------------------------------------------
//  Cenário completo
// ---------------------------------------------------------------------

export function criarCenario() {
  const parede = criarParede();
  const tampo = criarTampo();
  const ruidoTv = criarTvEstatica();

  return {
    /** Parede iluminada pela lâmpada. Desenhar logo depois do fundo, antes do cone. */
    desenharParede(ctx, lampada, pivoX) {
      ctx.save();
      ctx.globalAlpha = 0.9;
      ctx.drawImage(parede, 0, 0);
      // Só o que a lâmpada alcança aparece: máscara radial.
      ctx.globalCompositeOperation = 'destination-in';
      const luz = ctx.createRadialGradient(pivoX, 60, 40, pivoX, 60, 620);
      luz.addColorStop(0, `rgba(0,0,0,${0.9 * lampada.intensidade})`);
      luz.addColorStop(0.5, `rgba(0,0,0,${0.35 * lampada.intensidade})`);
      luz.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = luz;
      ctx.fillRect(0, 0, LARGURA, ALTURA);
      ctx.restore();
      // Repõe o preto atrás do que a máscara apagou.
      ctx.save();
      ctx.globalCompositeOperation = 'destination-over';
      ctx.fillStyle = '#060505';
      ctx.fillRect(0, 0, LARGURA, ALTURA);
      ctx.restore();
    },

    /** Objetos atrás da mesa: cadeira e TV. Desenhar antes do oponente e do tampo. */
    desenharFundoDaSala(ctx, agora, lampada, centroOponenteX) {
      desenharCadeira(ctx, centroOponenteX);
      desenharTv(ctx, ruidoTv, agora, lampada.intensidade);
    },

    desenharTampo(ctx) {
      ctx.drawImage(tampo, 0, 0);
    },

    desenharPlaca,
    desenharPlacar,
  };
}
