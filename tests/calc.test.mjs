// Tests for the calculations in app.html (the <script id="calc"> block).
// Run: npm test  (or: node --test)
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync(new URL('../app.html', import.meta.url), 'utf8');
const src = html.match(/<script id="calc">([\s\S]*?)<\/script>/)?.[1];
assert.ok(src, 'the <script id="calc"> block is missing from app.html');
const ctx = vm.createContext({});
vm.runInContext(src, ctx);
const C = ctx.Calc;

const close = (actual, expected, eps, what = '') =>
  assert.ok(Math.abs(actual - expected) <= eps, `${what} ${actual} ≠ ${expected} (±${eps})`);

const S = 50000;
const PI = 0.0661;
const raw = { S, pi: PI, rate: 0, tax: 0.1, fees: 0, net: false };
const dep = { S, pi: PI, rate: 0.055, tax: 0.1, fees: 0, net: true };

describe('parseNum: numbers written the Romanian or English way', () => {
  const cases = [
    ['6,61', 6.61], ['6.61', 6.61], ['6,61%', 6.61], [' 10 ', 10], ['0', 0], ['-3,5', -3.5], ['−2', -2], ['+5', 5],
    ['5,3495', 5.3495], ['5.3495', 5.3495], ['1.234,56', 1234.56], ['1,234.56', 1234.56], ['1.234.567', 1234567],
    ['50.', 50], [',5', 0.5],
  ];
  for (const [input, expected] of cases) {
    test(`"${input}" → ${expected}`, () => assert.equal(C.parseNum(input), expected));
  }
  test('for amounts, a dot or comma followed by 3 digits separates thousands', () => {
    assert.equal(C.parseNum('50.000', { money: true }), 50000);
    assert.equal(C.parseNum('50,000', { money: true }), 50000);
    assert.equal(C.parseNum('50 000', { money: true }), 50000);
    assert.equal(C.parseNum('50.000,50', { money: true }), 50000.5);
    assert.equal(C.parseNum('50,5', { money: true }), 50.5);
  });
  test('for rates, "50.000" stays 50 (decimal point)', () => assert.equal(C.parseNum('50.000'), 50));
  test('a group of thousands never starts with 0: "0,500" is half a leu, not 500', () => {
    for (const [input, expected] of [['0,500', 0.5], ['0.500', 0.5], ['0.050', 0.05], ['0,005', 0.005], ['00,500', 0.5]]) {
      assert.equal(C.parseNum(input, { money: true }), expected, input);
    }
    assert.equal(C.parseNum('50.000', { money: true }), 50000);
    assert.equal(C.parseNum('1.000.000', { money: true }), 1000000);
  });
  test('"-0" is 0, never a negative zero (the page would show „-0”)', () => {
    for (const z of ['-0', '−0', '-0,00', '+0', -0]) assert.ok(Object.is(C.parseNum(z), 0), String(z));
  });
  for (const bad of ['', '   ', 'abc', '.', ',', '1e3', '12.34.56', '1,5,6', '1.000,000.5', '5%5', '--3', '0.500,5', '0,500.5', '0.500.000', null, undefined]) {
    test(`invalid: ${JSON.stringify(bad) ?? 'undefined'} → NaN, not 0`, () => assert.ok(Number.isNaN(C.parseNum(bad))));
  }
});

describe('dates', () => {
  test('12 months = 365 days', () => assert.equal(C.daysBetween('2025-10-28', '2026-10-28'), 365));
  test('reversed order gives a negative number', () => assert.equal(C.daysBetween('2026-10-28', '2025-10-28'), -365));
  test('missing or nonexistent dates → NaN', () => {
    for (const d of ['', '2026-02-30', '28.10.2026', '2026-13-01']) assert.ok(Number.isNaN(C.daysBetween(d, '2026-10-28')), d);
  });
});

