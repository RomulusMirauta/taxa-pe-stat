# Cum lucrăm

Notițe despre felul în care e construit și întreținut proiectul. Pentru calcule și date vezi [`BAZA.md`](../BAZA.md).

## Cu Claude

Proiectul e construit cu ajutorul lui Claude (Anthropic), ca asistent:
- review;
- cod;
- teste;
- documente.

Commit-urile făcute de Claude au linia `Co-Authored-By: Claude`.

Instrucțiunile pentru Claude Code (sesiuni locale, de exemplu din VS Code) sunt în [`CLAUDE.md`](../CLAUDE.md). Claude Code îl citește automat la pornire: proiectul pe scurt, unde am rămas, regulile de lucru.

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

Pe calculatorul autorului, folderul în care scrie Claude din claude.ai, prin legătura cu aplicația desktop, e și clone-ul git al repo-ului. A fost transformat pe loc din `taxa-pe-stat.bundle`, cu `origin` pe GitHub.

- **Ce scrie Claude din claude.ai** apare în `git status`, ca orice modificare locală. Commit-ul și push-ul se fac de aici, din git.
- **`.github/`:** din claude.ai, Claude nu are voie să scrie acolo pe calculator. Workflow-urile se modifică din Claude Code sau din repo.
- **`taxa-pe-stat.bundle`** (ignorat de git) a fost copia de siguranță a istoricului până la primul push. Acum istoricul e pe GitHub, deci fișierul se poate șterge.
