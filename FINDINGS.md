# FINDINGS: Taxa pe stat (fost Ceasul leului)

Registrul de probleme găsite în aplicație. Fiecare intrare are un ID stabil; ID-urile nu se refolosesc.

**Review 1:** 29 octombrie 2026, versiunea 0.1 (artifact v1) → reparat în 0.2 (artifact v2).

**Severitate:**
- **Major:** rezultat greșit, pagină inutilizabilă sau risc la publicare.
- **Minor:** rezultat derutant sau caz-limită.
- **Cosmetic:** aspect.
- **Info:** de știut; nu e bug.

**Status:**
- **Reparat:** fix aplicat și, unde se poate, acoperit de test.
- **Deschis:** de făcut.
- **Acceptat:** limită asumată.

---

## Rezumat

| ID | Sev. | Problema | Status | Test |
|---|---|---|---|---|
| F-01 | Major | Contorul ilizibil în tema dark | Reparat | `page.test` |
| F-02 | Major | Virgula zecimală („6,61”) devenea 0, fără mesaj | Reparat | `calc.test`, `page.test` |
| F-03 | Major | O dată lipsă umplea pagina de „NaN” | Reparat | `calc.test` |
| F-04 | Major | Data curentă înaintea celei de referință dădea un ritm absurd | Reparat | `calc.test` |
| F-05 | Major | Intervalele scurte de curs, extrapolate exagerat | Reparat | `calc.test` |
| F-06 | Minor | Contorul rescria trecutul la schimbarea sumei | Reparat | — |
| F-07 | Minor | Contorul ignora dobânda | Reparat | `calc.test` |
| F-08 | Cosmetic | „−0,00” pentru zero | Reparat | — |
| F-09 | Minor | Valori absurde acceptate (impozit 300%, inflație −100%) | Reparat | — |
| F-10 | Minor | Graficul: etichete tăiate, text minuscul pe telefon | Reparat | `calc.test` |
| F-11 | Minor | Comisioanele, calculate diferit în tabel și grafic | Reparat | `calc.test` |
| F-12 | Minor | Zoom nedorit pe iPhone la atingerea câmpurilor | Reparat | `page.test` |
| F-13 | Cosmetic | Formatare refăcută de 10 ori pe secundă | Reparat | — |
| F-14 | Cosmetic | „Dobânda netă de 0,00%” când nu e dobândă | Reparat | — |
| F-15 | Minor | `start.cmd` deschidea browserul înainte de server | Reparat | — |
| F-16 | Minor | Port ocupat → eroare tehnică, fără explicație | Reparat | — |
| F-17 | Minor | Serverul local nu servea fonturi sau date | Reparat | `serve.test` |
| F-18 | Major | `BAZA.md`: dobânda minimă descrisă greșit ca aproximare | Reparat | `calc.test` |
| F-19 | Major | „Media 12 luni · 9,2%” folosită ca rată pentru viitor | Reparat | — |
| F-20 | Major | Premisa „inflația e în continuă creștere”, doar pe jumătate adevărată | Reparat | — |
| F-21 | Minor | Inflația pe 12 luni, cursul pe 289 de zile | Reparat | `calc.test` |
| F-22 | Minor | „3.100 lei” vs „6,61% din 50.000 = 3.305 lei” | Reparat | `calc.test` |
| F-23 | Info | Pierderea față de euro ≠ ce economiseai ținând euro | Reparat (notă) | — |
| F-24 | Minor | Date implicite învechite, fără avertisment | Reparat | — |
| F-25 | Cosmetic | Convenții de dată amestecate la cursul BNR | Reparat | — |
| F-26 | Major | Google Fonts pe un site public din UE (GDPR) | Reparat | `build.test` |
| F-27 | Major | Datele BNR/INS nu pot fi citite direct din browser | Reparat (arhitectură) | — |
| F-28 | Minor | `app.html` nu se putea publica pe un host | Reparat | `build.test` |
| F-29 | Minor | Niciun test | Reparat | `tests/` |
| F-30 | Minor | Fără CSP / antete de securitate | Reparat | `build.test` |

---

## Bug-uri în aplicație

### F-01 · Major · Contorul ilizibil în tema dark
- **Unde:** `app.html`, CSS `.ticker`.
- **Problema:** fundalul contorului era `var(--ink)`, care în dark devine deschis, iar cifrele aveau o culoare scrisă direct (`#ff9b8f`, roz deschis). Rezultatul: text deschis pe fundal deschis.
- **Fix:** tokeni dedicați `--ticker-bg`, `--ticker-fg`, `--ticker-loss`, `--ticker-gain`, definiți pentru ambele teme.
- **Test:** `page.test` → „nicio culoare literală în afara tokenilor” și „fiecare culoare din tema light e redefinită pentru dark”.

