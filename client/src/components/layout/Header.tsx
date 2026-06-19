import React, { useState } from 'react';
import { Bell, Search, Menu, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

interface HeaderProps {
  toggleSidebar: () => void;
  sidebarOpen: boolean;
}

const Header: React.FC<HeaderProps> = ({ toggleSidebar, sidebarOpen }) => {
  const { user } = useAuth();
  const [showNotifications, setShowNotifications] = useState(false);
  const navigate = useNavigate();
  
  const notifications = [
    { id: '1', title: 'Portfolio Alert', message: 'BTC price increased by 5% in the last hour', time: '10 min ago', read: false },
    { id: '2', title: 'New AI Insight', message: 'Our AI detected a potential buying opportunity for ETH', time: '1 hour ago', read: false },
    { id: '3', title: 'Security Alert', message: 'New login detected from San Francisco, CA', time: '3 hours ago', read: true },
  ];

  const handleProfileClick = () => {
    navigate('/profile');
  };

  return (
    <header className="fixed top-0 right-0 left-0 ml-64 h-16 bg-dark-800 border-b border-dark-700 flex items-center justify-between px-6 z-10">
      <div className="flex items-center">
        <button 
          onClick={toggleSidebar} 
          className="mr-4 p-2 rounded-lg hover:bg-dark-700 lg:hidden"
        >
          {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
        
        <div className="relative">
          <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-dark-400" />
          <input 
            type="text" 
            placeholder="Search..." 
            className="input-field pl-10 w-64"
          />
        </div>
      </div>
      
      <div className="flex items-center space-x-4">
        <div className="relative">
          <button 
            onClick={() => setShowNotifications(!showNotifications)}
            className="p-2 rounded-full hover:bg-dark-700 relative"
          >
            <Bell size={20} />
            <span className="absolute top-0 right-0 h-2 w-2 rounded-full bg-primary"></span>
          </button>
          
          <AnimatePresence>
            {showNotifications && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                transition={{ duration: 0.2 }}
                className="absolute right-0 mt-2 w-80 bg-dark-800 border border-dark-700 rounded-xl shadow-lg z-20"
              >
                <div className="p-4 border-b border-dark-700">
                  <h3 className="font-semibold">Notifications</h3>
                </div>
                <div className="max-h-96 overflow-y-auto">
                  {notifications.map((notification) => (
                    <div 
                      key={notification.id} 
                      className={`p-4 border-b border-dark-700 hover:bg-dark-700 cursor-pointer ${!notification.read ? 'bg-dark-700/50' : ''}`}
                    >
                      <div className="flex justify-between items-start">
                        <h4 className="font-medium">{notification.title}</h4>
                        <span className="text-xs text-dark-400">{notification.time}</span>
                      </div>
                      <p className="text-sm text-dark-300 mt-1">{notification.message}</p>
                    </div>
                  ))}
                </div>
                <div className="p-3 text-center">
                  <button className="text-primary text-sm font-medium">View all notifications</button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        
        <div className="flex items-center space-x-3 cursor-pointer" onClick={handleProfileClick}>
          <div className="text-right">
            <p className="text-sm font-medium">{user?.name || 'Guest'}</p>
            <p className="text-xs text-dark-400">{user?.plan || 'Standard Plan'}</p>
          </div>
          <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-medium">
            {user?.name?.split(' ').map((n) => n[0]).join('') || 'G'}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;