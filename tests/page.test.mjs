// Static checks on app.html: the artifact rules, code ↔ page links, light/dark themes.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../app.html', import.meta.url), 'utf8');
const style = html.match(/<style>([\s\S]*?)<\/style>/)[1];
const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join('\n');
const markup = html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style>[\s\S]*?<\/style>/, '');

describe('artifact rules', () => {
  test('is a fragment: no doctype, html, head or body', () => {
    assert.doesNotMatch(html, /<!doctype|<html[\s>]|<head[\s>]|<body[\s>]/i);
  });
  test('has a <title> in the first 8 KB', () => assert.match(html.slice(0, 8192), /<title>[^<]{3,60}<\/title>/));
  test('external scripts only from the allowed CDNs', () => {
    for (const m of html.matchAll(/<script[^>]*\bsrc="([^"]+)"/g)) {
      assert.match(m[1], /^https:\/\/(cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net\/npm|unpkg\.com)\//);
    }
  });
  test('external stylesheets only from Google Fonts, marked data-fonts (the build replaces them)', () => {
    for (const m of html.matchAll(/<link[^>]*rel="stylesheet"[^>]*>/g)) {
      assert.match(m[0], /href="https:\/\/fonts\.googleapis\.com\//);
      assert.match(m[0], /\bdata-fonts\b/);
    }
  });
  test('no network requests to other sites (the artifact blocks them)', () => {
    assert.doesNotMatch(scripts, /fetch\(\s*['"`]https?:|XMLHttpRequest|new WebSocket/);
  });
  test('no alert/confirm/prompt (the artifact does not show them)', () => {
    assert.doesNotMatch(scripts, /\b(alert|confirm|prompt)\(/);
  });
});

describe('links between code and page', () => {
  const ids = [...markup.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
  const idSet = new Set(ids);
  test('ids are unique', () => assert.equal(ids.length, idSet.size));
  test('every $(\'id\') in the code exists in the page', () => {
    const used = [...scripts.matchAll(/\$\('([^']+)'\)/g)].map((m) => m[1]);
    assert.ok(used.length > 20);
    assert.deepEqual(used.filter((id) => !idSet.has(id)), []);
  });
  test('rates read dynamically ($(k + \'0\')) exist', () => {
    for (const id of ['eur0', 'eur1', 'usd0', 'usd1']) assert.ok(idSet.has(id), id);
  });
  test('every field has a label', () => {
    const inputs = [...markup.matchAll(/<input[^>]*\bid="([^"]+)"/g)].map((m) => m[1]);
    const labels = new Set([...markup.matchAll(/<label[^>]*\bfor="([^"]+)"/g)].map((m) => m[1]));
    assert.equal(inputs.length, 11);
    assert.deepEqual(inputs.filter((i) => !labels.has(i)), []);
  });
  test('numeric fields accept a comma: no type="number"', () => assert.doesNotMatch(markup, /type="number"/));
  test('fields are at least 16px (otherwise the iPhone zooms in on tap)', () => {
    assert.match(style, /(^|\n)input\{[^}]*font-size:16px/);
  });
});

describe('light and dark themes', () => {
  const tokens = style.match(/\/\* tokens:start \*\/([\s\S]*?)\/\* tokens:end \*\//)?.[1] ?? '';
  const outside = style.replace(/\/\* tokens:start \*\/[\s\S]*?\/\* tokens:end \*\//, '');
  const block = (re) => tokens.match(re)?.[1] ?? '';
  const vars = (text) => new Map([...text.matchAll(/--([\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
  const light = vars(block(/^\s*:root\{([^}]*)\}/));
  const darkMedia = block(/:root:not\(\[data-theme="light"\]\)\{([^}]*)\}/);
  const darkAttr = block(/:root\[data-theme="dark"\]\{([^}]*)\}/);

  test('the token section is marked', () => assert.ok(tokens.length > 100));
  test('no literal colors outside the tokens (CSS and code)', () => {
    const literal = /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/;
    assert.doesNotMatch(outside, literal);
    assert.doesNotMatch(scripts, literal);
  });
  test('every light-theme color is redefined for dark', () => {
    const colors = [...light].filter(([, v]) => v.startsWith('#')).map(([k]) => k);
    assert.ok(colors.length >= 15);
    const dm = vars(darkMedia), da = vars(darkAttr);
    assert.deepEqual(colors.filter((k) => !dm.has(k)), [], 'missing from @media dark');
    assert.deepEqual(colors.filter((k) => !da.has(k)), [], 'missing from [data-theme="dark"]');
  });
  test('the two dark blocks are identical (the toggle works both ways)', () => {
    assert.equal(darkMedia.replace(/\s+/g, ''), darkAttr.replace(/\s+/g, ''));
    assert.match(darkMedia, /color-scheme:dark/);
  });
  test('body has an explicit background from a token', () => assert.match(outside, /body\{[^}]*background:var\(--bg\)/));
});
