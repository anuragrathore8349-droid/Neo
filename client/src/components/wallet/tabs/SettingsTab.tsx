import React, { useState } from 'react';
import { Settings, Trash2 } from 'lucide-react';
import GlassCard from '../../common/GlassCard';
import { toast } from 'react-toastify';

interface ConnectedWallet {
  _id: string;
  name: string;
  type: 'exchange' | 'defi' | 'external';
  provider: string;
  address: string;
  network: string;
}

interface SettingsTabProps {
  wallets?: ConnectedWallet[];
  onUpdate?: () => Promise<void>;
  onRemove?: (walletId: string) => Promise<void>;
}

const SettingsTab: React.FC<SettingsTabProps> = ({ wallets = [], onUpdate, onRemove }) => {
  const [defaultNetwork, setDefaultNetwork] = useState(() => localStorage.getItem('wallet_network') || 'ethereum');
  const [rpcProvider, setRpcProvider] = useState(() => localStorage.getItem('wallet_rpc') || 'infura');
  const [currency, setCurrency] = useState(() => localStorage.getItem('wallet_currency') || 'USD');
  const [showBalance, setShowBalance] = useState(() => localStorage.getItem('wallet_show_balance') !== 'false');
  const [autoSwitch, setAutoSwitch] = useState(() => localStorage.getItem('wallet_auto_switch') !== 'false');
  const [advancedGas, setAdvancedGas] = useState(() => localStorage.getItem('wallet_advanced_gas') === 'true');
  const [gasAlerts, setGasAlerts] = useState(() => localStorage.getItem('wallet_gas_alerts') !== 'false');
  const [isSaving, setIsSaving] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const saveSettings = () => {
    setIsSaving(true);
    localStorage.setItem('wallet_network', defaultNetwork);
    localStorage.setItem('wallet_rpc', rpcProvider);
    localStorage.setItem('wallet_currency', currency);
    localStorage.setItem('wallet_show_balance', String(showBalance));
    localStorage.setItem('wallet_auto_switch', String(autoSwitch));
    localStorage.setItem('wallet_advanced_gas', String(advancedGas));
    localStorage.setItem('wallet_gas_alerts', String(gasAlerts));
    setTimeout(() => {
      setIsSaving(false);
      toast.success('Wallet settings saved');
    }, 400);
  };

  const handleRemoveWallet = async (walletId: string) => {
    if (!window.confirm('Remove this wallet? This action cannot be undone.')) return;
    setRemovingId(walletId);
    try {
      await onRemove?.(walletId);
      toast.success('Wallet removed');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to remove wallet');
    } finally {
      setRemovingId(null);
    }
  };

  const Toggle: React.FC<{ checked: boolean; onChange: (v: boolean) => void }> = ({ checked, onChange }) => (
    <label className="relative inline-flex items-center cursor-pointer">
      <input type="checkbox" className="sr-only peer" checked={checked} onChange={e => onChange(e.target.checked)} />
      <div className="w-11 h-6 bg-dark-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
    </label>
  );

  return (
    <div className="pt-6 space-y-6">
      {/* Wallet Management */}
      {wallets && wallets.length > 0 && (
        <GlassCard className="p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Settings size={20} />
            Connected Wallets
          </h3>
          <div className="space-y-3">
            {wallets.map(w => (
              <div key={w._id} className="bg-dark-800/50 rounded-lg p-4 border border-dark-700 flex items-center justify-between">
                <div>
                  <p className="font-medium">{w.name || w.provider}</p>
                  <p className="text-dark-400 text-sm font-mono">
                    {w.address.substring(0, 6)}...{w.address.substring(w.address.length - 4)}
                  </p>
                </div>
                <button
                  onClick={() => handleRemoveWallet(w._id)}
                  disabled={removingId === w._id}
                  className="p-2 hover:bg-red-500/10 rounded-lg text-red-400 hover:text-red-300 disabled:opacity-50"
                  title="Remove wallet"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* General Settings */}
        <div className="lg:col-span-2">
          <GlassCard className="p-6">
            <h3 className="text-lg font-semibold mb-6">General Settings</h3>
            <div className="space-y-6">

              {/* Default Network */}
              <div className="bg-dark-800/50 rounded-lg p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-medium">Default Network</h4>
                    <p className="text-dark-400 text-sm mt-1">Set your default blockchain network</p>
                  </div>
                  <select
                    value={defaultNetwork}
                    onChange={e => setDefaultNetwork(e.target.value)}
                    className="bg-dark-700 border border-dark-600 rounded px-2 py-1 text-white text-sm"
                  >
                    <option value="ethereum">Ethereum Mainnet</option>
                    <option value="polygon">Polygon</option>
                    <option value="arbitrum">Arbitrum</option>
                    <option value="optimism">Optimism</option>
                    <option value="base">Base</option>
                  </select>
                </div>
              </div>

              {/* RPC Provider */}
              <div className="bg-dark-800/50 rounded-lg p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-medium">RPC Provider</h4>
                    <p className="text-dark-400 text-sm mt-1">Choose which RPC provider to use</p>
                  </div>
                  <select
                    value={rpcProvider}
                    onChange={e => setRpcProvider(e.target.value)}
                    className="bg-dark-700 border border-dark-600 rounded px-2 py-1 text-white text-sm"
                  >
                    <option value="infura">Infura</option>
                    <option value="alchemy">Alchemy</option>
                    <option value="pokt">Pocket Network</option>
                  </select>
                </div>
              </div>

              {/* Currency Display */}
              <div className="bg-dark-800/50 rounded-lg p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-medium">Display Currency</h4>
                    <p className="text-dark-400 text-sm mt-1">Select currency for price display</p>
                  </div>
                  <select
                    value={currency}
                    onChange={e => setCurrency(e.target.value)}
                    className="bg-dark-700 border border-dark-600 rounded px-2 py-1 text-white text-sm"
                  >
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="GBP">GBP (£)</option>
                    <option value="JPY">JPY (¥)</option>
                  </select>
                </div>
              </div>

              {/* Auto Network Switch */}
              <div className="bg-dark-800/50 rounded-lg p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-medium">Auto Network Switch</h4>
                    <p className="text-dark-400 text-sm mt-1">Automatically switch networks when needed</p>
                  </div>
                  <Toggle checked={autoSwitch} onChange={setAutoSwitch} />
                </div>
              </div>

              {/* Show Balance */}
              <div className="bg-dark-800/50 rounded-lg p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-medium">Show Balance</h4>
                    <p className="text-dark-400 text-sm mt-1">Display wallet balance publicly</p>
                  </div>
                  <Toggle checked={showBalance} onChange={setShowBalance} />
                </div>
              </div>

              {/* Advanced Gas Controls */}
              <div className="bg-dark-800/50 rounded-lg p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-medium">Advanced Gas Controls</h4>
                    <p className="text-dark-400 text-sm mt-1">Enable manual gas limit and price adjustment</p>
                  </div>
                  <Toggle checked={advancedGas} onChange={setAdvancedGas} />
                </div>
              </div>

              {/* Gas Price Alerts */}
              <div className="bg-dark-800/50 rounded-lg p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-medium">Gas Price Alerts</h4>
                    <p className="text-dark-400 text-sm mt-1">Get notified when gas prices are low</p>
                  </div>
                  <Toggle checked={gasAlerts} onChange={setGasAlerts} />
                </div>
              </div>

              <button
                onClick={saveSettings}
                disabled={isSaving}
                className="btn-primary w-full py-2 disabled:opacity-50"
              >
                {isSaving ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </GlassCard>
        </div>

        {/* Info Panel */}
        <div>
          <GlassCard className="p-6 bg-blue-500/10 border-blue-500/20 sticky top-6">
            <p className="font-semibold text-white mb-4">💡 Wallet Tips</p>
            <ul className="space-y-3 text-sm text-dark-400">
              <li>• Gas prices vary by network and time</li>
              <li>• Enable 2FA for extra security</li>
              <li>• Keep your seed phrase safe</li>
              <li>• Always verify recipient addresses</li>
              <li>• Use hardware wallets for large amounts</li>
              <li>• Monitor gas prices before transactions</li>
            </ul>
          </GlassCard>
        </div>
      </div>
    </div>
  );
};

export default SettingsTab;
