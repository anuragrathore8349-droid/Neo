import React, { ReactNode } from 'react';
import { motion } from 'framer-motion';

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  gradient?: boolean;
}

const GlassCard: React.FC<GlassCardProps> = ({ 
  children, 
  className = '', 
  hover = false,
  gradient = false
}) => {
  return (
    <motion.div 
      className={`
        ${hover ? 'glass-card-hover' : 'glass-card'} 
        ${gradient ? 'gradient-border' : ''}
        ${className}
      `}
      whileHover={hover ? { y: -5 } : {}}
      transition={{ type: 'spring', stiffness: 300 }}
    >
      {children}
    </motion.div>
  );
};

export default GlassCard;