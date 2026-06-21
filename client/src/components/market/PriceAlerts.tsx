import React, { useState, useEffect } from 'react';
import {
  getPriceAlerts,
  createPriceAlert,
  deletePriceAlert,
  type PriceAlert
} from '../../services/market.service';
import styles from './PriceAlerts.module.css';

interface NewAlertForm {
  symbol: string;
  type: 'above' | 'below';
  price: string;
  notificationTypes: string[];
}

export function PriceAlerts() {
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<NewAlertForm>({
    symbol: '',
    type: 'above',
    price: '',
    notificationTypes: ['email']
  });

  useEffect(() => {
    loadAlerts();
  }, []);

  const loadAlerts = async () => {
    try {
      setLoading(true);
      const response = await getPriceAlerts();
      setAlerts(response.data || []);
      setError(null);
    } catch (err) {
      console.error('Failed to load price alerts:', err);
      setError('Failed to load alerts');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAlert = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.symbol || !formData.price) {
      setError('Please fill in all fields');
      return;
    }

    try {
      const newAlert = await createPriceAlert({
        symbol: formData.symbol.toUpperCase(),
        type: formData.type,
        price: parseFloat(formData.price),
        notificationTypes: formData.notificationTypes
      });

      setAlerts([...alerts, newAlert.data]);
      setFormData({ symbol: '', type: 'above', price: '', notificationTypes: ['email'] });
      setShowForm(false);
      setError(null);
    } catch (err) {
      console.error('Failed to create alert:', err);
      setError('Failed to create alert');
    }
  };

  const handleDeleteAlert = async (alertId: string) => {
    try {
      await deletePriceAlert(alertId);
      setAlerts(alerts.filter(a => a._id !== alertId));
      setError(null);
    } catch (err) {
      console.error('Failed to delete alert:', err);
      setError('Failed to delete alert');
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>Price Alerts</h2>
        <button
          className={styles.addButton}
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? 'Cancel' : '+ New Alert'}
        </button>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      {showForm && (
        <form onSubmit={handleCreateAlert} className={styles.form}>
          <div className={styles.formGroup}>
            <label>Symbol</label>
            <input
              type="text"
              placeholder="BTC, ETH, SOL..."
              value={formData.symbol}
              onChange={(e) =>
                setFormData({ ...formData, symbol: e.target.value.toUpperCase() })
              }
            />
          </div>

          <div className={styles.formGroup}>
            <label>Alert Type</label>
            <select
              value={formData.type}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  type: e.target.value as 'above' | 'below'
                })
              }
            >
              <option value="above">Price Above</option>
              <option value="below">Price Below</option>
            </select>
          </div>

          <div className={styles.formGroup}>
            <label>Price ($)</label>
            <input
              type="number"
              step="0.01"
              placeholder="0.00"
              value={formData.price}
              onChange={(e) => setFormData({ ...formData, price: e.target.value })}
            />
          </div>

          <div className={styles.formGroup}>
            <label>Notifications</label>
            <div className={styles.checkboxGroup}>
              <label>
                <input
                  type="checkbox"
                  checked={formData.notificationTypes.includes('email')}
                  onChange={(e) => {
                    const types = e.target.checked
                      ? [...formData.notificationTypes, 'email']
                      : formData.notificationTypes.filter(t => t !== 'email');
                    setFormData({ ...formData, notificationTypes: types });
                  }}
                />
                Email
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={formData.notificationTypes.includes('push')}
                  onChange={(e) => {
                    const types = e.target.checked
                      ? [...formData.notificationTypes, 'push']
                      : formData.notificationTypes.filter(t => t !== 'push');
                    setFormData({ ...formData, notificationTypes: types });
                  }}
                />
                Push Notification
              </label>
            </div>
          </div>

          <button type="submit" className={styles.submitButton}>
            Create Alert
          </button>
        </form>
      )}

      {loading ? (
        <p className={styles.loading}>Loading alerts...</p>
      ) : alerts.length === 0 ? (
        <p className={styles.empty}>No price alerts yet. Create one to get started!</p>
      ) : (
        <div className={styles.alertsList}>
          {alerts.map((alert) => (
            <div key={alert._id} className={styles.alertItem}>
              <div className={styles.alertContent}>
                <div className={styles.alertSymbol}>{alert.symbol}</div>
                <div className={styles.alertDetails}>
                  <span className={styles.alertType}>
                    {alert.condition === 'above' ? '↑' : '↓'} ${alert.targetPrice}
                  </span>
                  {alert.triggered && (
                    <span className={styles.triggered}>Triggered</span>
                  )}
                </div>
              </div>
              <button
                className={styles.deleteButton}
                onClick={() => handleDeleteAlert(alert._id)}
                title="Delete alert"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
