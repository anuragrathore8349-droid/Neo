import React, { useState } from 'react';
import GlassCard from '../../common/GlassCard';
import { toast } from 'react-toastify';

interface SettingsTabProps {
  gasPrice: { slow: number; medium: number; fast: number };
  selectedGasPrice: string;
  onGasPriceChange: (value: string) => void;
}

const SettingsTab: React.FC<SettingsTabProps> = ({ gasPrice, selectedGasPrice, onGasPriceChange }) => {
  const [defaultNetwork, setDefaultNetwork] = useState(() => localStorage.getItem('wallet_network') || 'ethereum');
  const [rpcProvider, setRpcProvider]       = useState(() => localStorage.getItem('wallet_rpc') || 'infura');
  const [currency, setCurrency]             = useState(() => localStorage.getItem('wallet_currency') || 'USD');
  const [language, setLanguage]             = useState(() => localStorage.getItem('wallet_language') || 'en');
  const [showBalance, setShowBalance]       = useState(() => localStorage.getItem('wallet_show_balance') !== 'false');
  const [autoSwitch, setAutoSwitch]         = useState(() => localStorage.getItem('wallet_auto_switch') !== 'false');
  const [advancedGas, setAdvancedGas]       = useState(() => localStorage.getItem('wallet_advanced_gas') === 'true');
  const [gasAlerts, setGasAlerts]           = useState(() => localStorage.getItem('wallet_gas_alerts') !== 'false');
  const [isSaving, setIsSaving]             = useState(false);

  const saveSettings = () => {
    setIsSaving(true);
    localStorage.setItem('wallet_network', defaultNetwork);
    localStorage.setItem('wallet_rpc', rpcProvider);
    localStorage.setItem('wallet_currency', currency);
    localStorage.setItem('wallet_language', language);
    localStorage.setItem('wallet_show_balance', String(showBalance));
    localStorage.setItem('wallet_auto_switch', String(autoSwitch));
    localStorage.setItem('wallet_advanced_gas', String(advancedGas));
    localStorage.setItem('wallet_gas_alerts', String(gasAlerts));
    setTimeout(() => {
      setIsSaving(false);
      toast.success('Wallet settings saved');
    }, 400);
  };

  const Toggle: React.FC<{ checked: boolean; onChange: (v: boolean) => void }> = ({ checked, onChange }) => (
    <label className="relative inline-flex items-center cursor-pointer">
      <input type="checkbox" className="sr-only peer" checked={checked} onChange={e => onChange(e.target.checked)} />
      <div className="w-11 h-6 bg-dark-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
    </label>
  );

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
                    <p className="text-dark-400 text-sm mt-1">Choose your preferred gas price setting</p>
                  </div>
                  <select className="input-field" value={selectedGasPrice} onChange={e => onGasPriceChange(e.target.value)}>
                    <option value="slow">Slow ({gasPrice.slow} Gwei)</option>
                    <option value="medium">Medium ({gasPrice.medium} Gwei)</option>
                    <option value="fast">Fast ({gasPrice.fast} Gwei)</option>
                  </select>
                </div>
                <div className="space-y-3">
                  {[
                    { label: 'Slow', gwei: gasPrice.slow, color: 'bg-secondary', width: 'w-1/3', time: '~5 min' },
                    { label: 'Medium', gwei: gasPrice.medium, color: 'bg-primary', width: 'w-1/2', time: '~3 min' },
                    { label: 'Fast', gwei: gasPrice.fast, color: 'bg-red-500', width: 'w-3/4', time: '<1 min' },
                  ].map(row => (
                    <div key={row.label}>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm">{row.label}</span>
                        <span className="text-sm font-medium">{row.gwei} Gwei</span>
                      </div>
                      <div className="h-1.5 w-full bg-dark-700 rounded-full">
                        <div className={`h-full ${row.width} ${row.color} rounded-full`}></div>
                      </div>
                      <p className="text-xs text-dark-400 mt-1">{row.time}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-dark-800/50 rounded-lg p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-medium">Advanced Gas Controls</h4>
                    <p className="text-dark-400 text-sm mt-1">Enable manual gas limit and price adjustment</p>
                  </div>
                  <Toggle checked={advancedGas} onChange={setAdvancedGas} />
                </div>
              </div>
              <div className="bg-dark-800/50 rounded-lg p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-medium">Gas Price Alerts</h4>
                    <p className="text-dark-400 text-sm mt-1">Get notified when gas prices are low</p>
                  </div>
                  <Toggle checked={gasAlerts} onChange={setGasAlerts} />
                </div>
              </div>
            </div>
          </GlassCard>
        </div>

        <div className="lg:col-span-1 space-y-6">
          <GlassCard className="p-6">
            <h3 className="text-xl font-semibold mb-4">Network Settings</h3>
            <div className="space-y-4">
              <div className="bg-dark-800/50 rounded-lg p-4">
                <div className="flex justify-between items-center mb-2">
                  <p className="font-medium">Default Network</p>
                  <select className="input-field" value={defaultNetwork} onChange={e => setDefaultNetwork(e.target.value)}>
                    <option value="ethereum">Ethereum Mainnet</option>
                    <option value="polygon">Polygon</option>
                    <option value="arbitrum">Arbitrum</option>
                    <option value="optimism">Optimism</option>
                  </select>
                </div>
              </div>
              <div className="bg-dark-800/50 rounded-lg p-4">
                <div className="flex justify-between items-center mb-2">
                  <p className="font-medium">RPC Provider</p>
                  <select className="input-field" value={rpcProvider} onChange={e => setRpcProvider(e.target.value)}>
                    <option value="infura">Infura</option>
                    <option value="alchemy">Alchemy</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>
              </div>
              <div className="bg-dark-800/50 rounded-lg p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-medium">Auto Network Switch</h4>
                    <p className="text-dark-400 text-sm mt-1">Automatically switch networks when needed</p>
                  </div>
                  <Toggle checked={autoSwitch} onChange={setAutoSwitch} />
                </div>
              </div>
            </div>
          </GlassCard>

          <GlassCard className="p-6">
            <h3 className="text-xl font-semibold mb-4">Display Settings</h3>
            <div className="space-y-4">
              <div className="bg-dark-800/50 rounded-lg p-4">
                <div className="flex justify-between items-center mb-2">
                  <p className="font-medium">Currency</p>
                  <select className="input-field" value={currency} onChange={e => setCurrency(e.target.value)}>
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="GBP">GBP (£)</option>
                    <option value="JPY">JPY (¥)</option>
                  </select>
                </div>
              </div>
              <div className="bg-dark-800/50 rounded-lg p-4">
                <div className="flex justify-between items-center mb-2">
                  <p className="font-medium">Language</p>
                  <select className="input-field" value={language} onChange={e => setLanguage(e.target.value)}>
                    <option value="en">English</option>
                    <option value="es">Spanish</option>
                    <option value="fr">French</option>
                    <option value="de">German</option>
                  </select>
                </div>
              </div>
              <div className="bg-dark-800/50 rounded-lg p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-medium">Show Balance</h4>
                    <p className="text-dark-400 text-sm mt-1">Display wallet balance in header</p>
                  </div>
                  <Toggle checked={showBalance} onChange={setShowBalance} />
                </div>
              </div>
            </div>
          </GlassCard>
        </div>
      </div>

      {/* Save Button */}
      <div className="mt-6 flex justify-end">
        <button
          onClick={saveSettings}
          disabled={isSaving}
          className="btn-primary px-8 py-2.5 disabled:opacity-60"
        >
          {isSaving ? 'Saving…' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
};

export default SettingsTab;
