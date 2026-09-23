// =====================================================================
//  ui/armazenamento.js — o único arquivo que toca no localStorage  (4.1)
//
//  Fica na interface de propósito: `src/engine/` é lógica pura e não
//  pode saber que existe navegador. Aqui só entra e sai texto; quem
//  entende o formato é `src/engine/progresso.js`.
//
//  Guardar dados pode falhar de várias formas e nenhuma pode derrubar o
//  jogo: janela anônima, site bloqueado, cota estourada, ou o próprio
//  `localStorage` lançando erro só de ser lido. Por isso TODA operação
//  está dentro de try/catch e o objeto continua respondendo — só que
//  `disponivel` vira false e o jogo segue na memória, avisando no título.
// =====================================================================

export const CHAVE_PADRAO = 'blackjack21:progresso';

export function criarArmazenamento(chave = CHAVE_PADRAO, deposito = null) {
  let disponivel = true;
  let motivo = null;

  /** Pega o depósito de verdade. Só isto já pode lançar erro. */
  function pegarDeposito() {
    if (deposito) return deposito;
    return globalThis.localStorage ?? null;
  }

  function falhar(erro) {
    disponivel = false;
    motivo = erro?.message ?? String(erro);
    return null;
  }

  return {
    get disponivel() { return disponivel; },
    get motivo() { return motivo; },
    chave,

    /** Devolve o objeto guardado, ou null se não houver (ou se der errado). */
    carregar() {
      try {
        const alvo = pegarDeposito();
        if (!alvo) return falhar(new Error('sem localStorage neste navegador'));
        const texto = alvo.getItem(chave);
        if (texto === null || texto === undefined) return null;
        return JSON.parse(texto);
      } catch (erro) {
        return falhar(erro);
      }
    },

    /** Guarda o objeto. Devolve true se conseguiu. */
    salvar(dados) {
      try {
        const alvo = pegarDeposito();
        if (!alvo) { falhar(new Error('sem localStorage neste navegador')); return false; }
        alvo.setItem(chave, JSON.stringify(dados));
        return true;
      } catch (erro) {
        falhar(erro);
        return false;
      }
    },

    /** Apaga tudo o que este jogo guardou. Devolve true se conseguiu. */
    apagar() {
      try {
        const alvo = pegarDeposito();
        if (!alvo) { falhar(new Error('sem localStorage neste navegador')); return false; }
        alvo.removeItem(chave);
        return true;
      } catch (erro) {
        falhar(erro);
        return false;
      }
    },
  };
}
