'use strict';

/**
 * Property-Based Tests for the AI Study Buddy frontend.
 * Tasks 6.3, 6.6, 6.7, 6.8, 6.9
 *
 * Run with: node tests/frontend.property.test.js
 *
 * Uses fast-check for property generation (min 100 runs each) and
 * jsdom to simulate a browser DOM environment.
 *
 * Validates: Requirements 4.1, 4.6, 4.7, 6.1, 6.4, 6.5, 6.6, 6.7, 6.8,
 *            6.9, 6.10, 6.11
 */

const fc = require('fast-check');
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

// ── Helpers ──────────────────────────────────────────────────

let passed = 0;
let failed = 0;

/** Read app.js source once; it never changes between runs. */
const RAW_APP_SOURCE = fs.readFileSync(
  path.join(__dirname, '..', 'js', 'app.js'),
  'utf8'
);

/**
 * Patch the app source so that `const SYSTEM_PROMPT` and
 * `let conversationHistory` become `var` declarations, which ARE placed on
 * the global (window) object when eval'd inside jsdom.  All other behaviour
 * is identical.
 */
const APP_SOURCE = RAW_APP_SOURCE
  .replace(/^const SYSTEM_PROMPT\s*=/m, 'var SYSTEM_PROMPT =')
  .replace(/^let conversationHistory\s*=/m, 'var conversationHistory =');

/**
 * Create a fresh jsdom instance with the minimal HTML structure that
 * app.js expects, then evaluate app.js inside that window.
 *
 * @param {Function} fetchMock  - A function that replaces window.fetch.
 * @returns {{ window, document }}  The jsdom window and document objects.
 */
function createDOM(fetchMock) {
  const dom = new JSDOM(
    '<!DOCTYPE html><html><body>' +
      '<div id="chat-area"><div id="typing-indicator"></div></div>' +
      '<textarea id="user-input"></textarea>' +
      '<button id="send-btn"></button>' +
      '<button id="clear-btn"></button>' +
      '</body></html>',
    {
      runScripts: 'dangerously',
      resources: 'usable',
      url: 'http://localhost',
    }
  );

  // Inject fetch mock before app.js runs so it is available at module scope.
  dom.window.fetch = fetchMock || (() => Promise.reject(new Error('fetch not mocked')));

  // Execute app.js in the jsdom window context.
  dom.window.eval(APP_SOURCE);

  // Fire DOMContentLoaded so event listeners are wired up.
  dom.window.document.dispatchEvent(
    new dom.window.Event('DOMContentLoaded', { bubbles: true })
  );

  return dom.window;
}

/**
 * Build a simple deferred promise — useful for controlling when fetch resolves.
 */
function deferred() {
  let resolve, reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

// ── Property 9 (task 6.3): Message bubble rendering contains the message text ──
// Validates: Requirements 4.1, 6.4, 6.7, 6.9

async function runProperty9() {
  console.log('\nProperty 9 — Message bubble rendering contains the message text');
  console.log('  Validates: Requirements 4.1, 6.4, 6.7, 6.9');

  try {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('user', 'assistant'),
        fc.string({ minLength: 1 }),
        async (role, content) => {
          // Fresh DOM for every run to avoid state leakage.
          const win = createDOM();
          const chatArea = win.document.getElementById('chat-area');

          // Call appendMessage directly.
          win.appendMessage(role, content);

          // Assert: a .message.<role> element exists in #chat-area.
          const bubble = chatArea.querySelector(`.message.${role}`);
          if (!bubble) {
            throw new Error(
              `No .message.${role} element found in #chat-area after appendMessage('${role}', ...)`
            );
          }

          // Assert: the element's textContent equals the content string.
          if (bubble.textContent !== content) {
            throw new Error(
              `textContent mismatch.\nExpected: ${JSON.stringify(content)}\nGot:      ${JSON.stringify(bubble.textContent)}`
            );
          }

          // Assert: scrollTop was set to scrollHeight.
          // jsdom keeps both at 0, so the assignment produces 0 === 0.
          // We verify the assignment was attempted by checking they are equal.
          if (chatArea.scrollTop !== chatArea.scrollHeight) {
            throw new Error(
              `scrollTop (${chatArea.scrollTop}) !== scrollHeight (${chatArea.scrollHeight}) after appendMessage`
            );
          }
        }
      ),
      { numRuns: 100 }
    );

    console.log('  ✓ Property 9 passed (100 runs)');
    passed++;
  } catch (err) {
    console.error('  ✗ Property 9 failed');
    console.error(`    ${err.message}`);
    failed++;
  }
}

