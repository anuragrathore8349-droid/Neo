// server/src/api/controllers/api-key.controller.js
'use strict';

const ApiKey  = require('../../models/api-key.model');
const ccxt    = require('ccxt');
const { logger } = require('../middlewares/logger.middleware');

class ApiKeyController {
  async listApiKeys(req, res, next) {
    try {
      const keys = await ApiKey.find(
        { userId: req.user.userId },
        { apiSecret: 0, passphrase: 0 }   // never return secrets
      );
      res.json({ status: 'success', data: keys });
    } catch (e) { next(e); }
  }

  async addApiKey(req, res, next) {
    try {
      const { exchange, apiKey, apiSecret, passphrase, label } = req.body;
      if (!exchange || !apiKey || !apiSecret) {
        return res.status(422).json({ status: 'error', message: 'exchange, apiKey, apiSecret are required' });
      }

      const doc = new ApiKey({
        userId:     req.user.userId,
        exchange:   exchange.toLowerCase(),
        apiKey,
        apiSecret,
        passphrase: passphrase || '',
        label:      label || exchange,
        isActive:   true,
      });
      await doc.save();

      res.status(201).json({
        status: 'success',
        data: { _id: doc._id, exchange: doc.exchange, label: doc.label, isActive: doc.isActive },
      });
    } catch (e) { next(e); }
  }

  async deleteApiKey(req, res, next) {
    try {
      await ApiKey.deleteOne({ _id: req.params.id, userId: req.user.userId });
      res.json({ status: 'success', message: 'API key deleted' });
    } catch (e) { next(e); }
  }

  async testApiKey(req, res, next) {
    try {
      const key = await ApiKey.findOne({ _id: req.params.id, userId: req.user.userId });
      if (!key) return res.status(404).json({ status: 'error', message: 'Key not found' });

      const ExchangeClass = ccxt[key.exchange];
      if (!ExchangeClass) return res.status(400).json({ status: 'error', message: 'Unknown exchange' });

      const client = new ExchangeClass({
        apiKey:   key.apiKey,
        secret:   key.apiSecret,
        password: key.passphrase || undefined,
      });

      await client.fetchBalance();
      res.json({ status: 'success', message: 'API key is valid' });
    } catch (e) {
      res.status(400).json({ status: 'error', message: `Key test failed: ${e.message}` });
    }
  }
}

module.exports = new ApiKeyController();