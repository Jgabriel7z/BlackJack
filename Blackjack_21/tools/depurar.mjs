// Ferramenta de apoio: abre o jogo, joga sozinho com a regra da IA e
// imprime cada mudança de estado, além de erros de console. Serve para
// achar travamentos que a captura só mostra como "esperei demais".
//
//   node tools/depurar.mjs [seed] [nivel] [passos]

import { chromium } from 'playwright';
import { iniciarServidor } from './servidor.mjs';

const seed = process.argv[2] ?? '21';
const nivel = process.argv[3] ?? '1';
const passos = Number(process.argv[4] ?? 300);

const servidor = await iniciarServidor(0);
const navegador = await chromium.launch({ channel: 'chrome', headless: true });
const contexto = await navegador.newContext({ viewport: { width: 1280, height: 720 } });
const pagina = await contexto.newPage();

pagina.on('pageerror', (e) => console.log('EXCEÇÃO NA PÁGINA:', e.message, '\n', e.stack?.split('\n').slice(0, 4).join('\n')));
pagina.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE.ERROR:', m.text()); });

await pagina.goto(`${servidor.url}/index.html?seed=${seed}&nivel=${nivel}`, { waitUntil: 'load' });
await pagina.waitForSelector('body[data-pronto="1"]', { timeout: 10_000 });

const ler = () => pagina.evaluate(() => ({ ...document.body.dataset }));
let anterior = '';
let travadoDesde = 0;

for (let i = 0; i < passos; i++) {
  const d = await ler();
  const chave = `${d.nivel}|${d.fase}|${d.animacao}`;
  if (chave !== anterior) {
    console.log(`[${String(i).padStart(3)}] nível ${d.nivel} · ${d.fase} · ${d.animacao} · dedos ${d.meusDedos}x${d.dedosDele} · meu total ${d.meuTotal}`);
    anterior = chave;
    travadoDesde = i;
  } else if (i - travadoDesde === 40) {
    console.log(`     ... parado em "${chave}" há 40 leituras`);
  }

  if (d.animacao === 'ocioso') {
    if (d.fase === 'fim_de_jogo') { console.log('fim de jogo'); break; }
    if (d.fase === 'rodada_encerrada') { await pagina.locator('#botao-proxima').click(); continue; }
    if (d.fase === 'jogando') {
      if (Number(d.meuTotal) < 17) await pagina.locator('#botao-hit').click();
      else await pagina.locator('#botao-stay').click();
      continue;
    }
  }
  await pagina.waitForTimeout(150);
}

console.log('estado final:', JSON.stringify(await ler()));
await navegador.close();
await servidor.fechar();
