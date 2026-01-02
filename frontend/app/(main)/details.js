import React, { useState, useEffect, useCallback } from "react";
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    SafeAreaView,
    Platform,
    Dimensions,
    Share,
    Animated,
    StatusBar,
    Image,
    ActivityIndicator,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import ModernAudioPlayer from "../../src/components/audio/ModernAudioPlayer";
import useAudioStore from "../../src/context/useAudioStore";
import apiService from "../../src/services/api/apiService";
import { useToast } from "../../src/components/Toast";
import { Stack } from "expo-router";
import Logger from "../../src/utils/logger";
import ConfirmationModal from "../../src/components/ConfirmationModal";
import { normalizePodcast, normalizePodcasts } from "../../src/utils/urlHelper";

const { width: screenWidth } = Dimensions.get("window");

const Details = () => {
    const router = useRouter();
    const params = useLocalSearchParams();
    const { showToast } = useToast();

    // PERFORMANCE FIX: Use selective subscriptions to prevent unnecessary re-renders
    // Only subscribe to values that affect THIS component's UI
    // position/duration updates DON'T need to re-render the whole page

    // Critical state for play button and player visibility
    const currentTrack = useAudioStore((state) => state.currentTrack);
    const isPlaying = useAudioStore((state) => state.isPlaying);
    const isAudioLoading = useAudioStore((state) => state.isLoading);
    const showMiniPlayer = useAudioStore((state) => state.showMiniPlayer);
    const audioError = useAudioStore((state) => state.error);

    // CRITICAL: DON'T subscribe to position/duration/playbackRate/volume here!
    // They change frequently (position: 10x/second) and cause unnecessary re-renders
    // ModernAudioPlayer will subscribe to them directly
    // We only pass the store actions to ModernAudioPlayer

    // Actions (these are stable, don't cause re-renders)
    const play = useAudioStore((state) => state.play);
    const pause = useAudioStore((state) => state.pause);
    const setQueue = useAudioStore((state) => state.setQueue);
    const addToQueue = useAudioStore((state) => state.addToQueue);
    const toggleMiniPlayer = useAudioStore((state) => state.toggleMiniPlayer);
    const setPlaybackRate = useAudioStore((state) => state.setPlaybackRate);
    const setVolume = useAudioStore((state) => state.setVolume);
    const seek = useAudioStore((state) => state.seek);
    const clearError = useAudioStore((state) => state.clearError);

    // Local state
    const [podcast, setPodcast] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isLiked, setIsLiked] = useState(false);
    const [isBookmarked, setIsBookmarked] = useState(false);
    const [relatedPodcasts, setRelatedPodcasts] = useState([]);
    const [isOwner, setIsOwner] = useState(false);
    const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
    const [pulse] = useState(new Animated.Value(1));

    // Loading states for actions
    // Note: isPlayingLoading removed - using isAudioLoading from useAudioStore instead
    // Play action is fast (optimistic update), so separate loading state is unnecessary
    const [isLiking, setIsLiking] = useState(false);
    const [isBookmarking, setIsBookmarking] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    // Watch for audio playback errors and show toast
    useEffect(() => {
        if (audioError) {
            showToast(audioError, "error");
            clearError(); // Clear error after showing
        }
    }, [audioError, clearError, showToast]);

    useEffect(() => {
        loadPodcastDetails();
    }, [params.id, params.refresh]);

    // Handle optimistic update from edit page (only once when params change)
    useEffect(() => {
        if (podcast && params.updatedTitle) {
            setPodcast((prevPodcast) => {
                // Only update if values actually changed (prevent infinite loop)
                if (
                    prevPodcast.title !== params.updatedTitle ||
                    prevPodcast.description !==
                        (params.updatedDescription ||
                            prevPodcast.description) ||
                    prevPodcast.category !==
                        (params.updatedCategory || prevPodcast.category) ||
                    prevPodcast.is_public !==
                        (params.updatedIsPublic === "true")
                ) {
                    return {
                        ...prevPodcast,
                        title: params.updatedTitle,
                        description:
                            params.updatedDescription ||
                            prevPodcast.description,
                        category:
                            params.updatedCategory || prevPodcast.category,
                        is_public: params.updatedIsPublic === "true",
                    };
                }
                return prevPodcast;
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        params.updatedTitle,
        params.updatedDescription,
        params.updatedCategory,
        params.updatedIsPublic,
    ]);

    const loadPodcastDetails = async () => {
        try {
            setIsLoading(true);

            // Load podcast details
            const podcastData = await apiService.getPodcast(params.id);
            // Normalize URLs (relative to absolute)
            setPodcast(normalizePodcast(podcastData));

            // Check if current user is owner
            const userProfile = await apiService.getUserProfile();
            setIsOwner(userProfile.id === podcastData.owner_id);

            // Load user interactions
            const interactions = await apiService.getPodcastInteractions(
                params.id
            );
            setIsLiked(interactions.is_liked);
            setIsBookmarked(interactions.is_bookmarked);

            // Load related podcasts
            const related = await apiService.getRelatedPodcasts(params.id);
            // Normalize related podcasts URLs
            setRelatedPodcasts(normalizePodcasts(related));
        } catch (error) {
            Logger.error("Failed to load podcast details:", error);
            showToast("Failed to load podcast details", "error");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        // PERFORMANCE: Only run pulse animation when NOT playing
        // Stop animation when audio is playing to save CPU
        if (currentTrack?.id === podcast?.id && isPlaying) {
            // Audio is playing, stop pulse animation
            pulse.setValue(1);
            return;
        }

        // Start pulse animation only when not playing
        const animation = Animated.loop(
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
        );
        animation.start();

        // Cleanup: stop animation when component unmounts or effect re-runs
        return () => {
            animation.stop();
        };
    }, [currentTrack?.id, podcast?.id, isPlaying, pulse]);

    const handlePlay = useCallback(() => {
        if (!podcast?.audio_url) {
            showToast("Audio not available", "error");
            return;
        }

        // Prevent multiple clicks - use audio store's isLoading
        if (isAudioLoading) return;

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
        if (currentTrack?.id === podcast.id) {
            // Same track - toggle play/pause
            if (isPlaying) {
                pause();
            } else {
                play();
            }
        } else {
            // New track - start playing immediately
            play(track);

            // PERFORMANCE: Set queue lazily in the background (non-blocking)
            // This prevents UI freezing while building the queue
            requestAnimationFrame(() => {
                // Only build queue if we have related podcasts
                if (relatedPodcasts.length > 0) {
                    const queue = [
                        track,
                        ...relatedPodcasts
                            .filter((p) => p.audio_url)
                            .map((p) => ({
                                id: p.id,
                                uri: p.audio_url,
                                title: p.title,
                                artist: p.owner?.name || "Unknown Artist",
                                duration: (p.duration || 0) * 1000,
                                artwork: p.thumbnail_url,
                            })),
                    ];
                    setQueue(queue, 0);
                } else {
                    // Just current track in queue
                    setQueue([track], 0);
                }
            });
        }
    }, [
        podcast?.id,
        podcast?.audio_url,
        podcast?.title,
        podcast?.owner?.name,
        podcast?.duration,
        podcast?.thumbnail_url,
        podcast?.category,
        podcast?.description,
        currentTrack?.id,
        isPlaying,
        isAudioLoading,
        relatedPodcasts,
        play,
        pause,
        setQueue,
        showToast,
    ]);

    // PERFORMANCE: Memoize skip handlers to prevent ModernAudioPlayer re-renders
    // CRITICAL FIX: Remove position/duration from dependencies
    // These callbacks should be stable references that internally fetch current values
    const handleSkipForward = useCallback(() => {
        // Fetch fresh position/duration from store inside the callback
        const currentPos = useAudioStore.getState().position;
        const currentDur =
            useAudioStore.getState().duration ||
            (podcast?.duration ? podcast.duration * 1000 : 0);
        const newPos = Math.min(currentPos + 15000, currentDur);
        seek(newPos);
    }, [podcast?.duration, seek]); // Only depend on podcast duration (rarely changes) and seek (stable)

    const handleSkipBackward = useCallback(() => {
        // Fetch fresh position from store inside the callback
        const currentPos = useAudioStore.getState().position;
        const newPos = Math.max(currentPos - 15000, 0);
        seek(newPos);
    }, [seek]); // Only depend on seek (stable reference)

    const handleLike = async () => {
        if (isLiking) return; // Prevent multiple clicks

        try {
            setIsLiking(true);
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
        } finally {
            setIsLiking(false);
        }
    };

    const handleBookmark = async () => {
        if (isBookmarking) return; // Prevent multiple clicks

        try {
            setIsBookmarking(true);
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

            // Check if it's an auth error
            if (error.status === 401) {
                Logger.warn("Authentication error - session may have expired");
            }
        } finally {
            setIsBookmarking(false);
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
        setDeleteConfirmVisible(true);
    };

    const confirmDelete = async () => {
        setDeleteConfirmVisible(false);
        if (isDeleting) return; // Prevent multiple clicks

        try {
            setIsDeleting(true);
            await apiService.deletePodcast(podcast.id);
            showToast("Podcast deleted", "success");
            router.back();
        } catch (error) {
            Logger.error("Delete failed:", error);
            const errorMessage = error.message || "Failed to delete podcast";
            showToast(errorMessage, "error");

            // Check if it's an auth error
            if (error.status === 401) {
                Logger.warn("Authentication error - session may have expired");
            }
        } finally {
            setIsDeleting(false);
        }
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
            {/* Delete Confirmation Modal */}
            <ConfirmationModal
                visible={deleteConfirmVisible}
                onClose={() => setDeleteConfirmVisible(false)}
                onConfirm={confirmDelete}
                title="Delete Podcast"
                message="Are you sure you want to delete this podcast? This action cannot be undone."
                confirmText="Delete"
                cancelText="Cancel"
                destructive={true}
                icon="trash"
            />

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

            <ScrollView
                className="flex-1"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{
                    paddingTop:
                        Platform.OS === "android" ? StatusBar.currentHeight : 0,
                    paddingBottom: 32,
                }}
            >
                {/* Podcast Header */}
                <View className="px-6 py-6">
                    {/* Podcast Artwork / Thumbnail */}
                    <Animated.View style={{ transform: [{ scale: pulse }] }}>
                        <View
                            className="rounded-2xl mb-6 items-center justify-center overflow-hidden"
                            style={{
                                width: screenWidth - 48,
                                height: screenWidth - 48,
                                maxHeight: 300,
                                backgroundColor: "#0f0f10",
                                borderWidth: 1,
                                borderColor: "#1f1f22",
                            }}
                        >
                            {podcast.thumbnail_url ? (
                                <Image
                                    source={{ uri: podcast.thumbnail_url }}
                                    className="w-full h-full"
                                    resizeMode="cover"
                                />
                            ) : (
                                <>
                                    <MaterialCommunityIcons
                                        name="music-note"
                                        size={74}
                                        color="#D32F2F"
                                    />
                                    <Text className="text-text-secondary mt-2">
                                        {podcast.title}
                                    </Text>
                                </>
                            )}
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

                        {podcast.ai_enhanced && (
                            <View className="bg-success/20 px-2 py-1 rounded-full border border-success/30">
                                <Text className="text-success text-xs">
                                    🤖 AI Enhanced
                                </Text>
                            </View>
                        )}
                    </View>

                    {/* Action Buttons - Improved spacing and layout */}
                    <View className="flex-row items-center mb-6 gap-3">
                        <TouchableOpacity
                            onPress={handleLike}
                            className={`flex-row items-center px-5 py-3 rounded-xl ${
                                isLiked ? "bg-primary" : "bg-panel"
                            }`}
                            activeOpacity={0.7}
                            disabled={isLiking}
                            hitSlop={{
                                top: 10,
                                bottom: 10,
                                left: 10,
                                right: 10,
                            }}
                        >
                            {isLiking ? (
                                <ActivityIndicator
                                    size="small"
                                    color={isLiked ? "white" : "#888888"}
                                />
                            ) : (
                                <MaterialCommunityIcons
                                    name={isLiked ? "heart" : "heart-outline"}
                                    size={22}
                                    color={isLiked ? "white" : "#888888"}
                                />
                            )}
                            <Text
                                className={`ml-2 font-medium ${
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
                            className={`flex-row items-center px-5 py-3 rounded-xl ${
                                isBookmarked ? "bg-warning" : "bg-panel"
                            }`}
                            activeOpacity={0.7}
                            disabled={isBookmarking}
                            hitSlop={{
                                top: 10,
                                bottom: 10,
                                left: 10,
                                right: 10,
                            }}
                        >
                            {isBookmarking ? (
                                <ActivityIndicator
                                    size="small"
                                    color={isBookmarked ? "white" : "#888888"}
                                />
                            ) : (
                                <MaterialCommunityIcons
                                    name={
                                        isBookmarked
                                            ? "bookmark"
                                            : "bookmark-outline"
                                    }
                                    size={22}
                                    color={isBookmarked ? "white" : "#888888"}
                                />
                            )}
                            <Text
                                className={`ml-2 font-medium ${
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
                            className="flex-row items-center px-5 py-3 rounded-xl bg-panel"
                            activeOpacity={0.7}
                            hitSlop={{
                                top: 10,
                                bottom: 10,
                                left: 10,
                                right: 10,
                            }}
                        >
                            <MaterialCommunityIcons
                                name="playlist-plus"
                                size={22}
                                color="#888888"
                            />
                            <Text className="text-text-secondary ml-2 font-medium">
                                Queue
                            </Text>
                        </TouchableOpacity>

                        {isOwner && (
                            <TouchableOpacity
                                onPress={handleDelete}
                                className="flex-row items-center px-5 py-3 rounded-xl bg-error/20"
                                activeOpacity={0.7}
                                disabled={isDeleting}
                                hitSlop={{
                                    top: 10,
                                    bottom: 10,
                                    left: 10,
                                    right: 10,
                                }}
                            >
                                {isDeleting ? (
                                    <ActivityIndicator
                                        size="small"
                                        color="#EF4444"
                                    />
                                ) : (
                                    <MaterialCommunityIcons
                                        name="delete-outline"
                                        size={22}
                                        color="#EF4444"
                                    />
                                )}
                                <Text className="text-error ml-2 font-medium">
                                    Delete
                                </Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>

                {/* Audio Player - Show full player when this track is playing */}
                {currentTrack?.id === podcast.id && podcast.audio_url ? (
                    <View className="px-6 mb-6">
                        <ModernAudioPlayer
                            uri={podcast.audio_url}
                            title={podcast.title}
                            artist={podcast.owner?.name || "Unknown Artist"}
                            isPlaying={isPlaying}
                            onPlay={play}
                            onPause={pause}
                            onSeek={seek}
                            onSkipForward={handleSkipForward}
                            onSkipBackward={handleSkipBackward}
                            onPlaybackRateChange={setPlaybackRate}
                            onVolumeChange={setVolume}
                            showProgress={true}
                            showControls={true}
                        />
                    </View>
                ) : (
                    /* Play Button - Show when track is not playing */
                    <View className="px-6 mb-6">
                        <TouchableOpacity
                            onPress={handlePlay}
                            className="flex-row items-center justify-center px-8 py-4 rounded-xl bg-panel border border-border"
                            activeOpacity={0.8}
                            disabled={!podcast.audio_url || isAudioLoading}
                        >
                            {isAudioLoading ? (
                                <ActivityIndicator
                                    size="small"
                                    color="#D32F2F"
                                />
                            ) : (
                                <MaterialCommunityIcons
                                    name="play-circle"
                                    size={32}
                                    color={
                                        podcast.audio_url
                                            ? "#D32F2F"
                                            : "#888888"
                                    }
                                />
                            )}
                            <Text
                                className={`ml-3 text-lg font-semibold ${
                                    podcast.audio_url && !isAudioLoading
                                        ? "text-text-primary"
                                        : "text-text-secondary"
                                }`}
                            >
                                {isAudioLoading
                                    ? "Loading..."
                                    : podcast.audio_url
                                    ? "Play"
                                    : "Audio not available"}
                            </Text>
                        </TouchableOpacity>
                    </View>
                )}

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
