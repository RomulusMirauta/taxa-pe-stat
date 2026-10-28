# Ceasul leului — baza proiectului

Documentul de referință pentru aplicație: de ce există, pe ce date se bazează, ce calculează și cum. Dacă schimbi logica din `app.html`, actualizează și secțiunea „Logica de calcul”.

Data documentului: 28 octombrie 2026.

---

## 1. Ce face aplicația

Calculează și afișează pierderea **zilnică, săptămânală, lunară și anuală** a unei sume ținute în lei, din trei cauze:

1. **Inflația**: pierderea puterii de cumpărare în lei.
2. **Deprecierea leului față de euro**: aceeași sumă cumpără tot mai puțini euro.
3. **Deprecierea leului față de dolar**: aceeași sumă cumpără tot mai puțini dolari.

Opțional, calculul ține cont de **dobânda netă** (după impozit) și de **comisioanele bancare**.

Pe lângă tabel, aplicația mai are:
- un **contor live** cu lei pierduți din cauza inflației de când ai deschis pagina;
- o secțiune **„Ce s-a întâmplat deja”**, cu pierderea realizată în EUR/USD între cele două date de curs;
- **dobânda brută minimă** de care ai nevoie ca să ții pasul cu inflația;
- un **grafic pe 10 ani** cu puterea de cumpărare, fără dobândă și cu dobânda netă.

---

## 2. Datele de pornire (valorile implicite din aplicație)

### Inflația (INS, comunicatul din 13 oct. 2026)

| Indicator | Valoare |
|---|---|
| Rata anuală IPC, sept. 2026 vs. sept. 2025 | **6,61%** (august: 6,17%) |
| Rata medie pe 12 luni (oct. 2025 – sept. 2026) | **9,2%** |
| De la începutul anului (sept. 2026 vs. dec. 2025) | 5,4% |
| Lunar (sept. vs. aug. 2026) | 0,77% |
| IAPC (armonizat UE), sept. 2026 | 6,5% |
| Prognoza BNR pentru finalul lui 2026 | 6,1% |

Pe categorii (sept. 2026 vs. sept. 2025):

| Categorie | Creștere |
|---|---|
| Servicii | **11,12%** |
| Mărfuri nealimentare | 7,06% |
| Alimente | 3% |

Concluzie: „inflația ta” depinde de ce cumperi. Cine cheltuie mult pe servicii (chirie, utilități, reparații, abonamente) poate simți mult peste 6,61%.

### Cursul BNR

| Data | EUR | USD |
|---|---|---|
| 5 ian. 2026 (afișat 06 ian.) | 5,0905 | 4,3557 |
| 21 oct. 2026 | 5,3297 | 4,7489 |
| Maxim istoric EUR, 6 oct. 2026 | 5,3527 | — |

Între cele două date (289 de zile):

| Monedă | Leu pierdut în perioadă | Ritm anualizat |
|---|---|---|
| EUR | −4,49% | ~5,63% pe an |
| USD | −8,28% | ~10,34% pe an |

### Dobânzi și impozite (orientative, 2026)

| Produs | Dobândă | Impozit |
|---|---|---|
| Cont curent | ~0% | — |
| Depozit în lei, 12 luni | ~5,25% (variază de la bancă la bancă, ~4,4–6,3%) | 10% reținut la sursă |
| Tezaur / Fidelis | ~7% (până la ~7,5%) | 0%, neimpozabile |

- **CASS 10%** se adaugă dacă veniturile din dobânzi (plus alte venituri din investiții) depășesc 6 salarii minime brute pe an.
- Nerezidenții fără convenție de evitare a dublei impuneri plătesc 16%.

---

## 3. Ce altceva determină „pierderea” banilor în lei

| Cauză | Cum te afectează |
|---|---|
| **Inflația** | Prețurile cresc, aceiași lei cumpără mai puțin. Cauza principală. |
| **Deprecierea față de EUR/USD** | Contează doar dacă ai cheltuieli legate de valută: vacanțe, rate în euro, produse importate, electronice. |
| **Impozitul pe dobândă** | 10% din dobândă se reține automat, plus CASS 10% peste prag. Reduce dobânda care ar trebui să compenseze inflația. |
| **Costul de oportunitate** | Banii ținuți în contul curent la 0% pierd toată inflația. E cea mai mare „pierdere” pe care o poți controla. |
| **Comisioanele bancare** | Administrare cont, card, retrageri, transferuri. |
| **Spread-ul la schimb valutar** | Banca vinde euro peste cursul BNR, de obicei cu 1–3%. Se plătește la fiecare conversie. |
| **Salariul care nu ține pasul** | Dacă venitul crește mai încet decât inflația, pierzi și pe fluxul de bani, nu doar pe economii. |
| **Taxele indirecte (TVA, accize)** | Intră în inflație, dar explică de ce prețurile cresc în salturi la schimbarea lor. |

---

