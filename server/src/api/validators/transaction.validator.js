const { z } = require('zod');

const transactionSchemas = {
  createTransaction: z.object({
    body: z.object({
      walletId: z.string().optional(),
      type: z.enum(['deposit', 'withdrawal', 'transfer', 'buy', 'sell', 'swap', 'stake', 'unstake']),
      asset: z.string().min(1, 'Asset is required'),
      amount: z.number().positive('Amount must be positive'),
      fee: z.number().min(0, 'Fee cannot be negative').optional().default(0),
      sourceAddress: z.string().optional(),
      destinationAddress: z.string().optional(),
      network: z.string().min(1, 'Network is required'),
      memo: z.string().optional(),
      txHash: z.string().optional()
    })
  }),

  getTransactions: z.object({
    query: z.object({
      limit: z.coerce.number().int().min(1).max(100).optional().default(50),
      skip:  z.coerce.number().int().min(0).optional().default(0),
      type:  z.enum(['deposit', 'withdrawal', 'transfer']).optional(),
      asset: z.string().optional(),
      status: z.enum(['pending', 'completed', 'failed', 'cancelled']).optional(),
      from:  z.string().datetime().optional(),
      to:    z.string().datetime().optional()
    })
  }),

  getRecentTransactions: z.object({
    query: z.object({
      limit: z.coerce.number().int().min(1).max(100).optional().default(50),
      skip:  z.coerce.number().int().min(0).optional().default(0),
    }).optional(),
  }),

  getTransactionsByAsset: z.object({
    query: z.object({
      limit: z.coerce.number().int().min(1).max(100).optional().default(50),
      skip:  z.coerce.number().int().min(0).optional().default(0),
    }).optional(),
  }),

  getTransactionsByType: z.object({
    query: z.object({
      limit: z.coerce.number().int().min(1).max(100).optional().default(50),
      skip:  z.coerce.number().int().min(0).optional().default(0),
    }).optional(),
  })
};

module.exports = { transactionSchemas };