const { z } = require('zod');

const portfolioSchemas = {
  createPortfolio: z.object({
    body: z.object({
      name: z.string()
        .min(1, 'Portfolio name is required')
        .max(100, 'Portfolio name cannot exceed 100 characters'),
      description: z.string()
        .max(500, 'Description cannot exceed 500 characters')
        .optional(),
      assets: z.array(z.object({
        assetId: z.string(),
        symbol: z.string(),
        type: z.enum(['crypto', 'stock', 'fiat', 'commodity']),
        amount: z.number().positive('Amount must be positive'),
        costBasis: z.number().positive('Cost basis must be positive'),
        currentPrice: z.number().positive('Current price must be positive'),
        value: z.number().min(0, 'Value must be non-negative'),
        profit: z.number(),
        profitPercentage: z.number(),
        allocation: z.number().min(0).max(100)
      })).optional(),
      totalValue: z.number().min(0).optional(),
      totalProfit: z.number().optional(),
      totalProfitPercentage: z.number().optional()
    })
  }),

  updatePortfolio: z.object({
    params: z.object({
      id: z.string()
    }),
    body: z.object({
      name: z.string()
        .min(1, 'Portfolio name is required')
        .max(100, 'Portfolio name cannot exceed 100 characters')
        .optional(),
      description: z.string()
        .max(500, 'Description cannot exceed 500 characters')
        .optional(),
      rebalanceTarget: z.array(z.object({
        symbol: z.string(),
        allocation: z.number().min(0).max(100)
      })).optional()
    })
  }),

  deletePortfolio: z.object({
    params: z.object({
      id: z.string()
    })
  }),

  getAssetDetails: z.object({
    params: z.object({
      id: z.string()
    })
  }),

  getHistory: z.object({
    query: z.object({
      timeframe: z.enum(['1d', '1w', '1m', '3m', '6m', '1y', 'all'])
        .default('1m')
    })
  })
};

module.exports = { portfolioSchemas };