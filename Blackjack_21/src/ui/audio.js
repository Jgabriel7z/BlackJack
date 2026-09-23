// =====================================================================
//  ui/audio.js — todo o som do jogo, sintetizado  (sub-passo 4.2)
//
//  Nenhum arquivo de áudio: tudo sai de osciladores e ruído gerado na
//  hora, seguindo a parte B4 do PDF. Fica na interface porque
//  `src/engine/` não pode tocar em Web Audio.
//
//  O caminho do som:
//
//     ambiente (drone, lâmpada, coração, serra, chiado da TV) ──┐
//     foley    (carta, lâmina, capacitor, impacto) ─────────────┤
//                                                               ▼
//                                      abafador (passa-baixa) ──► mestre ──► saída
//
//  Dois barramentos porque eles são silenciados em momentos
//  diferentes: na revelação o ambiente some e o foley fica (é o
//  "silêncio antes de virar as cartas" do PDF), e depois de uma punição
//  o abafador fecha para tudo por alguns segundos, com um zumbido agudo
//  por cima — como quem levou um impacto perto do ouvido.
//
//  Nada aqui pode derrubar o jogo. O navegador só deixa tocar som
//  depois de um gesto do usuário, e pode simplesmente não ter Web
//  Audio: em qualquer um desses casos o jogo roda mudo e segue.
// =====================================================================

import { intensidadeDoPerigo } from './tensao.js';

// ---------------------------------------------------------------------
//  Contas puras (testáveis no terminal, sem navegador)
// ---------------------------------------------------------------------

/** Batidas por minuto do coração, pela aposta e pelo perigo (0..1). */
export function bpmDoCoracao(aposta, perigo = 0) {
  const porAposta = Math.min(Math.max(aposta, 1), 5) - 1;   // 0..4
  return 52 + porAposta * 11 + perigo * 46;
}

/**
 * Curva do abafamento depois de uma punição: 0 é som normal, 1 é tudo
 * abafado. Fecha na hora e volta devagar.
 */
export function abafamento(decorrido, duracao = 3500) {
  if (!(decorrido >= 0) || decorrido >= duracao) return 0;
  return (1 - decorrido / duracao) ** 0.6;
}

/** Frequência do passa-baixa para um dado abafamento. */
export function corteDoAbafador(quanto) {
  return 18000 * (1 - quanto) + 380 * quanto;
}

// ---------------------------------------------------------------------
//  O aparelho de som
// ---------------------------------------------------------------------

const DURACAO_DO_ABAFAMENTO = 3500;

