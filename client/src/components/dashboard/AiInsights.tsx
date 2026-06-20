import React from 'react';
import { Brain, TrendingUp, TrendingDown, AlertTriangle, Newspaper } from 'lucide-react';
import GlassCard from '../common/GlassCard';
import { AiInsight } from '../../types';
import { motion } from 'framer-motion';

interface AiInsightsProps {
  insights: AiInsight[];
}

const AiInsights: React.FC<AiInsightsProps> = ({ insights }) => {
  const getIcon = (type: string) => {
    switch (type) {
      case 'prediction':
        return <Brain size={18} className="text-primary" />;
      case 'recommendation':
        return <TrendingUp size={18} className="text-secondary" />;
      case 'alert':
        return <AlertTriangle size={18} className="text-amber-500" />;
      case 'news':
        return <Newspaper size={18} className="text-blue-400" />;
      default:
        return <Brain size={18} className="text-primary" />;
    }
  };

  const getActionColor = (action?: string) => {
    switch (action) {
      case 'buy':
        return 'text-secondary';
      case 'sell':
        return 'text-red-500';
      case 'hold':
        return 'text-amber-500';
      default:
        return 'text-primary';
    }
  };

  return (
    <GlassCard className="p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-semibold">AI Insights</h3>
        <div className="flex items-center space-x-1 text-primary">
          <Brain size={16} />
          <span className="text-sm font-medium">Powered by NeoAI</span>
        </div>
      </div>
      
      <div className="space-y-4">
        {insights.map((insight) => (
          <motion.div 
            key={insight.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="bg-dark-800/50 rounded-lg p-4 border border-dark-700 hover:border-primary/30 transition-all cursor-pointer"
          >
            <div className="flex items-start">
              <div className="bg-dark-700 p-2 rounded-lg mr-3">
                {getIcon(insight.type)}
              </div>
              <div className="flex-1">
                <div className="flex justify-between">
                  <h4 className="font-medium">{insight.title}</h4>
                  <span className="text-xs text-dark-400">{insight.date}</span>
                </div>
                <p className="text-sm text-dark-300 mt-1">{insight.description}</p>
                
                {insight.asset && (
                  <div className="flex justify-between items-center mt-2 text-sm">
                    <div className="flex items-center">
                      <span className="font-medium mr-1">{insight.asset.symbol}</span>
                      <span className="text-dark-400">{insight.asset.name}</span>
                    </div>
                    {insight.action && (
                      <span className={`font-medium ${getActionColor(insight.action)}`}>
                        {insight.action.toUpperCase()}
                      </span>
                    )}
                  </div>
                )}
                
                <div className="mt-2 flex justify-between items-center">
                  <div className="bg-dark-900/50 px-2 py-1 rounded text-xs">
                    {insight.type.charAt(0).toUpperCase() + insight.type.slice(1)}
                  </div>
                  <div className="flex items-center">
                    <span className="text-xs text-dark-400 mr-2">Confidence</span>
                    <div className="h-1.5 w-20 bg-dark-700 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-primary rounded-full"
                        style={{ width: `${insight.confidence}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
      
      <button className="w-full mt-4 py-2 text-sm font-medium text-primary border border-primary/30 rounded-lg hover:bg-primary/10 transition-all">
        View All Insights
      </button>
    </GlassCard>
  );
};

export default AiInsights;