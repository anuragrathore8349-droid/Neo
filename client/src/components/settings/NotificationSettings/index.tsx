// client/src/components/settings/NotificationSettings/index.tsx
import React, { useState, useEffect } from 'react';
import { Bell, TrendingUp, Wallet, Zap, Mail, Smartphone, Loader } from 'lucide-react';
import SettingsCard from '../../common/SettingsCard';
import Toggle from '../../common/Toggle';
import { apiFetch } from '../../../services/api';
import { useAuth } from '../../../context/AuthContext';

interface NotifPrefs {
  email: {
    marketAlerts:    boolean;
    securityAlerts:  boolean;
    newsDigest:      boolean;
    tradingUpdates:  boolean;
    portfolioSummary: boolean;
  };
  push: {
    marketAlerts:   boolean;
    securityAlerts: boolean;
    tradingUpdates: boolean;
    priceAlerts:    boolean;
  };
  sms: {
    securityAlerts: boolean;
    criticalAlerts: boolean;
  };
}

const DEFAULT_PREFS: NotifPrefs = {
  email: { marketAlerts: true, securityAlerts: true, newsDigest: false, tradingUpdates: true, portfolioSummary: true },
  push:  { marketAlerts: true, securityAlerts: true, tradingUpdates: true, priceAlerts: true },
  sms:   { securityAlerts: true, criticalAlerts: true },
};

const NotificationSettings = () => {
  const { user } = useAuth();
  const [prefs, setPrefs]       = useState<NotifPrefs>(DEFAULT_PREFS);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving]   = useState(false);
  const [status, setStatus]       = useState('');

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const res = await apiFetch<any>('/api/user/notifications');
        const d   = res?.data;
        if (d && typeof d === 'object') {
          setPrefs({
            email: { ...DEFAULT_PREFS.email, ...(d.email || {}) },
            push:  { ...DEFAULT_PREFS.push,  ...(d.push  || {}) },
            sms:   { ...DEFAULT_PREFS.sms,   ...(d.sms   || {}) },
          });
        }
      } catch { /* keep defaults */ }
      setIsLoading(false);
    })();
  }, [user]);

  const set = <K extends keyof NotifPrefs>(channel: K, key: keyof NotifPrefs[K], val: boolean) =>
    setPrefs(p => ({ ...p, [channel]: { ...p[channel], [key]: val } }));

  const handleSave = async () => {
    setIsSaving(true);
    setStatus('');
    try {
      await apiFetch('/api/user/notifications', { method: 'PUT', body: prefs });
      setStatus('✓ Notification preferences saved');
    } catch (e: any) {
      setStatus(e?.message || 'Failed to save preferences');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <SettingsCard title="Notification Preferences" description="Loading…">
        <div className="flex items-center gap-2 text-slate-400">
          <Loader className="w-4 h-4 animate-spin" /> Loading…
        </div>
      </SettingsCard>
    );
  }

  const emailRows: { key: keyof NotifPrefs['email']; label: string; icon: React.ReactNode }[] = [
    { key: 'tradingUpdates',  label: 'Trading Alerts',           icon: <TrendingUp className="w-5 h-5 text-[#22DFBF]" /> },
    { key: 'securityAlerts',  label: 'Security Alerts',          icon: <Bell       className="w-5 h-5 text-[#3D5AF1]" /> },
    { key: 'newsDigest',      label: 'Market News & Digest',      icon: <Zap        className="w-5 h-5 text-[#22DFBF]" /> },
    { key: 'portfolioSummary',label: 'Portfolio Summary',         icon: <Wallet     className="w-5 h-5 text-[#3D5AF1]" /> },
    { key: 'marketAlerts',    label: 'Market Price Alerts',       icon: <Mail       className="w-5 h-5 text-[#22DFBF]" /> },
  ];

  return (
    <div className="space-y-6">
      {/* Email Notifications */}
      <SettingsCard
        title="Email Notifications"
        description="Choose which updates you receive via email"
      >
        <div className="space-y-4">
          {emailRows.map(({ key, label, icon }) => (
            <div key={key} className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                {icon}
                <span className="text-white">{label}</span>
              </div>
              <Toggle
                enabled={prefs.email[key]}
                onChange={(v) => set('email', key, v)}
                label=""
              />
            </div>
          ))}
        </div>
      </SettingsCard>

      {/* Push Notifications */}
      <SettingsCard
        title="Push Notifications"
        description="Real-time browser & mobile push alerts"
      >
        <div className="space-y-4">
          {([
            ['marketAlerts',   'Market Alerts'],
            ['securityAlerts', 'Security Alerts'],
            ['tradingUpdates', 'Trade Updates'],
            ['priceAlerts',    'Price Alerts'],
          ] as [keyof NotifPrefs['push'], string][]).map(([key, label]) => (
            <div key={key} className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Smartphone className="w-5 h-5 text-[#22DFBF]" />
                <span className="text-white">{label}</span>
              </div>
              <Toggle
                enabled={prefs.push[key]}
                onChange={(v) => set('push', key, v)}
                label=""
              />
            </div>
          ))}
        </div>
      </SettingsCard>

      {/* SMS Notifications */}
      <SettingsCard
        title="SMS Notifications"
        description="Critical alerts sent to your phone number"
      >
        <div className="space-y-4">
          {([
            ['securityAlerts', 'Security Alerts'],
            ['criticalAlerts', 'Critical Alerts'],
          ] as [keyof NotifPrefs['sms'], string][]).map(([key, label]) => (
            <div key={key} className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Bell className="w-5 h-5 text-[#3D5AF1]" />
                <span className="text-white">{label}</span>
              </div>
              <Toggle
                enabled={prefs.sms[key]}
                onChange={(v) => set('sms', key, v)}
                label=""
              />
            </div>
          ))}
        </div>
      </SettingsCard>

      {/* Save Button */}
      <div className="flex items-center justify-end gap-4">
        {status && (
          <span className={`text-sm ${status.startsWith('✓') ? 'text-green-400' : 'text-red-400'}`}>
            {status}
          </span>
        )}
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-2 px-6 py-2.5 bg-[#3D5AF1] hover:bg-[#2D4AE1] rounded-lg text-white text-sm font-medium"
        >
          {isSaving && <Loader className="w-4 h-4 animate-spin" />}
          {isSaving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
};

export default NotificationSettings;