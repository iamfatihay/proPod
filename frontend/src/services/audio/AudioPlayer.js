import { Audio } from "expo-av";
import { Platform } from "react-native";
import Logger from "../../utils/logger";

class AudioPlayer {
    constructor() {
        this.sound = null;
        this.isPlaying = false;
        this.isPaused = false;
        this.isLoading = false;
        this.currentPosition = 0;
        this.duration = 0;
        this.currentTrack = null;
        this.playbackRate = 1.0;
        this.positionUpdateTimer = null;
        this.onPositionUpdate = null;
        this.onPlaybackStatusUpdate = null;
    }

    /**
     * Initialize audio session for playback
     * @returns {Promise<boolean>}
     */
    async initializePlayback() {
        try {
            await Audio.setAudioModeAsync({
                allowsRecordingIOS: false,
                playsInSilentModeIOS: true,
                staysActiveInBackground: true,
                shouldDuckAndroid: true,
                playThroughEarpieceAndroid: false,
                interruptionModeIOS: Audio.INTERRUPTION_MODE_IOS_DUCK_OTHERS,
                interruptionModeAndroid:
                    Audio.INTERRUPTION_MODE_ANDROID_DUCK_OTHERS,
            });
            return true;
        } catch (error) {
            Logger.error("Failed to initialize playback:", error);
            throw error;
        }
    }

    /**
     * Load and prepare audio file for playback
     * @param {string} uri - Audio file URI
     * @param {Object} trackInfo - Track metadata
     * @returns {Promise<boolean>}
     */
    async loadAudio(uri, trackInfo = {}) {
        try {
            this.isLoading = true;

            // Stop current playback if any
            await this.stop();

            // Initialize playback mode
            await this.initializePlayback();

            // Create new sound object
            const { sound, status } = await Audio.Sound.createAsync(
                { uri },
                {
                    shouldPlay: false,
                    rate: this.playbackRate,
                    isLooping: false,
                },
                this._onPlaybackStatusUpdate.bind(this)
            );

            this.sound = sound;
            this.currentTrack = { uri, ...trackInfo };
            this.duration = status.durationMillis || 0;
            this.currentPosition = 0;
            this.isLoading = false;

            Logger.log("Audio loaded:", trackInfo.title || uri);
            return true;
        } catch (error) {
            this.isLoading = false;
            Logger.error("Failed to load audio:", error);
            throw error;
        }
    }

