# Taxa pe stat

Fostul nume: *Ceasul leului* (redenumit pe 29 octombrie 2026).

Cât pierd economiile în lei din cauza inflației și a deprecierii față de EUR și USD: pe zi, săptămână, lună și an.

- **Pe web (implicit):** https://claude.ai/artifact/TjBbJYapbxWkrAHmyup8Cx
- **Logica și datele:** [`BAZA.md`](BAZA.md)
- **Probleme găsite:** [`FINDINGS.md`](FINDINGS.md)

## Rulare locală

Ai nevoie de Node.js 20 sau mai nou. Nu există dependențe de instalat.

- **Windows:** dublu-click pe `start.cmd`. Pornește serverul și deschide browserul.
- **Din terminal:**

  ```
  npm run dev        # http://localhost:5173, deschide browserul, se reîncarcă la salvare
  npm start          # la fel, fără să deschidă browserul
  ```

- **Alt port:**
  - PowerShell: `$env:PORT=8080; npm start`
  - cmd: `set PORT=8080 && npm start`
- **De pe telefon, din rețeaua de acasă:** `$env:HOST="0.0.0.0"; npm start`. Serverul afișează adresa.

## Teste

```
npm test
```

- Folosesc `node:test`, fără dependențe.
- Stau toate în `tests/`:

  | Fișier | Ce verifică |
  |---|---|
  | `calc.test.mjs` | calculele (funcțiile din `<script id="calc">`) |
  | `page.test.mjs` | regulile artifact-ului, legăturile cod ↔ pagină, temele light/dark |
  | `build.test.mjs` | build-ul pentru cloud |
  | `serve.test.mjs` | serverul local |

- Rulează și în GitHub Actions, la fiecare push și pull request.

Un bug găsit se trece în `FINDINGS.md`, cu un ID nou, și, unde se poate, primește un test.

## Build pentru cloud

```
npm run build      # → dist/index.html + dist/fonts/
```

`app.html` e un fragment (formatul cerut de artifact). `build.mjs` îl învelește într-un document complet:
- `<head>` cu `lang="ro"`, descriere și favicon;
- fonturi locale în loc de Google Fonts;
- CSP cu hash pentru fiecare script.

## Publicare

| Unde | Cum |
|---|---|
| **GitHub Pages** (recomandat) | Push pe `main`. `.github/workflows/pages.yml` rulează testele, build-ul și publică. O singură dată: Settings → Pages → Source: GitHub Actions. |

> **Workflow-urile stau în `github-workflows/`.** Instrumentele lui Claude nu pot scrie în `.github/workflows/` pe calculatorul tău, din motive de siguranță. Înainte de primul push, mută-le acolo:
>
> - PowerShell: `New-Item -ItemType Directory .github\workflows -Force; Move-Item github-workflows\*.yml .github\workflows\`
> - cmd: `mkdir .github\workflows & move github-workflows\*.yml .github\workflows\`
| **Vercel** (opțional, preview pe fiecare PR) | Import repo pe vercel.com; `vercel.json` face restul. |
| **Cloudflare Pages / Netlify** | Comanda de build: `node build.mjs`; folderul: `dist`. |

## Sincronizare cu artifact-ul

- **Local → artifact:** modifici `app.html`, apoi îi spui lui Claude: **„sync TaxaPeStat”**. Claude rulează testele, publică pe același link și actualizează `artifact.json`.
- **Chat → local:** modificările făcute în chat sunt scrise în folder.

## Reguli pentru `app.html`

Verificate de `tests/page.test.mjs`:
- fragment: fără `<!doctype>`, `<html>`, `<head>`, `<body>`;
- fără `fetch` către alte site-uri (în artifact sunt blocate); datele live vin ca fișier `data/rates.json`, de pe același domeniu;
- culorile doar ca tokeni, cu tema light și dark;
- calculele stau în `<script id="calc">`, fără DOM, ca să poată fi testate.
