/* The loss table: inflation, EUR and USD, per day, week, month and year. */
import { Calc } from './calc.js';
import { DATA } from './builtin-data.js';
import { $ } from './dom.js';
import { daysWord, fmt, fmtDate, fmtMonth, pct, short } from './format.js';

/* The header row: the cause, then the four periods. */
export function renderTableHead() {
  $('thead').innerHTML = '<th scope="col">Cauza</th>' + Calc.PERIODS.map(function (q) { return '<th scope="col">' + q.label + '</th>'; }).join('');
}

/* data-period: on a phone the header row is hidden and each value shows its period above it (O-18). */
function cell(v, unit, period) {
  var r = Math.round(v * 100) / 100, cls = '', text = '—';
  if (isFinite(v)) {
    cls = r > 0 ? ' loss' : r < 0 ? ' gain' : '';
    text = (r > 0 ? '−' : r < 0 ? '+' : '') + fmt(Math.abs(r)) + ' ' + unit;
  }
  return '<td class="num' + cls + '" data-period="' + period + '">' + text + '</td>';
}
function row(label, sub, values, unit) {
  return '<tr><td>' + label + '<span class="sub">' + sub + '</span></td>' +
    values.map(function (v, i) { return cell(v, unit, Calc.PERIODS[i].label); }).join('') + '</tr>';
}

export function renderTable(s) {
  var P = Calc.PERIODS, html = '';
  var inflSub = isFinite(s.infl) ? 'putere de cumpărare, ' + short(s.infl) + '%/an' : 'completează inflația';
  html += row('Inflație', inflSub, P.map(function (q) { return s.ok ? Calc.realLoss(s.p, q.days) : NaN; }), 'lei');
  [['eur', 'EUR', '€'], ['usd', 'USD', '$']].forEach(function (c) {
    var fx = s.fx[c[0]], sub;
    if (fx) {
      sub = 'leul ' + (fx.lost >= 0 ? 'a pierdut ' : 'a câștigat ') + pct(Math.abs(fx.lost)) + ' în ' + daysWord(s.days);
      if (!isFinite(fx.annual)) sub += '; ritmul anual nu se poate extrapola';
      else if (Math.abs(s.days - 365) > 3) sub += ' (~' + pct(fx.annual) + '/an)';
    } else {
      sub = s.fxMissing.length ? 'lipsește cursul BNR din ' + s.fxMissing.map(fmtDate).join(' și ') : 'completează datele și cursurile';
    }
    html += row('Față de ' + c[1], sub, P.map(function (q) { return s.ok && fx ? Calc.fxLoss(s.p, fx.annual, fx.c1, q.days) : NaN; }), c[2]);
  });
  $('tb').innerHTML = html;

  var t;
  if (s.p.net && isFinite(s.rate) && isFinite(s.tax) && (Calc.netRate(s.p) > 0 || s.fees > 0)) {
    t = 'Cu dobânda netă de ' + pct(Calc.netRate(s.p)) + ' pe an (' + short(s.rate) + '% minus impozit ' + short(s.tax) + '%)' +
        (s.fees > 0 ? ' și ' + fmt(s.fees, 0) + ' lei comisioane pe an' : '') + '. „+” verde înseamnă că dobânda acoperă pierderea.';
  } else {
    t = 'Bani ținuți fără dobândă (cash, cont curent).';
  }
  t += ' Rândurile EUR și USD sunt în valuta respectivă și presupun că ritmul leului din intervalul ales continuă.';
  if (DATA.inflation.euroArea !== undefined) {
    t += ' Nici euro nu e ferit de inflație: în zona euro a fost ' + short(DATA.inflation.euroArea) + '% în ' +
         fmtMonth(DATA.inflation.euroAreaMonth || DATA.inflation.month) + '.';
  }
  $('modeHint').textContent = t;
}
