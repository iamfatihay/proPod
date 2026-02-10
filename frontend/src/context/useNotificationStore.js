/**
 * Notification Store - Global notification management
 * 
 * Handles in-app notifications for:
 * - AI processing completion
 * - Comments
 * - Likes
 * - New followers
 * - System messages
 * 
 * Features:
 * - Persistent storage with AsyncStorage
 * - Unread count badge
 * - Mark as read functionality
 * - Action-based navigation
 */

import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Logger from '../utils/logger';

const STORAGE_KEY = '@notifications';

const useNotificationStore = create((set, get) => ({
    notifications: [],
    unreadCount: 0,
    isLoaded: false,

    /**
     * Add new notification
     * @param {Object} notification - Notification object
     * @param {string} notification.type - Type: 'ai_complete', 'comment', 'like', etc.
     * @param {string} notification.title - Notification title
     * @param {string} notification.message - Notification message
     * @param {Object} notification.action - Optional action for navigation
     * @param {Object} notification.data - Optional additional data
     */
    addNotification: (notification) => {
        const newNotification = {
            id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
            created_at: Date.now(),
            read: false,
            ...notification,
        };

        set((state) => ({
            notifications: [newNotification, ...state.notifications],
            unreadCount: state.unreadCount + 1,
        }));

        // Persist to storage
        get().saveToStorage();

        return newNotification;
    },

    /**
     * Mark notification as read
     * @param {string} id - Notification ID
     */
    markAsRead: (id) => {
        set((state) => {
            const notification = state.notifications.find(n => n.id === id);
            if (!notification || notification.read) {
                return state; // No change if already read or not found
            }

            return {
                notifications: state.notifications.map(n =>
                    n.id === id ? { ...n, read: true } : n
                ),
                unreadCount: Math.max(0, state.unreadCount - 1),
            };
        });

        get().saveToStorage();
    },

    /**
     * Mark all notifications as read
     */
    markAllAsRead: () => {
        set((state) => ({
            notifications: state.notifications.map(n => ({ ...n, read: true })),
            unreadCount: 0,
        }));

        get().saveToStorage();
    },

    /**
     * Remove notification
     * @param {string} id - Notification ID
     */
    removeNotification: (id) => {
        set((state) => {
            const notification = state.notifications.find(n => n.id === id);
            const wasUnread = notification && !notification.read;

            return {
                notifications: state.notifications.filter(n => n.id !== id),
                unreadCount: wasUnread ? Math.max(0, state.unreadCount - 1) : state.unreadCount,
            };
        });

        get().saveToStorage();
    },

    /**
     * Clear all notifications
     */
    clearAll: () => {
        set({
            notifications: [],
            unreadCount: 0,
        });

        get().saveToStorage();
    },

    /**
     * Load notifications from AsyncStorage
     */
    loadFromStorage: async () => {
        try {
            const data = await AsyncStorage.getItem(STORAGE_KEY);
            if (data) {
                const parsed = JSON.parse(data);
                
                // Filter out old notifications (older than 30 days)
                const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
                const validNotifications = parsed.notifications.filter(
                    n => n.created_at > thirtyDaysAgo
                );

                set({
                    notifications: validNotifications,
                    unreadCount: validNotifications.filter(n => !n.read).length,
                    isLoaded: true,
                });
            } else {
                set({ isLoaded: true });
            }
        } catch (error) {
            Logger.error('Failed to load notifications:', error);
            set({ isLoaded: true });
        }
    },

    /**
     * Save notifications to AsyncStorage
     */
    saveToStorage: async () => {
        try {
            const state = get();
            const data = {
                notifications: state.notifications,
                unreadCount: state.unreadCount,
            };
            await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        } catch (error) {
            Logger.error('Failed to save notifications:', error);
        }
    },

    /**
     * Get notifications by type
     * @param {string} type - Notification type
     */
    getNotificationsByType: (type) => {
        return get().notifications.filter(n => n.type === type);
    },

    /**
     * Get unread notifications
     */
    getUnreadNotifications: () => {
        return get().notifications.filter(n => !n.read);
    },
}));

export default useNotificationStore;
