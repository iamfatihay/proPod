import React, { useState, useEffect, useRef } from "react";
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
import WaveformVisualizer from "./WaveformVisualizer";

const { width: screenWidth } = Dimensions.get("window");

/**
 * ModernAudioPlayer - Controlled component that works with useAudioStore
 *
 * Props:
 * - uri: Audio file URI (for reference, actual playback controlled by parent)
 * - title: Track title
 * - artist: Track artist
 * - duration: Total duration in milliseconds
 * - isPlaying: Whether audio is currently playing (controlled by parent)
 * - currentPosition: Current playback position in milliseconds (controlled by parent)
 * - onPlay: Callback when play is requested
 * - onPause: Callback when pause is requested
 * - onSeek: Callback when seek is requested (position in milliseconds)
 * - onSkipForward: Callback for skip forward
 * - onSkipBackward: Callback for skip backward
 * - playbackRate: Current playback rate (controlled by parent)
 * - onPlaybackRateChange: Callback when playback rate changes
 * - volume: Current volume (controlled by parent)
 * - onVolumeChange: Callback when volume changes
 * - showProgress: Whether to show progress bar
 * - showControls: Whether to show controls
 * - compact: Whether to show compact version
 * - style: Additional style
 */
const ModernAudioPlayer = ({
    uri,
    title = "Unknown Track",
    artist = "Unknown Artist",
    duration = 0,
    isPlaying = false,
    currentPosition = 0,
    onPlay,
    onPause,
    onSeek,
    onSkipForward,
    onSkipBackward,
    playbackRate = 1.0,
    onPlaybackRateChange,
    volume = 1.0,
    onVolumeChange,
    style,
    compact = false,
    showProgress = true,
    showControls = true,
}) => {
    // Animation values
    const [playButtonScale] = useState(new Animated.Value(1));
    const progressAnimation = useRef(new Animated.Value(0)).current;
    const volumeAnimation = useRef(new Animated.Value(1)).current;

    // Progress bar interaction
    const [isDragging, setIsDragging] = useState(false);
    const [tempPosition, setTempPosition] = useState(0);
    const lastUpdateTimeRef = useRef(0); // For throttling drag updates

    // Generate simulated audio data for waveform visualization
    const generateSimulatedAudioData = () => {
        const dataLength = 1000;
        const audioData = [];
        for (let i = 0; i < dataLength; i++) {
            const frequency = 440 + Math.sin(i * 0.01) * 100;
            const amplitude =
                Math.sin(i * frequency * 0.01) * (0.5 + Math.random() * 0.5);
            audioData.push(amplitude);
        }
        return audioData;
    };

    const [audioData] = useState(generateSimulatedAudioData());

    // Update progress animation when position changes (only if not dragging)
    // Use refs to avoid unnecessary re-renders and prevent infinite loops
    const prevPositionRef = useRef(currentPosition);
    const prevDurationRef = useRef(duration);

    useEffect(() => {
        // Only update if position or duration actually changed (avoid unnecessary animations)
        const positionChanged =
            Math.abs(prevPositionRef.current - currentPosition) > 50; // 50ms threshold
        const durationChanged = prevDurationRef.current !== duration;

        if (
            !isDragging &&
            duration > 0 &&
            (positionChanged || durationChanged)
        ) {
            prevPositionRef.current = currentPosition;
            prevDurationRef.current = duration;

            const progress = currentPosition / duration;
            Animated.timing(progressAnimation, {
                toValue: Math.max(0, Math.min(1, progress)),
                duration: 100,
                useNativeDriver: false,
            }).start();
        }
    }, [currentPosition, duration, isDragging]);

    const handlePlay = async () => {
        try {
            // Animate play button
            Animated.sequence([
                Animated.timing(playButtonScale, {
                    toValue: 0.9,
                    duration: 100,
                    useNativeDriver: false,
                }),
                Animated.timing(playButtonScale, {
                    toValue: 1,
                    duration: 100,
                    useNativeDriver: false,
                }),
            ]).start();

            if (onPlay) {
                await onPlay();
            }
        } catch (error) {
            Logger.error("❌ ModernAudioPlayer playback failed:", error);
            Alert.alert("Playback Error", "Failed to control playback.");
        }
    };

    const handlePause = async () => {
        try {
            if (onPause) {
                await onPause();
            }
        } catch (error) {
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
        if (!onPlaybackRateChange) return;

        const rates = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];
        const currentIndex = rates.indexOf(playbackRate);
        const nextRate = rates[(currentIndex + 1) % rates.length];
        onPlaybackRateChange(nextRate); // Don't await
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

    // Progress bar pan responder
    const panResponder = PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (evt) => {
            setIsDragging(true);
            lastUpdateTimeRef.current = Date.now(); // Reset throttle timer
            const progressWidth = getProgressBarWidth();
            const touchX = evt.nativeEvent.locationX;
            const progress = Math.max(0, Math.min(1, touchX / progressWidth));
            const position = progress * duration;
            setTempPosition(position);
        },
        onPanResponderMove: (evt) => {
            const progressWidth = getProgressBarWidth();
            const touchX = evt.nativeEvent.locationX;
            const progress = Math.max(0, Math.min(1, touchX / progressWidth));
            const position = progress * duration;
            
            // Throttle state updates during drag - only update every 50ms
            // This prevents UI blocking from too many state updates
            const now = Date.now();
            if (now - lastUpdateTimeRef.current > 50) {
                setTempPosition(position);
                lastUpdateTimeRef.current = now;
            }

            // Animation can run more frequently (it's optimized, non-blocking)
            Animated.timing(progressAnimation, {
                toValue: progress,
                duration: 0, // Instant for smooth drag
                useNativeDriver: false, // Can't use native driver for width animations
            }).start();
        },
        onPanResponderRelease: () => {
            setIsDragging(false);
            handleSeek(tempPosition);
        },
    });

    if (compact) {
        return (
            <View
                className={`flex-row items-center bg-panel rounded-lg p-3 ${
                    style || ""
                }`}
            >
                {/* Play/Pause Button */}
                <Animated.View
                    style={{ transform: [{ scale: playButtonScale }] }}
                >
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
                </Animated.View>

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

            {/* Waveform Visualizer */}
            {isPlaying && (
                <View className="mb-4">
                    <WaveformVisualizer
                        isActive={isPlaying}
                        audioData={audioData}
                        useRealData={false}
                        barCount={25}
                        barColor="#D32F2F"
                        minHeight={4}
                        maxHeight={30}
                    />
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
                    <Animated.View
                        style={{ transform: [{ scale: playButtonScale }] }}
                    >
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
                                          shadowOffset: { width: 0, height: 4 },
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
                    </Animated.View>

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
};

export default ModernAudioPlayer;
