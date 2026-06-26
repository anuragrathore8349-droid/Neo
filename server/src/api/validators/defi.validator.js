'use strict';
const { z } = require('zod');

// Standard pagination object
const paginationQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  skip:  z.coerce.number().int().min(0).optional().default(0),
});

const defiSchemas = {
  getProtocols: z.object({
    query: paginationQuery.optional(),
  }),

  getProtocolDetails: z.object({
    params: z.object({ id: z.string().min(1, 'Protocol ID is required') }).strict(),
    body:   z.any().optional(),
    query:  z.any().optional()
  }),

  stake: z.object({
    body: z.object({
      protocolId:    z.string().min(1, 'Protocol ID is required'),
      assetSymbol:   z.string().min(1, 'Asset symbol is required'),
      amount:        z.number().positive('Amount must be positive'),
      duration:      z.number().int().positive().optional(),
      walletAddress: z.string().min(1, 'Wallet address is required')
    }).strict(),
    query:  z.any().optional(),
    params: z.any().optional()
  }),

  unstake: z.object({
    body: z.object({
      positionId:    z.string().min(1, 'Position ID is required'),
      amount:        z.string().optional(),
      walletAddress: z.string().min(1, 'Wallet address is required')
    }).strict(),
    query:  z.any().optional(),
    params: z.any().optional()
  }),

  getPositions: z.object({
    query: paginationQuery.optional(),
  }),

  getStakingPositions: z.object({
    query: paginationQuery.optional(),
  }),

  getPools: z.object({
    query: z.object({
      protocol: z.string().optional(),
      token:    z.string().optional(),
      limit:    z.coerce.number().int().min(1).max(100).optional().default(50),
      skip:     z.coerce.number().int().min(0).optional().default(0),
    }).optional(),
    body:   z.any().optional(),
    params: z.any().optional()
  }),

  joinPool: z.object({
    body: z.object({
      poolId:        z.string().min(1, 'Pool ID is required'),
      protocolId:    z.string().optional(),
      token0Amount:  z.string().min(1, 'Token 0 amount is required'),
      token1Amount:  z.string().min(1, 'Token 1 amount is required'),
      walletAddress: z.string().min(1, 'Wallet address is required')
    }).strict(),
    query:  z.any().optional(),
    params: z.any().optional()
  }),

  exitPool: z.object({
    body: z.object({
      poolId:        z.string().min(1, 'Pool ID is required'),
      lpAmount:      z.string().min(1, 'LP amount is required'),
      walletAddress: z.string().min(1, 'Wallet address is required')
    }).strict(),
    query:  z.any().optional(),
    params: z.any().optional()
  }),

  farmDeposit: z.object({
    body: z.object({
      farmId:        z.string().min(1, 'Farm ID is required'),
      protocolId:    z.string().optional(),
      amount:        z.string().min(1, 'Amount is required'),
      walletAddress: z.string().min(1, 'Wallet address is required')
    }).strict(),
    query:  z.any().optional(),
    params: z.any().optional()
  }),

  farmWithdraw: z.object({
    body: z.object({
      farmId:        z.string().min(1, 'Farm ID is required'),
      protocolId:    z.string().optional(),
      amount:        z.string().min(1, 'Amount is required'),
      walletAddress: z.string().min(1, 'Wallet address is required')
    }).strict(),
    query:  z.any().optional(),
    params: z.any().optional()
  }),

  getYieldFarms: z.object({
    query: paginationQuery.optional(),
  }),

  farmHarvest: z.object({
    body: z.object({
      farmId:        z.string().min(1, 'Farm ID is required'),
      protocolId:    z.string().optional(),
      walletAddress: z.string().min(1, 'Wallet address is required')
    }).strict(),
    query:  z.any().optional(),
    params: z.any().optional()
  }),

  claimRewards: z.object({
    body: z.object({
      positionId:    z.string().min(1, 'Position ID is required'),
      walletAddress: z.string().min(1, 'Wallet address is required')
    }).strict(),
    query:  z.any().optional(),
    params: z.any().optional()
  }),

  getChartHistory: z.object({
    params: z.object({ positionId: z.string().min(1, 'Position ID is required') }).strict(),
    query: z.object({
      days: z.string().transform(v => parseInt(v)).optional()
    }).optional(),
    body: z.any().optional()
  }),

  getPoolTvlHistory: z.object({
    params: z.object({ poolId: z.string().min(1, 'Pool ID is required') }).strict(),
    query: z.object({
      days: z.string().transform(v => parseInt(v, 10)).optional()
    }).optional(),
    body: z.any().optional()
  }),

  buildTx: z.object({
    body: z.object({
      action:        z.enum(['stake', 'unstake', 'addLiquidity', 'removeLiquidity', 'deposit', 'withdraw', 'harvest']),
      walletAddress: z.string().min(1, 'Wallet address is required'),
      protocolId:    z.string().optional(),
      assetSymbol:   z.string().optional(),
      amount:        z.string().optional(),
      positionId:    z.string().optional(),
      poolId:        z.string().optional(),
      token0Amount:  z.string().optional(),
      token1Amount:  z.string().optional(),
      lpAmount:      z.string().optional(),
      farmId:        z.string().optional(),
      network:       z.string().optional(),
      metadata:      z.any().optional()
    }).refine(data => {
      if (data.action === 'stake')           return !!data.protocolId && !!data.assetSymbol && !!data.amount;
      if (data.action === 'unstake')         return !!data.positionId && !!data.amount;
      if (data.action === 'addLiquidity')    return !!data.poolId && !!data.token0Amount && !!data.token1Amount;
      if (data.action === 'removeLiquidity') return !!data.poolId && !!data.lpAmount;
      if (data.action === 'deposit')         return !!data.farmId && !!data.amount;
      if (data.action === 'withdraw')        return !!data.farmId && !!data.amount;
      if (data.action === 'harvest')         return !!data.farmId;
      return true;
    }, { message: 'Missing required fields for the specified action' })
  }),

  // positionType is now OPTIONAL — WalletTxModal may not send it for harvest/claim
  confirmTx: z.object({
    body: z.object({
      txHash:       z.string().regex(/^0x[a-fA-F0-9]{64}$/, 'Invalid tx hash'),
      positionType: z.enum(['staking', 'liquidity', 'farming']).optional().default('staking'),
      metadata:     z.object({
        protocolId:    z.string().min(1),
        asset:         z.string().optional(),
        amount:        z.union([z.string(), z.number()]).optional(),
        apy:           z.union([z.string(), z.number()]).optional(),
        lockPeriod:    z.number().optional(),
        walletAddress: z.string().min(1),
        network:       z.string().default('ethereum'),
        assetAddress:  z.string().optional()
      })
    }).strict()
  })
};

module.exports = { defiSchemas };