const validateRequest = (schema) => async (req, res, next) => {
  try {
    const toValidate = {};
    
    // Get the shape of the Zod schema
    const shape = schema._def.shape();
    
    if (shape.body)   toValidate.body   = req.body;
    if (shape.params) toValidate.params = req.params;
    if (shape.query)  toValidate.query  = req.query;

    const validated = {};

    for (const key of Object.keys(toValidate)) {
      const result = shape[key].safeParse(toValidate[key]);

      if (!result.success) {
        const errors = result.error.errors.map(err => ({
          field: err.path.join('.') || 'root',
          message: err.message,
        }));
        return res.status(400).json({ status: 'error', message: 'Validation failed', errors });
      }

      validated[key] = result.data;
    }

    req.validatedData = validated;
    next();
  } catch (err) {
    next(err);
  }
};

module.exports = { validateRequest };
