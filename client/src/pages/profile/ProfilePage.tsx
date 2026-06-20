import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Shield, Mail, Phone, Globe, Calendar, Award, Edit2, Moon, Sun, Bell, Link, Wallet, LineChart as ChartLine, Lock, Trash2, Download, Linkedin as LinkedIn, ToggleLeft as Google, CheckCircle, AlertCircle } from 'lucide-react';

function ProfilePage() {
  const { user, updateProfile, updateNotificationSettings } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    fullName: user?.name || '', // Dynamically use logged-in user's name
    email: user?.email || '', // Dynamically use logged-in user's email
    phone: user?.phoneNumber || '',
    country: user?.country || '',
    dateOfBirth: user?.dateOfBirth || '',
    profession: user?.profession || '',
  });
  const [communicationPreferences, setCommunicationPreferences] = useState({
    securityAlerts: true,
    priceAlerts: true,
    portfolioUpdates: false,
    aiInsights: true,
    marketUpdates: true,
    tradeConfirmations: true,
    accountActivity: false,
  });

  useEffect(() => {
    // Synchronize formData with user whenever user changes
    if (user) {
      setFormData({
        fullName: user.name || '',
        email: user.email || '',
        phone: user.phoneNumber || '',
        country: user.country || '',
        dateOfBirth: user.dateOfBirth || '',
        profession: user.profession || '',
      });
    }
  }, [user]);

  useEffect(() => {
    // Synchronize communication preferences with user preferences
    if (user?.preferences?.notifications) {
      const newPrefs = {
        securityAlerts: user.preferences.notifications.securityAlerts ?? true,
        priceAlerts: user.preferences.notifications.marketAlerts ?? true,
        portfolioUpdates: user.preferences.notifications.portfolioSummary ?? false,
        aiInsights: user.preferences.notifications.newsDigest ?? true,
        marketUpdates: user.preferences.notifications.marketAlerts ?? true,
        tradeConfirmations: user.preferences.notifications.tradingUpdates ?? true,
        accountActivity: user.preferences.notifications.securityAlerts ?? false,
      };
      setCommunicationPreferences(newPrefs);
    }
  }, [user?.preferences?.notifications]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    
    // Update local state immediately for responsive UI
    const newPreferences = {
      ...communicationPreferences,
      [name]: checked,
    };
    setCommunicationPreferences(newPreferences);

    // Log the update for debugging
    console.log(`Updating notification setting: ${name} = ${checked}`);

    // Update backend asynchronously without blocking the UI
    updateNotificationSettings(newPreferences).catch((error) => {
      // Revert local state on error
      setCommunicationPreferences(communicationPreferences);
      const errorMsg = error instanceof Error ? error.message : 'Failed to update notification settings';
      console.error('Failed to update notification settings:', { error, errorMsg });
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      // Log the data being sent for debugging
      const updatePayload = {
        name: formData.fullName,
        phoneNumber: formData.phone,
        country: formData.country,
        dateOfBirth: formData.dateOfBirth,
        profession: formData.profession
      };
      console.log('Sending profile update:', updatePayload);
      
      await updateProfile(updatePayload);
      setIsEditing(false);
      setSuccessMessage('Profile updated successfully!');
      
      // Hide success message after 3 seconds
      setTimeout(() => {
        setSuccessMessage(null);
      }, 3000);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to update profile';
      console.error('Profile update error:', { error, errorMsg });
      setErrorMessage(errorMsg);
      
      // Hide error message after 5 seconds
      setTimeout(() => {
        setErrorMessage(null);
      }, 5000);
    }
  };

  return (
    <div className="space-y-8">
      {/* Success Notification */}
      {successMessage && (
        <div className="fixed top-4 right-4 flex items-center space-x-3 bg-green-500/10 border border-green-500/30 rounded-lg p-4 z-50 animate-in fade-in slide-in-from-top">
          <CheckCircle className="text-green-500" size={20} />
          <span className="text-green-400 font-medium">{successMessage}</span>
        </div>
      )}

      {/* Error Notification */}
      {errorMessage && (
        <div className="fixed top-4 right-4 flex items-center space-x-3 bg-red-500/10 border border-red-500/30 rounded-lg p-4 z-50 animate-in fade-in slide-in-from-top">
          <AlertCircle className="text-red-500" size={20} />
          <span className="text-red-400 font-medium">{errorMessage}</span>
        </div>
      )}

      {/* Personal Information */}
      <div className="glass-card p-8">
        <form onSubmit={handleSubmit}>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-light">Personal Information</h2>
            {isEditing ? (
              <div className="space-x-4">
                <button 
                  type="button"
                  onClick={() => setIsEditing(false)} 
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Save Changes
                </button>
              </div>
            ) : (
              <button 
                type="button"
                onClick={() => setIsEditing(true)} 
                className="btn-primary"
              >
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
                  value={formData.fullName || ''}
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
                  />
                  <Phone className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary" size={16} />
                </div>
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
                  />
                  <Globe className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50" size={16} />
                </div>
              </div>
              
              <div>
                <label className="block text-white/50 text-sm mb-2">Date of Birth</label>
                <div className="relative">
                  <input 
                    type="text"
                    name="dateOfBirth"
                    value={formData.dateOfBirth}
                    onChange={handleInputChange}
                    className="glass-input w-full pr-10"
                    readOnly={!isEditing}
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
                />
              </div>
            </div>
          </div>
        </form>
      </div>

      {/* Verification Progress */}
      <div className="glass-card p-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-light">Identity Verification</h2>
          <div className="flex items-center space-x-2">
            <Award className="text-primary" size={20} />
            <span className="text-primary font-medium">Tier 2 Verified</span>
          </div>
        </div>

        <div className="relative h-2 bg-glass-dark rounded-full mb-8">
          <div className="absolute left-0 top-0 h-full w-2/3 bg-gradient-to-r from-primary to-secondary rounded-full" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="glass-card p-4 border-green-500/20">
            <div className="flex items-center space-x-3 mb-2">
              <Shield className="text-green-500" size={16} />
              <span className="font-medium">Basic Verification</span>
            </div>
            <p className="text-white/50 text-sm">Email and phone verification completed</p>
          </div>

          <div className="glass-card p-4 border-green-500/20">
            <div className="flex items-center space-x-3 mb-2">
              <Shield className="text-green-500" size={16} />
              <span className="font-medium">Identity Verification</span>
            </div>
            <p className="text-white/50 text-sm">Government ID verification completed</p>
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
                <button className="glass-card p-4 flex items-center space-x-2">
                  <Sun size={16} className="text-white/50" />
                  <span>Light</span>
                </button>
              </div>
            </div>

            <div>
              <label className="block text-white/50 text-sm mb-2">Color Accent</label>
              <div className="flex space-x-3">
                <div className="w-8 h-8 rounded-full bg-primary cursor-pointer" />
                <div className="w-8 h-8 rounded-full bg-secondary cursor-pointer" />
                <div className="w-8 h-8 rounded-full bg-purple-500 cursor-pointer" />
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <label className="block text-white/50 text-sm mb-2">Font Size</label>
              <input type="range" className="w-full" />
            </div>

            <div>
              <label className="block text-white/50 text-sm mb-2">Animation Intensity</label>
              <select className="glass-input w-full">
                <option>Full</option>
                <option>Reduced</option>
                <option>None</option>
              </select>
            </div>
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
              <label className="flex items-center justify-between">
                <span className="text-white/70">Security Alerts</span>
                <input
                  type="checkbox"
                  name="securityAlerts"
                  checked={communicationPreferences.securityAlerts}
                  onChange={handleCheckboxChange}
                  className="form-checkbox"
                />
              </label>
              <label className="flex items-center justify-between">
                <span className="text-white/70">Price Alerts</span>
                <input
                  type="checkbox"
                  name="priceAlerts"
                  checked={communicationPreferences.priceAlerts}
                  onChange={handleCheckboxChange}
                  className="form-checkbox"
                />
              </label>
              <label className="flex items-center justify-between">
                <span className="text-white/70">Portfolio Updates</span>
                <input
                  type="checkbox"
                  name="portfolioUpdates"
                  checked={communicationPreferences.portfolioUpdates}
                  onChange={handleCheckboxChange}
                  className="form-checkbox"
                />
              </label>
              <label className="flex items-center justify-between">
                <span className="text-white/70">AI Insights</span>
                <input
                  type="checkbox"
                  name="aiInsights"
                  checked={communicationPreferences.aiInsights}
                  onChange={handleCheckboxChange}
                  className="form-checkbox"
                />
              </label>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-medium mb-4">Push Notifications</h3>
            <div className="space-y-4">
              <label className="flex items-center justify-between">
                <span className="text-white/70">Market Updates</span>
                <input
                  type="checkbox"
                  name="marketUpdates"
                  checked={communicationPreferences.marketUpdates}
                  onChange={handleCheckboxChange}
                  className="form-checkbox"
                />
              </label>
              <label className="flex items-center justify-between">
                <span className="text-white/70">Trade Confirmations</span>
                <input
                  type="checkbox"
                  name="tradeConfirmations"
                  checked={communicationPreferences.tradeConfirmations}
                  onChange={handleCheckboxChange}
                  className="form-checkbox"
                />
              </label>
              <label className="flex items-center justify-between">
                <span className="text-white/70">Account Activity</span>
                <input
                  type="checkbox"
                  name="accountActivity"
                  checked={communicationPreferences.accountActivity}
                  onChange={handleCheckboxChange}
                  className="form-checkbox"
                />
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Linked Accounts */}
      <div className="glass-card p-8">
        <h2 className="text-xl font-light mb-6">Linked Accounts</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 glass-card">
            <div className="flex items-center space-x-3">
              <LinkedIn size={20} className="text-[#0077B5]" />
              <span>LinkedIn</span>
            </div>
            <button className="btn-secondary text-sm">Connected</button>
          </div>

          <div className="flex items-center justify-between p-4 glass-card">
            <div className="flex items-center space-x-3">
              <Google size={20} className="text-[#DB4437]" />
              <span>Google</span>
            </div>
            <button className="btn-primary text-sm">Connect</button>
          </div>

          <div className="flex items-center justify-between p-4 glass-card">
            <div className="flex items-center space-x-3">
              <Wallet size={20} className="text-secondary" />
              <div>
                <div>MetaMask Wallet</div>
                <div className="text-sm text-white/50">0x1234...5678</div>
              </div>
            </div>
            <button className="btn-secondary text-sm">Connected</button>
          </div>
        </div>
      </div>

      {/* Account Statistics */}
      <div className="glass-card p-8">
        <h2 className="text-xl font-light mb-6">Account Statistics</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="glass-card p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-white/70">Account Activity</span>
              <ChartLine size={16} className="text-primary" />
            </div>
            <div className="h-20 bg-glass-dark rounded-lg" />
          </div>

          <div className="glass-card p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-white/70">API Usage</span>
              <span className="text-sm text-secondary">23/100</span>
            </div>
            <div className="relative h-2 bg-glass-dark rounded-full mt-4">
              <div className="absolute left-0 top-0 h-full w-1/4 bg-secondary rounded-full" />
            </div>
          </div>

          <div className="glass-card p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-white/70">Account Health</span>
              <span className="text-sm text-green-500">98%</span>
            </div>
            <div className="relative h-2 bg-glass-dark rounded-full mt-4">
              <div className="absolute left-0 top-0 h-full w-[98%] bg-green-500 rounded-full" />
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
                <p className="text-sm text-white/50">Download your account data</p>
              </div>
              <button className="btn-primary">
                <Download size={16} className="inline mr-2" />
                Export
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-red-500">Delete Account</h3>
                <p className="text-sm text-white/50">Permanently delete your account</p>
              </div>
              <button className="glass-card p-2 hover:bg-red-500/10">
                <Trash2 size={16} className="text-red-500" />
              </button>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="flex items-center justify-between">
                <span className="text-white/70">Data Analytics Sharing</span>
                <input type="checkbox" checked className="form-checkbox" />
              </label>
              <p className="text-sm text-white/50 mt-1">Allow anonymous data collection for service improvement</p>
            </div>

            <div>
              <label className="flex items-center justify-between">
                <span className="text-white/70">Marketing Communications</span>
                <input type="checkbox" className="form-checkbox" />
              </label>
              <p className="text-sm text-white/50 mt-1">Receive personalized offers and updates</p>
            </div>

            <div>
              <label className="flex items-center justify-between">
                <span className="text-white/70">Third-party Integration</span>
                <input type="checkbox" checked className="form-checkbox" />
              </label>
              <p className="text-sm text-white/50 mt-1">Allow connected apps to access your data</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ProfilePage;