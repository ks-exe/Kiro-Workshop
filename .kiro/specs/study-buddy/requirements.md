# Requirements Document

## Introduction

The AI Study Buddy is a web-based chatbot application that helps students learn any topic. It explains concepts in simple, beginner-friendly language, quizzes students after explanations, provides hints instead of direct answers, and encourages students throughout their learning journey. The application consists of a pure HTML/CSS/JavaScript frontend and a Node.js + Express backend that proxies requests to the Grok AI API (grok-3-mini).

## Glossary

- **Study_Buddy**: The AI Study Buddy web application as a whole
- **Frontend**: The browser-based UI consisting of index.html, css/style.css, and js/app.js
- **Backend**: The Node.js + Express server in server/server.js
- **Chat_Area**: The scrollable region of the UI that displays the conversation history
- **Conversation_History**: The ordered array of message objects (role + content) maintained in the browser
- **System_Prompt**: The fixed instruction object prepended to every API call that governs AI behavior
- **Grok_API**: The external AI completion service at https://api.x.ai/v1/chat/completions using model grok-3-mini
- **Message_Bubble**: A styled HTML element representing a single chat message from either the user or the AI
- **Typing_Indicator**: An animated three-dot element shown while the AI response is loading
- **Send_Button**: The UI control that submits the user's input message
- **Clear_Button**: The UI control that resets the conversation to its initial state

---

## Requirements

### Requirement 1: Project Structure and Configuration

**User Story:** As a developer, I want a well-structured project with clear configuration files, so that I can set up and run the application quickly.

#### Acceptance Criteria

1. THE Study_Buddy SHALL include a `package.json` with name `"study-buddy"`, dependencies for `express`, `dotenv`, `cors`, and `node-fetch`, and scripts `"start": "node server/server.js"` and `"dev": "nodemon server/server.js"`.
2. THE Study_Buddy SHALL include a `.env.example` file containing the keys `XAI_API_KEY=xai-your-key-here` and `PORT=3000` as placeholder values.
3. THE Study_Buddy SHALL include a `.gitignore` file that lists `.env` so that the real API key is never committed to version control.
4. THE Study_Buddy SHALL organize source files under the structure: `index.html` at root, `css/style.css`, `js/app.js`, and `server/server.js`.

---

### Requirement 2: Backend Server Setup

**User Story:** As a developer, I want a Node.js Express server that securely proxies AI API calls, so that the API key is never exposed to the browser.

#### Acceptance Criteria

1. WHEN the server starts, THE Backend SHALL load environment variables from `.env` using `dotenv.config()` as the very first statement before any `require` or initialization calls.
2. WHEN the server starts, THE Backend SHALL listen on the port defined by `process.env.PORT`, defaulting to `3000` if the variable is absent.
3. WHEN the server starts, THE Backend SHALL log `"Server running on http://localhost:<PORT>"` to the console, where `<PORT>` is the actual port the server bound to.
4. THE Backend SHALL serve all files from the project root directory as static assets using `express.static`.
5. THE Backend SHALL enable CORS for all routes and all origins using the `cors` middleware.
6. THE Backend SHALL include a comment block at the top of `server.js` containing at minimum: (1) `npm install`, (2) add API key to `.env`, (3) `npm start`, (4) open `http://localhost:3000`.
7. WHEN the server starts and `process.env.XAI_API_KEY` is absent or empty, THE Backend SHALL log an error message and exit the process with a non-zero exit code.

---

### Requirement 3: Chat API Endpoint

**User Story:** As a student, I want my messages sent to the AI and responses returned to me, so that I can have a learning conversation.

#### Acceptance Criteria

1. THE Backend SHALL expose a `POST /api/chat` endpoint that accepts a JSON body with a `messages` array where each element has a non-empty `role` string and a non-empty `content` string.
2. IF the request body is missing `messages`, or `messages` is empty, or any element is missing `role` or `content`, THEN THE Backend SHALL return `{ error: "Invalid request" }` with HTTP status `400`.
3. WHEN a valid request is received at `POST /api/chat`, THE Backend SHALL call the Grok_API at `https://api.x.ai/v1/chat/completions` with model `grok-3-mini`, `max_tokens` of `400`, and the provided `messages` array.
4. WHEN the Grok_API call succeeds, THE Backend SHALL return a JSON response `{ reply: "<AI response text>" }` with HTTP status `200`, where `<AI response text>` is the `content` field of the first choice in the Grok_API response.
5. IF the Grok_API call fails for any reason (network error, non-2xx status, or malformed response), THEN THE Backend SHALL return `{ error: "Something went wrong" }` with HTTP status `500`.
6. THE Backend SHALL include the `XAI_API_KEY` from environment variables in the `Authorization: Bearer` header of every Grok_API request.

---

### Requirement 4: Frontend HTML Structure

**User Story:** As a student, I want a clean, accessible chat interface, so that I can easily read and send messages.

#### Acceptance Criteria

1. THE Frontend SHALL include an element with `id="chat-area"` that contains all rendered Message_Bubbles and is the scrollable conversation history container.
2. THE Frontend SHALL include an element with `id="user-input"` of type `<textarea>` or `<input type="text">` for the student to type messages.
3. THE Frontend SHALL include a `<button>` element with `id="send-btn"` that submits the current message.
4. THE Frontend SHALL include a `<button>` element with `id="clear-btn"` that resets the conversation.
5. THE Frontend SHALL include an element with `id="typing-indicator"` that is hidden by default.
6. WHEN the Backend is processing a request, THE Frontend SHALL set `#typing-indicator` to visible.
7. WHEN the Backend response is received (success or error), THE Frontend SHALL set `#typing-indicator` to hidden.
8. THE Frontend SHALL include a `<link rel="stylesheet" href="css/style.css">` tag inside the `<head>` element.
9. THE Frontend SHALL include a `<script src="js/app.js">` tag immediately before the closing `</body>` tag.
10. THE Frontend SHALL use semantic HTML5 elements including at minimum `<header>`, `<main>`, and `<footer>` (or equivalent landmark roles) to structure the page.

