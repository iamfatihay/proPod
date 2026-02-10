import { AudioPlayer as ExpoAudioPlayer, setAudioModeAsync } from "expo-audio";
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
            await setAudioModeAsync({
                allowsRecordingIOS: false,
                playsInSilentModeIOS: true,
                shouldPlayInBackground: true,
                shouldDuckAndroid: true,
                playThroughEarpieceAndroid: false,
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

            // Create new audio player instance with expo-audio (no parameters)
            this.sound = new ExpoAudioPlayer();
            
            // Replace/load the audio source
            await this.sound.replace(uri);

            // Set playback options
            this.sound.rate = this.playbackRate;
            this.sound.loop = false;
            this.sound.volume = 1.0;

            this.currentTrack = { uri, ...trackInfo };
            // Duration will be available after loading
            this.duration = 0;
            this.currentPosition = 0;
            this.isLoading = false;

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
                return false;
            }

            if (this.isPlaying) {
                return true;
            }

            await this.sound.play();
            this.isPlaying = true;
            this.isPaused = false;

            this._startPositionTimer();
            return true;
        } catch (error) {
            Logger.error("Playback failed:", error);
            this.isPlaying = false;
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
                return false;
            }

            await this.sound.pause();
            this.isPlaying = false;
            this.isPaused = true;

            this._stopPositionTimer();
            return true;
        } catch (error) {
            Logger.error("Failed to pause:", error);
            throw error;
        }
    }

    /**
     * Stop playback
     * @returns {Promise<boolean>}
     */
    async stop() {
        try {
            if (this.sound) {
                await this.sound.stop();
                await this.sound.unload();
                this.sound = null;
            }

            this.isPlaying = false;
            this.isPaused = false;
            this.currentPosition = 0;

            this._stopPositionTimer();
            return true;
        } catch (error) {
            Logger.error("Failed to stop:", error);
            // Reset state even on error
            this.sound = null;
            this.isPlaying = false;
            this.isPaused = false;
            this.currentPosition = 0;
            this._stopPositionTimer();
            return false;
        }
    }

    /**
     * Seek to position in audio
     * @param {number} position - Position in milliseconds
     * @returns {Promise<boolean>}
     */
    async seekTo(position) {
        try {
            if (!this.sound) {
                return false;
            }

            // expo-audio uses currentTime in seconds
            this.sound.currentTime = position / 1000;
            this.currentPosition = position;

            return true;
        } catch (error) {
            Logger.error("Failed to seek:", error);
            throw error;
        }
    }

    /**
     * Set playback rate (speed)
     * @param {number} rate - Playback rate (0.5 to 2.0)
     * @returns {Promise<boolean>}
     */
    async setRate(rate) {
        try {
            if (!this.sound) {
                return false;
            }

            this.sound.rate = rate;
            this.playbackRate = rate;

            return true;
        } catch (error) {
            Logger.error("Failed to set rate:", error);
            throw error;
        }
    }

    /**
     * Set volume
     * @param {number} volume - Volume (0.0 to 1.0)
     * @returns {Promise<boolean>}
     */
    async setVolume(volume) {
        try {
            if (!this.sound) {
                return false;
            }

            this.sound.volume = volume;
            return true;
        } catch (error) {
            Logger.error("Failed to set volume:", error);
            throw error;
        }
    }

    /**
     * Get current playback status
     * @returns {Object}
     */
    getStatus() {
        return {
            isPlaying: this.isPlaying,
            isPaused: this.isPaused,
            isLoading: this.isLoading,
            position: this.currentPosition,
            duration: this.duration,
            rate: this.playbackRate,
            track: this.currentTrack,
        };
    }

    /**
     * Register callback for position updates
     * @param {Function} callback
     */
    setPositionUpdateCallback(callback) {
        this.onPositionUpdate = callback;
    }

    /**
     * Register callback for playback status updates
     * @param {Function} callback
     */
    setStatusUpdateCallback(callback) {
        this.onPlaybackStatusUpdate = callback;
    }

    /**
     * Clean up resources
     * @returns {Promise<void>}
     */
    async cleanup() {
        try {
            await this.stop();
            this.onPositionUpdate = null;
            this.onPlaybackStatusUpdate = null;
        } catch (error) {
            Logger.error("Failed to cleanup audio player:", error);
        }
    }

    /**
     * Start position update timer
     * @private
     */
    _startPositionTimer() {
        this._stopPositionTimer();
        this.positionUpdateTimer = setInterval(async () => {
            if (this.sound && this.isPlaying) {
                try {
                    // Get current time from sound instance
                    const currentTime = this.sound.currentTime || 0;
                    this.currentPosition = currentTime * 1000; // Convert to ms

                    // Notify callback if registered
                    if (this.onPositionUpdate) {
                        this.onPositionUpdate(this.currentPosition);
                    }

                    // Check if playback finished
                    if (this.duration > 0 && this.currentPosition >= this.duration) {
                        await this.stop();
                        if (this.onPlaybackStatusUpdate) {
                            this.onPlaybackStatusUpdate({
                                didJustFinish: true,
                            });
                        }
                    }
                } catch (error) {
                    Logger.error("Position update error:", error);
                }
            }
        }, 100); // Update every 100ms
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
}

export default new AudioPlayer();
