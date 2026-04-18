import React, { useEffect, useRef } from "react";
import { View, Text, TouchableOpacity, Animated, Platform, Dimensions } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import useViewModeStore from "../context/useViewModeStore";
import useAudioStore from "../context/useAudioStore";
import useAuthStore from "../context/useAuthStore";
import hapticFeedback from "../services/haptics/hapticFeedback";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

/**
 * HeroSection - Dynamic hero that adapts to user mode and context
 * 
 * Modes:
 * - Discover Mode: Continue listening, featured content
 * - Studio Mode: Quick record CTA, latest episode stats
 */

const HeroSection = ({ onRecordPress, onContinueListening, onFeaturedPress, userPodcasts = [] }) => {
    const { viewMode } = useViewModeStore();
    const { currentTrack, lastPlayedAt, position, duration } = useAudioStore();
    const { user } = useAuthStore();
    
    const fadeAnim = useRef(new Animated.Value(1)).current;
    const scaleAnim = useRef(new Animated.Value(1)).current;

    // Animate on mode change
    useEffect(() => {
        Animated.sequence([
            Animated.timing(fadeAnim, {
                toValue: 0,
                duration: 150,
                useNativeDriver: true,
            }),
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 150,
                useNativeDriver: true,
            }),
        ]).start();
    }, [viewMode]);

    // Pulse animation for CTA
    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(scaleAnim, {
                    toValue: 1.02,
                    duration: 1000,
                    useNativeDriver: true,
                }),
                Animated.timing(scaleAnim, {
                    toValue: 1,
                    duration: 1000,
                    useNativeDriver: true,
                }),
            ])
        ).start();
    }, []);

    const handleHaptic = () => {
        void hapticFeedback.impact("medium");
    };

    if (viewMode === "studio") {
        // CREATOR/STUDIO HERO
        const latestPodcast = userPodcasts[0];
        
        return (
            <Animated.View style={{ opacity: fadeAnim, marginBottom: 20 }}>
                <LinearGradient
                    colors={["#D32F2F", "#B71C1C"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{
                        borderRadius: 24,
                        overflow: "hidden",
                        minHeight: 200,
                        padding: 24,
                        // Shadow
                        ...(Platform.OS === "ios"
                            ? {
                                  shadowColor: "#D32F2F",
                                  shadowOffset: { width: 0, height: 12 },
                                  shadowOpacity: 0.4,
                                  shadowRadius: 16,
                              }
                            : {
                                  elevation: 12,
                              }),
                    }}
                >
                    {/* Top Badge */}
                    <View style={{ marginBottom: 16 }}>
                        <BlurView
                            intensity={20}
                            tint="light"
                            style={{
                                alignSelf: "flex-start",
                                flexDirection: "row",
                                alignItems: "center",
                                paddingHorizontal: 12,
                                paddingVertical: 6,
                                borderRadius: 20,
                                overflow: "hidden",
                                backgroundColor: "rgba(255, 255, 255, 0.2)",
                            }}
                        >
                            <MaterialCommunityIcons name="robot" size={14} color="white" />
                            <Text
                                style={{
                                    color: "white",
                                    fontSize: 11,
                                    fontWeight: "700",
                                    marginLeft: 6,
                                    letterSpacing: 0.5,
                                }}
                            >
                                AI-POWERED STUDIO
                            </Text>
                        </BlurView>
                    </View>

                    {/* Main Content */}
                    <View style={{ flex: 1, justifyContent: "center" }}>
                        <MaterialCommunityIcons
                            name="microphone-variant"
                            size={48}
                            color="rgba(255, 255, 255, 0.3)"
                            style={{ position: "absolute", right: 0, top: -10 }}
                        />
                        
                        <Text
                            style={{
                                color: "white",
                                fontSize: 28,
                                fontWeight: "800",
                                marginBottom: 8,
                                lineHeight: 34,
                            }}
                        >
                            Create Your{"\n"}Next Episode
                        </Text>
                        
                        <Text
                            style={{
                                color: "rgba(255, 255, 255, 0.9)",
                                fontSize: 14,
                                marginBottom: 20,
                                lineHeight: 20,
                            }}
                        >
                            Record with AI enhancement, auto-transcription, and smart editing
                        </Text>

                        {/* CTA Button */}
                        <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
                            <TouchableOpacity
                                onPress={() => {
                                    handleHaptic();
                                    onRecordPress?.();
                                }}
                                style={{
                                    backgroundColor: "white",
                                    flexDirection: "row",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    paddingVertical: 16,
                                    paddingHorizontal: 24,
                                    borderRadius: 16,
                                    // Shadow
                                    ...(Platform.OS === "ios"
                                        ? {
                                              shadowColor: "#000",
                                              shadowOffset: { width: 0, height: 8 },
                                              shadowOpacity: 0.3,
                                              shadowRadius: 12,
                                          }
                                        : {
                                              elevation: 8,
                                          }),
                                }}
                                activeOpacity={0.8}
                            >
                                <MaterialCommunityIcons
                                    name="record-circle"
                                    size={24}
                                    color="#D32F2F"
                                />
                                <Text
                                    style={{
                                        color: "#D32F2F",
                                        fontSize: 16,
                                        fontWeight: "700",
                                        marginLeft: 10,
                                        letterSpacing: 0.5,
                                    }}
                                >
                                    START RECORDING
                                </Text>
                            </TouchableOpacity>
                        </Animated.View>

                        {/* Stats Row */}
                        {latestPodcast && (
                            <View
                                style={{
                                    marginTop: 20,
                                    paddingTop: 20,
                                    borderTopWidth: 1,
                                    borderTopColor: "rgba(255, 255, 255, 0.2)",
                                }}
                            >
                                <Text
                                    style={{
                                        color: "rgba(255, 255, 255, 0.8)",
                                        fontSize: 12,
                                        marginBottom: 8,
                                    }}
                                >
                                    Your latest episode:
                                </Text>
                                <Text
                                    style={{
                                        color: "white",
                                        fontSize: 14,
                                        fontWeight: "600",
                                        marginBottom: 8,
                                    }}
                                    numberOfLines={1}
                                >
                                    {latestPodcast.title}
                                </Text>
                                <View style={{ flexDirection: "row", gap: 16 }}>
                                    <View style={{ flexDirection: "row", alignItems: "center" }}>
                                        <MaterialCommunityIcons
                                            name="eye-outline"
                                            size={14}
                                            color="rgba(255, 255, 255, 0.9)"
                                        />
                                        <Text
                                            style={{
                                                color: "rgba(255, 255, 255, 0.9)",
                                                fontSize: 12,
                                                marginLeft: 4,
                                            }}
                                        >
                                            {latestPodcast.play_count || 0} plays
                                        </Text>
                                    </View>
                                    <View style={{ flexDirection: "row", alignItems: "center" }}>
                                        <MaterialCommunityIcons
                                            name="heart-outline"
                                            size={14}
                                            color="rgba(255, 255, 255, 0.9)"
                                        />
                                        <Text
                                            style={{
                                                color: "rgba(255, 255, 255, 0.9)",
                                                fontSize: 12,
                                                marginLeft: 4,
                                            }}
                                        >
                                            {latestPodcast.like_count || 0} likes
                                        </Text>
                                    </View>
                                </View>
                            </View>
                        )}
                    </View>
                </LinearGradient>
            </Animated.View>
        );
    }

    // DISCOVER/LISTENER HERO
    return (
        <Animated.View style={{ opacity: fadeAnim, marginBottom: 20 }}>
            {currentTrack && lastPlayedAt ? (
                // Continue Listening Card
                <TouchableOpacity
                    onPress={() => {
                        handleHaptic();
                        onContinueListening?.();
                    }}
                    activeOpacity={0.9}
                >
                    <LinearGradient
                        colors={["#667eea", "#764ba2"]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={{
                            borderRadius: 24,
                            padding: 20,
                            minHeight: 160,
                            // Shadow
                            ...(Platform.OS === "ios"
                                ? {
                                      shadowColor: "#667eea",
                                      shadowOffset: { width: 0, height: 12 },
                                      shadowOpacity: 0.4,
                                      shadowRadius: 16,
                                  }
                                : {
                                      elevation: 12,
                                  }),
                        }}
                    >
                        {/* Top Badge */}
                        <View style={{ marginBottom: 12 }}>
                            <BlurView
                                intensity={20}
                                tint="light"
                                style={{
                                    alignSelf: "flex-start",
                                    flexDirection: "row",
                                    alignItems: "center",
                                    paddingHorizontal: 12,
                                    paddingVertical: 6,
                                    borderRadius: 20,
                                    overflow: "hidden",
                                    backgroundColor: "rgba(255, 255, 255, 0.2)",
                                }}
                            >
                                <MaterialCommunityIcons name="play-circle" size={14} color="white" />
                                <Text
                                    style={{
                                        color: "white",
                                        fontSize: 11,
                                        fontWeight: "700",
                                        marginLeft: 6,
                                        letterSpacing: 0.5,
                                    }}
                                >
                                    CONTINUE LISTENING
                                </Text>
                            </BlurView>
                        </View>

                        {/* Track Info */}
                        <Text
                            style={{
                                color: "white",
                                fontSize: 20,
                                fontWeight: "700",
                                marginBottom: 6,
                            }}
                            numberOfLines={2}
                        >
                            {currentTrack.title}
                        </Text>
                        <Text
                            style={{
                                color: "rgba(255, 255, 255, 0.9)",
                                fontSize: 14,
                                marginBottom: 16,
                            }}
                            numberOfLines={1}
                        >
                            {currentTrack.artist}
                        </Text>

                        {/* Progress Indicator */}
                        <View
                            style={{
                                height: 4,
                                backgroundColor: "rgba(255, 255, 255, 0.3)",
                                borderRadius: 2,
                                overflow: "hidden",
                            }}
                        >
                            <View
                                style={{
                                    height: "100%",
                                    width: duration > 0 ? `${Math.min((position / duration) * 100, 100)}%` : "0%",
                                    backgroundColor: "white",
                                }}
                            />
                        </View>
                    </LinearGradient>
                </TouchableOpacity>
            ) : (
                // Welcome/Featured Card
                <LinearGradient
                    colors={["#4facfe", "#00f2fe"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{
                        borderRadius: 24,
                        padding: 24,
                        minHeight: 180,
                        // Shadow
                        ...(Platform.OS === "ios"
                            ? {
                                  shadowColor: "#4facfe",
                                  shadowOffset: { width: 0, height: 12 },
                                  shadowOpacity: 0.4,
                                  shadowRadius: 16,
                              }
                            : {
                                  elevation: 12,
                              }),
                    }}
                >
                    <MaterialCommunityIcons
                        name="waveform"
                        size={64}
                        color="rgba(255, 255, 255, 0.3)"
                        style={{ position: "absolute", right: 20, top: 20 }}
                    />
                    
                    <Text
                        style={{
                            color: "white",
                            fontSize: 16,
                            fontWeight: "600",
                            marginBottom: 8,
                        }}
                    >
                        Welcome back, {user?.name?.split(" ")[0] || "there"}! 👋
                    </Text>
                    
                    <Text
                        style={{
                            color: "white",
                            fontSize: 26,
                            fontWeight: "800",
                            marginBottom: 12,
                            lineHeight: 32,
                        }}
                    >
                        Discover{"\n"}Amazing Podcasts
                    </Text>
                    
                    <Text
                        style={{
                            color: "rgba(255, 255, 255, 0.95)",
                            fontSize: 14,
                            lineHeight: 20,
                        }}
                    >
                        AI-curated content just for you
                    </Text>
                </LinearGradient>
            )}
        </Animated.View>
    );
};

export default HeroSection;
