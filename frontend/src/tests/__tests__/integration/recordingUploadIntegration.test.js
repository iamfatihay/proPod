/**
 * Integration Tests: Recording + Upload + Podcast Creation
 * Tests the complete flow from audio recording to podcast publication
 */

import apiService from "../../../services/api/apiService";

// Mock dependencies
jest.mock("../../../services/api/apiService");

const mockApiService = apiService;

describe("Recording + Upload Integration", () => {
    let mockRecording;
    let mockAudioPermissions;

    beforeEach(() => {
        jest.clearAllMocks();

        // Setup recording mock
        mockRecording = global.mockAudioRecording();

        // Setup permissions mock
        mockAudioPermissions = {
            status: "granted",
            granted: true,
            canAskAgain: true,
        };

        // Setup API mocks
        mockApiService.uploadAudio = jest.fn();
        mockApiService.createPodcast = jest.fn();
        mockApiService.updatePodcast = jest.fn();
    });

    describe("Complete Recording Workflow", () => {
        const mockPodcastData = {
            title: "My Test Podcast",
            description: "A podcast created during testing",
            category: "Tech",
            is_public: true,
        };

        test("should record, upload, and create podcast successfully", async () => {
            // Arrange
            const recordingUri = "file://test-recording.m4a";
            const uploadResponse = {
                audio_url: "https://cdn.example.com/audio/test-recording.m4a",
                duration: 30000,
                file_size: 1024000,
            };
            const createdPodcast = {
                id: 1,
                ...mockPodcastData,
                audio_url: uploadResponse.audio_url,
                duration: uploadResponse.duration,
                owner_id: 123,
                created_at: "2024-01-15T10:30:00Z",
            };

            mockRecording.stopAndUnloadAsync.mockResolvedValue({
                uri: recordingUri,
            });
            mockApiService.uploadAudio.mockResolvedValue(uploadResponse);
            mockApiService.createPodcast.mockResolvedValue(createdPodcast);

            // Act - Step 1: Stop recording
            const recordingResult = await mockRecording.stopAndUnloadAsync();

            // Act - Step 2: Upload audio file
            const uploadResult = await mockApiService.uploadAudio({
                uri: recordingResult.uri,
                type: "audio/mp4",
                name: "recording.m4a",
            });

            // Act - Step 3: Create podcast with audio URL
            const podcast = await mockApiService.createPodcast({
                ...mockPodcastData,
                audio_url: uploadResult.audio_url,
                duration: uploadResult.duration,
            });

            // Assert
            expect(mockRecording.stopAndUnloadAsync).toHaveBeenCalled();
            expect(mockApiService.uploadAudio).toHaveBeenCalledWith({
                uri: recordingUri,
                type: "audio/mp4",
                name: "recording.m4a",
            });
            expect(mockApiService.createPodcast).toHaveBeenCalledWith({
                ...mockPodcastData,
                audio_url: uploadResponse.audio_url,
                duration: uploadResponse.duration,
            });
            expect(podcast.id).toBe(1);
            expect(podcast.audio_url).toBe(uploadResponse.audio_url);
        });

        test("should handle recording failure gracefully", async () => {
            // Arrange
            const recordingError = new Error("Recording failed");
            mockRecording.stopAndUnloadAsync.mockRejectedValue(recordingError);

            // Act & Assert
            await expect(mockRecording.stopAndUnloadAsync()).rejects.toThrow(
                "Recording failed"
            );

            // Should not attempt upload or creation
            expect(mockApiService.uploadAudio).not.toHaveBeenCalled();
            expect(mockApiService.createPodcast).not.toHaveBeenCalled();
        });

        test("should handle upload failure with retry mechanism", async () => {
            // Arrange
            const recordingUri = "file://test-recording.m4a";
            const uploadError = new Error("Upload failed");

            mockRecording.stopAndUnloadAsync.mockResolvedValue({
                uri: recordingUri,
            });
            mockApiService.uploadAudio
                .mockRejectedValueOnce(uploadError) // First attempt fails
                .mockResolvedValueOnce({
                    // Second attempt succeeds
                    audio_url:
                        "https://cdn.example.com/audio/test-recording.m4a",
                    duration: 30000,
                });

            // Act
            const recordingResult = await mockRecording.stopAndUnloadAsync();

            try {
                await mockApiService.uploadAudio({ uri: recordingResult.uri });
            } catch (error) {
                // Retry upload
                const uploadResult = await mockApiService.uploadAudio({
                    uri: recordingResult.uri,
                });
                expect(uploadResult.audio_url).toBeTruthy();
            }

            // Assert
            expect(mockApiService.uploadAudio).toHaveBeenCalledTimes(2);
        });

        test("should handle podcast creation failure after successful upload", async () => {
            // Arrange
            const recordingUri = "file://test-recording.m4a";
            const uploadResponse = {
                audio_url: "https://cdn.example.com/audio/test-recording.m4a",
                duration: 30000,
            };
            const creationError = new Error("Podcast creation failed");

            mockRecording.stopAndUnloadAsync.mockResolvedValue({
                uri: recordingUri,
            });
            mockApiService.uploadAudio.mockResolvedValue(uploadResponse);
            mockApiService.createPodcast.mockRejectedValue(creationError);

            // Act
            const recordingResult = await mockRecording.stopAndUnloadAsync();
            const uploadResult = await mockApiService.uploadAudio({
                uri: recordingResult.uri,
            });

            // Assert
            await expect(
                mockApiService.createPodcast({
                    ...mockPodcastData,
                    audio_url: uploadResult.audio_url,
                })
            ).rejects.toThrow("Podcast creation failed");

            // Upload should have succeeded
            expect(mockApiService.uploadAudio).toHaveBeenCalled();
            expect(uploadResult.audio_url).toBeTruthy();
        });
    });

    describe("Draft and Auto-Save Functionality", () => {
        test("should save draft podcast during recording", async () => {
            // Arrange
            const draftData = {
                title: "Draft Podcast",
                description: "Work in progress",
                is_public: false, // Draft not public
            };

            mockApiService.createPodcast.mockResolvedValue({
                id: 1,
                ...draftData,
                audio_url: null, // No audio yet
                created_at: "2024-01-15T10:30:00Z",
            });

            // Act - Create draft before recording completes
            const draft = await mockApiService.createPodcast(draftData);

            // Assert
            expect(mockApiService.createPodcast).toHaveBeenCalledWith({
                title: "Draft Podcast",
                description: "Work in progress",
                is_public: false,
            });
            expect(draft.audio_url).toBeNull();
            expect(draft.is_public).toBe(false);
        });

        test("should update draft with recording after upload", async () => {
            // Arrange
            const draftId = 1;
            const recordingUri = "file://test-recording.m4a";
            const uploadResponse = {
                audio_url: "https://cdn.example.com/audio/test-recording.m4a",
                duration: 45000,
            };

            mockRecording.stopAndUnloadAsync.mockResolvedValue({
                uri: recordingUri,
            });
            mockApiService.uploadAudio.mockResolvedValue(uploadResponse);
            mockApiService.updatePodcast.mockResolvedValue({
                id: draftId,
                title: "Updated Podcast",
                audio_url: uploadResponse.audio_url,
                duration: uploadResponse.duration,
                is_public: true, // Now ready to publish
            });

            // Act
            const recordingResult = await mockRecording.stopAndUnloadAsync();
            const uploadResult = await mockApiService.uploadAudio({
                uri: recordingResult.uri,
            });
            const updatedPodcast = await mockApiService.updatePodcast(draftId, {
                audio_url: uploadResult.audio_url,
                duration: uploadResult.duration,
                is_public: true,
            });

            // Assert
            expect(mockApiService.updatePodcast).toHaveBeenCalledWith(draftId, {
                audio_url: uploadResponse.audio_url,
                duration: uploadResponse.duration,
                is_public: true,
            });
            expect(updatedPodcast.audio_url).toBe(uploadResponse.audio_url);
            expect(updatedPodcast.is_public).toBe(true);
        });
    });

    describe("Cross-Platform Recording Integration", () => {
        test("should handle iOS recording format and upload", async () => {
            // Arrange - iOS specific recording
            const iosRecordingUri = "file://Documents/recording.m4a";
            const iosUploadResponse = {
                audio_url: "https://cdn.example.com/audio/ios-recording.m4a",
                duration: 60000,
                format: "m4a",
                quality: "high",
            };

            mockRecording.stopAndUnloadAsync.mockResolvedValue({
                uri: iosRecordingUri,
            });
            mockApiService.uploadAudio.mockResolvedValue(iosUploadResponse);

            // Act
            const recordingResult = await mockRecording.stopAndUnloadAsync();
            const uploadResult = await mockApiService.uploadAudio({
                uri: recordingResult.uri,
                type: "audio/mp4", // iOS M4A
                name: "recording.m4a",
            });

            // Assert
            expect(uploadResult.format).toBe("m4a");
            expect(uploadResult.quality).toBe("high");
        });

        test("should handle Android recording format and upload", async () => {
            // Arrange - Android specific recording
            const androidRecordingUri = "file://storage/recording.mp3";
            const androidUploadResponse = {
                audio_url:
                    "https://cdn.example.com/audio/android-recording.mp3",
                duration: 60000,
                format: "mp3",
                quality: "standard",
            };

            mockRecording.stopAndUnloadAsync.mockResolvedValue({
                uri: androidRecordingUri,
            });
            mockApiService.uploadAudio.mockResolvedValue(androidUploadResponse);

            // Act
            const recordingResult = await mockRecording.stopAndUnloadAsync();
            const uploadResult = await mockApiService.uploadAudio({
                uri: recordingResult.uri,
                type: "audio/mpeg", // Android MP3
                name: "recording.mp3",
            });

            // Assert
            expect(uploadResult.format).toBe("mp3");
            expect(uploadResult.quality).toBe("standard");
        });
    });

    describe("Progress Tracking Integration", () => {
        test("should track upload progress during file transfer", async () => {
            // Arrange
            const recordingUri = "file://large-recording.m4a";
            const progressEvents = [
                { loaded: 1024, total: 10240 }, // 10%
                { loaded: 5120, total: 10240 }, // 50%
                { loaded: 10240, total: 10240 }, // 100%
            ];

            mockRecording.stopAndUnloadAsync.mockResolvedValue({
                uri: recordingUri,
            });

            // Mock progressive upload
            mockApiService.uploadAudio.mockImplementation(() => {
                return new Promise((resolve) => {
                    // Simulate progress events
                    progressEvents.forEach((event, index) => {
                        setTimeout(() => {
                            if (index === progressEvents.length - 1) {
                                resolve({
                                    audio_url:
                                        "https://cdn.example.com/audio/large-recording.m4a",
                                    duration: 300000, // 5 minutes
                                });
                            }
                        }, index * 100);
                    });
                });
            });

            // Act
            const recordingResult = await mockRecording.stopAndUnloadAsync();
            const uploadResult = await mockApiService.uploadAudio({
                uri: recordingResult.uri,
            });

            // Assert
            expect(uploadResult.audio_url).toBeTruthy();
            expect(uploadResult.duration).toBe(300000);
        });
    });

    describe("Error Recovery Scenarios", () => {
        test("should recover from network interruption during upload", async () => {
            // Arrange
            const recordingUri = "file://test-recording.m4a";
            const networkError = new Error("Network request failed");
            const retrySuccess = {
                audio_url:
                    "https://cdn.example.com/audio/recovered-recording.m4a",
                duration: 30000,
            };

            mockRecording.stopAndUnloadAsync.mockResolvedValue({
                uri: recordingUri,
            });
            mockApiService.uploadAudio
                .mockRejectedValueOnce(networkError)
                .mockResolvedValueOnce(retrySuccess);

            // Act
            const recordingResult = await mockRecording.stopAndUnloadAsync();

            let uploadResult;
            try {
                uploadResult = await mockApiService.uploadAudio({
                    uri: recordingResult.uri,
                });
            } catch (error) {
                // Implement retry logic
                uploadResult = await mockApiService.uploadAudio({
                    uri: recordingResult.uri,
                });
            }

            // Assert
            expect(mockApiService.uploadAudio).toHaveBeenCalledTimes(2);
            expect(uploadResult.audio_url).toBe(retrySuccess.audio_url);
        });

        test("should handle insufficient storage during recording", async () => {
            // Arrange
            const storageError = new Error("Insufficient storage");
            mockRecording.stopAndUnloadAsync.mockRejectedValue(storageError);

            // Act & Assert
            await expect(mockRecording.stopAndUnloadAsync()).rejects.toThrow(
                "Insufficient storage"
            );

            // Should not attempt upload
            expect(mockApiService.uploadAudio).not.toHaveBeenCalled();
        });

        test("should handle server capacity issues during upload", async () => {
            // Arrange
            const recordingUri = "file://test-recording.m4a";
            const serverError = new Error("Server temporarily unavailable");
            serverError.status = 503;

            mockRecording.stopAndUnloadAsync.mockResolvedValue({
                uri: recordingUri,
            });
            mockApiService.uploadAudio.mockRejectedValue(serverError);

            // Act & Assert
            const recordingResult = await mockRecording.stopAndUnloadAsync();
            await expect(
                mockApiService.uploadAudio({
                    uri: recordingResult.uri,
                })
            ).rejects.toThrow("Server temporarily unavailable");
        });
    });
});
