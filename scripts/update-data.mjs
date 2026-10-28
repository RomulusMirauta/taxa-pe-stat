// Aduce datele zilnice și scrie data/rates.json.
// Rulează în GitHub Actions (vezi .github/workflows/publish.yml); merge și local: node scripts/update-data.mjs
//
// Surse:
//   - curs: BNR, cursurile de referință (XML anual + zilnic); rezervă: BCE (API-ul de date);
//   - inflație: Eurostat, IAPC (setul prc_hicp_minr): România total și servicii, media pe 12 luni, zona euro.
// Dacă o sursă nu răspunde, păstrează valorile anterioare și lasă un avertisment.
// Eșuează (cod 1) doar dacă nu există deloc un curs, ca să primești email de la GitHub.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const OUT = join(ROOT, 'data', 'rates.json');
const SERIES_DAYS = 400;
const UA = 'taxa-pe-stat (calculator open-source; date publice BNR și Eurostat)';
const EUROSTAT = 'https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/prc_hicp_minr';

/* ---------- date calendaristice ---------- */

export function shiftDays(iso, n) {
  const t = new Date(iso + 'T00:00:00Z');
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
}

/** Aceeași zi, cu `n` ani mai devreme sau mai târziu; 29 februarie devine 28. */
export function shiftYear(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  const t = new Date(Date.UTC(y + n, m - 1, d));
  if (t.getUTCMonth() !== m - 1) t.setUTCDate(0);
  return t.toISOString().slice(0, 10);
}

const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);
const r4 = (v) => Math.round(v * 10000) / 10000;

/* ---------- parsare (funcții pure, testate în tests/data.test.mjs) ---------- */

/** XML-ul BNR → [{ date, EUR, USD }], crescător după dată. Ține cont de atributul multiplier. */
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

/** CSV simplu cu ghilimele (RFC 4180). */
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

/** CSV de la API-ul BCE (format=csvdata, EUR→RON și EUR→USD) → [{ date, EUR, USD }] în lei pentru o unitate. */
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

