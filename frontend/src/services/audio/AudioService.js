import { Platform } from "react-native";
import Logger from "../../utils/logger";

class AudioService {
    constructor() {
        this.isInitialized = false;
        this.activeMode = null; // 'recording' | 'playing' | null
        this.recordingState = {
            isRecording: false,
            isPaused: false,
            duration: 0,
            startTime: null,
            recordingUri: null,
        };
        this.playbackState = {
            isPlaying: false,
            isPaused: false,
            position: 0,
            duration: 0,
            currentUri: null,
        };
    }

    /**
     * Initialize audio service
     * @returns {Promise<boolean>}
     */
    async initialize() {
        try {
            // Simulate initialization delay
            await new Promise((resolve) => setTimeout(resolve, 100));

            this.isInitialized = true;
            return true;
        } catch (error) {
            Logger.error("Failed to initialize AudioService:", error);
            return false;
        }
    }

    /**
     * Start recording audio
     * @param {Object} options - Recording options
     * @returns {Promise<boolean>}
     */
    async startRecording(options = {}) {
        try {
            if (!this.isInitialized) {
                throw new Error("AudioService not initialized");
            }

            // Stop any active playback
            if (this.activeMode === "playing") {
                await this.stopPlayback();
            }

            this.activeMode = "recording";
            this.recordingState = {
                isRecording: true,
                isPaused: false,
                duration: 0,
                startTime: Date.now(),
                recordingUri: null,
            };
            return true;
        } catch (error) {
            Logger.error("Failed to start recording:", error);
            this.activeMode = null;
            throw error;
        }
    }

    /**
     * Stop recording and return file URI
     * @returns {Promise<string|null>}
     */
    async stopRecording() {
        try {
            if (this.activeMode !== "recording") {
                throw new Error("Not currently recording");
            }

            const recordingDuration =
                Date.now() - this.recordingState.startTime;
            const recordingUri = `file:///recordings/recording_${Date.now()}.m4a`;

            this.recordingState = {
                isRecording: false,
                isPaused: false,
                duration: recordingDuration,
                startTime: null,
                recordingUri: recordingUri,
            };

            this.activeMode = null;
            return recordingUri;
        } catch (error) {
            Logger.error("Failed to stop recording:", error);
            this.activeMode = null;
            throw error;
        }
    }

    /**
     * Pause recording
     * @returns {Promise<boolean>}
     */
    async pauseRecording() {
        try {
            if (
                this.activeMode !== "recording" ||
                !this.recordingState.isRecording
            ) {
                return false;
            }

            this.recordingState.isPaused = true;
            return true;
        } catch (error) {
            Logger.error("Failed to pause recording:", error);
            return false;
        }
    }

    /**
     * Resume recording
     * @returns {Promise<boolean>}
     */
    async resumeRecording() {
        try {
            if (
                this.activeMode !== "recording" ||
                !this.recordingState.isPaused
            ) {
                return false;
            }

            this.recordingState.isPaused = false;
            return true;
        } catch (error) {
            Logger.error("Failed to resume recording:", error);
            return false;
        }
    }

    /**
     * Load audio for playback
     * @param {string} uri - Audio file URI
     * @param {Object} trackInfo - Track metadata
     * @returns {Promise<boolean>}
     */
    async loadAudio(uri, trackInfo = {}) {
        try {
            if (!this.isInitialized) {
                throw new Error("AudioService not initialized");
            }

            // Stop any active recording
            if (this.activeMode === "recording") {
                await this.stopRecording();
            }

            this.activeMode = "playing";
            this.playbackState = {
                isPlaying: false,
                isPaused: false,
                position: 0,
                duration: trackInfo.duration || 60000, // Default 1 minute
                currentUri: uri,
            };
            return true;
        } catch (error) {
            Logger.error("Failed to load audio:", error);
            this.activeMode = null;
            throw error;
        }
    }

    /**
     * Start or resume playback
     * @returns {Promise<boolean>}
     */
    async play() {
        try {
            if (this.activeMode !== "playing") {
                throw new Error("No audio loaded for playback");
            }

            this.playbackState.isPlaying = true;
            this.playbackState.isPaused = false;
            return true;
        } catch (error) {
            Logger.error("Failed to start playback:", error);
            throw error;
        }
    }

    /**
     * Pause playback
     * @returns {Promise<boolean>}
     */
    async pausePlayback() {
        try {
            if (this.activeMode !== "playing") {
                return false;
            }

            this.playbackState.isPlaying = false;
            this.playbackState.isPaused = true;
            return true;
        } catch (error) {
            Logger.error("Failed to pause playback:", error);
            return false;
        }
    }

    /**
     * Stop playback
     * @returns {Promise<boolean>}
     */
    async stopPlayback() {
        try {
            if (this.activeMode !== "playing") {
                return false;
            }

            this.playbackState = {
                isPlaying: false,
                isPaused: false,
                position: 0,
                duration: this.playbackState.duration,
                currentUri: this.playbackState.currentUri,
            };

            this.activeMode = null;
            return true;
        } catch (error) {
            Logger.error("Failed to stop playback:", error);
            this.activeMode = null;
            throw error;
        }
    }

    /**
     * Get recording status
     * @returns {Object}
     */
    getRecordingStatus() {
        return {
            ...this.recordingState,
            activeMode: this.activeMode,
        };
    }

    /**
     * Get playback status
     * @returns {Object}
     */
    getPlaybackStatus() {
        return {
            ...this.playbackState,
            activeMode: this.activeMode,
        };
    }

    /**
     * Get overall service status
     * @returns {Object}
     */
    getStatus() {
        return {
            isInitialized: this.isInitialized,
            activeMode: this.activeMode,
            recording: this.recordingState,
            playback: this.playbackState,
            platform: Platform.OS,
        };
    }

    /**
     * Format time for display
     * @param {number} timeMs - Time in milliseconds
     * @returns {string}
     */
    formatTime(timeMs) {
        const minutes = Math.floor(timeMs / 60000);
        const seconds = Math.floor((timeMs % 60000) / 1000);
        return `${minutes.toString().padStart(2, "0")}:${seconds
            .toString()
            .padStart(2, "0")}`;
    }

    /**
     * Cleanup resources
     */
    cleanup() {
        this.isInitialized = false;
        this.activeMode = null;
        this.recordingState = {
            isRecording: false,
            isPaused: false,
            duration: 0,
            startTime: null,
            recordingUri: null,
        };
        this.playbackState = {
            isPlaying: false,
            isPaused: false,
            position: 0,
            duration: 0,
            currentUri: null,
        };
    }
}

export default AudioService;
