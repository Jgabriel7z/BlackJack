// =====================================================================
//  ui/animacao.js — sequenciador de passos e curvas de suavização
//  (sub-passo 1.4)
//
//  Toda animação da mesa é uma FILA DE PASSOS. Cada passo tem:
//    nome        texto curto, exposto em body[data-animacao] para roteiros
//    duracao     em ms, no ritmo normal; é multiplicada por `fatorTempo`
//                (0,05 com ?rapido=1), então tudo acelera junto
//    aoIniciar() chamado uma vez quando o passo começa
//    aoAtualizar(progresso)  chamado a cada quadro com progresso 0..1
//    aoTerminar()            chamado uma vez ao acabar; pode enfileirar
//                            novos passos (é assim que a IA "reage")
//
//  Só um passo roda por vez. O relógio vem de fora (requestAnimationFrame),
//  então não há setTimeout encadeado: um único loop pergunta
//  `atualizar(agora)` a cada quadro.
//
//  Sem DOM: testável no Node.
// =====================================================================

export const suavizar = {
  linear: (t) => t,
  entradaCubica: (t) => t * t * t,            // começa devagar, termina rápido (queda)
  saidaCubica: (t) => 1 - (1 - t) ** 3,
  entradaSaida: (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),
};

export function interpolar(a, b, t) {
  return a + (b - a) * t;
}

export function limitar(v, minimo, maximo) {
  return Math.max(minimo, Math.min(maximo, v));
}

export function criarSequenciador(fatorTempo = 1) {
  const fila = [];
  let atual = null;
  let inicio = 0;

  return {
    /** Enfileira um passo. Pode ser chamado de dentro de aoTerminar. */
    adicionar(passo) {
      fila.push(passo);
    },

    /** True enquanto houver passo rodando ou esperando. */
    get ocupado() {
      return atual !== null || fila.length > 0;
    },

    /** Nome do passo em andamento, ou null se ocioso. */
    get nomeAtual() {
      return atual?.nome ?? null;
    },

    /**
     * Avança o relógio. `agora` em ms (performance.now()).
     * Devolve { passo, progresso } do passo em andamento ou null.
     */
    atualizar(agora) {
      if (atual === null && fila.length > 0) {
        atual = fila.shift();
        inicio = agora;
        atual.aoIniciar?.();
      }
      if (atual === null) return null;

      const duracao = atual.duracao * fatorTempo;
      const progresso = duracao <= 0 ? 1 : limitar((agora - inicio) / duracao, 0, 1);
      atual.aoAtualizar?.(progresso);

      const resultado = { passo: atual, progresso };
      if (progresso >= 1) {
        const terminado = atual;
        atual = null;
        terminado.aoTerminar?.();
      }
      return resultado;
    },
  };
}

/** Passo que só espera. */
export function pausa(nome, duracao) {
  return { nome, duracao };
}