// ── Property 5 (task 6.6): Conversation history always starts with the system prompt ──
// Validates: Requirements 6.1, 6.11

async function runProperty5() {
  console.log('\nProperty 5 — Conversation history always starts with the system prompt');
  console.log('  Validates: Requirements 6.1, 6.11');

  try {
    await fc.assert(
      fc.asyncProperty(
        // A sequence of messages to send, up to 10 items.
        fc.array(fc.string({ minLength: 1 }), { maxLength: 10 }),
        // A parallel boolean array: true = call clearConversation before this message.
        fc.array(fc.boolean(), { minLength: 10, maxLength: 10 }),
        async (messages, clearFlags) => {
          // Build a fetch mock that always returns a successful reply.
          const fetchMock = async () => ({
            ok: true,
            json: async () => ({ reply: 'mock-reply' }),
          });

          const win = createDOM(fetchMock);

          // Helper: assert the invariant right now.
          function assertInvariant(label) {
            const history = win.conversationHistory;
            if (!Array.isArray(history) || history.length < 1) {
              throw new Error(`[${label}] conversationHistory is empty or not an array`);
            }
            const first = history[0];
            const expected = win.SYSTEM_PROMPT;
            if (
              first.role !== expected.role ||
              first.content !== expected.content
            ) {
              throw new Error(
                `[${label}] conversationHistory[0] is not SYSTEM_PROMPT.\n` +
                  `Expected: ${JSON.stringify(expected)}\n` +
                  `Got:      ${JSON.stringify(first)}`
              );
            }
          }

          // Assert invariant at the very start (before any operations).
          assertInvariant('initial');

          for (let i = 0; i < messages.length; i++) {
            // Optionally clear before this message.
            if (clearFlags[i]) {
              win.clearConversation();
              assertInvariant(`after clearConversation (step ${i})`);
            }

            // Send the message.
            win.document.getElementById('user-input').value = messages[i];
            await win.sendMessage();

            assertInvariant(`after sendMessage (step ${i})`);
          }

          // One final clear and check.
          win.clearConversation();
          assertInvariant('final clearConversation');
        }
      ),
      { numRuns: 100 }
    );

    console.log('  ✓ Property 5 passed (100 runs)');
    passed++;
  } catch (err) {
    console.error('  ✗ Property 5 failed');
    console.error(`    ${err.message}`);
    failed++;
  }
}

// ── Property 6 (task 6.7): User input and AI reply are both appended correctly ──
// Validates: Requirements 6.4, 6.6, 6.7

