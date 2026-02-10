import { AudioModule, setAudioModeAsync } from "expo-audio";
import { Platform } from "react-native";
import * as FileSystem from "expo-file-system";
import { AudioConfig } from "../../constants/audio/AudioConfig";
import AudioPermissions from "./AudioPermissions";
import Logger from "../../utils/logger";

class AudioRecorder {
    constructor() {
        this.recording = null;
        this.isRecording = false;
        this.isPaused = false;
        this.recordingUri = null;
        this.recordingDuration = 0;
        this.recordingTimer = null;
        this.recordingStartTime = null;
        this.recordingStatusHandler = null; // Handler for recordingStatusUpdate events
    }

    /**
     * Initialize audio session for recording
     * @returns {Promise<boolean>}
     */
    async initializeRecording() {
        try {
            // Check permissions first
            const hasPermissions =
                (await AudioPermissions.checkPermissions()) ||
                (await AudioPermissions.requestPermissions());

            if (!hasPermissions) {
                throw new Error("Audio permissions not granted");
            }

            // Set audio mode for recording (platform-specific)
            await setAudioModeAsync({
                playsInSilentModeIOS: true,
                shouldPlayInBackground: true,
                ...(Platform.OS === "ios"
                    ? {
                          allowsRecordingIOS: true,
                      }
                    : {
                          shouldDuckAndroid: true,
                          playThroughEarpieceAndroid: false,
                      }),
            });

            return true;
        } catch (error) {
            Logger.error("Failed to initialize recording:", error);
            throw error;
        }
    }

    /**
     * Start recording audio
     * @param {Object} options - Recording options
     * @returns {Promise<boolean>}
     */
    async startRecording(options = {}) {
        try {
            if (this.isRecording) {
                return false;
            }

            // Initialize if not done already
            await this.initializeRecording();

            // Create recorder instance for expo-audio 0.4.9
            const recordingOptions = {
                android: {
                    extension: ".m4a",
                    outputFormat: AudioConfig.ANDROID_OUTPUT_FORMAT,
                    audioEncoder: AudioConfig.ANDROID_AUDIO_ENCODER,
                    sampleRate: AudioConfig.SAMPLE_RATE,
                    numberOfChannels: AudioConfig.CHANNELS,
                    bitRate: AudioConfig.BIT_RATE,
                },
                ios: {
                    extension: ".m4a",
                    outputFormat: AudioConfig.IOS_OUTPUT_FORMAT,
                    audioQuality: AudioConfig.IOS_AUDIO_QUALITY,
                    sampleRate: AudioConfig.SAMPLE_RATE,
                    numberOfChannels: AudioConfig.CHANNELS,
                    bitRate: AudioConfig.BIT_RATE,
                    linearPCMBitDepth: 16,
                    linearPCMIsBigEndian: false,
                    linearPCMIsFloat: false,
                },
                web: {
                    mimeType: "audio/webm",
                    bitsPerSecond: 128000,
                },
            };

            // Create recorder instance
            // CRITICAL: On Android, filePath is NOT set in constructor!
            // filePath is only set when prepareToRecordAsync() is called via setRecordingOptions()
            this.recording = new AudioModule.AudioRecorder(recordingOptions);

            // CRITICAL: prepareToRecordAsync MUST be called on Android to:
            // 1. Set filePath (required for URI)
            // 2. Prepare MediaRecorder (required for record() to work - checks isPrepared)
            try {
                await this.recording.prepareToRecordAsync(recordingOptions);

                // After prepareToRecordAsync, filePath should be set, so URI should be available
                const uriAfterPrepare = this.recording?.uri || null;
                if (uriAfterPrepare && uriAfterPrepare !== "") {
                    this.recordingUri = uriAfterPrepare;
                } else {
                    Logger.warn(
                        "⚠️ URI still empty after prepareToRecordAsync:",
                        this.recording?.uri
                    );
                }
            } catch (prepareError) {
                Logger.error("❌ prepareToRecordAsync failed:", prepareError);
                // On error, try to continue - maybe it's not required on all platforms
                Logger.warn(
                    "⚠️ Continuing without prepareToRecordAsync (may fail)..."
                );
            }

            // Add status update listener to capture URI when recording stops
            this.recordingStatusHandler = (status) => {
                if (status?.url) {
                    this.recordingUri = status.url;
                }
                if (status?.hasError) {
                    Logger.error("❌ Recording error:", status.error);
                }
            };
            this.recording.addListener(
                "recordingStatusUpdate",
                this.recordingStatusHandler
            );

            // Start recording (expo-audio 0.4.9 uses record() not startAsync())
            // Note: On Android, record() checks isPrepared, which is set by prepareToRecordAsync
            this.recording.record();

            // Try to get URI one more time after record()
            const uriAfterRecord = this.recording?.uri || null;
            if (uriAfterRecord && uriAfterRecord !== "" && !this.recordingUri) {
                this.recordingUri = uriAfterRecord;
            }

            // Update state
            this.isRecording = true;
            this.isPaused = false;
            this.recordingStartTime = Date.now();
            this.recordingDuration = 0;

            // Start duration timer
            this._startTimer();

            return true;
        } catch (error) {
            Logger.error("Failed to start recording:", error);
            // Reset state on error
            this.isRecording = false;
            this.isPaused = false;
            this.recording = null;
            this._stopTimer();
            throw error;
        }
    }

