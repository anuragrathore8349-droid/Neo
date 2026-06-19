import React from 'react';
import { Lock, ToggleLeft as Toggle } from 'lucide-react';

interface Permission {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  critical: boolean;
}

interface PermissionCardProps {
  permission: Permission;
  onToggle: (id: string) => void;
}

const PermissionCard: React.FC<PermissionCardProps> = ({
  permission,
  onToggle,
}) => {
  return (
    <div className="bg-[#1A1B23]/60 backdrop-blur-lg border border-[#3D5AF1]/20 rounded-xl p-4 hover:border-[#3D5AF1]/40 transition-all duration-300">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <Lock className={`w-6 h-6 ${permission.critical ? 'text-red-500' : 'text-[#3D5AF1]'}`} />
          <div>
            <h4 className="text-white font-medium">{permission.name}</h4>
            <p className="text-sm text-gray-400 mt-1">{permission.description}</p>
          </div>
        </div>

        <button
          onClick={() => onToggle(permission.id)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            permission.enabled ? 'bg-[#22DFBF]' : 'bg-gray-600'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              permission.enabled ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>
    </div>
  );
};

export default PermissionCard;