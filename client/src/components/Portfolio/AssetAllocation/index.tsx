import React from 'react';
import { motion } from 'framer-motion';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { ArrowUpRight, ArrowDownRight, Filter, ChevronDown } from 'lucide-react';
import PageContainer from '../../../components/layout/PageContainer';
import Card from '../../../components/common/Card';
import Button from '../../../components/common/Button/Button';

// Mock data for asset allocation
const assetAllocationData = [
  { name: 'Stocks', value: 45, color: '#3D5AF1' },
  { name: 'Crypto', value: 25, color: '#22DFBF' },
  { name: 'Bonds', value: 15, color: '#F59E0B' },
  { name: 'Cash', value: 10, color: '#8B5CF6' },
  { name: 'Commodities', value: 5, color: '#EC4899' },
];

// Mock data for asset performance
const assetPerformanceData = [
  { 
    name: 'Bitcoin', 
    symbol: 'BTC', 
    allocation: 15, 
    value: 45000, 
    change: 5.2, 
    positive: true,
    color: '#F7931A'
  },
  { 
    name: 'Ethereum', 
    symbol: 'ETH', 
    allocation: 10, 
    value: 3200, 
    change: 3.8, 
    positive: true,
    color: '#627EEA'
  },
  { 
    name: 'Apple Inc.', 
    symbol: 'AAPL', 
    allocation: 12, 
    value: 175.25, 
    change: -1.2, 
    positive: false,
    color: '#A2AAAD'
  },
  { 
    name: 'Microsoft', 
    symbol: 'MSFT', 
    allocation: 11, 
    value: 340.50, 
    change: 2.1, 
    positive: true,
    color: '#00A4EF'
  },
  { 
    name: 'Tesla', 
    symbol: 'TSLA', 
    allocation: 8, 
    value: 240.75, 
    change: -2.5, 
    positive: false,
    color: '#CC0000'
  },
  { 
    name: 'US Treasury Bonds', 
    symbol: 'GOVT', 
    allocation: 15, 
    value: 108.30, 
    change: 0.5, 
    positive: true,
    color: '#6B7280'
  },
  { 
    name: 'Gold', 
    symbol: 'GLD', 
    allocation: 5, 
    value: 1950.40, 
    change: 1.2, 
    positive: true,
    color: '#FFC107'
  },
];

// Custom tooltip for pie chart
const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-dark-800 p-3 rounded-lg border border-dark-700 shadow-lg">
        <p className="font-medium">{payload[0].name}</p>
        <p className="text-primary font-semibold">{`${payload[0].value}%`}</p>
      </div>
    );
  }
  return null;
};

