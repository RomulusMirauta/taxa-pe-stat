# Ideas for later

Features discussed but not scheduled. None of them is a promise: each one is decided before any work starts. Known problems live in [`FINDINGS.md`](../FINDINGS.md); this file holds only ideas.

## In this app

### 1. A EUR/RON chart over the last 12 months
- **What:** how the exchange rate moved over the last year, next to the „Față de EUR” and „Față de USD” rows.
- **Why:** the leu's pace comes from a single interval (DESIGN §8); the chart shows whether the chosen interval is representative.
- **Data:** already there: `fx.series` in `data/rates.json` (BNR's days over the last 400 days).
- **Notes:** a hand-drawn SVG, like the 10-year chart; colours only from tokens; no dependencies.

### 2. CASS on investment income (O-01)
- **What:** the 10% health contribution above 6 gross minimum wages of investment income a year.
- **Why:** for large savings, the real net interest is lower than the calculation shows.
- **Notes:** the threshold changes every year; it means one more field, or a checkbox with that year's threshold.

### 3. The FX spread (O-02)
- **What:** the cost of converting lei → euros → lei at the bank's rate, usually 1–3% away from BNR's.
- **Why:** it matters for anyone who actually converts, whatever the exchange rate does.
- **Notes:** a percentage field, applied to the „Față de EUR/USD” rows and to the realised values.

### 4. Personal inflation (O-03)
- **What:** the user's own basket: weights for rent, food, services, energy.
- **Why:** the official basket is an average; in September 2026 services rose by 11% and food by 3%.
- **Notes:** Eurostat publishes the HICP by category; `data/rates.json` would need more series.

### 5. The full comparison of lei vs euros (O-04)
- **What:** lei with lei interest vs euros with euro interest, with euro-area inflation and the spread.
- **Why:** only that answers "would euros have been better?" (FINDINGS F-23).
- **Notes:** it needs euro deposit rates (set by hand, like the lei ones) and the euro-area HICP (already fetched).

## A separate app

### 6. Money that grows: interest, salary, bonuses, dividends
- **What:** a counter that also adds what comes in: deposit interest, salary, monthly bonuses, dividends, rent. With enough income it runs green and positive.
- **Why separate:** Taxa pe stat answers one question (what idle lei lose); this would answer another (how all my money changes). Two small apps that link to each other keep each one simple.
- **Already in Taxa pe stat:** in the „Cu dobânda netă” mode, a deposit or government bonds that beat inflation already turn the counter green, with „+” (FINDINGS F-07).
- **Notes:** income is a flow (lei per month), not a rate on a balance, so it needs a different model and other inputs; the same stack (one HTML file, no dependencies, GitHub Pages) would work.
