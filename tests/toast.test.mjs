// Tests for the toasts' messages (src/js/toast.js): which text asks for which message (F-97).
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

test('inflation of 100%: impossible, but allowed for tests', () => {
  assert.equal(toastFor('infl', '100'), TOASTS.infl100);
  assert.equal(toastFor('infl', '100,0'), TOASTS.infl100);
  assert.equal(toastFor('infl', '99,9'), '');
});

test('a wrong inflation is told only once it is typed', () => {
  for (const text of ['abc', '-51', '-', '6,5,1']) {
    assert.equal(toastFor('infl', text, true), TOASTS.inflBad, text);
    assert.equal(toastFor('infl', text, false), '', `${text}, while typing`);
  }
  for (const text of ['', '6,5', '-50', '0']) assert.equal(toastFor('infl', text, true), '', JSON.stringify(text));
});

test('other fields have no toast', () => assert.equal(toastFor('rate', '999', true), ''));
