/**
 * Wrap a service result in a standard API envelope
 * Adds dataSource field so frontend can show live vs cached badge
 */
const success = (data, meta = {}) => ({
  status: 'success',
  data,
  meta: {
    timestamp: new Date().toISOString(),
    dataSource: meta.dataSource || 'live',
    cached:     meta.cached     || false,
    ...meta
  }
});

const error = (message, code = 500) => ({
  status: 'error',
  message,
  code
});

module.exports = { success, error };
