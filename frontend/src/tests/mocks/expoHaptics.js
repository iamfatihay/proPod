// Mock for expo-haptics
module.exports = {
    impactAsync: jest.fn().mockResolvedValue(undefined),
    notificationAsync: jest.fn().mockResolvedValue(undefined),
    selectionAsync: jest.fn().mockResolvedValue(undefined),
    ImpactFeedbackStyle: {
        Light: "light",
        Medium: "medium",
        Heavy: "heavy",
    },
    NotificationFeedbackType: {
        Success: "success",
        Warning: "warning",
        Error: "error",
    },
};
