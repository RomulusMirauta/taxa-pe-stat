/* The form: reading and checking the fields, filling them from the data, the scenario chips, the mode switch. */
import { Calc } from './calc.js';
import { DATA } from './builtin-data.js';
import { $ } from './dom.js';
import { fmtDate, RATE4, short, todayISO } from './format.js';

var FIELDS = {
  sum:  { money: true, min: 0, err: 'suma (un număr ≥ 0, de ex. 50.000)' },
  infl: { min: -50, max: 500, err: 'inflația (între −50% și 500%)' },
  rate: { min: 0, max: 100, err: 'dobânda (între 0% și 100%)' },
  tax:  { min: 0, max: 100, err: 'impozitul (între 0% și 100%)' },
  fees: { money: true, min: 0, err: 'comisioanele (un număr ≥ 0)' },
  eur0: { gt: 0, lt: 1000, err: 'cursul EUR de atunci' },
  eur1: { gt: 0, lt: 1000, err: 'cursul EUR de acum' },
  usd0: { gt: 0, lt: 1000, err: 'cursul USD de atunci' },
  usd1: { gt: 0, lt: 1000, err: 'cursul USD de acum' }
};
function invalid(id) { $(id).setAttribute('aria-invalid', 'true'); }
function readNum(id, errors) {
  var f = FIELDS[id], el = $(id);
  var v = Calc.parseNum(el.value, { money: !!f.money });
  var ok = isFinite(v) && (f.min === undefined || v >= f.min) && (f.max === undefined || v <= f.max) &&
    (f.gt === undefined || v > f.gt) && (f.lt === undefined || v < f.lt);
  el.setAttribute('aria-invalid', String(!ok));
  if (!ok) errors.push(f.err);
  return ok ? v : NaN;
}
function readDate(id, errors, what) {
  var el = $(id), ok = isFinite(Calc.parseISODate(el.value));
  el.setAttribute('aria-invalid', String(!ok));
  if (!ok) errors.push(what);
  return ok ? el.value : null;
}

/* ---------- which BNR day the rates belong to (DESIGN §5.3) ----------
   Each side of the form, 0 ("atunci": d0, eur0, usd0) and 1 ("acum": d1, eur1, usd1), remembers the day
   its rates belong to: the data's date after fillInputs, the row's date after a lookup in the BNR history,
   or 'user' once the user types a rate on that side. */
var prov = [null, null];
/* A new date on side i: its rates follow it from the history, unless the user typed them or one of them has
   the focus. Without a row for that date (or without a history) they stay, and readState flags them. */
function resolveSide(i) {
  var row = Calc.rateOn(DATA.fx.series, $('d' + i).value, todayISO());
  var focus = document.activeElement && document.activeElement.id;
  if (prov[i] === 'user' || !row || focus === 'eur' + i || focus === 'usd' + i) return;
  $('eur' + i).value = RATE4.format(row[1]);
  $('usd' + i).value = RATE4.format(row[2]);
  prov[i] = row[0];
}
/* The day the rates of side i belong to for the date d in the form: a date, 'user', or null when they belong
   to another date (a date for which there is no BNR rate in the data). */
function sideDay(i, d, today) {
  var p = prov[i];
  if (p === 'user' || p === d) return p;
  var row = Calc.rateOn(DATA.fx.series, d, today);
  return row && row[0] === p ? p : null;
}

var mode = 'net';
/* The „Fără dobândă / Cu dobânda netă” switch: the mode readState uses, and the pressed button. */
export function setMode(m) {
  mode = m;
  $('mRaw').setAttribute('aria-pressed', String(m === 'raw'));
  $('mNet').setAttribute('aria-pressed', String(m === 'net'));
}

