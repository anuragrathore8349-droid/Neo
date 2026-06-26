// server/src/models/api-key.model.js
'use strict';
const mongoose = require('mongoose');

const apiKeySchema = new mongoose.Schema({
  userId: {
    type:     mongoose.Schema.Types.ObjectId,
    ref:      'User',
    required: true,
    index:    true,
  },
  exchange: {
    type:     String,
    required: true,
    lowercase: true,
  },
  apiKey: {
    type:     String,
    required: true,
  },
  apiSecret: {
    type:     String,
    required: true,
  },
  passphrase: {
    type:    String,
    default: '',
  },
  label: {
    type:    String,
    default: '',
  },
  isActive: {
    type:    Boolean,
    default: true,
  },
}, { timestamps: true });

apiKeySchema.index({ userId: 1, exchange: 1 });

module.exports = mongoose.model('ApiKey', apiKeySchema);