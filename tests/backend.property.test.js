'use strict';

/**
 * Property-Based Tests for the AI Study Buddy backend.
 * Tasks 2.3, 2.4, 2.5, 2.6
 *
 * Run with: node tests/backend.property.test.js
 *
 * Uses fast-check for property generation (min 100 runs each).
 *
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6
 */

const fc = require('fast-check');
const request = require('supertest');

// ── Helpers ──────────────────────────────────────────────────

let passed = 0;
let failed = 0;

/**
 * Load a fresh copy of the server module, with node-fetch already patched
 * in require.cache. Call this AFTER patching fetch and setting GROQ_API_KEY.
 */
function loadFreshApp() {
  const serverPath = require.resolve('../server/server.js');
  delete require.cache[serverPath];
  return require('../server/server.js');
}

/**
 * Patch node-fetch in require.cache with a custom implementation.
 * Returns the original cache entry so it can be restored later.
 */
function patchFetch(mockFn) {
  const fetchPath = require.resolve('node-fetch');
  const original = require.cache[fetchPath];
  require.cache[fetchPath] = {
    ...(original || {}),
    id: fetchPath,
    filename: fetchPath,
    loaded: true,
    exports: mockFn,
  };
  return original;
}

/**
 * Restore node-fetch and the server module to their original state.
 */
function restoreAll(originalFetchEntry) {
  const fetchPath = require.resolve('node-fetch');
  if (originalFetchEntry !== undefined) {
    require.cache[fetchPath] = originalFetchEntry;
  } else {
    delete require.cache[fetchPath];
  }
  const serverPath = require.resolve('../server/server.js');
  delete require.cache[serverPath];
}

// ── Arbitraries ───────────────────────────────────────────────

/**
 * A well-formed message array (non-empty, every element has a non-empty role
 * and content that are also non-empty after trimming, matching the server's
 * validation: `m.role.trim() === ''` and `m.content.trim() === ''` are rejected).
 */
const nonWhitespaceString = fc
  .string({ minLength: 1 })
  .filter((s) => s.trim().length > 0);

const validMessages = fc.array(
  fc.record({
    role: fc.constantFrom('user', 'assistant', 'system'),
    content: nonWhitespaceString,
  }),
  { minLength: 1 }
);

/** Various malformed request bodies that should all produce 400. */
const malformedBody = fc.oneof(
  // Missing messages key entirely
  fc.constant({}),
  // Empty array
  fc.constant({ messages: [] }),
  // Element missing role
  fc.constant({ messages: [{ content: 'hello' }] }),
  // Element missing content
  fc.constant({ messages: [{ role: 'user' }] }),
  // Element with empty role string
  fc.constant({ messages: [{ role: '', content: 'hi' }] }),
  // Element with empty content string
  fc.constant({ messages: [{ role: 'user', content: '' }] })
);

// ── Property 1: Input validation correctly classifies all request bodies ──────
// Validates: Requirements 3.1, 3.2

async function runProperty1() {
  console.log('\nProperty 1 — Input validation correctly classifies all request bodies');
  console.log('  Validates: Requirements 3.1, 3.2');

  // We need a stable app instance for this property; mock fetch so valid
  // requests never hit the network.
  const originalKey = process.env.GROQ_API_KEY;
  process.env.GROQ_API_KEY = 'mock-key-for-test';

  const fakeSuccessResponse = {
    choices: [{ message: { role: 'assistant', content: 'ok' } }],
  };

  const originalFetchEntry = patchFetch(async (_url, _opts) => ({
    ok: true,
    json: async () => fakeSuccessResponse,
  }));

  const app = loadFreshApp();

  try {
    await fc.assert(
      fc.asyncProperty(
        // Mix valid and malformed bodies in the same property run
        fc.oneof(
          validMessages.map((msgs) => ({ kind: 'valid', body: { messages: msgs } })),
          malformedBody.map((body) => ({ kind: 'malformed', body }))
        ),
        async ({ kind, body }) => {
          const res = await request(app)
            .post('/api/chat')
            .set('Content-Type', 'application/json')
            .send(body);

          if (kind === 'valid') {
            if (res.status !== 200) {
              throw new Error(
                `Expected 200 for valid body, got ${res.status}. Body: ${JSON.stringify(body)}`
              );
            }
          } else {
            if (res.status !== 400) {
              throw new Error(
                `Expected 400 for malformed body, got ${res.status}. Body: ${JSON.stringify(body)}`
              );
            }
            if (!res.body || res.body.error !== 'Invalid request') {
              throw new Error(
                `Expected { error: "Invalid request" }, got ${JSON.stringify(res.body)}`
              );
            }
          }
        }
      ),
      { numRuns: 100 }
    );

    console.log('  ✓ Property 1 passed (100 runs)');
    passed++;
  } catch (err) {
    console.error('  ✗ Property 1 failed');
    console.error(`    ${err.message}`);
    failed++;
  } finally {
    process.env.GROQ_API_KEY = originalKey;
    restoreAll(originalFetchEntry);
  }
}

