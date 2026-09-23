// =====================================================================
//  tools/servidor.mjs — servidor estático mínimo para a pasta do jogo
//
//  Por que existe: o Chrome bloqueia módulos ES (`import`) em páginas
//  abertas por file://. Este servidor entrega os arquivos por http://
//  sem nenhuma dependência.
//
//  Uso direto (para jogar ou abrir os testes na mão):
//      node tools/servidor.mjs            -> http://127.0.0.1:8080
//      node tools/servidor.mjs 3000       -> outra porta
//
//  Uso pelo capturar.mjs: importa `iniciarServidor(0)` (porta livre
//  aleatória) e fecha ao terminar.
// =====================================================================

import http from 'node:http';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

/** Pasta Blackjack_21/ (um nível acima de tools/). */
export const RAIZ_JOGO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webm': 'video/webm',
  '.mp4': 'video/mp4',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
};

async function responder(req, res) {
  try {
    const url = new URL(req.url, 'http://localhost');
    const caminhoPedido = decodeURIComponent(url.pathname);
    let arquivo = path.normalize(path.join(RAIZ_JOGO, caminhoPedido));

    // Nunca servir nada fora da pasta do jogo.
    if (!arquivo.toLowerCase().startsWith(RAIZ_JOGO.toLowerCase())) {
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('403: fora da pasta do jogo');
      return;
    }

    let info = await fs.stat(arquivo).catch((erro) => {
      // O navegador pede /favicon.ico sozinho; sem arquivo, responde vazio
      // em vez de 404 para não sujar o console com erro.
      if (caminhoPedido === '/favicon.ico') return null;
      throw erro;
    });
    if (info === null) {
      res.writeHead(204);
      res.end();
      return;
    }
    if (info.isDirectory()) {
      arquivo = path.join(arquivo, 'index.html');
      info = await fs.stat(arquivo);
    }

    const dados = await fs.readFile(arquivo);
    res.writeHead(200, {
      'Content-Type': TIPOS[path.extname(arquivo).toLowerCase()] ?? 'application/octet-stream',
      'Content-Length': dados.length,
      'Cache-Control': 'no-store', // sempre a versão mais nova do código
    });
    res.end(dados);
  } catch (erro) {
    const naoExiste = erro.code === 'ENOENT' || erro.code === 'ENOTDIR';
    res.writeHead(naoExiste ? 404 : 500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(naoExiste ? `404: ${req.url}` : `500: ${erro.message}`);
  }
}

/**
 * Sobe o servidor. `porta` 0 = qualquer porta livre.
 * Devolve { url, porta, fechar() }.
 */
export function iniciarServidor(porta = 0) {
  return new Promise((resolve, reject) => {
    const servidor = http.createServer(responder);
    servidor.on('error', reject);
    servidor.listen(porta, '127.0.0.1', () => {
      const portaReal = servidor.address().port;
      resolve({
        url: `http://127.0.0.1:${portaReal}`,
        porta: portaReal,
        fechar: () => new Promise((ok) => servidor.close(ok)),
      });
    });
  });
}

// Executado direto pela linha de comando?
const executadoDireto = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (executadoDireto) {
  const argumentos = process.argv.slice(2);
  const abrirSozinho = argumentos.includes('--abrir');
  const porta = Number(argumentos.find((a) => !a.startsWith('--')) ?? 8080);
  const s = await iniciarServidor(porta);
  console.log(`Servindo ${RAIZ_JOGO}`);
  console.log(`  jogo:   ${s.url}/index.html`);
  console.log(`  testes: ${s.url}/tests/tests.html`);

  // --abrir chama o navegador padrão sozinho, para dar para jogar sem
  // copiar endereço nenhum (é o que o `jogar.cmd` usa).
  if (abrirSozinho) {
    const endereco = `${s.url}/index.html`;
    const comando = process.platform === 'win32' ? 'cmd'
      : process.platform === 'darwin' ? 'open' : 'xdg-open';
    const parametros = process.platform === 'win32' ? ['/c', 'start', '', endereco] : [endereco];
    try {
      spawn(comando, parametros, { detached: true, stdio: 'ignore' }).unref();
      console.log('  (abrindo no navegador padrão)');
    } catch {
      console.log('  Não consegui abrir o navegador sozinho; abra o endereço acima.');
    }
  }

  console.log('Ctrl+C para parar.');
}
