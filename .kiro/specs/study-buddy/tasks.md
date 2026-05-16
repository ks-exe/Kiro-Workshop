# Implementation Plan: AI Study Buddy

## Overview

Implement a lightweight single-page web application with a vanilla JS/HTML/CSS frontend and a Node.js/Express backend that proxies requests to the Grok AI API. The build is intentionally zero-tooling: no bundler, no framework. Tasks proceed from project scaffolding → backend → frontend → system prompt → property-based tests → integration wiring.

## Tasks

- [x] 1. Scaffold project structure and configuration files
  - Create `package.json` with name `"study-buddy"`, dependencies (`express`, `dotenv`, `cors`, `node-fetch`), and scripts `"start": "node server/server.js"` and `"dev": "nodemon server/server.js"`
  - Create `.env.example` with placeholder keys `XAI_API_KEY=xai-your-key-here` and `PORT=3000`
  - Create `.gitignore` listing `.env`
  - Create empty placeholder files at `index.html`, `css/style.css`, `js/app.js`, and `server/server.js` to establish the directory structure
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 2. Implement the Express backend server
  - [x] 2.1 Set up `server/server.js` with environment loading, middleware, and startup logic
    - Call `require('dotenv').config()` as the very first statement
    - Add the setup comment block (npm install, add API key, npm start, open localhost:3000)
    - Configure `express.static` to serve the project root
    - Add `cors()` and `express.json()` middleware
    - Guard: if `XAI_API_KEY` is absent or empty, log an error and call `process.exit(1)`
    - Listen on `process.env.PORT || 3000` and log `"Server running on http://localhost:<PORT>"`
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_

  - [x] 2.2 Implement the `POST /api/chat` endpoint
    - Validate the request body: `messages` must be present, non-empty, and every element must have a non-empty `role` and `content`; return `400 { error: "Invalid request" }` on failure
    - On valid input, call the Grok API at `https://api.x.ai/v1/chat/completions` with `model: "grok-3-mini"`, `max_tokens: 400`, the provided `messages` array, and `Authorization: Bearer <XAI_API_KEY>` header
    - On success, return `200 { reply: choices[0].message.content }`
    - Wrap the Grok call in `try/catch`; on any failure (network error, non-2xx, missing `choices[0]`), return `500 { error: "Something went wrong" }`
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

  - [x]* 2.3 Write property test for input validation (Property 1)
    - **Property 1: Input validation correctly classifies all request bodies**
    - Generate both valid message arrays and malformed bodies (missing `messages`, empty array, missing `role`, missing `content`, empty string `role`/`content`); assert 400 for invalid and 200 for valid
    - Use `fc.oneof(validMessageArray, malformedBody)` arbitraries with fast-check (min 100 iterations)
    - **Validates: Requirements 3.1, 3.2**

  - [x]* 2.4 Write property test for proxy correctness (Property 2)
    - **Property 2: Every valid request is forwarded with the right payload and auth header**
    - Generate valid message arrays; mock the Grok API; assert outgoing call uses `model: "grok-3-mini"`, `max_tokens: 400`, the exact messages array, and the correct `Authorization: Bearer` header
    - Use `fc.array(fc.record({ role: fc.constantFrom('user','assistant'), content: fc.string({minLength:1}) }), {minLength:1})` arbitraries
    - **Validates: Requirements 3.3, 3.6**

  - [x]* 2.5 Write property test for reply extraction (Property 3)
    - **Property 3: Grok response content is returned verbatim**
    - Mock Grok to return arbitrary reply strings; assert backend returns `{ reply }` with that exact string
    - Use `fc.string({minLength:1})` for reply content
    - **Validates: Requirements 3.4**

  - [x]* 2.6 Write property test for Grok API failure handling (Property 4)
    - **Property 4: Grok API failures always produce a 500 error response**
    - Mock Grok to fail in various ways (network error, 4xx, 5xx, missing `choices`); assert all return `500 { error: "Something went wrong" }`
    - Use `fc.oneof(networkError, nonOkStatus, malformedBody)` arbitraries
    - **Validates: Requirements 3.5**

