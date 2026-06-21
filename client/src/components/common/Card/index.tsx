import React from 'react';
import { motion } from 'framer-motion';

interface CardProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  className?: string;
  glassEffect?: boolean;
  gradient?: boolean;
  actions?: React.ReactNode;
}

const Card: React.FC<CardProps> = ({
  children,
  title,
  subtitle,
  className = '',
  glassEffect = false,
  gradient = false,
  actions,
}) => {
  const baseClasses = 'rounded-xl overflow-hidden';
  const glassClasses = glassEffect ? 'glass-card' : 'bg-dark-800 border border-dark-700';
  const gradientClasses = gradient ? 'relative' : '';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`${baseClasses} ${glassClasses} ${gradientClasses} ${className}`}
    >
      {gradient && (
        <div className="absolute inset-0 bg-blue-gradient opacity-5 rounded-xl"></div>
      )}
      
      {(title || actions) && (
        <div className="flex justify-between items-center p-4 border-b border-dark-700">
          <div>
            {title && <h3 className="text-lg font-semibold">{title}</h3>}
            {subtitle && <p className="text-sm text-dark-400 mt-1">{subtitle}</p>}
          </div>
          {actions && <div>{actions}</div>}
        </div>
      )}
      
      <div className="p-4">{children}</div>
    </motion.div>
  );
};

export default Card;