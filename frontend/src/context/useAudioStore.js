import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { createAudioPlayer, setAudioModeAsync } from "expo-audio";
import Logger from "../utils/logger";
// import AudioService from "../services/audio"; // Temporarily disabled

const useAudioStore = create(
    subscribeWithSelector((set, get) => ({
        // Playback State
        currentTrack: null,
        isPlaying: false,
        isLoading: false,
        duration: 0,
        position: 0,
        volume: 1.0,
        playbackRate: 1.0,
        sound: null,
        isLoadingTimeout: null, // Safety timeout for isLoading
        isSeeking: false, // CRITICAL: Flag to prevent isPlaying override during seek

        // Queue Management
        queue: [],
        currentIndex: 0,
        shuffleMode: false,
        repeatMode: "none", // 'none', 'one', 'all'

        // UI State
        showMiniPlayer: false,
        miniPlayerPosition: { x: 16, y: 200 },
        lastPlayedAt: null,

        // Error Handling
        error: null,

        // Actions
        setCurrentTrack: (track) => {
            set({
                currentTrack: track,
                error: null,
            });
        },

        setPlaybackState: (state) => {
            set(state);
        },

        setQueue: (tracks, startIndex = 0) => {
            set({
                queue: tracks,
                currentIndex: startIndex,
                currentTrack: tracks[startIndex] || null,
            });
        },

        addToQueue: (track) => {
            const { queue } = get();
            set({ queue: [...queue, track] });
        },

        removeFromQueue: (index) => {
            const { queue, currentIndex } = get();
            const newQueue = queue.filter((_, i) => i !== index);
            let newCurrentIndex = currentIndex;

            if (index < currentIndex) {
                newCurrentIndex = currentIndex - 1;
            } else if (index === currentIndex) {
                // If removing current track, move to next or previous
                newCurrentIndex = Math.min(currentIndex, newQueue.length - 1);
            }

            set({
                queue: newQueue,
                currentIndex: Math.max(0, newCurrentIndex),
                currentTrack: newQueue[newCurrentIndex] || null,
            });
        },

        shuffleQueue: () => {
            const { queue, currentTrack, shuffleMode } = get();
            if (!shuffleMode) {
                // Enable shuffle
                const shuffled = [...queue].sort(() => Math.random() - 0.5);
                const currentIndex = shuffled.findIndex(
                    (track) => track.id === currentTrack?.id
                );
                set({
                    queue: shuffled,
                    currentIndex: Math.max(0, currentIndex),
                    shuffleMode: true,
                });
            } else {
                // Disable shuffle - restore original order
                // This would require storing original queue order
                set({ shuffleMode: false });
            }
        },

        setRepeatMode: (mode) => {
            set({ repeatMode: mode });
        },

        // Playback Controls
        play: (track = null) => {
            // PERFORMANCE: Direct execution - no setTimeout wrapper!
            const state = get();

            // DEBUG: Log caller to track duplicate calls
            if (__DEV__) {
                Logger.log("🎵 [PLAY] Called:", {
                    hasTrack: !!track,
                    trackId: track?.id,
                    currentTrackId: state.currentTrack?.id,
                    isPlaying: state.isPlaying,
                    isLoading: state.isLoading,
                });
            }

            // Clear any existing loading timeout
            if (state.isLoadingTimeout) {
                clearTimeout(state.isLoadingTimeout);
            }

            // CRITICAL: Prevent rapid duplicate calls (debounce)
            // If already playing the SAME track, ignore
            if (!track && state.isPlaying && !state.isLoading) {
                if (__DEV__) {
                    Logger.warn(
                        "⚠️ [PLAY] Already playing, ignoring duplicate resume call"
                    );
                }
                return;
            }

            // Prevent multiple simultaneous play calls - but allow track switching
            // Only block if we're loading the SAME track
            if (state.isLoading && track?.id === state.currentTrack?.id) {
                if (__DEV__) {
                    Logger.warn(
                        "⚠️ [PLAY] Already loading same track, skipping duplicate call"
                    );
                }
                return;
            }

            // If loading different track, clear loading state to allow switch
            if (
                state.isLoading &&
                track &&
                track.id !== state.currentTrack?.id
            ) {
                if (__DEV__) {
                    Logger.log(
                        "🔄 [PLAY] Force switching track, clearing loading state"
                    );
                }
                set({ isLoading: false });
            }

            // Early return if no track provided and no current track
            if (!track && !state.currentTrack) {
                if (__DEV__) {
                    Logger.warn(
                        "⚠️ [PLAY] No track provided and no current track"
                    );
                }
                return;
            }

            // Immediate optimistic update for UI responsiveness (synchronous)
            set({
                isLoading: true,
                error: null,
                isPlaying: true, // Optimistic - show playing state immediately
            });

            // Continue with async operations immediately (no setTimeout wrapper)
            (async () => {
                try {
                    if (__DEV__) {
                        Logger.log("🎵 [PLAY] Called:", {
                            hasTrack: !!track,
                            trackId: track?.id,
                            currentTrackId: state.currentTrack?.id,
                        });
                    }

                    // Handle track switching - non-blocking cleanup
                    const currentState = get();
                    if (track && track.id !== currentState.currentTrack?.id) {
                        if (__DEV__) {
                            Logger.log("🔄 [PLAY] Switching to new track");
                        }

                        // Cleanup old sound asynchronously (don't block UI)
                        const oldSound = currentState.sound;
                        if (oldSound) {
                            // Remove old sound from state immediately to prevent conflicts
                            set({ sound: null });

                            // Fire and forget - don't wait for cleanup
                            Promise.resolve().then(async () => {
                                try {
                                    oldSound.pause();
                                    oldSound.remove();
                                } catch (e) {
                                    // Ignore cleanup errors
                                }
                            });
                        }

                        // Update track immediately
                        set({ currentTrack: track });
                    }

                    const currentTrack = track || get().currentTrack;
                    if (!currentTrack?.uri) {
                        set({
                            error: "No track to play",
                            isLoading: false,
                            isPlaying: false,
                        });
                        throw new Error(
                            "No track to play. Please select a podcast first."
                        );
                    }

                    // Validate audio URL format
                    const uri = currentTrack.uri?.trim();
                    if (
                        !uri ||
                        (!uri.startsWith("http") &&
                            !uri.startsWith("file://") &&
                            !uri.startsWith("asset://"))
                    ) {
                        set({
                            error: "Invalid audio URL format",
                            isLoading: false,
                            isPlaying: false,
                        });
                        throw new Error(
                            "Invalid or missing audio URL. This podcast may be corrupted."
                        );
                    }

                    // Configure audio mode (non-blocking, fire and forget)
                    // CRITICAL: allowsRecordingIOS must be false for proper speaker routing
                    setAudioModeAsync({
                        playsInSilentModeIOS: true,
                        shouldPlayInBackground: true,
                        shouldDuckAndroid: true,
                        playThroughEarpieceAndroid: false,
                        staysActiveInBackground: true,
                        allowsRecordingIOS: false, // CRITICAL: Must be false for speaker playback
                    }).catch(() => {
                        // Ignore - not critical
                    });

                    let sound = get().sound; // Get fresh state after track update

                    // Check if we need to create a new player
                    // Always create new player if track changed or sound is null
                    const needsNewPlayer =
                        !sound ||
                        (track && track.id !== get().currentTrack?.id) ||
                        currentTrack.uri !== get().currentTrack?.uri;

                    if (needsNewPlayer) {
                        // Create new audio player (synchronous operation)
                        sound = createAudioPlayer(uri, 100);

                        if (!sound) {
                            set({
                                error: "Failed to create audio player",
                                isLoading: false,
                                isPlaying: false,
                            });
                            throw new Error("Failed to create audio player");
                        }

                        // Set playback options
                        const currentState = get();
                        sound.volume = currentState.volume;

                        // CRITICAL: expo-audio playbackRate might not work as property
                        // Try both setter and direct property assignment
                        try {
                            // Method 1: Direct property (might be read-only)
                            sound.playbackRate = currentState.playbackRate;

                            // Method 2: If there's a setter method (check expo-audio docs)
                            if (typeof sound.setPlaybackRate === "function") {
                                sound.setPlaybackRate(
                                    currentState.playbackRate
                                );
                            }

                            if (__DEV__) {
                                Logger.log(
                                    "🎵 [PLAY] Initial playbackRate set attempt:",
                                    {
                                        desired:
                                            currentState.playbackRate + "x",
                                        actual: sound.playbackRate + "x",
                                        hasSetterMethod:
                                            typeof sound.setPlaybackRate ===
                                            "function",
                                    }
                                );
                            }
                        } catch (rateError) {
                            Logger.warn(
                                "⚠️ [PLAY] Failed to set initial playbackRate:",
                                rateError
                            );
                        }

                        sound.loop = false;

                        // Add status update listener
                        sound.addListener(
                            "playbackStatusUpdate",
                            get().onPlaybackStatusUpdate
                        );

                        // Update state immediately with new sound
                        set({
                            sound,
                            showMiniPlayer: true,
                            lastPlayedAt: new Date().toISOString(),
                        });

                        // Start playback immediately (don't wait for load)
                        try {
                            sound.play();
                        } catch (playError) {
                            // If play fails, mark as loading and let status updates handle it
                            set({ isLoading: true });
                        }
                    } else {
                        // Resume existing sound - already optimistic updated above
                        try {
                            sound.play();
                        } catch (error) {
                            set({ isPlaying: false, error: error.message });
                            throw error;
                        }
                    }

                    // Mark as not loading (playback started)
                    // But set safety timeout in case status updates don't come
                    set({ isLoading: false });

                    // Safety timeout: if status update doesn't come in 2 seconds, clear loading
                    const timeoutId = setTimeout(() => {
                        const timeoutState = get();
                        if (timeoutState.isLoading) {
                            if (__DEV__) {
                                Logger.warn(
                                    "⚠️ [PLAY] Loading timeout, clearing isLoading state"
                                );
                            }
                            set({ isLoading: false });
                        }
                    }, 2000);

                    set({ isLoadingTimeout: timeoutId });
                } catch (error) {
                    if (__DEV__) {
                        Logger.error("❌ [PLAY] Playback failed:", error);
                    }

                    // Clear loading timeout if exists
                    const errorState = get();
                    if (errorState.isLoadingTimeout) {
                        clearTimeout(errorState.isLoadingTimeout);
                    }

                    set({
                        error:
                            error.message ||
                            "Failed to play audio. Please check your connection.",
                        isLoading: false,
                        isPlaying: false,
                        showMiniPlayer: false,
                        isLoadingTimeout: null,
                    });

                    // Provide user-friendly error messages
                    if (
                        error.message?.includes("ExoPlayer") ||
                        error.message?.includes("404") ||
                        error.message?.includes("Network") ||
                        error.message?.includes("Failed to load")
                    ) {
                        // Don't throw - just log
                        if (__DEV__) {
                            Logger.error("Audio file not found or unavailable");
                        }
                        return;
                    }

                    if (
                        error.message?.includes("Invalid") ||
                        error.message?.includes("format") ||
                        error.message?.includes("corrupted")
                    ) {
                        // Don't throw - just log
                        if (__DEV__) {
                            Logger.error(
                                "Podcast audio file appears to be corrupted"
                            );
                        }
                        return;
                    }
                }
            })();
        },

        pause: () => {
            // PERFORMANCE: Direct execution - no setTimeout!
            const { sound, isPlaying: currentIsPlaying } = get();

            // DEBUG: Log pause call to track duplicates
            if (__DEV__) {
                Logger.log("⏸️ [PAUSE] Called:", {
                    currentlyPlaying: currentIsPlaying,
                    hasSound: !!sound,
                });
            }

            // Prevent duplicate calls
            if (!currentIsPlaying) {
                if (__DEV__) {
                    Logger.warn("⚠️ [PAUSE] Already paused, ignoring");
                }
                return;
            }

            // Immediate optimistic update - UI responds instantly (synchronous)
            set({ isPlaying: false });

            // Execute pause immediately - it's fast enough
            if (sound) {
                try {
                    sound.pause();
                } catch (error) {
                    // Revert on error
                    set({
                        isPlaying: true,
                        error: error.message || "Failed to pause playback",
                    });
                    if (__DEV__) {
                        Logger.error("❌ Pause failed:", error);
                    }
                }
            }
        },

        stop: async () => {
            const { sound } = get();

            // Immediate state update
            set({
                isPlaying: false,
                showMiniPlayer: false,
            });

            // Cleanup sound asynchronously (non-blocking)
            if (sound) {
                Promise.resolve().then(async () => {
                    try {
                        sound.pause();
                        sound.remove();
                        set({ sound: null, position: 0 });
                    } catch (error) {
                        if (__DEV__) {
                            Logger.error("Stop failed:", error);
                        }
                        set({ sound: null, position: 0 });
                    }
                });
            } else {
                set({ sound: null, position: 0 });
            }
        },

        seek: (positionMillis) => {
            // PERFORMANCE: Direct execution - optimistic update first
            const { sound, position: previousPosition } = get();

            // DEBUG: Log seek call
            if (__DEV__) {
                Logger.log("⏩ [SEEK] Called:", {
                    from: Math.floor(previousPosition / 1000) + "s",
                    to: Math.floor(positionMillis / 1000) + "s",
                    hasSound: !!sound,
                });
            }

            // Capture previous position BEFORE optimistic update for rollback
            const originalPosition = previousPosition;

            // CRITICAL: Set seeking flag to prevent isPlaying override
            // Clear it faster (300ms) for better responsiveness
            set({
                position: positionMillis,
                isSeeking: true,
            });

            // Clear seeking flag after SHORT delay (reduced from 1000ms to 300ms)
            // Most seek operations complete in 50-200ms, 300ms is safe buffer
            const seekTimeoutId = setTimeout(() => {
                set({ isSeeking: false });
            }, 300);

            // Execute seek immediately - it's fast enough on native side
            if (sound) {
                try {
                    sound.seekTo(positionMillis / 1000); // Convert to seconds
                } catch (error) {
                    Logger.error("Seek failed:", error);
                    clearTimeout(seekTimeoutId); // Clear timeout on error
                    // Revert to original position captured before optimistic update
                    set({
                        position: originalPosition,
                        error: error.message,
                        isSeeking: false,
                    });
                }
            }
        },

        setVolume: (volume) => {
            // PERFORMANCE: Direct execution - optimistic update first
            const { sound } = get();
            const clampedVolume = Math.max(0, Math.min(1, volume));

            // Immediate optimistic update
            set({ volume: clampedVolume });

            // Execute volume change immediately - it's fast
            if (sound) {
                try {
                    sound.volume = clampedVolume;
                } catch (error) {
                    Logger.error("Volume change failed:", error);
                }
            }
        },

        setPlaybackRate: (rate) => {
            // PERFORMANCE: Direct execution - optimistic update first
            const { sound } = get();
            const clampedRate = Math.max(0.25, Math.min(3.0, rate));

            if (__DEV__) {
                Logger.log("🎵 [STORE] setPlaybackRate called:", {
                    from: get().playbackRate + "x",
                    to: clampedRate + "x",
                    hasSound: !!sound,
                });
            }

            // Immediate optimistic update
            set({ playbackRate: clampedRate });

            // Execute playback rate change immediately - it's fast
            if (sound) {
                try {
                    // CRITICAL: expo-audio playbackRate might be read-only or not supported
                    // Try all possible methods to change playback rate

                    const beforeRate = sound.playbackRate;

                    // Method 1: Direct property assignment
                    sound.playbackRate = clampedRate;
                    let currentRate = sound.playbackRate;

                    // Method 2: If there's a setPlaybackRate method
                    if (typeof sound.setPlaybackRate === "function") {
                        sound.setPlaybackRate(clampedRate);
                        currentRate = sound.playbackRate;
                    }

                    // Method 3: If there's a setRate method
                    if (typeof sound.setRate === "function") {
                        sound.setRate(clampedRate);
                        currentRate = sound.playbackRate;
                    }

                    if (__DEV__) {
                        const isSuccess =
                            Math.abs(currentRate - clampedRate) < 0.01;
                        Logger.log(
                            isSuccess
                                ? "✅ [STORE] playbackRate set successfully:"
                                : "❌ [STORE] playbackRate NOT SUPPORTED:",
                            {
                                desired: clampedRate + "x",
                                before: beforeRate + "x",
                                after: currentRate + "x",
                                hasSetPlaybackRate:
                                    typeof sound.setPlaybackRate === "function",
                                hasSetRate: typeof sound.setRate === "function",
                                SUCCESS: isSuccess,
                            }
                        );

                        if (!isSuccess) {
                            Logger.error(
                                "❌ expo-audio does NOT support playbackRate!",
                                {
                                    recommendation:
                                        "Use react-native-track-player or expo-av for playback rate support",
                                }
                            );
                        }
                    }
                } catch (error) {
                    Logger.error("❌ [STORE] Rate change failed:", error);
                }
            } else {
                if (__DEV__) {
                    Logger.warn(
                        "⚠️ [STORE] No sound instance, rate not applied"
                    );
                }
            }
        },

        // Queue Navigation
        next: async () => {
            const { queue, currentIndex, repeatMode } = get();

            if (queue.length === 0) return;

            let nextIndex;

            if (repeatMode === "one") {
                // Repeat current track
                nextIndex = currentIndex;
            } else if (currentIndex < queue.length - 1) {
                // Normal next
                nextIndex = currentIndex + 1;
            } else if (repeatMode === "all") {
                // Loop to beginning
                nextIndex = 0;
            } else {
                // End of queue
                await get().stop();
                return;
            }

            const nextTrack = queue[nextIndex];
            set({ currentIndex: nextIndex });
            await get().play(nextTrack);
        },

        previous: async () => {
            const { queue, currentIndex, position } = get();

            if (queue.length === 0) return;

            // If more than 3 seconds played, restart current track
            if (position > 3000) {
                await get().seek(0);
                return;
            }

            let prevIndex;

            if (currentIndex > 0) {
                prevIndex = currentIndex - 1;
            } else {
                // Go to last track or stay at first
                prevIndex = queue.length - 1;
            }

            const prevTrack = queue[prevIndex];
            set({ currentIndex: prevIndex });
            await get().play(prevTrack);
        },

        // UI Controls
        toggleMiniPlayer: (show) => {
            set({ showMiniPlayer: show ?? !get().showMiniPlayer });
        },

        setMiniPlayerPosition: (position) => {
            set({ miniPlayerPosition: position });
        },

        clearError: () => {
            set({ error: null });
        },

        // Status Update Handler for expo-audio
        onPlaybackStatusUpdate: (status) => {
            const { sound } = get();
            if (!sound) {
                // Don't log warning repeatedly - only log once per missing instance
                return;
            }

            try {
                if (status) {
                    const currentTime =
                        (status.currentTime || sound.currentTime || 0) * 1000;
                    const totalDuration =
                        (status.duration || sound.duration || 0) * 1000;
                    const isLoaded = sound.isLoaded;
                    const isPlayingStatus =
                        status.playing !== undefined
                            ? status.playing
                            : sound.playing !== undefined
                            ? sound.playing
                            : false;

                    // Clear loading timeout when we get status update
                    const stateForTimeout = get();
                    if (stateForTimeout.isLoadingTimeout) {
                        clearTimeout(stateForTimeout.isLoadingTimeout);
                    }

                    // CRITICAL FIX: Don't override isPlaying during seek operations
                    const currentState = get();
                    const shouldUpdatePlayingState = !currentState.isSeeking;

                    const updates = {
                        position: currentTime,
                        duration: totalDuration,
                        isLoading: !isLoaded,
                        isPlaying: shouldUpdatePlayingState
                            ? isPlayingStatus
                            : currentState.isPlaying,
                        isLoadingTimeout: null,
                    };

                    // Check if playback finished
                    if (
                        status.didJustFinish ||
                        (totalDuration > 0 &&
                            currentTime >= totalDuration - 100) // 100ms tolerance
                    ) {
                        const state = get();
                        const hasNext =
                            state.currentIndex < state.queue.length - 1;
                        const willRepeat = state.repeatMode === "all";

                        if (hasNext) {
                            Logger.log(
                                "✅ Track finished, moving to next track"
                            );
                        } else if (willRepeat) {
                            Logger.log("🔁 Track finished, repeating queue");
                        } else {
                            Logger.log("⏹️ Track finished, end of queue");
                        }

                        // Track finished, move to next (or stop if no next)
                        get().next();
                        return;
                    }

                    // PERFORMANCE: Reduced threshold from 200ms to 100ms for more responsive updates
                    // Update immediately without setTimeout - state updates are fast
                    const shouldUpdate =
                        Math.abs(currentState.position - currentTime) > 100 || // Reduced from 200ms to 100ms
                        currentState.duration !== totalDuration ||
                        currentState.isLoading !== !isLoaded ||
                        (shouldUpdatePlayingState &&
                            currentState.isPlaying !== isPlayingStatus);

                    if (shouldUpdate) {
                        // Direct state update - no setTimeout wrapper
                        set(updates);
                    }
                } else {
                    // Fallback: update from sound instance directly
                    const currentTime = (sound.currentTime || 0) * 1000;
                    const totalDuration = (sound.duration || 0) * 1000;
                    const isPlayingStatus = sound.playing || false;
                    const isLoaded = sound.isLoaded;

                    // Clear loading timeout when we get status update
                    const fallbackState = get();
                    if (fallbackState.isLoadingTimeout) {
                        clearTimeout(fallbackState.isLoadingTimeout);
                    }

                    // PERFORMANCE: Reduced threshold and direct update
                    const fallbackCurrentState = get();
                    const shouldUpdateFallback =
                        Math.abs(fallbackCurrentState.position - currentTime) >
                            100 || // Reduced from 200ms to 100ms
                        fallbackCurrentState.duration !== totalDuration ||
                        fallbackCurrentState.isLoading !== !isLoaded ||
                        fallbackCurrentState.isPlaying !== isPlayingStatus;

                    if (shouldUpdateFallback) {
                        // Direct state update - no setTimeout wrapper
                        set({
                            position: currentTime,
                            duration: totalDuration,
                            isPlaying: isPlayingStatus,
                            isLoading: !isLoaded,
                            isLoadingTimeout: null,
                        });
                    }
                }
            } catch (error) {
                Logger.error(
                    "❌ [STATUS] Error in playback status update:",
                    error
                );
            }
        },

        // Cleanup
        cleanup: async () => {
            const { sound, isLoadingTimeout } = get();

            // Clear loading timeout
            if (isLoadingTimeout) {
                clearTimeout(isLoadingTimeout);
            }

            if (sound) {
                try {
                    sound.pause();
                    sound.remove();
                } catch (error) {
                    Logger.error("Cleanup failed:", error);
                }
            }
            set({
                sound: null,
                isPlaying: false,
                isLoading: false,
                currentTrack: null,
                position: 0,
                showMiniPlayer: false,
                error: null,
                isLoadingTimeout: null,
                isSeeking: false, // Reset seeking flag
            });
        },
    }))
);

