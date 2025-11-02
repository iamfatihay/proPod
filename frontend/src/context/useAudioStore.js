import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { Audio } from "expo-av";
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
        play: async (track = null) => {
            const state = get();

            try {
                set({ isLoading: true, error: null });

                if (track && track !== state.currentTrack) {
                    // Load new track
                    await get().stop();
                    set({ currentTrack: track });
                }

                const currentTrack = track || state.currentTrack;
                if (!currentTrack?.uri) {
                    Logger.error("No track to play");
                    throw new Error("No track to play");
                }

                // Validate audio URL
                if (!currentTrack.uri.startsWith("http")) {
                    Logger.error("Invalid audio URL format:", currentTrack.uri);
                    throw new Error("Invalid audio URL format");
                }

                Logger.log("🎵 Starting playback:", {
                    title: currentTrack.title,
                    uri: currentTrack.uri.substring(0, 50) + "...",
                });

                // Configure audio mode for playback
                await Audio.setAudioModeAsync({
                    playsInSilentModeIOS: true,
                    staysActiveInBackground: true,
                    shouldDuckAndroid: true,
                    interruptionModeIOS: Audio.InterruptionModeIOS.DoNotMix,
                    interruptionModeAndroid:
                        Audio.InterruptionModeAndroid.DoNotMix,
                    playThroughEarpieceAndroid: false,
                });

                let sound = state.sound;

                if (!sound) {
                    // Create new sound object
                    const { sound: newSound } = await Audio.Sound.createAsync(
                        { uri: currentTrack.uri },
                        {
                            shouldPlay: true,
                            isLooping: false,
                            volume: state.volume,
                            rate: state.playbackRate,
                            shouldCorrectPitch: true,
                        },
                        get().onPlaybackStatusUpdate
                    );
                    sound = newSound;
                    set({ sound });
                } else {
                    // Resume existing sound
                    await sound.playAsync();
                }

                set({
                    isPlaying: true,
                    isLoading: false,
                    showMiniPlayer: true,
                    lastPlayedAt: new Date().toISOString(),
                });
            } catch (error) {
                Logger.error("Playback failed:", error);
                set({
                    error:
                        error.message ||
                        "Failed to play audio. Please check your connection.",
                    isLoading: false,
                    isPlaying: false,
                    showMiniPlayer: false,
                });

                // Notify user about the error
                if (
                    error.message?.includes("ExoPlayer") ||
                    error.message?.includes("404")
                ) {
                    throw new Error(
                        "Audio file not found. Please try a different podcast."
                    );
                }
            }
        },

        pause: async () => {
            const { sound } = get();
            if (sound) {
                try {
                    await sound.pauseAsync();
                    set({ isPlaying: false });
                } catch (error) {
                    Logger.error("Pause failed:", error);
                    set({ error: error.message });
                }
            }
        },

        stop: async () => {
            const { sound } = get();
            if (sound) {
                try {
                    await sound.stopAsync();
                    await sound.unloadAsync();
                    set({
                        sound: null,
                        isPlaying: false,
                        position: 0,
                        showMiniPlayer: false,
                    });
                } catch (error) {
                    Logger.error("Stop failed:", error);
                }
            }
        },

        seek: async (positionMillis) => {
            const { sound } = get();
            if (sound) {
                try {
                    await sound.setPositionAsync(positionMillis);
                    set({ position: positionMillis });
                } catch (error) {
                    Logger.error("Seek failed:", error);
                    set({ error: error.message });
                }
            }
        },

        setVolume: async (volume) => {
            const { sound } = get();
            const clampedVolume = Math.max(0, Math.min(1, volume));

            if (sound) {
                try {
                    await sound.setVolumeAsync(clampedVolume);
                } catch (error) {
                    Logger.error("Volume change failed:", error);
                }
            }

            set({ volume: clampedVolume });
        },

        setPlaybackRate: async (rate) => {
            const { sound } = get();
            const clampedRate = Math.max(0.25, Math.min(3.0, rate));

            if (sound) {
                try {
                    await sound.setRateAsync(clampedRate, true);
                } catch (error) {
                    Logger.error("Rate change failed:", error);
                }
            }

            set({ playbackRate: clampedRate });
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

        // Status Update Handler
        onPlaybackStatusUpdate: (status) => {
            if (status.isLoaded) {
                const updates = {
                    position: status.positionMillis || 0,
                    duration: status.durationMillis || 0,
                    isLoading: false,
                };

                if (status.didJustFinish) {
                    // Track finished, move to next
                    get().next();
                    return;
                }

                // Update playback state
                if (status.isPlaying !== undefined) {
                    updates.isPlaying = status.isPlaying;
                }

                set(updates);
            } else if (status.error) {
                Logger.error("Playback error:", status.error);
                set({
                    error: status.error,
                    isLoading: false,
                    isPlaying: false,
                });
            }
        },

        // Cleanup
        cleanup: async () => {
            const { sound } = get();
            if (sound) {
                try {
                    await sound.unloadAsync();
                } catch (error) {
                    Logger.error("Cleanup failed:", error);
                }
            }
            set({
                sound: null,
                isPlaying: false,
                currentTrack: null,
                position: 0,
                showMiniPlayer: false,
                error: null,
            });
        },
    }))
);

// Subscribe to playback state changes for analytics/logging
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

// Auto-save mini player position
useAudioStore.subscribe(
    (state) => state.miniPlayerPosition,
    (position) => {
        // Could save to AsyncStorage for persistence
        Logger.log("Mini player position updated:", position);
    }
);

export default useAudioStore;
