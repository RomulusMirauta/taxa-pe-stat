// Serverul local: servește pagina și fonturile, refuză orice altceva (inclusiv ../).
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer } from '../serve.mjs';

describe('serverul local', () => {
  let server;
  let base;
  before(async () => {
    server = await startServer({ port: 0, host: '127.0.0.1' });
    base = `http://127.0.0.1:${server.address().port}`;
  });
  after(() => new Promise((done) => server.close(done)));

  test('/ servește pagina completă, cu reîncărcare automată', async () => {
    const r = await fetch(base + '/');
    assert.equal(r.status, 200);
    assert.match(r.headers.get('content-type'), /text\/html/);
    const t = await r.text();
    assert.match(t, /<title>Taxa pe stat<\/title>/);
    assert.match(t, /\/__v/);
  });
  test('/__v întoarce versiunea lui app.html', async () => {
    const r = await fetch(base + '/__v');
    assert.equal(r.status, 200);
    assert.ok(Number(await r.text()) > 0);
  });
  test('servește fonturile', async () => {
    const r = await fetch(base + '/fonts/fonts.css');
    assert.equal(r.status, 200);
    assert.match(r.headers.get('content-type'), /text\/css/);
    await r.arrayBuffer();
  });
  for (const p of ['/package.json', '/app.html', '/build.mjs', '/fonts/../package.json', '/fonts/..%2f..%2fpackage.json',
    '/fonts/%2e%2e/%2e%2e/package.json', '/fonts/', '/nimic']) {
    test(`refuză ${p}`, async () => {
      const r = await fetch(base + p);
      assert.equal(r.status, 404);
      await r.arrayBuffer();
    });
  }
  test('refuză metodele care scriu', async () => {
    const r = await fetch(base + '/', { method: 'POST' });
    assert.equal(r.status, 405);
    await r.arrayBuffer();
  });
});
