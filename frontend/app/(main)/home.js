import { View, Text, Image, SafeAreaView, FlatList } from "react-native";
import React from "react";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import useAuthStore from "../../src/context/useAuthStore";
import PodcastCard from "../../src/components/PodcastCard";
import ChatCard from "../../src/components/ChatCard";
import ActivityCard from "../../src/components/ActivityCard";

// Fake Data
const episodes = [
    {
        id: "1",
        title: "Episode 1",
        duration: "28:15",
        date: "2 days ago",
    },
    {
        id: "2",
        title: "Episode 2",
        duration: "34:02",
        date: "1 week ago",
    },
    {
        id: "3",
        title: "Episode 3",
        duration: "21:47",
        date: "2 weeks ago",
    },
];

const chats = [
    {
        id: "1",
        name: "Daniel",
        message: "Hallo!",
        time: "2h ago",
    },
    {
        id: "2",
        name: "Anna",
        message: "Das war eine interessante Folge.",
        time: "3h ago",
    },
];

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

export default function HomeScreen() {
    const router = useRouter();
    const { user, logout } = useAuthStore();

    const handleLogout = () => {
        logout();
        // After logout, the user should be redirected to the login screen.
        // This is typically handled by the navigation setup (e.g., in _layout.js)
        // based on the user's authentication state.
    };

    return (
        <SafeAreaView className="flex-1 bg-background">
            <View className="flex-1 px-4 pt-10">
                {/* Header */}
                <View className="flex-row items-center justify-between mb-6">
                    <Text className="text-3xl font-bold text-text-primary">
                        Podcast
                    </Text>
                    {user && user.photoURL ? (
                        <Image
                            source={{ uri: user.photoURL }}
                            className="w-10 h-10 rounded-full"
                        />
                    ) : (
                        <View className="w-10 h-10 rounded-full bg-card items-center justify-center">
                            <Ionicons name="person" size={28} color="#888" />
                        </View>
                    )}
                </View>

                {/* Episodes */}
                <Text className="text-lg font-semibold text-text-primary mb-2">
                    Letzte Episoden
                </Text>
                <View className="mb-4">
                    <FlatList
                        data={episodes}
                        keyExtractor={(item) => item.id}
                        renderItem={({ item }) => (
                            <PodcastCard
                                episode={item}
                                onPress={() =>
                                    router.push({
                                        pathname: "/(main)/details",
                                        params: { id: item.id },
                                    })
                                }
                            />
                        )}
                        showsVerticalScrollIndicator={false}
                    />
                </View>

                {/* Chats & Activities */}
                <View className="flex-row gap-4 mb-4">
                    {/* Chats */}
                    <View className="flex-1">
                        <Text className="text-base font-semibold text-text-primary mb-2">
                            Chats
                        </Text>
                        <FlatList
                            data={chats}
                            keyExtractor={(item) => item.id}
                            renderItem={({ item }) => (
                                <ChatCard
                                    chat={item}
                                    onPress={() =>
                                        router.push({
                                            pathname: "/(main)/chat-details",
                                            params: { id: item.id },
                                        })
                                    }
                                />
                            )}
                            showsVerticalScrollIndicator={false}
                        />
                    </View>
                    {/* Activities */}
                    <View className="flex-1">
                        <Text className="text-base font-semibold text-text-primary mb-2">
                            Aktivitäten
                        </Text>
                        <FlatList
                            data={activities}
                            keyExtractor={(item) => item.id}
                            renderItem={({ item }) => (
                                <ActivityCard
                                    activity={item}
                                    onPress={() =>
                                        router.push({
                                            pathname:
                                                "/(main)/activity-details",
                                            params: { id: item.id },
                                        })
                                    }
                                />
                            )}
                            showsVerticalScrollIndicator={false}
                        />
                    </View>
                </View>
            </View>
        </SafeAreaView>
    );
}
