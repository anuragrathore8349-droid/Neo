import React, { useState, useEffect } from 'react';
import { Bell, Zap, TrendingUp, Wallet } from 'lucide-react';
import SettingsCard from '../../common/SettingsCard';
import Toggle from '../../common/Toggle';
import { useAuth } from '../../../context/AuthContext';
import * as userService from '../../../services/user.service';

const NotificationSettings = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState({
    trading: true,
    security: true,
    news: false,
    portfolio: true,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  useEffect(() => {
    const fetchSettings = async () => {
      if (!user) return;
      try {
        const response = await userService.getNotificationSettings(localStorage.getItem('neofin_auth') ? JSON.parse(localStorage.getItem('neofin_auth')!).accessToken : '');
        if (response.data) {
          setNotifications({
            trading: response.data.email?.tradingUpdates || false,
            security: response.data.email?.securityAlerts || false,
            news: response.data.email?.newsDigest || false,
            portfolio: response.data.email?.portfolioSummary || false,
          });
        }
      } catch {
        // Use defaults
      } finally {
        setIsLoading(false);
      }
    };
    fetchSettings();
  }, [user]);

  const handleSave = async () => {
    setIsSaving(true);
    setStatusMessage('');
    try {
      const data = {
        email: {
          marketAlerts: notifications.trading,
          securityAlerts: notifications.security,
          newsDigest: notifications.news,
          tradingUpdates: notifications.trading,
          portfolioSummary: notifications.portfolio
        },
        push: {
          marketAlerts: notifications.trading,
          securityAlerts: notifications.security,
          tradingUpdates: notifications.trading,
          priceAlerts: notifications.portfolio
        },
        sms: {
          securityAlerts: notifications.security,
          criticalAlerts: notifications.security
        }
      };
      await userService.updateNotificationSettings(localStorage.getItem('neofin_auth') ? JSON.parse(localStorage.getItem('neofin_auth')!).accessToken : '', data);
      setStatusMessage('Notification settings updated successfully');
    } catch {
      setStatusMessage('Failed to update settings');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) return <SettingsCard title="Notification Preferences" description="Loading..."><div>Loading...</div></SettingsCard>;

  return (
    <SettingsCard
      title="Notification Preferences"
      description="Customize how you receive updates and alerts"
    >
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <TrendingUp className="w-5 h-5 text-[#22DFBF]" />
            <span className="text-white">Trading Alerts</span>
          </div>
          <Toggle
            enabled={notifications.trading}
            onChange={(enabled) => setNotifications({ ...notifications, trading: enabled })}
            label=""
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Bell className="w-5 h-5 text-[#3D5AF1]" />
            <span className="text-white">Security Notifications</span>
          </div>
          <Toggle
            enabled={notifications.security}
            onChange={(enabled) => setNotifications({ ...notifications, security: enabled })}
            label=""
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Zap className="w-5 h-5 text-[#22DFBF]" />
            <span className="text-white">Market News & Updates</span>
          </div>
          <Toggle
            enabled={notifications.news}
            onChange={(enabled) => setNotifications({ ...notifications, news: enabled })}
            label=""
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Wallet className="w-5 h-5 text-[#3D5AF1]" />
            <span className="text-white">Portfolio Changes</span>
          </div>
          <Toggle
            enabled={notifications.portfolio}
            onChange={(enabled) => setNotifications({ ...notifications, portfolio: enabled })}
            label=""
          />
        </div>
      </div>

      <div className="flex items-center justify-end space-x-3 mt-6">
        {statusMessage && <span className="text-sm text-slate-400">{statusMessage}</span>}
        <button
          type="button"
          onClick={handleSave}
          className="btn-primary"
          disabled={isSaving}
        >
          {isSaving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </SettingsCard>
  );
};

export default NotificationSettings;