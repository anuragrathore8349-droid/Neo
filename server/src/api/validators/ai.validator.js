const { z } = require('zod');
const { inferAssetType } = require('../../utils/assetTypes');

const aiSchemas = {
  getPredictions: z.object({
    params: z.object({
      symbol: z.string().min(1, 'Symbol is required')
    }),
    query: z.object({
      timeframe: z.enum(['1h', '4h', '1d', '1w', '1m'])
        .default('1d'),
      horizon: z.string()
        .transform(str => {
          // Handle both "7" and "7d" formats
          const num = parseInt(str.replace(/[a-z]/gi, ''));
          return isNaN(num) ? 7 : num;
        })
        // Allow up to 90 days (service supports up to 90)
        .pipe(z.number().int().min(1).max(90))
        .default(7)
    })
  }),

  getSentiment: z.object({
    params: z.object({
      symbol: z.string().min(1, 'Symbol is required')
    }),
    query: z.object({
      sources: z.string()
        .transform(str => str.split(',').map(s => s.trim()))
        .pipe(z.array(z.enum(['news', 'social', 'technical', 'onchain'])))
        .default(['technical']),
      timeframe: z.string()
        .regex(/^\d+[hdwm]$/)
        .default('24h')
    })
  }),

  getRiskAssessment: z.object({
    body: z.object({
      assets: z.array(z.object({
        symbol: z.string(),
        // Allow very small crypto amounts (e.g. 0.001 BTC)
        amount: z.number().min(0)
      })).min(1, 'At least one asset required'),
      timeframe: z.string()
        .regex(/^\d+[hdwm]$/)
        .default('30d')
    })
  }),

  getOpportunities: z.object({
    query: z.object({
      type: z.enum(['all', 'crypto', 'defi', 'stocks'])
        .default('all'),
      riskLevel: z.enum(['low', 'medium', 'high'])
        .optional(),
      minReturn: z.string()
        .transform(str => parseFloat(str))
        .pipe(z.number().min(0))
        .optional(),
      maxRisk: z.string()
        .transform(str => parseFloat(str))
        .pipe(z.number().min(0))
        .optional(),
      limit: z.string()
        .transform(str => parseInt(str))
        .pipe(z.number().int().min(1).max(50))
        .default(10)
    })
  }),

  optimizePortfolio: z.object({
    body: z.object({
      assets: z.array(z.object({
        symbol: z.string(),
        amount: z.number().min(0)
      })),
      constraints: z.object({
        riskTolerance: z.number().min(0).max(1),
        minAllocation: z.number().min(0).max(1).optional(),
        maxAllocation: z.number().min(0).max(1).optional()
      }),
      objective: z.enum(['sharpe', 'return', 'risk'])
        .default('sharpe')
    })
  }),

  getStrategyRecommendations: z.object({
    body: z.object({
      portfolio: z.array(z.object({
        symbol: z.string(),
        amount: z.number().min(0),
        type: z.enum(['crypto', 'stock', 'commodity', 'forex']).optional()
      }).transform(obj => ({
        ...obj,
        type: obj.type ?? inferAssetType(obj.symbol)
      }))),
      preferences: z.object({
        riskTolerance: z.number().min(0).max(1),
        investmentHorizon: z.string().regex(/^\d+[hdwm]$/),
        strategy: z.enum(['passive', 'active', 'mixed']).default('mixed')
      })
    })
  }),

  detectPatterns: z.object({
    params: z.object({
      symbol: z.string().min(1, 'Symbol is required')
    }),
    query: z.object({
      timeframe: z.enum(['1h', '4h', '1d', '1w'])
        .default('1d'),
      patterns: z.string()
        .transform(str => str.split(',').map(s => s.trim()))
        .pipe(z.array(z.enum([
          'double_top', 'double_bottom', 'head_shoulders',
          'triangle', 'wedge', 'channel', 'all'
        ])))
        .optional()
    })
  }),

  analyzeNews: z.object({
    query: z.object({
      symbols: z.string()
        .transform(str => str.split(',').map(s => s.trim()))
        .optional(),
      // Categories is now a free-form string list — we just split it
      // (removes the enum restriction that was rejecting valid values)
      categories: z.string()
        .transform(str => str.split(',').map(s => s.trim()))
        .optional(),
      timeframe: z.string()
        .regex(/^\d+[hdwm]$/)
        .default('24h'),
      limit: z.string()
        .transform(str => parseInt(str))
        .pipe(z.number().int().min(1).max(100))
        .default(50)
    })
  }),

  detectAnomalies: z.object({
    body: z.object({
      assets: z.array(z.string()).optional(),
      data: z.array(z.object({
        symbol: z.string(),
        metrics: z.record(z.number())
      })).optional(),
      sensitivity: z.number().min(0).max(1).default(0.5),
      timeframe: z.string().regex(/^\d+[hdwm]$/).default('7d')
    }).transform(body => ({
      data: body.data ?? (body.assets ?? []).map(s => ({ symbol: s, metrics: {} })),
      sensitivity: body.sensitivity,
      timeframe: body.timeframe
    }))
  }),

  portfolioChat: z.object({
    body: z.object({
      message: z.string().min(1, 'Message is required').max(1000),
      history: z.array(
        z.object({
          role: z.enum(['user', 'assistant']),
          text: z.string().max(2000),
        })
      ).max(20).default([]),
    }),
  }),

  getTaxLossHarvesting: z.object({
    query: z.object({
      taxRate: z.string()
        .optional()
        .transform((str) => (str ? parseFloat(str) : undefined))
        .pipe(z.number().min(0).max(0.6).optional())
    }).optional()
  }),

  getWeeklyReport: z.object({}).optional(),
};

module.exports = { aiSchemas };
