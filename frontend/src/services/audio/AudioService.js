import AudioRecorder from "./AudioRecorder";
import AudioPlayer from "./AudioPlayer";
import AudioPermissions from "./AudioPermissions";
import { Platform } from "react-native";

class AudioService {
    constructor() {
        this.recorder = AudioRecorder;
        this.player = AudioPlayer;
        this.permissions = AudioPermissions;
        this.isInitialized = false;
        this.activeMode = null; // 'recording' | 'playing' | null
    }

    /**
     * Initialize audio service
     * @returns {Promise<boolean>}
     */
    async initialize() {
        try {
            if (this.isInitialized) {
                return true;
            }

            // Check and request permissions
            const hasPermissions =
                (await this.permissions.checkPermissions()) ||
                (await this.permissions.requestPermissions());

            if (!hasPermissions) {
                console.warn("Audio permissions not granted");
                return false;
            }

            this.isInitialized = true;
            console.log("AudioService initialized successfully");
            return true;
        } catch (error) {
            console.error("Failed to initialize AudioService:", error);
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
            // Stop any active playback
            if (this.activeMode === "playing") {
                await this.player.stop();
            }

            this.activeMode = "recording";
            return await this.recorder.startRecording(options);
        } catch (error) {
            console.error("Failed to start recording:", error);
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
            const uri = await this.recorder.stopRecording();
            this.activeMode = null;
            return uri;
        } catch (error) {
            console.error("Failed to stop recording:", error);
            this.activeMode = null;
            throw error;
        }
    }

    /**
     * Pause recording (iOS only)
     * @returns {Promise<boolean>}
     */
    async pauseRecording() {
        try {
            return await this.recorder.pauseRecording();
        } catch (error) {
            console.error("Failed to pause recording:", error);
            throw error;
        }
    }

    /**
     * Resume recording (iOS only)
     * @returns {Promise<boolean>}
     */
    async resumeRecording() {
        try {
            return await this.recorder.resumeRecording();
        } catch (error) {
            console.error("Failed to resume recording:", error);
            throw error;
        }
    }

    /**
     * Save recording to permanent location
     * @param {string} filename - Custom filename (optional)
     * @returns {Promise<string>}
     */
    async saveRecording(filename = null) {
        try {
            return await this.recorder.saveRecording(filename);
        } catch (error) {
            console.error("Failed to save recording:", error);
            throw error;
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
            // Stop any active recording
            if (this.activeMode === "recording") {
                await this.recorder.stopRecording();
            }

            this.activeMode = "playing";
            return await this.player.loadAudio(uri, trackInfo);
        } catch (error) {
            console.error("Failed to load audio:", error);
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
            return await this.player.play();
        } catch (error) {
            console.error("Failed to start playback:", error);
            throw error;
        }
    }

    /**
     * Pause playback
     * @returns {Promise<boolean>}
     */
    async pausePlayback() {
        try {
            return await this.player.pause();
        } catch (error) {
            console.error("Failed to pause playback:", error);
            throw error;
        }
    }

    /**
     * Stop playback
     * @returns {Promise<boolean>}
     */
    async stopPlayback() {
        try {
            const result = await this.player.stop();
            this.activeMode = null;
            return result;
        } catch (error) {
            console.error("Failed to stop playback:", error);
            this.activeMode = null;
            throw error;
        }
    }

    /**
     * Seek to specific position in playback
     * @param {number} positionMs - Position in milliseconds
     * @returns {Promise<boolean>}
     */
    async seekTo(positionMs) {
        try {
            return await this.player.seekTo(positionMs);
        } catch (error) {
            console.error("Failed to seek:", error);
            throw error;
        }
    }

    /**
     * Set playback rate/speed
     * @param {number} rate - Playback rate (0.5 to 2.0)
     * @returns {Promise<boolean>}
     */
    async setPlaybackRate(rate) {
        try {
            return await this.player.setPlaybackRate(rate);
        } catch (error) {
            console.error("Failed to set playback rate:", error);
            throw error;
        }
    }

    /**
     * Skip forward in playback
     * @param {number} seconds - Seconds to skip forward
     * @returns {Promise<boolean>}
     */
    async skipForward(seconds = 15) {
        try {
            return await this.player.skipForward(seconds);
        } catch (error) {
            console.error("Failed to skip forward:", error);
            throw error;
        }
    }

    /**
     * Skip backward in playback
     * @param {number} seconds - Seconds to skip backward
     * @returns {Promise<boolean>}
     */
    async skipBackward(seconds = 15) {
        try {
            return await this.player.skipBackward(seconds);
        } catch (error) {
            console.error("Failed to skip backward:", error);
            throw error;
        }
    }

    /**
     * Get recording status
     * @returns {Object}
     */
    getRecordingStatus() {
        return {
            ...this.recorder.getRecordingStatus(),
            activeMode: this.activeMode,
        };
    }

    /**
     * Get playback status
     * @returns {Object}
     */
    getPlaybackStatus() {
        return {
            ...this.player.getPlaybackStatus(),
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
            permissions: this.permissions.getPermissionStatus(),
            recording: this.recorder.getRecordingStatus(),
            playback: this.player.getPlaybackStatus(),
            platform: Platform.OS,
        };
    }

    /**
     * Set position update callback for playback
     * @param {Function} callback
     */
    setPositionUpdateCallback(callback) {
        this.player.setPositionUpdateCallback(callback);
    }

    /**
     * Set playback status update callback
     * @param {Function} callback
     */
    setPlaybackStatusCallback(callback) {
        this.player.setPlaybackStatusCallback(callback);
    }

    /**
     * Format time for display
     * @param {number} timeMs - Time in milliseconds
     * @returns {string}
     */
    formatTime(timeMs) {
        return this.player.formatTime(timeMs);
    }

    /**
     * Delete audio file
     * @param {string} uri - File URI to delete
     * @returns {Promise<boolean>}
     */
    async deleteAudioFile(uri) {
        try {
            return await this.recorder.deleteRecording(uri);
        } catch (error) {
            console.error("Failed to delete audio file:", error);
            throw error;
        }
    }

    /**
     * Check if recording is supported on current platform
     * @returns {boolean}
     */
    isRecordingSupported() {
        return true; // Both iOS and Android support recording
    }

    /**
     * Check if pause/resume is supported for recording
     * @returns {boolean}
     */
    isRecordingPauseSupported() {
        return Platform.OS === "ios"; // Only iOS supports pause/resume recording
    }

    /**
     * Cleanup all audio resources
     */
    async cleanup() {
        try {
            await this.recorder.cleanup();
            await this.player.cleanup();
            this.activeMode = null;
            this.isInitialized = false;
            console.log("AudioService cleaned up");
        } catch (error) {
            console.error("Failed to cleanup AudioService:", error);
        }
    }

    /**
     * Handle app state changes (background/foreground)
     * @param {string} nextAppState - 'active' | 'background' | 'inactive'
     */
    async handleAppStateChange(nextAppState) {
        try {
            if (nextAppState === "background") {
                // iOS: Continue background audio if enabled
                // Android: May need to pause based on audio focus
                console.log("App moved to background, audio may continue");
            } else if (nextAppState === "active") {
                // App returned to foreground
                console.log("App returned to foreground");
            }
        } catch (error) {
            console.error("Failed to handle app state change:", error);
        }
    }
}

export default new AudioService();
