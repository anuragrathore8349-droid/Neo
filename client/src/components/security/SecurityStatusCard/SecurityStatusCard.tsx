import React from 'react';
import { Shield, CheckCircle, AlertCircle } from 'lucide-react';

interface SecurityFeature {
  name: string;
  enabled: boolean;
  critical: boolean;
}

interface SecurityStatusCardProps {
  securityScore: number;
  features: SecurityFeature[];
}

const SecurityStatusCard: React.FC<SecurityStatusCardProps> = ({
  securityScore,
  features,
}) => {
  const getScoreColor = () => {
    if (securityScore >= 80) return 'text-[#22DFBF]';
    if (securityScore >= 50) return 'text-[#3D5AF1]';
    return 'text-red-500';
  };

  return (
    <div className="bg-[#1A1B23]/60 backdrop-blur-lg border border-[#3D5AF1]/20 rounded-xl p-6 hover:border-[#3D5AF1]/40 transition-all duration-300">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h3 className="text-xl font-bold text-white mb-2">Security Status</h3>
          <p className="text-gray-400 text-sm">Your account security overview</p>
        </div>
        <Shield className="w-8 h-8 text-[#3D5AF1]" />
      </div>

      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <span className="text-gray-400">Security Score</span>
          <span className={`text-2xl font-bold ${getScoreColor()}`}>
            {securityScore}%
          </span>
        </div>
        <div className="w-full h-2 bg-gray-700 rounded-full">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              securityScore >= 80
                ? 'bg-[#22DFBF]'
                : securityScore >= 50
                ? 'bg-[#3D5AF1]'
                : 'bg-red-500'
            }`}
            style={{ width: `${securityScore}%` }}
          />
        </div>
      </div>

      <div className="space-y-4">
        {features.map((feature, index) => (
          <div
            key={index}
            className="flex items-center justify-between p-3 rounded-lg bg-[#1A1B23]/40"
          >
            <div className="flex items-center gap-3">
              {feature.enabled ? (
                <CheckCircle className="w-5 h-5 text-[#22DFBF]" />
              ) : (
                <AlertCircle
                  className={`w-5 h-5 ${
                    feature.critical ? 'text-red-500' : 'text-[#3D5AF1]'
                  }`}
                />
              )}
              <span className="text-white">{feature.name}</span>
            </div>
            <span
              className={`text-sm ${
                feature.enabled ? 'text-[#22DFBF]' : 'text-gray-400'
              }`}
            >
              {feature.enabled ? 'Enabled' : 'Disabled'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SecurityStatusCard;