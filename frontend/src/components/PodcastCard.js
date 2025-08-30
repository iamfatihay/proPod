import { TouchableOpacity, View, Text, Platform } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Surface } from "react-native-paper";
import React from "react";

// Helper functions
const formatDuration = (milliseconds) => {
    const minutes = Math.floor(milliseconds / 60000);
    const seconds = Math.floor((milliseconds % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));

    if (diffInDays === 0) return "Today";
    if (diffInDays === 1) return "Yesterday";
    if (diffInDays < 7) return `${diffInDays} days ago`;
    if (diffInDays < 30) return `${Math.floor(diffInDays / 7)} weeks ago`;
    if (diffInDays < 365) return `${Math.floor(diffInDays / 30)} months ago`;
    return `${Math.floor(diffInDays / 365)} years ago`;
};

export default function PodcastCard({ podcast, onPress }) {
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
                marginBottom: 12,
            }}
            className="overflow-hidden bg-panel"
        >
            <TouchableOpacity
                activeOpacity={0.8}
                onPress={onPress}
                className="flex-row items-center px-4 py-3"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel={`Podcast episode: ${podcast.title}`}
                accessibilityHint="Tap to view episode details"
                testID={`podcast-card-${podcast.id}`}
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
                        {podcast.title}
                    </Text>
                    <Text className="text-xs text-text-secondary">
                        {formatDuration(podcast.duration)} •{" "}
                        {formatDate(podcast.created_at)}
                    </Text>
                </View>
            </TouchableOpacity>
        </Surface>
    );
}
