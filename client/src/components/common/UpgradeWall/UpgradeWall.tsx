import React from 'react';
import { Lock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface UpgradeWallProps {
  feature: string;
  requiredPlan: 'Pro' | 'Enterprise';
  description?: string;
}

const UpgradeWall: React.FC<UpgradeWallProps> = ({
  feature,
  requiredPlan,
  description,
}) => {
  const navigate = useNavigate();
  const isEnterprise = requiredPlan === 'Enterprise';

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-6">
      <div className="bg-dark-800 border border-dark-700 rounded-2xl p-10 max-w-md w-full shadow-xl">
        <div className="flex justify-center mb-4">
          <div className={`h-16 w-16 rounded-full flex items-center justify-center ${
            isEnterprise ? 'bg-yellow-500/10' : 'bg-primary/10'
          }`}>
            <Lock size={32} className={isEnterprise ? 'text-yellow-400' : 'text-primary'} />
          </div>
        </div>

        <div className={`inline-block text-xs font-semibold px-3 py-1 rounded-full mb-3 ${
          isEnterprise
            ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
            : 'bg-primary/20 text-primary border border-primary/30'
        }`}>
          {requiredPlan} Plan Required
        </div>

        <h2 className="text-xl font-bold text-white mb-2">{feature}</h2>
        <p className="text-dark-300 mb-6 text-sm leading-relaxed">
          {description || `${feature} is available on the ${requiredPlan} plan${isEnterprise ? '' : ' and above'}.`}
        </p>

        <button
          onClick={() => navigate('/select-plan')}
          className={`w-full py-3 rounded-xl text-white font-semibold transition-colors mb-3 ${
            isEnterprise
              ? 'bg-yellow-600 hover:bg-yellow-700'
              : 'bg-primary hover:bg-primary/90'
          }`}
        >
          Upgrade to {requiredPlan}
        </button>
        <button
          onClick={() => navigate(-1)}
          className="w-full py-2 rounded-xl bg-transparent text-dark-400 hover:text-white transition-colors text-sm"
        >
          Go Back
        </button>
      </div>
    </div>
  );
};

export default UpgradeWall;