const { ZodError } = require('zod');

const validateRequest = (schema) => async (req, res, next) => {
  const validationData = {};
  try {
    if (req.body   !== undefined) validationData.body   = req.body;
    if (req.query  !== undefined) validationData.query  = req.query;
    if (req.params !== undefined) validationData.params = req.params;

    const data = await schema.parseAsync(validationData);
    req.validatedData = data;
    next();
  } catch (error) {
    if (error instanceof ZodError) {
      const errorDetails = Array.isArray(error.errors)
        ? error.errors.map(e => ({
            field:   e.path?.length ? e.path.join('.') : 'root',
            message: e.message,
            code:    e.code,
          }))
        : [{ field: 'unknown', message: 'Validation failed', code: 'unknown_error' }];

      const response = {
        status:  'error',
        message: 'Validation failed',
        errors:  errorDetails,
      };

      // Only include debug info outside production
      if (process.env.NODE_ENV !== 'production') {
        response.debug = {
          keys: {
            body:   Object.keys(req.body   || {}),
            query:  Object.keys(req.query  || {}),
            params: Object.keys(req.params || {}),
          },
        };
      }

      return res.status(400).json(response);
    }
    next(error);
  }
};

module.exports = { validateRequest };