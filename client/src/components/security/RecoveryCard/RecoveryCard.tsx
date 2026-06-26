import React from 'react';
import { Key, Mail, Phone, Shield } from 'lucide-react';

interface RecoveryOption {
  type: 'email' | 'phone' | 'key';
  value: string;
  verified: boolean;
  primary: boolean;
}

interface RecoveryCardProps {
  options: RecoveryOption[];
  onVerify: (type: string) => void;
  onMakePrimary: (type: string) => void;
}

const RecoveryCard: React.FC<RecoveryCardProps> = ({
  options,
  onVerify,
  onMakePrimary,
}) => {
  const getIcon = (type: string) => {
    switch (type) {
      case 'email':
        return <Mail className="w-5 h-5 text-[#3D5AF1]" />;
      case 'phone':
        return <Phone className="w-5 h-5 text-[#3D5AF1]" />;
      case 'key':
        return <Key className="w-5 h-5 text-[#3D5AF1]" />;
      default:
        return <Shield className="w-5 h-5 text-[#3D5AF1]" />;
    }
  };

  return (
    <div className="bg-[#1A1B23]/60 backdrop-blur-lg border border-[#3D5AF1]/20 rounded-xl p-6 hover:border-[#3D5AF1]/40 transition-all duration-300">
      <h3 className="text-xl font-bold text-white mb-6">Recovery Options</h3>

      <div className="space-y-4">
        {options.map((option, index) => (
          <div
            key={index}
            className="p-4 rounded-lg bg-[#1A1B23]/40 flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              {getIcon(option.type)}
              <div>
                <p className="text-white">{option.value}</p>
                <div className="flex items-center gap-2 mt-1">
                  {option.verified && (
                    <span className="text-xs text-[#22DFBF]">Verified</span>
                  )}
                  {option.primary && (
                    <span className="text-xs text-[#3D5AF1]">Primary</span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {!option.verified && (
                <button
                  onClick={() => onVerify(option.type)}
                  className="px-3 py-1 text-sm rounded-lg bg-[#22DFBF]/10 text-[#22DFBF] hover:bg-[#22DFBF]/20 transition-colors"
                >
                  Verify
                </button>
              )}
              {option.verified && !option.primary && (
                <button
                  onClick={() => onMakePrimary(option.type)}
                  className="px-3 py-1 text-sm rounded-lg bg-[#3D5AF1]/10 text-[#3D5AF1] hover:bg-[#3D5AF1]/20 transition-colors"
                >
                  Make Primary
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default RecoveryCard;