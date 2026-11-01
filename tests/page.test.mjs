// Static checks on the source in src/: what index.html may load, code ↔ page links, light/dark themes.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { esc } from '../src/js/format.js';
import { DATA } from '../src/js/builtin-data.js';

const read = (path) => readFileSync(new URL('../src/' + path, import.meta.url), 'utf8').replace(/\r\n?/g, '\n');
const markup = read('index.html');
const style = read('css/style.css');
// The token file without its comments: :root{…}, the dark @media and :root[data-theme="dark"]{…}.
const tokens = read('css/tokens.css').replace(/\/\*[\s\S]*?\*\//g, '');
const modules = Object.fromEntries(readdirSync(new URL('../src/js/', import.meta.url)).filter((f) => f.endsWith('.js')).map((f) => [f, read('js/' + f)]));
const scripts = Object.values(modules).join('\n');

describe('what index.html loads', () => {
  test('no doctype, html, head or body: build.mjs writes the document around it', () => {
    assert.doesNotMatch(markup, /<!doctype|<html[\s>]|<head[\s>]|<body[\s>]/i);
  });
  test('has a <title> in the first 8 KB', () => assert.match(markup.slice(0, 8192), /<title>[^<]{3,60}<\/title>/));
  test('only its own stylesheets and its one module script, which the build puts inline; nothing inline', () => {
    for (const m of markup.matchAll(/<link\b[^>]*>/g)) assert.match(m[0], /^<link rel="stylesheet" href="css\/[\w-]+\.css">$/);
    assert.deepEqual([...markup.matchAll(/<script\b[^>]*>[\s\S]*?<\/script>/g)].map((m) => m[0]), ['<script type="module" src="js/main.js"></script>']);
    assert.doesNotMatch(markup, /<style/);
  });
  test('no network requests to other sites', () => {
    assert.doesNotMatch(scripts, /XMLHttpRequest|new WebSocket/);
  });
  test('fetch only with relative paths: the site lives under /taxa-pe-stat/', () => {
    const urls = [...scripts.matchAll(/fetch\(\s*(['"`])([^'"`]*)\1/g)].map((m) => m[2]);
    assert.ok(urls.includes('data/rates.json'));
    // "/data/…" would ask romulusmirauta.github.io/data/…; "//host" and "https:" are other sites.
    assert.deepEqual(urls.filter((u) => /^(\/|[a-z][a-z0-9+.-]*:)/i.test(u)), []);
  });
  test('no inline event handlers (onclick=…) or javascript: links: the CSP of the build blocks them', () => {
    for (const text of [markup, scripts]) {
      assert.doesNotMatch(text, /<[a-z][^<>]*\son[a-z]+\s*=/i);
      assert.doesNotMatch(text, /javascript:/i);
    }
  });
  test('no alert/confirm/prompt', () => {
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
  test('the data source labels reach innerHTML only through esc()', () => {
    for (const k of ['fx', 'inflation']) assert.match(modules['fresh.js'], new RegExp(`esc\\(D(?:ATA)?\\.${k}\\.source\\)`), k);
    assert.equal(esc('<img src=x onerror="a()">&'), '&lt;img src=x onerror=&quot;a()&quot;&gt;&amp;');
  });
  test('fields are at least 16px (otherwise the iPhone zooms in on tap)', () => {
    assert.match(style, /(^|\n)input\{[^}]*font-size:16px/);
  });
});

describe('without JavaScript', () => {
  test('a <noscript> message explains why the page is empty', () => {
    assert.match(markup, /<noscript><p class="formerr">[^<]*JavaScript[^<]*<\/p><\/noscript>/);
  });
  test('the counter has no static value: it would show a fake zero if the script does not run', () => {
    assert.doesNotMatch(markup.match(/\bid="tk"[^>]*>([^<]*)</)[1], /\d/);
  });
  test('the counter and the form, which do nothing without the script, are hidden', () => {
    assert.match(style, /@media \(scripting:\s*none\)\{[^}]*#ticker[^}]*\.grid[^}]*\{display:none\}\}/);
  });
});

describe('the hand-set values in DATA', () => {
  const month = /^\d{4}-(0[1-9]|1[0-2])$/;
  test('each one has the month it is from, so the page can flag it when it gets old', () => {
    assert.ok(typeof DATA.forecast.value === 'number');
    assert.match(DATA.forecast.target, month);
    assert.match(DATA.forecast.report, month);
    for (const [k, v] of Object.entries(DATA.savings)) {
      assert.ok(typeof v.rate === 'number', k);
      assert.match(v.asOf, month, k);
    }
  });
  test('their labels come from DATA: no month, year or tax rate written in the other modules', () => {
    const months = /\b(ianuarie|februarie|martie|aprilie|mai|iunie|iulie|august|septembrie|octombrie|noiembrie|decembrie|ian|feb|mar|apr|iun|iul|aug|sept|oct|nov|dec)\.?\s+(19|20)\d\d\b/i;
    for (const [f, code] of Object.entries(modules)) {
      if (f === 'builtin-data.js') continue;
      assert.doesNotMatch(code, months, f);
      assert.doesNotMatch(code, /Impozitul de \d/, f);
    }
  });
});

describe('light and dark themes', () => {
  const block = (re) => tokens.match(re)?.[1] ?? '';
  const vars = (text) => new Map([...text.matchAll(/--([\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
  const light = vars(block(/^\s*:root\{([^}]*)\}/));
  const darkMedia = block(/:root:not\(\[data-theme="light"\]\)\{([^}]*)\}/);
  const darkAttr = block(/:root\[data-theme="dark"\]\{([^}]*)\}/);

  test('tokens.css holds only the tokens: :root, the dark @media and [data-theme="dark"] (404.html copies it whole)', () => {
    assert.ok(tokens.length > 100);
    const rest = tokens
      .replace(/^\s*:root\{[^}]*\}/, '')
      .replace(/@media \(prefers-color-scheme:\s*dark\)\s*\{\s*:root:not\(\[data-theme="light"\]\)\s*\{[^}]*\}\s*\}/, '')
      .replace(/:root\[data-theme="dark"\]\{[^}]*\}/, '');
    assert.equal(rest.trim(), '');
  });
  test('no literal colors outside the tokens (CSS, markup and code)', () => {
    const literal = /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/;
    assert.doesNotMatch(style, literal);
    assert.doesNotMatch(markup, literal);
    for (const [f, code] of Object.entries(modules)) assert.doesNotMatch(code, literal, f);
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
  test('body has an explicit background from a token', () => assert.match(style, /body\{[^}]*background:var\(--bg\)/));
  test('the dark palette applies only with prefers-color-scheme: dark', () => {
    assert.match(tokens, /@media \(prefers-color-scheme:\s*dark\)\s*\{\s*:root:not\(\[data-theme="light"\]\)\s*\{/);
  });
  test('the braces balance in each stylesheet: the page joins them, so an open one would swallow the next', () => {
    for (const [name, css] of [['tokens.css', tokens], ['style.css', style]]) {
      let depth = 0;
      for (const ch of css) {
        if (ch === '{') depth++;
        else if (ch === '}') assert.ok(--depth >= 0, `${name}: a } too many`);
      }
      assert.equal(depth, 0, `${name}: a { left open`);
    }
  });
  test('the counter is readable in both themes: contrast ≥ 4.5 between the .ticker colours and its background (F-01)', () => {
    const dark = new Map([...light, ...vars(darkAttr)]);
    const rule = (sel) => style.match(new RegExp(`(?:^|[}\\s])${sel.replace(/[.]/g, '\\.')}\\{([^}]*)\\}`))?.[1] ?? '';
    const varOf = (decl, prop) => decl.match(new RegExp(`(?:^|;)\\s*${prop}:var\\(--([\\w-]+)\\)`))?.[1];
    const bg = varOf(rule('.ticker'), 'background');
    const fgs = [varOf(rule('.ticker'), 'color'), varOf(rule('.ticker .big'), 'color'), varOf(rule('.ticker.is-gain .big'), 'color')];
    assert.ok(bg && fgs.every(Boolean), 'the .ticker rules use tokens');
    const lum = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
      .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)).reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
    const ratio = (a, b) => { const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };
    for (const [theme, t] of [['light', light], ['dark', dark]]) {
      for (const fg of fgs) assert.ok(ratio(t.get(fg), t.get(bg)) >= 4.5, `${theme}: --${fg} on --${bg} = ${ratio(t.get(fg), t.get(bg)).toFixed(2)}`);
    }
  });
});
