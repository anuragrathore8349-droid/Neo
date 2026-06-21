import React, { useState, useEffect, useCallback } from 'react';
import { Bell, BellOff, Plus, Trash2, Loader, AlertCircle } from 'lucide-react';
import GlassCard from '../common/GlassCard';
import * as marketApi from '../../services/market.service';
import { Asset } from '../../types';

interface PriceAlertsProps {
  assets: Asset[];
}

const PriceAlerts: React.FC<PriceAlertsProps> = ({ assets }) => {
  const [alerts, setAlerts] = useState<marketApi.PriceAlert[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [symbol, setSymbol] = useState('BTC');
  const [alertType, setAlertType] = useState<'above' | 'below'>('above');
  const [price, setPrice] = useState('');
  const [notifTypes, setNotifTypes] = useState<string[]>(['email']);

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await marketApi.getPriceAlerts();
      setAlerts(response.data || []);
    } catch (err: any) {
      setError('Failed to load alerts.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAlerts();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedPrice = parseFloat(price);
    if (!symbol || !parsedPrice || parsedPrice <= 0) {
      setError('Please enter a valid symbol and price.');
      return;
    }
    setCreating(true);
    setError(null);
    try {
      await marketApi.createPriceAlert({
        symbol,
        type: alertType,
        price: parsedPrice,
        notificationTypes: notifTypes,
      });
      setPrice('');
      setShowForm(false);
      await fetchAlerts();
    } catch (err: any) {
      setError(err?.message || 'Failed to create alert.');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (alertId: string) => {
    setDeletingId(alertId);
    try {
      await marketApi.deletePriceAlert(alertId);
      setAlerts(prev => prev.filter(a => a._id !== alertId));
    } catch (err: any) {
      setError('Failed to delete alert.');
    } finally {
      setDeletingId(null);
    }
  };

  const currentPrice = assets.find(a => a.symbol === symbol)?.price;

  return (
    <GlassCard className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-2">
          <Bell size={20} className="text-primary" />
          <h3 className="text-xl font-semibold">Price Alerts</h3>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-all"
        >
          <Plus size={16} />
          New Alert
        </button>
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {/* Create Alert Form */}
      {showForm && (
        <form onSubmit={handleCreate} className="mb-6 p-4 bg-dark-800/50 rounded-lg border border-dark-700 space-y-4">
          <h4 className="font-medium text-sm text-dark-400 uppercase tracking-wide">Create Alert</h4>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-dark-400 mb-1">Asset</label>
              <select
                value={symbol}
                onChange={e => setSymbol(e.target.value)}
                className="w-full px-3 py-2 bg-dark-800 border border-dark-700 rounded-lg text-light text-sm"
              >
                {assets.map(a => (
                  <option key={a.id} value={a.symbol}>{a.symbol} — {a.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-dark-400 mb-1">Condition</label>
              <div className="flex">
                <button
                  type="button"
                  onClick={() => setAlertType('above')}
                  className={`flex-1 py-2 rounded-l-lg text-sm font-medium transition-all ${alertType === 'above' ? 'bg-secondary text-dark-900' : 'bg-dark-800 text-dark-400'}`}
                >
                  Above
                </button>
                <button
                  type="button"
                  onClick={() => setAlertType('below')}
                  className={`flex-1 py-2 rounded-r-lg text-sm font-medium transition-all ${alertType === 'below' ? 'bg-red-500 text-white' : 'bg-dark-800 text-dark-400'}`}
                >
                  Below
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs text-dark-400 mb-1">
                Price (USD)
                {currentPrice && (
                  <span className="ml-2 text-primary">Current: ${currentPrice.toFixed(2)}</span>
                )}
              </label>
              <input
                type="number"
                step="any"
                min="0"
                value={price}
                onChange={e => setPrice(e.target.value)}
                placeholder="e.g. 50000"
                className="w-full px-3 py-2 bg-dark-800 border border-dark-700 rounded-lg text-light text-sm"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-dark-400 mb-2">Notify via</label>
            <div className="flex gap-3">
              {['email', 'push', 'sms'].map(t => (
                <label key={t} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notifTypes.includes(t)}
                    onChange={e => {
                      if (e.target.checked) setNotifTypes(prev => [...prev, t]);
                      else setNotifTypes(prev => prev.filter(x => x !== t));
                    }}
                    className="accent-primary"
                  />
                  <span className="text-sm capitalize text-light">{t}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={creating}
              className="px-6 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
            >
              {creating ? 'Creating...' : 'Create Alert'}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-6 py-2 bg-dark-800 text-light rounded-lg text-sm hover:bg-dark-700"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Alert list */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader size={24} className="animate-spin text-primary" />
        </div>
      ) : alerts.length === 0 ? (
        <div className="text-center py-12">
          <BellOff size={36} className="mx-auto text-dark-400 mb-3" />
          <p className="text-dark-400 font-medium">No active alerts</p>
          <p className="text-dark-500 text-sm mt-1">Create an alert to get notified when prices move</p>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map(alert => {
            const asset = assets.find(a => a.symbol === alert.symbol);
            const currentP = asset?.price ?? 0;
            const diff = currentP > 0
              ? ((alert.targetPrice - currentP) / currentP * 100).toFixed(2)
              : null;

            return (
              <div
                key={alert._id}
                className="flex items-center justify-between p-4 bg-dark-800/50 rounded-lg border border-dark-700"
              >
                <div className="flex items-center gap-4">
                  <div className={`p-2 rounded-lg ${alert.condition === 'above' ? 'bg-secondary/20' : 'bg-red-500/20'}`}>
                    <Bell size={16} className={alert.condition === 'above' ? 'text-secondary' : 'text-red-400'} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{alert.symbol}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${alert.condition === 'above' ? 'bg-secondary/20 text-secondary' : 'bg-red-500/20 text-red-400'}`}>
                        {alert.condition === 'above' ? '↑ Above' : '↓ Below'}
                      </span>
                    </div>
                    <div className="text-sm text-dark-400 mt-0.5">
                      Target: <span className="text-light font-medium">${alert.targetPrice.toLocaleString()}</span>
                      {currentP > 0 && diff !== null && (
                        <span className="ml-2 text-xs">
                          ({parseFloat(diff) >= 0 ? '+' : ''}{diff}% away)
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-dark-500 mt-0.5">
                      Notify: {alert.notificationTypes.join(', ')}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(alert._id)}
                  disabled={deletingId === alert._id}
                  className="p-2 rounded-lg text-dark-400 hover:text-red-400 hover:bg-red-500/10 transition-all disabled:opacity-50"
                >
                  {deletingId === alert._id
                    ? <Loader size={16} className="animate-spin" />
                    : <Trash2 size={16} />
                  }
                </button>
              </div>
            );
          })}
        </div>
      )}
    </GlassCard>
  );
};

export default PriceAlerts;