describe('exchange rate: depreciation of the leu', () => {
  test('EUR, 28 Oct 2025 → 28 Oct 2026: the leu lost 4.96%', () => {
    const t = C.fxTrend(5.0844, 5.3495, 365);
    close(t.lost, 0.04956, 0.00001);
    close(t.annual, t.lost, 1e-12, 'at 365 days, the annual pace equals the loss:');
  });
  test('a short interval extrapolates wildly (which is why the app warns)', () => {
    assert.ok(C.fxTrend(5.30, 5.32, 1).annual > 0.7);
  });
  test('without a valid interval or exchange rates there is no pace', () => {
    assert.equal(C.fxTrend(5.08, 5.35, 0), null);
    assert.equal(C.fxTrend(5.08, 5.35, -10), null);
    assert.equal(C.fxTrend(5.08, 5.35, NaN), null);
    assert.equal(C.fxTrend(0, 5.35, 365), null);
    assert.equal(C.fxTrend(NaN, 5.35, 365), null);
  });
  test('a pace that overflows is no pace: null, not −∞', () => {
    assert.equal(C.fxTrend(53.495, 5.3495, 1), null);
    assert.equal(C.fxTrend(5.0844, 0.0001, 1), null);
  });
  test('an absurd extrapolation (a gain above 1000% a year) gives no annual pace, but the loss so far stays', () => {
    const t = C.fxTrend(7.3495, 5.3495, 1);
    assert.ok(Number.isNaN(t.annual));
    close(t.lost, 1 - 7.3495 / 5.3495, 1e-12);
    assert.ok(Number.isNaN(C.fxTrend(5.0844, 0.0001, 30).annual));
    assert.ok(Number.isNaN(C.fxLoss(raw, t.annual, 5.3495, 365)), 'so nothing is projected');
  });
  test('real moves keep their pace', () => {
    close(C.fxTrend(5.3527, 5.3495, 1).annual, -0.2439, 0.0001);
    close(C.fxTrend(5.30, 5.32, 1).annual, 0.7471, 0.0001);
    close(C.fxTrend(2.2319, 4.8088, 6762).annual, 0.0406, 0.0001, 'USD, April 2008 → October 2026:');
  });
  test('a pair of rates that can be real: each in (0, 1000), at most 4 times apart', () => {
    for (const [c0, c1] of [[5.0844, 5.3495], [2.2319, 4.8088], [4, 1], [1, 4], [999, 999]]) assert.equal(C.fxPairOk(c0, c1), true, `${c0}, ${c1}`);
    for (const [c0, c1] of [[53495, 5.3495], [53.495, 5.3495], [5.0844, 0.0001], [4.01, 1], [1000, 999], [0, 5], [-5, 5], [NaN, 5], ['5', '5']]) {
      assert.equal(C.fxPairOk(c0, c1), false, `${c0}, ${c1}`);
    }
  });
  test('under 180 days the interval is short: the page warns that the yearly pace exaggerates (F-05)', () => {
    assert.equal(C.isShortInterval(1), true);
    assert.equal(C.isShortInterval(179), true);
    for (const d of [180, 365, 0, -5, NaN]) assert.equal(C.isShortInterval(d), false, String(d));
  });
});

describe('the BNR rate on a date (rateOn)', () => {
  const series = [
    ['2026-09-10', 5.27, 4.60], // then a gap of 21 days
    ['2026-10-01', 5.2777, 4.6765], ['2026-10-02', 5.3447, 4.7519], ['2026-10-05', 5.3306, 4.7569],
  ];
  const on = (iso, today = '2026-10-29') => (r => r && Array.from(r))(C.rateOn(series, iso, today));
  test('the exact day', () => assert.deepEqual(on('2026-10-02'), ['2026-10-02', 5.3447, 4.7519]));
  test('a weekend or a holiday: the last published rate', () => {
    assert.equal(on('2026-10-03')[0], '2026-10-02');
    assert.equal(on('2026-10-04')[0], '2026-10-02');
  });
  test('after the end of the series: the last row, up to 10 days', () => {
    assert.equal(on('2026-10-15')[0], '2026-10-05');
    assert.equal(on('2026-10-16'), null);
  });
  test('no answer before the series, inside a gap of more than 10 days, or after today', () => {
    assert.equal(on('2026-09-01'), null);
    assert.equal(on('2026-09-20')[0], '2026-09-10', '10 days after a row');
    assert.equal(on('2026-09-21'), null, '11 days after it');
    assert.equal(on('2026-10-05', '2026-10-04'), null, 'a date in the future');
    assert.equal(on('2026-10-05', 'today'), null, 'without a valid today');
  });
  test('no answer without a series or a valid date', () => {
    for (const s of [undefined, null, [], 'x']) assert.equal(C.rateOn(s, '2026-10-02', '2026-10-29'), null);
    for (const d of ['', '2026-02-30', '02.10.2026', null]) assert.equal(C.rateOn(series, d, '2026-10-29'), null);
  });
});

