// Builds the site in dist/: index.html (a complete document) plus fonts/, data/, assets/ and 404.html.
// The source is app.html, the fragment the claude.ai artifact used. What the build adds to it:
//   - a complete <head>: lang="ro", description, favicon, Open Graph, no referrer;
//   - locally hosted fonts (no requests to Google);
//   - a strict Content-Security-Policy, with a hash for every inline script.
// 404.html is the page GitHub Pages shows for any address under the site that does not exist.
// Run: node build.mjs   (or npm run build)

import { readFile, writeFile, mkdir, cp, rm, access } from 'node:fs/promises';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

export const ROOT = dirname(fileURLToPath(import.meta.url));
export const APP = join(ROOT, 'app.html');
export const DIST = join(ROOT, 'dist');
// The only folders served and copied into the build, besides the page.
export const STATIC_DIRS = ['fonts', 'data', 'assets'];

// The public address comes from package.json (homepage); og:url, canonical and the preview image depend on it.
export const SITE_URL = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).homepage;
const OG_IMAGE = 'assets/og.png';

const DESCRIPTION = 'Cât pierd economiile în lei din cauza inflației și a deprecierii față de euro și dolar, pe zi, săptămână, lună și an.';

// The same reset the artifact added, so the page looks the same everywhere.
const RESET = ':root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}' +
  'body{margin:0;font:14px/1.4 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}img{max-width:100%}[hidden]{display:none!important}';

const FAVICON = 'data:image/svg+xml,' + encodeURIComponent(
  "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='7' fill='#3d3fa0'/>" +
  "<circle cx='16' cy='16' r='9' fill='none' stroke='#fff' stroke-width='2.5'/>" +
  "<path d='M16 10.5V16l3.5 2.5' fill='none' stroke='#fff' stroke-width='2.5' stroke-linecap='round'/></svg>");

// The browser bar takes the page background of each theme (--bg in the tokens of app.html).
const THEME_COLOR = '<meta name="theme-color" content="#f3f4f8" media="(prefers-color-scheme: light)">\n' +
  '<meta name="theme-color" content="#12141f" media="(prefers-color-scheme: dark)">';

const attr = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

// The HTML parser turns CRLF and a lone CR into LF before the browser hashes a script. The hashes are
// computed on that text, and the pages are written with LF only: a CRLF app.html (an editor on Windows)
// would otherwise get hashes that the browser rejects, and both scripts would be blocked.
const toLF = (s) => s.replace(/\r\n?/g, '\n');

/** The CSP hashes of the inline scripts (those without src) in an HTML fragment, as the browser computes them. */
export function inlineScriptHashes(html) {
  return [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)]
    .map((m) => `'sha256-${createHash('sha256').update(toLF(m[1]), 'utf8').digest('base64')}'`);
}

/** Wraps the app.html fragment into a complete document. `reloadScript` is used only by the local server. */
export function wrap(app, { reloadScript = '' } = {}) {
  app = toLF(app);
  const title = (app.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? 'Taxa pe stat').trim();
  let body = app
    .replace(/<title>[\s\S]*?<\/title>\s*/, '')
    .replace(/<meta name="claude:[^"]*"[^>]*>\s*/g, '')
    .replace(/<link[^>]*\bdata-fonts\b[^>]*>\s*/g, '')
    .trim();
  if (reloadScript) body += `\n<script>${reloadScript}</script>`;

  const csp = [
    "default-src 'self'",
    // Only the hashes: the page loads no script files, and 'self' would also allow the scripts of
    // every other GitHub Pages site of the account (they share the origin romulusmirauta.github.io).
    `script-src ${inlineScriptHashes(body).join(' ')}`,
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self'",
    "img-src 'self' data:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
  ].join('; ');

  return `<!doctype html>
<html lang="ro">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta http-equiv="Content-Security-Policy" content="${attr(csp)}">
<meta name="referrer" content="no-referrer">
<title>${title}</title>
<meta name="description" content="${attr(DESCRIPTION)}">
<meta property="og:type" content="website">
<meta property="og:locale" content="ro_RO">
<meta property="og:title" content="${attr(title)}">
<meta property="og:description" content="${attr(DESCRIPTION)}">
<meta property="og:url" content="${attr(SITE_URL)}">
<link rel="canonical" href="${attr(SITE_URL)}">${existsSync(join(ROOT, OG_IMAGE)) ? `
<meta property="og:image" content="${attr(SITE_URL + OG_IMAGE)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${attr(title + ': cât pierd leii tăi, zi de zi')}">
<meta name="twitter:card" content="summary_large_image">` : ''}
${THEME_COLOR}
<link rel="icon" href="${FAVICON}">
<link rel="stylesheet" href="fonts/fonts.css">
<style>${RESET}</style>
</head>
<body>
${body}
</body>
</html>
`;
}

