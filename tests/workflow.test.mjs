// The workflows in .github/workflows: what cannot be seen until the first run on GitHub
// (permissions, which commit gets published, step order). Plain text reading, no YAML parser.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (name) => readFileSync(new URL(`../.github/workflows/${name}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const publish = read('publish.yml');
const job = (name) => publish.split(/^ {2}(?=[\w-]+:\n)/m).find((part) => part.startsWith(`${name}:\n`)) ?? '';
const permissions = (block) => Object.fromEntries(
  [...(block.match(/^ {4}permissions:\n((?: {6}.+\n)+)/m)?.[1] ?? '').matchAll(/^ {6}([\w-]+): (\w+)/gm)].map((m) => [m[1], m[2]]));

test('permissions are granted per job, not to the whole workflow (F-44)', () => {
  assert.match(publish, /^permissions: \{\}$/m);
  assert.deepEqual(permissions(job('build')), { contents: 'write', pages: 'read' });
  assert.deepEqual(permissions(job('deploy')), { pages: 'write', 'id-token': 'write' });
});

test('the tip of main is published, not the commit that triggered the run (F-43)', () => {
  assert.match(job('build'), /uses: actions\/checkout@v\d+\n\s+with:\n(?:\s+#.*\n)*\s+ref: \$\{\{ github\.ref \}\}\n/);
});

test('data is fetched only on scheduled or manual runs; tests pass before publishing', () => {
  const build = job('build');
  assert.equal(build.match(/if: github\.event_name != 'push'/g)?.length, 2, 'the data steps do not run on push');
  const at = (s) => build.indexOf(s);
  assert.ok(at('node scripts/update-data.mjs') > 0);
  assert.ok(at('node scripts/update-data.mjs') < at('run: npm test'));
  assert.ok(at('run: npm test') < at('run: npm run build'));
  assert.ok(at('run: npm run build') < at('actions/upload-pages-artifact'));
});

test('the Pages actions are on their Node 24 versions (O-13)', () => {
  const major = (action) => Number(publish.match(new RegExp(`uses: actions/${action}@v(\\d+)`))?.[1]);
  assert.ok(major('configure-pages') >= 6);
  assert.ok(major('upload-pages-artifact') >= 5);
  assert.ok(major('deploy-pages') >= 5);
});

test('ci.yml: tests and build on every pull request, with read-only access', () => {
  const ci = read('ci.yml');
  assert.match(ci, /^on:\n {2}pull_request:/m);
  assert.match(ci, /^permissions:\n {2}contents: read\n/m);
  assert.match(ci, /run: npm test\n/);
  assert.match(ci, /run: npm run build\n/);
});
