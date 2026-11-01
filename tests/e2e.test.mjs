// The real page in headless Chrome, over the DevTools protocol (the WebSocket built into Node 22+). No dependencies.
// It catches what the static tests cannot: runtime errors in the page script, the CSP as the browser applies it,
// loading data/rates.json, the form's validation, the themes, a phone's width.
// The page is the site build, served under /taxa-pe-stat/ as on GitHub Pages: a path that starts with / breaks there.
// Skipped when Chrome is missing (CHROME_PATH or the usual places), when Node has no global WebSocket, or with E2E=0.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep, extname } from 'node:path';
import { build } from '../build.mjs';
import { Calc as C } from '../src/js/calc.js';
import { chromeArgs, launchChrome } from './chrome.mjs';

const CHROME = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, 'Google/Chrome/Application/chrome.exe'),
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser',
].find((p) => p && existsSync(p));
const missing = !CHROME ? 'Chrome is not installed (or set CHROME_PATH)'
  : typeof WebSocket !== 'function' ? 'Node has no global WebSocket (Node 22+ is needed)' : '';
// Locally it is skipped; in GitHub Actions the runner has Chrome, so a missing one must fail, not pass unnoticed.
const skip = process.env.E2E === '0' ? 'E2E=0' : missing && !process.env.GITHUB_ACTIONS ? missing : false;

// The data written by the bot: read when the test runs, so the test does not depend on today's values.
const rates = () => JSON.parse(readFileSync(new URL('../data/rates.json', import.meta.url), 'utf8'));
const tokens = readFileSync(new URL('../src/css/tokens.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').trim();
const bgToken = (re) => tokens.match(re)[1].match(/--bg:\s*#([0-9a-f]{6})/i)[1];
const rgb = (hex) => `rgb(${[0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ')})`;
const BG = { light: rgb(bgToken(/^\s*:root\{([^}]*)\}/)), dark: rgb(bgToken(/:root\[data-theme="dark"\]\{([^}]*)\}/)) };

// Fixed data and a fixed clock, for the tests that need exact dates: 29 Oct 2026, noon in Bucharest.
const NOW = '2026-10-29T10:00:00Z';
const FIXTURE = {
  version: 1,
  fx: {
    source: 'BNR', d0: '2025-10-28', eur0: 5.0844, usd0: 4.3591, d1: '2026-10-28', eur1: 5.3495, usd1: 4.8088,
    series: [
      ['2025-10-27', 5.0848, 4.3684], ['2025-10-28', 5.0844, 4.3591],
      ['2026-10-01', 5.2777, 4.6765], ['2026-10-02', 5.279, 4.6801], ['2026-10-05', 5.2801, 4.6833],
      ['2026-10-27', 5.3487, 4.7977], ['2026-10-28', 5.3495, 4.8088],
    ],
  },
  inflation: { source: 'Eurostat (IAPC)', month: '2026-09', yoy: 6.5, services: 9.3, avg12: 8.4, euroArea: 3.8, euroAreaMonth: '2026-09' },
};

const PREFIX = '/taxa-pe-stat/';
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.woff2': 'font/woff2', '.png': 'image/png', '.svg': 'image/svg+xml', '.txt': 'text/plain; charset=utf-8' };
/** A static server for the build, only under /taxa-pe-stat/ (like GitHub Pages); 404 everywhere else. */
function serve(dir) {
  const root = resolve(dir);
  const server = createServer(async (req, res) => {
    const path = new URL(req.url, 'http://localhost').pathname;
    const file = path.startsWith(PREFIX) && resolve(root, decodeURIComponent(path.slice(PREFIX.length)) || 'index.html');
    if (file && file.startsWith(root + sep)) {
      try {
        const body = await readFile(file);
        res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
        return res.end(body);
      } catch { /* missing, or a folder: 404 below */ }
    }
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  });
  return new Promise((ok) => server.listen(0, '127.0.0.1', () => ok(server)));
}

const shiftDays = (iso, n) => new Date(Date.parse(iso + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10);
// A date the way the page writes it: „27 oct. 2025”.
const roDate = (iso) => new Intl.DateTimeFormat('ro-RO', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(Date.parse(iso));
const comma = (v) => String(v).replace('.', ',');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// For the time limits in Promise.race: a pending timer would keep the test process open for another 3 s.
const deadline = (ms) => new Promise((r) => setTimeout(r, ms).unref());
async function until(fn, what, ms = 10000) {
  const end = Date.now() + ms;
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() > end) throw new Error(`after ${ms} ms, still not: ${what}`);
    await sleep(20);
  }
}

/** A minimal CDP connection: send() returns the result, on() receives the events. */
function connect(url) {
  const ws = new WebSocket(url);
  const pending = new Map();
  const listeners = new Set();
  let id = 0;
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id) {
      const p = pending.get(m.id);
      pending.delete(m.id);
      if (m.error) p?.fail(new Error(`${p.method}: ${m.error.message}`)); else p?.ok(m.result);
    } else for (const l of listeners) l(m);
  };
  ws.onclose = () => { for (const p of pending.values()) p.fail(new Error('CDP: the connection closed')); pending.clear(); };
  const opened = new Promise((ok, fail) => { ws.onopen = ok; ws.onerror = () => fail(new Error('CDP: WebSocket refused')); });
  return {
    opened,
    send: (method, params = {}) => new Promise((ok, fail) => {
      const i = ++id;
      pending.set(i, { ok, fail, method });
      ws.send(JSON.stringify({ id: i, method, params }));
    }),
    on(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    close: () => ws.close(),
  };
}

/** Runs in the page: the weakest text/background contrast (WCAG), with the parents' opacity. */
function worstContrast() {
  const parse = (s) => { const n = s.match(/[\d.]+/g).map(Number); return { r: n[0], g: n[1], b: n[2], a: n.length > 3 ? n[3] : 1 }; };
  const lum = (c) => [c.r, c.g, c.b].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; })
    .reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
  const bgOf = (el) => { for (let e = el; e; e = e.parentElement) { const c = parse(getComputedStyle(e).backgroundColor); if (c.a > 0) return c; } return { r: 255, g: 255, b: 255, a: 1 }; };
  const opacityOf = (el) => { let o = 1; for (let e = el; e; e = e.parentElement) o *= Number(getComputedStyle(e).opacity); return o; };
  let worst = { ratio: Infinity, where: '' };
  for (const el of document.querySelectorAll('body *')) {
    const hasText = el.tagName === 'INPUT' || [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (!hasText || !el.getClientRects().length || getComputedStyle(el).visibility === 'hidden') continue;
    const cs = getComputedStyle(el);
    const fg = parse(el instanceof SVGElement ? cs.fill : cs.color);
    const bg = bgOf(el);
    const a = fg.a * opacityOf(el);
    const f = { r: fg.r * a + bg.r * (1 - a), g: fg.g * a + bg.g * (1 - a), b: fg.b * a + bg.b * (1 - a) };
    const [hi, lo] = [lum(f), lum(bg)].sort((x, y) => y - x);
    const ratio = (hi + 0.05) / (lo + 0.05);
    if (ratio < worst.ratio) worst = { ratio, where: `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''} „${(el.textContent || el.value || '').trim().slice(0, 30)}”` };
  }
  return worst;
}

