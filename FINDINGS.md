# FINDINGS: Taxa pe stat (formerly Ceasul leului)

The registry of problems found in the app. Every entry has a stable ID, and IDs are never reused:
- `F-NN`: a problem that was found (fixed, or accepted as a limitation);
- `O-NN`: an open item, not fixed yet or still to be decided.

The first table lists what is fixed; the second, what is still in the app. The details follow, by area.

**Rounds:**
- Review 1: 29 October 2026, version 0.1 (artifact v1), fixed in 0.2 (artifact v2): F-01…F-30.
- Implementing the automatic data: 29 October 2026, F-31…F-33.
- Before publishing on GitHub: F-34…F-36.
- Publishing on GitHub and the first run with real data, with two independent reviews and a testing sweep: 29 October 2026, F-37…F-47 (v0.3.1).

**Severity:**
- **Major:** a wrong result, an unusable page or a risk when publishing.
- **Minor:** a confusing result or an edge case.
- **Cosmetic:** appearance.
- **Info:** good to know; not a bug.

---

## Fixed

| ID | Sev. | Problem | Status | Test |
|---|---|---|---|---|
| F-01 | Major | The counter was unreadable in the dark theme | Fixed | `page.test` |
| F-02 | Major | The decimal comma („6,61”) became 0, without a message | Fixed | `calc.test`, `page.test` |
| F-03 | Major | A missing date filled the page with „NaN” | Fixed | `calc.test` |
| F-04 | Major | A current date before the reference date gave an absurd pace | Fixed | `calc.test` |
| F-05 | Major | Short exchange-rate intervals, extrapolated too far | Fixed | `calc.test` |
| F-06 | Minor | The counter rewrote the past when the amount changed | Fixed | — |
| F-07 | Minor | The counter ignored the interest | Fixed | `calc.test` |
| F-08 | Cosmetic | „−0,00” for zero | Fixed | — |
| F-09 | Minor | Absurd values accepted (a 300% tax, −100% inflation) | Fixed | — |
| F-10 | Minor | The chart: clipped labels, tiny text on phones | Fixed | `calc.test` |
| F-11 | Minor | Fees computed differently in the table and the chart | Fixed | `calc.test` |
| F-12 | Minor | Unwanted zoom on iPhone when tapping the fields | Fixed | `page.test` |
| F-13 | Cosmetic | The formatting was redone 10 times a second | Fixed | — |
| F-14 | Cosmetic | „Dobânda netă de 0,00%” when there is no interest | Fixed | — |
| F-15 | Minor | `start.cmd` opened the browser before the server | Fixed | — |
| F-16 | Minor | A busy port gave a technical error, without an explanation | Fixed | — |
| F-17 | Minor | The local server served neither fonts nor data | Fixed | `serve.test` |
| F-18 | Major | The design document described the minimum interest rate wrongly, as an approximation | Fixed | `calc.test` |
| F-19 | Major | „Media 12 luni · 9,2%” was used as a rate for the future | Fixed | — |
| F-20 | Major | The premise "inflation keeps rising", only half true | Fixed | — |
| F-21 | Minor | Inflation over 12 months, the exchange rate over 289 days | Fixed | `calc.test` |
| F-22 | Minor | „3.100 lei” vs „6,61% of 50,000 = 3,305 lei” | Fixed | `calc.test` |
| F-23 | Info | The loss against the euro ≠ what you would have saved holding euros | Fixed (a note) | — |
| F-24 | Minor | Outdated default data, without a warning | Fixed | — |
| F-25 | Cosmetic | Mixed date conventions for the BNR rate | Fixed | — |
| F-26 | Major | Google Fonts on a public site in the EU (GDPR) | Fixed | `build.test` |
| F-27 | Major | BNR/INS data cannot be read directly from the browser | Fixed (architecture) | — |
| F-28 | Minor | `app.html` could not be published on a host | Fixed | `build.test` |
| F-29 | Minor | No tests | Fixed | `tests/` |
| F-30 | Minor | No CSP or security headers | Fixed | `build.test` |
| F-31 | Major | The planned Eurostat dataset (`prc_hicp_manr`) was discontinued | Fixed | `data.test` |
| F-32 | Minor | A bot commit would not have republished the site | Fixed (architecture) | — |
| F-34 | Minor | `vercel.json` left over after choosing GitHub Pages | Fixed | — |
| F-35 | Major | Commits with a provisional author; local paths and provisional links in the documents | Fixed | `build.test` |
| F-36 | Minor | The link sent to friends had no preview image; the README had no screenshot | Fixed | `build.test` |
| F-37 | Cosmetic | A row of the §5.9 table in the design document had ended up at the end of §5.10 | Fixed | — |
| F-38 | Major | No data request ever left: a „ș” in the User-Agent | Fixed | `data.test` |
| F-39 | Minor | The tests' simulated warnings showed up as GitHub Actions annotations | Fixed | `data.test` |
| F-40 | Major | BNR serves its XML files only on `curs.bnr.ro`; the old addresses redirect to its home page | Fixed | `data.test` |
| F-41 | Minor | Early January: the script fell back to the ECB although BNR answered | Fixed | `data.test` |
| F-42 | Minor | Stale data passed silently: no email when the data stops updating | Fixed | `data.test` |
| F-43 | Minor | A run queued behind a data run republished the previous data | Fixed | `workflow.test` |
| F-44 | Minor | The workflow's permissions were granted to both jobs | Fixed | `workflow.test` |
| F-45 | Minor | Outdated statements in `DESIGN.md` and `README.md` | Fixed | `calc.test` (the §6 example) |
| F-46 | Minor | No test parsed the page's main script | Fixed | `page.test` |
| F-47 | Cosmetic | The busy-port hint gave a Bash command, which does not work in cmd | Fixed | `serve.test` |
| O-07 | — | The license for the open-source version | Resolved: MIT | — |
| O-09 | — | BNR publishes only on working days, around 13:00 | Resolved: the script uses the last published day | `data.test` |
| O-10 | — | `start.cmd` had not been tested on a real Windows machine | Resolved: tested on Windows 11 | — |
| O-11 | — | The ECB fallback had never been tried on real data | Resolved: checked on real data | — |
| O-12 | — | BNR might refuse automated requests from GitHub's servers | Resolved: it does not | — |
| O-13 | — | The Pages actions targeted Node 20 | Resolved: on their Node 24 versions | `workflow.test` |
| O-14 | — | Every run downloaded both of BNR's yearly files | Resolved: the last 10 days are enough | `data.test` |

