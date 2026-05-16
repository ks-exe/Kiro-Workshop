require('dotenv').config();

/*
 * Setup:
 *   1. npm install
 *   2. Copy .env.example to .env and add your Groq API key: GROQ_API_KEY=gsk-your-key-here
 *   3. npm start
 *   4. Open http://localhost:3000
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const fetch = require('node-fetch');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..')));

// Guard: exit if API key is missing or empty
if (!process.env.GROQ_API_KEY || process.env.GROQ_API_KEY.trim() === '') {
  console.error('Error: GROQ_API_KEY is not set. Please add it to your .env file.');
  process.exit(1);
}

// POST /api/chat — proxy requests to the Groq API
app.post('/api/chat', async (req, res) => {
  const { messages } = req.body;

  // Validate: messages must be present, non-empty array, every element needs non-empty role and content
  if (
    !messages ||
    !Array.isArray(messages) ||
    messages.length === 0 ||
    messages.some(
      (m) =>
        !m.role || typeof m.role !== 'string' || m.role.trim() === '' ||
        !m.content || typeof m.content !== 'string' || m.content.trim() === ''
    )
  ) {
    return res.status(400).json({ error: 'Invalid request' });
  }

  try {
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 1200,
        messages,
      }),
    });

    if (!groqRes.ok) {
      return res.status(500).json({ error: 'Something went wrong' });
    }

    const data = await groqRes.json();

    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      return res.status(500).json({ error: 'Something went wrong' });
    }

    return res.status(200).json({ reply: data.choices[0].message.content });
  } catch (err) {
    return res.status(500).json({ error: 'Something went wrong' });
  }
});

// Export app for integration tests; only listen when run directly
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

module.exports = app;
