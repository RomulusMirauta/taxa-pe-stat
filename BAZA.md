# Taxa pe stat: baza proiectului

Fostul nume: *Ceasul leului* (redenumit pe 29 octombrie 2026).

Documentul de referință: de ce există aplicația, pe ce date se bazează, ce calculează și cum. Problemele găsite sunt în [`FINDINGS.md`](FINDINGS.md).

**Regulă:** dacă schimbi logica din `app.html`, actualizează §5 și testele din `tests/calc.test.mjs`.

Actualizat: 29 octombrie 2026 (versiunea 0.2, după primul review).

---

## 1. Ce face aplicația

Calculează pierderea **zilnică, săptămânală, lunară și anuală** a unei sume ținute în lei, din trei cauze:

1. **Inflația:** pierderea puterii de cumpărare în lei.
2. **Deprecierea față de euro:** aceeași sumă valorează tot mai puțini euro.
3. **Deprecierea față de dolar:** la fel, în dolari.

Opțional, calculul ține cont de **dobânda netă** (după impozit) și de **comisioanele bancare**.

Pe lângă tabel, pagina mai are:
- un rând cu **data fiecărei surse**, cu avertisment când datele sunt vechi;
- un **contor live** cu efectul inflației de când ai deschis pagina; urmează modul de calcul, deci arată și câștigul când dobânda bate inflația;
- secțiunea **„Pe scurt”**: pierderea deja realizată în EUR și USD, pierderea pe un an, câți lei în plus îți trebuie la anul și dobânda minimă pentru echilibru;
- un **grafic pe 10 ani**, fără dobândă și cu dobânda netă.

Câmpurile acceptă numere scrise ca în română („6,61”, „50.000”) sau ca în engleză. Câmpurile greșite sunt marcate și explicate.

---

## 2. Datele de pornire (valorile implicite)

### Inflația

INS, comunicatul din 13 oct. 2026:

| Indicator | Valoare |
|---|---|
| **Rata anuală IPC, sept. 2026 vs. sept. 2025** | **6,61%** (implicit în aplicație) |
| Rata medie pe 12 luni (oct. 2025 – sept. 2026 vs. cele 12 dinainte) | 9,2% |
| De la începutul anului (sept. 2026 vs. dec. 2025) | 5,4% |
| Lunar (sept. vs. aug. 2026) | 0,77% |
| IAPC (armonizat UE), sept. 2026 | 6,5% |

Pe categorii, sept. 2026 vs. sept. 2025:

| Categorie | Creștere |
|---|---|
| Servicii | **11,12%** |
| Mărfuri nealimentare | 7,06% |
| Alimente | 3% |

Traiectoria ratei anuale în 2026:

| Iunie | Iulie | August | Septembrie |
|---|---|---|---|
| 10,4% | 8,2% | 6,2% | 6,6% |

Scăderea din vară e **efect de bază**: scumpirile din iulie–august 2025 (TVA mărit, eliminarea plafonării la energie) au ieșit din fereastra de 12 luni. Prețurile continuă să crească, dar mai încet decât acum un an.

**Prognoza BNR** (raportul din august 2026): 6,1% la final de 2026 și 3,4% la final de 2027.

**Zona euro** (Eurostat): 3,8% în septembrie 2026, de la 3,2% în august, împinsă de energie și servicii.

**Ce înseamnă pentru aplicație:**
- rata implicită e cea anuală, 6,61%;
- 9,2% e o medie care privește înapoi și nu e folosită ca rată pentru viitor (FINDINGS F-19);
- butoanele de scenariu sunt: ultimele 12 luni (6,61%), doar servicii (11,12%) și prognoza BNR (3,4%).

### Cursul BNR

Date de publicare, ca în XML-ul BNR:

| Data | EUR | USD |
|---|---|---|
| 28 oct. 2025 | 5,0844 | 4,3591 |
| 28 oct. 2026 | 5,3495 | 4,8088 |
| Maxim istoric EUR, 6 oct. 2026 | 5,3527 | — |

