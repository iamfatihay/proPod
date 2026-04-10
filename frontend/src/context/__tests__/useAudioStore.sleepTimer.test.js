/**
 * useAudioStore — Sleep Timer Tests
 *
 * Covers:
 *   - setSleepTimer(minutes)      — sets state, starts countdown interval
 *   - setSleepTimer(0 / null)     — treated as cancellation
 *   - cancelSleepTimer()          — clears interval + resets state
 *   - Timer expiry                — pauses audio, clears state when countdown hits zero
 *   - Replacing an active timer   — old interval is cancelled before new one starts
 *   - cleanup()                   — cancels any running sleep timer
 */

import { act } from "@testing-library/react-native";
import useAudioStore from "../useAudioStore";

// ── Mocks ─────────────────────────────────────────────────────────────────────

// expo-audio is mapped to a mock via jest.config.js moduleNameMapper
// Logger is silent in tests
jest.mock("../../utils/logger", () => ({
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Reset only the sleep-timer slice of the store between tests. */
function resetSleepTimerState() {
    useAudioStore.setState({
        sleepTimerActive: false,
        sleepTimerEndTime: null,
        sleepTimerRemaining: 0,
        _sleepTimerIntervalId: null,
        // Ensure sound is null so pause() calls don't blow up
        sound: null,
        isPlaying: false,
    });
}

// ─────────────────────────────────────────────────────────────────────────────

describe("useAudioStore — Sleep Timer", () => {
    beforeEach(() => {
        jest.useFakeTimers();
        resetSleepTimerState();
    });

    afterEach(() => {
        // Cancel any live interval so it doesn't bleed into the next test
        const { _sleepTimerIntervalId } = useAudioStore.getState();
        if (_sleepTimerIntervalId) clearInterval(_sleepTimerIntervalId);
        resetSleepTimerState();
        jest.runOnlyPendingTimers();
        jest.useRealTimers();
    });

    // ── setSleepTimer ─────────────────────────────────────────────────────────

    describe("setSleepTimer(minutes)", () => {
        it("sets sleepTimerActive to true and stores a positive remaining value", () => {
            act(() => {
                useAudioStore.getState().setSleepTimer(30);
            });

            const state = useAudioStore.getState();
            expect(state.sleepTimerActive).toBe(true);
            expect(state.sleepTimerRemaining).toBe(30 * 60 * 1000);
        });

        it("stores an endTime approximately 30 minutes from now", () => {
            const before = Date.now();
            act(() => {
                useAudioStore.getState().setSleepTimer(30);
            });
            const after = Date.now();

            const { sleepTimerEndTime } = useAudioStore.getState();
            expect(sleepTimerEndTime).toBeGreaterThanOrEqual(before + 30 * 60 * 1000);
            expect(sleepTimerEndTime).toBeLessThanOrEqual(after + 30 * 60 * 1000);
        });

        it("registers a non-null interval ID", () => {
            act(() => {
                useAudioStore.getState().setSleepTimer(15);
            });
            expect(useAudioStore.getState()._sleepTimerIntervalId).not.toBeNull();
        });

        it("decrements sleepTimerRemaining by ~1000 ms each second", () => {
            act(() => {
                useAudioStore.getState().setSleepTimer(5);
            });

            const initial = useAudioStore.getState().sleepTimerRemaining;

            act(() => {
                jest.advanceTimersByTime(3000); // tick 3 seconds
            });

            const after = useAudioStore.getState().sleepTimerRemaining;
            // remaining should have dropped by ~3 s (allow ±100 ms tolerance)
            expect(initial - after).toBeGreaterThanOrEqual(2900);
            expect(initial - after).toBeLessThanOrEqual(3100);
        });

        it("accepts a 1-minute timer (minimum useful preset)", () => {
            act(() => {
                useAudioStore.getState().setSleepTimer(1);
            });
            const { sleepTimerActive, sleepTimerRemaining } = useAudioStore.getState();
            expect(sleepTimerActive).toBe(true);
            expect(sleepTimerRemaining).toBeGreaterThan(0);
        });

        it("accepts a 60-minute timer (maximum preset)", () => {
            act(() => {
                useAudioStore.getState().setSleepTimer(60);
            });
            expect(useAudioStore.getState().sleepTimerActive).toBe(true);
            expect(useAudioStore.getState().sleepTimerRemaining).toBe(60 * 60 * 1000);
        });

        // ── Zero / falsy values ───────────────────────────────────────────────

        it("calling setSleepTimer(0) cancels the timer (deactivates)", () => {
            act(() => {
                useAudioStore.getState().setSleepTimer(10); // start one first
            });
            act(() => {
                useAudioStore.getState().setSleepTimer(0);  // cancel via zero
            });

            const state = useAudioStore.getState();
            expect(state.sleepTimerActive).toBe(false);
            expect(state.sleepTimerRemaining).toBe(0);
            expect(state.sleepTimerEndTime).toBeNull();
            expect(state._sleepTimerIntervalId).toBeNull();
        });

        it("calling setSleepTimer(null) cancels the timer", () => {
            act(() => {
                useAudioStore.getState().setSleepTimer(10);
            });
            act(() => {
                useAudioStore.getState().setSleepTimer(null);
            });

            expect(useAudioStore.getState().sleepTimerActive).toBe(false);
        });

        // ── Replace active timer ──────────────────────────────────────────────

        it("replaces an active timer — old interval is cleared, new state reflects new duration", () => {
            act(() => {
                useAudioStore.getState().setSleepTimer(30);
            });
            const firstId = useAudioStore.getState()._sleepTimerIntervalId;

            act(() => {
                useAudioStore.getState().setSleepTimer(5); // replace with 5 min
            });

            const state = useAudioStore.getState();
            // New interval must differ from the old one (old was cleared)
            expect(state._sleepTimerIntervalId).not.toBeNull();
            expect(state._sleepTimerIntervalId).not.toBe(firstId);
            // Remaining should now reflect 5 minutes, not 30
            expect(state.sleepTimerRemaining).toBe(5 * 60 * 1000);
        });
    });

    // ── cancelSleepTimer ──────────────────────────────────────────────────────

    describe("cancelSleepTimer()", () => {
        it("sets sleepTimerActive to false", () => {
            act(() => {
                useAudioStore.getState().setSleepTimer(20);
            });
            act(() => {
                useAudioStore.getState().cancelSleepTimer();
            });

            expect(useAudioStore.getState().sleepTimerActive).toBe(false);
        });

        it("resets remaining, endTime, and intervalId to initial values", () => {
            act(() => {
                useAudioStore.getState().setSleepTimer(20);
            });
            act(() => {
                useAudioStore.getState().cancelSleepTimer();
            });

            const state = useAudioStore.getState();
            expect(state.sleepTimerRemaining).toBe(0);
            expect(state.sleepTimerEndTime).toBeNull();
            expect(state._sleepTimerIntervalId).toBeNull();
        });

        it("is safe to call when no timer is active (no throw)", () => {
            expect(() => {
                act(() => {
                    useAudioStore.getState().cancelSleepTimer();
                });
            }).not.toThrow();
        });

        it("stops the countdown — remaining does not change after cancel", () => {
            act(() => {
                useAudioStore.getState().setSleepTimer(10);
            });
            act(() => {
                useAudioStore.getState().cancelSleepTimer();
            });

            const remainingAfterCancel = useAudioStore.getState().sleepTimerRemaining;

            // Advance time — remaining should stay at 0 (timer was cancelled)
            act(() => {
                jest.advanceTimersByTime(5000);
            });

            expect(useAudioStore.getState().sleepTimerRemaining).toBe(remainingAfterCancel);
        });
    });

    // ── Timer expiry ──────────────────────────────────────────────────────────

    describe("Timer expiry (auto-pause)", () => {
        it("deactivates the timer and clears state when countdown reaches zero", () => {
            act(() => {
                useAudioStore.getState().setSleepTimer(1); // 1 minute
            });

            // Fast-forward past the 1-minute mark
            act(() => {
                jest.advanceTimersByTime(61 * 1000);
            });

            const state = useAudioStore.getState();
            expect(state.sleepTimerActive).toBe(false);
            expect(state.sleepTimerRemaining).toBe(0);
            expect(state.sleepTimerEndTime).toBeNull();
            expect(state._sleepTimerIntervalId).toBeNull();
        });

        it("sets isPlaying to false when the timer fires", () => {
            // Simulate audio playing
            useAudioStore.setState({ isPlaying: true });

            act(() => {
                useAudioStore.getState().setSleepTimer(1);
            });

            act(() => {
                jest.advanceTimersByTime(61 * 1000);
            });

            expect(useAudioStore.getState().isPlaying).toBe(false);
        });

        it("calls sound.pause() when a sound object is present", () => {
            const mockPause = jest.fn();
            useAudioStore.setState({ sound: { pause: mockPause }, isPlaying: true });

            act(() => {
                useAudioStore.getState().setSleepTimer(1);
            });

            act(() => {
                jest.advanceTimersByTime(61 * 1000);
            });

            expect(mockPause).toHaveBeenCalledTimes(1);
        });

        it("does not throw when sound is null at expiry", () => {
            useAudioStore.setState({ sound: null, isPlaying: false });

            expect(() => {
                act(() => {
                    useAudioStore.getState().setSleepTimer(1);
                });
                act(() => {
                    jest.advanceTimersByTime(61 * 1000);
                });
            }).not.toThrow();

            expect(useAudioStore.getState().sleepTimerActive).toBe(false);
        });

        it("handles a pause() rejection gracefully (no unhandled rejection)", () => {
            const mockPause = jest.fn().mockImplementation(() => {
                throw new Error("Audio hardware unavailable");
            });
            useAudioStore.setState({ sound: { pause: mockPause }, isPlaying: true });

            expect(() => {
                act(() => {
                    useAudioStore.getState().setSleepTimer(1);
                });
                act(() => {
                    jest.advanceTimersByTime(61 * 1000);
                });
            }).not.toThrow();

            // Timer state is still cleaned up despite the pause() error
            expect(useAudioStore.getState().sleepTimerActive).toBe(false);
        });
    });

    // ── cleanup() ─────────────────────────────────────────────────────────────

    describe("cleanup() cancels sleep timer", () => {
        it("resets all timer state when cleanup is called with a timer active", async () => {
            act(() => {
                useAudioStore.getState().setSleepTimer(30);
            });

            await act(async () => {
                await useAudioStore.getState().cleanup();
            });

            const state = useAudioStore.getState();
            expect(state.sleepTimerActive).toBe(false);
            expect(state.sleepTimerRemaining).toBe(0);
            expect(state.sleepTimerEndTime).toBeNull();
            expect(state._sleepTimerIntervalId).toBeNull();
        });

        it("stops the countdown after cleanup", async () => {
            act(() => {
                useAudioStore.getState().setSleepTimer(30);
            });

            await act(async () => {
                await useAudioStore.getState().cleanup();
            });

            // Advance time — the interval should be gone
            act(() => {
                jest.advanceTimersByTime(5000);
            });

            expect(useAudioStore.getState().sleepTimerActive).toBe(false);
        });
    });

    // ── State shape integrity ─────────────────────────────────────────────────

    describe("Initial state", () => {
        it("has all sleep timer fields at their default values on a fresh store import", () => {
            // Note: we reset these in beforeEach, so this validates the reset helper
            // matches the store's documented initial values
            const state = useAudioStore.getState();
            expect(state.sleepTimerActive).toBe(false);
            expect(state.sleepTimerEndTime).toBeNull();
            expect(state.sleepTimerRemaining).toBe(0);
            expect(state._sleepTimerIntervalId).toBeNull();
        });
    });
});
