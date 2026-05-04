const mongoose = require('mongoose');

const analyticsSchema = new mongoose.Schema(
  {
    event: { type: String, required: true }, // 'page_view' | 'project_view' | 'chat_message' | 'resume_download'
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
    meta: { type: Object, default: {} },
    ip: { type: String },
    userAgent: { type: String },
  },
  { timestamps: true }
);

analyticsSchema.index({ event: 1, createdAt: -1 });

module.exports = mongoose.model('Analytics', analyticsSchema);
