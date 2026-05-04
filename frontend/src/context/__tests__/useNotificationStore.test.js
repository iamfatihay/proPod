/**
 * useNotificationStore Tests
 *
 * Covers the server-sync logic that lives in the store:
 *   - fetchNotifications  -- merges server + local notifications
 *   - markAsReadWithSync  -- optimistic update, then PATCH to server
 *   - markAllAsReadWithSync -- marks all read, then POST to server
 *
 * Local-only operations (addNotification, markAsRead, clearAll --) are
 * straightforward state mutations tested at the bottom.
 */

import { renderHook, act } from "@testing-library/react-native";
import useNotificationStore from "../useNotificationStore";

// ---

jest.mock("../../services/api/apiService", () => ({
    getNotifications: jest.fn(),
    markNotificationRead: jest.fn(),
    markAllNotificationsRead: jest.fn(),
}));

import apiService from "../../services/api/apiService";
import AsyncStorage from "@react-native-async-storage/async-storage";

// ---

function resetStore() {
    useNotificationStore.setState({
        notifications: [],
        unreadCount: 0,
        isLoaded: false,
    });
}

function makeLocal(overrides = {}) {
    return {
        id: `local_${Date.now()}_test`,
        type: "ai_complete",
        title: "AI done",
        message: "Transcription ready",
        read: false,
        created_at: Date.now(),
        ...overrides,
    };
}

function makeServerApiNotif(overrides = {}) {
    return {
        id: 1,
        type: "like",
        title: "Someone liked your podcast",
        message: "New like!",
        read: false,
        created_at: new Date().toISOString(),
        podcast_id: 42,
        ...overrides,
    };
}

// ---

