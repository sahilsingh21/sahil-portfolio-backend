const express = require('express');
const router = express.Router();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { PORTFOLIO_CONTEXT } = require('../config/portfolioContext');

const geminiClient = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.0-flash-lite'];

async function getGeminiResponse(messages) {
  const allMessages = messages.filter(m => m.content && m.content.trim());
  const lastMessage = allMessages.at(-1);
  let history = allMessages.slice(0, -1);

  // Remove leading assistant messages
  while (history.length > 0 && history[0].role === 'assistant') {
    history = history.slice(1);
  }

  // Ensure alternating roles
  const geminiHistory = [];
  let lastRole = null;
  for (const m of history) {
    const role = m.role === 'assistant' ? 'model' : 'user';
    if (role === lastRole) continue;
    geminiHistory.push({ role, parts: [{ text: m.content }] });
    lastRole = role;
  }

  // Try each model in order
  for (const modelName of MODELS) {
    try {
      console.log(`[Chat] Trying model: ${modelName}`);
      const model = geminiClient.getGenerativeModel({
        model: modelName,
        systemInstruction: {
          parts: [{ text: PORTFOLIO_CONTEXT }],
        },
      });

      const chat = model.startChat({ history: geminiHistory });
      const result = await chat.sendMessage(lastMessage?.content || '');
      const text = result.response.text();
      console.log(`[Chat] Success with model: ${modelName}`);
      return text;
    } catch (err) {
      console.warn(`[Chat] Model ${modelName} failed: ${err.message}`);
      continue;
    }
  }

  throw new Error('All Gemini models unavailable');
}

// GET /api/chat/models
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

// POST /api/chat
router.post('/', async (req, res) => {
  try {
    console.log('Chat request received:', req.body?.messages?.length, 'messages');

    const { messages } = req.body;
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'messages array is required' });
    }

    const reply = await getGeminiResponse(messages);

    // Track analytics — ignore if MongoDB is down
    try {
      const Analytics = require('../models/Analytics');
      await Analytics.create({
        event: 'chat_message',
        meta: { provider: 'gemini', userMsg: messages.at(-1)?.content?.slice(0, 80) },
      });
    } catch (dbErr) {
      console.log('Analytics skip:', dbErr.message);
    }

    res.status(200).json({ success: true, reply, provider: 'gemini' });
  } catch (err) {
    console.error('Chat error FULL:', err);
    res.status(200).json({
      success: true,
      reply: "I'm experiencing high demand right now. Please try again in a moment!",
      provider: 'gemini',
    });
  }
});

module.exports = router;