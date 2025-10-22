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
                email: "test@gmail.com",
                name: "Test User",
                photo_url: "https://example.com/photo.jpg",
            };

            const result = await apiService.googleLogin(googleData);

            expect(global.fetch).toHaveBeenCalledWith(
                "http://localhost:8000/users/google-login",
                expect.objectContaining({
                    method: "POST",
                    body: JSON.stringify({
                        email: "test@gmail.com",
                        name: "Test User",
                        provider: "google",
                        photo_url: "https://example.com/photo.jpg",
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
                "http://localhost:8000/podcasts?skip=0&limit=10&category=Tech&search=AI",
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
});
