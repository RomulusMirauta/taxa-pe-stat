// Server local pentru Ceasul leului — fără dependențe, doar Node.
// Servește app.html învelit în același schelet pe care îl adaugă artifact-ul,
// ca pagina să arate la fel local și pe web. Se reîncarcă singur când salvezi app.html.
//
// Rulare:  node serve.mjs            (port 5173)
//          set PORT=8080 && node serve.mjs

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const APP = join(here, 'app.html');
const PORT = Number(process.env.PORT) || 5173;

// Scheletul imită ce adaugă artifact-ul la publicare.
const head = `<!doctype html>
<html lang="ro">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<style>
:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}
body{margin:0;font:14px/1.4 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
img{max-width:100%}
[hidden]{display:none!important}
</style>
</head>
<body>
`;

// Reîncărcare automată: pagina întreabă la fiecare secundă dacă app.html s-a schimbat.
const reload = `
<script>
(()=>{let v=null;setInterval(async()=>{try{const r=await fetch('/__v',{cache:'no-store'});const t=await r.text();if(v&&t!==v)location.reload();v=t;}catch{}},1000);})();
</script>`;

const server = createServer(async (req, res) => {
  try {
    if (req.url === '/__v') {
      const s = await stat(APP);
      res.writeHead(200, { 'content-type': 'text/plain', 'cache-control': 'no-store' });
      return res.end(String(s.mtimeMs));
    }
    if (req.url === '/' || req.url.startsWith('/?') || req.url === '/index.html') {
      const body = await readFile(APP, 'utf8');
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
      return res.end(head + body + reload + '\n</body>\n</html>\n');
    }
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Nu există. Deschide /');
  } catch (e) {
    res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Eroare: ' + e.message);
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Ceasul leului rulează pe http://localhost:${PORT}  (Ctrl+C ca să oprești)`);
});
