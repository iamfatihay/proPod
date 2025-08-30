import { Platform } from "react-native";

/**
 * Platform utility for consistent iOS/Android handling
 * Ensures UI components work properly on both platforms
 */

export const isIOS = Platform.OS === "ios";
export const isAndroid = Platform.OS === "android";

/**
 * Get platform-specific shadow styles
 * @param {number} elevation - Android elevation value
 * @param {object} iosShadow - iOS shadow configuration
 * @returns {object} Platform-specific shadow styles
 */
export const getPlatformShadow = (elevation = 5, iosShadow = {}) => {
    const defaultIOSShadow = {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
    };

    if (isIOS) {
        return {
            ...defaultIOSShadow,
            ...iosShadow,
        };
    }

    return {
        elevation,
    };
};

/**
 * Get platform-specific border radius
 * @param {number} radius - Base border radius
 * @returns {number} Platform-adjusted border radius
 */
export const getPlatformBorderRadius = (radius = 16) => {
    // iOS tends to look better with slightly larger radius
    if (isIOS) {
        return radius + 2;
    }
    return radius;
};

/**
 * Get platform-specific padding
 * @param {number} padding - Base padding value
 * @returns {number} Platform-adjusted padding
 */
export const getPlatformPadding = (padding = 16) => {
    // Android needs slightly more padding for touch targets
    if (isAndroid) {
        return padding + 2;
    }
    return padding;
};

/**
 * Get platform-specific font weight
 * @param {string} weight - Font weight
 * @returns {string} Platform-adjusted font weight
 */
export const getPlatformFontWeight = (weight = "normal") => {
    // Android doesn't support all font weights
    if (isAndroid) {
        const androidWeights = {
            100: "100",
            200: "200",
            300: "300",
            400: "normal",
            500: "500",
            600: "600",
            700: "bold",
            800: "800",
            900: "900",
        };
        return androidWeights[weight] || weight;
    }
    return weight;
};

/**
 * Get platform-specific icon size
 * @param {number} size - Base icon size
 * @returns {number} Platform-adjusted icon size
 */
export const getPlatformIconSize = (size = 24) => {
    // iOS icons look better slightly larger
    if (isIOS) {
        return size + 1;
    }
    return size;
};
