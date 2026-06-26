// client/src/components/settings/SecuritySettings/index.tsx
import React, { useState, useEffect } from 'react';
import { Shield, Key, Loader, CheckCircle, XCircle, Eye, EyeOff, Bell } from 'lucide-react';
import SettingsCard from '../../common/SettingsCard';
import Toggle from '../../common/Toggle';
import { useAuth } from '../../../context/AuthContext';
import { apiFetch } from '../../../services/api';

const SecuritySettings = () => {
  const { user } = useAuth();

  // ── 2FA state ──────────────────────────────────────────────────
  const [twoFaEnabled, setTwoFaEnabled] = useState(user?.twoFactorEnabled || false);
  const [twoFaSetup, setTwoFaSetup]     = useState<{ qrCode: string; secret: string } | null>(null);
  const [twoFaCode, setTwoFaCode]       = useState('');
  const [twoFaLoading, setTwoFaLoading] = useState(false);
  const [twoFaMsg, setTwoFaMsg]         = useState('');

  // ── Security notifications (saved to user prefs) ──────────────
  const [secNotif, setSecNotif]   = useState(true);
  const [notifSaving, setNotifSaving] = useState(false);

  // ── Password change ────────────────────────────────────────────
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' });
  const [showPw, setShowPw] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);
  const [pwMsg, setPwMsg]         = useState('');

  // ── Fetch current status on mount ─────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch<any>('/api/user/security-status');
        const d   = res?.data || res;
        setTwoFaEnabled(d?.twoFactorEnabled || false);

        // Load notification preference
        const notifRes = await apiFetch<any>('/api/user/notifications');
        setSecNotif(notifRes?.data?.email?.securityAlerts ?? true);
      } catch { /* use defaults */ }
    })();
  }, []);

  // ── 2FA ────────────────────────────────────────────────────────
  const handleToggle2FA = async (enabled: boolean) => {
    if (enabled) {
      // Initiate setup
      setTwoFaLoading(true);
      setTwoFaMsg('');
      try {
        const res = await apiFetch<any>('/api/auth/2fa/setup', { method: 'POST' });
        setTwoFaSetup({ qrCode: res.data?.qrCode || '', secret: res.data?.secret || '' });
      } catch (e: any) {
        setTwoFaMsg(e?.message || 'Failed to initiate 2FA setup');
      } finally {
        setTwoFaLoading(false);
      }
    } else {
      // Disable 2FA
      setTwoFaLoading(true);
      try {
        await apiFetch('/api/auth/2fa/disable', { method: 'POST' });
        setTwoFaEnabled(false);
        setTwoFaSetup(null);
        setTwoFaMsg('Two-factor authentication disabled.');
      } catch (e: any) {
        setTwoFaMsg(e?.message || 'Failed to disable 2FA');
      } finally {
        setTwoFaLoading(false);
      }
    }
  };

  const handleVerify2FA = async () => {
    if (twoFaCode.length !== 6) {
      setTwoFaMsg('Enter the 6-digit code from your authenticator app');
      return;
    }
    setTwoFaLoading(true);
    setTwoFaMsg('');
    try {
      await apiFetch('/api/auth/2fa/verify', { method: 'POST', body: { token: twoFaCode } });
      setTwoFaEnabled(true);
      setTwoFaSetup(null);
      setTwoFaCode('');
      setTwoFaMsg('✓ 2FA enabled successfully!');
    } catch (e: any) {
      setTwoFaMsg(e?.message || 'Invalid code — try again');
    } finally {
      setTwoFaLoading(false);
    }
  };

  // ── Security notifications ─────────────────────────────────────
  const handleSecNotifToggle = async (enabled: boolean) => {
    setSecNotif(enabled);
    setNotifSaving(true);
    try {
      await apiFetch('/api/user/notifications', {
        method: 'PUT',
        body: {
          email: { securityAlerts: enabled },
          push:  { securityAlerts: enabled },
          sms:   { securityAlerts: enabled, criticalAlerts: enabled },
        },
      });
    } catch (e: any) {
      console.error('Failed to save security notification preference:', e);
    } finally {
      setNotifSaving(false);
    }
  };

  // ── Password change ────────────────────────────────────────────
  const handlePasswordChange = async () => {
    if (!pwForm.current || !pwForm.next) {
      setPwMsg('Please fill in all password fields');
      return;
    }
    if (pwForm.next !== pwForm.confirm) {
      setPwMsg('New passwords do not match');
      return;
    }
    if (pwForm.next.length < 8) {
      setPwMsg('Password must be at least 8 characters');
      return;
    }
    setPwLoading(true);
    setPwMsg('');
    try {
      await apiFetch('/api/user/password', {
        method: 'PUT',
        body: { currentPassword: pwForm.current, newPassword: pwForm.next },
      });
      setPwMsg('✓ Password updated successfully');
      setPwForm({ current: '', next: '', confirm: '' });
    } catch (e: any) {
      setPwMsg(e?.message || 'Failed to update password');
    } finally {
      setPwLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Two-Factor Authentication ──────────────────────────── */}
      <SettingsCard
        title="Two-Factor Authentication"
        description="Add an extra layer of security to your account"
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-slate-800/30 rounded-lg border border-slate-700">
            <div className="flex items-center space-x-4">
              <div className="p-2 bg-[#3D5AF1]/20 rounded-lg">
                <Shield className="w-6 h-6 text-[#3D5AF1]" />
              </div>
              <div>
                <h4 className="text-white font-medium">Two-Factor Authentication</h4>
                <p className="text-sm text-slate-400">
                  Currently{' '}
                  <span className={twoFaEnabled ? 'text-green-400' : 'text-red-400'}>
                    {twoFaEnabled ? 'enabled' : 'disabled'}
                  </span>
                </p>
              </div>
            </div>
            {twoFaLoading
              ? <Loader className="w-5 h-5 animate-spin text-[#3D5AF1]" />
              : (
                <Toggle
                  enabled={twoFaEnabled}
                  onChange={handleToggle2FA}
                  label=""
                />
              )
            }
          </div>

          {/* QR Code setup panel */}
          {twoFaSetup && (
            <div className="p-5 bg-yellow-900/20 border border-yellow-500/30 rounded-xl space-y-4">
              <p className="text-sm text-yellow-200">
                Scan this QR code with <strong>Google Authenticator</strong>, <strong>Authy</strong>, or any TOTP app:
              </p>
              {twoFaSetup.qrCode && (
                <img src={twoFaSetup.qrCode} alt="2FA QR" className="w-44 h-44 rounded-lg bg-white p-2" />
              )}
              <p className="text-xs text-slate-400">
                Or enter this secret manually:{' '}
                <code className="bg-slate-900 px-2 py-1 rounded text-green-400">{twoFaSetup.secret}</code>
              </p>
              <div className="flex gap-3 items-center">
                <input
                  type="text"
                  placeholder="Enter 6-digit code"
                  maxLength={6}
                  value={twoFaCode}
                  onChange={(e) => setTwoFaCode(e.target.value.replace(/\D/g, ''))}
                  className="w-40 px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-[#3D5AF1]"
                />
                <button
                  onClick={handleVerify2FA}
                  disabled={twoFaLoading}
                  className="px-4 py-2 bg-[#3D5AF1] hover:bg-[#2D4AE1] rounded-lg text-white text-sm font-medium flex items-center gap-2"
                >
                  {twoFaLoading && <Loader className="w-4 h-4 animate-spin" />}
                  Verify & Enable
                </button>
                <button
                  onClick={() => { setTwoFaSetup(null); setTwoFaCode(''); setTwoFaMsg(''); }}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {twoFaMsg && (
            <p className={`text-sm px-1 ${twoFaMsg.startsWith('✓') ? 'text-green-400' : 'text-red-400'}`}>
              {twoFaMsg}
            </p>
          )}
        </div>
      </SettingsCard>

      {/* ── Security Notifications ─────────────────────────────── */}
      <SettingsCard
        title="Security Notifications"
        description="Get real-time alerts for suspicious activity and login events"
      >
        <div className="flex items-center justify-between p-4 bg-slate-800/30 rounded-lg border border-slate-700">
          <div className="flex items-center space-x-4">
            <div className="p-2 bg-[#3D5AF1]/20 rounded-lg">
              <Bell className="w-6 h-6 text-[#3D5AF1]" />
            </div>
            <div>
              <h4 className="text-white font-medium">Security Alerts</h4>
              <p className="text-sm text-slate-400">Email, push & SMS alerts for logins, suspicious activity</p>
            </div>
          </div>
          {notifSaving
            ? <Loader className="w-4 h-4 animate-spin text-[#3D5AF1]" />
            : (
              <Toggle
                enabled={secNotif}
                onChange={handleSecNotifToggle}
                label=""
              />
            )
          }
        </div>
      </SettingsCard>

      {/* ── Change Password ────────────────────────────────────── */}
      <SettingsCard
        title="Change Password"
        description="Update your account password"
      >
        <div className="space-y-4">
          <div className="relative">
            <label className="block text-sm text-slate-400 mb-1">Current Password</label>
            <input
              type={showPw ? 'text' : 'password'}
              value={pwForm.current}
              onChange={(e) => setPwForm({ ...pwForm, current: e.target.value })}
              className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#3D5AF1] pr-10"
              placeholder="Enter current password"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">New Password</label>
            <input
              type={showPw ? 'text' : 'password'}
              value={pwForm.next}
              onChange={(e) => setPwForm({ ...pwForm, next: e.target.value })}
              className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#3D5AF1]"
              placeholder="At least 8 characters"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Confirm New Password</label>
            <input
              type={showPw ? 'text' : 'password'}
              value={pwForm.confirm}
              onChange={(e) => setPwForm({ ...pwForm, confirm: e.target.value })}
              className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#3D5AF1]"
              placeholder="Repeat new password"
            />
          </div>
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setShowPw(!showPw)}
              className="flex items-center gap-1.5 text-slate-400 text-sm hover:text-white"
            >
              {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              {showPw ? 'Hide' : 'Show'} passwords
            </button>
            <button
              type="button"
              onClick={handlePasswordChange}
              disabled={pwLoading}
              className="flex items-center gap-2 px-5 py-2.5 bg-[#3D5AF1] hover:bg-[#2D4AE1] rounded-lg text-white text-sm font-medium"
            >
              {pwLoading && <Loader className="w-4 h-4 animate-spin" />}
              Update Password
            </button>
          </div>
          {pwMsg && (
            <p className={`text-sm ${pwMsg.startsWith('✓') ? 'text-green-400' : 'text-red-400'}`}>
              {pwMsg}
            </p>
          )}
        </div>
      </SettingsCard>
    </div>
  );
};

export default SecuritySettings;