- [x] 3. Checkpoint — Ensure backend tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Implement the frontend HTML structure
  - [x] 4.1 Write `index.html` with semantic structure and required element IDs
    - Add `<meta name="viewport" content="width=device-width, initial-scale=1">` in `<head>`
    - Add `<link rel="stylesheet" href="css/style.css">` in `<head>`
    - Use `<header>`, `<main>`, and `<footer>` landmark elements
    - Inside `<main>`, add `<div id="chat-area">` containing `<div id="typing-indicator">` (hidden by default)
    - Inside `<footer>`, add `<textarea id="user-input">`, `<button id="send-btn">`, and `<button id="clear-btn">`
    - Add `<script src="js/app.js">` immediately before `</body>`
    - No inline `style` attributes or `<style>` blocks
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.8, 4.9, 4.10, 5.6, 5.9_

- [x] 5. Implement the frontend CSS styles
  - [x] 5.1 Write `css/style.css` with all visual and layout rules
    - Set page background to `#F0F0F0` and `#chat-area` background to `#FFFFFF`
    - Style user message bubbles: background `#378ADD`, `align-self: flex-end`
    - Style AI message bubbles: background `#F1EFE8`, `align-self: flex-start`
    - Fix the input bar at the bottom using `position: fixed`
    - Add `scroll-behavior: smooth` to `#chat-area`
    - Implement the typing indicator as three dots with a CSS keyframe bounce animation of `600ms` duration
    - Ensure layout is responsive: no horizontal scrollbar at 375 px viewport width, all interactive elements reachable
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.7, 5.8, 5.9_

