/* The live counter. */
import { Calc } from './calc.js';
import { $ } from './dom.js';
import { fmt, lei, pct, short, signed } from './format.js';

var tick = { rate: 0, total: 0, last: performance.now() };
/* Read on every tick: turning "reduce motion" on later slows the counter at once, without a reload (O-17). */
var motion = globalThis.matchMedia ? matchMedia('(prefers-reduced-motion: reduce)') : null;
export function renderTicker(s) {
  $('tkLabel').textContent = isFinite(s.S) ? 'Pentru ' + fmt(s.S, 0) + ' lei, de când ai deschis pagina:' : 'Completează suma.';
  if (!s.ok) { tick.rate = 0; $('tkNote').textContent = 'Contorul e oprit până corectezi câmpurile marcate.'; return; }
  var perYear = Calc.lossRatePerYear(s.p);
  tick.rate = -perYear / (Calc.YEAR_DAYS * 86400);
  $('tkNote').textContent = 'Ritm actual: ' + signed(-perYear / (Calc.YEAR_DAYS * 24), 'lei', 4) + ' pe oră · ' +
    signed(-perYear / Calc.YEAR_DAYS, 'lei') + ' pe zi (inflație ' + short(s.infl) + '%/an, ' + Calc.accountNote(s.p, pct, lei) + ').';
}
export function loop() {
  var now = performance.now();
  tick.total += tick.rate * (now - tick.last) / 1000;
  tick.last = now;
  $('tk').textContent = signed(tick.total, 'lei', 4);
  $('ticker').classList.toggle('is-gain', tick.total > 0.00005);
  setTimeout(loop, motion && motion.matches ? 1000 : 100);
}
