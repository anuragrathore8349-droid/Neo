import React from 'react';
import { motion } from 'framer-motion';

interface Protocol {
  name: string;
  icon: string;
  tvl: string;
  apy: string;
  risk: 'Low' | 'Medium' | 'High';
  chain: string;
}

interface ProtocolCardProps {
  protocol: Protocol;
  onViewDetails?: (protocol: Protocol) => void;
}

const getRiskColor = (risk: string) => {
  switch (risk) {
    case 'Low':
      return 'bg-green-100 text-green-800';
    case 'Medium':
      return 'bg-yellow-100 text-yellow-800';
    case 'High':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

export const ProtocolCard: React.FC<ProtocolCardProps> = ({ protocol, onViewDetails }) => {
  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      className="relative bg-gray-900 rounded-xl overflow-hidden p-6 border border-opacity-20"
      style={{
        borderImage: 'linear-gradient(45deg, #3D5AF1, #22DFBF) 1',
        boxShadow: '0 4px 20px rgba(61, 90, 241, 0.1)'
      }}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <img src={protocol.icon} alt={protocol.name} className="w-10 h-10 rounded-full" />
          <h3 className="text-xl font-semibold text-white">{protocol.name}</h3>
        </div>
        <span className="text-sm px-3 py-1 rounded-full font-medium" 
              style={{ background: 'rgba(34, 223, 191, 0.1)', color: '#22DFBF' }}>
          {protocol.chain}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="space-y-1">
          <p className="text-gray-400 text-sm">Total Value Locked</p>
          <p className="text-white text-lg font-semibold">{protocol.tvl}</p>
        </div>
        <div className="space-y-1">
          <p className="text-gray-400 text-sm">APY</p>
          <div className="flex items-center gap-1">
            {!protocol.isLive && (
              <span className="text-xs bg-yellow-500/20 text-yellow-400 px-1 rounded">est.</span>
            )}
            <p className={`text-lg font-semibold ${protocol.apy !== null ? 'text-green-400' : 'text-gray-500'}`}>
              {protocol.apy !== null ? `${Number(protocol.apy).toFixed(2)}%` : '—'}
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${getRiskColor(protocol.risk)}`}>
          {protocol.risk} Risk
        </span>
        <button 
          onClick={() => onViewDetails?.(protocol)}
          className="bg-gradient-to-r from-[#3D5AF1] to-[#22DFBF] text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
        >
          View Details
        </button>
      </div>
    </motion.div>
  );
};
