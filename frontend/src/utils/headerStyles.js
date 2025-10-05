/**
 * Standardized header styles for Stack.Screen navigation
 * Ensures consistent header appearance across all screens
 * 
 * Usage:
 * <Stack.Screen options={getHeaderOptions('Page Title')} />
 * <Stack.Screen options={getHeaderOptions('Page', { showBack: false })} />
 */

const HEADER_COLORS = {
    background: "#18181b", // bg-background from tailwind
    tint: "#FFFFFF", // text-primary from tailwind
    primary: "#D32F2F", // primary color from tailwind
};

/**
 * Get standard header options for Stack.Screen
 * @param {string} title - Screen title
 * @param {Object} options - Additional options
 * @param {boolean} options.showBack - Show back button (default: true)
 * @param {function} options.onBack - Custom back handler
 * @param {React.Component} options.headerRight - Right header component
 * @returns {Object} Header options object
 */
export const getHeaderOptions = (title, options = {}) => {
    const {
        showBack = true,
        onBack,
        headerRight,
    } = options;

    return {
        title,
        headerShown: true,
        headerStyle: {
            backgroundColor: HEADER_COLORS.background,
        },
        headerTintColor: HEADER_COLORS.tint,
        headerTitleStyle: {
            fontWeight: "500",
        },
        ...(headerRight && { headerRight }),
        ...(onBack && {
            headerLeft: () => (
                <TouchableOpacity
                    onPress={onBack}
                    style={{ marginLeft: 16 }}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                    <Ionicons name="arrow-back" size={24} color={HEADER_COLORS.tint} />
                </TouchableOpacity>
            ),
        }),
    };
};

/**
 * Get status bar styles matching the app theme
 * @returns {Object} Status bar props
 */
export const getStatusBarStyles = () => ({
    barStyle: "light-content",
    backgroundColor: HEADER_COLORS.background,
});

/**
 * Header color constants for direct use
 */
export const HEADER_THEME = HEADER_COLORS;

export default {
    getHeaderOptions,
    getStatusBarStyles,
    HEADER_THEME,
};

