# Changelog

Versiunile proiectului, pe scurt. Detaliile problemelor sunt în [`FINDINGS.md`](FINDINGS.md), după ID.

## [0.3.0] - 2026-10-29 - Taxa pe stat

### Schimbat
- **Nume nou:** *Taxa pe stat* (fost *Ceasul leului*). Numele devine titlul principal al paginii.
- **Inflația automată** e IAPC, de la Eurostat (F-31, F-33).

### Adăugat
- **Date automate:**
  - `scripts/update-data.mjs` aduce cursul BNR (rezervă BCE) și inflația Eurostat în `data/rates.json`;
  - pagina le citește și le validează.
- **Publicare pe GitHub Pages:** `.github/workflows/publish.yml` aduce datele în zilele lucrătoare, face commit ca `github-actions[bot]` și publică (F-32).
- **Pentru distribuire:** link spre cod în pagină, `og:url`, `canonical` și o imagine de previzualizare pentru linkuri (F-35, F-36).
- **Documente:** licența MIT, `CHANGELOG.md`, `docs/LUCRU.md`, `.gitattributes`.
- **`CLAUDE.md`:** instrucțiunile pentru Claude Code (unde am rămas, reguli de lucru).
- **Teste:** `tests/data.test.mjs`, cu rețeaua simulată; 120+ teste în total.

### Scos
- `vercel.json`: publicăm doar pe GitHub Pages (F-34).

## [0.2.0] - 2026-10-29 - Review 1

### Reparat
30 de probleme găsite la primul review (F-01…F-30), printre care:
- tema dark ilizibilă;
- virgula zecimală transformată în 0;
- date lipsă care dădeau „NaN”;
- extrapolarea exagerată a cursului;
- media de 9,2% folosită ca prognoză;
- formula dobânzii minime, descrisă greșit ca aproximare.

### Adăugat
- **Build pentru cloud:** `build.mjs`, fonturi găzduite local, CSP cu hash-uri.
- **Server local nou:** fonturi, date, protecție la `../`.
- **Teste:** 92, cu `node:test`.
- **`FINDINGS.md`**.

## [0.1.0] - 2026-10-28 - Ceasul leului

### Adăugat
- **Prima versiune:**
  - pierderea pe zi, săptămână, lună și an, din inflație și din curs (EUR, USD);
  - contor live;
  - grafic pe 10 ani.
- **Publicare și rulare:** artifact pe claude.ai, server local, `start.cmd`.
- **`BAZA.md`:** datele, cauzele, formulele și exemplul calculat.

[0.3.0]: https://github.com/RomulusMirauta/taxa-pe-stat/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/RomulusMirauta/taxa-pe-stat/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/RomulusMirauta/taxa-pe-stat/releases/tag/v0.1.0
