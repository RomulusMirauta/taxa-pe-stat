// scripts/check-fresh.mjs: the check after publishing that emails the owner when the data stops updating (F-42, F-54).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { freshness } from '../scripts/check-fresh.mjs';

const fresh = { fx: { source: 'BNR', d1: '2026-10-28' }, inflation: { month: '2026-09' } };
const today = '2026-10-29';
const about = (re) => (problems) => problems.filter((p) => re.test(p));

test('fresh data: nothing to report', () => assert.deepEqual(freshness(fresh, today), []));

test('the exchange rates: 7 days old is fine, 8 days fails (the threshold of the page badge)', () => {
  assert.deepEqual(freshness(fresh, '2026-11-04'), []);
  assert.deepEqual(freshness(fresh, '2026-11-05'), ['the exchange rates are from 2026-10-28, 8 days ago']);
});

test('rates from the ECB fallback fail the check', () => {
  assert.deepEqual(freshness({ ...fresh, fx: { ...fresh.fx, source: 'BCE (rezervă)' } }, today), ['the exchange rates come from "BCE (rezervă)", not from BNR']);
});

test('inflation: up to 95 days after the first day of its month', () => {
  const inflation = about(/inflation/);
  assert.deepEqual(inflation(freshness(fresh, '2026-12-05')), [], '2026-09-01 + 95 days');
  assert.deepEqual(inflation(freshness(fresh, '2026-12-06')), ['the newest inflation month is 2026-09, 96 days after its first day']);
  // The January index comes out at the end of February: on 25 Feb the December one is 86 days old, which is normal.
  assert.deepEqual(freshness({ fx: { source: 'BNR', d1: '2027-02-25' }, inflation: { month: '2026-12' } }, '2027-02-25'), []);
});

test('missing sections fail', () => {
  assert.deepEqual(freshness({}, today), ['there are no exchange rates', 'there is no inflation data']);
  assert.deepEqual(freshness(null, today), ['there are no exchange rates', 'there is no inflation data']);
});

test('the command: exit code 1 and a GitHub error annotation when the data is stale', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'taxa-pe-stat-fresh-'));
  try {
    const file = join(dir, 'rates.json');
    await writeFile(file, JSON.stringify(fresh));
    const script = fileURLToPath(new URL('../scripts/check-fresh.mjs', import.meta.url));
    // The output is captured, so the annotation does not reach the log of a real run (F-39).
    const run = (day) => spawnSync(process.execPath, [script, file, day], { env: { ...process.env, GITHUB_ACTIONS: 'true' }, encoding: 'utf8' });
    const ok = run(today);
    assert.equal(ok.status, 0);
    assert.match(ok.stdout, /^Fresh: BNR rates from 2026-10-28, inflation for 2026-09\.$/m);
    const stale = run('2026-11-05');
    assert.equal(stale.status, 1);
    assert.match(stale.stdout, /^::error::Stale data: the exchange rates are from 2026-10-28, 8 days ago\.$/m);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
