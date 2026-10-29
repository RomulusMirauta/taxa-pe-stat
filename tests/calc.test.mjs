// Teste pentru calculele din app.html (blocul <script id="calc">).
// Rulare: npm test  (sau: node --test)
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync(new URL('../app.html', import.meta.url), 'utf8');
const src = html.match(/<script id="calc">([\s\S]*?)<\/script>/)?.[1];
assert.ok(src, 'blocul <script id="calc"> lipsește din app.html');
const ctx = vm.createContext({});
vm.runInContext(src, ctx);
const C = ctx.Calc;

const close = (actual, expected, eps, what = '') =>
  assert.ok(Math.abs(actual - expected) <= eps, `${what} ${actual} ≠ ${expected} (±${eps})`);

const S = 50000;
const PI = 0.0661;
const raw = { S, pi: PI, rate: 0, tax: 0.1, fees: 0, net: false };
const dep = { S, pi: PI, rate: 0.055, tax: 0.1, fees: 0, net: true };

describe('parseNum: numere scrise ca în română sau engleză', () => {
  const cases = [
    ['6,61', 6.61], ['6.61', 6.61], ['6,61%', 6.61], [' 10 ', 10], ['0', 0], ['-3,5', -3.5], ['−2', -2], ['+5', 5],
    ['5,3495', 5.3495], ['5.3495', 5.3495], ['1.234,56', 1234.56], ['1,234.56', 1234.56], ['1.234.567', 1234567],
    ['50.', 50], [',5', 0.5],
  ];
  for (const [input, expected] of cases) {
    test(`"${input}" → ${expected}`, () => assert.equal(C.parseNum(input), expected));
  }
  test('la sume, punctul sau virgula urmate de 3 cifre separă miile', () => {
    assert.equal(C.parseNum('50.000', { money: true }), 50000);
    assert.equal(C.parseNum('50,000', { money: true }), 50000);
    assert.equal(C.parseNum('50 000', { money: true }), 50000);
    assert.equal(C.parseNum('50.000,50', { money: true }), 50000.5);
    assert.equal(C.parseNum('50,5', { money: true }), 50.5);
  });
  test('la rate, "50.000" rămâne 50 (punct zecimal)', () => assert.equal(C.parseNum('50.000'), 50));
  for (const bad of ['', '   ', 'abc', '.', ',', '1e3', '12.34.56', '1,5,6', '1.000,000.5', '5%5', '--3', null, undefined]) {
    test(`invalid: ${JSON.stringify(bad) ?? 'undefined'} → NaN, nu 0`, () => assert.ok(Number.isNaN(C.parseNum(bad))));
  }
});

describe('date', () => {
  test('12 luni = 365 de zile', () => assert.equal(C.daysBetween('2025-10-28', '2026-10-28'), 365));
  test('ordinea inversă dă un număr negativ', () => assert.equal(C.daysBetween('2026-10-28', '2025-10-28'), -365));
  test('date lipsă sau inexistente → NaN', () => {
    for (const d of ['', '2026-02-30', '28.10.2026', '2026-13-01']) assert.ok(Number.isNaN(C.daysBetween(d, '2026-10-28')), d);
  });
});

describe('cursul: deprecierea leului', () => {
  test('EUR, 28 oct. 2025 → 28 oct. 2026: leul a pierdut 4,96%', () => {
    const t = C.fxTrend(5.0844, 5.3495, 365);
    close(t.lost, 0.04956, 0.00001);
    close(t.annual, t.lost, 1e-12, 'la 365 de zile, ritmul anual e chiar pierderea:');
  });
  test('un interval scurt e extrapolat exagerat (de aceea aplicația avertizează)', () => {
    assert.ok(C.fxTrend(5.30, 5.32, 1).annual > 0.7);
  });
  test('fără interval valid sau fără cursuri nu există ritm', () => {
    assert.equal(C.fxTrend(5.08, 5.35, 0), null);
    assert.equal(C.fxTrend(5.08, 5.35, -10), null);
    assert.equal(C.fxTrend(5.08, 5.35, NaN), null);
    assert.equal(C.fxTrend(0, 5.35, 365), null);
    assert.equal(C.fxTrend(NaN, 5.35, 365), null);
  });
});

