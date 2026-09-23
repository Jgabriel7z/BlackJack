// Testes da tabela das cinco melhores pontuações (sub-passo 3.4).
// Só dados: nenhum navegador, nenhum armazenamento.

import { teste, assert, assertIgual } from './testador.js';
import {
  criarPlacar,
  posicaoNoPlacar,
  entraNoPlacar,
  registrar,
  normalizarIniciais,
  criarEntradaDeIniciais,
  teclarIniciais,
  textoDasIniciais,
  TAMANHO_DO_PLACAR,
} from '../src/engine/placar.js';

/** Atalho: monta um placar já com estas pontuações, de cima para baixo. */
function placarCom(...pontuacoes) {
  const placar = criarPlacar();
  pontuacoes.forEach((p, i) => registrar(placar, `A${i}`, p));
  return placar;
}

const pontos = (placar) => placar.entradas.map((e) => e.pontos);
const iniciais = (placar) => placar.entradas.map((e) => e.iniciais);

// ---------------------------------------------------------------------
//  Quem entra na lista
// ---------------------------------------------------------------------

teste('placar: começa vazio e cabem cinco', () => {
  const placar = criarPlacar();
  assertIgual(placar.entradas, []);
  assertIgual(placar.tamanho, TAMANHO_DO_PLACAR);
});

teste('placar: com a lista incompleta, qualquer pontuação entra', () => {
  const placar = placarCom(900, 400);
  assert(entraNoPlacar(placar, 1));
  assertIgual(posicaoNoPlacar(placar, 1), 2);
});

teste('placar: pontuação zero (ou negativa) não entra', () => {
  const placar = criarPlacar();
  assertIgual(posicaoNoPlacar(placar, 0), -1);
  assertIgual(posicaoNoPlacar(placar, -50), -1);
  assertIgual(registrar(placar, 'JOA', 0).linha, -1);
  assertIgual(placar.entradas, []);
});

teste('placar: a lista fica sempre em ordem decrescente', () => {
  const placar = criarPlacar();
  for (const p of [300, 900, 100, 700, 500]) registrar(placar, 'XYZ', p);
  assertIgual(pontos(placar), [900, 700, 500, 300, 100]);
});

teste('placar: com a lista cheia, só entra quem passa do último', () => {
  const placar = placarCom(900, 800, 700, 600, 500);
  assert(!entraNoPlacar(placar, 500), 'empatar com o último não entra');
  assert(!entraNoPlacar(placar, 499));
  assert(entraNoPlacar(placar, 501));
});

teste('placar: entrar na lista cheia empurra o último para fora', () => {
  const placar = placarCom(900, 800, 700, 600, 500);
  const { linha } = registrar(placar, 'NOV', 750);
  assertIgual(linha, 2);
  assertIgual(pontos(placar), [900, 800, 750, 700, 600]);
  assertIgual(placar.entradas.length, TAMANHO_DO_PLACAR);
});

teste('placar: quem chegou antes fica na frente no empate', () => {
  const placar = criarPlacar();
  registrar(placar, 'PRI', 400);
  registrar(placar, 'SEG', 400);
  assertIgual(iniciais(placar), ['PRI', 'SEG']);
});

teste('placar: guarda até onde a partida chegou e se o jogador saiu inteiro', () => {
  const placar = criarPlacar();
  const { entrada } = registrar(placar, 'JOA', 1200, { nivel: 3, venceu: true });
  assertIgual(entrada, { iniciais: 'JOA', pontos: 1200, nivel: 3, venceu: true });
  const outra = registrar(placar, 'LUI', 300).entrada;
  assertIgual(outra.nivel, 1, 'sem informação, assume o primeiro nível');
  assertIgual(outra.venceu, false);
});

// ---------------------------------------------------------------------
//  As três letras
// ---------------------------------------------------------------------

teste('placar: as iniciais são sempre três letras de A a Z', () => {
  assertIgual(normalizarIniciais('joa'), 'JOA');
  assertIgual(normalizarIniciais('J'), 'JAA', 'o que falta vira A');
  assertIgual(normalizarIniciais(''), 'AAA');
  assertIgual(normalizarIniciais('João Gabriel'), 'JOO', 'acento e espaço somem, sobram as letras');
  assertIgual(normalizarIniciais('ABCDEF'), 'ABC');
});

teste('placar: digitar letras preenche as casas e anda o cursor', () => {
  const entrada = criarEntradaDeIniciais();
  for (const tecla of ['j', 'o', 'a']) teclarIniciais(entrada, tecla);
  assertIgual(textoDasIniciais(entrada), 'JOA');
  assertIgual(entrada.cursor, 2, 'na última casa o cursor não passa do fim');
});

teste('placar: digitar na última casa troca a letra, não estoura', () => {
  const entrada = criarEntradaDeIniciais();
  for (const tecla of ['a', 'b', 'c', 'd', 'e']) teclarIniciais(entrada, tecla);
  assertIgual(textoDasIniciais(entrada), 'ABE');
});

teste('placar: as setas trocam a letra e dão a volta no alfabeto', () => {
  const entrada = criarEntradaDeIniciais();
  teclarIniciais(entrada, 'ArrowDown');
  assertIgual(entrada.letras[0], 'Z', 'descer do A dá a volta');
  teclarIniciais(entrada, 'ArrowUp');
  assertIgual(entrada.letras[0], 'A');
});

teste('placar: as setas laterais andam entre as casas, sem sair', () => {
  const entrada = criarEntradaDeIniciais();
  teclarIniciais(entrada, 'ArrowLeft');
  assertIgual(entrada.cursor, 0, 'não anda para antes da primeira');
  for (let i = 0; i < 5; i++) teclarIniciais(entrada, 'ArrowRight');
  assertIgual(entrada.cursor, 2, 'nem para depois da última');
});

teste('placar: Backspace volta uma casa e apaga', () => {
  const entrada = criarEntradaDeIniciais();
  teclarIniciais(entrada, 'j');
  teclarIniciais(entrada, 'o');
  teclarIniciais(entrada, 'Backspace');
  assertIgual(textoDasIniciais(entrada), 'JAA');
  assertIgual(entrada.cursor, 1);
});

teste('placar: Enter confirma, e depois nada mais muda', () => {
  const entrada = criarEntradaDeIniciais();
  teclarIniciais(entrada, 'k');
  assertIgual(teclarIniciais(entrada, 'Enter'), { mudou: false, confirmou: true });
  assert(entrada.confirmada);
  assertIgual(teclarIniciais(entrada, 'z'), { mudou: false, confirmou: false });
  assertIgual(textoDasIniciais(entrada), 'KAA');
});

teste('placar: tecla que não interessa é ignorada', () => {
  const entrada = criarEntradaDeIniciais('LUI');
  for (const tecla of ['Shift', 'F5', '7', ' ', 'Tab', null]) {
    assertIgual(teclarIniciais(entrada, tecla), { mudou: false, confirmou: false });
  }
  assertIgual(textoDasIniciais(entrada), 'LUI');
});

teste('placar: dá para começar com as iniciais da partida anterior', () => {
  const entrada = criarEntradaDeIniciais('joa');
  assertIgual(textoDasIniciais(entrada), 'JOA');
  assertIgual(entrada.cursor, 0, 'o cursor começa na primeira casa');
});
