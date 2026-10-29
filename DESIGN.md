# Taxa pe stat: design

Former name: *Ceasul leului* (renamed on 29 October 2026).

The reference document: why the app exists, what data it relies on, what it computes and how. Problems found are in [`FINDINGS.md`](FINDINGS.md).

**Rule:** if you change the logic in `app.html`, update §5 and the tests in `tests/calc.test.mjs`.

Updated: 29 October 2026 (after publishing on GitHub Pages and the first run with real data).

The app's interface is in Romanian. Quoted labels below („Pe scurt”, „Cu dobânda netă”) are the names used in the page.

---

## 1. What the app does

It computes the **daily, weekly, monthly and yearly** loss of an amount kept in lei, from three causes:

1. **Inflation:** the loss of purchasing power in lei.
2. **Depreciation against the euro:** the same amount is worth fewer and fewer euros.
3. **Depreciation against the dollar:** the same, in dollars.

Optionally, the calculation takes into account the **net interest** (after tax) and **bank fees**.

Besides the table, the page has:
- a line with **the date of each source**, with a badge when it is old: the exchange rate after 7 days, the inflation month 90 days after its first day, the BNR report after 100 days, the interest rates after 90 days (FINDINGS F-24, F-70, F-71);
- a **live counter** with the effect of inflation since you opened the page. It follows the calculation mode, so it also shows the gain when the interest beats inflation;
- the **„Pe scurt”** section: the loss already realised in EUR and USD, the loss over a year, how many extra lei you need next year and the minimum interest rate to keep up;
- a **10-year chart**, without interest and with the net interest.

The fields accept numbers written the Romanian way („6,61”, „50.000”) or the English way. Invalid fields are marked and explained. When you change a date, the exchange rates of that day come from BNR's history in `data/rates.json` (§5.3).

On a phone (below 640 px) the table does not fit: each cause becomes a block, one line per period (FINDINGS O-18, F-80). On touch screens, fields and buttons are at least 44 px tall (F-82).

The exchange rates and inflation update themselves on every working day (§5.10).

---

## 2. Reference data (29 October 2026)

A snapshot of the sources on 29 October 2026. The page itself starts from `data/rates.json` (exchange rates and inflation, updated automatically: §5.10); the interest rates and the BNR forecast are set in `app.html`, in `DATA`.

### Inflation

INS (the National Institute of Statistics), release of 13 Oct 2026:

| Indicator | Value |
|---|---|
| **Annual CPI rate, Sept 2026 vs Sept 2025** | **6.61%** |
| 12-month average rate (Oct 2025 – Sept 2026 vs the 12 months before) | 9.2% |
| Year to date (Sept 2026 vs Dec 2025) | 5.4% |
| Monthly (Sept vs Aug 2026) | 0.77% |
| HICP (EU harmonised), Sept 2026 | 6.5% (the rate the app uses, from `data/rates.json`) |

By category, Sept 2026 vs Sept 2025:

| Category | Increase |
|---|---|
| Services | **11.12%** |
| Non-food goods | 7.06% |
| Food | 3% |

The annual rate in 2026:

| June | July | August | September |
|---|---|---|---|
| 10.4% | 8.2% | 6.2% | 6.6% |

The summer drop is a **base effect**: the price rises of July–August 2025 (higher VAT, the end of the energy price cap) left the 12-month window. Prices keep rising, but more slowly than a year ago.

**BNR forecast** (August 2026 report): 6.1% at the end of 2026 and 3.4% at the end of 2027.

**Euro area** (Eurostat): 3.8% in September 2026, up from 3.2% in August, pushed by energy and services.

**What the app uses (automatically, since October 2026): Eurostat, HICP.** INS has no stable data source for automation, so inflation comes from Eurostat, from the harmonised index (dataset `prc_hicp_minr`). It is very close to the INS index (FINDINGS F-33):

| Indicator (Sept 2026) | CPI, INS | HICP, Eurostat (in the app) |
|---|---|---|
| Annual rate | 6.61% | **6.5%** |
| Services | 11.12% | **9.3%** |
| 12-month average | 9.2% | **8.4%** |
| Euro area | — | **3.8%** |

**What this means for the app:**
- the starting rate is the annual one;
- the 12-month average looks backwards and is not used as a rate for the future (FINDINGS F-19);
- the scenario buttons are: the last 12 months, services only and the BNR forecast (3.4%).

