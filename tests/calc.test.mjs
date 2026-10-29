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
  for (const bad of ['', '   ', 'abc', '.', ',', '1e3', '12.34.56', '1,5,6', '1.000,000.5', '5%5', '--3', null, undefined]) {
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
  test('periods: day, week, month, year', () => {
    assert.deepEqual(Array.from(C.PERIODS, (p) => p.days), [1, 7, 365 / 12, 365]);
  });
});
