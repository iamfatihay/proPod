import { Audio } from "expo-av";
import { Platform, Alert } from "react-native";
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
            Logger.log("🎤 Starting permission requests...");

            // Request recording permission
            Logger.log("🎤 Requesting AUDIO recording permission...");
            const recordingResponse = await Audio.requestPermissionsAsync();
            this.recordingPermission = recordingResponse.status === "granted";
            Logger.log("🎤 Audio permission result:", {
                status: recordingResponse.status,
                granted: this.recordingPermission,
                response: recordingResponse,
            });

            // Request media library permission for saving files
            Logger.log("📁 Requesting MEDIA LIBRARY permission...");
            const mediaResponse = await MediaLibrary.requestPermissionsAsync();
            this.mediaLibraryPermission = mediaResponse.status === "granted";
            Logger.log("📁 Media library permission result:", {
                status: mediaResponse.status,
                granted: this.mediaLibraryPermission,
                response: mediaResponse,
            });

            this.permissionsGranted =
                this.recordingPermission && this.mediaLibraryPermission;

            Logger.log("✅ Final permission status:", {
                recording: this.recordingPermission,
                mediaLibrary: this.mediaLibraryPermission,
                allGranted: this.permissionsGranted,
            });

            if (!this.permissionsGranted) {
                Logger.warn("❌ Permissions denied, showing alert");
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
     * Check if permissions are already granted
     * @returns {Promise<boolean>}
     */
    async checkPermissions() {
        try {
            Logger.log("🔍 Checking existing permissions...");

            const recordingStatus = await Audio.getPermissionsAsync();
            const mediaStatus = await MediaLibrary.getPermissionsAsync();

            Logger.log("🔍 Permission check results:", {
                audio: {
                    status: recordingStatus.status,
                    granted: recordingStatus.granted,
                    canAskAgain: recordingStatus.canAskAgain,
                    full: recordingStatus,
                },
                media: {
                    status: mediaStatus.status,
                    granted: mediaStatus.granted,
                    canAskAgain: mediaStatus.canAskAgain,
                    full: mediaStatus,
                },
            });

            this.recordingPermission = recordingStatus.status === "granted";
            this.mediaLibraryPermission = mediaStatus.status === "granted";
            this.permissionsGranted =
                this.recordingPermission && this.mediaLibraryPermission;

            Logger.log("🔍 Final permission states:", {
                recording: this.recordingPermission,
                mediaLibrary: this.mediaLibraryPermission,
                allGranted: this.permissionsGranted,
            });

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
                            // On iOS, redirect to settings
                            // Linking.openURL('app-settings:');
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
