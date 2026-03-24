import "dotenv/config";

export default ({ config }) => ({
    ...config,
    name: "Volo",
    slug: "Volo",
    version: "1.0.0",
    scheme: "volo",
    orientation: "portrait",
    icon: "./assets/Volo-logo.png",
    userInterfaceStyle: "dark",
    newArchEnabled: false,
    splash: {
        image: "./assets/Volo-logo.png",
        resizeMode: "contain",
        backgroundColor: "#000000",
    },
    ios: {
        bundleIdentifier: "com.iamfatihay.Volo",
        supportsTablet: true,
        splash: {
            backgroundColor: "#000000",
        },
        infoPlist: {
            NSMicrophoneUsageDescription:
                "This app needs access to microphone to record podcasts.",
            NSCameraUsageDescription:
                "This app needs access to camera for profile pictures.",
            NSPhotoLibraryUsageDescription:
                "This app needs access to photo library for profile pictures.",
            UIBackgroundModes: ["audio"],
        },
    },
    android: {
        adaptiveIcon: {
            foregroundImage: "./assets/Volo-logo.png",
            backgroundColor: "#000000",
        },
        edgeToEdgeEnabled: true,
        splash: {
            backgroundColor: "#000000",
        },
        package: "com.iamfatihay.Volo",
        permissions: [
            "android.permission.RECORD_AUDIO",
            "android.permission.MODIFY_AUDIO_SETTINGS",
            "android.permission.INTERNET",
            "android.permission.ACCESS_NETWORK_STATE",
            "android.permission.CHANGE_NETWORK_STATE",
            "android.permission.FOREGROUND_SERVICE",
            "android.permission.BLUETOOTH",
            "android.permission.BLUETOOTH_CONNECT",
            "android.permission.WRITE_EXTERNAL_STORAGE",
            "android.permission.READ_EXTERNAL_STORAGE",
            "android.permission.CAMERA",
            "android.permission.READ_MEDIA_IMAGES",
            "android.permission.POST_NOTIFICATIONS", // For persistent recording notifications
        ],
    },
    web: {
        bundler: "metro",
        favicon: "./assets/Volo-logo.png",
    },
    extra: {
        // Analytics
        clarityProjectId: process.env.CLARITY_PROJECT_ID || "w0q4nzuzaa",
        // API Configuration
        // Development: Leave empty for auto-detection
        // Production: Set in .env or environment variables
        apiBaseUrl: process.env.API_BASE_URL || process.env.EXPO_PUBLIC_API_URL || "",
        eas: {
            projectId: "6760a9ac-697b-4e25-9f44-0d0ecc8edbbb",
        },
        googleAndroidClientId:
            "255785247154-dalcf8c8sn20hchs1edgeo87u7m5p2oc.apps.googleusercontent.com",
        googleIosClientId:
            "255785247154-ubfuvv65ft1ras0mnnpminqjibeksg2d.apps.googleusercontent.com",
        googleExpoClientId:
            "255785247154-af6kqt9s2g6ovnl5du0frdtd987dsves.apps.googleusercontent.com",
    },
    plugins: [
        "expo-secure-store",
        "expo-router",
        "expo-font",
        "expo-image-picker",
        "expo-asset",
        [
            "expo-audio",
            {
                microphonePermission:
                    "Allow Volo to access your microphone to record podcasts.",
                android: {
                    audioDecodingMode: "no-offload",
                },
            },
        ],
    ],
});
