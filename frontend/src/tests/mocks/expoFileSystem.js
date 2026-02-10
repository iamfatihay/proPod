// Mock for expo-file-system

// Directory constants
export const documentDirectory = "file:///test-documents/";
export const cacheDirectory = "file:///test-cache/";
export const bundleDirectory = "file:///test-bundle/";

// File operations
export const readAsStringAsync = jest.fn().mockResolvedValue("test content");
export const writeAsStringAsync = jest.fn().mockResolvedValue(undefined);
export const deleteAsync = jest.fn().mockResolvedValue(undefined);
export const moveAsync = jest.fn().mockResolvedValue(undefined);
export const copyAsync = jest.fn().mockResolvedValue(undefined);

// Directory operations
export const makeDirectoryAsync = jest.fn().mockResolvedValue(undefined);
export const readDirectoryAsync = jest.fn().mockResolvedValue(["file1.txt", "file2.txt"]);

// File info
export const getInfoAsync = jest.fn().mockResolvedValue({
    exists: true,
    uri: "file:///test-file.txt",
    size: 1024,
    isDirectory: false,
    modificationTime: Date.now(),
});

// Upload/Download
export const createDownloadResumable = jest.fn().mockReturnValue({
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
});

// Constants
export const UploadType = {
    MULTIPART: "multipart",
    BINARY_CONTENT: "binary",
};

export const DownloadResumable = jest.fn();

// Default export for compatibility
const FileSystem = {
    documentDirectory,
    cacheDirectory,
    bundleDirectory,
    readAsStringAsync,
    writeAsStringAsync,
    deleteAsync,
    moveAsync,
    copyAsync,
    makeDirectoryAsync,
    readDirectoryAsync,
    getInfoAsync,
    createDownloadResumable,
    UploadType,
    DownloadResumable,
};

export default FileSystem;
