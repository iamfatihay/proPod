import React, { useState, useEffect } from "react";
import {
    View,
    Text,
    TouchableOpacity,
    Image,
    Animated,
    Dimensions,
    Platform,
} from "react-native";
import { MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import useAudioStore from "../../context/useAudioStore";

const { width: screenWidth } = Dimensions.get("window");

/**
 * Modern bottom-anchored mini player (YouTube Music / Spotify style)
 * - Always visible at bottom when playing
 * - Tap to expand to full player
 * - Smooth animations
 * - Progress indicator
 * 
 * PERFORMANCE: Subscribes to position/duration internally to avoid
 * re-rendering parent components on frequent updates (10x/sec)
 */
const BottomMiniPlayer = ({
    isVisible = false,
    track = null,
    isPlaying = false,
    bottomOffset = 84,
    onPlayPause,
    onNext,
    onClose,
    onExpand,
}) => {
    const router = useRouter();

    // Subscribe to fast-changing state only in this component
    const position = useAudioStore((state) => state.position);
    const duration = useAudioStore((state) => state.duration);
    const [slideAnim] = useState(new Animated.Value(100));
    const [progressAnim] = useState(new Animated.Value(0));

    // Slide up animation when visible
    useEffect(() => {
        Animated.spring(slideAnim, {
            toValue: isVisible ? 0 : 100,
            useNativeDriver: true,
            tension: 65,
            friction: 10,
        }).start();
    }, [isVisible]);

    // Progress animation
    useEffect(() => {
        if (duration > 0) {
            const progress = (position / duration) * 100;
            Animated.timing(progressAnim, {
                toValue: progress,
                duration: 100,
                useNativeDriver: false,
            }).start();
        }
    }, [position, duration]);

    const progressWidth = progressAnim.interpolate({
        inputRange: [0, 100],
        outputRange: ["0%", "100%"],
    });

    const formatTime = (ms) => {
        const totalSeconds = Math.floor(ms / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes}:${seconds.toString().padStart(2, "0")}`;
    };

    if (!isVisible || !track) {
        return null;
    }

    return (
        <Animated.View
            style={{
                position: "absolute",
                bottom: bottomOffset,
                left: 0,
                right: 0,
                transform: [{ translateY: slideAnim }],
                // Shadow for elevation
                ...(Platform.OS === "ios"
                    ? {
                        shadowColor: "#000",
                        shadowOffset: { width: 0, height: -4 },
                        shadowOpacity: 0.3,
                        shadowRadius: 8,
                    }
                    : {}),
            }}
        >
            {/* Progress Bar */}
            <View
                style={{
                    height: 2,
                    backgroundColor: "rgba(255, 255, 255, 0.1)",
                }}
            >
                <Animated.View
                    style={{
                        height: "100%",
                        width: progressWidth,
                        backgroundColor: "#D32F2F",
                    }}
                />
            </View>

            {/* Main Player Container */}
            <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => {
                    // Navigate to full player
                    router.push({
                        pathname: "/(main)/details",
                        params: { id: track.id },
                    });
                }}
                style={{
                    backgroundColor: "#1E1E1E",
                    borderTopWidth: 1,
                    borderTopColor: "rgba(255, 255, 255, 0.05)",
                }}
            >
                <View
                    style={{
                        flexDirection: "row",
                        alignItems: "center",
                        paddingHorizontal: 16,
                        paddingVertical: 12,
                        gap: 12,
                    }}
                >
                    {/* Album Art */}
                    <View
                        style={{
                            width: 48,
                            height: 48,
                            borderRadius: 8,
                            backgroundColor: "#2A2A2A",
                            overflow: "hidden",
                            alignItems: "center",
                            justifyContent: "center",
                        }}
                    >
                        {track.artwork ? (
                            <Image
                                source={{ uri: track.artwork }}
                                style={{
                                    width: "100%",
                                    height: "100%",
                                }}
                                resizeMode="cover"
                            />
                        ) : (
                            <MaterialCommunityIcons
                                name="music-note"
                                size={24}
                                color="#888888"
                            />
                        )}
                    </View>

                    {/* Track Info */}
                    <View
                        style={{
                            flex: 1,
                            justifyContent: "center",
                            marginRight: 8,
                        }}
                    >
                        <Text
                            style={{
                                fontSize: 14,
                                fontWeight: "600",
                                color: "#FFFFFF",
                                marginBottom: 2,
                            }}
                            numberOfLines={1}
                            ellipsizeMode="tail"
                        >
                            {track.title}
                        </Text>
                        <Text
                            style={{
                                fontSize: 12,
                                color: "#AAAAAA",
                            }}
                            numberOfLines={1}
                            ellipsizeMode="tail"
                        >
                            {track.artist || "Unknown Artist"}
                        </Text>
                    </View>

                    {/* Control Buttons */}
                    <View
                        style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 4,
                        }}
                    >
                        {/* Play/Pause Button */}
                        <TouchableOpacity
                            onPress={(e) => {
                                e.stopPropagation();
                                onPlayPause && onPlayPause();
                            }}
                            style={{
                                width: 40,
                                height: 40,
                                borderRadius: 20,
                                backgroundColor: "rgba(211, 47, 47, 0.1)",
                                alignItems: "center",
                                justifyContent: "center",
                            }}
                            hitSlop={{
                                top: 10,
                                bottom: 10,
                                left: 10,
                                right: 10,
                            }}
                        >
                            <Ionicons
                                name={isPlaying ? "pause" : "play"}
                                size={24}
                                color="#D32F2F"
                            />
                        </TouchableOpacity>

                        {/* Next Button */}
                        {onNext && (
                            <TouchableOpacity
                                onPress={(e) => {
                                    e.stopPropagation();
                                    onNext && onNext();
                                }}
                                style={{
                                    width: 40,
                                    height: 40,
                                    alignItems: "center",
                                    justifyContent: "center",
                                }}
                                hitSlop={{
                                    top: 10,
                                    bottom: 10,
                                    left: 10,
                                    right: 10,
                                }}
                            >
                                <Ionicons
                                    name="play-skip-forward"
                                    size={20}
                                    color="#CCCCCC"
                                />
                            </TouchableOpacity>
                        )}

                        {/* Close Button */}
                        <TouchableOpacity
                            onPress={(e) => {
                                e.stopPropagation();
                                onClose && onClose();
                            }}
                            style={{
                                width: 40,
                                height: 40,
                                alignItems: "center",
                                justifyContent: "center",
                            }}
                            hitSlop={{
                                top: 10,
                                bottom: 10,
                                left: 10,
                                right: 10,
                            }}
                        >
                            <Ionicons name="close" size={20} color="#888888" />
                        </TouchableOpacity>
                    </View>
                </View>
            </TouchableOpacity>
        </Animated.View>
    );
};

export default React.memo(BottomMiniPlayer);
