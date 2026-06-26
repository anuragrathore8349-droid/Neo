// FILE: src/validators/wallet.validator.js
const { z } = require('zod');

const walletSchemas = {
  connectWallet: z.object({
    body: z.object({
      name:      z.string().min(1).max(50),
      type:      z.enum(['exchange', 'defi', 'external']),
      provider:  z.string().min(1),
      address:   z.string().min(1),
      network:   z.string().min(1),
      signature: z.string().min(1).optional(),
    }),
  }).superRefine((data, ctx) => {
    if (data.body.type === 'external' && !data.body.signature) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Signature is required to verify ownership of external wallets',
        path: ['body', 'signature'],
      });
    }
  }),

  removeWallet: z.object({
    params: z.object({ id: z.string().min(1) }),
  }),

  getTransactions: z.object({
    query: z.object({
      walletId: z.string().optional(),
      type:     z.enum(['all', 'deposit', 'withdrawal', 'transfer']).optional().default('all'),
      from:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      to:       z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      limit:    z.coerce.number().int().min(1).max(100).optional().default(50),
      skip:     z.coerce.number().int().min(0).optional().default(0),
    }),
  }),

  withdrawFunds: z.object({
    body: z.object({
      walletId:           z.string().min(1),
      asset:              z.string().min(1),
      amount:             z.number().positive(),
      destinationAddress: z.string().min(1),
      network:            z.string().min(1),
      memo:               z.string().optional(),
      twoFactorCode:      z.string().length(6).optional(),
      signedTx:           z.string().optional(),
    }),
  }),

  getDepositAddress: z.object({
    body: z.object({
      walletId: z.string().min(1),
      asset:    z.string().min(1),
      network:  z.string().min(1),
    }),
  }),

  // ✅ New: validate cache-transactions body
  cacheTransactions: z.object({
    body: z.object({
      walletId: z.string().min(1, 'Wallet ID is required'),
      transactions: z.array(z.object({
        hash:      z.string().min(1),
        type:      z.enum(['send', 'receive', 'transfer', 'swap', 'approve']),
        asset:     z.string().min(1),
        value:     z.string().or(z.number()),
        from:      z.string(),
        to:        z.string(),
        network:   z.string(),
        status:    z.enum(['pending', 'completed', 'failed']).default('pending'),
        timestamp: z.string(),
      })).min(1),
    }),
  }),
};

module.exports = { walletSchemas };