## Still in the app

| ID | Kind | What | Why it matters |
|---|---|---|---|
| F-33 | Accepted | Automatic inflation is the HICP (Eurostat), not the CPI (INS) | INS has no stable source for automation. The difference is small (6.5% vs 6.61% in September 2026), and the page names its source. |
| O-01 | Open | CASS 10% on investment income above 6 minimum wages a year | For large savings, the real net interest is lower than the calculation shows. Idea: [`docs/IDEAS.md`](docs/IDEAS.md). |
| O-02 | Open | The FX spread (usually 1–3%) | Converting lei → euros → lei costs money, whatever the exchange rate does. |
| O-03 | Open | Personal inflation (weights by category: rent, food, services) | The INS basket is an average; services rose by 11%, food by 3%. |
| O-04 | Open | A full comparison of lei vs euros | Euro interest rates, euro-area inflation and the spread decide whether euros were better. |
| O-05 | Open | Inflation and the leu's pace are assumed constant | The 10-year projections are illustrative. |
| O-06 | Open | Deposits pay the interest at maturity | Under a year the calculation compounds; the difference is negligible. |
| O-08 | Open | GitHub disables scheduled workflows after 60 days without activity in public repos | Probably covered by the bot's near-daily data commits, though GitHub does not define "activity". If the data stops changing, F-42 sends an email within 7 days. To turn the schedule back on: `gh workflow enable publish.yml -R RomulusMirauta/taxa-pe-stat`. |
| O-15 | Accepted | GitHub Pages does not let us set HTTP security headers (`frame-ancestors`, `nosniff`, `no-referrer`) | The consequence accepted in F-34. The in-page CSP covers scripts, fonts and connections. |

