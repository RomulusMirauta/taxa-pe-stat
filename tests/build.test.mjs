// Build-ul pentru cloud: document complet, fonturi locale, CSP corect, căi relative.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { build } from '../build.mjs';

describe('build pentru cloud', () => {
  let out;
  let page;
  before(async () => {
    out = await mkdtemp(join(tmpdir(), 'ceasul-leului-'));
    await build(out);
    page = await readFile(join(out, 'index.html'), 'utf8');
  });
  after(() => rm(out, { recursive: true, force: true }));

  test('document complet, în română, cu un singur <title> în <head>', () => {
    assert.match(page, /^<!doctype html>\n<html lang="ro">/);
    assert.match(page, /<head>[\s\S]*<title>Ceasul leului<\/title>[\s\S]*<\/head>/);
    assert.equal(page.match(/<title>/g).length, 1);
  });
  test('fără Google Fonts: fonturile sunt servite local', () => {
    assert.doesNotMatch(page, /fonts\.googleapis\.com|fonts\.gstatic\.com/);
    assert.match(page, /<link rel="stylesheet" href="fonts\/fonts\.css">/);
  });
  test('căi relative (merge și pe GitHub Pages, sub /CeasulLeului/)', () => {
    assert.doesNotMatch(page, /(?:href|src)="\/(?!\/)/);
  });
  test('fără meta-ul claude: (e doar pentru artifact)', () => assert.doesNotMatch(page, /name="claude:/));
  test('CSP: fiecare script inline are hash-ul lui, fără unsafe-inline la scripturi', () => {
    const csp = page.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)[1].replace(/&#39;|&apos;/g, "'");
    const scriptSrc = csp.split(';').map((d) => d.trim()).find((d) => d.startsWith('script-src'));
    assert.doesNotMatch(scriptSrc, /unsafe-inline/);
    const inline = [...page.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
    assert.equal(inline.length, 2);
    for (const code of inline) {
      const h = createHash('sha256').update(code, 'utf8').digest('base64');
      assert.ok(scriptSrc.includes(`'sha256-${h}'`), 'lipsește hash-ul unui script');
    }
    assert.match(csp, /connect-src 'self'/);
    assert.match(csp, /font-src 'self'/);
  });
  test('fonts.css și toate fișierele lui sunt copiate', async () => {
    const css = await readFile(join(out, 'fonts', 'fonts.css'), 'utf8');
    const files = [...css.matchAll(/url\(\.\/([^)]+)\)/g)].map((m) => m[1]);
    assert.equal(files.length, 6);
    for (const f of files) await access(join(out, 'fonts', f));
  });
});
