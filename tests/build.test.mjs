// The site build: a complete document, local fonts, a correct CSP, relative paths.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { build, SITE_URL } from '../build.mjs';

describe('the site build', () => {
  let out;
  let page;
  before(async () => {
    out = await mkdtemp(join(tmpdir(), 'taxa-pe-stat-'));
    await build(out);
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
    assert.match(page, new RegExp(`<meta property="og:image" content="${SITE_URL}assets/og.png">`));
    assert.match(page, /<meta name="twitter:card" content="summary_large_image">/);
    await access(join(out, 'assets', 'og.png'));
  });
  test('no claude: meta (it was only for the artifact)', () => assert.doesNotMatch(page, /name="claude:/));
  test('CSP: every inline script has its hash, no unsafe-inline for scripts', () => {
    const csp = page.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)[1].replace(/&#39;|&apos;/g, "'");
    const scriptSrc = csp.split(';').map((d) => d.trim()).find((d) => d.startsWith('script-src'));
    assert.doesNotMatch(scriptSrc, /unsafe-inline/);
    const inline = [...page.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
    assert.equal(inline.length, 2);
    for (const code of inline) {
      const h = createHash('sha256').update(code, 'utf8').digest('base64');
      assert.ok(scriptSrc.includes(`'sha256-${h}'`), 'an inline script has no hash in the CSP');
    }
    assert.match(csp, /connect-src 'self'/);
    assert.match(csp, /font-src 'self'/);
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
});
