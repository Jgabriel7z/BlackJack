// =====================================================================
//  placar.js — as cinco melhores pontuações da sessão  (sub-passo 3.4)
//
//  Tabela de fliperama: quem entra no top 5 digita três letras. Vale
//  enquanto a página estiver aberta; guardar em disco é da Etapa 4, por
//  isso aqui não existe localStorage nem qualquer I/O — só dados.
//
//  Desempate: quem chegou antes fica na frente. Uma pontuação igual à de
//  alguém que já está na lista entra ABAIXO dela, como nos fliperamas.
//  Pontuação zero não entra: não vale uma linha na tabela.
// =====================================================================

export const TAMANHO_DO_PLACAR = 5;
export const LETRAS_DAS_INICIAIS = 3;

/** As letras que as setas percorrem. Só A–Z: a fonte de pixels não tem acento. */
const ALFABETO = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export function criarPlacar(tamanho = TAMANHO_DO_PLACAR) {
  return { tamanho, entradas: [] };
}

/** Deixa o texto com exatamente três letras de A a Z, completando com A. */
export function normalizarIniciais(texto) {
  const limpo = String(texto ?? '').toUpperCase().replace(/[^A-Z]/g, '');
  return (limpo + 'A'.repeat(LETRAS_DAS_INICIAIS)).slice(0, LETRAS_DAS_INICIAIS);
}

/**
 * Em que linha (0 = primeiro lugar) esta pontuação entraria, ou -1 se
 * não entra na lista.
 */
export function posicaoNoPlacar(placar, pontos) {
  if (!Number.isFinite(pontos) || pontos <= 0) return -1;
  let linha = placar.entradas.findIndex((e) => pontos > e.pontos);
  if (linha === -1) linha = placar.entradas.length;   // pior que todo mundo: vai para o fim
  return linha < placar.tamanho ? linha : -1;
}

export function entraNoPlacar(placar, pontos) {
  return posicaoNoPlacar(placar, pontos) >= 0;
}

/**
 * Guarda uma pontuação na lista. `extra.nivel` é até onde a partida
 * chegou e `extra.venceu` se o jogador saiu inteiro — os dois aparecem
 * na tela. Devolve a linha em que ficou (-1 se não entrou).
 */
export function registrar(placar, iniciais, pontos, extra = {}) {
  const linha = posicaoNoPlacar(placar, pontos);
  if (linha < 0) return { linha: -1, entrada: null };

  const entrada = {
    iniciais: normalizarIniciais(iniciais),
    pontos,
    nivel: extra.nivel ?? 1,
    venceu: extra.venceu === true,
  };
  placar.entradas.splice(linha, 0, entrada);
  if (placar.entradas.length > placar.tamanho) placar.entradas.length = placar.tamanho;
  return { linha, entrada };
}

// ---------------------------------------------------------------------
//  Digitar as três letras
//
//  Como não temos manche, vale dos dois jeitos: digitar a letra no
//  teclado, ou mexer com as setas como num fliperama de verdade.
//  Estado puro: quem chama só repassa o nome da tecla.
// ---------------------------------------------------------------------

export function criarEntradaDeIniciais(inicial = 'AAA') {
  return {
    letras: normalizarIniciais(inicial).split(''),
    cursor: 0,
    confirmada: false,
  };
}

/** O texto digitado até agora. */
export function textoDasIniciais(entrada) {
  return entrada.letras.join('');
}

/**
 * Trata uma tecla. Devolve { mudou, confirmou }.
 *   letra A–Z        escreve na casa atual e anda para a próxima
 *   seta cima/baixo  troca a letra da casa atual
 *   seta esq/dir     anda entre as casas
 *   Backspace        volta uma casa e apaga (vira A)
 *   Enter            confirma
 */
export function teclarIniciais(entrada, tecla) {
  const parado = { mudou: false, confirmou: false };
  if (entrada.confirmada) return parado;

  if (tecla === 'Enter') {
    entrada.confirmada = true;
    return { mudou: false, confirmou: true };
  }

  if (tecla === 'Backspace') {
    entrada.cursor = Math.max(0, entrada.cursor - 1);
    entrada.letras[entrada.cursor] = 'A';
    return { mudou: true, confirmou: false };
  }

  if (tecla === 'ArrowLeft' || tecla === 'ArrowRight') {
    const passo = tecla === 'ArrowLeft' ? -1 : 1;
    entrada.cursor = Math.min(LETRAS_DAS_INICIAIS - 1, Math.max(0, entrada.cursor + passo));
    return { mudou: true, confirmou: false };
  }

  if (tecla === 'ArrowUp' || tecla === 'ArrowDown') {
    const passo = tecla === 'ArrowUp' ? 1 : -1;
    const atual = ALFABETO.indexOf(entrada.letras[entrada.cursor]);
    const proximo = (atual + passo + ALFABETO.length) % ALFABETO.length;
    entrada.letras[entrada.cursor] = ALFABETO[proximo];
    return { mudou: true, confirmou: false };
  }

  if (typeof tecla === 'string' && /^[a-zA-Z]$/.test(tecla)) {
    entrada.letras[entrada.cursor] = tecla.toUpperCase();
    // Na última casa o cursor fica parado: quem confirma é o Enter.
    entrada.cursor = Math.min(LETRAS_DAS_INICIAIS - 1, entrada.cursor + 1);
    return { mudou: true, confirmou: false };
  }

  return parado;
}
