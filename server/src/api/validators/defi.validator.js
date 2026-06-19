const { z } = require('zod');

const defiSchemas = {
  getProtocolDetails: z.object({
    params: z.object({
      id: z.string().min(1, 'Protocol ID is required')
    }).strict(),
    body: z.any().optional(),
    query: z.any().optional()
  }),

  stake: z.object({
    body: z.object({
      protocolId: z.string().min(1, 'Protocol ID is required'),
      assetSymbol: z.string().min(1, 'Asset symbol is required'),
      amount: z.number().positive('Amount must be positive'),
      duration: z.number().int().positive().optional(),
      walletAddress: z.string().min(1, 'Wallet address is required')
    }).strict(),
    query: z.any().optional(),
    params: z.any().optional()
  }),

  unstake: z.object({
    body: z.object({
      positionId: z.string().min(1, 'Position ID is required'),
      amount: z.string().min(1, 'Amount is required').optional(),
      walletAddress: z.string().min(1, 'Wallet address is required')
    }).strict(),
    query: z.any().optional(),
    params: z.any().optional()
  }),

  getPools: z.object({
    query: z.object({
      protocol: z.string().min(1, 'Protocol is required').optional(),
      token: z.string().optional()
    }).optional(),
    body: z.any().optional(),
    params: z.any().optional()
  }),

  joinPool: z.object({
    body: z.object({
      poolId: z.string().min(1, 'Pool ID is required'),
      token0Amount: z.string().min(1, 'Token 0 amount is required'),
      token1Amount: z.string().min(1, 'Token 1 amount is required'),
      walletAddress: z.string().min(1, 'Wallet address is required')
    }).strict(),
    query: z.any().optional(),
    params: z.any().optional()
  }),

  exitPool: z.object({
    body: z.object({
      poolId: z.string().min(1, 'Pool ID is required'),
      lpAmount: z.string().min(1, 'LP amount is required'),
      walletAddress: z.string().min(1, 'Wallet address is required')
    }).strict(),
    query: z.any().optional(),
    params: z.any().optional()
  }),

  farmDeposit: z.object({
    body: z.object({
      farmId: z.string().min(1, 'Farm ID is required'),
      amount: z.string().min(1, 'Amount is required'),
      walletAddress: z.string().min(1, 'Wallet address is required')
    }).strict(),
    query: z.any().optional(),
    params: z.any().optional()
  }),

  farmWithdraw: z.object({
    body: z.object({
      farmId: z.string().min(1, 'Farm ID is required'),
      amount: z.string().min(1, 'Amount is required'),
      walletAddress: z.string().min(1, 'Wallet address is required')
    }).strict(),
    query: z.any().optional(),
    params: z.any().optional()
  }),

  farmHarvest: z.object({
    body: z.object({
      farmId: z.string().min(1, 'Farm ID is required'),
      walletAddress: z.string().min(1, 'Wallet address is required')
    }).strict(),
    query: z.any().optional(),
    params: z.any().optional()
  }),

  claimRewards: z.object({
    body: z.object({
      positionId: z.string().min(1, 'Position ID is required'),
      walletAddress: z.string().min(1, 'Wallet address is required')
    }).strict(),
    query: z.any().optional(),
    params: z.any().optional()
  }),

  getChartHistory: z.object({
    params: z.object({
      positionId: z.string().min(1, 'Position ID is required')
    }).strict(),
    query: z.object({
      days: z.string().transform(v => parseInt(v)).optional()
    }).optional(),
    body: z.any().optional()
  }),

  getPoolTvlHistory: z.object({
    params: z.object({
      poolId: z.string().min(1, 'Pool ID is required')
    }).strict(),
    query: z.object({
      days: z.string().transform(v => parseInt(v, 10)).optional()
    }).optional(),
    body: z.any().optional()
  }),

  buildTx: z.object({
  body: z.object({
    action:        z.enum(['stake', 'unstake', 'addLiquidity', 'removeLiquidity', 'deposit', 'withdraw', 'harvest']),
    walletAddress: z.string().min(1, 'Wallet address is required'),

    // Staking fields
    protocolId:    z.string().optional(),   // required for stake/unstake, optional otherwise
    assetSymbol:   z.string().optional(),
    amount:        z.string().optional(),
    positionId:    z.string().optional(),   // for unstake

    // Liquidity pool fields
    poolId:        z.string().optional(),
    token0Amount:  z.string().optional(),   // addLiquidity
    token1Amount:  z.string().optional(),   // addLiquidity
    lpAmount:      z.string().optional(),   // removeLiquidity

    // Farm fields
    farmId:        z.string().optional(),
  })
  // Remove .strict() — action-specific fields vary per action type
  .refine(data => {
    // Per-action required field validation
    if (data.action === 'stake')           return !!data.protocolId && !!data.assetSymbol && !!data.amount;
    if (data.action === 'unstake')         return !!data.positionId && !!data.amount;
    if (data.action === 'addLiquidity')    return !!data.poolId && !!data.token0Amount && !!data.token1Amount;
    if (data.action === 'removeLiquidity') return !!data.poolId && !!data.lpAmount;
    if (data.action === 'deposit')         return !!data.farmId && !!data.amount;
    if (data.action === 'withdraw')        return !!data.farmId && !!data.amount;
    if (data.action === 'harvest')         return !!data.farmId;
    return true;
  }, {
    message: 'Missing required fields for the specified action'
  })
}),

confirmTx: z.object({
    body: z.object({
      txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/, 'Invalid tx hash'),
      positionType: z.enum(['staking', 'liquidity', 'farming']),
      metadata: z.object({
        protocolId: z.string().min(1),
        asset: z.string().optional(),
        apy: z.number().optional(),
        lockPeriod: z.number().optional(),
        walletAddress: z.string().min(1),
        network: z.string().default('ethereum')
      })
    }).strict()
  })
};

module.exports = { defiSchemas };