// ── Property 2: Every valid request is forwarded with the right payload and auth header ──
// Validates: Requirements 3.3, 3.6

async function runProperty2() {
  console.log('\nProperty 2 — Every valid request is forwarded with the right payload and auth header');
  console.log('  Validates: Requirements 3.3, 3.6');

  const originalKey = process.env.GROQ_API_KEY;
  const testApiKey = 'mock-key-for-test';

  try {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            role: fc.constantFrom('user', 'assistant'),
            content: fc.string({ minLength: 1 }).filter((s) => s.trim().length > 0),
          }),
          { minLength: 1 }
        ),
        async (messages) => {
          // Capture the outgoing fetch call for this run
          let capturedUrl = null;
          let capturedOptions = null;

          process.env.GROQ_API_KEY = testApiKey;

          const originalFetchEntry = patchFetch(async (url, options) => {
            capturedUrl = url;
            capturedOptions = options;
            return {
              ok: true,
              json: async () => ({
                choices: [{ message: { role: 'assistant', content: 'test reply' } }],
              }),
            };
          });

          const app = loadFreshApp();

          try {
            await request(app)
              .post('/api/chat')
              .set('Content-Type', 'application/json')
              .send({ messages });

            // Assert the outgoing URL
            if (capturedUrl !== 'https://api.groq.com/openai/v1/chat/completions') {
              throw new Error(`Wrong URL: ${capturedUrl}`);
            }

            // Parse the outgoing body
            const outBody = JSON.parse(capturedOptions.body);

            if (outBody.model !== 'llama-3.3-70b-versatile') {
              throw new Error(`Wrong model: ${outBody.model}`);
            }
            if (outBody.max_tokens !== 400) {
              throw new Error(`Wrong max_tokens: ${outBody.max_tokens}`);
            }
            if (JSON.stringify(outBody.messages) !== JSON.stringify(messages)) {
              throw new Error(
                `Messages mismatch.\nExpected: ${JSON.stringify(messages)}\nGot: ${JSON.stringify(outBody.messages)}`
              );
            }

            // Assert Authorization header
            const authHeader =
              capturedOptions.headers && capturedOptions.headers['Authorization'];
            if (authHeader !== `Bearer ${testApiKey}`) {
              throw new Error(`Wrong Authorization header: ${authHeader}`);
            }
          } finally {
            restoreAll(originalFetchEntry);
          }
        }
      ),
      { numRuns: 100 }
    );

    console.log('  ✓ Property 2 passed (100 runs)');
    passed++;
  } catch (err) {
    console.error('  ✗ Property 2 failed');
    console.error(`    ${err.message}`);
    failed++;
  } finally {
    process.env.GROQ_API_KEY = originalKey;
    // Ensure server cache is clean after the property
    const serverPath = require.resolve('../server/server.js');
    delete require.cache[serverPath];
  }
}

// ── Property 3: Groq response content is returned verbatim ───────────────────
// Validates: Requirement 3.4

