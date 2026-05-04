const express = require('express');
const router = express.Router();
const Analytics = require('../models/Analytics');

// POST /api/analytics/track — track an event
router.post('/track', async (req, res) => {
  try {
    const { event, projectId, meta } = req.body;
    await Analytics.create({
      event,
      projectId: projectId || null,
      meta: meta || {},
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/analytics/summary — admin summary
router.get('/summary', async (req, res) => {
  try {
    const [totalViews, projectViews, chatMessages, resumeDownloads] = await Promise.all([
      Analytics.countDocuments({ event: 'page_view' }),
      Analytics.countDocuments({ event: 'project_view' }),
      Analytics.countDocuments({ event: 'chat_message' }),
      Analytics.countDocuments({ event: 'resume_download' }),
    ]);

    const topProjects = await Analytics.aggregate([
      { $match: { event: 'project_view', projectId: { $ne: null } } },
      { $group: { _id: '$projectId', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
      { $lookup: { from: 'projects', localField: '_id', foreignField: '_id', as: 'project' } },
    ]);

    res.json({ success: true, data: { totalViews, projectViews, chatMessages, resumeDownloads, topProjects } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
