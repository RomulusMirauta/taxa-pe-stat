/* The 10-year chart of purchasing power: without interest, and with the form's interest. */
import { Calc } from './calc.js';
import { $ } from './dom.js';
import { compact, fmt, lei, pct, short, sumLei } from './format.js';

export function renderChart(s) {
  var svg = $('ch'), hint = $('chHint');
  /* The drawing's width follows the container, so the text keeps its size on phones too: a drawing wider than
     the container would be scaled down, its 11px labels with it (F-81). */
  /* R leaves room for „+10 ani” centred on the last year; L grows with the longest axis label (F-78). T leaves a
     band above the drawing for the assumption, where no line can reach it, whichever way the lines go (F-87). */
  var W = Math.round(Math.max(200, Math.min(640, svg.parentNode.clientWidth || 640))), H = 260, L = 64, R = 30, T = 32, B = 30, yrs = 10;
  svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
  if (!(s.S > 0) || !isFinite(s.infl)) {
    svg.innerHTML = '<text x="' + W / 2 + '" y="130" text-anchor="middle">Introdu suma și inflația ca să vezi graficul.</text>';
    hint.textContent = '';
    return;
  }
  var pRaw = { S: s.S, pi: s.infl / 100, net: false };
  var raw = [], net = [];
  for (var t = 0; t <= yrs; t++) {
    raw.push(Calc.realValue(pRaw, t));
    if (s.pNet) net.push(Calc.realValue(s.pNet, t));
  }
  var maxV = Math.max.apply(null, raw.concat(net));
  var step = Calc.niceStep(maxV, 4), top = Math.ceil(maxV / step) * step;
  for (var lv = 0; lv <= top + step / 2; lv += step) L = Math.max(L, Math.ceil(compact(lv).length * 6.8) + 14);
  var x = function (t) { return L + (W - L - R) * t / yrs; };
  var y = function (v) { return T + (H - T - B) * (1 - v / top); };
  var g = '';
  for (var v = 0; v <= top + step / 2; v += step) {
    g += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + y(v) + '" y2="' + y(v) + '" stroke="var(--line)" stroke-width="1"/>' +
         '<text x="' + (L - 8) + '" y="' + (y(v) + 4) + '" text-anchor="end">' + compact(v) + '</text>';
  }
  for (var u = 0; u <= yrs; u += (W < 420 ? 5 : 2)) {
    g += '<text x="' + x(u) + '" y="' + (H - 10) + '" text-anchor="middle">' + (u === 0 ? 'azi' : '+' + u + ' ani') + '</text>';
  }
  var path = function (a) { return a.map(function (val, i) { return (i ? 'L' : 'M') + x(i).toFixed(1) + ',' + y(val).toFixed(1); }).join(''); };
  g += '<path d="' + path(raw) + 'L' + x(yrs) + ',' + y(0) + 'L' + x(0) + ',' + y(0) + 'Z" fill="var(--loss-soft)" stroke="none"/>';
  g += '<path d="' + path(raw) + '" fill="none" stroke="var(--loss)" stroke-width="2.5"/>';
  if (net.length) {
    g += '<path d="' + path(net) + '" fill="none" stroke="var(--accent)" stroke-width="2.5"' + (Calc.netRate(s.pNet) === 0 && !s.fees ? ' stroke-dasharray="5 4"' : '') + '/>';
    g += '<circle cx="' + x(yrs) + '" cy="' + y(net[yrs]) + '" r="4" fill="var(--accent)"/>';
  }
  g += '<circle cx="' + x(yrs) + '" cy="' + y(raw[yrs]) + '" r="4" fill="var(--loss)"/>';
  /* The assumption, in the drawing itself: a hint under it is easy to miss (F-87). */
  g += '<text id="chAssume" class="assume" x="' + (W - 2) + '" y="14" text-anchor="end">inflație constantă: ' + short(s.infl) + '%/an</text>';
  svg.innerHTML = g;
  hint.textContent = 'În lei de azi: peste 10 ani, ' + sumLei(s.S) + ' fără dobândă cumpără cât ' + fmt(raw[yrs], 0) + ' lei azi' +
    (net.length && (Calc.netRate(s.pNet) > 0 || s.fees > 0) ? '; ' + Calc.accountNote(s.pNet, pct, lei) + ', cât ' + fmt(net[yrs], 0) + ' lei' : '') +
    '. Presupune inflație constantă de ' + short(s.infl) + '% pe an.';
}
