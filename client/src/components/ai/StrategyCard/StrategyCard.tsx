import React from 'react';
import { Target, TrendingUp, AlertTriangle, Clock } from 'lucide-react';

interface StrategyCardProps {
  title: string;
  type: 'aggressive' | 'moderate' | 'conservative';
  expectedReturn: number;
  riskLevel: number;
  timeframe: string;
  description: string;
  actions: string[];
}

const StrategyCard: React.FC<StrategyCardProps> = ({
  title,
  type,
  expectedReturn,
  riskLevel,
  timeframe,
  description,
  actions,
}) => {
  const getTypeStyles = () => {
    switch (type) {
      case 'aggressive':
        return 'border-red-500/30 bg-red-500/5';
      case 'moderate':
        return 'border-[#3D5AF1]/30 bg-[#3D5AF1]/5';
      case 'conservative':
        return 'border-[#22DFBF]/30 bg-[#22DFBF]/5';
    }
  };

  const getTypeColor = () => {
    switch (type) {
      case 'aggressive':
        return 'text-red-500';
      case 'moderate':
        return 'text-[#3D5AF1]';
      case 'conservative':
        return 'text-[#22DFBF]';
    }
  };

  return (
    <div className={`rounded-xl border ${getTypeStyles()} p-6 backdrop-blur-lg`}>
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
          <span className={`text-sm font-medium capitalize ${getTypeColor()}`}>
            {type} Strategy
          </span>
        </div>
        <Target className={`w-6 h-6 ${getTypeColor()}`} />
      </div>

      <p className="text-gray-400 text-sm mb-6">{description}</p>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="text-center">
          <div className="flex items-center justify-center mb-2">
            <TrendingUp className={`w-5 h-5 ${getTypeColor()}`} />
          </div>
          <div className="text-white font-bold">{expectedReturn}%</div>
          <div className="text-xs text-gray-400">Expected Return</div>
        </div>
        <div className="text-center">
          <div className="flex items-center justify-center mb-2">
            <AlertTriangle className={`w-5 h-5 ${getTypeColor()}`} />
          </div>
          <div className="text-white font-bold">{riskLevel}/10</div>
          <div className="text-xs text-gray-400">Risk Level</div>
        </div>
        <div className="text-center">
          <div className="flex items-center justify-center mb-2">
            <Clock className={`w-5 h-5 ${getTypeColor()}`} />
          </div>
          <div className="text-white font-bold">{timeframe}</div>
          <div className="text-xs text-gray-400">Timeframe</div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-sm font-medium text-white mb-2">Recommended Actions:</div>
        {actions.map((action, index) => (
          <div
            key={index}
            className="text-sm text-gray-400 flex items-center gap-2"
          >
            <div className={`w-1.5 h-1.5 rounded-full ${getTypeColor()}`} />
            {action}
          </div>
        ))}
      </div>
    </div>
  );
};

export default StrategyCard;