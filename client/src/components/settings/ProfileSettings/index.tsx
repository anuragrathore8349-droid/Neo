import React, { useEffect, useState } from 'react';
import { Camera } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import SettingsCard from '../../common/SettingsCard';

const ProfileSettings = () => {
  const { user, updateProfile } = useAuth();
  const [profile, setProfile] = useState({
    name: user?.name || '', // Dynamically use logged-in user's name
    email: user?.email || '', // Dynamically use logged-in user's email
    avatar: user?.avatar || 'https://images.unsplash.com/photo-1633332755192-727a05c4013d?w=400&h=400&fit=crop',
    bio: user?.bio || '',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  useEffect(() => {
    if (user) {
      setProfile({
        name: user.name || '',
        email: user.email || '',
        avatar: user.avatar || 'https://images.unsplash.com/photo-1633332755192-727a05c4013d?w=400&h=400&fit=crop',
        bio: user.bio || '',
      });
    }
  }, [user]);

  const handleSave = async () => {
    setIsSaving(true);
    setStatusMessage('');

    try {
      await updateProfile({
        name: profile.name,
        bio: profile.bio,
        avatar: profile.avatar
      });
      setStatusMessage('Profile updated successfully');
    } catch {
      setStatusMessage('Unable to save profile. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SettingsCard
      title="Profile Information"
      description="Manage your personal information and public profile"
    >
      <div className="flex flex-col space-y-6">
        <div className="flex items-start space-x-6">
          <div className="relative group">
            <img
              src={profile.avatar}
              alt="Profile"
              className="w-24 h-24 rounded-full object-cover border-2 border-[#3D5AF1]"
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
              <Camera className="w-6 h-6 text-white" />
            </div>
          </div>
          
          <div className="flex-1 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">
                Full Name
              </label>
              <input
                type="text"
                value={profile.name}
                onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-[#22DFBF] transition-colors"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">
                Email Address
              </label>
              <input
                type="email"
                value={profile.email}
                readOnly
                className="w-full bg-slate-900/40 border border-slate-700 rounded-lg px-4 py-2 text-white cursor-not-allowed"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">
                Bio
              </label>
              <textarea
                value={profile.bio}
                onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
                rows={3}
                className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-[#22DFBF] transition-colors"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end space-x-3">
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
      </div>
    </SettingsCard>
  );
};

export default ProfileSettings;