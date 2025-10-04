export default ({ config }) => ({
    ...config,
    name: "Volo",
    slug: "Volo",
    version: "1.0.0",
    scheme: "volo",
    orientation: "portrait",
    icon: "./assets/Volo-logo.png",
    userInterfaceStyle: "dark",
    newArchEnabled: true,
    splash: {
        image: "./assets/Volo-logo.png",
        resizeMode: "contain",
        backgroundColor: "#000000",
    },
    ios: {
        supportsTablet: true,
        splash: {
            backgroundColor: "#000000",
        },
        infoPlist: {
            NSMicrophoneUsageDescription:
                "This app needs access to microphone to record podcasts.",
            NSCameraUsageDescription:
                "This app needs access to camera for profile pictures.",
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
            "android.permission.WRITE_EXTERNAL_STORAGE",
            "android.permission.READ_EXTERNAL_STORAGE",
        ],
    },
    web: {
        bundler: "metro",
        favicon: "./assets/Volo-logo.png",
    },
    extra: {
        apiBaseUrl: "http://10.52.164.39:8000",
        // apiBaseUrl: "http://10.79.165.39:8000",
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
        [
            "expo-av",
            {
                microphonePermission:
                    "Allow Volo to access your microphone to record podcasts.",
            },
        ],
    ],
});
