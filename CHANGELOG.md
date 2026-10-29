# Changelog

The project's versions, briefly. The details of each problem are in [`FINDINGS.md`](FINDINGS.md), by ID.

## [0.3.1] - 2026-10-29 - The first run with real data

### Fixed
- **The automatic data never arrived in 0.3.0:** the „ș” in the User-Agent made `fetch` refuse every request before it left (BNR, ECB, Eurostat), and the job still ended in success (F-38). BNR serves its XML files only on `curs.bnr.ro`; the old addresses redirect to its home page, and a redirect is now an explicit error (F-40). The bot's first rates are those of 28 October 2026.
- **False annotations in GitHub Actions:** the tests' simulated warnings no longer reach the log (F-39).
- **Early January:** the script stays on BNR and no longer asks for a year file that does not exist yet (F-41).
- **Stale data went unnoticed:** when the exchange rate is more than 7 days old, the job fails and GitHub sends an email (F-42).
- **The workflow** publishes the tip of `main`, so a run queued behind a data run no longer republishes the previous data (F-43), and each job gets only the permissions it needs (F-44).
- **Documents:** a stray table row in the design document (F-37); outdated statements in `DESIGN.md` and `README.md` (F-45).
- **Windows:** `start.cmd` was tested on Windows 11 (O-10), and the local server's busy-port hint now gives the right command for cmd, PowerShell and macOS/Linux (F-47).
- **From a testing sweep with five testers (F-48…F-79):**
  - changing a date kept the rates of the old date, so the page stated false history; now the rates come from BNR's daily history (F-62);
  - stale data could last for weeks with a green pipeline; a check after the deploy now emails the owner, without ever blocking publishing (F-54);
  - the data script: the ECB no longer replaces an equally fresh BNR rate (F-48), errors name their cause and address (F-49), Eurostat gaps are reported (F-50), the inflation month never moves back (F-51), nothing the page would reject is written or committed (F-52), broken saved rows are skipped (F-53);
  - the page: data arriving after an edit (F-63), deflation (F-64), implausible rates (F-65), no JavaScript (F-66), „0,500” and „-0” (F-67, F-68), the counter's note with fees (F-69), the HICP badge (F-70), dated hand-set values with badges (F-71), chart labels and date fields (F-78, F-79);
  - the site: a 404 page (F-72), a stricter CSP and no referrer (F-73), line endings before hashing (F-59), the Source Sans 3 licence (F-74), Node 22 (F-75), a preview image without figures or dates (F-76).

### Changed
- **Less traffic to BNR:** normally only the last 10 days are fetched, joined to the saved history (O-14).
- **The Pages actions** are on their Node 24 versions (O-13).
- **English everywhere except the interface and `README.md`:** code, tests, documents, commit messages. `BAZA.md` became `DESIGN.md` and `docs/LUCRU.md` became `docs/DEVELOPMENT.md`.
- **`FINDINGS.md`** has two tables: fixed, and still in the app.
- **The README screenshot** is in the dark theme.
- **The claude.ai artifact** is no longer synced.

### Added
- `docs/IDEAS.md`: ideas for later, not scheduled.
- `scripts/check-fresh.mjs` and the `check` job after the deploy (F-54).
- **Tests:** from 120 to 237.
  - `tests/e2e.test.mjs`: the built page in headless Chrome, without any dependency (F-55, F-77);
  - `tests/workflow.test.mjs` (the workflows), `tests/fresh.test.mjs` (the freshness check), `tests/release.test.mjs` (the version in package.json, CHANGELOG and README);
  - every inline script in `app.html` is parsed (F-46); every figure of the worked example in DESIGN §6 (F-45);
  - the simulated sources answer only at their exact addresses (F-57); the 10-day path with a new day (F-56); independent data tests (F-58);
  - every fix was checked by mutation: with the fix undone, a test fails.

## [0.3.0] - 2026-10-29 - Taxa pe stat

### Changed
- **New name:** *Taxa pe stat* (formerly *Ceasul leului*). The name becomes the page's main title.
- **Automatic inflation** is the HICP, from Eurostat (F-31, F-33).

### Added
- **Automatic data:**
  - `scripts/update-data.mjs` fetches the BNR exchange rates (with the ECB as fallback) and Eurostat inflation into `data/rates.json`;
  - the page reads and validates them.

  In this version the requests never actually left: see 0.3.1.
- **Publishing on GitHub Pages:** `.github/workflows/publish.yml` fetches the data on working days, commits as `github-actions[bot]` and publishes (F-32).
- **For sharing:** a link to the code in the page, `og:url`, `canonical` and a preview image for links (F-35, F-36).
- **Documents:** the MIT license, `CHANGELOG.md`, `docs/LUCRU.md` (now `docs/DEVELOPMENT.md`), `.gitattributes`.
- **`CLAUDE.md`:** the instructions for Claude Code (where we left off, the working rules).
- **Tests:** `tests/data.test.mjs`, with a simulated network; 120+ tests in total.

### Removed
- `vercel.json`: we publish only on GitHub Pages (F-34).

## [0.2.0] - 2026-10-29 - Review 1

### Fixed
30 problems found in the first review (F-01…F-30), among them:
- the unreadable dark theme;
- the decimal comma turned into 0;
- missing dates that produced „NaN”;
- the exaggerated extrapolation of the exchange rate;
- the 9.2% average used as a forecast;
- the formula of the minimum interest rate, wrongly described as an approximation.

### Added
- **A build for the site:** `build.mjs`, locally hosted fonts, a CSP with hashes.
- **A new local server:** fonts, data, protection against `../`.
- **Tests:** 92, with `node:test`.
- **`FINDINGS.md`**.

## [0.1.0] - 2026-10-28 - Ceasul leului

### Added
- **The first version:**
  - the loss per day, week, month and year, from inflation and from the exchange rate (EUR, USD);
  - a live counter;
  - a 10-year chart.
- **Publishing and running:** an artifact on claude.ai, a local server, `start.cmd`.
- **`BAZA.md`** (now `DESIGN.md`): the data, the causes, the formulas and the worked example.

[0.3.1]: https://github.com/RomulusMirauta/taxa-pe-stat/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/RomulusMirauta/taxa-pe-stat/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/RomulusMirauta/taxa-pe-stat/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/RomulusMirauta/taxa-pe-stat/releases/tag/v0.1.0
