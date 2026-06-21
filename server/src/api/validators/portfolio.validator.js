const Joi = require('joi');

const portfolioSchemas = {
  addAsset: {
    body: Joi.object({
      symbol:       Joi.string().uppercase().min(1).max(20).required(),
      name:         Joi.string().max(100).optional(),
      type:         Joi.string().valid('crypto', 'stock', 'forex', 'commodity').default('crypto'),
      amount:       Joi.number().positive().required(),
      costBasis:    Joi.number().positive().required(),
      purchaseDate: Joi.date().iso().optional(),
    }),
  },
  updateAsset: {
    body: Joi.object({
      amount:       Joi.number().positive().optional(),
      costBasis:    Joi.number().positive().optional(),
      purchaseDate: Joi.date().iso().optional(),
    }),
    params: Joi.object({ id: Joi.string().required() }),
  },
};

module.exports = { portfolioSchemas };