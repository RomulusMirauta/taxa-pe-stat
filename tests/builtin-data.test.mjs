// The built-in data (src/js/builtin-data.js): the values the page starts with, and those set by hand each month.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { DATA } from '../src/js/builtin-data.js';
import { Calc } from '../src/js/calc.js';

const month = /^\d{4}-(0[1-9]|1[0-2])$/;

describe('the hand-set values', () => {
  test('each one has the month it is from, so the page can flag it when it gets old', () => {
    assert.ok(typeof DATA.forecast.value === 'number');
    assert.match(DATA.forecast.target, month);
    assert.match(DATA.forecast.report, month);
    for (const [k, v] of Object.entries(DATA.savings)) {
      assert.ok(typeof v.rate === 'number', k);
      assert.match(v.asOf, month, k);
    }
  });
  test('their labels come from DATA: no month, year or tax rate written in the other modules', () => {
    const months = /\b(ianuarie|februarie|martie|aprilie|mai|iunie|iulie|august|septembrie|octombrie|noiembrie|decembrie|ian|feb|mar|apr|iun|iul|aug|sept|oct|nov|dec)\.?\s+(19|20)\d\d\b/i;
    const dir = new URL('../src/js/', import.meta.url);
    for (const f of readdirSync(dir).filter((f) => f.endsWith('.js') && f !== 'builtin-data.js')) {
      const code = readFileSync(new URL(f, dir), 'utf8');
      assert.doesNotMatch(code, months, f);
      assert.doesNotMatch(code, /Impozitul de \d/, f);
    }
  });
});

test('the built-in rates and inflation pass the page\'s own validation, as if they came from data/rates.json', () => {
  const checked = Calc.normalizeRates({ fx: DATA.fx, inflation: DATA.inflation });
  assert.deepEqual(checked.fx, DATA.fx);
  assert.deepEqual(checked.inflation, DATA.inflation);
});
