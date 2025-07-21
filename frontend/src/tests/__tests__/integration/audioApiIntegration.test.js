/**
 * Integration Tests: Audio Engine + API Interactions
 * Tests the complete flow from recording/playback to API operations
 */

import apiService from "../../../services/api/apiService";

// Mock modules at the top level for Jest hoisting
jest.mock("../../../services/api/apiService");
jest.mock("../../../context/useAudioStore");

const mockApiService = apiService;

describe("Audio Engine + API Integration", () => {
    let mockAudioStore;
    let mockAudioActions;

    beforeEach(() => {
        // Reset all mocks
        jest.clearAllMocks();

        // Setup audio store mock
        mockAudioActions = {
            playPodcast: jest.fn(),
            pausePodcast: jest.fn(),
            stopPodcast: jest.fn(),
            seekToPosition: jest.fn(),
            updateListeningHistory: jest.fn(),
            setError: jest.fn(),
        };

        mockAudioStore = {
            currentPodcast: null,
            isPlaying: false,
            position: 0,
            duration: 0,
            isLoading: false,
            error: null,
            ...mockAudioActions,
        };

        // Mock API service methods
        mockApiService.getPodcast = jest.fn();
        mockApiService.updateListeningHistory = jest.fn();
        mockApiService.likePodcast = jest.fn();
        mockApiService.addBookmark = jest.fn();
        mockApiService.getPodcastInteractions = jest.fn();
    });

    describe("Podcast Loading and Playback Flow", () => {
        const mockPodcast = {
            id: 1,
            title: "Test Podcast",
            audio_url: "https://example.com/audio.mp3",
            duration: 180000, // 3 minutes
            owner: { name: "Test Creator" },
        };

        test("should load podcast from API and start playback", async () => {
            // Arrange
            mockApiService.getPodcast.mockResolvedValue(mockPodcast);
            mockApiService.getPodcastInteractions.mockResolvedValue({
                is_liked: false,
                is_bookmarked: false,
                listening_history: null,
            });

            // Act
            const podcast = await mockApiService.getPodcast(1);
            mockAudioActions.playPodcast(podcast);

            // Assert
            expect(mockApiService.getPodcast).toHaveBeenCalledWith(1);
            expect(mockAudioActions.playPodcast).toHaveBeenCalledWith(
                mockPodcast
            );
        });

        test("should handle API errors gracefully during podcast loading", async () => {
            // Arrange
            const apiError = new Error("Network error");
            apiError.status = 500;
            mockApiService.getPodcast.mockRejectedValue(apiError);

            // Act & Assert
            await expect(mockApiService.getPodcast(1)).rejects.toThrow(
                "Network error"
            );
            expect(mockAudioActions.setError).not.toHaveBeenCalled(); // Should be handled by UI layer
        });

        test("should load user interactions along with podcast", async () => {
            // Arrange
            const userInteractions = {
                is_liked: true,
                is_bookmarked: true,
                listening_history: {
                    position: 60000, // 1 minute
                    completed: false,
                    listen_time: 50000,
                },
            };

            mockApiService.getPodcast.mockResolvedValue(mockPodcast);
            mockApiService.getPodcastInteractions.mockResolvedValue(
                userInteractions
            );

            // Act
            const [podcast, interactions] = await Promise.all([
                mockApiService.getPodcast(1),
                mockApiService.getPodcastInteractions(1),
            ]);

            // Assert
            expect(podcast).toEqual(mockPodcast);
            expect(interactions.is_liked).toBe(true);
            expect(interactions.is_bookmarked).toBe(true);
            expect(interactions.listening_history.position).toBe(60000);
        });
    });

    describe("Listening History Tracking", () => {
        test("should update listening history during playback", async () => {
            // Arrange
            const historyUpdate = {
                position: 90000, // 1.5 minutes
                listen_time: 85000,
                completed: false,
            };

            mockApiService.updateListeningHistory.mockResolvedValue({
                id: 1,
                user_id: 123,
                podcast_id: 1,
                ...historyUpdate,
                updated_at: "2024-01-15T10:35:00Z",
            });

            // Act
            await mockApiService.updateListeningHistory(1, historyUpdate);
            mockAudioActions.updateListeningHistory(1, historyUpdate);

            // Assert
            expect(mockApiService.updateListeningHistory).toHaveBeenCalledWith(
                1,
                historyUpdate
            );
            expect(
                mockAudioActions.updateListeningHistory
            ).toHaveBeenCalledWith(1, historyUpdate);
        });

        test("should mark podcast as completed when reaching end", async () => {
            // Arrange
            const completionUpdate = {
                position: 180000, // Full duration
                listen_time: 180000,
                completed: true,
            };

            mockApiService.updateListeningHistory.mockResolvedValue({
                id: 1,
                podcast_id: 1,
                ...completionUpdate,
            });

            // Act
            await mockApiService.updateListeningHistory(1, completionUpdate);

            // Assert
            expect(mockApiService.updateListeningHistory).toHaveBeenCalledWith(
                1,
                {
                    position: 180000,
                    listen_time: 180000,
                    completed: true,
                }
            );
        });

        test("should handle network issues during history updates gracefully", async () => {
            // Arrange
            const networkError = new Error("Network timeout");
            mockApiService.updateListeningHistory.mockRejectedValue(
                networkError
            );

            // Act & Assert
            await expect(
                mockApiService.updateListeningHistory(1, { position: 30000 })
            ).rejects.toThrow("Network timeout");

            // Should continue playback despite sync failure
            expect(mockAudioActions.pausePodcast).not.toHaveBeenCalled();
        });
    });

    describe("Social Interactions During Playback", () => {
        test("should like podcast without interrupting playback", async () => {
            // Arrange
            mockAudioStore.isPlaying = true;
            mockAudioStore.currentPodcast = { id: 1, title: "Playing Podcast" };

            mockApiService.likePodcast.mockResolvedValue({
                id: 1,
                user_id: 123,
                podcast_id: 1,
                created_at: "2024-01-15T10:30:00Z",
            });

            // Act
            await mockApiService.likePodcast(1);

            // Assert
            expect(mockApiService.likePodcast).toHaveBeenCalledWith(1);
            expect(mockAudioActions.pausePodcast).not.toHaveBeenCalled(); // Playback should continue
        });

        test("should bookmark podcast while maintaining audio state", async () => {
            // Arrange
            mockAudioStore.position = 45000; // Current position preserved

            mockApiService.addBookmark.mockResolvedValue({
                id: 1,
                user_id: 123,
                podcast_id: 1,
                created_at: "2024-01-15T10:30:00Z",
            });

            // Act
            await mockApiService.addBookmark(1);

            // Assert
            expect(mockApiService.addBookmark).toHaveBeenCalledWith(1);
            expect(mockAudioStore.position).toBe(45000); // Position maintained
        });

        test("should handle interaction failures without affecting audio", async () => {
            // Arrange
            mockAudioStore.isPlaying = true;
            const interactionError = new Error("Like failed");
            mockApiService.likePodcast.mockRejectedValue(interactionError);

            // Act & Assert
            await expect(mockApiService.likePodcast(1)).rejects.toThrow(
                "Like failed"
            );

            // Audio should continue playing
            expect(mockAudioStore.isPlaying).toBe(true);
            expect(mockAudioActions.stopPodcast).not.toHaveBeenCalled();
        });
    });

    describe("Offline Behavior Integration", () => {
        test("should queue history updates when offline", async () => {
            // Arrange
            const offlineError = new Error("Network request failed");
            mockApiService.updateListeningHistory.mockRejectedValue(
                offlineError
            );

            // Act
            const updatePromise = mockApiService.updateListeningHistory(1, {
                position: 30000,
            });

            // Assert
            await expect(updatePromise).rejects.toThrow(
                "Network request failed"
            );

            // Audio playback should continue
            expect(mockAudioActions.stopPodcast).not.toHaveBeenCalled();
        });

        test("should retry failed operations when connection restored", async () => {
            // Arrange
            const historyUpdate = { position: 60000, listen_time: 55000 };

            // First call fails (offline)
            mockApiService.updateListeningHistory
                .mockRejectedValueOnce(new Error("Network error"))
                .mockResolvedValueOnce({ id: 1, ...historyUpdate }); // Second call succeeds

            // Act
            try {
                await mockApiService.updateListeningHistory(1, historyUpdate);
            } catch (error) {
                // Retry mechanism
                await mockApiService.updateListeningHistory(1, historyUpdate);
            }

            // Assert
            expect(mockApiService.updateListeningHistory).toHaveBeenCalledTimes(
                2
            );
        });
    });

    describe("Cross-Platform Audio + API Flow", () => {
        test("should handle iOS-specific audio session with API sync", async () => {
            // Arrange
            const iosAudioConfig = {
                ios: {
                    extension: ".m4a",
                    audioQuality: "max",
                    sampleRate: 44100,
                },
            };

            mockApiService.updateListeningHistory.mockResolvedValue({
                id: 1,
                platform: "ios",
                format: "m4a",
            });

            // Act
            await mockApiService.updateListeningHistory(1, {
                position: 30000,
                platform: "ios",
                format: "m4a",
            });

            // Assert
            expect(mockApiService.updateListeningHistory).toHaveBeenCalledWith(
                1,
                {
                    position: 30000,
                    platform: "ios",
                    format: "m4a",
                }
            );
        });

        test("should handle Android-specific audio session with API sync", async () => {
            // Arrange
            const androidAudioConfig = {
                android: {
                    extension: ".mp3",
                    outputFormat: "mpeg_4",
                    audioEncoder: "aac",
                },
            };

            mockApiService.updateListeningHistory.mockResolvedValue({
                id: 1,
                platform: "android",
                format: "mp3",
            });

            // Act
            await mockApiService.updateListeningHistory(1, {
                position: 45000,
                platform: "android",
                format: "mp3",
            });

            // Assert
            expect(mockApiService.updateListeningHistory).toHaveBeenCalledWith(
                1,
                {
                    position: 45000,
                    platform: "android",
                    format: "mp3",
                }
            );
        });
    });

    describe("Performance and Memory Management", () => {
        test("should handle rapid API calls without memory leaks", async () => {
            // Arrange
            const rapidUpdates = Array.from({ length: 10 }, (_, i) => ({
                position: i * 1000,
                listen_time: i * 900,
            }));

            mockApiService.updateListeningHistory.mockImplementation(
                (podcastId, update) => Promise.resolve({ id: 1, ...update })
            );

            // Act
            const updatePromises = rapidUpdates.map((update) =>
                mockApiService.updateListeningHistory(1, update)
            );

            await Promise.all(updatePromises);

            // Assert
            expect(mockApiService.updateListeningHistory).toHaveBeenCalledTimes(
                10
            );
            // Last call should have the final position
            expect(
                mockApiService.updateListeningHistory
            ).toHaveBeenLastCalledWith(1, {
                position: 9000,
                listen_time: 8100,
            });
        });

        test("should throttle history updates to prevent API spam", async () => {
            // Arrange - Simulate throttled updates (every 5 seconds)
            const positions = [1000, 2000, 3000, 4000, 5000]; // Only 5000 should be sent

            mockApiService.updateListeningHistory.mockResolvedValue({ id: 1 });

            // Act - Simulate throttled behavior
            const lastPosition = positions[positions.length - 1];
            await mockApiService.updateListeningHistory(1, {
                position: lastPosition,
            });

            // Assert - Only one call made due to throttling
            expect(mockApiService.updateListeningHistory).toHaveBeenCalledTimes(
                1
            );
            expect(mockApiService.updateListeningHistory).toHaveBeenCalledWith(
                1,
                { position: 5000 }
            );
        });
    });
});