### F-02 · Major · Virgula zecimală devenea 0, fără mesaj
- **Unde:** toate câmpurile numerice.
- **Problema:** câmpurile erau `type="number"`. În browserele care nu acceptă virgulă, „6,61” lasă câmpul gol, iar codul transforma golul în 0. Inflația devenea 0 și pierderea 0, fără nicio eroare vizibilă.
- **Fix:**
  - câmpuri text cu `inputmode="decimal"` (pe telefon apare tot tastatura numerică);
  - un parser care acceptă „6,61”, „6.61”, „50.000”, „50 000”, „1.234,56” și „6,61%”;
  - câmpurile invalide sunt marcate cu roșu și listate sub formular.
- **Test:** `calc.test` → „parseNum” (34 de cazuri); `page.test` → „fără type=number”.

### F-03 · Major · O dată lipsă umplea pagina de „NaN”
- **Problema:** `Math.max(1, NaN)` dă `NaN`, așa că o dată ștearsă strica toate rezultatele.
- **Fix:** datele sunt validate (inclusiv date inexistente, ca 30 februarie), iar rândurile afectate arată „—”.
- **Test:** `calc.test` → „date lipsă sau inexistente → NaN”.

### F-04 · Major · Data curentă înaintea celei de referință
- **Problema:** numărul de zile era forțat la 1, iar ritmul anual devenea raportul cursurilor la puterea 365, adică o valoare absurdă.
- **Fix:** mesaj explicit („data curentă trebuie să fie după data de referință”), fără calcul.
- **Test:** `calc.test` → „fără interval valid… nu există ritm”.

### F-05 · Major · Intervalele scurte, extrapolate exagerat
- **Problema:** o mișcare de 0,4% într-o singură zi apărea în tabel ca ~77% pe an.
- **Fix:**
  - intervalul implicit e de 12 luni, egal cu cel al inflației anuale;
  - sub 180 de zile apare un avertisment;
  - tabelul arată atât pierderea din interval, cât și ritmul anualizat.
- **Test:** `calc.test` → „un interval scurt e extrapolat exagerat”.

### F-06 · Minor · Contorul rescria trecutul
- **Problema:** totalul era calculat ca „ritmul de acum × timpul de la deschidere”. Dacă schimbai suma după un minut, tot minutul era recalculat cu suma nouă.
- **Fix:** contorul adună la fiecare pas cu ritmul din acel moment.

### F-07 · Minor · Contorul ignora dobânda
- **Problema:** arăta pierdere chiar și când depozitul bătea inflația.
- **Fix:** contorul urmează modul de calcul; câștigul apare verde, cu „+”.
- **Test:** `calc.test` → „contorul ține cont de dobândă”.

### F-08 · Cosmetic · „−0,00” pentru zero
- **Fix:** valoarea e rotunjită înainte să i se aleagă semnul.

### F-09 · Minor · Valori absurde acceptate
- **Problema:** se acceptau impozit peste 100%, dobândă negativă și inflație sub −100%, care produceau `Infinity` sau `NaN`.
- **Fix:** intervale validate: inflație între −50% și 500%, dobândă și impozit între 0% și 100%, sume ≥ 0, cursuri > 0.

### F-10 · Minor · Graficul
- **Problema:**
  - la sume mari, etichetele axei („5.000.000”) ieșeau din desen;
  - la sumă 0, axa era ciudată;
  - pe telefon, textul ajungea la ~6 px.
- **Fix:**
  - etichete scurte („50 mii”, „5 mil.”);
  - mesaj când nu e sumă;
  - desenul ia lățimea ecranului.
- **Test:** `calc.test` → „pas rotund pentru axa graficului”.

### F-11 · Minor · Comisioanele, calculate diferit în tabel și grafic
- **Problema:** comisioanele erau adunate nedeflatate, iar tabelul și graficul foloseau formule diferite.
- **Fix:** un singur model, folosit peste tot: soldul nominal `S·g^y − F·y`, împărțit la `(1+π)^y`.
- **Test:** `calc.test` → „comisioanele sunt deflatate ca restul banilor”.

### F-12 · Minor · Zoom pe iPhone
- **Problema:** câmpurile aveau 15 px, iar iOS mărește pagina când atingi un câmp sub 16 px.
- **Fix:** 16 px.
- **Test:** `page.test` → „câmpurile au cel puțin 16px”.

### F-13 · Cosmetic · Formatare refăcută de 10 ori pe secundă
- **Fix:** formatoarele `Intl.NumberFormat` sunt create o singură dată și refolosite.

