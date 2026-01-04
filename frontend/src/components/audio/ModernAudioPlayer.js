import React, { useState, useEffect, useRef, useMemo } from "react";
import {
    View,
    Text,
    TouchableOpacity,
    Platform,
    Animated,
    Dimensions,
    Alert,
    PanResponder,
} from "react-native";
import { MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";
import Logger from "../../utils/logger";
import useAudioStore from "../../context/useAudioStore";

const { width: screenWidth } = Dimensions.get("window");

/**
 * ModernAudioPlayer - Controlled component that works with useAudioStore
 *
 * Props:
 * - uri: Audio file URI (for reference, actual playback controlled by parent)
 * - title: Track title
 * - artist: Track artist
 * - isPlaying: Whether audio is currently playing (controlled by parent)
 * - onPlay: Callback when play is requested
 * - onPause: Callback when pause is requested
 * - onSeek: Callback when seek is requested (position in milliseconds)
 * - onSkipForward: Callback for skip forward
 * - onSkipBackward: Callback for skip backward
 * - onPlaybackRateChange: Callback when playback rate changes
 * - onVolumeChange: Callback when volume changes
 * - showProgress: Whether to show progress bar
 * - showControls: Whether to show controls
 * - compact: Whether to show compact version
 * - style: Additional style
 *
 * NOTE: duration, currentPosition, playbackRate, volume are now read directly from useAudioStore
 * to prevent unnecessary parent re-renders
 */
const ModernAudioPlayer = React.memo(
    ({
        uri,
        title = "Unknown Track",
        artist = "Unknown Artist",
        isPlaying = false,
        onPlay,
        onPause,
        onSeek,
        onSkipForward,
        onSkipBackward,
        onPlaybackRateChange,
        onVolumeChange,
        style,
        compact = false,
        showProgress = true,
        showControls = true,
    }) => {
        // CRITICAL PERFORMANCE FIX: Subscribe to frequently changing values HERE,
        // not in parent component (details.js) to prevent parent re-renders
        const duration = useAudioStore((state) => state.duration);
        const currentPosition = useAudioStore((state) => state.position);
        const playbackRate = useAudioStore((state) => state.playbackRate);
        const volume = useAudioStore((state) => state.volume);
        // Animation values
        const progressAnimation = useRef(new Animated.Value(0)).current;
        const volumeAnimation = useRef(new Animated.Value(1)).current;

        // Debounce refs to prevent rapid multiple calls
        const playDebounceRef = useRef(null);
        const pauseDebounceRef = useRef(null);

        // Progress bar interaction
        const [isDragging, setIsDragging] = useState(false);
        const [tempPosition, setTempPosition] = useState(0);

        // Update progress animation when position changes (only if not dragging)
        // Use refs to avoid unnecessary re-renders and prevent infinite loops
        const prevPositionRef = useRef(currentPosition);
        const prevDurationRef = useRef(duration);

        useEffect(() => {
            // PERFORMANCE: Direct setValue instead of Animated.timing for instant updates
            // This prevents blocking the main thread
            if (!isDragging && duration > 0) {
                const progress = currentPosition / duration;
                const clampedProgress = Math.max(0, Math.min(1, progress));

                // Direct setValue - instant, non-blocking
                progressAnimation.setValue(clampedProgress);

                prevPositionRef.current = currentPosition;
                prevDurationRef.current = duration;
            }
        }, [currentPosition, duration, isDragging, progressAnimation]);

        const handlePlay = () => {
            // CRITICAL: Debounce to prevent multiple rapid calls
            if (playDebounceRef.current) return;

            if (__DEV__) {
                Logger.log("▶️ [UI PLAY] Button pressed");
            }

            playDebounceRef.current = true;
            setTimeout(() => {
                playDebounceRef.current = null;
            }, 200); // Prevent multiple calls within 200ms (reduced from 500ms for better UX)

            try {
                if (onPlay) {
                    onPlay(); // Instant, non-blocking
                }
            } catch (error) {
                playDebounceRef.current = null; // Reset on error
                Logger.error("❌ ModernAudioPlayer playback failed:", error);
                Alert.alert("Playback Error", "Failed to control playback.");
            }
        };

        const handlePause = () => {
            // CRITICAL: Debounce to prevent multiple rapid calls
            if (pauseDebounceRef.current) return;

            if (__DEV__) {
                Logger.log("⏸️ [UI PAUSE] Button pressed");
            }

            pauseDebounceRef.current = true;
            setTimeout(() => {
                pauseDebounceRef.current = null;
            }, 200); // Prevent multiple calls within 200ms (reduced from 500ms for better UX)

            try {
                if (onPause) {
                    onPause(); // Instant, non-blocking
                }
            } catch (error) {
                pauseDebounceRef.current = null; // Reset on error
                Logger.error("❌ ModernAudioPlayer pause failed:", error);
            }
        };

        const handleSeek = (position) => {
            // Make non-blocking - remove await
            if (duration === 0 || !onSeek) return;

            const seekPosition = Math.max(0, Math.min(position, duration));
            // Don't await - let it run asynchronously
            onSeek(seekPosition);
        };

        const handleSkip = (direction) => {
            // Make non-blocking - remove await
            if (direction === "forward" && onSkipForward) {
                onSkipForward(); // Don't await
            } else if (direction === "backward" && onSkipBackward) {
                onSkipBackward(); // Don't await
            }
        };

        const handleSpeedChange = () => {
            // Make non-blocking - remove await
            if (!onPlaybackRateChange) {
                if (__DEV__) {
                    Logger.warn(
                        "⚠️ [SPEED] onPlaybackRateChange prop not provided!"
                    );
                }
                return;
            }

            const rates = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];
            const currentIndex = rates.indexOf(playbackRate);
            const nextRate = rates[(currentIndex + 1) % rates.length];

            if (__DEV__) {
                Logger.log("🎵 [SPEED] Changing:", {
                    from: playbackRate + "x",
                    to: nextRate + "x",
                });
            }

            onPlaybackRateChange(nextRate);
        };

        const handleVolumeToggle = () => {
            // Make non-blocking - remove await
            if (!onVolumeChange) return;

            const newVolume = volume > 0.5 ? 0.5 : 1.0;
            onVolumeChange(newVolume); // Don't await
        };

        const formatTime = (milliseconds) => {
            const seconds = Math.floor(milliseconds / 1000);
            const mins = Math.floor(seconds / 60);
            const secs = seconds % 60;
            return `${mins}:${secs.toString().padStart(2, "0")}`;
        };

        const getProgressBarWidth = () => {
            return compact ? screenWidth - 120 : screenWidth - 80;
        };

        // Progress bar pan responder - Stores the X offset of progress bar for accurate touch calculation
        const progressBarOffsetX = useRef(0);

        // PERFORMANCE: Memoize PanResponder to prevent recreation on every render
        // Only recreate when duration changes (which is rare)
        const panResponder = useMemo(() => {
            return PanResponder.create({
                onStartShouldSetPanResponder: () => true,
                onMoveShouldSetPanResponder: () => true,
                onPanResponderGrant: (evt, gestureState) => {
                    setIsDragging(true);

                    // CRITICAL FIX: Use pageX (absolute screen position) instead of locationX
                    // locationX is relative to the component and unreliable with padding/margins
                    const absoluteX =
                        evt.nativeEvent.pageX - progressBarOffsetX.current;
                    const progressWidth = getProgressBarWidth();
                    const progress = Math.max(
                        0,
                        Math.min(1, absoluteX / progressWidth)
                    );
                    const position = progress * duration;

                    setTempPosition(position);
                    progressAnimation.setValue(progress);

                    if (__DEV__) {
                        Logger.log("⏸️ [DRAG START]:", {
                            pageX: Math.round(evt.nativeEvent.pageX),
                            offset: Math.round(progressBarOffsetX.current),
                            progress: Math.round(progress * 100) + "%",
                            seekTo: Math.round(position / 1000) + "s",
                        });
                    }
                },
                onPanResponderMove: (evt, gestureState) => {
                    // CRITICAL FIX: Use pageX for accurate position tracking
                    const absoluteX =
                        evt.nativeEvent.pageX - progressBarOffsetX.current;
                    const progressWidth = getProgressBarWidth();
                    const progress = Math.max(
                        0,
                        Math.min(1, absoluteX / progressWidth)
                    );
                    const position = progress * duration;

                    // Immediate update - no throttle for smooth dragging
                    setTempPosition(position);
                    progressAnimation.setValue(progress);
                },
                onPanResponderRelease: (evt, gestureState) => {
                    setIsDragging(false);

                    if (__DEV__) {
                        Logger.log("⏸️ [DRAG END]:", {
                            finalPosition: Math.round(tempPosition / 1000) + "s",
                        });
                    }

                    handleSeek(tempPosition);
                },
            });
        }, [duration, progressAnimation, tempPosition]); // Only recreate when duration changes

        if (compact) {
            return (
                <View
                    className={`flex-row items-center bg-panel rounded-lg p-3 ${style || ""
                        }`}
                >
                    {/* Play/Pause Button */}
                    <TouchableOpacity
                        onPress={isPlaying ? handlePause : handlePlay}
                        className="mr-3"
                        accessible={true}
                        accessibilityRole="button"
                        accessibilityLabel={isPlaying ? "Pause" : "Play"}
                    >
                        <MaterialCommunityIcons
                            name={isPlaying ? "pause-circle" : "play-circle"}
                            size={32}
                            color="#D32F2F"
                        />
                    </TouchableOpacity>

                    {/* Track Info */}
                    <View className="flex-1 mr-3">
                        <Text
                            className="text-text-primary font-semibold text-sm"
                            numberOfLines={1}
                        >
                            {title}
                        </Text>
                        <Text
                            className="text-text-secondary text-xs"
                            numberOfLines={1}
                        >
                            {artist}
                        </Text>
                    </View>

                    {/* Progress */}
                    {showProgress && (
                        <View className="items-center">
                            <Text className="text-text-secondary text-xs">
                                {formatTime(
                                    isDragging ? tempPosition : currentPosition
                                )}
                            </Text>
                        </View>
                    )}
                </View>
            );
        }

        return (
            <View className={`bg-panel rounded-lg p-4 ${style || ""}`}>
                {/* Track Info */}
                <View className="items-center mb-4">
                    <Text
                        className="text-text-primary font-bold text-lg text-center"
                        numberOfLines={2}
                    >
                        {title}
                    </Text>
                    <Text
                        className="text-text-secondary text-sm text-center mt-1"
                        numberOfLines={1}
                    >
                        {artist}
                    </Text>
                </View>

                {/* Progress Bar */}
                {showProgress && (
                    <View className="mb-6">
                        <View
                            className="h-2 bg-border rounded-full"
                            style={{ width: getProgressBarWidth() }}
                            onLayout={(event) => {
                                // CRITICAL: Capture progress bar's absolute X position for accurate touch tracking
                                // Add null/undefined checks for safety across React Native versions
                                const target = event && event.target;

                                if (target && typeof target.measure === "function") {
                                    target.measure(
                                        (x, y, width, height, pageX, pageY) => {
                                            progressBarOffsetX.current = pageX;
                                            if (__DEV__) {
                                                Logger.log(
                                                    "📍 Progress bar position:",
                                                    {
                                                        pageX: Math.round(pageX),
                                                        width: Math.round(width),
                                                    }
                                                );
                                            }
                                        }
                                    );
                                }
                            }}
                            {...panResponder.panHandlers}
                        >
                            <Animated.View
                                className="h-full bg-primary rounded-full"
                                style={{
                                    width: progressAnimation.interpolate({
                                        inputRange: [0, 1],
                                        outputRange: ["0%", "100%"],
                                    }),
                                }}
                            />
                        </View>

                        {/* Time Display */}
                        <View className="flex-row justify-between mt-2">
                            <Text className="text-text-secondary text-xs">
                                {formatTime(
                                    isDragging ? tempPosition : currentPosition
                                )}
                            </Text>
                            <Text className="text-text-secondary text-xs">
                                {formatTime(duration)}
                            </Text>
                        </View>
                    </View>
                )}

                {/* Main Controls */}
                {showControls && (
                    <View className="flex-row items-center justify-center space-x-8 mb-4">
                        {/* Skip Backward */}
                        <TouchableOpacity
                            onPress={() => handleSkip("backward")}
                            accessible={true}
                            accessibilityRole="button"
                            accessibilityLabel="Skip backward 15 seconds"
                        >
                            <MaterialCommunityIcons
                                name="replay"
                                size={32}
                                color="#FFFFFF"
                            />
                        </TouchableOpacity>

                        {/* Play/Pause */}
                        <TouchableOpacity
                            onPress={isPlaying ? handlePause : handlePlay}
                            style={{
                                width: 64,
                                height: 64,
                                borderRadius: 32,
                                backgroundColor: "#D32F2F",
                                alignItems: "center",
                                justifyContent: "center",
                                ...(Platform.OS === "ios"
                                    ? {
                                        shadowColor: "#000",
                                        shadowOffset: {
                                            width: 0,
                                            height: 4,
                                        },
                                        shadowOpacity: 0.3,
                                        shadowRadius: 8,
                                    }
                                    : {
                                        elevation: 8,
                                    }),
                            }}
                            accessible={true}
                            accessibilityRole="button"
                            accessibilityLabel={isPlaying ? "Pause" : "Play"}
                        >
                            <MaterialCommunityIcons
                                name={isPlaying ? "pause" : "play"}
                                size={32}
                                color="white"
                            />
                        </TouchableOpacity>

                        {/* Skip Forward */}
                        <TouchableOpacity
                            onPress={() => handleSkip("forward")}
                            accessible={true}
                            accessibilityRole="button"
                            accessibilityLabel="Skip forward 15 seconds"
                        >
                            <MaterialCommunityIcons
                                name="forward"
                                size={32}
                                color="#FFFFFF"
                            />
                        </TouchableOpacity>
                    </View>
                )}

                {/* Secondary Controls */}
                {showControls && (
                    <View className="flex-row items-center justify-center space-x-6">
                        {/* Playback Speed */}
                        <TouchableOpacity
                            onPress={handleSpeedChange}
                            className="px-3 py-1 bg-card rounded-full"
                            accessible={true}
                            accessibilityRole="button"
                            accessibilityLabel={`Playback speed ${playbackRate}x`}
                        >
                            <Text className="text-text-primary text-sm font-semibold">
                                {playbackRate}x
                            </Text>
                        </TouchableOpacity>

                        {/* Volume Control */}
                        <Animated.View style={{ opacity: volumeAnimation }}>
                            <TouchableOpacity
                                onPress={handleVolumeToggle}
                                accessible={true}
                                accessibilityRole="button"
                                accessibilityLabel={`Volume ${Math.round(
                                    volume * 100
                                )}%`}
                            >
                                <MaterialCommunityIcons
                                    name={
                                        volume > 0.5
                                            ? "volume-high"
                                            : volume > 0
                                                ? "volume-medium"
                                                : "volume-off"
                                    }
                                    size={24}
                                    color="#888888"
                                />
                            </TouchableOpacity>
                        </Animated.View>
                    </View>
                )}
            </View>
        );
    },
    (prevProps, nextProps) => {
        // PERFORMANCE: Custom comparison function to prevent unnecessary re-renders
        // CRITICAL: duration, currentPosition, playbackRate, volume are now subscribed internally
        // We only compare props that are passed from parent and affect UI

        // DEV WARNING: Check if callbacks are changing (they shouldn't be!)
        if (__DEV__) {
            const callbackProps = [
                'onPlay', 'onPause', 'onSeek', 'onSkipForward',
                'onSkipBackward', 'onPlaybackRateChange', 'onVolumeChange'
            ];

            callbackProps.forEach(prop => {
                if (prevProps[prop] !== nextProps[prop]) {
                    Logger.warn(
                        `⚠️ [ModernAudioPlayer] Callback prop '${prop}' changed!`,
                        `This indicates the parent is not properly memoizing callbacks with useCallback.`,
                        `This can cause stale closures and unnecessary re-renders.`,
                        `Please wrap '${prop}' with useCallback in the parent component.`
                    );
                }
            });
        }

        return (
            prevProps.isPlaying === nextProps.isPlaying &&
            prevProps.title === nextProps.title &&
            prevProps.artist === nextProps.artist &&
            prevProps.compact === nextProps.compact &&
            prevProps.showProgress === nextProps.showProgress &&
            prevProps.showControls === nextProps.showControls
            // NOTE: Callback props (onPlay, onPause, etc.) are NOT compared
            // REQUIREMENT: Parent MUST wrap these callbacks with useCallback to ensure stable references
            // If callbacks change, stale closures may occur where callbacks reference old values
            // We detect callback changes in DEV mode and log warnings above
            // duration, currentPosition, playbackRate, volume are NOT props anymore
            // They are subscribed internally from useAudioStore
        );
    }
);

export default ModernAudioPlayer;
