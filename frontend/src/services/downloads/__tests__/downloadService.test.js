/**
 * downloadService.test.js
 *
 * Unit tests for the offline episode download service.
 * Uses the existing expo-file-system and AsyncStorage Jest mocks.
 */

import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import downloadService from '../downloadService';

// The downloads directory the service will build given the mock's documentDirectory
const DOWNLOADS_DIR = 'file:///test-documents/propod_downloads/';
const LOCAL_URI = DOWNLOADS_DIR + 'podcast_42.mp3';
const PODCAST = { id: 42, audio_url: 'https://cdn.example.com/episode.mp3', title: 'Test Episode' };

beforeEach(() => {
    jest.clearAllMocks();
    AsyncStorage.__clearMockStorage();

    // Default: directory already exists so ensureDir is a no-op
    FileSystem.getInfoAsync.mockResolvedValue({ exists: true, uri: LOCAL_URI });
    FileSystem.makeDirectoryAsync.mockResolvedValue(undefined);
    FileSystem.deleteAsync.mockResolvedValue(undefined);
});

// ─── helpers ────────────────────────────────────────────────────────────────

function mockDownloadSuccess(uri = LOCAL_URI) {
    FileSystem.createDownloadResumable.mockReturnValue({
        downloadAsync: jest.fn().mockResolvedValue({ uri }),
        cancelAsync: jest.fn().mockResolvedValue(undefined),
    });
}

function seedStorage(data) {
    AsyncStorage.__setMockStorage({
        '@propod/downloads': JSON.stringify(data),
    });
}

// ─── downloadEpisode ─────────────────────────────────────────────────────────

describe('downloadEpisode', () => {
    it('downloads file and persists metadata to AsyncStorage', async () => {
        mockDownloadSuccess(LOCAL_URI);

        const result = await downloadService.downloadEpisode(PODCAST);

        expect(result.localUri).toBe(LOCAL_URI);
        expect(FileSystem.createDownloadResumable).toHaveBeenCalledWith(
            PODCAST.audio_url,
            expect.stringContaining('podcast_42'),
            {},
            expect.any(Function),
        );

        const stored = JSON.parse(
            AsyncStorage.__getMockStorage()['@propod/downloads'] || '{}'
        );
        expect(stored['42']).toMatchObject({
            localUri: LOCAL_URI,
            title: 'Test Episode',
        });
        expect(stored['42'].downloadedAt).toBeTruthy();
    });

    it('calls onProgress callback with intermediate and final values', async () => {
        let capturedProgressCb;
        FileSystem.createDownloadResumable.mockImplementation((_url, _dest, _opts, cb) => {
            capturedProgressCb = cb;
            return {
                downloadAsync: jest.fn().mockImplementation(async () => {
                    capturedProgressCb({ totalBytesWritten: 500, totalBytesExpectedToWrite: 1000 });
                    return { uri: LOCAL_URI };
                }),
                cancelAsync: jest.fn(),
            };
        });

        const onProgress = jest.fn();
        await downloadService.downloadEpisode(PODCAST, onProgress);

        expect(onProgress).toHaveBeenCalledWith(0.5);
        expect(onProgress).toHaveBeenLastCalledWith(1);
    });

    it('rolls back downloaded file when metadata persistence fails', async () => {
        mockDownloadSuccess(LOCAL_URI);
        // First setItem call (the writeStore inside downloadEpisode) throws
        AsyncStorage.setItem.mockRejectedValueOnce(new Error('Storage full'));

        await expect(downloadService.downloadEpisode(PODCAST)).rejects.toThrow('Storage full');

        // Must clean up the already-written file
        expect(FileSystem.deleteAsync).toHaveBeenCalledWith(LOCAL_URI, { idempotent: true });
    });

    it('throws if podcast id or audio_url is missing', async () => {
        await expect(
            downloadService.downloadEpisode({ id: null, audio_url: '' })
        ).rejects.toThrow('Missing podcast id or audio_url');
    });
});

// ─── getLocalUri ─────────────────────────────────────────────────────────────

describe('getLocalUri', () => {
    it('returns the local URI when metadata exists and file is on disk', async () => {
        seedStorage({ '42': { localUri: LOCAL_URI, title: 'Test Episode' } });
        FileSystem.getInfoAsync.mockResolvedValue({ exists: true, uri: LOCAL_URI });

        const uri = await downloadService.getLocalUri(42);
        expect(uri).toBe(LOCAL_URI);
    });

    it('returns null when the podcast has no metadata entry', async () => {
        const uri = await downloadService.getLocalUri(99);
        expect(uri).toBeNull();
    });

    it('returns null when file no longer exists on disk (deleted externally)', async () => {
        seedStorage({ '42': { localUri: LOCAL_URI } });
        FileSystem.getInfoAsync.mockResolvedValue({ exists: false });

        const uri = await downloadService.getLocalUri(42);
        expect(uri).toBeNull();
    });
});

// ─── isDownloaded ────────────────────────────────────────────────────────────

describe('isDownloaded', () => {
    it('returns true when metadata exists and file is on disk', async () => {
        seedStorage({ '42': { localUri: LOCAL_URI } });
        FileSystem.getInfoAsync.mockResolvedValue({ exists: true });

        expect(await downloadService.isDownloaded(42)).toBe(true);
    });

    it('returns false when no metadata entry exists', async () => {
        expect(await downloadService.isDownloaded(42)).toBe(false);
    });

    it('returns false when file is missing from disk', async () => {
        seedStorage({ '42': { localUri: LOCAL_URI } });
        FileSystem.getInfoAsync.mockResolvedValue({ exists: false });

        expect(await downloadService.isDownloaded(42)).toBe(false);
    });
});

// ─── deleteDownload ───────────────────────────────────────────────────────────

describe('deleteDownload', () => {
    it('deletes local file and removes only that entry from AsyncStorage', async () => {
        seedStorage({
            '42': { localUri: LOCAL_URI, title: 'Test Episode' },
            '7':  { localUri: 'file:///other.mp3', title: 'Other' },
        });

        await downloadService.deleteDownload(42);

        expect(FileSystem.deleteAsync).toHaveBeenCalledWith(LOCAL_URI, { idempotent: true });

        const stored = JSON.parse(
            AsyncStorage.__getMockStorage()['@propod/downloads']
        );
        expect(stored['42']).toBeUndefined();
        expect(stored['7']).toBeDefined();
    });

    it('does not throw when there is no metadata entry for the podcast', async () => {
        await expect(downloadService.deleteDownload(999)).resolves.toBeUndefined();
        expect(FileSystem.deleteAsync).not.toHaveBeenCalled();
    });
});

// ─── cancelDownload ───────────────────────────────────────────────────────────

describe('cancelDownload', () => {
    it('is a no-op when no download is active for that id', async () => {
        await expect(downloadService.cancelDownload(42)).resolves.toBeUndefined();
    });
});
