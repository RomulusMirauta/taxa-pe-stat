// Headless Chrome for the end-to-end test: its flags and its start, with no dependencies. Tested in chrome.test.mjs.
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * The flags for a headless Chrome with its own profile. Chrome's sandbox cannot start on GitHub's Ubuntu runners
 * (they restrict the namespaces it needs), and Chrome refuses to start as root with it: on Linux, in CI or as
 * root, it runs with --no-sandbox (F-90).
 */
export function chromeArgs({ profile, platform = process.platform, uid = process.getuid?.(), ci = !!process.env.CI }) {
  return [
    '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--disable-sync',
    '--disable-background-networking', '--disable-component-update', '--mute-audio', '--hide-scrollbars',
    ...(platform === 'linux' && (ci || uid === 0) ? ['--no-sandbox'] : []),
    'about:blank',
  ];
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Starts `command` with `args` and waits for the DevTools port it writes into `profile` (with port 0, Chrome picks
 * a free one: no collisions when several tests run). If it stops first, or never writes it, the error says why, with
 * the end of what it wrote to stderr (F-90). A start that hangs is stopped and tried `retries` times more: on a slow
 * runner it is a passing delay (F-103). One that fails outright would only fail again, so it is not retried.
 * Returns the process, the port and the browser's DevTools path.
 */
export async function launchChrome(command, args, profile, { timeout = 30000, retries = 1 } = {}) {
  for (let left = retries; ; left--) {
    try {
      return await startOnce(command, args, profile, timeout);
    } catch (e) {
      if (!e.hung || left <= 0) throw e;
      console.error(e.message, '(trying once more)');
    }
  }
}

async function startOnce(command, args, profile, timeout) {
  const chrome = spawn(command, args, { stdio: ['ignore', 'ignore', 'pipe'] });
  let stderr = '';
  // Read all of it, or a full pipe would block Chrome; keep the end.
  chrome.stderr.on('data', (d) => { stderr = (stderr + d).slice(-2000); });
  let failed = null;
  chrome.once('error', (e) => { failed = e; });
  const why = () => (stderr.trim() ? `\n${stderr.trim()}` : ' (nothing on stderr)');
  const end = Date.now() + timeout;
  for (;;) {
    if (failed) throw new Error(`Chrome did not start: ${failed.message}: ${command}`);
    if (chrome.exitCode !== null || chrome.signalCode !== null) {
      throw new Error(`Chrome stopped at startup (${chrome.exitCode ?? chrome.signalCode}): ${command}${why()}`);
    }
    const [port, path] = (await readFile(join(profile, 'DevToolsActivePort'), 'utf8').catch(() => '')).split(/\r?\n/);
    if (/^\d+$/.test(port) && path) return { chrome, port, path };
    if (Date.now() > end) {
      // Gone before the next try, which uses the same profile.
      const gone = new Promise((r) => chrome.once('close', r));
      chrome.kill('SIGKILL');
      await gone;
      throw Object.assign(new Error(`Chrome wrote no DevTools port within ${timeout / 1000} s: ${command}${why()}`), { hung: true });
    }
    await sleep(20);
  }
}