/** Unește serii (ultima câștigă la aceeași dată). */
export function mergeSeries(...lists) {
  const map = new Map();
  for (const list of lists) for (const r of list) map.set(r.date, r);
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/** Ultima zi cu curs la cel mult un an înaintea lui `date` (fără weekend și sărbători). */
export function pickYearAgo(series, date) {
  const target = shiftYear(date, -1);
  let best = null;
  for (const r of series) {
    if (r.date <= target) best = r;
    else break;
  }
  return best && daysBetween(best.date, target) <= 10 ? best : null;
}

/** Seria → secțiunea fx din rates.json: cursul de acum și cel de acum un an, plus istoricul recent. */
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

/** Răspuns JSON-stat de la Eurostat, pentru o singură serie → { month, value } (ultima lună cu date). */
export function parseEurostat(json) {
  const index = json?.dimension?.time?.category?.index;
  if (!index || !json.value || !Array.isArray(json.size)) return null;
  const timeSize = Object.keys(index).length;
  if (json.size.reduce((a, b) => a * b, 1) !== timeSize) return null; // nu e o singură serie
  let best = null;
  for (const [month, pos] of Object.entries(index)) {
    const v = json.value[pos] ?? json.value[String(pos)];
    if (typeof v === 'number' && Number.isFinite(v) && (!best || month > best.month)) best = { month, value: v };
  }
  return best;
}

/** Secțiunea inflation din rates.json. Câmpurile lipsă se completează din datele anterioare doar dacă sunt din aceeași lună. */
export function buildInflation({ ro, services, avg12, euroArea }, prev) {
  if (!ro) return prev ?? null;
  const sameMonth = (x) => x && x.month === ro.month;
  const out = { source: 'Eurostat (IAPC)', month: ro.month, yoy: ro.value };
  if (sameMonth(services)) out.services = services.value;
  else if (prev?.month === ro.month && prev.services !== undefined) out.services = prev.services;
  if (sameMonth(avg12)) out.avg12 = avg12.value;
  else if (prev?.month === ro.month && prev.avg12 !== undefined) out.avg12 = prev.avg12;
  if (euroArea) { out.euroArea = euroArea.value; out.euroAreaMonth = euroArea.month; }
  else if (prev?.euroArea !== undefined) { out.euroArea = prev.euroArea; out.euroAreaMonth = prev.euroAreaMonth; }
  return out;
}

/* ---------- rețea ---------- */

const inActions = !!process.env.GITHUB_ACTIONS;
const warn = (msg) => console.log(inActions ? `::warning::${msg}` : `Avertisment: ${msg}`);

async function get(url) {
  const res = await fetch(url, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`HTTP ${res.status} la ${url}`);
  return res.text();
}

async function fxFromBnr(today) {
  const y = Number(today.slice(0, 4));
  const urls = [
    `https://www.bnr.ro/files/xml/years/nbrfxrates${y - 1}.xml`,
    `https://www.bnr.ro/files/xml/years/nbrfxrates${y}.xml`,
    'https://www.bnr.ro/nbrfxrates.xml',
  ];
  const texts = await Promise.all(urls.map((u) => get(u).catch((e) => { warn(`BNR: ${e.message}`); return ''; })));
  return fxFromSeries(mergeSeries(...texts.map(parseBnrXml)), 'BNR');
}

async function fxFromEcb(today) {
  const start = shiftDays(today, -SERIES_DAYS - 10);
  const csv = await get(`https://data-api.ecb.europa.eu/service/data/EXR/D.RON+USD.EUR.SP00.A?startPeriod=${start}&format=csvdata`);
  return fxFromSeries(parseEcbCsv(csv), 'BCE (rezervă)');
}

async function eurostat(geo, coicop, unit, since) {
  const url = `${EUROSTAT}?unit=${unit}&coicop18=${coicop}&geo=${geo}&sinceTimePeriod=${since}`;
  return parseEurostat(JSON.parse(await get(url)));
}

/* ---------- main ---------- */

export async function main({ today = new Date().toISOString().slice(0, 10), out = OUT } = {}) {
  let prev = null;
  try { prev = JSON.parse(await readFile(out, 'utf8')); } catch { /* prima rulare */ }

  let fx = await fxFromBnr(today).catch((e) => { warn(`BNR: ${e.message}`); return null; });
  if (!fx) {
    warn('Cursul BNR nu e disponibil; încerc BCE.');
    fx = await fxFromEcb(today).catch((e) => { warn(`BCE: ${e.message}`); return null; });
  }
  if (!fx && prev?.fx) { warn('Niciun curs nou; păstrez cursul anterior.'); fx = prev.fx; }
  if (!fx) { console.log(inActions ? '::error::Nu există niciun curs.' : 'Eroare: nu există niciun curs.'); process.exitCode = 1; return null; }
  if (daysBetween(fx.d1, today) > 5) warn(`Cursul e din ${fx.d1}, de acum ${daysBetween(fx.d1, today)} zile.`);

  const since = shiftDays(today, -240).slice(0, 7);
  const safe = (p, what) => p.catch((e) => { warn(`Eurostat (${what}): ${e.message}`); return null; });
  const [ro, services, avg12, euroArea] = await Promise.all([
    safe(eurostat('RO', 'TOTAL', 'RCH_A', since), 'România'),
    safe(eurostat('RO', 'SERV', 'RCH_A', since), 'servicii'),
    safe(eurostat('RO', 'TOTAL', 'RCH_MV12MAVR', since), 'media pe 12 luni'),
    safe(eurostat('EA', 'TOTAL', 'RCH_A', since), 'zona euro'),
  ]);
  if (!ro) warn('Inflația nu e disponibilă; păstrez valorile anterioare.');
  const inflation = buildInflation({ ro, services, avg12, euroArea }, prev?.inflation);

  const data = { version: 1, fx, inflation };
  const text = JSON.stringify(data, null, 2) + '\n';
  const before = prev ? JSON.stringify(prev, null, 2) + '\n' : '';
  if (text === before) {
    console.log(`Neschimbat: curs ${fx.source} din ${fx.d1}, inflație ${inflation?.month ?? '—'}.`);
  } else {
    await mkdir(dirname(out), { recursive: true });
    await writeFile(out, text);
    console.log(`Scris data/rates.json: curs ${fx.source} din ${fx.d1} (EUR ${fx.eur1}, USD ${fx.usd1}), inflație ${inflation?.yoy ?? '—'}% în ${inflation?.month ?? '—'}.`);
  }
  return data;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  main().catch((e) => { console.error('Eșuat:', e.message); process.exit(1); });
}
