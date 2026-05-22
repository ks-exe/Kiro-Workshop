# Tech Stack

## Runtime & Language
- Node.js (CommonJS modules)
- Vanilla JavaScript (no frontend framework, no bundler)
- Plain CSS (no preprocessor)

## Backend
- Express.js for HTTP server and static file serving
- `node-fetch` v2 for outbound HTTP requests
- `dotenv` for environment variable loading
- `cors` middleware enabled

## AI Integration
- Groq API (`https://api.groq.com/openai/v1/chat/completions`)
- Model: `llama-3.3-70b-versatile`
- Max tokens: 1200
- API key stored in `.env` as `GROQ_API_KEY`

## Testing
- No test framework — tests use raw `assert` and custom runners
- Property-based testing with `fast-check` (minimum 100 runs per property)
- DOM simulation with `jsdom` for frontend property tests
- `supertest` for HTTP endpoint testing
- Tests are standalone scripts run with `node`

## Dev Dependencies
- `fast-check` — property-based test generation
- `jsdom` — browser DOM simulation for tests
- `node-fetch` — HTTP client (also used as dev dep for mocking in tests)
- `supertest` — HTTP assertion library

## Commands

| Action | Command |
|--------|---------|
| Install dependencies | `npm install` |
| Start server | `npm start` |
| Start with auto-reload | `npm run dev` (requires nodemon) |
| Run integration tests | `npm test` |
| Run backend property tests | `node tests/backend.property.test.js` |
| Run frontend property tests | `node tests/frontend.property.test.js` |
| Run all tests | `node tests/backend.property.test.js & node tests/frontend.property.test.js & node tests/integration.test.js` |

## Environment Variables

| Variable | Purpose | Required |
|----------|---------|----------|
| `GROQ_API_KEY` | Groq API authentication | Yes |
| `PORT` | Server port (default: 3000) | No |
