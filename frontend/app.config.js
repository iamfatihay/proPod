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
    },
    web: {
        bundler: "metro",
        favicon: "./assets/Volo-logo.png",
    },
    extra: {
        apiBaseUrl: "http://10.0.2.2:8000",
        eas: {
            projectId: "6760a9ac-697b-4e25-9f44-0d0ecc8edbbb",
        },
    },
});
