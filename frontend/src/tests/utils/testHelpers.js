/**
 * Test Utilities and Helpers
 * Centralized utilities for consistent testing across all test types
 */

import { render } from "@testing-library/react-native";
import React from "react";

// Mock data generators
export const mockPodcastData = {
    minimal: {
        id: 1,
        title: "Test Podcast",
        description: "Test Description",
        duration: 60000,
        created_at: "2024-01-15T10:30:00Z",
        owner: {
            id: 123,
            name: "Test Creator",
        },
    },

    complete: {
        id: 1,
        title: "Complete Test Podcast",
        description: "A comprehensive test podcast with all fields populated",
        audio_url: "https://example.com/audio.mp3",
        thumbnail_url: "https://example.com/thumbnail.jpg",
        duration: 1800000, // 30 minutes
        category: "Technology",
        is_public: true,
        ai_enhanced: false,
        play_count: 150,
        like_count: 25,
        bookmark_count: 8,
        created_at: "2024-01-15T10:30:00Z",
        updated_at: "2024-01-15T10:30:00Z",
        owner_id: 123,
        owner: {
            id: 123,
            name: "Complete Creator",
            email: "creator@example.com",
            photo_url: "https://example.com/avatar.jpg",
        },
    },

    withInteractions: (overrides = {}) => ({
        ...mockPodcastData.complete,
        ...overrides,
        interactions: {
            is_liked: false,
            is_bookmarked: false,
            listening_history: null,
            ...overrides.interactions,
        },
    }),
};

export const mockUserData = {
    default: {
        id: 123,
        name: "Test User",
        email: "test@example.com",
        provider: "local",
        photo_url: null,
        is_active: true,
        created_at: "2024-01-01T00:00:00Z",
    },

    google: {
        id: 124,
        name: "Google User",
        email: "google@example.com",
        provider: "google",
        photo_url: "https://example.com/google-avatar.jpg",
        is_active: true,
        created_at: "2024-01-01T00:00:00Z",
    },
};

// API response builders
export const buildApiResponse = (data, status = 200) => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
    text: async () => JSON.stringify(data),
});

export const buildApiError = (message, status = 500) => {
    const error = new Error(message);
    error.status = status;
    error.response = { data: { detail: message } };
    return error;
};

// Mock function builders
export const createMockStore = (initialState = {}) => ({
    // Audio store defaults
    currentPodcast: null,
    isPlaying: false,
    position: 0,
    duration: 0,
    isLoading: false,
    volume: 1.0,
    playbackRate: 1.0,
    error: null,

    // Actions
    playPodcast: jest.fn(),
    pausePodcast: jest.fn(),
    stopPodcast: jest.fn(),
    seekToPosition: jest.fn(),
    setVolume: jest.fn(),
    setPlaybackRate: jest.fn(),
    updatePosition: jest.fn(),
    updateListeningHistory: jest.fn(),
    setError: jest.fn(),

    // Override with custom state
    ...initialState,
});

export const createMockNavigation = () => ({
    navigate: jest.fn(),
    dispatch: jest.fn(),
    reset: jest.fn(),
    goBack: jest.fn(),
    isFocused: jest.fn(() => true),
    canGoBack: jest.fn(() => false),
    getId: jest.fn(),
    getParent: jest.fn(),
    getState: jest.fn(() => ({ routes: [], index: 0 })),
});

export const createMockRoute = (params = {}) => ({
    key: "test-route",
    name: "test",
    params,
});

// Test wrapper components
export const TestWrapper = ({ children, storeState = {} }) => {
    // In a real implementation, this would wrap with providers
    // For now, it's a simple passthrough
    return children;
};

// Custom render function with providers
export const renderWithProviders = (ui, options = {}) => {
    const {
        storeState = {},
        navigationState = {},
        routeParams = {},
        ...renderOptions
    } = options;

    const Wrapper = ({ children }) => (
        <TestWrapper storeState={storeState}>{children}</TestWrapper>
    );

    return render(ui, { wrapper: Wrapper, ...renderOptions });
};

// Time and duration helpers
export const formatTestDuration = (milliseconds) => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

export const parseTestDuration = (durationString) => {
    const [minutes, seconds] = durationString.split(":").map(Number);
    return (minutes * 60 + seconds) * 1000;
};

// Wait utilities for async testing
export const waitForCondition = async (condition, timeout = 5000) => {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
        if (await condition()) {
            return true;
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
    }

    throw new Error(`Condition not met within ${timeout}ms`);
};

// Network simulation helpers
export const simulateNetworkDelay = (delay = 1000) => {
    return new Promise((resolve) => setTimeout(resolve, delay));
};

export const simulateNetworkError = () => {
    throw new Error("Network request failed");
};

// File and media helpers
export const createMockAudioFile = (overrides = {}) => ({
    uri: "file://test-audio.m4a",
    type: "audio/mp4",
    name: "test-audio.m4a",
    size: 1024000,
    duration: 60000,
    ...overrides,
});

export const createMockImageFile = (overrides = {}) => ({
    uri: "file://test-image.jpg",
    type: "image/jpeg",
    name: "test-image.jpg",
    size: 512000,
    width: 400,
    height: 400,
    ...overrides,
});

// Platform-specific test helpers
export const getPlatformSpecificValue = (iosValue, androidValue) => {
    // In a real implementation, this would check Platform.OS
    // For testing, we can mock the platform or use environment variables
    return process.env.TEST_PLATFORM === "ios" ? iosValue : androidValue;
};

// Assertion helpers
export const expectElementToBeVisible = async (
    getByTestId,
    testId,
    timeout = 5000
) => {
    await waitForCondition(() => {
        try {
            const element = getByTestId(testId);
            return element !== null;
        } catch {
            return false;
        }
    }, timeout);

    expect(getByTestId(testId)).toBeTruthy();
};

export const expectElementToHaveText = (getByTestId, testId, expectedText) => {
    const element = getByTestId(testId);
    expect(element.props.children).toEqual(expectedText);
};

// Performance testing helpers
export const measureRenderTime = (renderFunction) => {
    const startTime = performance.now();
    const result = renderFunction();
    const endTime = performance.now();

    return {
        result,
        renderTime: endTime - startTime,
    };
};

// Test data cleanup
export const cleanupTestData = () => {
    // Clear any global test state
    jest.clearAllMocks();

    // Reset any global variables
    if (global.fetch) {
        global.fetch.mockClear();
    }
};

// Common test patterns
export const testAccessibility = (component, expectedLabels = []) => {
    expectedLabels.forEach((label) => {
        expect(component.getByLabelText(label)).toBeTruthy();
    });
};

export const testErrorBoundary = async (ComponentWithError) => {
    // Temporarily suppress console.error for this test
    const originalError = console.error;
    console.error = jest.fn();

    try {
        render(<ComponentWithError />);
        // Test error boundary behavior
    } finally {
        console.error = originalError;
    }
};

// Export all utilities
export default {
    mockPodcastData,
    mockUserData,
    buildApiResponse,
    buildApiError,
    createMockStore,
    createMockNavigation,
    createMockRoute,
    renderWithProviders,
    formatTestDuration,
    parseTestDuration,
    waitForCondition,
    simulateNetworkDelay,
    simulateNetworkError,
    createMockAudioFile,
    createMockImageFile,
    getPlatformSpecificValue,
    expectElementToBeVisible,
    expectElementToHaveText,
    measureRenderTime,
    cleanupTestData,
    testAccessibility,
    testErrorBoundary,
};
