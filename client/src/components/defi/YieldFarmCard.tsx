import React from 'react';
import { motion } from 'framer-motion';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface YieldFarm {
  name: string;
  protocol: string;
  protocolIcon: string;
  depositToken: {
    symbol: string;
    icon: string;
    amount: string;
    value: string;
  };
  rewardTokens: Array<{
    symbol: string;
    icon: string;
    amount: string;
    value: string;
  }>;
  apy: string;
  tvl: string;
  myDeposit: string;
  rewards: string;
  performanceChart: Array<{ date: string; apy: number }>;
  estimatedDailyReward?: {
    amount: number;
    token: string;
  };
  estimatedWeeklyReward?: {
    amount: number;
    token: string;
  };
  estimatedMonthlyReward?: {
    amount: number;
    token: string;
  };
}

interface YieldFarmCardProps {
  farm: YieldFarm;
  onDeposit?: (farm: YieldFarm) => void;
  onWithdraw?: (farm: YieldFarm) => void;
  onHarvest?: (farm: YieldFarm) => void;
}

/**
 * YieldFarmCard Component
 * 
 * Displays a yield farming opportunity with:
 * - Real 30-day APY history from backend (stored in defi-chart.model.js)
 * - Formatted token rewards (e.g., "0.0042 CRV") instead of dollar strings
 * - All actions route through WalletTxModal for blockchain transactions
 */
export const YieldFarmCard: React.FC<YieldFarmCardProps> = ({ farm, onDeposit, onWithdraw, onHarvest }) => {
  // Format reward display - show token amount if available, fallback to dollar string
  const formatRewardDisplay = (rewards: string): { amount: string; token: string } | null => {
    // Check if rewards contain a token symbol (e.g., "0.0042 CRV")
    const tokenMatch = rewards.match(/^([\d.]+)\s+([A-Z0-9]+)$/);
    if (tokenMatch) {
      return {
        amount: tokenMatch[1],
        token: tokenMatch[2]
      };
    }
    return null;
  };

  const rewardDisplay = formatRewardDisplay(farm.rewards);

  // Handle button clicks - pass to parent handler which routes through WalletTxModal
  const handleDepositClick = () => {
    if (onDeposit) onDeposit(farm);
  };

  const handleWithdrawClick = () => {
    if (onWithdraw) onWithdraw(farm);
  };

  const handleHarvestClick = () => {
    if (onHarvest) onHarvest(farm);
  };

  // Show empty chart gracefully if no performanceChart data
  const chartData = farm.performanceChart && farm.performanceChart.length > 0 
    ? farm.performanceChart 
    : [{ date: 'No Data', apy: 0 }];

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      className="bg-gray-900 rounded-xl p-6 border border-opacity-20"
      style={{
        borderImage: 'linear-gradient(45deg, #3D5AF1, #22DFBF) 1',
        boxShadow: '0 4px 20px rgba(61, 90, 241, 0.1)'
      }}
    >
      {/* Header with Protocol Info */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <img src={farm.protocolIcon} alt={farm.protocol} className="w-8 h-8 rounded-full" />
          <div>
            <h3 className="text-xl font-semibold text-white">{farm.name}</h3>
            <p className="text-gray-400 text-sm">{farm.protocol}</p>
          </div>
        </div>
        <div className="flex items-center space-x-2 bg-gray-800 rounded-lg px-3 py-1">
          <img src={farm.depositToken.icon} alt={farm.depositToken.symbol} className="w-6 h-6 rounded-full" />
          <span className="text-white font-medium">{farm.depositToken.symbol}</span>
        </div>
      </div>

      {/* 30-Day APY Performance Chart - Real Data */}
      <div className="h-32 mb-6">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <XAxis dataKey="date" hide />
            <YAxis hide />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1F2937',
                border: 'none',
                borderRadius: '8px',
                color: '#fff'
              }}
              formatter={(value) => {
                if (typeof value === 'number') {
                  return [`${value.toFixed(2)}%`, 'APY'];
                }
                return [value, 'APY'];
              }}
            />
            <Line
              type="monotone"
              dataKey="apy"
              stroke="#22DFBF"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <p className="text-gray-400 text-sm">APY</p>
          <p className="text-green-400 font-semibold">{farm.apy}</p>
        </div>
        <div>
          <p className="text-gray-400 text-sm">TVL</p>
          <p className="text-white font-semibold">{farm.tvl}</p>
        </div>
        <div>
          <p className="text-gray-400 text-sm">My Deposit</p>
          <p className="text-white font-semibold">{farm.myDeposit}</p>
        </div>
        <div>
          <p className="text-gray-400 text-sm">Pending Rewards</p>
          {rewardDisplay ? (
            <>
              <p className="text-white font-semibold">{rewardDisplay.amount}</p>
              <p className="text-gray-500 text-xs">{rewardDisplay.token}</p>
            </>
          ) : (
            <p className="text-white font-semibold">{farm.rewards}</p>
          )}
        </div>
      </div>

      {/* Reward Token Details - Only show if user has pending rewards */}
      {farm.rewardTokens.some(t => parseFloat(t.amount) > 0) && (
        <div className="mb-4">
          <p className="text-gray-400 text-sm mb-2">Pending Reward Tokens</p>
          <div className="flex items-center space-x-4">
            {farm.rewardTokens.map((token, index) => (
              <div key={index} className="flex items-center space-x-2">
                <img 
                  src={token.icon} 
                  alt={token.symbol} 
                  className="w-6 h-6 rounded-full"
                  onError={(e) => { (e.target as HTMLImageElement).src = 'https://cryptologos.cc/logos/ethereum-eth-logo.png'; }}
                />
                <div>
                  <p className="text-white font-medium">{token.amount}</p>
                  <p className="text-gray-400 text-xs">{token.symbol}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Estimated Rewards Breakdown - Real Token Amounts */}
      {(farm.estimatedDailyReward || farm.estimatedWeeklyReward || farm.estimatedMonthlyReward) && (
        <div className="mb-4 bg-gray-800 rounded-lg p-3">
          <p className="text-gray-400 text-xs mb-2">Est. Rewards</p>
          <div className="flex justify-between text-xs">
            {farm.estimatedDailyReward && (
              <div className="text-gray-300">
                <span className="text-green-400 font-semibold">{farm.estimatedDailyReward.amount}</span>
                <span className="text-gray-500"> {farm.estimatedDailyReward.token}/day</span>
              </div>
            )}
            {farm.estimatedWeeklyReward && (
              <div className="text-gray-300">
                <span className="text-green-400 font-semibold">{farm.estimatedWeeklyReward.amount}</span>
                <span className="text-gray-500"> {farm.estimatedWeeklyReward.token}/week</span>
              </div>
            )}
            {farm.estimatedMonthlyReward && (
              <div className="text-gray-300">
                <span className="text-green-400 font-semibold">{farm.estimatedMonthlyReward.amount}</span>
                <span className="text-gray-500"> {farm.estimatedMonthlyReward.token}/month</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Action Buttons - Route Through WalletTxModal */}
      <div className="flex space-x-3">
        <button 
          onClick={handleDepositClick}
          className="flex-1 bg-gradient-to-r from-[#3D5AF1] to-[#22DFBF] text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity">
          Deposit
        </button>
        <button 
          onClick={handleWithdrawClick}
          className="flex-1 border border-[#3D5AF1] text-[#3D5AF1] px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#3D5AF1] hover:bg-opacity-10 transition-colors">
          Withdraw
        </button>
        <button 
          onClick={handleHarvestClick}
          className="flex-1 bg-green-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity">
          Harvest
        </button>
      </div>
    </motion.div>
  );
};