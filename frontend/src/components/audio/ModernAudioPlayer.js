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
import { Audio } from "expo-av";
import Logger from "../../utils/logger";
import WaveformVisualizer from "./WaveformVisualizer";

const { width: screenWidth } = Dimensions.get("window");

const ModernAudioPlayer = ({
    uri,
    title = "Unknown Track",
    artist = "Unknown Artist",
    duration = 0,
    autoPlay = false,
    onPlayStateChange,
    onProgressChange,
    style,
    compact = false,
    showProgress = true,
    showControls = true,
}) => {
    // Playback state
    const [isPlaying, setIsPlaying] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [currentPosition, setCurrentPosition] = useState(0);
    const [totalDuration, setTotalDuration] = useState(duration);
    const [playbackRate, setPlaybackRate] = useState(1.0);
    const [volume, setVolume] = useState(1.0);

    // Animation values (avoiding native driver conflicts)
    const [playButtonScale] = useState(new Animated.Value(1));
    const progressAnimation = useRef(new Animated.Value(0)).current;
    const volumeAnimation = useRef(new Animated.Value(1)).current;

    // Progress bar interaction
    const [isDragging, setIsDragging] = useState(false);
    const [tempPosition, setTempPosition] = useState(0);
    const [audioData, setAudioData] = useState(null); // For real waveform visualization

    // Generate simulated audio data for waveform visualization
    const generateSimulatedAudioData = () => {
        const dataLength = 1000; // Simulate 1000 audio samples
        const audioData = [];

        for (let i = 0; i < dataLength; i++) {
            // Generate a sine wave with some variation
            const frequency = 440 + Math.sin(i * 0.01) * 100; // Varying frequency
            const amplitude =
                Math.sin(i * frequency * 0.01) * (0.5 + Math.random() * 0.5);
            audioData.push(amplitude);
        }

        return audioData;
    };

    // Demo implementation - replace with expo-audio when available
    useEffect(() => {
        if (autoPlay) {
            handlePlay();
        }
    }, [autoPlay]);

    const handlePlay = async () => {
        try {
            Logger.log("🎵 ModernAudioPlayer: Starting playback (demo mode)");

            // Generate simulated audio data for waveform visualization
            if (!isPlaying) {
                setAudioData(generateSimulatedAudioData());
            }

            // Animate play button
            Animated.sequence([
                Animated.timing(playButtonScale, {
                    toValue: 0.9,
                    duration: 100,
                    useNativeDriver: false, // Avoid conflicts
                }),
                Animated.timing(playButtonScale, {
                    toValue: 1,
                    duration: 100,
                    useNativeDriver: false,
                }),
            ]).start();

            setIsPlaying(!isPlaying);
            onPlayStateChange && onPlayStateChange(!isPlaying);

            // Demo progress simulation (no real audio for now)
            if (!isPlaying) {
                startProgressSimulation();
            }
        } catch (error) {
            Logger.error("❌ ModernAudioPlayer playback failed:", error);
            Alert.alert("Playback Error", "Failed to control playback.");
        }
    };

    const startProgressSimulation = () => {
        // Demo progress for testing
        const interval = setInterval(() => {
            setCurrentPosition((prev) => {
                const newPos = prev + 1000; // 1 second
                if (newPos >= totalDuration) {
                    clearInterval(interval);
                    setIsPlaying(false);
                    setCurrentPosition(0);
                    return 0;
                }

                // Update progress animation smoothly
                const progress = newPos / totalDuration;
                Animated.timing(progressAnimation, {
                    toValue: progress,
                    duration: 100,
                    useNativeDriver: false,
                }).start();

                return newPos;
            });
        }, 1000);

        return () => clearInterval(interval);
    };

    const handleSeek = async (position) => {
        if (totalDuration === 0) return;

        try {
            const seekPosition = Math.max(0, Math.min(position, totalDuration));
            setCurrentPosition(seekPosition);

            const progress = seekPosition / totalDuration;
            Animated.timing(progressAnimation, {
                toValue: progress,
                duration: 200,
                useNativeDriver: false,
            }).start();
        } catch (error) {
            Logger.error("Seek failed:", error);
        }
    };

    const handleSkip = async (direction) => {
        const skipAmount = 15000; // 15 seconds
        const newPosition =
            direction === "forward"
                ? currentPosition + skipAmount
                : currentPosition - skipAmount;

        await handleSeek(newPosition);
    };

    const handleSpeedChange = async (rate) => {
        setPlaybackRate(rate);
        // In real implementation, update audio playback rate
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
            const progressWidth = getProgressBarWidth();
            const touchX = evt.nativeEvent.locationX;
            const progress = Math.max(0, Math.min(1, touchX / progressWidth));
            const position = progress * totalDuration;
            setTempPosition(position);
        },
        onPanResponderMove: (evt) => {
            const progressWidth = getProgressBarWidth();
            const touchX = evt.nativeEvent.locationX;
            const progress = Math.max(0, Math.min(1, touchX / progressWidth));
            const position = progress * totalDuration;
            setTempPosition(position);

            Animated.timing(progressAnimation, {
                toValue: progress,
                duration: 50,
                useNativeDriver: false,
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
                className={`flex-row items-center bg-panel rounded-lg p-3 ${style}`}
            >
                {/* Play/Pause Button */}
                <Animated.View
                    style={{ transform: [{ scale: playButtonScale }] }}
                >
                    <TouchableOpacity
                        onPress={handlePlay}
                        disabled={isLoading}
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
                            {formatTime(currentPosition)}
                        </Text>
                    </View>
                )}
            </View>
        );
    }

    return (
        <View className={`bg-panel rounded-lg p-4 ${style}`}>
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
                            {formatTime(totalDuration)}
                        </Text>
                    </View>
                </View>
            )}

            {/* Waveform Visualizer */}
            <View className="mb-4">
                <WaveformVisualizer
                    isActive={isPlaying}
                    audioData={audioData}
                    useRealData={!!audioData}
                    barCount={25}
                    barColor="#D32F2F"
                    minHeight={4}
                    maxHeight={30}
                />
            </View>

            {/* Main Controls */}
            {showControls && (
                <View className="flex-row items-center justify-center space-x-8 mb-4">
                    {/* Skip Backward */}
                    <TouchableOpacity
                        onPress={() => handleSkip("backward")}
                        disabled={isLoading}
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
                            onPress={handlePlay}
                            disabled={isLoading}
                            style={{
                                width: 64,
                                height: 64,
                                borderRadius: 32,
                                backgroundColor: "#D32F2F",
                                alignItems: "center",
                                justifyContent: "center",
                                // Cross-platform shadow
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
                        disabled={isLoading}
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
                        onPress={() => {
                            const rates = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];
                            const currentIndex = rates.indexOf(playbackRate);
                            const nextRate =
                                rates[(currentIndex + 1) % rates.length];
                            handleSpeedChange(nextRate);
                        }}
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
                            onPress={() => {
                                const newVolume = volume === 1.0 ? 0.5 : 1.0;
                                setVolume(newVolume);
                            }}
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
