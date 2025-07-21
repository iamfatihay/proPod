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

// Cleanup after each test
afterEach(() => {
    jest.clearAllMocks();
    global.fetch.mockClear();
});
