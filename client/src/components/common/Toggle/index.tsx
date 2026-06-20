import React from 'react';

interface ToggleProps {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  label: string;
}

const Toggle: React.FC<ToggleProps> = ({ enabled, onChange, label }) => {
  return (
    <label className="flex items-center cursor-pointer">
      <div className="relative">
        <input
          type="checkbox"
          className="sr-only"
          checked={enabled}
          onChange={(e) => onChange(e.target.checked)}
        />
        <div className={`block w-14 h-8 rounded-full transition-colors duration-300 ${
          enabled ? 'bg-[#22DFBF]' : 'bg-slate-700'
        }`}>
          <div className={`absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform duration-300 ${
            enabled ? 'transform translate-x-6' : ''
          }`} />
        </div>
      </div>
      <div className="ml-3 text-slate-300">{label}</div>
    </label>
  );
};

export default Toggle;