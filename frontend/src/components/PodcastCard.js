import { TouchableOpacity, View, Text, Platform, Image } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Surface } from "react-native-paper";
import React, { useMemo } from "react";

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

const PodcastCard = React.memo(function PodcastCard({
    podcast,
    onPress,
    onPlayPress,
    isPlaying = false,
    showPlayButton = true,
}) {
    // Memoize formatted values to prevent recalculation on every render
    const formattedDuration = useMemo(
        () => formatDuration(podcast.duration),
        [podcast.duration]
    );
    const formattedDate = useMemo(
        () => formatDate(podcast.created_at),
        [podcast.created_at]
    );

    return (
        <Surface
            style={{
                // Enhanced cross-platform shadow
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
                borderRadius: 16,
                marginBottom: 16,
            }}
            className="overflow-hidden bg-panel"
        >
            <TouchableOpacity
                activeOpacity={0.85}
                onPress={onPress}
                style={{ flexDirection: "row", minHeight: 80 }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel={`Podcast episode: ${podcast.title}`}
                accessibilityHint="Tap to view episode details"
                testID={`podcast-card-${podcast.id}`}
            >
                {/* Thumbnail — full-height left image, no padding */}
                <View style={{ width: 80, alignSelf: "stretch" }} className="bg-primary/10 overflow-hidden">
                    {podcast.thumbnail_url ? (
                        <Image
                            source={{ uri: podcast.thumbnail_url }}
                            style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
                            resizeMode="cover"
                        />
                    ) : (
                        <View style={{ flex: 1 }} className="items-center justify-center">
                            <MaterialCommunityIcons
                                name="waveform"
                                size={28}
                                color="#D32F2F"
                            />
                        </View>
                    )}
                </View>
                <View className="flex-1 px-4 py-3">
                    <Text
                        className="text-base font-semibold text-text-primary mb-1"
                        numberOfLines={2}
                    >
                        {podcast.title}
                    </Text>
                    <Text
                        className="text-sm text-text-secondary mb-1"
                        numberOfLines={1}
                    >
                        {podcast.owner?.name || "Unknown Artist"}
                    </Text>
                    <View className="flex-row items-center justify-between">
                        <Text className="text-xs text-text-secondary font-medium">
                            {formattedDuration} • {formattedDate}
                        </Text>
                        {/* Relevance Score Indicator for Search Results */}
                        {podcast.relevance !== undefined && (
                            <View className="flex-row items-center">
                                {podcast.matchCount !== undefined ? (
                                    // Transcription search results
                                    <>
                                        <MaterialCommunityIcons
                                            name="text-search"
                                            size={12}
                                            color="#3B82F6"
                                        />
                                        <Text className="text-xs text-info ml-1 font-medium">
                                            {podcast.matchCount} match
                                            {podcast.matchCount !== 1
                                                ? "es"
                                                : ""}
                                        </Text>
                                    </>
                                ) : (
                                    // General search results
                                    <>
                                        <MaterialCommunityIcons
                                            name="target"
                                            size={12}
                                            color="#10B981"
                                        />
                                        <Text className="text-xs text-success ml-1 font-medium">
                                            {Math.round(
                                                podcast.relevance * 100
                                            )}
                                            %
                                        </Text>
                                    </>
                                )}
                            </View>
                        )}
                    </View>
                </View>

                {/* Modern Play Button */}
                {showPlayButton && onPlayPress && (
                    <TouchableOpacity
                        onPress={(e) => {
                            e.stopPropagation(); // Prevent card press
                            onPlayPress();
                        }}
                        className="mr-4 self-center w-10 h-10 bg-primary rounded-full items-center justify-center"
                        style={{
                            // Modern shadow for play button
                            ...(Platform.OS === "ios"
                                ? {
                                      shadowColor: "#D32F2F",
                                      shadowOffset: { width: 0, height: 2 },
                                      shadowOpacity: 0.3,
                                      shadowRadius: 4,
                                  }
                                : {
                                      elevation: 4,
                                  }),
                        }}
                        accessible={true}
                        accessibilityRole="button"
                        accessibilityLabel={
                            isPlaying ? "Pause podcast" : "Play podcast"
                        }
                    >
                        <MaterialCommunityIcons
                            name={isPlaying ? "pause" : "play"}
                            size={18}
                            color="white"
                        />
                    </TouchableOpacity>
                )}
            </TouchableOpacity>
        </Surface>
    );
});

export default PodcastCard;
