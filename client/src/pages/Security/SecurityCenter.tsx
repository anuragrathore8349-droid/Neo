import React, { useState, useEffect, useCallback } from 'react';
import { Shield, Loader, AlertCircle, RefreshCw, CheckCircle, XCircle } from 'lucide-react';
import SecurityStatusCard from '../../components/security/SecurityStatusCard/SecurityStatusCard';
import ActivityLogCard from '../../components/security/ActivityLogCard/ActivityLogCard';
import DeviceCard from '../../components/security/DeviceCard/DeviceCard';
import PermissionCard from '../../components/security/PermissionCard/PermissionCard';
import RecoveryCard from '../../components/security/RecoveryCard/RecoveryCard';
import { apiFetch } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

interface SecurityStatus {
  twoFactorEnabled: boolean;
  emailVerified: boolean;
  activeSessions: number;
  lastLogin: string | null;
  failedAttempts: number;
}

interface ActivityLog {
  id: string;
  type: string;
  description: string;
  location: string;
  device: string;
  timestamp: string;
  critical: boolean;
}

interface DeviceSession {
  id: string;
  name: string;
  type: 'desktop' | 'mobile' | 'tablet';
  lastActive: string;
  location: string;
  current: boolean;
  userAgent?: string;
  ip?: string;
}

