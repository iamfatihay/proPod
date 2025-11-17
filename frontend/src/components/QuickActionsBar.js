import React from "react";
import {
    View,
    Text,
    TouchableOpacity,
    ScrollView,
    Platform,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import useViewModeStore from "../context/useViewModeStore";

/**
 * QuickActionsBar - Icon-based navigation for quick access
 *
 * Adapts to view mode:
 * - Discover: Bookmarks, History, Trending, Categories
 * - Studio: Record, Analytics, Messages, Drafts
 */

const ACTION_SETS = {
    discover: [
        {
            id: "record",
            icon: "microphone-variant",
            label: "Record",
            color: "#D32F2F",
        },
        {
            id: "bookmarks",
            icon: "bookmark-outline",
            label: "Saved",
            color: "#10B981",
        },
        { id: "history", icon: "history", label: "History", color: "#3B82F6" },
        { id: "trending", icon: "fire", label: "Trending", color: "#F59E0B" },
        {
            id: "categories",
            icon: "view-grid-outline",
            label: "Browse",
            color: "#8B5CF6",
        },
    ],
    studio: [
        {
            id: "quick-record",
            icon: "record-circle",
            label: "Record",
            color: "#D32F2F",
        },
        {
            id: "analytics",
            icon: "chart-line",
            label: "Analytics",
            color: "#10B981",
        },
        {
            id: "comments",
            icon: "message-reply-text-outline",
            label: "Messages",
            color: "#3B82F6",
        },
        {
            id: "drafts",
            icon: "file-document-edit-outline",
            label: "Drafts",
            color: "#F59E0B",
        },
        {
            id: "schedule",
            icon: "calendar-clock",
            label: "Schedule",
            color: "#8B5CF6",
        },
    ],
};

const QuickActionsBar = ({ onActionPress, notifications = {}, style }) => {
    const { viewMode } = useViewModeStore();
    const actions = ACTION_SETS[viewMode];

    const handlePress = (actionId) => {
        // Haptic feedback
        if (Platform.OS === "ios") {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        onActionPress?.(actionId);
    };

    return (
        <View style={[{ marginBottom: 20 }, style]}>
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 16 }}
            >
                {actions.map((action, index) => {
                    const badgeCount = notifications[action.id] || 0;
                    const isFirst = index === 0;

                    return (
                        <TouchableOpacity
                            key={action.id}
                            onPress={() => handlePress(action.id)}
                            style={{
                                alignItems: "center",
                                marginRight: 20,
                                // Emphasize first action
                                transform: isFirst ? [{ scale: 1.05 }] : [],
                            }}
                            activeOpacity={0.7}
                            accessible={true}
                            accessibilityRole="button"
                            accessibilityLabel={action.label}
                        >
                            {/* Icon Container */}
                            <View
                                style={{
                                    width: isFirst ? 66 : 56,
                                    height: isFirst ? 66 : 56,
                                    borderRadius: isFirst ? 33 : 28,
                                    backgroundColor: isFirst
                                        ? action.color
                                        : "#1a1a1a",
                                    borderWidth: isFirst ? 0 : 1.5,
                                    borderColor: isFirst
                                        ? "transparent"
                                        : action.color,
                                    justifyContent: "center",
                                    alignItems: "center",
                                    marginBottom: 8,
                                    // Shadow
                                    ...(Platform.OS === "ios"
                                        ? {
                                              shadowColor: isFirst
                                                  ? action.color
                                                  : "#000",
                                              shadowOffset: {
                                                  width: 0,
                                                  height: isFirst ? 6 : 2,
                                              },
                                              shadowOpacity: isFirst
                                                  ? 0.4
                                                  : 0.2,
                                              shadowRadius: isFirst ? 12 : 4,
                                          }
                                        : {
                                              elevation: isFirst ? 8 : 4,
                                          }),
                                }}
                            >
                                <MaterialCommunityIcons
                                    name={action.icon}
                                    size={isFirst ? 32 : 24}
                                    color={isFirst ? "white" : action.color}
                                />

                                {/* Notification Badge */}
                                {badgeCount > 0 && (
                                    <View
                                        style={{
                                            position: "absolute",
                                            top: -4,
                                            right: -4,
                                            backgroundColor: "#EF4444",
                                            borderRadius: 12,
                                            minWidth: 20,
                                            height: 20,
                                            paddingHorizontal: 6,
                                            justifyContent: "center",
                                            alignItems: "center",
                                            borderWidth: 2,
                                            borderColor: "#000",
                                        }}
                                    >
                                        <Text
                                            style={{
                                                color: "white",
                                                fontSize: 10,
                                                fontWeight: "700",
                                            }}
                                        >
                                            {badgeCount > 99
                                                ? "99+"
                                                : badgeCount}
                                        </Text>
                                    </View>
                                )}
                            </View>

                            {/* Label */}
                            <Text
                                style={{
                                    color: isFirst ? action.color : "#888",
                                    fontSize: 12,
                                    fontWeight: isFirst ? "700" : "500",
                                }}
                            >
                                {action.label}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>
        </View>
    );
};

export default QuickActionsBar;
