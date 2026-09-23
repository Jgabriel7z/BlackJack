// =====================================================================
//  tools/capturar.mjs — abre o jogo sozinho, tira prints e grava vídeo
//
//  Uso:
//      node tools/capturar.mjs 1.3              # roda o roteiro do sub-passo 1.3
//      node tools/capturar.mjs 1.3 --sem-video  # só prints
//
//  O que faz:
//    1. Sobe o servidor estático (tools/servidor.mjs) numa porta livre.
//    2. Abre um navegador com Playwright. Tenta o Chrome instalado na
//       máquina (channel "chrome"); se não houver, usa o Chromium do
//       Playwright (precisa de `npx playwright install chromium`).
//    3. Executa o roteiro em tools/roteiros/<sub-passo>.mjs, que decide
//       o que abrir, onde clicar e quando tirar print.
//    4. Salva tudo em ../progresso/etapa-N/<sub-passo>/:
//         01-nome.png, 02-nome.png, ...   prints numerados na ordem
//         video.webm (ou video.mp4 se houver ffmpeg)
//         captura.txt                     resumo da captura
//    5. FALHA (exit 1) se o roteiro lançar erro ou se o navegador
//       registrar qualquer erro: console.error, exceção não tratada,
//       requisição que falhou ou resposta HTTP >= 400.
//
//  Como escrever um roteiro: ver tools/roteiros/1.1.mjs.
// =====================================================================

import path from 'node:path';
import os from 'node:os';
import { promises as fs } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { iniciarServidor, RAIZ_JOGO } from './servidor.mjs';

const PASTA_TOOLS = path.dirname(fileURLToPath(import.meta.url));
const RAIZ_PROJETO = path.resolve(RAIZ_JOGO, '..'); // pasta com progresso/
const VIEWPORT_PADRAO = { width: 1280, height: 720 };

// ---------------------------------------------------------------------
//  Argumentos
// ---------------------------------------------------------------------

const argumentos = process.argv.slice(2);
const subPasso = argumentos.find((a) => !a.startsWith('--'));
const semVideo = argumentos.includes('--sem-video');

// Aceita "1.3" (sub-passo) ou "1.final" (captura especial da etapa).
if (!subPasso || !/^\d+\.(\d+|[a-z][a-z0-9-]*)$/.test(subPasso)) {
  console.error('Uso: node tools/capturar.mjs <sub-passo> [--sem-video]');
  console.error('Exemplos: node tools/capturar.mjs 1.3   |   node tools/capturar.mjs 1.final');
  console.error(`Roteiros disponíveis: ${await listarRoteiros()}`);
  process.exit(2);
}

const [etapa, sufixo] = subPasso.split('.');
// "1.3" vai para progresso/etapa-1/1.3/ ; "1.final" vai para progresso/etapa-1/final/
const nomePasta = /^\d+$/.test(sufixo) ? subPasso : sufixo;
const pastaDestino = path.join(RAIZ_PROJETO, 'progresso', `etapa-${etapa}`, nomePasta);
const arquivoRoteiro = path.join(PASTA_TOOLS, 'roteiros', `${subPasso}.mjs`);

async function listarRoteiros() {
  try {
    const nomes = await fs.readdir(path.join(PASTA_TOOLS, 'roteiros'));
    return nomes.filter((n) => n.endsWith('.mjs')).map((n) => n.replace('.mjs', '')).join(', ') || '(nenhum)';
  } catch {
    return '(nenhum)';
  }
}

// ---------------------------------------------------------------------
//  Carrega o roteiro
// ---------------------------------------------------------------------

let roteiro;
try {
  roteiro = (await import(pathToFileURL(arquivoRoteiro).href)).default;
} catch (erro) {
  if (erro.code === 'ERR_MODULE_NOT_FOUND') {
    console.error(`Não existe roteiro para o sub-passo ${subPasso}: ${arquivoRoteiro}`);
    console.error(`Roteiros disponíveis: ${await listarRoteiros()}`);
    process.exit(2);
  }
  throw erro;
}
if (typeof roteiro?.executar !== 'function') {
  console.error(`O roteiro ${subPasso} precisa exportar default { executar(ctx) }.`);
  process.exit(2);
}

