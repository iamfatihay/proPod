/**
 * Unit tests for useAudioStore next() action.
 *
 * Covers:
 *  1. repeat=one  — short-circuits, replays currentTrack
 *  2. repeat=all  — loops back to queue[0] at end of queue (including single-item queue)
 *  3. Fallback fetch — fetches from API and appends when queue is exhausted
 *  4. Error path   — logs warning and does not throw when API fails
 */

import { act } from "react-test-renderer";
import useAudioStore from "../useAudioStore";

// ── helpers ──────────────────────────────────────────────────────────────────

/** Reset Zustand store to a known blank state before each test. */
function resetStore() {
    useAudioStore.setState({
        queue: [],
        currentIndex: -1,
        currentTrack: null,
        repeatMode: "off",
        isPlaying: false,
    });
}

const TRACK_A = { id: 1, uri: "https://cdn.example.com/a.mp3", title: "Track A", artist: "Artist", ownerId: 10, duration: 60000, artwork: null };
const TRACK_B = { id: 2, uri: "https://cdn.example.com/b.mp3", title: "Track B", artist: "Artist", ownerId: 10, duration: 60000, artwork: null };

// ── mocks ────────────────────────────────────────────────────────────────────

// Mock play so we avoid real Audio/AV dependencies
const mockPlay = jest.fn().mockResolvedValue(undefined);

// Mock apiService used inside next() fallback
jest.mock("../../services/api/apiService", () => ({
    getPodcasts: jest.fn(),
}));
import apiService from "../../services/api/apiService";

beforeEach(() => {
    jest.clearAllMocks();
    resetStore();
    // Patch play on the store so it's a no-op
    useAudioStore.setState({ play: mockPlay });
});

// ── 1. repeat=one ────────────────────────────────────────────────────────────

describe("next() with repeatMode=one", () => {
    it("replays currentTrack without advancing the queue index", async () => {
        useAudioStore.setState({
            queue: [TRACK_A, TRACK_B],
            currentIndex: 0,
            currentTrack: TRACK_A,
            repeatMode: "one",
        });

        await act(async () => {
            await useAudioStore.getState().next();
        });

        expect(mockPlay).toHaveBeenCalledTimes(1);
        expect(mockPlay).toHaveBeenCalledWith(TRACK_A);
        // Index must not change
        expect(useAudioStore.getState().currentIndex).toBe(0);
    });
});

// ── 2. repeat=all ────────────────────────────────────────────────────────────

describe("next() with repeatMode=all", () => {
    it("loops back to queue[0] from the last item in a multi-item queue", async () => {
        useAudioStore.setState({
            queue: [TRACK_A, TRACK_B],
            currentIndex: 1,     // at end
            currentTrack: TRACK_B,
            repeatMode: "all",
        });

        await act(async () => {
            await useAudioStore.getState().next();
        });

        expect(useAudioStore.getState().currentIndex).toBe(0);
        expect(mockPlay).toHaveBeenCalledWith(TRACK_A);
    });

    it("loops a single-item queue back to itself (queue.length >= 1 fix)", async () => {
        useAudioStore.setState({
            queue: [TRACK_A],
            currentIndex: 0,
            currentTrack: TRACK_A,
            repeatMode: "all",
        });

        await act(async () => {
            await useAudioStore.getState().next();
        });

        // Must loop, NOT fall through to network fetch
        expect(apiService.getPodcasts).not.toHaveBeenCalled();
        expect(useAudioStore.getState().currentIndex).toBe(0);
        expect(mockPlay).toHaveBeenCalledWith(TRACK_A);
    });
});

// ── 3. Fallback fetch ─────────────────────────────────────────────────────────

describe("next() fallback fetch when queue is exhausted", () => {
    it("fetches from API, appends to queue, and plays the new track", async () => {
        const FETCHED = {
            id: 99,
            audio_url: "https://cdn.example.com/fetched.mp3",
            title: "Fetched Track",
            owner: { id: 10, name: "Artist" },
            duration: 30,
            thumbnail_url: null,
            category: "Technology",
            description: "Fetched description",
        };
        apiService.getPodcasts.mockResolvedValueOnce([FETCHED]);

        useAudioStore.setState({
            queue: [TRACK_A],
            currentIndex: 0,        // already at end, repeat=off
            currentTrack: TRACK_A,
            repeatMode: "off",
        });

        await act(async () => {
            await useAudioStore.getState().next();
        });

        expect(apiService.getPodcasts).toHaveBeenCalled();
        const { queue, currentIndex } = useAudioStore.getState();
        expect(queue).toHaveLength(2);
        expect(queue[1]).toMatchObject({
            id: 99,
            ownerId: 10,
            duration: 30000,
            category: "Technology",
            description: "Fetched description",
        });
        expect(currentIndex).toBe(1);
        expect(mockPlay).toHaveBeenCalledWith(
            expect.objectContaining({
                id: 99,
                ownerId: 10,
                duration: 30000,
                category: "Technology",
                description: "Fetched description",
            })
        );
    });

    it("falls back to generic getPodcasts when creator lookup yields nothing", async () => {
        const GENERIC = {
            id: 55,
            audio_url: "https://cdn.example.com/generic.mp3",
            title: "Generic",
            owner: { id: 99, name: "Someone" },
            duration: 45,
            thumbnail_url: null,
        };
        // First call (creator) returns empty, second call (generic) returns result
        apiService.getPodcasts
            .mockResolvedValueOnce([])   // creator lookup → empty
            .mockResolvedValueOnce([GENERIC]); // generic recent → one result

        useAudioStore.setState({
            queue: [TRACK_A],
            currentIndex: 0,
            currentTrack: TRACK_A,
            repeatMode: "off",
        });

        await act(async () => {
            await useAudioStore.getState().next();
        });

        expect(apiService.getPodcasts).toHaveBeenCalledTimes(2);
        expect(mockPlay).toHaveBeenCalledWith(expect.objectContaining({ id: 55 }));
    });
});

// ── 4. Error path ─────────────────────────────────────────────────────────────

describe("next() error path", () => {
    it("does not throw and does not call play when API rejects", async () => {
        apiService.getPodcasts.mockRejectedValue(new Error("network error"));

        useAudioStore.setState({
            queue: [TRACK_A],
            currentIndex: 0,
            currentTrack: TRACK_A,
            repeatMode: "off",
        });

        await expect(
            act(async () => {
                await useAudioStore.getState().next();
            })
        ).resolves.not.toThrow();

        // No new track should have been played
        expect(mockPlay).not.toHaveBeenCalled();
    });
});
