// Tests for the toasts' messages (src/js/toast.js): which text asks for which message (F-97, F-98).
import { test } from 'node:test';
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

test('other fields have no toast', () => assert.equal(toastFor('rate', 'abc', true), ''));
