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

  // ?trunfos=two_up,shield,go_for_24 -> mão inicial fixa (para testes e captura).
  const trunfosTexto = parametros.get('trunfos');
  const trunfos = trunfosTexto
    ? trunfosTexto.split(',').map((t) => t.trim()).filter((t) => /^[a-z0-9_]+$/.test(t))
    : null;

  // ?nivel=2 começa direto no aparelho de choque; ?nivel=3 na serra.
  const nivelTexto = parametros.get('nivel');
  const nivel = /^[123]$/.test(nivelTexto ?? '') ? Number(nivelTexto) : null;

  // ?tela=jogando pula a abertura e cai direto na mesa. Os roteiros de
  // captura das Etapas 1 e 2 usam isso; o jogo normal começa no título.
  const telaTexto = parametros.get('tela');
  const tela = /^[a-z_]+$/.test(telaTexto ?? '') ? telaTexto : null;

  return {
    seed,
    rapido,
    efeitos,
    nivel,
    tela,
    trunfos: trunfos && trunfos.length > 0 ? trunfos : null,
    fatorTempo: rapido ? FATOR_TEMPO_RAPIDO : FATOR_TEMPO_NORMAL,
  };
}
