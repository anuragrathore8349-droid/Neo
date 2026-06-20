import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface Token {
  symbol: string;
  icon: string;
  amount: string;
  value: string;
}

interface LiquidityPool {
  name: string;
  protocol: string;
  protocolIcon: string;
  tokens: Token[];
  tvl: string;
  apr: string;
  volume24h: string;
  myLiquidity: string;
  chartData: Array<{ date: string; tvl: number }>;
}

interface LiquidityPoolCardProps {
  pool: LiquidityPool;
  onAddLiquidity?: (pool: LiquidityPool) => void;
  onRemoveLiquidity?: (pool: LiquidityPool) => void;
}

export const LiquidityPoolCard: React.FC<LiquidityPoolCardProps> = ({ pool, onAddLiquidity, onRemoveLiquidity }) => {
  const [failedIcons, setFailedIcons] = useState<Set<string>>(new Set());

  const handleIconError = (tokenSymbol: string) => {
    setFailedIcons(prev => new Set(prev).add(tokenSymbol));
  };

  const getTokenIconDisplay = (token: Token) => {
    if (failedIcons.has(token.symbol)) {
      // Show fallback: first letter of symbol in a circle
      return (
        <div className="w-6 h-6 rounded-full bg-gradient-to-r from-[#3D5AF1] to-[#22DFBF] flex items-center justify-center text-xs font-bold text-white">
          {token.symbol.charAt(0)}
        </div>
      );
    }
    return (
      <img 
        src={token.icon} 
        alt={token.symbol} 
        className="w-6 h-6 rounded-full object-cover"
        onError={() => handleIconError(token.symbol)}
      />
    );
  };

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      className="bg-gray-900 rounded-xl p-6 border border-opacity-20"
      style={{
        borderImage: 'linear-gradient(45deg, #3D5AF1, #22DFBF) 1',
        boxShadow: '0 4px 20px rgba(61, 90, 241, 0.1)'
      }}
    >
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <img 
            src={pool.protocolIcon} 
            alt={pool.protocol} 
            className="w-8 h-8 rounded-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).src = 'https://assets.coingecko.com/coins/images/1/small/bitcoin.png';
            }}
          />
          <div>
            <h3 className="text-xl font-semibold text-white">{pool.name}</h3>
            <p className="text-gray-400 text-sm">{pool.protocol}</p>
          </div>
        </div>
        <div className="flex space-x-2">
          {pool.tokens.map((token) => (
            <div key={token.symbol} title={token.symbol}>
              {getTokenIconDisplay(token)}
            </div>
          ))}
        </div>
      </div>

      <div className="h-32 mb-6">
        {(!pool.chartData || pool.chartData.length === 0) ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-500 text-xs">Collecting TVL history…</p>
          </div>
        ) : (
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={pool.chartData || []} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <defs>
              <linearGradient id={`poolTvl-${pool.name}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3D5AF1" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#22DFBF" stopOpacity={0}/>
              </linearGradient>
            </defs>
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
                  return ['$' + (value / 1e6).toFixed(2) + 'M', 'TVL'];
                }
                return value;
              }}
            />
            <Area
              type="monotone"
              dataKey="tvl"
              stroke="#3D5AF1"
              fill={`url(#poolTvl-${pool.name})`}
              isAnimationActive={true}
            />
          </AreaChart>
        </ResponsiveContainer>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <p className="text-gray-400 text-sm">Total Value Locked</p>
          <p className="text-white font-semibold">{pool.tvl}</p>
        </div>
        <div>
          <p className="text-gray-400 text-sm">APR</p>
          <p className="text-green-400 font-semibold">{pool.apr}</p>
        </div>
        <div>
          <p className="text-gray-400 text-sm">24h Volume</p>
          <p className="text-white font-semibold">{pool.volume24h}</p>
        </div>
        <div>
          <p className="text-gray-400 text-sm">My Liquidity</p>
          <p className="text-white font-semibold">{pool.myLiquidity}</p>
        </div>
      </div>

      <div className="flex space-x-3">
        <button 
          onClick={() => onAddLiquidity?.(pool)}
          className="flex-1 bg-gradient-to-r from-[#3D5AF1] to-[#22DFBF] text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
        >
          Add Liquidity
        </button>
        <button 
          onClick={() => onRemoveLiquidity?.(pool)}
          className="flex-1 border border-[#3D5AF1] text-[#3D5AF1] px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#3D5AF1] hover:bg-opacity-10 transition-colors"
        >
          Remove
        </button>
      </div>
    </motion.div>
  );
};