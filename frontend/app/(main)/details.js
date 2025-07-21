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
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { AudioPlayer } from "../../src/components/audio";
import useAudioStore from "../../src/context/useAudioStore";
import apiService from "../../src/services/api/apiService";
import { useToast } from "../../src/components/Toast";

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

    useEffect(() => {
        loadPodcastDetails();
    }, [params.id]);

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
            console.error("Failed to load podcast details:", error);
            showToast("Failed to load podcast details", "error");
        } finally {
            setIsLoading(false);
        }
    };

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
            console.error("Playback failed:", error);
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
            console.error("Like action failed:", error);
            showToast("Action failed", "error");
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
            console.error("Bookmark action failed:", error);
            showToast("Action failed", "error");
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
            console.error("Share failed:", error);
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
                            console.error("Delete failed:", error);
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

    return (
        <SafeAreaView className="flex-1 bg-background">
            {/* Header */}
            <View className="flex-row items-center justify-between px-6 py-4 border-b border-border">
                <TouchableOpacity onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
                </TouchableOpacity>

                <Text className="text-text-primary font-semibold">
                    Podcast Details
                </Text>

                <View className="flex-row items-center space-x-4">
                    <TouchableOpacity onPress={handleShare}>
                        <Ionicons
                            name="share-outline"
                            size={24}
                            color="#FFFFFF"
                        />
                    </TouchableOpacity>

                    {isOwner && (
                        <TouchableOpacity onPress={handleEdit}>
                            <MaterialCommunityIcons
                                name="pencil"
                                size={24}
                                color="#FFFFFF"
                            />
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
                {/* Podcast Header */}
                <View className="px-6 py-6">
                    {/* Thumbnail Placeholder */}
                    <View
                        className="bg-panel rounded-lg mb-6 items-center justify-center"
                        style={{
                            width: screenWidth - 48,
                            height: screenWidth - 48,
                            maxHeight: 300,
                        }}
                    >
                        <MaterialCommunityIcons
                            name="music-note"
                            size={80}
                            color="#888888"
                        />
                    </View>

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
                            <Text className="text-text-secondary text-sm bg-panel px-2 py-1 rounded">
                                {podcast.category}
                            </Text>
                        </View>

                        {podcast.aiEnhanced && (
                            <View className="bg-primary/20 px-2 py-1 rounded">
                                <Text className="text-primary text-sm">
                                    🤖 AI Enhanced
                                </Text>
                            </View>
                        )}
                    </View>

                    {/* Action Buttons */}
                    <View className="flex-row items-center space-x-4 mb-6">
                        <TouchableOpacity
                            onPress={handleLike}
                            className={`flex-row items-center px-4 py-2 rounded-lg ${
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
                            className={`flex-row items-center px-4 py-2 rounded-lg ${
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
                            className="flex-row items-center px-4 py-2 rounded-lg bg-panel"
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

                {/* Audio Player */}
                {podcast.audio_url && (
                    <View className="px-6 mb-6">
                        <AudioPlayer
                            uri={podcast.audio_url}
                            title={podcast.title}
                            artist={podcast.owner?.name || "Unknown Artist"}
                            duration={podcast.duration * 1000} // Convert to milliseconds
                            onPlayStateChange={(playing) => {
                                if (playing && !showMiniPlayer) {
                                    toggleMiniPlayer(true);
                                }
                            }}
                        />
                    </View>
                )}

                {/* Description */}
                {podcast.description && (
                    <View className="px-6 mb-6">
                        <Text className="text-text-primary text-lg font-semibold mb-3">
                            Description
                        </Text>
                        <Text className="text-text-secondary leading-6">
                            {podcast.description}
                        </Text>
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
