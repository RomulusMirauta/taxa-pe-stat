// Tests for the toasts' messages (src/js/toast.js): which text asks for which message (F-97, F-98).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { TOASTS, toastFor } from '../src/js/toast.js';

test('a sum past 30 digits before the comma: the interface cannot show it', () => {
  assert.equal(toastFor('sum', '999.999.999.999.999.999.999.999.999.999'), '', '30 digits are still fine');
  assert.equal(toastFor('sum', '999.999.999.999.999.999.999.999.999.999,99'), '', 'the decimals do not count');
  assert.equal(toastFor('sum', '9.999.999.999.999.999.999.999.999.999.999'), TOASTS.huge);
  assert.equal(toastFor('sum', '50.000'), '');
  assert.equal(toastFor('sum', '0000000000000000000000000000000050'), '', 'leading zeros do not count');
});

test('a negative sum, at once', () => {
  for (const text of ['-50000', '−50.000', '-', ' -5']) assert.equal(toastFor('sum', text, false), TOASTS.sumNegative, text);
  assert.equal(toastFor('sum', '-0', true), '', '„-0” is 0');
});

test('letters or symbols in the sum, at once; a broken number, once it is typed', () => {
  for (const text of ['abc', '50k', '$50', '50.000 lei', '#!']) assert.equal(toastFor('sum', text, false), TOASTS.sumText, text);
  assert.equal(toastFor('sum', '50.000,5,1', false), '', 'while typing');
  assert.equal(toastFor('sum', '50.000,5,1', true), TOASTS.sumBad);
  assert.equal(toastFor('sum', '', true), '', 'an empty field says nothing: „Completează suma” is on the counter');
});

test('inflation of 100%: impossible, but allowed for tests', () => {
  assert.equal(toastFor('infl', '100'), TOASTS.infl100);
  assert.equal(toastFor('infl', '100,0'), TOASTS.infl100);
  assert.equal(toastFor('infl', '99,9'), '');
});

test('negative inflation is deflation: allowed down to −50%, with a word on what it means', () => {
  for (const text of ['-1', '−0,5', '-50']) assert.equal(toastFor('infl', text, true), TOASTS.inflNegative, text);
  assert.equal(toastFor('infl', '-51', true), TOASTS.inflBad, 'below −50%');
  assert.equal(toastFor('infl', '0', true), '');
});

test('letters or symbols in the inflation, at once; the rest once it is typed', () => {
  for (const text of ['abc', '6,5a', '@', 'șase']) assert.equal(toastFor('infl', text, false), TOASTS.inflText, text);
  for (const text of ['-', '6,5,1']) {
    assert.equal(toastFor('infl', text, false), '', `${text}, while typing`);
    assert.equal(toastFor('infl', text, true), TOASTS.inflBad, text);
  }
  for (const text of ['', '6,5', '6,5%']) assert.equal(toastFor('infl', text, true), '', JSON.stringify(text));
});

test('dates and other fields have no message of their own', () => assert.equal(toastFor('d1', '2030-01-01', true), ''));

describe('interest, tax, fees and exchange rates (F-99)', () => {
  test('letters or symbols, at once, with the field\'s name', () => {
    assert.equal(toastFor('tax', 'abc', false), 'Impozitul trebuie să fie un număr, de ex. 10. Literele și simbolurile nu merg aici.');
    assert.match(toastFor('rate', '5%%a', false), /^Dobânda trebuie să fie un număr/);
    assert.match(toastFor('fees', '$', false), /^Comisioanele trebuie să fie un număr/);
    assert.match(toastFor('eur1', 'x', false), /^Cursul EUR trebuie să fie un număr/);
  });
  test('negative, at once', () => {
    assert.equal(toastFor('tax', '-5', false), 'Impozitul nu poate fi negativ.');
    assert.equal(toastFor('rate', '−1', false), 'Dobânda nu poate fi negativă.');
    assert.match(toastFor('fees', '-120', false), /^Comisioanele nu pot fi negative/);
    assert.equal(toastFor('usd0', '-4', false), 'Cursul USD nu poate fi negativ.');
    assert.equal(toastFor('tax', '-0', false), '', '„-0” is 0');
  });
  test('out of range or broken, once it is typed', () => {
    assert.equal(toastFor('eur1', '0', false), '');
    assert.match(toastFor('eur1', '0', true), /^Cursul EUR trebuie să fie un număr între 0 și 1\.000/);
    assert.match(toastFor('usd1', '1000', true), /^Cursul USD trebuie să fie un număr între 0 și 1\.000/);
    assert.match(toastFor('rate', '5,5,5', true), /^Dobânda trebuie să fie între 0% și 100%/);
    assert.equal(toastFor('eur1', '5,0867', true), '');
    assert.equal(toastFor('fees', '1.200', true), '');
  });
  test('a tax of 100%: the state takes all the interest', () => assert.equal(toastFor('tax', '100', false), TOASTS.tax100));
});
