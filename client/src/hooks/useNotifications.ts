import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../services/api';
import { io, Socket } from 'socket.io-client';

export interface Notification {
  _id: string;
  type: 'order' | 'alert' | 'security' | 'subscription' | 'system' | 'defi' | 'performance' | 'ai_insight';
  title: string;
  message: string;
  icon: string;
  severity: 'info' | 'warning' | 'error' | 'success';
  isRead: boolean;
  readAt?: Date;
  actionUrl?: string;
  actionLabel?: string;
  metadata?: Record<string, any>;
  createdAt: string;
}

export interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
}

export interface UseNotificationsReturn extends NotificationState {
  fetchNotifications: (limit?: number, skip?: number, unreadOnly?: boolean) => Promise<void>;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (notificationId: string) => Promise<void>;
  deleteAllNotifications: () => Promise<void>;
  subscribe: () => void;
  unsubscribe: () => void;
}

export function useNotifications(): UseNotificationsReturn {
  const { user, token } = useAuth();
  const [state, setState] = useState<NotificationState>({
    notifications: [],
    unreadCount: 0,
    loading: false,
    error: null,
  });

  const socketRef = useRef<Socket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Initialize WebSocket connection
  const connectWebSocket = useCallback(() => {
    if (!user?.id || !token || socketRef.current?.connected) return;

    const wsUrl = import.meta.env.VITE_WS_URL || 'http://localhost:3001';

    try {
      socketRef.current = io(`${wsUrl}/notifications`, {
        auth: { token },
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: 5,
      });

      socketRef.current.on('connect', () => {
        console.log('📬 Notifications WebSocket connected');
        socketRef.current?.emit('authenticate', user.id);
      });

      socketRef.current.on('notification', (data: any) => {
        const notification: Notification = data.data || data;
        setState(prev => ({
          ...prev,
          notifications: [notification, ...prev.notifications],
          unreadCount: prev.unreadCount + 1,
        }));
      });

      socketRef.current.on('notification:update', (data: any) => {
        if (data.data?.notificationId) {
          setState(prev => ({
            ...prev,
            notifications: prev.notifications.map(n =>
              n._id === data.data.notificationId ? { ...n, isRead: true, readAt: data.data.readAt } : n
            ),
          }));
        }
      });

      socketRef.current.on('notification:batch', (data: any) => {
        if (data.event === 'markAllRead') {
          setState(prev => ({
            ...prev,
            notifications: prev.notifications.map(n => ({ ...n, isRead: true })),
            unreadCount: 0,
          }));
        } else if (data.event === 'deleteAll') {
          setState(prev => ({
            ...prev,
            notifications: [],
            unreadCount: 0,
          }));
        }
      });

      socketRef.current.on('notification:delete', (data: any) => {
        if (data.data?.notificationId) {
          setState(prev => {
            const notification = prev.notifications.find(n => n._id === data.data.notificationId);
            return {
              ...prev,
              notifications: prev.notifications.filter(n => n._id !== data.data.notificationId),
              unreadCount: prev.unreadCount - (notification?.isRead ? 0 : 1),
            };
          });
        }
      });

      socketRef.current.on('alert', (data: any) => {
        const notification: Notification = {
          _id: `alert_${Date.now()}`,
          type: 'alert',
          title: 'Price Alert',
          message: data.message || 'Price alert triggered',
          icon: 'AlertCircle',
          severity: 'warning',
          isRead: false,
          metadata: data.metadata || {},
          createdAt: new Date().toISOString(),
        };
        setState(prev => ({
          ...prev,
          notifications: [notification, ...prev.notifications],
          unreadCount: prev.unreadCount + 1,
        }));
      });

      socketRef.current.on('error', (err: any) => {
        console.error('WebSocket error:', err);
        setState(prev => ({ ...prev, error: err.message || 'WebSocket connection error' }));
      });

      socketRef.current.on('disconnect', () => {
        console.log('📬 Notifications WebSocket disconnected');
      });
    } catch (err: any) {
      console.error('Failed to connect to notifications:', err);
      setState(prev => ({ ...prev, error: 'Failed to connect to notifications' }));
    }
  }, [user, token]);

  // Fetch notifications from API
  const fetchNotifications = useCallback(async (limit = 20, skip = 0, unreadOnly = false) => {
    if (!user?.id) return;

    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const res = await apiFetch(
        `/api/user/notifications?limit=${limit}&skip=${skip}&unreadOnly=${unreadOnly}`
      );
      const data = (res as any).data || res;

      setState(prev => ({
        ...prev,
        notifications: data.data || data.notifications || [],
        unreadCount: data.unreadCount ?? 0,
        loading: false,
      }));
    } catch (err: any) {
      setState(prev => ({
        ...prev,
        error: err.message || 'Failed to fetch notifications',
        loading: false,
      }));
    }
  }, [user?.id]);

  // Mark notification as read
  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      await apiFetch(`/api/user/notifications/${notificationId}/read`, { method: 'PATCH' });
      setState(prev => ({
        ...prev,
        notifications: prev.notifications.map(n =>
          n._id === notificationId ? { ...n, isRead: true, readAt: new Date().toISOString() } : n
        ),
        unreadCount: Math.max(0, prev.unreadCount - 1),
      }));
    } catch (err: any) {
      console.error('Failed to mark notification as read:', err);
    }
  }, []);

  // Mark all as read
  const markAllAsRead = useCallback(async () => {
    try {
      await apiFetch('/api/user/notifications/mark-all/read', { method: 'PATCH' });
      setState(prev => ({
        ...prev,
        notifications: prev.notifications.map(n => ({ ...n, isRead: true })),
        unreadCount: 0,
      }));
    } catch (err: any) {
      console.error('Failed to mark all as read:', err);
    }
  }, []);

  // Delete notification
  const deleteNotification = useCallback(async (notificationId: string) => {
    try {
      await apiFetch(`/api/user/notifications/${notificationId}`, { method: 'DELETE' });
      setState(prev => {
        const notification = prev.notifications.find(n => n._id === notificationId);
        return {
          ...prev,
          notifications: prev.notifications.filter(n => n._id !== notificationId),
          unreadCount: prev.unreadCount - (notification?.isRead ? 0 : 1),
        };
      });
    } catch (err: any) {
      console.error('Failed to delete notification:', err);
    }
  }, []);

  // Delete all notifications
  const deleteAllNotifications = useCallback(async () => {
    try {
      await apiFetch('/api/user/notifications', { method: 'DELETE' });
      setState(prev => ({
        ...prev,
        notifications: [],
        unreadCount: 0,
      }));
    } catch (err: any) {
      console.error('Failed to delete all notifications:', err);
    }
  }, []);

  // Subscribe to WebSocket
  const subscribe = useCallback(() => {
    connectWebSocket();
  }, [connectWebSocket]);

  // Unsubscribe from WebSocket
  const unsubscribe = useCallback(() => {
    if (socketRef.current?.connected) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (socketRef.current?.connected) {
        socketRef.current.disconnect();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, []);

  // Auto-fetch notifications on mount
  useEffect(() => {
    if (user?.id) {
      fetchNotifications();
      connectWebSocket();
    }
  }, [user?.id, fetchNotifications, connectWebSocket]);

  return {
    ...state,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    deleteAllNotifications,
    subscribe,
    unsubscribe,
  };
}
