/* The page: renders everything from the form, wires the events, loads the daily data. The entry point of the build. */
import { Calc } from './calc.js';
import { DATA } from './builtin-data.js';
import { $ } from './dom.js';
import { capInput, fmtDate, fmtMonth, groupInput, short, todayISO } from './format.js';
import { fillInputs, noteInput, readState, syncChips } from './form.js';
import { renderFxTable, renderTable, renderTableHead } from './table.js';
import { renderFacts } from './facts.js';
import { renderChart } from './chart.js';
import { forecastShown, renderFresh } from './fresh.js';
import { loop, renderTicker } from './ticker.js';
import { closeToast, toast, toastFor } from './toast.js';

/* After „Minimul pentru plus”, the interest follows the sum, the inflation and the fees, until the user types an
   interest or a tax or picks another account: the order of a click and a new sum does not matter (F-95). */
var followMin = false;
function render() {
  var s = readState();
  if (followMin) {
    var r = Calc.rateForGainIn(s.infl / 100, 0, s.fees, s.S, 3);
    if (r <= 100 && (Calc.parseNum($('rate').value) !== r || Calc.parseNum($('tax').value) !== 0)) {
      $('rate').value = short(r);
      $('tax').value = '0';
      s = readState();
    }
  }
  var err = $('formErr');
  err.hidden = !s.errors.length;
  err.textContent = s.errors.length ? 'Verifică: ' + s.errors.join('; ') + '.' : '';
  renderTable(s);
  renderFxTable(s);
  renderFacts(s);
  renderChart(s);
  renderFresh(s);
  renderTicker(s);
  renderMinChip(s);
  syncChips();
}

/* The best case: the lowest tax-free interest at which the counter turns green within 3 seconds, for the sum,
   the inflation and the fees in the form. Hidden when the form has none, or when it would be over 100%. */
function renderMinChip(s) {
  var r = Calc.rateForGainIn(s.infl / 100, 0, s.fees, s.S, 3), b = document.querySelector('[data-min]');
  b.hidden = !(r <= 100);
  if (b.hidden) return;
  b.dataset.rate = r;
  b.textContent = 'Minimul pentru plus · ' + short(r) + '%, fără impozit';
}

/* Texts that depend on the data: scenario buttons, explanations, sources. */
function renderStatic() {
  var I = DATA.inflation, F = DATA.fx, P = DATA.forecast, Sv = DATA.savings;
  var chips = [[I.yoy, 'Ultimele 12 luni · ' + short(I.yoy) + '%']];
  if (I.services !== undefined) chips.push([I.services, 'Doar servicii · ' + short(I.services) + '%']);
  if (forecastShown(todayISO())) chips.push([P.value, 'Prognoza BNR, ' + fmtMonth(P.target, true) + ' · ' + short(P.value) + '%']);
  $('inflChips').innerHTML = chips.map(function (c) {
    return '<button type="button" class="chip" data-infl="' + c[0] + '" aria-pressed="false">' + c[1] + '</button>';
  }).join('');
  /* Under the chart, the same forecast button: the chart holds today's inflation for 10 years (F-87). */
  var shown = forecastShown(todayISO());
  $('chForecast').hidden = !shown;
  /* A toggle: pressed, it goes back to the annual rate (data-back), and says so. */
  $('chForecast').innerHTML = shown ? '<button type="button" class="chip" data-infl="' + P.value + '" data-back="' + I.yoy + '" aria-pressed="false"' +
    ' data-on="Înapoi la ultimele 12 luni (' + short(I.yoy) + '%)" data-off="Vezi cu prognoza BNR (' + short(P.value) + '%)">Vezi cu prognoza BNR (' + short(P.value) + '%)</button>' : '';
  var hint = 'Rata anuală, după ' + I.source + ', compară prețurile din ' + fmtMonth(I.month) + ' cu aceeași lună de anul trecut.';
  if (I.avg12 !== undefined && I.avg12 - I.yoy > 1) {
    hint += ' Media pe 12 luni, ' + short(I.avg12) + '%, e mai mare pentru că include scumpiri mai vechi; pentru viitor, rata anuală e un reper mai bun.';
  }
  $('inflHint').textContent = hint;

  $('rateChips').innerHTML = [
    [0, Sv.tax.rate, 'Cont curent · 0%'],
    [Sv.deposit.rate, Sv.tax.rate, 'Depozit 6–12 luni, media BNR · ' + short(Sv.deposit.rate) + '%'],
    [Sv.tezaur1y.rate, 0, 'Tezaur 1 an · ' + short(Sv.tezaur1y.rate) + '%, fără impozit']
  ].map(function (c) {
    return '<button type="button" class="chip" data-rate="' + c[0] + '" data-tax="' + c[1] + '" aria-pressed="false">' + c[2] + '</button>';
  }).join('') + '<button type="button" class="chip" data-min data-rate="" data-tax="0" aria-pressed="false" hidden></button>';
  $('rateHint').textContent = 'Depozitul: media BNR a dobânzilor la depozitele noi la termen în lei ale populației, cu scadența de 6–12 luni, din ' +
    fmtMonth(Sv.deposit.asOf) + '. BNR o publică la circa două luni după; ofertele băncilor pot fi mai mari sau mai mici. Impozitul de ' + short(Sv.tax.rate) + '% se reține automat; peste un prag anual de venituri din investiții se poate adăuga CASS, pe care calculul nu îl include.';

  $('foot').textContent = 'Surse: curs ' + F.source + ' (de referință, ' + fmtDate(F.d0) + ' și ' + fmtDate(F.d1) + '); inflație ' + I.source +
    ' (' + fmtMonth(I.month) + '), inclusiv zona euro' +
    (forecastShown(todayISO()) ? '; prognoza BNR din raportul asupra inflației, ' + fmtMonth(P.report) : '') +
    '; dobânzi: media BNR la depozitele noi la termen în lei ale populației, 6–12 luni, ' + fmtMonth(Sv.deposit.asOf) +
    ' (BNR o publică la circa două luni după), Tezaur ' + fmtMonth(Sv.tezaur1y.asOf) +
    '; impozitul pe dobândă: ' + short(Sv.tax.rate) + '% (' + fmtMonth(Sv.tax.asOf) + '). ' +
    'Pierderile pe cauze nu se adună: inflația din România include deja o parte din efectul cursului. Inflația e presupusă constantă; cursul nu e proiectat pe mai puțin de un an. ' +
    'Nu este consultanță financiară. Ce introduci rămâne în browserul tău.';
}