async function runProperty3() {
  console.log('\nProperty 3 — Groq response content is returned verbatim');
  console.log('  Validates: Requirement 3.4');

  const originalKey = process.env.GROQ_API_KEY;
  process.env.GROQ_API_KEY = 'mock-key-for-test';

  try {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1 }),
        async (replyContent) => {
          const originalFetchEntry = patchFetch(async (_url, _opts) => ({
            ok: true,
            json: async () => ({
              choices: [{ message: { role: 'assistant', content: replyContent } }],
            }),
          }));

          const app = loadFreshApp();

          try {
            const res = await request(app)
              .post('/api/chat')
              .set('Content-Type', 'application/json')
              .send({ messages: [{ role: 'user', content: 'hello' }] });

            if (res.status !== 200) {
              throw new Error(`Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
            }
            if (res.body.reply !== replyContent) {
              throw new Error(
                `Reply mismatch.\nExpected: ${JSON.stringify(replyContent)}\nGot: ${JSON.stringify(res.body.reply)}`
              );
            }
          } finally {
            restoreAll(originalFetchEntry);
          }
        }
      ),
      { numRuns: 100 }
    );

    console.log('  ✓ Property 3 passed (100 runs)');
    passed++;
  } catch (err) {
    console.error('  ✗ Property 3 failed');
    console.error(`    ${err.message}`);
    failed++;
  } finally {
    process.env.GROQ_API_KEY = originalKey;
    const serverPath = require.resolve('../server/server.js');
    delete require.cache[serverPath];
  }
}

// ── Property 4: Groq API failures always produce a 500 error response ─────────
// Validates: Requirement 3.5

async function runProperty4() {
  console.log('\nProperty 4 — Groq API failures always produce a 500 error response');
  console.log('  Validates: Requirement 3.5');

  const originalKey = process.env.GROQ_API_KEY;
  process.env.GROQ_API_KEY = 'mock-key-for-test';

  /**
   * Build a mock fetch function for each failure mode.
   * We use fc.oneof over integer tags so fast-check can shrink properly.
   */
  const failureModeArb = fc.oneof(
    // Mode 0: network error (fetch throws)
    fc.constant({ mode: 'network-error' }),
    // Mode 1: non-2xx HTTP status (random 4xx/5xx)
    fc.integer({ min: 400, max: 599 }).map((status) => ({ mode: 'non-ok', status })),
    // Mode 2: 200 OK but body has no choices key
    fc.constant({ mode: 'missing-choices' }),
    // Mode 3: 200 OK but choices array is empty
    fc.constant({ mode: 'empty-choices' })
  );

  try {
    await fc.assert(
      fc.asyncProperty(failureModeArb, async (failureMode) => {
        let mockFetch;

        switch (failureMode.mode) {
          case 'network-error':
            mockFetch = async () => {
              throw new Error('network failure');
            };
            break;

          case 'non-ok':
            mockFetch = async () => ({
              ok: false,
              status: failureMode.status,
              json: async () => ({ error: 'upstream error' }),
            });
            break;

          case 'missing-choices':
            mockFetch = async () => ({
              ok: true,
              json: async () => ({}),
            });
            break;

          case 'empty-choices':
            mockFetch = async () => ({
              ok: true,
              json: async () => ({ choices: [] }),
            });
            break;

          default:
            throw new Error(`Unknown failure mode: ${failureMode.mode}`);
        }

        const originalFetchEntry = patchFetch(mockFetch);
        const app = loadFreshApp();

        try {
          const res = await request(app)
            .post('/api/chat')
            .set('Content-Type', 'application/json')
            .send({ messages: [{ role: 'user', content: 'hello' }] });

          if (res.status !== 500) {
            throw new Error(
              `Expected 500 for failure mode "${failureMode.mode}", got ${res.status}: ${JSON.stringify(res.body)}`
            );
          }
          if (!res.body || res.body.error !== 'Something went wrong') {
            throw new Error(
              `Expected { error: "Something went wrong" }, got ${JSON.stringify(res.body)}`
            );
          }
        } finally {
          restoreAll(originalFetchEntry);
        }
      }),
      { numRuns: 100 }
    );

    console.log('  ✓ Property 4 passed (100 runs)');
    passed++;
  } catch (err) {
    console.error('  ✗ Property 4 failed');
    console.error(`    ${err.message}`);
    failed++;
  } finally {
    process.env.GROQ_API_KEY = originalKey;
    const serverPath = require.resolve('../server/server.js');
    delete require.cache[serverPath];
  }
}

// ── Run all properties ────────────────────────────────────────

(async () => {
  console.log('=== AI Study Buddy — Backend Property-Based Tests ===');

  // Ensure GROQ_API_KEY is set before loading the server for the first time,
  // so the startup guard does not call process.exit(1).
  if (!process.env.GROQ_API_KEY) {
    process.env.GROQ_API_KEY = 'mock-key-for-test';
  }

  await runProperty1();
  await runProperty2();
  await runProperty3();
  await runProperty4();

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  process.exit(failed > 0 ? 1 : 0);
})();
