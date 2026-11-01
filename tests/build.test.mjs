// The site build: the source joined into one page, a complete document, local fonts, a correct CSP, relative paths,
// the 404 page, the font licences.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, mkdtemp, mkdir, rm, access, cp, writeFile } from 'node:fs/promises';
import { readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import vm from 'node:vm';
import { brotliDecompressSync } from 'node:zlib';
import { build, wrap, assemble, bundle, notFoundPage, inlineScriptHashes, SRC, ROOT, SITE_URL } from '../build.mjs';

const tokensCss = readFileSync(join(SRC, 'css', 'tokens.css'), 'utf8').replace(/\r\n?/g, '\n').trim();
// The hash the browser computes: on the script text after the HTML parser has turned CRLF and CR into LF.
const hash = (code) => `'sha256-${createHash('sha256').update(code.replace(/\r\n?/g, '\n'), 'utf8').digest('base64')}'`;
const cspOf = (html) => html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)[1].replace(/&#39;|&apos;/g, "'");
const inlineScripts = (html) => [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);

// The copyright notice written inside a WOFF2 font: nameID 0 of the name table, Windows platform (UTF-16BE).
function fontCopyright(file) {
  const b = readFileSync(file);
  assert.equal(b.toString('latin1', 0, 4), 'wOF2', `${file} is not a WOFF2 font`);
  let p = 48, at = 0, name; // the table directory follows the 48-byte header
  const uint128 = () => { let v = 0, x; do { x = b[p++]; v = v * 128 + (x & 127); } while (x & 128); return v; };
  for (let i = 0, n = b.readUInt16BE(12); i < n; i++) {
    const flags = b[p++], tag = flags & 63, version = flags >> 6;
    if (tag === 63) p += 4; // a tag outside the spec's list, written out in 4 bytes
    const length = uint128();
    // glyf (10) and loca (11) are transformed unless version 3, the other tables when version is not 0;
    // a transformed table also gives its size in the compressed stream
    const size = (tag === 10 || tag === 11 ? version !== 3 : version !== 0) ? uint128() : length;
    if (tag === 5) name = { at, size }; // 5 = name
    at += size;
  }
  assert.ok(name, `${file} has no name table`);
  const t = brotliDecompressSync(b.subarray(p, p + b.readUInt32BE(20))).subarray(name.at, name.at + name.size);
  for (let r = 6; r < 6 + t.readUInt16BE(2) * 12; r += 12) {
    if (t.readUInt16BE(r) === 3 && t.readUInt16BE(r + 6) === 0) {
      const s = t.readUInt16BE(4) + t.readUInt16BE(r + 10);
      return Buffer.from(t.subarray(s, s + t.readUInt16BE(r + 8))).swap16().toString('utf16le');
    }
  }
  assert.fail(`${file} has no copyright notice`);
}

// What a page would load from another site. Only <a> links (a navigation, not a request), canonical and
// <meta> may name another address. The CSP does not cover everything: a <link rel="preconnect"> still
// reaches the other site, so the markup itself is checked.
function externalResources(html) {
  const bad = [];
  for (const [tag, name, attrs] of html.matchAll(/<([a-z][\w-]*)\b([^>]*)>/gi)) {
    for (const [, key, value] of attrs.matchAll(/([\w:-]+)="([^"]*)"/g)) {
      const allowed = (name === 'a' && key === 'href') || (name === 'meta' && key === 'content') ||
        (name === 'link' && key === 'href' && /\brel="canonical"/.test(tag));
      if (!allowed && /(?:^|[\s,(])(?:https?:)?\/\//i.test(value)) bad.push(`<${name} ${key}="${value}">`);
    }
  }
  for (const [, css] of html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)) {
    if (/url\(\s*['"]?(?:https?:)?\/\/|@import/i.test(css)) bad.push('<style> with url(//…) or @import');
  }
  return bad;
}

describe('the site build', () => {
  let out;
  let written;
  let page;
  before(async () => {
    out = await mkdtemp(join(tmpdir(), 'taxa-pe-stat-'));
    ({ written } = await build(out));
    page = await readFile(join(out, 'index.html'), 'utf8');
  });
  after(() => rm(out, { recursive: true, force: true }));

  test('a complete document, in Romanian, with a single <title> in <head>', () => {
    assert.match(page, /^<!doctype html>\n<html lang="ro">/);
    assert.match(page, /<head>[\s\S]*<title>Taxa pe stat<\/title>[\s\S]*<\/head>/);
    assert.equal(page.match(/<title>/g).length, 1);
  });
  test('no Google Fonts: the fonts are served locally', () => {
    assert.doesNotMatch(page, /fonts\.googleapis\.com|fonts\.gstatic\.com/);
    assert.match(page, /<link rel="stylesheet" href="fonts\/fonts\.css">/);
  });
  test('relative paths (they also work on GitHub Pages, under /taxa-pe-stat/)', () => {
    assert.doesNotMatch(page, /(?:href|src)="\/(?!\/)/);
  });
  test('the public address comes from package.json: og:url and canonical', () => {
    assert.equal(SITE_URL, 'https://romulusmirauta.github.io/taxa-pe-stat/');
    assert.match(page, new RegExp(`<meta property="og:url" content="${SITE_URL}">`));
    assert.match(page, new RegExp(`<link rel="canonical" href="${SITE_URL}">`));
  });
  test('the preview image: an absolute address, copied into the build', async () => {
    assert.match(page, new RegExp(`<meta property="og:image" content="${SITE_URL}assets/og-card.png">`));
    assert.match(page, /<meta name="twitter:card" content="summary_large_image">/);
    await access(join(out, 'assets', 'og-card.png'));
    await assert.rejects(access(join(out, 'assets', 'og.png')), 'the dated card is no longer published (F-76)');
  });
  test('no claude: meta (it was only for the artifact)', () => assert.doesNotMatch(page, /name="claude:/));
  test('CSP: exactly these directives, and script-src only the hash of the one inline script', () => {
    const csp = cspOf(page);
    assert.equal(csp.replace(/'sha256-[^']+'/g, 'H'), "default-src 'self'; script-src H; style-src 'self' 'unsafe-inline'; " +
      "font-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'");
    const inline = inlineScripts(page);
    assert.equal(inline.length, 1);
    assert.ok(csp.includes(hash(inline[0])), 'the inline script has no hash in the CSP: the browser would block it');
  });
  test('the modules are inline, in one module script that parses, with no import or export left (F-46)', () => {
    assert.deepEqual([...page.matchAll(/<script\b[^>]*>/g)].map((m) => m[0]), ['<script type="module">']);
    const code = inlineScripts(page)[0];
    assert.doesNotThrow(() => new vm.Script(code, { filename: 'the bundle' }));
    assert.doesNotMatch(code, /^\s*(import|export)\b/m);
    for (const f of readdirSync(join(SRC, 'js'))) assert.ok(code.includes(`/* js/${f} */`), `${f} is not in the page`);
  });
  test('the stylesheets are inline, the tokens first, and nothing else from src/ is linked', () => {
    const style = page.match(/<body>[\s\S]*?<style>\n([\s\S]*?)<\/style>/)[1];
    assert.ok(style.startsWith(readFileSync(join(SRC, 'css', 'tokens.css'), 'utf8').replace(/\r\n?/g, '\n')));
    assert.ok(style.includes(readFileSync(join(SRC, 'css', 'style.css'), 'utf8').replace(/\r\n?/g, '\n')));
    assert.doesNotMatch(page, /(?:href|src)="(?:css|js)\//);
  });
  test('no referrer: the sites the page links to are not told its address', () => {
    assert.match(page, /<head>[\s\S]*<meta name="referrer" content="no-referrer">[\s\S]*<\/head>/);
  });
  test('nothing loads from another site: only <a> links, canonical and <meta> name other addresses', () => {
    assert.deepEqual(externalResources(page), []);
  });

  describe('404.html, the page GitHub Pages shows for an address that does not exist', () => {
    let notFound;
    before(async () => { notFound = await readFile(join(out, '404.html'), 'utf8'); });

    test('a complete page in Romanian, whose only link opens the calculator; build() lists it', () => {
      assert.ok(written.includes('404.html'), 'build() does not list 404.html');
      assert.match(notFound, /^<!doctype html>\n<html lang="ro">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">/);
      assert.match(notFound, /<title>Pagina nu există · Taxa pe stat<\/title>/);
      assert.match(notFound, /<h1>Pagina nu există<\/h1>/);
      assert.deepEqual([...notFound.matchAll(/<a\b[^>]*>[\s\S]*?<\/a>/g)].map((m) => m[0]), [`<a href="${SITE_URL}">Deschide calculatorul</a>`]);
    });
    test('it stands alone, so it also works at /taxa-pe-stat/a/b/c: no relative address, no file, no script, no redirect', () => {
      assert.doesNotMatch(notFound, /(?:href|src)="(?!https:\/\/|data:)/);
      assert.doesNotMatch(notFound, /<link rel="stylesheet"|<script|url\(|@import|http-equiv="refresh"/i);
      assert.deepEqual(externalResources(notFound), []);
    });
    test('its own CSP, which allows only the inline style and the data: favicon, and no referrer', () => {
      assert.equal(cspOf(notFound), "default-src 'none'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'");
      assert.match(notFound, /<meta name="referrer" content="no-referrer">/);
    });
    test('the colours of the site, light and dark, only through the tokens of src/css/tokens.css', () => {
      const style = notFound.match(/<style>([\s\S]*?)<\/style>/)[1];
      assert.ok(style.includes(tokensCss), 'the tokens are missing');
      assert.match(tokensCss, /prefers-color-scheme:\s*dark/);
      assert.doesNotMatch(style.replace(tokensCss, ''), /#[0-9a-f]{3,8}\b|\b(?:rgb|hsl)a?\(/i);
    });
  });

  test('the daily data is copied next to the page', async () => {
    const data = JSON.parse(await readFile(join(out, 'data', 'rates.json'), 'utf8'));
    assert.ok(data.fx && data.inflation);
  });
  test('fonts.css and all its files are copied', async () => {
    const css = await readFile(join(out, 'fonts', 'fonts.css'), 'utf8');
    const files = [...css.matchAll(/url\(\.\/([^)]+)\)/g)].map((m) => m[1]);
    assert.equal(files.length, 6);
    for (const f of files) await access(join(out, 'fonts', f));
  });
  test('every font comes with its OFL licence, which names the copyright holder and Reserved Font Name written in the font', async () => {
    const dir = join(out, 'fonts');
    const files = await readdir(dir);
    const fonts = files.filter((f) => f.endsWith('.woff2'));
    assert.ok(fonts.length > 0);
    for (const font of fonts) {
      const licence = files.find((f) => /^OFL-.+\.txt$/.test(f) && font.startsWith(f.slice(4, -4) + '-'));
      assert.ok(licence, `${font} has no OFL-<family>.txt`);
      const first = (await readFile(join(dir, licence), 'utf8')).split('\n')[0];
      // e.g. "© 2023 Adobe (http://www.adobe.com/), with Reserved Font Name ‘Source’": Adobe, Source
      const notice = fontCopyright(join(dir, font));
      const holderOf = (line) => line.replace(/^(?:©|Copyright)[\s\d,–-]*/, '').split(/\s*[(,]/)[0];
      assert.ok(holderOf(notice), `${font}: no copyright holder in ${notice}`);
      assert.match(first, /^Copyright \d{4}/, `${licence}: line 1 is not a copyright notice: ${first}`);
      assert.equal(holderOf(first), holderOf(notice), `${licence}: line 1 names another copyright holder than the font`);
      const reserved = notice.match(/Reserved Font Name ['‘"“]([^'’"”]+)/)?.[1];
      if (reserved) assert.match(first, new RegExp(`Reserved Font Name ['‘"“]${reserved}['’"”]`), `${licence}: no Reserved Font Name '${reserved}'`);
    }
  });
});

describe('wrap() and the CSP hashes', () => {
  test('source files with CRLF or CR line endings: the same pages, so the same hashes, and no CR in them', async () => {
    const lf = wrap(assemble());
    for (const [endings, eol] of [['CRLF', '\r\n'], ['CR', '\r']]) {
      const src = await mkdtemp(join(tmpdir(), 'taxa-pe-stat-src-'));
      try {
        await cp(SRC, src, { recursive: true });
        for (const f of await readdir(src, { recursive: true })) {
          if (!/\.(html|css|js)$/.test(f)) continue;
          await writeFile(join(src, f), (await readFile(join(src, f), 'utf8')).replace(/\r\n?/g, '\n').replace(/\n/g, eol));
        }
        const html = wrap(assemble(src));
        assert.doesNotMatch(html, /\r/, endings);
        assert.equal(html, lf, endings);
        assert.equal(notFoundPage(tokensCss.replace(/\n/g, eol)), notFoundPage(tokensCss), endings);
      } finally {
        await rm(src, { recursive: true, force: true });
      }
    }
  });
  test('inlineScriptHashes: the hash the browser computes, with CRLF and CR read as LF', () => {
    assert.deepEqual(inlineScriptHashes('<script>a()\r\nb()\rc()</script><script src="x.js"></script>'), [hash('a()\nb()\nc()')]);
  });
  test('the reload script of the local server gets its own hash, and script-src lists nothing else', () => {
    const scriptSrc = cspOf(wrap('<title>t</title>\n<script>a()</script>', { reloadScript: 'b()' }))
      .split('; ').find((d) => d.startsWith('script-src'));
    assert.equal(scriptSrc, `script-src ${hash('a()')} ${hash('b()')}`);
  });
});

describe('bundle(): the ES modules of src/js, joined without a bundler', () => {
  let dir;
  before(async () => { dir = await mkdtemp(join(tmpdir(), 'taxa-pe-stat-bundle-')); });
  after(() => rm(dir, { recursive: true, force: true }));
  /** Writes the modules ({ 'a.js': 'code' }) into a fresh folder and bundles from main.js. */
  let n = 0;
  async function bundleOf(files) {
    const d = join(dir, String(n++));
    await mkdir(d);
    for (const [name, code] of Object.entries(files)) await writeFile(join(d, name), code);
    return bundle(join(d, 'main.js'));
  }
  // Runs a bundle and returns what it logged.
  const run = (code) => { const out = []; vm.runInNewContext(code, { log: (v) => out.push(v) }); return out; };

  test('each module runs once, after what it imports, and sees only what it imports', async () => {
    const code = await bundleOf({
      'a.js': "log('a');\nexport const A = 1;\nvar secret = 'a';\nexport function twice(v) { return 2 * v; }\n",
      'b.js': "import { A } from './a.js';\nlog('b');\nexport const B = A + 1;\nvar secret = 'b';\n",
      'main.js': "import { B } from './b.js';\nimport { A, twice } from './a.js';\nlog([A, B, twice(B), typeof secret].join(' '));\n",
    });
    assert.deepEqual(run(code), ['a', 'b', '1 2 4 undefined']);
  });
  test('a module can change an exported object, not rebind the export: the others see the change', async () => {
    const code = await bundleOf({
      'data.js': "export const DATA = { live: false };\n",
      'load.js': "import { DATA } from './data.js';\nexport function load() { DATA.live = true; }\n",
      'main.js': "import { DATA } from './data.js';\nimport { load } from './load.js';\nload();\nlog(DATA.live);\n",
    });
    assert.deepEqual(run(code), [true]);
  });
  const refused = [
    ['export default', { 'main.js': 'export default 1;\n' }, /main\.js:1: only "export function\|const\|class name"/],
    ['export let', { 'main.js': 'export let a = 1;\n' }, /main\.js:1: only "export/],
    ['export { … }', { 'main.js': 'const a = 1;\nexport { a };\n' }, /main\.js:2: only "export/],
    ['import … as', { 'a.js': 'export const a = 1;\n', 'main.js': "import { a as b } from './a.js';\n" }, /main\.js:1: only "import \{ a, b \}/],
    ['import *', { 'a.js': 'export const a = 1;\n', 'main.js': "import * as A from './a.js';\n" }, /main\.js:1: only "import/],
    ['a package', { 'main.js': "import { x } from 'lodash';\n" }, /main\.js:1: only "import/],
    ['a dynamic import()', { 'main.js': "const m = import('./a.js');\n" }, /main\.js:1: only "import/],
    ['a name the module does not export', { 'a.js': 'export const a = 1;\n', 'main.js': "import { b } from './a.js';\n" }, /main\.js:1: \.\/a\.js does not export b/],
    ['a missing file', { 'main.js': "import { a } from './nope.js';\n" }, /main\.js:1: .*nope\.js does not exist/],
    ['an import cycle', { 'a.js': "import { b } from './b.js';\nexport const a = 1;\n", 'b.js': "import { a } from './a.js';\nexport const b = 1;\n", 'main.js': "import { a } from './a.js';\n" }, /an import cycle: .*a\.js → .*b\.js → .*a\.js/],
    ['"</script" in the code', { 'main.js': "log('</script>');\n" }, /<\/script/],
  ];
  for (const [what, files, message] of refused) {
    test(`refuses ${what}, naming the file and the line`, async () => {
      await assert.rejects(bundleOf(files), message);
    });
  }
});

test('package.json: Node.js 22 or newer (Node 20 is end-of-life since 30 April 2026; the end-to-end test needs the global WebSocket)', () => {
  const { engines } = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
  assert.match(engines.node, /^>=\d+$/);
  assert.ok(Number(engines.node.slice(2)) >= 22, engines.node);
});
