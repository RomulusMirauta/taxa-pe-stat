/* The page: renders everything from the form, wires the events, loads the daily data. The entry point of the build. */
import { Calc } from './calc.js';
import { DATA } from './builtin-data.js';
import { $ } from './dom.js';
import { fmtDate, fmtMonth, short, todayISO } from './format.js';
import { fillInputs, noteInput, readState, syncChips } from './form.js';
import { renderFxTable, renderTable, renderTableHead } from './table.js';
import { renderFacts } from './facts.js';
import { renderChart } from './chart.js';
import { forecastShown, renderFresh } from './fresh.js';
import { loop, renderTicker } from './ticker.js';

function render() {
  var s = readState();
  var err = $('formErr');
  err.hidden = !s.errors.length;
  err.textContent = s.errors.length ? 'Verifică: ' + s.errors.join('; ') + '.' : '';
  renderTable(s);
  renderFxTable(s);
  renderFacts(s);
  renderChart(s);
  renderFresh(s);
  renderTicker(s);
  syncChips();
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
  $('chForecast').innerHTML = shown ? '<button type="button" class="chip" data-infl="' + P.value + '" aria-pressed="false">Vezi cu prognoza BNR (' + short(P.value) + '%)</button>' : '';
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
  }).join('');
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
      $('infl').value = short(Number(b.dataset.infl));
    } else if (b.dataset.rate !== undefined) {
      $('rate').value = short(Number(b.dataset.rate));
      $('tax').value = short(Number(b.dataset.tax));
    }
    render();
  });
  $('f').addEventListener('input', function (e) {
    noteInput(e.target.id);
    render();
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
