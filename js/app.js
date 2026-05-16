// ============================================================
// AI Study Buddy — js/app.js
// Manages conversation state, UI updates, and API communication.
// No API keys are stored here; all AI calls are proxied through /api/chat.
// ============================================================

// ── System Prompt and Conversation History ───────────────────

const SYSTEM_PROMPT = {
  role: "system",
  content:
    "You are a friendly AI tutor helping students learn. Follow these rules strictly on every response:\n" +
    "1. Use simple vocabulary and short sentences suitable for a beginner encountering the topic for the first time.\n" +
    "2. Never state the answer to a homework or exam question directly, even if the student asks repeatedly.\n" +
    "3. Respond to student questions with one or more guiding questions that lead the student toward the answer rather than stating it.\n" +
    "4. Append exactly one quiz question to every explanatory response you produce.\n" +
    "5. When a student's answer is incorrect, respond with a hint that narrows the problem space without revealing the answer.\n" +
    "6. Limit every response to a maximum of 5 sentences.\n" +
    "7. Conclude every response with an encouraging phrase such as \"You're doing great!\", \"Keep it up!\", or \"You've got this!\""
};

let conversationHistory = [SYSTEM_PROMPT];

// ── Quiz state ───────────────────────────────────────────────
let currentQuizData = null;

// ── Flashcard state ──────────────────────────────────────────
let flashcards = [];
let currentCardIndex = 0;

// ── Core UI helpers ──────────────────────────────────────────

/**
 * Creates a message bubble and appends it to #chat-area.
 * For assistant messages, also appends a "Generate Quiz" button below.
 * @param {string} role - "user", "assistant", or "error"
 * @param {string} text - The message content to display
 * @returns {HTMLElement} The created bubble element
 */
function appendMessage(role, text) {
  const chatArea = document.getElementById("chat-area");

  const div = document.createElement("div");
  div.classList.add("message", role);
  div.textContent = text;
  chatArea.appendChild(div);

  // Add "Generate Quiz" button after every assistant message
  if (role === "assistant") {
    const wrapper = document.createElement("div");
    wrapper.classList.add("quiz-trigger-wrapper");

    const quizBtn = document.createElement("button");
    quizBtn.type = "button";
    quizBtn.classList.add("generate-quiz-btn");
    quizBtn.textContent = "📝 Generate Quiz";
    quizBtn.addEventListener("click", function () {
      generateQuiz(quizBtn);
    });

    wrapper.appendChild(quizBtn);
    chatArea.appendChild(wrapper);
  }

  chatArea.scrollTop = chatArea.scrollHeight;
  return div;
}

/**
 * Shows or hides the typing indicator and toggles the send button.
 * @param {boolean} bool
 */
function showTyping(bool) {
  const typingIndicator = document.getElementById("typing-indicator");
  const sendBtn = document.getElementById("send-btn");

  if (bool) {
    typingIndicator.classList.add("visible");
  } else {
    typingIndicator.classList.remove("visible");
  }

  sendBtn.disabled = bool;
}

// ── Send message ─────────────────────────────────────────────

/**
 * Reads the user input, updates conversation history, sends the request
 * to the backend, and renders the AI reply (or an error bubble).
 */
async function sendMessage() {
  const userInput = document.getElementById("user-input");
  const trimmedInput = userInput.value.trim();

  if (!trimmedInput) return;

  conversationHistory.push({ role: "user", content: trimmedInput });
  appendMessage("user", trimmedInput);

  userInput.value = "";
  showTyping(true);

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: conversationHistory })
    });

    const data = await response.json();

    if (response.ok && data.reply) {
      conversationHistory.push({ role: "assistant", content: data.reply });
      appendMessage("assistant", data.reply);
    } else {
      appendMessage("error", "Sorry, something went wrong. Please try again.");
    }
  } catch (err) {
    appendMessage("error", "Sorry, something went wrong. Please try again.");
  } finally {
    showTyping(false);
  }
}

// ── Clear conversation ───────────────────────────────────────

/**
 * Resets the conversation to its initial state.
 * Removes all message bubbles and quiz trigger wrappers from #chat-area.
 * Also hides the quiz container.
 */
