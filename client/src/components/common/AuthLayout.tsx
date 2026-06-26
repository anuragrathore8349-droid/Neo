import React from 'react';
import { motion } from 'framer-motion';
import Logo from './Logo';

interface AuthLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
}

const AuthLayout: React.FC<AuthLayoutProps> = ({ children, title, subtitle }) => {
  return (
    <div className="min-h-screen bg-dark-900 flex flex-col md:flex-row">
      {/* Left side - Branding */}
      <div className="hidden md:flex md:w-1/2 bg-dark-800 p-8 flex-col justify-between relative overflow-hidden">
        <div className="absolute inset-0 bg-blue-gradient opacity-10"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-primary opacity-20 blur-3xl rounded-full transform translate-x-1/3 translate-y-1/3"></div>
        <div className="absolute top-0 left-0 w-96 h-96 bg-secondary opacity-20 blur-3xl rounded-full transform -translate-x-1/3 -translate-y-1/3"></div>
        
        <div className="relative z-10">
          <Logo />
        </div>
        
        <div className="relative z-10 max-w-md">
          <h1 className="text-4xl font-bold mb-6">Transform Your Financial Future</h1>
          <p className="text-dark-300 text-lg">
            NeoFin combines traditional finance with DeFi, powered by advanced AI to maximize your investment potential.
          </p>
        </div>
        
        <div className="relative z-10 text-dark-400 text-sm">
          © 2025 NeoFin. All rights reserved.
        </div>
      </div>
      
      {/* Right side - Auth form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <motion.div 
          className="w-full max-w-md"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="md:hidden mb-8">
            <Logo />
          </div>
          
          <h2 className="text-2xl font-bold mb-2">{title}</h2>
          {subtitle && <p className="text-dark-300 mb-8">{subtitle}</p>}
          
          {children}
        </motion.div>
      </div>
    </div>
  );
};

export default AuthLayout;