function setup() {
  renderTableHead();
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('.chip');
    if (!b) return;
    if (b.dataset.infl !== undefined) {
      var back = b.dataset.back !== undefined && b.getAttribute('aria-pressed') === 'true';
      $('infl').value = short(Number(back ? b.dataset.back : b.dataset.infl));
    } else if (b.dataset.rate !== undefined) {
      followMin = b.dataset.min !== undefined;
      $('rate').value = short(Number(b.dataset.rate));
      $('tax').value = short(Number(b.dataset.tax));
    }
    render();
  });
  /* The sums get their thousands dots as they are typed (F-93). Backspace or Delete next to a dot removes the
     digit beyond it: the dot itself would come back at once. */
  var MONEY = { sum: 1, fees: 1 };
  $('f').addEventListener('keydown', function (e) {
    var el = e.target, c = el.selectionStart;
    if (!MONEY[el.id] || c !== el.selectionEnd) return;
    if (e.key === 'Backspace' && el.value.charAt(c - 1) === '.') el.setSelectionRange(c - 1, c - 1);
    else if (e.key === 'Delete' && el.value.charAt(c) === '.') el.setSelectionRange(c + 1, c + 1);
  });
  $('f').addEventListener('input', function (e) {
    var el = e.target;
    if (MONEY[el.id]) {
      var g = groupInput(el.value, el.selectionStart);
      if (g.value !== el.value) { el.value = g.value; el.setSelectionRange(g.caret, g.caret); }
    }
    /* Inflation above 100% becomes 100% as it is typed (F-96). */
    if (el.id === 'infl' && capInput(el.value, 100) !== el.value) el.value = capInput(el.value, 100);
    if (el.id === 'sum' || el.id === 'infl') toast(el.id, toastFor(el.id, el.value, false));
    if (el.id === 'rate' || el.id === 'tax') followMin = false;
    noteInput(el.id);
    render();
  });
  $('toastClose').addEventListener('click', closeToast);
  /* What may still become a number is told once it is typed: when the field is left or Enter is pressed (F-97). */
  $('f').addEventListener('change', function (e) {
    var id = e.target.id;
    if (id === 'sum' || id === 'infl') toast(id, toastFor(id, e.target.value, true));
  });
  $('f').addEventListener('submit', function (e) { e.preventDefault(); });
  var pending = false;
  window.addEventListener('resize', function () {
    if (pending) return;
    pending = true;
    requestAnimationFrame(function () { pending = false; render(); });
  });
}

/* Daily data, from the same domain (GitHub Pages, the local server, the artifact if the file is published next to the page).
   If missing or invalid, the built-in values stay. Does not overwrite the fields the user has already changed. */
function loadData() {
  if (!window.fetch) return;
  fetch('data/rates.json', { cache: 'no-cache' })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (j) {
      var d = Calc.normalizeRates(j);
      if (!d) return;
      if (d.fx) DATA.fx = d.fx;
      if (d.inflation) DATA.inflation = d.inflation;
      DATA.live = true;
      renderStatic();
      fillInputs(true);
      render();
    })
    .catch(function () { /* no data: the built-in values stay */ });
}

setup();
renderStatic();
fillInputs();
render();
loop();
loadData();
