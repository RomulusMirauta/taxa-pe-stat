// A release names the same version in package.json, CHANGELOG.md (with its compare link) and the README's history.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

test('the version in package.json is the first in CHANGELOG, with its link, and is listed in the README', () => {
  const { version } = JSON.parse(read('package.json'));
  const v = version.replaceAll('.', '\\.');
  const changelog = read('CHANGELOG.md');
  assert.equal(changelog.match(/^## \[(\d+\.\d+\.\d+)\] - \d{4}-\d{2}-\d{2}/m)?.[1], version, 'the first entry of CHANGELOG.md');
  assert.match(changelog, new RegExp(`^\\[${v}\\]: https://github\\.com/RomulusMirauta/taxa-pe-stat/(compare/v[\\d.]+\\.\\.\\.v${v}|releases/tag/v${v})$`, 'm'));
  assert.match(read('README.md'), new RegExp(`\\*\\*v${v}\\*\\*`), 'the history table of README.md');
});
