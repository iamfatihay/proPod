import AudioService from "../AudioService";

describe("AudioService", () => {
    let audioService;

    beforeEach(() => {
        audioService = new AudioService();
    });

    afterEach(() => {
        audioService.cleanup();
    });

    describe("Initialization", () => {
        test("should initialize successfully", async () => {
            const result = await audioService.initialize();
            expect(result).toBe(true);
            expect(audioService.isInitialized).toBe(true);
        });

        test("should have correct initial state", () => {
            expect(audioService.isInitialized).toBe(false);
            expect(audioService.activeMode).toBe(null);
            expect(audioService.getRecordingStatus().isRecording).toBe(false);
            expect(audioService.getPlaybackStatus().isPlaying).toBe(false);
        });
    });

    describe("Recording", () => {
        beforeEach(async () => {
            await audioService.initialize();
        });

        test("should start recording successfully", async () => {
            const result = await audioService.startRecording();
            expect(result).toBe(true);
            expect(audioService.activeMode).toBe("recording");
            expect(audioService.getRecordingStatus().isRecording).toBe(true);
        });

        test("should stop recording and return URI", async () => {
            await audioService.startRecording();
            const uri = await audioService.stopRecording();

            expect(uri).toMatch(/^file:\/\/\/recordings\/recording_\d+\.m4a$/);
            expect(audioService.activeMode).toBe(null);
            expect(audioService.getRecordingStatus().isRecording).toBe(false);
        });

        test("should pause and resume recording", async () => {
            await audioService.startRecording();

            const pauseResult = await audioService.pauseRecording();
            expect(pauseResult).toBe(true);
            expect(audioService.getRecordingStatus().isPaused).toBe(true);

            const resumeResult = await audioService.resumeRecording();
            expect(resumeResult).toBe(true);
            expect(audioService.getRecordingStatus().isPaused).toBe(false);
        });

        test("should not start recording without initialization", async () => {
            const newService = new AudioService();
            await expect(newService.startRecording()).rejects.toThrow(
                "AudioService not initialized"
            );
        });
    });

    describe("Playback", () => {
        beforeEach(async () => {
            await audioService.initialize();
        });

        test("should load audio successfully", async () => {
            const result = await audioService.loadAudio("file://test.mp3", {
                duration: 120000,
            });
            expect(result).toBe(true);
            expect(audioService.activeMode).toBe("playing");
            expect(audioService.getPlaybackStatus().currentUri).toBe(
                "file://test.mp3"
            );
        });

        test("should start and stop playback", async () => {
            await audioService.loadAudio("file://test.mp3");

            const playResult = await audioService.play();
            expect(playResult).toBe(true);
            expect(audioService.getPlaybackStatus().isPlaying).toBe(true);

            const stopResult = await audioService.stopPlayback();
            expect(stopResult).toBe(true);
            expect(audioService.activeMode).toBe(null);
        });

        test("should pause and resume playback", async () => {
            await audioService.loadAudio("file://test.mp3");
            await audioService.play();

            const pauseResult = await audioService.pausePlayback();
            expect(pauseResult).toBe(true);
            expect(audioService.getPlaybackStatus().isPaused).toBe(true);

            const playResult = await audioService.play();
            expect(playResult).toBe(true);
            expect(audioService.getPlaybackStatus().isPlaying).toBe(true);
        });
    });

    describe("Status and Utilities", () => {
        beforeEach(async () => {
            await audioService.initialize();
        });

        test("should return correct service status", () => {
            const status = audioService.getStatus();
            expect(status.isInitialized).toBe(true);
            expect(status.activeMode).toBe(null);
            expect(status.platform).toBeDefined();
        });

        test("should format time correctly", () => {
            expect(audioService.formatTime(60000)).toBe("01:00"); // 1 minute
            expect(audioService.formatTime(125000)).toBe("02:05"); // 2 minutes 5 seconds
            expect(audioService.formatTime(0)).toBe("00:00"); // 0 time
        });

        test("should cleanup resources", () => {
            audioService.cleanup();
            expect(audioService.isInitialized).toBe(false);
            expect(audioService.activeMode).toBe(null);
            expect(audioService.getRecordingStatus().isRecording).toBe(false);
            expect(audioService.getPlaybackStatus().isPlaying).toBe(false);
        });
    });

    describe("Mode Management", () => {
        beforeEach(async () => {
            await audioService.initialize();
        });

        test("should switch from recording to playback mode", async () => {
            await audioService.startRecording();
            expect(audioService.activeMode).toBe("recording");

            await audioService.loadAudio("file://test.mp3");
            expect(audioService.activeMode).toBe("playing");
            expect(audioService.getRecordingStatus().isRecording).toBe(false);
        });

        test("should switch from playback to recording mode", async () => {
            await audioService.loadAudio("file://test.mp3");
            expect(audioService.activeMode).toBe("playing");

            await audioService.startRecording();
            expect(audioService.activeMode).toBe("recording");
            expect(audioService.getPlaybackStatus().isPlaying).toBe(false);
        });
    });
});
