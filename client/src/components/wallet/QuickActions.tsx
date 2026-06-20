import React from 'react';
import { RefreshCw, Book, Shield, Send } from 'lucide-react';
import GlassCard from '../common/GlassCard';

interface QuickActionsProps {
  onSend?:        () => void;
  onAddressBook?: () => void;
  onSecurity?:    () => void;
}

const QuickActions: React.FC<QuickActionsProps> = ({ onSend, onAddressBook, onSecurity }) => {
  const actions = [
    { icon: <Send size={18} className="text-blue-500"/>, bg: 'bg-blue-500/20', label: 'Send', sub: 'Send crypto to address', fn: onSend },
    { icon: <Book size={18} className="text-secondary"/>, bg: 'bg-secondary/20', label: 'Address Book', sub: 'Manage saved addresses', fn: onAddressBook },
    { icon: <Shield size={18} className="text-purple-500"/>, bg: 'bg-purple-500/20', label: 'Security', sub: 'Wallet security settings', fn: onSecurity },
  ];

  return (
    <GlassCard className="p-6">
      <h3 className="text-xl font-semibold mb-4">Quick Actions</h3>
      <div className="grid grid-cols-3 gap-3">
        {actions.map(({ icon, bg, label, sub, fn }) => (
          <button
            key={label}
            onClick={fn}
            disabled={!fn}
            className="p-4 bg-dark-800/50 rounded-lg hover:bg-dark-800 transition-all text-center disabled:opacity-40 disabled:cursor-not-allowed group"
          >
            <div className={`${bg} p-2 rounded-lg mx-auto mb-2 group-hover:scale-110 transition`}>{icon}</div>
            <p className="font-medium text-sm">{label}</p>
            <p className="text-dark-400 text-xs mt-1">{sub}</p>
          </button>
        ))}
      </div>
    </GlassCard>
  );
};

export default QuickActions;