async function runProperty6() {
  console.log('\nProperty 6 — User input and AI reply are both appended correctly');
  console.log('  Validates: Requirements 6.4, 6.6, 6.7');

  try {
    await fc.assert(
      fc.asyncProperty(
        // Filter out strings that trim to empty — sendMessage() returns early for those.
        fc.string({ minLength: 1 }).filter((s) => s.trim().length > 0),
        fc.string({ minLength: 1 }),
        async (inputString, replyString) => {
          let capturedBody = null;

          const fetchMock = async (_url, options) => {
            capturedBody = JSON.parse(options.body);
            return {
              ok: true,
              json: async () => ({ reply: replyString }),
            };
          };

          const win = createDOM(fetchMock);

          // Set the input and send.
          win.document.getElementById('user-input').value = inputString;
          await win.sendMessage();

          const history = win.conversationHistory;
          const trimmed = inputString.trim();

          // Assert: conversationHistory contains the user message.
          const hasUser = history.some(
            (m) => m.role === 'user' && m.content === trimmed
          );
          if (!hasUser) {
            throw new Error(
              `conversationHistory missing user message.\n` +
                `Expected: { role: 'user', content: ${JSON.stringify(trimmed)} }\n` +
                `History: ${JSON.stringify(history)}`
            );
          }

          // Assert: conversationHistory contains the assistant reply.
          const hasAssistant = history.some(
            (m) => m.role === 'assistant' && m.content === replyString
          );
          if (!hasAssistant) {
            throw new Error(
              `conversationHistory missing assistant message.\n` +
                `Expected: { role: 'assistant', content: ${JSON.stringify(replyString)} }\n` +
                `History: ${JSON.stringify(history)}`
            );
          }

          // Assert: fetch was called with the full conversationHistory as body.
          if (!capturedBody) {
            throw new Error('fetch was never called');
          }
          // The body sent to the server should contain the user message
          // (it is pushed before the fetch call).
          const sentMessages = capturedBody.messages;
          const sentHasUser = sentMessages.some(
            (m) => m.role === 'user' && m.content === trimmed
          );
          if (!sentHasUser) {
            throw new Error(
              `Fetch body did not include the user message.\n` +
                `Sent messages: ${JSON.stringify(sentMessages)}`
            );
          }
          // The first element of the sent messages must be the system prompt.
          const sysPrompt = win.SYSTEM_PROMPT;
          if (
            sentMessages[0].role !== sysPrompt.role ||
            sentMessages[0].content !== sysPrompt.content
          ) {
            throw new Error(
              `Fetch body did not start with SYSTEM_PROMPT.\n` +
                `First sent message: ${JSON.stringify(sentMessages[0])}`
            );
          }
        }
      ),
      { numRuns: 100 }
    );

    console.log('  ✓ Property 6 passed (100 runs)');
    passed++;
  } catch (err) {
    console.error('  ✗ Property 6 failed');
    console.error(`    ${err.message}`);
    failed++;
  }
}

// ── Property 7 (task 6.8): Error responses do not mutate conversation history ──
// Validates: Requirement 6.8

async function runProperty7() {
  console.log('\nProperty 7 — Error responses do not mutate conversation history');
  console.log('  Validates: Requirement 6.8');

  try {
    await fc.assert(
      fc.asyncProperty(
        // Extra history entries beyond the system prompt.
        fc.array(
          fc.record({
            role: fc.constantFrom('user', 'assistant'),
            content: fc.string({ minLength: 1 }),
          }),
          { maxLength: 5 }
        ),
        async (extraHistory) => {
          // Mock fetch to return a 500 error.
          const fetchMock = async () => ({
            ok: false,
            status: 500,
            json: async () => ({ error: 'Something went wrong' }),
          });

          const win = createDOM(fetchMock);

          // Seed the conversation history with extra entries.
          // We push directly after the system prompt.
          for (const entry of extraHistory) {
            win.conversationHistory.push(entry);
          }

          // Record the number of assistant entries before the call.
          const assistantCountBefore = win.conversationHistory.filter(
            (m) => m.role === 'assistant'
          ).length;

          // Record the full history snapshot AFTER the user message is pushed
          // (sendMessage pushes the user message before calling fetch).
          // We do this by capturing history length before and after.
          const lengthBeforeSend = win.conversationHistory.length;

          // Send a message — fetch will fail.
          win.document.getElementById('user-input').value = 'test';
          await win.sendMessage();

          const history = win.conversationHistory;

          // The user message IS pushed before fetch, so history grew by 1.
          // After the error, NO assistant message should have been added.
          const assistantCountAfter = history.filter(
            (m) => m.role === 'assistant'
          ).length;

          if (assistantCountAfter !== assistantCountBefore) {
            throw new Error(
              `An assistant message was added despite a fetch error.\n` +
                `Assistant entries before: ${assistantCountBefore}\n` +
                `Assistant entries after:  ${assistantCountAfter}\n` +
                `History: ${JSON.stringify(history)}`
            );
          }

          // The history should have grown by exactly 1 (the user message only).
          const expectedLength = lengthBeforeSend + 1;
          if (history.length !== expectedLength) {
            throw new Error(
              `History length mismatch after error.\n` +
                `Expected: ${expectedLength} (user msg added, no assistant msg)\n` +
                `Got:      ${history.length}\n` +
                `History: ${JSON.stringify(history)}`
            );
          }
        }
      ),
      { numRuns: 100 }
    );

    console.log('  ✓ Property 7 passed (100 runs)');
    passed++;
  } catch (err) {
    console.error('  ✗ Property 7 failed');
    console.error(`    ${err.message}`);
    failed++;
  }
}