În ultimele 12 luni (365 de zile):

| Monedă | Leul a pierdut |
|---|---|
| EUR | **4,96%** |
| USD | **9,35%** |

Dolarul s-a întărit și față de euro: EUR/USD a coborât de la 1,1664 la 1,1124.

Implicit, aplicația folosește **același interval de 12 luni ca inflația anuală**. Sub 180 de zile apare un avertisment, pentru că extrapolarea la un an exagerează (FINDINGS F-05).

### Dobânzi și impozite (orientative, 2026)

| Produs | Dobândă | Impozit |
|---|---|---|
| Cont curent | ~0% | — |
| Depozit în lei, 12 luni, bănci mari (BT, BCR, BRD, Raiffeisen, CEC) | 5,2–5,5% (iulie 2026) | 10%, reținut la sursă |
| Depozit în lei, 12 luni, cele mai bune oferte | până la ~7% | 10% |
| Tezaur, octombrie 2026 | 1 an 6,5% · 3 ani 7% · 5 ani 7,5% | 0% (neimpozabil) |
| Fidelis, octombrie 2026 | 2 ani 6,6% · 4 ani 7,15% · 10 ani 7,75% | 0% (neimpozabil) |

Alte reguli fiscale:
- Impozitul pe dobânzi a rămas 10% în 2026; dividendele au trecut la 16%.
- **CASS 10%** se poate adăuga dacă veniturile din investiții depășesc 6 salarii minime brute pe an. Aplicația nu îl calculează (FINDINGS O-01).

---

## 3. Ce determină „pierderea” banilor în lei

| Cauză | Cum te afectează |
|---|---|
| **Inflația** | Aceiași lei cumpără mai puțin. Cauza principală. |
| **Deprecierea față de EUR/USD** | Contează doar pentru cheltuieli legate de valută: vacanțe, rate în euro, produse importate, electronice. |
| **Impozitul pe dobândă** | 10% din dobândă, plus CASS peste prag. Reduce exact partea care ar trebui să compenseze inflația. |
| **Costul de oportunitate** | Banii din contul curent pierd toată inflația. E pierderea pe care o controlezi cel mai ușor. |
| **Comisioanele bancare** | Administrare cont, card, retrageri. |
| **Spread-ul la schimb valutar** | Banca vinde euro peste cursul BNR, de obicei cu 1–3%, la fiecare conversie. |
| **Salariul care nu ține pasul** | Dacă venitul crește mai încet decât prețurile, pierzi și pe fluxul de bani. |
| **Taxele indirecte (TVA, accize)** | Intră în inflație; explică saltul din vara lui 2025. |

**Și euro pierde din valoare:** inflația din zona euro a fost 3,8% în septembrie 2026. Rândul „Față de EUR” arată cât valorează leii tăi în euro, nu cât ai fi economisit ținând euro (FINDINGS F-23).

---

## 4. Aplicații existente

Niciuna nu combină inflația INS, cursul BNR și dobânda netă pentru România.

