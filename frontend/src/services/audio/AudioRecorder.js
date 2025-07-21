import { Audio } from "expo-av";
import { Platform } from "react-native";
import * as FileSystem from "expo-file-system";
import { AudioConfig } from "../../constants/audio/AudioConfig";
import AudioPermissions from "./AudioPermissions";

class AudioRecorder {
    constructor() {
        this.recording = null;
        this.isRecording = false;
        this.isPaused = false;
        this.recordingUri = null;
        this.recordingDuration = 0;
        this.recordingTimer = null;
        this.recordingStartTime = null;
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

            // Set audio mode for recording
            await Audio.setAudioModeAsync({
                allowsRecordingIOS: true,
                playsInSilentModeIOS: true,
                staysActiveInBackground: true,
                shouldDuckAndroid: true,
                playThroughEarpieceAndroid: false,
                interruptionModeIOS: Audio.INTERRUPTION_MODE_IOS_DO_NOT_MIX,
                interruptionModeAndroid:
                    Audio.INTERRUPTION_MODE_ANDROID_DO_NOT_MIX,
            });

            return true;
        } catch (error) {
            console.error("Failed to initialize recording:", error);
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
                console.warn("Already recording");
                return false;
            }

            // Initialize if not done already
            await this.initializeRecording();

            // Prepare recording options based on platform
            const recordingOptions = this._getRecordingOptions(options);

            // Create new recording
            this.recording = new Audio.Recording();
            await this.recording.prepareToRecordAsync(recordingOptions);

            // Start recording
            await this.recording.startAsync();

            this.isRecording = true;
            this.isPaused = false;
            this.recordingStartTime = Date.now();

            // Start duration timer
            this._startTimer();

            console.log("Recording started");
            return true;
        } catch (error) {
            console.error("Failed to start recording:", error);
            throw error;
        }
    }

    /**
     * Stop recording and get file URI
     * @returns {Promise<string>} - File URI of recorded audio
     */
    async stopRecording() {
        try {
            if (!this.isRecording || !this.recording) {
                console.warn("No active recording to stop");
                return null;
            }

            // Stop the recording
            await this.recording.stopAndUnloadAsync();

            this.isRecording = false;
            this.isPaused = false;
            this._stopTimer();

            // Get the recording URI
            this.recordingUri = this.recording.getURI();

            // Clean up recording object
            this.recording = null;

            console.log("Recording stopped, saved to:", this.recordingUri);
            return this.recordingUri;
        } catch (error) {
            console.error("Failed to stop recording:", error);
            throw error;
        }
    }

    /**
     * Pause recording (iOS only - Android will stop)
     * @returns {Promise<boolean>}
     */
    async pauseRecording() {
        try {
            if (!this.isRecording || !this.recording) {
                console.warn("No active recording to pause");
                return false;
            }

            if (Platform.OS === "ios") {
                await this.recording.pauseAsync();
                this.isPaused = true;
                this._stopTimer();
                console.log("Recording paused");
                return true;
            } else {
                console.warn(
                    "Pause not supported on Android, stopping recording"
                );
                await this.stopRecording();
                return false;
            }
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
            if (!this.isPaused || !this.recording) {
                console.warn("No paused recording to resume");
                return false;
            }

            if (Platform.OS === "ios") {
                await this.recording.startAsync();
                this.isPaused = false;
                this._startTimer();
                console.log("Recording resumed");
                return true;
            } else {
                console.warn("Resume not supported on Android");
                return false;
            }
        } catch (error) {
            console.error("Failed to resume recording:", error);
            throw error;
        }
    }

    /**
     * Get current recording status
     * @returns {Object}
     */
    getRecordingStatus() {
        return {
            isRecording: this.isRecording,
            isPaused: this.isPaused,
            duration: this.recordingDuration,
            uri: this.recordingUri,
        };
    }

    /**
     * Save recording to permanent location
     * @param {string} filename - Custom filename (optional)
     * @returns {Promise<string>} - Permanent file URI
     */
    async saveRecording(filename = null) {
        try {
            if (!this.recordingUri) {
                throw new Error("No recording to save");
            }

            const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
            const fileExtension = Platform.OS === "ios" ? "m4a" : "mp3";
            const finalFilename =
                filename || `volo-recording-${timestamp}.${fileExtension}`;

            const documentDirectory = FileSystem.documentDirectory;
            const newUri = `${documentDirectory}${finalFilename}`;

            // Move file to permanent location
            await FileSystem.moveAsync({
                from: this.recordingUri,
                to: newUri,
            });

            this.recordingUri = newUri;
            console.log("Recording saved to:", newUri);
            return newUri;
        } catch (error) {
            console.error("Failed to save recording:", error);
            throw error;
        }
    }

    /**
     * Delete recording file
     * @param {string} uri - File URI to delete (optional, uses current recording)
     * @returns {Promise<boolean>}
     */
    async deleteRecording(uri = null) {
        try {
            const fileUri = uri || this.recordingUri;
            if (!fileUri) {
                console.warn("No recording to delete");
                return false;
            }

            const fileInfo = await FileSystem.getInfoAsync(fileUri);
            if (fileInfo.exists) {
                await FileSystem.deleteAsync(fileUri);
                if (fileUri === this.recordingUri) {
                    this.recordingUri = null;
                }
                console.log("Recording deleted:", fileUri);
                return true;
            }
            return false;
        } catch (error) {
            console.error("Failed to delete recording:", error);
            return false;
        }
    }

    /**
     * Get recording options based on platform and config
     * @private
     */
    _getRecordingOptions(customOptions = {}) {
        const baseOptions = {
            android: {
                extension: ".mp3",
                outputFormat:
                    Audio.RECORDING_OPTION_ANDROID_OUTPUT_FORMAT_MPEG_4,
                audioEncoder: Audio.RECORDING_OPTION_ANDROID_AUDIO_ENCODER_AAC,
                sampleRate: AudioConfig.recording.sampleRate,
                numberOfChannels: AudioConfig.recording.numberOfChannels,
                bitRate: AudioConfig.recording.bitRate,
            },
            ios: {
                extension: ".m4a",
                outputFormat: Audio.RECORDING_OPTION_IOS_OUTPUT_FORMAT_MPEG4AAC,
                audioQuality: Audio.RECORDING_OPTION_IOS_AUDIO_QUALITY_HIGH,
                sampleRate: AudioConfig.recording.sampleRate,
                numberOfChannels: AudioConfig.recording.numberOfChannels,
                bitRate: AudioConfig.recording.bitRate,
                linearPCMBitDepth: 16,
                linearPCMIsBigEndian: false,
                linearPCMIsFloat: false,
            },
        };

        return {
            ...baseOptions,
            ...customOptions,
        };
    }

    /**
     * Start duration timer
     * @private
     */
    _startTimer() {
        this.recordingTimer = setInterval(() => {
            if (this.isRecording && !this.isPaused) {
                this.recordingDuration = Math.floor(
                    (Date.now() - this.recordingStartTime) / 1000
                );
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

    /**
     * Cleanup resources
     */
    async cleanup() {
        try {
            if (this.isRecording) {
                await this.stopRecording();
            }
            this._stopTimer();
            this.recording = null;
            this.recordingUri = null;
            this.recordingDuration = 0;
        } catch (error) {
            console.error("Failed to cleanup recorder:", error);
        }
    }
}

export default new AudioRecorder();
