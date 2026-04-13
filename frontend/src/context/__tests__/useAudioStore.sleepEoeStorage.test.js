/**
 * useAudioStore — sleepOnEpisodeEnd AsyncStorage Persistence Tests
 *
 * Covers:
 *   - setSleepOnEpisodeEnd(true)   writes "1" to AsyncStorage
 *   - setSleepOnEpisodeEnd(false)  writes "0" to AsyncStorage
 *   - loadSleepSettings()          restores sleepOnEpisodeEnd=true when "1" is stored
 *   - loadSleepSettings()          no-ops when null (nothing stored yet)
 *   - loadSleepSettings()          no-ops when "0" is stored
 *   - loadSleepSettings()          handles AsyncStorage.getItem rejection gracefully
 *   - setSleepOnEpisodeEnd(true)   handles AsyncStorage.setItem rejection gracefully
 *   - setSleepOnEpisodeEnd(false)  handles AsyncStorage.setItem rejection gracefully
 */

import { act } from "@testing-library/react-native";
import useAudioStore from "../useAudioStore";

// ── Mocks ─────────────────────────────────────────────────────────────────────

jest.mock("../../utils/logger", () => ({
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
}));

// AsyncStorage is mapped to the custom mock in jest.config.js
// (src/tests/mocks/asyncStorage.js) which exposes __clearMockStorage / __setMockStorage
const AsyncStorage = require("@react-native-async-storage/async-storage");

const SLEEP_EOE_KEY = "@propod/sleepOnEpisodeEnd";

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

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("useAudioStore — sleepOnEpisodeEnd AsyncStorage persistence", () => {
    beforeEach(() => {
        jest.useFakeTimers();
        resetState();
        AsyncStorage.__clearMockStorage();
        jest.clearAllMocks();
    });

    afterEach(() => {
        const { _sleepTimerIntervalId } = useAudioStore.getState();
        if (_sleepTimerIntervalId) clearInterval(_sleepTimerIntervalId);
        resetState();
        jest.runOnlyPendingTimers();
        jest.useRealTimers();
    });

    // ── setSleepOnEpisodeEnd persistence ─────────────────────────────────────

    describe("setSleepOnEpisodeEnd(true) — persistence", () => {
        it('writes "1" to AsyncStorage', async () => {
            await act(async () => {
                useAudioStore.getState().setSleepOnEpisodeEnd(true);
                // Let the fire-and-forget setItem promise settle
                await Promise.resolve();
            });
            expect(AsyncStorage.setItem).toHaveBeenCalledWith(SLEEP_EOE_KEY, "1");
        });

        it("still sets sleepOnEpisodeEnd=true in store regardless of storage", async () => {
            await act(async () => {
                useAudioStore.getState().setSleepOnEpisodeEnd(true);
                await Promise.resolve();
            });
            expect(useAudioStore.getState().sleepOnEpisodeEnd).toBe(true);
        });
    });

    describe("setSleepOnEpisodeEnd(false) — persistence", () => {
        it('writes "0" to AsyncStorage', async () => {
            await act(async () => {
                useAudioStore.getState().setSleepOnEpisodeEnd(true);
                await Promise.resolve();
                useAudioStore.getState().setSleepOnEpisodeEnd(false);
                await Promise.resolve();
            });
            // The second call should write "0"
            expect(AsyncStorage.setItem).toHaveBeenLastCalledWith(SLEEP_EOE_KEY, "0");
        });

        it("still sets sleepOnEpisodeEnd=false in store", async () => {
            await act(async () => {
                useAudioStore.getState().setSleepOnEpisodeEnd(true);
                await Promise.resolve();
                useAudioStore.getState().setSleepOnEpisodeEnd(false);
                await Promise.resolve();
            });
            expect(useAudioStore.getState().sleepOnEpisodeEnd).toBe(false);
        });
    });

    // ── loadSleepSettings ─────────────────────────────────────────────────────

    describe("loadSleepSettings — restores from storage", () => {
        it('sets sleepOnEpisodeEnd=true when "1" is stored', async () => {
            AsyncStorage.__setMockStorage({ [SLEEP_EOE_KEY]: "1" });

            await act(async () => {
                await useAudioStore.getState().loadSleepSettings();
            });

            expect(useAudioStore.getState().sleepOnEpisodeEnd).toBe(true);
        });

        it("is a no-op when nothing is stored (null)", async () => {
            // Storage is empty — value will be null
            await act(async () => {
                await useAudioStore.getState().loadSleepSettings();
            });
            expect(useAudioStore.getState().sleepOnEpisodeEnd).toBe(false);
        });

        it('is a no-op when "0" is stored', async () => {
            AsyncStorage.__setMockStorage({ [SLEEP_EOE_KEY]: "0" });

            await act(async () => {
                await useAudioStore.getState().loadSleepSettings();
            });
            expect(useAudioStore.getState().sleepOnEpisodeEnd).toBe(false);
        });
    });

    // ── Error handling ────────────────────────────────────────────────────────

    describe("error handling", () => {
        it("does not throw when loadSleepSettings AsyncStorage.getItem rejects", async () => {
            AsyncStorage.getItem.mockRejectedValueOnce(new Error("storage unavailable"));

            await expect(
                act(async () => {
                    await useAudioStore.getState().loadSleepSettings();
                })
            ).resolves.not.toThrow();

            // Store stays at its default
            expect(useAudioStore.getState().sleepOnEpisodeEnd).toBe(false);
        });

        it("does not throw when setSleepOnEpisodeEnd AsyncStorage.setItem rejects", async () => {
            AsyncStorage.setItem.mockRejectedValueOnce(new Error("storage full"));

            await expect(
                act(async () => {
                    useAudioStore.getState().setSleepOnEpisodeEnd(true);
                    await Promise.resolve();
                })
            ).resolves.not.toThrow();

            // State is still updated even when storage fails
            expect(useAudioStore.getState().sleepOnEpisodeEnd).toBe(true);
        });
    });
});