| Proiect | Ce face | Limită |
|---|---|---|
| [Inflation Calculator (Android, MIT)](https://alternativeto.net/software/inflation-calculator/about) | Puterea de cumpărare între doi ani | Doar SUA, Marea Britanie, Franța |
| [finkit (CLI, Go)](https://github.com/David-DAM/finkit) | Pierderea la o rată dată; conversie valutară | Fără date românești, fără depreciere |
| [inflatie-calculator (NL)](https://github.com/NickHuijgen/inflatie-calculator) | Inflație cu date oficiale (CBS) | Doar Olanda |

---

## 5. Logica de calcul

Funcțiile pure sunt în `app.html`, în blocul `<script id="calc">`, și sunt testate în `tests/calc.test.mjs`.

### Notații

| Simbol | Ce este | Câmp |
|---|---|---|
| `S` | suma în lei | `sum` |
| `π` | inflația anuală (fracție, ex. 0,0661) | `infl` |
| `r` | dobânda brută anuală | `rate` |
| `τ` | impozitul pe dobândă | `tax` |
| `i = r·(1−τ)` | dobânda netă anuală | — |
| `F` | comisioane, lei pe an | `fees` |
| `c₀`, `c₁` | cursul (lei pentru 1 EUR/USD) la data de referință și acum | `eur0/eur1`, `usd0/usd1` |
| `D` | zile între cele două date | `d0`, `d1` |
| `n` | zilele perioadei: 1, 7, 365/12, 365 | — |
| `y = n/365` | perioada în ani | — |

**Modurile de calcul:**
- **fără dobândă:** `g = 1`, comisioanele sunt ignorate;
- **cu dobânda netă:** `g = 1 + i`, comisioanele se plătesc pe parcurs.

Creșterile sunt **compuse**.

### 5.1 Modelul (unul singur, folosit peste tot)

```
sold_nominal(y) = S · g^y − F·y                  // lei nominali după y ani
valoare_reală(y) = max(0, sold_nominal(y)) / (1+π)^y    // în lei de azi
```

### 5.2 Pierderea din inflație (lei de azi)

```
pierdere(n) = S − sold_nominal(y) / (1+π)^y
```

Fără comisioane, formula se reduce la `S · (1 − (g/(1+π))^y)`.

Valoare negativă înseamnă câștig real: dobânda bate inflația. Pagina o arată cu verde și „+”.

### 5.3 Pierderea față de EUR / USD (în valută)

```
k = c₀ / c₁                         // cât din valoarea în valută a rămas
d = 1 − k^(365/D)                   // ritmul anual; la D = 365, d = 1 − k exact
pierdere_valută(n) = (S − sold_nominal(y) · (1−d)^y) / c₁
```

Presupunere: leul continuă în ritmul din intervalul ales.

Validări:
- fără interval valid (`D ≤ 0`, date lipsă) nu se calculează nimic;
- sub 180 de zile apare un avertisment.

### 5.4 Pe scurt (realizat, nu proiectat)

```
valoare_atunci = S / c₀ ;  valoare_acum = S / c₁ ;  diferență = valoare_acum − valoare_atunci
pierdere_un_an = S · (1 − 1/(1+π))        // putere de cumpărare, lei de azi
lei_în_plus    = S · π                    // câți lei în plus îți trebuie la anul pentru același coș
```

La 50.000 lei: **3.100 lei** pierduți în lei de azi și **3.305 lei** în plus necesari la anul. Sunt două fețe ale aceleiași inflații (FINDINGS F-22).

### 5.5 Dobânda brută minimă (exactă)

Valoarea reală rămâne neschimbată după un an:

```
(S·(1+i) − F) / (1+π) = S   ⟺   i = π + F/S   ⟺   r_minim = (π + F/S) / (1 − τ)
```

Fără comisioane: `r_minim = π / (1 − τ)`.

Formula e exactă, nu aproximativă; versiunea anterioară a acestui document greșea aici (FINDINGS F-18). La impozit 100% nu există răspuns.

### 5.6 Contorul live

Ritmul instantaneu al pierderii reale:

```
lei_pe_an = S · (ln(1+π) − ln g) + F       // fără dobândă: S · ln(1+π)
lei_pe_secundă = lei_pe_an / (365 · 86.400)
```

Contorul adună la fiecare pas (100 ms, sau 1 s cu „reduced motion”) cu ritmul din acel moment. Dacă schimbi suma, trecutul nu se recalculează (FINDINGS F-06).

### 5.7 Graficul pe 10 ani

Valoarea reală pentru `t = 0…10` ani, pentru două cazuri:
- fără dobândă;
- cu dobânda netă și comisioanele din formular.

Axa folosește un pas „rotund” (1, 2, 2,5, 5 × 10ⁿ). Presupune inflație constantă.

### 5.8 De ce pierderile pe cauze NU se adună

Inflația din România include deja o parte din efectul cursului: produsele importate se scumpesc când leul scade. Dacă aduni inflația cu deprecierea, numeri de două ori. De aceea pagina are rânduri separate și niciun total.

### 5.9 Citirea numerelor

| Scris | Citit ca | Observație |
|---|---|---|
| „6,61” / „6.61” / „6,61%” | 6,61 | |
| „1.234,56” / „1,234.56” | 1234,56 | |
| „50.000” / „50,000” / „50 000” | 50000 | la sume și comisioane |
| „50.000” | 50 | la rate, punctul e zecimal |
| „abc”, „”, „12.34.56” | invalid | câmpul e marcat; nu devine 0 |

---

## 6. Exemplu calculat

Valori implicite: `S` = 50.000 lei, `π` = 6,61%, curs pe 12 luni.

**Pierderea reală pe perioade:**

| Unde stau banii | Zi | Săptămână | Lună | An |
|---|---|---|---|---|
| Cont curent (0%) | −8,77 | −61,34 | −265,99 | −3.100,08 lei |
| Depozit 5,5% brut (4,95% net) | −2,15 | −15,05 | −65,35 | −778,54 lei |
| Tezaur 1 an, 6,5% neimpozabil | −0,14 | −0,99 | −4,30 | −51,59 lei |
| Fidelis 4 ani, 7,15% neimpozabil | +0,69 | +4,85 | +21,06 | +253,26 lei |

**Față de valută, deja realizat (28 oct. 2025 → 28 oct. 2026):**
- EUR: 9.834,00 € → 9.346,67 €, adică **−487,33 €**
- USD: 11.470,26 $ → 10.397,60 $, adică **−1.072,65 $**

**Față de valută, proiectat pe un an (dacă ritmul continuă):**

| | EUR | USD |
|---|---|---|
| Cont curent | −463,18 € | −972,34 $ |
| Depozit 5,5% | −23,45 € | −505,79 $ |

**Peste 10 ani, în lei de azi:**
- fără dobândă: 26.363 lei;
- depozit 5,5%: 42.738 lei.

**Altele:**
- dobânda brută minimă, cu impozit 10%: **7,34%**; fără impozit: 6,61%;
- lei în plus necesari la anul: 3.305 lei.

Toate valorile sunt verificate de `tests/calc.test.mjs`.

---

## 7. Concluzii

Fapte, nu sfaturi de investiții:

- Cifra care contează e **pierderea reală**, adică inflația minus dobânda netă. Asta arată rândul „Inflație” în modul „Cu dobânda netă”.
- La 6,61%:
  - contul curent pierde ~3.100 lei pe an la 50.000 lei;
  - un depozit tipic de la o bancă mare (5,5% brut) încă pierde ~780 lei pe an;
  - Tezaur pe 1 an e aproape de echilibru;
  - dobânzile neimpozabile peste 6,61% (Fidelis 4 ani, Tezaur 3–5 ani) sunt peste inflația de acum.
- Pierderea față de EUR/USD contează doar pentru cheltuieli în valută. Euro are și el inflație (3,8%).
- **Premisa „inflația e în continuă creștere” trebuie nuanțată.** Prețurile cresc continuu, dar rata anuală a scăzut puternic în vară (efect de bază) și a urcat ușor în septembrie. Pentru viitor, aplicația oferă scenarii, nu o singură cifră.
- Pierderea pe zi e un motivator bun (~9 lei pe zi la 50.000 lei în cont curent), dar deciziile se iau pe cifrele anuale.

Nu este consultanță financiară.

---

## 8. Limitele aplicației

- **Datele se introduc manual sau vin cu aplicația.** Actualizarea automată e pasul următor (§11).
- Inflația și ritmul leului sunt presupuse **constante** în proiecții.
- Nu modelează:
  - CASS;
  - spread-ul valutar;
  - inflația personală pe categorii;
  - comparația completă lei vs. euro.

  Detalii: FINDINGS O-01…O-04.
- Ritmul cursului vine dintr-un singur interval, deci depinde de datele alese.

---

## 9. Structura proiectului

**Locație:** `C:\Users\R\Desktop\ClaudeZone\TaxaPeStat`
**Artifact:** https://claude.ai/artifact/TjBbJYapbxWkrAHmyup8Cx

| Fișier / folder | Rol |
|---|---|
| `app.html` | **Sursa unică.** Fragment HTML: publicat ca artifact și învelit de `build.mjs` pentru cloud. |
| `build.mjs` | Produce `dist/index.html` complet, cu fonturi locale, CSP și `<head>`. |
| `serve.mjs` | Server local, fără dependențe; aceeași pagină ca în cloud, cu reîncărcare automată. |
| `start.cmd` | Dublu-click pe Windows: pornește serverul și deschide browserul. |
| `fonts/` | Fonturile, găzduite local (OFL). Folosite local și în cloud; artifact-ul folosește Google Fonts. |
| `tests/` | Testele (`node:test`). Toate testele proiectului stau aici. |
| `github-workflows/` | `ci.yml` (teste + build la fiecare push/PR), `pages.yml` (publicare pe GitHub Pages). Se mută în `.github/workflows/` înainte de primul push (vezi README). |
| `vercel.json` | Configurare pentru Vercel, dacă îl folosim. |
| `package.json` | Comenzi: `npm run dev`, `npm test`, `npm run build`. Fără dependențe. |
| `FINDINGS.md` | Registrul de probleme. Bug-urile găsite se trec aici. |
| `BAZA.md` | Acest document. |
| `README.md` | Cum rulezi, testezi, publici. |
| `artifact.json` | Linkul artifact-ului și ultima versiune publicată. |

**Artifact vs. cloud:** același `app.html`, deci aceleași calcule. Diferă doar ambalajul:

| | Artifact | Cloud / local |
|---|---|---|
| Fonturi | Google Fonts (singura sursă permisă acolo) | `fonts/`, găzduite local |
| `<head>`, CSP | ale platformei | din `build.mjs` |
| Date live | nu (cererile externe sunt blocate) | `data/rates.json` de pe același domeniu (pasul următor) |

**Reguli pentru `app.html`** (impuse de artifact și verificate de `tests/page.test.mjs`):
- fragment, fără `<!doctype>`, `<html>`, `<head>` sau `<body>`;
- scripturi externe doar de pe cdnjs, jsDelivr sau unpkg; fonturi doar de pe Google Fonts, cu `data-fonts`;
- fără `fetch` către alte site-uri;
- culorile doar ca tokeni (între `tokens:start` și `tokens:end`), cu ambele teme;
- câmpurile numerice sunt text (`inputmode="decimal"`), de cel puțin 16 px.

**Sincronizare:**

| Direcție | Cum |
|---|---|
| Local → artifact | Modifici `app.html`, apoi îi spui lui Claude „sync TaxaPeStat”. Claude rulează testele, publică pe același link și actualizează `artifact.json`. |
| Chat → local | Modificările făcute în chat sunt scrise în folder. |
| Local → cloud | Push pe GitHub. Actions rulează testele, apoi build-ul, apoi publică. |

---

## 10. Hosting: propunerea

**Recomandare: GitHub Pages pentru producție, cu GitHub Actions.**

De ce:
- e gratuit și fără cont nou;
- se potrivește cu planul open-source;
- aplicația e statică, deci nu are nevoie de server;
- Actions rulează deja testele și va descărca datele zilnic (§11);
- datele ajung ca fișier (`data/rates.json`), același pentru local, cloud și artifact.

Pași, o singură dată:
1. Creezi repo-ul pe GitHub și faci push.
2. În repo: Settings → Pages → Source: **GitHub Actions**.
3. Adresa va fi `https://<utilizator>.github.io/taxa-pe-stat/`. Căile relative din build funcționează sub acest prefix.

**Vercel: pregătit, opțional.**
- `vercel.json` e gata. Import repo pe vercel.com și restul se configurează singur.
- Avantajul real: un **link de preview pentru fiecare pull request**, util pentru testare.
- Planul gratuit (Hobby) e doar pentru uz necomercial.

**Alternative:** Cloudflare Pages și Netlify merg cu aceeași comandă (`node build.mjs`, folder `dist`).

**De ce nu un API pe server (serverless):** artifact-ul nu poate citi alte site-uri, iar un API ar servi doar varianta din cloud. Un fișier de date merge peste tot.

---

## 11. Pași următori

- [ ] Repo pe GitHub + alegerea licenței (O-07). Apoi GitHub Pages.
- [ ] `scripts/update-data.mjs`: descarcă XML-ul zilnic de la BNR (și inflația INS / Eurostat) și scrie `data/rates.json`.
- [ ] Workflow programat, zilnic după ora 13 (ora României), care rulează scriptul și face commit dacă datele s-au schimbat (O-08, O-09).
- [ ] `app.html` citește `data/rates.json` dacă există; altfel folosește valorile din pagină.
- [ ] Sync artifact: publicăm și `data/rates.json` lângă pagină.
- [ ] Opțional: CASS, spread valutar, inflație personală, comparația lei vs. euro (O-01…O-04).

---

## Surse

- [INS: rata inflației, septembrie 2026 (curs-valutar-bnr.ro)](https://www.curs-valutar-bnr.ro/articole/rata-inflatiei-romania)
- [Forbes România: inflația pe categorii](https://www.forbes.ro/?p=526539) · [media pe 12 luni](https://www.forbes.ro/?p=525774)
- [Trading Economics: traiectoria ratei anuale în 2026](https://tradingeconomics.com/romania/inflation-cpi/news/591392)
- [Prognoza BNR: 6,1% (2026), 3,4% (2027)](https://www.stiripesurse.ro/annual-inflation-rate-reaches-661-in-september_3927938)
- [Eurostat, prin Eunews: zona euro 3,8% în septembrie 2026](https://www.eunews.it/en/2026/10/16/euro-area-and-eu-september-inflation-confirmed-up-at-3-8-per-cent/)
- [Curs BNR 28.10.2026](https://cursbnr.nxm.ro/data/28-10-2026) · [28.10.2025](https://cursbnr.nxm.ro/data/28-10-2025) · [Bugetul.ro, 28 oct. 2025](https://www.bugetul.ro/curs-bnr-marti-28-octombrie-2025-ce-se-intampla-cu-moneda-unica-europeana-dupa-doua-zile-consecutive-in-care-s-a-apreciat-in-raport-cu-leul-romanesc/)
- [Maxim istoric EUR, 6 oct. 2026](https://cursbnr.nxm.ro/convertor/usd-ron-8000)
- [Depozite bancare, iulie 2026 (Wall-Street.ro)](https://www.wall-street.ro/articol/credite-si-depozite-bancare/depozite-bancare-iulie-2026.html)
- [Tezaur, octombrie 2026 (Financiarul)](https://financiarul.ro/finante-personale/tezaur-ofera-dobanzi-intre-6-5-si-7-5-in-octombrie-2026-cum-difera/) · [Fidelis, octombrie 2026 (StartupCafe)](https://startupcafe.ro/titluri-de-stat-fidelis-s-a-anuntat-editia-din-octombrie-2026-ce-dobanzi-sunt-la-lei-si-euro-107768)
- [Impozitul pe dobânzi rămâne 10% (Wall-Street.ro)](https://www.wall-street.ro/articol/credite-si-depozite-bancare/cresterea-impozitului-s-ar-putea-sa-nu-se-opreasca-la-dividende.html) · [Ghid impozit depozit 2026 (Financer)](https://financer.ro/investitii/impozit-depozit-bancar/)
- [Inflation Calculator](https://alternativeto.net/software/inflation-calculator/about) · [finkit](https://github.com/David-DAM/finkit) · [inflatie-calculator](https://github.com/NickHuijgen/inflatie-calculator)
