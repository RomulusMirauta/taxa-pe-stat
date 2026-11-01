/* Built-in values. Used until data/rates.json loads (updated daily by GitHub Actions)
   or when the file is missing. The BNR forecast and the interest rates are updated by hand. */

export const DATA = {
  sum: 50000,
  live: false,
  inflation: { source: 'Eurostat (IAPC)', month: '2026-09', yoy: 6.5, services: 9.3, avg12: 8.4, euroArea: 3.8, euroAreaMonth: '2026-09' },
  fx: { source: 'BNR', d0: '2025-10-28', eur0: 5.0844, usd0: 4.3591, d1: '2026-10-28', eur1: 5.3495, usd1: 4.8088 },
  /* Set by hand (DESIGN §2), each value with the month it is from; the page flags them when they get old.
     forecast: the BNR inflation forecast for the end of `target`, from the report of the month `report`. */
  forecast: { value: 3.4, target: '2027-12', report: '2026-08' },
  savings: {
    /* BNR's average rate on new household term deposits in lei, 6 to 12 months (Buletin lunar, table 10.1.2). */
    deposit: { rate: 5.51, asOf: '2026-07' },
    tezaur1y: { rate: 6.5, asOf: '2026-10' },
    tax: { rate: 10, asOf: '2026-10' }
  }
};
