/**
 * useDMStore Tests
 *
 * Tests the store directly via Zustand's getState()/setState() API — no
 * React or renderHook required, which matches the pattern used in
 * useViewModeStore.test.js and keeps the suite fast.
 *
 * Covers:
 *   - fetchDMUnreadCount — reads total_unread from GET /messages/unread-count
 *   - fetchDMUnreadCount — handles zero / missing field in response
 *   - fetchDMUnreadCount — fails silently on network error (badge unchanged)
 *   - fetchDMUnreadCount — fails silently on 401 (no log noise)
 *   - resetDMUnread     — sets unreadDMCount to 0
 */

import useDMStore from "../useDMStore";

// ── Mocks ─────────────────────────────────────────────────────────────────────

jest.mock("../../services/api/apiService", () => ({
    getTotalDMUnreadCount: jest.fn(),
}));

// Logger calls are intentional silent-fail paths — suppress test output
jest.mock("../../utils/logger", () => ({
    warn: jest.fn(),
    log: jest.fn(),
    error: jest.fn(),
}));

import apiService from "../../services/api/apiService";
import Logger from "../../utils/logger";

// ── Helpers ───────────────────────────────────────────────────────────────────

function resetStore() {
    useDMStore.setState({ unreadDMCount: 0 });
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

    it("sets unreadDMCount to total_unread from the endpoint", async () => {
        apiService.getTotalDMUnreadCount.mockResolvedValue({ total_unread: 4 });

        await useDMStore.getState().fetchDMUnreadCount();

        expect(useDMStore.getState().unreadDMCount).toBe(4);
    });

    it("sets unreadDMCount to 0 when total_unread is 0", async () => {
        apiService.getTotalDMUnreadCount.mockResolvedValue({ total_unread: 0 });

        await useDMStore.getState().fetchDMUnreadCount();

        expect(useDMStore.getState().unreadDMCount).toBe(0);
    });

    it("handles missing total_unread field (defaults to 0)", async () => {
        apiService.getTotalDMUnreadCount.mockResolvedValue({});

        await useDMStore.getState().fetchDMUnreadCount();

        expect(useDMStore.getState().unreadDMCount).toBe(0);
    });

    it("handles null response (defaults to 0)", async () => {
        apiService.getTotalDMUnreadCount.mockResolvedValue(null);

        await useDMStore.getState().fetchDMUnreadCount();

        expect(useDMStore.getState().unreadDMCount).toBe(0);
    });

    it("leaves unreadDMCount unchanged on network error (silent fail)", async () => {
        useDMStore.setState({ unreadDMCount: 5 });
        const err = new Error("Network error");
        apiService.getTotalDMUnreadCount.mockRejectedValue(err);

        await useDMStore.getState().fetchDMUnreadCount();

        // Badge must NOT be reset on error — keeps last known value
        expect(useDMStore.getState().unreadDMCount).toBe(5);
        expect(Logger.warn).toHaveBeenCalledWith(
            "fetchDMUnreadCount failed",
            err.message,
        );
    });

    it("leaves unreadDMCount unchanged on 401 and does NOT log a warning", async () => {
        useDMStore.setState({ unreadDMCount: 3 });
        const err = Object.assign(new Error("Unauthorized"), { status: 401 });
        apiService.getTotalDMUnreadCount.mockRejectedValue(err);

        await useDMStore.getState().fetchDMUnreadCount();

        expect(useDMStore.getState().unreadDMCount).toBe(3);
        // 401 is a normal logged-out state — must not log noise
        expect(Logger.warn).not.toHaveBeenCalled();
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

    it("fetch → reset → re-fetch reflects correct badge lifecycle", async () => {
        apiService.getTotalDMUnreadCount.mockResolvedValue({ total_unread: 3 });

        // 1. Fetch populates the badge
        await useDMStore.getState().fetchDMUnreadCount();
        expect(useDMStore.getState().unreadDMCount).toBe(3);

        // 2. User opens inbox → badge clears immediately
        useDMStore.getState().resetDMUnread();
        expect(useDMStore.getState().unreadDMCount).toBe(0);

        // 3. Next foreground refresh with no new DMs
        apiService.getTotalDMUnreadCount.mockResolvedValue({ total_unread: 0 });
        await useDMStore.getState().fetchDMUnreadCount();
        expect(useDMStore.getState().unreadDMCount).toBe(0);
    });
});
