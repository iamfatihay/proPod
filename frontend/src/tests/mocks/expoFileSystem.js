// Mock for expo-file-system
const FileSystem = {
    documentDirectory: "file:///test-documents/",
    cacheDirectory: "file:///test-cache/",
    bundleDirectory: "file:///test-bundle/",

    // File operations
    readAsStringAsync: jest.fn().mockResolvedValue("test content"),
    writeAsStringAsync: jest.fn().mockResolvedValue(undefined),
    deleteAsync: jest.fn().mockResolvedValue(undefined),
    moveAsync: jest.fn().mockResolvedValue(undefined),
    copyAsync: jest.fn().mockResolvedValue(undefined),

    // Directory operations
    makeDirectoryAsync: jest.fn().mockResolvedValue(undefined),
    readDirectoryAsync: jest.fn().mockResolvedValue(["file1.txt", "file2.txt"]),
    deleteAsync: jest.fn().mockResolvedValue(undefined),

    // File info
    getInfoAsync: jest.fn().mockResolvedValue({
        exists: true,
        uri: "file:///test-file.txt",
        size: 1024,
        isDirectory: false,
        modificationTime: Date.now(),
    }),

    // Upload/Download
    createDownloadResumable: jest.fn().mockReturnValue({
        downloadAsync: jest.fn().mockResolvedValue({
            uri: "file:///downloaded-file.txt",
            status: 200,
            headers: {},
        }),
        resumeAsync: jest.fn().mockResolvedValue({
            uri: "file:///resumed-file.txt",
            status: 200,
            headers: {},
        }),
    }),

    // Constants
    UploadType: {
        MULTIPART: "multipart",
        BINARY_CONTENT: "binary",
    },

    DownloadResumable: jest.fn(),
};

export default FileSystem;
export { FileSystem };
