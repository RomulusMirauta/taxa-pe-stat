/* The two tables, per day, week, month and year: the loss to inflation (projected; inflation moves slowly), and
   what already happened against EUR and USD over the same periods (F-84). */
import { Calc } from './calc.js';
import { DATA } from './builtin-data.js';
import { $ } from './dom.js';
import { daysWord, fmt, fmtDate, fmtMonth, pct, short, signed, sumLei, todayISO } from './format.js';

/* A table whose values do not fit beside each other (large sums) gets the phone layout, one period per line. */
function fit(tbody) {
  var wrap = tbody.closest('.tablewrap');
  wrap.classList.remove('stacked');
  if (wrap.scrollWidth > wrap.clientWidth) wrap.classList.add('stacked');
}

function head(first) {
  return '<th scope="col">' + first + '</th>' + Calc.PERIODS.map(function (q) { return '<th scope="col">' + q.label + '</th>'; }).join('');
}
/* The header rows: the cause or the currency, then the four periods. */
export function renderTableHead() {
  $('thead').innerHTML = head('Cauza');
  $('fxHead').innerHTML = head('Valuta');
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
  var inflSub = isFinite(s.infl) ? 'putere de cumpărare, ' + short(s.infl) + '%/an' : 'completează inflația';
  $('tb').innerHTML = row('Inflație', inflSub, Calc.PERIODS.map(function (q) { return s.ok ? Calc.realLoss(s.p, q.days) : NaN; }), 'lei');
  fit($('tb'));

  var t;
  if (isFinite(s.rate) && isFinite(s.tax) && (Calc.netRate(s.p) > 0 || s.fees > 0)) {
    t = 'Cu dobânda netă de ' + pct(Calc.netRate(s.p)) + ' pe an (' + short(s.rate) + '% minus impozit ' + short(s.tax) + '%)' +
        (s.fees > 0 ? ' și ' + fmt(s.fees, 0) + ' lei comisioane pe an' : '') + '. „+” verde înseamnă că dobânda acoperă pierderea.';
  } else {
    t = 'Bani ținuți fără dobândă (cash, cont curent).';
  }
  $('lossHint').textContent = t;
}

/* What already happened against EUR and USD (F-84): the rows, and the note with the only projection, a year's.
   Pure, tested in Node (tests/table.test.mjs): `D` is the data (DATA), `today` the visitor's date. */
export function fxView(s, D, today) {
  var series = D.fx.series;
  var rows = [['eur', 'EUR', '€', 1], ['usd', 'USD', '$', 2]].map(function (c) {
    var k = c[0], values = Calc.PERIODS.map(function () { return NaN; }), sub;
    if (!series) {
      sub = 'lipsește istoricul zilnic al cursului';
    } else if (s.fxDay[1] === 'missing') {
      sub = 'lipsește cursul BNR din ' + fmtDate(s.d1);
    } else if (!s.d1 || !isFinite(s.now[k])) {
      sub = 'completează data curentă și cursul';
    } else {
      sub = 'până pe ' + fmtDate(s.d1) + (s.fxDay[1] === 'user' ? ', cu cursul introdus de tine' : '');
      if (s.okFx) values = Calc.fxRealized(s.p, series, s.d1, s.now[k], c[3], today);
    }
    return { label: c[1], sub: sub, values: values, unit: c[2] };
  });

  var note = 'Ce s-a întâmplat deja: cât valorau banii în euro și în dolari acum o zi, o săptămână, 30 de zile și un an, ' +
    'față de cât valorează la cursul de acum. Nu e o prognoză: cursul urcă și coboară, iar „+” verde înseamnă că leul a câștigat.';
  if (isFinite(s.S) && (Calc.netRate(s.p) > 0 || s.fees > 0)) {
    note += ' Cu dobânda și comisioanele din formular, suma de atunci e cea care a ajuns la ' + sumLei(s.S) + ' azi.';
  }
  /* A currency is never projected for less than a year: the pace of one interval holds only on average. */
  var pace = [['eur', '€', 'euro'], ['usd', '$', 'dolar']].map(function (c) {
    var fx = s.fx[c[0]];
    return fx && s.okFx && isFinite(fx.annual) ? signed(-Calc.fxLoss(s.p, fx.annual, fx.c1, Calc.YEAR_DAYS), c[1]) + ' pe an față de ' + c[2] : '';
  }).filter(Boolean);
  if (pace.length) {
    note += ' Dacă ritmul ' + (Math.abs(s.days - 365) <= 3 ? 'din ultimul an' : 'din intervalul ales (' + daysWord(s.days) + ')') +
      ' continuă: ' + pace.join(' și ') + '.';
  } else if (s.fx.eur || s.fx.usd) {
    note += ' Din intervalul ales, ritmul anual nu se poate extrapola.';
  }
  if (D.inflation.euroArea !== undefined) {
    note += ' Nici euro nu e ferit de inflație: în zona euro a fost ' + short(D.inflation.euroArea) + '% în ' +
      fmtMonth(D.inflation.euroAreaMonth || D.inflation.month) + '.';
  }
  return { rows: rows, note: note };
}

export function renderFxTable(s) {
  var v = fxView(s, DATA, todayISO());
  $('fxb').innerHTML = v.rows.map(function (r) { return row(r.label, r.sub, r.values, r.unit); }).join('');
  fit($('fxb'));
  $('fxNote').textContent = v.note;
}
