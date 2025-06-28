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
        apiBaseUrl: "http://192.168.178.27:8000",
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
});
