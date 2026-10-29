# CLAUDE.md: Taxa pe stat

Instrucțiuni pentru Claude Code. Citește-le la începutul fiecărei sesiuni în acest repo.

## Proiectul, pe scurt

Calculator în română: cât pierd banii ținuți în lei din cauza inflației și a cursului EUR/USD, pe zi, săptămână, lună și an.
- **Pagina** e un singur fișier (`app.html`), fără dependențe.
- **Datele** (BNR, Eurostat) se actualizează zilnic prin GitHub Actions.
- **Site-ul** e pe GitHub Pages.

Unde găsești restul:

| Fișier | Ce conține |
|---|---|
| `README.md` | ce face aplicația și comenzile |
| `BAZA.md` | formulele (§5), sursele de date (§2), deciziile, pașii următori (§11) |
| `FINDINGS.md` | registrul de bug-uri și ce a rămas deschis (O-NN) |
| `CHANGELOG.md` | versiunile |
| `docs/LUCRU.md` | artifact-ul de pe claude.ai și copia locală |

## Unde am rămas (29 oct. 2026): de făcut, în ordine

Ce urmează a fost lucrat într-o sesiune claude.ai care nu putea face push în repo. Pașii rămași:

1. **Push.** Repo-ul `RomulusMirauta/taxa-pe-stat` e gol.
   - Dacă lucrezi într-un clone făcut din `taxa-pe-stat.bundle`, `origin` arată spre bundle. Schimbă-l:
     ```
     git remote set-url origin https://RomulusMirauta@github.com/RomulusMirauta/taxa-pe-stat.git
     git push -u origin main --tags
     ```
   - Numele contului stă în URL ca Git Credential Manager să ceară datele contului `RomulusMirauta`, chiar dacă git-ul e logat și pe alt cont GitHub.
2. **GitHub Pages:** Settings → Pages → Source: **GitHub Actions**. Cu `gh` logat pe `RomulusMirauta` se poate și din terminal:
   `gh api -X POST repos/RomulusMirauta/taxa-pe-stat/pages -f build_type=workflow`
3. **Prima rulare cu date reale:** `gh workflow run publish.yml -R RomulusMirauta/taxa-pe-stat`, apoi `gh run watch -R RomulusMirauta/taxa-pe-stat`. Verifică în log:
   - **cursul:** a răspuns BNR, sau scriptul a trecut pe BCE (avertismentul „Cursul BNR nu e disponibil”)? Rezultatul închide O-11 și O-12 din `FINDINGS.md`.
   - **inflația:** a răspuns Eurostat?
   - **commit-ul de date:** a apărut „date: curs …” de la `github-actions[bot]`? Apare doar dacă datele s-au schimbat.
4. **Site-ul:** la https://romulusmirauta.github.io/taxa-pe-stat/ verifică:
   - pagina se încarcă, fără erori în consolă;
   - sub titlu apare „actualizate automat”;
   - `data/rates.json` și `assets/og.png` răspund.
5. **„About” pe GitHub:**
   `gh repo edit RomulusMirauta/taxa-pe-stat --description "Cât pierd leii tăi, zi de zi: inflația și cursul leului, cu date BNR și Eurostat actualizate zilnic." --homepage https://romulusmirauta.github.io/taxa-pe-stat/ --add-topic romania,inflation,exchange-rates,bnr,eurostat,github-actions,github-pages,calculator`
6. **La final:** bifează în `BAZA.md` §11 ce s-a făcut și scurtează secțiunea asta.

## Reguli de lucru

**Limbă**
- Interfața, documentele și mesajele de commit sunt în română, cu diacritice.
- Identificatorii din cod sunt în engleză; comentariile, în română.

**Teste**
- Toate stau în `tests/` și folosesc `node:test`.
- Rulează `npm test` înainte de fiecare commit. Toate trebuie să treacă.

**Bug-uri**
- Orice problemă găsită se trece în `FINDINGS.md`, cu:
  - un ID nou `F-NN` (ID-urile nu se refolosesc);
  - severitatea, problema și fix-ul;
  - testul care o acoperă, unde se poate.
- Ce nu se repară acum merge în tabelul „Deschise” (`O-NN`).

**Commit-uri**
- Mici, pe teme, cu ID-urile din FINDINGS în mesaj.
- Autor: `Romulus Mirăuță <181910713+RomulusMirauta@users.noreply.github.com>`. Fără adresa asta, commit-urile nu apar pe graficul de contribuții.
- Commit-urile scrise de tine au linia `Co-Authored-By: Claude`.

**Versiuni**
- O versiune nouă înseamnă: o intrare în `CHANGELOG.md`, `version` actualizat în `package.json` și un tag adnotat `vX.Y.Z`.

**Dependențe**
- Nu adăuga dependențe noi fără să întrebi. Proiectul nu are niciuna, iar asta e o decizie, nu o întâmplare.

**`app.html`** (verificat de `tests/page.test.mjs`):
- e fragment, fără `<!doctype>`, `<html>`, `<head>` sau `<body>`, pentru că e publicat și ca artifact pe claude.ai;
- nu face cereri către alte site-uri; datele vin din `data/rates.json`, pe cale relativă;
- culorile sunt doar tokeni, între `tokens:start` și `tokens:end`, definiți pentru ambele teme;
- calculele stau în `<script id="calc">`, ca funcții pure testate în `tests/calc.test.mjs`;
- căile sunt relative, pentru că site-ul stă sub `/taxa-pe-stat/`.

**Date**
- `data/rates.json` îl scrie doar botul (`scripts/update-data.mjs`); nu îl edita de mână.
- Prognoza BNR și dobânzile orientative stau în `DATA`, în `app.html`. Când le schimbi, actualizează și sursele din `BAZA.md` §2.
- Dacă schimbi formulele, actualizează `BAZA.md` §5 și testele.

**Ce nu intră în repo:** `dist/`, `node_modules/`, `*.bundle`.

## Comenzi

```
npm run dev                    # server local cu reîncărcare: http://localhost:5173
npm test                       # toate testele
npm run build                  # → dist/
node scripts/update-data.mjs   # datele de azi (internet)
```

## Artifact pe claude.ai

Pagina există și ca artifact privat. URL-ul și ultima versiune stau în `artifact.json`.

La cererea „sync TaxaPeStat”:
1. rulează testele;
2. publică `app.html` și `data/rates.json` pe același URL;
3. crește `lastPublishedVersion`.

Dacă sesiunea ta nu poate publica artifact-ul, sincronizarea se face din claude.ai.

## Mediu

- **Windows:** `start.cmd` pornește serverul și deschide browserul.
- **Folderul local e clone-ul:** copia scrisă din claude.ai a fost transformată în clone git (`docs/LUCRU.md`). Ce scrie claude.ai apare în `git status`.
- **Autorul commit-urilor** e setat local, în `.git/config`: git-ul global de pe calculator folosește altă adresă. Într-un clone nou, setează din nou `user.name` și `user.email`.
- **`gh`** e în `C:\Program Files\GitHub CLI\`, dar poate lipsi din PATH (Git Bash: `"/c/Program Files/GitHub CLI/gh.exe"`). Contul activ trebuie să fie `RomulusMirauta` (`gh auth status`).