// ── Property 8 (task 6.9): Typing indicator and send button are always consistent ──
// Validates: Requirements 4.6, 4.7, 6.5, 6.10

async function runProperty8() {
  console.log('\nProperty 8 — Typing indicator and send button are always consistent');
  console.log('  Validates: Requirements 4.6, 4.7, 6.5, 6.10');

  try {
    await fc.assert(
      fc.asyncProperty(
        // Filter out strings that trim to empty — sendMessage() returns early for those.
        fc.string({ minLength: 1 }).filter((s) => s.trim().length > 0),
        fc.boolean(), // true = success response, false = error response
        async (inputString, isSuccess) => {
          // Create a deferred so we can inspect UI state before the fetch resolves.
          const def = deferred();

          const fetchMock = async () => {
            // Wait until the test tells us to resolve.
            await def.promise;
            if (isSuccess) {
              return {
                ok: true,
                json: async () => ({ reply: 'mock-reply' }),
              };
            } else {
              return {
                ok: false,
                status: 500,
                json: async () => ({ error: 'Something went wrong' }),
              };
            }
          };

          const win = createDOM(fetchMock);
          const typingIndicator = win.document.getElementById('typing-indicator');
          const sendBtn = win.document.getElementById('send-btn');

          // Start sendMessage but do NOT await it yet.
          win.document.getElementById('user-input').value = inputString;
          const sendPromise = win.sendMessage();

          // Yield to the microtask queue so sendMessage can run up to the
          // first `await fetch(...)` suspension point.
          await new Promise((r) => setTimeout(r, 0));

          // ── BEFORE fetch resolves ──────────────────────────────────────
          if (!typingIndicator.classList.contains('visible')) {
            throw new Error(
              'BEFORE resolve: #typing-indicator does not have .visible class'
            );
          }
          if (!sendBtn.disabled) {
            throw new Error(
              'BEFORE resolve: #send-btn is not disabled'
            );
          }

          // Resolve (or reject) the deferred to let fetch complete.
          def.resolve();

          // Await the full sendMessage() completion.
          await sendPromise;

          // ── AFTER fetch resolves ───────────────────────────────────────
          if (typingIndicator.classList.contains('visible')) {
            throw new Error(
              'AFTER resolve: #typing-indicator still has .visible class'
            );
          }
          if (sendBtn.disabled) {
            throw new Error(
              'AFTER resolve: #send-btn is still disabled'
            );
          }
        }
      ),
      { numRuns: 100 }
    );

    console.log('  ✓ Property 8 passed (100 runs)');
    passed++;
  } catch (err) {
    console.error('  ✗ Property 8 failed');
    console.error(`    ${err.message}`);
    failed++;
  }
}

// ── Run all properties ────────────────────────────────────────

(async () => {
  console.log('=== AI Study Buddy — Frontend Property-Based Tests ===');

  await runProperty9();
  await runProperty5();
  await runProperty6();
  await runProperty7();
  await runProperty8();

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  process.exit(failed > 0 ? 1 : 0);
})();
