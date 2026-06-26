const helmet = require('helmet');
const cors = require('cors');
const config = require('./index');

// Helmet Configuration
const helmetConfig = {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://api.example.com"]
    }
  },
  crossOriginEmbedderPolicy: true,
  crossOriginOpenerPolicy: true,
  crossOriginResourcePolicy: { policy: "cross-origin" },
  dnsPrefetchControl: true,
  frameguard: { action: "deny" },
  hidePoweredBy: true,
  hsts: true,
  ieNoOpen: true,
  noSniff: true,
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  xssFilter: true
};

// CORS Configuration
const corsConfig = {
  origin: config.corsOptions.origin,
  methods: config.corsOptions.methods,
  allowedHeaders: config.corsOptions.allowedHeaders,
  credentials: config.corsOptions.credentials,
  maxAge: 86400 // 24 hours
};

module.exports = {
  helmetConfig,
  corsConfig
};