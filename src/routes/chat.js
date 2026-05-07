const express = require('express');
const router = express.Router();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { PORTFOLIO_CONTEXT } = require('../config/portfolioContext');

const geminiClient = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const MODELS = [
  'gemini-2.0-flash-lite',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function tryModel(modelName, geminiHistory, prompt) {
  const model = geminiClient.getGenerativeModel({
    model: modelName,
    systemInstruction: PORTFOLIO_CONTEXT,
  });

  const chat = model.startChat({
    history: geminiHistory,
  });

  return await chat.sendMessage(prompt);
}

async function getGeminiResponse(messages) {
  const validMessages = messages.filter(
    (m) => m?.content && m.content.trim()
  );

  const lastMessage = validMessages.at(-1);

  if (!lastMessage) {
    throw new Error('No valid user message');
  }

  let history = validMessages.slice(0, -1);

  // Remove invalid leading assistant/model messages
  while (
    history.length > 0 &&
    ['assistant', 'model'].includes(history[0].role)
  ) {
    history.shift();
  }

  // Gemini requires alternating roles
  const geminiHistory = [];

  let previousRole = null;

  for (const msg of history) {
    const role = msg.role === 'assistant' ? 'model' : 'user';

    if (role === previousRole) continue;

    geminiHistory.push({
      role,
      parts: [{ text: msg.content }],
    });

    previousRole = role;
  }

  let lastError = null;

  for (const modelName of MODELS) {
    try {
      console.log(`Trying Gemini model: ${modelName}`);

      const result = await tryModel(
        modelName,
        geminiHistory,
        lastMessage.content
      );

      const text = result.response.text();

      if (!text) {
        throw new Error('Empty response');
      }

      console.log(`Success: ${modelName}`);

      return text;
    } catch (err) {
      lastError = err;

      console.warn(`Model failed: ${modelName}`);
      console.warn(err.message);

      // Rate limit handling
      if (
        err.message.includes('429') ||
        err.message.includes('quota')
      ) {
        console.log('Rate limited. Waiting 2 seconds...');
        await sleep(2000);
      }

      continue;
    }
  }

  throw lastError || new Error('All Gemini models failed');
}

// GET available models
router.get('/models', async (req, res) => {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`
    );

    const data = await response.json();

    const models =
      data.models?.map((m) => ({
        name: m.name,
        displayName: m.displayName,
      })) || [];

    res.json({
      success: true,
      models,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

// Main chat route
router.post('/', async (req, res) => {
  try {
    const { messages } = req.body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'messages array required',
      });
    }

    console.log(`Incoming chat (${messages.length} msgs)`);

    const reply = await getGeminiResponse(messages);

    // Optional analytics
    try {
      const Analytics = require('../models/Analytics');

      await Analytics.create({
        event: 'chat_message',
        meta: {
          provider: 'gemini',
          preview: messages.at(-1)?.content?.slice(0, 100),
        },
      });
    } catch (analyticsErr) {
      console.log('Analytics skipped');
    }

    return res.status(200).json({
      success: true,
      provider: 'gemini',
      reply,
    });
  } catch (err) {
    console.error('FULL CHAT ERROR:', err);

    return res.status(200).json({
      success: true,
      provider: 'fallback',
      reply:
        'Server is busy right now. Please try again in a few moments.',
    });
  }
});

module.exports = router;