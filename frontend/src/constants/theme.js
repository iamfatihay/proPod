/**
 * Theme Constants
 * 
 * Central theme management for consistent styling across the app.
 * Import this file instead of requiring tailwind.config.js in components.
 * 
 * Performance: Single object reference, no require() overhead per component.
 */

export const COLORS = {
    // Primary Colors
    primary: "#D32F2F",
    accent: "#D32F2F",
    
    // Background Colors
    background: "#000000",
    panel: "#232323",
    card: "#181818",
    
    // Text Colors
    text: {
        primary: "#FFFFFF",
        secondary: "#CCCCCC",
        muted: "#888888",
    },
    
    // Border Colors
    border: "#333333",
    borderLight: "#444444",
    
    // Status Colors
    success: "#10B981",
    warning: "#F59E0B",
    error: "#EF4444",
    info: "#3B82F6",
    
    // State Colors
    recording: "#D32F2F",
    live: "#D32F2F",
    playing: "#10B981",
    paused: "#F59E0B",
    
    // Icon Colors
    icon: "#FFFFFF",
    
    // Gradient Colors
    gradient: {
        purple: "#667eea",
        purpleDark: "#764ba2",
        pink: "#f093fb",
        pinkDark: "#f5576c",
        blue: "#4facfe",
        cyan: "#00f2fe",
        green: "#43e97b",
        greenLight: "#38f9d7",
        orange: "#fa709a",
        yellow: "#fee140",
        teal: "#30cfd0",
        tealDark: "#330867",
        rose: "#ff9a9e",
        roseLight: "#fecfef",
    },
    
    // Notification Type Colors
    notification: {
        ai: "#8B5CF6",
        comment: "#3B82F6",
        like: "#EF4444",
        follow: "#10B981",
        system: "#6B7280",
        rtc_processing: "#F59E0B",
        rtc_ready: "#10B981",
    },
};

export const FONT_SIZES = {
    xs: 10,
    sm: 12,
    base: 14,
    md: 16,
    lg: 20,
    xl: 24,
    xxl: 32,
    // Semantic names
    title: 32,
    headline: 24,
    body: 16,
    caption: 13,
    small: 11,
};

export const SPACING = {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
};

export const BORDER_RADIUS = {
    xs: 5,
    sm: 6,
    md: 12,
    lg: 20,
    xl: 24,
    xxl: 60,
    full: 9999,
};

/**
 * Helper function to add alpha transparency to hex colors
 * @param {string} hex - Hex color code (e.g., "#FFFFFF")
 * @param {number} alpha - Alpha value 0-1 (e.g., 0.5 for 50%)
 * @returns {string} RGBA color string
 */
export const addAlpha = (hex, alpha) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

/**
 * Get notification type color configuration
 * @param {string} type - Notification type (ai_complete, comment, like, follow, system)
 * @returns {object} Color configuration with icon color and background color
 */
export const getNotificationColors = (type) => {
    const colorMap = {
        ai_complete: { color: COLORS.notification.ai, bgColor: addAlpha(COLORS.notification.ai, 0.12) },
        comment: { color: COLORS.notification.comment, bgColor: addAlpha(COLORS.notification.comment, 0.12) },
        like: { color: COLORS.notification.like, bgColor: addAlpha(COLORS.notification.like, 0.12) },
        follow: { color: COLORS.notification.follow, bgColor: addAlpha(COLORS.notification.follow, 0.12) },
        system: { color: COLORS.notification.system, bgColor: addAlpha(COLORS.notification.system, 0.12) },
        rtc_processing: { color: COLORS.notification.rtc_processing, bgColor: addAlpha(COLORS.notification.rtc_processing, 0.12) },
        rtc_ready: { color: COLORS.notification.rtc_ready, bgColor: addAlpha(COLORS.notification.rtc_ready, 0.12) },
    };
    
    return colorMap[type] || colorMap.system;
};

// Export default theme object (backward compatibility)
export default {
    colors: COLORS,
    fontSize: FONT_SIZES,
    spacing: SPACING,
    borderRadius: BORDER_RADIUS,
};
