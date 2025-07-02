import { TouchableOpacity, View, Text } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Surface } from "react-native-paper";
import React from "react";

export default function PodcastCard({ episode, onPress }) {
    return (
        <Surface
            style={{
                elevation: 2,
                borderRadius: 16,
                marginBottom: 12,
                backgroundColor: "#18181b", // bg-panel
            }}
            className="overflow-hidden"
        >
            <TouchableOpacity
                activeOpacity={0.8}
                onPress={onPress}
                className="flex-row items-center px-4 py-3"
            >
                <View className="w-10 h-10 bg-primary/20 rounded-full items-center justify-center mr-3">
                    <MaterialCommunityIcons
                        name="microphone"
                        size={24}
                        color="#D32F2F"
                    />
                </View>
                <View className="flex-1">
                    <Text className="text-base font-medium text-text-primary">
                        {episode.title}
                    </Text>
                    <Text className="text-xs text-text-secondary">
                        {episode.duration} • {episode.date}
                    </Text>
                </View>
            </TouchableOpacity>
        </Surface>
    );
}
