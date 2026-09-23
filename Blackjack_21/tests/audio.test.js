// Testes do som (sub-passo 4.2). As contas (coração, perigo,
// abafamento) são puras. O resto é testado com um AudioContext de
// mentira, que só anota o que foi criado: dá para provar que o caminho
// do som monta inteiro e que nenhum efeito lança erro, sem navegador.

import { teste, assert, assertIgual } from './testador.js';
import {
  bpmDoCoracao,
  abafamento,
  corteDoAbafador,
  criarAudio,
} from '../src/ui/audio.js';
import { intensidadeDoPerigo } from '../src/ui/tensao.js';

// ---------------------------------------------------------------------
//  Um AudioContext de mentira
// ---------------------------------------------------------------------

function criarParam(valor = 0) {
  return {
    value: valor,
    setValueAtTime() { return this; },
    exponentialRampToValueAtTime() { return this; },
    linearRampToValueAtTime() { return this; },
    setTargetAtTime() { return this; },
    cancelScheduledValues() { return this; },
  };
}

function contextoFalso() {
  const criados = { gain: 0, filtro: 0, osc: 0, fonte: 0, conexoes: 0 };

  class ContextoFalso {
    constructor() {
      this.currentTime = 0;
      this.sampleRate = 44100;
      this.state = 'suspended';
      this.destination = { connect() { criados.conexoes += 1; } };
      this.criados = criados;
      ContextoFalso.ultimo = this;
    }

    resume() { this.state = 'running'; return Promise.resolve(); }

    createGain() {
      criados.gain += 1;
      return { gain: criarParam(1), connect() { criados.conexoes += 1; } };
    }

    createBiquadFilter() {
      criados.filtro += 1;
      return {
        type: 'lowpass',
        frequency: criarParam(1000),
        Q: criarParam(1),
        connect() { criados.conexoes += 1; },
      };
    }

    createOscillator() {
      criados.osc += 1;
      return {
        type: 'sine',
        frequency: criarParam(440),
        connect() { criados.conexoes += 1; },
        start() {},
        stop() {},
      };
    }

    createBufferSource() {
      criados.fonte += 1;
      return {
        buffer: null,
        loop: false,
        connect() { criados.conexoes += 1; },
        start() {},
        stop() {},
      };
    }

    createBuffer(canais, amostras) {
      return { getChannelData: () => new Float32Array(amostras) };
    }
  }

  return { ContextoFalso, criados };
}

/** Uma mesa mínima, só com o que o som lê. */
function mesaFalsa(extra = {}) {
  return {
    nivel: 1,
    tela: 'jogando',
    serraPos: 7,
    kaio: null,
    eu: { aposta: 1, dedos: 5, medidor: 0 },
    ...extra,
  };
}

// ---------------------------------------------------------------------
//  Contas
// ---------------------------------------------------------------------

teste('som: o coração acelera com a aposta', () => {
  const calmo = bpmDoCoracao(1, 0);
  const apertado = bpmDoCoracao(5, 0);
  assert(apertado > calmo, `${apertado} deveria passar de ${calmo}`);
  assertIgual(bpmDoCoracao(1, 0), 52);
});

teste('som: o coração acelera perto da morte', () => {
  assert(bpmDoCoracao(3, 1) > bpmDoCoracao(3, 0));
  assert(bpmDoCoracao(5, 1) < 200, 'mas não vira metralhadora');
});

teste('som: aposta fora da faixa não quebra a conta', () => {
  assertIgual(bpmDoCoracao(0, 0), bpmDoCoracao(1, 0));
  assertIgual(bpmDoCoracao(99, 0), bpmDoCoracao(5, 0));
});

teste('som: o perigo do nível 1 é quantos dedos já foram', () => {
  assertIgual(intensidadeDoPerigo(mesaFalsa()), 0);
  assertIgual(intensidadeDoPerigo(mesaFalsa({ eu: { aposta: 1, dedos: 0, medidor: 0 } })), 1);
  assertIgual(intensidadeDoPerigo(mesaFalsa({ eu: { aposta: 1, dedos: 3, medidor: 0 } })), 0.4);
});

