const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true },
    desc: { type: String, required: true },
    problem: { type: String, required: true },
    solution: { type: String, required: true },
    architecture: { type: String, required: true },
    challenges: { type: String, required: true },
    techStack: [{ type: String, lowercase: true }],
    impact: { type: String },
    featured: { type: Boolean, default: false },
    githubUrl: { type: String, default: '#' },
    liveUrl: { type: String, default: '#' },
    order: { type: Number, default: 0 },
    visible: { type: Boolean, default: true },
  },
  { timestamps: true }
);

projectSchema.index({ techStack: 1 });
projectSchema.index({ featured: -1, order: 1 });

module.exports = mongoose.model('Project', projectSchema);