describe("useNotificationStore", () => {
    beforeEach(() => {
        resetStore();
        jest.clearAllMocks();
        // Clear the AsyncStorage in-memory backing store so tests are independent
        AsyncStorage.__clearMockStorage();
    });

    // ---

    describe("fetchNotifications()", () => {
        it("populates store with server notifications normalised to local schema", async () => {
            const serverNotif = makeServerApiNotif({ id: 10, podcast_id: 99 });

            apiService.getNotifications.mockResolvedValueOnce({
                notifications: [serverNotif],
                total: 1,
                unread_count: 1,
            });

            const { result } = renderHook(() => useNotificationStore());

            await act(async () => {
                await result.current.fetchNotifications();
            });

            expect(result.current.notifications).toHaveLength(1);

            const stored = result.current.notifications[0];
            expect(stored.id).toBe("srv_10");
            expect(stored._serverId).toBe(10);
            expect(stored.action).toEqual({
                type: "navigate",
                screen: "details",
                params: { id: 99 },
            });
            expect(stored.read).toBe(false);
            expect(result.current.unreadCount).toBe(1);
        });

        it("sets action to null when notification has no podcast_id", async () => {
            apiService.getNotifications.mockResolvedValueOnce({
                notifications: [makeServerApiNotif({ id: 5, podcast_id: null })],
                total: 1,
                unread_count: 0,
            });

            const { result } = renderHook(() => useNotificationStore());

            await act(async () => {
                await result.current.fetchNotifications();
            });

            expect(result.current.notifications[0].action).toBeNull();
        });

        it("preserves local (device-only) ai_complete notifications alongside server data", async () => {
            const localAi = makeLocal({ id: "local_ai_001", type: "ai_complete" });
            useNotificationStore.setState({
                notifications: [localAi],
                unreadCount: 1,
                isLoaded: true,
            });

            apiService.getNotifications.mockResolvedValueOnce({
                notifications: [makeServerApiNotif({ id: 20 })],
                total: 1,
                unread_count: 1,
            });

            const { result } = renderHook(() => useNotificationStore());

            await act(async () => {
                await result.current.fetchNotifications();
            });

            const ids = result.current.notifications.map((n) => n.id);
            expect(ids).toContain("local_ai_001");
            expect(ids).toContain("srv_20");
            expect(result.current.notifications).toHaveLength(2);
        });

        it("replaces stale server-type local notifications with fresh server data", async () => {
            const staleLike = {
                id: "srv_5",
                _serverId: 5,
                type: "like",
                read: false,
                created_at: Date.now() - 10000,
                title: "Old like",
                message: "Old",
            };
            useNotificationStore.setState({
                notifications: [staleLike],
                unreadCount: 1,
                isLoaded: true,
            });

            apiService.getNotifications.mockResolvedValueOnce({
                notifications: [makeServerApiNotif({ id: 5, read: true })],
                total: 1,
                unread_count: 0,
            });

            const { result } = renderHook(() => useNotificationStore());

            await act(async () => {
                await result.current.fetchNotifications();
            });

            expect(result.current.notifications).toHaveLength(1);
            expect(result.current.notifications[0].id).toBe("srv_5");
            expect(result.current.notifications[0].read).toBe(true);
            expect(result.current.unreadCount).toBe(0);
        });

        it("drops legacy local new_episode notifications when server results arrive", async () => {
            // A local 'new_episode' notification that was cached before the server
            // normalisation was introduced (non-'srv_' id, device-only origin).
            // After fetchNotifications(), the server-backed version should replace it
            // and the local copy must NOT appear in the merged list.
            const legacyLocal = {
                id: "local_ne_001",            // non-srv_ prefix -- treated as local
                type: "new_episode",
                title: "New episode from Creator",
                message: "Creator just published \"Episode 5\"",
                read: false,
                created_at: Date.now() - 5000,
            };
            useNotificationStore.setState({
                notifications: [legacyLocal],
                unreadCount: 1,
                isLoaded: true,
            });

            apiService.getNotifications.mockResolvedValueOnce({
                notifications: [
                    makeServerApiNotif({ id: 30, type: "new_episode", podcast_id: 55 }),
                ],
                total: 1,
                unread_count: 1,
            });

            const { result } = renderHook(() => useNotificationStore());

            await act(async () => {
                await result.current.fetchNotifications();
            });

            // Only the server-normalised entry should survive
            expect(result.current.notifications).toHaveLength(1);
            expect(result.current.notifications[0].id).toBe("srv_30");

            // The legacy local entry must be gone
            const ids = result.current.notifications.map((n) => n.id);
            expect(ids).not.toContain("local_ne_001");
        });

        it("handles empty notifications array from server gracefully", async () => {
            apiService.getNotifications.mockResolvedValueOnce({
                notifications: [],
                total: 0,
                unread_count: 0,
            });

            const { result } = renderHook(() => useNotificationStore());

            await act(async () => {
                await result.current.fetchNotifications();
            });

            expect(result.current.notifications).toHaveLength(0);
            expect(result.current.unreadCount).toBe(0);
        });

        it("silently ignores API errors and keeps existing local state", async () => {
            const localAi = makeLocal({ id: "local_ai_002" });
            useNotificationStore.setState({
                notifications: [localAi],
                unreadCount: 1,
                isLoaded: true,
            });

            apiService.getNotifications.mockRejectedValueOnce(
                new Error("Network error")
            );

            const { result } = renderHook(() => useNotificationStore());

            await act(async () => {
                await result.current.fetchNotifications();
            });

            expect(result.current.notifications).toHaveLength(1);
            expect(result.current.notifications[0].id).toBe("local_ai_002");
            expect(result.current.unreadCount).toBe(1);
        });

        it("does not throw when API returns null", async () => {
            apiService.getNotifications.mockResolvedValueOnce(null);

            const { result } = renderHook(() => useNotificationStore());

            await expect(
                act(async () => {
                    await result.current.fetchNotifications();
                })
            ).resolves.not.toThrow();
        });
    });

    // ---

    describe("markAsReadWithSync()", () => {
        it("optimistically marks notification as read and decrements unreadCount", async () => {
            const serverNotif = {
                id: "srv_7",
                _serverId: 7,
                type: "like",
                read: false,
                created_at: Date.now(),
                title: "Like",
                message: "Liked",
            };
            useNotificationStore.setState({
                notifications: [serverNotif],
                unreadCount: 1,
                isLoaded: true,
            });

            apiService.markNotificationRead.mockResolvedValueOnce({ id: 7, read: true });

            const { result } = renderHook(() => useNotificationStore());

            await act(async () => {
                await result.current.markAsReadWithSync("srv_7");
            });

            expect(result.current.notifications[0].read).toBe(true);
            expect(result.current.unreadCount).toBe(0);
        });

        it("calls markNotificationRead API with the original server id", async () => {
            const serverNotif = {
                id: "srv_8",
                _serverId: 8,
                type: "comment",
                read: false,
                created_at: Date.now(),
                title: "Comment",
                message: "Someone commented",
            };
            useNotificationStore.setState({
                notifications: [serverNotif],
                unreadCount: 1,
                isLoaded: true,
            });

            apiService.markNotificationRead.mockResolvedValueOnce({});

            const { result } = renderHook(() => useNotificationStore());

            await act(async () => {
                await result.current.markAsReadWithSync("srv_8");
            });

            expect(apiService.markNotificationRead).toHaveBeenCalledWith(8);
        });

        it("does NOT call API for local device-only notifications (no _serverId)", async () => {
            const localNotif = makeLocal({ id: "local_xyz", type: "ai_complete" });
            useNotificationStore.setState({
                notifications: [localNotif],
                unreadCount: 1,
                isLoaded: true,
            });

            const { result } = renderHook(() => useNotificationStore());

            await act(async () => {
                await result.current.markAsReadWithSync("local_xyz");
            });

            expect(result.current.notifications[0].read).toBe(true);
            expect(apiService.markNotificationRead).not.toHaveBeenCalled();
        });

        it("retains optimistic local update even if API call fails", async () => {
            const serverNotif = {
                id: "srv_9",
                _serverId: 9,
                type: "like",
                read: false,
                created_at: Date.now(),
                title: "Like",
                message: "Liked",
            };
            useNotificationStore.setState({
                notifications: [serverNotif],
                unreadCount: 1,
                isLoaded: true,
            });

            apiService.markNotificationRead.mockRejectedValueOnce(
                new Error("API error")
            );

            const { result } = renderHook(() => useNotificationStore());

            await act(async () => {
                await result.current.markAsReadWithSync("srv_9");
            });

            expect(result.current.notifications[0].read).toBe(true);
            expect(result.current.unreadCount).toBe(0);
        });

        it("is a no-op when notification is already read (API not called)", async () => {
            const readNotif = {
                id: "srv_10",
                _serverId: 10,
                type: "like",
                read: true,
                created_at: Date.now(),
                title: "Like",
                message: "Liked",
            };
            useNotificationStore.setState({
                notifications: [readNotif],
                unreadCount: 0,
                isLoaded: true,
            });

            const { result } = renderHook(() => useNotificationStore());

            await act(async () => {
                await result.current.markAsReadWithSync("srv_10");
            });

            expect(result.current.unreadCount).toBe(0);
            expect(apiService.markNotificationRead).not.toHaveBeenCalled();
        });
    });

    // ---

    describe("markAllAsReadWithSync()", () => {
        it("marks all notifications as read and resets unreadCount to 0", async () => {
            useNotificationStore.setState({
                notifications: [
                    makeLocal({ id: "a", read: false }),
                    makeLocal({ id: "b", read: false }),
                    makeLocal({ id: "c", read: true }),
                ],
                unreadCount: 2,
                isLoaded: true,
            });

            apiService.markAllNotificationsRead.mockResolvedValueOnce({
                message: "All notifications marked as read",
            });

            const { result } = renderHook(() => useNotificationStore());

            await act(async () => {
                await result.current.markAllAsReadWithSync();
            });

            expect(result.current.notifications.every((n) => n.read)).toBe(true);
            expect(result.current.unreadCount).toBe(0);
        });

        it("calls markAllNotificationsRead API endpoint exactly once", async () => {
            useNotificationStore.setState({
                notifications: [makeLocal({ id: "d", read: false })],
                unreadCount: 1,
                isLoaded: true,
            });

            apiService.markAllNotificationsRead.mockResolvedValueOnce({});

            const { result } = renderHook(() => useNotificationStore());

            await act(async () => {
                await result.current.markAllAsReadWithSync();
            });

            expect(apiService.markAllNotificationsRead).toHaveBeenCalledTimes(1);
        });

        it("retains optimistic update even when API call fails", async () => {
            useNotificationStore.setState({
                notifications: [makeLocal({ id: "e", read: false })],
                unreadCount: 1,
                isLoaded: true,
            });

            apiService.markAllNotificationsRead.mockRejectedValueOnce(
                new Error("API error")
            );

            const { result } = renderHook(() => useNotificationStore());

            await act(async () => {
                await result.current.markAllAsReadWithSync();
            });

            expect(result.current.unreadCount).toBe(0);
            expect(result.current.notifications[0].read).toBe(true);
        });

        it("works without throwing when there are no notifications", async () => {
            apiService.markAllNotificationsRead.mockResolvedValueOnce({});

            const { result } = renderHook(() => useNotificationStore());

            await expect(
                act(async () => {
                    await result.current.markAllAsReadWithSync();
                })
            ).resolves.not.toThrow();

            expect(result.current.unreadCount).toBe(0);
        });
    });

    // ---

    describe("addNotification()", () => {
        it("prepends a notification and increments unreadCount", () => {
            const { result } = renderHook(() => useNotificationStore());

            act(() => {
                result.current.addNotification({
                    type: "ai_complete",
                    title: "Done",
                    message: "Transcription complete",
                });
            });

            expect(result.current.notifications).toHaveLength(1);
            expect(result.current.unreadCount).toBe(1);
            expect(result.current.notifications[0].read).toBe(false);
        });

        it("returns the new notification object with generated id", () => {
            const { result } = renderHook(() => useNotificationStore());
            let returned;

            act(() => {
                returned = result.current.addNotification({
                    type: "system",
                    title: "System alert",
                    message: "Maintenance tonight",
                });
            });

            expect(returned).toBeDefined();
            expect(returned.type).toBe("system");
            expect(returned.read).toBe(false);
            expect(typeof returned.id).toBe("string");
        });
    });

    describe("markAsRead()", () => {
        it("marks a specific notification as read and decrements unreadCount", () => {
            const notif = makeLocal({ id: "local_r1" });
            useNotificationStore.setState({
                notifications: [notif],
                unreadCount: 1,
                isLoaded: true,
            });

            const { result } = renderHook(() => useNotificationStore());

            act(() => {
                result.current.markAsRead("local_r1");
            });

            expect(result.current.notifications[0].read).toBe(true);
            expect(result.current.unreadCount).toBe(0);
        });

        it("does not change unreadCount when notification is already read", () => {
            const notif = makeLocal({ id: "local_r2", read: true });
            useNotificationStore.setState({
                notifications: [notif],
                unreadCount: 0,
                isLoaded: true,
            });

            const { result } = renderHook(() => useNotificationStore());

            act(() => {
                result.current.markAsRead("local_r2");
            });

            expect(result.current.unreadCount).toBe(0);
        });
    });

    describe("removeNotification()", () => {
        it("removes an unread notification and decrements unreadCount", () => {
            const notif = makeLocal({ id: "local_del1", read: false });
            useNotificationStore.setState({
                notifications: [notif],
                unreadCount: 1,
                isLoaded: true,
            });

            const { result } = renderHook(() => useNotificationStore());

            act(() => {
                result.current.removeNotification("local_del1");
            });

            expect(result.current.notifications).toHaveLength(0);
            expect(result.current.unreadCount).toBe(0);
        });

        it("does not change unreadCount when removing an already-read notification", () => {
            const notif = makeLocal({ id: "local_del2", read: true });
            useNotificationStore.setState({
                notifications: [notif],
                unreadCount: 0,
                isLoaded: true,
            });

            const { result } = renderHook(() => useNotificationStore());

            act(() => {
                result.current.removeNotification("local_del2");
            });

            expect(result.current.notifications).toHaveLength(0);
            expect(result.current.unreadCount).toBe(0);
        });
    });

    describe("clearAll()", () => {
        it("empties notifications list and resets unreadCount", () => {
            useNotificationStore.setState({
                notifications: [
                    makeLocal({ id: "n1", read: false }),
                    makeLocal({ id: "n2", read: true }),
                ],
                unreadCount: 1,
                isLoaded: true,
            });

            const { result } = renderHook(() => useNotificationStore());

            act(() => {
                result.current.clearAll();
            });

            expect(result.current.notifications).toHaveLength(0);
            expect(result.current.unreadCount).toBe(0);
        });
    });

    describe("getNotificationsByType()", () => {
        it("returns only notifications of the requested type", () => {
            useNotificationStore.setState({
                notifications: [
                    makeLocal({ id: "t1", type: "like" }),
                    makeLocal({ id: "t2", type: "ai_complete" }),
                    makeLocal({ id: "t3", type: "like" }),
                ],
                unreadCount: 3,
                isLoaded: true,
            });

            const { result } = renderHook(() => useNotificationStore());

            const likes = result.current.getNotificationsByType("like");
            expect(likes).toHaveLength(2);
            expect(likes.every((n) => n.type === "like")).toBe(true);
        });
    });

    describe("getUnreadNotifications()", () => {
        it("returns only unread notifications", () => {
            useNotificationStore.setState({
                notifications: [
                    makeLocal({ id: "u1", read: false }),
                    makeLocal({ id: "u2", read: true }),
                    makeLocal({ id: "u3", read: false }),
                ],
                unreadCount: 2,
                isLoaded: true,
            });

            const { result } = renderHook(() => useNotificationStore());

            const unread = result.current.getUnreadNotifications();
            expect(unread).toHaveLength(2);
            expect(unread.every((n) => !n.read)).toBe(true);
        });
    });

    describe("markAllRead()", () => {
        it("clears badge, stamps lastReadTimestamp, marks all notifications read", async () => {
            const { result } = renderHook(() => useNotificationStore());
            act(() => {
                useNotificationStore.setState({
                    notifications: [
                        { id: "1", read: false, created_at: Date.now() - 5000, type: "like" },
                        { id: "2", read: false, created_at: Date.now() - 3000, type: "comment" },
                    ],
                    unreadCount: 2,
                    lastReadTimestamp: 0,
                });
            });
            const before = Date.now();
            await act(async () => { await result.current.markAllRead(); });
            const after = Date.now();
            const state = useNotificationStore.getState();
            expect(state.unreadCount).toBe(0);
            expect(state.lastReadTimestamp).toBeGreaterThanOrEqual(before);
            expect(state.lastReadTimestamp).toBeLessThanOrEqual(after);
            expect(state.notifications.every((n) => n.read)).toBe(true);
        });

        it("persists lastReadTimestamp to AsyncStorage", async () => {
            const { result } = renderHook(() => useNotificationStore());
            await act(async () => { await result.current.markAllRead(); });
            const raw = await AsyncStorage.getItem("@notifications");
            const parsed = JSON.parse(raw);
            expect(parsed.lastReadTimestamp).toBeGreaterThan(0);
        });
    });

    describe("lastReadTimestamp badge derivation", () => {
        it("loadFromStorage uses timestamp to compute unreadCount -- newer items only", async () => {
            const ts = Date.now() - 1000;
            const notifications = [
                { id: "1", read: false, created_at: ts - 5000, type: "like" },
                { id: "2", read: false, created_at: ts + 500,  type: "comment" },
            ];
            await AsyncStorage.setItem("@notifications", JSON.stringify({
                notifications, unreadCount: 2, lastReadTimestamp: ts,
            }));
            const { result } = renderHook(() => useNotificationStore());
            await act(async () => { await result.current.loadFromStorage(); });
            expect(result.current.unreadCount).toBe(1);
            expect(result.current.lastReadTimestamp).toBe(ts);
        });

        it("loadFromStorage falls back to read-flag count when lastReadTimestamp is 0", async () => {
            const notifications = [
                { id: "1", read: false, created_at: Date.now() - 5000, type: "like" },
                { id: "2", read: true,  created_at: Date.now() - 3000, type: "comment" },
            ];
            await AsyncStorage.setItem("@notifications", JSON.stringify({
                notifications, unreadCount: 1, lastReadTimestamp: 0,
            }));
            const { result } = renderHook(() => useNotificationStore());
            await act(async () => { await result.current.loadFromStorage(); });
            expect(result.current.unreadCount).toBe(1);
        });
    });

});