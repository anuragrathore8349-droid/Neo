'use strict';

const mongoose = require('mongoose');
const { createClient } = require('redis');
const config = require('./index');
const { logger } = require('../api/middlewares/logger.middleware');

// ── MongoDB ───────────────────────────────────────────────────────────────────
async function connectDB() {
  try {
    await mongoose.connect(config.mongodb.uri, config.mongodb.options);
    logger.info('✅ MongoDB connected');
  } catch (error) {
    logger.error('❌ MongoDB connection failed:', error.message);
    process.exit(1);
  }
}

mongoose.connection.on('disconnected', () => logger.warn('⚠️  MongoDB disconnected'));
mongoose.connection.on('reconnected',  () => logger.info('✅ MongoDB reconnected'));

// ── Redis ─────────────────────────────────────────────────────────────────────
// Null-safe stub used when Redis is unavailable
const redisSafeStub = {
  isOpen: false,
  get: async () => null,
  set: async () => null,
  setEx: async () => null,
  del: async () => null,
  keys: async () => [],
};

let redisClient = redisSafeStub;

async function connectRedis() {
  const redisUrl =
    config.redis.url ||
    `redis://${config.redis.password ? `:${config.redis.password}@` : ''}${config.redis.host}:${config.redis.port}`;

  const client = createClient({
    url: redisUrl,
    socket: { reconnectStrategy: retries => Math.min(retries * 100, 5000) },
  });

  client.on('error', err => logger.warn('Redis error (non-fatal):', err.message));
  client.on('connect', () => logger.info('✅ Redis connected'));
  client.on('reconnecting', () => logger.info('🔄 Redis reconnecting...'));

  try {
    await client.connect();
    redisClient = client;
    logger.info('✅ Redis client ready');
  } catch (err) {
    logger.warn(`⚠️  Redis unavailable — running without cache: ${err.message}`);
    redisClient = redisSafeStub;
  }
}

// Connect Redis on module load (non-blocking)
connectRedis().catch(() => {});

module.exports = { connectDB, redisClient: new Proxy(redisSafeStub, {
  get(_, prop) {
    return redisClient[prop];
  }
}) };
