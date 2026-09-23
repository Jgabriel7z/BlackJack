// =====================================================================
//  ui/parametros.js — lê os parâmetros da URL  (sub-passo 1.3)
//
//    ?seed=123   seed da partida; a mesma seed reproduz as mesmas cartas.
//                Sem o parâmetro (ou inválido), a partida sorteia uma.
//    ?rapido=1   modo de captura: animações e pausas encurtadas
//                (fatorTempo 0,05). Sem animação ainda, só fica registrado.
//
//  Função pura: recebe a string de busca (`window.location.search`) e
//  devolve um objeto. Não toca no DOM, por isso é testável no Node.
// =====================================================================

export const FATOR_TEMPO_NORMAL = 1;
export const FATOR_TEMPO_RAPIDO = 0.05;

export function lerParametros(search = '') {
  const parametros = new URLSearchParams(search);

  const seedTexto = parametros.get('seed');
  const seed = seedTexto !== null && /^\d{1,10}$/.test(seedTexto)
    ? Number(seedTexto) >>> 0
    : null;

  const rapido = parametros.get('rapido') === '1';
  const efeitos = parametros.get('efeitos') !== '0'; // ?efeitos=0 desliga granulado/scanlines

  return {
    seed,
    rapido,
    efeitos,
    fatorTempo: rapido ? FATOR_TEMPO_RAPIDO : FATOR_TEMPO_NORMAL,
  };
}
