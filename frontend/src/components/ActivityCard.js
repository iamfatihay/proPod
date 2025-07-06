import { TouchableOpacity, View, Text } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { Surface } from "react-native-paper";
import React from "react";

export default function ActivityCard({ activity, onPress }) {
    let icon = null;
    if (activity.type === "comment") {
        icon = (
            <Ionicons
                name="chatbubble-ellipses"
                size={18}
                color="#D32F2F"
                className="mr-2"
            />
        );
    } else if (activity.type === "livestream") {
        icon = (
            <MaterialCommunityIcons
                name="broadcast"
                size={18}
                color="#D32F2F"
                className="mr-2"
            />
        );
    } else if (activity.type === "message") {
        icon = (
            <Ionicons name="mail" size={18} color="#D32F2F" className="mr-2" />
        );
    }
    return (
        <Surface
            style={{
                elevation: 2,
                borderRadius: 16,
                marginBottom: 10,
                backgroundColor: "#18181b",
            }}
            className="overflow-hidden"
        >
            <TouchableOpacity
                activeOpacity={0.8}
                onPress={onPress}
                className="flex-row items-center px-3 py-2"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
                {icon}
                <Text className="text-sm text-text-primary flex-1 ml-2">
                    {activity.text}
                </Text>
                <Text className="text-xs text-text-secondary ml-2">
                    {activity.time}
                </Text>
            </TouchableOpacity>
        </Surface>
    );
}
