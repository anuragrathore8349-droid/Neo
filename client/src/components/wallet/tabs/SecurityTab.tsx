import React from 'react';
import { Shield, RefreshCw, Check, X } from 'lucide-react';
import GlassCard from '../../common/GlassCard';

const SecurityTab: React.FC = () => {
  return (
    <div className="pt-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <GlassCard className="p-6">
            <h3 className="text-xl font-semibold mb-6">Security Settings</h3>
            
            <div className="space-y-6">
              <div className="bg-dark-800/50 rounded-lg p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-medium">Transaction Signing</h4>
                    <p className="text-dark-400 text-sm mt-1">
                      Require password confirmation for all transactions
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" defaultChecked />
                    <div className="w-11 h-6 bg-dark-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>
              </div>
              
              <div className="bg-dark-800/50 rounded-lg p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-medium">Auto-Lock</h4>
                    <p className="text-dark-400 text-sm mt-1">
                      Automatically lock wallet after period of inactivity
                    </p>
                  </div>
                  <select className="input-field">
                    <option>5 minutes</option>
                    <option>15 minutes</option>
                    <option>30 minutes</option>
                    <option>1 hour</option>
                    <option>Never</option>
                  </select>
                </div>
              </div>
              
              <div className="bg-dark-800/50 rounded-lg p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-medium">Spending Limits</h4>
                    <p className="text-dark-400 text-sm mt-1">
                      Set daily transaction limits
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="number"
                      className="input-field w-24"
                      defaultValue="1000"
                    />
                    <span className="text-dark-400">USD</span>
                  </div>
                </div>
              </div>
              
              <div className="bg-dark-800/50 rounded-lg p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-medium">Address Whitelist</h4>
                    <p className="text-dark-400 text-sm mt-1">
                      Only allow transactions to whitelisted addresses
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" />
                    <div className="w-11 h-6 bg-dark-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>
              </div>
            </div>
          </GlassCard>
          
          <GlassCard className="p-6 mt-6">
            <h3 className="text-xl font-semibold mb-6">Connected Apps</h3>
            
            <div className="space-y-4">
              <div className="bg-dark-800/50 rounded-lg p-4">
                <div className="flex justify-between items-center">
                  <div className="flex items-center">
                    <div className="bg-primary/20 p-2 rounded-lg mr-3">
                      <img src="https://cryptologos.cc/logos/uniswap-uni-logo.png" alt="Uniswap" className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="font-medium">Uniswap</p>
                      <p className="text-dark-400 text-sm">Connected 2 days ago</p>
                    </div>
                  </div>
                  <button className="text-red-500 hover:text-red-400">Disconnect</button>
                </div>
              </div>
              
              <div className="bg-dark-800/50 rounded-lg p-4">
                <div className="flex justify-between items-center">
                  <div className="flex items-center">
                    <div className="bg-primary/20 p-2 rounded-lg mr-3">
                      <img src="https://cryptologos.cc/logos/aave-aave-logo.png" alt="Aave" className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="font-medium">Aave</p>
                      <p className="text-dark-400 text-sm">Connected 5 days ago</p>
                    </div>
                  </div>
                  <button className="text-red-500 hover:text-red-400">Disconnect</button>
                </div>
              </div>
            </div>
          </GlassCard>
        </div>
        
        <div className="lg:col-span-1">
          <GlassCard className="p-6">
            <h3 className="text-xl font-semibold mb-4">Security Status</h3>
            
            <div className="space-y-4">
              <div className="bg-dark-800/50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-medium">Overall Security</p>
                  <span className="text-secondary">Strong</span>
                </div>
                <div className="h-2 w-full bg-dark-700 rounded-full">
                  <div className="h-full w-4/5 bg-secondary rounded-full"></div>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center">
                  <Check size={16} className="text-secondary mr-2" />
                  <span className="text-sm">Password protection enabled</span>
                </div>
                <div className="flex items-center">
                  <Check size={16} className="text-secondary mr-2" />
                  <span className="text-sm">Auto-lock activated</span>
                </div>
                <div className="flex items-center">
                  <Check size={16} className="text-secondary mr-2" />
                  <span className="text-sm">Transaction signing required</span>
                </div>
                <div className="flex items-center">
                  <X size={16} className="text-red-500 mr-2" />
                  <span className="text-sm">Address whitelist disabled</span>
                </div>
              </div>
            </div>
          </GlassCard>
          
          <GlassCard className="p-6 mt-6">
            <h3 className="text-xl font-semibold mb-4">Backup & Recovery</h3>
            
            <div className="space-y-4">
              <button className="w-full p-3 bg-dark-800/50 rounded-lg hover:bg-dark-800 transition-all text-left">
                <div className="flex items-center">
                  <div className="bg-primary/20 p-2 rounded-lg mr-3">
                    <Shield size={18} className="text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">Backup Wallet</p>
                    <p className="text-dark-400 text-sm">Export recovery phrase</p>
                  </div>
                </div>
              </button>
              
              <button className="w-full p-3 bg-dark-800/50 rounded-lg hover:bg-dark-800 transition-all text-left">
                <div className="flex items-center">
                  <div className="bg-secondary/20 p-2 rounded-lg mr-3">
                    <RefreshCw size={18} className="text-secondary" />
                  </div>
                  <div>
                    <p className="font-medium">Reset Wallet</p>
                    <p className="text-dark-400 text-sm">Clear all data</p>
                  </div>
                </div>
              </button>
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
};

export default SecurityTab;