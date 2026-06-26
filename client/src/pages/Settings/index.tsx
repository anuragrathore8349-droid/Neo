// client/src/pages/Settings/index.tsx
import React, { useState } from 'react';
import SecuritySettings from '../../components/settings/SecuritySettings';
import NotificationSettings from '../../components/settings/NotificationSettings';
import ApiSettings from '../../components/settings/ApiSettings';
import SubscriptionSettings from '../../components/settings/SubscriptionSettings';
import { Shield, Bell, Key, CreditCard } from 'lucide-react';

const TABS = [
  { id: 'security',      label: 'Security',       icon: Shield },
  { id: 'notifications', label: 'Notifications',   icon: Bell },
  { id: 'api',           label: 'API Access',      icon: Key },
  { id: 'subscription',  label: 'Subscription',    icon: CreditCard },
] as const;

type TabId = typeof TABS[number]['id'];

const Settings = () => {
  const [activeTab, setActiveTab] = useState<TabId>('security');

  return (
    <div className="min-h-screen bg-slate-900 text-white p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-white mb-2">Settings</h1>
          <p className="text-slate-400">Manage your account preferences and security</p>
        </div>

        {/* Tab Bar */}
        <div className="flex gap-1 bg-slate-800/50 border border-slate-700 rounded-xl p-1">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === id
                  ? 'bg-[#3D5AF1] text-white shadow'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div>
          {activeTab === 'security'      && <SecuritySettings />}
          {activeTab === 'notifications' && <NotificationSettings />}
          {activeTab === 'api'           && <ApiSettings />}
          {activeTab === 'subscription'  && <SubscriptionSettings />}
        </div>
      </div>
    </div>
  );
};

export default Settings;