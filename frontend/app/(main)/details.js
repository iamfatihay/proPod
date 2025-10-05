import React, { useState, useEffect } from "react";
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    SafeAreaView,
    Platform,
    Dimensions,
    Share,
    Alert,
    Animated,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import ModernAudioPlayer from "../../src/components/audio/ModernAudioPlayer";
import useAudioStore from "../../src/context/useAudioStore";
import apiService from "../../src/services/api/apiService";
import { useToast } from "../../src/components/Toast";
import { Stack } from "expo-router";
import Logger from "../../src/utils/logger";

const { width: screenWidth } = Dimensions.get("window");

const Details = () => {
    const router = useRouter();
    const params = useLocalSearchParams();
    const { showToast } = useToast();

    // Audio store
    const {
        currentTrack,
        isPlaying,
        play,
        pause,
        setQueue,
        addToQueue,
        showMiniPlayer,
        toggleMiniPlayer,
    } = useAudioStore();

    // Local state
    const [podcast, setPodcast] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isLiked, setIsLiked] = useState(false);
    const [isBookmarked, setIsBookmarked] = useState(false);
    const [relatedPodcasts, setRelatedPodcasts] = useState([]);
    const [isOwner, setIsOwner] = useState(false);
    const [pulse] = useState(new Animated.Value(1));

    useEffect(() => {
        loadPodcastDetails();
    }, [params.id, params.refresh]);

    // Handle optimistic update from edit page
    useEffect(() => {
        if (podcast && params.updatedTitle) {
            setPodcast((prevPodcast) => ({
                ...prevPodcast,
                title: params.updatedTitle,
                description:
                    params.updatedDescription || prevPodcast.description,
                category: params.updatedCategory || prevPodcast.category,
                is_public: params.updatedIsPublic === "true",
            }));
        }
    }, [
        params.updatedTitle,
        params.updatedDescription,
        params.updatedCategory,
        params.updatedIsPublic,
        podcast,
    ]);

    const loadPodcastDetails = async () => {
        try {
            setIsLoading(true);

            // Load podcast details
            const podcastData = await apiService.getPodcast(params.id);
            setPodcast(podcastData);

            // Check if current user is owner
            const userProfile = await apiService.getUserProfile();
            setIsOwner(userProfile.id === podcastData.owner_id);

            // Load user interactions
            const interactions = await apiService.getPodcastInteractions(
                params.id
            );
            setIsLiked(interactions.isLiked);
            setIsBookmarked(interactions.isBookmarked);

            // Load related podcasts
            const related = await apiService.getRelatedPodcasts(params.id);
            setRelatedPodcasts(related);
        } catch (error) {
            Logger.error("Failed to load podcast details:", error);
            showToast("Failed to load podcast details", "error");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(pulse, {
                    toValue: 1.06,
                    duration: 1200,
                    useNativeDriver: true,
                }),
                Animated.timing(pulse, {
                    toValue: 1,
                    duration: 1200,
                    useNativeDriver: true,
                }),
            ])
        ).start();
    }, []);

    const handlePlay = async () => {
        if (!podcast?.audio_url) {
            showToast("Audio not available", "error");
            return;
        }

        const track = {
            id: podcast.id,
            uri: podcast.audio_url,
            title: podcast.title,
            artist: podcast.owner?.name || "Unknown Artist",
            duration: podcast.duration || 0,
            artwork: podcast.thumbnail_url,
            category: podcast.category,
            description: podcast.description,
        };

        try {
            if (currentTrack?.id === podcast.id) {
                // Same track - toggle play/pause
                if (isPlaying) {
                    await pause();
                } else {
                    await play();
                }
            } else {
                // New track - start playing
                await play(track);

                // Set queue with related podcasts
                const queue = [
                    track,
                    ...relatedPodcasts.map((p) => ({
                        id: p.id,
                        uri: p.audio_url,
                        title: p.title,
                        artist: p.owner?.name || "Unknown Artist",
                        duration: p.duration || 0,
                        artwork: p.thumbnail_url,
                    })),
                ];

                setQueue(queue, 0);
            }
        } catch (error) {
            Logger.error("Playback failed:", error);
            showToast("Failed to start playback", "error");
        }
    };

    const handleLike = async () => {
        try {
            if (isLiked) {
                await apiService.unlikePodcast(podcast.id);
                setIsLiked(false);
                showToast("Removed from likes", "success");
            } else {
                await apiService.likePodcast(podcast.id);
                setIsLiked(true);
                showToast("Added to likes", "success");
            }
        } catch (error) {
            Logger.error("Like action failed:", error);
            const msg =
                error?.detail ||
                error?.response?.data?.detail ||
                error?.message ||
                "Action failed";
            showToast(msg, "error");
        }
    };

    const handleBookmark = async () => {
        try {
            if (isBookmarked) {
                await apiService.removeBookmark(podcast.id);
                setIsBookmarked(false);
                showToast("Bookmark removed", "success");
            } else {
                await apiService.addBookmark(podcast.id);
                setIsBookmarked(true);
                showToast("Bookmarked", "success");
            }
        } catch (error) {
            Logger.error("Bookmark action failed:", error);
            const msg =
                error?.detail ||
                error?.response?.data?.detail ||
                error?.message ||
                "Action failed";
            showToast(msg, "error");
        }
    };

    const handleShare = async () => {
        try {
            const shareMessage = `Check out this podcast: ${podcast.title}\n\nListen on Volo App!`;

            if (Platform.OS === "ios") {
                await Share.share({
                    message: shareMessage,
                    url: `volo://podcast/${podcast.id}`,
                });
            } else {
                await Share.share({
                    message: `${shareMessage}\n\nvolo://podcast/${podcast.id}`,
                });
            }
        } catch (error) {
            Logger.error("Share failed:", error);
        }
    };

    const handleAddToQueue = async () => {
        if (!podcast?.audio_url) return;

        const track = {
            id: podcast.id,
            uri: podcast.audio_url,
            title: podcast.title,
            artist: podcast.owner?.name || "Unknown Artist",
            duration: podcast.duration || 0,
            artwork: podcast.thumbnail_url,
        };

        addToQueue(track);
        showToast("Added to queue", "success");
    };

    const handleEdit = () => {
        router.push({
            pathname: "/(main)/edit-podcast",
            params: { id: podcast.id },
        });
    };

    const handleDelete = () => {
        Alert.alert(
            "Delete Podcast",
            "Are you sure you want to delete this podcast? This action cannot be undone.",
            [
                {
                    text: "Cancel",
                    style: "cancel",
                },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            await apiService.deletePodcast(podcast.id);
                            showToast("Podcast deleted", "success");
                            router.back();
                        } catch (error) {
                            Logger.error("Delete failed:", error);
                            showToast("Failed to delete podcast", "error");
                        }
                    },
                },
            ]
        );
    };

    const formatDuration = (seconds) => {
        if (!seconds) return "0:00";
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, "0")}`;
    };

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
        });
    };

    if (isLoading) {
        return (
            <SafeAreaView className="flex-1 bg-background">
                <View className="flex-1 justify-center items-center">
                    <MaterialCommunityIcons
                        name="loading"
                        size={48}
                        color="#D32F2F"
                    />
                    <Text className="text-text-secondary mt-4">
                        Loading podcast...
                    </Text>
                </View>
            </SafeAreaView>
        );
    }

    if (!podcast) {
        return (
            <SafeAreaView className="flex-1 bg-background">
                <View className="flex-1 justify-center items-center px-6">
                    <MaterialCommunityIcons
                        name="alert-circle"
                        size={48}
                        color="#EF4444"
                    />
                    <Text className="text-text-primary text-lg font-semibold mt-4 text-center">
                        Podcast Not Found
                    </Text>
                    <Text className="text-text-secondary text-center mt-2">
                        The podcast you're looking for might have been removed
                        or is no longer available.
                    </Text>
                    <TouchableOpacity
                        onPress={() => router.back()}
                        className="bg-primary px-6 py-3 rounded-lg mt-6"
                    >
                        <Text className="text-white font-semibold">
                            Go Back
                        </Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    const themeColor = "#FFFFFF";

    return (
        <SafeAreaView className="flex-1 bg-background">
            <Stack.Screen
                options={{
                    title: "Podcast Details",
                    headerShown: true,
                    headerStyle: {
                        backgroundColor: "#18181b",
                    },
                    headerTintColor: "#FFFFFF",
                    headerTitleStyle: {
                        fontWeight: "500",
                    },
                    headerLeft: () => (
                        <TouchableOpacity
                            onPress={() => router.back()}
                            style={{ marginLeft: 16 }}
                            hitSlop={{
                                top: 10,
                                bottom: 10,
                                left: 10,
                                right: 10,
                            }}
                        >
                            <Ionicons
                                name="arrow-back"
                                size={24}
                                color="#FFFFFF"
                            />
                        </TouchableOpacity>
                    ),
                    headerRight: () => (
                        <View style={{ flexDirection: "row", marginRight: 16 }}>
                            <TouchableOpacity
                                onPress={handleShare}
                                style={{ padding: 12 }}
                                hitSlop={{
                                    top: 10,
                                    bottom: 10,
                                    left: 10,
                                    right: 10,
                                }}
                            >
                                <Ionicons
                                    name="share-outline"
                                    size={24}
                                    color="#FFFFFF"
                                />
                            </TouchableOpacity>
                            {isOwner && (
                                <TouchableOpacity
                                    onPress={handleEdit}
                                    style={{ padding: 12 }}
                                    hitSlop={{
                                        top: 10,
                                        bottom: 10,
                                        left: 10,
                                        right: 10,
                                    }}
                                >
                                    <Ionicons
                                        name="pencil-outline"
                                        size={24}
                                        color="#FFFFFF"
                                    />
                                </TouchableOpacity>
                            )}
                        </View>
                    ),
                }}
            />

            <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
                {/* Podcast Header */}
                <View className="px-6 py-6">
                    {/* AI Artwork */}
                    <Animated.View style={{ transform: [{ scale: pulse }] }}>
                        <View
                            className="rounded-2xl mb-6 items-center justify-center"
                            style={{
                                width: screenWidth - 48,
                                height: screenWidth - 48,
                                maxHeight: 300,
                                backgroundColor: "#0f0f10",
                                borderWidth: 1,
                                borderColor: "#1f1f22",
                            }}
                        >
                            <MaterialCommunityIcons
                                name="waveform"
                                size={74}
                                color="#D32F2F"
                            />
                            <Text className="text-text-secondary mt-2">
                                AI Optimized Playback
                            </Text>
                        </View>
                    </Animated.View>

                    {/* Title and Info */}
                    <Text className="text-text-primary text-2xl font-bold mb-2">
                        {podcast.title}
                    </Text>

                    <Text className="text-text-secondary text-lg mb-4">
                        by {podcast.owner?.name || "Unknown Artist"}
                    </Text>

                    {/* Metadata */}
                    <View className="flex-row items-center justify-between mb-6">
                        <View className="flex-row items-center space-x-4">
                            <Text className="text-text-secondary text-sm">
                                {formatDuration(podcast.duration)}
                            </Text>
                            <Text className="text-text-secondary text-sm">
                                {formatDate(podcast.created_at)}
                            </Text>
                            <View className="px-2 py-1 rounded-full bg-primary/20 border border-primary/30">
                                <Text className="text-primary text-xs">
                                    {podcast.category}
                                </Text>
                            </View>
                        </View>

                        {podcast.aiEnhanced && (
                            <View className="bg-success/20 px-2 py-1 rounded-full border border-success/30">
                                <Text className="text-success text-xs">
                                    🤖 AI Enhanced
                                </Text>
                            </View>
                        )}
                    </View>

                    {/* Action Buttons */}
                    <View className="flex-row items-center mb-6">
                        <TouchableOpacity
                            onPress={handleLike}
                            className={`flex-row items-center px-4 py-2 rounded-lg mr-3 ${
                                isLiked ? "bg-primary" : "bg-panel"
                            }`}
                        >
                            <MaterialCommunityIcons
                                name={isLiked ? "heart" : "heart-outline"}
                                size={20}
                                color={isLiked ? "white" : "#888888"}
                            />
                            <Text
                                className={`ml-2 ${
                                    isLiked
                                        ? "text-white"
                                        : "text-text-secondary"
                                }`}
                            >
                                Like
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={handleBookmark}
                            className={`flex-row items-center px-4 py-2 rounded-lg mr-3 ${
                                isBookmarked ? "bg-warning" : "bg-panel"
                            }`}
                        >
                            <MaterialCommunityIcons
                                name={
                                    isBookmarked
                                        ? "bookmark"
                                        : "bookmark-outline"
                                }
                                size={20}
                                color={isBookmarked ? "white" : "#888888"}
                            />
                            <Text
                                className={`ml-2 ${
                                    isBookmarked
                                        ? "text-white"
                                        : "text-text-secondary"
                                }`}
                            >
                                Save
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={handleAddToQueue}
                            className="flex-row items-center px-4 py-2 rounded-lg bg-panel mr-3"
                        >
                            <MaterialCommunityIcons
                                name="playlist-plus"
                                size={20}
                                color="#888888"
                            />
                            <Text className="text-text-secondary ml-2">
                                Queue
                            </Text>
                        </TouchableOpacity>

                        {isOwner && (
                            <TouchableOpacity
                                onPress={handleDelete}
                                className="flex-row items-center px-4 py-2 rounded-lg bg-error/20"
                            >
                                <MaterialCommunityIcons
                                    name="delete-outline"
                                    size={20}
                                    color="#EF4444"
                                />
                            </TouchableOpacity>
                        )}
                    </View>
                </View>

                {/* Modern Audio Player - Use real audio URL if available */}
                <View className="px-6 mb-6">
                    <ModernAudioPlayer
                        uri={
                            podcast.audio_url ||
                            "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3"
                        }
                        title={podcast.title}
                        artist={podcast.owner?.name || "Unknown Artist"}
                        duration={podcast.duration * 1000 || 180000} // Convert to milliseconds or 3 min demo
                        onPlayStateChange={(playing) => {
                            if (playing && !showMiniPlayer) {
                                toggleMiniPlayer(true);
                            }
                        }}
                    />
                </View>

                {/* Description */}
                {podcast.description && (
                    <View className="px-6 mb-6">
                        <Text className="text-text-primary text-lg font-semibold mb-3">
                            Description
                        </Text>
                        <View className="bg-card rounded-xl p-4 border border-border">
                            <Text className="text-text-secondary leading-6">
                                {podcast.description}
                            </Text>
                        </View>
                    </View>
                )}

                {/* Related Podcasts */}
                {relatedPodcasts.length > 0 && (
                    <View className="px-6 mb-6">
                        <Text className="text-text-primary text-lg font-semibold mb-4">
                            Related Podcasts
                        </Text>

                        {relatedPodcasts.map((relatedPodcast) => (
                            <TouchableOpacity
                                key={relatedPodcast.id}
                                onPress={() =>
                                    router.push({
                                        pathname: "/(main)/details",
                                        params: { id: relatedPodcast.id },
                                    })
                                }
                                className="flex-row items-center bg-panel rounded-lg p-4 mb-3"
                            >
                                <View className="w-12 h-12 bg-card rounded-lg items-center justify-center mr-4">
                                    <MaterialCommunityIcons
                                        name="music-note"
                                        size={24}
                                        color="#888888"
                                    />
                                </View>

                                <View className="flex-1">
                                    <Text
                                        className="text-text-primary font-semibold"
                                        numberOfLines={1}
                                    >
                                        {relatedPodcast.title}
                                    </Text>
                                    <Text
                                        className="text-text-secondary text-sm"
                                        numberOfLines={1}
                                    >
                                        {relatedPodcast.owner?.name ||
                                            "Unknown Artist"}{" "}
                                        •{" "}
                                        {formatDuration(
                                            relatedPodcast.duration
                                        )}
                                    </Text>
                                </View>

                                <MaterialCommunityIcons
                                    name="chevron-right"
                                    size={24}
                                    color="#888888"
                                />
                            </TouchableOpacity>
                        ))}
                    </View>
                )}

                {/* Bottom Spacing for Mini Player */}
                <View style={{ height: showMiniPlayer ? 100 : 20 }} />
            </ScrollView>
        </SafeAreaView>
    );
};

export default Details;
