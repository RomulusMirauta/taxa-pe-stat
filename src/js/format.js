/* Formatting, the Romanian way: numbers, signs, dates, day counts. Pure, no DOM; tested in tests/format.test.mjs. */
import { Calc } from './calc.js';

export function esc(v) { return String(v).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
/* Intl writes "-" and keeps it on values that round to zero; the page writes "−" and no sign on zero (F-08). */
function minus(s) { return /^-0(,0+)?$/.test(s) ? s.slice(1) : s.replace('-', '−'); }
var NF = {};
function nf(d) { return NF[d] || (NF[d] = new Intl.NumberFormat('ro-RO', { minimumFractionDigits: d, maximumFractionDigits: d })); }
export function fmt(v, d) { return minus(nf(d === undefined ? 2 : d).format(v)); }
var SHORT = new Intl.NumberFormat('ro-RO', { maximumFractionDigits: 2 });
export const RATE4 = new Intl.NumberFormat('ro-RO', { maximumFractionDigits: 4 });
export function short(v) { return minus(SHORT.format(v)); }
export function pct(fraction) { return isFinite(fraction) ? fmt(fraction * 100) + '%' : '—'; }
export function lei(v) { return fmt(v, 0) + ' lei'; }
/* The sign of a value as the page shows it, rounded to 2 decimals or to `d` (−1, 0 or 1), and its colour: a loss in
   red, a gain in green, zero without a colour. */
export function sign2(v, d) { var k = Math.pow(10, d === undefined ? 2 : d), r = Math.round(v * k) / k; return r > 0 ? 1 : r < 0 ? -1 : 0; }
export function tone(v, d) { return ['loss', '', 'gain'][sign2(v, d) + 1]; }
export function signed(v, unit, d) {
  d = d === undefined ? 2 : d;
  var k = Math.pow(10, d), r = Math.round(v * k) / k;
  if (r === 0) return fmt(0, d) + ' ' + unit;
  return (r < 0 ? '−' : '+') + fmt(Math.abs(r), d) + ' ' + unit;
}
export function compact(v) {
  var a = Math.abs(v);
  if (a >= 1e6) return short(v / 1e6) + ' mil.';
  if (a >= 1e3) return v / 1e3 === 1 ? '1 mie' : short(v / 1e3) + ' mii';
  return short(v);
}
var DF = new Intl.DateTimeFormat('ro-RO', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
var MF = new Intl.DateTimeFormat('ro-RO', { month: 'long', year: 'numeric', timeZone: 'UTC' });
var MS = new Intl.DateTimeFormat('ro-RO', { month: 'short', year: 'numeric', timeZone: 'UTC' });
export function fmtDate(iso) { var t = Calc.parseISODate(iso); return isFinite(t) ? DF.format(t) : '—'; }
export function fmtMonth(ym, brief) { var t = Calc.parseISODate(ym + '-01'); return isFinite(t) ? (brief ? MS : MF).format(t) : ym; }
/* A sum as it is typed: the thousands get their dots by themselves, wherever the user put or removed them
   ("50000" → "50.000"); the comma and the decimals after it stay as typed. `caret` is the cursor's position;
   it stays after the same digit. Text that is not a Romanian number ("abc", "50.000,5,1") stays as it is.
   Spaces go, and so do zeros in front ("05000" would read as 5 lei, F-100). `pasted`: a sum pasted the
   English way, one dot and 1–2 decimals ("1234.56"), keeps its decimals ("1.234,56"); a typed dot never
   gets there, it is removed at once. */
export function groupInput(text, caret, pasted) {
  var original = text, before = text.slice(0, caret).replace(/[\s ]/g, '');
  text = text.replace(/[\s ]/g, '');
  if (pasted && /^[0-9]+\.[0-9]{1,2}$/.test(text)) { text = text.replace('.', ','); before = before.replace('.', ','); }
  if (!/^[0-9.]*(,[0-9]*)?$/.test(text)) return { value: original, caret: caret };
  var cut = text.indexOf(','), int = (cut < 0 ? text : text.slice(0, cut)).replace(/\./g, '');
  var zeros = int.length - int.replace(/^0+(?=\d)/, '').length;
  int = int.slice(zeros);
  var value = int.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + (cut < 0 ? '' : text.slice(cut));
  /* The characters before the cursor that are not dots or dropped zeros, then the same count in the new text. */
  var keep = Math.max(0, before.replace(/\./g, '').length - zeros), at = 0;
  while (keep > 0 && at < value.length) { if (value.charAt(at) !== '.') keep--; at++; }
  return { value: value, caret: at };
}
/* A stopwatch's time: "13 s", "2 min 13 s", "1 h 2 min 5 s". */
export function duration(secs) {
  var s = Math.max(0, Math.floor(secs)), h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60);
  return (h ? h + ' h ' : '') + (h || m ? m + ' min ' : '') + s % 60 + ' s';
}
/* Romanian day counts: "1 zi", "7 zile", "365 de zile" */
export function daysWord(n) {
  if (n === 1) return '1 zi';
  var r = n % 100;
  return n + (n >= 20 && (r === 0 || r >= 20) ? ' de zile' : ' zile');
}
/* Today in the visitor's own time zone, not in UTC: the dates in the form are local dates. `now` is for the tests. */
export function todayISO(now) {
  var n = now || new Date(), two = function (v) { return (v < 10 ? '0' : '') + v; };
  return n.getFullYear() + '-' + two(n.getMonth() + 1) + '-' + two(n.getDate());
}
/* A signed value split into its sign and the rest, so the counter can set the sign apart: "−0,0008 lei" →
   ["−", "0,0008 lei"]; without a sign the first part is empty. */
export function splitSign(text) { return /^[−+]/.test(text) ? [text.charAt(0), text.slice(1)] : ['', text]; }
/* A field with a ceiling: a number above `max` becomes `max` as it is typed ("999" → "100"); anything else stays. */
export function capInput(text, max) { return Calc.parseNum(text) > max ? short(max) : text; }
/* The sum as the user wrote it: its decimals when it has any ("0,50 lei", not "1 lei"), and "1 leu" (F-101). */
export function sumLei(v) { return v === 1 ? '1 leu' : fmt(v, v % 1 ? 2 : 0) + ' lei'; }
