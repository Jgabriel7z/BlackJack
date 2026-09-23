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
 * Raridade das cartas trunfo. O peso é o quanto a carta pesa no sorteio:
 * uma comum sai oito vezes mais que uma lendária. A porcentagem de cada
 * uma é calculada em cima das cartas que estão liberadas no momento, e
 * aparece na dica quando o cursor passa pela carta.
 */
export const RARIDADES = Object.freeze({
  comum: { peso: 8, nome: 'comum', cor: '#8e857a' },
  incomum: { peso: 4, nome: 'incomum', cor: '#7fa06a' },
  rara: { peso: 2, nome: 'rara', cor: '#6a8fb5' },
  lendaria: { peso: 1, nome: 'lendária', cor: '#c08a3e' },
});

/**
 * Em que gaveta cada carta cai. A régua: quanto mais a carta resolve
 * sozinha, mais rara ela é. As quatro lendárias são as que viram a
 * rodada de uma vez — limpar a mesa e trancar os trunfos do outro,
 * comprar a melhor carta encarecendo a derrota dele, comprar a melhor e
 * ainda encher a mão, e obrigar o adversário a estourar.
 */
export const RARIDADE_DOS_TRUNFOS = Object.freeze({
  // comuns
  card_2: 'comum', card_3: 'comum', card_4: 'comum', card_5: 'comum',
  card_6: 'comum', card_7: 'comum',
  return: 'comum', shield: 'comum', one_up: 'comum', remove: 'comum',
  go_for_17: 'comum',
  // incomuns
  two_up: 'incomum', destroy: 'incomum', perfect_draw: 'incomum',
  go_for_24: 'incomum', exchange: 'incomum', trump_switch: 'incomum',
  // raras
  shield_plus: 'rara', two_up_plus: 'rara', destroy_plus: 'rara',
  harvest: 'rara', go_for_27: 'rara', trump_switch_plus: 'rara',
  // lendárias
  destroy_plus_plus: 'lendaria', perfect_draw_plus: 'lendaria',
  ultimate_draw: 'lendaria', love_your_enemy: 'lendaria',
});

/**
 * Cartas trunfo — números que a wiki não define, propostos na Parte C7
 * do PDF de referência. Mexa aqui para calibrar.
 */
export const TRUNFOS = Object.freeze({
  // Ajustado depois de jogar: a mão estava larga demais e caíam cartas
  // demais, então dava para acumular e resolver tudo no trunfo.
  chanceAoComprar: 0.18,   // chance de ganhar 1 trunfo a cada carta comprada (HIT)
  maximoNaMao: 4,          // acima disso, o trunfo mais antigo é descartado
  iniciaisPorRodada: 1,    // trunfos recebidos por cada lado no começo da rodada
  maximoPorRodada: 3,      // quantos cada lado pode JOGAR na mesma rodada
});
