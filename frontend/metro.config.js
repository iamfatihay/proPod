const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Preserve Expo's default extensions while removing 'mjs' to prevent syntax errors
// Some libraries (e.g., Zustand) use .mjs files with modern JS syntax that
// Metro doesn't fully support for web builds yet.
config.resolver.sourceExts = config.resolver.sourceExts.filter(
    (ext) => ext !== "mjs"
);
config.resolver.assetExts = config.resolver.assetExts || [];

module.exports = config;