export async function renderPage(options) {
  return wrap(await readFile(APP, 'utf8'), options);
}

// GitHub Pages serves 404.html at any depth (/taxa-pe-stat/a/b/c), where relative links would break.
// So the page stands alone: an inline style, one absolute link to the calculator, no scripts and no
// timed redirect. Its own CSP allows only that style and the data: favicon.
const NOT_FOUND_CSP = "default-src 'none'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'";

/** The page for an address that does not exist. Its colours are the tokens of app.html, for both themes. */
export function notFoundPage(app) {
  const tokens = toLF(app).match(/\/\* tokens:start \*\/[\s\S]*?\/\* tokens:end \*\//)?.[0];
  if (!tokens) throw new Error('app.html has no colour tokens (tokens:start … tokens:end)');
  return `<!doctype html>
<html lang="ro">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="${attr(NOT_FOUND_CSP)}">
<meta name="referrer" content="no-referrer">
<title>Pagina nu există · Taxa pe stat</title>
${THEME_COLOR}
<link rel="icon" href="${FAVICON}">
<style>
:root{color-scheme:light}
${tokens}
*{box-sizing:border-box}
body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px 16px;background:var(--bg);color:var(--ink);font-family:var(--body);font-size:16px;line-height:1.5}
main{max-width:34rem;background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:28px 24px}
.eyebrow{margin:0;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);font-weight:600}
h1{margin:6px 0 10px;font-family:var(--display);font-size:clamp(28px,6vw,40px);line-height:1.1;letter-spacing:-.01em}
p{margin:0 0 22px;color:var(--muted)}
a{display:inline-block;padding:12px 20px;border-radius:999px;background:var(--accent);color:var(--on-accent);font-weight:600;text-decoration:none}
a:hover{text-decoration:underline}
a:focus-visible{outline:2px solid var(--accent);outline-offset:3px}
</style>
</head>
<body>
<main>
<p class="eyebrow">Taxa pe stat · eroare 404</p>
<h1>Pagina nu există</h1>
<p>Adresa pe care ai deschis-o nu există pe acest site. Poate are o greșeală de scriere sau linkul e incomplet.</p>
<a href="${attr(SITE_URL)}">Deschide calculatorul</a>
</main>
</body>
</html>
`;
}

/** Writes dist/ from scratch. Returns the list of what it wrote. */
export async function build(outDir = DIST) {
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });
  await writeFile(join(outDir, 'index.html'), await renderPage());
  const written = ['index.html'];
  for (const dir of STATIC_DIRS) {
    try { await access(join(ROOT, dir)); } catch { continue; }
    await cp(join(ROOT, dir), join(outDir, dir), { recursive: true });
    written.push(`${dir}/`);
  }
  await writeFile(join(outDir, '404.html'), notFoundPage(await readFile(APP, 'utf8')));
  written.push('404.html');
  return { outDir, written };
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  build()
    .then(({ outDir, written }) => console.log(`Build done in ${outDir}: ${written.join(', ')}`))
    .catch((e) => { console.error('Build failed:', e.message); process.exit(1); });
}
