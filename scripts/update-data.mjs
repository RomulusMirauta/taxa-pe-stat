// Fetches the daily data and writes data/rates.json.
// Runs in GitHub Actions (see .github/workflows/publish.yml); also works locally: node scripts/update-data.mjs
//
// Sources:
//   - exchange rates: BNR, the reference rates from curs.bnr.ro: the last 10 days, joined to the history already saved;
//     the yearly files only when the history is missing or has gaps; fallback: the ECB (its data API);
//   - inflation: Eurostat, HICP (dataset prc_hicp_minr): Romania total and services, the 12-month average, the euro area.
// If a source does not answer, keeps the previous values and leaves a warning.
// Fails (exit code 1), so that GitHub sends you an email, if there is no exchange rate at all or if the page would
// reject the result. Stale data is reported after publishing, by scripts/check-fresh.mjs.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const OUT = join(ROOT, 'data', 'rates.json');
const SERIES_DAYS = 400;
// ASCII only: fetch rejects headers with characters above 255, such as "ș" (FINDINGS F-38).
export const UA = 'taxa-pe-stat (calculator open-source; +https://github.com/RomulusMirauta/taxa-pe-stat)';
const EUROSTAT = 'https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/prc_hicp_minr';

/* ---------- calendar dates ---------- */

export function shiftDays(iso, n) {
  const t = new Date(iso + 'T00:00:00Z');
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
}

/** The same day, `n` years earlier or later; 29 February becomes the 28th. */
export function shiftYear(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  const t = new Date(Date.UTC(y + n, m - 1, d));
  if (t.getUTCMonth() !== m - 1) t.setUTCDate(0);
  return t.toISOString().slice(0, 10);
}

const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);
const r4 = (v) => Math.round(v * 10000) / 10000;

/* ---------- parsing (pure functions, tested in tests/data.test.mjs) ---------- */

/** The BNR XML → [{ date, EUR, USD }], ascending by date. Honours the multiplier attribute. */
export function parseBnrXml(xml) {
  const out = [];
  for (const cube of String(xml).matchAll(/<Cube\s+date="(\d{4}-\d{2}-\d{2})"\s*>([\s\S]*?)<\/Cube>/g)) {
    const row = { date: cube[1] };
    for (const rate of cube[2].matchAll(/<Rate\b([^>]*)>\s*([\d.]+)\s*<\/Rate>/g)) {
      const currency = rate[1].match(/currency="([A-Z]{3})"/)?.[1];
      const multiplier = Number(rate[1].match(/multiplier="(\d+)"/)?.[1] ?? 1);
      if (currency === 'EUR' || currency === 'USD') row[currency] = Number(rate[2]) / multiplier;
    }
    if (row.EUR > 0 && row.USD > 0) out.push(row);
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

/** Simple CSV with quotes (RFC 4180). */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += ch;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((c) => c !== ''));
}

