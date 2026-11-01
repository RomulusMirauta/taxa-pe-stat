/* Short messages at the bottom of the page, for fields typed outside what the page is made for (F-97). */
import { Calc } from './calc.js';
import { $ } from './dom.js';

export const TOASTS = {
  huge: 'Wow! Ai atât de mulți bani, încât strici interfața aplicației! 😂',
  inflBad: 'Inflația trebuie să fie un număr între −50% și 100%, de ex. 6,5.',
  infl100: 'Inflația de 100% este imposibilă, dar poate fi interesantă pentru calcule și teste. 🧪'
};

/* The message for a field's text, or '' for none. A sum is too large past 30 digits before the comma
   (999.999.999.999.999.999.999.999.999.999 is still fine). Inflation is checked only once it is typed
   (`done`), so "-" on the way to "-5" says nothing. */
export function toastFor(id, text, done) {
  if (id === 'sum') {
    var digits = String(text).split(',')[0].replace(/[^0-9]/g, '').replace(/^0+/, '');
    return digits.length > 30 ? TOASTS.huge : '';
  }
  if (id === 'infl') {
    var v = Calc.parseNum(text);
    if (v === 100) return TOASTS.infl100;
    if (done && String(text).trim() && !(v >= -50 && v <= 100)) return TOASTS.inflBad;
  }
  return '';
}

/* Shows a message for 5 seconds; the same message is not shown again while its field still asks for it. */
var shown = {}, timer = 0;
export function toast(id, msg) {
  if (!msg) { shown[id] = ''; return; }
  if (shown[id] === msg) return;
  shown[id] = msg;
  var el = $('toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(timer);
  timer = setTimeout(function () { el.hidden = true; }, 5000);
}