describe('the BNR history from data/rates.json (normalizeRates)', () => {
  const fx = { source: 'BNR', d0: '2025-10-28', eur0: 5.0844, usd0: 4.3591, d1: '2026-10-28', eur1: 5.3495, usd1: 4.8088 };
  const series = [['2025-10-28', 5.0844, 4.3591], ['2026-10-27', 5.3487, 4.7977], ['2026-10-28', 5.3495, 4.8088]];
  const norm = (f) => JSON.parse(JSON.stringify(C.normalizeRates({ fx: f })?.fx ?? null));
  test('a valid series is kept, as [date, eur, usd] rows; the other fields stay as they were', () => {
    assert.deepEqual(norm({ ...fx, series: series.map((r) => [...r, 'extra']) }), { ...fx, series });
    assert.deepEqual(norm(fx), fx, 'without a series');
  });
  const broken = {
    'not an array': 'x',
    'empty': [],
    'a row that is not an array': [series[0], null],
    'a wrong date': [['2026-02-30', 5, 4]],
    'dates not increasing': [series[1], series[0]],
    'the same date twice': [series[0], series[0]],
    'a rate of 0': [['2026-10-28', 0, 4.8]],
    'a rate above 1000': [['2026-10-28', 5.3, 4800]],
    'a rate as text': [['2026-10-28', '5,3', 4.8]],
    'more than 600 rows': Array.from({ length: 601 }, (_, i) => [new Date(Date.UTC(2024, 0, 1 + i)).toISOString().slice(0, 10), 5, 4.5]),
  };
  for (const [what, s] of Object.entries(broken)) {
    test(`a broken series is dropped, the rest of fx stays: ${what}`, () => assert.deepEqual(norm({ ...fx, series: s }), fx));
  }
  test('600 rows are still a series', () => assert.equal(norm({ ...fx, series: broken['more than 600 rows'].slice(1) }).series.length, 600));
  test('exchange rates that cannot be real are rejected, like in the form', () => {
    assert.equal(norm({ ...fx, eur0: 53.495 }), null, 'a misplaced comma: 10 times the other rate');
    assert.equal(norm({ ...fx, usd1: 1000 }), null);
  });
});

describe('data that arrives late (mergeInputs)', () => {
  const filled = { sum: '50.000', infl: '6,5', rate: '0', tax: '10', d0: '2025-10-28', d1: '2026-10-28', eur0: '5,0844', eur1: '5,3495', usd0: '4,3591', usd1: '4,8088' };
  const next = { ...filled, infl: '6,1', d0: '2025-10-29', d1: '2026-10-29', eur0: '5,0901', eur1: '5,3601', usd0: '4,3655', usd1: '4,825' };
  const merge = (current, focus = '') => Object.keys(JSON.parse(JSON.stringify(C.mergeInputs(current, filled, next, focus)))).sort();
  const fxIds = ['d0', 'd1', 'eur0', 'eur1', 'usd0', 'usd1'];
  test('nothing changed: everything is written', () => assert.deepEqual(merge(filled), Object.keys(next).sort()));
  test('only the sum changed: the dates, the rates and inflation still get the new data', () => {
    assert.deepEqual(merge({ ...filled, sum: '60.000' }), Object.keys(next).filter((id) => id !== 'sum').sort());
  });
  test('one rate changed: none of the dates and rates is written, inflation still is', () => {
    assert.deepEqual(merge({ ...filled, eur1: '5,4' }), ['infl', 'rate', 'sum', 'tax']);
    assert.deepEqual(merge({ ...filled, d0: '2026-10-01' }), ['infl', 'rate', 'sum', 'tax']);
  });
  test('a chip changed the rate and the tax: the rest is written', () => {
    assert.deepEqual(merge({ ...filled, rate: '5,5', tax: '0' }), [...fxIds, 'infl', 'sum'].sort());
  });
  test('the field with the focus is never written, and a focused date or rate keeps all of them', () => {
    assert.deepEqual(merge(filled, 'infl'), Object.keys(next).filter((id) => id !== 'infl').sort());
    assert.deepEqual(merge(filled, 'eur1'), ['infl', 'rate', 'sum', 'tax']);
  });
  test('the values written are the new ones', () => {
    assert.equal(C.mergeInputs({ ...filled, sum: '1' }, filled, next, '').eur1, '5,3601');
  });
});