/** CSV from the ECB API (format=csvdata, EUR→RON and EUR→USD) → [{ date, EUR, USD }] in lei per unit. */
export function parseEcbCsv(csv) {
  const [head = [], ...data] = parseCsv(String(csv));
  const iCur = head.indexOf('CURRENCY');
  const iTime = head.indexOf('TIME_PERIOD');
  const iVal = head.indexOf('OBS_VALUE');
  if (iCur < 0 || iTime < 0 || iVal < 0) return [];
  const byDate = new Map();
  for (const r of data) {
    const v = Number(r[iVal]);
    if (!(v > 0)) continue;
    const day = byDate.get(r[iTime]) ?? {};
    day[r[iCur]] = v;
    byDate.set(r[iTime], day);
  }
  const out = [];
  for (const [date, d] of byDate) if (d.RON > 0 && d.USD > 0) out.push({ date, EUR: d.RON, USD: d.RON / d.USD });
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

/** Merges series (on the same date, the last one wins). */
export function mergeSeries(...lists) {
  const map = new Map();
  for (const list of lists) for (const r of list) map.set(r.date, r);
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/** The last day with a rate no later than one year before `date` (no weekends or holidays). */
export function pickYearAgo(series, date) {
  const target = shiftYear(date, -1);
  let best = null;
  for (const r of series) {
    if (r.date <= target) best = r;
    else break;
  }
  return best && daysBetween(best.date, target) <= 10 ? best : null;
}

/** Series → the fx section of rates.json: the current rate and the one from a year ago, plus the recent history. */
export function fxFromSeries(series, source) {
  if (!series.length) return null;
  const last = series.at(-1);
  const ago = pickYearAgo(series, last.date);
  if (!ago) return null;
  const from = shiftDays(last.date, -SERIES_DAYS);
  return {
    source,
    d0: ago.date, eur0: r4(ago.EUR), usd0: r4(ago.USD),
    d1: last.date, eur1: r4(last.EUR), usd1: r4(last.USD),
    series: series.filter((r) => r.date >= from).map((r) => [r.date, r4(r.EUR), r4(r.USD)]),
  };
}

/** The series covers the last SERIES_DAYS days, with no gaps over 10 days (BNR holidays last ~5 at most). */
export function isContinuous(series) {
  if (!series.length) return false;
  const from = shiftDays(series.at(-1).date, -SERIES_DAYS);
  return daysBetween(from, series[0].date) <= 10 &&
    series.every((r, i) => i === 0 || daysBetween(series[i - 1].date, r.date) <= 10);
}

/** A Eurostat JSON-stat response for a single series → { month, value } (the latest month with data). */
export function parseEurostat(json) {
  const index = json?.dimension?.time?.category?.index;
  if (!index || !json.value || !Array.isArray(json.size)) return null;
  const timeSize = Object.keys(index).length;
  if (json.size.reduce((a, b) => a * b, 1) !== timeSize) return null; // not a single series
  let best = null;
  for (const [month, pos] of Object.entries(index)) {
    const v = json.value[pos] ?? json.value[String(pos)];
    if (typeof v === 'number' && Number.isFinite(v) && (!best || month > best.month)) best = { month, value: v };
  }
  return best;
}

/** The inflation section of rates.json. Missing fields are filled in from the previous data only if it is from the same month. */
export function buildInflation({ ro, services, avg12, euroArea }, prev) {
  // A month older than the one already published means a partial or stale answer: the previous data stays (F-51).
  if (!ro || (prev?.month && ro.month < prev.month)) return prev ?? null;
  const sameMonth = (x) => x && x.month === ro.month;
  const out = { source: 'Eurostat (IAPC)', month: ro.month, yoy: ro.value };
  if (sameMonth(services)) out.services = services.value;
  else if (prev?.month === ro.month && prev.services !== undefined) out.services = prev.services;
  if (sameMonth(avg12)) out.avg12 = avg12.value;
  else if (prev?.month === ro.month && prev.avg12 !== undefined) out.avg12 = prev.avg12;
  if (euroArea && !(prev?.euroAreaMonth && euroArea.month < prev.euroAreaMonth)) { out.euroArea = euroArea.value; out.euroAreaMonth = euroArea.month; }
  else if (prev?.euroArea !== undefined) { out.euroArea = prev.euroArea; out.euroAreaMonth = prev.euroAreaMonth; }
  return out;
}

/** The page's own validator (Calc.normalizeRates, from app.html's <script id="calc">), run in a sandbox. */
export async function pageValidator(appHtml = join(ROOT, 'app.html')) {
  const code = (await readFile(appHtml, 'utf8')).match(/<script id="calc">([\s\S]*?)<\/script>/)?.[1];
  if (!code) throw new Error('app.html has no <script id="calc"> block');
  const ctx = vm.createContext({});
  vm.runInContext(code, ctx);
  return (data) => ctx.Calc.normalizeRates(JSON.parse(JSON.stringify(data)));
}

/* ---------- network ---------- */

const inActions = !!process.env.GITHUB_ACTIONS;
const warn = (msg) => console.log(inActions ? `::warning::${msg}` : `Warning: ${msg}`);
const error = (msg) => console.log(inActions ? `::error::${msg}` : `Error: ${msg}`);

// fetch says only "fetch failed" (while connecting) or "terminated" (while reading the body); the reason is in e.cause.
// The code (ECONNRESET, ENOTFOUND, ERR_SSL_…) comes first: an AggregateError has an empty message, TLS errors span lines (F-49).
const why = (e) => (e?.name === 'TimeoutError' ? 'no answer within 30 s'
  : String(e?.cause?.code || e?.cause?.message || e?.message).replace(/\s+/g, ' ').trim());

async function get(url) {
  const fail = (e) => { throw new Error(`${why(e)} for ${url}`, { cause: e }); };
  const res = await fetch(url, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(30000) }).catch(fail);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  // BNR sends the requests it does not serve to its home page; without this check, we would parse that page's HTML (F-40).
  if (res.redirected) throw new Error(`redirected to ${res.url} from ${url}`);
  return res.text().catch(fail);
}

async function fxFromBnr(today, prevFx) {
  // The XML files are only on curs.bnr.ro; the addresses on www.bnr.ro redirect to the home page (F-40).
  const bnr = (url) => get(url).then(parseBnrXml).catch((e) => { warn(`BNR: ${e.message}`); return []; });
  const recent = await bnr('https://curs.bnr.ro/nbrfxrates10days.xml');

  // The saved BNR history is enough if the last 10 days connect to it: BNR asks for no redundant downloads (O-14).
  const saved = prevFx?.source === 'BNR' && Array.isArray(prevFx.series)
    ? prevFx.series
      .filter((r) => Array.isArray(r) && /^\d{4}-\d{2}-\d{2}$/.test(r[0]) && r[1] > 0 && r[2] > 0) // a broken row must not stop BNR (F-53)
      .map(([date, EUR, USD]) => ({ date, EUR, USD }))
    : [];
  if (saved.length && recent.length && recent[0].date <= saved.at(-1).date) {
    const series = mergeSeries(saved, recent);
    const fx = isContinuous(series) && fxFromSeries(series, 'BNR');
    if (fx) return fx;
  }

  // The years follow from the last published day, like the 400-day window: in early January the year before
  // is needed too, and a year already covered by the last 10 days is not requested (its file may not exist yet) (F-41).
  const last = recent.at(-1)?.date ?? today;
  const from = shiftDays(last, -SERIES_DAYS);
  const years = [];
  for (let year = Number(from.slice(0, 4)); year <= Number(last.slice(0, 4)); year++) {
    const start = `${year}-01-01` > from ? `${year}-01-01` : from;
    if (!recent.length || recent[0].date > start) years.push(year);
  }
  const lists = await Promise.all(years.map((year) => bnr(`https://curs.bnr.ro/files/xml/years/nbrfxrates${year}.xml`)));
  return fxFromSeries(mergeSeries(...lists, recent), 'BNR');
}

async function fxFromEcb(today) {
  const start = shiftDays(today, -SERIES_DAYS - 10);
  const csv = await get(`https://data-api.ecb.europa.eu/service/data/EXR/D.RON+USD.EUR.SP00.A?startPeriod=${start}&format=csvdata`);
  return fxFromSeries(parseEcbCsv(csv), 'BCE (rezervă)');
}

async function eurostat(geo, coicop, unit, since) {
  const url = `${EUROSTAT}?unit=${unit}&coicop18=${coicop}&geo=${geo}&sinceTimePeriod=${since}`;
  const r = parseEurostat(JSON.parse(await get(url)));
  if (!r) throw new Error(`no usable data for ${url}`); // otherwise the series would vanish without a warning (F-50)
  return r;
}

/* ---------- main ---------- */

export async function main({ today = new Date().toISOString().slice(0, 10), out = OUT } = {}) {
  let prev = null;
  try { prev = JSON.parse(await readFile(out, 'utf8')); } catch { /* first run */ }

  let fx = await fxFromBnr(today, prev?.fx).catch((e) => { warn(`BNR: ${e.message}`); return null; });
  if (!fx) {
    warn('BNR rates unavailable; trying the ECB.');
    fx = await fxFromEcb(today).catch((e) => { warn(`ECB: ${e.message}`); return null; });
    // The ECB is a fallback only when it brings a newer day: an equally fresh saved BNR rate, and its history, stay (F-48).
    if (fx && prev?.fx?.d1 && fx.d1 <= prev.fx.d1) { warn('The ECB has no newer rate; keeping the previous rates.'); fx = prev.fx; }
  }
  if (!fx && prev?.fx) { warn('No new rates; keeping the previous ones.'); fx = prev.fx; }
  if (!fx) { error('No exchange rates at all.'); process.exitCode = 1; return null; }
  const age = daysBetween(fx.d1, today);
  // Data that has stopped updating fails the check after publishing (scripts/check-fresh.mjs, F-42, F-54).
  if (age > 5) warn(`Rates are from ${fx.d1}, ${age} days ago.`);

  const since = shiftDays(today, -240).slice(0, 7);
  const safe = (p, what) => p.catch((e) => { warn(`Eurostat (${what}): ${e.message}`); return null; });
  const [ro, services, avg12, euroArea] = await Promise.all([
    safe(eurostat('RO', 'TOTAL', 'RCH_A', since), 'Romania'),
    safe(eurostat('RO', 'SERV', 'RCH_A', since), 'services'),
    safe(eurostat('RO', 'TOTAL', 'RCH_MV12MAVR', since), '12-month average'),
    safe(eurostat('EA', 'TOTAL', 'RCH_A', since), 'euro area'),
  ]);
  const older = (x, than) => x && than && x.month < than;
  if (!ro) warn('Inflation data unavailable; keeping the previous values.');
  else if (older(ro, prev?.inflation?.month)) warn(`Eurostat (Romania): the newest month is ${ro.month}, older than ${prev.inflation.month}; keeping the previous values.`);
  else {
    for (const [x, what] of [[services, 'services'], [avg12, '12-month average']]) {
      if (x && x.month !== ro.month) warn(`Eurostat (${what}): the newest month is ${x.month}, not ${ro.month}.`);
    }
  }
  if (older(euroArea, prev?.inflation?.euroAreaMonth)) warn(`Eurostat (euro area): the newest month is ${euroArea.month}, older than ${prev.inflation.euroAreaMonth}; keeping the previous value.`);
  const inflation = buildInflation({ ro, services, avg12, euroArea }, prev?.inflation);

  const data = { version: 1, fx, inflation };
  // A file the page would reject must not reach the repo: it would break the page and the next deploys (F-52).
  const accepted = (await pageValidator())(data);
  const rejected = ['fx', 'inflation'].filter((k) => data[k] && !accepted?.[k]);
  if (rejected.length) {
    error(`The page would reject the ${rejected.join(' and ')} section; data/rates.json is not written.`);
    process.exitCode = 1;
    return null;
  }
  const text = JSON.stringify(data, null, 2) + '\n';
  const before = prev ? JSON.stringify(prev, null, 2) + '\n' : '';
  if (text === before) {
    console.log(`Unchanged: ${fx.source} rates from ${fx.d1}, inflation ${inflation?.month ?? '—'}.`);
  } else {
    await mkdir(dirname(out), { recursive: true });
    await writeFile(out, text);
    console.log(`Wrote data/rates.json: ${fx.source} rates from ${fx.d1} (EUR ${fx.eur1}, USD ${fx.usd1}), inflation ${inflation?.yoy ?? '—'}% in ${inflation?.month ?? '—'}.`);
  }
  return data;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  main().catch((e) => { console.error('Failed:', e.message); process.exit(1); });
}