### F-14 · Cosmetic · „Dobânda netă de 0,00%”
- **Problema:** găsit la verificarea vizuală: în modul „cu dobânda netă”, cu dobânda 0, textul vorbea despre o dobândă de 0,00%.
- **Fix:** la dobândă netă 0, fără comisioane, apare textul pentru bani fără dobândă.

## Serverul local și Windows

### F-15 · Minor · `start.cmd`: browserul înaintea serverului
- **Problema:** browserul se deschidea în paralel cu pornirea serverului și putea afișa „nu se poate conecta”.
- **Fix:** serverul deschide browserul abia după ce ascultă (`node serve.mjs --open`).

### F-16 · Minor · Port ocupat
- **Problema:** dacă portul era ocupat, apărea o eroare tehnică (stack trace).
- **Fix:** mesaj clar, cu exemplu de port alternativ pentru cmd și PowerShell.

### F-17 · Minor · Serverul nu servea fonturi sau date
- **Problema:** se servea doar `/`, deci fonturile locale și `data/rates.json` (pasul următor) ar fi dat 404.
- **Fix:**
  - se servesc doar `fonts/` și `data/`;
  - cererile cu `../`, inclusiv codificate (`%2f`, `%2e%2e`), sunt refuzate.
- **Test:** `serve.test`: 8 căi refuzate, inclusiv `app.html` și `package.json`.

## Logică și presupuneri greșite

### F-18 · Major · Dobânda minimă descrisă greșit ca aproximare
- **Unde:** `BAZA.md` §5.4.
- **Problema:** formula `π / (1 − τ)` este exactă, nu aproximativă: valoarea reală rămâne aceeași ⟺ `(1+i) = (1+π)` ⟺ `i = π`, iar `i = r·(1−τ)`.
- **Fix:**
  - documentul e corectat;
  - formula include acum și comisioanele: `r = (π + F/S) / (1 − τ)`.
- **Test:** `calc.test` → „la dobânda minimă, valoarea reală nu se schimbă într-un an (și cu comisioane)”.

### F-19 · Major · „Media 12 luni · 9,2%” folosită ca rată pentru viitor
- **Problema:** 9,2% e media prețurilor din ultimele 12 luni față de cele 12 dinainte. Include scumpirile din vara lui 2025 (TVA, plafonarea la energie) și exagerează ritmul de acum.
- **Fix:**
  - butonul e înlocuit cu „Prognoza BNR, dec. 2027 · 3,4%”;
  - pagina explică diferența dintre rata anuală și medie.

### F-20 · Major · „Inflația e în continuă creștere”, doar pe jumătate adevărat
- **Problema:** prețurile cresc continuu (asta înseamnă inflație pozitivă), dar rata anuală a evoluat așa:
  - 10,4% în iunie;
  - 8,2% în iulie;
  - 6,2% în august (efectul de bază: scumpirile din 2025 au ieșit din calcul);
  - 6,6% în septembrie.

  BNR estimează 6,1% la final de 2026 și 3,4% la final de 2027.
- **Fix:** trei scenarii, fiecare la un clic: ultimele 12 luni (6,61%), doar servicii (11,12%), prognoza BNR (3,4%).

### F-21 · Minor · Intervale diferite pentru inflație și curs
- **Problema:** inflația era pe 12 luni, cursul pe 5 ian. → 21 oct. 2026 (289 de zile), extrapolat la un an.
- **Fix:** cursul folosește același interval de 12 luni: 28 oct. 2025 → 28 oct. 2026.
- **Test:** `calc.test` → „12 luni = 365 de zile”, „EUR… leul a pierdut 4,96%”.

### F-22 · Minor · 3.100 lei sau 3.305 lei?
- **Problema:** utilizatorul calculează „6,61% din 50.000 = 3.305 lei”, iar aplicația afișa 3.100 lei. Ambele sunt corecte, dar pe baze diferite:
  - **3.100 lei:** puterea de cumpărare pierdută, în lei de azi;
  - **3.305 lei:** câți lei în plus îți trebuie la anul pentru același coș.
- **Fix:** pagina le arată pe amândouă.
- **Test:** `calc.test` → „la anul îți trebuie cu 6,61% mai mult: 3.305 lei”.

### F-23 · Info · Pierderea față de euro ≠ ce economiseai ținând euro
- **Problema:** nici euro nu e ferit de inflație: în zona euro a fost 3,8% în septembrie 2026. Rândul „Față de EUR” arată cât valorează leii tăi în euro, nu cât ai fi câștigat convertind.
- **Fix:**
  - notă în pagină;
  - comparația completă e deschisă (O-04).

## Date

