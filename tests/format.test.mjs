// Tests for the page's formatting (src/js/format.js): numbers, signs, dates and day counts, the Romanian way.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { esc, fmt, RATE4, short, pct, lei, sign2, tone, signed, compact, fmtDate, fmtMonth, daysWord, duration, groupInput, capInput, minPlusNote, splitSign, sumLei, sumMissing, todayISO } from '../src/js/format.js';

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
  cases(tone, [[[-1], 'loss'], [[1], 'gain'], [[0.004], ''], [[0.00004, 4], ''], [[-0.00006, 4], 'loss'], [[0.00006, 4], 'gain']]);
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

describe('a sum as it is typed: the thousands dots come by themselves (F-93)', () => {
  const g = (text, caret = text.length, pasted) => groupInput(text, caret, pasted);
  for (const [args, value, caret] of [
    [['50000'], '50.000', 6], [['5000'], '5.000', 5], [['500'], '500', 3], [['1234567,891'], '1.234.567,891', 13],
    [['50.0000'], '500.000', 7], [['5.0000'], '50.000', 6], [['5000,'], '5.000,', 6], [[''], '', 0],
    [['50000', 2], '50.000', 2], [['500000', 3], '500.000', 3], [['50.00', 3], '5.000', 3],
    [['abc'], 'abc', 3], [['50.000,5,1'], '50.000,5,1', 10], [['-50000'], '-50000', 6],
    // F-100: zeros in front, spaces, a sum pasted with a decimal point.
    [['05000'], '5.000', 5], [['0050000'], '50.000', 6], [['00'], '0', 1], [['0,5'], '0,5', 3], [['50 000'], '50.000', 6],
    [['1234.56', 7, true], '1.234,56', 8], [['1234.56', 7], '123.456', 7], [['50.000', 6, true], '50.000', 6], [['abc def', 3], 'abc def', 3],
  ]) test(`groupInput(${args.map((a) => JSON.stringify(a)).join(', ')}) → ${value}, caret ${caret}`, () => assert.deepEqual(g(...args), { value, caret }));
});

describe('inflation above 100% becomes 100% as it is typed (F-96)', () => {
  cases(capInput, [[['999', 100], '100'], [['100,5', 100], '100'], [['100', 100], '100'], [['6,5', 100], '6,5'], [['-50', 100], '-50'], [['abc', 100], 'abc'], [['', 100], '']]);
});

test('splitSign: the counter sets the sign apart from the number', () => {
  assert.deepEqual(splitSign('−0,0008 lei'), ['−', '0,0008 lei']);
  assert.deepEqual(splitSign('+2,00 €'), ['+', '2,00 €']);
  assert.deepEqual(splitSign('0,0000 lei'), ['', '0,0000 lei']);
});

describe('the counter\'s stopwatch (F-91)', () => {
  cases(duration, [[[0], '0 s'], [[13.9], '13 s'], [[60], '1 min 0 s'], [[133], '2 min 13 s'], [[3725], '1 h 2 min 5 s'], [[3600], '1 h 0 min 0 s'], [[-3], '0 s']]);
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

describe('the sum as the user wrote it (F-101)', () => {
  cases(sumLei, [[[50000], '50.000 lei'], [[0.5], '0,50 lei'], [[1234.56], '1.234,56 lei'], [[1], '1 leu'], [[2], '2 lei'], [[0], '0 lei']]);
});

describe('the counter without a sum: an empty field, or a wrong one (F-102)', () => {
  cases(sumMissing, [[[''], 'Completează suma.'], [['  '], 'Completează suma.'], [['abc'], 'Corectează suma: nu e un număr valid.'], [['-5'], 'Corectează suma: nu e un număr valid.']]);
});

describe('why „Minimul pentru plus” is missing (F-102)', () => {
  test('a small sum, or large fees: more than 100% interest would be needed', () => {
    assert.equal(minPlusNote(100, 0, 1500), '„Minimul pentru plus” lipsește: pentru 100 lei, contorul ar ajunge pe plus în 3 secunde doar cu o dobândă de peste 100%.');
    assert.match(minPlusNote(1000, 2000, 300), /pentru 1\.000 lei și 2\.000 lei comisioane pe an,/);
  });
  test('with 0 lei nothing can be gained', () => assert.equal(minPlusNote(0, 0, NaN), 'Cu 0 lei, contorul rămâne pe zero, oricare ar fi dobânda.'));
  test('nothing when the button is there, or the sum is wrong', () => {
    assert.equal(minPlusNote(50000, 0, 7.86), '');
    assert.equal(minPlusNote(NaN, 0, NaN), '');
  });
});
