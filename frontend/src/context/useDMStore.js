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
     * Fetch the DM inbox and sum unread_count across all threads.
     * Call this on app mount and when the app returns to the foreground.
     * Fails silently on network error so the badge degrades gracefully.
     */
    fetchDMUnreadCount: async () => {
        try {
            const data = await apiService.getTotalDMUnreadCount();
            set({ unreadDMCount: data?.total_unread ?? 0 });
        } catch (err) {
            // Network errors are expected offline — degrade silently
            Logger.warn('fetchDMUnreadCount: could not reach server', err?.message);
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