describe('the page in Chrome (end-to-end)', { skip }, () => {
  let dist, server, base, chrome, profile, cdp, browserUrl;
  const problems = [];
  const requests = [];

  const js = async (expression) => {
    const r = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(`in the page: ${r.exceptionDetails.exception?.description ?? r.exceptionDetails.text}`);
    return r.result.value;
  };
  const isLive = () => js("document.getElementById('fresh').textContent.includes('actualizate automat')");
  // As when typing: the new value, then the "input" event the form listens to.
  const type = (id, value) => js(`(() => { const el = document.getElementById(${JSON.stringify(id)}); el.value = ${JSON.stringify(value)};
    el.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  const click = (selector) => js(`document.querySelector(${JSON.stringify(selector)}).click()`);
  const state = () => js(`(() => {
    const $ = (id) => document.getElementById(id);
    return {
      text: document.body.innerText,
      rows: [...document.querySelectorAll('#tb tr')].map((tr) => [...tr.cells].map((td) => td.textContent)),
      fxRows: [...document.querySelectorAll('#fxb tr')].map((tr) => [...tr.cells].map((td) => td.textContent)),
      fxNote: $('fxNote').textContent,
      facts: [...document.querySelectorAll('#facts .fact')].map((f) => ({ value: f.querySelector('b').textContent, cls: f.querySelector('b').className, text: f.querySelector('span').textContent })),
      invalid: [...document.querySelectorAll('[aria-invalid="true"]')].map((e) => e.id),
      formErr: $('formErr').hidden ? null : $('formErr').textContent,
      fresh: $('fresh').textContent,
      fxHint: $('fxHint').className + ': ' + $('fxHint').textContent,
      lossHint: $('lossHint').textContent,
      tkNote: $('tkNote').textContent,
      foot: $('foot').textContent,
      paths: [...$('ch').querySelectorAll('path')].map((p) => p.getAttribute('d')),
      ticker: $('tk').textContent,
      csp: window.__csp,
      v: Object.fromEntries([...document.querySelectorAll('#f input')].map((i) => [i.id, i.value])),
    };
  })()`);

  /** data/rates.json, answered by the test: a body to send, or a function that gets the paused request. */
  async function intercept(answer, fn) {
    const off = cdp.on(({ method, params }) => {
      if (method !== 'Fetch.requestPaused') return;
      if (typeof answer === 'function') return answer(params.requestId);
      const [code, body] = answer;
      cdp.send('Fetch.fulfillRequest', { requestId: params.requestId, responseCode: code,
        responseHeaders: [{ name: 'content-type', value: 'application/json' }], body: Buffer.from(body).toString('base64') });
    });
    await cdp.send('Fetch.enable', { patterns: [{ urlPattern: '*/data/rates.json*' }] });
    try { return await fn(); } finally {
      off();
      await cdp.send('Fetch.disable');
    }
  }
  const json = (data) => [200, JSON.stringify(data)];

  /** The page from scratch, with the given theme and width; waits for the fonts and, by default, the daily data. */
  async function open({ theme = 'light', width = 1280, height = 900, live = true, now } = {}) {
    problems.length = 0;
    requests.length = 0;
    await cdp.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 600 });
    await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: theme }] });
    // A fixed "now" for this page only: Date answers as if it were `now`, the rest of the clock runs normally.
    const clock = now && await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: `(() => {
      const Real = Date, shift = Real.parse(${JSON.stringify(now)}) - Real.now();
      class Fixed extends Real {
        constructor(...a) { if (a.length) super(...a); else super(Real.now() + shift); }
        static now() { return Real.now() + shift; }
      }
      window.Date = Fixed;
    })();` });
    let loaded = false;
    const off = cdp.on((m) => { if (m.method === 'Page.loadEventFired') loaded = true; });
    try {
      await cdp.send('Page.navigate', { url: base });
      await until(() => loaded, 'the load event', 15000);
    } finally {
      off();
      if (clock) await cdp.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: clock.identifier });
    }
    await js('document.fonts.ready.then(() => true)');
    if (live) await waitLive();
  }
  // Stops at the first error in the page (e.g. a CSP that blocks the scripts), with its message, not after 10 s.
  async function waitLive() {
    await until(async () => (await isLive()) || problems.length, '„actualizate automat” (data/rates.json loaded)');
    if (!(await isLive())) assert.fail(`the page did not load the data:\n${problems.join('\n')}`);
  }
  const cellValue = (text) => -C.parseNum(text.replace(/\s(lei|€|\$)$/, '').replace(/^−/, '-'), { money: true });
  const dash = (row) => row.slice(1).every((c) => c === '—');

  before(async () => {
    if (missing) throw new Error(`the end-to-end test cannot run: ${missing}`);
    dist = await mkdtemp(join(tmpdir(), 'taxa-pe-stat-e2e-'));
    await build(dist);
    server = await serve(dist);
    base = `http://127.0.0.1:${server.address().port}${PREFIX}`;
    profile = await mkdtemp(join(tmpdir(), 'taxa-pe-stat-chrome-'));
    // A Chrome that cannot start fails the suite with its own words, never a silent „cancelledByParent” (F-90).
    let port, path;
    ({ chrome, port, path } = await launchChrome(CHROME, chromeArgs({ profile }), profile));
    browserUrl = `ws://127.0.0.1:${port}${path}`;
    const page = await until(async () => (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((t) => t.type === 'page'), 'the tab');
    cdp = connect(page.webSocketDebuggerUrl);
    await cdp.opened;
    cdp.on(({ method, params: p }) => {
      if (method === 'Runtime.exceptionThrown') problems.push(`exception: ${p.exceptionDetails.exception?.description ?? p.exceptionDetails.text}`);
      else if (method === 'Runtime.consoleAPICalled' && ['error', 'warning', 'assert'].includes(p.type)) problems.push(`console.${p.type}: ${p.args.map((a) => a.value ?? a.description).join(' ')}`);
      else if (method === 'Log.entryAdded' && ['error', 'warning'].includes(p.entry.level)) problems.push(`${p.entry.source}: ${p.entry.text} ${p.entry.url ?? ''}`.trim());
      else if (method === 'Network.requestWillBeSent') requests.push(p.request.url);
      else if (method === 'Network.responseReceived' && p.response.status >= 400) problems.push(`HTTP ${p.response.status} ${p.response.url}`);
      else if (method === 'Network.loadingFailed' && !p.canceled) problems.push(`network: ${p.errorText} ${p.blockedReason ?? ''}`.trim());
    });
    for (const d of ['Page', 'Runtime', 'Log', 'Network']) await cdp.send(`${d}.enable`);
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
    // "Today" is the visitor's local date: the same time zone on every machine.
    await cdp.send('Emulation.setTimezoneOverride', { timezoneId: 'Europe/Bucharest' });
    // CSP violations as events too: not only the console messages.
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
      source: "window.__csp = []; document.addEventListener('securitypolicyviolation', (e) => __csp.push(e.violatedDirective + ' ' + (e.blockedURI || 'inline')));",
    });
  });

  after(async () => {
    try { cdp?.close(); } catch {}
    try { const b = connect(browserUrl); await b.opened; await Promise.race([b.send('Browser.close'), deadline(3000)]); } catch {}
    if (chrome && chrome.exitCode === null) {
      await Promise.race([new Promise((r) => chrome.once('exit', r)), deadline(3000)]);
      if (chrome.exitCode === null) chrome.kill();
    }
    await new Promise((r) => (server ? server.close(r) : r()));
    for (const dir of [profile, dist]) if (dir) await rm(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }).catch(() => {});
  });

  test('the chart labels and the date fields fit, with large sums too, at 1280 and 320 px (F-78, F-79)', async () => {
    for (const width of [1280, 320]) {
      await open({ width });
      for (const sum of ['50000', '5000000000']) {
        await type('sum', sum);
        const cut = await js(`(() => {
          const svg = document.getElementById('ch'), [, , w, h] = svg.getAttribute('viewBox').split(' ').map(Number);
          return [...svg.querySelectorAll('text')].filter((t) => { const b = t.getBBox(); return b.x < 0 || b.y < 0 || b.x + b.width > w + 0.5 || b.y + b.height > h + 0.5; }).map((t) => t.textContent);
        })()`);
        assert.deepEqual(cut, [], `chart labels cut at ${width}px, sum ${sum}`);
      }
      const dates = await js("['d0', 'd1'].map((id) => Math.round(document.getElementById(id).getBoundingClientRect().width))");
      assert.ok(dates.every((w) => w >= 170), `date fields at ${width}px: ${dates} px wide`);
      assert.deepEqual(problems, []);
    }
  });
  test('the chart states its assumption in the drawing, above the lines, and offers the BNR forecast (F-87)', async () => {
    const assumption = () => js(`(() => {
      const svg = document.getElementById('ch'), t = document.getElementById('chAssume'), b = t.getBBox();
      // The highest point any line or end dot reaches: the smallest y.
      const ys = [...svg.querySelectorAll('path')].flatMap((p) => [...p.getAttribute('d').matchAll(/[ML][\\d.]+,([\\d.]+)/g)].map((m) => Number(m[1])))
        .concat([...svg.querySelectorAll('circle')].map((c) => Number(c.getAttribute('cy')) - Number(c.getAttribute('r'))));
      return { text: t.textContent, bottom: b.y + b.height, highest: Math.min(...ys) };
    })()`);
    await intercept(json(FIXTURE), async () => {
      for (const width of [1280, 320]) {
        await open({ width, now: NOW });
        // The worst cases: lines that reach the top of the axis, at the left when they fall (40,000 lei, the axis
        // ends at 40 mii), at the right, under the assumption, when they rise (46,399 lei at 15% tax-free grow to
        // just under 100 mii in 10 years, the axis's end).
        for (const [sum, rate, tax] of [['40.000', '0', '10'], ['46.399', '15', '0']]) {
          await type('sum', sum);
          await type('rate', rate);
          await type('tax', tax);
          const a = await assumption();
          assert.equal(a.text, 'inflație constantă: 6,5%/an');
          assert.ok(a.bottom <= a.highest, `at ${width} px, ${sum} lei at ${rate}%: the assumption (bottom ${a.bottom}) overlaps a line (top ${a.highest})`);
        }
      }
      await click('#chForecast .chip');
      const s = await state();
      assert.equal(s.v.infl, '3,4', 'the button sets the forecast, like the chip by the field');
      assert.equal((await assumption()).text, 'inflație constantă: 3,4%/an');
      assert.equal(await js("document.querySelector('#chForecast .chip').getAttribute('aria-pressed')"), 'true');
      assert.equal(await js("document.querySelector('#chForecast .chip').textContent"), 'Înapoi la ultimele 12 luni (6,5%)');
      // A toggle: pressed again, it goes back to the annual rate.
      await click('#chForecast .chip');
      assert.equal((await state()).v.infl, '6,5');
      assert.equal(await js("document.querySelector('#chForecast .chip').textContent"), 'Vezi cu prognoza BNR (3,4%)');
      assert.deepEqual(problems, []);
    });
    // After its target month the forecast is gone from under the chart too.
    await intercept(json(FIXTURE), async () => {
      await open({ now: '2028-01-03T10:00:00Z' });
      assert.equal(await js("document.getElementById('chForecast').hidden && !document.querySelector('#chForecast button')"), true);
    });
  });

  test('loads with the daily data, without errors, CSP violations or requests to other sites; the results are those of Calc', async () => {
    await open();
    assert.deepEqual(problems, []);
    const s = await state();
    assert.deepEqual(s.csp, []);
    const origin = new URL(base).origin;
    assert.deepEqual(requests.filter((u) => !u.startsWith(origin + '/') && !u.startsWith('data:')), [], 'the page makes no requests to other sites');

    const r = rates();
    assert.equal(s.formErr, null, 'the values filled in pass the validation (ro-RO formatting → parseNum)');
    assert.deepEqual(s.invalid, []);
    assert.equal(s.v.d0, r.fx.d0);
    assert.equal(s.v.d1, r.fx.d1);
    for (const k of ['eur0', 'eur1', 'usd0', 'usd1']) assert.equal(C.parseNum(s.v[k]), r.fx[k], k);
    assert.equal(C.parseNum(s.v.infl), r.inflation.yoy);
    assert.match(s.fresh, new RegExp(`Curs: ${r.fx.source.replace(/[()]/g, '\\$&')}, `));
    assert.doesNotMatch(s.text, /NaN|undefined|Infinity/);
    assert.ok(s.paths.length >= 3 && s.paths.every((d) => d && !d.includes('NaN')), 'the chart has valid curves');

    const n = (id, money) => C.parseNum(s.v[id], { money });
    const p = { S: n('sum', true), pi: n('infl') / 100, rate: n('rate') / 100, tax: n('tax') / 100, fees: n('fees', true), net: true };
    const days = C.daysBetween(s.v.d0, s.v.d1);
    const fx = (k) => C.fxTrend(n(k + '0'), n(k + '1'), days);
    const near = (rows, expected, what) => rows.forEach((row, i) => row.slice(1).forEach((cell, j) =>
      assert.ok(Math.abs(cellValue(cell) - expected[i][j]) < 0.0051, `${what} row ${i + 1}, ${C.PERIODS[j].label}: ${cell} ≠ ${expected[i][j]}`)));
    assert.equal(s.rows.length, 1);
    near(s.rows, [C.PERIODS.map((q) => C.realLoss(p, q.days))], 'loss');
    // EUR and USD: what already happened, from BNR's daily history; none of these cells is a projection (F-84).
    assert.equal(s.fxRows.length, 2);
    const realised = [C.fxRealized(p, r.fx.series, s.v.d1, n('eur1'), 1, r.fx.d1), C.fxRealized(p, r.fx.series, s.v.d1, n('usd1'), 2, r.fx.d1)];
    assert.ok(realised.flat().every(Number.isFinite), 'the bot keeps a year of history: every window is reached');
    near(s.fxRows, realised, 'realised');
    // The only projection: one year, in the sentence under the table.
    const year = (k, unit) => {
      const v = -C.fxLoss(p, fx(k).annual, n(k + '1'), 365), a = Math.abs(v).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+,)/g, '.');
      return `${v < 0 ? '−' : '+'}${a} ${unit} pe an`;
    };
    assert.ok(s.fxNote.includes(`Dacă ritmul din ultimul an continuă: ${year('eur', '€')} față de euro și ${year('usd', '$')} față de dolar.`), s.fxNote);
    // „Pe scurt” is computed in the page script (renderFacts), not in Calc: this is where it is checked (DESIGN §5.4).
    const shown = s.facts.map((f) => -cellValue(f.value.replace(/%$/, '')));
    const want = [p.S / n('eur1') - p.S / n('eur0'), p.S / n('usd1') - p.S / n('usd0'),
      -C.realLoss({ S: p.S, pi: p.pi, net: false }, 365), C.breakEvenRate(p.pi, p.tax, p.fees, p.S) * 100];
    want.forEach((w, i) => assert.ok(Math.abs(shown[i] - w) < 0.0051, `Pe scurt #${i + 1}: ${s.facts[i].value} ≠ ${w}`));
    if (p.rate === 0) assert.match(s.lossHint, /^Bani ținuți fără dobândă/, 'F-14: no „dobânda netă de 0,00%”');
    // The counter's sign follows the data: a loss with inflation, a gain with deflation (F-07). 50 million keeps it
    // away from zero even in the first seconds of a year.
    const perYear = C.lossRatePerYear(p);
    if (perYear !== 0) {
      await type('sum', '50.000.000');
      const t = await until(async () => { const v = (await state()).ticker; return v !== '0,0000 lei' && v; }, 'the counter starts', 5000);
      assert.match(t, perYear > 0 ? /^−[\d.]+,\d{4} lei$/ : /^\+[\d.]+,\d{4} lei$/);
    }
  });

  test('wrong fields are marked and the affected rows show „—” (F-02…F-05, F-08, F-09); the texts follow the numbers', async () => {
    await open();
    await type('infl', 'abc');
    let s = await state();
    assert.deepEqual(s.invalid, ['infl']);
    assert.match(s.formErr, /inflația/);
    assert.ok(s.rows.every(dash));
    assert.ok(!s.fxRows.some(dash), 'the exchange rates do not need inflation');
    assert.doesNotMatch(s.text, /NaN|undefined|Infinity/);

    await type('infl', '6,5');
    await type('tax', '300');
    assert.deepEqual((await state()).invalid, ['tax'], 'F-09: a tax above 100%');
    await type('tax', '100');
    s = await state();
    assert.equal(s.facts[3].value, '—', 'at a 100% tax no interest keeps up');
    assert.doesNotMatch(s.text, /NaN|undefined|Infinity/);
    await type('tax', '10');

    await type('d0', '');
    s = await state();
    assert.deepEqual(s.invalid, ['d0']);
    assert.ok(!dash(s.rows[0]) && !s.fxRows.some(dash), 'F-03: what already happened needs only the current date (F-84)');
    assert.doesNotMatch(s.fxNote, /Dacă ritmul/, 'F-03: without an interval there is no annual pace');

    await type('d0', '2099-01-01');
    s = await state();
    assert.equal(s.formErr, 'Verifică: data curentă trebuie să fie după data de referință.', 'F-04, and no BNR rate asked for 2099');

    // A date in the BNR history: the rates follow it, and a short interval is flagged (F-05).
    const r = rates();
    const d0 = shiftDays(r.fx.d1, -30);
    const row = C.rateOn(r.fx.series, d0, r.fx.d1);
    await type('d0', d0);
    s = await state();
    assert.match(s.fxHint, /^hint warn: Interval scurt \(30 de zile\)/, 'F-05');
    assert.equal(s.formErr, null);
    assert.deepEqual([C.parseNum(s.v.eur0), C.parseNum(s.v.usd0)], [row[1], row[2]], 'the rates of that day, from data/rates.json');

    // Exchange rates that cannot be real: above 1000, or a pair more than 4 times apart.
    await type('eur0', '53495');
    s = await state();
    assert.ok(s.invalid.includes('eur0'));
    assert.doesNotMatch(s.fxNote, /față de euro/, 'no annual pace for EUR without the rate of then');
    assert.match(s.fxNote, /pe an față de dolar/);
    assert.match(s.formErr, /cursul EUR de atunci/);
    await type('eur0', '53,495');
    s = await state();
    assert.deepEqual(s.invalid, ['eur0', 'eur1']);
    assert.match(s.formErr, /cursurile EUR de atunci și de acum nu par reale/);
    assert.ok(dash(s.fxRows[0]) && !dash(s.fxRows[1]), 'a pair that cannot be real: no EUR at all');
    assert.doesNotMatch(s.text, /∞|NaN/);
    // A wrong first digit over 1 day is a plausible pair, but no pace can be extrapolated from it.
    await type('d0', shiftDays(r.fx.d1, -1));
    await type('eur0', '7,3495');
    s = await state();
    assert.doesNotMatch(s.fxNote, /față de euro/);
    // USD's pace over that day depends on the day's data: projected for a year, or not extrapolated at all.
    assert.match(s.fxNote, /Dacă ritmul din intervalul ales \(1 zi\) continuă: [−+][\d.]+,\d\d \$ pe an față de dolar\.|Din intervalul ales, ritmul anual nu se poate extrapola\./);
    assert.doesNotMatch(s.text, /∞|\d{1,3}(\.\d{3}){5}/, 'no number of 16 digits or more');
    await type('d0', d0);
    await type('eur0', comma(row[1]));

    // Deflation: the words follow the sign, and any interest keeps up.
    await type('infl', '-1');
    s = await state();
    assert.match(s.rows[0][0], /putere de cumpărare, −1%\/an/, 'the minus sign is U+2212, as in the table');
    assert.equal(s.facts[2].cls, 'num gain');
    assert.match(s.facts[2].text, /^putere de cumpărare câștigată .* La anul îți trebuie cu 500,00 lei mai puțin pentru același coș\.$/);
    assert.equal(s.facts[3].value, '0,00%');
    assert.match(s.facts[3].text, /orice dobândă, chiar 0%, ține pasul \(prețurile scad\)/);
    await type('infl', '0');
    s = await state();
    assert.equal(s.facts[2].cls, 'num ', 'zero has no colour');
    assert.match(s.facts[2].text, /neschimbată .* aceiași bani/);
    await type('infl', '6,5');

    // A current account with fees: the note never says „fără dobândă și comisioane” (no interest and no fees).
    await type('fees', '240');
    s = await state();
    assert.match(s.tkNote, /fără dobândă, dar cu 240 lei comisioane pe an\)/);
    await type('fees', '0');

    // Real keys: the thousands dots come by themselves, Backspace on a dot takes the digit before it,
    // and the comma is the decimal one (F-93).
    await js("(() => { const el = document.getElementById('sum'); el.value = ''; el.focus(); })()");
    for (const ch of '1234567') await cdp.send('Input.insertText', { text: ch });
    assert.equal(await js("document.getElementById('sum').value"), '1.234.567');
    await js("document.getElementById('sum').setSelectionRange(6, 6)"); // after „1.234.”, just after the dot
    for (const type of ['rawKeyDown', 'keyUp']) await cdp.send('Input.dispatchKeyEvent', { type, key: 'Backspace', code: 'Backspace', windowsVirtualKeyCode: 8 });
    assert.equal(await js("document.getElementById('sum').value"), '123.567');
    // Delete just before a dot takes the digit after it; a dot typed by hand does not stay.
    await js("document.getElementById('sum').setSelectionRange(3, 3)");
    for (const type of ['rawKeyDown', 'keyUp']) await cdp.send('Input.dispatchKeyEvent', { type, key: 'Delete', code: 'Delete', windowsVirtualKeyCode: 46 });
    assert.equal(await js("document.getElementById('sum').value"), '12.367');
    await cdp.send('Input.insertText', { text: '.' });
    assert.equal(await js("document.getElementById('sum').value"), '12.367');
    await type('sum', '123.567');
    await js("document.getElementById('sum').setSelectionRange(7, 7)");
    for (const ch of ',5') await cdp.send('Input.insertText', { text: ch });
    s = await state();
    assert.equal(s.v.sum, '123.567,5');
    assert.match(s.text, /Pentru 123\.568 lei/);
    await type('sum', '50,000');
    assert.match((await state()).text, /Pentru 50 lei/, 'a comma is never a thousands separator');

    await type('sum', '-0');
    s = await state();
    assert.match(s.text, /Pentru 0 lei, de când ai deschis pagina/);
    assert.doesNotMatch(s.text, /[-−]0(?:[,.]0+)?(?![\d,.])/, 'no zero with a sign');
    await type('sum', '0');
    s = await state();
    assert.ok([...s.rows, ...s.fxRows].flatMap((row) => row.slice(1)).every((c) => /^0,00 (lei|€|\$)$/.test(c)), 'F-08: zero without a sign');

    // One way to say „no interest”: the form's 0% (F-86). A scenario button changes every result at once.
    assert.equal(await js("document.querySelectorAll('#mRaw, #mNet, .toggle').length"), 0, 'no „Fără dobândă / Cu dobânda netă” switch');
    await type('sum', '50.000');
    const cash = await state();
    assert.match(cash.lossHint, /^Bani ținuți fără dobândă/);
    const deposit = '#rateChips .chip:nth-child(2)';
    await click(deposit);
    s = await state();
    const rate = Number(await js(`document.querySelector('${deposit}').dataset.rate`)) / 100;
    const dp = { S: 50000, pi: 0.065, rate, tax: 0.1, fees: 0, net: true };
    assert.equal(C.parseNum(s.v.rate), rate * 100);
    assert.ok(Math.abs(cellValue(s.rows[0][4]) - C.realLoss(dp, 365)) < 0.0051, `the table: ${s.rows[0][4]}`);
    assert.match(s.lossHint, /^Cu dobânda netă de /);
    assert.match(s.tkNote, /cu dobânda netă de /, 'the counter too');
    // „Pe scurt” follows the form's interest too (F-94): a smaller loss, and the words say which interest.
    assert.equal(s.facts[2].value, s.rows[0][4], '„Pe scurt”: the same year as the table');
    assert.notEqual(s.facts[2].value, cash.facts[2].value);
    assert.match(s.facts[2].text, /într-un an cu dobânda netă de /);
    // The best case: green everywhere it is shown.
    await click('[data-min]');
    s = await state();
    assert.equal(s.facts[2].cls, 'num gain', `„Minimul pentru plus”: ${s.facts[2].value}`);
    assert.match(s.rows[0][4], /^\+/);
    // A new sum, then the button, or the button, then a new sum: the same interest and results (F-95).
    const results = (x) => ({ rate: x.v.rate, tax: x.v.tax, rows: x.rows, facts: x.facts, tkNote: x.tkNote });
    await type('sum', '20.000');
    const minAfter = results(await state());
    await click(deposit);
    await type('sum', '50.000');
    await type('sum', '20.000');
    await click('[data-min]');
    assert.deepEqual(minAfter, results(await state()));
    assert.equal(C.parseNum(minAfter.rate), C.rateForGainIn(0.065, 0, 0, 20000, 3));
    // An interest typed by hand stays, whatever the sum.
    await type('rate', '9');
    await type('sum', '30.000');
    assert.equal((await state()).v.rate, '9');
    await type('sum', '50.000');
    await click(deposit);
    s = await state();
    assert.match(await js(`document.querySelector('${deposit}').textContent`), /^Depozit 6–12 luni, media BNR · \d+(,\d+)?%$/);
    assert.equal(await js(`document.querySelector('${deposit}').getAttribute('aria-pressed')`), 'true');
    assert.match(await js("document.getElementById('rateHint').textContent"), /BNR o publică la circa două luni după/, 'the lag of the source, under the buttons');
    assert.match(s.foot, /6–12 luni, [a-z]+ \d{4} \(BNR o publică la circa două luni după\)/, 'and in the sources');
    assert.deepEqual(problems, []);
    assert.deepEqual(s.csp, []);
  });

  test('a date change takes the BNR rate of that day; without one, the page says so and computes nothing', async () => {
    await intercept(json(FIXTURE), async () => {
      await open({ now: NOW });
      let s = await state();
      assert.match(s.fxHint, /Atunci: cursul BNR din 28 oct\. 2025\. Acum: cursul BNR din 28 oct\. 2026\./);
      // The fixture's history has 27 Oct and 28 Oct 2025, then gaps: a week and a month back from 28 Oct 2026 it has
      // no rate within 10 days, so those windows show „—” (F-84), while a day and a year are computed.
      const p = { S: 50000, pi: 0.065, rate: 0, tax: 0.1, fees: 0, net: true };
      const wanted = (col, cNow) => C.fxRealized(p, FIXTURE.fx.series, '2026-10-28', cNow, col, '2026-10-29');
      assert.deepEqual(wanted(1, 5.3495).map(Number.isFinite), [true, false, false, true]);
      for (const [i, w] of [[0, wanted(1, 5.3495)], [1, wanted(2, 4.8088)]]) {
        s.fxRows[i].slice(1).forEach((cell, j) => assert.ok(Number.isFinite(w[j]) ? Math.abs(cellValue(cell) - w[j]) < 0.0051 : cell === '—', `${cell} ≠ ${w[j]}`));
      }
      assert.match(s.fxRows[0][0], /^EURpână pe 28 oct\. 2026$/);

      await type('d0', '2026-10-04'); // a Sunday: the rate of Friday 2 October
      s = await state();
      assert.equal(s.formErr, null);
      assert.deepEqual([s.v.eur0, s.v.usd0], ['5,279', '4,6801']);
      assert.match(s.fxHint, /Atunci: cursul BNR din 2 oct\. 2026, ultima zi cu curs până la 4 oct\. 2026\./);
      assert.match(s.facts[0].text, /valorau 9\.471,49 € pe 4 oct\. 2026/);
      assert.match(s.fresh, /Curs: BNR, 28 oct\. 2026/, 'the date list shows the data, not the form');

      await type('d0', '2026-09-15'); // not in the series
      s = await state();
      assert.equal(s.formErr, 'Verifică: cursul BNR din 15 sept. 2026 (bnr.ro).');
      assert.deepEqual(s.invalid, ['eur0', 'usd0']);
      assert.doesNotMatch(s.fxNote, /Dacă ritmul/, 'no annual pace without the rates of then');
      assert.ok(!dash(s.fxRows[0]), 'what already happened needs only the current date');
      assert.deepEqual([s.facts[0].value, s.facts[1].value], ['—', '—']);
      assert.match(s.facts[0].text, /Lipsește cursul BNR din 15 sept\. 2026/);
      assert.doesNotMatch(s.text, /lei valorau/, '„Pe scurt” shows no value without the rate of then');

      // Rates typed by the user stay theirs: a new date no longer replaces them.
      await type('eur0', '5,25');
      await type('usd0', '4,65');
      await type('d0', '2026-10-01');
      s = await state();
      assert.equal(s.formErr, null);
      assert.deepEqual([s.v.eur0, s.v.usd0], ['5,25', '4,65']);
      assert.match(s.fxHint, /Atunci: cursul introdus de tine\./);

      await type('d1', '2026-11-05');
      s = await state();
      assert.equal(s.formErr, 'Verifică: data curentă nu poate fi în viitor.');
      assert.ok(s.invalid.includes('d1'));
      assert.match(s.fresh, /Curs: BNR, 28 oct\. 2026/);
      assert.deepEqual(problems, []);

      // "Today" is the visitor's date: at 00:30 in Bucharest it is already 30 October, while in UTC it is still the 29th.
      await open({ now: '2026-10-29T22:30:00Z' });
      await type('d1', '2026-10-30');
      s = await state();
      assert.equal(s.formErr, null, 'today is not in the future');
      assert.match(s.fxHint, /Acum: cursul BNR din 28 oct\. 2026, ultima zi cu curs până la 30 oct\. 2026\./);
    });
  });

  test('the counter: a stopwatch from the page\'s opening, once a second, and under it the loss since 1 January (F-91, F-85)', async () => {
    const now = '2026-11-01T10:00:00Z'; // noon in Bucharest, 304.5 days into the year
    await intercept(json(FIXTURE), async () => {
      await open({ now });
      const p = { S: 50000, pi: 0.065, rate: 0, tax: 0.1, fees: 0, net: true };
      const perSecond = (q) => -C.lossRatePerYear(q) / (365 * 86400);
      const sinceJan = (q) => C.realLoss(q, C.secondsSinceYearStart(Date.parse(now), -120, -120) / 86400);
      // One snapshot: the loop writes the label, the counter and the line under it in the same tick.
      const read = () => js("['tkLabel', 'tk', 'tkNote', 'tkYear'].map((id) => document.getElementById(id).textContent)")
        .then(([label, tk, note, year]) => ({ label, note, year, secs: Number(label.match(/\((\d+) s\)/)?.[1]), total: -cellValue(tk), tk }));
      const after = (n, what) => until(async () => { const r = await read(); return r.secs >= n && r; }, what, 8000);
      const lossSinceJan = (r) => cellValue(r.year.replace('De la 1 ianuarie 2026: ', ''));

      // Each whole second adds the loss of a second: about 0,0001 lei for 50.000 lei.
      let r = await after(2, 'two seconds on the stopwatch');
      assert.match(r.label, /^Pentru 50\.000 lei, de când ai deschis pagina \(\d+ s\), ai pierdut:$/);
      assert.ok(Math.abs(r.total - r.secs * perSecond(p)) < 0.00006, `${r.tk} after ${r.secs} s`);
      assert.equal(r.note, 'Ritm actual: −0,3594 lei pe oră | −8,63 lei pe zi (inflație 6,5%/an, fără dobândă).');
      assert.ok(Math.abs(lossSinceJan(r) - sinceJan(p)) < 1, `${r.year}: about ${sinceJan(p).toFixed(2)} lei`);

      // A new sum recounts every second since the page opened at its pace; the year is recomputed too.
      const n1 = r.secs;
      await type('sum', '50.000.000');
      const big = { ...p, S: 50000000 };
      r = await after(n1 + 1, 'one more second');
      const k = Math.abs(r.total / perSecond(big));
      assert.ok(Math.abs(k - r.secs) < 0.01, `${r.tk}: ${k.toFixed(2)} seconds at the new pace, of ${r.secs}`);
      assert.ok(Math.abs(lossSinceJan(r) - sinceJan(big)) < 1, r.year);

      // Interest above inflation: the next seconds are gains, in green.
      await type('rate', '10');
      await type('tax', '0');
      await type('sum', '5.000.000.000');
      await until(async () => (await read()).tk.startsWith('+'), 'a gain once a second has passed', 4000);
      assert.equal(await js("document.getElementById('ticker').classList.contains('is-gain')"), true);
      assert.match((await read()).label, /, ai câștigat:$/);
      assert.match((await read()).year, /^De la 1 ianuarie 2026: \+[\d.]+,\d\d lei$/);

      // A wrong field stops the counter, and the year shows „—”.
      await type('infl', 'abc');
      const stopped = await read();
      await sleep(2100);
      r = await read();
      assert.equal(r.tk, stopped.tk, 'no seconds added while a field is wrong');
      assert.match(r.note, /Contorul e oprit/);
      assert.equal(r.year, 'De la 1 ianuarie 2026: —');
      assert.deepEqual(problems, []);
    });
  });
  test('the line under the counter names the year, and in a new year counts from its own 1 January', async () => {
    const now = '2027-01-02T10:00:00Z'; // noon in Bucharest, 1.5 days into 2027
    await intercept(json(FIXTURE), async () => {
      await open({ now });
      const year = await until(async () => { const t = await js("document.getElementById('tkYear').textContent"); return /\d,\d\d lei$/.test(t) && t; }, 'the loss since 1 January', 4000);
      const p = { S: 50000, pi: 0.065, rate: 0, tax: 0.1, fees: 0, net: true };
      const expected = C.realLoss(p, C.secondsSinceYearStart(Date.parse(now), -120, -120) / 86400);
      assert.match(year, /^De la 1 ianuarie 2027: −[\d.]+,\d\d lei$/);
      assert.ok(Math.abs(cellValue(year.replace('De la 1 ianuarie 2027: ', '')) - expected) < 1, `${year}: about ${expected.toFixed(2)} lei`);

      // The counter's number starts where it stays: at zero, the sign's place is kept empty.
      const numberLeft = () => js("document.querySelector('#tk .sgn').getBoundingClientRect().right");
      await type('sum', '0');
      await until(async () => (await js("document.getElementById('tk').textContent")) === '0,0000 lei', 'zero on the counter', 4000);
      const atZero = await numberLeft();
      assert.equal(await js("document.getElementById('ticker').className"), 'ticker is-zero', 'zero is neither a loss nor a gain');
      assert.match(await js("document.getElementById('tkLabel').textContent"), /, nu ai pierdut, nu ai câștigat:$/, 'and the words say so');
      assert.equal(await js("getComputedStyle(document.getElementById('tk')).color"), 'rgb(169, 173, 198)', 'zero in grey');
      await type('sum', '50.000');
      await until(async () => (await js("document.getElementById('tk').textContent")).startsWith('−'), 'a loss on the counter', 4000);
      assert.equal(await numberLeft(), atZero, 'the number does not move when the minus comes');
      assert.deepEqual(problems, []);
    });
  });

  test('without data, or with broken data: the built-in values stay, without errors; the text from the data is not HTML', async () => {
    const bodies = {
      missing: [404, 'not found'],
      'broken JSON': [200, '{"fx":'],
      hostile: [200, JSON.stringify({ ...rates(), fx: { ...rates().fx, source: '<img src=x id=xss>' } })],
    };
    for (const [what, body] of Object.entries(bodies)) {
      await intercept(body, async () => {
        await open({ live: what === 'hostile' });
        await until(() => js("performance.getEntriesByType('resource').some((e) => e.name.includes('data/rates.json') && e.responseEnd > 0)"), 'the data request');
        await js('new Promise((r) => setTimeout(() => r(true), 50))');
        const s = await state();
        assert.equal(s.formErr, null, what);
        assert.doesNotMatch(s.text, /NaN|undefined|Infinity/, what);
        assert.equal(await isLive(), what === 'hostile', what);
        assert.deepEqual(problems.filter((p) => !(what === 'missing' && /404/.test(p))), [], what);
        if (what === 'hostile') {
          assert.equal(await js("!!document.getElementById('xss')"), false, 'the source is shown as text (esc)');
          assert.match(s.fresh, /Curs: <img src=x id=xss>, /);
        }
        if (what === 'missing') {
          // Without the daily history, what already happened is unknown: „—”, never a projection instead (F-84).
          assert.ok(s.fxRows.every(dash), 'no realised values without the history');
          assert.ok(s.fxRows.every((row) => row[0].endsWith('lipsește istoricul zilnic al cursului')), s.fxRows.map((row) => row[0]).join(' | '));
          assert.match(s.fxNote, /Dacă ritmul din ultimul an continuă: /, 'the annual pace needs only the two rates of the form');
          // Without a BNR history (the built-in values), a new date has no rate: no false history.
          const other = shiftDays(s.v.d0, -1);
          await type('d0', other);
          let t = await state();
          assert.equal(t.formErr, `Verifică: cursul BNR din ${roDate(other)} (bnr.ro).`);
          assert.doesNotMatch(t.fxNote, /Dacă ritmul/);
          await type('d0', s.v.d0);
          t = await state();
          assert.equal(t.formErr, null, 'back on the date of the built-in rates');
        }
      });
    }
  });

  test('data that arrives after the user typed in Suma still fills the fields the user did not touch', async () => {
    const next = {
      ...FIXTURE,
      fx: { ...FIXTURE.fx, d0: '2025-10-29', eur0: 5.0901, usd0: 4.3655, d1: '2026-10-29', eur1: 5.3601, usd1: 4.825,
        series: [...FIXTURE.fx.series, ['2026-10-29', 5.3601, 4.825]] },
      inflation: { ...FIXTURE.inflation, month: '2026-10', yoy: 6.1 },
    };
    /** The page with data/rates.json held back until `edit` has typed something, then answered with `next`. */
    const late = async (edit) => {
      let paused = null;
      await intercept((id) => { paused = id; }, async () => {
        await open({ live: false, now: NOW });
        await until(() => paused, 'the data request, paused');
        await edit();
        await cdp.send('Fetch.fulfillRequest', { requestId: paused, responseCode: 200,
          responseHeaders: [{ name: 'content-type', value: 'application/json' }], body: Buffer.from(JSON.stringify(next)).toString('base64') });
        await waitLive();
      });
      return state();
    };
    let s = await late(() => type('sum', '60.000'));
    assert.equal(s.v.sum, '60.000', 'what the user typed stays');
    assert.deepEqual([s.v.d0, s.v.d1, s.v.eur1, s.v.usd1, s.v.infl], ['2025-10-29', '2026-10-29', '5,3601', '4,825', '6,1']);
    assert.match(s.fresh, /Curs: BNR, 29 oct\. 2026/);
    assert.match(s.foot, /29 oct\. 2025 și 29 oct\. 2026/);
    assert.equal(s.formErr, null);
    assert.deepEqual(problems, []);

    // A date changed before the data (no BNR history yet): the dates stay, and the rates follow them once the history arrives.
    s = await late(async () => {
      await type('d0', '2026-10-04');
      assert.match((await state()).formErr, /cursul BNR din 4 oct\. 2026/, 'without the history, no rate for that day yet');
    });
    assert.deepEqual([s.v.d0, s.v.d1, s.v.eur0, s.v.usd0], ['2026-10-04', '2026-10-28', '5,279', '4,6801']);
    assert.equal(s.formErr, null);
    assert.deepEqual(problems, []);
  });

  test('the date list flags old data, with words that depend on whether the daily data arrived', async () => {
    const fresh = async (body, now) => intercept(body, async () => {
      await open({ now, live: body[0] === 200 });
      if (body[0] !== 200) await until(() => js("performance.getEntriesByType('resource').some((e) => e.name.includes('data/rates.json') && e.responseEnd > 0)"), 'the data request');
      return state();
    });
    let s = await fresh(json(FIXTURE), NOW);
    assert.doesNotMatch(s.fresh, /de acum|întârziată|lună nouă|raport nou|depășită/, 'nothing is old on 29 Oct 2026');
    assert.match(s.fresh, /Dobânzi: media BNR la depozite, [a-z]+ \d{4} · Tezaur, [a-z]+ \d{4}/);
    assert.match(s.fresh, /Prognoza BNR: raportul din august 2026/);

    s = await fresh(json(FIXTURE), '2026-12-05T10:00:00Z');
    assert.match(s.fresh, /Curs: BNR, 28 oct\. 2026de acum 38 de zile/);
    assert.match(s.fresh, /septembrie 2026actualizarea pare întârziată/, 'on the site: the daily update has stopped');
    assert.match(s.fresh, /raportul din august 2026a apărut probabil un raport nou/);

    s = await fresh([404, 'not found'], '2026-12-05T10:00:00Z');
    assert.match(s.fresh, /septembrie 2026a apărut probabil o lună nouă/, 'with the built-in values: a new month is out');

    // After its target month, the forecast is no longer offered, nor cited.
    s = await fresh(json(FIXTURE), '2028-01-03T10:00:00Z');
    assert.doesNotMatch(s.text, /Prognoza BNR/);
    assert.doesNotMatch(s.foot, /prognoza/);
    // Each interest rate with its own badge, in words that fit its source.
    assert.match(s.fresh, /Dobânzi: media BNR la depozite, [a-z]+ \d{4}a apărut probabil o lună nouă · Tezaur, [a-z]+ \d{4}poate fi depășită/);
    assert.deepEqual(problems.filter((p) => !/404/.test(p)), []);
  });

  test('themes: the background from the tokens and readable contrast, the counter included (F-01); 320 px: no horizontal scroll', async () => {
    await open({ theme: 'light' });
    const look = async () => js(`({ bg: getComputedStyle(document.body).backgroundColor, worst: (${worstContrast})() })`);
    const frame = () => js('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(true))))');
    const checks = [
      ['light', null, BG.light], ['light', 'dark', BG.dark],
      ['dark', null, BG.dark], ['dark', 'light', BG.light],
    ];
    for (const [media, attr, bg] of checks) {
      await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: media }] });
      await js(attr ? `document.documentElement.dataset.theme = '${attr}'` : 'delete document.documentElement.dataset.theme');
      await frame();
      const l = await look();
      const what = `media ${media}${attr ? `, data-theme="${attr}"` : ''}`;
      assert.equal(l.bg, bg, `${what}: the page background`);
      assert.ok(l.worst.ratio >= 4.5, `${what}: contrast ${l.worst.ratio.toFixed(2)} at ${l.worst.where}`);
    }
    // The smallest phone width (and 400% zoom on a 1280 px screen): the chart shrinks, nothing scrolls sideways (F-10).
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 320, height: 800, deviceScaleFactor: 1, mobile: true });
    await until(() => js("document.getElementById('ch').textContent.includes('+5 ani')"), 'the chart redrawn at 320 px');
    await frame();
    const m = await js(`({ sw: document.documentElement.scrollWidth, iw: innerWidth, ch: document.getElementById('ch').textContent })`);
    assert.ok(m.sw <= m.iw, `scrollWidth ${m.sw} > ${m.iw}`);
    assert.match(m.ch, /\+5 ani/);
    assert.doesNotMatch(m.ch, /\+2 ani/);
    assert.deepEqual(problems, []);
  });

  test('on a phone both tables show every period, one per line, without sideways scrolling or broken numbers, and stay tables for screen readers (O-18, F-80, F-84)', async () => {
    const layout = () => js(`(() => {
      const wraps = [...document.querySelectorAll('.tablewrap')];
      const tds = [...document.querySelectorAll('#tb td, #fxb td')];
      const outside = (td) => { const box = td.closest('.tablewrap').getBoundingClientRect(), r = td.getBoundingClientRect(); return r.left < box.left - 0.5 || r.right > box.right + 0.5; };
      return {
        tables: wraps.length,
        sw: Math.max(...wraps.map((w) => w.scrollWidth - w.clientWidth)), cw: 0,
        out: tds.filter(outside).map((td) => td.textContent),
        labels: [...document.querySelectorAll('#fxb tr:first-child td')].slice(1).map((td) => getComputedStyle(td, '::before').content),
        // Content wider than its cell runs into the next one.
        overflowing: tds.filter((td) => td.scrollWidth > td.clientWidth + 0.5).map((td) => td.textContent),
        // A value split over two lines: „−6.035.034,2” / „7 lei”.
        broken: tds.filter((td) => td.dataset.period).filter((td) => {
          const range = document.createRange();
          range.selectNodeContents(td);
          return new Set([...range.getClientRects()].map((r) => Math.round(r.top))).size > 1;
        }).map((td) => td.textContent),
        display: getComputedStyle(tds[1]).display,
      };
    })()`);
    let m;
    // 320 px is the narrowest phone; 5 billion lei gives the longest values („−305.164.319,25 lei”).
    for (const width of [320, 400]) {
      await open({ width });
      for (const sum of ['50.000', '5.000.000.000']) {
        await type('sum', sum);
        m = await layout();
        const at = `at ${width} px, sum ${sum}`;
        assert.equal(m.tables, 2);
        assert.ok(m.sw <= m.cw, `a table scrolls sideways ${at}, by ${m.sw} px`);
        assert.deepEqual(m.out, [], `values outside the table ${at}`);
        assert.deepEqual(m.overflowing, [], `values wider than their cell ${at}`);
        assert.deepEqual(m.broken, [], `values split over two lines ${at}`);
        assert.deepEqual(m.labels, [...C.PERIODS].map((q) => `"${q.label}"`), 'each value with its period');
      }
    }
    await cdp.send('Accessibility.enable');
    try {
      const { nodes } = await cdp.send('Accessibility.getFullAXTree');
      const named = (role) => nodes.filter((n) => n.role?.value === role && !n.ignored).map((n) => n.name?.value);
      assert.equal(named('table').length, 2, 'the table role survives the phone layout');
      const lower = (a) => a.map((s) => s.toLowerCase());
      const periods = C.PERIODS.map((q) => q.label);
      assert.deepEqual(lower(named('columnheader')), lower(['Cauza', ...periods, 'Valuta', ...periods]), 'the hidden header rows are still read (in capitals: text-transform)');
      assert.equal(named('row').length, 5, 'a header row and inflation; a header row, EUR and USD');
    } finally {
      await cdp.send('Accessibility.disable');
    }
    // On a wide screen it is the usual table, the periods in the header row.
    await open({ width: 1280 });
    m = await layout();
    assert.equal(m.display, 'table-cell');
    assert.deepEqual(m.labels, [...C.PERIODS].map(() => 'none'));
    // Large sums on a wide screen: values too long to sit side by side get the phone layout too, never a sideways scroll.
    for (const sum of ['10.000.000', '5.000.000.000']) {
      await type('sum', sum);
      m = await layout();
      assert.ok(m.sw <= m.cw, `at 1280 px, sum ${sum}: a table scrolls sideways, by ${m.sw} px`);
      assert.deepEqual(m.overflowing, [], `values wider than their cell at 1280 px, sum ${sum}`);
      assert.deepEqual(m.broken, [], `values split over two lines at 1280 px, sum ${sum}`);
    }
    assert.deepEqual(problems, []);
  });

  test('on a phone the chart is not scaled down: its labels keep their size (F-81)', async () => {
    for (const width of [320, 360, 375]) {
      await open({ width });
      const scale = await js("(() => { const svg = document.getElementById('ch'); return svg.getBoundingClientRect().width / Number(svg.getAttribute('viewBox').split(' ')[2]); })()");
      assert.ok(scale > 0.999, `at ${width} px the chart is drawn at ${scale.toFixed(3)} of its size`);
    }
    assert.deepEqual(problems, []);
  });

  test('on a touch screen every field and button is at least 44 px tall (F-82)', async () => {
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    try {
      await open({ width: 375 });
      assert.equal(await js("matchMedia('(pointer: coarse)').matches"), true, 'the touch screen is emulated');
      const small = await js(`[...document.querySelectorAll('input, button')]
        .map((el) => [el.id || el.textContent.trim(), el.getBoundingClientRect().height]).filter(([, h]) => h < 44)`);
      assert.deepEqual(small, []);
    } finally {
      await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: false });
    }
    assert.deepEqual(problems, []);
  });

  test('the counter ticks once a second, like a stopwatch, with or without reduced motion (F-91, O-17)', async () => {
    await open();
    // Updates of the counter's text during `ms`: the loop rewrites it on every tick.
    const updates = (ms) => js(`new Promise((r) => {
      let n = 0;
      const o = new MutationObserver(() => n++);
      o.observe(document.getElementById('tk'), { childList: true, characterData: true, subtree: true });
      setTimeout(() => { o.disconnect(); r(n); }, ${ms});
    })`);
    const motion = (value) => cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }, { name: 'prefers-reduced-motion', value }] });
    try {
      for (const value of ['no-preference', 'reduce']) {
        await motion(value);
        const n = await updates(3000);
        assert.ok(n >= 2 && n <= 4, `${n} updates in 3 s (${value})`);
      }
    } finally {
      await motion('');
    }
    assert.deepEqual(problems, []);
  });
});
