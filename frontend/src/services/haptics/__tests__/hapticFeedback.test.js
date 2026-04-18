jest.mock("expo-haptics", () => ({
    impactAsync: jest.fn().mockResolvedValue(undefined),
    ImpactFeedbackStyle: {
        Light: "light",
        Medium: "medium",
    },
}));

const AsyncStorage = require("@react-native-async-storage/async-storage");
const Haptics = require("expo-haptics");
const { Platform, Vibration } = require("react-native");

const {
    default: hapticFeedback,
    STORAGE_KEY,
} = require("../hapticFeedback");

describe("hapticFeedback", () => {
    const originalPlatform = Platform.OS;

    beforeEach(() => {
        AsyncStorage.__clearMockStorage();
        hapticFeedback.__resetForTests();
        Platform.OS = "ios";
        Vibration.vibrate.mockClear();
    });

    afterAll(() => {
        Platform.OS = originalPlatform;
    });

    it("defaults to enabled when no preference is stored", async () => {
        await expect(hapticFeedback.loadPreference()).resolves.toBe(true);
    });

    it("persists disabled preference and blocks feedback", async () => {
        await hapticFeedback.setEnabled(false);

        await expect(hapticFeedback.impact("medium")).resolves.toBe(false);
        await expect(hapticFeedback.vibrate(500)).resolves.toBe(false);
        expect(AsyncStorage.setItem).toHaveBeenCalledWith(STORAGE_KEY, "0");
        expect(Haptics.impactAsync).not.toHaveBeenCalled();
        expect(Vibration.vibrate).not.toHaveBeenCalled();
    });

    it("triggers impact feedback when enabled", async () => {
        await hapticFeedback.setEnabled(true);

        await expect(hapticFeedback.impact("medium")).resolves.toBe(true);
        expect(AsyncStorage.setItem).toHaveBeenCalledWith(STORAGE_KEY, "1");
        expect(Haptics.impactAsync).toHaveBeenCalledWith("medium");
    });

    it("uses vibration patterns when enabled", async () => {
        await hapticFeedback.setEnabled(true);

        await expect(hapticFeedback.vibrate([0, 200, 100, 200])).resolves.toBe(true);
        expect(Vibration.vibrate).toHaveBeenCalledWith([0, 200, 100, 200]);
    });
});
