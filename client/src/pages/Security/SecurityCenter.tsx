import React, { useState } from 'react';
import { Shield } from 'lucide-react';
import SecurityStatusCard from '../../components/security/SecurityStatusCard/SecurityStatusCard';
import ActivityLogCard from '../../components/security/ActivityLogCard/ActivityLogCard';
import DeviceCard from '../../components/security/DeviceCard/DeviceCard';
import PermissionCard from '../../components/security/PermissionCard/PermissionCard';
import RecoveryCard from '../../components/security/RecoveryCard/RecoveryCard';

// Mock data
const securityFeatures = [
  { name: '2FA Authentication', enabled: true, critical: true },
  { name: 'Biometric Login', enabled: false, critical: false },
  { name: 'Hardware Wallet', enabled: true, critical: false },
  { name: 'Email Notifications', enabled: true, critical: true },
  { name: 'SMS Alerts', enabled: false, critical: false },
];

const activityLogs = [
  {
    id: '1',
    type: 'security_alert',
    description: 'Unusual login attempt detected from new location',
    location: 'Tokyo, Japan',
    device: 'Unknown Device',
    timestamp: '2 minutes ago',
    critical: true,
  },
  {
    id: '2',
    type: 'login',
    description: 'Successful login to account',
    location: 'New York, USA',
    device: 'MacBook Pro',
    timestamp: '1 hour ago',
  },
  {
    id: '3',
    type: 'transaction',
    description: 'Large transaction initiated',
    location: 'London, UK',
    device: 'Chrome Browser',
    timestamp: '3 hours ago',
  },
];

const devices = [
  {
    id: '1',
    name: 'MacBook Pro',
    type: 'desktop',
    lastActive: 'Now',
    location: 'New York, USA',
    current: true,
  },
  {
    id: '2',
    name: 'iPhone 13',
    type: 'mobile',
    lastActive: '2 hours ago',
    location: 'New York, USA',
    current: false,
  },
  {
    id: '3',
    name: 'iPad Pro',
    type: 'tablet',
    lastActive: '1 day ago',
    location: 'London, UK',
    current: false,
  },
];

const permissions = [
  {
    id: '1',
    name: 'Trading Access',
    description: 'Allow executing trades and managing orders',
    enabled: true,
    critical: true,
  },
  {
    id: '2',
    name: 'API Access',
    description: 'Enable third-party API integrations',
    enabled: false,
    critical: true,
  },
  {
    id: '3',
    name: 'Email Notifications',
    description: 'Receive important updates via email',
    enabled: true,
    critical: false,
  },
];

const recoveryOptions = [
  {
    type: 'email',
    value: 'user@example.com',
    verified: true,
    primary: true,
  },
  {
    type: 'phone',
    value: '+1 (555) 123-4567',
    verified: true,
    primary: false,
  },
  {
    type: 'key',
    value: 'Recovery Key (...XYZW)',
    verified: false,
    primary: false,
  },
];

const SecurityCenter: React.FC = () => {
  const [activeDevices, setActiveDevices] = useState(devices);
  const [activePermissions, setActivePermissions] = useState(permissions);

  const handleRemoveDevice = (id: string) => {
    setActiveDevices(activeDevices.filter(device => device.id !== id));
  };

  const handleTogglePermission = (id: string) => {
    setActivePermissions(activePermissions.map(permission =>
      permission.id === id
        ? { ...permission, enabled: !permission.enabled }
        : permission
    ));
  };

  const handleVerifyRecovery = (type: string) => {
    console.log('Verifying recovery option:', type);
  };

  const handleMakePrimaryRecovery = (type: string) => {
    console.log('Making primary recovery option:', type);
  };

  return (
    <div className="min-h-screen bg-[#0A0B0F] text-white p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <Shield className="w-8 h-8 text-[#3D5AF1]" />
          <h1 className="text-3xl font-bold">Security Center</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Security Status */}
          <SecurityStatusCard
            securityScore={85}
            features={securityFeatures}
          />

          {/* Activity Log */}
          <ActivityLogCard activities={activityLogs} />
        </div>

        {/* Device Management */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Device Management</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeDevices.map(device => (
              <DeviceCard
                key={device.id}
                device={device}
                onRemove={handleRemoveDevice}
              />
            ))}
          </div>
        </div>

        {/* Permissions */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Permission Controls</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activePermissions.map(permission => (
              <PermissionCard
                key={permission.id}
                permission={permission}
                onToggle={handleTogglePermission}
              />
            ))}
          </div>
        </div>

        {/* Recovery Options */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <RecoveryCard
            options={recoveryOptions}
            onVerify={handleVerifyRecovery}
            onMakePrimary={handleMakePrimaryRecovery}
          />
        </div>
      </div>
    </div>
  );
};

export default SecurityCenter;