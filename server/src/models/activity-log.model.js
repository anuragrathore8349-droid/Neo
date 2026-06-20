'use strict';
const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema(
  {
    userId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    action:      { type: String, required: true },     // e.g. 'login', 'trade', 'withdrawal', 'settings_change'
    description: { type: String, required: true },
    ipAddress:   { type: String },
    userAgent:   { type: String },
    device:      { type: String },
    status:      { type: String, enum: ['success', 'failed', 'blocked'], default: 'success' },
    metadata:    { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

// TTL index: auto-delete logs older than 90 days
activityLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 3600 });

module.exports = mongoose.model('ActivityLog', activityLogSchema);
