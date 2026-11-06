// Starting headless Chrome for the end-to-end test (tests/chrome.mjs): the sandbox flag, the reason when it fails (F-90), a second try when it hangs (F-103).
import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromeArgs, launchChrome } from './chrome.mjs';

describe('chromeArgs: --no-sandbox only where the sandbox cannot start', () => {
  const sandboxless = (o) => chromeArgs({ profile: 'p', ...o }).includes('--no-sandbox');
  test('Linux in CI (GitHub\'s runners), or as root', () => {
    assert.equal(sandboxless({ platform: 'linux', uid: 1001, ci: true }), true);
    assert.equal(sandboxless({ platform: 'linux', uid: 0, ci: false }), true, 'root in a container, outside CI');
  });
  test('not as a normal user, nor on Windows or macOS', () => {
    assert.equal(sandboxless({ platform: 'linux', uid: 1000, ci: false }), false);
    assert.equal(sandboxless({ platform: 'win32', uid: undefined, ci: true }), false);
    assert.equal(sandboxless({ platform: 'darwin', uid: 0, ci: false }), false);
  });
  test('headless, its own profile, a free DevTools port, a blank page', () => {
    const args = chromeArgs({ profile: '/tmp/x', platform: 'win32' });
    for (const a of ['--headless=new', '--remote-debugging-port=0', '--user-data-dir=/tmp/x']) assert.ok(args.includes(a), a);
    assert.equal(args.at(-1), 'about:blank');
  });
});

describe('launchChrome: a browser that does not start says why', () => {
  const dirs = [];
  const profile = async () => { const d = await mkdtemp(join(tmpdir(), 'taxa-pe-stat-fake-chrome-')); dirs.push(d); return d; };
  after(() => Promise.all(dirs.map((d) => rm(d, { recursive: true, force: true }))));
  // A stand-in for Chrome: Node itself, running a line of code.
  const fake = (code) => [process.execPath, ['-e', code]];

  test('it stops at once (Chrome as root, without --no-sandbox): the error carries what it wrote to stderr', async () => {
    const [cmd, args] = fake("console.error('Running as root without --no-sandbox is not supported.'); process.exit(1)");
    await assert.rejects(launchChrome(cmd, args, await profile()), /Chrome stopped at startup \(1\).*\nRunning as root without --no-sandbox is not supported\./s);
  });
  test('it never writes its DevTools port: a time limit, not a hang, and the process is stopped', async () => {
    const [cmd, args] = fake("console.error('stuck'); setInterval(() => {}, 1000)");
    await assert.rejects(launchChrome(cmd, args, await profile(), { timeout: 500 }), /no DevTools port within 0\.5 s.*\nstuck/s);
  });
  // A stand-in that writes one line per start, so a test can count them.
  const counted = (dir, code) => fake(`const fs = require('fs'), log = ${JSON.stringify(join(dir, 'starts'))}; const n = fs.existsSync(log) ? fs.readFileSync(log, 'utf8').length : 0; fs.appendFileSync(log, 'x'); ${code}`);
  const starts = (dir) => readFile(join(dir, 'starts'), 'utf8').then((t) => t.length);

  test('a start that hangs, then works: it is tried again, and the second start counts (F-103)', async () => {
    const dir = await profile();
    const [cmd, args] = counted(dir, `if (n === 0) setInterval(() => {}, 1000); else { fs.writeFileSync(${JSON.stringify(join(dir, 'DevToolsActivePort'))}, '9222\\n/devtools/browser/abc'); setTimeout(() => {}, 3000); }`);
    const { chrome, port } = await launchChrome(cmd, args, dir, { timeout: 1500 });
    chrome.kill();
    assert.equal(port, '9222');
    assert.equal(await starts(dir), 2);
  });
  test('a start that always hangs: two tries, then the error (F-103)', async () => {
    const dir = await profile();
    const [cmd, args] = counted(dir, 'setInterval(() => {}, 1000)');
    await assert.rejects(launchChrome(cmd, args, dir, { timeout: 1000 }), /no DevTools port within 1 s/);
    assert.equal(await starts(dir), 2);
  });
  test('a start that fails outright is not tried again (F-103)', async () => {
    const dir = await profile();
    const [cmd, args] = counted(dir, 'process.exit(1)');
    await assert.rejects(launchChrome(cmd, args, dir), /Chrome stopped at startup \(1\)/);
    assert.equal(await starts(dir), 1);
  });
  test('it writes the port: the process, the port and the path', async () => {
    const dir = await profile();
    const [cmd, args] = fake(`require('fs').writeFileSync(${JSON.stringify(join(dir, 'DevToolsActivePort'))}, '9222\\n/devtools/browser/abc'); setTimeout(() => {}, 3000)`);
    const { chrome, port, path } = await launchChrome(cmd, args, dir);
    chrome.kill();
    assert.deepEqual([port, path], ['9222', '/devtools/browser/abc']);
  });
  test('a missing program: the error names it', async () => {
    await assert.rejects(launchChrome(join(await profile(), 'no-chrome.exe'), [], await profile(), { timeout: 2000 }), /Chrome did not start|Chrome stopped at startup/);
  });
});
