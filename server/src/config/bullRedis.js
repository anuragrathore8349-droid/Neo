'use strict';

/**
 * Shared Bull queue Redis configuration.
 * Uses REDIS_URL (full URL) if set, otherwise individual host/port/password vars.
 */
const bullRedisConfig = process.env.REDIS_URL
  ? { url: process.env.REDIS_URL }
  : {
      host: process.env.REDIS_HOST || '127.0.0.1',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD || undefined,
    };

module.exports = bullRedisConfig;