## 4. Există deja o aplicație free, open-source?

Doar parțial. Niciuna nu combină inflația INS, cursul BNR și dobânda netă pentru România.

| Proiect | Ce face | Limită |
|---|---|---|
| [Inflation Calculator (Android, MIT)](https://alternativeto.net/software/inflation-calculator/about) | Puterea de cumpărare între doi ani | Doar SUA, Marea Britanie, Franța |
| [finkit (CLI, Go)](https://github.com/David-DAM/finkit) | Pierderea puterii de cumpărare la o rată dată, conversie valutară | Fără date românești, fără depreciere |
| [inflatie-calculator (NL)](https://github.com/NickHuijgen/inflatie-calculator) | Inflație cu date oficiale (CBS) | Doar Olanda |

---

## 5. Logica de calcul

### Notații

| Simbol | Ce este | Câmp în aplicație |
|---|---|---|
| `S` | suma în lei | `sum` |
| `π` | inflația anuală (fracție, ex. 0,0661) | `infl` |
| `r` | dobânda brută anuală | `rate` |
| `τ` | impozitul pe dobândă | `tax` |
| `i = r·(1−τ)` | dobânda netă anuală | — |
| `F` | comisioane, lei pe an | `fees` |
| `c₀`, `c₁` | cursul (lei pentru 1 EUR/USD) la data de referință, respectiv acum | `eur0/eur1`, `usd0/usd1` |
| `D` | zile între cele două date | `d0`, `d1` |
| `n` | zilele perioadei: 1, 7, 365/12, 365 | — |
| `y = n/365` | perioada în ani | — |

**Mod de calcul**
- **Fără dobândă**: `g = 1`, iar comisioanele sunt ignorate.
- **După dobânda netă**: `g = 1 + i`, iar comisioanele se scad proporțional, `F·y`.

Toate creșterile sunt **compuse**, nu liniare.

### 5.1 Pierderea din inflație (în lei de azi)

```
pierdere_inflație(n) = S · (1 − (g / (1+π))^y) + F·y
```

Valoare negativă înseamnă câștig real, adică dobânda bate inflația. În aplicație apare verde, cu „+”.

### 5.2 Pierderea față de EUR / USD (în valuta respectivă)

```
k = c₀ / c₁                      // cât din valoarea în valută a rămas
d = 1 − k^(365/D)                // ritmul anual de depreciere, extrapolat
factor(n) = (1−d)^y · g^y
pierdere_valută(n) = (S · (1 − factor(n)) + F·y) / c₁
```

Presupunere: deprecierea continuă în ritmul observat între `c₀` și `c₁`.

### 5.3 „Ce s-a întâmplat deja” (pierderea realizată)

```
valoare_atunci = S / c₀
valoare_acum   = S / c₁
pierdere       = valoare_atunci − valoare_acum      // în EUR sau USD
procent        = 1 − c₀/c₁
```

Putere de cumpărare pierdută într-un an, fără dobândă:

```
S · (1 − 1/(1+π))
```

### 5.4 Dobânda brută minimă ca să ții pasul cu inflația

```
r_minim = π / (1 − τ)
```

Aproximare: compară ratele direct, nu exact `(1+i) = (1+π)`.

### 5.5 Contorul live

Rată continuă, ca să crească lin:

```
pierdere_pe_secundă = S · ln(1+π) / 31.536.000      // secunde într-un an
```

Se actualizează la 100 ms. Ia în calcul doar inflația, fără dobândă.

### 5.6 Graficul pe 10 ani (în lei de azi)

```
fără_dobândă(t) = S / (1+π)^t
cu_dobândă(t)   = max(0, S · ((1+i)/(1+π))^t − F·t)
```

Presupune inflație constantă `π` pe toată perioada.

### 5.7 De ce pierderile pe cauze NU se adună

Inflația din România include deja o parte din efectul cursului: produsele importate se scumpesc când leul scade. Dacă aduni inflația cu deprecierea, aceeași pierdere e numărată de două ori. De aceea aplicația afișează rânduri separate și nu are total.

---

## 6. Exemplu calculat (valorile implicite, `S` = 50.000 lei, `π` = 6,61%)

**Fără dobândă (cont curent):**

| Perioadă | Pierdere din inflație |
|---|---|
| Zi | ~8,77 lei |
| Săptămână | ~61,34 lei |
| Lună | ~265,99 lei |
| An | ~3.100,08 lei |

**Cu depozit la 5,25% brut (4,725% net):**

| Perioadă | Pierdere reală |
|---|---|
| Zi | ~2,44 lei |
| Săptămână | ~17,10 lei |
| Lună | ~74,28 lei |
| An | ~884,06 lei |

**Deja realizat față de valută, 5 ian. → 21 oct. 2026:**
- EUR: 9.822,22 € → 9.381,39 €, adică **−440,83 €**
- USD: 11.479,21 $ → 10.528,75 $, adică **−950,46 $**

**Peste 10 ani, în lei de azi:**
- fără dobândă, 50.000 lei cumpără cât ~26.363 lei azi;
- cu depozitul de mai sus, cât ~41.831 lei azi.

**Dobânda brută minimă** la impozit 10%: ~7,34%.

---

## 7. Concluzii (opinia de pornire)

- Cifra care contează cu adevărat e **pierderea reală**: inflația minus dobânda netă. Asta arată rândul „Inflație” în modul „După dobânda netă”.
- Pierderea față de EUR/USD e relevantă doar pentru cheltuieli în valută.
- Pierderea „pe zi” e mai mult un motivator decât o cifră de decizie. La 50.000 lei în cont curent, înseamnă cam 9 lei pe zi.
- La datele actuale, un depozit obișnuit nu bate inflația. Titlurile de stat neimpozabile sunt aproape de pragul de echilibru.
- Nu este consultanță financiară.

---

## 8. Limitele aplicației

- **Datele se introduc manual.** În artifact, cererile către alte site-uri (BNR, INS) sunt blocate.
- Inflația și deprecierea sunt **presupuse constante** pe perioada proiecției.
- Deprecierea e extrapolată dintr-un singur interval, deci e sensibilă la datele alese.
- Nu modelează CASS, spread-ul valutar sau inflația personală pe categorii de cheltuieli.

---

## 9. Structura proiectului și fluxul de lucru

**Locație:** `C:\Users\R\Desktop\ClaudeZone\CeasulLeului`

**Artifact:** https://claude.ai/artifact/TjBbJYapbxWkrAHmyup8Cx

| Fișier | Rol |
|---|---|
| `app.html` | Sursa unică. Rulează local și e publicat ca artifact. E un fragment, fără `<!doctype>`, `<html>`, `<head>` sau `<body>`. |
| `serve.mjs` | Server local Node, fără dependențe, pe portul 5173. Adaugă același schelet ca artifact-ul și reîncarcă pagina la salvare. |
| `start.cmd` | Dublu-click pe Windows: pornește serverul și deschide browserul. |
| `artifact.json` | Linkul artifact-ului și ultima versiune publicată. |
| `README.md` | Cum rulezi aplicația și regulile pentru `app.html`. |
| `BAZA.md` | Acest document. |

**Reguli pentru `app.html`** (impuse de artifact):
- scripturi externe doar de pe cdnjs, jsDelivr sau unpkg; fonturi doar de pe Google Fonts;
- fără `fetch` către alte site-uri;
- tot CSS-ul și JS-ul stau în același fișier;
- culori definite ca tokenuri, cu temă light și dark.

**Sync:**
- **Local → web:** modifici `app.html`, apoi îi spui lui Claude „sync CeasulLeului”. Claude publică fișierul peste același link și actualizează `artifact.json`.
- **Web → local:** modificările făcute în chat sunt scrise înapoi în `app.html`.

---

## 10. Idei / pași următori (deschise)

- [ ] Git în folder, pentru istoricul modificărilor; eventual publicat pe GitHub, open-source.
- [ ] Doar local: preluare automată a cursului din fluxul XML zilnic al BNR și a indicilor INS.
- [ ] Acces de pe telefon în rețeaua de acasă (server pe `0.0.0.0`).
- [ ] Inflație personală, pe categorii (servicii / nealimentare / alimente) cu ponderi alese de utilizator.
- [ ] Spread-ul valutar și CASS în calcul.
- [ ] Versiune găzduită pe GitHub Pages.

---

## Surse

- [Rata inflației în România: 6,6% în septembrie 2026](https://www.curs-valutar-bnr.ro/articole/rata-inflatiei-romania)
- [Forbes România: inflația pe categorii, sept. 2026](https://www.forbes.ro/?p=526539)
- [Forbes România: media pe 12 luni](https://www.forbes.ro/?p=525774)
- [Prognoza BNR, 6,1% la final de 2026](https://www.stiripesurse.ro/annual-inflation-rate-reaches-661-in-september_3927938)
- [Curs BNR 21.10.2026](https://cursbnr.nxm.ro/data/21-10-2026)
- [Curs BNR 06.01.2026](https://cursbnr.nxm.ro/data/06-01-2026)
- [Maxim istoric EUR, 6 oct. 2026](https://cursbnr.nxm.ro/convertor/usd-ron-8000)
- [Impozit depozit bancar 2026 (Financer)](https://financer.ro/investitii/impozit-depozit-bancar/)
- [Calculator depozit și dobânzi 2026 (Folositor)](https://folositor.ro/calculator-depozit)
- [Inflation Calculator (AlternativeTo)](https://alternativeto.net/software/inflation-calculator/about)
- [finkit (GitHub)](https://github.com/David-DAM/finkit)
- [inflatie-calculator (GitHub)](https://github.com/NickHuijgen/inflatie-calculator)
