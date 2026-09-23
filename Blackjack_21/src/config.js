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
 * Quanto tempo cada tela fica no ar sozinha, em milissegundos, seguindo
 * o laço de fliperama do plano:
 *   título --15s--> attract --20s--> melhores pontuações --8s--> título
 * A tela de fim de jogo volta ao título depois de 5 s. Qualquer tecla ou
 * clique corta a espera. O `?rapido=1` encurta tudo isso junto.
 *
 * A de digitar as iniciais (3.4) é a exceção: são 20 s para escrever as
 * três letras, e esse tempo NÃO é encurtado pelo `?rapido=1`, senão nem
 * dava para digitar numa captura acelerada.
 */
export const TEMPOS_DE_TELA = Object.freeze({
  titulo: 15000,
  attract: 20000,
  highScores: 8000,
  gameOver: 5000,
  iniciais: 20000,
});

/** Quem assina o trabalho; aparece no rodapé da tela de título. */
export const EQUIPE = Object.freeze([NOMES.jogador, NOMES.oponente, NOMES.anfitriao]);

/**
 * O que o anfitrião diz na televisão quando o jogador vence o último
 * nível. No 21 original o mestre do jogo não solta a vítima: ele se
 * interessa e propõe outra coisa. (3.3)
 */
export const FALA_DA_VITORIA = Object.freeze([
  'Você ganhou. Eu não esperava, e faz muito tempo que não me surpreendo.',
  'Descanse essa mão. Amanhã eu trago outro jogo, e ele é melhor.',
]);

/**
 * O que o anfitrião grita quando trapaceia, no nível 3, com a serra a
 * uma derrota de encostar no Luiz Alberto (4.8).
 */
export const FALA_DA_TRAPACA = Object.freeze([
  'NÃO. Não assim. Não hoje.',
  'Eu decido quando esta mesa acaba — e não é agora.',
]);

/** A tela de título: o tubo acendendo e o convite piscando (3.2). */
export const TITULO = Object.freeze({
  ligarTv: 2600,        // quanto dura a televisão acendendo
  piscaConvite: 1100,   // meio ciclo do "pressione qualquer tecla"
  subtitulo: 'um jogo que decide se você vive ou não',
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
