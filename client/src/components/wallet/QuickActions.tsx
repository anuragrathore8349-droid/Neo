import React from 'react';
import { RefreshCw, Book, Shield } from 'lucide-react';
import GlassCard from '../common/GlassCard';

interface QuickActionsProps {
  onSwap?:        () => void;
  onAddressBook?: () => void;
  onSecurity?:    () => void;
}

const QuickActions: React.FC<QuickActionsProps> = ({ onSwap, onAddressBook, onSecurity }) => {
  const actions = [
    { icon: <RefreshCw size={18} className="text-primary"/>, bg: 'bg-primary/20',    label: 'Swap Tokens',     sub: 'Exchange tokens instantly',     fn: onSwap },
    { icon: <Book      size={18} className="text-secondary"/>,bg: 'bg-secondary/20', label: 'Address Book',    sub: 'Manage saved addresses',        fn: onAddressBook },
    { icon: <Shield    size={18} className="text-purple-500"/>,bg:'bg-purple-500/20',label: 'Security Settings',sub: 'Review security options',       fn: onSecurity },
  ];

  return (
    <GlassCard className="p-6 mt-6">
      <h3 className="text-xl font-semibold mb-4">Quick Actions</h3>
      <div className="space-y-3">
        {actions.map(({ icon, bg, label, sub, fn }) => (
          <button
            key={label}
            onClick={fn}
            disabled={!fn}
            className="w-full p-3 bg-dark-800/50 rounded-lg hover:bg-dark-800 transition-all text-left disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <div className="flex items-center">
              <div className={`${bg} p-2 rounded-lg mr-3`}>{icon}</div>
              <div>
                <p className="font-medium">{label}</p>
                <p className="text-dark-400 text-sm">{sub}</p>
              </div>
            </div>
          </button>
        ))}
      </div>
    </GlassCard>
  );
};

export default QuickActions;