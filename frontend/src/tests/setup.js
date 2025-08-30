// Minimal test setup for Jest

// Mock fetch API
global.fetch = jest.fn();

// Global test utilities
global.mockApiResponse = (data, status = 200) => {
    global.fetch.mockResolvedValueOnce({
        ok: status >= 200 && status < 300,
        status,
        json: async () => data,
        text: async () => JSON.stringify(data),
    });
};

global.mockApiError = (error, status = 500) => {
    global.fetch.mockRejectedValueOnce({
        status,
        message: error,
        detail: error,
    });
};

// Audio recording mock
global.mockAudioRecording = () => ({
    startAsync: jest.fn().mockResolvedValue(undefined),
    stopAndUnloadAsync: jest.fn().mockResolvedValue({
        uri: "file://test-recording.m4a",
        durationMillis: 5000,
    }),
    pauseAsync: jest.fn().mockResolvedValue(undefined),
    resumeAsync: jest.fn().mockResolvedValue(undefined),
    getStatusAsync: jest.fn().mockResolvedValue({
        isRecording: true,
        durationMillis: 5000,
    }),
});

// Cleanup after each test
afterEach(() => {
    jest.clearAllMocks();
    global.fetch.mockClear();
});
