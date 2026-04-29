/**
 * Unit tests for useAudioStore activePlaylistId state slice.
 *
 * Covers:
 *  1. setQueue with sourcePlaylistId — sets activePlaylistId
 *  2. setQueue without sourcePlaylistId — clears activePlaylistId (null default)
 *  3. setQueue called twice — overwrites with new playlist id
 *  4. stop() — clears activePlaylistId
 *  5. cleanup() — clears activePlaylistId
 */

import useAudioStore from "../useAudioStore";

// ── helpers ───────────────────────────────────────────────────────────────────

function resetStore() {
    useAudioStore.setState({
        queue: [],
        currentIndex: 0,
        currentTrack: null,
        isPlaying: false,
        sound: null,
        showMiniPlayer: false,
        activePlaylistId: null,
    });
}

const TRACK_A = { id: 1, uri: "https://cdn.example.com/a.mp3", title: "Track A", artist: "Artist", duration: 60000, artwork: null };
const TRACK_B = { id: 2, uri: "https://cdn.example.com/b.mp3", title: "Track B", artist: "Artist", duration: 60000, artwork: null };

beforeEach(() => {
    resetStore();
});

// ── 1. setQueue with sourcePlaylistId ─────────────────────────────────────────

describe("setQueue(tracks, startIndex, sourcePlaylistId)", () => {
    it("sets activePlaylistId to the provided playlist id", () => {
        useAudioStore.getState().setQueue([TRACK_A, TRACK_B], 0, 42);

        const state = useAudioStore.getState();
        expect(state.activePlaylistId).toBe(42);
        expect(state.currentTrack).toEqual(TRACK_A);
        expect(state.queue).toHaveLength(2);
    });

    it("also accepts a string playlist id", () => {
        useAudioStore.getState().setQueue([TRACK_A], 0, "playlist-99");
        expect(useAudioStore.getState().activePlaylistId).toBe("playlist-99");
    });

    // ── 2. setQueue without sourcePlaylistId clears it ────────────────────────

    it("defaults sourcePlaylistId to null — clears a previously set value", () => {
        // Pre-set a playlist context
        useAudioStore.getState().setQueue([TRACK_A], 0, 7);
        expect(useAudioStore.getState().activePlaylistId).toBe(7);

        // Call without third arg (simulates a non-playlist play source)
        useAudioStore.getState().setQueue([TRACK_B], 0);
        expect(useAudioStore.getState().activePlaylistId).toBeNull();
    });

    it("explicitly passing null clears the playlist context", () => {
        useAudioStore.getState().setQueue([TRACK_A], 0, 5);
        useAudioStore.getState().setQueue([TRACK_B], 0, null);
        expect(useAudioStore.getState().activePlaylistId).toBeNull();
    });

    // ── 3. setQueue called twice overwrites ───────────────────────────────────

    it("overwrites activePlaylistId when called with a different playlist", () => {
        useAudioStore.getState().setQueue([TRACK_A], 0, 1);
        useAudioStore.getState().setQueue([TRACK_B], 0, 2);
        expect(useAudioStore.getState().activePlaylistId).toBe(2);
    });
});

// ── 4. stop() clears activePlaylistId ────────────────────────────────────────

describe("stop()", () => {
    it("sets activePlaylistId to null", async () => {
        useAudioStore.getState().setQueue([TRACK_A], 0, 10);
        expect(useAudioStore.getState().activePlaylistId).toBe(10);

        await useAudioStore.getState().stop();

        expect(useAudioStore.getState().activePlaylistId).toBeNull();
    });

    it("also sets isPlaying to false and showMiniPlayer to false", async () => {
        useAudioStore.setState({ isPlaying: true, showMiniPlayer: true, activePlaylistId: 3 });

        await useAudioStore.getState().stop();

        const state = useAudioStore.getState();
        expect(state.isPlaying).toBe(false);
        expect(state.showMiniPlayer).toBe(false);
        expect(state.activePlaylistId).toBeNull();
    });
});

// ── 5. cleanup() clears activePlaylistId ─────────────────────────────────────

describe("cleanup()", () => {
    it("sets activePlaylistId to null", async () => {
        useAudioStore.getState().setQueue([TRACK_A], 0, 99);
        expect(useAudioStore.getState().activePlaylistId).toBe(99);

        await useAudioStore.getState().cleanup();

        expect(useAudioStore.getState().activePlaylistId).toBeNull();
    });
});
