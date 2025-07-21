import React, { useState, useEffect } from "react";
import {
    View,
    Text,
    TouchableOpacity,
    Platform,
    Animated,
    Dimensions,
    PanResponder,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

const MiniPlayer = ({
    isVisible = false,
    track = null,
    isPlaying = false,
    onPlayPause,
    onClose,
    onExpand,
    position = { x: 0, y: 0 },
    onPositionChange,
}) => {
    const router = useRouter();
    const [dragPosition] = useState(new Animated.ValueXY(position));
    const [scale] = useState(new Animated.Value(1));
    const [opacity] = useState(new Animated.Value(0));

    useEffect(() => {
        if (isVisible) {
            // Fade in animation
            Animated.timing(opacity, {
                toValue: 1,
                duration: 300,
                useNativeDriver: true,
            }).start();
        } else {
            // Fade out animation
            Animated.timing(opacity, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true,
            }).start();
        }
    }, [isVisible]);

    // Pan responder for dragging
    const panResponder = PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
            // Scale down on touch
            Animated.spring(scale, {
                toValue: 0.95,
                useNativeDriver: true,
            }).start();
        },
        onPanResponderMove: Animated.event(
            [null, { dx: dragPosition.x, dy: dragPosition.y }],
            { useNativeDriver: false }
        ),
        onPanResponderRelease: (evt, gestureState) => {
            // Scale back up
            Animated.spring(scale, {
                toValue: 1,
                useNativeDriver: true,
            }).start();

            // Snap to edges
            const threshold = 50;
            const snapToLeft = gestureState.moveX < screenWidth / 2;
            const snapX = snapToLeft ? 16 : screenWidth - 80 - 16;

            // Keep within screen bounds
            const maxY = screenHeight - 200; // Account for tab bar
            const minY = 100; // Account for status bar
            const snapY = Math.max(
                minY,
                Math.min(maxY, gestureState.moveY - 40)
            );

            Animated.spring(dragPosition, {
                toValue: { x: snapX, y: snapY },
                useNativeDriver: false,
            }).start();

            // Notify parent of position change
            onPositionChange && onPositionChange({ x: snapX, y: snapY });
        },
    });

    const handleExpand = () => {
        // Animate to center and expand
        Animated.parallel([
            Animated.spring(dragPosition, {
                toValue: { x: screenWidth / 2 - 40, y: screenHeight / 2 - 40 },
                useNativeDriver: false,
            }),
            Animated.spring(scale, {
                toValue: 1.2,
                useNativeDriver: true,
            }),
        ]).start(() => {
            // Navigate to full player
            onExpand && onExpand();
        });
    };

    if (!isVisible || !track) {
        return null;
    }

    return (
        <Animated.View
            style={{
                position: "absolute",
                top: 0,
                left: 0,
                transform: [
                    { translateX: dragPosition.x },
                    { translateY: dragPosition.y },
                    { scale },
                ],
                opacity,
                zIndex: 1000,
                // Cross-platform shadow
                ...(Platform.OS === "ios"
                    ? {
                          shadowColor: "#000",
                          shadowOffset: { width: 0, height: 4 },
                          shadowOpacity: 0.3,
                          shadowRadius: 8,
                      }
                    : {
                          elevation: 12,
                      }),
            }}
            {...panResponder.panHandlers}
        >
            <TouchableOpacity
                onPress={handleExpand}
                onLongPress={() => {
                    // Show context menu on long press
                    // Could implement options like: Close, Add to Queue, etc.
                }}
                activeOpacity={0.9}
                style={{
                    width: 80,
                    height: 80,
                    borderRadius: 40,
                    backgroundColor: "#1A1A1A",
                    borderWidth: 2,
                    borderColor: "#D32F2F",
                    overflow: "hidden",
                }}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel={`Mini player: ${track.title} by ${track.artist}`}
                accessibilityHint="Tap to expand player, drag to move"
            >
                {/* Background Gradient Effect */}
                <View
                    style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: "rgba(211, 47, 47, 0.1)",
                    }}
                />

                {/* Album Art Placeholder */}
                <View
                    style={{
                        position: "absolute",
                        top: 8,
                        left: 8,
                        right: 8,
                        bottom: 8,
                        borderRadius: 32,
                        backgroundColor: "#2A2A2A",
                        alignItems: "center",
                        justifyContent: "center",
                    }}
                >
                    <MaterialCommunityIcons
                        name="music-note"
                        size={24}
                        color="#888888"
                    />
                </View>

                {/* Play/Pause Overlay */}
                <View
                    style={{
                        position: "absolute",
                        bottom: -2,
                        right: -2,
                        width: 28,
                        height: 28,
                        borderRadius: 14,
                        backgroundColor: "#D32F2F",
                        borderWidth: 2,
                        borderColor: "#1A1A1A",
                        alignItems: "center",
                        justifyContent: "center",
                    }}
                >
                    <TouchableOpacity
                        onPress={(e) => {
                            e.stopPropagation();
                            onPlayPause && onPlayPause();
                        }}
                        style={{
                            width: "100%",
                            height: "100%",
                            alignItems: "center",
                            justifyContent: "center",
                        }}
                        accessible={true}
                        accessibilityRole="button"
                        accessibilityLabel={isPlaying ? "Pause" : "Play"}
                    >
                        <MaterialCommunityIcons
                            name={isPlaying ? "pause" : "play"}
                            size={16}
                            color="white"
                        />
                    </TouchableOpacity>
                </View>

                {/* Close Button */}
                <TouchableOpacity
                    onPress={(e) => {
                        e.stopPropagation();
                        onClose && onClose();
                    }}
                    style={{
                        position: "absolute",
                        top: -2,
                        right: -2,
                        width: 20,
                        height: 20,
                        borderRadius: 10,
                        backgroundColor: "#666666",
                        borderWidth: 1,
                        borderColor: "#1A1A1A",
                        alignItems: "center",
                        justifyContent: "center",
                    }}
                    accessible={true}
                    accessibilityRole="button"
                    accessibilityLabel="Close mini player"
                >
                    <MaterialCommunityIcons
                        name="close"
                        size={12}
                        color="white"
                    />
                </TouchableOpacity>

                {/* Progress Ring (optional) */}
                {isPlaying && (
                    <View
                        style={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            borderRadius: 40,
                            borderWidth: 2,
                            borderColor: "transparent",
                            borderTopColor: "#D32F2F",
                            // Could animate this based on playback progress
                        }}
                    />
                )}
            </TouchableOpacity>

            {/* Track Info (appears on hover/long press) */}
            {/* This could be implemented as a tooltip */}
        </Animated.View>
    );
};

export default MiniPlayer;
