const express = require('express');
const router = express.Router();
const Anthropic = require('@anthropic-ai/sdk').default || require('@anthropic-ai/sdk');
const { PORTFOLIO_CONTEXT } = require('../config/portfolioContext');
const Analytics = require('../models/Analytics');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// POST /api/chat — non-streaming response
router.post('/', async (req, res) => {
  try {
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'messages array is required' });
    }

    // Keep last 10 messages for context window efficiency
    const recentMessages = messages.slice(-10);

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 600,
      system: PORTFOLIO_CONTEXT,
      messages: recentMessages,
    });

    const reply = response.content[0]?.text || "I'm not sure about that. Try asking about Sahil's projects or experience!";

    // Track chat usage
    await Analytics.create({ event: 'chat_message', meta: { userMsg: messages.at(-1)?.content?.slice(0, 80) } });

    res.json({ success: true, reply });
  } catch (err) {
    console.error('Chat error:', err.message);
    res.status(500).json({ error: 'AI chat temporarily unavailable. Please try again.' });
  }
});

// POST /api/chat/stream — streaming SSE response
router.post('/stream', async (req, res) => {
  try {
    const { messages } = req.body;
    if (!messages?.length) return res.status(400).json({ error: 'messages required' });

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const stream = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 600,
      system: PORTFOLIO_CONTEXT,
      messages: messages.slice(-10),
      stream: true,
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
        res.write(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`);
      }
      if (event.type === 'message_stop') {
        res.write('data: [DONE]\n\n');
        break;
      }
    }

    res.end();
  } catch (err) {
    console.error('Stream error:', err.message);
    res.write(`data: ${JSON.stringify({ error: 'Stream failed' })}\n\n`);
    res.end();
  }
});

module.exports = router;
