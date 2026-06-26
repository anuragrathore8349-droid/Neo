import React, { useState, useEffect } from 'react';
import { Bell, Search, Menu, X, Trash2, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../hooks/useNotifications';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3003';

interface HeaderProps {
  toggleSidebar: () => void;
  sidebarOpen: boolean;
}

const Header: React.FC<HeaderProps> = ({ toggleSidebar, sidebarOpen }) => {
  const { user } = useAuth();
  const [showNotifications, setShowNotifications] = useState(false);
  const navigate = useNavigate();
  const { notifications, unreadCount, markAsRead, deleteNotification, markAllAsRead } = useNotifications();

  const [apiLive, setApiLive] = useState<boolean>(false);

  const handleProfileClick = () => {
    navigate('/profile');
  };

  const handleNotificationClick = (notification: any) => {
    if (!notification.isRead) {
      markAsRead(notification._id);
    }
    if (notification.actionUrl) {
      navigate(notification.actionUrl);
      setShowNotifications(false);
    }
  };

  const handleViewAll = () => {
    navigate('/notifications');
    setShowNotifications(false);
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'error':
        return 'text-red-400';
      case 'warning':
        return 'text-yellow-400';
      case 'success':
        return 'text-green-400';
      default:
        return 'text-blue-400';
    }
  };

  const getIconForType = (type: string) => {
    const icons: Record<string, string> = {
      order: '📈',
      alert: '🔔',
      security: '🔐',
      subscription: '💳',
      system: '⚙️',
      defi: '🏦',
      performance: '⭐',
      ai_insight: '💡',
    };
    return icons[type] || '📬';
  };

  useEffect(() => {
    let isMounted = true;

    const checkApiHealth = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/health`, { method: 'GET' });
        if (!response.ok) throw new Error('API unavailable');
        const data = await response.json();
        if (isMounted && data?.status === 'ok') {
          setApiLive(true);
          return;
        }
        if (isMounted) setApiLive(false);
      } catch {
        if (isMounted) setApiLive(false);
      }
    };

    checkApiHealth();
    const interval = window.setInterval(checkApiHealth, 10000);

    return () => {
      isMounted = false;
      window.clearInterval(interval);
    };
  }, []);

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
        <div className="flex items-center rounded-full border border-dark-700 bg-dark-900 px-3 py-1 text-xs text-light">
          <span className={`mr-2 h-2.5 w-2.5 rounded-full ${apiLive ? 'bg-green-400' : 'bg-red-400'}`} />
          <span>{apiLive ? 'API Live' : 'API Offline'}</span>
        </div>
        <div className="relative">
          <button 
            onClick={() => setShowNotifications(!showNotifications)}
            className="p-2 rounded-full hover:bg-dark-700 relative"
          >
            <Bell size={20} />
            {unreadCount > 0 && (
              <span className="absolute top-0 right-0 h-5 w-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center font-bold">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
          
          <AnimatePresence>
            {showNotifications && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                transition={{ duration: 0.2 }}
                className="absolute right-0 mt-2 w-96 bg-dark-800 border border-dark-700 rounded-xl shadow-lg z-20"
              >
                <div className="p-4 border-b border-dark-700 flex justify-between items-center">
                  <h3 className="font-semibold">Notifications ({unreadCount})</h3>
                  {unreadCount > 0 && (
                    <button
                      onClick={() => markAllAsRead()}
                      className="text-primary text-xs font-medium hover:text-primary/80 flex items-center gap-1"
                    >
                      <Check size={14} /> Mark all read
                    </button>
                  )}
                </div>
                <div className="max-h-96 overflow-y-auto">
                  {!Array.isArray(notifications) || notifications.length === 0 ? (
                    <div className="p-8 text-center text-dark-400">
                      <Bell size={24} className="mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No notifications yet</p>
                    </div>
                  ) : (
                    notifications.slice(0, 10).map((notification) => (
                      <div 
                        key={notification._id} 
                        className={`p-4 border-b border-dark-700 hover:bg-dark-700/50 cursor-pointer transition-colors ${
                          !notification.isRead ? 'bg-dark-700/30' : ''
                        }`}
                        onClick={() => handleNotificationClick(notification)}
                      >
                        <div className="flex justify-between items-start gap-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-lg">{getIconForType(notification.type)}</span>
                              <h4 className={`font-medium text-sm ${!notification.isRead ? 'text-white' : 'text-dark-300'}`}>
                                {notification.title}
                              </h4>
                            </div>
                            <p className="text-xs text-dark-400 mt-1">{notification.message}</p>
                            <div className="flex items-center justify-between mt-2">
                              <span className="text-xs text-dark-500">
                                {new Date(notification.createdAt).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteNotification(notification._id);
                                }}
                                className="text-dark-500 hover:text-red-400 transition-colors"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <div className="p-3 text-center border-t border-dark-700">
                  <button 
                    onClick={handleViewAll}
                    className="text-primary text-sm font-medium hover:text-primary/80"
                  >
                    View all notifications
                  </button>
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