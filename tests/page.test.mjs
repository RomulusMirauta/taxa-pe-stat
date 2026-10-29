// Static checks on app.html: the artifact rules, code ↔ page links, light/dark themes.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync(new URL('../app.html', import.meta.url), 'utf8');
const style = html.match(/<style>([\s\S]*?)<\/style>/)[1];
const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join('\n');
const markup = html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style>[\s\S]*?<\/style>/, '');
// The page script (not the calculations): the texts, the labels and the built-in DATA.
const ui = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const tokens = style.match(/\/\* tokens:start \*\/([\s\S]*?)\/\* tokens:end \*\//)?.[1] ?? '';

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
    assert.doesNotMatch(scripts, /XMLHttpRequest|new WebSocket/);
  });
  test('fetch only with relative paths: the site lives under /taxa-pe-stat/', () => {
    const urls = [...scripts.matchAll(/fetch\(\s*(['"`])([^'"`]*)\1/g)].map((m) => m[2]);
    assert.ok(urls.includes('data/rates.json'));
    // "/data/…" would ask romulusmirauta.github.io/data/…; "//host" and "https:" are other sites.
    assert.deepEqual(urls.filter((u) => /^(\/|[a-z][a-z0-9+.-]*:)/i.test(u)), []);
  });
  test('no inline event handlers (onclick=…) or javascript: links: the CSP of the build blocks them', () => {
    assert.doesNotMatch(html, /<[a-z][^<>]*\son[a-z]+\s*=/i);
    assert.doesNotMatch(html, /javascript:/i);
  });
  test('no alert/confirm/prompt (the artifact does not show them)', () => {
    assert.doesNotMatch(scripts, /\b(alert|confirm|prompt)\(/);
  });
});

describe('the page scripts', () => {
  test('every inline script parses: a syntax error would stop the whole page (F-46)', () => {
    const inline = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
    assert.equal(inline.length, 2);
    inline.forEach((code, i) => assert.doesNotThrow(() => new vm.Script(code, { filename: `app.html, inline script ${i + 1}` })));
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
    for (const k of ['fx', 'inflation']) assert.match(ui, new RegExp(`esc\\(D(?:ATA)?\\.${k}\\.source\\)`), k);
    const esc = vm.runInNewContext('(' + ui.match(/function esc\(v\) \{[^\n]*\}/)[0] + ')');
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
  const DATA = vm.runInNewContext('(' + ui.match(/var DATA = (\{[\s\S]*?\n {2}\});/)[1] + ')');
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
  test('their labels come from DATA: no month, year or tax rate written in the page script', () => {
    const months = /\b(ianuarie|februarie|martie|aprilie|mai|iunie|iulie|august|septembrie|octombrie|noiembrie|decembrie|ian|feb|mar|apr|iun|iul|aug|sept|oct|nov|dec)\.?\s+(19|20)\d\d\b/i;
    assert.doesNotMatch(ui, months);
    assert.doesNotMatch(ui, /Impozitul de \d/);
  });
});

describe('light and dark themes', () => {
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
  test('the dark palette applies only with prefers-color-scheme: dark', () => {
    assert.match(tokens, /@media \(prefers-color-scheme:\s*dark\)\s*\{\s*:root:not\(\[data-theme="light"\]\)\s*\{/);
  });
  test('the braces of <style> balance, and nothing after the tokens ends up inside the dark @media', () => {
    let depth = 0;
    let atEnd = null;
    const end = style.indexOf('/* tokens:end */');
    for (let i = 0; i < style.length; i++) {
      if (i === end) atEnd = depth;
      if (style[i] === '{') depth++;
      else if (style[i] === '}') assert.ok(--depth >= 0, 'a } too many');
    }
    assert.equal(atEnd, 0);
    assert.equal(depth, 0);
  });
  test('the counter is readable in both themes: contrast ≥ 4.5 between the .ticker colours and its background (F-01)', () => {
    const light = vars(block(/^\s*:root\{([^}]*)\}/));
    const dark = new Map([...light, ...vars(darkAttr)]);
    const rule = (sel) => outside.match(new RegExp(`(?:^|[}\\s])${sel.replace(/[.]/g, '\\.')}\\{([^}]*)\\}`))?.[1] ?? '';
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
