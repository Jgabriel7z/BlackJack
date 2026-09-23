// =====================================================================
//  ui/tensao.js — o quanto a cena está tensa, de 0 a 1  (sub-passo 4.3)
//
//  Duas coisas apertam o jogo, segundo a parte B3 do PDF: a aposta
//  subindo e a morte chegando perto. Quem lê isto é o som (o coração
//  acelera) e os efeitos visuais (granulado, tremor e separação de cores
//  aumentam). Como são dois donos, a conta mora sozinha aqui.
//
//  Funções puras: recebem a "mesa visual" e devolvem número. Nasceu no
//  4.2 dentro do audio.js e mudou de casa no 4.3, quando os efeitos
//  visuais passaram a precisar da mesma conta.
// =====================================================================

const limitar = (v, minimo = 0, maximo = 1) => Math.min(Math.max(v, minimo), maximo);

/**
 * O quanto o jogador está perto de morrer, de 0 a 1, olhando o aparelho
 * do nível: dedos que restam, medidor de choque, ou a serra no trilho.
 */
export function intensidadeDoPerigo(mesa) {
  if (!mesa) return 0;
  if (mesa.nivel === 2) return limitar(mesa.eu.medidor / 10);
  if (mesa.nivel === 3) {
    // O trilho tem 15 marcas e ela começa no meio; contar a partir da
    // metade faz o aperto começar quando ela vira para o nosso lado.
    const distancia = limitar(mesa.serraPos, 0, 15);
    return limitar(1 - distancia / 7);
  }
  return limitar((5 - mesa.eu.dedos) / 5);
}

/** Peso da aposta, de 0 (1 dedo em jogo) a 1 (5 dedos). */
export function pesoDaAposta(aposta) {
  return limitar((limitar(aposta, 1, 5) - 1) / 4);
}

/**
 * A tensão da cena inteira. A morte chegando pesa mais que a aposta:
 * estar a um passo do fim já deixa quase no máximo, mesmo apostando
 * pouco; e uma aposta alta sozinha não passa da metade.
 */
export function tensaoDaCena(mesa) {
  if (!mesa) return 0;
  const aposta = pesoDaAposta(mesa.eu?.aposta ?? 1);
  return limitar(0.45 * aposta + 0.75 * intensidadeDoPerigo(mesa));
}