describe('dates of the data: when the page flags them as old', () => {
  test('age in days, from a date or from the first day of a month', () => {
    assert.equal(C.ageDays('2026-10-28', '2026-10-29'), 1);
    assert.equal(C.ageDays('2026-09', '2026-10-01'), 30);
    assert.ok(Number.isNaN(C.ageDays('2026-13', '2026-10-29')));
  });
  test('the exchange rate after 7 days (F-24)', () => {
    assert.equal(C.isStale('fx', '2026-10-28', '2026-11-04'), false);
    assert.equal(C.isStale('fx', '2026-10-28', '2026-11-05'), true);
  });
  test('the BNR report after 100 days (one comes out every quarter)', () => {
    assert.equal(C.isStale('report', '2026-08', '2026-11-09'), false);
    assert.equal(C.isStale('report', '2026-08', '2026-11-10'), true);
  });
  test('the Tezaur rate after 90 days', () => {
    assert.equal(C.isStale('tezaur', '2026-10', '2026-12-30'), false);
    assert.equal(C.isStale('tezaur', '2026-10', '2026-12-31'), true);
  });
  test('the BNR deposit rate, published about two months after its month, only after 150 days', () => {
    assert.equal(C.isStale('deposit', '2026-07', '2026-10-29'), false, 'the latest month BNR has published is not old');
    assert.equal(C.isStale('deposit', '2026-07', '2026-11-28'), false);
    assert.equal(C.isStale('deposit', '2026-07', '2026-11-29'), true, 'about 4 months after the end of July');
  });
  test('inflation: the next month is overdue only after 90 days, January (published end of February) included', () => {
    for (const [month, today] of [['2026-09', '2026-11-17'], ['2026-09', '2026-11-19'], ['2026-10', '2026-12-18'], ['2026-11', '2027-01-20'],
      ['2025-12', '2026-02-26'], ['2026-12', '2027-03-01'], ['2026-09', '2026-10-29']]) {
      assert.equal(C.inflationOverdue(month, today), false, `${month} on ${today}`);
    }
    assert.equal(C.inflationOverdue('2026-09', '2026-12-05'), true);
    assert.equal(C.inflationOverdue('2026-12', '2027-03-02'), true);
  });
  test('the forecast is shown until its target month is over', () => {
    assert.equal(C.monthPassed('2027-12', '2027-12-31'), false);
    assert.equal(C.monthPassed('2027-12', '2028-01-01'), true);
    assert.equal(C.monthPassed('2027-12', '2026-10-29'), false);
  });
});

describe('inflation: the real loss', () => {
  test('50,000 lei at 6.61%, no interest', () => {
    close(C.realLoss(raw, 1), 8.77, 0.005, 'day');
    close(C.realLoss(raw, 7), 61.34, 0.005, 'week');
    close(C.realLoss(raw, 365 / 12), 265.99, 0.005, 'month');
    close(C.realLoss(raw, 365), 3100.08, 0.005, 'year');
  });
  test('deposit 5.5% gross, 10% tax → 4.95% net', () => {
    close(C.netRate(dep), 0.0495, 1e-12);
    close(C.realLoss(dep, 365), 778.54, 0.005);
  });
  test('net interest above inflation gives a gain (negative value)', () => {
    assert.ok(C.realLoss({ ...dep, rate: 0.0715, tax: 0 }, 365) < 0);
  });
  test('no inflation and no interest: nothing is lost', () => assert.equal(C.realLoss({ ...raw, pi: 0 }, 365), 0));
  test('deflation gives a gain', () => assert.ok(C.realLoss({ ...raw, pi: -0.02 }, 365) < 0));
  test('fees count only in the with-interest mode', () => {
    close(C.realLoss({ S: 0, pi: 0, rate: 0, tax: 0, fees: 100, net: true }, 365), 100, 1e-9);
    assert.equal(C.realLoss({ S: 0, pi: 0, rate: 0, tax: 0, fees: 100, net: false }, 365), 0);
  });
  test('fees are deflated like the rest of the money', () => {
    close(C.realLoss({ S: 0, pi: 0.1, rate: 0, tax: 0, fees: 110, net: true }, 365), 100, 1e-9);
  });
  test('without fees, the formula is the one in DESIGN.md: S·(1 − (g/(1+π))^y)', () => {
    close(C.realLoss(dep, 182.5), S * (1 - Math.pow(1.0495 / (1 + PI), 0.5)), 1e-9);
  });
});

