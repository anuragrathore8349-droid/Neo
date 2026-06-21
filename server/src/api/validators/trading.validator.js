// server/src/validators/trading.validator.js
'use strict';
const Joi = require('joi');

const placeOrder = {
  body: Joi.object({
    symbol:      Joi.string().uppercase().min(2).max(20).required(),
    exchange:    Joi.string().default('binance'),
    type:        Joi.string().valid('market','limit','stop','stop_limit').required(),
    side:        Joi.string().valid('buy','sell').required(),
    amount:      Joi.number().positive().required(),
    price:       Joi.number().positive().optional(),
    stopPrice:   Joi.number().positive().optional(),
    timeInForce: Joi.string().valid('GTC','IOC','FOK').default('GTC'),
    postOnly:    Joi.boolean().default(false),
    reduceOnly:  Joi.boolean().default(false),
    mode:        Joi.string().valid('paper','live').default('live'),
    stopLoss:    Joi.object({ price: Joi.number().positive(), triggerType: Joi.string().valid('mark','last','index') }).optional(),
    takeProfit:  Joi.object({ price: Joi.number().positive(), triggerType: Joi.string().valid('mark','last','index') }).optional(),
  }),
};

const placePaperTrade = {
  body: Joi.object({
    symbol: Joi.string().uppercase().min(2).max(20).required(),
    side:   Joi.string().valid('buy','sell').required(),
    amount: Joi.number().positive().required(),
    price:  Joi.number().positive().optional(),
    type:   Joi.string().valid('market','limit').default('market'),
  }),
};

const getOpenOrders = {
  query: Joi.object({
    symbol: Joi.string().uppercase().optional(),
  }),
};

const getOrderHistory = {
  query: Joi.object({
    symbol: Joi.string().uppercase().optional(),
    from:   Joi.string().isoDate().optional(),
    to:     Joi.string().isoDate().optional(),
    limit:  Joi.number().integer().min(1).max(500).default(50),
  }),
};

const cancelOrder = {
  params: Joi.object({
    id: Joi.string().required(),
  }),
};

const getOrderBook = {
  query: Joi.object({
    symbol: Joi.string().uppercase().min(2).max(20).required(),
    limit:  Joi.number().integer().min(5).max(100).default(20),
  }),
};

const getRecentTrades = {
  query: Joi.object({
    symbol: Joi.string().uppercase().min(2).max(20).required(),
    limit:  Joi.number().integer().min(1).max(200).default(50),
  }),
};

const getPaperHistory = {
  query: Joi.object({
    symbol: Joi.string().uppercase().optional(),
    limit:  Joi.number().integer().min(1).max(200).default(50),
  }),
};

module.exports = {
  tradingSchemas: {
    placeOrder,
    placePaperTrade,
    getOpenOrders,
    getOrderHistory,
    cancelOrder,
    getOrderBook,
    getRecentTrades,
    getPaperHistory,
  },
};
