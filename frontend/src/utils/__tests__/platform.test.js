import { Platform } from "react-native";

// Mock Platform.OS
jest.mock("react-native", () => ({
    Platform: {
        OS: "ios",
    },
}));

// Import after mocking
import {
    isIOS,
    isAndroid,
    getPlatformShadow,
    getPlatformBorderRadius,
    getPlatformPadding,
    getPlatformFontWeight,
    getPlatformIconSize,
} from "../platform";

describe("Platform Utilities", () => {
    describe("Platform Detection", () => {
        it("correctly identifies iOS platform", () => {
            expect(isIOS).toBe(true);
            expect(isAndroid).toBe(false);
        });

        it("has platform constants defined", () => {
            expect(typeof isIOS).toBe("boolean");
            expect(typeof isAndroid).toBe("boolean");
        });
    });

    describe("getPlatformShadow", () => {
        it("returns shadow styles for iOS", () => {
            const shadow = getPlatformShadow(5);

            expect(shadow).toHaveProperty("shadowColor");
            expect(shadow).toHaveProperty("shadowOffset");
            expect(shadow).toHaveProperty("shadowOpacity");
            expect(shadow).toHaveProperty("shadowRadius");
        });

        it("accepts custom shadow configuration", () => {
            const customShadow = { shadowOpacity: 0.5 };
            const shadow = getPlatformShadow(5, customShadow);

            expect(shadow.shadowOpacity).toBe(0.5);
        });

        it("returns valid shadow object", () => {
            const shadow = getPlatformShadow(8);
            expect(typeof shadow).toBe("object");
            expect(shadow).not.toBeNull();
        });
    });

    describe("getPlatformBorderRadius", () => {
        it("returns valid border radius", () => {
            const radius = getPlatformBorderRadius(16);
            expect(typeof radius).toBe("number");
            expect(radius).toBeGreaterThan(0);
        });

        it("handles different input values", () => {
            expect(getPlatformBorderRadius(8)).toBeGreaterThan(0);
            expect(getPlatformBorderRadius(24)).toBeGreaterThan(0);
            expect(getPlatformBorderRadius(32)).toBeGreaterThan(0);
        });
    });

    describe("getPlatformPadding", () => {
        it("returns valid padding values", () => {
            const padding = getPlatformPadding(16);
            expect(typeof padding).toBe("number");
            expect(padding).toBeGreaterThan(0);
        });

        it("handles different input values", () => {
            expect(getPlatformPadding(8)).toBeGreaterThan(0);
            expect(getPlatformPadding(24)).toBeGreaterThan(0);
            expect(getPlatformPadding(32)).toBeGreaterThan(0);
        });
    });

    describe("getPlatformFontWeight", () => {
        it("returns valid font weight for iOS", () => {
            const weight = getPlatformFontWeight("400");
            expect(typeof weight).toBe("string");
            expect(weight.length).toBeGreaterThan(0);
        });

        it("handles different font weights", () => {
            expect(getPlatformFontWeight("100")).toBeDefined();
            expect(getPlatformFontWeight("500")).toBeDefined();
            expect(getPlatformFontWeight("900")).toBeDefined();
        });
    });

    describe("getPlatformIconSize", () => {
        it("returns valid icon size", () => {
            const size = getPlatformIconSize(24);
            expect(typeof size).toBe("number");
            expect(size).toBeGreaterThan(0);
        });

        it("handles different input sizes", () => {
            expect(getPlatformIconSize(16)).toBeGreaterThan(0);
            expect(getPlatformIconSize(32)).toBeGreaterThan(0);
            expect(getPlatformIconSize(48)).toBeGreaterThan(0);
        });
    });

    describe("Utility Functions", () => {
        it("all functions are defined", () => {
            expect(typeof getPlatformShadow).toBe("function");
            expect(typeof getPlatformBorderRadius).toBe("function");
            expect(typeof getPlatformPadding).toBe("function");
            expect(typeof getPlatformFontWeight).toBe("function");
            expect(typeof getPlatformIconSize).toBe("function");
        });

        it("functions handle edge cases gracefully", () => {
            expect(() => getPlatformShadow(0)).not.toThrow();
            expect(() => getPlatformBorderRadius(0)).not.toThrow();
            expect(() => getPlatformPadding(0)).not.toThrow();
            expect(() => getPlatformFontWeight("")).not.toThrow();
            expect(() => getPlatformIconSize(0)).not.toThrow();
        });
    });
});
