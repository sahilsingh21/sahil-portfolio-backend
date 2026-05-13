const express = require('express');
const router = express.Router();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { PORTFOLIO_CONTEXT } = require('../config/portfolioContext');

const gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
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

async function callOllama(url, payload) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Ollama error ${response.status} ${response.statusText}: ${body}`);
  }

  return response.json();
}

async function getOllamaAnalysis(prompt) {
  const models = await getOllamaModels();
  const model = resolveOllamaModel(models);
  const payload = {
    model,
    messages: [{ role: 'user', content: prompt }],
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
      console.log(`[Ollama Analyze] Trying: ${url} with model=${model}`);
      const data = await callOllama(url, payload);
      const reply = data?.message?.content || data?.response || '';
      if (!reply) {
        throw new Error(`Unable to parse Ollama response: ${JSON.stringify(data).slice(0, 1000)}`);
      }
      return reply;
    } catch (err) {
      console.warn(`[Ollama Analyze] ${url} failed: ${err.message}`);
      lastError = err;
    }
  }

  throw lastError || new Error('All Ollama endpoints failed');
}

async function getGeminiAnalysis(prompt) {
  for (const modelName of GEMINI_MODELS) {
    try {
      console.log(`[Gemini Analyze] Trying: ${modelName}`);
      const model = gemini.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(prompt);
      return result.response.text();
    } catch (err) {
      console.warn(`[Gemini Analyze] ${modelName} failed: ${err.message}`);
      continue;
    }
  }

  throw new Error('All Gemini models unavailable');
}

async function analyzeWithAI(prompt) {
  // Try Ollama first
  try {
    console.log('[Analyze] Trying Ollama...');
    const reply = await getOllamaAnalysis(prompt);
    console.log('[Analyze] Ollama success');
    return reply;
  } catch (err) {
    console.warn('[Analyze] Ollama failed:', err.message);
  }

  // Fallback to Gemini
  try {
    console.log('[Analyze] Trying Gemini...');
    const reply = await getGeminiAnalysis(prompt);
    console.log('[Analyze] Gemini success');
    return reply;
  } catch (err) {
    console.warn('[Analyze] Gemini failed:', err.message);
  }

  throw new Error('All AI providers failed');
}

// POST /api/analyze/jd — match job description to Sahil's profile
router.post('/jd', async (req, res) => {
  try {
    const { jobDescription } = req.body;
    if (!jobDescription || jobDescription.length < 50) {
      return res.status(400).json({ error: 'Please provide a full job description (min 50 chars)' });
    }

    const prompt = `
You are a technical recruiter. Analyze how well Sahil Singh matches the job description below.
Respond ONLY with a valid JSON object — no markdown, no backticks, no extra text.

Required JSON format:
{
  "score": <number 0-100>,
  "matched_skills": ["skill1", "skill2"],
  "missing_skills": ["skill1", "skill2"],
  "strengths": ["strength1", "strength2"],
  "suggestion": "<one concise sentence>"
}

Sahil's Profile:
${PORTFOLIO_CONTEXT}

Job Description:
${jobDescription.slice(0, 3000)}
    `.trim();

    const text = await analyzeWithAI(prompt);

    // Clean any markdown formatting
    const cleanedText = text.replace(/```json|```/g, '').trim();

    const parsed = JSON.parse(cleanedText);
    res.json({ success: true, data: parsed });
  } catch (err) {
    console.error('JD analyze error:', err.message);
    res.status(500).json({ error: 'Analysis failed. Please try again.' });
  }
});

// POST /api/analyze/project — explain a project
router.post('/project', async (req, res) => {
  try {
    const { projectName, projectDesc, projectArch, mode } = req.body;
    if (!projectName) return res.status(400).json({ error: 'projectName is required' });

    const prompt = mode === 'simple'
      ? `Explain this software project in 3-4 friendly sentences for a non-technical recruiter. Focus on business value and what problem it solves. Project: ${projectName}. ${projectDesc}. Architecture: ${projectArch}`
      : `Give a sharp 4-5 sentence technical deep dive for an engineering audience on: ${projectName}. Description: ${projectDesc}. Architecture: ${projectArch}. Cover: specific technical decisions, trade-offs, scalability considerations, and anything impressive about the implementation.`;

    const explanation = await analyzeWithAI(prompt);

    res.json({ success: true, explanation });
  } catch (err) {
    console.error('Project explain error:', err.message);
    res.status(500).json({ error: 'Explanation failed. Please try again.' });
  }
});

module.exports = router;