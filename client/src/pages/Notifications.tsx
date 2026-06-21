import React, { useState, useEffect } from 'react';
import { Trash2, Check, Clock, Archive, AlertCircle } from 'lucide-react';
import { useNotifications } from '../hooks/useNotifications';
import { Loader } from 'lucide-react';

const NotificationsPage: React.FC = () => {
  const {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    deleteAllNotifications,
  } = useNotifications();

  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest'>('newest');

  const filteredNotifications = filter === 'unread' 
    ? notifications.filter(n => !n.isRead)
    : notifications;

  const sortedNotifications = [...filteredNotifications].sort((a, b) => {
    const dateA = new Date(a.createdAt).getTime();
    const dateB = new Date(b.createdAt).getTime();
    return sortBy === 'newest' ? dateB - dateA : dateA - dateB;
  });

  const getIconForType = (type: string) => {
    const icons: Record<string, React.ReactNode> = {
      order: <span>📈</span>,
      alert: <span>🔔</span>,
      security: <span>🔐</span>,
      subscription: <span>💳</span>,
      system: <span>⚙️</span>,
      defi: <span>🏦</span>,
      performance: <span>⭐</span>,
      ai_insight: <span>💡</span>,
    };
    return icons[type] || <span>📬</span>;
  };

  const getSeverityBadge = (severity: string) => {
    const styles: Record<string, string> = {
      error: 'bg-red-500/20 text-red-400',
      warning: 'bg-yellow-500/20 text-yellow-400',
      success: 'bg-green-500/20 text-green-400',
      info: 'bg-blue-500/20 text-blue-400',
    };
    return styles[severity] || styles.info;
  };

  const formatDate = (date: string) => {
    const d = new Date(date);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 7) {
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
    }
    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    return 'just now';
  };

  if (loading && notifications.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Notifications</h1>
        <p className="text-dark-400">Manage your alerts and updates</p>
      </div>

      {/* Controls */}
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === 'all'
                ? 'bg-primary text-white'
                : 'bg-dark-700 text-dark-300 hover:bg-dark-600'
            }`}
          >
            All ({notifications.length})
          </button>
          <button
            onClick={() => setFilter('unread')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === 'unread'
                ? 'bg-primary text-white'
                : 'bg-dark-700 text-dark-300 hover:bg-dark-600'
            }`}
          >
            Unread ({unreadCount})
          </button>
        </div>

        <div className="flex gap-2">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-sm text-white"
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </select>

          {unreadCount > 0 && (
            <button
              onClick={() => markAllAsRead()}
              className="px-4 py-2 bg-dark-700 hover:bg-dark-600 rounded-lg text-sm font-medium text-primary transition-colors flex items-center gap-2"
            >
              <Check size={16} /> Mark all read
            </button>
          )}

          {notifications.length > 0 && (
            <button
              onClick={() => deleteAllNotifications()}
              className="px-4 py-2 bg-dark-700 hover:bg-red-500/20 rounded-lg text-sm font-medium text-red-400 transition-colors flex items-center gap-2"
            >
              <Trash2 size={16} /> Clear all
            </button>
          )}
        </div>
      </div>

      {/* Notifications List */}
      <div className="space-y-2">
        {sortedNotifications.length === 0 ? (
          <div className="text-center py-12">
            <AlertCircle size={48} className="mx-auto mb-4 text-dark-500" />
            <h3 className="text-lg font-semibold text-dark-300 mb-1">No notifications</h3>
            <p className="text-dark-400">
              {filter === 'unread' ? 'You\'re all caught up!' : 'You don\'t have any notifications yet'}
            </p>
          </div>
        ) : (
          sortedNotifications.map((notification) => (
            <div
              key={notification._id}
              className={`p-4 rounded-lg border transition-colors ${
                notification.isRead
                  ? 'bg-dark-800 border-dark-700'
                  : 'bg-dark-700/50 border-dark-600'
              }`}
            >
              <div className="flex gap-4">
                <div className="text-2xl flex-shrink-0">
                  {getIconForType(notification.type)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <div>
                      <h3 className={`font-semibold ${notification.isRead ? 'text-dark-200' : 'text-white'}`}>
                        {notification.title}
                      </h3>
                      <p className="text-sm text-dark-300 mt-1 line-clamp-2">{notification.message}</p>
                    </div>
                    {!notification.isRead && (
                      <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-2" />
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-2 mt-3 text-xs text-dark-400">
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1">
                        <Clock size={12} />
                        {formatDate(notification.createdAt)}
                      </span>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getSeverityBadge(notification.severity)}`}>
                        {notification.severity}
                      </span>
                      <span className="text-xs text-dark-500">
                        {notification.type.charAt(0).toUpperCase() + notification.type.slice(1)}
                      </span>
                    </div>

                    <div className="flex gap-2">
                      {!notification.isRead && (
                        <button
                          onClick={() => markAsRead(notification._id)}
                          className="p-1.5 hover:bg-dark-600 rounded text-dark-400 hover:text-primary transition-colors"
                          title="Mark as read"
                        >
                          <Check size={16} />
                        </button>
                      )}
                      <button
                        onClick={() => deleteNotification(notification._id)}
                        className="p-1.5 hover:bg-red-500/20 rounded text-dark-400 hover:text-red-400 transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  {notification.actionUrl && (
                    <div className="mt-3">
                      <a
                        href={notification.actionUrl}
                        className="text-sm text-primary hover:text-primary/80 font-medium inline-flex items-center gap-1"
                      >
                        {notification.actionLabel || 'View'} →
                      </a>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Stats */}
      {notifications.length > 0 && (
        <div className="mt-8 pt-6 border-t border-dark-700">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{notifications.length}</div>
              <div className="text-xs text-dark-400 mt-1">Total notifications</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-400">{unreadCount}</div>
              <div className="text-xs text-dark-400 mt-1">Unread</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-400">{notifications.filter(n => n.isRead).length}</div>
              <div className="text-xs text-dark-400 mt-1">Read</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-400">{new Set(notifications.map(n => n.type)).size}</div>
              <div className="text-xs text-dark-400 mt-1">Types</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationsPage;
