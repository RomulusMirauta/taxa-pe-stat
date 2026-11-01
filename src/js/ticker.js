/* The live counter: the loss since 1 January for the sum and the account in the form, at the pace of now (F-85). */
import { Calc } from './calc.js';
import { $ } from './dom.js';
import { fmt, lei, pct, short, signed } from './format.js';

/* The form's values, or null while a field is wrong: every tick recomputes the total from them. */
var tick = { p: null };
/* Read on every tick: turning "reduce motion" on later slows the counter at once, without a reload (O-17). */
var motion = globalThis.matchMedia ? matchMedia('(prefers-reduced-motion: reduce)') : null;
export function renderTicker(s) {
  $('tkLabel').textContent = isFinite(s.S) ? 'Pentru ' + fmt(s.S, 0) + ' lei, de la 1 ianuarie până acum, în ritmul de acum:' : 'Completează suma.';
  if (!s.ok) { tick.p = null; $('tkNote').textContent = 'Contorul e oprit până corectezi câmpurile marcate.'; return; }
  tick.p = s.p;
  var perYear = Calc.lossRatePerYear(s.p);
  $('tkNote').textContent = 'Ritm actual: ' + signed(-perYear / (Calc.YEAR_DAYS * 24), 'lei', 4) + ' pe oră · ' +
    signed(-perYear / Calc.YEAR_DAYS, 'lei') + ' pe zi (inflație ' + short(s.infl) + '%/an, ' + Calc.accountNote(s.p, pct, lei) + ').';
}
/* A what-if, not a running sum: the loss of today's sum since 1 January, the same as the table's „An” on
   31 December. Changing the sum changes the total at once (F-85 replaces F-06's running sum). */
export function loop() {
  var n = new Date();
  var secs = Calc.secondsSinceYearStart(n.getTime(), n.getTimezoneOffset(), new Date(n.getFullYear(), 0, 1).getTimezoneOffset());
  var total = tick.p ? -Calc.realLoss(tick.p, secs / 86400) : NaN;
  $('tk').textContent = isFinite(total) ? signed(total, 'lei', 4) : '—';
  $('ticker').classList.toggle('is-gain', total > 0.00005);
  setTimeout(loop, motion && motion.matches ? 1000 : 100);
}
