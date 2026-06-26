const { z } = require('zod');

const paginationQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  skip:  z.coerce.number().int().min(0).optional().default(0),
});

const marketSchemas = {
  getPrices: z.object({
    query: z.object({
      symbols: z.string()
        .transform(str => str.split(','))
        .optional(),
      limit: z.coerce.number().int().min(1).max(100).optional().default(50),
      skip:  z.coerce.number().int().min(0).optional().default(0),
    })
  }),

  getSymbolPrice: z.object({
    params: z.object({
      symbol: z.string().toUpperCase()
    })
  }),

  getPriceHistory: z.object({
    params: z.object({
      symbol: z.string().toUpperCase()
    }),
    query: z.object({
      interval: z.enum(['1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w'])
        .default('1d'),
      from: z.string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)')
        .optional(),
      to: z.string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)')
        .optional()
    })
  }),

  searchAssets: z.object({
    query: z.object({
      query: z.string().min(1, 'Search query is required'),
      type: z.enum(['crypto', 'stock', 'forex', 'commodity']).optional(),
      limit: z.coerce.number().int().min(1).max(100).optional().default(50),
      skip:  z.coerce.number().int().min(0).optional().default(0),
    })
  }),

  getTrendingAssets: z.object({
    query: paginationQuery.optional(),
  }),

  getMarketAssets: z.object({
    query: z.object({
      timeframe: z.enum(['1h', '24h', '7d', '30d']).optional().default('24h'),
      limit: z.coerce.number().int().min(1).max(100).optional().default(50),
      skip:  z.coerce.number().int().min(0).optional().default(0),
    }).optional(),
  }),

  getAvailableAssets: z.object({
    query: paginationQuery.optional(),
  }),

  getWatchlist: z.object({
    query: paginationQuery.optional(),
  }),

  getAssetDetails: z.object({
    params: z.object({
      symbol: z.string().toUpperCase()
    })
  }),

  addToWatchlist: z.object({
    params: z.object({
      symbol: z.string().toUpperCase()
    })
  }),

  removeFromWatchlist: z.object({
    params: z.object({
      symbol: z.string().toUpperCase()
    })
  }),

  createAlert: z.object({
    body: z.object({
      symbol: z.string().toUpperCase(),
      type: z.enum(['above', 'below']),
      price: z.number().positive(),
      notificationTypes: z.array(
        z.enum(['email', 'push', 'sms'])
      ).default(['email'])
    })
  }),

  getPriceAlerts: z.object({
    query: paginationQuery.optional(),
  }),

  deleteAlert: z.object({
    params: z.object({
      id: z.string()
    })
  })
};

module.exports = { marketSchemas };