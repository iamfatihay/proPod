// Mock for expo-media-library
const MediaLibrary = {
    // Permissions
    requestPermissionsAsync: jest.fn().mockResolvedValue({
        status: "granted",
        granted: true,
        canAskAgain: true,
        expires: "never",
    }),

    getPermissionsAsync: jest.fn().mockResolvedValue({
        status: "granted",
        granted: true,
        canAskAgain: true,
        expires: "never",
    }),

    // Asset operations
    getAssetsAsync: jest.fn().mockResolvedValue({
        assets: [
            {
                id: "test-asset-1",
                filename: "test-audio.mp3",
                uri: "file://test-audio.mp3",
                mediaType: "audio",
                duration: 60000,
                creationTime: Date.now(),
                modificationTime: Date.now(),
            },
        ],
        endCursor: "cursor-1",
        hasNextPage: false,
        totalCount: 1,
    }),

    getAssetInfoAsync: jest.fn().mockResolvedValue({
        id: "test-asset-1",
        filename: "test-audio.mp3",
        uri: "file://test-audio.mp3",
        mediaType: "audio",
        duration: 60000,
        localUri: "file://local-test-audio.mp3",
        location: {
            latitude: 37.7749,
            longitude: -122.4194,
        },
        exif: {},
        creationTime: Date.now(),
        modificationTime: Date.now(),
    }),

    createAssetAsync: jest.fn().mockResolvedValue({
        id: "new-asset-1",
        filename: "new-audio.mp3",
        uri: "file://new-audio.mp3",
        mediaType: "audio",
        duration: 30000,
        creationTime: Date.now(),
        modificationTime: Date.now(),
    }),

    deleteAssetsAsync: jest.fn().mockResolvedValue(true),

    // Album operations
    getAlbumsAsync: jest.fn().mockResolvedValue([
        {
            id: "test-album-1",
            title: "Test Album",
            assetCount: 5,
            type: "album",
        },
    ]),

    getAlbumAsync: jest.fn().mockResolvedValue({
        id: "test-album-1",
        title: "Test Album",
        assetCount: 5,
        type: "album",
    }),

    createAlbumAsync: jest.fn().mockResolvedValue({
        id: "new-album-1",
        title: "New Album",
        assetCount: 0,
        type: "album",
    }),

    addAssetsToAlbumAsync: jest.fn().mockResolvedValue(true),
    removeAssetsFromAlbumAsync: jest.fn().mockResolvedValue(true),
    deleteAlbumsAsync: jest.fn().mockResolvedValue(true),

    // Constants
    MediaType: {
        audio: "audio",
        photo: "photo",
        video: "video",
        unknown: "unknown",
    },

    SortBy: {
        default: "default",
        creationTime: "creationTime",
        modificationTime: "modificationTime",
        mediaType: "mediaType",
        width: "width",
        height: "height",
        duration: "duration",
    },

    // Test utilities
    __setMockAssets: (assets) => {
        MediaLibrary.getAssetsAsync.mockResolvedValue({
            assets,
            endCursor: "cursor-1",
            hasNextPage: false,
            totalCount: assets.length,
        });
    },

    __setMockPermissionStatus: (status) => {
        const permissionResult = {
            status,
            granted: status === "granted",
            canAskAgain: status !== "denied",
            expires: "never",
        };

        MediaLibrary.getPermissionsAsync.mockResolvedValue(permissionResult);
        MediaLibrary.requestPermissionsAsync.mockResolvedValue(
            permissionResult
        );
    },
};

// Named exports for ES6 imports
export const requestPermissionsAsync = MediaLibrary.requestPermissionsAsync;
export const getPermissionsAsync = MediaLibrary.getPermissionsAsync;
export const getAssetsAsync = MediaLibrary.getAssetsAsync;
export const getAssetInfoAsync = MediaLibrary.getAssetInfoAsync;
export const createAssetAsync = MediaLibrary.createAssetAsync;
export const deleteAssetsAsync = MediaLibrary.deleteAssetsAsync;
export const getAlbumsAsync = MediaLibrary.getAlbumsAsync;
export const createAlbumAsync = MediaLibrary.createAlbumAsync;
export const MediaType = MediaLibrary.MediaType;
export const SortBy = MediaLibrary.SortBy;
export const PermissionStatus = MediaLibrary.PermissionStatus;

export default MediaLibrary;

// CommonJS compatibility for Jest environments that might not fully support ESM
module.exports = MediaLibrary;
module.exports.default = MediaLibrary;
module.exports.requestPermissionsAsync = MediaLibrary.requestPermissionsAsync;
module.exports.getPermissionsAsync = MediaLibrary.getPermissionsAsync;
module.exports.getAssetsAsync = MediaLibrary.getAssetsAsync;
module.exports.getAssetInfoAsync = MediaLibrary.getAssetInfoAsync;
module.exports.createAssetAsync = MediaLibrary.createAssetAsync;
module.exports.deleteAssetsAsync = MediaLibrary.deleteAssetsAsync;
module.exports.getAlbumsAsync = MediaLibrary.getAlbumsAsync;
module.exports.createAlbumAsync = MediaLibrary.createAlbumAsync;
module.exports.MediaType = MediaLibrary.MediaType;
module.exports.SortBy = MediaLibrary.SortBy;
module.exports.PermissionStatus = MediaLibrary.PermissionStatus;