    /**
     * Pause recording
     * @returns {Promise<boolean>}
     */
    async pauseRecording() {
        try {
            if (!this.recording || !this.isRecording || this.isPaused) {
                return false;
            }

            this.recording.pause();
            this.isPaused = true;
            return true;
        } catch (error) {
            Logger.error("Failed to pause recording:", error);
            this.isPaused = false; // Reset state on error
            throw error;
        }
    }

    /**
     * Resume recording
     * @returns {Promise<boolean>}
     */
    async resumeRecording() {
        try {
            if (!this.recording || !this.isRecording || !this.isPaused) {
                return false;
            }

            this.recording.record();
            this.isPaused = false;
            return true;
        } catch (error) {
            Logger.error("Failed to resume recording:", error);
            this.isPaused = true; // Reset state on error
            throw error;
        }
    }

    /**
     * Stop recording and save file
     * @returns {Promise<string|null>} Recording URI
     */
    async stopRecording() {
        try {
            if (!this.recording || !this.isRecording) {
                return null;
            }

            // Clear timer first
            if (this.recordingTimer) {
                clearInterval(this.recordingTimer);
                this.recordingTimer = null;
            }

            // CRITICAL: On Android, stopRecording() returns a Bundle with status including URI
            // The URI is only available AFTER stop() is called and filePath is preserved
            // We need to call stop() and then getStatus() or use the return value
            let uri = null;

            try {
                // First try to get URI from stored value or recording property
                uri = this.recordingUri || this.recording?.uri || null;
                if (uri === "") uri = null;

                // Call stop() - on Android, this returns a Bundle with status
                await this.recording.stop();

                // After stop(), try getStatus() to get URI (Android preserves filePath in getAudioRecorderStatus)
                try {
                    const status = this.recording?.getStatus();
                    if (status?.url) {
                        uri = status.url;
                    }
                } catch (statusError) {
                    Logger.warn(
                        "⚠️ Error calling getStatus() after stop:",
                        statusError
                    );
                }

                // If still no URI, try recording.uri property one more time
                if (!uri) {
                    const uriAfterStop = this.recording?.uri || null;
                    if (uriAfterStop && uriAfterStop !== "") {
                        uri = uriAfterStop;
                    }
                }
            } catch (stopError) {
                Logger.error("❌ Error during stop():", stopError);
                // Continue to cleanup even if stop() failed
            }

            // Validate URI and check file exists
            if (uri) {
                try {
                    const fileInfo = await FileSystem.getInfoAsync(uri);
                    if (fileInfo.exists) {
                        this.recordingUri = uri; // Store for future reference
                    } else {
                        Logger.warn(
                            "⚠️ Recording file does not exist at URI:",
                            uri
                        );
                        uri = null;
                    }
                } catch (fileError) {
                    Logger.warn("⚠️ Could not verify file exists:", fileError);
                    // Keep URI anyway - might be a path format issue
                    this.recordingUri = uri;
                }
            } else {
                Logger.error(
                    "❌ Recording stopped but no URI available - file may not be saved!"
                );
            }

            // Reset recording state
            this.isRecording = false;
            this.isPaused = false;

            return uri;
        } catch (error) {
            Logger.error("Failed to stop recording:", error);
            // Reset state even on error
            this.isRecording = false;
            this.isPaused = false;
            // Clear timer on error
            if (this.recordingTimer) {
                clearInterval(this.recordingTimer);
                this.recordingTimer = null;
            }
            throw error;
        }
    }

