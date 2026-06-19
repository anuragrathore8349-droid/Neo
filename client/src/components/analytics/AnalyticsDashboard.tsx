import React, { useEffect, useState } from 'react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import {
  TrendingUp, Calendar, ChevronDown, Filter, Download, Activity
} from 'lucide-react';
import GlassCard from '../common/GlassCard';

// ---- TYPES ----
interface MarketChartPoint {
  timestamp: number;
  price: number;
}

interface PortfolioPoint {
  month: string;
  portfolio: number;
  benchmark: number;
}

// ---- COMPONENT ----
const AnalyticsDashboard: React.FC = () => {
  const [data, setData] = useState<PortfolioPoint[]>([]);
  const [loading, setLoading] = useState(true);

  // ---- FETCH REAL DATA (BTC from CoinGecko) ----
  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch(
          'https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=365'
        );
        const json = await res.json();

        const prices: [number, number][] = json.prices;

        // Convert to monthly buckets
        const monthly: Record<string, number> = {};

        prices.forEach(([timestamp, price]) => {
          const date = new Date(timestamp);
          const month = date.toLocaleString('default', { month: 'short' });

          monthly[month] = price;
        });

        const formatted: PortfolioPoint[] = Object.keys(monthly).map(
          (month, i) => ({
            month,
            portfolio: monthly[month],
            benchmark: monthly[month] * 0.9 // simple benchmark comparison
          })
        );

        setData(formatted);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // ---- RETURNS CALCULATION ----
  const calculateReturns = (data: PortfolioPoint[]) => {
    return data.map((item, index) => {
      if (index === 0) {
        return { ...item, portfolioReturn: 0, benchmarkReturn: 0 };
      }

      const prev = data[index - 1];

      return {
        ...item,
        portfolioReturn:
          ((item.portfolio - prev.portfolio) / prev.portfolio) * 100,
        benchmarkReturn:
          ((item.benchmark - prev.benchmark) / prev.benchmark) * 100
      };
    });
  };

  const returnsData = calculateReturns(data);

  const formatCurrency = (value: number) =>
    `$${Math.round(value).toLocaleString()}`;

  const formatPercentage = (value: number) =>
    `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;

  if (loading) {
    return <div className="text-white p-6">Loading real market data...</div>;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-6">

        {/* ---- PERFORMANCE ---- */}
        <GlassCard className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-semibold">BTC Performance (Live)</h3>
            <button className="p-2 bg-dark-800 rounded-lg">
              <Download size={18} />
            </button>
          </div>

          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#323B4E" />
                <XAxis dataKey="month" />
                <YAxis tickFormatter={(v) => `$${v / 1000}k`} />
                <Tooltip formatter={(v: any) => formatCurrency(v)} />
                <Legend />

                <Area
                  type="monotone"
                  dataKey="portfolio"
                  stroke="#3D5AF1"
                  fillOpacity={0.2}
                  fill="#3D5AF1"
                  name="BTC Price"
                />
                <Area
                  type="monotone"
                  dataKey="benchmark"
                  stroke="#22DFBF"
                  fillOpacity={0.2}
                  fill="#22DFBF"
                  name="Benchmark"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>

        {/* ---- RETURNS ---- */}
        <GlassCard className="p-6">
          <h3 className="text-xl font-semibold mb-6">Monthly Returns</h3>

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={returnsData.slice(1)}>
                <CartesianGrid strokeDasharray="3 3" stroke="#323B4E" />
                <XAxis dataKey="month" />
                <YAxis tickFormatter={(v) => `${v}%`} />
                <Tooltip formatter={(v: any) => formatPercentage(v)} />
                <Legend />

                <Bar dataKey="portfolioReturn" fill="#3D5AF1" name="BTC" />
                <Bar dataKey="benchmarkReturn" fill="#22DFBF" name="Benchmark" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>
      </div>

      {/* ---- RIGHT SIDE ---- */}
      <div className="space-y-6">

        {/* ---- LIVE PRICE CARD ---- */}
        <GlassCard className="p-6">
          <h3 className="text-xl font-semibold mb-4">Live BTC Snapshot</h3>

          <div className="text-3xl font-bold text-white">
            {formatCurrency(data[data.length - 1].portfolio)}
          </div>

          <p className="text-gray-400 mt-2">
            Latest market price (CoinGecko)
          </p>
        </GlassCard>

        {/* ---- SIMPLE DISTRIBUTION ---- */}
        <GlassCard className="p-6">
          <h3 className="text-xl font-semibold mb-4">Portfolio</h3>

          <PieChart width={250} height={250}>
            <Pie
              data={[
                { name: 'BTC', value: 100 }
              ]}
              cx="50%"
              cy="50%"
              outerRadius={80}
              dataKey="value"
            >
              <Cell fill="#F7931A" />
            </Pie>
          </PieChart>

          <p className="text-center text-gray-400 mt-2">
            100% BTC (live tracking)
          </p>
        </GlassCard>

        {/* ---- ACTIVITY ---- */}
        <GlassCard className="p-6">
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-semibold">Live Status</h3>
            <Activity className="text-green-400" />
          </div>

          <p className="text-green-400 mt-3">
            Connected to CoinGecko API
          </p>
        </GlassCard>

      </div>
    </div>
  );
};

export default AnalyticsDashboard;