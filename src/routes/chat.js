const express = require('express');
const router = express.Router();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { PORTFOLIO_CONTEXT } = require('../config/portfolioContext');

const geminiClient = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const OLLAMA_URL = process.env.OLLAMA_URL || 'https://ai.sahilsingh.co.in';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3';

const GEMINI_MODELS = [
  'gemini-2.0-flash-lite',
  'gemini-2.5-flash',
  'gemini-flash-latest',
];

// ── Ollama ────────────────────────────────────────────────────────────────────
async function getOllamaResponse(messages) {
  const ollamaMessages = [
    { role: 'system', content: PORTFOLIO_CONTEXT },
    ...messages.map(m => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content,
    })),
  ];

  const response = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      messages: ollamaMessages,
      stream: false,
    }),
    signal: AbortSignal.timeout(30000), // 30 second timeout
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Ollama error ${response.status}: ${err}`);
  }

  const data = await response.json();
  return data.message?.content || '';
}

// ── Gemini fallback ───────────────────────────────────────────────────────────
async function getGeminiResponse(messages) {
  const allMessages = messages.filter(m => m.content && m.content.trim());
  const lastMessage = allMessages.at(-1);
  let history = allMessages.slice(0, -1);

  while (history.length > 0 && history[0].role === 'assistant') {
    history = history.slice(1);
  }

  const geminiHistory = [];
  let lastRole = null;
  for (const m of history) {
    const role = m.role === 'assistant' ? 'model' : 'user';
    if (role === lastRole) continue;
    geminiHistory.push({ role, parts: [{ text: m.content }] });
    lastRole = role;
  }

  for (const modelName of GEMINI_MODELS) {
    try {
      console.log(`[Gemini] Trying: ${modelName}`);
      const model = geminiClient.getGenerativeModel({
        model: modelName,
        systemInstruction: { parts: [{ text: PORTFOLIO_CONTEXT }] },
      });
      const chat = model.startChat({ history: geminiHistory });
      const result = await chat.sendMessage(lastMessage?.content || '');
      return result.response.text();
    } catch (err) {
      console.warn(`[Gemini] ${modelName} failed: ${err.message}`);
      continue;
    }
  }

  throw new Error('All Gemini models unavailable');
}

// ── Main handler ──────────────────────────────────────────────────────────────
async function getAIResponse(messages) {
  // Try Ollama first — no quota, no cost
  try {
    console.log('[Chat] Trying Ollama...');
    const reply = await getOllamaResponse(messages);
    console.log('[Chat] Ollama success');
    return { reply, provider: 'ollama' };
  } catch (err) {
    console.warn('[Chat] Ollama failed:', err.message);
  }

  // Fallback to Gemini
  try {
    console.log('[Chat] Trying Gemini...');
    const reply = await getGeminiResponse(messages);
    console.log('[Chat] Gemini success');
    return { reply, provider: 'gemini' };
  } catch (err) {
    console.warn('[Chat] Gemini failed:', err.message);
  }

  // Both failed
  return {
    reply: "I'm experiencing high demand right now. Please try again in a moment!",
    provider: 'none',
  };
}

// GET /api/chat/models
router.get('/models', async (req, res) => {
  try {
    const response = await fetch(`${OLLAMA_URL}/api/tags`);
    const data = await response.json();
    res.json({ ollama: data.models?.map(m => m.name), url: OLLAMA_URL });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/chat
router.post('/', async (req, res) => {
  try {
    console.log('Chat request:', req.body?.messages?.length, 'messages');
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'messages array is required' });
    }

    const { reply, provider } = await getAIResponse(messages);

    // Track analytics
    try {
      const Analytics = require('../models/Analytics');
      await Analytics.create({
        event: 'chat_message',
        meta: { provider, userMsg: messages.at(-1)?.content?.slice(0, 80) },
      });
    } catch (dbErr) {
      console.log('Analytics skip:', dbErr.message);
    }

    res.status(200).json({ success: true, reply, provider });
  } catch (err) {
    console.error('Chat error:', err.message);
    res.status(200).json({
      success: true,
      reply: "I'm experiencing high demand. Please try again in a moment!",
      provider: 'none',
    });
  }
});

module.exports = router;