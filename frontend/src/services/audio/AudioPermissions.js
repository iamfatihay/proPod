import {
    requestRecordingPermissionsAsync,
    getRecordingPermissionsAsync,
} from "expo-audio";
import { Platform, Alert, Linking } from "react-native";
import * as MediaLibrary from "expo-media-library";
import Logger from "../../utils/logger";

class AudioPermissions {
    constructor() {
        this.permissionsGranted = false;
        this.recordingPermission = false;
        this.mediaLibraryPermission = false;
    }

    /**
     * Request all necessary audio permissions
     * @returns {Promise<boolean>} - true if all permissions granted
     */
    async requestPermissions() {
        try {
            // Request recording permission
            const recordingResponse = await requestRecordingPermissionsAsync();
            this.recordingPermission = recordingResponse.status === "granted";

            // Request media library permission for saving files
            const mediaResponse = await MediaLibrary.requestPermissionsAsync();
            this.mediaLibraryPermission = mediaResponse.status === "granted";

            this.permissionsGranted =
                this.recordingPermission && this.mediaLibraryPermission;

            if (!this.permissionsGranted) {
                this._showPermissionDeniedAlert();
            }

            return this.permissionsGranted;
        } catch (error) {
            Logger.error("💥 Permission request failed:", error);
            Logger.error("💥 Error details:", {
                message: error.message,
                stack: error.stack,
                name: error.name,
            });
            this._showPermissionErrorAlert();
            return false;
        }
    }

    /**
     * Request only microphone permission for starting a recording session.
     * @returns {Promise<boolean>}
     */
    async requestRecordingPermissions() {
        try {
            const recordingResponse = await requestRecordingPermissionsAsync();
            this.recordingPermission = recordingResponse.status === "granted";
            this.permissionsGranted = this.recordingPermission;

            if (!this.recordingPermission) {
                this._showRecordingPermissionDeniedAlert();
            }

            return this.recordingPermission;
        } catch (error) {
            Logger.error("💥 Recording permission request failed:", error);
            Logger.error("💥 Recording permission error details:", {
                message: error.message,
                stack: error.stack,
                name: error.name,
            });
            this._showPermissionErrorAlert();
            return false;
        }
    }

    /**
     * Check if permissions are already granted
     * @returns {Promise<boolean>}
     */
    async checkPermissions() {
        try {
            const recordingStatus = await getRecordingPermissionsAsync();
            const mediaStatus = await MediaLibrary.getPermissionsAsync();

            this.recordingPermission = recordingStatus.status === "granted";
            this.mediaLibraryPermission = mediaStatus.status === "granted";
            this.permissionsGranted =
                this.recordingPermission && this.mediaLibraryPermission;

            return this.permissionsGranted;
        } catch (error) {
            Logger.error("💥 Permission check failed:", error);
            Logger.error("💥 Check error details:", {
                message: error.message,
                stack: error.stack,
                name: error.name,
            });
            return false;
        }
    }

    /**
     * Check only microphone permission for recording.
     * @returns {Promise<boolean>}
     */
    async checkRecordingPermissions() {
        try {
            const recordingStatus = await getRecordingPermissionsAsync();

            this.recordingPermission = recordingStatus.status === "granted";
            this.permissionsGranted = this.recordingPermission;

            return this.recordingPermission;
        } catch (error) {
            Logger.error("💥 Recording permission check failed:", error);
            Logger.error("💥 Recording check error details:", {
                message: error.message,
                stack: error.stack,
                name: error.name,
            });
            return false;
        }
    }

    /**
     * Get current permission status
     * @returns {Object} - permission status object
     */
    getPermissionStatus() {
        return {
            recording: this.recordingPermission,
            mediaLibrary: this.mediaLibraryPermission,
            allGranted: this.permissionsGranted,
        };
    }

    async _openAppSettings() {
        try {
            await Linking.openSettings();
        } catch (error) {
            Logger.error("💥 Failed to open app settings:", error);
            this._showPermissionErrorAlert();
        }
    }

    /**
     * Show alert when permissions are denied
     * @private
     */
    _showPermissionDeniedAlert() {
        const title = "Permissions Required";
        const message =
            Platform.OS === "ios"
                ? "Volo needs microphone and media library access to record and save podcasts. Please enable these permissions in Settings > Volo."
                : "Volo needs microphone and storage permissions to record and save podcasts. Please grant these permissions.";

        Alert.alert(
            title,
            message,
            [
                {
                    text: "Cancel",
                    style: "cancel",
                },
                {
                    text: Platform.OS === "ios" ? "Open Settings" : "Retry",
                    onPress: () => {
                        if (Platform.OS === "ios") {
                            void this._openAppSettings();
                        } else {
                            // On Android, request permissions again
                            this.requestPermissions();
                        }
                    },
                },
            ],
            { cancelable: false }
        );
    }

    /**
     * Show alert when microphone permission is denied.
     * @private
     */
    _showRecordingPermissionDeniedAlert() {
        const title = "Microphone Permission Required";
        const message =
            Platform.OS === "ios"
                ? "Volo needs microphone access to record podcasts. Please enable microphone permission in Settings > Volo."
                : "Volo needs microphone access to record podcasts. Please grant microphone permission.";

        Alert.alert(
            title,
            message,
            [
                {
                    text: "Cancel",
                    style: "cancel",
                },
                {
                    text: Platform.OS === "ios" ? "Open Settings" : "Retry",
                    onPress: () => {
                        if (Platform.OS === "ios") {
                            void this._openAppSettings();
                        } else if (Platform.OS === "android") {
                            this.requestRecordingPermissions();
                        }
                    },
                },
            ],
            { cancelable: false }
        );
    }

    /**
     * Show alert when permission request fails
     * @private
     */
    _showPermissionErrorAlert() {
        Alert.alert(
            "Permission Error",
            "There was an error requesting permissions. Please try again or check your device settings.",
            [{ text: "OK" }]
        );
    }
}

export default new AudioPermissions();
