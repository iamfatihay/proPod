/**
 * useDMStore.js — Zustand store for Direct Message state
 *
 * Tracks the total number of unread DMs across all conversation threads so
 * the tab-bar badge is accurate without requiring the user to open the inbox.
 *
 * Usage:
 *   const unreadDMCount = useDMStore(s => s.unreadDMCount);
 *   const fetchDMUnreadCount = useDMStore(s => s.fetchDMUnreadCount);
 */
import { create } from 'zustand';
import Logger from '../utils/logger';
import apiService from '../services/api/apiService';

const useDMStore = create((set) => ({
    /** Total unread message count across all DM threads */
    unreadDMCount: 0,

    /**
     * Fetch the total unread DM count from the lightweight
     * GET /messages/unread-count endpoint (single indexed COUNT query).
     * Call this on app mount and when the app returns to the foreground.
     * Fails silently on any error so the badge degrades gracefully.
     */
    fetchDMUnreadCount: async () => {
        try {
            const data = await apiService.getTotalDMUnreadCount();
            set({ unreadDMCount: data?.total_unread ?? 0 });
        } catch (err) {
            // 401 (logged out), network errors, etc. — degrade silently; badge stays at last known value
            if (err?.status !== 401) {
                Logger.warn('fetchDMUnreadCount failed', err?.message);
            }
        }
    },

    /**
     * Reset the badge to zero locally.
     * Call this when the user opens the Messages inbox so the badge
     * clears immediately without waiting for the next poll.
     */
    resetDMUnread: () => set({ unreadDMCount: 0 }),
}));

export default useDMStore;