const AssetAllocation: React.FC = () => {
  const [timeframe, setTimeframe] = React.useState('1M');
  const [assetFilter, setAssetFilter] = React.useState('All Assets');

  return (
    <PageContainer>
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">Asset Allocation</h1>
        <p className="text-dark-300">Analyze and optimize your portfolio distribution</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <Card title="Total Portfolio Value" className="lg:col-span-1">
          <div className="flex flex-col">
            <span className="text-3xl font-bold">$248,392.75</span>
            <div className="flex items-center mt-2 text-success">
              <ArrowUpRight size={16} />
              <span className="ml-1">+$12,543.21 (5.3%)</span>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              {['1D', '1W', '1M', '3M', '1Y', 'All'].map((period) => (
                <button
                  key={period}
                  className={`py-1 px-2 rounded-md text-sm ${
                    timeframe === period
                      ? 'bg-primary text-white'
                      : 'bg-dark-700/50 text-dark-300 hover:bg-dark-700'
                  }`}
                  onClick={() => setTimeframe(period)}
                >
                  {period}
                </button>
              ))}
            </div>
          </div>
        </Card>

        <Card title="Asset Allocation" className="lg:col-span-2">
          <div className="flex flex-col md:flex-row items-center">
            <div className="w-full md:w-1/2 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={assetAllocationData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {assetAllocationData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="w-full md:w-1/2 mt-4 md:mt-0">
              <h4 className="font-medium mb-3">Distribution</h4>
              <div className="space-y-3">
                {assetAllocationData.map((asset, index) => (
                  <div key={index} className="flex items-center">
                    <div
                      className="w-3 h-3 rounded-full mr-2"
                      style={{ backgroundColor: asset.color }}
                    ></div>
                    <div className="flex-1 flex justify-between">
                      <span className="text-dark-300">{asset.name}</span>
                      <span className="font-medium">{asset.value}%</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4">
                <Button variant="outline" size="sm" fullWidth>
                  Rebalance Portfolio
                </Button>
              </div>
            </div>
          </div>
        </Card>
      </div>

      <Card 
        title="Asset Performance" 
        actions={
          <div className="flex items-center">
            <div className="relative mr-3">
              <button className="flex items-center bg-dark-700/50 hover:bg-dark-700 rounded-lg px-3 py-1.5 text-sm">
                <Filter size={14} className="mr-2" />
                {assetFilter}
                <ChevronDown size={14} className="ml-2" />
              </button>
            </div>
            <Button variant="primary" size="sm">
              Add Asset
            </Button>
          </div>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-dark-700">
                <th className="text-left py-3 px-4 font-medium text-dark-300">Asset</th>
                <th className="text-right py-3 px-4 font-medium text-dark-300">Allocation</th>
                <th className="text-right py-3 px-4 font-medium text-dark-300">Value</th>
                <th className="text-right py-3 px-4 font-medium text-dark-300">24h Change</th>
                <th className="text-right py-3 px-4 font-medium text-dark-300">Actions</th>
              </tr>
            </thead>
            <tbody>
              {assetPerformanceData.map((asset, index) => (
                <motion.tr
                  key={index}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="border-b border-dark-700/50 hover:bg-dark-700/20"
                >
                  <td className="py-3 px-4">
                    <div className="flex items-center">
                      <div 
                        className="w-8 h-8 rounded-full mr-3 flex items-center justify-center"
                        style={{ backgroundColor: `${asset.color}20` }}
                      >
                        <div 
                          className="w-6 h-6 rounded-full"
                          style={{ backgroundColor: asset.color }}
                        ></div>
                      </div>
                      <div>
                        <div className="font-medium">{asset.name}</div>
                        <div className="text-dark-400 text-sm">{asset.symbol}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right">{asset.allocation}%</td>
                  <td className="py-3 px-4 text-right font-medium">
                    ${asset.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className={`py-3 px-4 text-right ${asset.positive ? 'text-success' : 'text-error'}`}>
                    <div className="flex items-center justify-end">
                      {asset.positive ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                      <span className="ml-1">{asset.change}%</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex justify-end space-x-2">
                      <button className="text-primary hover:text-primary-light text-sm">Details</button>
                      <button className="text-primary hover:text-primary-light text-sm">Trade</button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <Card title="Diversification Score" gradient>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-4xl font-bold">78/100</div>
              <p className="text-dark-300 mt-1">Good diversification</p>
            </div>
            <div className="w-24 h-24 relative">
              <svg viewBox="0 0 100 100" className="w-full h-full">
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  stroke="#1E293B"
                  strokeWidth="10"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  stroke="#3D5AF1"
                  strokeWidth="10"
                  strokeDasharray="251.2"
                  strokeDashoffset="55.264"
                  transform="rotate(-90 50 50)"
                />
              </svg>
            </div>
          </div>
          <div className="mt-4">
            <h4 className="font-medium mb-2">Recommendations</h4>
            <ul className="space-y-2 text-dark-300">
              <li className="flex items-start">
                <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 mr-2"></div>
                <span>Consider adding more bonds to reduce volatility</span>
              </li>
              <li className="flex items-start">
                <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 mr-2"></div>
                <span>Your tech exposure is slightly high at 32%</span>
              </li>
            </ul>
          </div>
        </Card>

        <Card title="Risk Analysis" gradient>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-4xl font-bold">Moderate</div>
              <p className="text-dark-300 mt-1">Balanced risk profile</p>
            </div>
            <div className="w-24 h-24 relative">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-20 h-20 rounded-full bg-dark-700/50 flex items-center justify-center">
                  <div className="w-16 h-16 rounded-full bg-dark-800 flex items-center justify-center">
                    <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                      <div className="w-8 h-8 rounded-full bg-primary/40"></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-4">
            <h4 className="font-medium mb-2">Risk Factors</h4>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-dark-300">Volatility</span>
                  <span>Medium</span>
                </div>
                <div className="w-full bg-dark-700 rounded-full h-2">
                  <div className="bg-primary h-2 rounded-full" style={{ width: '60%' }}></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-dark-300">Market Risk</span>
                  <span>Medium-High</span>
                </div>
                <div className="w-full bg-dark-700 rounded-full h-2">
                  <div className="bg-primary h-2 rounded-full" style={{ width: '75%' }}></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-dark-300">Liquidity Risk</span>
                  <span>Low</span>
                </div>
                <div className="w-full bg-dark-700 rounded-full h-2">
                  <div className="bg-primary h-2 rounded-full" style={{ width: '30%' }}></div>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </PageContainer>
  );
};

export default AssetAllocation;