function clearConversation() {
  conversationHistory = [SYSTEM_PROMPT];

  const chatArea = document.getElementById("chat-area");
  chatArea.querySelectorAll(".message, .quiz-trigger-wrapper").forEach((el) => el.remove());

  hideQuiz();
}

// ── Feature 1: Generate Quiz ─────────────────────────────────

const QUIZ_PROMPT =
  "Based on our conversation so far, generate a multiple choice quiz with " +
  "3 questions. For each question provide 4 options labeled A, B, C, D " +
  "and mark the correct answer. Return ONLY valid JSON in this exact format: " +
  "{\"questions\":[{\"question\":\"Question text here\"," +
  "\"options\":{\"A\":\"...\",\"B\":\"...\",\"C\":\"...\",\"D\":\"...\"}," +
  "\"answer\":\"A\"}]}";

/**
 * Called when a "Generate Quiz" button is clicked.
 * @param {HTMLButtonElement} triggerBtn - The button that was clicked
 */
async function generateQuiz(triggerBtn) {
  triggerBtn.disabled = true;
  triggerBtn.textContent = "⏳ Generating…";

  // Build messages: full history + quiz instruction (not stored in history)
  const messages = [
    ...conversationHistory,
    { role: "user", content: QUIZ_PROMPT }
  ];

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages })
    });

    const data = await response.json();

    if (!response.ok || !data.reply) {
      throw new Error("Bad response from server");
    }

    // Extract JSON from the reply (model may wrap it in markdown code fences)
    const jsonText = extractJSON(data.reply);
    const parsed = JSON.parse(jsonText);

    if (!parsed.questions || !Array.isArray(parsed.questions) || parsed.questions.length === 0) {
      throw new Error("Invalid quiz format");
    }

    currentQuizData = parsed.questions;
    renderQuiz(currentQuizData);

    triggerBtn.textContent = "✅ Quiz Ready";
  } catch (err) {
    triggerBtn.disabled = false;
    triggerBtn.textContent = "📝 Generate Quiz";
    appendMessage("error", "Couldn't generate quiz. Please try again.");
  }
}

/**
 * Strips markdown code fences and extracts the first JSON object/array.
 * @param {string} text
 * @returns {string}
 */
function extractJSON(text) {
  // Remove ```json ... ``` or ``` ... ``` fences
  let cleaned = text.replace(/```(?:json)?\s*([\s\S]*?)```/g, "$1").trim();
  // Find the first { ... } block
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start !== -1 && end !== -1) {
    return cleaned.slice(start, end + 1);
  }
  return cleaned;
}

/**
 * Renders the quiz card UI.
 * @param {Array} questions
 */
function renderQuiz(questions) {
  const container = document.getElementById("quiz-container");
  const questionsEl = document.getElementById("quiz-questions");
  const scoreEl = document.getElementById("quiz-score");
  const tryAgainBtn = document.getElementById("try-again-btn");

  questionsEl.innerHTML = "";
  scoreEl.classList.add("hidden");
  scoreEl.textContent = "";
  tryAgainBtn.classList.add("hidden");

  questions.forEach((q, idx) => {
    const block = document.createElement("div");
    block.classList.add("quiz-question-block");
    block.dataset.answer = q.answer;
    block.dataset.answered = "false";

    const questionText = document.createElement("p");
    questionText.classList.add("quiz-question-text");
    questionText.textContent = `${idx + 1}. ${q.question}`;
    block.appendChild(questionText);

    const optionsGrid = document.createElement("div");
    optionsGrid.classList.add("quiz-options");

    Object.entries(q.options).forEach(([letter, text]) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.classList.add("quiz-option-btn");
      btn.textContent = `${letter}: ${text}`;
      btn.dataset.letter = letter;

      btn.addEventListener("click", function () {
        handleQuizAnswer(block, letter, btn);
      });

      optionsGrid.appendChild(btn);
    });

    block.appendChild(optionsGrid);

    const feedback = document.createElement("p");
    feedback.classList.add("quiz-feedback");
    block.appendChild(feedback);

    questionsEl.appendChild(block);
  });

  container.classList.remove("hidden");

  // Scroll quiz into view
  container.scrollIntoView({ behavior: "smooth", block: "start" });
}

