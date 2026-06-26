// client/src/components/settings/ApiSettings/index.tsx
import React, { useState, useEffect } from 'react';
import { Key, Copy, Eye, EyeOff, CheckCircle, Trash2, Plus, Loader } from 'lucide-react';
import SettingsCard from '../../common/SettingsCard';
import { useAuth } from '../../../context/AuthContext';
import { apiFetch } from '../../../services/api';

interface ApiKey {
  _id: string;
  label: string;
  exchange: string;
  apiKey: string;
  isActive: boolean;
  createdAt: string;
}

const EXCHANGES = ['binance', 'coinbase', 'kraken', 'bybit', 'okx', 'other'];

const ApiSettings = () => {
  const { user } = useAuth();
  const [keys, setKeys]           = useState<ApiKey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [visibleKey, setVisibleKey] = useState<string | null>(null);
  const [showToast, setShowToast] = useState(false);
  const [error, setError]         = useState('');

  // Create form
  const [form, setForm] = useState({ label: '', exchange: 'binance', apiKey: '', secret: '' });
  const [isCreating, setIsCreating] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Delete state
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const res = await apiFetch<any>('/api/user/api-keys');
        setKeys(res?.data || []);
      } catch (e: any) {
        setError(e?.message || 'Failed to load API keys');
      } finally {
        setIsLoading(false);
      }
    })();
  }, [user]);

  const copyToClipboard = (val: string) => {
    navigator.clipboard.writeText(val);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  const handleCreate = async () => {
    if (!form.label || !form.apiKey || !form.secret) {
      setError('Please fill in all fields');
      return;
    }
    setIsCreating(true);
    setError('');
    try {
      const res = await apiFetch<any>('/api/user/api-keys', {
        method: 'POST',
        body: {
          label:    form.label,
          exchange: form.exchange,
          apiKey:   form.apiKey,
          secret:   form.secret,
        },
      });
      // Refresh list
      const listRes = await apiFetch<any>('/api/user/api-keys');
      setKeys(listRes?.data || []);
      setForm({ label: '', exchange: 'binance', apiKey: '', secret: '' });
      setShowCreateForm(false);
    } catch (e: any) {
      setError(e?.message || 'Failed to create API key');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleting(id);
    try {
      await apiFetch(`/api/user/api-keys/${id}`, { method: 'DELETE' });
      setKeys(prev => prev.filter(k => k._id !== id));
    } catch (e: any) {
      setError(e?.message || 'Failed to delete key');
    } finally {
      setDeleting(null);
    }
  };

  if (isLoading) {
    return (
      <SettingsCard title="API Access" description="Loading…">
        <div className="flex items-center gap-2 text-slate-400">
          <Loader className="w-4 h-4 animate-spin" /> Loading…
        </div>
      </SettingsCard>
    );
  }

  return (
    <SettingsCard title="API Access" description="Manage exchange API keys for trading integrations">
      <div className="space-y-6 relative">

        {/* Toast */}
        {showToast && (
          <div className="absolute top-0 right-0 -mt-12 flex items-center gap-2 bg-[#22DFBF]/20 text-[#22DFBF] px-4 py-2 rounded-lg border border-[#22DFBF]/30">
            <CheckCircle className="w-4 h-4" />
            <span className="text-sm">Copied to clipboard</span>
          </div>
        )}

        {error && (
          <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2">{error}</p>
        )}

        {/* Key List */}
        {keys.length === 0 && !showCreateForm && (
          <p className="text-slate-400 text-sm text-center py-4">
            No API keys yet. Add one below to connect an exchange.
          </p>
        )}

        {keys.map((k) => (
          <div key={k._id} className="p-4 bg-slate-800/30 rounded-lg border border-slate-700 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Key className="w-5 h-5 text-[#22DFBF]" />
                <span className="text-white font-medium">{k.label}</span>
                <span className="text-xs text-slate-500 capitalize bg-slate-700 px-2 py-0.5 rounded">{k.exchange}</span>
                {k.isActive && <span className="text-xs text-green-400 bg-green-500/10 px-2 py-0.5 rounded">Active</span>}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setVisibleKey(visibleKey === k._id ? null : k._id)}
                  className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors"
                  title={visibleKey === k._id ? 'Hide' : 'Show'}
                >
                  {visibleKey === k._id ? <EyeOff className="w-4 h-4 text-slate-400" /> : <Eye className="w-4 h-4 text-slate-400" />}
                </button>
                <button
                  onClick={() => copyToClipboard(k.apiKey)}
                  className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors"
                  title="Copy API key"
                >
                  <Copy className="w-4 h-4 text-slate-400" />
                </button>
                <button
                  onClick={() => handleDelete(k._id)}
                  disabled={deleting === k._id}
                  className="p-2 hover:bg-red-500/20 rounded-lg transition-colors"
                  title="Delete"
                >
                  {deleting === k._id
                    ? <Loader className="w-4 h-4 animate-spin text-red-400" />
                    : <Trash2 className="w-4 h-4 text-red-400" />}
                </button>
              </div>
            </div>
            <div className="font-mono text-xs bg-slate-900 px-3 py-2 rounded border border-slate-700 text-slate-300 break-all">
              {visibleKey === k._id ? k.apiKey : '•'.repeat(Math.min(k.apiKey?.length || 32, 48))}
            </div>
            <p className="text-xs text-slate-500">Added {new Date(k.createdAt).toLocaleDateString()}</p>
          </div>
        ))}

        {/* Add Key Button / Form */}
        {!showCreateForm ? (
          <button
            onClick={() => setShowCreateForm(true)}
            className="flex items-center gap-2 px-4 py-2 border border-dashed border-slate-600 hover:border-[#3D5AF1] rounded-lg text-slate-400 hover:text-white text-sm transition-colors w-full justify-center"
          >
            <Plus className="w-4 h-4" /> Add Exchange API Key
          </button>
        ) : (
          <div className="p-5 bg-slate-800/40 rounded-xl border border-slate-700 space-y-4">
            <h4 className="text-white font-medium">New API Key</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Label</label>
                <input
                  type="text"
                  placeholder="e.g. My Binance Key"
                  value={form.label}
                  onChange={(e) => setForm({ ...form, label: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#3D5AF1]"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Exchange</label>
                <select
                  value={form.exchange}
                  onChange={(e) => setForm({ ...form, exchange: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#3D5AF1]"
                >
                  {EXCHANGES.map(ex => <option key={ex} value={ex} className="capitalize">{ex}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">API Key</label>
                <input
                  type="text"
                  placeholder="Paste your API key"
                  value={form.apiKey}
                  onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#3D5AF1]"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Secret</label>
                <input
                  type="password"
                  placeholder="Paste your secret"
                  value={form.secret}
                  onChange={(e) => setForm({ ...form, secret: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#3D5AF1]"
                />
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => { setShowCreateForm(false); setError(''); }}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={isCreating}
                className="flex items-center gap-2 px-5 py-2 bg-[#3D5AF1] hover:bg-[#2D4AE1] rounded-lg text-white text-sm font-medium"
              >
                {isCreating && <Loader className="w-4 h-4 animate-spin" />}
                Save Key
              </button>
            </div>
          </div>
        )}
      </div>
    </SettingsCard>
  );
};

export default ApiSettings;