describe('loss against foreign currency', () => {
  const eur = C.fxTrend(5.0844, 5.3495, 365);
  test('no interest, over one year: S × annual pace / current rate', () => {
    close(C.fxLoss(raw, eur.annual, 5.3495, 365), (S * eur.annual) / 5.3495, 1e-9);
  });
  test('reference values for 50,000 lei', () => {
    close(C.fxLoss(raw, eur.annual, 5.3495, 1), 1.30, 0.005, 'day, no interest');
    close(C.fxLoss(raw, eur.annual, 5.3495, 365), 463.18, 0.005, 'year, no interest');
    close(C.fxLoss(dep, eur.annual, 5.3495, 365), 23.45, 0.005, 'year, with deposit');
  });
  test('no depreciation and no interest: nothing is lost in foreign currency', () => {
    assert.equal(C.fxLoss(raw, 0, 5.3495, 365), 0);
  });
});

describe('other results', () => {
  test('the minimum gross rate is exact: 6.61% / (1 − 10%) = 7.344%', () => {
    close(C.breakEvenRate(PI, 0.1, 0, S), 0.073444, 0.000001);
  });
  test('at the minimum rate, the real value is unchanged after a year (with fees too)', () => {
    const r = C.breakEvenRate(PI, 0.1, 120, S);
    close(C.realLoss({ S, pi: PI, rate: r, tax: 0.1, fees: 120, net: true }, 365), 0, 1e-6);
  });
  test('100% or missing tax → no answer', () => {
    assert.ok(Number.isNaN(C.breakEvenRate(PI, 1, 0, S)));
    assert.ok(Number.isNaN(C.breakEvenRate(PI, NaN, 0, S)));
    assert.ok(Number.isNaN(C.breakEvenRate(NaN, 0.1, 0, S)), 'or missing inflation');
  });
  test('when prices fall faster than the fees take (π + F/S ≤ 0), any interest keeps up, even 0%: never negative', () => {
    assert.equal(C.breakEvenRate(-0.01, 0.1, 0, S), 0);
    assert.equal(C.breakEvenRate(-0.01, 0.1, 250, S), 0, 'π + F/S = −0.5%');
    assert.equal(C.breakEvenRate(0, 0.1, 0, S), 0);
    assert.ok(C.realLoss({ S, pi: -0.01, rate: 0, tax: 0.1, fees: 250, net: true }, 365) <= 0, 'at 0% the real value does not fall');
  });
  test('with deflation, fees can still need interest: π + F/S > 0', () => {
    const r = C.breakEvenRate(-0.01, 0.1, 1000, S);
    close(r, 0.011111, 0.000001);
    close(C.realLoss({ S, pi: -0.01, rate: r, tax: 0.1, fees: 1000, net: true }, 365), 0, 1e-6);
  });
  test('the counter includes the fees: S·(ln(1+π) − ln g) + F (DESIGN §5.6)', () => {
    close(C.lossRatePerYear({ S: 0, pi: 0, rate: 0, tax: 0, fees: 120, net: true }), 120, 1e-12);
    assert.equal(C.lossRatePerYear({ S: 0, pi: 0, rate: 0, tax: 0, fees: 120, net: false }), 0, 'without interest, fees do not count');
  });
  test('the counter note names the fees when they are charged, never „fără dobândă și comisioane”', () => {
    const pct = (f) => `${(f * 100).toFixed(2)}%`;
    const lei = (v) => `${v} lei`;
    const note = (p) => C.accountNote({ S, pi: PI, tax: 0.1, ...p }, pct, lei);
    assert.equal(note({ rate: 0, fees: 0, net: true }), 'fără dobândă');
    assert.equal(note({ rate: 0, fees: 240, net: true }), 'fără dobândă, dar cu 240 lei comisioane pe an');
    assert.equal(note({ rate: 0.055, fees: 0, net: true }), 'cu dobânda netă de 4.95%');
    assert.equal(note({ rate: 0.055, fees: 240, net: true }), 'cu dobânda netă de 4.95% și 240 lei comisioane pe an');
    assert.equal(note({ rate: 0.055, fees: 240, net: false }), 'fără dobândă', 'without interest the fees do not count (§5)');
  });
  test('next year you need 6.61% more: 3,305 lei', () => close(C.extraNeeded(S, PI, 1), 3305, 1e-9));
  test('real value in 10 years', () => {
    close(C.realValue(raw, 10), 26363, 0.5, 'no interest');
    close(C.realValue(dep, 10), 42738, 0.5, 'with deposit');
  });
  test('real value does not go below zero when fees eat everything', () => {
    assert.equal(C.realValue({ S: 100, pi: 0.05, rate: 0, tax: 0, fees: 1000, net: true }, 1), 0);
  });
  test('counter: the rate over one day ≈ the loss over one day', () => close(C.lossRatePerYear(raw) / 365, C.realLoss(raw, 1), 0.001));
  test('the counter accounts for interest', () => assert.ok(C.lossRatePerYear(dep) < C.lossRatePerYear(raw)));
  test('round step for the chart axis', () => {
    assert.equal(C.niceStep(50000, 4), 20000);
    assert.equal(C.niceStep(100, 4), 25);
    assert.equal(C.niceStep(0, 4), 1);
  });
  test('round step: every bucket, 1, 2, 2.5, 5 and 10', () => {
    assert.deepEqual([4, 8, 10, 20, 24].map((max) => C.niceStep(max, 4)), [1, 2, 2.5, 5, 10]);
    assert.equal(C.niceStep(150000, 4), 50000);
  });
  test('periods: day, week, month, year', () => {
    assert.deepEqual(Array.from(C.PERIODS, (p) => p.days), [1, 7, 365 / 12, 365]);
  });
});

