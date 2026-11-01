/* How fresh the data is: the date of each source with its badges, and the BNR days under the rates. */
import { Calc } from './calc.js';
import { DATA } from './builtin-data.js';
import { $ } from './dom.js';
import { daysWord, esc, fmtDate, fmtMonth, todayISO } from './format.js';

/* The forecast is shown until its target month is over. */
export function forecastShown(today) { return !Calc.monthPassed(DATA.forecast.target, today); }

/* The date of each source, with a badge when it is old. Always the data's dates, never the form's. */
export function renderFresh(s) {
  var D = DATA, today = todayISO(), items = [];
  var badge = function (on, text) { return on ? '<span class="badge">' + text + '</span>' : ''; };
  items.push('<li>Curs: ' + esc(D.fx.source) + ', ' + fmtDate(D.fx.d1) +
    badge(Calc.isStale('fx', D.fx.d1, today), 'de acum ' + daysWord(Calc.ageDays(D.fx.d1, today))) + '</li>');
  /* On the site a late month means the daily update has stopped; with the built-in values, that a new one is out. */
  items.push('<li>Inflație: ' + esc(D.inflation.source) + ', ' + fmtMonth(D.inflation.month) +
    badge(Calc.inflationOverdue(D.inflation.month, today), D.live ? 'actualizarea pare întârziată' : 'a apărut probabil o lună nouă') + '</li>');
  if (forecastShown(today)) {
    items.push('<li>Prognoza BNR: raportul din ' + fmtMonth(D.forecast.report) +
      badge(Calc.isStale('report', D.forecast.report, today), 'a apărut probabil un raport nou') + '</li>');
  }
  var Sv = D.savings;
  items.push('<li>Dobânzi: media BNR la depozite, ' + fmtMonth(Sv.deposit.asOf) +
    badge(Calc.isStale('deposit', Sv.deposit.asOf, today), 'a apărut probabil o lună nouă') + ' · Tezaur, ' + fmtMonth(Sv.tezaur1y.asOf) +
    badge(Calc.isStale('tezaur', Sv.tezaur1y.asOf, today), 'poate fi depășită') + '</li>');
  if (D.live) items.push('<li>Curs și inflație actualizate automat</li>');
  $('fresh').innerHTML = items.join('');

  /* Under the rates: the interval, then the BNR day each side's rates come from. */
  var fxHint = $('fxHint'), text = [], warn = Calc.isShortInterval(s.days) || s.fxMissing.length > 0;
  if (Calc.isShortInterval(s.days)) {
    text.push('Interval scurt (' + daysWord(s.days) + '): ritmul anual extrapolat poate exagera mult. Pentru o comparație cinstită cu inflația anuală, folosește 12 luni.');
  } else if (s.d0 === D.fx.d0 && s.d1 === D.fx.d1) {
    text.push('Implicit: ultimele 12 luni, același interval ca inflația anuală.');
  }
  s.fxDay.forEach(function (day, i) {
    var d = i ? s.d1 : s.d0, side = i ? 'Acum: ' : 'Atunci: ';
    if (day === 'user') text.push(side + 'cursul introdus de tine.');
    else if (day === 'missing') text.push(side + 'nu avem cursul BNR din ' + fmtDate(d) + '; îl găsești pe bnr.ro (publicat în zilele lucrătoare, în jur de ora 13).');
    else if (day) text.push(side + 'cursul ' + D.fx.source + ' din ' + fmtDate(day) + (day !== d ? ', ultima zi cu curs până la ' + fmtDate(d) : '') + '.');
  });
  fxHint.className = warn ? 'hint warn' : 'hint';
  fxHint.textContent = text.join(' ');
}
