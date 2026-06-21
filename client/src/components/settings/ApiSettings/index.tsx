import React, { useState, useEffect } from 'react';
import { Key, Copy, Eye, EyeOff, CheckCircle, Trash2, Plus } from 'lucide-react';
import SettingsCard from '../../common/SettingsCard';
import { useAuth } from '../../../context/AuthContext';
import * as userService from '../../../services/user.service';

interface ApiKey {
  id: string;
  name: string;
  key: string;
  permissions: string[];
  createdAt: string;
}

const ApiSettings = () => {
  const { user } = useAuth();
  const [showKey, setShowKey] = useState(false);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showToast, setShowToast] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    const fetchApiKeys = async () => {
      if (!user) return;
      try {
        const response = await userService.getApiKeys(localStorage.getItem('neofin_auth') ? JSON.parse(localStorage.getItem('neofin_auth')!).accessToken : '');
        setApiKeys(response.data || []);
      } catch {
        // Handle error
      } finally {
        setIsLoading(false);
      }
    };
    fetchApiKeys();
  }, [user]);

  const copyToClipboard = (key: string) => {
    navigator.clipboard.writeText(key);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  const handleCreateKey = async () => {
    if (!newKeyName.trim()) return;
    setIsCreating(true);
    try {
      const response = await userService.createApiKey(localStorage.getItem('neofin_auth') ? JSON.parse(localStorage.getItem('neofin_auth')!).accessToken : '', {
        name: newKeyName,
        permissions: ['read', 'trade']
      });
      setApiKeys([...apiKeys, response.data]);
      setNewKeyName('');
    } catch {
      // Handle error
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteKey = async (id: string) => {
    try {
      await userService.deleteApiKey(localStorage.getItem('neofin_auth') ? JSON.parse(localStorage.getItem('neofin_auth')!).accessToken : '', id);
      setApiKeys(apiKeys.filter(key => key.id !== id));
    } catch {
      // Handle error
    }
  };

  if (isLoading) return <SettingsCard title="API Access" description="Loading..."><div>Loading...</div></SettingsCard>;

  return (
    <SettingsCard
      title="API Access"
      description="Manage your API keys and access tokens"
    >
      <div className="space-y-6 relative">
        {showToast && (
          <div className="absolute top-0 right-0 -mt-12 flex items-center space-x-2 bg-[#22DFBF]/20 text-[#22DFBF] px-4 py-2 rounded-lg border border-[#22DFBF]/30 animate-fade-in">
            <CheckCircle className="w-4 h-4" />
            <span className="text-sm font-medium">API key copied to clipboard</span>
          </div>
        )}

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-white font-medium">Your API Keys</h4>
            <div className="flex space-x-2">
              <input
                type="text"
                placeholder="New key name"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                className="bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-1 text-white text-sm"
              />
              <button
                onClick={handleCreateKey}
                disabled={isCreating || !newKeyName.trim()}
                className="btn-primary text-sm"
              >
                {isCreating ? 'Creating...' : 'Create Key'}
              </button>
            </div>
          </div>

          {apiKeys.map((apiKey) => (
            <div key={apiKey.id} className="p-4 bg-slate-800/30 rounded-lg border border-slate-700">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <Key className="w-5 h-5 text-[#22DFBF]" />
                  <span className="text-white font-medium">{apiKey.name}</span>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => setShowKey(!showKey)}
                    className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors"
                    aria-label={showKey ? 'Hide API key' : 'Show API key'}
                  >
                    {showKey ? (
                      <EyeOff className="w-5 h-5 text-slate-400" />
                    ) : (
                      <Eye className="w-5 h-5 text-slate-400" />
                    )}
                  </button>
                  <button
                    onClick={() => copyToClipboard(apiKey.key)}
                    className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors"
                    aria-label="Copy API key"
                  >
                    <Copy className="w-5 h-5 text-slate-400" />
                  </button>
                  <button
                    onClick={() => handleDeleteKey(apiKey.id)}
                    className="p-2 hover:bg-red-500/50 rounded-lg transition-colors"
                    aria-label="Delete API key"
                  >
                    <Trash2 className="w-5 h-5 text-red-500" />
                  </button>
                </div>
              </div>
              <div className="font-mono bg-slate-900 p-3 rounded border border-slate-700">
                {showKey ? apiKey.key : '•'.repeat(apiKey.key.length)}
              </div>
              <div className="mt-2 text-sm text-slate-400">
                Created: {new Date(apiKey.createdAt).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-4">
          <h4 className="text-white font-medium">API Documentation</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <a
              href="#"
              className="block p-4 bg-slate-800/30 rounded-lg border border-slate-700 hover:border-[#22DFBF]/30 transition-colors"
            >
              <h5 className="text-[#22DFBF] font-medium mb-2">Quick Start Guide</h5>
              <p className="text-sm text-slate-400">Learn the basics of NeoFin API integration</p>
            </a>
            <a
              href="#"
              className="block p-4 bg-slate-800/30 rounded-lg border border-slate-700 hover:border-[#22DFBF]/30 transition-colors"
            >
              <h5 className="text-[#22DFBF] font-medium mb-2">API Reference</h5>
              <p className="text-sm text-slate-400">Complete documentation of all API endpoints</p>
            </a>
          </div>
        </div>
      </div>
    </SettingsCard>
  );
};

export default ApiSettings;