export function criarAudio(opcoes = {}) {
  const construtor = opcoes.contexto ?? globalThis.AudioContext ?? globalThis.webkitAudioContext ?? null;

  let ctx = null;
  let mudo = false;
  let falhou = false;
  let motivo = null;

  let mestre = null;
  let abafador = null;
  let ambiente = null;
  let foley = null;
  let ruidoBuffer = null;

  let droneGanho = null;
  let lampadaGanho = null;
  let lampadaFiltro = null;
  let serraGanho = null;
  let serraOsc = null;
  let chiadoGanho = null;

  let proximaBatida = 0;
  let punidoEm = null;
  let emSilencio = false;
  // `impacto` pede o abafamento, mas quem tem o relógio do jogo é o
  // `atualizar` do quadro seguinte; por isso o pedido fica marcado aqui.
  let pedirAbafamento = false;
  /** Último som disparado e quantos já foram: os roteiros leem isto. */
  const ultimo = { nome: 'nenhum', total: 0 };

  const agoraCtx = () => (ctx ? ctx.currentTime : 0);

  function anotar(nome) {
    ultimo.nome = nome;
    ultimo.total += 1;
  }

  /** Um buffer de ruído branco, reaproveitado por todos os chiados. */
  function pegarRuido() {
    if (ruidoBuffer) return ruidoBuffer;
    const amostras = Math.floor(ctx.sampleRate * 2);
    ruidoBuffer = ctx.createBuffer(1, amostras, ctx.sampleRate);
    const dados = ruidoBuffer.getChannelData(0);
    for (let i = 0; i < amostras; i++) dados[i] = Math.random() * 2 - 1;
    return ruidoBuffer;
  }

  function ganho(valor, destino) {
    const g = ctx.createGain();
    g.gain.value = valor;
    g.connect(destino);
    return g;
  }

  /**
   * Liga o aparelho. Só funciona depois de um gesto do usuário — é o
   * navegador que exige isso. Chamar de novo é inofensivo.
   */
  function ligar() {
    if (ctx || falhou) {
      if (ctx && ctx.state === 'suspended') ctx.resume?.().catch(() => {});
      return ctx !== null;
    }
    if (!construtor) {
      falhou = true;
      motivo = 'este navegador não tem Web Audio';
      return false;
    }
    try {
      ctx = new construtor();
      montar();
      if (ctx.state === 'suspended') ctx.resume?.().catch(() => {});
      return true;
    } catch (erro) {
      falhou = true;
      motivo = erro?.message ?? String(erro);
      ctx = null;
      return false;
    }
  }

  /** Monta o caminho fixo do som e as fontes que tocam o tempo todo. */
  function montar() {
    mestre = ctx.createGain();
    mestre.gain.value = mudo ? 0 : 0.9;
    mestre.connect(ctx.destination);

    abafador = ctx.createBiquadFilter();
    abafador.type = 'lowpass';
    abafador.frequency.value = 18000;
    abafador.connect(mestre);

    ambiente = ganho(1, abafador);
    foley = ganho(1, abafador);

    // --- Drone grave constante: dois osciladores quase no mesmo tom ---
    droneGanho = ganho(0.10, ambiente);
    const droneFiltro = ctx.createBiquadFilter();
    droneFiltro.type = 'lowpass';
    droneFiltro.frequency.value = 220;
    droneFiltro.connect(droneGanho);
    for (const [freq, tipo] of [[36, 'sine'], [43.5, 'triangle'], [72, 'sine']]) {
      const osc = ctx.createOscillator();
      osc.type = tipo;
      osc.frequency.value = freq;
      osc.connect(droneFiltro);
      osc.start();
    }
    // Respiração lenta do drone, para ele não ficar parado.
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGanho = ctx.createGain();
    lfoGanho.gain.value = 0.035;
    lfo.connect(lfoGanho);
    lfoGanho.connect(droneGanho.gain);
    lfo.start();

    // --- Zumbido elétrico da lâmpada e da TV ---
    lampadaFiltro = ctx.createBiquadFilter();
    lampadaFiltro.type = 'bandpass';
    lampadaFiltro.frequency.value = 1400;
    lampadaFiltro.Q.value = 6;
    lampadaGanho = ganho(0.02, ambiente);
    lampadaFiltro.connect(lampadaGanho);
    for (const freq of [100, 150, 300]) {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = freq;
      osc.connect(lampadaFiltro);
      osc.start();
    }

    // --- Motor da serra: só se ouve no nível 3, mais alto quanto mais perto ---
    serraGanho = ganho(0, ambiente);
    const serraFiltro = ctx.createBiquadFilter();
    serraFiltro.type = 'lowpass';
    serraFiltro.frequency.value = 900;
    serraFiltro.connect(serraGanho);
    serraOsc = ctx.createOscillator();
    serraOsc.type = 'sawtooth';
    serraOsc.frequency.value = 78;
    serraOsc.connect(serraFiltro);
    serraOsc.start();

    // --- Chiado do alto-falante da TV, quando o anfitrião fala ---
    chiadoGanho = ganho(0, ambiente);
    const chiadoFiltro = ctx.createBiquadFilter();
    chiadoFiltro.type = 'bandpass';
    chiadoFiltro.frequency.value = 1900;
    chiadoFiltro.Q.value = 0.8;
    chiadoFiltro.connect(chiadoGanho);
    const fonte = ctx.createBufferSource();
    fonte.buffer = pegarRuido();
    fonte.loop = true;
    fonte.connect(chiadoFiltro);
    fonte.start();
  }

  /** Uma rajada de ruído com filtro e envelope próprios. */
  function rajada({ duracao, volume, tipo = 'bandpass', de, para, q = 1, destino, atraso = 0 }) {
    const inicio = agoraCtx() + atraso;
    const fonte = ctx.createBufferSource();
    fonte.buffer = pegarRuido();
    const filtro = ctx.createBiquadFilter();
    filtro.type = tipo;
    filtro.Q.value = q;
    filtro.frequency.setValueAtTime(de, inicio);
    filtro.frequency.exponentialRampToValueAtTime(Math.max(para, 30), inicio + duracao);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, agoraCtx());
    g.gain.setValueAtTime(volume, inicio);
    g.gain.exponentialRampToValueAtTime(0.0001, inicio + duracao);
    fonte.connect(filtro);
    filtro.connect(g);
    g.connect(destino ?? foley);
    fonte.start(inicio);
    fonte.stop(inicio + duracao + 0.05);
  }

  /** Um tom com envelope, opcionalmente varrendo de uma nota a outra. */
  function tom({ de, para = null, duracao, volume, tipo = 'sine', destino, atraso = 0 }) {
    const inicio = agoraCtx() + atraso;
    const osc = ctx.createOscillator();
    osc.type = tipo;
    osc.frequency.setValueAtTime(de, inicio);
    if (para !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(para, 20), inicio + duracao);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, inicio);
    g.gain.exponentialRampToValueAtTime(volume, inicio + Math.min(0.02, duracao / 4));
    g.gain.exponentialRampToValueAtTime(0.0001, inicio + duracao);
    osc.connect(g);
    g.connect(destino ?? foley);
    osc.start(inicio);
    osc.stop(inicio + duracao + 0.05);
  }

  /** Executa `fn` só se houver som ligado; erro aqui nunca sobe. */
  function tocar(nome, fn) {
    anotar(nome);
    if (!ctx || mudo) return;
    try { fn(); } catch { /* som não é motivo para parar o jogo */ }
  }

  return {
    get ligado() { return ctx !== null; },
    get mudo() { return mudo; },
    get falhou() { return falhou; },
    get motivo() { return motivo; },
    get ultimoSom() { return ultimo.nome; },
    get totalDeSons() { return ultimo.total; },
    ligar,

    /** Liga/desliga o som (tecla M). Devolve o novo estado de mudo. */
    alternarMudo() {
      mudo = !mudo;
      if (mestre) {
        try {
          mestre.gain.cancelScheduledValues(agoraCtx());
          mestre.gain.setTargetAtTime(mudo ? 0 : 0.9, agoraCtx(), 0.05);
        } catch { /* ignora */ }
      }
      anotar(mudo ? 'mudo' : 'som-ligado');
      return mudo;
    },

    // --- eventos da mesa ---------------------------------------------

    /** Papel da carta deslizando. */
    carta() {
      tocar('carta', () => rajada({ duracao: 0.16, volume: 0.22, de: 2600, para: 700, q: 0.7 }));
    },

    /** Metal da guilhotina sendo armado e descendo. */
    lamina() {
      tocar('lamina', () => {
        tom({ de: 900, para: 180, duracao: 0.5, volume: 0.09, tipo: 'sawtooth' });
        rajada({ duracao: 0.45, volume: 0.16, de: 900, para: 4200, q: 1.2 });
      });
    },

    /** Capacitor do taser carregando. */
    capacitor(duracao = 0.9) {
      tocar('capacitor', () => {
        tom({ de: 180, para: 1100, duracao, volume: 0.07, tipo: 'sawtooth' });
      });
    },

    /** Descarga elétrica. */
    descarga() {
      tocar('descarga', () => {
        rajada({ duracao: 0.55, volume: 0.30, tipo: 'highpass', de: 700, para: 3000, q: 0.5 });
        tom({ de: 140, para: 60, duracao: 0.4, volume: 0.15, tipo: 'square' });
      });
    },

    /** A serra dando um passo no trilho: o motor sobe de tom um instante. */
    passoDaSerra() {
      tocar('serra', () => {
        tom({ de: 150, para: 90, duracao: 0.7, volume: 0.10, tipo: 'sawtooth' });
        rajada({ duracao: 0.6, volume: 0.10, de: 1800, para: 500, q: 0.8 });
      });
    },

    /**
     * Impacto seco da punição: pancada + zumbido agudo no ouvido, e
     * todo o som abafado por alguns segundos.
     */
    impacto() {
      tocar('impacto', () => {
        tom({ de: 120, para: 38, duracao: 0.45, volume: 0.45 });
        rajada({ duracao: 0.22, volume: 0.35, tipo: 'lowpass', de: 1400, para: 200 });
        // Zumbido agudo: entra depois do estouro e demora a sair.
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = 3730;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, agoraCtx());
        g.gain.exponentialRampToValueAtTime(0.045, agoraCtx() + 0.05);
        g.gain.exponentialRampToValueAtTime(0.0001, agoraCtx() + DURACAO_DO_ABAFAMENTO / 1000);
        osc.connect(g);
        g.connect(mestre);   // passa por fora do abafador: é dentro do ouvido
        osc.start();
        osc.stop(agoraCtx() + DURACAO_DO_ABAFAMENTO / 1000 + 0.1);
      });
      pedirAbafamento = true;   // o próximo quadro fecha o abafador
    },

    /**
     * A voz do anfitrião: nenhuma palavra, só grunhidos abafados com
     * chiado por cima, como uma respiração passando por um alto-falante
     * velho. O ritmo sai do próprio texto (soma dos códigos das letras),
     * então a mesma fala soa sempre igual e nenhuma soa como a outra.
     */
    voz(fala = '') {
      tocar('voz', () => {
        const letras = [...fala];
        const grunhidos = Math.max(3, Math.min(11, Math.round(letras.length / 9)));
        // Um "acaso" que vem do texto: sem Math.random, sempre igual.
        const semente = (i) => {
          const c = letras[(i * 7) % Math.max(1, letras.length)]?.charCodeAt(0) ?? 65;
          return ((c * 37 + i * 61) % 100) / 100;
        };

        let quando = 0;
        for (let i = 0; i < grunhidos; i++) {
          const r = semente(i);
          const duracao = 0.10 + r * 0.10;
          // O grunhido: grave, curto, e sempre descendo um pouco.
          tom({
            de: 96 + r * 54, para: 62 + r * 22, duracao,
            volume: 0.085 + r * 0.03, tipo: 'sawtooth', atraso: quando,
          });
          // E o chiado do alto-falante em cima dele.
          rajada({
            duracao: duracao + 0.05, volume: 0.075 + r * 0.04,
            tipo: 'bandpass', de: 900 + r * 700, para: 420 + r * 260,
            q: 1.6, atraso: quando,
          });
          quando += duracao + 0.035 + semente(i + 3) * 0.075;
        }

        // A respiração por baixo de tudo, do começo ao fim da fala.
        rajada({
          duracao: quando + 0.25, volume: 0.05,
          tipo: 'bandpass', de: 640, para: 300, q: 0.9,
        });
      });
    },

    /**
     * O grito do anfitrião pelo alto-falante da TV, na trapaça (4.8).
     * É voz nenhuma: é ruído filtrado descendo, que é o que sobra de uma
     * voz num alto-falante velho.
     */
    grito() {
      tocar('grito', () => {
        rajada({ duracao: 1.6, volume: 0.30, tipo: 'bandpass', de: 2600, para: 320, q: 2.2 });
        tom({ de: 420, para: 90, duracao: 1.5, volume: 0.13, tipo: 'sawtooth' });
      });
    },

    /** Corta a música e o ambiente: só ficam as cartas sendo viradas. */
    silencioDaRevelacao() {
      emSilencio = true;
      anotar('silencio');
      if (!ctx) return;
      try { ambiente.gain.setTargetAtTime(0, agoraCtx(), 0.12); } catch { /* ignora */ }
    },

    /** O ambiente volta depois da revelação. */
    voltarDoSilencio() {
      emSilencio = false;
      anotar('ambiente-volta');
      if (!ctx) return;
      try { ambiente.gain.setTargetAtTime(1, agoraCtx(), 0.35); } catch { /* ignora */ }
    },

    /**
     * Um quadro. Cuida do que é contínuo: zumbido da lâmpada, motor da
     * serra, chiado da TV, coração e o abafamento depois da punição.
     */
    atualizar(mesa, lampada, agora) {
      if (!ctx) return;
      try {
        if (pedirAbafamento) {
          pedirAbafamento = false;
          punidoEm = agora;
          abafador.frequency.cancelScheduledValues(agoraCtx());
          abafador.frequency.setValueAtTime(corteDoAbafador(1), agoraCtx());
        }

        // Abafamento voltando ao normal.
        if (punidoEm !== null) {
          const quanto = abafamento(agora - punidoEm, DURACAO_DO_ABAFAMENTO);
          abafador.frequency.setTargetAtTime(corteDoAbafador(quanto), agoraCtx(), 0.08);
          if (quanto === 0) punidoEm = null;
        }

        // Zumbido da lâmpada acompanha o piscar dela.
        const brilho = lampada?.intensidade ?? 1;
        lampadaGanho.gain.setTargetAtTime(0.012 + 0.030 * (1 - brilho), agoraCtx(), 0.03);

        // Motor da serra: só no nível 3, mais alto quanto mais perto.
        const perigo = intensidadeDoPerigo(mesa);
        const naSerra = mesa.nivel === 3 && mesa.tela === 'jogando';
        serraGanho.gain.setTargetAtTime(naSerra ? 0.02 + 0.06 * perigo : 0, agoraCtx(), 0.4);
        serraOsc.frequency.setTargetAtTime(74 + 26 * perigo, agoraCtx(), 0.4);

        // Chiado quando o anfitrião fala na televisão.
        chiadoGanho.gain.setTargetAtTime(mesa.kaio ? 0.05 : 0, agoraCtx(), 0.12);

        // Coração: acelera com a aposta e com o perigo; some na revelação.
        const batendo = !emSilencio && mesa.tela === 'jogando' && !mudo;
        if (!batendo) {
          proximaBatida = 0;
        } else {
          const bpm = bpmDoCoracao(mesa.eu.aposta, perigo);
          const intervalo = 60000 / bpm;
          if (proximaBatida === 0) proximaBatida = agora + intervalo;
          if (agora >= proximaBatida) {
            proximaBatida = agora + intervalo;
            const volume = 0.10 + 0.14 * perigo;
            tom({ de: 62, para: 40, duracao: 0.13, volume, destino: ambiente });
            const segunda = ctx.createGain();   // a segunda pancada, mais fraca
            segunda.gain.value = 1;
            segunda.connect(ambiente);
            const osc = ctx.createOscillator();
            osc.frequency.setValueAtTime(58, agoraCtx() + 0.16);
            osc.frequency.exponentialRampToValueAtTime(38, agoraCtx() + 0.27);
            const g = ctx.createGain();
            g.gain.setValueAtTime(0.0001, agoraCtx() + 0.16);
            g.gain.exponentialRampToValueAtTime(volume * 0.6, agoraCtx() + 0.18);
            g.gain.exponentialRampToValueAtTime(0.0001, agoraCtx() + 0.30);
            osc.connect(g);
            g.connect(ambiente);
            osc.start(agoraCtx() + 0.16);
            osc.stop(agoraCtx() + 0.35);
          }
        }
      } catch { /* som não é motivo para parar o jogo */ }
    },
  };
}