// Subscribe to playback state changes for analytics/logging (dev only)
if (__DEV__) {
    useAudioStore.subscribe(
        (state) => state.isPlaying,
        (isPlaying, previousIsPlaying) => {
            const currentState = useAudioStore.getState();
            const trackTitle = currentState.currentTrack?.title || "Unknown";

            if (isPlaying && !previousIsPlaying) {
                // Only log if not loading (to avoid false "started" during initial load)
                if (!currentState.isLoading) {
                    Logger.log("▶️ Playback started:", trackTitle);
                }
            } else if (!isPlaying && previousIsPlaying) {
                // Check if this is a real pause or just a stop at end
                // If position is near end, it's probably finished
                const isNearEnd =
                    currentState.position > 0 &&
                    currentState.duration > 0 &&
                    currentState.duration - currentState.position < 1000;

                // If position is very small (< 500ms), it's probably still loading
                const isJustStarted = currentState.position < 500;

                if (isNearEnd) {
                    Logger.log(
                        "⏹️ Playback stopped (end of track):",
                        trackTitle
                    );
                } else if (isJustStarted || currentState.isLoading) {
                    Logger.log("⏳ Audio loading:", trackTitle);
                } else {
                    Logger.log("⏸️ Playback paused:", trackTitle);
                }
            }
        }
    );
}

export default useAudioStore;
