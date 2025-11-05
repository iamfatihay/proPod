import {
    View,
    Text,
    Image,
    SafeAreaView,
    FlatList,
    ActivityIndicator,
    TouchableOpacity,
    Platform,
    ScrollView,
} from "react-native";
import React, { useEffect, useState, useCallback } from "react";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import useAuthStore from "../../src/context/useAuthStore";
import useAudioStore from "../../src/context/useAudioStore";
import PodcastCard from "../../src/components/PodcastCard";
import ChatCard from "../../src/components/ChatCard";
import ActivityCard from "../../src/components/ActivityCard";
import RecommendedPodcasts from "../../src/components/RecommendedPodcasts";
import { normalizePodcast } from "../../src/utils/urlHelper";
import { PodcastCardSkeleton } from "../../src/components/SkeletonLoader";
import apiService from "../../src/services/api/apiService";
import { useToast } from "../../src/components/Toast";
import Logger from "../../src/utils/logger";

// Removed mock episodes; will fetch from API

// Category filters for home page
const CATEGORIES = [
    { id: "all", label: "All", icon: "apps" },
    { id: "Technology", label: "Technology", icon: "laptop-outline" },
    { id: "Business", label: "Business", icon: "briefcase-outline" },
    { id: "Health & Wellness", label: "Health", icon: "fitness-outline" },
    { id: "Science", label: "Science", icon: "flask-outline" },
    { id: "Education", label: "Education", icon: "school-outline" },
    { id: "Entertainment", label: "Entertainment", icon: "film-outline" },
    { id: "Food & Drink", label: "Food", icon: "restaurant-outline" },
];

const chats = [
    {
        id: "1",
        name: "Daniel",
        message: "Hello!",
        time: "2h ago",
    },
    {
        id: "2",
        name: "Anna",
        message: "That was an interesting episode.",
        time: "3h ago",
    },
];

const activities = [
    {
        id: "1",
        type: "comment",
        text: "User XY commented on your episode",
        time: "4h ago",
    },
    {
        id: "2",
        type: "livestream",
        text: "Livestream started by @PodcastStar",
        time: "3h ago",
    },
    {
        id: "3",
        type: "message",
        text: "New message from Anna",
        time: "2h ago",
    },
];