const SecurityCenter: React.FC = () => {
  const { user } = useAuth();
  const [securityStatus, setSecurityStatus] = useState<SecurityStatus | null>(null);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [sessions, setSessions] = useState<DeviceSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [twoFaSetup, setTwoFaSetup] = useState<{ qrCode: string; secret: string } | null>(null);
  const [twoFaCode, setTwoFaCode] = useState('');
  const [twoFaLoading, setTwoFaLoading] = useState(false);
  const [twoFaMessage, setTwoFaMessage] = useState<string | null>(null);
  const [removingSession, setRemovingSession] = useState<string | null>(null);
  const [devices, setDevices] = useState<any[]>([]);
  const [activity, setActivity] = useState<any[]>([]);
  const [secLoading, setSecLoading] = useState(true);
  const [permissions, setPermissions] = useState([
    { id: 'trading',       name: 'Trading Access',       description: 'Allow executing trades and managing orders', enabled: true,  critical: true  },
    { id: 'api',           name: 'API Access',            description: 'Enable third-party API integrations',        enabled: false, critical: true  },
    { id: 'notifications', name: 'Email Notifications',   description: 'Receive important updates via email',        enabled: false, critical: false },
  ]);
  const [togglingPerm, setTogglingPerm] = useState<string | null>(null);
  const [verifyingEmail, setVerifyingEmail] = useState(false);
  const [verifyMsg, setVerifyMsg] = useState('');

  const loadSecurityData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    
    // Fetch devices and activity data
    async function loadSecurity() {
      setSecLoading(true);
      try {
        const [devRes, actRes] = await Promise.allSettled([
          apiFetch('/api/user/devices'),
          apiFetch('/api/user/activity'),
        ]);
        if (devRes.status === 'fulfilled') setDevices((devRes.value as any)?.data || []);
        if (actRes.status === 'fulfilled') setActivity((actRes.value as any)?.data || []);
      } catch (e) {
        console.error('Security data load failed:', e);
      } finally {
        setSecLoading(false);
      }
    }
    loadSecurity();
    
    try {
      const [statusRes, sessionsRes, activityRes] = await Promise.allSettled([
        apiFetch<any>('/api/user/security-status'),
        apiFetch<any>('/api/user/sessions').catch(() => ({ data: [] })),
        apiFetch<any>('/api/security/activity').catch(() => ({ data: { logs: [] } })),
      ]);

      if (statusRes.status === 'fulfilled') {
        const d = statusRes.value?.data || statusRes.value;
        setSecurityStatus({
          twoFactorEnabled: d.twoFactorEnabled || false,
          emailVerified:    d.emailVerified    || false,
          activeSessions:   d.activeSessions   || 0,
          lastLogin:        d.lastLogin        || null,
          failedAttempts:   d.failedAttempts   || 0,
        });
      }

      if (sessionsRes.status === 'fulfilled') {
        const raw = sessionsRes.value?.data || [];
        setSessions(raw.map((s: any, i: number) => ({
          id: s._id || s.id || String(i),
          name: s.deviceName || parseUserAgent(s.userAgent || ''),
          type: detectDeviceType(s.userAgent || ''),
          lastActive: s.lastActive ? new Date(s.lastActive).toLocaleString() : 'Unknown',
          location: s.ip ? `IP: ${s.ip}` : 'Unknown location',
          current: s.current || i === 0,
          userAgent: s.userAgent,
          ip: s.ip,
        })));
      }

      if (activityRes.status === 'fulfilled') {
        const rawLogs = activityRes.value?.data?.logs || [];
        setActivityLogs(rawLogs.map((log: any) => ({
          id:          String(log._id),
          type:        log.action === 'login' ? 'login'
                     : log.action?.includes('fail') ? 'security_alert'
                     : 'settings_change',
          description: log.description,
          location:    log.ipAddress || 'Unknown',
          device:      log.device || log.userAgent || 'Unknown',
          timestamp:   new Date(log.createdAt).toLocaleString(),
          critical:    log.status === 'failed' || log.status === 'blocked',
        })));
      }

    } catch (err: any) {
      setError(err?.message || 'Failed to load security data');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => { loadSecurityData(); }, [loadSecurityData]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadSecurityData(true);
  };

  // ── 2FA Setup ──────────────────────────────────────────────────────────
  const handle2FASetup = async () => {
    setTwoFaLoading(true);
    setTwoFaMessage(null);
    try {
      const res = await apiFetch<any>('/api/auth/2fa/setup', { method: 'POST' });
      setTwoFaSetup({ qrCode: res.data?.qrCode || '', secret: res.data?.secret || '' });
    } catch (err: any) {
      setTwoFaMessage(err?.message || 'Failed to set up 2FA');
    } finally {
      setTwoFaLoading(false);
    }
  };

  const handle2FAVerify = async () => {
    if (!twoFaCode || twoFaCode.length !== 6) {
      setTwoFaMessage('Enter the 6-digit code from your authenticator app');
      return;
    }
    setTwoFaLoading(true);
    setTwoFaMessage(null);
    try {
      await apiFetch('/api/auth/2fa/verify', { method: 'POST', body: { token: twoFaCode } });
      setTwoFaMessage('2FA enabled successfully!');
      setTwoFaSetup(null);
      setTwoFaCode('');
      loadSecurityData(true);
    } catch (err: any) {
      setTwoFaMessage(err?.message || 'Invalid code, try again');
    } finally {
      setTwoFaLoading(false);
    }
  };

  const handleRemoveSession = async (id: string) => {
    setRemovingSession(id);
    try {
      await apiFetch(`/api/user/sessions/${id}`, { method: 'DELETE' });
      setSessions(prev => prev.filter(s => s.id !== id));
    } catch (err: any) {
      console.error('Failed to remove session:', err.message);
    } finally {
      setRemovingSession(null);
    }
  };

  const handlePermissionToggle = async (id: string) => {
    const perm = permissions.find(p => p.id === id);
    if (!perm) return;
    const newVal = !perm.enabled;
    setTogglingPerm(id);
    try {
      await apiFetch(`/api/security/permissions/${id}`, {
        method: 'PUT',
        body: { enabled: newVal },
      });
      setPermissions(prev => prev.map(p => p.id === id ? { ...p, enabled: newVal } : p));
    } catch (e: any) {
      console.error('Permission toggle failed:', e.message);
    } finally {
      setTogglingPerm(null);
    }
  };

  const handleVerifyEmail = async () => {
    setVerifyingEmail(true);
    setVerifyMsg('');
    try {
      await apiFetch('/api/auth/resend-verification', { method: 'POST' });
      setVerifyMsg('Verification email sent! Check your inbox.');
    } catch (e: any) {
      setVerifyMsg(e?.message || 'Failed to send verification email');
    } finally {
      setVerifyingEmail(false);
    }
  };

  // ── Derive security score ─────────────────────────────────────────────
  const calculateSecurityScore = (status: SecurityStatus): number => {
    let score = 40;
    if (status.twoFactorEnabled) score += 30;
    if (status.emailVerified) score += 20;
    if (status.failedAttempts === 0) score += 10;
    return Math.min(score, 100);
  };

  // ── Derive feature list from real status ──────────────────────────────
  const buildSecurityFeatures = (status: SecurityStatus) => [
    { name: '2FA Authentication', enabled: status.twoFactorEnabled, critical: true },
    { name: 'Email Verified',     enabled: status.emailVerified,    critical: true },
    { name: 'Email Notifications', enabled: true,                   critical: false },
    { name: 'Session Monitoring', enabled: status.activeSessions > 0, critical: false },
  ];

  // ── Recovery options from user profile ────────────────────────────────
  const buildRecoveryOptions = () => [
    {
      type: 'email',
      value: user?.email || 'Not set',
      verified: securityStatus?.emailVerified || false,
      primary: true,
    },
    {
      type: 'key',
      value: securityStatus?.twoFactorEnabled ? '2FA Active' : 'Not configured',
      verified: securityStatus?.twoFactorEnabled || false,
      primary: false,
    },
  ];



  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0B0F] flex items-center justify-center">
        <div className="text-center">
          <Loader className="w-8 h-8 text-[#3D5AF1] animate-spin mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Loading security data…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0A0B0F] flex items-center justify-center p-6">
        <div className="text-center">
          <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
          <p className="text-red-300 mb-4">{error}</p>
          <button onClick={() => loadSecurityData()} className="px-4 py-2 bg-[#3D5AF1] rounded-lg text-white text-sm">
            Retry
          </button>
        </div>
      </div>
    );
  }

  const securityScore = securityStatus ? calculateSecurityScore(securityStatus) : 0;

  return (
    <div className="min-h-screen bg-[#0A0B0F] text-white p-6">
      <div className="max-w-7xl mx-auto space-y-8">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="w-8 h-8 text-[#3D5AF1]" />
            <div>
              <h1 className="text-3xl font-bold">Security Center</h1>
              <p className="text-gray-400 text-sm">Real-time account security status</p>
            </div>
          </div>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-4 py-2 bg-[#1A1B23] border border-[#3D5AF1]/30 rounded-lg text-sm hover:border-[#3D5AF1] transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Status cards */}
        {securityStatus && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-[#1A1B23]/60 border border-[#3D5AF1]/20 rounded-xl p-4">
              <p className="text-xs text-gray-400 mb-1">Security Score</p>
              <p className={`text-2xl font-bold ${securityScore >= 80 ? 'text-green-400' : securityScore >= 60 ? 'text-yellow-400' : 'text-red-400'}`}>
                {securityScore}/100
              </p>
            </div>
            <div className="bg-[#1A1B23]/60 border border-[#3D5AF1]/20 rounded-xl p-4">
              <p className="text-xs text-gray-400 mb-1">2FA Status</p>
              <div className="flex items-center gap-2 mt-1">
                {securityStatus.twoFactorEnabled
                  ? <CheckCircle className="w-5 h-5 text-green-400" />
                  : <XCircle className="w-5 h-5 text-red-400" />}
                <span className={`text-sm font-medium ${securityStatus.twoFactorEnabled ? 'text-green-400' : 'text-red-400'}`}>
                  {securityStatus.twoFactorEnabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>
            </div>
            <div className="bg-[#1A1B23]/60 border border-[#3D5AF1]/20 rounded-xl p-4">
              <p className="text-xs text-gray-400 mb-1">Active Sessions</p>
              <p className="text-2xl font-bold text-white">{securityStatus.activeSessions}</p>
            </div>
            <div className="bg-[#1A1B23]/60 border border-[#3D5AF1]/20 rounded-xl p-4">
              <p className="text-xs text-gray-400 mb-1">Failed Logins</p>
              <p className={`text-2xl font-bold ${securityStatus.failedAttempts > 0 ? 'text-red-400' : 'text-green-400'}`}>
                {securityStatus.failedAttempts}
              </p>
            </div>
          </div>
        )}

        {/* 2FA Setup panel */}
        {securityStatus && !securityStatus.twoFactorEnabled && (
          <div className="bg-yellow-900/20 border border-yellow-500/40 rounded-xl p-6">
            <div className="flex items-start gap-4">
              <AlertCircle className="w-6 h-6 text-yellow-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-yellow-300 mb-1">Two-Factor Authentication is not enabled</h3>
                <p className="text-yellow-200/70 text-sm mb-4">
                  Enable 2FA to significantly increase your account security. You'll need an authenticator app.
                </p>
                {!twoFaSetup ? (
                  <button
                    onClick={handle2FASetup}
                    disabled={twoFaLoading}
                    className="px-4 py-2 bg-yellow-500 hover:bg-yellow-400 rounded-lg text-black text-sm font-medium transition-colors flex items-center gap-2"
                  >
                    {twoFaLoading && <Loader className="w-4 h-4 animate-spin" />}
                    Set Up 2FA
                  </button>
                ) : (
                  <div className="space-y-4">
                    <p className="text-sm text-gray-300">Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.):</p>
                    {twoFaSetup.qrCode && (
                      <img src={twoFaSetup.qrCode} alt="2FA QR Code" className="rounded-xl bg-white p-2 w-48 h-48" />
                    )}
                    <p className="text-xs text-gray-400">Or enter this secret manually: <code className="bg-dark-800 px-2 py-1 rounded text-green-400">{twoFaSetup.secret}</code></p>
                    <div className="flex gap-3 items-center">
                      <input
                        type="text"
                        placeholder="Enter 6-digit code"
                        maxLength={6}
                        value={twoFaCode}
                        onChange={(e) => setTwoFaCode(e.target.value.replace(/\D/g, ''))}
                        className="px-3 py-2 bg-dark-800 border border-gray-600 rounded-lg text-white text-sm w-40 focus:outline-none focus:border-primary"
                      />
                      <button
                        onClick={handle2FAVerify}
                        disabled={twoFaLoading}
                        className="px-4 py-2 bg-[#3D5AF1] hover:bg-[#2D4AE1] rounded-lg text-white text-sm font-medium transition-colors flex items-center gap-2"
                      >
                        {twoFaLoading && <Loader className="w-4 h-4 animate-spin" />}
                        Verify & Enable
                      </button>
                    </div>
                    {twoFaMessage && (
                      <p className={`text-sm ${twoFaMessage.includes('success') ? 'text-green-400' : 'text-red-400'}`}>
                        {twoFaMessage}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Status + Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {securityStatus && (
            <SecurityStatusCard
              securityScore={securityScore}
              features={buildSecurityFeatures(securityStatus)}
            />
          )}
          <ActivityLogCard activities={activityLogs} />
        </div>

        {/* Device / Session Management */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Active Sessions</h2>
            <span className="text-sm text-gray-400">{sessions.length} session(s) active</span>
          </div>
          {sessions.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sessions.map(session => (
                <DeviceCard
                  key={session.id}
                  device={session}
                  onRemove={session.current ? undefined : () => handleRemoveSession(session.id)}
                />
              ))}
            </div>
          ) : (
            <div className="bg-[#1A1B23]/60 border border-[#3D5AF1]/20 rounded-xl p-6 text-center text-gray-400">
              No active sessions found. This may appear after the session tracking backend route is added.
            </div>
          )}
        </div>

        {/* Permissions */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Permission Controls</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {permissions.map(permission => (
              <PermissionCard
                key={permission.id}
                permission={permission}
                onToggle={togglingPerm ? () => {} : handlePermissionToggle}
              />
            ))}
          </div>
        </div>

        {/* Recovery Options */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <RecoveryCard
            options={buildRecoveryOptions()}
            onVerify={async (type) => {
              if (type === 'email') {
                await handleVerifyEmail();
              }
            }}
            onMakePrimary={(type) => console.log('Make primary:', type)}
          />
          {verifyMsg && (
            <p className={`text-sm mt-2 ${verifyMsg.includes('sent') ? 'text-green-400' : 'text-red-400'}`}>
              {verifyMsg}
            </p>
          )}
        </div>

      </div>
    </div>
  );
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function parseUserAgent(ua: string): string {
  if (!ua) return 'Unknown Device';
  if (/iPhone|iPad/i.test(ua)) return 'iOS Device';
  if (/Android/i.test(ua)) return 'Android Device';
  if (/Mac/i.test(ua)) return 'Mac';
  if (/Windows/i.test(ua)) return 'Windows PC';
  if (/Linux/i.test(ua)) return 'Linux';
  return 'Browser';
}

function detectDeviceType(ua: string): 'desktop' | 'mobile' | 'tablet' {
  if (/iPad/i.test(ua)) return 'tablet';
  if (/iPhone|Android/i.test(ua)) return 'mobile';
  return 'desktop';
}

export default SecurityCenter;