    /**
     * Get current recording status
     * @returns {Object} Status object
     */
    getStatus() {
        // Use recording instance properties if available, otherwise fallback to internal state
        const recordingIsActive =
            this.recording?.isRecording ?? this.isRecording;
        // Always use internal recordingDuration (updated by timer) for consistency
        const recordingTime = this.recordingDuration;
        const recordingUri = this.recordingUri || this.recording?.uri || null;

        return {
            isRecording: recordingIsActive,
            isPaused: this.isPaused,
            duration: recordingTime, // Duration in seconds
            uri: recordingUri === "" ? null : recordingUri,
        };
    }

    /**
     * Get recording duration in seconds
     * @returns {number}
     */
    getDuration() {
        return this.recordingDuration;
    }

    /**
     * Clean up recording resources
     * @returns {Promise<void>}
     */
    async cleanup() {
        try {
            // Stop timer first
            this._stopTimer();

            // Remove status listener if exists
            if (this.recording && this.recordingStatusHandler) {
                try {
                    this.recording.removeListener(
                        "recordingStatusUpdate",
                        this.recordingStatusHandler
                    );
                    this.recordingStatusHandler = null;
                } catch (error) {
                    Logger.warn("⚠️ Error removing status listener:", error);
                }
            }

            // Stop recording if active
            if (this.recording && this.isRecording) {
                try {
                    await this.stopRecording();
                } catch (error) {
                    Logger.warn(
                        "⚠️ Error stopping recording during cleanup:",
                        error
                    );
                }
            }

            // Clean up recording instance
            if (this.recording) {
                try {
                    // expo-audio 0.4.9 AudioRecorder doesn't have remove(), just set to null
                    this.recording = null;
                } catch (error) {
                    Logger.warn("⚠️ Error removing recording instance:", error);
                }
            }

            // Reset all state
            this.isRecording = false;
            this.isPaused = false;
            this.recordingUri = null;
            this.recordingDuration = 0;
            this.recordingStartTime = null;
        } catch (error) {
            Logger.error("❌ Failed to cleanup recording:", error);
            // Force reset state even on error
            this.isRecording = false;
            this.isPaused = false;
            this._stopTimer();
        }
    }

    /**
     * Delete recording file
     * @param {string} uri - File URI to delete
     * @returns {Promise<boolean>}
     */
    async deleteRecording(uri) {
        try {
            if (!uri) {
                return false;
            }

            await FileSystem.deleteAsync(uri, { idempotent: true });
            return true;
        } catch (error) {
            Logger.error("Failed to delete recording:", error);
            return false;
        }
    }

    /**
     * Start duration timer
     * @private
     */
    _startTimer() {
        this._stopTimer(); // Clear any existing timer first

        this.recordingTimer = setInterval(() => {
            if (this.recording && this.isRecording && !this.isPaused) {
                // Always calculate duration from start time (most reliable)
                if (this.recordingStartTime) {
                    this.recordingDuration = Math.floor(
                        (Date.now() - this.recordingStartTime) / 1000
                    );
                }
            }
        }, 1000);
    }

    /**
     * Stop duration timer
     * @private
     */
    _stopTimer() {
        if (this.recordingTimer) {
            clearInterval(this.recordingTimer);
            this.recordingTimer = null;
        }
    }
}

export default new AudioRecorder();
