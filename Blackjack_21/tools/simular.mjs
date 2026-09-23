// =====================================================================
//  tools/simular.mjs — simula partidas com a IA jogando dos dois lados
//
//  Uso:  node tools/simular.mjs [quantidade de seeds] [seed inicial]
//
//  Para cada seed, joga uma partida inteira com `decidirAcao` decidindo
//  pelo jogador e pelo oponente (a mesma regra que o roteiro de captura
//  usa para clicar HIT/STAY). Imprime um resumo por desfecho e as seeds
//  das partidas mais curtas em que o João Gabriel vence e em que perde,
//  para os roteiros de captura usarem.
// =====================================================================

import { criarJogo, iniciarRodada, hit, stay, FASE, LADO } from '../src/engine/game.js';
import { decidirAcao, ACAO } from '../src/engine/ai.js';

const quantidade = Number(process.argv[2] ?? 500);
const seedInicial = Number(process.argv[3] ?? 1);

function simular(seed) {
  const jogo = criarJogo({ seed });
  let acoes = 0;
  while (jogo.fase !== FASE.FIM_DE_JOGO) {
    iniciarRodada(jogo);
    while (jogo.fase === FASE.JOGANDO) {
      const lado = jogo.turno;
      if (decidirAcao(jogo, lado) === ACAO.HIT) hit(jogo, lado);
      else stay(jogo, lado);
      if (++acoes > 5000) throw new Error(`seed ${seed} travou`);
    }
  }
  return {
    seed,
    vencedor: jogo.vencedorDoJogo,
    rodadas: jogo.rodada,
    dedos: { jogador: jogo.jogadores[LADO.JOGADOR].dedos, oponente: jogo.jogadores[LADO.OPONENTE].dedos },
    acoes,
  };
}

const resultados = [];
for (let s = seedInicial; s < seedInicial + quantidade; s++) resultados.push(simular(s));

const porDesfecho = { jogador: [], oponente: [], ninguem: [] };
for (const r of resultados) porDesfecho[r.vencedor].push(r);

console.log(`Simuladas ${resultados.length} partidas (seeds ${seedInicial}..${seedInicial + quantidade - 1}), IA x IA.\n`);
for (const [desfecho, lista] of Object.entries(porDesfecho)) {
  const media = lista.length ? (lista.reduce((s, r) => s + r.rodadas, 0) / lista.length).toFixed(1) : '-';
  console.log(`${desfecho.padEnd(9)} ${String(lista.length).padStart(4)} partidas   média de ${media} rodadas`);
}

const maisCurtas = (lista) => [...lista].sort((a, b) => a.rodadas - b.rodadas || a.acoes - b.acoes).slice(0, 5);
console.log('\nPartidas mais curtas em que João Gabriel VENCE:');
for (const r of maisCurtas(porDesfecho.jogador)) console.log(`  seed ${r.seed}: ${r.rodadas} rodadas, ${r.acoes} ações, dedos ${r.dedos.jogador}x${r.dedos.oponente}`);
console.log('Partidas mais curtas em que João Gabriel PERDE:');
for (const r of maisCurtas(porDesfecho.oponente)) console.log(`  seed ${r.seed}: ${r.rodadas} rodadas, ${r.acoes} ações, dedos ${r.dedos.jogador}x${r.dedos.oponente}`);
if (porDesfecho.ninguem.length) {
  console.log('Partidas em que os dois zeram:');
  for (const r of maisCurtas(porDesfecho.ninguem)) console.log(`  seed ${r.seed}: ${r.rodadas} rodadas`);
}
