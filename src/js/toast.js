/* Short messages at the bottom of the page, for fields typed outside what the page is made for (F-97, F-98, F-99). */
import { Calc } from './calc.js';
import { $ } from './dom.js';

export const TOASTS = {
  huge: 'Wow! Ai atât de mulți bani, încât strici interfața aplicației! 😂',
  sumNegative: 'Suma nu poate fi negativă: scrie câți lei ai, de ex. 50.000.',
  sumText: 'Suma trebuie să fie un număr, de ex. 50.000. Literele și simbolurile nu sunt bani. 🙂',
  sumBad: 'Suma nu e un număr valid. Scrie-o așa: 50.000 sau 1.234,56.',
  inflText: 'Inflația trebuie să fie un număr, de ex. 6,5. Literele și simbolurile nu merg aici.',
  inflBad: 'Inflația trebuie să fie un număr între −50% și 100%, de ex. 6,5.',
  inflNegative: 'Inflație negativă înseamnă deflație: prețurile scad. E rar, dar calculul merge. 📉',
  infl100: 'Inflația de 100% este imposibilă, dar poate fi interesantă pentru calcule și teste. 🧪',
  tax100: 'Impozit de 100%: statul ia toată dobânda. Sperăm să nu ajungem acolo. 😅'
};

/* The other number fields: what they are called, an example, and the range the form accepts (form.js). */
var FIELDS = {
  rate: { text: 'Dobânda', ex: '5,51', neg: 'Dobânda nu poate fi negativă.', range: 'Dobânda trebuie să fie între 0% și 100%, de ex. 5,51.' },
  tax: { text: 'Impozitul', ex: '10', neg: 'Impozitul nu poate fi negativ.', range: 'Impozitul trebuie să fie între 0% și 100%, de ex. 10.' },
  fees: { text: 'Comisioanele', ex: '120', neg: 'Comisioanele nu pot fi negative: scrie cât plătești pe an, sau 0.', range: 'Comisioanele trebuie să fie un număr, de ex. 120 sau 0.', money: true },
  eur0: { text: 'Cursul EUR', ex: '5,0867', neg: 'Cursul EUR nu poate fi negativ.', range: 'Cursul EUR trebuie să fie un număr între 0 și 1.000, de ex. 5,0867.' },
  eur1: { text: 'Cursul EUR', ex: '5,0867', neg: 'Cursul EUR nu poate fi negativ.', range: 'Cursul EUR trebuie să fie un număr între 0 și 1.000, de ex. 5,0867.' },
  usd0: { text: 'Cursul USD', ex: '4,3711', neg: 'Cursul USD nu poate fi negativ.', range: 'Cursul USD trebuie să fie un număr între 0 și 1.000, de ex. 4,3711.' },
  usd1: { text: 'Cursul USD', ex: '4,3711', neg: 'Cursul USD nu poate fi negativ.', range: 'Cursul USD trebuie să fie un număr între 0 și 1.000, de ex. 4,3711.' }
};
var RANGE = { rate: [0, 100], tax: [0, 100], fees: [0, Infinity], eur0: [0, 1000], eur1: [0, 1000], usd0: [0, 1000], usd1: [0, 1000] };

/* Characters that never belong in a number: letters, symbols. Told at once, even while typing. */
var NOT_A_NUMBER = /[^0-9.,\s%+\-−]/;
var NEGATIVE = /^\s*[-−]/;

/* The message for a field's text, or '' for none. A sum is too large past 30 digits before the comma
   (999.999.999.999.999.999.999.999.999.999 is still fine). What may still become a number ("-" on the way
   to "-5", "6,") is told only once it is typed (`done`: the field was left, or Enter). */
export function toastFor(id, text, done) {
  text = String(text);
  if (!text.trim()) return '';
  var v = Calc.parseNum(text, { money: id === 'sum' || !!(FIELDS[id] && FIELDS[id].money) });
  if (id === 'sum') {
    if (NOT_A_NUMBER.test(text)) return TOASTS.sumText;
    if (v < 0 || NEGATIVE.test(text) && !(v === 0)) return TOASTS.sumNegative;
    var digits = text.split(',')[0].replace(/[^0-9]/g, '').replace(/^0+/, '');
    if (digits.length > 30) return TOASTS.huge;
    return done && !isFinite(v) ? TOASTS.sumBad : '';
  }
  if (id === 'infl') {
    if (NOT_A_NUMBER.test(text)) return TOASTS.inflText;
    if (v === 100) return TOASTS.infl100;
    if (v >= -50 && v < 0) return TOASTS.inflNegative;
    return done && !(v >= -50 && v <= 100) ? TOASTS.inflBad : '';
  }
  var f = FIELDS[id];
  if (!f) return '';
  if (NOT_A_NUMBER.test(text)) return f.text + ' trebuie să fie un număr, de ex. ' + f.ex + '. Literele și simbolurile nu merg aici.';
  if (v < 0 || NEGATIVE.test(text) && !(v === 0)) return f.neg;
  if (id === 'tax' && v === 100) return TOASTS.tax100;
  var r = RANGE[id], ok = /^(eur|usd)/.test(id) ? v > r[0] && v < r[1] : v >= r[0] && v <= r[1];
  return done && !ok ? f.range : '';
}

/* Shows a message for 5 seconds; the same message is not shown again while its field still asks for it. */
var shown = {}, timer = 0;
export function toast(id, msg) {
  if (!msg) { shown[id] = ''; return; }
  if (shown[id] === msg) return;
  shown[id] = msg;
  $('toastText').textContent = msg;
  $('toast').hidden = false;
  clearTimeout(timer);
  timer = setTimeout(closeToast, 5000);
}
/* The × on the toast, or the 5 seconds: the message goes away. */
export function closeToast() { clearTimeout(timer); $('toast').hidden = true; }
