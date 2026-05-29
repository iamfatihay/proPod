import React from "react";
import { TouchableOpacity, View, Text, Platform, Image, ImageBackground } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";

/**
 * GradientCard - Modern, glassmorphism-style card with gradient backgrounds
 *
 * Features:
 * - Dynamic gradient colors based on category/theme
 * - Glassmorphism effect with blur
 * - AI badge support
 * - Play button overlay
 * - Responsive sizing
 */

// Predefined gradient themes
const GRADIENT_THEMES = {
    technology: ["#667eea", "#764ba2"],
    business: ["#f093fb", "#f5576c"],
    health: ["#4facfe", "#00f2fe"],
    science: ["#43e97b", "#38f9d7"],
    education: ["#fa709a", "#fee140"],
    entertainment: ["#30cfd0", "#330867"],
    food: ["#ff9a9e", "#fecfef"],
    default: ["#667eea", "#764ba2"],
    creator: ["#D32F2F", "#FF6B6B"],
    ai: ["#00f2fe", "#4facfe"],
};

const GradientCard = ({
    podcast,
    onPress,
    onPlayPress,
    isPlaying = false,
    category = "default",
    size = "medium", // 'small' | 'medium' | 'large'
    showAIBadge = true,
    showPlayButton = true,
    style,
}) => {
    // Determine gradient colors — guard against null/undefined category
    const gradientColors =
        GRADIENT_THEMES[(category ?? "default").toLowerCase()] || GRADIENT_THEMES.default;

    // Responsive sizing
    const cardSizes = {
        small: { width: 140, height: 140 },
        medium: { width: 180, height: 220 },
        large: { width: "100%", height: 260 },
    };

    const dimensions = cardSizes[size];

    const cardStyle = {
        width: dimensions.width,
        height: dimensions.height,
        borderRadius: 20,
        overflow: "hidden",
        marginRight: size !== "large" ? 16 : 0,
        marginBottom: 16,
        ...(Platform.OS === "ios"
            ? {
                  shadowColor: gradientColors[0],
                  shadowOffset: { width: 0, height: 8 },
                  shadowOpacity: 0.3,
                  shadowRadius: 16,
              }
            : {
                  elevation: 8,
              }),
    };

    // Shared bottom content (title, artist, duration + play button)
    const BottomContent = () => (
        <View>
            {/* AI Badge */}
            {showAIBadge && podcast?.ai_enhanced && (
                <View style={{ alignSelf: "flex-start", marginBottom: 8 }}>
                    <BlurView
                        intensity={20}
                        tint="light"
                        style={{
                            paddingHorizontal: 8,
                            paddingVertical: 4,
                            borderRadius: 20,
                            overflow: "hidden",
                            backgroundColor: "rgba(255, 255, 255, 0.2)",
                        }}
                    >
                        <Text
                            style={{
                                color: "white",
                                fontSize: 10,
                                fontWeight: "600",
                            }}
                        >
                            AI Enhanced
                        </Text>
                    </BlurView>
                </View>
            )}
            <Text
                style={{
                    color: "white",
                    fontSize: size === "small" ? 14 : 16,
                    fontWeight: "700",
                    marginBottom: 4,
                }}
                numberOfLines={2}
            >
                {podcast?.title || "Untitled"}
            </Text>
            <Text
                style={{
                    color: "rgba(255, 255, 255, 0.9)",
                    fontSize: size === "small" ? 12 : 13,
                    fontWeight: "500",
                    marginBottom: 8,
                }}
                numberOfLines={1}
            >
                {podcast?.owner?.name || "Unknown Artist"}
            </Text>
            <View
                style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                }}
            >
                <Text
                    style={{
                        color: "rgba(255, 255, 255, 0.8)",
                        fontSize: 11,
                        fontWeight: "600",
                    }}
                >
                    {podcast?.duration
                        ? `${Math.floor(podcast.duration / 60000)}:${String(
                              Math.floor((podcast.duration % 60000) / 1000)
                          ).padStart(2, "0")}`
                        : "0:00"}
                </Text>
                {showPlayButton && onPlayPress && (
                    <TouchableOpacity
                        onPress={(e) => {
                            e.stopPropagation();
                            onPlayPress();
                        }}
                        style={{
                            width: 36,
                            height: 36,
                            borderRadius: 18,
                            backgroundColor: "rgba(255, 255, 255, 0.9)",
                            justifyContent: "center",
                            alignItems: "center",
                            ...(Platform.OS === "ios" && {
                                shadowColor: "#000",
                                shadowOffset: { width: 0, height: 4 },
                                shadowOpacity: 0.3,
                                shadowRadius: 8,
                            }),
                        }}
                        accessible={true}
                        accessibilityRole="button"
                        accessibilityLabel={isPlaying ? "Pause" : "Play"}
                    >
                        <MaterialCommunityIcons
                            name={isPlaying ? "pause" : "play"}
                            size={18}
                            color={gradientColors[0]}
                        />
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );

    return (
        <TouchableOpacity
            activeOpacity={0.85}
            onPress={onPress}
            style={[cardStyle, style]}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel={`Podcast: ${podcast?.title || "Unknown"}`}
        >
            {podcast?.thumbnail_url ? (
                /* Full-bleed thumbnail — gradient sits behind so broken images never go black */
                <LinearGradient
                    colors={gradientColors}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{ flex: 1 }}
                >
                    <ImageBackground
                        source={{ uri: podcast.thumbnail_url }}
                        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
                        resizeMode="cover"
                    />
                    <LinearGradient
                        colors={["transparent", "rgba(0,0,0,0.85)"]}
                        start={{ x: 0, y: 0.3 }}
                        end={{ x: 0, y: 1 }}
                        style={{ flex: 1, justifyContent: "flex-end", padding: 12 }}
                    >
                        <BottomContent />
                    </LinearGradient>
                </LinearGradient>
            ) : (
                /* Gradient fallback when no thumbnail */
                <LinearGradient
                    colors={gradientColors}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{ flex: 1, justifyContent: "space-between", padding: 12 }}
                >
                    {/* Waveform icon centered */}
                    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
                        <View
                            style={{
                                width: 55,
                                height: 55,
                                borderRadius: 35,
                                backgroundColor: "rgba(255, 255, 255, 0.2)",
                                justifyContent: "center",
                                alignItems: "center",
                                borderWidth: 2,
                                borderColor: "rgba(255, 255, 255, 0.3)",
                            }}
                        >
                            <MaterialCommunityIcons
                                name="waveform"
                                size={32}
                                color="white"
                            />
                        </View>
                    </View>
                    {/* Bottom Section - Content */}
                    <BottomContent />
                </LinearGradient>
            )}
        </TouchableOpacity>
    );
};

export default GradientCard;
export { GRADIENT_THEMES };
