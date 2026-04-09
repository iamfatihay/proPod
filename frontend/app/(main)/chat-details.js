import {
    View,
    Text,
    SafeAreaView,
    Platform,
    TouchableOpacity,
} from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import React from "react";
import { Surface } from "react-native-paper";
import { COLORS, BORDER_RADIUS } from "../../src/constants/theme";
import { buildSecondaryScreenOptions } from "../../src/utils/secondaryScreenOptions";

const formatTimestamp = (secondsValue) => {
    const totalSeconds = Number(secondsValue || 0);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
};

export default function ChatDetails() {
    const params = useLocalSearchParams();
    const router = useRouter();
    const authorName = Array.isArray(params.authorName) ? params.authorName[0] : params.authorName;
    const content = Array.isArray(params.content) ? params.content[0] : params.content;
    const createdAt = Array.isArray(params.createdAt) ? params.createdAt[0] : params.createdAt;
    const podcastId = Array.isArray(params.podcastId) ? params.podcastId[0] : params.podcastId;
    const podcastTitle = Array.isArray(params.podcastTitle) ? params.podcastTitle[0] : params.podcastTitle;
    const timestampSeconds = Array.isArray(params.timestampSeconds)
        ? params.timestampSeconds[0]
        : params.timestampSeconds;
    const message = {
        authorName,
        content,
        createdAt,
        podcastId,
        podcastTitle,
        timestampSeconds,
    };

    return (
        <SafeAreaView className="flex-1 bg-background">
            <Stack.Screen
                options={buildSecondaryScreenOptions({
                    router,
                    title: "Comment Details",
                })}
            />
            <View className="flex-1 px-4 pt-6">
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
                        borderRadius: BORDER_RADIUS.md,
                        padding: 20,
                        backgroundColor: COLORS.card,
                    }}
                >
                    {message.content ? (
                        <>
                            <Text className="text-2xl font-bold text-text-primary mb-2">
                                Comment from {message.authorName || "Listener"}
                            </Text>
                            <Text className="text-base text-text-secondary mb-2">
                                On: {message.podcastTitle || "Your podcast"}
                            </Text>
                            <Text className="text-base text-text-secondary mb-2">
                                Comment time: {formatTimestamp(message.timestampSeconds)}
                            </Text>
                            <Text className="text-base text-text-primary mt-4">
                                {message.content}
                            </Text>
                            {message.createdAt && (
                                <Text className="text-base text-text-secondary mt-3">
                                    Received: {new Date(message.createdAt).toLocaleString()}
                                </Text>
                            )}
                            {message.podcastId && (
                                <TouchableOpacity
                                    onPress={() =>
                                        router.push({
                                            pathname: "/(main)/details",
                                            params: { id: message.podcastId },
                                        })
                                    }
                                    className="mt-5 bg-primary rounded-xl px-4 py-3 items-center"
                                    activeOpacity={0.8}
                                >
                                    <Text className="text-white font-semibold">
                                        Open Podcast
                                    </Text>
                                </TouchableOpacity>
                            )}
                        </>
                    ) : (
                        <Text className="mt-8 text-lg text-red-500">
                            Message not found
                        </Text>
                    )}
                </Surface>
            </View>
        </SafeAreaView>
    );
}
