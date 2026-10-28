// Server local pentru dezvoltare. Fără dependențe, doar Node 20 sau mai nou.
// Servește aceeași pagină ca build-ul de cloud (fonturi locale, CSP) și o reîncarcă singur când salvezi app.html.
//
//   node serve.mjs              → http://localhost:5173
//   node serve.mjs --open       → pornește și deschide browserul (start.cmd face asta)
//   PORT=8080 node serve.mjs    → alt port   (PowerShell: $env:PORT=8080; node serve.mjs)
//   HOST=0.0.0.0 node serve.mjs → accesibil și de pe telefon, din rețeaua de acasă

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { networkInterfaces } from 'node:os';
import { join, resolve, sep, extname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT, APP, STATIC_DIRS, wrap } from './build.mjs';

const TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.woff2': 'font/woff2',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

// Întreabă serverul la fiecare secundă dacă app.html s-a schimbat.
const RELOAD = "(()=>{let v=null;setInterval(async()=>{try{const r=await fetch('/__v',{cache:'no-store'});const t=await r.text();if(v&&t!==v)location.reload();v=t}catch{}},1000)})();";

function send(res, code, type, body) {
  res.writeHead(code, { 'content-type': type, 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
  res.end(body);
}

async function handle(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'text/plain; charset=utf-8', 'Metodă nepermisă');
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch {
    return send(res, 400, 'text/plain; charset=utf-8', 'Adresă invalidă');
  }

  if (pathname === '/' || pathname === '/index.html') {
    const app = await readFile(APP, 'utf8');
    return send(res, 200, 'text/html; charset=utf-8', wrap(app, { reloadScript: RELOAD }));
  }
  if (pathname === '/__v') {
    return send(res, 200, 'text/plain; charset=utf-8', String((await stat(APP)).mtimeMs));
  }

  // Doar fișiere din folderele permise; nimic din afara lor (protecție la ../).
  const dir = pathname.split('/')[1];
  if (STATIC_DIRS.includes(dir)) {
    const base = join(ROOT, dir);
    const file = resolve(ROOT, '.' + pathname);
    if (file.startsWith(base + sep)) {
      try {
        const data = await readFile(file);
        return send(res, 200, TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream', data);
      } catch { /* inexistent sau folder: 404 mai jos */ }
    }
  }
  send(res, 404, 'text/plain; charset=utf-8', 'Nu există. Deschide /');
}

export function startServer({ port = Number(process.env.PORT) || 5173, host = process.env.HOST || '127.0.0.1' } = {}) {
  return new Promise((ok, fail) => {
    const server = createServer((req, res) => {
      handle(req, res).catch((e) => send(res, 500, 'text/plain; charset=utf-8', 'Eroare: ' + e.message));
    });
    server.once('error', fail);
    server.listen(port, host, () => ok(server));
  });
}

function openBrowser(url) {
  const [cmd, args] = process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]]
    : process.platform === 'darwin' ? ['open', [url]]
    : ['xdg-open', [url]];
  try {
    spawn(cmd, args, { stdio: 'ignore', detached: true, windowsHide: true }).on('error', () => {}).unref();
  } catch { /* fără browser: adresa e afișată în consolă */ }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  startServer()
    .then((server) => {
      const { port, address } = server.address();
      const url = `http://localhost:${port}`;
      console.log(`Taxa pe stat rulează pe ${url}  (Ctrl+C ca să oprești)`);
      if (address === '0.0.0.0' || address === '::') {
        for (const list of Object.values(networkInterfaces())) {
          for (const n of list ?? []) if (n.family === 'IPv4' && !n.internal) console.log(`  din rețeaua de acasă: http://${n.address}:${port}`);
        }
      }
      if (process.argv.includes('--open')) openBrowser(url);
    })
    .catch((e) => {
      if (e.code === 'EADDRINUSE') {
        console.error(`Portul ${e.port} e ocupat. Oprește cealaltă instanță sau alege alt port: PORT=5174 node serve.mjs (PowerShell: $env:PORT=5174; node serve.mjs)`);
      } else {
        console.error('Serverul nu a pornit:', e.message);
      }
      process.exit(1);
    });
}
