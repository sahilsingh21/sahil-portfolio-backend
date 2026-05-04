const express = require('express');
const router = express.Router();
const Anthropic = require('@anthropic-ai/sdk').default || require('@anthropic-ai/sdk');
const { PORTFOLIO_CONTEXT } = require('../config/portfolioContext');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// POST /api/analyze/jd — match job description to Sahil's profile
router.post('/jd', async (req, res) => {
  try {
    const { jobDescription } = req.body;
    if (!jobDescription || jobDescription.length < 50) {
      return res.status(400).json({ error: 'Please provide a full job description (min 50 chars)' });
    }

    const prompt = `
You are a technical recruiter. Analyze how well Sahil Singh matches the job description below.
Respond ONLY with a valid JSON object — no markdown, no backticks.

Required JSON format:
{
  "score": <number 0-100>,
  "matched_skills": ["skill1", "skill2"],
  "missing_skills": ["skill1", "skill2"],
  "strengths": ["strength1", "strength2"],
  "suggestion": "<one concise sentence on how Sahil can position himself>"
}

Sahil's Profile:
${PORTFOLIO_CONTEXT}

Job Description:
${jobDescription.slice(0, 3000)}
    `.trim();

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 800,
      messages: [{ role: 'user', content: prompt }],
    });

    let text = response.content[0]?.text || '{}';
    text = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(text);

    res.json({ success: true, data: parsed });
  } catch (err) {
    console.error('JD analyze error:', err.message);
    res.status(500).json({ error: 'Analysis failed. Please try again.' });
  }
});

// POST /api/analyze/project — explain a project simply or technically
router.post('/project', async (req, res) => {
  try {
    const { projectName, projectDesc, projectArch, mode } = req.body;
    if (!projectName) return res.status(400).json({ error: 'projectName is required' });

    const isSimple = mode === 'simple';
    const prompt = isSimple
      ? `Explain this software project in 3-4 friendly sentences for a non-technical recruiter. Focus on business value and what problem it solves.
         Project: ${projectName}. ${projectDesc}. Architecture: ${projectArch}`
      : `Give a sharp 4-5 sentence technical deep dive for an engineering audience on: ${projectName}.
         Description: ${projectDesc}. Architecture: ${projectArch}.
         Cover: specific technical decisions, trade-offs made, scalability considerations, and anything impressive about the implementation.`;

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 400,
      messages: [{ role: 'user', content: prompt }],
    });

    res.json({ success: true, explanation: response.content[0]?.text || '' });
  } catch (err) {
    console.error('Project explain error:', err.message);
    res.status(500).json({ error: 'Explanation failed. Please try again.' });
  }
});

module.exports = router;