### F-24 · Minor · Date implicite învechite, fără avertisment
- **Problema:** valorile implicite rămăseseră în urmă:
  - cursul era din 21 oct.; acum e din 28 oct.: EUR 5,3495, USD 4,8088;
  - depozitul avea 5,25% (iunie); la băncile mari dobânda e 5,2–5,5% (iulie);
  - Tezaur 1 an: 6,5% (octombrie).
- **Fix:**
  - valorile sunt actualizate;
  - sub titlu apare data fiecărei surse;
  - apare un avertisment când cursul are peste 7 zile sau inflația peste 35 de zile de la publicare.

### F-25 · Cosmetic · Convenții de dată amestecate
- **Problema:** site-ul sursă afișează uneori data valabilității, nu data publicării.
- **Fix:** se folosește peste tot data publicării BNR, aceeași ca în XML-ul BNR, deci compatibilă cu pasul următor.

## Publicare în cloud

### F-26 · Major · Google Fonts pe un site public din UE
- **Problema:** încărcarea fonturilor de la Google trimite IP-ul fiecărui vizitator către Google, fără consimțământ. În 2022, o instanță din München a acordat despăgubiri pentru exact asta, în baza GDPR.
- **Fix:**
  - build-ul de cloud și serverul local folosesc fonturi găzduite local (`fonts/`, licență OFL), așa că pagina nu mai face nicio cerere către alte site-uri;
  - doar artifact-ul păstrează Google Fonts, singura sursă de fonturi permisă acolo.
- **Test:** `build.test` → „fără Google Fonts”.

### F-27 · Major · Datele BNR/INS nu pot fi citite direct din browser
- **Problema:**
  - artifact-ul blochează orice cerere către alte site-uri;
  - pe GitHub Pages, citirea ar depinde de faptul că BNR permite acces din alte domenii (CORS), pe care nu ne putem baza.
- **Fix (arhitectură, pentru pasul următor):**
  - un GitHub Action descarcă zilnic datele, pe server, în `data/rates.json`;
  - pagina citește fișierul de pe propriul domeniu;
  - același fișier poate fi publicat lângă artifact.

  Serverul local și build-ul servesc deja `data/`.

### F-28 · Minor · `app.html` nu se putea publica pe un host
- **Problema:** `app.html` e un fragment, în formatul cerut de artifact.
- **Fix:** `build.mjs` produce `dist/index.html` complet, cu `lang="ro"`, descriere, favicon și căi relative (merge și sub `/taxa-pe-stat/` pe GitHub Pages).
- **Test:** `build.test`.

### F-29 · Minor · Niciun test
- **Fix:** `tests/` cu `node:test`, fără dependențe, 92 de teste:
  - calcule;
  - structura paginii;
  - build;
  - server.

  Rulează local (`npm test`) și în GitHub Actions la fiecare push.

### F-30 · Minor · Fără CSP / antete de securitate
- **Fix:**
  - build-ul pune un Content-Security-Policy cu hash pentru fiecare script inline (fără `unsafe-inline` la scripturi);
  - `vercel.json` adaugă `frame-ancestors 'none'`, `nosniff`, `no-referrer`.
- **Test:** `build.test` → „CSP: fiecare script inline are hash-ul lui”.

---

## Deschise (nereparate, de decis)

| ID | Ce | De ce contează |
|---|---|---|
| O-01 | CASS 10% pe veniturile din investiții, peste pragul de 6 salarii minime pe an | Pentru economii mari, dobânda netă reală e mai mică decât arată calculul. |
| O-02 | Spread-ul la schimb valutar (de obicei 1–3%) | Convertirea lei → euro → lei costă, independent de curs. |
| O-03 | Inflația personală (ponderi pe categorii: chirie, mâncare, servicii) | Coșul INS e o medie; serviciile au crescut cu 11%, alimentele cu 3%. |
| O-04 | Comparație completă „lei vs euro” | Dobânzile la euro, inflația zonei euro și spread-ul decid dacă euro a fost mai bun. |
| O-05 | Inflația și ritmul leului sunt presupuse constante | Proiecțiile pe 10 ani sunt ilustrative. |
| O-06 | Depozitele plătesc dobânda la scadență | Sub un an, calculul folosește dobândă compusă; diferența e neglijabilă. |
| O-07 | Licența pentru varianta open-source (de ex. MIT) | Decizia ta, înainte de repo-ul public. |
| O-08 | GitHub oprește workflow-urile programate după 60 de zile fără activitate în repo-urile publice | Contează pentru actualizarea zilnică a datelor. |
| O-09 | BNR publică doar în zilele lucrătoare, în jur de 13:00 | În weekend, „cursul de azi” e cel din ultima zi lucrătoare; scriptul de date trebuie să știe asta. |
| O-10 | `start.cmd` netestat pe Windows real | Serverul a fost testat pe Linux; scriptul `.cmd`, nu. |
