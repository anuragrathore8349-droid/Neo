import React from 'react';
import ProfileSettings from '../../components/settings/ProfileSettings';
import SecuritySettings from '../../components/settings/SecuritySettings';
import NotificationSettings from '../../components/settings/NotificationSettings';
import ApiSettings from '../../components/settings/ApiSettings';

const Settings = () => {
  return (
    <div className="min-h-screen bg-slate-900 text-white p-6">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Settings</h1>
          <p className="text-slate-400">Manage your account preferences and security</p>
        </div>

        <ProfileSettings />
        <SecuritySettings />
        <NotificationSettings />
        <ApiSettings />
      </div>
    </div>
  );
};

export default Settings;