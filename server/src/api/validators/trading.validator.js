const { z } = require('zod');

const tradingSchemas = {
  placeOrder: z.object({
    body: z.object({
      symbol:      z.string().min(1).toUpperCase(),
      type:        z.enum(['market', 'limit', 'stop', 'stop_limit']),
      side:        z.enum(['buy', 'sell']),
      amount:      z.number().positive(),
      price:       z.number().positive().optional().nullable(),
      stopPrice:   z.number().positive().optional().nullable(),
      timeInForce: z.enum(['GTC', 'IOC', 'FOK']).optional().default('GTC'),
      postOnly:    z.boolean().optional().default(false),
      reduceOnly:  z.boolean().optional().default(false),
      mode:        z.enum(['paper', 'live']).optional().default('live'),
      isPaper:     z.boolean().optional().default(false),
      // 'paper' is a valid exchange for simulated trades
      exchange:    z.string().min(1).default('binance'),
      stopLoss:    z.object({
        price:       z.number().positive(),
        triggerType: z.enum(['mark', 'last', 'index']).default('last'),
      }).optional(),
      takeProfit:  z.object({
        price:       z.number().positive(),
        triggerType: z.enum(['mark', 'last', 'index']).default('last'),
      }).optional(),
    }).refine(data => {
      if (data.type === 'limit'      && !data.price)                      return false;
      if (data.type === 'stop'       && !data.stopPrice)                  return false;
      if (data.type === 'stop_limit' && (!data.price || !data.stopPrice)) return false;
      return true;
    }, { message: 'Invalid price configuration for order type' }),
  }),

  placePaperTrade: z.object({
    body: z.object({
      symbol: z.string().min(1).toUpperCase(),
      side:   z.enum(['buy', 'sell']),
      amount: z.number().positive(),
      price:  z.number().positive().optional().nullable(),
      type:   z.enum(['market', 'limit']).optional().default('market'),
    }),
  }),

  getOpenOrders: z.object({
    query: z.object({
      symbol: z.string().optional().transform(v => v?.toUpperCase()),
    }),
  }),

  getOrderHistory: z.object({
    query: z.object({
      symbol: z.string().optional().transform(v => v?.toUpperCase()),
      from:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      to:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      limit:  z.coerce.number().int().min(1).max(500).optional().default(100),
    }),
  }),

  getPaperHistory: z.object({
    query: z.object({
      symbol: z.string().optional().transform(v => v?.toUpperCase()),
      limit:  z.coerce.number().int().min(1).max(500).optional().default(50),
    }),
  }),

  cancelOrder: z.object({
    params: z.object({ id: z.string().min(1) }),
  }),

  getOrderBook: z.object({
    query: z.object({
      symbol: z.string().min(1).transform(v => v.toUpperCase()),
      limit:  z.coerce.number().int().min(1).max(100).optional().default(50),
    }),
  }),

  getRecentTrades: z.object({
    query: z.object({
      symbol: z.string().min(1).transform(v => v.toUpperCase()),
      limit:  z.coerce.number().int().min(1).max(100).optional().default(50),
    }),
  }),
};

module.exports = { tradingSchemas };