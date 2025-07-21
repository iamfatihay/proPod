import { Audio } from "expo-av";
import { Platform, Alert } from "react-native";
import * as MediaLibrary from "expo-media-library";

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
            const recordingResponse = await Audio.requestPermissionsAsync();
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
            console.error("Permission request failed:", error);
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
            const recordingStatus = await Audio.getPermissionsAsync();
            const mediaStatus = await MediaLibrary.getPermissionsAsync();

            this.recordingPermission = recordingStatus.status === "granted";
            this.mediaLibraryPermission = mediaStatus.status === "granted";
            this.permissionsGranted =
                this.recordingPermission && this.mediaLibraryPermission;

            return this.permissionsGranted;
        } catch (error) {
            console.error("Permission check failed:", error);
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
