const { z } = require('zod');

const analyticsSchemas = {
// REPLACE getPerformance schema section:
  getPerformance: z.object({
    query: z.object({
      timeframe: z.enum(['1d', '1w', '1m', '3m', '6m', '1y', 'all'])
        .default('1m'),
      // FIX: Accept both comma-separated string and array; always output array
      metrics: z.union([
        z.array(z.string()),
        z.string().transform(s => s.split(',')),
      ])
        .optional()
        .default(['returns', 'volatility', 'sharpe_ratio', 'sortino_ratio'])
    })
  }),
  getRisk: z.object({
    query: z.object({
      assets: z.array(z.string())
        .optional(),
      timeframe: z.enum(['1d', '1w', '1m', '3m', '6m', '1y'])
        .default('1m')
    })
  }),

  getPredictions: z.object({
    query: z.object({
      symbol: z.string()
        .min(1, 'Symbol is required'),
      timeframe: z.enum(['1h', '4h', '1d', '1w', '1m'])
        .default('1d')
    })
  }),

  getSentiment: z.object({
    query: z.object({
      symbol: z.string()
        .min(1, 'Symbol is required'),
      sources: z.array(
        z.enum(['news', 'social', 'technical', 'onchain'])
      )
        .optional()
        .default(['news', 'social'])
    })
  }),

  getOpportunities: z.object({
    query: z.object({
      type: z.enum(['trading', 'defi', 'all'])
        .default('all'),
      filters: z.object({
        minReturn: z.number().optional(),
        maxRisk: z.number().optional(),
        categories: z.array(z.string()).optional(),
        networks: z.array(z.string()).optional()
      }).optional()
    })
  }),

  generateCustomReport: z.object({
    body: z.object({
      title: z.string()
        .min(1, 'Report title is required'),
      sections: z.array(
        z.object({
          type: z.enum([
            'performance',
            'risk',
            'predictions',
            'sentiment',
            'opportunities'
          ]),
          params: z.record(z.any()).optional()
        })
      ).min(1, 'At least one section is required'),
      format: z.enum(['json', 'pdf'])
        .default('json'),
      schedule: z.object({
        frequency: z.enum(['once', 'daily', 'weekly', 'monthly']),
        time: z.string().optional(),
        timezone: z.string().optional()
      }).optional()
    })
  })
};

module.exports = { analyticsSchemas };