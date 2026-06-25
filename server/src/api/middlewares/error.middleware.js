const winston = require('winston');
const Sentry = require('@sentry/node');

const errorMiddleware = (err, req, res, next) => {
  // Print full error to terminal
  console.error('🔴 Express error:', err.stack || err);

  // Log error
  winston.error(err.message, {
    error: err,
    stack: err.stack,
    path: req.path,
    method: req.method
  });

  // Report to Sentry if enabled
  if (process.env.NODE_ENV === 'production') {
    Sentry.captureException(err);
  }

  // Handle specific error types
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      status: 'error',
      message: 'Validation Error',
      errors: err.errors
    });
  }

  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({
      status: 'error',
      message: 'Unauthorized'
    });
  }

  // Handle MongoDB duplicate key error (E11000)
  if (err.code === 11000 || err.name === 'MongoServerError') {
    const field = Object.keys(err.keyPattern || {})[0] || 'field';
    return res.status(409).json({
      status: 'error',
      message: `A record with this ${field} already exists.`,
      code: 'DUPLICATE_KEY_ERROR'
    });
  }

  // Use statusCode if set (for custom errors)
  const status = err.statusCode || err.status || 500;

  // Default error response
  res.status(status).json({
    status: 'error',
    message: process.env.NODE_ENV === 'production' 
      ? (status === 500 ? 'Internal Server Error' : err.message)
      : err.message,
    code: err.code
  });
};

module.exports = { errorMiddleware };
