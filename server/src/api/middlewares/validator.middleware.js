// server/src/api/middlewares/validator.middleware.js
'use strict';
const Joi = require('joi');

/**
 * Validates request against a schema object with optional keys: body, query, params.
 * Supports both Joi and Zod schemas.
 * Attaches cleaned data to req.validatedData.
 */
const validateRequest = (schema) => (req, res, next) => {
  req.validatedData = {};

  // Detect if it's a Zod schema (has .shape property) or Joi (has .describe property)
  const isZodSchema = schema && typeof schema.shape === 'object';
  
  let toValidate;
  if (isZodSchema) {
    // For Zod schemas, access via .shape
    toValidate = {
      body:   schema.shape?.body,
      query:  schema.shape?.query,
      params: schema.shape?.params,
    };
  } else {
    // For Joi schemas, access directly
    toValidate = {
      body:   schema.body,
      query:  schema.query,
      params: schema.params,
    };
  }

  for (const [key, joiOrZodSchema] of Object.entries(toValidate)) {
    if (!joiOrZodSchema) continue;

    let error, value;

    // Check if it's a Zod schema (has safeParse method)
    if (typeof joiOrZodSchema.safeParse === 'function') {
      const result = joiOrZodSchema.safeParse(req[key]);
      if (!result.success) {
        return res.status(422).json({
          status:  'error',
          message: 'Validation failed',
          details: result.error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message
          }))
        });
      }
      value = result.data;
    } 
    // Otherwise assume it's Joi (has validate method)
    else if (typeof joiOrZodSchema.validate === 'function') {
      const result = joiOrZodSchema.validate(req[key], {
        abortEarly:       false,
        allowUnknown:     false,
        stripUnknown:     true,
        convert:          true,
      });

      if (result.error) {
        return res.status(422).json({
          status:  'error',
          message: 'Validation failed',
          details: result.error.details.map(d => ({ field: d.path.join('.'), message: d.message })),
        });
      }
      value = result.value;
    }

    req.validatedData[key] = value;
  }

  next();
};

module.exports = { validateRequest };
