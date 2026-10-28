# Taxa pe stat

Taxa pe care o plătești când banii stau: cât pierd leii tăi din cauza inflației și a leului care scade față de euro și dolar, pe zi, săptămână, lună și an.

Fostul nume: *Ceasul leului* (redenumit pe 29 octombrie 2026).

- **Site:** `https://<utilizator>.github.io/taxa-pe-stat/`, după prima publicare.
- **Cum calculează și de unde vin datele:** [`BAZA.md`](BAZA.md)
- **Probleme găsite și reparate:** [`FINDINGS.md`](FINDINGS.md)

## Cum funcționează

- **Pagina** e un singur fișier, `app.html`, fără framework și fără dependențe.
- **Calculele** stau separat, în `<script id="calc">`, ca să poată fi testate.
- **Datele se actualizează singure.** În fiecare zi lucrătoare, după ce BNR publică cursul, GitHub Actions rulează `scripts/update-data.mjs`:
  - ia cursul BNR (rezervă: BCE) și inflația de la Eurostat;
  - scrie `data/rates.json`;
  - face commit ca `github-actions[bot]`;
  - republică site-ul.
- **Dacă o sursă cade,** rămân datele anterioare și apare un avertisment în Actions. Dacă nu există deloc un curs, jobul eșuează și GitHub trimite email.
- **Pagina citește `data/rates.json`** de pe același domeniu și îl validează. Fără fișier, folosește valorile din `app.html`.

## Rulare locală

Ai nevoie de Node.js 20 sau mai nou. Nu există dependențe de instalat.

- **Windows:** dublu-click pe `start.cmd`. Pornește serverul și deschide browserul.
- **Din terminal:**

  ```
  npm run dev        # http://localhost:5173, deschide browserul, se reîncarcă la salvare
  npm start          # la fel, fără să deschidă browserul
  ```

- **Datele de azi, local:** `node scripts/update-data.mjs` (are nevoie de internet).
- **Alt port:**
  - PowerShell: `$env:PORT=8080; npm start`
  - cmd: `set PORT=8080 && npm start`
- **De pe telefon, din rețeaua de acasă:** `$env:HOST="0.0.0.0"; npm start`. Serverul afișează adresa.

## Teste

```
npm test
```

- Folosesc `node:test`, fără dependențe, și stau toate în `tests/`:

  | Fișier | Ce verifică |
  |---|---|
  | `calc.test.mjs` | calculele |
  | `data.test.mjs` | datele automate: parsarea BNR, BCE, Eurostat, cu rețea simulată, inclusiv când sursele cad |
  | `page.test.mjs` | regulile paginii și temele light/dark |
  | `build.test.mjs` | build-ul |
  | `serve.test.mjs` | serverul local |

- Rulează în GitHub Actions înainte de fiecare publicare și la fiecare pull request.
- Un bug găsit se trece în `FINDINGS.md`, cu un ID nou, și, unde se poate, primește un test.

## Build și publicare

```
npm run build      # → dist/index.html + dist/fonts/ + dist/data/
```

`build.mjs` învelește `app.html` într-un document complet:
- `<head>` cu `lang="ro"`, descriere și favicon;
- fonturi găzduite local, fără cereri către Google;
- CSP cu hash pentru fiecare script.

**GitHub Pages**, o singură dată:
1. Settings → Pages → Source: **GitHub Actions**.
2. Actions → **Publicare** → Run workflow, ca datele să vină imediat.

Apoi totul merge singur:
- push pe `main` → teste → build → publicare;
- în zilele lucrătoare → date noi → commit → publicare.

**Alternative:** `vercel.json` e pregătit pentru Vercel. Cloudflare Pages și Netlify merg cu comanda `node build.mjs` și folderul `dist`.

## Istoric

Fiecare pas e un commit, așa că `git log` spune povestea proiectului:
- prima versiune (*Ceasul leului*);
- review-ul cu problemele din `FINDINGS.md` și reparațiile lor;
- redenumirea;
- datele automate.

Commit-urile zilnice de date sunt ale lui `github-actions[bot]`.

## Artifact și copia locală

- **Artifact (privat, pe claude.ai):** https://claude.ai/artifact/TjBbJYapbxWkrAHmyup8Cx. Pentru actualizare, îi spui lui Claude **„sync TaxaPeStat”**: rulează testele și publică `app.html` și `data/rates.json` pe același link.
- **Copia din `ClaudeZone\TaxaPeStat`** e o oglindă scrisă de Claude:
  - nu conține `.github/`, pentru că Claude nu are voie să scrie acolo pe calculatorul tău;
  - până există repo-ul pe GitHub, istoricul complet e în `taxa-pe-stat.bundle` (`git clone taxa-pe-stat.bundle`);
  - după aceea, clonează repo-ul.

## Reguli pentru `app.html`

Verificate de `tests/page.test.mjs`:
- fragment: fără `<!doctype>`, `<html>`, `<head>`, `<body>` (formatul artifact-ului);
- fără cereri către alte site-uri; datele vin din `data/rates.json`, de pe același domeniu;
- culorile doar ca tokeni, cu tema light și dark;
- calculele stau în `<script id="calc">`, fără DOM.

## Licență

[MIT](LICENSE)
