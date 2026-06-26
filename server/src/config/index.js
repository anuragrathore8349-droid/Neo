const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Hard fail in production if critical env vars are missing
if (process.env.NODE_ENV === 'production') {
  const REQUIRED = ['JWT_SECRET', 'MONGODB_URI'];
  const missing  = REQUIRED.filter(k => !process.env[k]);
  if (missing.length > 0) {
    console.error(`FATAL: Missing required environment variables: ${missing.join(', ')}`);
    process.exit(1);
  }
}

module.exports = {
  env:  process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 3000,

  mongodb: {
    uri: (process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/neofin')
      .toString().trim().replace(/^"|"$/g, ''),
    options: {},
  },

  redis: {
    url:      process.env.REDIS_URL?.trim()      || undefined,
    host:     process.env.REDIS_HOST             || '127.0.0.1',
    port:     parseInt(process.env.REDIS_PORT, 10) || 6379,
    password: process.env.REDIS_PASSWORD?.trim() || undefined,
  },

  jwt: {
    secret:             process.env.JWT_SECRET,
    accessTokenExpiry:  process.env.JWT_ACCESS_EXPIRY   || '15m',
    refreshTokenExpiry: process.env.JWT_REFRESH_EXPIRY  || '7d',
  },

  corsOptions: {
    origin: process.env.CORS_ORIGIN
      ? process.env.CORS_ORIGIN.split(',').map(o => o.trim())
      : ['http://localhost:5173'],
    methods:        ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials:    true,
  },

gemini: {
    apiKey:    process.env.GEMINI_API_KEY?.trim() || null,
    model:     'gemini-2.5-flash',
    maxTokens: 300,
    // Free tier: 15 RPM, 1500 RPD — we stay well within by caching
  },

  apis: {
    gemini:       process.env.GEMINI_API_KEY,
    coinGecko:    process.env.COINGECKO_API_KEY,
    etherscan:    process.env.ETHERSCAN_API_KEY,
    yahooFinance: process.env.YAHOO_FINANCE_API_KEY,
    alphaVantage: process.env.ALPHA_VANTAGE_API_KEY,
  },
  blockchain: {
    ethereum: {
      rpcUrl:  process.env.ETH_RPC_URL,
      chainId: parseInt(process.env.ETH_CHAIN_ID, 10) || 1,
    },
    solana: {
      rpcUrl:  process.env.SOLANA_RPC_URL,
      network: process.env.SOLANA_NETWORK || 'mainnet-beta',
    },
  },

  sentry: {
    dsn:         process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
  },

  email: {
    host:     process.env.SMTP_HOST,
    port:     parseInt(process.env.SMTP_PORT, 10) || 587,
    secure:   parseInt(process.env.SMTP_PORT, 10) === 465,
    user:     process.env.SMTP_USER,
    password: process.env.SMTP_PASSWORD,
    from:     process.env.EMAIL_FROM || 'no-reply@neofin.com',
  },

  appUrl: process.env.APP_URL || process.env.FRONTEND_URL || 'http://localhost:5173',
};