// Datele automate: parsarea surselor (BNR, BCE, Eurostat), alegerea cursului de acum un an,
// rezervele când o sursă cade, și validarea din pagină. Fără rețea: fetch e simulat,
// dar fiecare cerere trece prin aceeași validare ca la fetch-ul adevărat (F-38).
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

/* ---------- fixturi, în formatul real al surselor ---------- */

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

describe('BNR: XML-ul cu cursurile de referință', () => {
  test('citește EUR și USD din fiecare zi, în ordine', () => {
    const rows = parseBnrXml(bnrXml([['2026-10-28', 5.3495, 4.8088], ['2026-10-27', 5.3487, 4.7977]]));
    assert.equal(rows.length, 2);
    assert.equal(rows[0].date, '2026-10-27');
    assert.equal(rows[1].EUR, 5.3495);
    assert.equal(rows[1].USD, 4.8088);
  });
  test('ține cont de atributul multiplier', () => {
    const xml = '<Cube date="2026-10-28"><Rate currency="EUR">5.3495</Rate><Rate currency="USD" multiplier="100">480.88</Rate></Cube>';
    assert.equal(parseBnrXml(xml)[0].USD, 4.8088);
  });
  test('ignoră zilele fără EUR sau USD și textul stricat', () => {
    assert.equal(parseBnrXml('<Cube date="2026-10-28"><Rate currency="EUR">5.3495</Rate></Cube>').length, 0);
    assert.equal(parseBnrXml('<html>Access denied</html>').length, 0);
    assert.equal(parseBnrXml('').length, 0);
  });
});

describe('BCE: rezerva', () => {
  test('CSV cu ghilimele și virgule în câmpuri', () => {
    assert.deepEqual(parseCsv('a,"b, ""c""",d\n1,2,3\n'), [['a', 'b, "c"', 'd'], ['1', '2', '3']]);
  });
  test('transformă EUR→RON și EUR→USD în lei pentru 1 EUR și 1 USD', () => {
    const rows = parseEcbCsv(ECB_CSV);
    assert.equal(rows.length, 2, 'ziua fără USD e ignorată');
    assert.equal(rows[1].date, '2026-10-28');
    assert.equal(rows[1].EUR, 5.3502);
    assert.ok(Math.abs(rows[1].USD - 5.3502 / 1.1125) < 1e-12);
  });
  test('un răspuns fără coloanele așteptate dă o serie goală', () => {
    assert.equal(parseEcbCsv('<html>robots</html>').length, 0);
  });
});

