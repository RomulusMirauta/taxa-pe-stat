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
/* The sign of a value as the page shows it, rounded to 2 decimals (−1, 0 or 1), and its colour: a loss in
   red, a gain in green, zero without a colour. */
export function sign2(v) { var r = Math.round(v * 100) / 100; return r > 0 ? 1 : r < 0 ? -1 : 0; }
export function tone(v) { return ['loss', '', 'gain'][sign2(v) + 1]; }
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
