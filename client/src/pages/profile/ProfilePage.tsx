import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  Shield, Mail, Phone, Globe, Calendar, Award, Edit2, Moon, Sun,
  Bell, Wallet, LineChart as ChartLine, Trash2, Download, CheckCircle,
  AlertCircle, Camera, Key, User as UserIcon, FileText
} from 'lucide-react';
import * as userService from '../../services/user.service';
import { apiFetch } from '../../services/api';

// Map frontend notification keys → DB schema keys
function toDbNotificationKeys(prefs: Record<string, boolean>): Record<string, boolean> {
  return {
    marketAlerts:    prefs.priceAlerts    ?? prefs.marketAlerts    ?? true,
    securityAlerts:  prefs.securityAlerts ?? true,
    newsDigest:      prefs.aiInsights     ?? prefs.newsDigest      ?? true,
    tradingUpdates:  prefs.tradeConfirmations ?? prefs.tradingUpdates ?? true,
    portfolioSummary: prefs.portfolioUpdates ?? prefs.portfolioSummary ?? false,
  };
}

// Map DB schema keys → frontend keys
function fromDbNotificationKeys(dbPrefs: Record<string, boolean>): Record<string, boolean> {
  return {
    securityAlerts:    dbPrefs.securityAlerts   ?? true,
    priceAlerts:       dbPrefs.marketAlerts      ?? true,
    portfolioUpdates:  dbPrefs.portfolioSummary  ?? false,
    aiInsights:        dbPrefs.newsDigest        ?? true,
    marketUpdates:     dbPrefs.marketAlerts      ?? true,
    tradeConfirmations: dbPrefs.tradingUpdates   ?? true,
    accountActivity:   dbPrefs.securityAlerts    ?? false,
  };
}