teste('som: no nível 2 o perigo é o medidor de choque', () => {
  const mesa = mesaFalsa({ nivel: 2, eu: { aposta: 1, dedos: 5, medidor: 7 } });
  assertIgual(intensidadeDoPerigo(mesa), 0.7);
});

teste('som: no nível 3 o perigo é a serra chegando perto', () => {
  assertIgual(intensidadeDoPerigo(mesaFalsa({ nivel: 3, serraPos: 7 })), 0, 'no meio do trilho, nada');
  assertIgual(intensidadeDoPerigo(mesaFalsa({ nivel: 3, serraPos: 0 })), 1, 'encostada, no limite');
  assert(intensidadeDoPerigo(mesaFalsa({ nivel: 3, serraPos: 3 })) > 0.5);
  assertIgual(intensidadeDoPerigo(mesaFalsa({ nivel: 3, serraPos: 15 })), 0, 'do outro lado, nada');
});

teste('som: sem mesa, nenhum perigo', () => {
  assertIgual(intensidadeDoPerigo(null), 0);
});

teste('som: o abafamento fecha na hora e volta devagar', () => {
  assertIgual(abafamento(0), 1);
  assert(abafamento(1000) > abafamento(2500), 'vai abrindo com o tempo');
  assertIgual(abafamento(3500), 0);
  assertIgual(abafamento(9999), 0);
  assertIgual(abafamento(-5), 0, 'tempo negativo não abafa');
  assertIgual(abafamento(NaN), 0);
});

teste('som: abafado corta os agudos', () => {
  assert(corteDoAbafador(0) > 15000, 'som normal deixa passar tudo');
  assert(corteDoAbafador(1) < 500, 'abafado só deixa o grave');
});

// ---------------------------------------------------------------------
//  Sem Web Audio
// ---------------------------------------------------------------------

teste('som: sem Web Audio o jogo continua, mudo', () => {
  const audio = criarAudio({ contexto: null });
  assertIgual(audio.ligar(), false);
  assert(audio.falhou);
  assert(!audio.ligado);
  // Nada disso pode lançar erro.
  audio.carta();
  audio.lamina();
  audio.impacto();
  audio.silencioDaRevelacao();
  audio.voltarDoSilencio();
  audio.atualizar(mesaFalsa(), { intensidade: 1 }, 1000);
  assertIgual(audio.ultimoSom, 'ambiente-volta');
});

teste('som: um AudioContext que explode não derruba o jogo', () => {
  const Explosivo = function () { throw new Error('sem saída de áudio'); };
  const audio = criarAudio({ contexto: Explosivo });
  assertIgual(audio.ligar(), false);
  assert(audio.motivo.includes('sem saída de áudio'), audio.motivo);
  audio.carta();
  assertIgual(audio.totalDeSons, 1, 'os eventos continuam sendo anotados');
});

// ---------------------------------------------------------------------
//  Com o contexto de mentira
// ---------------------------------------------------------------------

teste('som: ligar monta o caminho inteiro do som', () => {
  const { ContextoFalso, criados } = contextoFalso();
  const audio = criarAudio({ contexto: ContextoFalso });
  assert(audio.ligar());
  assert(audio.ligado);
  // Mestre, abafador, dois barramentos e as fontes contínuas.
  assert(criados.gain >= 6, `ganhos criados: ${criados.gain}`);
  assert(criados.filtro >= 4, `filtros criados: ${criados.filtro}`);
  assert(criados.osc >= 8, `osciladores criados: ${criados.osc}`);
  assert(criados.conexoes > 15, `conexões: ${criados.conexoes}`);
});

teste('som: ligar duas vezes não monta tudo de novo', () => {
  const { ContextoFalso, criados } = contextoFalso();
  const audio = criarAudio({ contexto: ContextoFalso });
  audio.ligar();
  const depoisDeUma = criados.osc;
  audio.ligar();
  assertIgual(criados.osc, depoisDeUma);
});

