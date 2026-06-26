import React from 'react';
import { Zap } from 'lucide-react';
import { Link } from 'react-router-dom'; // or any routing library you're using

const Logo: React.FC = () => {
  return (
    <Link to="/">
      <div className="flex items-center space-x-2 cursor-pointer">
        <div className="h-8 w-8 rounded-lg bg-blue-gradient flex items-center justify-center shadow-glow">
          <Zap size={20} className="text-white" />
        </div>
        <span className="text-xl font-display font-bold bg-clip-text text-transparent bg-blue-gradient">
          NeoFin
        </span>
      </div>
    </Link>
  );
};

export default Logo;
