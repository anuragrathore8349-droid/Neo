import React from 'react';
import { motion } from 'framer-motion';

interface Protocol {
  name:         string;
  icon:         string;
  tvl:          string;
  apy:          string;
  risk:         'Low' | 'Medium' | 'High';
  chain:        string;
  description?: string;
  features?:    string[];
  safetyScore?: string;
}

interface ProtocolDetailsModalProps {
  isOpen: boolean;
  protocol: Protocol | null;
  onClose: () => void;
}

const getRiskColor = (risk: string) => {
  switch (risk) {
    case 'Low':
      return 'bg-green-500/20 text-green-400 border-green-500/30';
    case 'Medium':
      return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    case 'High':
      return 'bg-red-500/20 text-red-400 border-red-500/30';
    default:
      return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
  }
};

export const ProtocolDetailsModal: React.FC<ProtocolDetailsModalProps> = ({
  isOpen,
  protocol,
  onClose
}) => {
  if (!isOpen || !protocol) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="bg-gray-900 rounded-xl p-8 max-w-md w-full border border-gray-700"
      >
        {/* Protocol Header */}
        <div className="flex items-center space-x-4 mb-6">
          <img
            src={protocol.icon}
            alt={protocol.name}
            className="w-16 h-16 rounded-full border-2 border-blue-500"
          />
          <div>
            <h2 className="text-3xl font-bold text-white">{protocol.name}</h2>
            <p className="text-gray-400 text-sm mt-1">{protocol.chain}</p>
          </div>
        </div>

        {/* Details Grid */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          {/* TVL */}
          <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
            <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">
              Total Value Locked
            </p>
            <p className="text-white text-xl font-bold">{protocol.tvl}</p>
          </div>

          {/* APY */}
          <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
            <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">
              Annual Percentage Yield
            </p>
            <p className="text-white text-xl font-bold">{protocol.apy}</p>
          </div>

          {/* Risk Level */}
          <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700 col-span-2">
            <p className="text-gray-400 text-xs uppercase tracking-wider mb-2">
              Risk Level
            </p>
            <div className={`inline-block px-3 py-1 rounded-full border text-sm font-semibold ${getRiskColor(protocol.risk)}`}>
              {protocol.risk} Risk
            </div>
          </div>
        </div>

        {/* Description */}
        <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700 mb-6">
          <p className="text-gray-300 text-sm leading-relaxed">
            {protocol.description ||
              `${protocol.name} is a decentralized finance protocol on the ${protocol.chain} network.`}
          </p>
          {protocol.features && protocol.features.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {protocol.features.map(f => (
                <span key={f} className="text-xs bg-blue-900/30 text-blue-300 border border-blue-700/40 px-2 py-1 rounded-full">
                  {f}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Add safety score if present */}
        {protocol.safetyScore && (
          <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700 mb-6">
            <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">Safety Score</p>
            <p className="text-green-400 text-xl font-bold">{protocol.safetyScore}</p>
          </div>
        )}

        {/* Close Button */}
        <button
          onClick={onClose}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          Close
        </button>
      </motion.div>
    </div>
  );
};
