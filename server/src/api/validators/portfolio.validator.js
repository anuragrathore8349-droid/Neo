const { z } = require('zod');

const portfolioSchemas = {
  addAsset: z.object({
    body: z.object({
      symbol:       z.string().min(1).max(20),
      name:         z.string().max(100).optional(),
      type:         z.enum(['crypto', 'stock', 'forex', 'commodity']).default('crypto'),
      amount:       z.number().positive(),
      costBasis:    z.number().positive(),
      purchaseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}/, 'Date must be in YYYY-MM-DD format').optional(),
    }),
  }),
  updateAsset: z.object({
    body: z.object({
      amount:       z.number().positive().optional(),
      costBasis:    z.number().positive().optional(),
      purchaseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}/, 'Date must be in YYYY-MM-DD format').optional(),
    }),
    params: z.object({ id: z.string() }),
  }),
};

module.exports = { portfolioSchemas };
