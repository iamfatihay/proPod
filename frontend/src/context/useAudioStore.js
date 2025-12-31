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
            // Make completely non-blocking - use setTimeout to defer heavy operations
            setTimeout(() => {
                const state = get();

                // Clear any existing loading timeout
                if (state.isLoadingTimeout) {
                    clearTimeout(state.isLoadingTimeout);
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

                // Continue with async operations
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
                        if (
                            track &&
                            track.id !== currentState.currentTrack?.id
                        ) {
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
                        setAudioModeAsync({
                            playsInSilentModeIOS: true,
                            shouldPlayInBackground: true,
                            shouldDuckAndroid: true,
                            playThroughEarpieceAndroid: false,
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
                                throw new Error(
                                    "Failed to create audio player"
                                );
                            }

                            // Set playback options
                            const currentState = get();
                            sound.volume = currentState.volume;
                            sound.playbackRate = currentState.playbackRate;
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
                                Logger.error(
                                    "Audio file not found or unavailable"
                                );
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
            }, 0); // Defer to next tick - completely non-blocking
        },

        pause: () => {
            // Make completely non-blocking
            const { sound, isPlaying: currentIsPlaying } = get();

            // Prevent duplicate calls
            if (!currentIsPlaying) {
                return;
            }

            // Immediate optimistic update - UI responds instantly (synchronous)
            set({ isPlaying: false });

            // Defer sound.pause() to next tick - non-blocking
            if (sound) {
                setTimeout(() => {
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
                }, 0);
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
            // Make completely non-blocking - optimistic update first
            const { sound } = get();

            // Immediate optimistic update for UI responsiveness
            set({ position: positionMillis });

            // Defer native seek operation to prevent blocking
            if (sound) {
                setTimeout(() => {
                    try {
                        sound.seekTo(positionMillis / 1000); // Convert to seconds
                    } catch (error) {
                        Logger.error("Seek failed:", error);
                        // Revert position on error
                        const currentState = get();
                        set({
                            position: currentState.position, // Revert to actual position
                            error: error.message,
                        });
                    }
                }, 0);
            }
        },

        setVolume: (volume) => {
            // Make non-blocking - optimistic update first
            const { sound } = get();
            const clampedVolume = Math.max(0, Math.min(1, volume));

            // Immediate optimistic update
            set({ volume: clampedVolume });

            // Defer native volume change to prevent blocking
            if (sound) {
                setTimeout(() => {
                    try {
                        sound.volume = clampedVolume;
                    } catch (error) {
                        Logger.error("Volume change failed:", error);
                    }
                }, 0);
            }
        },

        setPlaybackRate: (rate) => {
            // Make non-blocking - optimistic update first
            const { sound } = get();
            const clampedRate = Math.max(0.25, Math.min(3.0, rate));

            // Immediate optimistic update
            set({ playbackRate: clampedRate });

            // Defer native playback rate change to prevent blocking
            if (sound) {
                setTimeout(() => {
                    try {
                        sound.playbackRate = clampedRate;
                    } catch (error) {
                        Logger.error("Rate change failed:", error);
                    }
                }, 0);
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

                    const updates = {
                        position: currentTime,
                        duration: totalDuration,
                        isLoading: !isLoaded,
                        isPlaying: isPlayingStatus,
                        isLoadingTimeout: null,
                    };

                    // Check if playback finished
                    if (
                        status.didJustFinish ||
                        (totalDuration > 0 &&
                            currentTime >= totalDuration - 100) // 100ms tolerance
                    ) {
                        Logger.log(
                            "✅ [STATUS] Playback finished, moving to next"
                        );
                        // Track finished, move to next
                        get().next();
                        return;
                    }

                    // Only update if values changed (avoid unnecessary re-renders)
                    // Throttle updates to prevent UI blocking
                    const currentState = get();
                    const shouldUpdate =
                        Math.abs(currentState.position - currentTime) > 200 || // Increased threshold to 200ms
                        currentState.duration !== totalDuration ||
                        currentState.isLoading !== !isLoaded ||
                        currentState.isPlaying !== isPlayingStatus;

                    if (shouldUpdate) {
                        // Defer state update to prevent blocking
                        setTimeout(() => {
                            set(updates);
                        }, 0);
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

                    // Throttle fallback updates too
                    const fallbackCurrentState = get();
                    const shouldUpdateFallback =
                        Math.abs(fallbackCurrentState.position - currentTime) >
                            200 ||
                        fallbackCurrentState.duration !== totalDuration ||
                        fallbackCurrentState.isLoading !== !isLoaded ||
                        fallbackCurrentState.isPlaying !== isPlayingStatus;

                    if (shouldUpdateFallback) {
                        // Defer state update to prevent blocking
                        setTimeout(() => {
                            set({
                                position: currentTime,
                                duration: totalDuration,
                                isPlaying: isPlayingStatus,
                                isLoading: !isLoaded,
                                isLoadingTimeout: null,
                            });
                        }, 0);
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
            });
        },
    }))
);

// Subscribe to playback state changes for analytics/logging (dev only)
if (__DEV__) {
    useAudioStore.subscribe(
        (state) => state.isPlaying,
        (isPlaying, previousIsPlaying) => {
            if (isPlaying && !previousIsPlaying) {
                Logger.log(
                    "Playback started:",
                    useAudioStore.getState().currentTrack?.title
                );
            } else if (!isPlaying && previousIsPlaying) {
                Logger.log(
                    "Playback paused:",
                    useAudioStore.getState().currentTrack?.title
                );
            }
        }
    );
}

export default useAudioStore;
