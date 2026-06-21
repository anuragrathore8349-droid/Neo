import React from 'react';
import { Clock, MapPin, Monitor, AlertTriangle } from 'lucide-react';

interface ActivityLog {
  id: string;
  type: 'login' | 'transaction' | 'settings_change' | 'security_alert';
  description: string;
  location: string;
  device: string;
  timestamp: string;
  critical?: boolean;
}

interface ActivityLogCardProps {
  activities: ActivityLog[];
}

const ActivityLogCard: React.FC<ActivityLogCardProps> = ({ activities }) => {
  const getActivityIcon = (type: ActivityLog['type']) => {
    switch (type) {
      case 'security_alert':
        return <AlertTriangle className="w-5 h-5 text-red-500" />;
      case 'login':
        return <Monitor className="w-5 h-5 text-[#22DFBF]" />;
      case 'transaction':
        return <Clock className="w-5 h-5 text-[#3D5AF1]" />;
      case 'settings_change':
        return <Clock className="w-5 h-5 text-[#3D5AF1]" />;
      default:
        return <Clock className="w-5 h-5 text-[#3D5AF1]" />;
    }
  };

  return (
    <div className="bg-[#1A1B23]/60 backdrop-blur-lg border border-[#3D5AF1]/20 rounded-xl p-6 hover:border-[#3D5AF1]/40 transition-all duration-300">
      <h3 className="text-xl font-bold text-white mb-6">Recent Activity</h3>

      <div className="space-y-4">
        {activities.map((activity) => (
          <div
            key={activity.id}
            className={`p-4 rounded-lg ${
              activity.critical ? 'bg-red-500/10' : 'bg-[#1A1B23]/40'
            }`}
          >
            <div className="flex items-start gap-3">
              {getActivityIcon(activity.type)}
              <div className="flex-1">
                <p className="text-white mb-1">{activity.description}</p>
                <div className="flex items-center gap-4 text-sm text-gray-400">
                  <div className="flex items-center gap-1">
                    <MapPin className="w-4 h-4" />
                    <span>{activity.location}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Monitor className="w-4 h-4" />
                    <span>{activity.device}</span>
                  </div>
                </div>
              </div>
              <span className="text-sm text-gray-400">{activity.timestamp}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ActivityLogCard;