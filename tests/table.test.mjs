// The tables' decisions (src/js/table.js, fxView): what already happened against EUR and USD, and the note under it (F-84).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { fxView } from '../src/js/table.js';
import { Calc as C } from '../src/js/calc.js';
import { signed } from '../src/js/format.js';

const S = 50000;
const series = [['2025-10-30', 5.0856, 4.38], ['2026-09-30', 5.27, 4.55], ['2026-10-23', 5.33, 4.75], ['2026-10-29', 5.34, 4.78], ['2026-10-30', 5.3426, 4.7698]];
const D = { fx: { series }, inflation: { month: '2026-09', euroArea: 3.8, euroAreaMonth: '2026-09' } };
const TODAY = '2026-10-31';
const trend = (c0, c1, days) => { const t = C.fxTrend(c0, c1, days); return { c0, c1, lost: t.lost, annual: t.annual }; };
/** The state readState() would give for the default form: 50,000 lei, no interest, a year of rates up to 30 Oct 2026. */
const state = (over = {}) => ({
  p: { S, pi: 0.065, rate: 0, tax: 0.1, fees: 0, net: true }, okFx: true, S, rate: 0, tax: 10, fees: 0,
  d1: '2026-10-30', days: 365, fxDay: ['2025-10-30', '2026-10-30'], fxMissing: [], now: { eur: 5.3426, usd: 4.7698 },
  fx: { eur: trend(5.0856, 5.3426, 365), usd: trend(4.38, 4.7698, 365) },
  ...over,
});
const year = (s, k, unit) => signed(-C.fxLoss(s.p, s.fx[k].annual, s.fx[k].c1, 365), unit);

describe('the rows: realised, from the history', () => {
  test('EUR and USD, each period from fxRealized with the rate of d1', () => {
    const s = state(), v = fxView(s, D, TODAY);
    assert.deepEqual(v.rows.map((r) => [r.label, r.unit, r.sub]), [['EUR', '€', 'până pe 30 oct. 2026'], ['USD', '$', 'până pe 30 oct. 2026']]);
    assert.deepEqual(v.rows[0].values, C.fxRealized(s.p, series, '2026-10-30', 5.3426, 1, TODAY));
    assert.deepEqual(v.rows[1].values, C.fxRealized(s.p, series, '2026-10-30', 4.7698, 2, TODAY));
    assert.ok(v.rows.every((r) => r.values.every(Number.isFinite)));
  });
  test('without the daily history: „—” everywhere and the reason, never a projection instead', () => {
    const v = fxView(state(), { ...D, fx: {} }, TODAY);
    assert.ok(v.rows.every((r) => r.values.every(Number.isNaN)));
    assert.deepEqual(v.rows.map((r) => r.sub), ['lipsește istoricul zilnic al cursului', 'lipsește istoricul zilnic al cursului']);
  });
  test('without the BNR rate of d1: „—” and which day is missing', () => {
    const v = fxView(state({ fxDay: ['2025-10-30', 'missing'] }), D, TODAY);
    assert.ok(v.rows.every((r) => r.values.every(Number.isNaN)));
    assert.equal(v.rows[0].sub, 'lipsește cursul BNR din 30 oct. 2026');
  });
  test('a rate the user typed: computed, and said so', () => {
    const v = fxView(state({ fxDay: ['2025-10-30', 'user'], now: { eur: 5.40, usd: 4.7698 } }), D, TODAY);
    assert.equal(v.rows[0].sub, 'până pe 30 oct. 2026, cu cursul introdus de tine');
    assert.deepEqual(v.rows[0].values, C.fxRealized(state().p, series, '2026-10-30', 5.40, 1, TODAY));
  });
  test('an invalid rate of now, or a missing d1: „—” and what to fill in', () => {
    for (const s of [state({ now: { eur: NaN, usd: 4.7698 } }), state({ d1: null, fxDay: ['2025-10-30', null] })]) {
      const v = fxView(s, D, TODAY);
      assert.ok(v.rows[0].values.every(Number.isNaN));
      assert.equal(v.rows[0].sub, 'completează data curentă și cursul');
    }
  });
  test('an invalid sum or interest: „—”, with the dates still shown', () => {
    const v = fxView(state({ okFx: false }), D, TODAY);
    assert.ok(v.rows.every((r) => r.values.every(Number.isNaN)));
    assert.equal(v.rows[0].sub, 'până pe 30 oct. 2026');
  });
});

describe('the note: what the rows mean, and the only projection, over a year', () => {
  test('a year of rates: the pace of the last year, for a year, in each currency', () => {
    const s = state(), { note } = fxView(s, D, TODAY);
    assert.match(note, /^Ce s-a întâmplat deja: .* Nu e o prognoză/);
    assert.ok(note.includes(`Dacă ritmul din ultimul an continuă: ${year(s, 'eur', '€')} pe an față de euro și ${year(s, 'usd', '$')} pe an față de dolar.`), note);
    // Every amount in the note is a year's: nothing under a year is projected.
    const amounts = [...note.matchAll(/[−+][\d.]+,\d\d [€$]( pe an)?/g)];
    assert.equal(amounts.length, 2);
    assert.ok(amounts.every((m) => m[1]), note);
  });
  test('another interval: named, with its length', () => {
    const s = state({ days: 30, fx: { eur: trend(5.27, 5.3426, 30), usd: trend(4.55, 4.7698, 30) } });
    assert.match(fxView(s, D, TODAY).note, /Dacă ritmul din intervalul ales \(30 de zile\) continuă: /);
  });
  test('a pace that cannot be extrapolated, or no interval: no projection', () => {
    const odd = { c0: 7.3495, c1: 5.3426, lost: 0, annual: NaN };
    let note = fxView(state({ days: 1, fx: { eur: odd, usd: odd } }), D, TODAY).note;
    assert.doesNotMatch(note, /Dacă ritmul/);
    assert.match(note, /Din intervalul ales, ritmul anual nu se poate extrapola\./);
    note = fxView(state({ fx: { eur: null, usd: null } }), D, TODAY).note;
    assert.doesNotMatch(note, /Dacă ritmul|nu se poate extrapola/);
  });
  test('with interest or fees, it says which money of then is meant; without, it does not', () => {
    const p = { S, pi: 0.065, rate: 0.055, tax: 0.1, fees: 0, net: true };
    assert.match(fxView(state({ p }), D, TODAY).note, /suma de atunci e cea care a ajuns la 50\.000 lei azi\./);
    assert.doesNotMatch(fxView(state(), D, TODAY).note, /suma de atunci/);
  });
  test('the euro area\'s inflation, when the data has it', () => {
    assert.match(fxView(state(), D, TODAY).note, /în zona euro a fost 3,8% în septembrie 2026\.$/);
    assert.doesNotMatch(fxView(state(), { ...D, inflation: { month: '2026-09' } }, TODAY).note, /zona euro/);
  });
});
