// =====================================================================
//  anfitriao.js — quando o Kaio abre a boca  (ajuste depois de jogar)
//
//  Ele já falava na troca de nível, na vitória e na trapaça. Faltava o
//  que dá liga: comentar a rodada enquanto ela acontece, como o Lucas do
//  material original — que não narra o jogo, ele tira sarro de quem está
//  jogando.
//
//  Este arquivo não guarda fala nenhuma: as falas moram no `config.js`,
//  junto com os nomes. Aqui fica só a decisão de QUANDO e QUAL, e ela é
//  pura, com o gerador de seed vindo de fora — então a mesma partida dá
//  sempre os mesmos comentários.
//
//  Duas regras para ele não virar barulho de fundo:
//    1. no máximo um comentário por rodada;
//    2. uma fala não se repete enquanto houver outra daquela situação
//       que ainda não foi usada.
// =====================================================================

import { FALAS_DO_ANFITRIAO } from '../config.js';

/** Chance de ele comentar quando a situação permite. */
export const CHANCE_DE_COMENTAR = 0.72;

/**
 * As situações em ordem de interesse: se a rodada se encaixa em mais de
 * uma, ele fala da primeira que aparecer aqui. Estourar é mais engraçado
 * do que ganhar, e estar quase morto é mais engraçado do que tudo.
 */
export const SITUACOES_POR_INTERESSE = Object.freeze([
  'jogadorQuaseMorto',
  'jogadorEstourou',
  'oponenteEstourou',
  'empate',
  'alvoExato',
  'oponenteQuaseMorto',
  'apostaAlta',
  'jogadorPerdeuRodada',
  'jogadorVenceuRodada',
]);

export function criarAnfitriao(aleatorio) {
  return {
    _aleatorio: aleatorio,
    ditas: new Set(),       // falas já usadas nesta partida
    ultimaRodada: -1,       // em que rodada ele falou pela última vez
  };
}

/** A primeira situação da lista que a rodada satisfaz, ou null. */
export function escolherSituacao(situacoes) {
  const presentes = new Set(situacoes);
  return SITUACOES_POR_INTERESSE.find((s) => presentes.has(s)) ?? null;
}

/**
 * Devolve uma fala para `situacao`, ou null se ele resolver ficar
 * calado. `rodada` serve para o limite de uma fala por rodada.
 */
export function comentar(anfitriao, situacao, rodada = 0) {
  if (!situacao) return null;
  if (rodada === anfitriao.ultimaRodada) return null;   // já falou nesta rodada

  const banco = FALAS_DO_ANFITRIAO[situacao];
  if (!banco || banco.length === 0) return null;
  if (anfitriao._aleatorio() > CHANCE_DE_COMENTAR) return null;

  // Prefere o que ele ainda não disse; se já disse tudo, libera o banco
  // daquela situação de novo.
  let novas = banco.filter((fala) => !anfitriao.ditas.has(fala));
  if (novas.length === 0) {
    for (const fala of banco) anfitriao.ditas.delete(fala);
    novas = [...banco];
  }

  const escolhida = novas[Math.floor(anfitriao._aleatorio() * novas.length)];
  anfitriao.ditas.add(escolhida);
  anfitriao.ultimaRodada = rodada;
  return escolhida;
}

/**
 * Atalho para quem tem a lista de situações da rodada em mãos: escolhe a
 * mais interessante e tenta comentar.
 */
export function comentarSobre(anfitriao, situacoes, rodada = 0) {
  return comentar(anfitriao, escolherSituacao(situacoes), rodada);
}
