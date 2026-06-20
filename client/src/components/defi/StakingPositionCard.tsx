// FILE: src/components/defi/StakingPositionCard.tsx
// REPLACE ENTIRE FILE

import React from 'react';
import { motion } from 'framer-motion';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { StakingPosition } from '../../services/defi.service';

interface StakingPositionCardProps {
  position: StakingPosition;
  chartData?: Array<{ date: string; value: number }>;
  onClaimRewards: (position: StakingPosition) => void;
  onUnstake: (position: StakingPosition) => void;
}

export const StakingPositionCard: React.FC<StakingPositionCardProps> = ({
  position, chartData = [], onClaimRewards, onUnstake
}) => {
  const assetSymbol = typeof position.asset === 'string'
    ? position.asset
    : (position.asset as any)?.symbol || 'Unknown';

  const etherscanUrl = position.transactionHash
    ? `https://etherscan.io/tx/${position.transactionHash}`
    : null;

  const truncateHash = (hash: string) => `${hash.slice(0, 6)}…${hash.slice(-4)}`;

  const hasActiveStaking = position.status !== 'available'
    && parseFloat((position.amount || '0').replace(/[^0-9.]/g, '')) > 0;

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      className="bg-gray-900 rounded-xl p-6 border border-gray-700"
      style={{ boxShadow: '0 4px 20px rgba(61, 90, 241, 0.1)' }}
    >
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-xl font-semibold text-white">{assetSymbol}</h3>
          <p className="text-gray-400 text-sm">{position.protocol || 'Staking Position'}</p>
        </div>
        <div className="text-right">
          <p className="text-white text-lg font-semibold">{position.value}</p>
          <p className="text-green-400 text-sm">APY: {position.apy}</p>
        </div>
      </div>

      {/* Chart */}
      <div className="h-32 mb-6 bg-gray-800/50 rounded-lg p-2">
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id={`grad-${position.id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#3D5AF1" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#22DFBF" stopOpacity={0}   />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" hide />
              <YAxis hide />
              <Tooltip
                contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #3D5AF1', borderRadius: '8px', color: '#fff' }}
                formatter={(v: any) => [`$${Number(v).toFixed(2)}`, 'Value']}
              />
              <Area type="monotone" dataKey="value" stroke="#3D5AF1" fill={`url(#grad-${position.id})`} />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-500 text-sm">
              {position.status === 'available' ? 'No position yet' : 'Collecting chart data…'}
            </p>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="bg-gray-800/50 rounded-lg p-3">
          <p className="text-gray-400 text-sm">Staked Amount</p>
          <p className="text-white font-semibold">{position.amount || '—'}</p>
        </div>
        <div className="bg-gray-800/50 rounded-lg p-3">
          <p className="text-gray-400 text-sm">Pending Rewards</p>
          <p className="text-green-400 font-semibold">{position.rewards || '—'}</p>
        </div>
      </div>

      {position.earnedSoFar && parseFloat(position.earnedSoFar.replace(/[^0-9.]/g, '')) > 0 && (
        <div className="bg-gray-800/50 rounded-lg p-3 mb-4">
          <p className="text-gray-400 text-sm">Already Claimed</p>
          <p className="text-white font-semibold">{position.earnedSoFar}</p>
        </div>
      )}

      {/* Etherscan link */}
      {etherscanUrl && (
        <div className="mb-4 p-3 bg-blue-900/20 border border-blue-700/30 rounded-lg">
          <p className="text-gray-400 text-xs mb-1">Transaction</p>
          <a href={etherscanUrl} target="_blank" rel="noopener noreferrer"
             className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 transition-colors text-sm">
            <code className="bg-gray-900/50 px-2 py-1 rounded text-xs">
              {truncateHash(position.transactionHash!)}
            </code>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        </div>
      )}

      {/* Available opportunity hint */}
      {position.status === 'available' && (
        <div className="mb-4 p-3 bg-blue-900/20 border border-blue-700/30 rounded-lg">
          <p className="text-green-400 text-xs font-medium">
            Available opportunity — click "+ Stake Now" above to start earning.
          </p>
          {position.description && (
            <p className="text-gray-400 text-xs mt-1">{position.description}</p>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        {hasActiveStaking ? (
          <>
            <button onClick={() => onClaimRewards(position)}
              className="flex-1 bg-gradient-to-r from-blue-600 to-green-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity">
              Claim Rewards
            </button>
            <button onClick={() => onUnstake(position)}
              className="flex-1 border border-blue-500 text-blue-400 px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-500/10 transition-colors">
              Unstake
            </button>
          </>
        ) : (
          <button disabled
            className="flex-1 bg-gray-700 text-gray-500 px-4 py-2 rounded-lg text-sm font-medium cursor-not-allowed opacity-50">
            {position.status === 'available' ? 'Stake to Activate' : 'No Active Staking'}
          </button>
        )}
      </div>
    </motion.div>
  );
};