/**
 * Handles a quiz option click.
 */
function handleQuizAnswer(block, selectedLetter, selectedBtn) {
  if (block.dataset.answered === "true") return;
  block.dataset.answered = "true";

  const correctLetter = block.dataset.answer;
  const allBtns = block.querySelectorAll(".quiz-option-btn");
  const feedback = block.querySelector(".quiz-feedback");

  // Disable all buttons
  allBtns.forEach((b) => { b.disabled = true; });

  // Mark correct button green
  allBtns.forEach((b) => {
    if (b.dataset.letter === correctLetter) {
      b.classList.add("correct");
    }
  });

  if (selectedLetter === correctLetter) {
    selectedBtn.classList.add("correct");
    feedback.textContent = "Correct! 🎉";
    feedback.classList.add("correct");
  } else {
    selectedBtn.classList.add("wrong");
    feedback.textContent = `Not quite! The answer was ${correctLetter}.`;
    feedback.classList.add("wrong");
  }

  // Check if all questions answered → show score
  checkQuizComplete();
}

/**
 * Checks if all questions are answered and shows the score.
 */
function checkQuizComplete() {
  const blocks = document.querySelectorAll(".quiz-question-block");
  const allAnswered = Array.from(blocks).every((b) => b.dataset.answered === "true");

  if (!allAnswered) return;

  let correct = 0;
  blocks.forEach((b) => {
    const correctLetter = b.dataset.answer;
    const selectedWrong = b.querySelector(".quiz-option-btn.wrong");
    if (!selectedWrong) correct++; // no wrong selection means they got it right
  });

  const scoreEl = document.getElementById("quiz-score");
  scoreEl.textContent = `You scored ${correct} out of ${blocks.length} 🏆`;
  scoreEl.classList.remove("hidden");

  document.getElementById("try-again-btn").classList.remove("hidden");
}

/**
 * Resets the quiz (Try Again) without touching the chat.
 */
function resetQuiz() {
  if (currentQuizData) {
    renderQuiz(currentQuizData);
  }
}

/**
 * Hides the quiz container.
 */
function hideQuiz() {
  document.getElementById("quiz-container").classList.add("hidden");
  currentQuizData = null;
}

// ── Feature 2: Flashcards ────────────────────────────────────

const FLASHCARD_PROMPT =
  "Based on our conversation, generate 5 flashcards for the most " +
  "important points and key concepts covered.\n" +
  "STRICT RULES you must follow:\n" +
  "1. Front side: the topic or term (2 to 4 words max)\n" +
  "2. Back side: MUST be a full meaningful sentence of 10 to 20 words " +
  "explaining the most important thing about that topic\n" +
  "3. Back side must NEVER be a single word\n" +
  "4. Back side must NEVER be a question\n" +
  "5. Back side must NEVER be vague or generic\n" +
  "EXAMPLE of correct format:\n" +
  "{\"flashcards\":[" +
  "{\"front\":\"Machine Learning\"," +
  "\"back\":\"A type of AI that learns patterns from data to make predictions without being explicitly programmed.\"}," +
  "{\"front\":\"Neural Network\"," +
  "\"back\":\"A system of connected nodes inspired by the human brain that processes information in layers.\"}" +
  "]}\n" +
  "Follow this example format exactly.\n" +
  "Return ONLY valid JSON, no extra text, no markdown, no code fences.";

/**
 * Called when the "Generate Flashcards" header button is clicked.
 */
async function generateFlashcards() {
  // Guard: need at least one user message beyond the system prompt
  const hasChat = conversationHistory.some((m) => m.role === "user");
  if (!hasChat) {
    showFlashcardModal([]);
    return;
  }

  const flashcardsBtn = document.getElementById("flashcards-btn");
  flashcardsBtn.disabled = true;
  flashcardsBtn.textContent = "⏳ Generating…";

  const messages = [
    ...conversationHistory,
    { role: "user", content: FLASHCARD_PROMPT }
  ];

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages })
    });

    const data = await response.json();

    if (!response.ok || !data.reply) throw new Error("Bad response");

    const jsonText = extractJSON(data.reply);
    const parsed = JSON.parse(jsonText);

    if (!parsed.flashcards || !Array.isArray(parsed.flashcards) || parsed.flashcards.length === 0) {
      throw new Error("Invalid flashcard format");
    }

    flashcards = parsed.flashcards;
    currentCardIndex = 0;
    showFlashcardModal(flashcards);
  } catch (err) {
    appendMessage("error", "Couldn't generate flashcards. Please try again.");
  } finally {
    flashcardsBtn.disabled = false;
    flashcardsBtn.textContent = "✨ Flashcards";
  }
}

