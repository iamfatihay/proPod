jest.mock("expo-audio", () => ({
    requestRecordingPermissionsAsync: jest.fn(),
    getRecordingPermissionsAsync: jest.fn(),
}));

jest.mock("expo-media-library", () => ({
    requestPermissionsAsync: jest.fn(),
    getPermissionsAsync: jest.fn(),
}));

jest.mock("react-native", () => {
    const actual = jest.requireActual("react-native");
    return {
        ...actual,
        Alert: {
            alert: jest.fn(),
        },
        Platform: {
            ...actual.Platform,
            OS: "android",
        },
        Linking: {
            openSettings: jest.fn().mockResolvedValue(undefined),
        },
    };
});

import { Alert, Linking, Platform } from "react-native";
import * as ExpoAudio from "expo-audio";
import * as MediaLibrary from "expo-media-library";
import AudioPermissions from "../AudioPermissions";

describe("AudioPermissions", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        AudioPermissions.permissionsGranted = false;
        AudioPermissions.recordingPermission = false;
        AudioPermissions.mediaLibraryPermission = false;
        Platform.OS = "android";
    });

    test("allows recording when microphone permission is granted", async () => {
        ExpoAudio.getRecordingPermissionsAsync.mockResolvedValue({
            status: "granted",
        });

        const hasPermission =
            await AudioPermissions.checkRecordingPermissions();

        expect(hasPermission).toBe(true);
        expect(MediaLibrary.getPermissionsAsync).not.toHaveBeenCalled();
    });

    test("requests only microphone permission for recording start", async () => {
        ExpoAudio.requestRecordingPermissionsAsync.mockResolvedValue({
            status: "granted",
        });

        const hasPermission =
            await AudioPermissions.requestRecordingPermissions();

        expect(hasPermission).toBe(true);
        expect(MediaLibrary.requestPermissionsAsync).not.toHaveBeenCalled();
        expect(Alert.alert).not.toHaveBeenCalled();
    });

    test("combined permission check still reports false when media library is denied", async () => {
        ExpoAudio.getRecordingPermissionsAsync.mockResolvedValue({
            status: "granted",
        });
        MediaLibrary.getPermissionsAsync.mockResolvedValue({
            status: "denied",
        });

        const hasPermission = await AudioPermissions.checkPermissions();

        expect(hasPermission).toBe(false);
        expect(AudioPermissions.getPermissionStatus()).toEqual({
            recording: true,
            mediaLibrary: false,
            allGranted: false,
        });
    });

    test("shows a microphone-specific alert when mic permission is denied", async () => {
        ExpoAudio.requestRecordingPermissionsAsync.mockResolvedValue({
            status: "denied",
        });

        const hasPermission =
            await AudioPermissions.requestRecordingPermissions();

        expect(hasPermission).toBe(false);
        expect(Alert.alert).toHaveBeenCalledWith(
            "Microphone Permission Required",
            expect.stringContaining("microphone access"),
            expect.any(Array),
            { cancelable: false }
        );
    });

    test("opens iOS settings when the microphone permission alert action is pressed", async () => {
        Platform.OS = "ios";
        ExpoAudio.requestRecordingPermissionsAsync.mockResolvedValue({
            status: "denied",
        });

        await AudioPermissions.requestRecordingPermissions();

        const buttons = Alert.alert.mock.calls[0][2];
        await buttons[1].onPress();

        expect(Linking.openSettings).toHaveBeenCalled();
    });
});