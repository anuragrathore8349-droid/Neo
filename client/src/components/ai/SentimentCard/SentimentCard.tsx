import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface SentimentCardProps {
  sentiment: 'positive' | 'negative' | 'neutral';
  score: number;
  change: number;
  asset: string;
}

const SentimentCard: React.FC<SentimentCardProps> = ({
  sentiment,
  score,
  change,
  asset,
}) => {
  const getSentimentColor = () => {
    switch (sentiment) {
      case 'positive':
        return 'bg-[#22DFBF]/10 border-[#22DFBF]/30 text-[#22DFBF]';
      case 'negative':
        return 'bg-red-500/10 border-red-500/30 text-red-500';
      default:
        return 'bg-gray-500/10 border-gray-500/30 text-gray-500';
    }
  };

  const displayScore = score <= 1 ? Math.round(score * 100) : Math.round(score);

  return (
    <div
      className={`rounded-xl border backdrop-blur-md p-4 ${getSentimentColor()}`}
    >
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-lg font-semibold">{asset}</h3>
        {change >= 0 ? (
          <TrendingUp className="w-5 h-5 text-[#22DFBF]" />
        ) : (
          <TrendingDown className="w-5 h-5 text-red-500" />
        )}
      </div>
      <div className="text-3xl font-bold mb-2">{displayScore}%</div>
      <div className="text-sm opacity-80">
        {change >= 0 ? '+' : ''}{change}% change
      </div>
    </div>
  );
};

export default SentimentCard;