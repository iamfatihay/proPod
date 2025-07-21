// Mock AsyncStorage implementation
let mockStorage = {};

const AsyncStorage = {
    setItem: jest.fn().mockImplementation((key, value) => {
        return new Promise((resolve) => {
            mockStorage[key] = value;
            resolve();
        });
    }),

    getItem: jest.fn().mockImplementation((key) => {
        return new Promise((resolve) => {
            const value = mockStorage[key] || null;
            resolve(value);
        });
    }),

    removeItem: jest.fn().mockImplementation((key) => {
        return new Promise((resolve) => {
            delete mockStorage[key];
            resolve();
        });
    }),

    clear: jest.fn().mockImplementation(() => {
        return new Promise((resolve) => {
            mockStorage = {};
            resolve();
        });
    }),

    getAllKeys: jest.fn().mockImplementation(() => {
        return new Promise((resolve) => {
            resolve(Object.keys(mockStorage));
        });
    }),

    multiGet: jest.fn().mockImplementation((keys) => {
        return new Promise((resolve) => {
            const result = keys.map((key) => [key, mockStorage[key] || null]);
            resolve(result);
        });
    }),

    multiSet: jest.fn().mockImplementation((keyValuePairs) => {
        return new Promise((resolve) => {
            keyValuePairs.forEach(([key, value]) => {
                mockStorage[key] = value;
            });
            resolve();
        });
    }),

    multiRemove: jest.fn().mockImplementation((keys) => {
        return new Promise((resolve) => {
            keys.forEach((key) => {
                delete mockStorage[key];
            });
            resolve();
        });
    }),

    // Test utilities
    __getMockStorage: () => mockStorage,
    __setMockStorage: (newStorage) => {
        mockStorage = { ...newStorage };
    },
    __clearMockStorage: () => {
        mockStorage = {};
    },
};

module.exports = AsyncStorage;
