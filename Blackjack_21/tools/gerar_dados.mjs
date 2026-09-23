// =====================================================================
//  tools/gerar_dados.mjs — converte ../trump_cards.json em data/trump_cards.js
//
//  Por que: os testes e o jogo rodam como módulos ES tanto no Node quanto
//  no browser, e `import` de JSON não é uniforme entre os dois. Um módulo
//  JS com `export default` funciona nos dois sem servidor especial.
//  O JSON da raiz continua sendo a fonte da verdade; rode este script
//  sempre que ele mudar:   node tools/gerar_dados.mjs
// =====================================================================

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ_JOGO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ORIGEM = path.join(RAIZ_JOGO, '..', 'trump_cards.json');
const DESTINO = path.join(RAIZ_JOGO, 'data', 'trump_cards.js');

const json = JSON.parse(await fs.readFile(ORIGEM, 'utf-8'));
const conteudo = [
  '// GERADO por tools/gerar_dados.mjs a partir de ../trump_cards.json — não editar à mão.',
  '// Catálogo completo de cartas trunfo (jogador e inimigos). O motor recebe este',
  '// objeto pronto; ele nunca carrega o arquivo sozinho.',
  '',
  `export default ${JSON.stringify(json, null, 2)};`,
  '',
].join('\n');

await fs.mkdir(path.dirname(DESTINO), { recursive: true });
await fs.writeFile(DESTINO, conteudo, 'utf-8');
console.log(`gerado: ${DESTINO} (${json.player_cards.length} cartas do jogador, ${json.enemy_cards.length} inimigas)`);
