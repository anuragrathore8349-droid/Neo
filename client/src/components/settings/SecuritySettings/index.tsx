import React, { useState, useEffect } from 'react';
import { Shield, Smartphone, Key } from 'lucide-react';
import SettingsCard from '../../common/SettingsCard';
import Toggle from '../../common/Toggle';
import { useAuth } from '../../../context/AuthContext';

const SecuritySettings = () => {
  const { user, verifyTwoFactor } = useAuth();
  const [security, setSecurity] = useState({
    twoFactor: user?.twoFactorEnabled || false,
    biometric: false,
    notifications: true,
  });
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  useEffect(() => {
    if (user) {
      setSecurity({
        twoFactor: user.twoFactorEnabled || false,
        biometric: false, // Not implemented yet
        notifications: true, // Not implemented yet
      });
    }
  }, [user]);

  const handleToggle2FA = async (enabled: boolean) => {
    if (enabled && !security.twoFactor) {
      // Enable 2FA - would need to setup first, but for now just toggle
      setSecurity({ ...security, twoFactor: enabled });
    } else if (!enabled) {
      // Disable 2FA - would need backend call
      setSecurity({ ...security, twoFactor: enabled });
    }
  };

  const handleVerify2FA = async () => {
    if (!twoFactorCode) return;
    setIsVerifying(true);
    setStatusMessage('');
    try {
      await verifyTwoFactor(twoFactorCode);
      setStatusMessage('2FA verified successfully');
      setTwoFactorCode('');
    } catch {
      setStatusMessage('Invalid 2FA code');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <SettingsCard
      title="Security Settings"
      description="Manage your account security and authentication methods"
    >
      <div className="space-y-6">
        <div className="flex items-center justify-between p-4 bg-slate-800/30 rounded-lg border border-slate-700">
          <div className="flex items-center space-x-4">
            <div className="p-2 bg-[#3D5AF1]/20 rounded-lg">
              <Shield className="w-6 h-6 text-[#3D5AF1]" />
            </div>
            <div>
              <h4 className="text-white font-medium">Two-Factor Authentication</h4>
              <p className="text-sm text-slate-400">Add an extra layer of security</p>
            </div>
          </div>
          <Toggle
            enabled={security.twoFactor}
            onChange={handleToggle2FA}
            label=""
          />
        </div>

        {security.twoFactor && (
          <div className="p-4 bg-slate-800/30 rounded-lg border border-slate-700">
            <h4 className="text-white font-medium mb-2">Verify 2FA Code</h4>
            <div className="flex space-x-2">
              <input
                type="text"
                placeholder="Enter 6-digit code"
                value={twoFactorCode}
                onChange={(e) => setTwoFactorCode(e.target.value)}
                className="flex-1 bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-[#22DFBF] transition-colors"
              />
              <button
                onClick={handleVerify2FA}
                disabled={isVerifying || !twoFactorCode}
                className="btn-primary"
              >
                {isVerifying ? 'Verifying...' : 'Verify'}
              </button>
            </div>
            {statusMessage && <p className="text-sm text-slate-400 mt-2">{statusMessage}</p>}
          </div>
        )}

        <div className="flex items-center justify-between p-4 bg-slate-800/30 rounded-lg border border-slate-700">
          <div className="flex items-center space-x-4">
            <div className="p-2 bg-[#22DFBF]/20 rounded-lg">
              <Smartphone className="w-6 h-6 text-[#22DFBF]" />
            </div>
            <div>
              <h4 className="text-white font-medium">Biometric Authentication</h4>
              <p className="text-sm text-slate-400">Use fingerprint or face ID</p>
            </div>
          </div>
          <Toggle
            enabled={security.biometric}
            onChange={(enabled) => setSecurity({ ...security, biometric: enabled })}
            label=""
          />
        </div>

        <div className="flex items-center justify-between p-4 bg-slate-800/30 rounded-lg border border-slate-700">
          <div className="flex items-center space-x-4">
            <div className="p-2 bg-[#3D5AF1]/20 rounded-lg">
              <Key className="w-6 h-6 text-[#3D5AF1]" />
            </div>
            <div>
              <h4 className="text-white font-medium">Security Notifications</h4>
              <p className="text-sm text-slate-400">Get alerts for suspicious activity</p>
            </div>
          </div>
          <Toggle
            enabled={security.notifications}
            onChange={(enabled) => setSecurity({ ...security, notifications: enabled })}
            label=""
          />
        </div>
      </div>
    </SettingsCard>
  );
};

export default SecuritySettings;