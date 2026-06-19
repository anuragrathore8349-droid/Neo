import React from 'react';
import AnalyticsDashboard from '../components/analytics/AnalyticsDashboard';

const Analytics: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Analytics</h2>
        <div className="flex space-x-2">
          <button className="btn-outline">Export Data</button>
          <button className="btn-primary">Generate Report</button>
        </div>
      </div>
      
      <AnalyticsDashboard />
    </div>
  );
};

export default Analytics;