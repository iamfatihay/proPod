import { TouchableOpacity, View, Text, Platform } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { Surface } from "react-native-paper";
import React from "react";

export default function ActivityCard({ activity, onPress }) {
    let icon = null;
    let accessibilityLabel = "";

    if (activity.type === "comment") {
        icon = (
            <Ionicons
                name="chatbubble-ellipses"
                size={18}
                color="#D32F2F"
                className="mr-2"
            />
        );
        accessibilityLabel = `Comment activity: ${activity.text}`;
    } else if (activity.type === "livestream") {
        icon = (
            <MaterialCommunityIcons
                name="broadcast"
                size={18}
                color="#D32F2F"
                className="mr-2"
            />
        );
        accessibilityLabel = `Livestream activity: ${activity.text}`;
    } else if (activity.type === "message") {
        icon = (
            <Ionicons name="mail" size={18} color="#D32F2F" className="mr-2" />
        );
        accessibilityLabel = `Message activity: ${activity.text}`;
    }

    return (
        <Surface
            style={{
                // Cross-platform shadow for both iOS and Android
                ...(Platform.OS === "ios"
                    ? {
                          shadowColor: "#000",
                          shadowOffset: { width: 0, height: 2 },
                          shadowOpacity: 0.25,
                          shadowRadius: 3.84,
                      }
                    : {
                          elevation: 5,
                      }),
                borderRadius: 16,
                marginBottom: 10,
            }}
            className="overflow-hidden bg-panel"
        >
            <TouchableOpacity
                activeOpacity={0.8}
                onPress={onPress}
                className="flex-row items-center px-3 py-2"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel={accessibilityLabel}
                accessibilityHint="Tap to view activity details"
            >
                <View className="mr-2">
                    {React.cloneElement(icon, { color: "#D32F2F" })}
                </View>
                <Text
                    className="text-sm text-text-primary flex-1 ml-2"
                    numberOfLines={2}
                >
                    {activity.text}
                </Text>
                <Text className="text-xs text-text-secondary ml-2">
                    {activity.time}
                </Text>
            </TouchableOpacity>
        </Surface>
    );
}
