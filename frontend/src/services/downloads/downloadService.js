/**
 * downloadService.js
 *
 * Manages offline episode downloads using expo-file-system.
 * Downloaded files are stored in the app's documentDirectory under `propod_downloads/`
 * and their metadata is persisted in AsyncStorage so the list survives app restarts.
 *
 * Public API:
 *   isDownloaded(podcastId)               → Promise<boolean>
 *   getLocalUri(podcastId)                → Promise<string|null>
 *   downloadEpisode(podcast, onProgress)  → Promise<{ localUri }>
 *   cancelDownload(podcastId)             → Promise<void>
 *   deleteDownload(podcastId)             → Promise<void>
 *   getDownloads()                        → Promise<Record<string, DownloadEntry>>
 */

import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Logger from '../../utils/logger';

const STORAGE_KEY = '@propod/downloads';
const DOWNLOADS_DIR = FileSystem.documentDirectory + 'propod_downloads/';

/** @type {Record<string, FileSystem.DownloadResumable>} */
const _activeDownloads = {};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function ensureDir() {
    const info = await FileSystem.getInfoAsync(DOWNLOADS_DIR);
    if (!info.exists) {
        await FileSystem.makeDirectoryAsync(DOWNLOADS_DIR, { intermediates: true });
    }
}

async function readStore() {
    try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch (err) {
        Logger.error('[downloads] Failed to read store:', err);
        return {};
    }
}

async function writeStore(data) {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

/** Pick a safe local filename for a podcast episode. */
function localFilename(podcastId, audioUrl) {
    const rawExt = (audioUrl || '').split('?')[0].split('.').pop()?.toLowerCase();
    const ext = ['mp3', 'm4a', 'aac', 'wav', 'ogg'].includes(rawExt) ? rawExt : 'mp3';
    return `podcast_${podcastId}.${ext}`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Return all stored download entries.
 */
async function getDownloads() {
    return readStore();
}

/**
 * True if a local file for this podcast exists on disk.
 */
async function isDownloaded(podcastId) {
    const store = await readStore();
    const entry = store[String(podcastId)];
    if (!entry?.localUri) return false;
    try {
        const info = await FileSystem.getInfoAsync(entry.localUri);
        return info.exists;
    } catch {
        return false;
    }
}

/**
 * Return the local file:// URI for a downloaded podcast, or null.
 */
async function getLocalUri(podcastId) {
    const store = await readStore();
    const entry = store[String(podcastId)];
    if (!entry?.localUri) return null;
    try {
        const info = await FileSystem.getInfoAsync(entry.localUri);
        return info.exists ? entry.localUri : null;
    } catch {
        return null;
    }
}

/**
 * Download a podcast episode to local storage.
 *
 * @param {{ id: number|string, audio_url: string, title?: string }} podcast
 * @param {(progress: number) => void} [onProgress]  progress 0 -> 1
 * @returns {Promise<{ localUri: string }>}
 */
async function downloadEpisode(podcast, onProgress) {
    const { id, audio_url, title } = podcast;
    if (!id || !audio_url) throw new Error('Missing podcast id or audio_url');
    if (_activeDownloads[String(id)]) throw new Error('Download already in progress');

    await ensureDir();
    const localUri = DOWNLOADS_DIR + localFilename(id, audio_url);

    const handleProgress = ({ totalBytesWritten, totalBytesExpectedToWrite }) => {
        if (onProgress && totalBytesExpectedToWrite > 0) {
            onProgress(Math.min(totalBytesWritten / totalBytesExpectedToWrite, 1));
        }
    };

    const download = FileSystem.createDownloadResumable(
        audio_url,
        localUri,
        {},
        handleProgress,
    );

    _activeDownloads[String(id)] = download;
    Logger.info('[downloads] Starting download for podcast ' + id);

    try {
        const result = await download.downloadAsync();
        if (!result?.uri) throw new Error('Download failed — no URI returned');

        // Persist metadata — if this fails, roll back the file so we
        // don't leave an orphaned file that the user can't manage via the app.
        try {
            const store = await readStore();
            store[String(id)] = {
                localUri: result.uri,
                title: title || ('Episode ' + id),
                downloadedAt: new Date().toISOString(),
            };
            await writeStore(store);
        } catch (storeErr) {
            Logger.error('[downloads] Metadata persist failed, rolling back file:', storeErr);
            await FileSystem.deleteAsync(result.uri, { idempotent: true }).catch(() => {});
            throw storeErr;
        }

        Logger.info('[downloads] Saved podcast ' + id + ' -> ' + result.uri);
        if (onProgress) onProgress(1);
        return { localUri: result.uri };
    } finally {
        delete _activeDownloads[String(id)];
    }
}

/**
 * Cancel an in-progress download.
 */
async function cancelDownload(podcastId) {
    const key = String(podcastId);
    const download = _activeDownloads[key];
    if (!download) return;
    try {
        await download.cancelAsync();
        Logger.info('[downloads] Cancelled download for podcast ' + podcastId);
    } catch (err) {
        Logger.error('[downloads] cancelAsync error:', err);
    } finally {
        delete _activeDownloads[key];
    }
}

/**
 * Delete a downloaded episode from disk and AsyncStorage.
 */
async function deleteDownload(podcastId) {
    const key = String(podcastId);

    // Cancel any active download first
    await cancelDownload(podcastId);

    const store = await readStore();
    const entry = store[key];
    if (entry?.localUri) {
        try {
            await FileSystem.deleteAsync(entry.localUri, { idempotent: true });
            Logger.info('[downloads] Deleted file: ' + entry.localUri);
        } catch (err) {
            Logger.error('[downloads] deleteAsync error:', err);
        }
    }
    delete store[key];
    await writeStore(store);
}

export default {
    getDownloads,
    isDownloaded,
    getLocalUri,
    downloadEpisode,
    cancelDownload,
    deleteDownload,
};
