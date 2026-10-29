// The real page in headless Chrome, over the DevTools protocol (the WebSocket built into Node 22+). No dependencies.
// It catches what the static tests cannot: runtime errors in the page script, the CSP as the browser applies it,
// loading data/rates.json, the form's validation, the themes, a phone's width.
// The page is the site build, served under /taxa-pe-stat/ as on GitHub Pages: a path that starts with / breaks there.
// Skipped when Chrome is missing (CHROME_PATH or the usual places), when Node has no global WebSocket, or with E2E=0.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep, extname } from 'node:path';
import vm from 'node:vm';
import { build } from '../build.mjs';

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

const html = readFileSync(new URL('../app.html', import.meta.url), 'utf8');
const ctx = vm.createContext({});
vm.runInContext(html.match(/<script id="calc">([\s\S]*?)<\/script>/)[1], ctx);
const C = ctx.Calc;
// The data written by the bot: read when the test runs, so the test does not depend on today's values.
const rates = () => JSON.parse(readFileSync(new URL('../data/rates.json', import.meta.url), 'utf8'));
const tokens = html.match(/\/\* tokens:start \*\/([\s\S]*?)\/\* tokens:end \*\//)[1];
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
      facts: [...document.querySelectorAll('#facts .fact')].map((f) => ({ value: f.querySelector('b').textContent, cls: f.querySelector('b').className, text: f.querySelector('span').textContent })),
      invalid: [...document.querySelectorAll('[aria-invalid="true"]')].map((e) => e.id),
      formErr: $('formErr').hidden ? null : $('formErr').textContent,
      fresh: $('fresh').textContent,
      fxHint: $('fxHint').className + ': ' + $('fxHint').textContent,
      modeHint: $('modeHint').textContent,
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
    chrome = spawn(CHROME, [
      '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`,
      '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--disable-sync',
      '--disable-background-networking', '--disable-component-update', '--mute-audio', '--hide-scrollbars',
      // GitHub's Ubuntu runners restrict the namespaces Chrome's sandbox needs.
      ...(process.platform === 'linux' && process.env.CI ? ['--no-sandbox'] : []),
      'about:blank',
    ], { stdio: 'ignore' });
    // With port 0, Chrome picks a free port and writes it here: no collisions when several tests run.
    const [port, path] = await until(async () => {
      if (chrome.exitCode !== null) throw new Error(`Chrome stopped at startup (code ${chrome.exitCode}): ${CHROME}`);
      const [p, b] = (await readFile(join(profile, 'DevToolsActivePort'), 'utf8').catch(() => '')).split(/\r?\n/);
      return /^\d+$/.test(p) && b ? [p, b] : null;
    }, 'the DevTools port of Chrome', 30000);
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
    const expected = [
      C.PERIODS.map((q) => C.realLoss(p, q.days)),
      C.PERIODS.map((q) => C.fxLoss(p, fx('eur').annual, n('eur1'), q.days)),
      C.PERIODS.map((q) => C.fxLoss(p, fx('usd').annual, n('usd1'), q.days)),
    ];
    assert.equal(s.rows.length, 3);
    s.rows.forEach((row, i) => row.slice(1).forEach((cell, j) =>
      assert.ok(Math.abs(cellValue(cell) - expected[i][j]) < 0.0051, `row ${i + 1}, ${C.PERIODS[j].label}: ${cell} ≠ ${expected[i][j]}`)));
    // „Pe scurt” is computed in the page script (renderFacts), not in Calc: this is where it is checked (DESIGN §5.4).
    const shown = s.facts.map((f) => -cellValue(f.value.replace(/%$/, '')));
    const want = [p.S / n('eur1') - p.S / n('eur0'), p.S / n('usd1') - p.S / n('usd0'),
      -C.realLoss({ S: p.S, pi: p.pi, net: false }, 365), C.breakEvenRate(p.pi, p.tax, p.fees, p.S) * 100];
    want.forEach((w, i) => assert.ok(Math.abs(shown[i] - w) < 0.0051, `Pe scurt #${i + 1}: ${s.facts[i].value} ≠ ${w}`));
    if (p.rate === 0) assert.match(s.modeHint, /^Bani ținuți fără dobândă/, 'F-14: no „dobânda netă de 0,00%”');
    // The counter's sign follows the data: a loss with inflation, a gain with deflation (F-07). With 50 million,
    // the first visible decimal appears within ~0.1 s even at a low inflation.
    const perYear = C.lossRatePerYear(p);
    if (perYear !== 0) {
      await type('sum', '50.000.000');
      const t = await until(async () => { const v = (await state()).ticker; return v !== '0,0000 lei' && v; }, 'the counter starts', 5000);
      assert.match(t, perYear > 0 ? /^−\d+,\d{4} lei$/ : /^\+\d+,\d{4} lei$/);
    }
  });

  test('wrong fields are marked and the affected rows show „—” (F-02…F-05, F-08, F-09); the texts follow the numbers', async () => {
    await open();
    await type('infl', 'abc');
    let s = await state();
    assert.deepEqual(s.invalid, ['infl']);
    assert.match(s.formErr, /inflația/);
    assert.ok(s.rows.every(dash));
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
    assert.ok(!dash(s.rows[0]) && dash(s.rows[1]) && dash(s.rows[2]), 'F-03: only the exchange-rate rows show „—”');

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
    assert.ok(s.invalid.includes('eur0') && dash(s.rows[1]));
    assert.match(s.formErr, /cursul EUR de atunci/);
    await type('eur0', '53,495');
    s = await state();
    assert.deepEqual(s.invalid, ['eur0', 'eur1']);
    assert.match(s.formErr, /cursurile EUR de atunci și de acum nu par reale/);
    assert.doesNotMatch(s.text, /∞|NaN/);
    // A wrong first digit over 1 day is a plausible pair, but no pace can be extrapolated from it.
    await type('d0', shiftDays(r.fx.d1, -1));
    await type('eur0', '7,3495');
    s = await state();
    assert.match(s.rows[1][0], /ritmul anual nu se poate extrapola/);
    assert.ok(dash(s.rows[1]));
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

    await type('sum', '-0');
    s = await state();
    assert.match(s.text, /Pentru 0 lei, de când/);
    assert.doesNotMatch(s.text, /[-−]0(?:[,.]0+)?(?![\d,.])/, 'no zero with a sign');
    await type('sum', '0');
    s = await state();
    assert.ok(s.rows.flatMap((row) => row.slice(1)).every((c) => /^0,00 (lei|€|\$)$/.test(c)), 'F-08: zero without a sign');

    await click('#mRaw');
    await click('#mNet');
    await click('.chip[data-rate="5.5"]');
    s = await state();
    assert.equal(s.v.rate, '5,5');
    assert.equal(await js(`document.querySelector('.chip[data-rate="5.5"]').getAttribute('aria-pressed')`), 'true');
    assert.deepEqual(problems, []);
    assert.deepEqual(s.csp, []);
  });

  test('a date change takes the BNR rate of that day; without one, the page says so and computes nothing', async () => {
    await intercept(json(FIXTURE), async () => {
      await open({ now: NOW });
      let s = await state();
      assert.match(s.fxHint, /Atunci: cursul BNR din 28 oct\. 2025\. Acum: cursul BNR din 28 oct\. 2026\./);

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
      assert.ok(dash(s.rows[1]) && dash(s.rows[2]));
      assert.deepEqual([s.facts[0].value, s.facts[1].value], ['—', '—']);
      assert.match(s.facts[0].text, /Lipsește cursul BNR din 15 sept\. 2026/);
      assert.doesNotMatch(s.text, /valorau/);

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
          // Without a BNR history (the built-in values), a new date has no rate: no false history.
          const other = shiftDays(s.v.d0, -1);
          await type('d0', other);
          let t = await state();
          assert.equal(t.formErr, `Verifică: cursul BNR din ${roDate(other)} (bnr.ro).`);
          assert.ok(dash(t.rows[1]) && dash(t.rows[2]));
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
    assert.doesNotMatch(s.fresh, /de acum|întârziată|lună nouă|raport nou/, 'nothing is old on 29 Oct 2026');
    assert.match(s.fresh, /Prognoza BNR: raportul din august 2026/);

    s = await fresh(json(FIXTURE), '2026-12-05T10:00:00Z');
    assert.match(s.fresh, /Curs: BNR, 28 oct\. 2026de acum 38 de zile/);
    assert.match(s.fresh, /septembrie 2026actualizarea pare întârziată/, 'on the site: the daily update has stopped');
    assert.match(s.fresh, /raportul din august 2026a apărut probabil un raport nou/);
    assert.match(s.fresh, /Dobânzi: orientative, [a-z]+ 2026pot fi depășite/);

    s = await fresh([404, 'not found'], '2026-12-05T10:00:00Z');
    assert.match(s.fresh, /septembrie 2026a apărut probabil o lună nouă/, 'with the built-in values: a new month is out');

    // After its target month, the forecast is no longer offered, nor cited.
    s = await fresh(json(FIXTURE), '2028-01-03T10:00:00Z');
    assert.doesNotMatch(s.text, /Prognoza BNR/);
    assert.doesNotMatch(s.foot, /prognoza/);
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

  test('on a phone the loss table shows every period, one per line, without sideways scrolling or broken numbers, and stays a table for screen readers (O-18, F-80)', async () => {
    const layout = () => js(`(() => {
      const wrap = document.querySelector('.tablewrap'), box = wrap.getBoundingClientRect();
      const tds = [...document.querySelectorAll('#tb td')];
      return {
        sw: wrap.scrollWidth, cw: wrap.clientWidth,
        out: tds.filter((td) => { const r = td.getBoundingClientRect(); return r.left < box.left - 0.5 || r.right > box.right + 0.5; }).map((td) => td.textContent),
        labels: tds.slice(1, 5).map((td) => getComputedStyle(td, '::before').content),
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
        assert.ok(m.sw <= m.cw, `the table scrolls sideways ${at}: ${m.sw} > ${m.cw}`);
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
      assert.equal(named('table').length, 1, 'the table role survives the phone layout');
      const lower = (a) => a.map((s) => s.toLowerCase());
      assert.deepEqual(lower(named('columnheader')), lower(['Cauza', ...C.PERIODS.map((q) => q.label)]), 'the hidden header row is still read (in capitals: text-transform)');
      assert.equal(named('row').length, 4);
    } finally {
      await cdp.send('Accessibility.disable');
    }
    // On a wide screen it is the usual table, the periods in the header row.
    await open({ width: 1280 });
    m = await layout();
    assert.equal(m.display, 'table-cell');
    assert.deepEqual(m.labels, [...C.PERIODS].map(() => 'none'));
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
      const small = await js(`[...document.querySelectorAll('input, .chip, .toggle button')]
        .map((el) => [el.id || el.textContent.trim(), el.getBoundingClientRect().height]).filter(([, h]) => h < 44)`);
      assert.deepEqual(small, []);
    } finally {
      await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: false });
    }
    assert.deepEqual(problems, []);
  });

  test('turning on reduced motion slows the counter to one update a second, without a reload (O-17)', async () => {
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
      assert.ok((await updates(1000)) >= 5, 'about 10 updates a second at first');
      await motion('reduce');
      await sleep(1100); // the tick already scheduled
      const slow = await updates(2500);
      assert.ok(slow <= 3, `${slow} updates in 2.5 s with reduced motion`);
      await motion('no-preference');
      await sleep(1100);
      assert.ok((await updates(1000)) >= 5, 'fast again once it is turned off');
    } finally {
      await motion('');
    }
    assert.deepEqual(problems, []);
  });
});
