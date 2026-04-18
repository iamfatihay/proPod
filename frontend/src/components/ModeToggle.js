import React, { useEffect } from "react";
import { View, Text, TouchableOpacity, Animated, Platform } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import useViewModeStore from "../context/useViewModeStore";
import hapticFeedback from "../services/haptics/hapticFeedback";

/**
 * ModeToggle - Animated toggle switch between Discover and Studio modes
 *
 * Features:
 * - Smooth animation
 * - Haptic feedback
 * - Clear visual states
 * - Accessible
 */

const ModeToggle = ({ style }) => {
    const {
        viewMode,
        toggleViewMode,
        hasSeenModeToggleTutorial,
        markTutorialSeen,
    } = useViewModeStore();
    const slideAnim = React.useRef(
        new Animated.Value(viewMode === "discover" ? 0 : 1)
    ).current;
    const [showTutorial, setShowTutorial] = React.useState(false);

    useEffect(() => {
        // Show tutorial on first render
        if (!hasSeenModeToggleTutorial) {
            setShowTutorial(true);
            setTimeout(() => {
                setShowTutorial(false);
                markTutorialSeen();
            }, 3000);
        }
    }, []);

    useEffect(() => {
        // Animate toggle
        Animated.spring(slideAnim, {
            toValue: viewMode === "discover" ? 0 : 1,
            useNativeDriver: false,
            friction: 8,
            tension: 100,
        }).start();
    }, [viewMode]);

    const handleToggle = () => {
        void hapticFeedback.impact(Haptics.ImpactFeedbackStyle.Medium);
        toggleViewMode();
    };

    const backgroundPosition = slideAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ["4%", "50%"],
    });

    return (
        <View style={[{ position: "relative" }, style]}>
            {/* Toggle Container */}
            <View
                style={{
                    flexDirection: "row",
                    backgroundColor: "#1a1a1a",
                    borderRadius: 25,
                    padding: 4,
                    borderWidth: 1,
                    borderColor: "#333",
                    // Shadow
                    ...(Platform.OS === "ios"
                        ? {
                              shadowColor: "#000",
                              shadowOffset: { width: 0, height: 2 },
                              shadowOpacity: 0.3,
                              shadowRadius: 4,
                          }
                        : {
                              elevation: 4,
                          }),
                }}
            >
                {/* Animated Background */}
                <Animated.View
                    style={{
                        position: "absolute",
                        left: backgroundPosition,
                        top: 4,
                        bottom: 4,
                        width: "48%",
                        backgroundColor: "#D32F2F",
                        borderRadius: 21,
                        // Shadow for active state
                        ...(Platform.OS === "ios" && {
                            shadowColor: "#D32F2F",
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.5,
                            shadowRadius: 6,
                        }),
                    }}
                />

                {/* Discover Button */}
                <TouchableOpacity
                    onPress={handleToggle}
                    style={{
                        flex: 1,
                        paddingVertical: 10,
                        paddingHorizontal: 16,
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "center",
                        zIndex: 1,
                    }}
                    activeOpacity={0.7}
                    accessible={true}
                    accessibilityRole="button"
                    accessibilityLabel="Switch to Discover mode"
                    accessibilityState={{ selected: viewMode === "discover" }}
                >
                    <MaterialCommunityIcons
                        name="compass-outline"
                        size={20}
                        color={viewMode === "discover" ? "white" : "#888"}
                    />
                    <Text
                        style={{
                            color: viewMode === "discover" ? "white" : "#888",
                            fontSize: 14,
                            fontWeight: viewMode === "discover" ? "700" : "500",
                            marginLeft: 6,
                        }}
                    >
                        Discover
                    </Text>
                </TouchableOpacity>

                {/* Studio Button */}
                <TouchableOpacity
                    onPress={handleToggle}
                    style={{
                        flex: 1,
                        paddingVertical: 10,
                        paddingHorizontal: 16,
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "center",
                        zIndex: 1,
                    }}
                    activeOpacity={0.7}
                    accessible={true}
                    accessibilityRole="button"
                    accessibilityLabel="Switch to Studio mode"
                    accessibilityState={{ selected: viewMode === "studio" }}
                >
                    <MaterialCommunityIcons
                        name="microphone"
                        size={20}
                        color={viewMode === "studio" ? "white" : "#888"}
                    />
                    <Text
                        style={{
                            color: viewMode === "studio" ? "white" : "#888",
                            fontSize: 14,
                            fontWeight: viewMode === "studio" ? "700" : "500",
                            marginLeft: 6,
                        }}
                    >
                        Studio
                    </Text>
                </TouchableOpacity>
            </View>

            {/* Tutorial Tooltip */}
            {showTutorial && (
                <Animated.View
                    style={{
                        position: "absolute",
                        top: -50,
                        left: "50%",
                        transform: [{ translateX: -100 }],
                        backgroundColor: "#D32F2F",
                        paddingHorizontal: 16,
                        paddingVertical: 10,
                        borderRadius: 12,
                        width: 200,
                        // Shadow
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
                >
                    <Text
                        style={{
                            color: "white",
                            fontSize: 12,
                            fontWeight: "600",
                            textAlign: "center",
                        }}
                    >
                        💡 Switch modes to explore or create!
                    </Text>
                    {/* Arrow */}
                    <View
                        style={{
                            position: "absolute",
                            bottom: -6,
                            left: "50%",
                            marginLeft: -6,
                            width: 12,
                            height: 12,
                            backgroundColor: "#D32F2F",
                            transform: [{ rotate: "45deg" }],
                        }}
                    />
                </Animated.View>
            )}
        </View>
    );
};

export default ModeToggle;
