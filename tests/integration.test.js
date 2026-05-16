'use strict';

/**
 * Integration tests for the AI Study Buddy backend.
 * Tasks 8.1, 8.2, 8.3
 *
 * Run with: node tests/integration.test.js
 */

const assert = require('assert');
const { spawn } = require('child_process');
const path = require('path');
const http = require('http');

// ── Helpers ──────────────────────────────────────────────────

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

// ── Task 8.1: Valid POST /api/chat returns correct shape ─────
// Uses a mock Groq API server so no real API key is needed.

async function runTest81() {
  console.log('\n8.1 — Valid POST /api/chat returns correct shape');

  // Start a mock Groq API server on a random port
  const mockReply = "Great question! Think about what addition means. You've got this!";
  const mockGroqServer = http.createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        choices: [{ message: { role: 'assistant', content: mockReply } }]
      }));
    });
  });

  await new Promise((resolve) => mockGroqServer.listen(0, '127.0.0.1', resolve));
  const mockPort = mockGroqServer.address().port;

  // Clear any cached server module
  const serverModulePath = require.resolve('../server/server.js');
  delete require.cache[serverModulePath];

  // Patch node-fetch to redirect Groq API calls to our mock server
  const fetchModulePath = require.resolve('node-fetch');
  const originalFetchEntry = require.cache[fetchModulePath];
  const realFetch = require('node-fetch');

  require.cache[fetchModulePath] = {
    ...originalFetchEntry,
    exports: function patchedFetch(url, options) {
      const redirected = url.replace('https://api.groq.com', `http://127.0.0.1:${mockPort}`);
      return realFetch(redirected, options);
    }
  };

  // Set a mock API key so the guard passes
  const originalKey = process.env.GROQ_API_KEY;
  process.env.GROQ_API_KEY = 'mock-key-for-test';

  const app = require('../server/server.js');
  const request = require('supertest');

  await test('POST /api/chat with valid messages returns 200 and { reply: string }', async () => {
    const res = await request(app)
      .post('/api/chat')
      .set('Content-Type', 'application/json')
      .send({
        messages: [
          { role: 'system', content: 'You are a helpful tutor.' },
          { role: 'user', content: 'What is 2 + 2?' }
        ]
      });

    assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
    assert.ok(res.body, 'Response body should exist');
    assert.ok(typeof res.body.reply === 'string', `Expected reply to be a string, got ${typeof res.body.reply}`);
    assert.strictEqual(res.body.reply, mockReply, 'Reply should match mock response verbatim');
  });

  await test('POST /api/chat with missing messages returns 400', async () => {
    const res = await request(app)
      .post('/api/chat')
      .set('Content-Type', 'application/json')
      .send({});
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.error, 'Invalid request');
  });

  await test('POST /api/chat with empty messages array returns 400', async () => {
    const res = await request(app)
      .post('/api/chat')
      .set('Content-Type', 'application/json')
      .send({ messages: [] });
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.error, 'Invalid request');
  });

  await test('POST /api/chat with message missing role returns 400', async () => {
    const res = await request(app)
      .post('/api/chat')
      .set('Content-Type', 'application/json')
      .send({ messages: [{ content: 'hello' }] });
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.error, 'Invalid request');
  });

  await test('POST /api/chat with message missing content returns 400', async () => {
    const res = await request(app)
      .post('/api/chat')
      .set('Content-Type', 'application/json')
      .send({ messages: [{ role: 'user' }] });
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.error, 'Invalid request');
  });

  // Restore
  process.env.GROQ_API_KEY = originalKey;
  require.cache[fetchModulePath] = originalFetchEntry;
  delete require.cache[serverModulePath];
  await new Promise((resolve) => mockGroqServer.close(resolve));
}

// ── Task 8.2: Server exits on missing API key ────────────────

async function runTest82() {
  console.log('\n8.2 — Server exits with non-zero code when GROQ_API_KEY is absent');

  await test('Server process exits with non-zero code when GROQ_API_KEY is missing', () => {
    return new Promise((resolve, reject) => {
      // Write a wrapper that stubs dotenv (no-op) and deletes GROQ_API_KEY,
      // then requires server.js — the guard should fire and exit(1).
      const wrapperPath = path.join(__dirname, '_test_no_key_wrapper.js');
      const fs = require('fs');
      fs.writeFileSync(wrapperPath,
        `// Stub dotenv so config() is a no-op\n` +
        `require.cache[require.resolve('dotenv')] = {\n` +
        `  id: require.resolve('dotenv'),\n` +
        `  filename: require.resolve('dotenv'),\n` +
        `  loaded: true,\n` +
        `  exports: { config: () => ({}) }\n` +
        `};\n` +
        `// Remove the key so the guard triggers\n` +
        `delete process.env.GROQ_API_KEY;\n` +
        `require('../server/server.js');\n`
      );

      const child = spawn(process.execPath, [wrapperPath], {
        env: Object.assign({}, process.env, { GROQ_API_KEY: '' }),
        stdio: 'pipe',
        cwd: path.join(__dirname, '..')
      });

      let stderr = '';
      child.stderr.on('data', (d) => { stderr += d.toString(); });

      const timeout = setTimeout(() => {
        child.kill();
        try { fs.unlinkSync(wrapperPath); } catch (_) {}
        reject(new Error(`Server did not exit within 5 seconds. stderr: "${stderr}"`));
      }, 5000);

      child.on('exit', (code) => {
        clearTimeout(timeout);
        try { fs.unlinkSync(wrapperPath); } catch (_) {}
        try {
          assert.ok(code !== 0, `Expected non-zero exit code, got ${code}`);
          assert.ok(
            stderr.includes('GROQ_API_KEY'),
            `Expected error message about GROQ_API_KEY in stderr, got: "${stderr}"`
          );
          resolve();
        } catch (err) {
          reject(err);
        }
      });
    });
  });
}

// ── Task 8.3: Static files are served correctly ──────────────

async function runTest83() {
  console.log('\n8.3 — Static files are served correctly');

  // Ensure a fresh server module with a valid key
  const serverModulePath = require.resolve('../server/server.js');
  delete require.cache[serverModulePath];
  process.env.GROQ_API_KEY = process.env.GROQ_API_KEY || 'mock-key-for-test';

  const request = require('supertest');
  const app = require('../server/server.js');

  await test('GET / returns 200 with HTML content', async () => {
    const res = await request(app).get('/');
    assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}`);
    assert.ok(
      res.headers['content-type'] && res.headers['content-type'].includes('text/html'),
      `Expected text/html, got ${res.headers['content-type']}`
    );
    assert.ok(
      res.text.includes('<!DOCTYPE html') || res.text.includes('<html'),
      'Response body should contain HTML'
    );
  });

  await test('GET /css/style.css returns 200 with CSS content', async () => {
    const res = await request(app).get('/css/style.css');
    assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}`);
    assert.ok(
      res.headers['content-type'] && res.headers['content-type'].includes('text/css'),
      `Expected text/css, got ${res.headers['content-type']}`
    );
  });

  await test('GET /js/app.js returns 200 with JS content', async () => {
    const res = await request(app).get('/js/app.js');
    assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}`);
    assert.ok(
      res.headers['content-type'] && res.headers['content-type'].includes('javascript'),
      `Expected javascript content-type, got ${res.headers['content-type']}`
    );
  });
}

// ── Run all ──────────────────────────────────────────────────

(async () => {
  console.log('=== AI Study Buddy — Integration Tests ===');

  await runTest81();
  await runTest82();
  await runTest83();

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  process.exit(failed > 0 ? 1 : 0);
})();
