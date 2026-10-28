// Verificări statice pe app.html: regulile artifact-ului, legăturile cod ↔ pagină, temele light/dark.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../app.html', import.meta.url), 'utf8');
const style = html.match(/<style>([\s\S]*?)<\/style>/)[1];
const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join('\n');
const markup = html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style>[\s\S]*?<\/style>/, '');

describe('regulile artifact-ului', () => {
  test('e un fragment: fără doctype, html, head sau body', () => {
    assert.doesNotMatch(html, /<!doctype|<html[\s>]|<head[\s>]|<body[\s>]/i);
  });
  test('are <title> în primii 8 KB', () => assert.match(html.slice(0, 8192), /<title>[^<]{3,60}<\/title>/));
  test('scripturi externe doar de pe CDN-urile permise', () => {
    for (const m of html.matchAll(/<script[^>]*\bsrc="([^"]+)"/g)) {
      assert.match(m[1], /^https:\/\/(cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net\/npm|unpkg\.com)\//);
    }
  });
  test('foi de stil externe doar de pe Google Fonts, marcate data-fonts (build-ul le înlocuiește)', () => {
    for (const m of html.matchAll(/<link[^>]*rel="stylesheet"[^>]*>/g)) {
      assert.match(m[0], /href="https:\/\/fonts\.googleapis\.com\//);
      assert.match(m[0], /\bdata-fonts\b/);
    }
  });
  test('fără cereri de rețea spre alte site-uri (artifact-ul le blochează)', () => {
    assert.doesNotMatch(scripts, /fetch\(\s*['"`]https?:|XMLHttpRequest|new WebSocket/);
  });
  test('fără alert/confirm/prompt (artifact-ul nu le afișează)', () => {
    assert.doesNotMatch(scripts, /\b(alert|confirm|prompt)\(/);
  });
});

describe('legăturile dintre cod și pagină', () => {
  const ids = [...markup.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
  const idSet = new Set(ids);
  test('id-urile sunt unice', () => assert.equal(ids.length, idSet.size));
  test('fiecare $(\'id\') din cod există în pagină', () => {
    const used = [...scripts.matchAll(/\$\('([^']+)'\)/g)].map((m) => m[1]);
    assert.ok(used.length > 20);
    assert.deepEqual(used.filter((id) => !idSet.has(id)), []);
  });
  test('cursurile citite dinamic ($(k + \'0\')) există', () => {
    for (const id of ['eur0', 'eur1', 'usd0', 'usd1']) assert.ok(idSet.has(id), id);
  });
  test('fiecare câmp are etichetă', () => {
    const inputs = [...markup.matchAll(/<input[^>]*\bid="([^"]+)"/g)].map((m) => m[1]);
    const labels = new Set([...markup.matchAll(/<label[^>]*\bfor="([^"]+)"/g)].map((m) => m[1]));
    assert.equal(inputs.length, 11);
    assert.deepEqual(inputs.filter((i) => !labels.has(i)), []);
  });
  test('câmpurile numerice acceptă virgulă: fără type="number"', () => assert.doesNotMatch(markup, /type="number"/));
  test('câmpurile au cel puțin 16px (altfel iPhone-ul face zoom la atingere)', () => {
    assert.match(style, /(^|\n)input\{[^}]*font-size:16px/);
  });
});

describe('teme light și dark', () => {
  const tokens = style.match(/\/\* tokens:start \*\/([\s\S]*?)\/\* tokens:end \*\//)?.[1] ?? '';
  const outside = style.replace(/\/\* tokens:start \*\/[\s\S]*?\/\* tokens:end \*\//, '');
  const block = (re) => tokens.match(re)?.[1] ?? '';
  const vars = (text) => new Map([...text.matchAll(/--([\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
  const light = vars(block(/^\s*:root\{([^}]*)\}/));
  const darkMedia = block(/:root:not\(\[data-theme="light"\]\)\{([^}]*)\}/);
  const darkAttr = block(/:root\[data-theme="dark"\]\{([^}]*)\}/);

  test('secțiunea de tokeni e marcată', () => assert.ok(tokens.length > 100));
  test('nicio culoare literală în afara tokenilor (CSS și cod)', () => {
    const literal = /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/;
    assert.doesNotMatch(outside, literal);
    assert.doesNotMatch(scripts, literal);
  });
  test('fiecare culoare din tema light e redefinită pentru dark', () => {
    const colors = [...light].filter(([, v]) => v.startsWith('#')).map(([k]) => k);
    assert.ok(colors.length >= 15);
    const dm = vars(darkMedia), da = vars(darkAttr);
    assert.deepEqual(colors.filter((k) => !dm.has(k)), [], 'lipsesc din @media dark');
    assert.deepEqual(colors.filter((k) => !da.has(k)), [], 'lipsesc din [data-theme="dark"]');
  });
  test('cele două blocuri dark sunt identice (comutatorul funcționează în ambele sensuri)', () => {
    assert.equal(darkMedia.replace(/\s+/g, ''), darkAttr.replace(/\s+/g, ''));
    assert.match(darkMedia, /color-scheme:dark/);
  });
  test('body are fundal explicit din token', () => assert.match(outside, /body\{[^}]*background:var\(--bg\)/));
});
