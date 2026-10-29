# FINDINGS: Taxa pe stat (formerly Ceasul leului)

The registry of problems found in the app. Every entry has a stable ID, and IDs are never reused:
- `F-NN`: a problem that was found (fixed, or accepted as a limitation);
- `O-NN`: an open item, not fixed yet or still to be decided.

The first table lists what is fixed; the second, what is still in the app. The details follow, by area.

**Rounds:**
- Review 1: 29 October 2026, version 0.1 (artifact v1), fixed in 0.2 (artifact v2): F-01…F-30.
- Implementing the automatic data: 29 October 2026, F-31…F-33.
- Before publishing on GitHub: F-34…F-36.
- Publishing on GitHub and the first run with real data, with two independent reviews: 29 October 2026, F-37…F-47 (v0.3.1).
- A testing sweep (five testers: the page, the data, security, test coverage, "outside the box"; every finding reproduced by a second agent): 29 October 2026, F-48…F-79 (v0.3.1).
- The open items that could be fixed in the page: 29 October 2026, O-17 and O-18 (v0.3.2).
- A mobile sweep (nine phone and tablet sizes, portrait and landscape, touch emulated): 29 October 2026, F-80…F-82 (v0.3.3).
- An official source for the deposit rate: 29 October 2026, F-83 (v0.3.4).

**Severity:**
- **Major:** a wrong result, an unusable page or a risk when publishing.
- **Minor:** a confusing result or an edge case.
- **Cosmetic:** appearance.
- **Info:** good to know; not a bug.

---

## Fixed