describe('inflația: pierderea reală', () => {
  test('50.000 lei la 6,61%, fără dobândă', () => {
    close(C.realLoss(raw, 1), 8.77, 0.005, 'zi');
    close(C.realLoss(raw, 7), 61.34, 0.005, 'săptămână');
    close(C.realLoss(raw, 365 / 12), 265.99, 0.005, 'lună');
    close(C.realLoss(raw, 365), 3100.08, 0.005, 'an');
  });
  test('depozit 5,5% brut, impozit 10% → 4,95% net', () => {
    close(C.netRate(dep), 0.0495, 1e-12);
    close(C.realLoss(dep, 365), 778.54, 0.005);
  });
  test('o dobândă netă peste inflație dă câștig (valoare negativă)', () => {
    assert.ok(C.realLoss({ ...dep, rate: 0.0715, tax: 0 }, 365) < 0);
  });
  test('fără inflație și fără dobândă nu pierzi nimic', () => assert.equal(C.realLoss({ ...raw, pi: 0 }, 365), 0));
  test('deflația dă câștig', () => assert.ok(C.realLoss({ ...raw, pi: -0.02 }, 365) < 0));
  test('comisioanele contează doar în modul cu dobândă', () => {
    close(C.realLoss({ S: 0, pi: 0, rate: 0, tax: 0, fees: 100, net: true }, 365), 100, 1e-9);
    assert.equal(C.realLoss({ S: 0, pi: 0, rate: 0, tax: 0, fees: 100, net: false }, 365), 0);
  });
  test('comisioanele sunt deflatate ca restul banilor', () => {
    close(C.realLoss({ S: 0, pi: 0.1, rate: 0, tax: 0, fees: 110, net: true }, 365), 100, 1e-9);
  });
  test('fără comisioane, formula e cea din DESIGN.md: S·(1 − (g/(1+π))^y)', () => {
    close(C.realLoss(dep, 182.5), S * (1 - Math.pow(1.0495 / (1 + PI), 0.5)), 1e-9);
  });
});

describe('pierderea față de valută', () => {
  const eur = C.fxTrend(5.0844, 5.3495, 365);
  test('fără dobândă, pe un an: S × ritmul / cursul de acum', () => {
    close(C.fxLoss(raw, eur.annual, 5.3495, 365), (S * eur.annual) / 5.3495, 1e-9);
  });
  test('valori de referință pentru 50.000 lei', () => {
    close(C.fxLoss(raw, eur.annual, 5.3495, 1), 1.30, 0.005, 'zi, fără dobândă');
    close(C.fxLoss(raw, eur.annual, 5.3495, 365), 463.18, 0.005, 'an, fără dobândă');
    close(C.fxLoss(dep, eur.annual, 5.3495, 365), 23.45, 0.005, 'an, cu depozit');
  });
  test('fără depreciere și fără dobândă nu pierzi nimic în valută', () => {
    assert.equal(C.fxLoss(raw, 0, 5.3495, 365), 0);
  });
});

describe('alte rezultate', () => {
  test('dobânda brută minimă e exactă: 6,61% / (1 − 10%) = 7,344%', () => {
    close(C.breakEvenRate(PI, 0.1, 0, S), 0.073444, 0.000001);
  });
  test('la dobânda minimă, valoarea reală nu se schimbă într-un an (și cu comisioane)', () => {
    const r = C.breakEvenRate(PI, 0.1, 120, S);
    close(C.realLoss({ S, pi: PI, rate: r, tax: 0.1, fees: 120, net: true }, 365), 0, 1e-6);
  });
  test('impozit de 100% sau lipsă → fără răspuns', () => {
    assert.ok(Number.isNaN(C.breakEvenRate(PI, 1, 0, S)));
    assert.ok(Number.isNaN(C.breakEvenRate(PI, NaN, 0, S)));
  });
  test('la anul îți trebuie cu 6,61% mai mult: 3.305 lei', () => close(C.extraNeeded(S, PI, 1), 3305, 1e-9));
  test('valoarea reală peste 10 ani', () => {
    close(C.realValue(raw, 10), 26363, 0.5, 'fără dobândă');
    close(C.realValue(dep, 10), 42738, 0.5, 'cu depozit');
  });
  test('valoarea reală nu coboară sub zero când comisioanele mănâncă tot', () => {
    assert.equal(C.realValue({ S: 100, pi: 0.05, rate: 0, tax: 0, fees: 1000, net: true }, 1), 0);
  });
  test('contorul: ritmul pe o zi ≈ pierderea pe o zi', () => close(C.lossRatePerYear(raw) / 365, C.realLoss(raw, 1), 0.001));
  test('contorul ține cont de dobândă', () => assert.ok(C.lossRatePerYear(dep) < C.lossRatePerYear(raw)));
  test('pas rotund pentru axa graficului', () => {
    assert.equal(C.niceStep(50000, 4), 20000);
    assert.equal(C.niceStep(100, 4), 25);
    assert.equal(C.niceStep(0, 4), 1);
  });
  test('perioadele: zi, săptămână, lună, an', () => {
    assert.deepEqual(Array.from(C.PERIODS, (p) => p.days), [1, 7, 365 / 12, 365]);
  });
});
