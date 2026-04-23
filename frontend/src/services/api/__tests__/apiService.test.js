import apiService from "../apiService";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Mock the token storage
jest.mock("../../auth/tokenStorage", () => ({
    getToken: jest.fn(),
    saveToken: jest.fn(),
    deleteToken: jest.fn(),
}));

import { getToken, saveToken, deleteToken } from "../../auth/tokenStorage";

describe("ApiService", () => {
    beforeEach(() => {
        global.fetch.mockClear();
        getToken.mockClear();
        saveToken.mockClear();
        deleteToken.mockClear();

        // Mock default token behavior
        getToken.mockImplementation((tokenType) => {
            if (tokenType === "accessToken")
                return Promise.resolve("mock-access-token");
            if (tokenType === "refreshToken")
                return Promise.resolve("mock-refresh-token");
            return Promise.resolve(null);
        });
    });

    describe("Authentication Methods", () => {
        test("login() should authenticate user and store tokens", async () => {
            const mockResponse = {
                access_token: "new-access-token",
                refresh_token: "new-refresh-token",
                token_type: "bearer",
                user: { id: 1, email: "test@example.com", name: "Test User" },
            };

            global.mockApiResponse(mockResponse);

            const result = await apiService.login(
                "test@example.com",
                "password"
            );

            expect(global.fetch).toHaveBeenCalledWith(
                "http://localhost:8000/users/login",
                expect.objectContaining({
                    method: "POST",
                    headers: expect.objectContaining({
                        "Content-Type": "application/json",
                    }),
                    body: JSON.stringify({
                        email: "test@example.com",
                        password: "password",
                    }),
                })
            );

            expect(saveToken).toHaveBeenCalledWith(
                "accessToken",
                "new-access-token"
            );
            expect(saveToken).toHaveBeenCalledWith(
                "refreshToken",
                "new-refresh-token"
            );
            expect(result).toEqual(mockResponse);
        });

        test("googleLogin() should authenticate with Google and store tokens", async () => {
            const mockResponse = {
                access_token: "google-access-token",
                refresh_token: "google-refresh-token",
                token_type: "bearer",
                user: { id: 1, email: "test@gmail.com", name: "Test User" },
            };

            global.mockApiResponse(mockResponse);

            const googleData = {
                google_access_token: "google-provider-token",
            };

            const result = await apiService.googleLogin(googleData);

            expect(global.fetch).toHaveBeenCalledWith(
                "http://localhost:8000/users/google-login",
                expect.objectContaining({
                    method: "POST",
                    body: JSON.stringify({
                        google_access_token: "google-provider-token",
                        provider: "google",
                    }),
                })
            );

            expect(result).toEqual(mockResponse);
        });

        test("logout() should clear stored tokens", async () => {
            await apiService.logout();

            expect(deleteToken).toHaveBeenCalledWith("accessToken");
            expect(deleteToken).toHaveBeenCalledWith("refreshToken");
        });
    });

    describe("Podcast CRUD Methods", () => {
        test("createPodcast() should create new podcast", async () => {
            const podcastData = {
                title: "Test Podcast",
                description: "Test Description",
                category: "Tech",
            };

            const mockResponse = {
                id: 1,
                ...podcastData,
                owner_id: 1,
                created_at: "2024-01-15T10:30:00Z",
            };

            global.mockApiResponse(mockResponse);

            const result = await apiService.createPodcast(podcastData);

            expect(global.fetch).toHaveBeenCalledWith(
                "http://localhost:8000/podcasts/create",
                expect.objectContaining({
                    method: "POST",
                    headers: expect.objectContaining({
                        Authorization: "Bearer mock-access-token",
                    }),
                    body: JSON.stringify(podcastData),
                })
            );

            expect(result).toEqual(mockResponse);
        });

        test("getPodcast() should fetch specific podcast", async () => {
            const mockPodcast = {
                id: 1,
                title: "Test Podcast",
                play_count: 100,
                like_count: 20,
            };

            global.mockApiResponse(mockPodcast);

            const result = await apiService.getPodcast(1);

            expect(global.fetch).toHaveBeenCalledWith(
                "http://localhost:8000/podcasts/1",
                expect.objectContaining({
                    headers: expect.objectContaining({
                        Authorization: "Bearer mock-access-token",
                    }),
                })
            );

            expect(result).toEqual(mockPodcast);
        });

        test("getPodcasts() should fetch podcasts with query parameters", async () => {
            const mockResponse = {
                podcasts: [{ id: 1, title: "Podcast 1" }],
                total: 1,
                has_more: false,
            };

            global.mockApiResponse(mockResponse);

            const params = {
                skip: 0,
                limit: 10,
                category: "Tech",
                search: "AI",
            };

            const result = await apiService.getPodcasts(params);

            expect(global.fetch).toHaveBeenCalledWith(
                "http://localhost:8000/podcasts/?skip=0&limit=10&category=Tech&search=AI",
                expect.any(Object)
            );

            // getPodcasts now returns only the podcasts array
            expect(result).toEqual(mockResponse.podcasts);
        });

        test("updatePodcast() should update podcast", async () => {
            const updateData = { title: "Updated Title" };
            const mockResponse = { id: 1, title: "Updated Title" };

            global.mockApiResponse(mockResponse);

            const result = await apiService.updatePodcast(1, updateData);

            expect(global.fetch).toHaveBeenCalledWith(
                "http://localhost:8000/podcasts/1",
                expect.objectContaining({
                    method: "PUT",
                    body: JSON.stringify(updateData),
                })
            );

            expect(result).toEqual(mockResponse);
        });

        test("deletePodcast() should delete podcast", async () => {
            global.mockApiResponse({ message: "Podcast deleted successfully" });

            const result = await apiService.deletePodcast(1);

            expect(global.fetch).toHaveBeenCalledWith(
                "http://localhost:8000/podcasts/1",
                expect.objectContaining({
                    method: "DELETE",
                })
            );

            expect(result.message).toBe("Podcast deleted successfully");
        });
    });

    describe("Podcast Interaction Methods", () => {
        test("likePodcast() should like a podcast", async () => {
            const mockResponse = {
                id: 1,
                user_id: 1,
                podcast_id: 123,
                created_at: "2024-01-15T10:30:00Z",
            };

            global.mockApiResponse(mockResponse);

            const result = await apiService.likePodcast(123);

            expect(global.fetch).toHaveBeenCalledWith(
                "http://localhost:8000/podcasts/123/like",
                expect.objectContaining({
                    method: "POST",
                })
            );

            expect(result).toEqual(mockResponse);
        });

        test("unlikePodcast() should unlike a podcast", async () => {
            global.mockApiResponse({ message: "Podcast unliked successfully" });

            const result = await apiService.unlikePodcast(123);

            expect(global.fetch).toHaveBeenCalledWith(
                "http://localhost:8000/podcasts/123/like",
                expect.objectContaining({
                    method: "DELETE",
                })
            );

            expect(result.message).toBe("Podcast unliked successfully");
        });

        test("addBookmark() should bookmark a podcast", async () => {
            const mockResponse = {
                id: 1,
                user_id: 1,
                podcast_id: 123,
                created_at: "2024-01-15T10:30:00Z",
            };

            global.mockApiResponse(mockResponse);

            const result = await apiService.addBookmark(123);

            expect(global.fetch).toHaveBeenCalledWith(
                "http://localhost:8000/podcasts/123/bookmark",
                expect.objectContaining({
                    method: "POST",
                })
            );

            expect(result).toEqual(mockResponse);
        });

        test("removeBookmark() should remove bookmark", async () => {
            global.mockApiResponse({
                message: "Bookmark removed successfully",
            });

            const result = await apiService.removeBookmark(123);

            expect(global.fetch).toHaveBeenCalledWith(
                "http://localhost:8000/podcasts/123/bookmark",
                expect.objectContaining({
                    method: "DELETE",
                })
            );

            expect(result.message).toBe("Bookmark removed successfully");
        });

        test("getPodcastInteractions() should get user interactions", async () => {
            const mockResponse = {
                is_liked: true,
                is_bookmarked: false,
                listening_history: {
                    position: 1200,
                    completed: false,
                },
            };

            global.mockApiResponse(mockResponse);

            const result = await apiService.getPodcastInteractions(123);

            expect(global.fetch).toHaveBeenCalledWith(
                "http://localhost:8000/podcasts/123/interactions",
                expect.any(Object)
            );

            expect(result).toEqual(mockResponse);
        });
    });

    describe("Listening History Methods", () => {
        test("updateListeningHistory() should update listening progress", async () => {
            const historyData = {
                position: 1800,
                listen_time: 1800,
                completed: true,
            };

            const mockResponse = {
                id: 1,
                user_id: 1,
                podcast_id: 123,
                ...historyData,
                updated_at: "2024-01-15T10:35:00Z",
            };

            global.mockApiResponse(mockResponse);

            const result = await apiService.updateListeningHistory(
                123,
                historyData
            );

            expect(global.fetch).toHaveBeenCalledWith(
                "http://localhost:8000/podcasts/123/history",
                expect.objectContaining({
                    method: "POST",
                    body: JSON.stringify(historyData),
                })
            );

            expect(result).toEqual(mockResponse);
        });

        test("getListeningHistory() should fetch user listening history", async () => {
            const mockHistory = [
                {
                    id: 1,
                    podcast_id: 123,
                    position: 1200,
                    completed: false,
                    podcast: { title: "Test Podcast" },
                },
            ];

            global.mockApiResponse(mockHistory);

            const result = await apiService.getListeningHistory({ limit: 10 });

            expect(global.fetch).toHaveBeenCalledWith(
                "http://localhost:8000/podcasts/my/history?limit=10",
                expect.any(Object)
            );

            expect(result).toEqual(mockHistory);
        });
    });

    describe("Discovery Methods", () => {
        test("getTrendingPodcasts() should fetch trending podcasts", async () => {
            const mockTrending = [
                { id: 1, title: "Trending Podcast 1" },
                { id: 2, title: "Trending Podcast 2" },
            ];

            global.mockApiResponse(mockTrending);

            const result = await apiService.getTrendingPodcasts({
                limit: 5,
                days: 7,
            });

            expect(global.fetch).toHaveBeenCalledWith(
                "http://localhost:8000/podcasts/discover/trending?limit=5&days=7",
                expect.any(Object)
            );

            expect(result).toEqual(mockTrending);
        });

        test("getRecommendedPodcasts() should fetch recommended podcasts", async () => {
            const mockRecommended = [{ id: 3, title: "Recommended Podcast 1" }];

            global.mockApiResponse(mockRecommended);

            const result = await apiService.getRecommendedPodcasts(10);

            expect(global.fetch).toHaveBeenCalledWith(
                "http://localhost:8000/podcasts/discover/recommended?limit=10",
                expect.objectContaining({
                    headers: expect.objectContaining({
                        Authorization: "Bearer mock-access-token",
                    }),
                })
            );

            expect(result).toEqual(mockRecommended);
        });

        test("getRelatedPodcasts() should fetch related podcasts", async () => {
            const mockRelated = [{ id: 4, title: "Related Podcast 1" }];

            global.mockApiResponse(mockRelated);

            const result = await apiService.getRelatedPodcasts(123, 10);

            expect(global.fetch).toHaveBeenCalledWith(
                "http://localhost:8000/podcasts/discover/related/123?limit=10",
                expect.any(Object)
            );

            expect(result).toEqual(mockRelated);
        });
    });

    describe("Error Handling", () => {
        test("should handle 401 unauthorized and retry with refresh token", async () => {
            // First call fails with 401
            global.fetch
                .mockResolvedValueOnce({
                    ok: false,
                    status: 401,
                    json: async () => ({ detail: "Token expired" }),
                })
                // Refresh token call succeeds
                .mockResolvedValueOnce({
                    ok: true,
                    status: 200,
                    json: async () => ({ access_token: "new-access-token" }),
                })
                // Retry original call succeeds
                .mockResolvedValueOnce({
                    ok: true,
                    status: 200,
                    json: async () => ({ id: 1, title: "Test Podcast" }),
                });

            const result = await apiService.getPodcast(1);

            expect(global.fetch).toHaveBeenCalledTimes(3);
            expect(saveToken).toHaveBeenCalledWith(
                "accessToken",
                "new-access-token"
            );
            expect(result).toEqual({ id: 1, title: "Test Podcast" });
        });

        test("should handle network timeout errors", async () => {
            global.fetch.mockRejectedValueOnce({ name: "AbortError" });

            await expect(apiService.getPodcast(1)).rejects.toThrow(
                "Request timeout. Please check your internet connection and try again."
            );
        });

        test("should handle network connection errors", async () => {
            global.fetch.mockRejectedValueOnce({
                message: "Network request failed",
            });

            await expect(apiService.getPodcast(1)).rejects.toThrow(
                "Network error. Please check your internet connection."
            );
        });

        test("should handle validation errors (422)", async () => {
            const validationError = {
                detail: "Validation failed",
                errors: [{ field: "title", message: "Title is required" }],
            };

            global.fetch.mockResolvedValueOnce({
                ok: false,
                status: 422,
                json: async () => validationError,
            });

            try {
                await apiService.createPodcast({});
            } catch (error) {
                expect(error.status).toBe(422);
                expect(error.response.data).toEqual(validationError);
            }
        });
    });

    describe("RTC Methods", () => {
        test("createRtcRoom() should send POST request with correct payload", async () => {
            const mockResponse = {
                id: "room-123",
                name: "test-room",
                session_id: 1,
                enabled: true,
            };

            global.mockApiResponse(mockResponse);

            const roomData = {
                name: "test-room",
                description: "Test description",
                title: "Test Podcast",
                category: "Tech",
                is_public: true,
                media_mode: "video",
            };

            const result = await apiService.createRtcRoom(roomData);

            expect(global.fetch).toHaveBeenCalledWith(
                "http://localhost:8000/rtc/rooms",
                expect.objectContaining({
                    method: "POST",
                    headers: expect.objectContaining({
                        "Content-Type": "application/json",
                        Authorization: expect.stringContaining("Bearer"),
                    }),
                    body: JSON.stringify(roomData),
                })
            );
            expect(result).toEqual(mockResponse);
        });

        test("createRtcToken() should send POST request with room_id and role", async () => {
            const mockResponse = {
                token: "mock-token-123",
                room_id: "room-123",
                role: "host",
                user_id: "1",
                expires_in_seconds: 86400,
            };

            global.mockApiResponse(mockResponse);

            const tokenData = {
                room_id: "room-123",
                role: "host",
            };

            const result = await apiService.createRtcToken(tokenData);

            expect(global.fetch).toHaveBeenCalledWith(
                "http://localhost:8000/rtc/token",
                expect.objectContaining({
                    method: "POST",
                    headers: expect.objectContaining({
                        "Content-Type": "application/json",
                        Authorization: expect.stringContaining("Bearer"),
                    }),
                    body: JSON.stringify(tokenData),
                })
            );
            expect(result).toEqual(mockResponse);
        });

        test("getRtcSession() should send GET request with session ID", async () => {
            const mockResponse = {
                id: 1,
                room_id: "room-123",
                status: "created",
                created_at: "2026-02-21T00:00:00Z",
            };

            global.mockApiResponse(mockResponse);

            const result = await apiService.getRtcSession(1);

            expect(global.fetch).toHaveBeenCalledWith(
                "http://localhost:8000/rtc/sessions/1",
                expect.any(Object)
            );
            expect(result).toEqual(mockResponse);
        });

        test("listRtcSessions() should send GET request with optional filters", async () => {
            const mockResponse = [
                { id: 1, room_id: "room-1", status: "created" },
                { id: 2, room_id: "room-2", status: "completed" },
            ];

            global.mockApiResponse(mockResponse);

            const result = await apiService.listRtcSessions({ room_id: "room-1", limit: 10 });

            expect(global.fetch).toHaveBeenCalledWith(
                "http://localhost:8000/rtc/sessions?room_id=room-1&limit=10",
                expect.any(Object)
            );
            expect(result).toEqual(mockResponse);
        });

        test("listRtcSessions() should handle empty query params", async () => {
            const mockResponse = [];

            global.mockApiResponse(mockResponse);

            const result = await apiService.listRtcSessions();

            expect(global.fetch).toHaveBeenCalledWith(
                "http://localhost:8000/rtc/sessions",
                expect.any(Object)
            );
            expect(result).toEqual(mockResponse);
        });
    });

    // ── Notification Methods ────────────────────────────────────────────────

    describe("Notification Methods", () => {
        // Reset the in-memory token cache so 401-retry tests do not bleed state
        beforeEach(() => { apiService.clearToken(); });
        test("getNotifications() should fetch notifications with default pagination", async () => {
            const mockResponse = {
                notifications: [
                    {
                        id: 1,
                        type: "like",
                        title: "New like",
                        message: "Someone liked your podcast",
                        read: false,
                        created_at: "2026-04-09T10:00:00Z",
                        podcast_id: 42,
                    },
                ],
                total: 1,
                unread_count: 1,
                limit: 30,
                offset: 0,
                has_more: false,
            };

            global.mockApiResponse(mockResponse);

            const result = await apiService.getNotifications();

            expect(global.fetch).toHaveBeenCalledWith(
                "http://localhost:8000/notifications/?skip=0&limit=30",
                expect.objectContaining({
                    headers: expect.objectContaining({
                        Authorization: "Bearer mock-access-token",
                    }),
                })
            );

            expect(result).toEqual(mockResponse);
        });

        test("getNotifications() should pass custom skip and limit as query params", async () => {
            const mockResponse = {
                notifications: [],
                total: 0,
                unread_count: 0,
                limit: 5,
                offset: 20,
                has_more: false,
            };

            global.mockApiResponse(mockResponse);

            const result = await apiService.getNotifications({ skip: 20, limit: 5 });

            expect(global.fetch).toHaveBeenCalledWith(
                "http://localhost:8000/notifications/?skip=20&limit=5",
                expect.any(Object)
            );

            expect(result).toEqual(mockResponse);
        });

        test("markNotificationRead() should send PATCH request to correct endpoint", async () => {
            const mockResponse = {
                id: 7,
                type: "comment",
                title: "New comment",
                message: "Someone commented on your podcast",
                read: true,
                created_at: "2026-04-09T10:00:00Z",
            };

            global.mockApiResponse(mockResponse);

            const result = await apiService.markNotificationRead(7);

            expect(global.fetch).toHaveBeenCalledWith(
                "http://localhost:8000/notifications/7/read",
                expect.objectContaining({
                    method: "PATCH",
                    headers: expect.objectContaining({
                        Authorization: "Bearer mock-access-token",
                    }),
                })
            );

            expect(result).toEqual(mockResponse);
        });

        test("markAllNotificationsRead() should send POST request to mark-all-read endpoint", async () => {
            const mockResponse = {
                message: "All notifications marked as read",
            };

            global.mockApiResponse(mockResponse);

            const result = await apiService.markAllNotificationsRead();

            expect(global.fetch).toHaveBeenCalledWith(
                "http://localhost:8000/notifications/mark-all-read",
                expect.objectContaining({
                    method: "POST",
                    headers: expect.objectContaining({
                        Authorization: "Bearer mock-access-token",
                    }),
                })
            );

            expect(result.message).toBe("All notifications marked as read");
        });

        test("markNotificationRead() should handle 404 when notification does not exist", async () => {
            global.fetch.mockResolvedValueOnce({
                ok: false,
                status: 404,
                json: async () => ({ detail: "Notification not found" }),
            });

            await expect(apiService.markNotificationRead(9999)).rejects.toMatchObject({
                status: 404,
            });
        });

        test("getCreatorCommentInbox() should aggregate and sort comments across owned podcasts", async () => {
            const getMyPodcastsSpy = jest
                .spyOn(apiService, "getMyPodcasts")
                .mockResolvedValue([
                    {
                        id: 10,
                        title: "Alpha",
                        owner_id: 7,
                        thumbnail_url: "/media/alpha.png",
                    },
                    {
                        id: 11,
                        title: "Beta",
                        owner_id: 7,
                        thumbnail_url: "/media/beta.png",
                    },
                ]);
            const getPodcastCommentsSpy = jest
                .spyOn(apiService, "getPodcastComments")
                .mockImplementation(async (podcastId) => {
                    if (podcastId === 10) {
                        return [
                            {
                                id: 201,
                                user_id: 22,
                                content: "Newest comment",
                                timestamp: 32,
                                created_at: "2026-04-09T12:00:00Z",
                                updated_at: "2026-04-09T12:00:00Z",
                                user: { name: "Anna", photo_url: null },
                            },
                        ];
                    }

                    return [
                        {
                            id: 101,
                            user_id: 21,
                            content: "Older comment",
                            timestamp: 5,
                            created_at: "2026-04-09T09:00:00Z",
                            updated_at: "2026-04-09T09:00:00Z",
                            user: { name: "Daniel", photo_url: null },
                        },
                        {
                            id: 102,
                            user_id: 7,
                            content: "Owner comment should be excluded",
                            timestamp: 8,
                            created_at: "2026-04-09T11:00:00Z",
                            updated_at: "2026-04-09T11:00:00Z",
                            user: { name: "Owner", photo_url: null },
                        },
                    ];
                });

            const result = await apiService.getCreatorCommentInbox();

            expect(getMyPodcastsSpy).toHaveBeenCalledWith({ limit: 8 });
            expect(getPodcastCommentsSpy).toHaveBeenCalledTimes(2);
            expect(result.map((item) => item.commentId)).toEqual([201, 101]);
            expect(result[0]).toMatchObject({
                podcastId: 10,
                podcastTitle: "Alpha",
                authorName: "Anna",
                content: "Newest comment",
            });
            expect(result[1]).toMatchObject({
                podcastId: 11,
                podcastTitle: "Beta",
                authorName: "Daniel",
                content: "Older comment",
            });

            getMyPodcastsSpy.mockRestore();
            getPodcastCommentsSpy.mockRestore();
        });

        test("getCreatorCommentInbox() should skip failed comment fetches and keep successful podcasts", async () => {
            const getMyPodcastsSpy = jest
                .spyOn(apiService, "getMyPodcasts")
                .mockResolvedValue([
                    { id: 99, title: "Working", owner_id: 5 },
                    { id: 100, title: "Broken", owner_id: 5 },
                ]);
            const getPodcastCommentsSpy = jest
                .spyOn(apiService, "getPodcastComments")
                .mockImplementation(async (podcastId) => {
                    if (podcastId === 100) {
                        throw new Error("boom");
                    }

                    return [
                        {
                            id: 301,
                            user_id: 8,
                            content: "Still works",
                            timestamp: 1,
                            created_at: "2026-04-09T10:00:00Z",
                            updated_at: "2026-04-09T10:00:00Z",
                            user: { name: "Listener", photo_url: null },
                        },
                    ];
                });

            const result = await apiService.getCreatorCommentInbox();

            expect(result).toHaveLength(1);
            expect(result[0]).toMatchObject({
                podcastId: 99,
                commentId: 301,
                authorName: "Listener",
            });

            getMyPodcastsSpy.mockRestore();
            getPodcastCommentsSpy.mockRestore();
        });
    });
});