// Every figure of DESIGN §6, so the document cannot drift from the code (F-45).
describe('the worked example in DESIGN §6 (50,000 lei, 6.61%, BNR 28 Oct 2025 → 28 Oct 2026)', () => {
  const taxFree = (rate) => ({ S, pi: PI, rate, tax: 0, fees: 0, net: true });
  const rows = {
    'current account': [raw, [8.77, 61.34, 265.99, 3100.08]],
    'deposit 5.5% gross': [dep, [2.15, 15.05, 65.35, 778.54]],
    'Tezaur 1 year, 6.5% tax-free': [taxFree(0.065), [0.14, 0.99, 4.30, 51.59]],
    'Fidelis 4 years, 7.15% tax-free': [taxFree(0.0715), [-0.69, -4.85, -21.06, -253.26]],
  };
  for (const [name, [p, losses]] of Object.entries(rows)) {
    test(`the real loss by period: ${name}`, () => {
      C.PERIODS.forEach((q, i) => close(C.realLoss(p, q.days), losses[i], 0.005, q.label));
    });
  }
  const eur = C.fxTrend(5.0844, 5.3495, 365);
  const usd = C.fxTrend(4.3591, 4.8088, 365);
  test('against foreign currency, already realised', () => {
    close(S / 5.0844, 9834.00, 0.005, 'EUR then');
    close(S / 5.3495, 9346.67, 0.005, 'EUR now');
    close(S / 5.3495 - S / 5.0844, -487.33, 0.005, 'EUR difference');
    close(S / 4.3591, 11470.26, 0.005, 'USD then');
    close(S / 4.8088, 10397.60, 0.005, 'USD now');
    close(S / 4.8088 - S / 4.3591, -1072.65, 0.005, 'USD difference');
    close(usd.lost, 0.0935, 0.00005, 'the leu lost 9.35% against the dollar');
  });
  test('against foreign currency, projected over a year', () => {
    close(C.fxLoss(raw, eur.annual, 5.3495, 365), 463.18, 0.005, 'EUR, current account');
    close(C.fxLoss(raw, usd.annual, 4.8088, 365), 972.34, 0.005, 'USD, current account');
    close(C.fxLoss(dep, eur.annual, 5.3495, 365), 23.45, 0.005, 'EUR, deposit');
    close(C.fxLoss(dep, usd.annual, 4.8088, 365), 505.79, 0.005, 'USD, deposit');
  });
  test('in 10 years, the minimum rate and the extra lei', () => {
    close(C.realValue(raw, 10), 26363, 0.5, 'no interest');
    close(C.realValue(dep, 10), 42738, 0.5, 'deposit');
    close(C.breakEvenRate(PI, 0.1, 0, S), 0.0734, 0.00005, 'with a 10% tax');
    close(C.breakEvenRate(PI, 0, 0, S), 0.0661, 1e-12, 'without tax');
    close(C.extraNeeded(S, PI, 1), 3305, 1e-9, 'extra lei next year');
  });
});
