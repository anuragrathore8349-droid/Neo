import React, { useEffect, useState } from 'react';
import { AlertTriangle, Loader } from 'lucide-react';
import GlassCard from '../common/GlassCard';

interface NetworkStatusProps {
  gasPrice: {
    slow: number;
    medium: number;
    fast: number;
  };
}

const NetworkStatus: React.FC<NetworkStatusProps> = ({ gasPrice }) => {
  const [blockNumber, setBlockNumber] = useState<number | null>(null);
  const [networkStatus, setNetworkStatus] = useState<string>('Checking...');
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const checkNetwork = async () => {
      try {
        if (!window.ethereum) {
          setNetworkStatus('MetaMask not connected');
          setIsConnected(false);
          return;
        }

        // Get current block number via JSON-RPC
        const response = await fetch('https://eth.public-rpc.com/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'eth_blockNumber',
            params: [],
            id: 1,
          }),
        });

        const data = await response.json();
        if (data.result) {
          const blockNum = parseInt(data.result, 16);
          setBlockNumber(blockNum);
          setNetworkStatus('Connected');
          setIsConnected(true);
        }
      } catch (err) {
        setNetworkStatus('Connection Error');
        setIsConnected(false);
      }
    };

    checkNetwork();
    const interval = setInterval(checkNetwork, 30000); // Update every 30 seconds

    return () => clearInterval(interval);
  }, []);

  const getNetworkName = () => {
    if (!window.ethereum) return 'Ethereum';
    // Could detect actual network via ethereum.request({ method: 'net_version' })
    return 'Ethereum Mainnet';
  };

  const getCongestLevel = () => {
    if (gasPrice.medium < 20) return { level: 'Low', color: 'text-secondary' };
    if (gasPrice.medium < 50) return { level: 'Moderate', color: 'text-amber-400' };
    return { level: 'High', color: 'text-red-400' };
  };

  const congestion = getCongestLevel();

  return (
    <GlassCard className="p-6">
      <h3 className="text-xl font-semibold mb-4">Network Status</h3>
      
      <div className="space-y-4">
        {/* Network Status */}
        <div className="bg-dark-800/50 rounded-lg p-4">
          <div className="flex justify-between items-center mb-2">
            <p className="font-medium">{getNetworkName()}</p>
            <div className="flex items-center gap-2">
              <div className={`h-2 w-2 rounded-full ${isConnected ? 'bg-secondary' : 'bg-red-500'} animate-pulse`}></div>
              <span className="text-sm font-medium">{networkStatus}</span>
            </div>
          </div>
          <div className="space-y-2 text-sm">
            {blockNumber ? (
              <>
                <div className="flex justify-between text-dark-400">
                  <span>Current Block</span>
                  <span className="text-white font-mono">#{blockNumber.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-dark-400">
                  <span>Gas (Medium)</span>
                  <span className="text-white font-medium">{gasPrice.medium} Gwei</span>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2 text-dark-400">
                <Loader size={14} className="animate-spin" />
                Loading block data...
              </div>
            )}
          </div>
        </div>

        {/* Gas Tracker */}
        <div className="bg-dark-800/50 rounded-lg p-4">
          <p className="text-dark-400 text-sm mb-3">Gas Tracker</p>
          <div className="space-y-3">
            {Object.entries(gasPrice).map(([speed, price]) => {
              const speedLabel =
                speed === 'slow' ? 'Slow' :
                speed === 'medium' ? 'Standard' : 'Fast';
              const speedTime =
                speed === 'slow' ? '~5 min' :
                speed === 'medium' ? '~3 min' : '<1 min';
              return (
                <div key={speed}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm">{speedLabel}</span>
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
                  <p className="text-xs text-dark-400 mt-1">{speedTime}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Congestion Alert */}
        <div className={`${
          congestion.level === 'Low' ? 'bg-secondary/10 border-secondary/20' :
          congestion.level === 'Moderate' ? 'bg-amber-500/10 border-amber-500/20' :
          'bg-red-500/10 border-red-500/20'
        } border rounded-lg p-4 flex gap-3`}>
          <AlertTriangle size={16} className={`${congestion.color} mt-0.5 flex-shrink-0`} />
          <p className={`text-sm ${congestion.color}`}>
            Network congestion is <strong>{congestion.level.toLowerCase()}</strong>. 
            {congestion.level === 'Low' && ' This is a good time to transact.'}
            {congestion.level === 'Moderate' && ' Consider using standard gas.'}
            {congestion.level === 'High' && ' Consider using fast gas or waiting.'}
          </p>
        </div>
      </div>
    </GlassCard>
  );
};

export default NetworkStatus;