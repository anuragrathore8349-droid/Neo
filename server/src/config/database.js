const mongoose = require('mongoose');
const { Pool } = require('pg');
const Redis = require('redis');
const config = require('./index');

// =========================
// MongoDB Connection
// =========================
const connectMongoDB = async () => {
  try {
    let mongoUri = config.mongodb.uri;
    if (!mongoUri || mongoUri === 'undefined' || mongoUri === 'null') {
      mongoUri = 'mongodb://127.0.0.1:27017/neofin';
    }

    if (!mongoUri) {
      throw new Error('MONGODB_URI is missing or invalid in environment variables');
    }

    console.log('🔧 Connecting to MongoDB URI:', mongoUri);
    await mongoose.connect(mongoUri, config.mongodb.options);
    console.log('✅ MongoDB connected successfully');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    throw error;
  }
};

// =========================
// PostgreSQL Connection
// =========================
/*
const postgresPool = new Pool({
  host: config.postgres.host,
  port: config.postgres.port,
  database: config.postgres.database,
  user: config.postgres.user,
  password: config.postgres.password,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

const connectPostgres = async () => {
  try {
    const client = await postgresPool.connect();
    console.log('✅ PostgreSQL connected successfully');
    client.release();
  } catch (error) {
    console.error('❌ PostgreSQL connection error:', error.message);
    throw error;
  }
};
*/

// =========================
// Redis Connection (redis v4)
// =========================
let redisClient = null;
let redisConnected = false;

try {
  redisClient = config.redis.url
    ? require('redis').createClient({
        url: config.redis.url,
        socket: {
          reconnectStrategy: (retries) => Math.min(retries * 50, 500),
        },
      })
    : require('redis').createClient({
        socket: {
          host: config.redis.host,
          port: config.redis.port,
          reconnectStrategy: (retries) => Math.min(retries * 50, 500),
        },
        password: config.redis.password,
      });

  redisClient.on('error', (error) => {
    console.warn('⚠️ Redis error:', error.message);
    redisConnected = false;
  });

  redisClient.on('ready', () => {
    console.log('✅ Redis ready for commands');
    redisConnected = true;
  });

  redisClient.on('end', () => {
    console.warn('⚠️ Redis connection ended');
    redisConnected = false;
  });
} catch (error) {
  console.warn('⚠️ Redis client creation failed:', error.message);
  redisClient = null;
}

const connectRedis = async () => {
  if (!redisClient) {
    console.warn('⚠️ Redis client not available');
    return;
  }

  try {
    if (!redisClient.isOpen) {
      await redisClient.connect();
      // Wait for ready event with timeout
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Redis connection timeout'));
        }, 5000);

        if (redisConnected) {
          clearTimeout(timeout);
          resolve();
        } else {
          redisClient.once('ready', () => {
            clearTimeout(timeout);
            resolve();
          });
        }
      });
      console.log('✅ Redis connected successfully');
    }
  } catch (error) {
    // Redis is optional - log warning but don't crash the server
    console.warn('⚠️ Redis connection failed (optional):', error.message);
    console.warn('⚠️ Server will continue without Redis caching');
    redisConnected = false;
  }
};

// =========================
// Connect All Databases
// =========================
const connectDB = async () => {
  await connectMongoDB();
  await connectRedis();
  const redisStatus = redisConnected ? 'MongoDB and Redis' : 'MongoDB (Redis unavailable)';
  console.log(`🎉 Database connected successfully (${redisStatus})`);
};

module.exports = {
  connectMongoDB,
  connectRedis,
  connectDB,
  redisClient,
};