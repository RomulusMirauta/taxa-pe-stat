// Tests for the page's formatting (src/js/format.js): numbers, signs, dates and day counts, the Romanian way.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { esc, fmt, RATE4, short, pct, lei, sign2, tone, signed, compact, fmtDate, fmtMonth, daysWord, todayISO } from '../src/js/format.js';

const cases = (fn, list) => {
  for (const [args, expected] of list) test(`${fn.name}(${args.map((a) => JSON.stringify(a)).join(', ')}) → ${expected}`, () => assert.equal(fn(...args), expected));
};

describe('numbers: Romanian separators, the true minus sign, no sign on zero (F-08)', () => {
  cases(fmt, [
    [[1234.5], '1.234,50'], [[-3.5], '−3,50'], [[0.005], '0,01'], [[1234.5, 0], '1.235'],
    [[-0.001], '0,00'], [[-0.004], '0,00'], [[-0.4, 0], '0'],
  ]);
  cases(short, [[[50000], '50.000'], [[6.5], '6,5'], [[1234.567], '1.234,57'], [[-0.001], '0']]);
  cases(pct, [[[0.0661], '6,61%'], [[NaN], '—'], [[Infinity], '—']]);
  cases(lei, [[[50000], '50.000 lei'], [[1234.6], '1.235 lei']]);
  test('RATE4: up to 4 decimals, as BNR publishes the rates', () => {
    assert.equal(RATE4.format(5.3495), '5,3495');
    assert.equal(RATE4.format(4.38), '4,38');
    assert.equal(RATE4.format(5.34951), '5,3495');
  });
});

describe('signs and colours: what rounds to zero has neither', () => {
  cases(signed, [
    [[-1.234, 'lei'], '−1,23 lei'], [[2, '$', 4], '+2,0000 $'],
    [[0.004, '€'], '0,00 €'], [[-0.004, '€'], '0,00 €'], [[-0.00004, 'lei', 4], '0,0000 lei'],
  ]);
  cases(sign2, [[[0.004], 0], [[0.005], 1], [[-0.006], -1]]);
  cases(tone, [[[-1], 'loss'], [[1], 'gain'], [[0.004], '']]);
});

describe('the chart axis: compact numbers', () => {
  cases(compact, [
    [[0], '0'], [[999], '999'], [[1000], '1 mie'], [[1500], '1,5 mii'], [[60000], '60 mii'], [[-2000], '−2 mii'], [[2500000], '2,5 mil.'],
  ]);
});

describe('dates and months', () => {
  cases(fmtDate, [[['2026-10-30'], '30 oct. 2026'], [['2026-02-30'], '—'], [[''], '—']]);
  cases(fmtMonth, [[['2026-09'], 'septembrie 2026'], [['2027-12', true], 'dec. 2027'], [['2026-13'], '2026-13']]);
  test('todayISO: the local date of the given moment, not the UTC one', () => {
    assert.equal(todayISO(new Date(2026, 0, 5, 23, 59)), '2026-01-05');
    assert.equal(todayISO(new Date(2026, 11, 31, 0, 0)), '2026-12-31');
  });
});

describe('day counts: „de” from 20 on, except 101–119 and the like', () => {
  cases(daysWord, [
    [[0], '0 zile'], [[1], '1 zi'], [[7], '7 zile'], [[19], '19 zile'], [[20], '20 de zile'],
    [[101], '101 zile'], [[119], '119 zile'], [[120], '120 de zile'], [[365], '365 de zile'],
  ]);
});

test('esc: what reaches innerHTML cannot open a tag or an attribute', () => {
  assert.equal(esc('<img src=x onerror="a()">&'), '&lt;img src=x onerror=&quot;a()&quot;&gt;&amp;');
  assert.equal(esc(5.3), '5.3');
});
