import React, { useEffect, useState } from 'react';
import { TrendingDown, FileDown, Sparkles, Loader2, AlertTriangle } from 'lucide-react';
import GlassCard from '../../common/GlassCard';
import aiService from '../../../services/ai.service';
import { generateWeeklyReportPdf, WeeklyReportData } from '../../../utils/weeklyReportPdf';

/**
 * TaxLossHarvesting widget — shows live, real tax-loss harvesting
 * opportunities computed by the server's deterministic reasoning engine,
 * with an optional AI narrative, plus a one-click "AI Weekly Report" PDF
 * export (the Enterprise upsell driver).
 */
const TaxLossHarvestingPanel: React.FC<{ className?: string }> = ({ className = '' }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);
  const [reportLoading, setReportLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    aiService
      .getTaxLossHarvesting()
      .then((res) => mounted && setData(res))
      .catch((err) => mounted && setError(err?.message || 'Failed to load tax-loss data'))
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, []);

  const handleDownloadReport = async () => {
    setReportLoading(true);
    try {
      const report: WeeklyReportData = await aiService.getWeeklyReport();
      generateWeeklyReportPdf(report);
    } catch (err) {
      console.error('Failed to generate weekly report PDF:', err);
    } finally {
      setReportLoading(false);
    }
  };

  return (
    <GlassCard className={`p-6 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <TrendingDown className="w-5 h-5 text-rose-400" />
          <h3 className="text-lg font-semibold">Tax-Loss Harvesting</h3>
        </div>
        <button
          onClick={handleDownloadReport}
          disabled={reportLoading}
          className="flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 transition-colors disabled:opacity-50"
        >
          {reportLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
          AI Weekly Report (PDF)
        </button>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <Loader2 className="w-4 h-4 animate-spin" /> Scanning your portfolio for losses…
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-sm text-rose-400">
          <AlertTriangle className="w-4 h-4" /> {error}
        </div>
      )}

      {!loading && !error && data && (
        <>
          {data.opportunityCount === 0 ? (
            <p className="text-sm text-gray-400">No tax-loss harvesting opportunities right now — none of your positions are showing an unrealised loss.</p>
          ) : (
            <>
              <div className="mb-3 text-sm text-gray-300">
                <span className="font-semibold text-emerald-400">
                  ${data.totalPotentialTaxSavings.toLocaleString()}
                </span>{' '}
                in estimated potential tax savings across {data.opportunityCount} position
                {data.opportunityCount > 1 ? 's' : ''}.
              </div>

              <div className="space-y-2 mb-3">
                {data.opportunities.slice(0, 5).map((o: any) => (
                  <div key={o.symbol} className="flex items-center justify-between text-sm bg-white/5 rounded-lg px-3 py-2">
                    <div>
                      <span className="font-medium">{o.symbol}</span>{' '}
                      <span className="text-rose-400">-${o.lossAmount.toLocaleString()}</span>
                      {o.suggestedSwap && (
                        <span className="text-gray-400"> → swap into {o.suggestedSwap.suggestedSymbol}</span>
                      )}
                    </div>
                    <span className="text-emerald-400">+${o.estimatedTaxSavings.toLocaleString()} savings</span>
                  </div>
                ))}
              </div>

              <div className="flex items-start gap-2 text-xs text-gray-400 bg-white/5 rounded-lg p-3">
                <Sparkles className={`w-4 h-4 mt-0.5 ${data.narrativeSource === 'ai' ? 'text-indigo-400' : 'text-gray-500'}`} />
                <p>{data.narrative}</p>
              </div>
            </>
          )}

          <p className="text-[10px] text-gray-500 mt-3">
            Not tax advice. Methodology: {data.methodology || 'deterministic-rule-based'} — consult a tax professional before acting.
          </p>
        </>
      )}
    </GlassCard>
  );
};

export default TaxLossHarvestingPanel;