### BNR exchange rates

Publication dates, as in BNR's XML:

| Date | EUR | USD |
|---|---|---|
| 28 Oct 2025 | 5.0844 | 4.3591 |
| 28 Oct 2026 | 5.3495 | 4.8088 |
| EUR all-time high, 6 Oct 2026 | 5.3527 | — |

Over the last 12 months (365 days):

| Currency | The leu lost |
|---|---|
| EUR | **4.96%** |
| USD | **9.35%** |

The dollar also strengthened against the euro: EUR/USD fell from 1.1664 to 1.1124.

By default, the app uses **the same 12-month interval as annual inflation**. Under 180 days a warning appears, because extrapolating to a year exaggerates (FINDINGS F-05).

### Interest and taxes (indicative, 2026)

| Product | Interest | Tax |
|---|---|---|
| Current account | ~0% | — |
| Lei deposit, 12 months, big banks (BT, BCR, BRD, Raiffeisen, CEC) | 5.2–5.5% (July 2026) | 10%, withheld at source |
| Lei deposit, 12 months, best offers | up to ~7% | 10% |
| Tezaur, October 2026 | 1 year 6.5% · 3 years 7% · 5 years 7.5% | 0% (tax-free) |
| Fidelis, October 2026 | 2 years 6.6% · 4 years 7.15% · 10 years 7.75% | 0% (tax-free) |

**In the page (`DATA` in `app.html`):** every hand-set value has the month it is from: the deposit rate 5.5% (July 2026), Tezaur 1 year 6.5% (October 2026), the tax 10% (October 2026), and the BNR forecast 3.4% for December 2027 (the August 2026 report). The labels are built from these values, and the page flags them when they get old (F-71). On 29 October 2026 no newer source for the deposit rates was found, so the page shows that they may be out of date.

Other tax rules:
- The tax on interest stayed at 10% in 2026; the tax on dividends went up to 16%.
- **CASS 10%** (the health contribution) may be added when investment income exceeds 6 gross minimum wages a year. The app does not compute it (FINDINGS O-01).

---

## 3. What makes money in lei "lose" value

| Cause | How it affects you |
|---|---|
| **Inflation** | The same lei buy less. The main cause. |
| **Depreciation against EUR/USD** | Matters only for spending tied to foreign currency: holidays, loans in euros, imported goods, electronics. |
| **Tax on interest** | 10% of the interest, plus CASS above the threshold. It cuts exactly the part that should make up for inflation. |
| **Opportunity cost** | Money in a current account loses all of inflation. It is the loss you control most easily. |
| **Bank fees** | Account management, card, withdrawals. |
| **The FX spread** | The bank sells euros above the BNR rate, usually by 1–3%, at every conversion. |
| **Income that does not keep up** | If your income grows more slowly than prices, you also lose on the flow of money. |
| **Indirect taxes (VAT, excise)** | They are part of inflation; they explain the jump of summer 2025. |

**The euro loses value too:** euro-area inflation was 3.8% in September 2026. The „Față de EUR” row shows how much your lei are worth in euros, not how much you would have saved by holding euros (FINDINGS F-23).

---

## 4. Existing apps

None combines Romanian inflation, the BNR exchange rate and the net interest.

