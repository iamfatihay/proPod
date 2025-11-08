import React from "react";
import { TouchableOpacity, View, Text, Platform } from "react-native";
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
    // Determine gradient colors
    const gradientColors = GRADIENT_THEMES[category.toLowerCase()] || GRADIENT_THEMES.default;
    
    // Responsive sizing
    const cardSizes = {
        small: { width: 140, height: 140 },
        medium: { width: 180, height: 220 },
        large: { width: "100%", height: 260 },
    };
    
    const dimensions = cardSizes[size];
    
    return (
        <TouchableOpacity
            activeOpacity={0.85}
            onPress={onPress}
            style={[
                {
                    width: dimensions.width,
                    height: dimensions.height,
                    borderRadius: 20,
                    overflow: "hidden",
                    marginRight: size !== "large" ? 16 : 0,
                    marginBottom: 16,
                    // Enhanced shadow
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
                },
                style,
            ]}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel={`Podcast: ${podcast?.title || "Unknown"}`}
        >
            {/* Gradient Background */}
            <LinearGradient
                colors={gradientColors}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                    flex: 1,
                    justifyContent: "space-between",
                    padding: 16,
                }}
            >
                {/* Top Section - AI Badge */}
                {showAIBadge && podcast?.ai_enhanced && (
                    <View style={{ alignSelf: "flex-start" }}>
                        <BlurView
                            intensity={20}
                            tint="light"
                            style={{
                                flexDirection: "row",
                                alignItems: "center",
                                paddingHorizontal: 10,
                                paddingVertical: 6,
                                borderRadius: 20,
                                overflow: "hidden",
                                backgroundColor: "rgba(255, 255, 255, 0.2)",
                            }}
                        >
                            <MaterialCommunityIcons
                                name="robot"
                                size={14}
                                color="white"
                            />
                            <Text
                                style={{
                                    color: "white",
                                    fontSize: 11,
                                    fontWeight: "600",
                                    marginLeft: 4,
                                }}
                            >
                                AI Enhanced
                            </Text>
                        </BlurView>
                    </View>
                )}
                
                {/* Center - Waveform Icon */}
                <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
                    <View
                        style={{
                            width: 80,
                            height: 80,
                            borderRadius: 40,
                            backgroundColor: "rgba(255, 255, 255, 0.2)",
                            justifyContent: "center",
                            alignItems: "center",
                            borderWidth: 2,
                            borderColor: "rgba(255, 255, 255, 0.3)",
                        }}
                    >
                        <MaterialCommunityIcons
                            name="waveform"
                            size={40}
                            color="white"
                        />
                    </View>
                </View>
                
                {/* Bottom Section - Content */}
                <View>
                    {/* Title */}
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
                    
                    {/* Artist/Creator */}
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
                    
                    {/* Bottom Row - Duration & Play Button */}
                    <View
                        style={{
                            flexDirection: "row",
                            justifyContent: "space-between",
                            alignItems: "center",
                        }}
                    >
                        {/* Duration */}
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
                        
                        {/* Play Button */}
                        {showPlayButton && onPlayPress && (
                            <TouchableOpacity
                                onPress={(e) => {
                                    e.stopPropagation();
                                    onPlayPress();
                                }}
                                style={{
                                    width: 40,
                                    height: 40,
                                    borderRadius: 20,
                                    backgroundColor: "rgba(255, 255, 255, 0.9)",
                                    justifyContent: "center",
                                    alignItems: "center",
                                    // iOS shadow
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
                                    size={20}
                                    color={gradientColors[0]}
                                />
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </LinearGradient>
        </TouchableOpacity>
    );
};

export default GradientCard;
export { GRADIENT_THEMES };

