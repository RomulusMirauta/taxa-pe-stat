/* „Pe scurt”: what the sum was worth in EUR and USD on the two dates, a year of inflation with the form's interest,
   the break-even interest. */
import { Calc } from './calc.js';
import { $ } from './dom.js';
import { fmt, fmtDate, lei, pct, short, sign2, signed, sumLei, tone } from './format.js';

function fact(value, cls, text) {
  return '<div class="fact"><b class="num ' + cls + '">' + value + '</b><span>' + text + '</span></div>';
}
export function renderFacts(s) {
  var h = '';
  [['eur', '€'], ['usd', '$']].forEach(function (c) {
    var fx = s.fx[c[0]];
    if (!fx || !isFinite(s.S)) {
      h += fact('—', '', s.fxMissing.length ? 'Lipsește cursul BNR din ' + s.fxMissing.map(fmtDate).join(' și ') + '.'
        : 'Completează suma, datele și cursurile ' + c[0].toUpperCase() + '.');
      return;
    }
    var a = s.S / fx.c0, b = s.S / fx.c1, d = b - a;
    h += fact(signed(d, c[1]), tone(d),
      sumLei(s.S) + ' valorau ' + fmt(a) + ' ' + c[1] + ' pe ' + fmtDate(s.d0) + ' și ' + fmt(b) + ' ' + c[1] + ' pe ' + fmtDate(s.d1) + '.');
  });
  if (isFinite(s.S) && isFinite(s.infl)) {
    /* Deflation is a gain: the words follow the sign that is shown (F-08), never „pierdută” next to a green „+”.
       The year follows the form's interest and fees, as the table and the counter do (F-94). */
    var p = s.pNet || { S: s.S, pi: s.infl / 100, net: false };
    var lostYr = Calc.realLoss(p, Calc.YEAR_DAYS), more = Calc.extraNeeded(s.S, s.infl / 100, 1);
    h += fact(signed(-lostYr, 'lei'), tone(-lostYr),
      'putere de cumpărare ' + ['câștigată', 'neschimbată', 'pierdută'][sign2(lostYr) + 1] +
      ' într-un an ' + (s.pNet ? Calc.accountNote(p, pct, lei) : 'fără dobândă') + ', în lei de azi. La anul îți trebuie ' +
      ['cu ' + fmt(-more) + ' lei mai puțin', 'aceiași bani', 'cu ' + fmt(more) + ' lei mai mult'][sign2(more) + 1] + ' pentru același coș.');
    if (isFinite(s.tax)) {
      var be = Calc.breakEvenRate(s.infl / 100, s.tax / 100, isFinite(s.fees) ? s.fees : 0, s.S);
      h += fact(pct(be), '', 'dobânda brută minimă ca să ții pasul cu inflația' + (be === 0
        ? ': orice dobândă, chiar 0%, ține pasul' + (s.infl < 0 ? ' (prețurile scad).' : '.')
        : ' (impozit ' + short(s.tax) + '%' + (s.fees > 0 ? ', cu comisioanele incluse' : '') + ').'));
    } else {
      h += fact('—', '', 'Completează impozitul ca să vezi dobânda minimă.');
    }
  } else {
    h += fact('—', '', 'Completează suma și inflația.') + fact('—', '', 'Completează suma și inflația.');
  }
  $('facts').innerHTML = h;
}