---

## Bugs in the app

### F-01 · Major · The counter was unreadable in the dark theme
- **Where:** `app.html`, the `.ticker` CSS.
- **Problem:** the counter's background was `var(--ink)`, which becomes light in the dark theme, while the digits had a hard-coded colour (`#ff9b8f`, light pink). The result: light text on a light background.
- **Fix:** dedicated tokens `--ticker-bg`, `--ticker-fg`, `--ticker-loss`, `--ticker-gain`, defined for both themes.
- **Test:** `page.test` → "no literal colors outside the tokens (CSS and code)" and "every light-theme color is redefined for dark".

### F-02 · Major · The decimal comma became 0, without a message
- **Where:** all the numeric fields.
- **Problem:** the fields were `type="number"`. In browsers that don't accept a comma, „6,61” leaves the field empty, and the code turned the empty value into 0. Inflation became 0 and the loss 0, without any visible error.
- **Fix:**
  - text fields with `inputmode="decimal"` (phones still show the numeric keyboard);
  - a parser that accepts „6,61”, „6.61”, „50.000”, „50 000”, „1.234,56” and „6,61%”;
  - invalid fields are marked in red and listed under the form.
- **Test:** `calc.test` → "parseNum: numbers written the Romanian or English way"; `page.test` → "numeric fields accept a comma: no `type="number"`".