const gravarVideo = !semVideo && roteiro.video !== false;
const viewport = roteiro.viewport ?? VIEWPORT_PADRAO;

// ---------------------------------------------------------------------
//  Prepara a pasta de destino (apaga prints/vídeos de execuções antigas)
// ---------------------------------------------------------------------

await fs.mkdir(pastaDestino, { recursive: true });
for (const nome of await fs.readdir(pastaDestino)) {
  const ehPrint = /\.png$/i.test(nome);
  const ehVideo = /\.(webm|mp4)$/i.test(nome);
  // Com --sem-video o vídeo da captura anterior é preservado.
  if (ehPrint || (ehVideo && gravarVideo) || nome === 'captura.txt') {
    await fs.unlink(path.join(pastaDestino, nome));
  }
}

// ---------------------------------------------------------------------
//  Navegador
// ---------------------------------------------------------------------

async function abrirNavegador() {
  try {
    const nav = await chromium.launch({ channel: 'chrome', headless: true });
    return { nav, nome: 'Chrome instalado na máquina' };
  } catch {
    try {
      const nav = await chromium.launch({ headless: true });
      return { nav, nome: 'Chromium do Playwright' };
    } catch (erro) {
      console.error('Não consegui abrir nem o Chrome nem o Chromium do Playwright.');
      console.error('Instale o Chromium com:  npx playwright install chromium');
      console.error(erro.message);
      process.exit(1);
    }
  }
}

// ---------------------------------------------------------------------
//  Execução
// ---------------------------------------------------------------------

const inicio = new Date();
const log = [];
const registrar = (linha) => { console.log(linha); log.push(linha); };

registrar(`Captura do sub-passo ${subPasso} — ${roteiro.descricao ?? ''}`);
registrar(`Destino: ${pastaDestino}`);

const servidor = await iniciarServidor(0);
registrar(`Servidor: ${servidor.url}`);

const { nav: navegador, nome: nomeNavegador } = await abrirNavegador();
registrar(`Navegador: ${nomeNavegador}`);

const pastaVideoTemp = gravarVideo
  ? await fs.mkdtemp(path.join(os.tmpdir(), 'captura-21-'))
  : null;

const contexto = await navegador.newContext({
  viewport,
  deviceScaleFactor: 1,
  locale: 'pt-BR',
  recordVideo: gravarVideo ? { dir: pastaVideoTemp, size: viewport } : undefined,
});

let pagina;
try {
  pagina = await contexto.newPage();
} catch (erro) {
  if (gravarVideo && /ffmpeg/i.test(erro.message)) {
    console.error('Para gravar vídeo o Playwright precisa do próprio ffmpeg (download pequeno, uma vez só):');
    console.error('    npx playwright install ffmpeg');
    console.error('Ou rode com --sem-video para só tirar prints.');
    await navegador.close();
    await servidor.fechar();
    process.exit(1);
  }
  throw erro;
}

// Qualquer erro do navegador derruba a captura.
const errosNavegador = [];
pagina.on('console', (msg) => {
  if (msg.type() !== 'error') return;
  const origem = msg.location()?.url ? ` [${msg.location().url}]` : '';
  errosNavegador.push(`console.error: ${msg.text()}${origem}`);
});
pagina.on('pageerror', (erro) => errosNavegador.push(`exceção na página: ${erro.message}`));
pagina.on('requestfailed', (req) => {
  errosNavegador.push(`requisição falhou: ${req.url()} (${req.failure()?.errorText ?? '?'})`);
});
pagina.on('response', (res) => {
  if (res.status() >= 400) errosNavegador.push(`HTTP ${res.status()}: ${res.url()}`);
});

const prints = [];
let contadorPrints = 0;

