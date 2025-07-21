/** @type {Detox.DetoxConfig} */
module.exports = {
    testRunner: {
        args: {
            $0: "jest",
            config: "e2e/jest.config.js",
        },
        jest: {
            setupTimeout: 120000,
        },
    },
    apps: {
        "ios.debug": {
            type: "ios.app",
            binaryPath:
                "ios/build/Build/Products/Debug-iphonesimulator/Volo.app",
            build: "xcodebuild -workspace ios/Volo.xcworkspace -scheme Volo -configuration Debug -sdk iphonesimulator -derivedDataPath ios/build",
        },
        "ios.release": {
            type: "ios.app",
            binaryPath:
                "ios/build/Build/Products/Release-iphonesimulator/Volo.app",
            build: "xcodebuild -workspace ios/Volo.xcworkspace -scheme Volo -configuration Release -sdk iphonesimulator -derivedDataPath ios/build",
        },
        "android.debug": {
            type: "android.apk",
            binaryPath: "android/app/build/outputs/apk/debug/app-debug.apk",
            build: "cd android && ./gradlew assembleDebug assembleAndroidTest -DtestBuildType=debug",
            reversePorts: [8000, 8081],
        },
        "android.release": {
            type: "android.apk",
            binaryPath: "android/app/build/outputs/apk/release/app-release.apk",
            build: "cd android && ./gradlew assembleRelease assembleAndroidTest -DtestBuildType=release",
            reversePorts: [8000],
        },
    },
    devices: {
        simulator: {
            type: "ios.simulator",
            device: {
                type: "iPhone 15 Pro",
            },
        },
        attached: {
            type: "android.attached",
            device: {
                adbName: ".*",
            },
        },
        emulator: {
            type: "android.emulator",
            device: {
                avdName: "Pixel_7_API_34",
            },
        },
    },
    configurations: {
        "ios.sim.debug": {
            device: "simulator",
            app: "ios.debug",
        },
        "ios.sim.release": {
            device: "simulator",
            app: "ios.release",
        },
        "android.emu.debug": {
            device: "emulator",
            app: "android.debug",
        },
        "android.emu.release": {
            device: "emulator",
            app: "android.release",
        },
        "android.attached.debug": {
            device: "attached",
            app: "android.debug",
        },
    },
};
