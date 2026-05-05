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

  // Filter out empty messages
  const allMessages = messages.filter(m => m.content && m.content.trim());

  // Separate history from last message
  const lastMessage = allMessages.at(-1);
  let history = allMessages.slice(0, -1);

  // Remove leading assistant messages — Gemini requires history to start with 'user'
  while (history.length > 0 && history[0].role === 'assistant') {
    history = history.slice(1);
  }

  // Convert to Gemini format
  const geminiHistory = history.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  const chat = model.startChat({ history: geminiHistory });
  const result = await chat.sendMessage(lastMessage?.content || '');
  return result.response.text();
}

// GET /api/chat/models — list available models (for debugging)
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

    res.json({ success: true, reply, provider: 'gemini' });
  } catch (err) {
    console.error('Chat error:', err.message);
    res.status(500).json({ error: 'AI chat temporarily unavailable. Please try again.' });
  }
});

module.exports = router;