- [x] 6. Implement the frontend JavaScript behavior
  - [x] 6.1 Define the system prompt constant and initialize `conversationHistory`
    - Define `SYSTEM_PROMPT` constant at the top of `js/app.js` with all 7 pedagogical rules (simple vocabulary, never give answers, guiding questions, quiz question per response, hints for wrong answers, 5-sentence limit, encouraging phrase)
    - Initialize `conversationHistory = [SYSTEM_PROMPT]`
    - _Requirements: 6.1, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_

  - [x] 6.2 Implement `appendMessage(role, text)` and `showTyping(bool)`
    - `appendMessage`: create a `<div>` with the appropriate CSS class for the role, set `textContent` to the message, append to `#chat-area`, then set `#chat-area.scrollTop = #chat-area.scrollHeight`
    - `showTyping(bool)`: toggle `#typing-indicator` visibility and `#send-btn` disabled state
    - _Requirements: 4.6, 4.7, 6.9_

  - [x]* 6.3 Write property test for message bubble rendering (Property 9)
    - **Property 9: Message bubble rendering contains the message text**
    - Generate arbitrary role and content strings; call `appendMessage(role, content)`; assert the resulting DOM element's `textContent` includes the content string and `#chat-area.scrollTop` equals `#chat-area.scrollHeight`
    - Use `fc.constantFrom('user','assistant')` and `fc.string({minLength:1})` arbitraries
    - **Validates: Requirements 4.1, 6.4, 6.7, 6.9**

  - [x] 6.4 Implement `sendMessage()` with fetch logic
    - Trim input; return early if empty
    - Append user message to `conversationHistory` and call `appendMessage('user', trimmedInput)`
    - Clear `#user-input`, call `showTyping(true)` before the fetch
    - POST to `/api/chat` with `Content-Type: application/json` and body `{ messages: conversationHistory }`
    - On success: append `{ role: "assistant", content: reply }` to `conversationHistory` and call `appendMessage('assistant', reply)`
    - On error (non-2xx or `{ error }` body): call `appendMessage('error', 'Sorry, something went wrong. Please try again.')` without modifying `conversationHistory`
    - In `finally`: call `showTyping(false)` and re-enable `#send-btn`
    - Ensure no API key string matching `/xai-[a-zA-Z0-9]+/` appears anywhere in the file
    - _Requirements: 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.10, 6.12_

  - [x] 6.5 Implement `clearConversation()` and wire up all event listeners
    - `clearConversation()`: reset `conversationHistory = [SYSTEM_PROMPT]` and remove all child elements from `#chat-area`
    - Add `click` listener on `#send-btn` → `sendMessage()`
    - Add `keydown` listener on `#user-input` → call `sendMessage()` when `event.key === 'Enter'` and `!event.shiftKey`
    - Add `click` listener on `#clear-btn` → `clearConversation()`
    - _Requirements: 6.2, 6.3, 6.11_

  - [x]* 6.6 Write property test for system prompt invariant (Property 5)
    - **Property 5: Conversation history always starts with the system prompt**
    - Generate N `sendMessage()` and `clearConversation()` calls; assert `conversationHistory[0]` always equals `SYSTEM_PROMPT` and `conversationHistory` is never empty
    - Use `fc.array(fc.string({minLength:1}))` for message sequences
    - **Validates: Requirements 6.1, 6.11**

  - [x]* 6.7 Write property test for message round-trip (Property 6)
    - **Property 6: User input and AI reply are both appended correctly**
    - Generate arbitrary input strings and reply strings; call `sendMessage()`; assert user entry appended before fetch and assistant entry appended after; assert full `conversationHistory` sent as request body
    - Use `fc.string({minLength:1})` for both input and reply
    - **Validates: Requirements 6.4, 6.6, 6.7**

  - [x]* 6.8 Write property test for error history immutability (Property 7)
    - **Property 7: Error responses do not mutate conversation history**
    - Generate arbitrary prior history; mock an error backend; call `sendMessage()`; assert `conversationHistory` is identical before and after the failed call
    - Use `fc.array(fc.record({ role: fc.constantFrom('user','assistant'), content: fc.string({minLength:1}) }))` for initial history
    - **Validates: Requirements 6.8**

  - [ ]* 6.9 Write property test for UI state lifecycle (Property 8)
    - **Property 8: Typing indicator and send button are always consistent**
    - Mock fetch with a delay; call `sendMessage()`; assert `#typing-indicator` is visible and `#send-btn` is disabled before response, then hidden and enabled after (for both success and error responses)
    - Use `fc.string({minLength:1})` for input and `fc.boolean()` for success vs error
    - **Validates: Requirements 4.6, 4.7, 6.5, 6.10**

- [x] 7. Checkpoint — Ensure all frontend tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Write integration tests
  - [x]* 8.1 Write integration test: valid POST /api/chat returns correct shape
    - Start the Express server with a mock `XAI_API_KEY`; send a valid `POST /api/chat` request; assert the response is `200 { reply: string }`
    - _Requirements: 3.1, 3.3, 3.4_

  - [x]* 8.2 Write integration test: server exits on missing API key
    - Spawn the server as a child process without `XAI_API_KEY`; assert it exits with a non-zero exit code
    - _Requirements: 2.7_

  - [x]* 8.3 Write integration test: static files are served correctly
    - Send `GET /` to the running server; assert `200` with HTML content
    - _Requirements: 2.4_

- [x] 9. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at the end of each major phase
- Property tests use **fast-check** (JavaScript) and run a minimum of 100 iterations each
- Unit tests and property tests are complementary — both should be present for full coverage
- The backend is stateless; all conversation state lives in the browser's `conversationHistory` array
- No build tooling is required — plain HTML, CSS, and vanilla JS throughout

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["2.1"] },
    { "id": 1, "tasks": ["2.2", "4.1"] },
    { "id": 2, "tasks": ["2.3", "2.4", "2.5", "2.6", "5.1", "6.1"] },
    { "id": 3, "tasks": ["6.2"] },
    { "id": 4, "tasks": ["6.3", "6.4"] },
    { "id": 5, "tasks": ["6.5", "6.6", "6.7", "6.8", "6.9"] },
    { "id": 6, "tasks": ["8.1", "8.2", "8.3"] }
  ]
}
```
