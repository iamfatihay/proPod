import {
    View,
    Text,
    Image,
    SafeAreaView,
    FlatList,
    ActivityIndicator,
    RefreshControl,
    TouchableOpacity,
    Platform,
    ScrollView,
    StatusBar,
} from "react-native";
import React, { useEffect, useState, useCallback } from "react";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams, useFocusEffect } from "expo-router";
import useAuthStore from "../../src/context/useAuthStore";
import useAudioStore from "../../src/context/useAudioStore";
import useViewModeStore from "../../src/context/useViewModeStore";
import PodcastCard from "../../src/components/PodcastCard";
import GradientCard from "../../src/components/GradientCard";
import ModeToggle from "../../src/components/ModeToggle";
import HeroSection from "../../src/components/HeroSection";
import QuickActionsBar from "../../src/components/QuickActionsBar";
import { normalizePodcast } from "../../src/utils/urlHelper";
import { PodcastCardSkeleton } from "../../src/components/SkeletonLoader";
import apiService from "../../src/services/api/apiService";
import { useToast } from "../../src/components/Toast";
import Logger from "../../src/utils/logger";

// Import design tokens from Tailwind config
const colors = require("../../tailwind.config").theme.extend.colors;

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
    const params = useLocalSearchParams();
    const { user, logout } = useAuthStore();
    const { showToast } = useToast();
    const { viewMode } = useViewModeStore();

    // PERFORMANCE FIX: Use selective subscriptions to prevent unnecessary re-renders
    // Only subscribe to values that affect THIS component's UI
    const currentTrack = useAudioStore((state) => state.currentTrack);
    const isPlaying = useAudioStore((state) => state.isPlaying);
    const showMiniPlayer = useAudioStore((state) => state.showMiniPlayer);
    const audioError = useAudioStore((state) => state.error);

    // Actions (stable, don't cause re-renders)
    const play = useAudioStore((state) => state.play);
    const pause = useAudioStore((state) => state.pause);
    const toggleMiniPlayer = useAudioStore((state) => state.toggleMiniPlayer);
    const clearError = useAudioStore((state) => state.clearError);

    const [podcasts, setPodcasts] = useState([]);
    const [userPodcasts, setUserPodcasts] = useState([]);
    const [trendingPodcasts, setTrendingPodcasts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedCategory, setSelectedCategory] = useState("all");
    const [refreshing, setRefreshing] = useState(false);

    // Watch for audio playback errors and show toast
    useEffect(() => {
        if (audioError) {
            showToast(audioError, "error");
            clearError(); // Clear error after showing
        }
    }, [audioError, clearError, showToast]);

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

    // Reload when params.refresh changes (after delete/create)
    useEffect(() => {
        if (params.refresh) {
            (async () => {
                await load();
            })();
        }
    }, [params.refresh, load]);

    // Reload when screen comes into focus
    useFocusEffect(
        useCallback(() => {
            (async () => {
                await load();
            })();
        }, [load])
    );

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

    // Optimized play functionality - immediate UI response
    const handlePlayPodcast = useCallback(
        (podcast) => {
            // Validate podcast has audio
            if (!podcast.audio_url) {
                showToast("Audio not available", "error");
                return;
            }

            // Create track object
            const track = {
                id: podcast.id,
                uri: podcast.audio_url,
                title: podcast.title,
                artist: podcast.owner?.name || "Unknown Artist",
                duration: (podcast.duration || 0) * 1000, // Convert to milliseconds
                artwork: podcast.thumbnail_url,
                category: podcast.category,
                description: podcast.description,
            };

            // Non-blocking audio operations - errors handled via audioError state
            // Same track - toggle play/pause
            if (currentTrack?.id === podcast.id) {
                if (isPlaying) {
                    pause();
                } else {
                    play();
                }
            } else {
                // New track - start playing
                play(track);

                // Show mini player if not visible
                if (!showMiniPlayer) {
                    toggleMiniPlayer(true);
                }
            }
        },
        [
            currentTrack?.id,
            isPlaying,
            play,
            pause,
            showMiniPlayer,
            toggleMiniPlayer,
            showToast,
        ]
    );

    // Quick action handler
    const handleQuickAction = (actionId) => {
        Logger.log("Quick action:", actionId);
        switch (actionId) {
            case "record":
            case "quick-record":
                // Navigate to create page with appropriate mode
                router.push({
                    pathname: "/(main)/create",
                    params: {
                        mode:
                            actionId === "quick-record"
                                ? "quick-record"
                                : "full-create",
                    },
                });
                break;
            case "analytics":
                showToast("Analytics coming soon! 📊", "info");
                break;
            case "bookmarks":
                router.push("/(main)/library");
                break;
            case "history":
                showToast("Listening history coming soon! 🕐", "info");
                break;
            case "trending":
                setSelectedCategory("all");
                break;
            default:
                showToast("Feature coming soon!", "info");
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-background">
            <ScrollView
                className="flex-1"
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                    />
                }
            >
                <View
                    className="px-4 pb-32"
                    style={{
                        paddingTop:
                            Platform.OS === "android"
                                ? StatusBar.currentHeight + 16
                                : 32,
                    }}
                >
                    {/* Header with Mode Toggle */}
                    <View className="flex-row items-center justify-between mb-6">
                        <View className="flex-1 mr-3">
                            <Text className="text-2xl font-bold text-text-primary mb-2">
                                {viewMode === "studio"
                                    ? "🎙️ Studio"
                                    : "🎧 Discover"}
                            </Text>
                            <Text className="text-sm text-text-secondary">
                                {viewMode === "studio"
                                    ? "Create and manage your podcasts"
                                    : "Explore podcasts curated for you"}
                            </Text>
                        </View>
                        <TouchableOpacity
                            onPress={() => router.push("/(main)/profile")}
                            activeOpacity={0.7}
                            hitSlop={{
                                top: 10,
                                bottom: 10,
                                left: 10,
                                right: 10,
                            }}
                            style={{
                                width: 48,
                                height: 48,
                                borderRadius: 24,
                                overflow: "hidden",
                                backgroundColor: colors.card,
                                borderWidth: 2,
                                borderColor: colors.primary,
                                justifyContent: "center",
                                alignItems: "center",
                            }}
                        >
                            {user && user.photo_url ? (
                                <Image
                                    source={{ uri: user.photo_url }}
                                    style={{
                                        width: "100%",
                                        height: "100%",
                                    }}
                                    resizeMode="cover"
                                />
                            ) : (
                                <Ionicons
                                    name="person"
                                    size={24}
                                    color={colors.text.muted}
                                />
                            )}
                        </TouchableOpacity>
                    </View>

                    {/* Mode Toggle */}
                    <ModeToggle style={{ marginBottom: 24 }} />

                    {/* Hero Section */}
                    <HeroSection
                        onRecordPress={() => router.push("/(main)/create")}
                        onContinueListening={() => {
                            if (currentTrack) {
                                if (!isPlaying) play();
                            }
                        }}
                        userPodcasts={userPodcasts}
                    />

                    {/* Quick Actions Bar */}
                    <View className="-mx-4">
                        <QuickActionsBar
                            onActionPress={handleQuickAction}
                            notifications={{
                                comments: 3,
                                analytics: 0,
                            }}
                        />
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
                                className={`flex-row items-center px-4 py-2 rounded-full mr-3 ${selectedCategory === category.id
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
                                            ? colors.text.primary
                                            : colors.text.muted
                                    }
                                />
                                <Text
                                    className={`ml-2 font-medium ${selectedCategory === category.id
                                            ? "text-white"
                                            : "text-text-secondary"
                                        }`}
                                >
                                    {category.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>

                    {/* For You Feed - Gradient Cards */}
                    <View className="mb-6">
                        <View className="flex-row items-center justify-between mb-4">
                            <View className="flex-row items-center">
                                <MaterialCommunityIcons
                                    name="robot"
                                    size={24}
                                    color={colors.gradient.blue}
                                />
                                <Text className="text-xl font-bold text-text-primary ml-2">
                                    For You
                                </Text>
                            </View>
                            <TouchableOpacity className="flex-row items-center">
                                <Text className="text-primary text-sm font-medium mr-1">
                                    See all
                                </Text>
                                <Ionicons
                                    name="chevron-forward"
                                    size={16}
                                    color={colors.primary}
                                />
                            </TouchableOpacity>
                        </View>
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={{ paddingRight: 16 }}
                        >
                            {loading ? (
                                <>
                                    <View className="w-[180px] h-[220px] bg-panel rounded-2xl mr-4" />
                                    <View className="w-[180px] h-[220px] bg-panel rounded-2xl mr-4" />
                                    <View className="w-[180px] h-[220px] bg-panel rounded-2xl" />
                                </>
                            ) : (
                                podcasts.slice(0, 5).map((podcast) => (
                                    <GradientCard
                                        key={podcast.id}
                                        podcast={podcast}
                                        category={podcast.category}
                                        size="medium"
                                        onPress={() =>
                                            router.push({
                                                pathname: "/(main)/details",
                                                params: { id: podcast.id },
                                            })
                                        }
                                        onPlayPress={() =>
                                            handlePlayPodcast(podcast)
                                        }
                                        isPlaying={
                                            currentTrack?.id === podcast.id &&
                                            isPlaying
                                        }
                                        showAIBadge={true}
                                    />
                                ))
                            )}
                        </ScrollView>
                    </View>

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
                                    color={colors.primary}
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
                            // Error State
                            <View className="py-12 items-center px-6">
                                <View className="w-24 h-24 rounded-full bg-error/10 items-center justify-center mb-4">
                                    <MaterialCommunityIcons
                                        name="alert-circle-outline"
                                        size={48}
                                        color={colors.error}
                                    />
                                </View>
                                <Text className="text-lg text-text-primary font-semibold mb-2 text-center">
                                    Oops! Something went wrong
                                </Text>
                                <Text className="text-sm text-text-secondary text-center mb-6">
                                    {error}
                                </Text>
                                <TouchableOpacity
                                    onPress={onRefresh}
                                    className="bg-primary px-6 py-3 rounded-full flex-row items-center"
                                    activeOpacity={0.8}
                                >
                                    <MaterialCommunityIcons
                                        name="refresh"
                                        size={20}
                                        color="white"
                                    />
                                    <Text className="text-white font-semibold ml-2">
                                        Try Again
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        ) : podcasts.length === 0 ? (
                            // Empty State - Mode-specific
                            <View className="py-12 items-center px-6">
                                {viewMode === "studio" ? (
                                    <>
                                        <View className="w-32 h-32 rounded-full bg-primary/10 items-center justify-center mb-6">
                                            <MaterialCommunityIcons
                                                name="microphone-variant"
                                                size={64}
                                                color={colors.primary}
                                            />
                                        </View>
                                        <Text className="text-headline text-text-primary font-semibold mb-2 text-center">
                                            Start Your Creator Journey
                                        </Text>
                                        <Text className="text-body text-text-secondary text-center mb-6 px-4">
                                            Create your first podcast with
                                            AI-powered tools. Record, edit, and
                                            share your voice with the world!
                                        </Text>
                                        <TouchableOpacity
                                            onPress={() =>
                                                router.push("/(main)/create")
                                            }
                                            className="bg-primary px-8 py-4 rounded-full flex-row items-center"
                                            activeOpacity={0.8}
                                            style={{
                                                ...(Platform.OS === "ios"
                                                    ? {
                                                        shadowColor:
                                                            colors.primary,
                                                        shadowOffset: {
                                                            width: 0,
                                                            height: 4,
                                                        },
                                                        shadowOpacity: 0.3,
                                                        shadowRadius: 8,
                                                    }
                                                    : {
                                                        elevation: 8,
                                                    }),
                                            }}
                                        >
                                            <MaterialCommunityIcons
                                                name="record-circle"
                                                size={24}
                                                color="white"
                                            />
                                            <Text className="text-white font-semibold text-base ml-2">
                                                Create First Podcast
                                            </Text>
                                        </TouchableOpacity>
                                    </>
                                ) : (
                                    <>
                                        <View className="w-32 h-32 rounded-full bg-info/10 items-center justify-center mb-6">
                                            <MaterialCommunityIcons
                                                name="compass-outline"
                                                size={64}
                                                color={colors.info}
                                            />
                                        </View>
                                        <Text className="text-headline text-text-primary font-semibold mb-2 text-center">
                                            No Podcasts Yet
                                        </Text>
                                        <Text className="text-body text-text-secondary text-center mb-6 px-4">
                                            Be the first to discover amazing
                                            content! Check back soon or try
                                            different categories.
                                        </Text>
                                        <TouchableOpacity
                                            onPress={() =>
                                                setSelectedCategory("all")
                                            }
                                            className="bg-info px-8 py-4 rounded-full flex-row items-center"
                                            activeOpacity={0.8}
                                        >
                                            <MaterialCommunityIcons
                                                name="refresh"
                                                size={20}
                                                color="white"
                                            />
                                            <Text className="text-white font-semibold text-base ml-2">
                                                Refresh Feed
                                            </Text>
                                        </TouchableOpacity>
                                    </>
                                )}
                            </View>
                        ) : (
                            <>
                                {podcasts.map((item) => (
                                    <PodcastCard
                                        key={String(item.id)}
                                        podcast={item}
                                        onPress={() =>
                                            router.push({
                                                pathname: "/(main)/details",
                                                params: { id: item.id },
                                            })
                                        }
                                        onPlayPress={() =>
                                            handlePlayPodcast(item)
                                        }
                                        isPlaying={
                                            currentTrack?.id === item.id &&
                                            isPlaying
                                        }
                                        showPlayButton={true}
                                    />
                                ))}
                            </>
                        )}
                    </View>

                    {/* Trending Now Section */}
                    <View className="mb-6">
                        <View className="flex-row items-center justify-between mb-4">
                            <View className="flex-row items-center">
                                <MaterialCommunityIcons
                                    name="fire"
                                    size={24}
                                    color={colors.warning}
                                />
                                <Text className="text-xl font-bold text-text-primary ml-2">
                                    Trending Now
                                </Text>
                            </View>
                        </View>
                        {podcasts.slice(0, 3).map((podcast, index) => (
                            <View
                                key={podcast.id}
                                className="flex-row items-center mb-3 p-3 bg-panel rounded-xl"
                            >
                                <Text className="text-2xl font-bold text-primary mr-3">
                                    #{index + 1}
                                </Text>
                                <View className="flex-1">
                                    <TouchableOpacity
                                        onPress={() =>
                                            router.push({
                                                pathname: "/(main)/details",
                                                params: { id: podcast.id },
                                            })
                                        }
                                    >
                                        <Text
                                            className="text-base font-semibold text-text-primary mb-1"
                                            numberOfLines={1}
                                        >
                                            {podcast.title}
                                        </Text>
                                        <View className="flex-row items-center">
                                            <MaterialCommunityIcons
                                                name="trending-up"
                                                size={12}
                                                color={colors.success}
                                            />
                                            <Text className="text-xs text-success ml-1">
                                                +{podcast.play_count || 0} plays
                                            </Text>
                                        </View>
                                    </TouchableOpacity>
                                </View>
                                <TouchableOpacity
                                    onPress={() => handlePlayPodcast(podcast)}
                                >
                                    <MaterialCommunityIcons
                                        name={
                                            currentTrack?.id === podcast.id &&
                                                isPlaying
                                                ? "pause-circle"
                                                : "play-circle"
                                        }
                                        size={40}
                                        color={colors.primary}
                                    />
                                </TouchableOpacity>
                            </View>
                        ))}
                    </View>

                    {/* Your Podcasts - Studio Mode Only */}
                    {viewMode === "studio" && userPodcasts.length > 0 && (
                        <View className="mb-6">
                            <View className="flex-row items-center justify-between mb-4">
                                <Text className="text-xl font-bold text-text-primary">
                                    Your Podcasts
                                </Text>
                                <TouchableOpacity
                                    onPress={() =>
                                        router.push("/(main)/library")
                                    }
                                    className="flex-row items-center"
                                >
                                    <Text className="text-primary text-sm font-medium mr-1">
                                        Manage
                                    </Text>
                                    <Ionicons
                                        name="chevron-forward"
                                        size={16}
                                        color={colors.primary}
                                    />
                                </TouchableOpacity>
                            </View>
                            {userPodcasts.slice(0, 3).map((podcast) => (
                                <PodcastCard
                                    key={podcast.id}
                                    podcast={podcast}
                                    onPress={() =>
                                        router.push({
                                            pathname: "/(main)/details",
                                            params: { id: podcast.id },
                                        })
                                    }
                                    onPlayPress={() =>
                                        handlePlayPodcast(podcast)
                                    }
                                    isPlaying={
                                        currentTrack?.id === podcast.id &&
                                        isPlaying
                                    }
                                    showPlayButton={true}
                                />
                            ))}
                        </View>
                    )}
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}
