const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// Remove 'mjs' from sourceExts to prevent 'import.meta' syntax error on web.
// Some libraries (e.g., Zustand) use .mjs files with modern JS syntax that
// Metro doesn't fully support for web builds yet. Removing the extension
// forces Metro to use the more compatible .js versions of these libraries.
if (config.resolver.sourceExts.includes("mjs")) {
    config.resolver.sourceExts.splice(
        config.resolver.sourceExts.indexOf("mjs"),
        1
    );
}

module.exports = withNativeWind(config, { input: "./global.css" });
