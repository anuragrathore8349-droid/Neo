const mongoose = require('mongoose');
const { createClient } = require('redis');
const { logger } = require('../api/middlewares/logger.middleware');
const config = require('./index');

// ─── MongoDB ──────────────────────────────────────────────────────────────────
async function connectDB() {
  try {
    await mongoose.connect(config.mongodb.uri, config.mongodb.options);
    logger.info('✅ MongoDB connected');
  } catch (error) {
    logger.error('❌ MongoDB connection failed:', error.message);
    throw error;
  }
}

mongoose.connection.on('disconnected', () => logger.warn('MongoDB disconnected'));
mongoose.connection.on('reconnected', () => logger.info('MongoDB reconnected'));


// ─── Redis (safe no-op when unavailable) ─────────────────────────────────────
let redisClient = null;

async function connectRedis() {
  const redisUrl = config.redis.url
    || `redis://${config.redis.host}:${config.redis.port}`;

  try {
    const client = createClient({
      url: redisUrl,
      password: config.redis.password || undefined,
      socket: { connectTimeout: 5000, reconnectStrategy: (retries) => Math.min(retries * 500, 10000) }
    });

    client.on('error', (err) => logger.warn('Redis error (non-fatal):', err.message));
    client.on('ready', () => logger.info('✅ Redis connected'));

    await client.connect();
    redisClient = client;
  } catch (err) {
    logger.warn(`⚠️ Redis unavailable (${err.message}) — caching disabled, continuing without Redis`);
    // No-op stub so all redisClient?.isOpen checks safely return falsy
    redisClient = null;
  }
}

connectRedis().catch(() => {});

module.exports = { connectDB, redisClient: new Proxy({}, {
  get(_, prop) {
    if (!redisClient) return prop === 'isOpen' ? false : async () => null;
    return typeof redisClient[prop] === 'function'
      ? redisClient[prop].bind(redisClient)
      : redisClient[prop];
  }
}) };
