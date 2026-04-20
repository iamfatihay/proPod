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
import apiService from '../services/api/apiService';

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

    // ─── API-backed methods ────────────────────────────────────────────────

    /**
     * Fetch server-side notifications and merge with local (AI/system) ones.
     *
     * Server notifications (like, comment) use a numeric `id` prefixed with
     * "srv_" to avoid collisions with local IDs.  Local notifications that
     * are device-only (AI processing complete) are preserved and shown first.
     *
     * Call this on mount and on pull-to-refresh.
     */
    fetchNotifications: async () => {
        // Ensure local cache is loaded first so offline mode shows cached data
        // even before the network request completes or if it fails.
        if (!get().isLoaded) {
            await get().loadFromStorage();
        }

        try {
            const response = await apiService.getNotifications({ limit: 50 });
            if (!response || !Array.isArray(response.notifications)) {
                return;
            }

            const serverNotifs = response.notifications.map((n) => ({
                // Normalise server notification to match the local schema
                id: `srv_${n.id}`,
                _serverId: n.id,            // keep original DB id for PATCH calls
                created_at: new Date(n.created_at).getTime(),
                read: n.read,
                type: n.type,
                title: n.title,
                message: n.message,
                // Allow navigation to the podcast detail when tapped
                // 'details' matches the existing frontend/app/(main)/details.js screen
                action: n.podcast_id
                    ? { type: 'navigate', screen: 'details', params: { id: n.podcast_id } }
                    : null,
            }));

            // Keep local notifications that are NOT already represented by a
            // server notification (device-only types: ai_complete, system).
            // 'new_episode' is also server-backed — exclude it from local merging.
            const serverTypes = new Set(['like', 'comment', 'new_episode']);
            const localNotifs = get().notifications.filter(
                (n) => !serverTypes.has(n.type) && !n.id.startsWith('srv_')
            );

            // Merge: local (AI/system) first, then server notifications
            const merged = [...localNotifs, ...serverNotifs].sort(
                (a, b) => b.created_at - a.created_at
            );

            set({
                notifications: merged,
                unreadCount: merged.filter((n) => !n.read).length,
            });

            // Persist merged list so the tab badge survives app restarts
            await get().saveToStorage();
        } catch (error) {
            // Network errors are expected offline — degrade silently
            Logger.warn('fetchNotifications: could not reach server, using local cache', error?.message);
        }
    },

    /**
     * Mark a single notification as read — syncs to server for server-backed
     * notifications; falls back to local-only update for device notifications.
     *
     * @param {string} id - Notification id (may be "srv_<n>" or a local uuid)
     */
    markAsReadWithSync: async (id) => {
        // Capture existing notification before mutating — needed for API call guard
        const existing = get().notifications.find((n) => n.id === id);

        // No-op if notification is already read or not found
        if (!existing || existing.read) return;

        // Optimistically update local state for immediate UI response
        set((state) => ({
            notifications: state.notifications.map((n) =>
                n.id === id ? { ...n, read: true } : n
            ),
            unreadCount: Math.max(0, state.unreadCount - 1),
        }));
        await get().saveToStorage();

        // If this is a server-backed notification, persist the read status via API
        if (existing._serverId) {
            try {
                await apiService.markNotificationRead(existing._serverId);
            } catch (error) {
                Logger.warn('markAsReadWithSync: API call failed, local state already updated', error?.message);
            }
        }
    },

    /**
     * Mark all notifications as read — syncs to server.
     */
    markAllAsReadWithSync: async () => {
        set((state) => ({
            notifications: state.notifications.map((n) => ({ ...n, read: true })),
            unreadCount: 0,
        }));
        await get().saveToStorage();

        try {
            await apiService.markAllNotificationsRead();
        } catch (error) {
            Logger.warn('markAllAsReadWithSync: API call failed, local state already updated', error?.message);
        }
    },
}));

export default useNotificationStore;
