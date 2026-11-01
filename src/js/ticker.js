/* The live counter: a stopwatch from the moment the page opened, which adds every second the loss of that second
   for the sum and the account in the form (F-91); under it, the loss since 1 January (F-85). */
import { Calc } from './calc.js';
import { $ } from './dom.js';
import { duration, fmt, lei, pct, short, signed } from './format.js';

/* `rate`: lei per second, negative for a loss; 0 while a field is wrong, so the counter stops. `counted`: the whole
   seconds already added. A new sum changes the seconds to come, not those already counted (F-06). */
var tick = { S: NaN, p: null, rate: 0, total: 0, counted: 0, start: performance.now() };
function label(secs) {
  $('tkLabel').textContent = isFinite(tick.S) ? 'Pentru ' + fmt(tick.S, 0) + ' lei, de când ai deschis pagina (' + duration(secs) + '):' : 'Completează suma.';
}
export function renderTicker(s) {
  tick.S = s.S;
  label(tick.counted);
  if (!s.ok) { tick.p = null; tick.rate = 0; $('tkNote').textContent = 'Contorul e oprit până corectezi câmpurile marcate.'; return; }
  tick.p = s.p;
  var perYear = Calc.lossRatePerYear(s.p);
  tick.rate = -perYear / (Calc.YEAR_DAYS * 86400);
  $('tkNote').textContent = 'Ritm: ' + signed(tick.rate, 'lei', 4) + ' pe secundă · ' + signed(-perYear / Calc.YEAR_DAYS, 'lei') +
    ' pe zi (inflație ' + short(s.infl) + '%/an, ' + Calc.accountNote(s.p, pct, lei) + ').';
}
/* Once a second, on the second since the page opened, like a stopwatch; that is calm enough for reduced motion too. */
export function loop() {
  var ms = performance.now() - tick.start, secs = Math.floor(ms / 1000);
  for (; tick.counted < secs; tick.counted++) tick.total += tick.rate;
  label(secs);
  $('tk').textContent = signed(tick.total, 'lei', 4);
  $('ticker').classList.toggle('is-gain', tick.total > 0.00005);
  /* The same sum since 1 January: a what-if, recomputed from the form (F-85). */
  var n = new Date();
  var year = Calc.secondsSinceYearStart(n.getTime(), n.getTimezoneOffset(), new Date(n.getFullYear(), 0, 1).getTimezoneOffset());
  $('tkYear').textContent = 'De la 1 ianuarie: ' + (tick.p ? signed(-Calc.realLoss(tick.p, year / 86400), 'lei') : '—');
  setTimeout(loop, 1000 - ms % 1000 + 5); // a timer may fire a little early: just after the second, not before it
}
