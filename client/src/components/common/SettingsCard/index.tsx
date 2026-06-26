import React from 'react';

interface SettingsCardProps {
  title: string;
  description?: string;
  children: React.ReactNode;
}

const SettingsCard: React.FC<SettingsCardProps> = ({ title, description, children }) => {
  return (
    <div className="backdrop-blur-md bg-slate-900/50 rounded-xl border border-slate-800/50 p-6 mb-6 hover:border-[#22DFBF]/30 transition-all duration-300">
      <h3 className="text-xl font-semibold text-white mb-2">{title}</h3>
      {description && (
        <p className="text-slate-400 mb-4 text-sm">{description}</p>
      )}
      <div className="space-y-4">
        {children}
      </div>
    </div>
  );
};

export default SettingsCard;