    /**
     * Start or resume playback
     * @returns {Promise<boolean>}
     */
    async play() {
        try {
            if (!this.sound) {
                Logger.warn("No audio loaded");
                return false;
            }

            if (this.isPlaying) {
                Logger.warn("Already playing");
                return true;
            }

            await this.sound.playAsync();
            this.isPlaying = true;
            this.isPaused = false;

            this._startPositionTimer();
            Logger.log("Playback started");
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
    async pause() {
        try {
            if (!this.sound || !this.isPlaying) {
                Logger.warn("No active playback to pause");
                return false;
            }

            await this.sound.pauseAsync();
            this.isPlaying = false;
            this.isPaused = true;

            this._stopPositionTimer();
            Logger.log("Playback paused");
            return true;
        } catch (error) {
            Logger.error("Failed to pause playback:", error);
            throw error;
        }
    }

    /**
     * Stop playback
     * @returns {Promise<boolean>}
     */
    async stop() {
        try {
            this._stopPositionTimer();

            if (this.sound) {
                await this.sound.stopAsync();
                await this.sound.unloadAsync();
                this.sound = null;
            }

            this.isPlaying = false;
            this.isPaused = false;
            this.currentPosition = 0;
            this.currentTrack = null;

            Logger.log("Playback stopped");
            return true;
        } catch (error) {
            Logger.error("Failed to stop playback:", error);
            throw error;
        }
    }

    /**
     * Seek to specific position
     * @param {number} positionMs - Position in milliseconds
     * @returns {Promise<boolean>}
     */
    async seekTo(positionMs) {
        try {
            if (!this.sound) {
                Logger.warn("No audio loaded");
                return false;
            }

            await this.sound.setPositionAsync(positionMs);
            this.currentPosition = positionMs;

            Logger.log("Seeked to:", positionMs);
            return true;
        } catch (error) {
            Logger.error("Failed to seek:", error);
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
            if (!this.sound) {
                Logger.warn("No audio loaded");
                return false;
            }

            const clampedRate = Math.max(0.5, Math.min(2.0, rate));
            await this.sound.setRateAsync(clampedRate, true);
            this.playbackRate = clampedRate;

            Logger.log("Playback rate set to:", clampedRate);
            return true;
        } catch (error) {
            Logger.error("Failed to set playback rate:", error);
            throw error;
        }
    }

    /**
     * Skip forward by specified seconds
     * @param {number} seconds - Seconds to skip forward
     * @returns {Promise<boolean>}
     */
    async skipForward(seconds = 15) {
        try {
            const newPosition = Math.min(
                this.currentPosition + seconds * 1000,
                this.duration
            );
            return await this.seekTo(newPosition);
        } catch (error) {
            Logger.error("Failed to skip forward:", error);
            throw error;
        }
    }

    /**
     * Skip backward by specified seconds
     * @param {number} seconds - Seconds to skip backward
     * @returns {Promise<boolean>}
     */
    async skipBackward(seconds = 15) {
        try {
            const newPosition = Math.max(
                this.currentPosition - seconds * 1000,
                0
            );
            return await this.seekTo(newPosition);
        } catch (error) {
            Logger.error("Failed to skip backward:", error);
            throw error;
        }
    }

    /**
     * Get current playback status
     * @returns {Object}
     */
    getPlaybackStatus() {
        return {
            isPlaying: this.isPlaying,
            isPaused: this.isPaused,
            isLoading: this.isLoading,
            currentPosition: this.currentPosition,
            duration: this.duration,
            currentTrack: this.currentTrack,
            playbackRate: this.playbackRate,
            progress:
                this.duration > 0 ? this.currentPosition / this.duration : 0,
        };
    }

    /**
     * Set position update callback
     * @param {Function} callback - Called with current position in ms
     */
    setPositionUpdateCallback(callback) {
        this.onPositionUpdate = callback;
    }

    /**
     * Set playback status update callback
     * @param {Function} callback - Called with playback status changes
     */
    setPlaybackStatusCallback(callback) {
        this.onPlaybackStatusUpdate = callback;
    }

    /**
     * Format time in mm:ss format
     * @param {number} timeMs - Time in milliseconds
     * @returns {string}
     */
    formatTime(timeMs) {
        const totalSeconds = Math.floor(timeMs / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes}:${seconds.toString().padStart(2, "0")}`;
    }

    /**
     * Handle playback status updates from expo-av
     * @private
     */
    _onPlaybackStatusUpdate(status) {
        if (status.isLoaded) {
            this.currentPosition = status.positionMillis || 0;
            this.duration = status.durationMillis || 0;
            this.isPlaying = status.isPlaying || false;

            // Check if playback finished
            if (status.didJustFinish) {
                this.isPlaying = false;
                this.isPaused = false;
                this.currentPosition = 0;
                this._stopPositionTimer();
                Logger.log("Playback finished");
            }
        }

        // Call external callback if set
        if (this.onPlaybackStatusUpdate) {
            this.onPlaybackStatusUpdate(this.getPlaybackStatus());
        }
    }

    /**
     * Start position update timer
     * @private
     */
    _startPositionTimer() {
        this._stopPositionTimer();

        this.positionUpdateTimer = setInterval(() => {
            if (this.isPlaying && this.onPositionUpdate) {
                this.onPositionUpdate(this.currentPosition);
            }
        }, 1000);
    }

    /**
     * Stop position update timer
     * @private
     */
    _stopPositionTimer() {
        if (this.positionUpdateTimer) {
            clearInterval(this.positionUpdateTimer);
            this.positionUpdateTimer = null;
        }
    }

    /**
     * Cleanup resources
     */
    async cleanup() {
        try {
            await this.stop();
            this._stopPositionTimer();
            this.onPositionUpdate = null;
            this.onPlaybackStatusUpdate = null;
        } catch (error) {
            Logger.error("Failed to cleanup player:", error);
        }
    }
}

export default new AudioPlayer();
