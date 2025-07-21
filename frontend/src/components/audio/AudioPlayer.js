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
import AudioService from "../../services/audio/AudioService";

const { width: screenWidth } = Dimensions.get("window");

const AudioPlayer = ({
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
    const [sound, setSound] = useState(null);
    const [playbackRate, setPlaybackRate] = useState(1.0);
    const [volume, setVolume] = useState(1.0);

    // Animation values
    const [playButtonScale] = useState(new Animated.Value(1));
    const progressAnimation = useRef(new Animated.Value(0)).current;
    const volumeAnimation = useRef(new Animated.Value(1)).current;

    // Progress bar interaction
    const [isDragging, setIsDragging] = useState(false);
    const [tempPosition, setTempPosition] = useState(0);

    useEffect(() => {
        setupAudio();
        return () => {
            cleanupAudio();
        };
    }, [uri]);

    useEffect(() => {
        if (autoPlay && sound) {
            handlePlay();
        }
    }, [sound, autoPlay]);

    const setupAudio = async () => {
        try {
            setIsLoading(true);

            // Configure audio session for playback
            await Audio.setAudioModeAsync({
                allowsRecordingIOS: false,
                staysActiveInBackground: true,
                playsInSilentModeIOS: true,
                shouldDuckAndroid: true,
                playThroughEarpieceAndroid: false,
                interruptionModeIOS: Audio.INTERRUPTION_MODE_IOS_DO_NOT_MIX,
                interruptionModeAndroid:
                    Audio.INTERRUPTION_MODE_ANDROID_DO_NOT_MIX,
            });

            const { sound: newSound } = await Audio.Sound.createAsync(
                { uri },
                {
                    shouldPlay: false,
                    isLooping: false,
                    volume: volume,
                    rate: playbackRate,
                    shouldCorrectPitch: true,
                },
                onPlaybackStatusUpdate
            );

            setSound(newSound);
        } catch (error) {
            console.error("Audio setup failed:", error);
            Alert.alert(
                "Playback Error",
                "Failed to load audio. Please check your connection and try again.",
                [{ text: "OK" }]
            );
        } finally {
            setIsLoading(false);
        }
    };

    const cleanupAudio = async () => {
        if (sound) {
            try {
                await sound.unloadAsync();
                setSound(null);
            } catch (error) {
                console.error("Audio cleanup failed:", error);
            }
        }
    };

    const onPlaybackStatusUpdate = (status) => {
        if (status.isLoaded) {
            setCurrentPosition(status.positionMillis || 0);
            setTotalDuration(status.durationMillis || duration);
            setIsPlaying(status.isPlaying || false);

            // Update progress animation if not dragging
            if (!isDragging && status.durationMillis > 0) {
                const progress =
                    (status.positionMillis || 0) / status.durationMillis;
                progressAnimation.setValue(progress);
            }

            // Notify parent component
            onPlayStateChange && onPlayStateChange(status.isPlaying);
            onProgressChange &&
                onProgressChange(status.positionMillis, status.durationMillis);

            // Handle playback completion
            if (status.didJustFinish) {
                setIsPlaying(false);
                setCurrentPosition(0);
                progressAnimation.setValue(0);
            }
        }
    };

    const handlePlay = async () => {
        if (!sound) return;

        try {
            // Animate play button
            Animated.sequence([
                Animated.timing(playButtonScale, {
                    toValue: 0.9,
                    duration: 100,
                    useNativeDriver: true,
                }),
                Animated.timing(playButtonScale, {
                    toValue: 1,
                    duration: 100,
                    useNativeDriver: true,
                }),
            ]).start();

            if (isPlaying) {
                await sound.pauseAsync();
            } else {
                await sound.playAsync();
            }
        } catch (error) {
            console.error("Playback control failed:", error);
            Alert.alert("Playback Error", "Failed to control playback.");
        }
    };

    const handleSeek = async (position) => {
        if (!sound || totalDuration === 0) return;

        try {
            const seekPosition = Math.max(0, Math.min(position, totalDuration));
            await sound.setPositionAsync(seekPosition);
            setCurrentPosition(seekPosition);
        } catch (error) {
            console.error("Seek failed:", error);
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
        if (!sound) return;

        try {
            await sound.setRateAsync(rate, true);
            setPlaybackRate(rate);
        } catch (error) {
            console.error("Speed change failed:", error);
        }
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
            progressAnimation.setValue(progress);
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
                        {isLoading ? (
                            <MaterialCommunityIcons
                                name="loading"
                                size={32}
                                color="#D32F2F"
                            />
                        ) : (
                            <MaterialCommunityIcons
                                name={
                                    isPlaying ? "pause-circle" : "play-circle"
                                }
                                size={32}
                                color="#D32F2F"
                            />
                        )}
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
                            name="replay-15"
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
                            {isLoading ? (
                                <MaterialCommunityIcons
                                    name="loading"
                                    size={32}
                                    color="white"
                                />
                            ) : (
                                <MaterialCommunityIcons
                                    name={isPlaying ? "pause" : "play"}
                                    size={32}
                                    color="white"
                                />
                            )}
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
                            name="forward-15"
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
                                sound?.setVolumeAsync(newVolume);
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

export default AudioPlayer;
