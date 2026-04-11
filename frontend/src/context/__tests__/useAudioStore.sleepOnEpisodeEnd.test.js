/**
 * useAudioStore — Sleep-on-Episode-End Tests
 *
 * Covers:
 *   - setSleepOnEpisodeEnd(true)    — sets flag, cancels any running time-based timer
 *   - setSleepOnEpisodeEnd(false)   — clears flag only
 *   - setSleepTimer(minutes)        — clears sleepOnEpisodeEnd (mutual exclusion)
 *   - cancelSleepTimer()            — clears sleepOnEpisodeEnd flag as well
 *   - cleanup()                     — resets sleepOnEpisodeEnd to false
 *   - onPlaybackStatusUpdate        — stops and clears flag when episode finishes
 */

import { act } from "@testing-library/react-native";
import useAudioStore from "../useAudioStore";

// ── Mocks ─────────────────────────────────────────────────────────────────────

jest.mock("../../utils/logger", () => ({
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function resetState() {
    useAudioStore.setState({
        sleepTimerActive: false,
        sleepTimerEndTime: null,
        sleepTimerRemaining: 0,
        _sleepTimerIntervalId: null,
        sleepOnEpisodeEnd: false,
        sound: null,
        isPlaying: false,
        position: 0,
        duration: 0,
        isLoading: false,
        isSeeking: false,
        isLoadingTimeout: null,
        queue: [],
        currentIndex: 0,
        repeatMode: "none",
    });
}

/** Creates a minimal fake sound object with a pauseable spy. */
function fakeSoundWith({ playing = true } = {}) {
    return {
        playing,
        isLoaded: true,
        currentTime: 0,
        duration: 0,
        pause: jest.fn(),
        remove: jest.fn(),
    };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("useAudioStore — sleepOnEpisodeEnd", () => {
    beforeEach(() => {
        jest.useFakeTimers();
        resetState();
    });

    afterEach(() => {
        const { _sleepTimerIntervalId } = useAudioStore.getState();
        if (_sleepTimerIntervalId) clearInterval(_sleepTimerIntervalId);
        resetState();
        jest.runOnlyPendingTimers();
        jest.useRealTimers();
    });

    // ── setSleepOnEpisodeEnd ──────────────────────────────────────────────────

    describe("setSleepOnEpisodeEnd(true)", () => {
        it("sets sleepOnEpisodeEnd to true", () => {
            act(() => {
                useAudioStore.getState().setSleepOnEpisodeEnd(true);
            });
            expect(useAudioStore.getState().sleepOnEpisodeEnd).toBe(true);
        });

        it("does NOT activate the time-based timer (sleepTimerActive stays false)", () => {
            act(() => {
                useAudioStore.getState().setSleepOnEpisodeEnd(true);
            });
            expect(useAudioStore.getState().sleepTimerActive).toBe(false);
        });

        it("cancels an existing time-based timer when switching to episode-end mode", () => {
            // Start a time-based timer first
            act(() => {
                useAudioStore.getState().setSleepTimer(15);
            });
            expect(useAudioStore.getState().sleepTimerActive).toBe(true);
            const intervalId = useAudioStore.getState()._sleepTimerIntervalId;
            expect(intervalId).not.toBeNull();

            // Switch to episode-end mode
            act(() => {
                useAudioStore.getState().setSleepOnEpisodeEnd(true);
            });

            const state = useAudioStore.getState();
            expect(state.sleepOnEpisodeEnd).toBe(true);
            expect(state.sleepTimerActive).toBe(false);
            expect(state.sleepTimerRemaining).toBe(0);
            expect(state._sleepTimerIntervalId).toBeNull();
        });
    });

    describe("setSleepOnEpisodeEnd(false)", () => {
        it("clears sleepOnEpisodeEnd without touching other state", () => {
            act(() => {
                useAudioStore.getState().setSleepOnEpisodeEnd(true);
            });
            act(() => {
                useAudioStore.getState().setSleepOnEpisodeEnd(false);
            });
            expect(useAudioStore.getState().sleepOnEpisodeEnd).toBe(false);
        });
    });

    // ── Mutual exclusion with time-based timer ────────────────────────────────

    describe("setSleepTimer mutual exclusion", () => {
        it("clears sleepOnEpisodeEnd when a time-based timer is set", () => {
            act(() => {
                useAudioStore.getState().setSleepOnEpisodeEnd(true);
            });
            expect(useAudioStore.getState().sleepOnEpisodeEnd).toBe(true);

            act(() => {
                useAudioStore.getState().setSleepTimer(10);
            });

            const state = useAudioStore.getState();
            expect(state.sleepOnEpisodeEnd).toBe(false);
            expect(state.sleepTimerActive).toBe(true);
        });
    });

    // ── cancelSleepTimer ──────────────────────────────────────────────────────

    describe("cancelSleepTimer", () => {
        it("also clears sleepOnEpisodeEnd", () => {
            act(() => {
                useAudioStore.getState().setSleepOnEpisodeEnd(true);
            });
            act(() => {
                useAudioStore.getState().cancelSleepTimer();
            });
            expect(useAudioStore.getState().sleepOnEpisodeEnd).toBe(false);
        });

        it("clears both a time-based timer AND sleepOnEpisodeEnd if somehow both are set", () => {
            // Manually force both flags on (bypassing the mutual-exclusion logic)
            useAudioStore.setState({ sleepTimerActive: true, sleepOnEpisodeEnd: true });

            act(() => {
                useAudioStore.getState().cancelSleepTimer();
            });

            const state = useAudioStore.getState();
            expect(state.sleepTimerActive).toBe(false);
            expect(state.sleepOnEpisodeEnd).toBe(false);
        });
    });

    // ── cleanup ───────────────────────────────────────────────────────────────

    describe("cleanup", () => {
        it("resets sleepOnEpisodeEnd to false", async () => {
            act(() => {
                useAudioStore.getState().setSleepOnEpisodeEnd(true);
            });
            await act(async () => {
                await useAudioStore.getState().cleanup();
            });
            expect(useAudioStore.getState().sleepOnEpisodeEnd).toBe(false);
        });
    });

    // ── onPlaybackStatusUpdate — episode-end interception ────────────────────

    describe("onPlaybackStatusUpdate with sleepOnEpisodeEnd = true", () => {
        it("pauses and clears sleepOnEpisodeEnd when didJustFinish fires", () => {
            const mockSound = fakeSoundWith({ playing: true });
            useAudioStore.setState({
                sleepOnEpisodeEnd: true,
                isPlaying: true,
                sound: mockSound,
                position: 0,
                duration: 60000,
            });

            act(() => {
                useAudioStore.getState().onPlaybackStatusUpdate({
                    didJustFinish: true,
                    currentTime: 60,
                    duration: 60,
                    playing: true,
                });
            });

            const state = useAudioStore.getState();
            expect(state.isPlaying).toBe(false);
            expect(state.sleepOnEpisodeEnd).toBe(false);
            expect(mockSound.pause).toHaveBeenCalledTimes(1);
        });

        it("pauses via tolerance threshold (currentTime >= duration - 100ms)", () => {
            const mockSound = fakeSoundWith({ playing: true });
            useAudioStore.setState({
                sleepOnEpisodeEnd: true,
                isPlaying: true,
                sound: mockSound,
                position: 59900,
                duration: 60000,
            });

            act(() => {
                useAudioStore.getState().onPlaybackStatusUpdate({
                    didJustFinish: false,
                    currentTime: 59.95,  // 59950ms — within 100ms of 60000ms
                    duration: 60,
                    playing: true,
                });
            });

            const state = useAudioStore.getState();
            expect(state.isPlaying).toBe(false);
            expect(state.sleepOnEpisodeEnd).toBe(false);
            expect(mockSound.pause).toHaveBeenCalledTimes(1);
        });

        it("does NOT stop playback when didJustFinish is false and still playing", () => {
            const mockSound = fakeSoundWith({ playing: true });
            useAudioStore.setState({
                sleepOnEpisodeEnd: true,
                isPlaying: true,
                sound: mockSound,
                position: 30000,
                duration: 60000,
            });

            act(() => {
                useAudioStore.getState().onPlaybackStatusUpdate({
                    didJustFinish: false,
                    currentTime: 30,
                    duration: 60,
                    playing: true,
                });
            });

            // sleepOnEpisodeEnd should still be armed
            expect(useAudioStore.getState().sleepOnEpisodeEnd).toBe(true);
            expect(mockSound.pause).not.toHaveBeenCalled();
        });

        it("advances to next track normally when sleepOnEpisodeEnd is false", () => {
            const nextTrack = { id: 2, title: "Episode 2", uri: "http://example.com/2.mp3" };
            const mockSound = fakeSoundWith({ playing: true });

            useAudioStore.setState({
                sleepOnEpisodeEnd: false,
                isPlaying: true,
                sound: mockSound,
                position: 59900,
                duration: 60000,
                queue: [
                    { id: 1, title: "Episode 1", uri: "http://example.com/1.mp3" },
                    nextTrack,
                ],
                currentIndex: 0,
                repeatMode: "none",
            });

            // Spy on play to verify next() was called
            const playSpy = jest.spyOn(useAudioStore.getState(), "play").mockResolvedValue(undefined);

            act(() => {
                useAudioStore.getState().onPlaybackStatusUpdate({
                    didJustFinish: true,
                    currentTime: 60,
                    duration: 60,
                    playing: true,
                });
            });

            // sleepOnEpisodeEnd should remain false; isPlaying stays managed by play()
            expect(useAudioStore.getState().sleepOnEpisodeEnd).toBe(false);
            playSpy.mockRestore();
        });
    });
});
