// Mini framework de testes, sem dependências. Funciona no browser e no Node.

export const testes = [];

/** Registra um teste. `fn` pode lançar erro para falhar. */
export function teste(nome, fn) {
  testes.push({ nome, fn });
}

export function assert(condicao, mensagem = 'condição falsa') {
  if (!condicao) throw new Error(mensagem);
}

export function assertIgual(obtido, esperado, mensagem = '') {
  const a = JSON.stringify(obtido);
  const b = JSON.stringify(esperado);
  if (a !== b) {
    throw new Error(`${mensagem}${mensagem ? ': ' : ''}esperado ${b}, obtido ${a}`);
  }
}

export function assertLanca(fn, mensagem = 'esperava um erro') {
  let lancou = false;
  try {
    fn();
  } catch {
    lancou = true;
  }
  if (!lancou) throw new Error(mensagem);
}

/** Roda todos os testes registrados e devolve a lista de resultados. */
export function rodarTodos() {
  return testes.map(({ nome, fn }) => {
    try {
      fn();
      return { nome, ok: true, erro: null };
    } catch (e) {
      return { nome, ok: false, erro: e.message ?? String(e) };
    }
  });
}
