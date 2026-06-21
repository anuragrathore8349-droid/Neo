// FILE: src/components/defi/GasTracker.tsx
// REPLACE ENTIRE FILE

import React from 'react';
import { motion } from 'framer-motion';

interface GasPrice {
  network: string;
  price:   string;
  speed:   'Slow' | 'Normal' | 'Fast';
  trend:   'up' | 'down' | 'stable';
}

interface GasTrackerProps {
  gasPrices: GasPrice[];
}

const TREND_ICON: Record<string, string> = { up: '↑', down: '↓', stable: '→' };
const SPEED_COLOR: Record<string, string> = { Slow: '#FACC15', Normal: '#60A5FA', Fast: '#34D399' };

export const GasTracker: React.FC<GasTrackerProps> = ({ gasPrices }) => {
  // Group by network
  const grouped = gasPrices.reduce<Record<string, { Slow?: GasPrice; Normal?: GasPrice; Fast?: GasPrice; trend?: string }>>((acc, g) => {
    if (!acc[g.network]) acc[g.network] = { trend: g.trend };
    acc[g.network][g.speed] = g;
    return acc;
  }, {});

  return (
    <div className="bg-gray-900 rounded-xl p-6 border border-gray-700"
         style={{ boxShadow: '0 4px 20px rgba(61, 90, 241, 0.1)' }}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-semibold text-white">Gas Tracker</h3>
        <div className="flex gap-4 text-xs text-gray-400">
          <span style={{ color: SPEED_COLOR.Slow   }}>● Slow</span>
          <span style={{ color: SPEED_COLOR.Normal }}>● Normal</span>
          <span style={{ color: SPEED_COLOR.Fast   }}>● Fast</span>
        </div>
      </div>

      <div className="space-y-3">
        {Object.entries(grouped).map(([network, speeds], idx) => (
          <motion.div
            key={network}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.08 }}
            className="flex items-center justify-between p-3 rounded-lg bg-gray-800"
          >
            <span className="text-white font-medium w-24">{network}</span>
            <div className="flex gap-6">
              {(['Slow', 'Normal', 'Fast'] as const).map(spd => (
                <div key={spd} className="text-center min-w-[64px]">
                  <p className="text-gray-400 text-xs">{spd}</p>
                  <p className="font-medium text-sm" style={{ color: SPEED_COLOR[spd] }}>
                    {speeds[spd]?.price || '—'}
                  </p>
                </div>
              ))}
            </div>
            <span className="text-gray-400 text-lg w-6 text-center" title="Trend">
              {TREND_ICON[speeds.trend || 'stable']}
            </span>
          </motion.div>
        ))}

        {Object.keys(grouped).length === 0 && (
          <p className="text-gray-400 text-sm text-center py-4">Loading gas prices…</p>
        )}
      </div>
    </div>
  );
};