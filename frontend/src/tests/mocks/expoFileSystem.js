// Mock for expo-file-system
const FileSystem = {
    // Directory constants
    documentDirectory: "file://test-documents/",
    cacheDirectory: "file://test-cache/",
    bundleDirectory: "file://test-bundle/",

    // File operations
    getInfoAsync: jest.fn().mockResolvedValue({
        exists: true,
        isDirectory: false,
        size: 1024,
        modificationTime: Date.now() / 1000,
        uri: "file://test-file.txt",
    }),

    readAsStringAsync: jest.fn().mockResolvedValue("test file content"),

    writeAsStringAsync: jest.fn().mockResolvedValue(),

    deleteAsync: jest.fn().mockResolvedValue(),

    moveAsync: jest.fn().mockResolvedValue(),

    copyAsync: jest.fn().mockResolvedValue(),

    makeDirectoryAsync: jest.fn().mockResolvedValue(),

    readDirectoryAsync: jest.fn().mockResolvedValue(["file1.txt", "file2.txt"]),

    downloadAsync: jest.fn().mockResolvedValue({
        uri: "file://downloaded-file.txt",
        status: 200,
        headers: {},
        mimeType: "text/plain",
    }),

    uploadAsync: jest.fn().mockResolvedValue({
        status: 200,
        headers: {},
        body: "upload response",
    }),

    createDownloadResumable: jest.fn().mockReturnValue({
        downloadAsync: jest.fn().mockResolvedValue({
            uri: "file://downloaded-file.txt",
            status: 200,
        }),
        pauseAsync: jest.fn().mockResolvedValue(),
        resumeAsync: jest.fn().mockResolvedValue(),
    }),

    // Encoding constants
    EncodingType: {
        UTF8: "utf8",
        Base64: "base64",
    },

    // Test utilities
    __setMockFileExists: (exists) => {
        FileSystem.getInfoAsync.mockResolvedValue({
            exists,
            isDirectory: false,
            size: exists ? 1024 : 0,
            modificationTime: Date.now() / 1000,
            uri: "file://test-file.txt",
        });
    },

    __setMockFileContent: (content) => {
        FileSystem.readAsStringAsync.mockResolvedValue(content);
    },
};

module.exports = FileSystem;
