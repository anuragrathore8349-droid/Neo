import React from 'react';
import { ArrowUpRight, ArrowDownRight, Timer } from 'lucide-react';

interface PredictionCardProps {
  asset: string;
  currentPrice: number;
  predictedPrice: number;
  confidence: number;
  timeframe: string;
}

const PredictionCard: React.FC<PredictionCardProps> = ({
  asset,
  currentPrice,
  predictedPrice,
  confidence,
  timeframe,
}) => {
  const percentageChange = ((predictedPrice - currentPrice) / currentPrice) * 100;
  const isPositive = percentageChange >= 0;

  return (
    <div className="bg-[#1A1B23]/60 backdrop-blur-lg border border-[#3D5AF1]/20 rounded-xl p-6 hover:border-[#3D5AF1]/40 transition-all duration-300">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-xl font-bold text-white">{asset}</h3>
          <div className="flex items-center gap-2 text-gray-400 mt-1">
            <Timer className="w-4 h-4" />
            <span className="text-sm">{timeframe}</span>
          </div>
        </div>
        {isPositive ? (
          <ArrowUpRight className="w-6 h-6 text-[#22DFBF]" />
        ) : (
          <ArrowDownRight className="w-6 h-6 text-red-500" />
        )}
      </div>

      <div className="space-y-3">
        <div>
          <div className="text-sm text-gray-400">Current Price</div>
          <div className="text-lg font-semibold text-white">
            {currentPrice ? `$${currentPrice.toLocaleString()}` : '—'}
          </div>
        </div>
        <div>
          <div className="text-sm text-gray-400">Predicted Price</div>
          <div className="text-lg font-semibold text-white">
            {predictedPrice ? `$${predictedPrice.toLocaleString()}` : '—'}
          </div>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-gray-700">
        <div className="flex justify-between items-center">
          <div className="text-sm text-gray-400">AI Confidence</div>
          <div
            className={`text-sm font-semibold ${
              confidence >= 70
                ? 'text-[#22DFBF]'
                : confidence >= 40
                ? 'text-yellow-500'
                : 'text-red-500'
            }`}
          >
            {confidence}%
          </div>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-1.5 mt-2">
          <div
            className="bg-[#22DFBF] h-1.5 rounded-full transition-all duration-500"
            style={{ width: `${confidence}%` }}
          />
        </div>
      </div>
    </div>
  );
};

export default PredictionCard;