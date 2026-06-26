// client/src/components/trading/ApiKeyManager.tsx
import React, { useState, useEffect, useCallback } from 'react';
import GlassCard from '../common/GlassCard';
import { Plus, Trash2, CheckCircle, AlertCircle, Loader, Eye, EyeOff, Key } from 'lucide-react';
import * as tradingApi from '../../services/trading.service';

interface ApiKey {
  _id: string;
  exchange: string;
  label: string;
  isActive: boolean;
  createdAt: string;
}

const SUPPORTED_EXCHANGES = ['binance','coinbase','kraken','bybit','okx','kucoin'];

const ApiKeyManager: React.FC = () => {
  const [keys,         setKeys]         = useState<ApiKey[]>([]);
  const [loading,      setLoading]      = useState(false);
  const [showForm,     setShowForm]     = useState(false);
  const [testingId,    setTestingId]    = useState<string | null>(null);
  const [deletingId,   setDeletingId]   = useState<string | null>(null);
  const [error,        setError]        = useState<string | null>(null);
  const [success,      setSuccess]      = useState<string | null>(null);
  const [showSecret,   setShowSecret]   = useState(false);

  // Form
  const [exchange,    setExchange]    = useState('binance');
  const [apiKey,      setApiKey]      = useState('');
  const [apiSecret,   setApiSecret]   = useState('');
  const [passphrase,  setPassphrase]  = useState('');
  const [label,       setLabel]       = useState('');
  const [submitting,  setSubmitting]  = useState(false);

  const fetchKeys = useCallback(async () => {
    setLoading(true);
    try {
      const r: any = await tradingApi.getApiKeys();
      setKeys(r.data || []);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchKeys(); }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey || !apiSecret) { setError('API Key and Secret are required'); return; }
    setSubmitting(true);
    setError(null);
    try {
      await tradingApi.addApiKey({ exchange, apiKey, apiSecret, passphrase, label: label || exchange });
      setShowForm(false);
      setApiKey(''); setApiSecret(''); setPassphrase(''); setLabel('');
      setSuccess('API key added successfully');
      setTimeout(() => setSuccess(null), 3000);
      await fetchKeys();
    } catch (e: any) {
      setError(e?.message || 'Failed to add API key');
    } finally { setSubmitting(false); }
  };

  const handleTest = async (id: string) => {
    setTestingId(id);
    setError(null);
    try {
      await tradingApi.testApiKey(id);
      setSuccess('API key is valid!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (e: any) {
      setError(e?.message || 'Key test failed');
    } finally { setTestingId(null); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this API key?')) return;
    setDeletingId(id);
    try {
      await tradingApi.deleteApiKey(id);
      setKeys(prev => prev.filter(k => k._id !== id));
    } catch (e: any) {
      setError(e?.message || 'Failed to delete');
    } finally { setDeletingId(null); }
  };

  return (
    <div className="space-y-4">
      <GlassCard className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-base flex items-center gap-2">
              <Key size={16} className="text-primary" /> Exchange API Keys
            </h3>
            <p className="text-xs text-dark-400 mt-0.5">Add your exchange API keys to enable live trading</p>
          </div>
          <button onClick={() => setShowForm(v => !v)} className="btn-primary text-sm px-3 py-1.5 flex items-center gap-1.5">
            <Plus size={14} /> Add Key
          </button>
        </div>

        {error   && <div className="mb-3 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm flex gap-2"><AlertCircle size={14} />{error}</div>}
        {success && <div className="mb-3 p-3 bg-green-500/10 border border-green-500/30 rounded-lg text-green-400 text-sm flex gap-2"><CheckCircle size={14} />{success}</div>}

        {showForm && (
          <form onSubmit={handleAdd} className="mb-4 p-4 bg-dark-800 rounded-xl border border-dark-700 space-y-3">
            <h4 className="text-sm font-medium mb-2">Add Exchange API Key</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-dark-400 mb-1">Exchange</label>
                <select
                  value={exchange}
                  onChange={e => setExchange(e.target.value)}
                  className="w-full bg-dark-900 border border-dark-600 rounded-lg px-3 py-2 text-sm text-light focus:outline-none focus:border-primary"
                >
                  {SUPPORTED_EXCHANGES.map(ex => <option key={ex} value={ex}>{ex.charAt(0).toUpperCase() + ex.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-dark-400 mb-1">Label (optional)</label>
                <input
                  type="text" value={label} onChange={e => setLabel(e.target.value)}
                  placeholder="My Binance Key"
                  className="w-full bg-dark-900 border border-dark-600 rounded-lg px-3 py-2 text-sm text-light focus:outline-none focus:border-primary"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-dark-400 mb-1">API Key</label>
              <input
                type="text" value={apiKey} onChange={e => setApiKey(e.target.value)} required
                placeholder="Paste your API key"
                className="w-full bg-dark-900 border border-dark-600 rounded-lg px-3 py-2 text-sm text-light focus:outline-none focus:border-primary font-mono"
              />
            </div>
            <div>
              <label className="block text-xs text-dark-400 mb-1">API Secret</label>
              <div className="relative">
                <input
                  type={showSecret ? 'text' : 'password'} value={apiSecret} onChange={e => setApiSecret(e.target.value)} required
                  placeholder="Paste your API secret"
                  className="w-full bg-dark-900 border border-dark-600 rounded-lg px-3 py-2 pr-10 text-sm text-light focus:outline-none focus:border-primary font-mono"
                />
                <button type="button" onClick={() => setShowSecret(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-400 hover:text-light">
                  {showSecret ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
            {(exchange === 'coinbase' || exchange === 'okx' || exchange === 'kucoin') && (
              <div>
                <label className="block text-xs text-dark-400 mb-1">Passphrase</label>
                <input
                  type="password" value={passphrase} onChange={e => setPassphrase(e.target.value)}
                  placeholder="Required for this exchange"
                  className="w-full bg-dark-900 border border-dark-600 rounded-lg px-3 py-2 text-sm text-light focus:outline-none focus:border-primary"
                />
              </div>
            )}
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-xs text-amber-400">
              ⚠️ Only add keys with <strong>trading permissions</strong>. Never enable withdrawal permissions.
            </div>
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setShowForm(false)} className="btn-outline text-sm px-3 py-1.5">Cancel</button>
              <button type="submit" disabled={submitting} className="btn-primary text-sm px-3 py-1.5 flex items-center gap-1.5">
                {submitting ? <Loader size={14} className="animate-spin" /> : <Plus size={14} />}
                {submitting ? 'Adding…' : 'Add Key'}
              </button>
            </div>
          </form>
        )}

        {loading ? (
          <div className="flex items-center gap-2 py-8 justify-center text-dark-400"><Loader size={16} className="animate-spin" /> Loading…</div>
        ) : keys.length === 0 ? (
          <div className="text-center py-10 text-dark-400">
            <Key size={32} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">No API keys added yet</p>
            <p className="text-xs mt-1">Add exchange API keys to enable live trading</p>
          </div>
        ) : (
          <div className="space-y-2">
            {keys.map(key => (
              <div key={key._id} className="flex items-center justify-between p-3 bg-dark-800 rounded-lg border border-dark-700">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-light capitalize">{key.exchange}</span>
                    <span className="text-xs text-dark-500">•</span>
                    <span className="text-xs text-dark-400">{key.label}</span>
                    {key.isActive && <span className="px-1.5 py-0.5 bg-green-500/15 text-green-400 text-xs rounded">Active</span>}
                  </div>
                  <p className="text-xs text-dark-500 mt-0.5">Added {new Date(key.createdAt).toLocaleDateString()}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleTest(key._id)}
                    disabled={testingId === key._id}
                    className="px-2.5 py-1 text-xs rounded-md bg-dark-700 text-dark-300 hover:text-light hover:bg-dark-600 transition-all flex items-center gap-1"
                  >
                    {testingId === key._id ? <Loader size={11} className="animate-spin" /> : <CheckCircle size={11} />}
                    Test
                  </button>
                  <button
                    onClick={() => handleDelete(key._id)}
                    disabled={deletingId === key._id}
                    className="p-1.5 rounded-md text-dark-400 hover:text-red-400 hover:bg-red-500/10 transition-all"
                  >
                    {deletingId === key._id ? <Loader size={13} className="animate-spin" /> : <Trash2 size={13} />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </GlassCard>

      <GlassCard className="p-4">
        <h4 className="font-medium text-sm mb-2">Live Trading Setup Guide</h4>
        <ol className="text-xs text-dark-400 space-y-1.5 list-decimal list-inside">
          <li>Go to your exchange (Binance, Coinbase, etc.) and create an API key</li>
          <li>Enable <strong className="text-light">Spot Trading</strong> permission only. Do NOT enable withdrawals.</li>
          <li>Restrict the key to your server's IP for security</li>
          <li>Paste the key above and click Test to verify</li>
          <li>Switch to <strong className="text-light">Live Mode</strong> in the Trading tab header to trade for real</li>
        </ol>
      </GlassCard>
    </div>
  );
};

export default ApiKeyManager;