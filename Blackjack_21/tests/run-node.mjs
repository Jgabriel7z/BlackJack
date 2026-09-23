// Roda os mesmos testes de tests.html no terminal:  node tests/run-node.mjs
import './engine.test.js';
import './ai.test.js';
import './parametros.test.js';
import './animacao.test.js';
import './score.test.js';
import './trumps.test.js';
import './niveis.test.js';
import './telas.test.js';
import './placar.test.js';
import { rodarTodos } from './testador.js';

const resultados = rodarTodos();
let falhas = 0;

for (const r of resultados) {
  if (r.ok) {
    console.log(`  ok   ${r.nome}`);
  } else {
    falhas++;
    console.log(`  FALHA ${r.nome}`);
    console.log(`        ${r.erro}`);
  }
}

console.log(`\n${resultados.length - falhas}/${resultados.length} testes passaram.`);
process.exit(falhas === 0 ? 0 : 1);
