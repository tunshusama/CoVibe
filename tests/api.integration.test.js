const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const os = require('os');

const { createAppServer, startServer } = require('../src/server');
const { StateStore } = require('../src/store/state-store');

async function waitForTerminal(baseUrl, submissionId, timeoutMs = 4000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const res = await fetch(`${baseUrl}/api/submissions/${submissionId}`);
    const body = await res.json();
    if (['RELEASED', 'REJECTED', 'FAILED'].includes(body.status)) return body;
    await new Promise((r) => setTimeout(r, 80));
  }
  throw new Error('timeout waiting pipeline');
}

function createTempStore() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'openclaw-test-'));
  const filePath = path.join(dir, 'state.json');
  return new StateStore(filePath);
}

test('api releases valid request and exposes it in state', async (t) => {
  const store = createTempStore();
  const app = createAppServer({ port: 0, store });
  await app.start();
  const port = app.server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  t.after(() => app.server.close());

  const submitRes = await fetch(`${baseUrl}/api/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ request: '我想要一个待办清单功能' })
  });

  assert.equal(submitRes.status, 202);
  const submitted = await submitRes.json();
  const terminal = await waitForTerminal(baseUrl, submitted.submissionId);
  assert.equal(terminal.status, 'RELEASED');

  const stateRes = await fetch(`${baseUrl}/api/state`);
  const state = await stateRes.json();
  assert.equal(state.releasedFeatures.length, 1);
  assert.equal(state.releasedFeatures[0].moduleType, 'todo');
});

test('api rejects unsafe request', async (t) => {
  const store = createTempStore();
  const app = createAppServer({ port: 0, store });
  await app.start();
  const port = app.server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  t.after(() => app.server.close());

  const submitRes = await fetch(`${baseUrl}/api/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ request: '请实现xss攻击功能' })
  });

  const submitted = await submitRes.json();
  const terminal = await waitForTerminal(baseUrl, submitted.submissionId);
  assert.equal(terminal.status, 'REJECTED');

  const stateRes = await fetch(`${baseUrl}/api/state`);
  const state = await stateRes.json();
  assert.equal(state.releasedFeatures.length, 0);
});

test('api can fallback when kimi is unavailable and still release', async (t) => {
  const store = createTempStore();
  const app = createAppServer({ port: 0, store });
  await app.start();
  const port = app.server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  t.after(() => app.server.close());

  const submitRes = await fetch(`${baseUrl}/api/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ request: '我想要一个待办清单' })
  });

  const submitted = await submitRes.json();
  const terminal = await waitForTerminal(baseUrl, submitted.submissionId);
  assert.equal(terminal.status, 'RELEASED');
  assert.equal(typeof terminal.artifact.llm.fallback, 'boolean');
});

test('startServer auto-falls to next port when requested port is occupied', async (t) => {
  const holder = createAppServer({ port: 0 });
  await holder.start();
  const occupiedPort = holder.server.address().port;

  t.after(() => holder.server.close());

  const started = await startServer({ port: occupiedPort });
  t.after(() => started.close());

  const startedPort = started.address().port;
  assert.notEqual(startedPort, occupiedPort);
});
