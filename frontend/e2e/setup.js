/**
 * E2E Test Setup
 * Global setup and utilities for Detox tests
 */

const { cleanup, init } = require("detox");

// Global test utilities
global.waitForElementTimeout = 10000;
global.longPressTimeout = 1000;

// Helper functions for common E2E operations
global.helpers = {
    // Wait for app to be ready
    waitForAppReady: async (timeout = 10000) => {
        await waitFor(element(by.id("app-ready-indicator")))
            .toBeVisible()
            .withTimeout(timeout);
    },

    // Login helper
    loginUser: async (email, password) => {
        await element(by.id("email-input")).typeText(email);
        await element(by.id("password-input")).typeText(password);
        await element(by.id("login-button")).tap();

        // Wait for home screen
        await waitFor(element(by.id("home-screen")))
            .toBeVisible()
            .withTimeout(10000);
    },

    // Navigate to tab
    navigateToTab: async (tabName) => {
        await element(by.id(`${tabName}-tab`)).tap();
        await waitFor(element(by.id(`${tabName}-screen`)))
            .toBeVisible()
            .withTimeout(5000);
    },

    // Scroll to element
    scrollToElement: async (scrollViewId, elementId) => {
        await waitFor(element(by.id(elementId)))
            .toBeVisible()
            .whileElement(by.id(scrollViewId))
            .scroll(200, "down");
    },

    // Wait for loading to complete
    waitForLoadingComplete: async (timeout = 10000) => {
        await waitFor(element(by.id("loading-indicator")))
            .not.toBeVisible()
            .withTimeout(timeout);
    },

    // Take screenshot for debugging
    takeScreenshot: async (name) => {
        if (device.getPlatform() === "ios") {
            await device.takeScreenshot(name);
        }
    },

    // Mock API responses for testing
    mockApiSuccess: async () => {
        // Implementation would depend on your API mocking strategy
        await device.setURLBlacklist([]);
    },

    mockApiError: async () => {
        // Implementation for testing error scenarios
        await device.setURLBlacklist(["**/api/**"]);
    },
};

// Before each test
beforeEach(async () => {
    await helpers.waitForAppReady();
});

// After each test cleanup
afterEach(async () => {
    // Reset app state if needed
    await device.reloadReactNative();
});