function ProfilePage() {
  const { user, updateProfile, updateNotificationSettings, logout } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [apiKeyCount, setApiKeyCount] = useState<number>(0);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [securityStatus, setSecurityStatus] = useState<{
    emailVerified: boolean;
    twoFactorEnabled: boolean;
    activeSessions: number;
  } | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    country: '',
    dateOfBirth: '',
    profession: '',
    bio: '',
  });

  const [communicationPreferences, setCommunicationPreferences] = useState({
    securityAlerts:    true,
    priceAlerts:       true,
    portfolioUpdates:  false,
    aiInsights:        true,
    marketUpdates:     true,
    tradeConfirmations: true,
    accountActivity:   false,
  });

  // Load full profile from server on mount
  useEffect(() => {
    const loadAll = async () => {
      setIsLoadingProfile(true);
      try {
        // Load profile
        const profileResp = await userService.getProfile();
        const profile = profileResp.data;
        const fullName = [profile.firstName, profile.lastName].filter(Boolean).join(' ');

        setFormData({
          fullName,
          email:       profile.email          || '',
          phone:       profile.phoneNumber     || '',
          country:     profile.country         || '',
          dateOfBirth: profile.dateOfBirth     || '',
          profession:  profile.profession      || '',
          bio:         profile.bio             || '',
        });

        // Load notification settings
        const notifResp = await userService.getNotificationSettings();
        if (notifResp.data) {
          setCommunicationPreferences(fromDbNotificationKeys(notifResp.data as Record<string, boolean>));
        }
      } catch (err) {
        console.error('Failed to load profile data:', err);
      } finally {
        setIsLoadingProfile(false);
      }
    };

    // Load side data (non-blocking)
    const loadSideData = async () => {
      try {
        // API keys count
        const keysResp = await userService.getApiKeys();
        if (keysResp.data) setApiKeyCount(keysResp.data.length);
      } catch { /* non-critical */ }

      try {
        // First wallet address
        const walletsResp = await apiFetch<{ status: string; data: any[] }>('/api/wallet');
        if (walletsResp.data?.length > 0) {
          setWalletAddress(walletsResp.data[0].address || null);
        }
      } catch { /* non-critical */ }

      try {
        // Security status
        const secResp = await userService.getSecurityStatus();
        if (secResp.data) {
          setSecurityStatus({
            emailVerified:     secResp.data.emailVerified     ?? false,
            twoFactorEnabled:  secResp.data.twoFactorEnabled  ?? false,
            activeSessions:    secResp.data.activeSessions    ?? 0,
          });
        }
      } catch { /* non-critical */ }
    };

    loadAll();
    loadSideData();
  }, []);

  // Sync form when user context changes (e.g. after updateProfile)
  useEffect(() => {
    if (user && !isLoadingProfile) {
      setFormData(prev => ({
        ...prev,
        fullName: user.name || prev.fullName,
        email:    user.email || prev.email,
        phone:    user.phoneNumber || prev.phone,
        country:  user.country    || prev.country,
        dateOfBirth: user.dateOfBirth || prev.dateOfBirth,
        profession:  user.profession  || prev.profession,
      }));
    }
  }, [user, isLoadingProfile]);

  const showSuccess = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 3000);
  };
  const showError = (msg: string) => {
    setErrorMessage(msg);
    setTimeout(() => setErrorMessage(null), 5000);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleCheckboxChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    const newPreferences = { ...communicationPreferences, [name]: checked };
    setCommunicationPreferences(newPreferences);

    try {
      await updateNotificationSettings(toDbNotificationKeys(newPreferences));
    } catch {
      setCommunicationPreferences(communicationPreferences);
      showError('Failed to update notification settings');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      await updateProfile({
        fullName:    formData.fullName,
        phoneNumber: formData.phone,
        country:     formData.country,
        dateOfBirth: formData.dateOfBirth,
        profession:  formData.profession,
        bio:         formData.bio,
      });
      setIsEditing(false);
      showSuccess('Profile updated successfully!');
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Failed to update profile');
    }
  };

  const handleAvatarClick = () => avatarInputRef.current?.click();

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarUploading(true);
    try {
      const formDataObj = new FormData();
      formDataObj.append('avatar', file);
      await apiFetch('/api/user/avatar', { method: 'POST', body: formDataObj });
      // Reload profile to get new avatar URL
      const profileResp = await userService.getProfile();
      await updateProfile({ avatar: profileResp.data.avatar });
      showSuccess('Avatar updated successfully!');
    } catch {
      showError('Failed to upload avatar');
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!window.confirm('Are you sure you want to permanently delete your account? This action cannot be undone.')) return;
    try {
      await apiFetch('/api/user/account', { method: 'DELETE' });
      logout();
    } catch {
      showError('Failed to delete account. Please try again.');
    }
  };

  const handleExportData = async () => {
    try {
      const profileResp = await userService.getProfile();
      const blob = new Blob([JSON.stringify(profileResp.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'my-neofin-data.json';
      a.click();
      URL.revokeObjectURL(url);
      showSuccess('Data exported successfully!');
    } catch {
      showError('Failed to export data');
    }
  };

  // Derive verification tier from real data
  const emailVerified = securityStatus?.emailVerified ?? user?.isEmailVerified ?? false;
  const twoFaEnabled  = securityStatus?.twoFactorEnabled ?? user?.twoFactorEnabled ?? false;
  const verifiedCount = [emailVerified, twoFaEnabled].filter(Boolean).length;
  const tierLabel = verifiedCount >= 2 ? 'Tier 2 Verified' : verifiedCount === 1 ? 'Tier 1 Verified' : 'Unverified';
  const progressPct  = verifiedCount >= 2 ? '66%' : verifiedCount === 1 ? '33%' : '5%';

  const avatarUrl = user?.avatar
    ? (user.avatar.startsWith('http') ? user.avatar : `${import.meta.env.VITE_API_URL || 'http://localhost:3003'}${user.avatar}`)
    : null;

  const initials = (user?.name || formData.fullName || 'U')
    .split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);

  if (isLoadingProfile) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-white/50">Loading profile...</div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Toast notifications */}
      {successMessage && (
        <div className="fixed top-4 right-4 flex items-center space-x-3 bg-green-500/10 border border-green-500/30 rounded-lg p-4 z-50">
          <CheckCircle className="text-green-500" size={20} />
          <span className="text-green-400 font-medium">{successMessage}</span>
        </div>
      )}
      {errorMessage && (
        <div className="fixed top-4 right-4 flex items-center space-x-3 bg-red-500/10 border border-red-500/30 rounded-lg p-4 z-50">
          <AlertCircle className="text-red-500" size={20} />
          <span className="text-red-400 font-medium">{errorMessage}</span>
        </div>
      )}

      {/* Avatar + Name Header */}
      <div className="glass-card p-8 flex items-center space-x-6">
        <div className="relative">
          <div
            className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center text-2xl font-bold cursor-pointer overflow-hidden"
            onClick={handleAvatarClick}
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" />
            ) : (
              <span>{initials}</span>
            )}
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity rounded-full">
              {avatarUploading ? (
                <span className="text-xs text-white">Uploading...</span>
              ) : (
                <Camera size={20} className="text-white" />
              )}
            </div>
          </div>
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleAvatarChange}
          />
        </div>
        <div>
          <h1 className="text-2xl font-semibold">{formData.fullName || 'Your Name'}</h1>
          <p className="text-white/50">{formData.email}</p>
          <p className="text-sm text-primary mt-1 capitalize">{user?.plan || 'basic'} plan</p>
        </div>
      </div>

      {/* Personal Information */}
      <div className="glass-card p-8">
        <form onSubmit={handleSubmit}>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-light">Personal Information</h2>
            {isEditing ? (
              <div className="space-x-4">
                <button type="button" onClick={() => setIsEditing(false)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Save Changes
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => setIsEditing(true)} className="btn-primary">
                <Edit2 size={16} className="inline mr-2" />
                Edit Profile
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div>
                <label className="block text-white/50 text-sm mb-2">Full Name</label>
                <input
                  type="text"
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleInputChange}
                  className="glass-input w-full"
                  readOnly={!isEditing}
                />
              </div>

              <div>
                <label className="block text-white/50 text-sm mb-2">Email Address</label>
                <div className="relative">
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    className="glass-input w-full pr-10 bg-slate-950/50"
                    readOnly
                  />
                  <Mail className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary" size={16} />
                </div>
                <p className="text-xs text-white/30 mt-1">Email cannot be changed</p>
              </div>

              <div>
                <label className="block text-white/50 text-sm mb-2">Phone Number</label>
                <div className="relative">
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    className="glass-input w-full pr-10"
                    readOnly={!isEditing}
                    placeholder={isEditing ? '+1 234 567 8900' : '—'}
                  />
                  <Phone className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary" size={16} />
                </div>
              </div>

              <div>
                <label className="block text-white/50 text-sm mb-2">Bio</label>
                <textarea
                  name="bio"
                  value={formData.bio}
                  onChange={handleInputChange}
                  className="glass-input w-full resize-none"
                  rows={3}
                  readOnly={!isEditing}
                  placeholder={isEditing ? 'Tell us a bit about yourself...' : '—'}
                />
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-white/50 text-sm mb-2">Country/Region</label>
                <div className="relative">
                  <input
                    type="text"
                    name="country"
                    value={formData.country}
                    onChange={handleInputChange}
                    className="glass-input w-full pr-10"
                    readOnly={!isEditing}
                    placeholder={isEditing ? 'e.g. India' : '—'}
                  />
                  <Globe className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50" size={16} />
                </div>
              </div>

              <div>
                <label className="block text-white/50 text-sm mb-2">Date of Birth</label>
                <div className="relative">
                  <input
                    type={isEditing ? 'date' : 'text'}
                    name="dateOfBirth"
                    value={formData.dateOfBirth}
                    onChange={handleInputChange}
                    className="glass-input w-full pr-10"
                    readOnly={!isEditing}
                    placeholder={isEditing ? 'YYYY-MM-DD' : '—'}
                  />
                  <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50" size={16} />
                </div>
              </div>

              <div>
                <label className="block text-white/50 text-sm mb-2">Professional Background</label>
                <input
                  type="text"
                  name="profession"
                  value={formData.profession}
                  onChange={handleInputChange}
                  className="glass-input w-full"
                  readOnly={!isEditing}
                  placeholder={isEditing ? 'e.g. Software Engineer' : '—'}
                />
              </div>
            </div>
          </div>
        </form>
      </div>

      {/* Identity Verification — real data */}
      <div className="glass-card p-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-light">Identity Verification</h2>
          <div className="flex items-center space-x-2">
            <Award className="text-primary" size={20} />
            <span className="text-primary font-medium">{tierLabel}</span>
          </div>
        </div>

        <div className="relative h-2 bg-glass-dark rounded-full mb-8">
          <div
            className="absolute left-0 top-0 h-full bg-gradient-to-r from-primary to-secondary rounded-full transition-all duration-500"
            style={{ width: progressPct }}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className={`glass-card p-4 ${emailVerified ? 'border-green-500/20' : 'border-white/10'}`}>
            <div className="flex items-center space-x-3 mb-2">
              <Shield className={emailVerified ? 'text-green-500' : 'text-white/30'} size={16} />
              <span className="font-medium">Email Verification</span>
            </div>
            <p className="text-white/50 text-sm">
              {emailVerified ? 'Email verified successfully' : 'Email not yet verified'}
            </p>
          </div>

          <div className={`glass-card p-4 ${twoFaEnabled ? 'border-green-500/20' : 'border-white/10'}`}>
            <div className="flex items-center space-x-3 mb-2">
              <Shield className={twoFaEnabled ? 'text-green-500' : 'text-white/30'} size={16} />
              <span className="font-medium">Two-Factor Auth</span>
            </div>
            <p className="text-white/50 text-sm">
              {twoFaEnabled ? '2FA enabled and active' : 'Enable 2FA for higher security'}
            </p>
          </div>

          <div className="glass-card p-4 border-primary/20">
            <div className="flex items-center space-x-3 mb-2">
              <Shield className="text-primary" size={16} />
              <span className="font-medium">Advanced Verification</span>
            </div>
            <p className="text-white/50 text-sm">Complete additional verification for higher limits</p>
          </div>
        </div>
      </div>

      {/* Communication Preferences */}
      <div className="glass-card p-8">
        <h2 className="text-xl font-light mb-6">Communication Preferences</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <h3 className="text-lg font-medium mb-4">Email Notifications</h3>
            <div className="space-y-4">
              {([
                ['securityAlerts',   'Security Alerts'],
                ['priceAlerts',      'Price Alerts'],
                ['portfolioUpdates', 'Portfolio Updates'],
                ['aiInsights',       'AI Insights'],
              ] as [string, string][]).map(([key, label]) => (
                <label key={key} className="flex items-center justify-between">
                  <span className="text-white/70">{label}</span>
                  <input
                    type="checkbox"
                    name={key}
                    checked={(communicationPreferences as any)[key]}
                    onChange={handleCheckboxChange}
                    className="form-checkbox"
                  />
                </label>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-lg font-medium mb-4">Push Notifications</h3>
            <div className="space-y-4">
              {([
                ['marketUpdates',     'Market Updates'],
                ['tradeConfirmations','Trade Confirmations'],
                ['accountActivity',  'Account Activity'],
              ] as [string, string][]).map(([key, label]) => (
                <label key={key} className="flex items-center justify-between">
                  <span className="text-white/70">{label}</span>
                  <input
                    type="checkbox"
                    name={key}
                    checked={(communicationPreferences as any)[key]}
                    onChange={handleCheckboxChange}
                    className="form-checkbox"
                  />
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Connected Wallet — real data */}
      <div className="glass-card p-8">
        <h2 className="text-xl font-light mb-6">Connected Wallet</h2>
        {walletAddress ? (
          <div className="flex items-center justify-between p-4 glass-card">
            <div className="flex items-center space-x-3">
              <Wallet size={20} className="text-secondary" />
              <div>
                <div className="font-medium">Primary Wallet</div>
                <div className="text-sm text-white/50 font-mono">
                  {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
                </div>
              </div>
            </div>
            <span className="text-green-400 text-sm">Connected</span>
          </div>
        ) : (
          <div className="flex items-center justify-between p-4 glass-card border-dashed border-white/20">
            <div className="flex items-center space-x-3">
              <Wallet size={20} className="text-white/30" />
              <span className="text-white/50">No wallet connected</span>
            </div>
            <a href="/wallet" className="btn-primary text-sm">Connect Wallet</a>
          </div>
        )}
      </div>

      {/* Account Statistics — real data */}
      <div className="glass-card p-8">
        <h2 className="text-xl font-light mb-6">Account Statistics</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="glass-card p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-white/70">Active Sessions</span>
              <ChartLine size={16} className="text-primary" />
            </div>
            <p className="text-2xl font-semibold mt-2">{securityStatus?.activeSessions ?? '—'}</p>
            <p className="text-xs text-white/40 mt-1">Logged-in devices</p>
          </div>

          <div className="glass-card p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-white/70">API Keys</span>
              <Key size={16} className="text-secondary" />
            </div>
            <p className="text-2xl font-semibold mt-2">{apiKeyCount}</p>
            <p className="text-xs text-white/40 mt-1">Exchange keys configured</p>
          </div>

          <div className="glass-card p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-white/70">Account Health</span>
              <Shield size={16} className="text-green-500" />
            </div>
            <div className="flex items-center space-x-2 mt-2">
              <span className={`text-lg font-semibold ${emailVerified && twoFaEnabled ? 'text-green-400' : emailVerified ? 'text-yellow-400' : 'text-red-400'}`}>
                {emailVerified && twoFaEnabled ? 'Excellent' : emailVerified ? 'Good' : 'Needs Attention'}
              </span>
            </div>
            <div className="relative h-2 bg-glass-dark rounded-full mt-3">
              <div
                className={`absolute left-0 top-0 h-full rounded-full ${emailVerified && twoFaEnabled ? 'bg-green-500 w-full' : emailVerified ? 'bg-yellow-500 w-2/3' : 'bg-red-500 w-1/4'}`}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Appearance Settings */}
      <div className="glass-card p-8">
        <h2 className="text-xl font-light mb-6">Appearance Settings</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-6">
            <div>
              <label className="block text-white/50 text-sm mb-4">Theme Preference</label>
              <div className="flex space-x-4">
                <button className="glass-card p-4 flex items-center space-x-2 border-primary/20">
                  <Moon size={16} className="text-primary" />
                  <span>Dark</span>
                </button>
                <button className="glass-card p-4 flex items-center space-x-2 opacity-50 cursor-not-allowed" disabled>
                  <Sun size={16} className="text-white/50" />
                  <span>Light</span>
                </button>
              </div>
              <p className="text-xs text-white/30 mt-2">Light theme coming soon</p>
            </div>
          </div>
        </div>
      </div>

      {/* Data & Privacy */}
      <div className="glass-card p-8">
        <h2 className="text-xl font-light mb-6">Data & Privacy</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium">Export Data</h3>
                <p className="text-sm text-white/50">Download your account data as JSON</p>
              </div>
              <button onClick={handleExportData} className="btn-primary">
                <Download size={16} className="inline mr-2" />
                Export
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-red-500">Delete Account</h3>
                <p className="text-sm text-white/50">Permanently delete your account and all data</p>
              </div>
              <button
                onClick={handleDeleteAccount}
                className="glass-card p-2 hover:bg-red-500/10 border border-red-500/30"
              >
                <Trash2 size={16} className="text-red-500" />
              </button>
            </div>
          </div>

          <div className="space-y-4">
            <p className="text-sm text-white/50">
              Your data is encrypted at rest and in transit. We never sell your personal information.
              API keys are stored with AES-256 encryption.
            </p>
            <a href="/security" className="text-primary text-sm hover:underline flex items-center space-x-1">
              <Shield size={14} />
              <span>View full security settings →</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ProfilePage;
