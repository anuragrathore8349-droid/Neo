const { RateLimiterRedis, RateLimiterMemory } = require('rate-limiter-flexible');
const { redisClient } = require('../../config/database');

let rateLimiter;

try {
  if (redisClient && redisClient.isOpen) {
    rateLimiter = new RateLimiterRedis({
      storeClient: redisClient,
      keyPrefix: 'rl_mw',
      points: 60,
      duration: 1,
      blockDuration: 120,
    });
  } else {
    throw new Error('Redis not ready');
  }
} catch {
  rateLimiter = new RateLimiterMemory({
    points: 60,
    duration: 1,
    blockDuration: 120,
  });
}

const rateLimitMiddleware = async (req, res, next) => {
  try {
    await rateLimiter.consume(req.ip);
    next();
  } catch (err) {
    if (err && err.msBeforeNext !== undefined) {
      res.set('Retry-After', Math.ceil(err.msBeforeNext / 1000));
      return res.status(429).json({
        status: 'error',
        message: 'Too many requests. Please try again later.',
        retryAfter: Math.ceil(err.msBeforeNext / 1000),
      });
    }
    // Unexpected limiter error — allow through rather than blocking all users
    next();
  }
};

module.exports = { rateLimitMiddleware };