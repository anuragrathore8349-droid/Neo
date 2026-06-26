import React from 'react';
import { LineChart, Lightbulb, ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface MarketInsightCardProps {
  title: string;
  description: string;
  impact: 'positive' | 'negative' | 'neutral';
  confidence: number;
  tags: string[];
  timestamp: string;
}

const MarketInsightCard: React.FC<MarketInsightCardProps> = ({
  title,
  description,
  impact,
  confidence,
  tags,
  timestamp,
}) => {
  const getImpactColor = () => {
    switch (impact) {
      case 'positive':
        return 'text-[#22DFBF]';
      case 'negative':
        return 'text-red-500';
      default:
        return 'text-gray-400';
    }
  };

  const ImpactIcon = impact === 'positive' ? ArrowUpRight : ArrowDownRight;
  const displayConf = confidence <= 1 ? Math.round(confidence * 100) : Math.round(confidence);

  return (
    <div className="bg-[#1A1B23]/60 backdrop-blur-lg border border-[#3D5AF1]/20 rounded-xl p-6 hover:border-[#3D5AF1]/40 transition-all duration-300">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <Lightbulb className="w-5 h-5 text-[#3D5AF1]" />
          <h3 className="text-lg font-semibold text-white">{title}</h3>
        </div>
        <ImpactIcon className={`w-5 h-5 ${getImpactColor()}`} />
      </div>

      <p className="text-gray-400 text-sm mb-4">{description}</p>

      <div className="flex flex-wrap gap-2 mb-4">
        {tags.map((tag, index) => (
          <span
            key={index}
            className="px-2 py-1 rounded-full bg-[#3D5AF1]/10 text-[#3D5AF1] text-xs"
          >
            {tag}
          </span>
        ))}
      </div>

      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <LineChart className="w-4 h-4 text-[#3D5AF1]" />
          <span className="text-gray-400">Confidence: </span>
          <span className={`font-medium ${getImpactColor()}`}>{displayConf}%</span>
        </div>
        <span className="text-gray-500">{timestamp}</span>
      </div>
    </div>
  );
};

export default MarketInsightCard;