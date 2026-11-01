/* The live counter: a stopwatch from the moment the page opened, which adds every second the loss of that second
   for the sum and the account in the form (F-91); under it, the loss since 1 January (F-85). */
import { Calc } from './calc.js';
import { $ } from './dom.js';
import { duration, esc, fmt, lei, pct, short, signed, splitSign, tone } from './format.js';

/* `rate`: lei per second, negative for a loss. The total is the seconds since the page opened at the pace of the
   form now: a new sum recounts them all (F-91 replaces F-06's running sum). While a field is wrong it stops. */
var tick = { S: NaN, p: null, rate: 0, total: 0, secs: 0, start: performance.now() };
/* What the number is, by the colour it is shown in: what rounds to zero is neither a loss nor a gain. */
var WORDS = { loss: 'ai pierdut', gain: 'ai câștigat', '': 'nu ai pierdut, nu ai câștigat' };
function label(secs) {
  $('tkLabel').textContent = isFinite(tick.S) ? 'Pentru ' + fmt(tick.S, 0) + ' lei, de când ai deschis pagina (' + duration(secs) + '), ' + WORDS[tone(tick.total, 4)] + ':' : 'Completează suma.';
}
export function renderTicker(s) {
  tick.S = s.S;
  label(tick.secs);
  if (!s.ok) { tick.p = null; $('tkNote').textContent = 'Contorul e oprit până corectezi câmpurile marcate.'; return; }
  tick.p = s.p;
  var perYear = Calc.lossRatePerYear(s.p);
  tick.rate = -perYear / (Calc.YEAR_DAYS * 86400);
  $('tkNote').textContent = 'Ritm actual: ' + signed(tick.rate * 3600, 'lei', 4) + ' pe oră | ' + signed(-perYear / Calc.YEAR_DAYS, 'lei') +
    ' pe zi (inflație ' + short(s.infl) + '%/an, ' + Calc.accountNote(s.p, pct, lei) + ').';
}
/* Once a second, on the second since the page opened, like a stopwatch; that is calm enough for reduced motion too. */
export function loop() {
  var ms = performance.now() - tick.start, secs = Math.floor(ms / 1000);
  tick.secs = secs;
  if (tick.p) tick.total = secs * tick.rate;
  label(secs);
  /* The sign apart from the number, as far as the number is from „lei”; without a sign its place stays empty,
     so the number does not move when the sign comes. */
  var parts = splitSign(signed(tick.total, 'lei', 4));
  $('tk').innerHTML = '<span class="sgn">' + parts[0] + '</span>' + esc(parts[1]);
  /* Red for a loss, green for a gain, grey for what rounds to zero. */
  var t = tone(tick.total, 4);
  $('ticker').classList.toggle('is-gain', t === 'gain');
  $('ticker').classList.toggle('is-zero', t === '');
  /* The same sum since 1 January: a what-if, recomputed from the form (F-85). */
  var n = new Date();
  var year = Calc.secondsSinceYearStart(n.getTime(), n.getTimezoneOffset(), new Date(n.getFullYear(), 0, 1).getTimezoneOffset());
  $('tkYear').textContent = 'De la 1 ianuarie ' + n.getFullYear() + ': ' + (tick.p ? signed(-Calc.realLoss(tick.p, year / 86400), 'lei') : '—');
  setTimeout(loop, 1000 - ms % 1000 + 5); // a timer may fire a little early: just after the second, not before it
}
