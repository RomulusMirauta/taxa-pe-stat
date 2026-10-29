// Checks that data/rates.json is still being updated. publish.yml runs it after the deploy, so a stale
// source never blocks publishing, but the run fails and GitHub emails the owner (FINDINGS F-42, F-54).
//   node scripts/check-fresh.mjs [file] [today]   (defaults: data/rates.json, today's UTC date)
// It fails (exit code 1) when:
//   - the exchange rates are more than 7 days old (the threshold of the page's badge, F-24);
//   - the rates come from the ECB fallback instead of BNR;
//   - the newest inflation month is more than 95 days past its first day (Eurostat publishes month M around
//     the 18th of M+1, and the January index only at the end of February: 86 days after 1 December).

import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

export const LIMITS = { fxDays: 7, inflationDays: 95 };

const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);

/** The reasons why the data looks stopped; an empty list when it is fresh. */
export function freshness(data, today) {
  const problems = [];
  const fx = data?.fx;
  const inflation = data?.inflation;
  if (!fx?.d1) problems.push('there are no exchange rates');
  else {
    const age = daysBetween(fx.d1, today);
    if (age > LIMITS.fxDays) problems.push(`the exchange rates are from ${fx.d1}, ${age} days ago`);
    if (fx.source !== 'BNR') problems.push(`the exchange rates come from "${fx.source}", not from BNR`);
  }
  if (!inflation?.month) problems.push('there is no inflation data');
  else {
    const age = daysBetween(`${inflation.month}-01`, today);
    if (age > LIMITS.inflationDays) problems.push(`the newest inflation month is ${inflation.month}, ${age} days after its first day`);
  }
  return problems;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const [file = join(root, 'data', 'rates.json'), today = new Date().toISOString().slice(0, 10)] = process.argv.slice(2);
  const data = JSON.parse(await readFile(file, 'utf8'));
  const problems = freshness(data, today);
  for (const p of problems) console.log(process.env.GITHUB_ACTIONS ? `::error::Stale data: ${p}.` : `Error: stale data: ${p}.`);
  if (problems.length) process.exitCode = 1;
  else console.log(`Fresh: ${data.fx.source} rates from ${data.fx.d1}, inflation for ${data.inflation.month}.`);
}