export function readState() {
  var errors = [], today = todayISO();
  var S = readNum('sum', errors), infl = readNum('infl', errors);
  var rate = readNum('rate', errors), tax = readNum('tax', errors), fees = readNum('fees', errors);
  var d0 = readDate('d0', errors, 'data de referință'), d1 = readDate('d1', errors, 'data curentă');
  /* A date after today is a typing error; the data's own dates are not (the visitor's clock may be behind). */
  var future = function (d, i) { return d > today && d !== DATA.fx['d' + i]; };
  if (d1 && future(d1, 1)) {
    errors.push('data curentă nu poate fi în viitor');
    invalid('d1');
    d1 = null;
  }
  var days = d0 && d1 ? Calc.daysBetween(d0, d1) : NaN;
  if (d0 && d1 && !(days > 0)) {
    errors.push('data curentă trebuie să fie după data de referință');
    invalid('d0');
    invalid('d1');
    days = NaN;
  }
  var c = {};
  ['eur', 'usd'].forEach(function (k) {
    var c0 = readNum(k + '0', errors), c1 = readNum(k + '1', errors);
    if (isFinite(c0) && isFinite(c1) && !Calc.fxPairOk(c0, c1)) {
      errors.push('cursurile ' + k.toUpperCase() + ' de atunci și de acum nu par reale (verifică virgula)');
      invalid(k + '0');
      invalid(k + '1');
      c0 = c1 = NaN;
    }
    c[k] = [c0, c1];
  });
  /* Rates that belong to another date than the one in the form would state false history: no calculation. */
  var fxDay = [d0, d1].map(function (d, i) { return d && !future(d, i) ? sideDay(i, d, today) || 'missing' : null; });
  var fxMissing = [];
  fxDay.forEach(function (day, i) {
    if (day !== 'missing') return;
    var d = i ? d1 : d0;
    fxMissing.push(d);
    errors.push('cursul BNR din ' + fmtDate(d) + ' (bnr.ro)');
    invalid('eur' + i);
    invalid('usd' + i);
  });
  var fx = {};
  ['eur', 'usd'].forEach(function (k) {
    var t = fxMissing.length ? null : Calc.fxTrend(c[k][0], c[k][1], days);
    fx[k] = t ? { c0: c[k][0], c1: c[k][1], lost: t.lost, annual: t.annual } : null;
  });
  /* The rates of d1 alone: what already happened (F-84) needs neither d0 nor its rates. */
  var now = {};
  ['eur', 'usd'].forEach(function (k) { now[k] = fxDay[1] && fxDay[1] !== 'missing' ? c[k][1] : NaN; });
  var netOk = isFinite(rate) && isFinite(tax) && isFinite(fees);
  var p = { S: S, pi: infl / 100, rate: rate / 100, tax: tax / 100, fees: fees, net: mode === 'net' };
  return {
    p: p,
    pNet: netOk ? { S: S, pi: infl / 100, rate: rate / 100, tax: tax / 100, fees: fees, net: true } : null,
    ok: isFinite(S) && isFinite(infl) && (!p.net || netOk),
    /* The exchange rates do not need inflation. */
    okFx: isFinite(S) && (!p.net || netOk),
    fx: fx, now: now, days: days, d0: d0, d1: d1, fxDay: fxDay, fxMissing: fxMissing, errors: errors,
    S: S, infl: infl, rate: rate, tax: tax, fees: fees
  };
}

/* A field the user changed: rates typed on one side are the user's from now on; a new date brings its own rates. */
export function noteInput(id) {
  if (/^(eur|usd)[01]$/.test(id)) prov[Number(id.slice(-1))] = 'user';
  else if (/^d[01]$/.test(id)) resolveSide(Number(id.slice(-1)));
}

export function syncChips() {
  var infl = Calc.parseNum($('infl').value), rate = Calc.parseNum($('rate').value), tax = Calc.parseNum($('tax').value);
  document.querySelectorAll('[data-infl]').forEach(function (b) {
    b.setAttribute('aria-pressed', String(Math.abs(Number(b.dataset.infl) - infl) < 1e-9));
  });
  document.querySelectorAll('[data-rate]').forEach(function (b) {
    b.setAttribute('aria-pressed', String(Math.abs(Number(b.dataset.rate) - rate) < 1e-9 && Math.abs(Number(b.dataset.tax) - tax) < 1e-9));
  });
}

/* The values the form starts with, as the strings written into the fields. */
function startValues() {
  var F = DATA.fx;
  return {
    sum: short(DATA.sum), infl: short(DATA.inflation.yoy), rate: '0', tax: short(DATA.savings.tax.rate), fees: '0',
    d0: F.d0, d1: F.d1, eur0: RATE4.format(F.eur0), eur1: RATE4.format(F.eur1), usd0: RATE4.format(F.usd0), usd1: RATE4.format(F.usd1)
  };
}
var filled = {};
/* Writes DATA into the form: every field at startup; when the daily data arrives later, only the fields the
   user has not changed (Calc.mergeInputs). Dates the user changed then follow the new BNR history. */
export function fillInputs(late) {
  var next = startValues(), write = next, current = {};
  if (late) {
    for (var id in next) current[id] = $(id).value;
    write = Calc.mergeInputs(current, filled, next, document.activeElement && document.activeElement.id);
  }
  for (var k in write) { $(k).value = write[k]; filled[k] = write[k]; }
  if ('d0' in write) {
    prov = [DATA.fx.d0, DATA.fx.d1];
  } else {
    resolveSide(0);
    resolveSide(1);
  }
}