### F-03 · Major · A missing date filled the page with „NaN”
- **Problem:** `Math.max(1, NaN)` gives `NaN`, so a deleted date broke every result.
- **Fix:** dates are validated (including dates that don't exist, like 30 February), and the affected rows show „—”.
- **Test:** `calc.test` → "missing or nonexistent dates → NaN".

### F-04 · Major · A current date before the reference date
- **Problem:** the number of days was forced to 1, and the annual pace became the ratio of the rates to the power of 365: an absurd value.
- **Fix:** an explicit message („data curentă trebuie să fie după data de referință”), without a calculation.
- **Test:** `calc.test` → "without a valid interval or exchange rates there is no pace".

### F-05 · Major · Short intervals, extrapolated too far
- **Problem:** a 0.4% move in a single day showed in the table as ~77% a year.
- **Fix:**
  - the default interval is 12 months, the same as annual inflation;
  - under 180 days a warning appears;
  - the table shows both the loss over the interval and the annualised pace.
- **Test:** `calc.test` → "a short interval extrapolates wildly (which is why the app warns)".

### F-06 · Minor · The counter rewrote the past
- **Problem:** the total was computed as "the current pace × the time since opening". If you changed the amount after a minute, the whole minute was recomputed with the new amount.
- **Fix:** the counter adds up at every step, at the pace of that moment.

### F-07 · Minor · The counter ignored the interest
- **Problem:** it showed a loss even when the deposit beat inflation.
- **Fix:** the counter follows the calculation mode; a gain shows in green, with „+”.
- **Test:** `calc.test` → "the counter accounts for interest".

### F-08 · Cosmetic · „−0,00” for zero
- **Fix:** the value is rounded before its sign is chosen.

### F-09 · Minor · Absurd values accepted
- **Problem:** a tax above 100%, a negative interest rate and inflation below −100% were accepted, and produced `Infinity` or `NaN`.
- **Fix:** validated ranges: inflation between −50% and 500%, interest and tax between 0% and 100%, amounts ≥ 0, exchange rates > 0.

### F-10 · Minor · The chart
- **Problem:**
  - with large amounts, the axis labels („5.000.000”) went outside the drawing;
  - with an amount of 0, the axis looked odd;
  - on phones, the text shrank to ~6 px.
- **Fix:**
  - short labels („50 mii”, „5 mil.”);
  - a message when there is no amount;
  - the drawing takes the width of the screen.
- **Test:** `calc.test` → "round step for the chart axis".

### F-11 · Minor · Fees computed differently in the table and the chart
- **Problem:** fees were added without being deflated, and the table and the chart used different formulas.
- **Fix:** a single model, used everywhere: the nominal balance `S·g^y − F·y`, divided by `(1+π)^y`.
- **Test:** `calc.test` → "fees are deflated like the rest of the money".

### F-12 · Minor · Zoom on iPhone
- **Problem:** the fields were 15 px, and iOS zooms the page when you tap a field under 16 px.
- **Fix:** 16 px.
- **Test:** `page.test` → "fields are at least 16px (otherwise the iPhone zooms in on tap)".

### F-13 · Cosmetic · The formatting was redone 10 times a second
- **Fix:** the `Intl.NumberFormat` formatters are created once and reused.

### F-14 · Cosmetic · „Dobânda netă de 0,00%”
- **Problem:** found during the visual check: in the „Cu dobânda netă” mode, with an interest rate of 0, the text spoke of an interest rate of 0.00%.
- **Fix:** with a net interest rate of 0 and no fees, the text for money without interest appears.

## The local server and Windows

### F-15 · Minor · `start.cmd`: the browser before the server
- **Problem:** the browser opened while the server was starting and could show "can't connect".
- **Fix:** the server opens the browser only once it is listening (`node serve.mjs --open`).

### F-16 · Minor · A busy port
- **Problem:** if the port was busy, a technical error appeared (a stack trace).
- **Fix:** a clear message, with an example of another port for cmd and PowerShell.

### F-17 · Minor · The server served neither fonts nor data
- **Problem:** only `/` was served, so the local fonts and `data/rates.json` (then the next step) would have given 404.
- **Fix:**
  - only `fonts/` and `data/` are served (and later `assets/`);
  - requests with `../`, including encoded ones (`%2f`, `%2e%2e`), are refused.
- **Test:** `serve.test` → "refuses …", for 9 paths, including `app.html` and `package.json`.

## Logic and wrong assumptions

### F-18 · Major · The minimum interest rate described wrongly as an approximation
- **Where:** the design document (then `BAZA.md`), §5.4.
- **Problem:** the formula `π / (1 − τ)` is exact, not approximate: the real value stays the same ⟺ `(1+i) = (1+π)` ⟺ `i = π`, and `i = r·(1−τ)`.
- **Fix:**
  - the document is corrected;
  - the formula now includes the fees too: `r = (π + F/S) / (1 − τ)`.
- **Test:** `calc.test` → "at the minimum rate, the real value is unchanged after a year (with fees too)".

### F-19 · Major · „Media 12 luni · 9,2%” used as a rate for the future
- **Problem:** 9.2% is the average of the prices over the last 12 months against the 12 before. It includes the price rises of summer 2025 (VAT, the energy price cap) and exaggerates today's pace.
- **Fix:**
  - the button was replaced by „Prognoza BNR, dec. 2027 · 3,4%”;
  - the page explains the difference between the annual rate and the average.

### F-20 · Major · "Inflation keeps rising", only half true
- **Problem:** prices rise continuously (that is what positive inflation means), but the annual rate went like this:
  - 10.4% in June;
  - 8.2% in July;
  - 6.2% in August (the base effect: the price rises of 2025 left the calculation);
  - 6.6% in September.

  BNR expects 6.1% at the end of 2026 and 3.4% at the end of 2027.
- **Fix:** three scenarios, one click each: the last 12 months (then 6.61%), services only (then 11.12%), the BNR forecast (3.4%). Since the automatic data (F-33), the first two use the HICP.

### F-21 · Minor · Different intervals for inflation and the exchange rate
- **Problem:** inflation was over 12 months, the exchange rate over 5 Jan → 21 Oct 2026 (289 days), extrapolated to a year.
- **Fix:** the exchange rate uses the same 12-month interval: 28 Oct 2025 → 28 Oct 2026.
- **Test:** `calc.test` → "12 months = 365 days" and "EUR, 28 Oct 2025 → 28 Oct 2026: the leu lost 4.96%".

### F-22 · Minor · 3,100 lei or 3,305 lei?
- **Problem:** the user computes "6.61% of 50,000 = 3,305 lei", while the app showed 3,100 lei. Both are right, on different bases:
  - **3,100 lei:** the purchasing power lost, in today's lei;
  - **3,305 lei:** how many extra lei you need next year for the same basket.
- **Fix:** the page shows both.
- **Test:** `calc.test` → "next year you need 6.61% more: 3,305 lei".

### F-23 · Info · The loss against the euro ≠ what you would have saved holding euros
- **Problem:** the euro is not safe from inflation either: euro-area inflation was 3.8% in September 2026. The „Față de EUR” row shows how much your lei are worth in euros, not how much you would have gained by converting.
- **Fix:**
  - a note in the page;
  - the full comparison is open (O-04).

## Data

### F-24 · Minor · Outdated default data, without a warning
- **Problem:** the default values had fallen behind:
  - the exchange rate was from 21 Oct; now it is from 28 Oct: EUR 5.3495, USD 4.8088;
  - the deposit had 5.25% (June); at the big banks the rate is 5.2–5.5% (July);
  - Tezaur 1 year: 6.5% (October).
- **Fix:**
  - the values are updated;
  - under the title, the date of each source appears;
  - a warning appears when the exchange rate is more than 7 days old, or inflation more than 35 days after publication.

### F-25 · Cosmetic · Mixed date conventions
- **Problem:** the source website sometimes shows the validity date, not the publication date.
- **Fix:** BNR's publication date is used everywhere, the same as in BNR's XML, so it is compatible with the automatic data.

## Publishing on the cloud

### F-26 · Major · Google Fonts on a public site in the EU
- **Problem:** loading the fonts from Google sends every visitor's IP to Google, without consent. In 2022, a Munich court awarded damages for exactly that, under the GDPR.
- **Fix:**
  - the site's build and the local server use locally hosted fonts (`fonts/`, OFL license), so the page makes no request to other sites;
  - only the claude.ai artifact kept Google Fonts, the only font source allowed there.
- **Test:** `build.test` → "no Google Fonts: the fonts are served locally".

### F-27 · Major · BNR/INS data cannot be read directly from the browser
- **Problem:**
  - the artifact blocks every request to other sites;
  - on GitHub Pages, reading them would depend on BNR allowing access from other domains (CORS), which we cannot rely on.
- **Fix (architecture, for the next step then):**
  - a GitHub Action downloads the data daily, on the server, into `data/rates.json`;
  - the page reads the file from its own domain;
  - the same file could be published next to the artifact.

  The local server and the build already served `data/`.

### F-28 · Minor · `app.html` could not be published on a host
- **Problem:** `app.html` is a fragment, in the format the artifact required.
- **Fix:** `build.mjs` produces a complete `dist/index.html`, with `lang="ro"`, a description, a favicon and relative paths (it also works under `/taxa-pe-stat/` on GitHub Pages).
- **Test:** `build.test`.

### F-29 · Minor · No tests
- **Fix:** `tests/` with `node:test`, without dependencies, 92 tests:
  - calculations;
  - the page's structure;
  - the build;
  - the server.

  They run locally (`npm test`) and in GitHub Actions on every push.

### F-30 · Minor · No CSP or security headers
- **Fix:**
  - the build adds a Content-Security-Policy with a hash for every inline script (no `unsafe-inline` for scripts);
  - `vercel.json` added `frame-ancestors 'none'`, `nosniff`, `no-referrer` (removed later: F-34, O-15).
- **Test:** `build.test` → "CSP: every inline script has its hash, no unsafe-inline for scripts".

## Found while implementing the automatic data

### F-31 · Major · The planned Eurostat dataset was discontinued
- **Problem:** the classic dataset `prc_hicp_manr` receives no data from 2026 on; its last month is December 2025. Eurostat moved to ECOICOP 2, in the dataset `prc_hicp_minr`, with other codes: `TOTAL` instead of `CP00`, the dimension `coicop18`.
- **Fix:** the script uses `prc_hicp_minr`, one series per request.
- **Test:** `data.test` → "Eurostat: inflation".

### F-32 · Minor · A bot commit would not have republished the site
- **Problem:** commits made with the GitHub Actions token don't start other workflows. With a separate job for the data, the site would have kept the old data.
- **Fix:** a single workflow (`publish.yml`) fetches the data, commits and publishes.

### F-33 · Info · Automatic inflation is the HICP (Eurostat), not the CPI (INS)
- **Problem:** INS offers no stable data source for automation. The HICP differs slightly from the CPI: in September 2026, 6.5% vs 6.61% in total and 9.3% vs 11.12% for services.
- **Decision:** the HICP. The source appears in the page, and DESIGN §2 shows both values.

## Found before publishing on GitHub

### F-34 · Minor · `vercel.json` left over after choosing GitHub Pages
- **Found by:** Romulus, in the review before publishing.
- **Problem:** the file had been prepared while the host was not chosen yet. After the decision for GitHub Pages it was only noise, and it suggested a host that is not used.
- **Fix:** deleted, and the documents updated.
- **Accepted consequence:** the security headers it set (`frame-ancestors`, `nosniff`, `no-referrer`) cannot be set on GitHub Pages (O-15). The in-page CSP remains, and it covers scripts, fonts and connections.

### F-35 · Major · A provisional author, local paths and provisional links
- **Problem:**
  - every commit had a provisional address, so none would have been linked to the GitHub account;
  - the documents contained the local path (`C:\Users\…`) and `<utilizator>` instead of the site's address;
  - the page had no link to the code.
- **Fix:**
  - the author is the personal account, with GitHub's "noreply" address (the email is not public);
  - the addresses are the real ones, and the local path is gone;
  - the page links to the repo, with `og:url` and `canonical`.
- **Test:** `build.test` → "the public address comes from package.json: og:url and canonical".

### F-36 · Minor · No preview image when sharing
- **Problem:** WhatsApp, Facebook and Discord show a card with an image for links that have an `og:image`. Without it, the link sent to friends showed as plain text. The README did not show what the app looks like either.
- **Fix:**
  - `assets/og.png` (1200×630), with `og:image`, `og:image:alt` and `twitter:card` in the build, at the absolute address from `package.json`;
  - `docs/screenshot.png` in the README.
- **Note:** messaging apps remember the preview. A link sent before publishing may stay without an image.
- **Test:** `build.test` → "the preview image: an absolute address, copied into the build".

## Found when publishing on GitHub (v0.3.1)

### F-37 · Cosmetic · A row of the §5.9 table had ended up at the end of §5.10
- **Where:** the design document (then `BAZA.md`), §5.9 ("Reading numbers") and §5.10 ("Automatic data").
- **Problem:** the row for invalid values („abc”, „”, „12.34.56”) was stuck to the last paragraph of §5.10. Without a header it was not a table: it showed as text with vertical bars at the end of the paragraph, and the §5.9 table was missing it.
- **Fix:** the row is back in the §5.9 table.

### F-38 · Major · No data request ever left: a „ș” in the User-Agent
- **Where:** `scripts/update-data.mjs`, the `user-agent` header.
- **Found:** at the first run in GitHub Actions: „Cannot convert argument to a ByteString because the character at index 55 has a value of 537”.
- **Problem:** the User-Agent ended in „date publice BNR și Eurostat”. HTTP header values may only contain characters with codes up to 255, and „ș” is 537, so `fetch` refused every request before it left: BNR, the ECB and every Eurostat series. The script kept the old data and the job ended in success, so no email came (F-42). The tests did not catch it, because the simulated network ignored the headers.
- **Fix:**
  - an ASCII-only User-Agent, with the repo's address;
  - in the tests, every simulated request goes through `new Request()`, i.e. through the same validation as `fetch`;
  - when every source answers, the test requires zero warnings.
- **Test:** `data.test` → "ASCII-only User-Agent: otherwise fetch rejects every request (F-38)" and "first run: the BNR rates and inflation, from the exact addresses". Checked by mutation: with the „ș” put back, the tests fail.

### F-39 · Minor · The tests' simulated warnings showed up as GitHub Actions annotations
- **Problem:** in Actions, the script writes its warnings as annotations (`::warning::`, `::error::`). The tests run the same script with sources that fail on purpose, so every run's page showed „BNR: HTTP 403”, „BCE: HTTP 503” and the error „Nu există niciun curs”, although none of it had happened. They could mislead exactly when checking O-11 and O-12.
- **Fix:** the tests capture the script's messages and check them, instead of letting them reach the log.
- **Test:** `data.test` → the simulated-network tests check the expected messages.

### F-40 · Major · BNR serves its XML files only on `curs.bnr.ro`
- **Problem:** the addresses used (`www.bnr.ro/nbrfxrates.xml` and the yearly files under `www.bnr.ro/files/xml/years/`) now answer with a 302 to the home page, even from a computer in Romania. `fetch` followed the redirect and got the home page's HTML, without any exchange rate. The log said only „Cursul BNR nu e disponibil”, without a reason.
- **Source:** BNR's page "Utilizarea fișierelor XML pentru preluare curs valutar" (https://curs.bnr.ro/) lists the files, with the same names, only on `curs.bnr.ro`.
- **Fix:**
  - the new addresses, on `curs.bnr.ro`;
  - a redirect is treated as an error and shows in the log with the address it points to („redirected to https://www.bnr.ro/”).
- **Checked on real data,** from a computer in Romania: 28 Oct 2026, EUR 5.3495 and USD 4.8088, as in DESIGN §2.
- **Test:** `data.test` → "first run: the BNR rates and inflation, from the exact addresses" (any other BNR address answers 404) and "BNR redirects to its home page: a clear warning, then the ECB (F-40)". Checked by mutation: with the old addresses, a wrong path or without the redirect check, the tests fail.

### F-41 · Minor · Early January: the script fell back to the ECB although BNR answered
- **Where:** `scripts/update-data.mjs`, the BNR yearly files.
- **Found by:** an independent review, with BNR's real files.
- **Problem:** the yearly files were always those of last year and this year. In the first days of January, the rate from a year ago falls before the first day of last year's file (on 4 Jan 2027, the target is 4 Jan 2026, but the 2026 file starts on 5 Jan), so there was no rate from a year ago and the script used the ECB, although BNR had answered. On 1–2 January, the file of the new year does not exist yet (BNR answers 502), so every run also logged a false warning.
- **Fix:** the years follow from the last day published by BNR (in the 10-day file): the 400-day window decides which yearly files are needed, and a year already covered by those 10 days is not requested.
- **Test:** `data.test` → "early January: still BNR, with the year before and without the file of the new year (F-41)", for 1 and 4 January 2027.

### F-42 · Minor · Stale data passed silently
- **Problem:** when every source failed but old data existed, the job ended in success and no email came. That is how F-38 could have stayed hidden: it was found only because the log was read. The page's badge (F-24) warns visitors after 7 days, but nobody warned the maintainer.
- **Fix:** when the exchange rate is more than 7 days old (the badge's threshold), the job fails and GitHub sends an email. At 6–7 days it is only a warning; the longest normal gap between BNR rates, around holidays, is 4–5 days.
- **Test:** `data.test` → "the rates are over 7 days old: the job fails, so that GitHub sends an email (F-42)" (7 days: a warning; 8 days: a failure).

### F-43 · Minor · A run queued behind a data run republished the previous data
- **Where:** `.github/workflows/publish.yml`.
- **Problem:** every run checked out the commit that had started it. A push run queued behind a data run therefore published the `data/rates.json` from before the bot's commit, until the next data run (usually ~4 hours later; at worst the next working day).
- **Fix:** the checkout takes the tip of `main` when the job starts (`ref: ${{ github.ref }}`).
- **Accepted remainder:** a push that lands in the ~1.5 s between `git pull --rebase` and `git push` makes the data step fail (with an email); the next run recovers.
- **Test:** `workflow.test` → "the tip of main is published, not the commit that triggered the run (F-43)".

### F-44 · Minor · The workflow's permissions were granted to both jobs
- **Problem:** `contents: write`, `pages: write` and `id-token: write` were set for the whole workflow, so the deploy job could write to the repo and the build job could publish.
- **Fix:** no permissions at the workflow level; `build` gets `contents: write` (the data commit) and `pages: read`, `deploy` gets `pages: write` and `id-token: write`.
- **Test:** `workflow.test` → "permissions are granted per job, not to the whole workflow (F-44)".

### F-45 · Minor · Outdated statements in `DESIGN.md` and `README.md`
- **Found by:** an independent review of the documents.
- **Problem:**
  - DESIGN §2 and §6 presented 6.61% (INS) as the page's default, while the page starts from the HICP in `data/rates.json` (6.5% for September 2026);
  - §6 claimed that all its values were checked by the tests, but several rows were not;
  - §10 still spoke of the daily data in the future tense;
  - the README said that the script commits and republishes; the workflow does.
- **Fix:** §2 and §6 are a dated example; every value of §6 is checked by `calc.test`; §10 and the README are corrected.
- **Test:** `calc.test` → "the worked example in DESIGN §6 (…)": every figure of the section.

### F-46 · Minor · No test parsed the page's main script
- **Found:** when the owner asked whether the project needs a linter. A linter would bring dependencies, which the project avoids; the real gap was narrower.
- **Problem:** the tests ran only the `<script id="calc">` block. The page's main script (~400 lines: the form, the table, the counter) was read only as text, so a syntax error in it would have passed every test and stopped the whole page.
- **Fix:** `page.test` parses every inline script of `app.html`.
- **Test:** `page.test` → "every inline script parses: a syntax error would stop the whole page (F-46)". Checked by mutation: a broken function header in the main script fails only this test.

### F-47 · Cosmetic · The busy-port hint gave a Bash command, which does not work in cmd
- **Found:** when testing `start.cmd` on Windows 11 (O-10).
- **Problem:** when the port was busy, the local server suggested `PORT=5174 node serve.mjs` and the PowerShell form. `start.cmd` opens a cmd window, where the Bash form does not work, although F-16 promised an example for cmd.
- **Fix:** the hint lists the command for cmd (`set "PORT=5174" && start.cmd`), PowerShell and macOS/Linux.
- **Test:** `serve.test` → "a busy port: a clear message, with the command for cmd, PowerShell and Bash (F-16, F-47)".

### O-10, resolved · `start.cmd` on a real Windows machine
- **Tested on Windows 11, 29 October 2026:**
  - a normal start: the server answers and the browser opens, after the server is listening (F-15);
  - without Node.js on PATH: the message to install it, and exit code 1;
  - a busy port: the hint with the right commands (F-16, F-47).
