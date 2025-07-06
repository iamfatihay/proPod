import { View, Text, SafeAreaView } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import { Appbar, Surface } from "react-native-paper";

// Aynı fake data'yı burada da tanımla veya dışarıdan import et
const episodes = [
    { id: "1", title: "Episode 1", duration: "28:15", date: "2 days ago" },
    { id: "2", title: "Episode 2", duration: "34:02", date: "1 week ago" },
    { id: "3", title: "Episode 3", duration: "21:47", date: "2 weeks ago" },
];

export default function PodcastDetails() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const episode = episodes.find((ep) => ep.id === id);

    return (
        <SafeAreaView className="flex-1 bg-background">
            <Appbar.Header style={{ backgroundColor: "#18181b" }}>
                <Appbar.BackAction onPress={() => router.back()} />
                <Appbar.Content title="Podcast Details" />
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
                    {episode ? (
                        <>
                            <Text className="text-2xl font-bold text-text-primary mb-2">
                                {episode.title}
                            </Text>
                            <Text className="text-base text-text-secondary mb-2">
                                Duration: {episode.duration}
                            </Text>
                            <Text className="text-base text-text-secondary mb-2">
                                Date: {episode.date}
                            </Text>
                            <Text className="text-base text-text-primary mt-4">
                                Podcast details coming soon...
                            </Text>
                        </>
                    ) : (
                        <Text className="mt-8 text-lg text-red-500">
                            Podcast not found
                        </Text>
                    )}
                </Surface>
            </View>
        </SafeAreaView>
    );
}
