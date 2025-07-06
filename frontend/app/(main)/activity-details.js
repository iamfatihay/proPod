import { View, Text, SafeAreaView } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import { Appbar, Surface } from "react-native-paper";

const activities = [
    {
        id: "1",
        type: "comment",
        text: "User XY hat deine Episode kommentiert",
        time: "4h ago",
    },
    {
        id: "2",
        type: "livestream",
        text: "Livestream gestartet von @PodcastStar",
        time: "3h ago",
    },
    {
        id: "3",
        type: "message",
        text: "Neue Nachricht von Anna",
        time: "2h ago",
    },
];

export default function ActivityDetails() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const activity = activities.find((a) => a.id === id);

    return (
        <SafeAreaView className="flex-1 bg-background">
            <Appbar.Header style={{ backgroundColor: "#18181b" }}>
                <Appbar.BackAction onPress={() => router.back()} />
                <Appbar.Content title="Activity Details" />
            </Appbar.Header>
            <View className="flex-1 px-4 pt-6">
                <Surface
                    style={{
                        elevation: 2,
                        borderRadius: 16,
                        padding: 20,
                        backgroundColor: "#18181b",
                    }}
                >
                    {activity ? (
                        <>
                            <Text className="text-2xl font-bold text-text-primary mb-2">
                                Activity
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
                                Activity details coming soon...
                            </Text>
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
