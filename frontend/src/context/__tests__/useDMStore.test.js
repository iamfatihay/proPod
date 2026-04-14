/**
 * useDMStore Tests
 *
 * Tests the store directly via Zustand's getState()/setState() API — no
 * React or renderHook required, which matches the pattern used in
 * useViewModeStore.test.js and keeps the suite fast.
 *
 * Covers:
 *   - fetchDMUnreadCount — sums unread_count across threads
 *   - fetchDMUnreadCount — handles empty/missing threads
 *   - fetchDMUnreadCount — handles missing unread_count on a thread
 *   - fetchDMUnreadCount — fails silently on API error (badge stays at last value)
 *   - resetDMUnread     — sets unreadDMCount to 0
 */

import { renderHook, act } from "@testing-library/react-native";
import useDMStore from "../useDMStore";

// ── Mocks ─────────────────────────────────────────────────────────────────────

jest.mock("../../services/api/apiService", () => ({
    getDMInbox: jest.fn(),
}));

// Logger.warn calls are intentional silent-fail paths — suppress test output
jest.mock("../../utils/logger", () => ({
    warn: jest.fn(),
    log: jest.fn(),
    error: jest.fn(),
}));

import apiService from "../../services/api/apiService";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Reset store to initial state before each test */
function resetStore() {
    useDMStore.setState({ unreadDMCount: 0 });
}

function makeThread(overrides = {}) {
    return {
        partner_id: 1,
        partner_name: "Alice",
        last_message_body: "Hey!",
        last_message_at: new Date().toISOString(),
        unread_count: 0,
        ...overrides,
    };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("useDMStore", () => {
    beforeEach(() => {
        resetStore();
        jest.clearAllMocks();
    });

    // ── Initial state ──────────────────────────────────────────────────────

    it("initialises with unreadDMCount = 0", () => {
        expect(useDMStore.getState().unreadDMCount).toBe(0);
    });

    // ── fetchDMUnreadCount ─────────────────────────────────────────────────

    it("sums unread_count across multiple threads", async () => {
        apiService.getDMInbox.mockResolvedValue({
            threads: [
                makeThread({ partner_id: 1, unread_count: 3 }),
                makeThread({ partner_id: 2, unread_count: 1 }),
                makeThread({ partner_id: 3, unread_count: 0 }),
            ],
        });

        await useDMStore.getState().fetchDMUnreadCount();

        expect(useDMStore.getState().unreadDMCount).toBe(4);
    });

    it("sets unreadDMCount to 0 when all threads are read", async () => {
        apiService.getDMInbox.mockResolvedValue({
            threads: [
                makeThread({ unread_count: 0 }),
                makeThread({ partner_id: 2, unread_count: 0 }),
            ],
        });

        await useDMStore.getState().fetchDMUnreadCount();

        expect(useDMStore.getState().unreadDMCount).toBe(0);
    });

    it("handles empty threads array", async () => {
        apiService.getDMInbox.mockResolvedValue({ threads: [] });

        await useDMStore.getState().fetchDMUnreadCount();

        expect(useDMStore.getState().unreadDMCount).toBe(0);
    });

    it("handles missing threads key in response", async () => {
        // API returns data without 'threads' — should default to []
        apiService.getDMInbox.mockResolvedValue({});

        await useDMStore.getState().fetchDMUnreadCount();

        expect(useDMStore.getState().unreadDMCount).toBe(0);
    });

    it("handles threads with missing unread_count field", async () => {
        // unread_count may be undefined if API changes — should treat as 0
        apiService.getDMInbox.mockResolvedValue({
            threads: [
                { partner_id: 1, partner_name: "Bob" },          // no unread_count
                makeThread({ partner_id: 2, unread_count: 2 }),
            ],
        });

        await useDMStore.getState().fetchDMUnreadCount();

        expect(useDMStore.getState().unreadDMCount).toBe(2);
    });

    it("leaves unreadDMCount unchanged on API error (silent fail)", async () => {
        // Pre-seed a non-zero count so we can verify it stays put
        useDMStore.setState({ unreadDMCount: 5 });
        apiService.getDMInbox.mockRejectedValue(new Error("Network error"));

        await useDMStore.getState().fetchDMUnreadCount();

        // Should NOT reset the badge on error — keeps last known value
        expect(useDMStore.getState().unreadDMCount).toBe(5);
    });

    // ── resetDMUnread ──────────────────────────────────────────────────────

    it("resets unreadDMCount to 0", () => {
        useDMStore.setState({ unreadDMCount: 7 });

        useDMStore.getState().resetDMUnread();

        expect(useDMStore.getState().unreadDMCount).toBe(0);
    });

    it("reset is idempotent when count is already 0", () => {
        useDMStore.getState().resetDMUnread();

        expect(useDMStore.getState().unreadDMCount).toBe(0);
    });

    // ── Full round-trip ────────────────────────────────────────────────────

    it("fetch then reset reflects correct badge lifecycle", async () => {
        apiService.getDMInbox.mockResolvedValue({
            threads: [
                makeThread({ unread_count: 2 }),
                makeThread({ partner_id: 2, unread_count: 1 }),
            ],
        });

        // 1. Fetch populates the badge
        await useDMStore.getState().fetchDMUnreadCount();
        expect(useDMStore.getState().unreadDMCount).toBe(3);

        // 2. User opens inbox → badge clears immediately
        useDMStore.getState().resetDMUnread();
        expect(useDMStore.getState().unreadDMCount).toBe(0);

        // 3. Next foreground refresh with no new DMs
        apiService.getDMInbox.mockResolvedValue({ threads: [] });
        await useDMStore.getState().fetchDMUnreadCount();
        expect(useDMStore.getState().unreadDMCount).toBe(0);
    });
});