teste('som: todos os efeitos rodam sem lançar erro', () => {
  const { ContextoFalso } = contextoFalso();
  const audio = criarAudio({ contexto: ContextoFalso });
  audio.ligar();
  for (const efeito of ['carta', 'lamina', 'capacitor', 'descarga', 'passoDaSerra', 'impacto', 'grito']) {
    audio[efeito]();
  }
  audio.voz('Uma fala qualquer do anfitrião, com acento e tudo.');
  assertIgual(audio.ultimoSom, 'voz');
  assertIgual(audio.totalDeSons, 8);
});

teste('som: a voz do anfitrião aguenta qualquer texto', () => {
  const { ContextoFalso, criados } = contextoFalso();
  const audio = criarAudio({ contexto: ContextoFalso });
  audio.ligar();
  const antes = criados.osc;
  for (const fala of ['', 'oi', 'NÃO. Não assim. Não hoje.', 'a'.repeat(400)]) {
    audio.voz(fala);
  }
  assert(criados.osc > antes, 'grunhiu alguma coisa');
});

teste('som: a mesma fala soa sempre igual', () => {
  // O ritmo dos grunhidos sai do próprio texto, sem Math.random, então a
  // mesma fala cria sempre a mesma quantidade de sons.
  const contar = () => {
    const { ContextoFalso, criados } = contextoFalso();
    const audio = criarAudio({ contexto: ContextoFalso });
    audio.ligar();
    const antes = criados.osc;
    audio.voz('Empate. Os dois pagam. Adoro empate.');
    return criados.osc - antes;
  };
  assertIgual(contar(), contar());
});

teste('som: a tecla M alterna o mudo', () => {
  const { ContextoFalso } = contextoFalso();
  const audio = criarAudio({ contexto: ContextoFalso });
  audio.ligar();
  assert(!audio.mudo);
  assertIgual(audio.alternarMudo(), true);
  assert(audio.mudo);
  assertIgual(audio.alternarMudo(), false);
});

teste('som: mudo não toca nada, mas continua anotando', () => {
  const { ContextoFalso, criados } = contextoFalso();
  const audio = criarAudio({ contexto: ContextoFalso });
  audio.ligar();
  audio.alternarMudo();
  const antes = criados.osc;
  audio.impacto();
  assertIgual(criados.osc, antes, 'mudo não cria oscilador nenhum');
  assertIgual(audio.ultimoSom, 'impacto', 'mas o roteiro ainda vê o evento');
});

teste('som: o quadro roda com mesa de qualquer nível, sem erro', () => {
  const { ContextoFalso } = contextoFalso();
  const audio = criarAudio({ contexto: ContextoFalso });
  audio.ligar();
  for (const nivel of [1, 2, 3]) {
    for (let t = 0; t < 4000; t += 200) {
      audio.atualizar(mesaFalsa({ nivel, kaio: t > 2000 ? 'fala' : null }), { intensidade: 0.5 }, t);
    }
  }
  assert(true, 'chegou até aqui sem lançar');
});

teste('som: o coração para na revelação e volta depois', () => {
  const { ContextoFalso, criados } = contextoFalso();
  const audio = criarAudio({ contexto: ContextoFalso });
  audio.ligar();
  const mesa = mesaFalsa();

  let t = 0;
  const bater = (quanto) => {
    const antes = criados.osc;
    for (let i = 0; i < quanto; i++) { t += 200; audio.atualizar(mesa, { intensidade: 1 }, t); }
    return criados.osc - antes;
  };

  assert(bater(30) > 0, 'batendo normalmente');
  audio.silencioDaRevelacao();
  assertIgual(bater(30), 0, 'silêncio antes de virar as cartas');
  audio.voltarDoSilencio();
  assert(bater(30) > 0, 'e volta depois');
});
