const express = require('express');
const router = express.Router();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { PORTFOLIO_CONTEXT } = require('../config/portfolioContext');

const geminiClient = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const OLLAMA_URL = process.env.OLLAMA_URL || 'https://ai.sahilsingh.co.in';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL;

const GEMINI_MODELS = [
  'gemini-2.0-flash-lite',
  'gemini-2.5-flash',
  'gemini-flash-latest',
];

async function getOllamaModels() {
  const urls = [`${OLLAMA_URL}/api/tags`, `${OLLAMA_URL}/api/models`];
  let data;

  for (const url of urls) {
    try {
      const response = await fetch(url);
      if (!response.ok) continue;
      data = await response.json();
      break;
    } catch (err) {
      continue;
    }
  }

  const models = data?.models?.map(m => m.name) || data?.tags?.map(t => t.name) || [];
  if (!models.length) {
    throw new Error('Could not discover any Ollama models from configured URL');
  }

  return models;
}

function resolveOllamaModel(models) {
  if (OLLAMA_MODEL && models.includes(OLLAMA_MODEL)) {
    return OLLAMA_MODEL;
  }

  return models.find(name => name.startsWith('llama3')) || models[0];
}

// ── Ollama ────────────────────────────────────────────────────────────────────
function normalizeOllamaReply(data) {
  return (
    data?.choices?.[0]?.message?.content ||
    data?.message?.content ||
    (typeof data?.output === 'string' && data.output) ||
    (typeof data?.response === 'string' && data.response) ||
    data?.choices?.[0]?.text ||
    ''
  );
}

async function callOllama(url, payload) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(30000), // 30 second timeout
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Ollama error ${response.status} ${response.statusText}: ${body}`);
  }

  return response.json();
}

async function getOllamaResponse(messages) {
  const ollamaMessages = [
    { role: 'system', content: PORTFOLIO_CONTEXT },
    ...messages.map(m => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content,
    })),
  ];

  const models = await getOllamaModels();
  const model = resolveOllamaModel(models);
  const payload = {
    model,
    messages: ollamaMessages,
    stream: false,
  };

  const endpoints = [
    `${OLLAMA_URL}/api/chat`,
    `${OLLAMA_URL}/api/v1/chat`,
    `${OLLAMA_URL}/chat`,
  ];

  let lastError;
  for (const url of endpoints) {
    try {
      console.log(`[Ollama] Trying: ${url} with model=${model}`);
      const data = await callOllama(url, payload);
      const reply = normalizeOllamaReply(data);
      if (!reply) {
        throw new Error(`Unable to parse Ollama response: ${JSON.stringify(data).slice(0, 1000)}`);
      }
      return reply;
    } catch (err) {
      console.warn(`[Ollama] ${url} failed: ${err.message}`);
      lastError = err;
    }
  }

  throw lastError || new Error('All Ollama endpoints failed');
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
    const urls = [`${OLLAMA_URL}/api/tags`, `${OLLAMA_URL}/api/models`];
    let data;
    let urlUsed;

    for (const url of urls) {
      const response = await fetch(url);
      if (!response.ok) continue;
      data = await response.json();
      urlUsed = url;
      break;
    }

    if (!data) {
      throw new Error('Unable to fetch Ollama models from configured URL');
    }

    const models = data.models?.map(m => m.name)
      || data.tags?.map(t => t.name)
      || [];

    const selectedModel = OLLAMA_MODEL && models.includes(OLLAMA_MODEL)
      ? OLLAMA_MODEL
      : models.find(name => name.startsWith('llama3')) || models[0];

    res.json({ ollama: models, url: OLLAMA_URL, urlUsed, selectedModel });
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