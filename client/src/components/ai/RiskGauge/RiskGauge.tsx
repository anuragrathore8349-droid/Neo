import React from 'react';

interface RiskGaugeProps {
  riskScore: number; // 0-100
  size?: number;
}

const RiskGauge: React.FC<RiskGaugeProps> = ({ riskScore, size = 200 }) => {
  const radius = size / 2;
  const strokeWidth = size / 10;
  const normalizedScore = Math.min(Math.max(riskScore, 0), 100);
  const angle = (normalizedScore / 100) * 180;
  const rad = (angle - 90) * (Math.PI / 180);
  const x = radius + radius * Math.cos(rad);
  const y = radius + radius * Math.sin(rad);

  const getColor = (score: number) => {
    if (score < 30) return '#22DFBF';
    if (score < 70) return '#FFB800';
    return '#FF4B4B';
  };

  return (
    <div className="relative" style={{ width: size, height: size / 2 }}>
      <svg width={size} height={size / 2}>
        <defs>
          <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#22DFBF" />
            <stop offset="50%" stopColor="#FFB800" />
            <stop offset="100%" stopColor="#FF4B4B" />
          </linearGradient>
        </defs>
        <path
          d={`M ${strokeWidth / 2} ${size / 2} A ${radius - strokeWidth / 2} ${
            radius - strokeWidth / 2
          } 0 0 1 ${size - strokeWidth / 2} ${size / 2}`}
          fill="none"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth={strokeWidth}
        />
        <path
          d={`M ${strokeWidth / 2} ${size / 2} A ${radius - strokeWidth / 2} ${
            radius - strokeWidth / 2
          } 0 0 1 ${x} ${y}`}
          fill="none"
          stroke={getColor(normalizedScore)}
          strokeWidth={strokeWidth}
          className="transition-all duration-1000 ease-in-out"
        />
      </svg>
      <div
        className="absolute top-1/2 left-1/2 transform -translate-x-1/2 translate-y-[-25%] text-center"
      >
        <div className="text-3xl font-bold text-white">{riskScore}</div>
        <div className="text-sm text-gray-400">Risk Score</div>
      </div>
    </div>
  );
};

export default RiskGauge;