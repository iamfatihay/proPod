import {
    View,
    Text,
    Image,
    SafeAreaView,
    FlatList,
    ActivityIndicator,
} from "react-native";
import React, { useEffect, useState, useCallback } from "react";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import useAuthStore from "../../src/context/useAuthStore";
import PodcastCard from "../../src/components/PodcastCard";
import ChatCard from "../../src/components/ChatCard";
import ActivityCard from "../../src/components/ActivityCard";
import apiService from "../../src/services/api/apiService";

// Removed mock episodes; will fetch from API

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
    const [podcasts, setPodcasts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [refreshing, setRefreshing] = useState(false);

    const load = useCallback(async () => {
        try {
            const res = await apiService.getPodcasts({ limit: 20 });
            const normalized = (res.podcasts || []).map((p) => {
                // Robust duration normalization → milliseconds
                const durationMs =
                    (typeof p.duration_ms === "number" && p.duration_ms) ||
                    (typeof p.durationMilliseconds === "number" &&
                        p.durationMilliseconds) ||
                    (typeof p.duration_seconds === "number" &&
                        p.duration_seconds * 1000) ||
                    (typeof p.duration === "number" && p.duration * 1000) ||
                    0;
                return {
                    ...p,
                    duration: durationMs,
                };
            });
            setPodcasts(normalized);
            setError(null);
        } catch (e) {
            setError(e?.detail || e?.message || "Failed to load podcasts");
        }
    }, []);

    useEffect(() => {
        (async () => {
            setLoading(true);
            await load();
            setLoading(false);
        })();
    }, [load]);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await load();
        setRefreshing(false);
    }, [load]);

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
                    Recent Episodes
                </Text>
                <View className="mb-4">
                    {loading ? (
                        <View className="py-6 items-center">
                            <ActivityIndicator color="#D32F2F" />
                        </View>
                    ) : error ? (
                        <Text className="text-text-secondary">{error}</Text>
                    ) : (
                        <FlatList
                            data={podcasts}
                            keyExtractor={(item) => String(item.id)}
                            renderItem={({ item }) => (
                                <PodcastCard
                                    podcast={item}
                                    onPress={() =>
                                        router.push({
                                            pathname: "/(main)/details",
                                            params: { id: item.id },
                                        })
                                    }
                                />
                            )}
                            showsVerticalScrollIndicator={false}
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                        />
                    )}
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
                            Activities
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
