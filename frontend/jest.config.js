module.exports = {
    testEnvironment: "node",
    testMatch: [
        "<rootDir>/src/**/__tests__/**/*.{js,jsx}",
        "<rootDir>/src/**/*.(test|spec).{js,jsx}",
    ],
    setupFilesAfterEnv: ["<rootDir>/src/tests/setup.js"],
    moduleFileExtensions: ["js", "jsx", "json"],
    transform: {
        "^.+\\.(js|jsx)$": "babel-jest",
    },
    transformIgnorePatterns: [
        "node_modules/(?!(expo|@expo|expo-constants|react-native)/)",
    ],
    moduleNameMapper: {
        "^expo-constants$": "<rootDir>/src/tests/mocks/expoConstants.js",
        "^react-native$": "<rootDir>/src/tests/mocks/reactNative.js",
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
