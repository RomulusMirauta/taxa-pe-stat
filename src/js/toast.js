/* Short messages at the bottom of the page, for fields typed outside what the page is made for (F-97). */
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
  infl100: 'Inflația de 100% este imposibilă, dar poate fi interesantă pentru calcule și teste. 🧪'
};

/* Characters that never belong in a number: letters, symbols. Told at once, even while typing. */
var NOT_A_NUMBER = /[^0-9.,\s%+\-−]/;

/* The message for a field's text, or '' for none. A sum is too large past 30 digits before the comma
   (999.999.999.999.999.999.999.999.999.999 is still fine). What may still become a number ("-" on the way
   to "-5", "6,") is told only once it is typed (`done`: the field was left, or Enter). */
export function toastFor(id, text, done) {
  text = String(text);
  if (!text.trim() || (id !== 'sum' && id !== 'infl')) return '';
  var v = Calc.parseNum(text, { money: id === 'sum' });
  if (id === 'sum') {
    if (NOT_A_NUMBER.test(text)) return TOASTS.sumText;
    if (v < 0 || /^\s*[-−]/.test(text) && !(v === 0)) return TOASTS.sumNegative;
    var digits = text.split(',')[0].replace(/[^0-9]/g, '').replace(/^0+/, '');
    if (digits.length > 30) return TOASTS.huge;
    return done && !isFinite(v) ? TOASTS.sumBad : '';
  }
  if (NOT_A_NUMBER.test(text)) return TOASTS.inflText;
  if (v === 100) return TOASTS.infl100;
  if (v >= -50 && v < 0) return TOASTS.inflNegative;
  return done && !(v >= -50 && v <= 100) ? TOASTS.inflBad : '';
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
