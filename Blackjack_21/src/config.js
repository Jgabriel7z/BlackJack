// =====================================================================
//  config.js — configurações do jogo que o grupo pode querer trocar
//
//  Criado no ajuste do sub-passo 1.1. Nenhum outro arquivo deve ter
//  nome de personagem fixo; todos importam daqui.
// =====================================================================

/** Nomes dos participantes (membros da equipe). */
export const NOMES = Object.freeze({
  jogador: 'João Gabriel',   // quem joga
  oponente: 'Luiz Alberto',  // o homem encapuzado do outro lado da mesa
  anfitriao: 'Kaio',         // a voz na TV; ainda não tem função no motor
});

/**
 * Cartas trunfo — números que a wiki não define, propostos na Parte C7
 * do PDF de referência. Mexa aqui para calibrar.
 */
export const TRUNFOS = Object.freeze({
  chanceAoComprar: 0.30,   // chance de ganhar 1 trunfo a cada carta comprada (HIT)
  maximoNaMao: 8,          // acima disso, o trunfo mais antigo é descartado
  iniciaisPorRodada: 1,    // trunfos recebidos por cada lado no começo da rodada
});