describe('cursul de acum un an', () => {
  const series = mergeSeries(
    [{ date: '2025-10-24', EUR: 5.08, USD: 4.36 }, { date: '2025-10-27', EUR: 5.0848, USD: 4.3684 }],
    [{ date: '2026-10-26', EUR: 5.34, USD: 4.79 }, { date: '2026-10-27', EUR: 5.3487, USD: 4.7977 }],
  );
  test('aceeași zi de anul trecut, sau ultima zi lucrătoare dinainte', () => {
    assert.equal(pickYearAgo(series, '2026-10-27').date, '2025-10-27');
    assert.equal(pickYearAgo(series, '2026-10-26').date, '2025-10-24', '26 oct. 2025 a fost duminică');
  });
  test('fără date suficient de vechi nu ghicește', () => {
    assert.equal(pickYearAgo(series.slice(2), '2026-10-27'), null);
    assert.equal(pickYearAgo([{ date: '2025-09-01', EUR: 5, USD: 4 }, ...series.slice(2)], '2026-10-27'), null, 'o gaură de peste 10 zile');
  });
  test('29 februarie devine 28 februarie', () => assert.equal(shiftYear('2028-02-29', -1), '2027-02-28'));
  test('secțiunea fx: acum, acum un an, istoricul recent', () => {
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

describe('Eurostat: inflația', () => {
  test('ultima lună cu date', () => {
    assert.deepEqual(parseEurostat(eurostatJson([9.2, 8.2, 6.3, 6.5])), { month: '2026-09', value: 6.5 });
    assert.deepEqual(parseEurostat(eurostatJson([9.2, 8.2, 6.3, null])), { month: '2026-08', value: 6.3 }, 'luna fără valoare e sărită');
  });
  test('refuză răspunsurile cu mai multe serii sau fără date', () => {
    assert.equal(parseEurostat({ ...eurostatJson([1, 2, 3, 4]), size: [1, 1, 2, 1, 4] }), null);
    assert.equal(parseEurostat({ error: 'nu există' }), null);
    assert.equal(parseEurostat(null), null);
  });
  test('combină seriile; completează din datele vechi doar pentru aceeași lună', () => {
    const ro = { month: '2026-09', value: 6.5 };
    const full = buildInflation({ ro, services: { month: '2026-09', value: 9.3 }, avg12: { month: '2026-09', value: 8.4 }, euroArea: { month: '2026-09', value: 3.8 } });
    assert.deepEqual(full, { source: 'Eurostat (IAPC)', month: '2026-09', yoy: 6.5, services: 9.3, avg12: 8.4, euroArea: 3.8, euroAreaMonth: '2026-09' });
    const prev = { month: '2026-08', yoy: 6.3, services: 9.7 };
    assert.equal(buildInflation({ ro }, prev).services, undefined, 'serviciile din august nu se amestecă cu septembrie');
    assert.equal(buildInflation({ ro: null }, prev), prev, 'fără date noi rămân cele vechi');
  });
});

describe('validarea din pagină (normalizeRates)', () => {
  const good = JSON.parse(readFileSync(new URL('../data/rates.json', import.meta.url), 'utf8'));
  test('data/rates.json din repo e valid', () => {
    const d = C.normalizeRates(good);
    assert.equal(d.fx.d1, good.fx.d1);
    assert.equal(d.inflation.yoy, good.inflation.yoy);
  });
  test('o secțiune stricată e ignorată, cealaltă rămâne', () => {
    const d = C.normalizeRates({ ...good, fx: { ...good.fx, eur1: 'mult' } });
    assert.equal(d.fx, undefined);
    assert.equal(d.inflation.month, good.inflation.month);
    assert.equal(C.normalizeRates({ ...good, inflation: { month: '2026-13', yoy: 6 } }).inflation, undefined);
    assert.equal(C.normalizeRates({ ...good, fx: { ...good.fx, d0: good.fx.d1 } }).fx, undefined, 'interval de 0 zile');
  });
  test('orice altceva → null', () => {
    for (const bad of [null, 'text', 42, {}, { fx: null, inflation: null }]) assert.equal(C.normalizeRates(bad), null);
  });
  test('sursa e scurtată (apare în pagină)', () => {
    assert.equal(C.normalizeRates({ ...good, fx: { ...good.fx, source: 'x'.repeat(200) } }).fx.source.length, 40);
  });
});

describe('scriptul zilnic, cu rețea simulată', () => {
  let dir;
  let out;
  const realFetch = globalThis.fetch;
  const today = '2026-10-29';
  const files = {
    'nbrfxrates2025.xml': bnrXml([['2025-10-27', 5.0848, 4.3684], ['2025-10-28', 5.0844, 4.3591]]),
    'nbrfxrates2026.xml': bnrXml([['2026-10-27', 5.3487, 4.7977]]),
    'nbrfxrates.xml': bnrXml([['2026-10-28', 5.3495, 4.8088]]),
  };
  const eurostat = (url) => {
    const q = new URL(url).searchParams;
    if (q.get('geo') === 'EA') return eurostatJson([2.9, 3.2, 3.8], ['2026-07', '2026-08', '2026-09']);
    if (q.get('coicop18') === 'SERV') return eurostatJson([9.9, 9.8, 9.7, 9.3]);
    if (q.get('unit') === 'RCH_MV12MAVR') return eurostatJson([9.6, 9.3, 8.8, 8.4]);
    return eurostatJson([9.2, 8.2, 6.3, 6.5]);
  };
  const respond = (body, status = 200) => ({ ok: status < 400, status, text: async () => body });
  const homepage = { ok: true, status: 200, redirected: true, url: 'https://www.bnr.ro/', text: async () => '<html>BNR</html>' };
  const requested = [];
  const mock = ({ bnr = true, ecb = true, stat = true } = {}) => async (url, init) => {
    new Request(url, init);
    url = String(url);
    requested.push(url);
    if (url.includes('bnr.ro')) {
      if (bnr === 'redirect') return homepage;
      return bnr ? respond(files[url.split('/').pop()]) : respond('Access denied', 403);
    }
    if (url.includes('data-api.ecb')) return ecb ? respond(ECB_CSV) : respond('', 503);
    if (url.includes('eurostat')) { if (!stat) throw new Error('timeout'); return respond(JSON.stringify(eurostat(url))); }
    throw new Error('URL neașteptat: ' + url);
  };
  // Mesajele scriptului sunt captate: în Actions, avertismentele simulate ar apărea ca adnotări ale rulării (F-39).
  const realLog = console.log;
  const logs = [];
  const logged = (re) => logs.some((l) => re.test(l));
  before(async () => {
    dir = await mkdtemp(join(tmpdir(), 'taxa-pe-stat-date-'));
    out = join(dir, 'rates.json');
    console.log = (...args) => logs.push(args.join(' '));
  });
  beforeEach(() => { logs.length = 0; requested.length = 0; });
  after(async () => {
    console.log = realLog;
    globalThis.fetch = realFetch;
    process.exitCode = 0;
    await rm(dir, { recursive: true, force: true });
  });

  test('User-Agent doar ASCII: altfel fetch refuză orice cerere (F-38)', () => {
    assert.match(UA, /^[\x20-\x7e]+$/);
  });
  test('BNR și Eurostat răspund: scrie cursul BNR și inflația', async () => {
    globalThis.fetch = mock();
    const d = await main({ today, out });
    assert.deepEqual(logs.filter((l) => /Avertisment|::warning::/.test(l)), [], 'fără avertismente');
    const bnr = requested.filter((u) => u.includes('bnr.ro'));
    assert.equal(bnr.length, 3);
    assert.ok(bnr.every((u) => u.startsWith('https://curs.bnr.ro/')), 'fișierele XML sunt doar pe curs.bnr.ro (F-40)');
    assert.equal(d.fx.source, 'BNR');
    assert.equal(d.fx.d0, '2025-10-28');
    assert.equal(d.fx.d1, '2026-10-28');
    assert.equal(d.fx.eur1, 5.3495);
    assert.deepEqual(d.inflation, { source: 'Eurostat (IAPC)', month: '2026-09', yoy: 6.5, services: 9.3, avg12: 8.4, euroArea: 3.8, euroAreaMonth: '2026-09' });
    assert.deepEqual(JSON.parse(await readFile(out, 'utf8')), d);
    assert.ok(C.normalizeRates(d), 'pagina acceptă fișierul scris');
  });
  test('a doua rulare cu aceleași date nu schimbă fișierul (deci nici commit)', async () => {
    const before = await readFile(out, 'utf8');
    await main({ today, out });
    assert.equal(await readFile(out, 'utf8'), before);
  });
  test('BNR refuză: trece pe BCE', async () => {
    globalThis.fetch = mock({ bnr: false });
    const d = await main({ today, out: join(dir, 'bce.json') });
    assert.ok(logged(/Cursul BNR nu e disponibil; încerc BCE/));
    assert.equal(d.fx.source, 'BCE (rezervă)');
    assert.equal(d.fx.d1, '2026-10-28');
    assert.equal(d.fx.d0, '2025-10-28');
  });
  test('BNR trimite spre prima pagină: avertisment clar, apoi BCE (F-40)', async () => {
    globalThis.fetch = mock({ bnr: 'redirect' });
    const d = await main({ today, out: join(dir, 'redirect.json') });
    assert.ok(logged(/BNR: redirecționat spre https:\/\/www\.bnr\.ro\//));
    assert.equal(d.fx.source, 'BCE (rezervă)');
  });
  test('toate sursele cad: păstrează datele de ieri', async () => {
    const before = await readFile(out, 'utf8');
    globalThis.fetch = mock({ bnr: false, ecb: false, stat: false });
    const d = await main({ today, out });
    assert.ok(logged(/Niciun curs nou; păstrez cursul anterior/));
    assert.ok(logged(/Inflația nu e disponibilă/));
    assert.equal(d.fx.d1, '2026-10-28');
    assert.equal(d.inflation.yoy, 6.5);
    assert.equal(await readFile(out, 'utf8'), before);
  });
  test('toate sursele cad și nu există date vechi: eșuează (GitHub trimite email)', async () => {
    globalThis.fetch = mock({ bnr: false, ecb: false, stat: false });
    const d = await main({ today, out: join(dir, 'nimic.json') });
    assert.ok(logged(/nu există niciun curs/i));
    assert.equal(d, null);
    assert.equal(process.exitCode, 1);
    process.exitCode = 0;
  });
  test('datele calendaristice', () => assert.equal(shiftDays('2026-03-01', -1), '2026-02-28'));
});
