import React from 'react';
import { AlertTriangle } from 'lucide-react';
import GlassCard from '../common/GlassCard';

interface NetworkStatusProps {
  gasPrice: {
    slow: number;
    medium: number;
    fast: number;
  };
}

const NetworkStatus: React.FC<NetworkStatusProps> = ({ gasPrice }) => {
  return (
    <GlassCard className="p-6">
      <h3 className="text-xl font-semibold mb-4">Network Status</h3>
      
      <div className="space-y-4">
        <div className="bg-dark-800/50 rounded-lg p-4">
          <div className="flex justify-between items-center mb-2">
            <p className="font-medium">Ethereum</p>
            <div className="flex items-center text-secondary">
              <div className="h-2 w-2 rounded-full bg-secondary mr-2"></div>
              <span className="text-sm">Active</span>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-dark-400">Block Height</span>
              <span>18,934,567</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-dark-400">Gas Price</span>
              <span>{gasPrice.medium} Gwei</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-dark-400">Peers</span>
              <span>100+</span>
            </div>
          </div>
        </div>
        
        <div className="bg-dark-800/50 rounded-lg p-4">
          <p className="text-dark-400 text-sm mb-2">Gas Tracker</p>
          <div className="space-y-3">
            {Object.entries(gasPrice).map(([speed, price]) => (
              <div key={speed}>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm capitalize">{speed}</span>
                  <span className="text-sm font-medium">{price} Gwei</span>
                </div>
                <div className="h-1.5 w-full bg-dark-700 rounded-full">
                  <div 
                    className={`h-full rounded-full ${
                      speed === 'slow' ? 'w-1/3 bg-secondary' :
                      speed === 'medium' ? 'w-1/2 bg-primary' :
                      'w-3/4 bg-red-500'
                    }`}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4">
          <div className="flex items-start">
            <AlertTriangle size={16} className="text-amber-500 mt-0.5 mr-2" />
            <p className="text-sm text-dark-300">
              Network congestion is moderate. Consider using fast gas for important transactions.
            </p>
          </div>
        </div>
      </div>
    </GlassCard>
  );
};

export default NetworkStatus;