export default function HomeScreen() {
    const router = useRouter();
    const { user, logout } = useAuthStore();
    const { showToast } = useToast();

    // Audio store
    const {
        currentTrack,
        isPlaying,
        play,
        pause,
        setQueue,
        showMiniPlayer,
        toggleMiniPlayer,
    } = useAudioStore();

    const [podcasts, setPodcasts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedCategory, setSelectedCategory] = useState("all");
    const [refreshing, setRefreshing] = useState(false);

    const load = useCallback(async () => {
        try {
            const params = { limit: 20 };
            if (selectedCategory && selectedCategory !== "all") {
                params.category = selectedCategory;
            }
            const res = await apiService.getPodcasts(params);
            const normalized = (res || []).map((p) => {
                // Convert duration from seconds to milliseconds for display
                const durationMs =
                    (typeof p.duration === "number" && p.duration * 1000) || 0;
                // Normalize URLs (relative to absolute)
                const normalizedPodcast = normalizePodcast(p);
                return {
                    ...normalizedPodcast,
                    duration: durationMs,
                };
            });
            setPodcasts(normalized);
            setError(null);
        } catch (e) {
            setError(e?.detail || e?.message || "Failed to load podcasts");
        }
    }, [selectedCategory]);

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

    // Modern play functionality with demo audio
    const handlePlayPodcast = async (podcast) => {
        try {
            Logger.log("🎵 Playing podcast:", podcast.title);
            // Create track with real audio URL if available, otherwise demo
            const track = {
                id: podcast.id,
                uri:
                    podcast.audio_url ||
                    "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3", // Use real audio or demo
                title: podcast.title,
                artist: podcast.owner?.name || "Unknown Artist",
                duration: podcast.duration || 180000, // 3 minutes demo
                artwork: podcast.thumbnail_url,
                category: podcast.category,
                description: podcast.description,
            };

            Logger.log("🎵 Track created:", track);

            if (currentTrack?.id === podcast.id) {
                // Same track - toggle play/pause
                if (isPlaying) {
                    await pause();
                    Logger.log("⏸️ Paused");
                } else {
                    await play();
                    Logger.log("▶️ Resumed");
                }
            } else {
                // New track - start playing
                await play(track);
                Logger.log("🎵 Started new track");

                // Show mini player
                if (!showMiniPlayer) {
                    toggleMiniPlayer(true);
                    Logger.log("📱 MiniPlayer enabled");
                }
            }

            showToast(
                `${
                    isPlaying && currentTrack?.id === podcast.id
                        ? "Paused"
                        : "Playing"
                }: ${podcast.title}`,
                "success"
            );
        } catch (error) {
            Logger.error("❌ Play failed:", error);
            showToast("Playback failed. Please try again.", "error");
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-background">
            <View className="flex-1 px-4 pt-10">
                {/* Header */}
                <View className="flex-row items-center justify-between mb-6">
                    <Text className="text-3xl font-bold text-text-primary">
                        Podcast
                    </Text>
                    <TouchableOpacity
                        onPress={() => router.push("/(main)/profile")}
                        activeOpacity={0.7}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        {user && user.photo_url ? (
                            <Image
                                source={{ uri: user.photo_url }}
                                className="w-10 h-10 rounded-full"
                            />
                        ) : (
                            <View className="w-10 h-10 rounded-full bg-card items-center justify-center">
                                <Ionicons
                                    name="person"
                                    size={28}
                                    color="#888"
                                />
                            </View>
                        )}
                    </TouchableOpacity>
                </View>

                {/* Category Filters - Horizontal scroll */}
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    className="mb-6"
                    contentContainerStyle={{ paddingRight: 16 }}
                >
                    {CATEGORIES.map((category) => (
                        <TouchableOpacity
                            key={category.id}
                            onPress={() => setSelectedCategory(category.id)}
                            className={`flex-row items-center px-4 py-2 rounded-full mr-3 ${
                                selectedCategory === category.id
                                    ? "bg-primary"
                                    : "bg-panel"
                            }`}
                            activeOpacity={0.7}
                        >
                            <Ionicons
                                name={category.icon}
                                size={18}
                                color={
                                    selectedCategory === category.id
                                        ? "#FFFFFF"
                                        : "#888888"
                                }
                            />
                            <Text
                                className={`ml-2 font-medium ${
                                    selectedCategory === category.id
                                        ? "text-white"
                                        : "text-text-secondary"
                                }`}
                            >
                                {category.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>

                {/* AI-Powered Recommendations */}
                <RecommendedPodcasts
                    title="🤖 For You"
                    limit={5}
                    onPodcastPress={(podcast) =>
                        router.push({
                            pathname: "/(main)/details",
                            params: { id: podcast.id },
                        })
                    }
                    onPlayPress={handlePlayPodcast}
                    horizontal={true}
                />

                {/* Episodes */}
                <View className="flex-row items-center justify-between mb-3">
                    <Text className="text-xl font-semibold text-text-primary">
                        Recent Episodes
                    </Text>
                    {podcasts.length > 0 && (
                        <TouchableOpacity
                            onPress={() => router.push("/(main)/library")}
                            className="flex-row items-center"
                        >
                            <Text className="text-primary text-sm font-medium mr-1">
                                See all
                            </Text>
                            <Ionicons
                                name="chevron-forward"
                                size={16}
                                color="#D32F2F"
                            />
                        </TouchableOpacity>
                    )}
                </View>
                <View className="mb-4">
                    {loading ? (
                        // Skeleton loaders for better perceived performance
                        <>
                            <PodcastCardSkeleton />
                            <PodcastCardSkeleton />
                            <PodcastCardSkeleton />
                        </>
                    ) : error ? (
                        <Text className="text-text-secondary">{error}</Text>
                    ) : podcasts.length === 0 ? (
                        // Empty State - First user experience
                        <View className="py-12 items-center">
                            <View className="w-32 h-32 rounded-full bg-primary/10 items-center justify-center mb-6">
                                <MaterialCommunityIcons
                                    name="podcast"
                                    size={64}
                                    color="#D32F2F"
                                />
                            </View>
                            <Text className="text-headline text-text-primary font-semibold mb-2 text-center">
                                Create Your First Podcast
                            </Text>
                            <Text className="text-body text-text-secondary text-center mb-6 px-8">
                                Share your story! Record audio or upload an
                                existing file to get started.
                            </Text>
                            <TouchableOpacity
                                onPress={() => router.push("/(main)/create")}
                                className="bg-primary px-8 py-4 rounded-full flex-row items-center"
                                activeOpacity={0.8}
                            >
                                <MaterialCommunityIcons
                                    name="plus-circle"
                                    size={24}
                                    color="white"
                                />
                                <Text className="text-white font-semibold text-base ml-2">
                                    Create New Podcast
                                </Text>
                            </TouchableOpacity>
                        </View>
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
                                    onPlayPress={() => handlePlayPodcast(item)}
                                    isPlaying={
                                        currentTrack?.id === item.id &&
                                        isPlaying
                                    }
                                    showPlayButton={true}
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

                {/* Floating Action Button removed - using tab bar + button instead */}
            </View>
        </SafeAreaView>
    );
}
