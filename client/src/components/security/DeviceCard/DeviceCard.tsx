import React from 'react';
import { Smartphone, Laptop, Monitor, Trash2, MoreVertical } from 'lucide-react';

interface Device {
  id: string;
  name: string;
  type: 'mobile' | 'desktop' | 'tablet';
  lastActive: string;
  location: string;
  current: boolean;
}

interface DeviceCardProps {
  device: Device;
  onRemove: (id: string) => void;
}

const DeviceCard: React.FC<DeviceCardProps> = ({ device, onRemove }) => {
  const getDeviceIcon = () => {
    switch (device.type) {
      case 'mobile':
        return <Smartphone className="w-6 h-6 text-[#3D5AF1]" />;
      case 'tablet':
        return <Monitor className="w-6 h-6 text-[#3D5AF1]" />;
      default:
        return <Laptop className="w-6 h-6 text-[#3D5AF1]" />;
    }
  };

  return (
    <div className="bg-[#1A1B23]/60 backdrop-blur-lg border border-[#3D5AF1]/20 rounded-xl p-4 hover:border-[#3D5AF1]/40 transition-all duration-300">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          {getDeviceIcon()}
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-white font-medium">{device.name}</h4>
              {device.current && (
                <span className="px-2 py-0.5 text-xs rounded-full bg-[#22DFBF]/10 text-[#22DFBF]">
                  Current
                </span>
              )}
            </div>
            <p className="text-sm text-gray-400 mt-1">
              Last active: {device.lastActive}
            </p>
            <p className="text-sm text-gray-400">Location: {device.location}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!device.current && (
            <button
              onClick={() => onRemove(device.id)}
              className="p-2 hover:bg-red-500/10 rounded-lg transition-colors"
            >
              <Trash2 className="w-5 h-5 text-red-500" />
            </button>
          )}
          <button className="p-2 hover:bg-[#3D5AF1]/10 rounded-lg transition-colors">
            <MoreVertical className="w-5 h-5 text-[#3D5AF1]" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeviceCard;