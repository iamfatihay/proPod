module.exports = {
    testEnvironment: "node",
    testMatch: [
        "<rootDir>/src/**/__tests__/**/*.{js,jsx}",
        "<rootDir>/src/**/*.(test|spec).{js,jsx}",
    ],
    testPathIgnorePatterns: [
        "<rootDir>/src/components/__tests__/",
        "<rootDir>/src/components/audio/__tests__/",
        "<rootDir>/src/components/recording/__tests__/",
    ],
    setupFilesAfterEnv: ["<rootDir>/src/tests/setup.js"],
    moduleFileExtensions: ["js", "jsx", "json"],
    transform: {
        "^.+\\.(js|jsx)$": "babel-jest",
    },
    transformIgnorePatterns: [
        "node_modules/(?!(expo|@expo|expo-constants|expo-secure-store|expo-font|react-native)/)",
    ],
    moduleNameMapper: {
        "^expo-constants$": "<rootDir>/src/tests/mocks/expoConstants.js",
        "^react-native$": "<rootDir>/src/tests/mocks/reactNative.js",
        "^expo-audio$": "<rootDir>/src/tests/mocks/expoAudio.js",
        "^expo-secure-store$": "<rootDir>/src/tests/mocks/expoSecureStore.js",
        "^expo-font$": "<rootDir>/src/tests/mocks/expoFont.js",
        "^expo-file-system$": "<rootDir>/src/tests/mocks/expoFileSystem.js",
        "^expo-media-library$": "<rootDir>/src/tests/mocks/expoMediaLibrary.js",
        "^@react-native-async-storage/async-storage$": "<rootDir>/src/tests/mocks/asyncStorage.js",
        "^@expo/vector-icons$": "<rootDir>/src/tests/mocks/vectorIcons.js",
        "^react-native-paper$": "<rootDir>/src/tests/mocks/reactNativePaper.js",
        "^@/(.*)$": "<rootDir>/src/$1",
        "^~/(.*)$": "<rootDir>/$1",
    },
    collectCoverageFrom: [
        "src/**/*.{js,jsx}",
        "!src/**/*.test.{js,jsx}",
        "!src/**/__tests__/**/*.{js,jsx}",
        "!src/tests/**/*.js",
    ],
    testTimeout: 10000,
    verbose: true,
    globals: {
        __DEV__: true,
    },
};