/**
 * Opens the flashcard modal.
 * @param {Array} cards - Array of { front, back } objects. Empty = show friendly message.
 */
function showFlashcardModal(cards) {
  const modal = document.getElementById("flashcard-modal");
  modal.classList.remove("hidden");

  if (cards.length === 0) {
    // No chat yet — show friendly message
    document.getElementById("flashcard-counter").textContent = "";
    document.getElementById("flashcard-front-text").textContent =
      "Chat with me first, then I'll make flashcards!";
    document.getElementById("flashcard-back-text").textContent = "";
    document.getElementById("flashcard").classList.remove("flipped");
    document.getElementById("prev-card-btn").disabled = true;
    document.getElementById("next-card-btn").disabled = true;
    return;
  }

  document.getElementById("prev-card-btn").disabled = false;
  document.getElementById("next-card-btn").disabled = false;
  renderFlashcard();
}

/**
 * Renders the current flashcard.
 */
function renderFlashcard() {
  const card = flashcards[currentCardIndex];
  document.getElementById("flashcard-front-text").textContent = card.front;
  document.getElementById("flashcard-back-text").textContent = card.back;
  document.getElementById("flashcard-counter").textContent =
    `Card ${currentCardIndex + 1} of ${flashcards.length}`;

  // Reset flip state for new card
  document.getElementById("flashcard").classList.remove("flipped");
}

/**
 * Closes the flashcard modal.
 */
function closeFlashcardModal() {
  document.getElementById("flashcard-modal").classList.add("hidden");
}

// ── Event listeners ──────────────────────────────────────────

document.addEventListener("DOMContentLoaded", function () {
  const sendBtn        = document.getElementById("send-btn");
  const userInput      = document.getElementById("user-input");
  const clearBtn       = document.getElementById("clear-btn");
  const flashcardsBtn  = document.getElementById("flashcards-btn");
  const closeFlashBtn  = document.getElementById("close-flashcards-btn");
  const flashcard      = document.getElementById("flashcard");
  const prevCardBtn    = document.getElementById("prev-card-btn");
  const nextCardBtn    = document.getElementById("next-card-btn");
  const closeQuizBtn   = document.getElementById("close-quiz-btn");
  const tryAgainBtn    = document.getElementById("try-again-btn");

  // ── Chat controls
  sendBtn.addEventListener("click", sendMessage);

  userInput.addEventListener("keydown", function (event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  });

  clearBtn.addEventListener("click", clearConversation);

  // ── Flashcard controls
  flashcardsBtn.addEventListener("click", generateFlashcards);

  closeFlashBtn.addEventListener("click", closeFlashcardModal);

  // Close modal when clicking the dark overlay (outside the box)
  document.getElementById("flashcard-modal").addEventListener("click", function (e) {
    if (e.target === this) closeFlashcardModal();
  });

  // Flip card on click or Enter/Space key
  flashcard.addEventListener("click", function () {
    this.classList.toggle("flipped");
  });

  flashcard.addEventListener("keydown", function (e) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      this.classList.toggle("flipped");
    }
  });

  prevCardBtn.addEventListener("click", function () {
    if (flashcards.length === 0) return;
    currentCardIndex = (currentCardIndex - 1 + flashcards.length) % flashcards.length;
    renderFlashcard();
  });

  nextCardBtn.addEventListener("click", function () {
    if (flashcards.length === 0) return;
    currentCardIndex = (currentCardIndex + 1) % flashcards.length;
    renderFlashcard();
  });

  // ── Quiz controls
  closeQuizBtn.addEventListener("click", hideQuiz);
  tryAgainBtn.addEventListener("click", resetQuiz);
});
