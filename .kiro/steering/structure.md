# Project Structure

```
├── server/
│   └── server.js          # Express backend — API proxy, static serving, validation
├── js/
│   └── app.js             # Frontend logic — chat, quiz, flashcards, DOM manipulation
├── css/
│   └── style.css          # All styles — dark theme, responsive, component styles
├── index.html             # Single-page HTML shell
├── tests/
│   ├── backend.property.test.js   # Property-based tests for /api/chat endpoint
│   ├── frontend.property.test.js  # Property-based tests for UI logic (jsdom)
│   └── integration.test.js        # End-to-end HTTP tests with mock Groq server
├── .env                   # Local secrets (not committed)
├── .env.example           # Template for required env vars
└── package.json           # Dependencies and scripts
```

## Architecture

- **Single-page app** — one HTML file, one JS file, one CSS file
- **Backend is a thin proxy** — validates input, forwards to Groq API, returns response verbatim
- **No build step** — static files served directly by Express from the project root
- **Frontend manages all state in memory** — conversation history, quiz data, flashcard deck
- **No database** — all data is ephemeral per browser session

## Conventions

- Backend exports `app` for testability; only calls `app.listen()` when run directly (`require.main === module`)
- Frontend uses `var` for globals that tests need to access via jsdom `window`
- CSS uses custom properties (variables) defined in `:root` for theming
- Tests mock `node-fetch` by patching `require.cache` — no DI framework
- Error messages returned to the client are generic ("Something went wrong") to avoid leaking internals