/** O que o roteiro recebe. */
const ctx = {
  pagina,
  urlBase: servidor.url,
  viewport,

  /** Abre um caminho do jogo, com parâmetros de URL opcionais (ex.: { seed: 123, rapido: 1 }). */
  async abrir(caminho, parametros = {}) {
    const url = new URL(caminho, servidor.url);
    for (const [chave, valor] of Object.entries(parametros)) {
      url.searchParams.set(chave, String(valor));
    }
    registrar(`abrir ${url.pathname}${url.search}`);
    await pagina.goto(url.href, { waitUntil: 'load' });
  },

  /** Tira um print numerado. `opcoes.paginaInteira` captura além da janela. */
  async print(nome, opcoes = {}) {
    contadorPrints += 1;
    const arquivo = path.join(pastaDestino, `${String(contadorPrints).padStart(2, '0')}-${nome}.png`);
    await pagina.screenshot({ path: arquivo, fullPage: opcoes.paginaInteira ?? false });
    prints.push(arquivo);
    registrar(`print  ${path.basename(arquivo)}`);
    return arquivo;
  },

  /** Espera `ms` milissegundos (para animações terminarem). */
  esperar: (ms) => pagina.waitForTimeout(ms),

  /** Anota uma linha no captura.txt. */
  anotar: (texto) => registrar(`nota   ${texto}`),

  /** Interrompe a captura com erro. */
  falhar(mensagem) {
    throw new Error(mensagem);
  },
};

let erroRoteiro = null;
try {
  await roteiro.executar(ctx);
} catch (erro) {
  erroRoteiro = erro;
  // Print de emergência para ver onde parou.
  try {
    await ctx.print('ERRO');
  } catch { /* ignora */ }
}

// ---------------------------------------------------------------------
//  Fecha e salva o vídeo
// ---------------------------------------------------------------------

const video = gravarVideo ? pagina.video() : null;
await contexto.close(); // só aqui o vídeo é finalizado
await navegador.close();
await servidor.fechar();

let arquivoVideo = null;
if (video) {
  const origem = await video.path();
  const destinoWebm = path.join(pastaDestino, 'video.webm');
  await fs.copyFile(origem, destinoWebm);
  await fs.rm(pastaVideoTemp, { recursive: true, force: true });
  arquivoVideo = destinoWebm;

  const destinoMp4 = path.join(pastaDestino, 'video.mp4');
  const ffmpeg = spawnSync('ffmpeg', [
    '-y', '-loglevel', 'error', '-i', destinoWebm,
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
    destinoMp4,
  ], { encoding: 'utf-8' });

  if (ffmpeg.error?.code === 'ENOENT') {
    registrar('vídeo  video.webm (ffmpeg não encontrado; sem conversão para mp4. O .webm abre no Chrome ou no VLC)');
  } else if (ffmpeg.status !== 0) {
    registrar(`vídeo  video.webm (ffmpeg falhou na conversão: ${ffmpeg.stderr?.trim()})`);
  } else {
    await fs.unlink(destinoWebm);
    arquivoVideo = destinoMp4;
    registrar('vídeo  video.mp4 (convertido com ffmpeg)');
  }
}

// ---------------------------------------------------------------------
//  Resumo
// ---------------------------------------------------------------------

const fim = new Date();
const resumo = [
  `Sub-passo: ${subPasso}`,
  `Roteiro: ${roteiro.descricao ?? ''}`,
  `Data: ${inicio.toISOString()}`,
  `Duração: ${((fim - inicio) / 1000).toFixed(1)} s`,
  `Navegador: ${nomeNavegador}`,
  `Viewport: ${viewport.width}x${viewport.height}`,
  `Prints: ${prints.length}`,
  ...prints.map((p) => `  - ${path.basename(p)}`),
  `Vídeo: ${arquivoVideo ? path.basename(arquivoVideo) : '(não gravado)'}`,
  `Erros do navegador: ${errosNavegador.length}`,
  ...errosNavegador.map((e) => `  - ${e}`),
  `Erro do roteiro: ${erroRoteiro ? erroRoteiro.message : 'nenhum'}`,
  '',
  'Log:',
  ...log,
].join('\n');

await fs.writeFile(path.join(pastaDestino, 'captura.txt'), resumo + '\n', 'utf-8');

console.log('');
if (erroRoteiro || errosNavegador.length > 0) {
  console.error('CAPTURA FALHOU');
  if (erroRoteiro) console.error(`  roteiro: ${erroRoteiro.message}`);
  for (const e of errosNavegador) console.error(`  navegador: ${e}`);
  console.error(`Arquivos parciais em: ${pastaDestino}`);
  process.exit(1);
}

console.log(`Captura concluída: ${prints.length} print(s)${arquivoVideo ? ' + vídeo' : ''} em`);
console.log(`  ${pastaDestino}`);
