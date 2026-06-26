import React from 'react';
import { Brain, TrendingUp, AlertTriangle, Newspaper, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import GlassCard from '../common/GlassCard';
import { AiInsight } from '../../types';
import { motion } from 'framer-motion';

interface AiInsightsProps {
  insights: AiInsight[];
}

const AiInsights: React.FC<AiInsightsProps> = ({ insights }) => {
  const navigate = useNavigate();

  const getIcon = (type: string) => {
    switch (type) {
      case 'prediction':     return <Brain size={15} className="text-primary" />;
      case 'recommendation': return <TrendingUp size={15} className="text-green-400" />;
      case 'alert':          return <AlertTriangle size={15} className="text-amber-400" />;
      case 'news':           return <Newspaper size={15} className="text-blue-400" />;
      default:               return <Brain size={15} className="text-primary" />;
    }
  };

  const getIconBg = (type: string) => {
    switch (type) {
      case 'prediction':     return 'bg-primary/10';
      case 'recommendation': return 'bg-green-400/10';
      case 'alert':          return 'bg-amber-400/10';
      case 'news':           return 'bg-blue-400/10';
      default:               return 'bg-primary/10';
    }
  };

  const getActionStyle = (action?: string) => {
    switch (action) {
      case 'buy':  return 'bg-green-400/10 text-green-400 border-green-400/20';
      case 'sell': return 'bg-red-400/10 text-red-400 border-red-400/20';
      case 'hold': return 'bg-amber-400/10 text-amber-400 border-amber-400/20';
      default:     return 'bg-primary/10 text-primary border-primary/20';
    }
  };

  const displayInsights = insights.slice(0, 4);

  return (
    <GlassCard className="p-5">
      <div className="flex justify-between items-center mb-4 gap-2">
        <h3 className="text-sm sm:text-base font-semibold text-white truncate">AI Insights</h3>
        <div className="flex items-center gap-1 text-primary text-xs flex-shrink-0">
          <Brain size={13} />
          <span className="hidden sm:inline">NeoAI</span>
        </div>
      </div>

      {displayInsights.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-gray-500">
          <Brain size={28} className="mb-2 opacity-30" />
          <p className="text-sm">No insights available</p>
        </div>
      ) : (
        <div className="space-y-2 sm:space-y-3">
          {displayInsights.map((insight, i) => (
            <motion.div
              key={insight.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: i * 0.05 }}
              className="p-2 sm:p-3 rounded-xl bg-dark-800/40 hover:bg-dark-800/70 border border-transparent hover:border-dark-700 transition-all cursor-pointer"
            >
              <div className="flex items-start gap-2 sm:gap-3">
                <div className={`w-6 h-6 sm:w-7 sm:h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${getIconBg(insight.type)}`}>
                  {getIcon(insight.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start gap-1 flex-wrap">
                    <p className="font-medium text-white text-xs sm:text-sm leading-tight break-words flex-1">{insight.title}</p>
                    {insight.action && (
                      <span className={`text-xs px-1.5 sm:px-2 py-0.5 rounded-full border font-medium flex-shrink-0 uppercase ${getActionStyle(insight.action)}`}>
                        {insight.action}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-1 line-clamp-2">{insight.description}</p>

                  <div className="flex items-center justify-between mt-1.5 sm:mt-2 flex-wrap gap-1">
                    {insight.asset && (
                      <span className="text-xs text-gray-500">{insight.asset.symbol}</span>
                    )}
                    <div className="flex items-center gap-1 ml-auto flex-shrink-0">
                      <span className="text-xs text-gray-500">{insight.confidence}%</span>
                      <div className="h-1 w-10 sm:w-14 bg-dark-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full"
                          style={{ width: `${insight.confidence}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <button
        onClick={() => navigate('/ai-insights')}
        className="w-full mt-3 sm:mt-4 py-2 sm:py-2.5 flex items-center justify-center gap-2 text-xs sm:text-sm font-medium text-primary border border-primary/20 rounded-xl hover:bg-primary/10 hover:border-primary/40 transition-all whitespace-nowrap"
      >
        View All Insights
        <ExternalLink size={13} />
      </button>
    </GlassCard>
  );
};

export default AiInsights;