const express = require('express');
const router = express.Router();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { PORTFOLIO_CONTEXT } = require('../config/portfolioContext');

const gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function getGeminiResponse(messages) {
  const model = gemini.getGenerativeModel({
    model: 'gemini-2.5-flash',
    systemInstruction: {
      parts: [{ text: PORTFOLIO_CONTEXT }],
    },
  });

  // Build history (all messages except the last one)
  const history = messages.slice(0, -1).map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  const chat = model.startChat({ history });
  const lastMessage = messages.at(-1)?.content || '';
  const result = await chat.sendMessage(lastMessage);
  return result.response.text();
}

// POST /api/chat
router.post('/', async (req, res) => {
  try {
    const { messages } = req.body;
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'messages array is required' });
    }

    const reply = await getGeminiResponse(messages);
    res.json({ success: true, reply, provider: 'gemini' });
  } catch (err) {
    console.error('Chat error:', err.message);
    res.status(500).json({ error: 'AI chat temporarily unavailable. Please try again.' });
  }
});

router.get('/models', async (req, res) => {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`
    );
    const data = await response.json();
    const models = data.models?.map(m => m.name) || [];
    res.json({ models });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;