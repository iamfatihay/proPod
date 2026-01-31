# Volo Podcast App - Test Documentation

## Overview

This document outlines the comprehensive testing strategy for the Volo Podcast App, following [React Native Testing best practices](https://reactnative.dev/docs/testing-overview) with a focus on reliability, maintainability, and coverage.

## Testing Pyramid Structure

```
┌─────────────────┐
│   E2E Tests     │  ← Critical user flows, slow but comprehensive
├─────────────────┤
│Integration Tests│  ← Component + API integration, moderate speed
├─────────────────┤
│  Unit Tests     │  ← Individual functions/components, fast & frequent
└─────────────────┘
```

## Testing Framework Stack

| Tool                             | Purpose                | Coverage       |
| -------------------------------- | ---------------------- | -------------- |
| **Jest**                         | Core testing framework | All test types |
| **React Native Testing Library** | Component testing      | UI components  |
| **Detox**                        | End-to-end testing     | Full app flows |
| **MSW**                          | API mocking            | HTTP requests  |

## Test Configuration

### Jest Configuration (`jest.config.js`)

```javascript
module.exports = {
    testEnvironment: "node",
    testMatch: [
        "<rootDir>/src/**/__tests__/**/*.{js,jsx}",
        "<rootDir>/src/**/*.(test|spec).{js,jsx}",
    ],
    setupFilesAfterEnv: ["<rootDir>/src/tests/setup.js"],
    collectCoverageFrom: [
        "src/**/*.{js,jsx}",
        "!src/**/*.test.{js,jsx}",
        "!src/**/__tests__/**/*.{js,jsx}",
        "!src/tests/**/*.js",
    ],
    testTimeout: 10000,
    verbose: true,
};
```

### Test Scripts

```json
{
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:ci": "jest --ci --coverage --watchAll=false"
}
```

## Test Structure & Organization

```
src/
├── components/
│   └── audio/
│       └── __tests__/
│           ├── AudioPlayer.test.js
│           ├── MiniPlayer.test.js
│           └── RecordingControls.test.js
├── services/
│   └── api/
│       └── __tests__/
│           └── apiService.test.js
├── context/
│   └── __tests__/
│       └── useAudioStore.test.js
└── tests/
    ├── setup.js
    ├── __tests__/
    │   └── basic.test.js
    └── mocks/
        ├── expoAv.js
        ├── asyncStorage.js
        ├── vectorIcons.js
        ├── expoFileSystem.js
        └── expoMediaLibrary.js
```

## Test Types & Implementation

### 1. Unit Tests ✅

**Status: COMPLETED**

#### API Service Tests (`src/services/api/__tests__/apiService.test.js`)

-   **Coverage:** 25+ API methods
-   **Focus:** Network requests, error handling, token management
-   **Key Test Cases:**
    -   Authentication flows (login, Google auth, logout)
    -   CRUD operations (podcasts, interactions, history)
    -   Error scenarios (401, network failures, validation)
    -   Token refresh mechanism

```javascript
// Example: API Error Handling Test
test("should handle 401 unauthorized and retry with refresh token", async () => {
    global.fetch
        .mockResolvedValueOnce({ ok: false, status: 401 })
        .mockResolvedValueOnce({
            ok: true,
            json: async () => ({ access_token: "new-token" }),
        })
        .mockResolvedValueOnce({
            ok: true,
            json: async () => ({ id: 1, title: "Test" }),
        });

    const result = await apiService.getPodcast(1);

    expect(global.fetch).toHaveBeenCalledTimes(3);
    expect(saveToken).toHaveBeenCalledWith("accessToken", "new-token");
});
```

#### Audio Component Tests (`src/components/audio/__tests__/`)

-   **Coverage:** AudioPlayer, MiniPlayer, RecordingControls
-   **Focus:** User interactions, audio state management, accessibility
-   **Key Test Cases:**
    -   Play/pause functionality
    -   Progress tracking and seeking
    -   Volume and playback rate controls
    -   Error states and loading indicators

```javascript
// Example: Audio Player Interaction Test
test("calls playPodcast when play button is pressed", async () => {
    const { getByTestId } = render(<AudioPlayer />);
    const playButton = getByTestId("play-pause-button");

    await act(async () => {
        fireEvent.press(playButton);
    });

    expect(mockAudioActions.playPodcast).toHaveBeenCalledWith(mockPodcast);
});
```

### 2. Integration Tests 🚧

**Status: IN PROGRESS**

Focus areas:

-   Audio Engine + API Integration
-   Recording + Upload Flow
-   Playback + History Tracking
-   User State + Authentication

### 3. Component Tests 📋

**Status: PLANNED**

Using React Native Testing Library:

-   User-centric testing approach
-   Accessibility validation
-   Cross-platform compatibility

### 4. End-to-End Tests 🎯

**Status: PLANNED**

Critical user flows:

-   User registration and login
-   Podcast recording and creation
-   Audio playback and interactions
-   Social features (likes, comments)

## Mock System

### Comprehensive Mocks

1. **Expo AV Mock** (`src/tests/mocks/expoAv.js`)

    - Audio recording and playback
    - Cross-platform audio session management
    - Permission handling

2. **AsyncStorage Mock** (`src/tests/mocks/asyncStorage.js`)

    - Token storage simulation
    - User preferences persistence

3. **Vector Icons Mock** (`src/tests/mocks/vectorIcons.js`)
    - Icon rendering for all families
    - Accessibility support

### Global Test Utilities

```javascript
// API Response Mocking
global.mockApiResponse(data, (status = 200));
global.mockApiError(error, (status = 500));

// Audio Mocking
global.mockAudioPlayback();
global.mockAudioRecording();
```

## Test Coverage Goals

| Category             | Target Coverage | Current Status |
| -------------------- | --------------- | -------------- |
| **API Service**      | 90%+            | ✅ Achieved    |
| **Audio Components** | 85%+            | ✅ Achieved    |
| **UI Components**    | 80%+            | 🚧 In Progress |
| **Utils/Helpers**    | 95%+            | 📋 Planned     |
| **Integration**      | 70%+            | 📋 Planned     |

## Running Tests

### Development Workflow

```bash
# Run all tests
npm run test

# Watch mode for development
npm run test:watch

# Coverage report
npm run test:coverage

# CI mode (non-interactive)
npm run test:ci
```

### Debugging Tests

```bash
# Run specific test file
npm run test -- src/services/api/__tests__/apiService.test.js

# Run tests matching pattern
npm run test -- --testNamePattern="should handle errors"

# Debug mode with detailed output
npm run test -- --verbose --no-coverage
```

## Testing Best Practices

### 1. Test Structure (AAA Pattern)

```javascript
test('should do something when condition is met', () => {
  // Arrange
  const mockData = { id: 1, title: 'Test' };
  global.mockApiResponse(mockData);

  // Act
  const result = await apiService.getPodcast(1);

  // Assert
  expect(result).toEqual(mockData);
});
```

### 2. Mock Management

-   Use specific mocks for each test scenario
-   Clear mocks between tests automatically
-   Provide realistic mock data

### 3. Error Testing

-   Test both success and failure scenarios
-   Validate error messages and codes
-   Ensure graceful degradation

### 4. Accessibility Testing

```javascript
test("has proper accessibility labels", () => {
    const { getByTestId } = render(<AudioPlayer />);
    const playButton = getByTestId("play-pause-button");

    expect(playButton.props.accessibilityLabel).toBe("Play podcast");
});
```

## Continuous Integration

### GitHub Actions Integration

```yaml
name: Test Suite
on: [push, pull_request]
jobs:
    test:
        runs-on: ubuntu-latest
        steps:
            - uses: actions/checkout@v2
            - uses: actions/setup-node@v2
            - run: npm install
            - run: npm run test:ci
            - uses: codecov/codecov-action@v1
```

## Performance Testing

### Audio Performance Tests

-   Recording latency measurements
-   Playback quality validation
-   Memory usage monitoring
-   Battery impact assessment

### API Performance Tests

-   Response time validation
-   Concurrent request handling
-   Network error resilience

## Future Enhancements

### Planned Test Additions

1. **Visual Regression Testing**

    - Component screenshot comparisons
    - Cross-platform UI consistency

2. **Accessibility Testing**

    - Screen reader compatibility
    - Keyboard navigation
    - Color contrast validation

3. **Load Testing**

    - API endpoint stress testing
    - Audio streaming performance

4. **Security Testing**
    - Token security validation
    - API vulnerability scanning

## Troubleshooting Common Issues

### Jest Module Resolution

If you encounter module resolution errors:

```javascript
// Add to jest.config.js
moduleNameMapper: {
  '^@/(.*)$': '<rootDir>/src/$1',
  '^expo-av$': '<rootDir>/src/tests/mocks/expoAv.js'
}
```

### React Native Testing Library Issues

```javascript
// Ensure proper test environment
testEnvironment: "node";

// Mock React Native components
jest.mock("react-native", () => ({
    // ... mock implementations
}));
```

### Audio Testing Challenges

-   Use comprehensive mocks for Expo AV
-   Test state changes rather than audio playback
-   Focus on user interactions and UI updates

---

This testing strategy ensures comprehensive coverage of the Volo Podcast App while maintaining development velocity and code quality. The modular approach allows for incremental testing implementation and easy maintenance.

## Test Results Summary

✅ **COMPLETED FEATURES:**

-   Jest configuration and setup
-   Basic unit test infrastructure
-   API service comprehensive testing
-   Audio component test framework
-   Mock system for external dependencies

🚧 **NEXT PRIORITIES:**

1. Integration test implementation
2. Component test expansion
3. E2E test setup with Detox
4. CI/CD pipeline integration

For questions or contributions to the test suite, please refer to the development team.
