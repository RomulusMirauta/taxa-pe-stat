# Taxa pe stat

[![Publicare](https://github.com/RomulusMirauta/taxa-pe-stat/actions/workflows/publish.yml/badge.svg)](https://github.com/RomulusMirauta/taxa-pe-stat/actions/workflows/publish.yml)
[![Licență: MIT](https://img.shields.io/badge/licen%C8%9B%C4%83-MIT-blue.svg)](LICENSE)

**Cât pierd leii tăi, zi de zi.** Taxa pe care o plătești când banii stau: inflația și leul care pierde teren față de euro și dolar, pe zi, săptămână, lună și an.

**→ [romulusmirauta.github.io/taxa-pe-stat](https://romulusmirauta.github.io/taxa-pe-stat/)**

![Taxa pe stat: pierderea pe zi, săptămână, lună și an pentru 50.000 lei](docs/screenshot.png)

## Ce face

- Calculează pierderea pe **zi, săptămână, lună și an**, din trei cauze, fiecare pe rândul ei:
  - inflația (puterea de cumpărare);
  - leul față de euro;
  - leul față de dolar.
- **Unde stau banii schimbă rezultatul:** cont curent, depozit sau titluri de stat, cu impozitul pe dobândă și comisioanele.
- **Contor live:** cât ai pierdut (sau câștigat) de când ai deschis pagina.
- **Pe scurt:** cât s-a pierdut deja în euro și dolari în ultimul an și dobânda minimă cu care ții pasul cu inflația.
- **Grafic pe 10 ani** al puterii de cumpărare.
- **Datele se actualizează singure** în zilele lucrătoare: cursul BNR și inflația de la Eurostat.

Nu este consultanță financiară. Ce introduci rămâne în browserul tău: pagina nu face cereri către alte site-uri și nu are analytics.

## Cum funcționează

- **Pagina** e un singur fișier, `app.html`, fără framework și fără dependențe. Calculele stau separat, în `<script id="calc">`, ca să poată fi testate.
- **Datele:** în zilele lucrătoare, după ce BNR publică cursul, GitHub Actions rulează `scripts/update-data.mjs`. Scriptul:
  - ia cursul BNR (rezervă: BCE) și inflația IAPC de la Eurostat;
  - scrie `data/rates.json`;
  - face commit ca `github-actions[bot]`;
  - republică site-ul.
- **Dacă o sursă cade,** rămân datele anterioare și apare un avertisment. Dacă nu există deloc un curs, jobul eșuează și GitHub trimite email.
- **Pagina citește `data/rates.json`** de pe același domeniu și îl validează. Fără fișier, folosește valorile din `app.html`.

Formulele, sursele și deciziile sunt în [`BAZA.md`](BAZA.md). Problemele găsite și reparate sunt în [`FINDINGS.md`](FINDINGS.md).

## Rulare locală

Ai nevoie de Node.js 20 sau mai nou. Nu există dependențe de instalat.

```
npm run dev        # http://localhost:5173, deschide browserul, se reîncarcă la salvare
npm test           # toate testele
npm run build      # → dist/: pagina completă, fonturile, datele, imaginea de previzualizare
node scripts/update-data.mjs   # datele de azi (are nevoie de internet)
```

Pe Windows, `start.cmd` pornește serverul și deschide browserul.

## Teste

Testele folosesc `node:test`, fără dependențe, și stau toate în `tests/`:

| Fișier | Ce verifică |
|---|---|
| `calc.test.mjs` | calculele: inflație, curs, dobândă, comisioane, numere scrise ca în română |
| `data.test.mjs` | datele automate: BNR, BCE, Eurostat, cu rețea simulată, inclusiv când sursele cad |
| `page.test.mjs` | regulile paginii, legăturile cod ↔ pagină, temele light și dark |
| `build.test.mjs` | build-ul: CSP, căi relative, fonturi locale, adresa publică |
| `serve.test.mjs` | serverul local, inclusiv protecția la `../` |

Rulează în GitHub Actions înainte de fiecare publicare și la fiecare pull request.

## Publicare

GitHub Pages, prin `.github/workflows/publish.yml`:
- **push pe `main`** → teste → build → publicare;
- **zilele lucrătoare** → date noi → commit → teste → build → publicare.

Configurare, o singură dată: Settings → Pages → Source: **GitHub Actions**.

## Istoric

Fiecare pas e un commit, iar versiunile au tag-uri. Pe scurt, în [`CHANGELOG.md`](CHANGELOG.md):

| Versiune | Ce aduce |
|---|---|
| **v0.1.0** | *Ceasul leului*, prima versiune |
| **v0.2.0** | review-ul 1: 30 de probleme găsite și reparate, build, teste |
| **v0.3.0** | *Taxa pe stat*: nume nou, date automate, publicare pe GitHub Pages |

Cum lucrăm (artifact-ul de pe claude.ai, copia locală, sincronizarea): [`docs/LUCRU.md`](docs/LUCRU.md).

## In English

*Taxa pe stat* ("the tax for standing still") shows how much money kept in Romanian lei loses every day, week, month and year:
- to inflation;
- to the leu's slide against the euro and the US dollar;
- after deposit interest, tax and bank fees.

Exchange rates (BNR, with ECB as fallback) and inflation (Eurostat HICP) are refreshed automatically on weekdays by GitHub Actions and committed to the repo. The page is a single dependency-free HTML file, and the project has 120+ tests built on `node:test`. Its history, starting as *Ceasul leului*, is kept commit by commit, with a findings log in [`FINDINGS.md`](FINDINGS.md).

## Licență

[MIT](LICENSE). Fonturile sunt sub licența SIL OFL 1.1 (`fonts/`).
