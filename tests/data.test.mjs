// Automatic data: parsing the sources (BNR, ECB, Eurostat), picking the rate from a year ago,
// the fallbacks when a source fails, and the validation in the page. No network: fetch is simulated,
// but every request goes through the same validation as with the real fetch (F-38).
import { test, describe, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import vm from 'node:vm';
import {
  parseBnrXml, parseCsv, parseEcbCsv, mergeSeries, pickYearAgo, fxFromSeries, parseEurostat,
  buildInflation, shiftYear, shiftDays, main, UA,
} from '../scripts/update-data.mjs';

const html = readFileSync(new URL('../app.html', import.meta.url), 'utf8');
const ctx = vm.createContext({});
vm.runInContext(html.match(/<script id="calc">([\s\S]*?)<\/script>/)[1], ctx);
const C = ctx.Calc;

/* ---------- fixtures, in the real format of the sources ---------- */

const bnrXml = (cubes) => `<?xml version="1.0" encoding="utf-8"?>
<DataSet xmlns="http://www.bnr.ro/xsd">
  <Header><Publisher>National Bank of Romania</Publisher><PublishingDate>2026-10-28</PublishingDate><MessageType>DR</MessageType></Header>
  <Body><Subject>Reference rates</Subject><OrigCurrency>RON</OrigCurrency>
${cubes.map(([d, eur, usd]) => `    <Cube date="${d}">
      <Rate currency="AED">1.3093</Rate>
      <Rate currency="EUR">${eur}</Rate>
      <Rate currency="HUF" multiplier="100">1.4526</Rate>
      <Rate currency="USD">${usd}</Rate>
    </Cube>`).join('\n')}
  </Body>
</DataSet>`;

const ECB_CSV = `KEY,FREQ,CURRENCY,CURRENCY_DENOM,EXR_TYPE,EXR_SUFFIX,TIME_PERIOD,OBS_VALUE,OBS_STATUS,TITLE
EXR.D.RON.EUR.SP00.A,D,RON,EUR,SP00,A,2025-10-28,5.0850,A,"Romanian leu/Euro, ""ECB"" reference"
EXR.D.USD.EUR.SP00.A,D,USD,EUR,SP00,A,2025-10-28,1.1660,A,US dollar/Euro
EXR.D.RON.EUR.SP00.A,D,RON,EUR,SP00,A,2026-10-27,5.3480,A,Romanian leu/Euro
EXR.D.RON.EUR.SP00.A,D,RON,EUR,SP00,A,2026-10-28,5.3502,A,Romanian leu/Euro
EXR.D.USD.EUR.SP00.A,D,USD,EUR,SP00,A,2026-10-28,1.1125,A,US dollar/Euro
`;

const eurostatJson = (values, months = ['2026-06', '2026-07', '2026-08', '2026-09']) => ({
  version: '2.0', class: 'dataset', id: ['freq', 'unit', 'coicop18', 'geo', 'time'], size: [1, 1, 1, 1, months.length],
  dimension: { time: { category: { index: Object.fromEntries(months.map((m, i) => [m, i])) } } },
  value: Object.fromEntries(values.map((v, i) => [i, v]).filter(([, v]) => v !== null)),
});

describe('BNR: the reference rates XML', () => {
  test('reads EUR and USD for each day, in order', () => {
    const rows = parseBnrXml(bnrXml([['2026-10-28', 5.3495, 4.8088], ['2026-10-27', 5.3487, 4.7977]]));
    assert.equal(rows.length, 2);
    assert.equal(rows[0].date, '2026-10-27');
    assert.equal(rows[1].EUR, 5.3495);
    assert.equal(rows[1].USD, 4.8088);
  });
  test('honours the multiplier attribute', () => {
    const xml = '<Cube date="2026-10-28"><Rate currency="EUR">5.3495</Rate><Rate currency="USD" multiplier="100">480.88</Rate></Cube>';
    assert.equal(parseBnrXml(xml)[0].USD, 4.8088);
  });
  test('ignores days without EUR or USD, and broken text', () => {
    assert.equal(parseBnrXml('<Cube date="2026-10-28"><Rate currency="EUR">5.3495</Rate></Cube>').length, 0);
    assert.equal(parseBnrXml('<html>Access denied</html>').length, 0);
    assert.equal(parseBnrXml('').length, 0);
  });
});

describe('ECB: the fallback', () => {
  test('CSV with quotes and commas inside fields', () => {
    assert.deepEqual(parseCsv('a,"b, ""c""",d\n1,2,3\n'), [['a', 'b, "c"', 'd'], ['1', '2', '3']]);
  });
  test('converts EUR→RON and EUR→USD into lei for 1 EUR and 1 USD', () => {
    const rows = parseEcbCsv(ECB_CSV);
    assert.equal(rows.length, 2, 'the day without USD is ignored');
    assert.equal(rows[1].date, '2026-10-28');
    assert.equal(rows[1].EUR, 5.3502);
    assert.ok(Math.abs(rows[1].USD - 5.3502 / 1.1125) < 1e-12);
  });
  test('a response without the expected columns gives an empty series', () => {
    assert.equal(parseEcbCsv('<html>robots</html>').length, 0);
  });
});

describe('the rate from a year ago', () => {
  const series = mergeSeries(
    [{ date: '2025-10-24', EUR: 5.08, USD: 4.36 }, { date: '2025-10-27', EUR: 5.0848, USD: 4.3684 }],
    [{ date: '2026-10-26', EUR: 5.34, USD: 4.79 }, { date: '2026-10-27', EUR: 5.3487, USD: 4.7977 }],
  );
  test('the same day last year, or the last working day before it', () => {
    assert.equal(pickYearAgo(series, '2026-10-27').date, '2025-10-27');
    assert.equal(pickYearAgo(series, '2026-10-26').date, '2025-10-24', '26 Oct 2025 was a Sunday');
  });
  test('does not guess without data that is old enough', () => {
    assert.equal(pickYearAgo(series.slice(2), '2026-10-27'), null);
    assert.equal(pickYearAgo([{ date: '2025-09-01', EUR: 5, USD: 4 }, ...series.slice(2)], '2026-10-27'), null, 'a gap of over 10 days');
  });
  test('29 February becomes 28 February', () => assert.equal(shiftYear('2028-02-29', -1), '2027-02-28'));
  test('the fx section: now, a year ago, the recent history', () => {
    const fx = fxFromSeries(series, 'BNR');
    assert.equal(fx.source, 'BNR');
    assert.equal(fx.d0, '2025-10-27');
    assert.equal(fx.d1, '2026-10-27');
    assert.equal(fx.eur1, 5.3487);
    assert.equal(fx.series.length, 4);
    assert.deepEqual(fx.series.at(-1), ['2026-10-27', 5.3487, 4.7977]);
    assert.equal(fxFromSeries([], 'BNR'), null);
  });
});

describe('Eurostat: inflation', () => {
  test('the latest month with data', () => {
    assert.deepEqual(parseEurostat(eurostatJson([9.2, 8.2, 6.3, 6.5])), { month: '2026-09', value: 6.5 });
    assert.deepEqual(parseEurostat(eurostatJson([9.2, 8.2, 6.3, null])), { month: '2026-08', value: 6.3 }, 'the month without a value is skipped');
  });
  test('rejects responses with several series or without data', () => {
    assert.equal(parseEurostat({ ...eurostatJson([1, 2, 3, 4]), size: [1, 1, 2, 1, 4] }), null);
    assert.equal(parseEurostat({ error: 'nu există' }), null);
    assert.equal(parseEurostat(null), null);
  });
  test('combines the series; fills in from the old data only for the same month', () => {
    const ro = { month: '2026-09', value: 6.5 };
    const full = buildInflation({ ro, services: { month: '2026-09', value: 9.3 }, avg12: { month: '2026-09', value: 8.4 }, euroArea: { month: '2026-09', value: 3.8 } });
    assert.deepEqual(full, { source: 'Eurostat (IAPC)', month: '2026-09', yoy: 6.5, services: 9.3, avg12: 8.4, euroArea: 3.8, euroAreaMonth: '2026-09' });
    const prev = { month: '2026-08', yoy: 6.3, services: 9.7 };
    assert.equal(buildInflation({ ro }, prev).services, undefined, 'services from August are not mixed with September');
    assert.equal(buildInflation({ ro: null }, prev), prev, 'without new data, the old data stays');
  });
  test('an older month never replaces a newer one (F-51)', () => {
    const prev = { source: 'Eurostat (IAPC)', month: '2026-09', yoy: 6.5, services: 9.3, euroArea: 3.8, euroAreaMonth: '2026-09' };
    assert.equal(buildInflation({ ro: { month: '2026-08', value: 6.6 } }, prev), prev, 'Romania: the previous data stays');
    const d = buildInflation({ ro: { month: '2026-09', value: 6.5 }, euroArea: { month: '2026-08', value: 3.2 } }, prev);
    assert.deepEqual([d.euroArea, d.euroAreaMonth], [3.8, '2026-09'], 'the euro area keeps its newer month');
    const next = buildInflation({ ro: { month: '2026-10', value: 6.1 } }, prev);
    assert.deepEqual([next.month, next.yoy, next.services], ['2026-10', 6.1, undefined], 'a newer month replaces, without mixing in September');
  });
});

describe('the validation in the page (normalizeRates)', () => {
  const good = JSON.parse(readFileSync(new URL('../data/rates.json', import.meta.url), 'utf8'));
  test('data/rates.json in the repo is valid', () => {
    const d = C.normalizeRates(good);
    assert.equal(d.fx.d1, good.fx.d1);
    assert.equal(d.inflation.yoy, good.inflation.yoy);
  });
  test('a broken section is ignored, the other one stays', () => {
    const d = C.normalizeRates({ ...good, fx: { ...good.fx, eur1: 'mult' } });
    assert.equal(d.fx, undefined);
    assert.equal(d.inflation.month, good.inflation.month);
    assert.equal(C.normalizeRates({ ...good, inflation: { month: '2026-13', yoy: 6 } }).inflation, undefined);
    assert.equal(C.normalizeRates({ ...good, fx: { ...good.fx, d0: good.fx.d1 } }).fx, undefined, 'a 0-day interval');
  });
  test('anything else → null', () => {
    for (const bad of [null, 'text', 42, {}, { fx: null, inflation: null }]) assert.equal(C.normalizeRates(bad), null);
  });
  test('the source is shortened (it appears in the page)', () => {
    assert.equal(C.normalizeRates({ ...good, fx: { ...good.fx, source: 'x'.repeat(200) } }).fx.source.length, 40);
  });
});

test('ASCII-only User-Agent: otherwise fetch rejects every request (F-38)', () => {
  assert.match(UA, /^[\x20-\x7e]+$/);
});

describe('the daily script, with a simulated network', () => {
  let dir;
  let baseline;
  const realFetch = globalThis.fetch;
  const today = '2026-10-29';

  // Working days, as in the real files; the known rates are the ones in DESIGN §2.
  const KNOWN = { '2025-10-27': [5.0848, 4.3684], '2025-10-28': [5.0844, 4.3591], '2026-10-27': [5.3487, 4.7977], '2026-10-28': [5.3495, 4.8088] };
  const cubes = (from, to, skip = []) => {
    const out = [];
    for (let d = from; d <= to; d = shiftDays(d, 1)) {
      if (![0, 6].includes(new Date(d + 'T00:00:00Z').getUTCDay()) && !skip.includes(d)) out.push([d, ...(KNOWN[d] ?? [5.2, 4.6])]);
    }
    return out;
  };

  // The simulated sources answer only at their exact addresses, like the real ones (F-31, F-40).
  const BNR = 'https://curs.bnr.ro/';
  const YEAR = (y) => `${BNR}files/xml/years/nbrfxrates${y}.xml`;
  const TEN = `${BNR}nbrfxrates10days.xml`;
  const ECB = 'https://data-api.ecb.europa.eu/service/data/EXR/D.RON+USD.EUR.SP00.A';
  const EUROSTAT = 'https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/prc_hicp_minr';
  // The BNR files, by full address; any other BNR address gives 404. null = a file that does not exist yet (502).
  const october = {
    [YEAR(2025)]: bnrXml(cubes('2025-09-01', '2025-12-31')),
    [YEAR(2026)]: bnrXml(cubes('2026-01-05', '2026-10-27')),
    [TEN]: bnrXml(cubes('2026-10-15', '2026-10-28')),
  };
  // The ECB rates by day (lei for 1 EUR, US dollars for 1 EUR); the API returns only the days from startPeriod on.
  const ECB_DAYS = [['2025-10-28', 5.0850, 1.1660], ['2026-10-28', 5.3502, 1.1125]];
  const ecbCsv = (days) => ['KEY,FREQ,CURRENCY,CURRENCY_DENOM,EXR_TYPE,EXR_SUFFIX,TIME_PERIOD,OBS_VALUE,OBS_STATUS,TITLE',
    ...days.flatMap(([d, ron, usd]) => [`EXR.D.RON.EUR.SP00.A,D,RON,EUR,SP00,A,${d},${ron},A,Romanian leu/Euro`,
      `EXR.D.USD.EUR.SP00.A,D,USD,EUR,SP00,A,${d},${usd},A,US dollar/Euro`])].join('\n') + '\n';
  // Eurostat, by unit|coicop18|geo; an unknown code answers like the real API, with an empty series.
  const SERIES = {
    'RCH_A|TOTAL|RO': eurostatJson([9.2, 8.2, 6.3, 6.5]),
    'RCH_A|SERV|RO': eurostatJson([9.9, 9.8, 9.7, 9.3]),
    'RCH_MV12MAVR|TOTAL|RO': eurostatJson([9.6, 9.3, 8.8, 8.4]),
    'RCH_A|TOTAL|EA': eurostatJson([2.9, 3.2, 3.8], ['2026-07', '2026-08', '2026-09']),
  };
  const EMPTY = { ...eurostatJson([]), size: [1, 1, 0, 1, 4], value: {} };
  const respond = (body, status = 200) => ({ ok: status < 400, status, text: async () => body });
  const homepage = { ok: true, status: 200, redirected: true, url: 'https://www.bnr.ro/', text: async () => '<html>BNR</html>' };
  const requested = [];
  const everyRequest = [];
  const badInit = [];
  const mock = ({ bnr = true, ecb = true, stat = true, files = october, ecbDays = ECB_DAYS, series = {}, fail = {} } = {}) => async (url, init) => {
    const req = new Request(url, init); // the same validation as the real fetch (F-38)
    if (req.headers.get('user-agent') !== UA || !(init?.signal instanceof AbortSignal)) badInit.push(String(url));
    url = String(url);
    requested.push(url);
    everyRequest.push(url);
    if (url in fail) return fail[url]();
    const u = new URL(url);
    if (u.hostname.endsWith('bnr.ro')) {
      if (bnr === 'redirect') return homepage;
      if (!bnr) return respond('Access denied', 403);
      if (!(url in files)) return respond('<html>404</html>', 404);
      return files[url] === null ? respond('<html>502 Bad Gateway</html>', 502) : respond(files[url]);
    }
    if (url.startsWith(ECB + '?')) {
      if (!ecb) return respond('', 503);
      if (u.searchParams.get('format') !== 'csvdata') return respond('', 400);
      const start = u.searchParams.get('startPeriod') ?? '';
      return respond(ecbCsv(ecbDays.filter(([d]) => d >= start)));
    }
    if (url.startsWith(EUROSTAT + '?')) {
      if (!stat) throw new TypeError('fetch failed', { cause: Object.assign(new Error('connect ETIMEDOUT'), { code: 'ETIMEDOUT' }) });
      const q = u.searchParams;
      const extra = [...q.keys()].find((k) => !['unit', 'coicop18', 'geo', 'sinceTimePeriod'].includes(k));
      if (extra) return respond(JSON.stringify({ error: [{ status: 400, label: `INVALID_QUERY_DIMENSION: ${extra}` }] }), 400);
      const key = ['unit', 'coicop18', 'geo'].map((k) => q.get(k)).join('|');
      return respond(JSON.stringify(series[key] ?? SERIES[key] ?? EMPTY));
    }
    return respond('<html>404</html>', 404);
  };
  const bnrAsked = () => requested.filter((u) => u.includes('bnr.ro'));
  const askedYears = () => bnrAsked().some((u) => /nbrfxrates\d{4}\.xml$/.test(u));

  // The script's messages are captured: in Actions, the simulated warnings would show up as annotations on the run (F-39).
  const realLog = console.log;
  const logs = [];
  const assertLogged = (re) => assert.ok(logs.some((l) => re.test(l)), `${re} is missing from the script's messages:\n${logs.join('\n')}`);
  const warnings = () => logs.filter((l) => /Warning:|Error:|::warning::|::error::/.test(l));

  // A successful run from scratch: the starting point of the tests with a saved history, so they do not depend on each other.
  const withSaved = async (name, edit = (s) => s) => {
    const file = join(dir, name);
    await writeFile(file, JSON.stringify(edit(JSON.parse(baseline)), null, 2) + '\n');
    return file;
  };
  before(async () => {
    dir = await mkdtemp(join(tmpdir(), 'taxa-pe-stat-date-'));
    console.log = (...args) => logs.push(args.join(' '));
    globalThis.fetch = mock();
    if (!(await main({ today, out: join(dir, 'baseline.json') }))) {
      throw new Error(`the baseline run brought no data; the script's messages:\n${logs.join('\n')}`);
    }
    baseline = await readFile(join(dir, 'baseline.json'), 'utf8');
    process.exitCode = 0;
  });
  beforeEach(() => { logs.length = 0; requested.length = 0; });
  after(async () => {
    console.log = realLog;
    globalThis.fetch = realFetch;
    process.exitCode = 0;
    await rm(dir, { recursive: true, force: true });
  });

  test('first run: the BNR rates and inflation, from the exact addresses', async () => {
    globalThis.fetch = mock();
    const out = join(dir, 'prima.json');
    const d = await main({ today, out });
    assert.deepEqual(warnings(), [], 'no warnings');
    assert.deepEqual(bnrAsked().sort(), [YEAR(2025), YEAR(2026), TEN].sort(), 'the XML files on curs.bnr.ro (F-40)');
    const since = shiftDays(today, -240).slice(0, 7);
    const stat = (unit, coicop, geo) => `${EUROSTAT}?unit=${unit}&coicop18=${coicop}&geo=${geo}&sinceTimePeriod=${since}`;
    assert.deepEqual(requested.filter((u) => u.startsWith(EUROSTAT)).sort(),
      [stat('RCH_A', 'TOTAL', 'RO'), stat('RCH_A', 'SERV', 'RO'), stat('RCH_MV12MAVR', 'TOTAL', 'RO'), stat('RCH_A', 'TOTAL', 'EA')].sort(),
      'the Eurostat dataset prc_hicp_minr and its codes (F-31)');
    assert.equal(d.fx.source, 'BNR');
    assert.equal(d.fx.d0, '2025-10-28');
    assert.equal(d.fx.d1, '2026-10-28');
    assert.equal(d.fx.eur1, 5.3495);
    assert.equal(d.fx.series[0][0], '2025-09-23', 'the history covers 400 days');
    assert.deepEqual(d.inflation, { source: 'Eurostat (IAPC)', month: '2026-09', yoy: 6.5, services: 9.3, avg12: 8.4, euroArea: 3.8, euroAreaMonth: '2026-09' });
    assert.deepEqual(JSON.parse(await readFile(out, 'utf8')), d);
    assert.ok(C.normalizeRates(d), 'the page accepts the written file');
  });
  test('second run with the same data: only the last 10 days, and the file unchanged (so no commit either) (O-14)', async () => {
    globalThis.fetch = mock();
    const out = await withSaved('a-doua.json');
    await main({ today, out });
    assert.equal(await readFile(out, 'utf8'), baseline);
    assert.deepEqual(bnrAsked(), [TEN]);
    assert.deepEqual(warnings(), []);
  });
  test('a new day after yesterday\'s history: only the last 10 days, and today\'s rate gets in (O-14)', async () => {
    globalThis.fetch = mock();
    const out = await withSaved('ieri-istoric.json', (s) => ({
      ...s,
      fx: { ...s.fx, d0: '2025-10-27', eur0: 5.0848, usd0: 4.3684, d1: '2026-10-27', eur1: 5.3487, usd1: 4.7977, series: s.fx.series.filter(([date]) => date < '2026-10-28') },
    }));
    const d = await main({ today, out });
    assert.deepEqual(bnrAsked(), [TEN]);
    assert.deepEqual([d.fx.d1, d.fx.eur1, d.fx.usd1], ['2026-10-28', 5.3495, 4.8088]);
    assert.deepEqual([d.fx.d0, d.fx.eur0, d.fx.usd0], ['2025-10-28', 5.0844, 4.3591], 'the rate from a year ago, from the saved history');
    assert.deepEqual(d.fx.series.at(-1), ['2026-10-28', 5.3495, 4.8088]);
    assert.deepEqual(JSON.parse(await readFile(out, 'utf8')), d);
  });
  test('a correction within the last 10 days replaces the saved value (O-14)', async () => {
    globalThis.fetch = mock();
    const out = await withSaved('corectie.json', (s) => ({ ...s, fx: { ...s.fx, series: s.fx.series.map((r) => (r[0] === '2026-10-27' ? [r[0], 9.9999, 9.9999] : r)) } }));
    const d = await main({ today, out });
    assert.deepEqual(bnrAsked(), [TEN]);
    assert.deepEqual(d.fx.series.find(([date]) => date === '2026-10-27'), ['2026-10-27', 5.3487, 4.7977]);
  });
  test('the history does not connect to the last 10 days (the bot did not run): also fetches the yearly files (O-14)', async () => {
    globalThis.fetch = mock();
    const out = await withSaved('gol.json', (s) => ({ ...s, fx: { ...s.fx, series: s.fx.series.filter(([date]) => date <= '2026-10-09') } }));
    const d = await main({ today, out });
    assert.ok(askedYears());
    assert.ok(d.fx.series.some(([date]) => date === '2026-10-12'), 'the missing days are recovered');
  });
  test('an incomplete history, or one from the ECB: also fetches the yearly files (O-14)', async () => {
    globalThis.fetch = mock();
    const cuts = {
      'two days are not a history': (s) => [s[0], s.at(-1)],
      'a one-month gap': (s) => s.filter(([date]) => date < '2026-03-01' || date > '2026-03-31'),
      'starts inside the 400-day window': (s) => s.filter(([date]) => date >= '2025-10-20'),
    };
    for (const [what, cut] of Object.entries(cuts)) {
      requested.length = 0;
      await main({ today, out: await withSaved('incomplet.json', (s) => ({ ...s, fx: { ...s.fx, series: cut(s.fx.series) } })) });
      assert.ok(askedYears(), what);
    }
    requested.length = 0;
    const d = await main({ today, out: await withSaved('bce-istoric.json', (s) => ({ ...s, fx: { ...s.fx, source: 'BCE (rezervă)' } })) });
    assert.ok(askedYears(), 'the ECB history is not mixed into the BNR one');
    assert.equal(d.fx.source, 'BNR');
  });
  test('broken rows in the saved history do not stop BNR (F-53)', async () => {
    globalThis.fetch = mock();
    const out = await withSaved('rand-stricat.json', (s) => ({ ...s, fx: { ...s.fx, series: [['garbage', 5, 4], ...s.fx.series, [null, 5, 4], ['2026-10-29', -1, 4]] } }));
    const d = await main({ today, out });
    assert.equal(d.fx.source, 'BNR');
    assert.deepEqual(bnrAsked(), [TEN], 'the rest of the history is still used');
    assert.deepEqual(warnings(), []);
  });
  test('BNR refuses: switches to the ECB, at its exact address', async () => {
    globalThis.fetch = mock({ bnr: false });
    const d = await main({ today, out: join(dir, 'bce.json') });
    assertLogged(/BNR rates unavailable; trying the ECB/);
    assert.deepEqual(requested.filter((u) => u.startsWith(ECB)), [`${ECB}?startPeriod=${shiftDays(today, -410)}&format=csvdata`]);
    assert.equal(d.fx.source, 'BCE (rezervă)');
    assert.equal(d.fx.d1, '2026-10-28');
    assert.equal(d.fx.d0, '2025-10-28');
  });
  test('the ECB has no newer day: the saved BNR rates and their history stay (F-48)', async () => {
    for (const [what, last] of [['the ECB one day behind', '2026-10-27'], ['the ECB on the same day', '2026-10-28']]) {
      logs.length = 0;
      globalThis.fetch = mock({ bnr: false, ecbDays: [['2025-10-27', 5.0849, 1.1663], ['2025-10-28', 5.0850, 1.1660], [last, 5.3502, 1.1125]] });
      const out = await withSaved('bce-mai-vechi.json');
      const d = await main({ today, out });
      assertLogged(/The ECB has no newer rate; keeping the previous rates/);
      assert.equal(d.fx.source, 'BNR', what);
      assert.equal(await readFile(out, 'utf8'), baseline, what);
    }
    // A newer ECB day is still used: the fallback keeps working.
    globalThis.fetch = mock({ bnr: false, ecbDays: [...ECB_DAYS, ['2026-10-29', 5.3510, 1.1120]] });
    const d = await main({ today: '2026-10-30', out: await withSaved('bce-mai-nou.json') });
    assert.deepEqual([d.fx.source, d.fx.d1], ['BCE (rezervă)', '2026-10-29']);
  });
  test('BNR redirects to its home page: a clear warning, then the ECB (F-40)', async () => {
    globalThis.fetch = mock({ bnr: 'redirect' });
    const d = await main({ today, out: join(dir, 'redirect.json') });
    assertLogged(/BNR: redirected to https:\/\/www\.bnr\.ro\//);
    assert.equal(d.fx.source, 'BCE (rezervă)');
  });
  test('network errors name the cause and the address (F-49)', async () => {
    const reject = (code) => () => { throw new TypeError('fetch failed', { cause: Object.assign(new Error(`read ${code}`), { code }) }); };
    const timeout = () => { throw Object.assign(new Error('The operation was aborted due to timeout'), { name: 'TimeoutError' }); };
    const body = () => ({ ok: true, status: 200, text: async () => { throw new TypeError('terminated', { cause: Object.assign(new Error('other side closed'), { code: 'UND_ERR_SOCKET' }) }); } });
    globalThis.fetch = mock({ fail: { [TEN]: reject('ECONNRESET'), [YEAR(2025)]: timeout, [YEAR(2026)]: body } });
    const d = await main({ today, out: join(dir, 'retea.json') });
    assertLogged(/BNR: ECONNRESET for https:\/\/curs\.bnr\.ro\/nbrfxrates10days\.xml$/);
    assertLogged(/BNR: no answer within 30 s for https:\/\/curs\.bnr\.ro\/files\/xml\/years\/nbrfxrates2025\.xml$/);
    assertLogged(/BNR: UND_ERR_SOCKET for https:\/\/curs\.bnr\.ro\/files\/xml\/years\/nbrfxrates2026\.xml$/);
    assert.equal(d.fx.source, 'BCE (rezervă)');
  });
  test('a Eurostat series without usable data is reported, not dropped silently (F-50)', async () => {
    const twoSeries = { ...eurostatJson([9.9, 9.8, 9.7, 9.3]), size: [1, 1, 1, 2, 4] };
    globalThis.fetch = mock({ series: { 'RCH_A|SERV|RO': twoSeries, 'RCH_MV12MAVR|TOTAL|RO': EMPTY } });
    const d = await main({ today, out: join(dir, 'eurostat-gol.json') });
    assertLogged(/Eurostat \(services\): no usable data for https:\/\/ec\.europa\.eu\/\S+coicop18=SERV/);
    assertLogged(/Eurostat \(12-month average\): no usable data for https:\/\/ec\.europa\.eu\/\S+unit=RCH_MV12MAVR/);
    assert.deepEqual([d.inflation.yoy, d.inflation.services, d.inflation.avg12], [6.5, undefined, undefined]);
  });
  test('a Eurostat series that lags behind Romania total is reported (F-50)', async () => {
    globalThis.fetch = mock({ series: { 'RCH_A|SERV|RO': eurostatJson([9.9, 9.8, 9.7, null]) } });
    const d = await main({ today, out: join(dir, 'eurostat-intarziat.json') });
    assertLogged(/Eurostat \(services\): the newest month is 2026-08, not 2026-09/);
    assert.equal(d.inflation.services, undefined, 'August is not mixed with September');
  });
  test('Eurostat answers with an older month: the published values stay (F-51)', async () => {
    globalThis.fetch = mock({
      series: { 'RCH_A|TOTAL|RO': eurostatJson([9.2, 8.2, null, null]), 'RCH_A|TOTAL|EA': eurostatJson([2.9, 3.2, null], ['2026-07', '2026-08', '2026-09']) },
    });
    const out = await withSaved('luna-veche.json');
    const d = await main({ today, out });
    assertLogged(/Eurostat \(Romania\): the newest month is 2026-07, older than 2026-09; keeping the previous values/);
    assertLogged(/Eurostat \(euro area\): the newest month is 2026-08, older than 2026-09; keeping the previous value/);
    assert.deepEqual([d.inflation.month, d.inflation.euroAreaMonth], ['2026-09', '2026-09']);
    assert.equal(await readFile(out, 'utf8'), baseline);
  });
  test('a result the page would reject is not written, and the job fails (F-52)', async () => {
    globalThis.fetch = mock({ series: { 'RCH_A|TOTAL|RO': eurostatJson([9.2, 8.2, 6.3, 6.4], ['2026M07', '2026M08', '2026M09', '2026M10']) } });
    const out = await withSaved('format-nou.json');
    const d = await main({ today, out });
    assertLogged(/The page would reject the inflation section; data\/rates\.json is not written/);
    assert.equal(d, null);
    assert.equal(process.exitCode, 1);
    process.exitCode = 0;
    assert.equal(await readFile(out, 'utf8'), baseline);
  });
  test('early January: still BNR, with the year before and without the file of the new year (F-41)', async () => {
    const january = (to, skip) => ({
      [YEAR(2025)]: bnrXml(cubes('2025-09-01', '2025-12-31')),
      [YEAR(2026)]: bnrXml(cubes('2026-01-05', '2026-12-31', ['2026-12-25'])),
      [YEAR(2027)]: null,
      [TEN]: bnrXml(cubes('2026-12-14', to, skip).slice(-10)),
    });
    // 1 January: BNR has not published anything in 2027 yet; the rate from a year ago is from 31 Dec 2025.
    globalThis.fetch = mock({ files: january('2026-12-31', ['2026-12-25']) });
    let d = await main({ today: '2027-01-01', out: join(dir, 'ian-1.json') });
    assert.deepEqual(warnings(), [], 'no "HTTP 502" for the 2027 file');
    assert.deepEqual([d.fx.source, d.fx.d1, d.fx.d0], ['BNR', '2026-12-31', '2025-12-31']);
    assert.ok(!bnrAsked().includes(YEAR(2027)));
    // 4 January: the first BNR day of 2027; the target from a year ago (4 Jan 2026) is before the first day in the 2026 file.
    logs.length = 0;
    requested.length = 0;
    globalThis.fetch = mock({ files: january('2027-01-04', ['2026-12-25', '2027-01-01']) });
    d = await main({ today: '2027-01-04', out: join(dir, 'ian-4.json') });
    assert.deepEqual(warnings(), []);
    assert.deepEqual([d.fx.source, d.fx.d1, d.fx.d0], ['BNR', '2027-01-04', '2025-12-31']);
    assert.ok(bnrAsked().includes(YEAR(2025)), 'the year before, for the 400-day window');
  });
  test('January: a failed 10-day file on 4 Jan keeps BNR, and the next run needs only the 10 days (F-41)', async () => {
    const files = (to, skip = []) => ({
      [YEAR(2025)]: bnrXml(cubes('2025-09-01', '2025-12-31')),
      [YEAR(2026)]: bnrXml(cubes('2026-01-05', '2026-12-31', ['2026-12-25'])),
      [YEAR(2027)]: bnrXml(cubes('2027-01-04', to < '2027-01-04' ? '2027-01-03' : to)),
      [TEN]: bnrXml(cubes('2026-12-14', to, skip).slice(-10)),
    });
    const out = join(dir, 'ian-istoric.json');
    globalThis.fetch = mock({ files: files('2026-12-31', ['2026-12-25']) });
    await main({ today: '2026-12-31', out });
    // 4 January: the 10-day file answers 502; the yearly files work.
    logs.length = 0;
    requested.length = 0;
    globalThis.fetch = mock({ files: { ...files('2027-01-04', ['2026-12-25', '2027-01-01']), [TEN]: null } });
    let d = await main({ today: '2027-01-04', out });
    assert.deepEqual([d.fx.source, d.fx.d1, d.fx.d0], ['BNR', '2027-01-04', '2025-12-31']);
    // 5 January: the saved history is enough again.
    logs.length = 0;
    requested.length = 0;
    globalThis.fetch = mock({ files: files('2027-01-05', ['2026-12-25', '2027-01-01']) });
    d = await main({ today: '2027-01-05', out });
    assert.deepEqual(bnrAsked(), [TEN]);
    assert.equal(d.fx.d1, '2027-01-05');
  });
  test('a first run in late January: the next day needs no yearly file (F-41)', async () => {
    const files = (to) => ({
      [YEAR(2025)]: bnrXml(cubes('2025-09-01', '2025-12-31')),
      [YEAR(2026)]: bnrXml(cubes('2026-01-05', '2026-12-31')),
      [YEAR(2027)]: bnrXml(cubes('2027-01-04', to)),
      [TEN]: bnrXml(cubes('2027-01-04', to).slice(-10)),
    });
    const out = join(dir, 'ian-tarziu.json');
    globalThis.fetch = mock({ files: files('2027-01-25') });
    await main({ today: '2027-01-25', out });
    requested.length = 0;
    globalThis.fetch = mock({ files: files('2027-01-26') });
    const d = await main({ today: '2027-01-26', out });
    assert.deepEqual(bnrAsked(), [TEN]);
    assert.equal(d.fx.d1, '2027-01-26');
  });
  test('all sources fail: keeps the data from yesterday', async () => {
    globalThis.fetch = mock({ bnr: false, ecb: false, stat: false });
    const out = await withSaved('ieri.json');
    const d = await main({ today, out });
    assertLogged(/No new rates; keeping the previous ones/);
    assertLogged(/Inflation data unavailable/);
    assertLogged(/Eurostat \(Romania\): ETIMEDOUT for https:\/\/ec\.europa\.eu\//);
    assert.equal(d.fx.d1, '2026-10-28');
    assert.equal(d.inflation.yoy, 6.5);
    assert.equal(await readFile(out, 'utf8'), baseline);
    assert.equal(process.exitCode ?? 0, 0, 'a day without new data is not an error');
  });
  test('rates more than 5 days old: a warning; the check after publishing fails from 8 days on (F-42, F-54)', async () => {
    globalThis.fetch = mock({ bnr: false, ecb: false, stat: false });
    const d = await main({ today: '2026-11-05', out: await withSaved('8-zile.json') });
    assertLogged(/Rates are from 2026-10-28, 8 days ago\./);
    assert.equal(d.fx.d1, '2026-10-28');
    assert.equal(process.exitCode ?? 0, 0, 'publishing goes on; tests/fresh.test.mjs covers the failure');
  });
  test('all sources fail and there is no old data: fails (GitHub sends an email)', async () => {
    globalThis.fetch = mock({ bnr: false, ecb: false, stat: false });
    const d = await main({ today, out: join(dir, 'nimic.json') });
    assertLogged(/no exchange rates at all/i);
    assert.equal(d, null);
    assert.equal(process.exitCode, 1);
    process.exitCode = 0;
  });
  test('every request carried the User-Agent and a timeout (F-38)', () => {
    assert.ok(everyRequest.length > 50, 'the tests above made requests');
    assert.deepEqual(badInit, []);
  });
  test('calendar dates', () => assert.equal(shiftDays('2026-03-01', -1), '2026-02-28'));
});
