// The local server: serves the page and the fonts, refuses everything else (including ../).
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer } from '../serve.mjs';

describe('the local server', () => {
  let server;
  let base;
  before(async () => {
    server = await startServer({ port: 0, host: '127.0.0.1' });
    base = `http://127.0.0.1:${server.address().port}`;
  });
  after(() => new Promise((done) => server.close(done)));

  test('/ serves the complete page, with automatic reload', async () => {
    const r = await fetch(base + '/');
    assert.equal(r.status, 200);
    assert.match(r.headers.get('content-type'), /text\/html/);
    const t = await r.text();
    assert.match(t, /<title>Taxa pe stat<\/title>/);
    assert.match(t, /\/__v/);
  });
  test('/__v returns the version of app.html', async () => {
    const r = await fetch(base + '/__v');
    assert.equal(r.status, 200);
    assert.ok(Number(await r.text()) > 0);
  });
  test('serves the fonts', async () => {
    const r = await fetch(base + '/fonts/fonts.css');
    assert.equal(r.status, 200);
    assert.match(r.headers.get('content-type'), /text\/css/);
    await r.arrayBuffer();
  });
  test('serves the daily data', async () => {
    const r = await fetch(base + '/data/rates.json');
    assert.equal(r.status, 200);
    assert.match(r.headers.get('content-type'), /application\/json/);
    assert.ok((await r.json()).fx);
  });
  for (const p of ['/package.json', '/scripts/update-data.mjs', '/app.html', '/build.mjs', '/fonts/../package.json', '/fonts/..%2f..%2fpackage.json',
    '/fonts/%2e%2e/%2e%2e/package.json', '/fonts/', '/missing']) {
    test(`refuses ${p}`, async () => {
      const r = await fetch(base + p);
      assert.equal(r.status, 404);
      await r.arrayBuffer();
    });
  }
  test('refuses methods that write', async () => {
    const r = await fetch(base + '/', { method: 'POST' });
    assert.equal(r.status, 405);
    await r.arrayBuffer();
  });
});
