// Every file in src/js is a real ES module: the page's bundle (build.mjs) must behave like the modules themselves.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const dir = new URL('../src/js/', import.meta.url);
const files = readdirSync(dir).filter((f) => f.endsWith('.js'));

test('src/js has the modules of the page', () => {
  assert.ok(files.includes('main.js') && files.includes('calc.js'));
  assert.ok(files.length >= 10, files.join(', '));
});

// Node links the imports: a name a module imports but the other does not export fails here, as it would in a browser.
for (const f of files.filter((f) => f !== 'main.js')) {
  test(`${f} loads in Node, without the page: its code touches the page only when called`, async () => {
    await import(new URL(f, dir));
  });
}

test('main.js, which starts the page as it loads, is at least valid module syntax (node --check)', () => {
  const r = spawnSync(process.execPath, ['--check', fileURLToPath(new URL('main.js', dir))], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
});
