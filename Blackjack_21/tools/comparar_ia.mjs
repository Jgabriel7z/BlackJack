// =====================================================================
//  tools/comparar_ia.mjs — a IA do nível 3 é mesmo mais difícil?
//
//  Uso:  node tools/comparar_ia.mjs [rodadas]
//
//  Joga a MESMA rodada duas vezes, com o mesmo baralho: uma com o
//  oponente pensando como no nível 1 (conta até 17) e outra como no
//  nível 3 (compara riscos). Do outro lado da mesa fica sempre a regra
//  do nível 1, para o que mudar ser só a cabeça do oponente.
//
//  Sem cartas trunfo de propósito: assim os números medem a decisão de
//  comprar ou parar, e não a sorte das cartas especiais.
// =====================================================================

import { criarJogo, iniciarRodada, hit, stay, FASE, LADO } from '../src/engine/game.js';
import { decidirAcao, ACAO } from '../src/engine/ai.js';

const rodadas = Number(process.argv[2] ?? 1000);

/** Joga uma rodada com o oponente pensando no nível `nivelDoOponente`. */
function jogarUmaRodada(seed, nivelDoOponente) {
  const jogo = criarJogo({ seed });
  iniciarRodada(jogo);
  while (jogo.fase === FASE.JOGANDO) {
    const lado = jogo.turno;
    const nivel = lado === LADO.OPONENTE ? nivelDoOponente : 1;
    if (decidirAcao(jogo, lado, nivel) === ACAO.HIT) hit(jogo, lado);
    else stay(jogo, lado);
  }
  const r = jogo.ultimaRodada;
  return {
    venceu: r.vencedor === LADO.OPONENTE,
    empatou: r.vencedor === 'empate',
    estourou: r.estourou.oponente,
    total: r.totais.oponente,
  };
}

function medir(nivel) {
  let vitorias = 0;
  let empates = 0;
  let estouros = 0;
  let somaDosTotais = 0;
  for (let seed = 1; seed <= rodadas; seed++) {
    const r = jogarUmaRodada(seed, nivel);
    if (r.venceu) vitorias++;
    if (r.empatou) empates++;
    if (r.estourou) estouros++;
    somaDosTotais += r.total;
  }
  return {
    nivel,
    vitorias,
    empates,
    estouros,
    taxaDeVitoria: (vitorias / rodadas) * 100,
    taxaDeEstouro: (estouros / rodadas) * 100,
    totalMedio: somaDosTotais / rodadas,
  };
}

const facil = medir(1);
const dificil = medir(3);

const linha = (r) => [
  `  nível ${r.nivel}`.padEnd(10),
  `vitórias ${String(r.vitorias).padStart(4)} (${r.taxaDeVitoria.toFixed(1).padStart(5)}%)`,
  `estouros ${String(r.estouros).padStart(4)} (${r.taxaDeEstouro.toFixed(1).padStart(5)}%)`,
  `empates ${String(r.empates).padStart(3)}`,
  `total médio ${r.totalMedio.toFixed(1)}`,
].join('   ');

console.log(`${rodadas} rodadas com o mesmo baralho, só a cabeça do oponente muda:\n`);
console.log(linha(facil));
console.log(linha(dificil));
console.log('\ndiferença do nível 3 para o nível 1:');
console.log(`  vitórias: ${(dificil.taxaDeVitoria - facil.taxaDeVitoria >= 0 ? '+' : '')}${(dificil.taxaDeVitoria - facil.taxaDeVitoria).toFixed(1)} pontos percentuais`);
console.log(`  estouros: ${(dificil.taxaDeEstouro - facil.taxaDeEstouro >= 0 ? '+' : '')}${(dificil.taxaDeEstouro - facil.taxaDeEstouro).toFixed(1)} pontos percentuais`);