| Project | What it does | Limitation |
|---|---|---|
| [Inflation Calculator (Android, MIT)](https://alternativeto.net/software/inflation-calculator/about) | Purchasing power between two years | Only the USA, the UK, France |
| [finkit (CLI, Go)](https://github.com/David-DAM/finkit) | The loss at a given rate; currency conversion | No Romanian data, no depreciation |
| [inflatie-calculator (NL)](https://github.com/NickHuijgen/inflatie-calculator) | Inflation with official data (CBS) | Only the Netherlands |

---

## 5. Calculation logic

The pure functions are in `app.html`, in the `<script id="calc">` block, and are tested in `tests/calc.test.mjs`.

### Notation

| Symbol | What it is | Field |
|---|---|---|
| `S` | the amount in lei | `sum` |
| `π` | annual inflation (a fraction, e.g. 0.0661) | `infl` |
| `r` | the gross annual interest rate | `rate` |
| `τ` | the tax on interest | `tax` |
| `i = r·(1−τ)` | the net annual interest rate | — |
| `F` | fees, lei per year | `fees` |
| `c₀`, `c₁` | the exchange rate (lei for 1 EUR/USD) on the reference date and now | `eur0/eur1`, `usd0/usd1` |
| `D` | days between the two dates | `d0`, `d1` |
| `n` | the days of the period: 1, 7, 365/12, 365 | — |
| `y = n/365` | the period in years | — |

**The calculation modes:**
- **without interest** („Fără dobândă”): `g = 1`, fees are ignored;
- **with the net interest** („Cu dobânda netă”): `g = 1 + i`, fees are paid along the way.

Growth is **compounded**.

### 5.1 The model (a single one, used everywhere)

```
sold_nominal(y) = S · g^y − F·y                  // nominal lei after y years
valoare_reală(y) = max(0, sold_nominal(y)) / (1+π)^y    // in today's lei
```

(`sold_nominal` is the nominal balance, `valoare_reală` the real value.)

### 5.2 The loss from inflation (today's lei)

```
pierdere(n) = S − sold_nominal(y) / (1+π)^y
```

Without fees, the formula becomes `S · (1 − (g/(1+π))^y)`.

A negative value means a real gain: the interest beats inflation. The page shows it in green, with „+”.

### 5.3 The loss against EUR / USD (in the foreign currency)

```
k = c₀ / c₁                         // how much of the value in foreign currency is left
d = 1 − k^(365/D)                   // the annual rate; at D = 365, d = 1 − k exactly
pierdere_valută(n) = (S − sold_nominal(y) · (1−d)^y) / c₁
```

Assumption: the leu keeps moving at the pace of the chosen interval.

**The rates follow the dates** (F-62): when a date changes, that side's EUR and USD rates come from BNR's daily history in `data/rates.json` (`Calc.rateOn`: the last BNR day on or before the date, at most 10 days before it). Without such a day, or without a history, the page asks for the rate and shows „—” instead of computing with a rate from another date. Rates typed by the user stay theirs.

Validation:
- without a valid interval (`D ≤ 0`, missing dates) nothing is computed; a current date in the future is an error;
- the two rates of a currency must be under 1000 and at most 4 times apart (`Calc.fxPairOk`; a misplaced comma changes a rate 10 times, while the largest real ratio since 2005 is about 2.15), F-65;
- a pace beyond 1000% a year is not extrapolated („—”);
- under 180 days a warning appears (`Calc.isShortInterval`).

### 5.4 „Pe scurt” (realised, not projected)

```
valoare_atunci = S / c₀ ;  valoare_acum = S / c₁ ;  diferență = valoare_acum − valoare_atunci
pierdere_un_an = S · (1 − 1/(1+π))        // purchasing power, today's lei
lei_în_plus    = S · π                    // how many extra lei you need next year for the same basket
```

At 50,000 lei and 6.61%: **3,100 lei** lost in today's lei and **3,305 lei** more needed next year. They are two faces of the same inflation (FINDINGS F-22).

The words follow the sign of the rounded value: purchasing power „pierdută” or „câștigată”, lei „mai mult” or „mai puțin”, and neutral at zero, so deflation reads correctly (F-64).

### 5.5 The minimum gross interest rate (exact)

The real value stays the same after a year:

```
(S·(1+i) − F) / (1+π) = S   ⟺   i = π + F/S   ⟺   r_minim = (π + F/S) / (1 − τ)
```

Without fees: `r_minim = π / (1 − τ)`.

The formula is exact, not approximate; an earlier version of this document got it wrong (FINDINGS F-18). At a 100% tax there is no answer. When `π + F/S ≤ 0` (prices fall faster than the fees eat), any rate keeps up, so the page shows 0% instead of a negative rate (F-64).

### 5.6 The live counter

The instantaneous rate of the real loss:

```
lei_pe_an = S · (ln(1+π) − ln g) + F       // without interest: S · ln(1+π)
lei_pe_secundă = lei_pe_an / (365 · 86.400)
```

The counter adds up at every step (100 ms, or 1 s with "reduced motion", read at every step: FINDINGS O-17), at the rate of that moment. If you change the amount, the past is not recomputed (FINDINGS F-06).

### 5.7 The 10-year chart

The real value for `t = 0…10` years, in two cases:
- without interest;
- with the net interest and the fees from the form.

The axis uses a "round" step (1, 2, 2.5, 5 × 10ⁿ). It assumes constant inflation.

### 5.8 Why the losses by cause do NOT add up

Romanian inflation already includes part of the exchange-rate effect: imported goods get more expensive when the leu falls. Adding inflation to depreciation counts that twice. That is why the page has separate rows and no total.

### 5.9 Reading numbers

| Written | Read as | Note |
|---|---|---|
| „6,61” / „6.61” / „6,61%” | 6.61 | |
| „1.234,56” / „1,234.56” | 1234.56 | |
| „50.000” / „50,000” / „50 000” | 50000 | for amounts and fees |
| „50.000” | 50 | for rates, the dot is decimal |
| „0,500” / „0.050” | 0.5 / 0.05 | a group of thousands never starts with 0 (F-67) |
| „-0” | 0 | never shown as „-0” (F-68) |
| „abc”, „”, „12.34.56” | invalid | the field is marked; it does not become 0 |

### 5.10 Automatic data

The data is updated on GitHub's servers, without your computer.

1. **When:** on working days, at 13:30 and 17:30 Romanian time in winter (an hour later in summer). BNR publishes around 13:00; the second run is a safety net.
2. **What:** `scripts/update-data.mjs` fetches:
   - **exchange rates:** BNR's XML files from `curs.bnr.ro` (FINDINGS F-40). Normally only the last 10 days (`nbrfxrates10days.xml`), joined to the history already saved in `data/rates.json` (O-14). The yearly files are fetched only when that history is missing, comes from the ECB, does not overlap those 10 days or does not cover 400 days without gaps; which years are needed follows from the last published day (F-41). From the series, the script picks today's rate and the one from a year ago (the last working day at most 10 days before the same date). If BNR does not answer, or redirects (F-40), it uses the ECB rates, but only when the ECB has a newer day than the saved rate (F-48);
   - **inflation:** Eurostat, HICP (`prc_hicp_minr`): Romania total, services, the 12-month average and the euro area. An older month never replaces a newer one (F-51), and a series without usable data is reported (F-50).
3. **Where:** before writing, the script checks its result with the page's own validator (`Calc.normalizeRates`) and writes nothing if the page would reject it (F-52). It writes `data/rates.json` only if something changed. The workflow runs the tests on the new data, commits it as `github-actions[bot]` („data: rates …”), runs the tests again, builds and publishes the tip of `main` (F-43).
4. **When something fails:**
   - a source is unavailable → the previous values stay and a warning appears in Actions, with the cause and the address (F-49);
   - no exchange rate at all, not even an old one, or a result the page would reject → the job fails and GitHub sends an email;
   - after the deploy, `scripts/check-fresh.mjs` fails the run, with an email, when the rates are more than 7 days old (the page badge's threshold) or come from the ECB, or when the inflation month is more than 95 days past its first day (F-42, F-54). Publishing is never blocked by it.
5. **In the page:** `app.html` reads `data/rates.json` from the same site and validates it (`Calc.normalizeRates`, which also keeps BNR's daily history for §5.3). Whatever fails validation is ignored and the page's own values stay. Data that arrives after you have changed the form fills only the fields you did not touch; the dates and rates are filled together or not at all (F-63).

Tested in `tests/data.test.mjs`, with a simulated network that answers only at the exact addresses of the sources and checks every request like `fetch` does: parsing each source, the rate from a year ago, the 10-day path with a new day and its fallbacks, January, the ECB fallback and when it is not used, network errors, older months, a result the page would reject, keeping old data. `tests/fresh.test.mjs` checks the limits of the check after publishing; `tests/workflow.test.mjs` the workflow: per-job permissions, the commit that gets published, the order of the steps, the test before the bot's commit and the check job.

---

## 6. Worked example

Example (29 October 2026): `S` = 50,000 lei, `π` = 6.61% (CPI, INS), BNR rates of 28 Oct 2025 → 28 Oct 2026. The page starts with the inflation and the rates from `data/rates.json` (on 29 Oct 2026: HICP 6.5%), so its figures differ slightly.

**The real loss by period:**

| Where the money sits | Day | Week | Month | Year |
|---|---|---|---|---|
| Current account (0%) | −8.77 | −61.34 | −265.99 | −3,100.08 lei |
| Deposit 5.5% gross (4.95% net) | −2.15 | −15.05 | −65.35 | −778.54 lei |
| Tezaur 1 year, 6.5% tax-free | −0.14 | −0.99 | −4.30 | −51.59 lei |
| Fidelis 4 years, 7.15% tax-free | +0.69 | +4.85 | +21.06 | +253.26 lei |

**Against foreign currency, already realised (28 Oct 2025 → 28 Oct 2026):**
- EUR: €9,834.00 → €9,346.67, i.e. **−€487.33**
- USD: $11,470.26 → $10,397.60, i.e. **−$1,072.65**

**Against foreign currency, projected over a year (if the pace continues):**

| | EUR | USD |
|---|---|---|
| Current account | −€463.18 | −$972.34 |
| Deposit 5.5% | −€23.45 | −$505.79 |

**In 10 years, in today's lei:**
- without interest: 26,363 lei;
- deposit 5.5%: 42,738 lei.

**Other figures:**
- the minimum gross interest rate, with a 10% tax: **7.34%**; without tax: 6.61%;
- extra lei needed next year: 3,305 lei.

All the values are checked by `tests/calc.test.mjs`.

---

## 7. Conclusions

Facts, not investment advice:

- The figure that matters is the **real loss**, i.e. inflation minus the net interest. That is what the „Inflație” row shows in the „Cu dobânda netă” mode.
- At 6.61%:
  - a current account loses ~3,100 lei a year on 50,000 lei;
  - a typical deposit at a big bank (5.5% gross) still loses ~780 lei a year;
  - Tezaur for 1 year is close to break-even;
  - tax-free rates above 6.61% (Fidelis 4 years, Tezaur 3–5 years) are above today's inflation.
- The loss against EUR/USD matters only for spending in foreign currency. The euro has inflation too (3.8%).
- **The premise "inflation keeps rising" needs nuance.** Prices rise continuously, but the annual rate fell sharply in the summer (base effect) and rose slightly in September. For the future, the app offers scenarios, not a single figure.
- The loss per day is a good motivator (~9 lei a day on 50,000 lei in a current account), but decisions are made on the yearly figures.

This is not financial advice.

---

## 8. The app's limitations

- **The exchange rates and inflation are automatic; the BNR forecast and the interest rates are not.** Those are updated by hand, in `app.html` (`DATA`), each with the month it is from; the page flags them when they get old (F-71). BNR publishes its inflation report every quarter (February, May, August, November).
- Inflation and the leu's pace are assumed **constant** in the projections.
- It does not model:
  - CASS;
  - the FX spread;
  - personal inflation by category;
  - the full comparison of lei vs euros.

  Details: FINDINGS O-01…O-04; ideas: [`docs/IDEAS.md`](docs/IDEAS.md).
- The pace of the exchange rate comes from a single interval, so it depends on the dates chosen.

---

## 9. Project structure

**Site:** https://romulusmirauta.github.io/taxa-pe-stat/
**Code:** https://github.com/RomulusMirauta/taxa-pe-stat
**How we work (Claude, the local copy):** [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md)

| File / folder | Role |
|---|---|
| `app.html` | **The single source.** An HTML fragment, wrapped by `build.mjs` for the site. |
| `build.mjs` | Produces the complete `dist/index.html`, with local fonts, CSP and `<head>`, and a self-contained `dist/404.html`. |
| `serve.mjs` | A local server, without dependencies: the same page as on the site, with automatic reload. |
| `start.cmd` | Double-click on Windows: starts the server and opens the browser. |
| `fonts/` | The fonts, hosted locally (OFL). |
| `tests/` | The tests (`node:test`). All the project's tests live here; `e2e.test.mjs` drives the built page in headless Chrome and skips when Chrome is missing (it fails in GitHub Actions in that case). |
| `scripts/update-data.mjs` | Fetches the exchange rates (BNR, with the ECB as fallback) and inflation (Eurostat) and writes `data/rates.json` (§5.10). |
| `scripts/check-fresh.mjs` | After publishing, fails the run (with an email) when the data has stopped updating (§5.10). |
| `data/rates.json` | The daily data, updated by GitHub Actions. |
| `.github/workflows/` | `publish.yml` (daily data, publishing on GitHub Pages, the freshness check), `ci.yml` (tests on every pull request). |
| `LICENSE` | MIT. |
| `package.json` | Commands: `npm run dev`, `npm test`, `npm run build`. No dependencies; Node 22 or newer. |
| `README.md` | For visitors, in Romanian: what the app does, how to run, test and publish it. |
| `CHANGELOG.md` | The versions, briefly; each one has a git tag. |
| `FINDINGS.md` | The registry of problems: fixed, and still in the app. |
| `DESIGN.md` | This document. |
| `CLAUDE.md` | Instructions for Claude Code: where we left off and the working rules. |
| `docs/DEVELOPMENT.md` | How we work: with Claude, the local copy, the former claude.ai artifact. |
| `docs/IDEAS.md` | Ideas for later; not scheduled. |
| `docs/screenshot.png` | The README screenshot (dark theme, the counter at „−0,0029 lei”). |
| `assets/og-card.png` | The preview image when you share the link (WhatsApp, Facebook etc.). It has no figures or dates on purpose, because it is not regenerated with the data (F-76). |
| `docs/og-card.html` | The template of that image, rendered at 1200×630 with headless Chrome. |
| `artifact.json` | The link to the claude.ai artifact and its last published version; no longer synced. |

**The claude.ai artifact:** `app.html` was also published as a private artifact on claude.ai (last version: 4). Since 29 October 2026 it is no longer synced; the site is the reference. The rules below come from the artifact and stay, because the build and the tests rely on them.

**Rules for `app.html`** (checked by `tests/page.test.mjs`):
- a fragment, without `<!doctype>`, `<html>`, `<head>` or `<body>`; `build.mjs` wraps it;
- external scripts only from cdnjs, jsDelivr or unpkg; fonts only from Google Fonts, marked `data-fonts` (the build replaces them with the local ones);
- no `fetch` to other sites, and only relative paths;
- no inline event handlers (the CSP would block them); every inline script must parse;
- colours only as tokens (between `tokens:start` and `tokens:end`), for both themes;
- numeric fields are text (`inputmode="decimal"`), at least 16 px;
- the hand-set values carry their month, and their labels come from `DATA`.

**The site's security** (checked by `tests/build.test.mjs`): a CSP whose `script-src` lists only the hashes of the inline scripts, no referrer, nothing loaded from another site. GitHub Pages cannot send HTTP headers, so `frame-ancestors` and `nosniff` are missing (FINDINGS O-15).

**How changes reach the site:**

| Direction | How |
|---|---|
| Local → site | Push to GitHub. Actions runs the tests, then the build, then publishes. |
| Data → site | Automatic, on working days (§5.10). Nothing to do. |
| claude.ai → local | Changes made from a claude.ai chat are written into the local folder, which is the git clone; they show up in `git status`. |

**History (git):** every step is a commit: the first version (Ceasul leului), the local project, this document (then `BAZA.md`), review 1 (fixes, build, tests, docs), the rename, the license, the automatic data, publishing on GitHub (v0.3.1). The data commits are by `github-actions[bot]`.

---

## 10. Hosting

**Decided: GitHub Pages, on the personal account, with GitHub Actions.**

Why:
- it is free and needs no new account;
- it fits the open-source plan;
- the app is static, so it needs no server;
- Actions runs the tests and fetches the data on working days (§5.10);
- the data arrives as a file (`data/rates.json`), the same locally and on the site.

One-time steps (done on 29 October 2026):
1. The public repo `RomulusMirauta/taxa-pe-stat`, with the full history.
2. In the repo: Settings → Pages → Source: **GitHub Actions**.
3. Actions → Publish → **Run workflow**, so the data arrives right away, not at the next scheduled run.
4. The address: https://romulusmirauta.github.io/taxa-pe-stat/. The relative paths in the build work under this prefix.

**Not used:** Vercel, Cloudflare Pages and Netlify would work with the same command (`node build.mjs`, the `dist` folder), without any other configuration file. `vercel.json`, prepared before the decision, was removed (FINDINGS F-34).

**Why not a server API (serverless):** the artifact could not read other sites, and an API would only serve the site. A data file works everywhere.

---

## 11. Next steps

- [x] License: MIT.
- [x] `scripts/update-data.mjs`: BNR rates (with the ECB as fallback), Eurostat inflation, `data/rates.json`.
- [x] Workflow `publish.yml`: data on working days after 13:00, a commit by the bot, publishing.
- [x] `app.html` reads `data/rates.json`; otherwise it uses its own values.
- [x] A link to the source code in the page footer; `og:url`, `canonical`, a preview image.
- [x] Push to `RomulusMirauta/taxa-pe-stat` and GitHub Pages: the site is published and loads without errors (29 October 2026).
- [x] The first run with real data brought nothing and revealed F-38 and F-39; checking BNR's addresses from a computer in Romania found F-40.
- [x] After the fixes, BNR (from `curs.bnr.ro`) and Eurostat answer from GitHub Actions too, and the bot commits (O-12). The ECB fallback was checked on real data from a computer in Romania (O-11).
- [x] "About" on GitHub: description, site address, topics.
- [x] The Pages actions on the versions for Node 24 (O-13) and less traffic to BNR (O-14), in v0.3.1.
- [x] A testing sweep with five testers found F-48…F-79, all fixed in v0.3.1, among them the rates that did not follow the dates (F-62), stale data with a green pipeline (F-54) and a page script no test ran (F-55, now `tests/e2e.test.mjs`).
- [x] The open items that could be fixed in the page, in v0.3.2: the table on a phone (O-18) and reduced motion turned on later (O-17).
- [x] Tests and fixes for phones, in v0.3.3: a sweep at nine sizes found F-80…F-82.
- [ ] The owner's decision on protecting `main` and the tags, and on Dependabot for the actions (O-16).
- [ ] A current source for the deposit rates (the page flags the July 2026 ones). Found: BNR's official statistic, Buletin lunar table 10.1.2 (households, new term deposits in lei, 6–12 months: 5.51% in July 2026), published about two months later.
- [ ] What is still in the app: the second table in [`FINDINGS.md`](FINDINGS.md).

Ideas for later (a EUR/RON chart, CASS, the FX spread, personal inflation, lei vs euros) are in [`docs/IDEAS.md`](docs/IDEAS.md); they are not scheduled.

---

## Sources

- [INS: the inflation rate, September 2026 (curs-valutar-bnr.ro)](https://www.curs-valutar-bnr.ro/articole/rata-inflatiei-romania)
- [Forbes România: inflation by category](https://www.forbes.ro/?p=526539) · [the 12-month average](https://www.forbes.ro/?p=525774)
- [Trading Economics: the annual rate in 2026](https://tradingeconomics.com/romania/inflation-cpi/news/591392)
- [BNR forecast: 6.1% (2026), 3.4% (2027)](https://www.stiripesurse.ro/annual-inflation-rate-reaches-661-in-september_3927938)
- [Eurostat, via Eunews: euro area 3.8% in September 2026](https://www.eunews.it/en/2026/10/16/euro-area-and-eu-september-inflation-confirmed-up-at-3-8-per-cent/)
- [BNR rates on 28.10.2026](https://cursbnr.nxm.ro/data/28-10-2026) · [28.10.2025](https://cursbnr.nxm.ro/data/28-10-2025) · [Bugetul.ro, 28 Oct 2025](https://www.bugetul.ro/curs-bnr-marti-28-octombrie-2025-ce-se-intampla-cu-moneda-unica-europeana-dupa-doua-zile-consecutive-in-care-s-a-apreciat-in-raport-cu-leul-romanesc/)
- [EUR all-time high, 6 Oct 2026](https://cursbnr.nxm.ro/convertor/usd-ron-8000)
- [BNR: using the XML files to fetch exchange rates (curs.bnr.ro)](https://curs.bnr.ro/)
- [Bank deposits, July 2026 (Wall-Street.ro)](https://www.wall-street.ro/articol/credite-si-depozite-bancare/depozite-bancare-iulie-2026.html)
- [Tezaur, October 2026 (Financiarul)](https://financiarul.ro/finante-personale/tezaur-ofera-dobanzi-intre-6-5-si-7-5-in-octombrie-2026-cum-difera/) · [Fidelis, October 2026 (StartupCafe)](https://startupcafe.ro/titluri-de-stat-fidelis-s-a-anuntat-editia-din-octombrie-2026-ce-dobanzi-sunt-la-lei-si-euro-107768)
- [The tax on interest stays at 10% (Wall-Street.ro)](https://www.wall-street.ro/articol/credite-si-depozite-bancare/cresterea-impozitului-s-ar-putea-sa-nu-se-opreasca-la-dividende.html) · [Guide to the deposit tax in 2026 (Financer)](https://financer.ro/investitii/impozit-depozit-bancar/)
- [Inflation Calculator](https://alternativeto.net/software/inflation-calculator/about) · [finkit](https://github.com/David-DAM/finkit) · [inflatie-calculator](https://github.com/NickHuijgen/inflatie-calculator)
