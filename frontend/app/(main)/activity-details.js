import {
    View,
    Text,
    Platform,
    SafeAreaView,
    TouchableOpacity,
} from "react-native";
import { useLocalSearchParams, Stack, useRouter } from "expo-router";
import React from "react";
import { Surface } from "react-native-paper";
import { COLORS, BORDER_RADIUS } from "../../src/constants/theme";
import { buildSecondaryScreenOptions } from "../../src/utils/secondaryScreenOptions";

export default function ActivityDetails() {
    const params = useLocalSearchParams();
    const rawTitle = Array.isArray(params.title) ? params.title[0] : params.title;
    const rawText = Array.isArray(params.text) ? params.text[0] : params.text;
    const rawType = Array.isArray(params.type) ? params.type[0] : params.type;
    const rawTime = Array.isArray(params.time) ? params.time[0] : params.time;
    const rawPodcastId = Array.isArray(params.podcastId) ? params.podcastId[0] : params.podcastId;
    const router = useRouter();
    const activity = {
        title: rawTitle || "Activity",
        text: rawText,
        type: rawType,
        time: rawTime,
        podcastId: rawPodcastId,
    };

    return (
        <SafeAreaView className="flex-1 bg-background">
            <Stack.Screen
                options={buildSecondaryScreenOptions({
                    router,
                    title: "Activity Details",
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
                    {rawText ? (
                        <>
                            <Text className="text-2xl font-bold text-text-primary mb-2">
                                {activity.title}
                            </Text>
                            <Text className="text-base text-text-secondary mb-2">
                                {activity.text}
                            </Text>
                            <Text className="text-base text-text-secondary mb-2">
                                Type: {activity.type}
                            </Text>
                            <Text className="text-base text-text-secondary mb-2">
                                Time: {activity.time}
                            </Text>
                            <Text className="text-base text-text-primary mt-4">
                                This event came from your live notification feed.
                            </Text>
                            {activity.podcastId ? (
                                <TouchableOpacity
                                    onPress={() =>
                                        router.push({
                                            pathname: "/(main)/details",
                                            params: { id: activity.podcastId },
                                        })
                                    }
                                    className="mt-5 bg-primary rounded-xl px-4 py-3 items-center"
                                    activeOpacity={0.8}
                                >
                                    <Text className="text-white font-semibold">
                                        Open Related Podcast
                                    </Text>
                                </TouchableOpacity>
                            ) : null}
                        </>
                    ) : (
                        <Text className="mt-8 text-lg text-red-500">
                            Activity not found
                        </Text>
                    )}
                </Surface>
            </View>
        </SafeAreaView>
    );
}
