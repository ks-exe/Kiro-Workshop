#  AI Study Buddy

An AI-powered web chatbot that helps students learn any topic through guided conversation using the Socratic method. Instead of giving direct answers, it asks guiding questions, generates quizzes, and creates flashcards to reinforce learning.

##  About This Project

This project was built as part of the **Seekho aur Banao** workshop series (Day 02) that I host to teach students how to use **Kiro** — an AI-powered development environment. The goal is to demonstrate how you can go from idea to a fully working application using Kiro's features like:

- **Steering files** — Project-level rules that guide the AI's coding style and decisions
- **Specs** — Structured requirements → design → tasks workflow for building features
- **Agent hooks** — Automated actions triggered by IDE events (linting on save, tests after tasks, etc.)
- **AI-assisted coding** — Writing, debugging, and refactoring code through natural conversation

Students follow along in the workshop to build this project from scratch using Kiro, learning how AI-assisted development works in practice.

##  Features

- **Socratic Chat** — Ask any question and receive guided responses that lead you toward understanding rather than handing you the answer
- **Quiz Generation** — Generate multiple-choice quizzes based on your conversation to test your knowledge
- **Flashcards** — Create study flashcards summarizing key concepts discussed in the chat
- **Dark Theme UI** — Clean, modern dark interface with responsive design
- **Encouraging Feedback** — Every response ends with an encouraging phrase to keep you motivated

##  Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vanilla JavaScript, HTML5, CSS3 |
| Backend | Node.js, Express.js |
| AI Model | Groq API (LLaMA 3.3 70B Versatile) |
| Testing | fast-check, jsdom, supertest |

##  Project Structure

```
├── server/
│   └── server.js          # Express backend — API proxy, static serving, validation
├── js/
│   └── app.js             # Frontend logic — chat, quiz, flashcards, DOM manipulation
├── css/
│   └── style.css          # Dark theme, responsive, component styles
├── index.html             # Single-page HTML shell
├── tests/
│   ├── backend.property.test.js   # Property-based tests for /api/chat endpoint
│   ├── frontend.property.test.js  # Property-based tests for UI logic (jsdom)
│   └── integration.test.js        # End-to-end HTTP tests with mock Groq server
├── .env.example           # Template for required env vars
└── package.json           # Dependencies and scripts
```

##  Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v16 or higher)
- A [Groq API key](https://console.groq.com/) (free tier available)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/ks-exe/Kiro-Workshop.git
   cd Kiro-Workshop
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```
   Open `.env` and replace the placeholder with your actual Groq API key:
   ```
   GROQ_API_KEY=gsk-your-actual-key-here
   ```

4. **Start the server**
   ```bash
   npm start
   ```

5. **Open in browser**
   ```
   http://localhost:3000
   ```

##  Usage

1. **Chat** — Type a question or topic in the input box and press Send (or Enter)
2. **Generate Quiz** — After receiving an AI response, click the " Generate Quiz" button below any message to get a 3-question multiple-choice quiz
3. **Flashcards** — Click the " Flashcards" button in the header to generate study cards from your conversation
4. **Clear** — Click "Clear" to reset the conversation and start fresh

##  Running Tests

```bash
# Integration tests
npm test

# Backend property-based tests
node tests/backend.property.test.js

# Frontend property-based tests
node tests/frontend.property.test.js

# Run all tests
node tests/backend.property.test.js & node tests/frontend.property.test.js & node tests/integration.test.js
```

##  Environment Variables

| Variable | Purpose | Required |
|----------|---------|----------|
| `GROQ_API_KEY` | Groq API authentication key | Yes |
| `PORT` | Server port (default: 3000) | No |

##  Architecture

- **Single-page app** — One HTML file, one JS file, one CSS file
- **Backend is a thin proxy** — Validates input, forwards to Groq API, returns response
- **No build step** — Static files served directly by Express
- **No database** — All data is ephemeral per browser session
- **Frontend manages all state in memory** — Conversation history, quiz data, flashcard deck

##  AI Behavior Rules

The AI tutor follows strict guidelines:
- Never gives direct answers to homework/exam questions
- Responds with guiding questions (Socratic method)
- Limits responses to 5 sentences with simple vocabulary
- Includes a quiz question in every explanatory response
- Provides hints (not corrections) for incorrect answers
- Ends every response with encouragement

##  License

This project is open source and available for educational purposes.

---

Built with ❤️ using [Kiro](https://kiro.dev) during Seekho aur Banao Workshop — Day 02
