import React, { useState } from 'react';
import { Shield } from 'lucide-react';
import GlassCard from '../../common/GlassCard';
import { toast } from 'react-toastify';

const SecurityTab: React.FC = () => {
  const [requireSigning, setRequireSigning]   = useState(() => localStorage.getItem('ws_require_signing') !== 'false');
  const [autoLock, setAutoLock]               = useState(() => localStorage.getItem('ws_auto_lock') || '15');
  const [spendingLimit, setSpendingLimit]     = useState(() => localStorage.getItem('ws_spending_limit') || '1000');
  const [whitelistOnly, setWhitelistOnly]     = useState(() => localStorage.getItem('ws_whitelist_only') === 'true');
  const [isSaving, setIsSaving]               = useState(false);

  const saveSettings = () => {
    setIsSaving(true);
    localStorage.setItem('ws_require_signing', String(requireSigning));
    localStorage.setItem('ws_auto_lock', autoLock);
    localStorage.setItem('ws_spending_limit', spendingLimit);
    localStorage.setItem('ws_whitelist_only', String(whitelistOnly));
    setTimeout(() => {
      setIsSaving(false);
      toast.success('Security settings saved');
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
            <h3 className="text-xl font-semibold mb-6">Security Settings</h3>
            <div className="space-y-6">

              <div className="bg-dark-800/50 rounded-lg p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-medium">Transaction Signing</h4>
                    <p className="text-dark-400 text-sm mt-1">Require MetaMask confirmation for all transactions</p>
                  </div>
                  <Toggle checked={requireSigning} onChange={setRequireSigning} />
                </div>
              </div>

              <div className="bg-dark-800/50 rounded-lg p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-medium">Auto-Lock</h4>
                    <p className="text-dark-400 text-sm mt-1">Lock wallet after period of inactivity</p>
                  </div>
                  <select
                    className="input-field"
                    value={autoLock}
                    onChange={e => setAutoLock(e.target.value)}
                  >
                    <option value="5">5 minutes</option>
                    <option value="15">15 minutes</option>
                    <option value="30">30 minutes</option>
                    <option value="60">1 hour</option>
                    <option value="0">Never</option>
                  </select>
                </div>
              </div>

              <div className="bg-dark-800/50 rounded-lg p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-medium">Daily Spending Limit</h4>
                    <p className="text-dark-400 text-sm mt-1">Maximum transaction value per day</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="number"
                      className="input-field w-28"
                      value={spendingLimit}
                      onChange={e => setSpendingLimit(e.target.value)}
                      min="0"
                    />
                    <span className="text-dark-400">USD</span>
                  </div>
                </div>
              </div>

              <div className="bg-dark-800/50 rounded-lg p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-medium">Address Whitelist</h4>
                    <p className="text-dark-400 text-sm mt-1">Only allow transactions to saved address book entries</p>
                  </div>
                  <Toggle checked={whitelistOnly} onChange={setWhitelistOnly} />
                </div>
              </div>
            </div>
          </GlassCard>
        </div>

        <div className="lg:col-span-1">
          <GlassCard className="p-6">
            <div className="flex items-center space-x-3 mb-6">
              <Shield className="w-6 h-6 text-primary" />
              <h3 className="text-xl font-semibold">Security Summary</h3>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-dark-300 text-sm">Transaction Signing</span>
                <span className={`text-xs font-medium px-2 py-1 rounded-full ${requireSigning ? 'bg-green-900/40 text-green-400' : 'bg-red-900/40 text-red-400'}`}>
                  {requireSigning ? 'Required' : 'Disabled'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-dark-300 text-sm">Auto-Lock</span>
                <span className="text-xs font-medium text-primary">
                  {autoLock === '0' ? 'Never' : `${autoLock} min`}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-dark-300 text-sm">Daily Limit</span>
                <span className="text-xs font-medium text-primary">${Number(spendingLimit).toLocaleString()} USD</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-dark-300 text-sm">Whitelist Mode</span>
                <span className={`text-xs font-medium px-2 py-1 rounded-full ${whitelistOnly ? 'bg-green-900/40 text-green-400' : 'bg-dark-600 text-dark-300'}`}>
                  {whitelistOnly ? 'Active' : 'Off'}
                </span>
              </div>
            </div>
          </GlassCard>
        </div>
      </div>

      <div className="mt-6 flex justify-end">
        <button
          onClick={saveSettings}
          disabled={isSaving}
          className="btn-primary px-8 py-2.5 disabled:opacity-60"
        >
          {isSaving ? 'Saving…' : 'Save Security Settings'}
        </button>
      </div>
    </div>
  );
};

export default SecurityTab;