---

### Requirement 5: Frontend Styling

**User Story:** As a student, I want a visually clean and mobile-friendly interface, so that I can use the app comfortably on any device.

#### Acceptance Criteria

1. THE Frontend SHALL display the page with a background color of `#F0F0F0` and the `#chat-area` with a background color of `#FFFFFF`.
2. THE Frontend SHALL render user Message_Bubbles with a background color of `#378ADD` and `text-align: right` (or `align-self: flex-end` in a flex container).
3. THE Frontend SHALL render AI Message_Bubbles with a background color of `#F1EFE8` and `text-align: left` (or `align-self: flex-start` in a flex container).
4. THE Frontend SHALL position the input bar using `position: fixed` or `position: sticky` so it remains visible at the bottom of the viewport at all times.
5. WHILE the Typing_Indicator is visible, THE Frontend SHALL animate it as exactly three dots with a vertical bounce cycle of `600ms` duration using CSS keyframe animation.
6. THE Frontend SHALL include a `<meta name="viewport" content="width=device-width, initial-scale=1">` tag so the layout scales correctly on mobile devices.
7. WHERE the viewport width is `375px` or wider, THE Frontend SHALL render without a horizontal scrollbar and all interactive elements (`#user-input`, `#send-btn`, `#clear-btn`) SHALL be reachable without horizontal scrolling.
8. THE Frontend SHALL apply `scroll-behavior: smooth` to the `#chat-area` element via CSS.
9. THE Frontend SHALL contain no `style` attributes on any HTML element and no `<style>` blocks in any HTML file; all visual rules SHALL be defined exclusively in `css/style.css`.

---

### Requirement 6: Frontend JavaScript Behavior

**User Story:** As a student, I want the chat to feel responsive and intuitive, so that I can focus on learning rather than the interface.

#### Acceptance Criteria

1. THE Frontend SHALL initialize the `conversationHistory` array with the System_Prompt object `{ role: "system", content: "<system prompt text>" }` as its first and only element before any user interaction.
2. WHEN the student presses the Enter key (without Shift) in `#user-input` and the input is non-empty, THE Frontend SHALL invoke `sendMessage()`.
3. WHEN the student clicks `#send-btn` and `#user-input` is non-empty, THE Frontend SHALL invoke `sendMessage()`.
4. WHEN `sendMessage()` is invoked with a non-empty input, THE Frontend SHALL trim the input value, append `{ role: "user", content: "<trimmed input>" }` to `conversationHistory`, and display it as a user Message_Bubble in `#chat-area`.
5. WHEN `sendMessage()` is invoked, THE Frontend SHALL clear `#user-input`, set `#send-btn` to `disabled`, and call `showTyping(true)` before the backend request is initiated.
6. WHEN calling the Backend, THE Frontend SHALL send a `POST` request to `/api/chat` with `Content-Type: application/json` and a body of `{ messages: conversationHistory }` containing the full array including the System_Prompt.
7. WHEN a successful response is received from the Backend, THE Frontend SHALL append `{ role: "assistant", content: "<reply>" }` to `conversationHistory` and display it as an AI Message_Bubble in `#chat-area`.
8. WHEN the Backend returns an error (non-2xx status or `{ error: ... }` body), THE Frontend SHALL display a Message_Bubble with the text `"Sorry, something went wrong. Please try again."` in `#chat-area` without modifying `conversationHistory`.
9. WHEN a new Message_Bubble is appended to `#chat-area`, THE Frontend SHALL call `#chat-area.scrollTop = #chat-area.scrollHeight` (or equivalent) to scroll to the bottom.
10. WHEN the Backend response is received (success or error), THE Frontend SHALL call `showTyping(false)` and re-enable `#send-btn`.
11. WHEN the student clicks `#clear-btn`, THE Frontend SHALL reset `conversationHistory` to `[System_Prompt]` and remove all child elements from `#chat-area`.
12. THE Frontend SHALL contain no string matching the pattern `/xai-[a-zA-Z0-9]+/` or any other API key value; all AI calls SHALL be proxied through `/api/chat`.

---

### Requirement 7: AI Study Buddy Behavior (System Prompt)

**User Story:** As a student, I want the AI to guide my learning without giving away answers, so that I actually understand the material.

#### Acceptance Criteria

1. THE System_Prompt SHALL contain an explicit instruction directing the AI to use simple vocabulary and short sentences suitable for a beginner encountering the topic for the first time.
2. THE System_Prompt SHALL contain an explicit instruction directing the AI to never state the answer to a homework or exam question directly, even if the student asks repeatedly.
3. THE System_Prompt SHALL contain an explicit instruction directing the AI to respond to student questions with one or more guiding questions that lead the student toward the answer rather than stating it.
4. THE System_Prompt SHALL contain an explicit instruction directing the AI to append exactly one quiz question to every explanatory response it produces.
5. THE System_Prompt SHALL contain an explicit instruction directing the AI that, when a student's answer is incorrect, it must respond with a hint that narrows the problem space without revealing the answer.
6. THE System_Prompt SHALL contain an explicit instruction directing the AI to limit every response to a maximum of 5 sentences.
7. THE System_Prompt SHALL contain an explicit instruction directing the AI to conclude every response with an encouraging phrase (e.g., "You're doing great!", "Keep it up!", "You've got this!").