| ID | Sev. | Problem | Status | Test |
|---|---|---|---|---|
| F-01 | Major | The counter was unreadable in the dark theme | Fixed | `page.test`, `e2e.test` |
| F-02 | Major | The decimal comma („6,61”) became 0, without a message | Fixed | `calc.test`, `page.test`, `e2e.test` |
| F-03 | Major | A missing date filled the page with „NaN” | Fixed | `calc.test`, `e2e.test` |
| F-04 | Major | A current date before the reference date gave an absurd pace | Fixed | `calc.test`, `e2e.test` |
| F-05 | Major | Short exchange-rate intervals, extrapolated too far | Fixed | `calc.test`, `e2e.test` |
| F-06 | Minor | The counter rewrote the past when the amount changed | Fixed | — |
| F-07 | Minor | The counter ignored the interest | Fixed | `calc.test` |
| F-08 | Cosmetic | „−0,00” for zero | Fixed | `e2e.test` |
| F-09 | Minor | Absurd values accepted (a 300% tax, −100% inflation) | Fixed | `e2e.test` |
| F-10 | Minor | The chart: clipped labels, tiny text on phones | Fixed | `calc.test` |
| F-11 | Minor | Fees computed differently in the table and the chart | Fixed | `calc.test` |
| F-12 | Minor | Unwanted zoom on iPhone when tapping the fields | Fixed | `page.test` |
| F-13 | Cosmetic | The formatting was redone 10 times a second | Fixed | — |
| F-14 | Cosmetic | „Dobânda netă de 0,00%” when there is no interest | Fixed | — |
| F-15 | Minor | `start.cmd` opened the browser before the server | Fixed | — |
| F-16 | Minor | A busy port gave a technical error, without an explanation | Fixed | `serve.test` |
| F-17 | Minor | The local server served neither fonts nor data | Fixed | `serve.test` |
| F-18 | Major | The design document described the minimum interest rate wrongly, as an approximation | Fixed | `calc.test` |
| F-19 | Major | „Media 12 luni · 9,2%” was used as a rate for the future | Fixed | — |
| F-20 | Major | The premise "inflation keeps rising", only half true | Fixed | — |
| F-21 | Minor | Inflation over 12 months, the exchange rate over 289 days | Fixed | `calc.test` |
| F-22 | Minor | „3.100 lei” vs „6,61% of 50,000 = 3,305 lei” | Fixed | `calc.test` |
| F-23 | Info | The loss against the euro ≠ what you would have saved holding euros | Fixed (a note) | — |
| F-24 | Minor | Outdated default data, without a warning | Fixed | `e2e.test` |
| F-25 | Cosmetic | Mixed date conventions for the BNR rate | Fixed | — |
| F-26 | Major | Google Fonts on a public site in the EU (GDPR) | Fixed | `build.test` |
| F-27 | Major | BNR/INS data cannot be read directly from the browser | Fixed (architecture) | — |
| F-28 | Minor | `app.html` could not be published on a host | Fixed | `build.test` |
| F-29 | Minor | No tests | Fixed | `tests/` |
| F-30 | Minor | No CSP or security headers | Fixed | `build.test`, `e2e.test` |
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
| F-42 | Minor | Stale data passed silently: no email when the data stops updating | Fixed | `fresh.test` |
| F-43 | Minor | A run queued behind a data run republished the previous data | Fixed | `workflow.test` |
| F-44 | Minor | The workflow's permissions were granted to both jobs | Fixed | `workflow.test` |
| F-45 | Minor | Outdated statements in `DESIGN.md` and `README.md` | Fixed | `calc.test` (the §6 example) |
| F-46 | Minor | No test parsed the page's main script | Fixed | `page.test` |
| F-47 | Cosmetic | The busy-port hint gave a Bash command, which does not work in cmd | Fixed | `serve.test` |
| F-48 | Minor | The ECB fallback replaced an equally fresh BNR rate, and the BNR history | Fixed | `data.test` |
| F-49 | Minor | Network errors were logged as a bare „fetch failed” | Fixed | `data.test` |
| F-50 | Minor | A Eurostat series without usable data vanished silently | Fixed | `data.test` |
| F-51 | Minor | The inflation month could move back | Fixed | `data.test` |
| F-52 | Minor | The bot could commit data that the page rejects | Fixed | `data.test`, `workflow.test` |
| F-53 | Info | A broken row in the saved history stopped the BNR branch | Fixed | `data.test` |
| F-54 | Major | Stale data could last for weeks with a green pipeline | Fixed | `fresh.test`, `workflow.test` |
| F-55 | Major | No test ran the page script | Fixed | `e2e.test` |
| F-56 | Minor | The daily 10-day path (O-14) was never tested with a new day | Fixed | `data.test` |
| F-57 | Major | The simulated network answered any address, so the tests did not pin F-31 and F-40 | Fixed | `data.test` |
| F-58 | Minor | Four data tests depended on a file written by an earlier test | Fixed | `data.test` |
| F-59 | Minor | The CSP hashes were computed on the raw file, CRLF included | Fixed | `build.test` |
| F-60 | Minor | The static rules for `app.html` had holes | Fixed | `page.test` |
| F-61 | Minor | Documented formulas and branches had no assertions | Fixed | `calc.test` |
| F-62 | Major | Changing a date kept the rates of the old date: false history | Fixed | `calc.test`, `e2e.test` |
| F-63 | Minor | Data arriving after an edit left stale values in the form | Fixed | `calc.test`, `e2e.test` |
| F-64 | Minor | With deflation, „Pe scurt” contradicted itself | Fixed | `calc.test`, `e2e.test` |
| F-65 | Minor | Implausible exchange rates gave „~-∞%/an” | Fixed | `calc.test`, `e2e.test` |
| F-66 | Minor | Without JavaScript the page said nothing | Fixed | `page.test` |
| F-67 | Minor | „0,500” was read as 500 | Fixed | `calc.test` |
| F-68 | Cosmetic | „-0” was accepted and shown | Fixed | `calc.test` |
| F-69 | Minor | The counter said „fără dobândă și comisioane” when fees were charged | Fixed | `calc.test`, `e2e.test` |
| F-70 | Minor | The HICP badge appeared before Eurostat published | Fixed | `calc.test`, `e2e.test` |
| F-71 | Minor | Hand-set values went stale without a warning | Fixed | `calc.test`, `page.test`, `e2e.test` |
| F-72 | Minor | No 404 page: GitHub's English one, with no way back | Fixed | `build.test` |
| F-73 | Minor | The CSP was not pinned by tests, `script-src` allowed `'self'`, no referrer policy | Fixed | `build.test`, `e2e.test` |
| F-74 | Minor | The Source Sans 3 licence named the wrong copyright holder | Fixed | `build.test` |
| F-75 | Info | Node 20, past its end of life, was still the minimum | Fixed | `build.test` |
| F-76 | Minor | The preview image showed a figure and a month that the data would contradict | Fixed | `build.test` |
| F-77 | Minor | `esc()`, the guard against markup in `rates.json`, was untested | Fixed | `e2e.test` |
| F-78 | Cosmetic | Chart labels were cut („+10 an”, „.000 mil.”) | Fixed | `e2e.test` |
| F-79 | Cosmetic | The date fields cut off the year | Fixed | `e2e.test` |
| F-80 | Minor | On a phone, long values in the loss table ran into the next column (from v0.3.2) | Fixed | `e2e.test` |
| F-81 | Minor | On phones under ~380 px the chart was scaled down, its labels to ~8.5 px | Fixed | `e2e.test` |
| F-82 | Minor | On touch screens the buttons and fields were 30–42 px tall, under the 44 px a finger needs | Fixed | `e2e.test` |
| F-83 | Minor | The deposit rate came from press round-ups and its badge stayed on for want of a newer one | Fixed | `calc.test`, `e2e.test` |
| O-07 | — | The license for the open-source version | Resolved: MIT | — |
| O-09 | — | BNR publishes only on working days, around 13:00 | Resolved: the script uses the last published day | `data.test` |
| O-10 | — | `start.cmd` had not been tested on a real Windows machine | Resolved: tested on Windows 11 | — |
| O-11 | — | The ECB fallback had never been tried on real data | Resolved: checked on real data | — |
| O-12 | — | BNR might refuse automated requests from GitHub's servers | Resolved: it does not | — |
| O-13 | — | The Pages actions targeted Node 20 | Resolved: on their Node 24 versions | `workflow.test` |
| O-14 | — | Every run downloaded both of BNR's yearly files | Resolved: the last 10 days are enough | `data.test` |
| O-17 | — | `prefers-reduced-motion` was read only when the page loaded: turned on later, the counter kept 10 updates a second | Resolved: read at every step of the counter | `e2e.test` |
| O-18 | — | On a phone, the loss table showed only the „Zi” column; the other periods were a sideways scroll away | Resolved: below 640 px each cause is a block, one line per period (F-80); screen readers still get a table | `e2e.test` |

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
| O-08 | Open | GitHub disables scheduled workflows after 60 days without activity in public repos | Probably covered by the bot's near-daily data commits, though GitHub does not define "activity". If the data stops changing, the check after publishing (F-54) emails within 8 days. To turn the schedule back on: `gh workflow enable publish.yml -R RomulusMirauta/taxa-pe-stat`. |
| O-15 | Accepted | GitHub Pages cannot send HTTP headers, and two of them have no `<meta>` form: CSP `frame-ancestors` (no framing by other sites) and `X-Content-Type-Options: nosniff` | A static calculator without accounts has little to lose to framing. The in-page CSP covers scripts, fonts and connections, and the referrer policy is set from a `<meta>` (F-73). Another host (Cloudflare Pages, Netlify) could send them. |
| O-16 | Open (owner's decision) | The repo has no rules protecting `main` and the `v*` tags, any marketplace action may run, and Dependabot does not watch the actions | A ruleset would block force-pushes and deleting `main`, and moving or deleting release tags; Dependabot would open a pull request when an action has a new version (it would have raised O-13 by itself). These change the repo's settings, so they are left to the owner. |

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
  - a badge appears when the exchange rate is more than 7 days old, or when the inflation month is more than 90 days past its first day (75 days until F-70; this document wrongly said "35 days after publication").
- **Test:** `e2e.test` → "the date list flags old data, with words that depend on whether the daily data arrived".

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
- **Accepted consequence:** GitHub Pages cannot send HTTP headers, and two of the ones `vercel.json` set have no `<meta>` form: CSP `frame-ancestors` and `nosniff` (O-15). The in-page CSP remains, and it covers scripts, fonts and connections. The referrer policy does have a `<meta>` form; this entry used to say otherwise, and it is set since F-73.

### F-35 · Major · A provisional author, local paths and provisional links
- **Problem:**
  - every commit had a provisional address, so none would have been linked to the GitHub account;
  - the documents contained the local path (`C:\Users\…`) and `<utilizator>` instead of the site's address;
  - the page had no link to the code.
- **Fix:**
  - the author is the personal account, with GitHub's "noreply" address (the email is not public);
  - the addresses are the real ones, and the local path is gone from the files (in `a0c6006`). It stays in the history: `BAZA.md` had the line „Locație: `C:\Users\R\Desktop\ClaudeZone\…`” from `ff5c0bf` to `4d62ef5`. It shows only the Windows user name and folder names; removing it would mean rewriting the history (every hash and tag would change, and a force-push), so it stays;
  - the page links to the repo, with `og:url` and `canonical`.
- **Test:** `build.test` → "the public address comes from package.json: og:url and canonical".

### F-36 · Minor · No preview image when sharing
- **Problem:** WhatsApp, Facebook and Discord show a card with an image for links that have an `og:image`. Without it, the link sent to friends showed as plain text. The README did not show what the app looks like either.
- **Fix:**
  - `assets/og.png` (1200×630), with `og:image`, `og:image:alt` and `twitter:card` in the build, at the absolute address from `package.json` (replaced by `assets/og-card.png` in F-76);
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
- **Fix:** when the exchange rate is more than 7 days old (the badge's threshold), the run fails and GitHub sends an email. At first the data step itself failed; since F-54, a separate check after the deploy does it, so publishing is never blocked. The longest normal gap between BNR rates, around holidays, is 4–5 days.
- **Test:** `fresh.test` → "the exchange rates: 7 days old is fine, 8 days fails (the threshold of the page badge)".

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

## Found in the testing sweep (v0.3.1)

Five testers looked for what the reviews had missed, each from another angle; every finding below was reproduced by a second, independent agent. Each fix was then checked by mutation: undo it, and a test fails.

### Data and alerts

### F-48 · Minor · The ECB fallback replaced an equally fresh BNR rate, and the BNR history
- **Problem:** when BNR failed once (say a 403 at the 11:30 run), the script switched to the ECB even when the ECB had nothing newer than the rate already saved: the ECB publishes after 16:00 CET. The file became „BCE (rezervă)”, the 400-day BNR history was replaced by the ECB's, and the next BNR run had to download the yearly files again.
- **Fix:** the ECB is used only when it brings a newer day than the saved rate; otherwise the saved BNR rates and their history stay.
- **Test:** `data.test` → "the ECB has no newer day: the saved BNR rates and their history stay (F-48)" (one day behind, the same day, and a newer day that is still used).

### F-49 · Minor · Network errors were logged as a bare „fetch failed”
- **Problem:** Node's `fetch` reports a refused or reset connection only as „fetch failed”, with the reason hidden in `cause`; a timeout said only that the operation was aborted. Neither named the address.
- **Fix:** every network error is logged with its code (`ECONNRESET`, `ENOTFOUND`…) or „no answer within 30 s”, and with the address; errors while reading the body too.
- **Test:** `data.test` → "network errors name the cause and the address (F-49)".

### F-50 · Minor · A Eurostat series without usable data vanished silently
- **Problem:** when the services, 12-month-average or euro-area series came back empty, or in an unexpected shape, it was dropped without a warning; so was a series lagging behind Romania total.
- **Fix:** such an answer is an error that names the address, so it is reported; a series whose newest month differs from Romania total is reported too.
- **Test:** `data.test` → "a Eurostat series without usable data is reported, not dropped silently (F-50)" and "a Eurostat series that lags behind Romania total is reported (F-50)".

### F-51 · Minor · The inflation month could move back
- **Problem:** a partial or stale Eurostat answer (the last two months without values, for example) replaced September with July and dropped services and the average. The exchange rate was protected against this; inflation was not.
- **Fix:** an older month never replaces a newer one, separately for Romania and for the euro area, and a warning says so.
- **Test:** `data.test` → "an older month never replaces a newer one (F-51)" and "Eurostat answers with an older month: the published values stay (F-51)".

### F-52 · Minor · The bot could commit data that the page rejects
- **Problem:** nothing checked the new data before the commit. A file the page rejects (a month written as „2026M10”, for example) would have reached `main`, and the tests that run after the commit would have blocked this deploy and every later one.
- **Fix:** the script checks its result with the page's own validator (`Calc.normalizeRates`) and writes nothing, failing the job, if a section would be rejected; the workflow also runs the tests on the new data before committing it.
- **Test:** `data.test` → "a result the page would reject is not written, and the job fails (F-52)"; `workflow.test` → "the new data passes the tests before the bot commits it (F-52)".

### F-53 · Info · A broken row in the saved history stopped the BNR branch
- **Problem:** a malformed date in one saved row made the BNR code throw, so the yearly files were never tried and the file switched to the ECB with a cryptic warning.
- **Fix:** only rows with a valid date and positive rates are used.
- **Test:** `data.test` → "broken rows in the saved history do not stop BNR (F-53)".

### F-54 · Major · Stale data could last for weeks with a green pipeline
- **Problem:** F-42 made the data step fail when the rate was over 7 days old, but that also stopped a fresh inflation month from being committed and published. Stale inflation, and rates that kept coming from the ECB, raised no alarm at all.
- **Fix:** `scripts/check-fresh.mjs` runs in a separate job after the deploy and fails, so GitHub emails the owner, when the rates are more than 7 days old or come from the ECB instead of BNR, or when the newest inflation month is more than 95 days past its first day (the January index comes out at the end of February, 86 days after 1 December). It never blocks publishing; the data script only warns.
- **Test:** `fresh.test` (the limits, and the exit code with a `::error::` annotation); `workflow.test` → "after the deploy, a separate job checks that the data is still updating (F-54)".

### Tests

### F-55 · Major · No test ran the page script
- **Found by:** the coverage tester: of 43 realistic one-line regressions, the suite caught 6.
- **Problem:** the page script (~400 lines: the form, the table, the counter, loading `data/rates.json`) was never executed by a test, so a runtime error, a CSP the browser rejects or a broken data load passed every test.
- **Fix:** `tests/e2e.test.mjs` builds the site, serves it under `/taxa-pe-stat/` as GitHub Pages does, and drives headless Chrome over the DevTools protocol with Node's own WebSocket, without any dependency. It skips locally when Chrome is missing, and fails in GitHub Actions in that case.
- **Test:** `e2e.test`: 8 tests, about 2 seconds.

### F-56 · Minor · The daily 10-day path (O-14) was never tested with a new day
- **Problem:** the only test of the 10-day path ran again with identical data, so leaving the 10 days out of the merge, or letting the saved history win over them, passed every test.
- **Fix:** tests with yesterday's history plus a new day, and with a correction inside the 10 days.
- **Test:** `data.test` → "a new day after yesterday's history: only the last 10 days, and today's rate gets in (O-14)" and "a correction within the last 10 days replaces the saved value (O-14)".

### F-57 · Major · The simulated network answered any address
- **Problem:** the simulated sources answered any URL on the right host, so the tests credited for F-31 and F-40 did not pin those fixes: a wrong path on `curs.bnr.ro`, the discontinued Eurostat dataset or a too short ECB period all passed. The User-Agent and the timeout were not checked either.
- **Fix:** BNR, the ECB and Eurostat answer only at their exact addresses, and Eurostat rejects unknown parameters as the real API does; every request is checked for the User-Agent and a timeout.
- **Test:** `data.test` → "first run: the BNR rates and inflation, from the exact addresses", "BNR refuses: switches to the ECB, at its exact address" and "every request carried the User-Agent and a timeout (F-38)". 18 mutations of the script, all caught.

### F-58 · Minor · Four data tests depended on a file written by an earlier test
- **Problem:** they failed when run alone or in another order.
- **Fix:** a baseline run in `before()`; every test starts from its own copy of it.
- **Test:** `data.test`, the simulated-network block.

### F-59 · Minor · The CSP hashes were computed on the raw file, CRLF included
- **Problem:** the browser hashes the script text after turning CRLF into LF; `build.mjs` hashed the raw file, so an `app.html` with Windows line endings would have passed every test while Chrome blocked both scripts.
- **Fix:** `wrap()` and `inlineScriptHashes()` turn CRLF and CR into LF first.
- **Test:** `build.test` → the "wrap() and the CSP hashes" tests.

### F-60 · Minor · The static rules for `app.html` had holes
- **Problem:** an absolute fetch path (which breaks under `/taxa-pe-stat/`), inline event handlers (which the CSP blocks), the exact F-01 regression and broken theme CSS all passed.
- **Fix:** `page.test` checks them, including the counter's contrast in both themes.
- **Test:** `page.test`.

### F-61 · Minor · Documented formulas and branches had no assertions
- **Problem:** the fees term of the counter (§5.6), most `niceStep` steps and the 180-day hint were not asserted.
- **Fix:** `calc.test` asserts them; the 180-day rule moved into `Calc.isShortInterval`.
- **Test:** `calc.test`.

### The page

### F-62 · Major · Changing a date kept the rates of the old date: false history
- **Found by:** two testers, independently.
- **Problem:** the rate fields did not follow the date fields. With the reference date moved a year back, the page kept the rates of 28 Oct 2025, so it stated false history („valorau 9.834,00 € pe 28 oct. 2024”) and projected EUR/USD losses about 10 times too large.
- **Fix:**
  - the page keeps BNR's daily history from `data/rates.json`, after checking it;
  - when a date changes, that side's rates come from it (`Calc.rateOn`: the last BNR day at most 10 days before), and the hint says which BNR day is used;
  - without such a day, or without a history, the fields are marked, the error asks for the rate, and the currency rows and facts show „—”;
  - rates the user typed stay theirs; a current date in the future is an error; "today" is the visitor's local date; the date list shows the data's own date.
- **Test:** `calc.test` → "the BNR rate on a date (rateOn)" and "the BNR history from data/rates.json (normalizeRates)"; `e2e.test` → "a date change takes the BNR rate of that day; without one, the page says so and computes nothing".

### F-63 · Minor · Data arriving after an edit left stale values in the form
- **Problem:** one flag for the whole form: after any edit, even of the sum, no field was filled when `data/rates.json` arrived, while the header and the footer already showed the new dates.
- **Fix:** `Calc.mergeInputs` writes the fields the user has not changed; the dates and rates are written together or not at all, and the focused field never.
- **Test:** `calc.test` → "data that arrives late (mergeInputs)"; `e2e.test` → "data that arrives after the user typed in Suma still fills the fields the user did not touch".

### F-64 · Minor · With deflation, „Pe scurt” contradicted itself
- **Problem:** with negative inflation, a green „+” was described as purchasing power lost, „cu -500,00 lei mai mult”, and the minimum interest rate was negative.
- **Fix:** the words follow the sign (pierdută / câștigată, mai mult / mai puțin); the minimum rate is never below 0, with a short explanation when any rate keeps up.
- **Test:** `calc.test` (`breakEvenRate`); `e2e.test`.

### F-65 · Minor · Implausible exchange rates gave „~-∞%/an”
- **Problem:** a misplaced comma (53,495 instead of 5,3495) over a short interval gave „~-∞%/an” or numbers 50 digits long.
- **Fix:** `Calc.fxPairOk`: both rates under 1000 and at most 4 times apart (the largest real ratio since 2005 is about 2.15), in the form and in the data; no extrapolation beyond 1000% a year.
- **Test:** `calc.test`; `e2e.test`.

### F-66 · Minor · Without JavaScript the page said nothing
- **Fix:** a `<noscript>` message; the counter starts at „—” instead of a fake zero; the counter and the form are hidden when scripts do not run.
- **Test:** `page.test` → "a <noscript> message explains why the page is empty" and the two tests after it.

### F-67 · Minor · „0,500” was read as 500
- **Problem:** the thousands rule accepted a first group starting with 0, so „0,500” (half a leu) became 500 and „0.050” became 50.
- **Fix:** a group of thousands cannot start with 0.
- **Test:** `calc.test` → "parseNum: …".

### F-68 · Cosmetic · „-0” was accepted and shown
- **Problem:** „-0” showed as „Pentru -0 lei”, „-0,00 €”, „-0%”.
- **Fix:** `parseNum` returns 0, and the formatters never put a sign on zero.
- **Test:** `calc.test`.

### F-69 · Minor · The counter said „fără dobândă și comisioane” when fees were charged
- **Fix:** `Calc.accountNote`, e.g. „fără dobândă, dar cu 240 lei comisioane pe an”, for the counter and the chart.
- **Test:** `calc.test`; `e2e.test`.

### F-70 · Minor · The HICP badge appeared before Eurostat published
- **Problem:** „a apărut probabil o lună nouă” appeared 75 days after the first day of the data's month, but the next month comes out around day 78–81 (the January index at the end of February), so it showed every month for nothing.
- **Fix:** `Calc.inflationOverdue`: 90 days; with the daily data loaded, the badge says that the update looks late.
- **Test:** `calc.test` → "dates of the data: when the page flags them as old" (fixed dates); `e2e.test`.

### F-71 · Minor · Hand-set values went stale without a warning
- **Problem:** the BNR forecast, the deposit and Tezaur rates and the interest tax are set by hand in `DATA`; their labels („Prognoza BNR, dec. 2027”, „august 2026”, „Impozitul de 10%”) were written into the script, and nothing warned when they got old.
- **Fix:** every hand-set value has the month it is from; the labels are built from `DATA`; the date list shows a badge when the BNR report is more than 100 days old or a rate more than 90 days; the forecast button disappears after its target month.
- **Note:** on 29 Oct 2026 the deposit rate, from July 2026, already shows the badge: no newer source was found.
- **Test:** `calc.test`; `page.test` → "their labels come from DATA: no month, year or tax rate written in the page script"; `e2e.test`.

### F-78 · Cosmetic · Chart labels were cut („+10 an”, „.000 mil.”)
- **Problem:** the last label of the time axis read „+10 an” at every width, and the value labels from „1.000 mil.” up lost their first digits.
- **Fix:** more room on the right, and a left margin that grows with the longest label.
- **Test:** `e2e.test` → "the chart labels and the date fields fit, with large sums too, at 1280 and 320 px (F-78, F-79)".

### F-79 · Cosmetic · The date fields cut off the year
- **Problem:** at 320–360 px, and at 1280 px with a common Windows date format, the year was cut („28.10.2(”).
- **Fix:** the two dates sit side by side only when both fit, at least 170 px each; otherwise they stack.
- **Test:** `e2e.test`, the same test as F-78.

### The site and security

### F-72 · Minor · No 404 page
- **Problem:** a mistyped link landed on GitHub's English 404 page, with no way back to the calculator.
- **Fix:** `build.mjs` writes a self-contained `404.html`, in Romanian, with the site's colours, its own CSP and one link to the calculator; no scripts, no timed redirect.
- **Test:** `build.test` → the "404.html" tests.

### F-73 · Minor · The CSP was not pinned by tests, `script-src` allowed `'self'`, no referrer policy
- **Problem:** a weakened CSP plus an external image passed every test; `script-src 'self'` allowed any script on the shared `github.io` address; visitors' browsers sent the page's address to the sites it links to.
- **Fix:** `script-src` lists only the hashes of the two inline scripts; the tests pin the exact CSP and check that nothing loads from another site; `<meta name="referrer" content="no-referrer">`.
- **Test:** `build.test` → "CSP: exactly these directives…", "no referrer…", "nothing loads from another site…"; `e2e.test` (no CSP violations, no requests to other sites).

### F-74 · Minor · The Source Sans 3 licence named the wrong copyright holder
- **Problem:** `fonts/OFL-source-sans-3.txt` named „Google Inc.”; the font and its upstream name Adobe, with the Reserved Font Name 'Source'.
- **Fix:** the copyright line from upstream (`adobe-fonts/source-sans`).
- **Test:** `build.test` → "every font comes with its OFL licence, which names the copyright holder and Reserved Font Name written in the font" (it reads the notice inside each WOFF2).

### F-75 · Info · Node 20, past its end of life, was still the minimum
- **Fix:** `package.json` and the README require Node 22: Node 20 reached its end of life on 30 April 2026, and the end-to-end test needs Node's WebSocket.
- **Test:** `build.test`.

### F-76 · Minor · The preview image showed a figure and a month that the data would contradict
- **Problem:** `assets/og.png` showed „−8,63 lei pe zi” and „sept. 2026”.
- **Fix:** `assets/og-card.png`, the same design without figures or dates, under a new name so that messaging apps fetch it again; the old file is no longer published. Its template is `docs/og-card.html`.
- **Test:** `build.test` → "the preview image: an absolute address, copied into the build".

### F-77 · Minor · `esc()`, the guard against markup in `rates.json`, was untested
- **Problem:** `esc()` is the only guard against markup in the source labels that come from `data/rates.json`; removing it passed every test.
- **Fix:** the end-to-end test serves a `rates.json` with markup in its labels and checks that it shows as text.
- **Test:** `e2e.test` → "without data, or with broken data: the built-in values stay, without errors; the text from the data is not HTML".

## Found in the mobile sweep (v0.3.3)

Headless Chrome at 320×568, 360×740, 375×667, 390×844, 430×932, 568×320, 740×360, 844×390 and 768×1024, with touch emulated, at 50.000 and 5.000.000.000 lei: sideways overflow, cells narrower than their content, touch targets, font sizes in the form, small text, the chart's scale.

### F-80 · Minor · On a phone, long values in the loss table ran into the next column
- **Problem:** the phone layout of v0.3.2 (O-18) put the values two by two. At 320 px even „−3.051,64 lei” was wider than its column (125 > 117 px) and the table scrolled sideways by 8 px; with large sums the values overlapped („−862.594,07 lei−6.035.034,27”). Letting them wrap broke numbers in the middle („−6.035.034,2” / „7 lei”).
- **Fix:** one line per period, the name on the left and the value on the right; a value that does not fit beside the name moves, whole, to the next line, still on the right.
- **Test:** `e2e.test` → "on a phone the loss table shows every period, one per line, without sideways scrolling or broken numbers…" (320 and 400 px, 50.000 and 5.000.000.000 lei; it fails with either earlier layout).

### F-81 · Minor · On phones under ~380 px the chart was scaled down, its labels with it
- **Problem:** the drawing was never narrower than 320 units, so in a 246 px container (a 320 px phone) it was scaled to 0.77, and its 11 px labels to about 8.5 px.
- **Fix:** the drawing is as wide as its container, down to 200 px.
- **Test:** `e2e.test` → "on a phone the chart is not scaled down: its labels keep their size" (320, 360, 375 px).

### F-82 · Minor · Touch targets under 44 px
- **Problem:** on a phone the scenario buttons were 30 px tall, the mode toggle 33 px and the fields 42 px. They meet WCAG's 24 px minimum, but 44 px is what a finger needs (Apple's guideline, WCAG 2.5.5).
- **Fix:** on touch screens (`pointer: coarse`), fields, scenario buttons and the toggle are at least 44 px tall; with a mouse nothing changes.
- **Test:** `e2e.test` → "on a touch screen every field and button is at least 44 px tall".

## Found while looking for a deposit-rate source (v0.3.4)

### F-83 · Minor · The deposit rate came from press round-ups, and its badge stayed on
- **Problem:** the deposit rate (5.5%, „bănci mari”) was taken from press round-ups of bank offers, with no official source behind it. On 29 October 2026 no round-up newer than July was found, so the „pot fi depășite” badge stayed on, and one badge covered both the deposit and the Tezaur rates.
- **Fix:** the rate is BNR's average for new household term deposits in lei, 6–12 months (Buletin lunar, table 10.1.2): 5.51% in July 2026. BNR publishes it about two months after its month, so its badge („a apărut probabil o lună nouă”) comes 150 days after the month's first day, about 4 months after its end; Tezaur keeps 90 days and its own badge. The lag is explained under the scenario buttons, in the sources at the bottom of the page and in the README.
- **Test:** `calc.test` → "the BNR deposit rate, published about two months after its month, only after 150 days", "the Tezaur rate after 90 days"; `e2e.test` → the date list and the scenario buttons.
