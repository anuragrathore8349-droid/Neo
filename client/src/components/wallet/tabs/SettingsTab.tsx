import React from 'react';
import GlassCard from '../../common/GlassCard';

interface SettingsTabProps {
  gasPrice: {
    slow: number;
    medium: number;
    fast: number;
  };
  selectedGasPrice: string;
  onGasPriceChange: (value: string) => void;
}

const SettingsTab: React.FC<SettingsTabProps> = ({
  gasPrice,
  selectedGasPrice,
  onGasPriceChange,
}) => {
  return (
    <div className="pt-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <GlassCard className="p-6">
            <h3 className="text-xl font-semibold mb-6">Gas Settings</h3>
            
            <div className="space-y-6">
              <div className="bg-dark-800/50 rounded-lg p-4">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h4 className="font-medium">Default Gas Price</h4>
                    <p className="text-dark-400 text-sm mt-1">
                      Choose your preferred gas price setting
                    </p>
                  </div>
                  <select 
                    className="input-field"
                    value={selectedGasPrice}
                    onChange={(e) => onGasPriceChange(e.target.value)}
                  >
                    <option value="slow">Slow ({gasPrice.slow} Gwei)</option>
                    <option value="medium">Medium ({gasPrice.medium} Gwei)</option>
                    <option value="fast">Fast ({gasPrice.fast} Gwei)</option>
                  </select>
                </div>
                
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm">Slow</span>
                      <span className="text-sm font-medium">{gasPrice.slow} Gwei</span>
                    </div>
                    <div className="h-1.5 w-full bg-dark-700 rounded-full">
                      <div className="h-full w-1/3 bg-secondary rounded-full"></div>
                    </div>
                    <p className="text-xs text-dark-400 mt-1">~5 min</p>
                  </div>
                  
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm">Medium</span>
                      <span className="text-sm font-medium">{gasPrice.medium} Gwei</span>
                    </div>
                    <div className="h-1.5 w-full bg-dark-700 rounded-full">
                      <div className="h-full w-1/2 bg-primary rounded-full"></div>
                    </div>
                    <p className="text-xs text-dark-400 mt-1">~3 min</p>
                  </div>
                  
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm">Fast</span>
                      <span className="text-sm font-medium">{gasPrice.fast} Gwei</span>
                    </div>
                    <div className="h-1.5 w-full bg-dark-700 rounded-full">
                      <div className="h-full w-3/4 bg-red-500 rounded-full"></div>
                    </div>
                    <p className="text-xs text-dark-400 mt-1">&lt;1 min</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-dark-800/50 rounded-lg p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-medium">Advanced Gas Controls</h4>
                    <p className="text-dark-400 text-sm mt-1">
                      Enable manual gas limit and price adjustment
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" />
                    <div className="w-11 h-6 bg-dark-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>
              </div>
              
              <div className="bg-dark-800/50 rounded-lg p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-medium">Gas Price Alerts</h4>
                    <p className="text-dark-400 text-sm mt-1">
                      Get notified when gas prices are low
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" defaultChecked />
                    <div className="w-11 h-6 bg-dark-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>
              </div>
            </div>
          </GlassCard>
        </div>
        
        <div className="lg:col-span-1">
          <GlassCard className="p-6">
            <h3 className="text-xl font-semibold mb-4">Network Settings</h3>
            
            <div className="space-y-4">
              <div className="bg-dark-800/50 rounded-lg p-4">
                <div className="flex justify-between items-center mb-2">
                  <p className="font-medium">Default Network</p>
                  <select className="input-field">
                    <option>Ethereum Mainnet </option>
                    <option>Polygon</option>
                    <option>Arbitrum</option>
                    <option>Optimism</option>
                  </select>
                </div>
              </div>
              
              <div className="bg-dark-800/50 rounded-lg p-4">
                <div className="flex justify-between items-center mb-2">
                  <p className="font-medium">RPC Provider</p>
                  <select className="input-field">
                    <option>Infura</option>
                    <option>Alchemy</option>
                    <option>Custom</option>
                  </select>
                </div>
              </div>
              
              <div className="bg-dark-800/50 rounded-lg p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-medium">Auto Network Switch</h4>
                    <p className="text-dark-400 text-sm mt-1">
                      Automatically switch networks when needed
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" defaultChecked />
                    <div className="w-11 h-6 bg-dark-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>
              </div>
            </div>
          </GlassCard>
          
          <GlassCard className="p-6 mt-6">
            <h3 className="text-xl font-semibold mb-4">Display Settings</h3>
            
            <div className="space-y-4">
              <div className="bg-dark-800/50 rounded-lg p-4">
                <div className="flex justify-between items-center mb-2">
                  <p className="font-medium">Currency</p>
                  <select className="input-field">
                    <option>USD ($)</option>
                    <option>EUR (€)</option>
                    <option>GBP (£)</option>
                    <option>JPY (¥)</option>
                  </select>
                </div>
              </div>
              
              <div className="bg-dark-800/50 rounded-lg p-4">
                <div className="flex justify-between items-center mb-2">
                  <p className="font-medium">Language</p>
                  <select className="input-field">
                    <option>English</option>
                    <option>Spanish</option>
                    <option>French</option>
                    <option>German</option>
                  </select>
                </div>
              </div>
              
              <div className="bg-dark-800/50 rounded-lg p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-medium">Show Balance</h4>
                    <p className="text-dark-400 text-sm mt-1">
                      Display wallet balance in header
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" defaultChecked />
                    <div className="w-11 h-6 bg-dark-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>
              </div>
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
};

export default SettingsTab;