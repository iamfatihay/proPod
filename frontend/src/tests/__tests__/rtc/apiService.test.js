/**
 * Tests for RTC API service methods
 */
import apiService from "../../../services/api/apiService";

// Mock expo-secure-store
jest.mock('expo-secure-store', () => ({
    getItemAsync: jest.fn().mockResolvedValue('mock-token'),
    setItemAsync: jest.fn().mockResolvedValue(undefined),
    deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

// Mock fetch globally
global.fetch = jest.fn();

describe("RTC API Service", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        apiService.baseURL = "http://localhost:8000";
        apiService.token = "mock-token";
    });

    describe("createRtcRoom", () => {
        it("should create RTC room successfully", async () => {
            const mockResponse = {
                id: "mock-room-id",
                name: "test-room",
                enabled: true,
                template_id: "template-123",
                session_id: 1,
            };

            global.fetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => mockResponse,
            });

            const result = await apiService.createRtcRoom({
                name: "test-room",
                title: "Test Podcast",
                description: "Test Description",
                category: "Tech",
                is_public: true,
                media_mode: "video",
            });

            expect(global.fetch).toHaveBeenCalledWith(
                "http://localhost:8000/rtc/rooms",
                expect.objectContaining({
                    method: "POST",
                    headers: expect.objectContaining({
                        "Content-Type": "application/json",
                        Authorization: "Bearer mock-token",
                    }),
                })
            );

            expect(result).toEqual(mockResponse);
        });

        it("should handle room creation errors", async () => {
            global.fetch.mockResolvedValueOnce({
                ok: false,
                status: 400,
                json: async () => ({ detail: "template_id is required" }),
            });

            await expect(
                apiService.createRtcRoom({
                    name: "test-room",
                    title: "Test Podcast",
                })
            ).rejects.toThrow();
        });
    });

    describe("createRtcToken", () => {
        it("should create auth token successfully", async () => {
            const mockResponse = {
                token: "mock-jwt-token",
                room_id: "room-123",
                role: "host",
                user_id: "user-456",
                expires_in_seconds: 3600,
            };

            global.fetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => mockResponse,
            });

            const result = await apiService.createRtcToken({
                room_id: "room-123",
                role: "host",
            });

            expect(global.fetch).toHaveBeenCalledWith(
                "http://localhost:8000/rtc/token",
                expect.objectContaining({
                    method: "POST",
                })
            );

            expect(result).toEqual(mockResponse);
            expect(result.token).toBe("mock-jwt-token");
        });
    });

    describe("getRtcSession", () => {
        it("should fetch session by ID", async () => {
            const mockSession = {
                id: 1,
                room_id: "room-123",
                room_name: "Test Room",
                owner_id: 1,
                title: "Test Podcast",
                status: "completed",
                recording_url: "https://example.com/recording.mp4",
                podcast_id: 10,
                duration_seconds: 1200,
            };

            global.fetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => mockSession,
            });

            const result = await apiService.getRtcSession(1);

            expect(global.fetch).toHaveBeenCalledWith(
                "http://localhost:8000/rtc/sessions/1",
                expect.objectContaining({
                    headers: expect.objectContaining({
                        Authorization: "Bearer mock-token",
                    }),
                })
            );

            expect(result).toEqual(mockSession);
            expect(result.podcast_id).toBe(10);
        });

        it("should handle session not found", async () => {
            global.fetch.mockResolvedValueOnce({
                ok: false,
                status: 404,
                json: async () => ({ detail: "RTC session not found" }),
            });

            await expect(apiService.getRtcSession(999)).rejects.toThrow();
        });
    });

    describe("listRtcSessions", () => {
        it("should list all sessions", async () => {
            const mockSessions = {
                sessions: [
                    {
                        id: 1,
                        room_id: "room-1",
                        title: "Session 1",
                        status: "completed",
                    },
                    {
                        id: 2,
                        room_id: "room-2",
                        title: "Session 2",
                        status: "created",
                    },
                ],
                total: 2,
                limit: 20,
                offset: 0,
                has_more: false,
            };

            global.fetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => mockSessions,
            });

            const result = await apiService.listRtcSessions();

            expect(global.fetch).toHaveBeenCalledWith(
                "http://localhost:8000/rtc/sessions",
                expect.any(Object)
            );

            expect(result).toEqual(mockSessions);
            expect(result.sessions).toHaveLength(2);
        });

        it("should filter sessions by room_id", async () => {
            global.fetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => [
                    {
                        id: 1,
                        room_id: "specific-room",
                        title: "Filtered Session",
                    },
                ],
            });

            await apiService.listRtcSessions({ room_id: "specific-room" });

            expect(global.fetch).toHaveBeenCalledWith(
                "http://localhost:8000/rtc/sessions?room_id=specific-room",
                expect.any(Object)
            );
        });

        it("should apply limit parameter", async () => {
            global.fetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => [],
            });

            await apiService.listRtcSessions({ limit: 10 });

            expect(global.fetch).toHaveBeenCalledWith(
                "http://localhost:8000/rtc/sessions?limit=10",
                expect.any(Object)
            );
        });

        it("should apply pagination offset parameter", async () => {
            global.fetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => [],
            });

            await apiService.listRtcSessions({ limit: 10, offset: 20 });

            expect(global.fetch).toHaveBeenCalledWith(
                "http://localhost:8000/rtc/sessions?limit=10&offset=20",
                expect.any(Object)
            );
        });
    });

    describe("RTC session state flow", () => {
        it("should handle complete recording flow", async () => {
            // Step 1: Create room
            global.fetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({
                    id: "room-123",
                    session_id: 1,
                }),
            });

            const room = await apiService.createRtcRoom({
                name: "test-room",
                title: "Test",
            });

            expect(room.session_id).toBe(1);

            // Step 2: Create token
            global.fetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({
                    token: "auth-token",
                    room_id: "room-123",
                }),
            });

            const token = await apiService.createRtcToken({
                room_id: room.id,
                role: "host",
            });

            expect(token.token).toBe("auth-token");

            // Step 3: Poll session status
            global.fetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({
                    id: 1,
                    status: "completed",
                    recording_url: "https://example.com/recording.mp4",
                    podcast_id: 42,
                }),
            });

            const session = await apiService.getRtcSession(room.session_id);

            expect(session.status).toBe("completed");
            expect(session.podcast_id).toBe(42);
            expect(session.recording_url).toBeDefined();
        });
    });

    describe("Error handling", () => {
        it("should handle network errors gracefully", async () => {
            global.fetch.mockRejectedValueOnce(new Error("Network error"));

            await expect(
                apiService.createRtcRoom({ name: "test" })
            ).rejects.toThrow("Network error");
        });

        it("should handle 401 unauthorized", async () => {
            global.fetch.mockResolvedValueOnce({
                ok: false,
                status: 401,
                json: async () => ({ detail: "Unauthorized" }),
            });

            await expect(apiService.getRtcSession(1)).rejects.toThrow();
        });

        it("should handle 500 server errors", async () => {
            global.fetch.mockResolvedValueOnce({
                ok: false,
                status: 500,
                json: async () => ({ detail: "Internal server error" }),
            });

            await expect(
                apiService.createRtcRoom({ name: "test" })
            ).rejects.toThrow();
        });
    });
});
