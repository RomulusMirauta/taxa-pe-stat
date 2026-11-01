/* Pure calculations, no DOM. Tested in tests/calc.test.mjs.
   Rates are fractions: 0.0661 means 6.61%. Amounts are in nominal lei. */

var YEAR_DAYS = 365;
/* `days`: the length of the period in a projection; `back`: the same period in calendar days, looking back
   from a date, for what already happened (fxRealized, F-84). */
var PERIODS = [
  { key: 'zi', label: 'Zi', days: 1, back: 1 },
  { key: 'saptamana', label: 'Săptămână', days: 7, back: 7 },
  { key: 'luna', label: 'Lună', days: 365 / 12, back: 30 },
  { key: 'an', label: 'An', days: 365, back: 365 }
];

/* Reads numbers written the Romanian or English way: "6,61", "6.61", "50.000", "50 000", "1.234,56", "6,61%".
   opts.money: for amounts, "50.000" means fifty thousand and the comma is always the decimal one ("50,000" is
   fifty lei, F-93): the page writes the dots by itself. A group of thousands never starts
   with 0, so "0,500" is half a leu, not 500. "-0" is 0: the page never shows a sign on zero. */
function parseNum(input, opts) {
  var money = !!(opts && opts.money);
  if (typeof input === 'number') return Number.isFinite(input) ? (input === 0 ? 0 : input) : NaN;
  if (typeof input !== 'string') return NaN;
  var s = input.replace(/[\s  ']/g, '').replace(/%$/, '');
  if (!s) return NaN;
  var neg = false;
  if (/^[+\-−]/.test(s)) { neg = s.charAt(0) !== '+'; s = s.slice(1); }
  if (!/^[0-9.,]+$/.test(s) || !/[0-9]/.test(s)) return NaN;
  var dot = s.lastIndexOf('.'), comma = s.lastIndexOf(',');
  var intPart, frac = '';
  if (dot >= 0 && comma >= 0) {
    var dec = dot > comma ? '.' : ',', grp = dec === '.' ? ',' : '.';
    var cut = s.lastIndexOf(dec);
    intPart = s.slice(0, cut); frac = s.slice(cut + 1);
    if (frac.indexOf(grp) >= 0) return NaN;
    if (!new RegExp('^[1-9]\\d{0,2}(\\' + grp + '\\d{3})*$').test(intPart)) return NaN;
    intPart = intPart.split(grp).join('');
  } else if (dot >= 0 || comma >= 0) {
    var parts = s.split(dot >= 0 ? '.' : ',');
    var grouped = /^[1-9]\d{0,2}$/.test(parts[0]) && parts.slice(1).every(function (p) { return /^\d{3}$/.test(p); });
    if (parts.length > 2) {
      if (!grouped) return NaN;
      intPart = parts.join('');
    } else if (money && grouped && dot >= 0) {
      intPart = parts.join('');
    } else {
      intPart = parts[0]; frac = parts[1];
    }
  } else {
    intPart = s;
  }
  var v = Number((intPart || '0') + (frac ? '.' + frac : ''));
  if (!Number.isFinite(v)) return NaN;
  return neg && v !== 0 ? -v : v;
}

/* "YYYY-MM-DD" -> UTC milliseconds; NaN for nonexistent dates (e.g. 2026-02-30). */
function parseISODate(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return NaN;
  var t = Date.parse(s + 'T00:00:00Z');
  if (!Number.isFinite(t) || new Date(t).toISOString().slice(0, 10) !== s) return NaN;
  return t;
}

function daysBetween(a, b) {
  var ta = parseISODate(a), tb = parseISODate(b);
  if (!Number.isFinite(ta) || !Number.isFinite(tb)) return NaN;
  return Math.round((tb - ta) / 864e5);
}

/* Seconds from 1 January, 00:00 local time, of the local year of `nowMs`, to `nowMs` (the counter, F-85). The
   offsets are getTimezoneOffset()'s, in minutes (UTC − local): the one at `nowMs`, which gives the local year, and
   the one on 1 January, which gives its midnight; in summer time they differ by an hour. */
function secondsSinceYearStart(nowMs, offsetNow, offsetJan1) {
  if (![nowMs, offsetNow, offsetJan1].every(Number.isFinite)) return NaN;
  var year = new Date(nowMs - offsetNow * 60000).getUTCFullYear();
  return (nowMs - (Date.UTC(year, 0, 1) + offsetJan1 * 60000)) / 1000;
}

/* The date `n` days after `iso` (before it, for a negative n); '' for an invalid date. */
function addDays(iso, n) {
  var t = parseISODate(iso);
  return Number.isFinite(t) ? new Date(t + n * 864e5).toISOString().slice(0, 10) : '';
}

/* Age in days, on `today`, of a date or of a month ("YYYY-MM", counted from its first day). NaN if invalid. */
function ageDays(iso, today) {
  return daysBetween(typeof iso === 'string' && /^\d{4}-\d{2}$/.test(iso) ? iso + '-01' : iso, today);
}
/* After how many days the page flags a value as old: the exchange rate (F-24); the BNR inflation report,
   which comes out every quarter; the Tezaur rate, set by hand from the monthly issues; BNR's average deposit
   rate, which BNR publishes about two months after its month: 150 days from the month's first day is about
   4 months after its end, when at least one newer month should be out. */
var STALE_DAYS = { fx: 7, report: 100, tezaur: 90, deposit: 150 };
function isStale(kind, iso, today) { return ageDays(iso, today) > STALE_DAYS[kind]; }
/* Eurostat publishes a month around the 18th of the next one (January only at the end of February), and the
   bot runs on working days: the month after `month` is late only when `month` is more than 90 days old,
   counted from its first day. */
function inflationOverdue(month, today) { return ageDays(month, today) > 90; }
/* The month `ym` ("YYYY-MM") is over on `today`. */
function monthPassed(ym, today) { return typeof ym === 'string' && typeof today === 'string' && today.slice(0, 7) > ym; }

/* A pair of exchange rates (lei for 1 unit, then and now) that can be real: each between 0 and 1000, at most
   4 times apart. A forgotten or misplaced comma changes a rate at least 10 times; the largest real move since
   2005 is about 2.15 times (USD: 2.2319 in April 2008, 4.8088 in October 2026). */
var FX_MAX = 1000, FX_MAX_RATIO = 4;
function fxPairOk(c0, c1) {
  return typeof c0 === 'number' && typeof c1 === 'number' && c0 > 0 && c1 > 0 && c0 < FX_MAX && c1 < FX_MAX &&
    Math.max(c0 / c1, c1 / c0) <= FX_MAX_RATIO;
}

/* How much of its foreign-currency value the leu kept between two rates (lei per 1 unit),
   and the equivalent annual pace. Without a valid interval, or when the pace overflows, there is no pace.
   A pace below −1000% a year (the leu would gain more than ten times its value) is an artefact of a very
   short interval, not a pace: annual is then NaN, and nothing is projected from it. */
var MIN_ANNUAL = -10;
function fxTrend(c0, c1, days) {
  if (!(c0 > 0 && c1 > 0 && days > 0)) return null;
  var kept = c0 / c1, annual = 1 - Math.pow(kept, YEAR_DAYS / days);
  if (!Number.isFinite(annual)) return null;
  return { kept: kept, lost: 1 - kept, annual: annual >= MIN_ANNUAL ? annual : NaN, days: days };
}

/* Under 180 days, extrapolating the leu's pace to a whole year exaggerates: the page warns (F-05). */
var SHORT_DAYS = 180;
function isShortInterval(days) { return days > 0 && days < SHORT_DAYS; }

/* The BNR rate on the date `iso`, from a series of [date, eur, usd] rows in ascending order (normalizeRates):
   the last row on or before that date, since weekends and holidays keep the last published rate.
   null when that row is more than 10 days older than the date (the series does not reach it),
   when the date is after `today`, or without a series. */
function rateOn(series, iso, today) {
  var t = parseISODate(iso);
  if (!Array.isArray(series) || !Number.isFinite(t) || !(parseISODate(today) >= t)) return null;
  var best = null;
  for (var k = 0; k < series.length && series[k][0] <= iso; k++) best = series[k];
  return best && daysBetween(best[0], iso) <= 10 ? best : null;
}

/* Data that arrives after the page has started: which fields to write, by id. `current` is what the fields
   hold, `lastFilled` what was last written into them, `next` the new values. A field the user changed (it
   differs from what was written) is kept, and so is the field with the focus. The dates and the rates go
   together: if any of them was changed, or has the focus, none of them is written. */
var FX_FIELDS = ['d0', 'd1', 'eur0', 'eur1', 'usd0', 'usd1'];
function mergeInputs(current, lastFilled, next, focusedId) {
  var changed = function (id) { return current[id] !== lastFilled[id]; };
  var keepFx = FX_FIELDS.some(function (id) { return id === focusedId || changed(id); });
  var out = {};
  Object.keys(next).forEach(function (id) {
    if (id !== focusedId && !changed(id) && !(keepFx && FX_FIELDS.indexOf(id) >= 0)) out[id] = next[id];
  });
  return out;
}

/* p = { S, pi, rate, tax, fees, net }. In no-interest mode (net=false), interest and fees don't count. */
function netRate(p) { return p.rate * (1 - p.tax); }
function growth(p) { return p.net ? 1 + netRate(p) : 1; }
function feesOf(p) { return p.net ? p.fees : 0; }

/* Nominal balance after `years` years: compound interest, fees paid along the way. */
function nominalBalance(p, years) { return p.S * Math.pow(growth(p), years) - feesOf(p) * years; }

/* Loss of purchasing power after `days` days, in today's lei. Negative = real gain. */
function realLoss(p, days) {
  var y = days / YEAR_DAYS;
  return p.S - nominalBalance(p, y) / Math.pow(1 + p.pi, y);
}

/* Loss measured in the foreign currency after `days` days, if the leu loses `annualDep` a year against it. */
function fxLoss(p, annualDep, rateNow, days) {
  var y = days / YEAR_DAYS;
  return (p.S - nominalBalance(p, y) * Math.pow(1 - annualDep, y)) / rateNow;
}

/* What already happened against a currency over the last `days` days, in that currency (F-84): the money that
   became S lei today, valued at the rate of then, minus S valued at the rate of now. With interest that money
   was less than S, with fees more (nominalBalance, backwards). Positive is a loss, like the other rows; without
   interest and fees it is S/cThen − S/cNow. */
function fxRealizedLoss(p, cThen, cNow, days) {
  var y = days / YEAR_DAYS;
  return ((p.S + feesOf(p) * y) / Math.pow(growth(p), y)) / cThen - p.S / cNow;
}

/* fxRealizedLoss for each period, looking back from `d1`, whose rate is `cNow`: the rate of then is BNR's on the
   date `back` days before d1 (rateOn). NaN where the series does not reach that date. `col` is the currency's
   column in the series: 1 for EUR, 2 for USD. Exchange rates go up and down: this is never projected. */
function fxRealized(p, series, d1, cNow, col, today) {
  return PERIODS.map(function (q) {
    var row = rateOn(series, addDays(d1, -q.back), today);
    return row ? fxRealizedLoss(p, row[col], cNow, q.back) : NaN;
  });
}

/* Real value (today's lei) after `years` years. */
function realValue(p, years) { return Math.max(0, nominalBalance(p, years)) / Math.pow(1 + p.pi, years); }

/* Instantaneous rate of real loss, in lei per year (for the live counter). */
function lossRatePerYear(p) { return p.S * (Math.log(1 + p.pi) - Math.log(growth(p))) + feesOf(p); }

/* The interest and the fees in words, for the counter note and the chart hint. Fees are never described
   as absent when they are charged. `pct` and `lei` are the page's formatters. */
function accountNote(p, pct, lei) {
  var i = p.net ? netRate(p) : 0, fees = p.net && p.fees > 0 ? lei(p.fees) + ' comisioane pe an' : '';
  if (i > 0) return 'cu dobânda netă de ' + pct(i) + (fees ? ' și ' + fees : '');
  return 'fără dobândă' + (fees ? ', dar cu ' + fees : '');
}

/* Gross interest rate at which the real value stays unchanged after one year. Exact, not approximate:
   (S(1+i) - F) / (1+π) = S  <=>  i = π + F/S, where i = r(1-τ). When prices fall faster than the fees take
   (π + F/S ≤ 0), any interest keeps up, even 0%: a negative gross rate would assume that the tax is paid
   back on negative interest, and the form accepts none (F-09). */
function breakEvenRate(pi, tax, feesPerYear, S) {
  if (!(tax >= 0 && tax < 1)) return NaN;
  var need = pi + (S > 0 && feesPerYear > 0 ? feesPerYear / S : 0);
  return need <= 0 ? 0 : need / (1 - tax);
}

/* The lowest gross rate, in %, rounded up to 2 decimals, at which the counter turns green within `secs` seconds:
   a real gain of 0,00006 lei by then, which the counter rounds to +0,0001. From lossRatePerYear ≤ −G:
   1 + r(1−τ) = (1+π)·e^((F+G)/S). NaN without a sum. */
function rateForGainIn(pi, tax, feesPerYear, S, secs) {
  if (!(S > 0) || !(tax >= 0 && tax < 1) || !(secs > 0)) return NaN;
  var G = 0.00006 / secs * YEAR_DAYS * 86400;
  var r = ((1 + pi) * Math.exp((Math.max(0, feesPerYear) + G) / S) - 1) / (1 - tax);
  return Math.max(0, Math.ceil(r * 1e4 - 1e-9) / 100);
}

/* How many extra lei you need in `years` years for the same basket. */
function extraNeeded(S, pi, years) { return S * (Math.pow(1 + pi, years) - 1); }

/* "Round" step for the chart axis: 1, 2, 2.5, 5 or 10 × 10^n. */
function niceStep(max, ticks) {
  if (!(max > 0) || !(ticks > 0)) return 1;
  var raw = max / ticks, pow = Math.pow(10, Math.floor(Math.log10(raw))), m = raw / pow;
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * pow;
}

/* The BNR history from data/rates.json, [date, eur, usd] rows: kept only if every date is valid and later
   than the one before, every rate is between 0 and 1000, and there are at most 600 rows (the bot keeps
   400 days, about 280 working days). Otherwise null: the page then works without it. */
var SERIES_MAX = 600;
function seriesOf(s) {
  var rate = function (v) { return typeof v === 'number' && v > 0 && v < FX_MAX; };
  if (!Array.isArray(s) || !s.length || s.length > SERIES_MAX) return null;
  for (var k = 0; k < s.length; k++) {
    var r = s[k];
    if (!Array.isArray(r) || !Number.isFinite(parseISODate(r[0])) || (k > 0 && !(r[0] > s[k - 1][0])) || !rate(r[1]) || !rate(r[2])) return null;
  }
  return s.map(function (r) { return [r[0], r[1], r[2]]; });
}

/* Validates data/rates.json before the page uses it. Returns only what is valid, or null. */
function normalizeRates(j) {
  if (!j || typeof j !== 'object') return null;
  var out = {};
  var label = function (v) { return typeof v === 'string' ? v.slice(0, 40) : ''; };
  var month = function (v) { return typeof v === 'string' && /^\d{4}-\d{2}$/.test(v) && Number.isFinite(parseISODate(v + '-01')); };
  var pctOk = function (v) { return typeof v === 'number' && v > -50 && v < 500; };
  var f = j.fx;
  if (f && daysBetween(f.d0, f.d1) > 0 && fxPairOk(f.eur0, f.eur1) && fxPairOk(f.usd0, f.usd1)) {
    out.fx = { source: label(f.source) || 'BNR', d0: f.d0, d1: f.d1, eur0: f.eur0, eur1: f.eur1, usd0: f.usd0, usd1: f.usd1 };
    var series = seriesOf(f.series);
    if (series) out.fx.series = series;
  }
  var i = j.inflation;
  if (i && month(i.month) && pctOk(i.yoy)) {
    out.inflation = { source: label(i.source) || 'Eurostat (IAPC)', month: i.month, yoy: i.yoy };
    if (pctOk(i.services)) out.inflation.services = i.services;
    if (pctOk(i.avg12)) out.inflation.avg12 = i.avg12;
    if (pctOk(i.euroArea)) {
      out.inflation.euroArea = i.euroArea;
      out.inflation.euroAreaMonth = month(i.euroAreaMonth) ? i.euroAreaMonth : i.month;
    }
  }
  return out.fx || out.inflation ? out : null;
}

export const Calc = Object.freeze({
  YEAR_DAYS: YEAR_DAYS, PERIODS: PERIODS, parseNum: parseNum, parseISODate: parseISODate, rateForGainIn: rateForGainIn,
  daysBetween: daysBetween, addDays: addDays, secondsSinceYearStart: secondsSinceYearStart, ageDays: ageDays, isStale: isStale, inflationOverdue: inflationOverdue,
  monthPassed: monthPassed, fxPairOk: fxPairOk, fxTrend: fxTrend, isShortInterval: isShortInterval,
  rateOn: rateOn, mergeInputs: mergeInputs, netRate: netRate, growth: growth,
  nominalBalance: nominalBalance, realLoss: realLoss, fxLoss: fxLoss, fxRealizedLoss: fxRealizedLoss,
  fxRealized: fxRealized, realValue: realValue,
  lossRatePerYear: lossRatePerYear, accountNote: accountNote, breakEvenRate: breakEvenRate,
  extraNeeded: extraNeeded, niceStep: niceStep, normalizeRates: normalizeRates
});
