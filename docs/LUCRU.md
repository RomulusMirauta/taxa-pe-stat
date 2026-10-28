# Cum lucrăm

Notițe despre felul în care e construit și întreținut proiectul. Pentru calcule și date vezi [`BAZA.md`](../BAZA.md).

## Cu Claude

Proiectul e construit cu ajutorul lui Claude (Anthropic), ca asistent:
- review;
- cod;
- teste;
- documente.

Commit-urile făcute de Claude au linia `Co-Authored-By: Claude`.

**Convenții:**
- toate testele stau în `tests/`;
- orice bug găsit se trece în [`FINDINGS.md`](../FINDINGS.md), cu un ID nou care nu se refolosește, și, unde se poate, primește un test.

## Artifact pe claude.ai

Pe lângă site, aplicația există și ca artifact privat pe claude.ai. Linkul și ultima versiune publicată stau în [`artifact.json`](../artifact.json).

- **De ce merge același fișier în ambele locuri:** artifact-ul primește `app.html` ca fragment (fără `<head>`). De aceea `app.html` nu are `<!doctype>`, iar `build.mjs` îl învelește pentru site.
- **Diferențe față de site:**
  - artifact-ul folosește Google Fonts, singura sursă de fonturi permisă acolo;
  - datele zilnice ajung în artifact doar la fiecare sincronizare.
- **Sincronizare:** îi spui lui Claude „sync TaxaPeStat”. Claude:
  1. rulează testele;
  2. publică `app.html` și `data/rates.json` pe același link;
  3. actualizează `artifact.json`.

## Copia locală

Există și o copie a proiectului pe calculatorul autorului, scrisă de Claude prin legătura cu aplicația desktop.

- **Nu conține `.github/`:** din motive de siguranță, Claude nu are voie să scrie acolo pe calculator.
- **Copia de siguranță a istoricului:** `taxa-pe-stat.bundle`, ignorat de git. Se clonează cu `git clone taxa-pe-stat.bundle`.
- **Pentru lucru local** e mai simplu un clone al repo-ului de pe GitHub.
