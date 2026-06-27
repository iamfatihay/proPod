import React, { useState, useEffect, useCallback, useRef } from "react";
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    SafeAreaView,
    Platform,
    Dimensions,
    Share,
    StatusBar,
    Image,
    ActivityIndicator,
    TextInput,
    KeyboardAvoidingView,
} from "react-native";
import { useRouter, useLocalSearchParams, useFocusEffect } from "expo-router";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import ModernAudioPlayer from "../../src/components/audio/ModernAudioPlayer";
import PodcastVideoPlayer from "../../src/components/video/PodcastVideoPlayer";
import useAudioStore from "../../src/context/useAudioStore";
import apiService from "../../src/services/api/apiService";
import { useToast } from "../../src/components/Toast";
import { Stack } from "expo-router";
import Logger from "../../src/utils/logger";
import ConfirmationModal from "../../src/components/ConfirmationModal";
import InfoModal from "../../src/components/InfoModal";
import CustomModal from "../../src/components/CustomModal";
import { normalizePodcast, normalizePodcasts } from "../../src/utils/urlHelper";
import { getQualityMessage } from "../../src/utils/qualityHelpers";
import {
    buildDetailsQueueTrack,
    buildPodcastPlaybackQueue,
    buildRelatedPlaybackQueue,
} from "../../src/utils/detailsPlayback";
import { COLORS, withTabScreenBottomPadding } from "../../src/constants/theme";
import hapticFeedback from "../../src/services/haptics/hapticFeedback";
import GradientCard from "../../src/components/GradientCard";
import downloadService from "../../src/services/downloads/downloadService";

const { width: screenWidth } = Dimensions.get("window");

const formatTimeAgo = (dateString) => {
    const diff = Date.now() - new Date(dateString).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return "just now";
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    if (d < 7) return `${d}d ago`;
    return new Date(dateString).toLocaleDateString();
};

const CommentItem = ({ comment, currentUserId, onDelete, onPressAuthor }) => {
    const name = comment.user?.name || "User";
    const initial = name.charAt(0).toUpperCase();
    const isOwn = comment.user_id === currentUserId;
    const canNavigate = !isOwn && Boolean(comment.user_id) && Boolean(onPressAuthor);

    return (
        <View className="flex-row items-start mb-4">
            <TouchableOpacity
                onPress={canNavigate ? () => onPressAuthor(comment.user_id, name) : undefined}
                disabled={!canNavigate}
                activeOpacity={canNavigate ? 0.7 : 1}
                className="mr-3 flex-shrink-0"
            >
                <View
                    className="w-9 h-9 rounded-full items-center justify-center"
                    style={{ backgroundColor: COLORS.primary + "33" }}
                >
                    <Text className="text-primary font-bold text-sm">{initial}</Text>
                </View>
            </TouchableOpacity>
            <View className="flex-1">
                <View className="flex-row items-center mb-1">
                    <TouchableOpacity
                        onPress={canNavigate ? () => onPressAuthor(comment.user_id, name) : undefined}
                        disabled={!canNavigate}
                        activeOpacity={canNavigate ? 0.7 : 1}
                    >
                        <Text className="text-text-primary font-semibold text-sm mr-2">{name}</Text>
                    </TouchableOpacity>
                    <Text className="text-text-muted text-xs">{formatTimeAgo(comment.created_at)}</Text>
                </View>
                <Text className="text-text-secondary text-sm leading-5">{comment.content}</Text>
            </View>
            {isOwn && (
                <TouchableOpacity
                    onPress={() => onDelete(comment.id)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    className="ml-2 mt-0.5"
                >
                    <Ionicons name="trash-outline" size={15} color={COLORS.text.muted} />
                </TouchableOpacity>
            )}
        </View>
    );
};

const getRouteParamValue = (value) => (Array.isArray(value) ? value[0] : value);

const Details = () => {
    const router = useRouter();
    const params = useLocalSearchParams();
    const { showToast } = useToast();
    const podcastId = getRouteParamValue(params.id);
    const refreshToken = getRouteParamValue(params.refresh);
    const updatedTitle = getRouteParamValue(params.updatedTitle);
    const updatedDescription = getRouteParamValue(params.updatedDescription);
    const updatedCategory = getRouteParamValue(params.updatedCategory);
    const updatedIsPublic = getRouteParamValue(params.updatedIsPublic);
    const updatedThumbnailUrl = getRouteParamValue(params.updatedThumbnailUrl);

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

    // Loading states for actions
    // Note: isPlayingLoading removed - using isAudioLoading from useAudioStore instead
    // Play action is fast (optimistic update), so separate loading state is unnecessary
    const [isLiking, setIsLiking] = useState(false);
    const [isBookmarking, setIsBookmarking] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isProcessingAI, setIsProcessingAI] = useState(false);
    const [showFullTranscription, setShowFullTranscription] = useState(false);
    const [aiData, setAiData] = useState(null);
    const [showQualityInfo, setShowQualityInfo] = useState(false);

    // Add-to-playlist modal state
    const [playlistModalVisible, setPlaylistModalVisible] = useState(false);
    const [myPlaylists, setMyPlaylists] = useState([]);
    const [loadingPlaylists, setLoadingPlaylists] = useState(false);
    const [addingToPlaylist, setAddingToPlaylist] = useState(null); // playlistId being added to

    // Download state
    const [localUri, setLocalUri] = useState(null);       // file:// URI when downloaded
    const [isDownloading, setIsDownloading] = useState(false);
    const [downloadProgress, setDownloadProgress] = useState(0);
    // Ref to suppress "Download failed" toast when the user intentionally cancels
    const downloadCancelledRef = useRef(false);
    const detailsRequestIdRef = useRef(0);
    const aiPollingActiveRef = useRef(false);

    // Comment state
    const [comments, setComments] = useState([]);
    const [commentsLoading, setCommentsLoading] = useState(false);
    const [commentText, setCommentText] = useState("");
    const [isSubmittingComment, setIsSubmittingComment] = useState(false);
    const [currentUserId, setCurrentUserId] = useState(null);
    const commentInputRef = useRef(null);

    const isVideoPodcast = Boolean(
        podcast?.media_type === "video" && podcast?.video_url
    );

    // Watch for audio playback errors and show toast
    useEffect(() => {
        if (audioError) {
            showToast(audioError, "error");
            clearError(); // Clear error after showing
        }
    }, [audioError, clearError, showToast]);

    useEffect(() => {
        return () => { aiPollingActiveRef.current = false; };
    }, []);

    const loadPodcastDetails = useCallback(async (requestedPodcastId = podcastId) => {
        if (!requestedPodcastId) {
            setPodcast(null);
            setRelatedPodcasts([]);
            setAiData(null);
            setIsOwner(false);
            setIsLiked(false);
            setIsBookmarked(false);
            setIsLoading(false);
            return;
        }

        const requestId = ++detailsRequestIdRef.current;
        const isCurrentRequest = () => detailsRequestIdRef.current === requestId;

        try {
            setIsLoading(true);

            // Reset download state for the incoming episode so we never
            // briefly show a previous episode's downloaded/progress state.
            setLocalUri(null);
            setIsDownloading(false);
            setDownloadProgress(0);
            downloadCancelledRef.current = false;

            const podcastData = await apiService.getPodcast(requestedPodcastId);

            if (!isCurrentRequest()) {
                return;
            }

            // Normalize URLs (relative to absolute)
            setPodcast(normalizePodcast(podcastData));

            const userProfile = await apiService.getUserProfile();

            if (!isCurrentRequest()) {
                return;
            }

            setIsOwner(userProfile.id === podcastData.owner_id);
            setCurrentUserId(userProfile.id);

            const interactions = await apiService.getPodcastInteractions(requestedPodcastId);

            if (!isCurrentRequest()) {
                return;
            }

            setIsLiked(interactions.is_liked);
            setIsBookmarked(interactions.is_bookmarked);

            const related = await apiService.getRelatedPodcasts(requestedPodcastId);

            if (!isCurrentRequest()) {
                return;
            }

            // Normalize related podcasts URLs
            setRelatedPodcasts(normalizePodcasts(related));

            setComments([]);
            loadComments(requestedPodcastId, requestId);

            try {
                const uri = await downloadService.getLocalUri(podcastData.id);

                if (!isCurrentRequest()) {
                    return;
                }

                setLocalUri(uri);
            } catch (dlErr) {
                if (!isCurrentRequest()) {
                    return;
                }

                Logger.error("Download state check failed:", dlErr);
            }

            // Only fetch AI detail payload when processing has actually completed.
            if (podcastData.ai_processing_status === "completed") {
                try {
                    const aiDataResponse = await apiService.getPodcastAIData(requestedPodcastId);

                    if (!isCurrentRequest()) {
                        return;
                    }

                    setAiData(aiDataResponse);
                } catch (error) {
                    if (!isCurrentRequest()) {
                        return;
                    }

                    // AI data is optional, fail silently
                }
            } else {
                setAiData(null);
            }
        } catch (error) {
            if (!isCurrentRequest()) {
                return;
            }

            setPodcast(null);
            setRelatedPodcasts([]);
            setAiData(null);
            setIsOwner(false);
            setIsLiked(false);
            setIsBookmarked(false);
            Logger.error("Failed to load podcast details:", error);
            showToast("Failed to load podcast details", "error");
        } finally {
            if (isCurrentRequest()) {
                setIsLoading(false);
            }
        }
    }, [podcastId, showToast]);

    useEffect(() => {
        loadPodcastDetails(podcastId);
    }, [loadPodcastDetails, podcastId, refreshToken]);

    // Refresh when returning to this screen (e.g. after AI processing finishes in background)
    useFocusEffect(
        useCallback(() => {
            if (podcastId) {
                loadPodcastDetails(podcastId);
            }
        }, [loadPodcastDetails, podcastId])
    );

    // Handle optimistic update from edit page (only once when params change)
    useEffect(() => {
        if (podcast && updatedTitle) {
            setPodcast((prevPodcast) => {
                // Only update if values actually changed (prevent infinite loop)
                if (
                    prevPodcast.title !== updatedTitle ||
                    prevPodcast.description !==
                    (updatedDescription ||
                        prevPodcast.description) ||
                    prevPodcast.category !==
                    (updatedCategory || prevPodcast.category) ||
                    prevPodcast.is_public !==
                    (updatedIsPublic === "true") ||
                    prevPodcast.thumbnail_url !==
                    (updatedThumbnailUrl || null)
                ) {
                    return {
                        ...prevPodcast,
                        title: updatedTitle,
                        description:
                            updatedDescription ||
                            prevPodcast.description,
                        category:
                            updatedCategory || prevPodcast.category,
                        is_public: updatedIsPublic === "true",
                        thumbnail_url: updatedThumbnailUrl || null,
                    };
                }
                return prevPodcast;
            });
        }
    }, [
        updatedTitle,
        updatedDescription,
        updatedCategory,
        updatedIsPublic,
        updatedThumbnailUrl,
    ]);

    const handlePlay = useCallback(() => {
        const isVideo = podcast?.media_type === "video" && Boolean(podcast?.video_url);
        const mediaUrl = isVideo ? podcast?.video_url : podcast?.audio_url;
        if (!mediaUrl) {
            showToast(isVideo ? "Video not available" : "Audio not available", "error");
            return;
        }

        // Prevent multiple clicks - use audio store's isLoading
        if (isAudioLoading) return;

        const track = buildDetailsQueueTrack(podcast, {
            uriOverride: localUri || mediaUrl,
        });

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
                try {
                    // Only build queue if we have related podcasts
                    if (relatedPodcasts.length > 0) {
                        const queue = buildPodcastPlaybackQueue(
                            podcast,
                            relatedPodcasts,
                            {
                                uriOverride: localUri || mediaUrl,
                            }
                        );
                        setQueue(queue, 0);
                    } else {
                        // Just current track in queue
                        setQueue([track], 0);
                    }
                } catch (error) {
                    // Ensure we still have at least the current track in the queue
                    Logger.error("Failed to build audio queue from related podcasts", error);
                    setQueue([track], 0);
                    showToast("Playing current episode only", "warning");
                }
            });
        }
    }, [
        podcast?.id,
        podcast?.audio_url,
        podcast?.video_url,
        podcast?.media_type,
        podcast?.title,
        podcast?.owner?.name,
        localUri,
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

    /**
     * Play a related podcast card directly (used by GradientCard onPlayPress).
     * Starts playback of the tapped related podcast and rebuilds the queue so
     * the remaining related items follow naturally.
     */
    const handlePlayRelated = useCallback(
        (relatedPodcast) => {
            const isRelatedVideo = relatedPodcast?.media_type === "video";
            const relatedMediaUrl = isRelatedVideo ? relatedPodcast?.video_url : relatedPodcast?.audio_url;
            if (!relatedMediaUrl) {
                showToast("Media not available", "error");
                return;
            }

            const track = buildDetailsQueueTrack(relatedPodcast);

            if (currentTrack?.id === relatedPodcast.id) {
                if (isPlaying) {
                    pause();
                } else {
                    play();
                }
            } else {
                play(track);
                requestAnimationFrame(() => {
                    try {
                        setQueue(
                            buildRelatedPlaybackQueue(
                                relatedPodcast,
                                relatedPodcasts
                            ),
                            0
                        );
                    } catch (err) {
                        Logger.error("Failed to build queue from related podcast", err);
                        setQueue([track], 0);
                        showToast("Playing current episode only", "warning");
                    }
                });
            }
        },
        [currentTrack?.id, isPlaying, play, pause, setQueue, relatedPodcasts, showToast]
    );

    // PERFORMANCE: Memoize skip handlers to prevent ModernAudioPlayer re-renders
    // CRITICAL FIX: Remove position/duration from dependencies
    // These callbacks should be stable references that internally fetch current values
    const handleSkipForward = useCallback(() => {
        // Fetch fresh position/duration from store inside the callback
        const { position: currentPos, duration: storeDuration } = useAudioStore.getState();
        const currentDur = storeDuration || 0;
        const newPos = Math.min(currentPos + 15000, currentDur);
        seek(newPos);
    }, [seek]); // Only depend on seek (stable reference)

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
        } finally {
            setIsBookmarking(false);
        }
    };

    const handleOpenPlaylistPicker = async () => {
        setPlaylistModalVisible(true);
        setLoadingPlaylists(true);
        try {
            const res = await apiService.getMyPlaylists();
            setMyPlaylists(res.playlists || []);
        } catch (e) {
            showToast("Could not load playlists", "error");
            setPlaylistModalVisible(false);
        } finally {
            setLoadingPlaylists(false);
        }
    };

    const handleAddToPlaylist = async (playlistId) => {
        if (!podcast?.id) return;
        setAddingToPlaylist(playlistId);
        try {
            await apiService.addToPlaylist(playlistId, podcast.id);
            showToast("Added to playlist", "success");
            setPlaylistModalVisible(false);
        } catch (e) {
            showToast(e?.detail || e?.message || "Failed to add to playlist", "error");
        } finally {
            setAddingToPlaylist(null);
        }
    };

    const handleDownload = async () => {
        if (!podcast?.audio_url && !podcast?.video_url) return;
        if (isVideoPodcast) {
            showToast("Video download is not yet supported", "info");
            return;
        }

        if (isDownloading) {
            // Mark as intentional cancel BEFORE awaiting cancelAsync so the
            // catch block in the download invocation can distinguish a user
            // cancel from a real error (and suppress the "Download failed" toast).
            downloadCancelledRef.current = true;
            await downloadService.cancelDownload(podcast.id);
            setIsDownloading(false);
            setDownloadProgress(0);
            showToast("Download cancelled", "info");
            return;
        }

        if (localUri) {
            // Already downloaded — confirm deletion
            try {
                await downloadService.deleteDownload(podcast.id);
                setLocalUri(null);
                showToast("Download removed", "success");
            } catch (err) {
                Logger.error("Failed to delete download:", err);
                showToast("Failed to remove download", "error");
            }
            return;
        }

        // Start download
        downloadCancelledRef.current = false;
        setIsDownloading(true);
        setDownloadProgress(0);
        showToast("Downloading episode…", "info");

        try {
            const result = await downloadService.downloadEpisode(
                podcast,
                (progress) => setDownloadProgress(progress),
            );
            setLocalUri(result.localUri);
            showToast("Episode saved for offline listening", "success");
        } catch (err) {
            // Suppress error toast when the user intentionally cancelled
            if (!downloadCancelledRef.current) {
                Logger.error("Download failed:", err);
                showToast("Download failed. Please try again.", "error");
            }
        } finally {
            setIsDownloading(false);
            setDownloadProgress(0);
        }
    };

    const handleShare = async () => {
        try {
            const shareMessage = isVideoPodcast
                ? `Watch this podcast: ${podcast.title}\n\nOpen it in Volo App!`
                : `Check out this podcast: ${podcast.title}\n\nListen on Volo App!`;

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

    const handleAddToQueue = useCallback(async () => {
        const isVideo = podcast?.media_type === "video" && Boolean(podcast?.video_url);
        const mediaUrl = isVideo ? podcast?.video_url : podcast?.audio_url;
        if (!mediaUrl) return;

        const track = buildDetailsQueueTrack(podcast, {
            uriOverride: localUri || mediaUrl,
        });

        addToQueue(track);
        showToast("Added to queue", "success");
    }, [podcast, localUri, addToQueue, showToast]);

    const loadComments = useCallback(async (podcastId, requestId) => {
        if (!podcastId || detailsRequestIdRef.current !== requestId) return;
        setCommentsLoading(true);
        try {
            const data = await apiService.getPodcastComments(podcastId, { limit: 50 });
            if (detailsRequestIdRef.current !== requestId) return;
            setComments(Array.isArray(data) ? data : []);
        } catch (err) {
            Logger.error("Failed to load comments:", err);
        } finally {
            if (detailsRequestIdRef.current === requestId) {
                setCommentsLoading(false);
            }
        }
    }, []);

    const handleSubmitComment = async () => {
        const text = commentText.trim();
        if (!text || !podcast?.id) return;
        setIsSubmittingComment(true);
        try {
            const newComment = await apiService.createComment(podcast.id, {
                podcast_id: podcast.id,
                content: text,
                timestamp: 0,
            });
            setComments((prev) => [newComment, ...prev]);
            setCommentText("");
            commentInputRef.current?.blur();
            showToast("Comment posted", "success");
        } catch (err) {
            Logger.error("Failed to post comment:", err);
            showToast("Could not post comment", "error");
        } finally {
            setIsSubmittingComment(false);
        }
    };

    const handleDeleteComment = useCallback(async (commentId) => {
        // Optimistic: remove immediately, restore on failure
        setComments((prev) => prev.filter((c) => c.id !== commentId));
        try {
            await apiService.deleteComment(commentId);
        } catch (err) {
            Logger.error("Failed to delete comment:", err);
            showToast("Could not delete comment", "error");
            // Reload to restore deleted comment
            if (podcast?.id) {
                loadComments(podcast.id, detailsRequestIdRef.current);
            }
        }
    }, [podcast?.id, showToast, loadComments]);

    const handlePressCommentAuthor = useCallback((userId, name) => {
        router.push({
            pathname: "/(main)/creator-profile",
            params: { userId: String(userId) },
        });
    }, [router]);

    const handleProcessAI = async () => {
        if (!podcast?.audio_url) {
            showToast("AI processing requires an audio source", "error");
            return;
        }

        try {
            setIsProcessingAI(true);
            showToast("🤖 AI processing started...", "info");

            await apiService.processAudio(podcast.id);

            setPodcast((prev) => prev ? ({
                ...prev,
                ai_processing_status: "processing",
            }) : prev);

            void hapticFeedback.vibrate([0, 200, 100, 200]);

            // Poll until completed or failed (max ~3 min, every 5s)
            const MAX_POLLS = 36;
            let finalStatus = "timeout";
            aiPollingActiveRef.current = true;

            for (let i = 0; i < MAX_POLLS; i++) {
                await new Promise((resolve) => setTimeout(resolve, 5000));

                if (!aiPollingActiveRef.current) break;

                try {
                    const updated = await apiService.getPodcast(podcast.id);
                    const status = updated?.ai_processing_status;

                    setPodcast((prev) => (prev ? { ...prev, ...updated } : prev));

                    if (status === "completed" || status === "failed") {
                        finalStatus = status;
                        break;
                    }
                } catch (pollErr) {
                    Logger.warn("AI status poll error:", pollErr);
                }
            }

            await loadPodcastDetails();

            if (finalStatus === "completed") {
                showToast("AI processing complete!", "success");
            } else if (finalStatus === "failed") {
                showToast("AI processing failed. Please try again.", "error");
            } else {
                showToast("AI processing is still running. Check again shortly.", "info");
            }
        } catch (error) {
            Logger.error("AI processing failed:", error);
            const errorMsg = error.response?.data?.detail || "Failed to process with AI";
            showToast(errorMsg, "error");
            
            void hapticFeedback.vibrate(500);
        } finally {
            aiPollingActiveRef.current = false;
            setIsProcessingAI(false);
        }
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
        if (isDeleting) {
            return; // Prevent multiple clicks
        }

        try {
            setIsDeleting(true);
            await apiService.deletePodcast(podcast.id);
            showToast("Podcast deleted", "success");
            
            // Navigate to library with refresh flag
            router.replace({
                pathname: "/(main)/library",
                params: { refresh: Date.now().toString() }
            });
        } catch (error) {
            Logger.error("🗑️ Delete failed:", error);
            const errorMessage = error.message || "Failed to delete podcast";
            showToast(errorMessage, "error");
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
                        color={COLORS.primary}
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
                        color={COLORS.error}
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

            {/* AI Quality Info Modal */}
            <InfoModal
                visible={showQualityInfo}
                onClose={() => setShowQualityInfo(false)}
                title="AI Processing Quality"
                message={getQualityMessage(aiData?.quality_score)}
                icon="information-outline"
            />

            <Stack.Screen
                options={{
                    title: "Podcast Details",
                    headerShown: true,
                    headerStyle: {
                        backgroundColor: COLORS.card,
                    },
                    headerTintColor: COLORS.text.primary,
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
                                color={COLORS.text.primary}
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
                                    color={COLORS.text.primary}
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
                                        color={COLORS.text.primary}
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
                contentContainerStyle={withTabScreenBottomPadding({
                    paddingTop:
                        Platform.OS === "android" ? StatusBar.currentHeight : 0,
                })}
            >
                {/* Podcast Header */}
                <View className="px-6 py-6">
                    {/* Podcast Artwork / Thumbnail */}
                    <View
                        className="rounded-2xl mb-6 items-center justify-center overflow-hidden"
                        style={{
                            width: screenWidth - 48,
                            height: screenWidth - 48,
                            maxHeight: 300,
                            backgroundColor: COLORS.background,
                            borderWidth: 1,
                            borderColor: COLORS.border,
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
                                    color={COLORS.primary}
                                />
                                <Text className="text-text-secondary mt-2">
                                    {podcast.title}
                                </Text>
                            </>
                        )}
                    </View>

                    {/* Title and Info */}
                    <Text className="text-text-primary text-2xl font-bold mb-2">
                        {podcast.title}
                    </Text>

                    {/* Creator name — tappable only for other users when owner_id is present */}
                    {isOwner || !podcast.owner_id ? (
                        <Text className="text-text-secondary text-lg mb-4">
                            by {podcast.owner?.name || "Unknown Artist"}
                        </Text>
                    ) : (
                        <View className="flex-row items-center mb-4">
                            <TouchableOpacity
                                onPress={() =>
                                    router.push({
                                        pathname: "/(main)/creator-profile",
                                        params: { userId: podcast.owner_id },
                                    })
                                }
                                activeOpacity={0.7}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                accessible
                                accessibilityLabel={`View ${podcast.owner?.name || "creator"}'s profile`}
                                accessibilityRole="button"
                            >
                                <Text className="text-primary text-lg font-medium">
                                    by {podcast.owner?.name || "Unknown Artist"}
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() =>
                                    router.push({
                                        pathname: "/(main)/chat-details",
                                        params: {
                                            partnerId: String(podcast.owner_id),
                                            partnerName: podcast.owner?.name || "Creator",
                                        },
                                    })
                                }
                                activeOpacity={0.7}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                className="ml-2 p-1"
                                accessibilityLabel="Send a message to this creator"
                                accessibilityRole="button"
                            >
                                <Ionicons name="mail-outline" size={18} color={COLORS.text.muted} />
                            </TouchableOpacity>
                        </View>
                    )}

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

                        {podcast.ai_processing_status === "processing" && (
                            <View className="bg-warning/20 px-2 py-1 rounded-full border border-warning/30">
                                <Text className="text-warning text-xs">
                                    AI Processing
                                </Text>
                            </View>
                        )}
                    </View>

                    {/* Action Buttons - Horizontal Scrollable with AI Process as primary CTA */}
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        className="mb-6"
                        contentContainerStyle={{ gap: 12, paddingRight: 24 }}
                    >
                        {/* AI Process Button - PRIMARY CTA (only show if owner and not already processed) */}
                        {isOwner && podcast.ai_processing_status === "processing" && (
                            <View className="flex-row items-center px-3 py-1 rounded-xl bg-panel border border-warning/30">
                                <ActivityIndicator
                                    size="small"
                                    color={COLORS.warning}
                                />
                                <Text className="text-warning ml-1.5 font-bold text-xs">
                                    AI Processing...
                                </Text>
                            </View>
                        )}

                        {isOwner && isVideoPodcast && (
                            <View className="flex-row items-center px-3 py-1 rounded-xl bg-panel border border-border">
                                <Ionicons name="information-circle-outline" size={14} color="#888" />
                                <Text className="text-text-muted text-xs ml-1">AI enhancement is audio-only</Text>
                            </View>
                        )}

                        {isOwner && !isVideoPodcast && !podcast.ai_enhanced && podcast.ai_processing_status !== "processing" && podcast.audio_url && (
                            <TouchableOpacity
                                onPress={handleProcessAI}
                                className="flex-row items-center px-3 py-1 rounded-xl bg-success border-2 border-success shadow-lg"
                                activeOpacity={0.7}
                                disabled={isProcessingAI}
                                hitSlop={{
                                    top: 10,
                                    bottom: 10,
                                    left: 10,
                                    right: 10,
                                }}
                            >
                                {isProcessingAI ? (
                                    <ActivityIndicator
                                        size="small"
                                        color="white"
                                    />
                                ) : (
                                    <MaterialCommunityIcons
                                        name="robot-outline"
                                        size={16}
                                        color="white"
                                    />
                                )}
                                <Text className="text-white ml-1.5 font-bold text-xs">
                                    Process with AI
                                </Text>
                            </TouchableOpacity>
                        )}

                        <TouchableOpacity
                            onPress={handleLike}
                            className={`flex-row items-center px-3 py-1 rounded-xl ${isLiked ? "bg-primary" : "bg-panel"
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
                                    color={isLiked ? "white" : COLORS.text.muted}
                                />
                            ) : (
                                <MaterialCommunityIcons
                                    name={isLiked ? "heart" : "heart-outline"}
                                    size={16}
                                    color={isLiked ? "white" : COLORS.text.muted}
                                />
                            )}
                            <Text
                                className={`ml-1.5 text-xs font-medium ${isLiked
                                    ? "text-white"
                                    : "text-text-secondary"
                                    }`}
                            >
                                Like
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={handleBookmark}
                            className={`flex-row items-center px-3 py-1 rounded-xl ${isBookmarked ? "bg-warning" : "bg-panel"
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
                                    color={isBookmarked ? "white" : COLORS.text.muted}
                                />
                            ) : (
                                <MaterialCommunityIcons
                                    name={
                                        isBookmarked
                                            ? "bookmark"
                                            : "bookmark-outline"
                                    }
                                    size={16}
                                    color={isBookmarked ? "white" : COLORS.text.muted}
                                />
                            )}
                            <Text
                                className={`ml-1.5 text-xs font-medium ${isBookmarked
                                    ? "text-white"
                                    : "text-text-secondary"
                                    }`}
                            >
                                Save
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={handleAddToQueue}
                            className="flex-row items-center px-3 py-1 rounded-xl bg-panel"
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
                                size={16}
                                color={COLORS.text.muted}
                            />
                            <Text className="text-text-secondary ml-1.5 text-xs font-medium">
                                Queue
                            </Text>
                        </TouchableOpacity>

                        {/* Download for offline listening */}
                        {!isVideoPodcast && podcast?.audio_url && (
                            <TouchableOpacity
                                onPress={handleDownload}
                                className={`flex-row items-center px-3 py-1 rounded-xl ${
                                    localUri ? "bg-success/20 border border-success/30" : "bg-panel"
                                }`}
                                activeOpacity={0.7}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            >
                                {isDownloading ? (
                                    <View style={{ width: 18, height: 18, alignItems: "center", justifyContent: "center" }}>
                                        <ActivityIndicator size="small" color={COLORS.primary} />
                                    </View>
                                ) : (
                                    <MaterialCommunityIcons
                                        name={localUri ? "check-circle" : "download-outline"}
                                        size={16}
                                        color={localUri ? COLORS.success || "#4CAF50" : COLORS.text.muted}
                                    />
                                )}
                                <Text
                                    className={`ml-1.5 text-xs font-medium ${
                                        localUri ? "text-green-400" : "text-text-secondary"
                                    }`}
                                >
                                    {isDownloading
                                        ? Math.round(downloadProgress * 100) + "%"
                                        : localUri
                                        ? "Downloaded"
                                        : "Download"}
                                </Text>
                            </TouchableOpacity>
                        )}

                        {/* Add to Playlist */}
                        <TouchableOpacity
                            onPress={handleOpenPlaylistPicker}
                            className="flex-row items-center px-3 py-1 rounded-xl bg-panel"
                            activeOpacity={0.7}
                            hitSlop={{
                                top: 10,
                                bottom: 10,
                                left: 10,
                                right: 10,
                            }}
                        >
                            <MaterialCommunityIcons
                                name="playlist-edit"
                                size={16}
                                color={COLORS.text.muted}
                            />
                            <Text className="text-text-secondary ml-1.5 text-xs font-medium">
                                Playlist
                            </Text>
                        </TouchableOpacity>

                        {/* Delete Button - Only for owner */}
                        {isOwner && (
                            <TouchableOpacity
                                onPress={handleDelete}
                                className="flex-row items-center px-3 py-1 rounded-xl bg-error/20 border border-error/30"
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
                                        color={COLORS.error}
                                    />
                                ) : (
                                    <MaterialCommunityIcons
                                        name="delete-outline"
                                        size={16}
                                        color={COLORS.error}
                                    />
                                )}
                                <Text className="text-error ml-1.5 text-xs font-medium">
                                    Delete
                                </Text>
                            </TouchableOpacity>
                        )}
                    </ScrollView>
                </View>

                {isVideoPodcast ? (
                    <PodcastVideoPlayer
                        uri={podcast.video_url}
                        title={podcast.title}
                        subtitle={podcast.owner?.name || "Unknown Artist"}
                    />
                ) : currentTrack?.id === podcast.id && podcast.audio_url ? (
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
                                    color={COLORS.primary}
                                />
                            ) : (
                                <MaterialCommunityIcons
                                    name="play-circle"
                                    size={32}
                                    color={
                                        podcast.audio_url
                                            ? COLORS.primary
                                            : COLORS.text.muted
                                    }
                                />
                            )}
                            <Text
                                className={`ml-3 text-lg font-semibold ${podcast.audio_url && !isAudioLoading
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

                {/* AI Insights - Show if podcast is AI enhanced */}
                {podcast.ai_enhanced && aiData && (
                    <View className="px-6 mb-6">
                        <View className="flex-row items-center mb-4">
                            <MaterialCommunityIcons
                                name="robot-excited-outline"
                                size={24}
                                color={COLORS.success}
                            />
                            <Text className="text-text-primary text-lg font-semibold ml-2">
                                AI Insights
                            </Text>
                            <View className="ml-2 px-2 py-1 rounded-full bg-success/20 border border-success/30">
                                <Text className="text-success text-xs font-medium">
                                    Powered by AI
                                </Text>
                            </View>
                            <TouchableOpacity
                                onPress={() => setShowQualityInfo(true)}
                                className="ml-auto p-2"
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            >
                                <MaterialCommunityIcons
                                    name="information-outline"
                                    size={22}
                                    color={COLORS.text.muted}
                                />
                            </TouchableOpacity>
                        </View>

                        {/* Transcription */}
                        {aiData.transcription_text && (
                            <View className="bg-card rounded-xl p-4 border border-border mb-4">
                                <View className="flex-row items-center mb-3">
                                    <MaterialCommunityIcons
                                        name="text"
                                        size={20}
                                        color={COLORS.success}
                                    />
                                    <Text className="text-text-primary font-semibold ml-2">
                                        Transcription
                                    </Text>
                                    {aiData.transcription_confidence && (
                                        <View className="ml-auto flex-row items-center">
                                            <MaterialCommunityIcons
                                                name="check-circle"
                                                size={16}
                                                color={COLORS.success}
                                            />
                                            <Text className="text-success text-xs ml-1">
                                                {Math.round(aiData.transcription_confidence * 100)}% accurate
                                            </Text>
                                        </View>
                                    )}
                                </View>
                                <Text
                                    className="text-text-secondary leading-6"
                                    numberOfLines={showFullTranscription ? undefined : 4}
                                >
                                    {aiData.transcription_text}
                                </Text>
                                {aiData.transcription_text.length > 150 && (
                                    <TouchableOpacity
                                        onPress={() => setShowFullTranscription(!showFullTranscription)}
                                        className="mt-2"
                                    >
                                        <Text className="text-primary font-medium">
                                            {showFullTranscription ? "Show Less" : "Show More"}
                                        </Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        )}

                        {/* Keywords */}
                        {aiData.keywords && aiData.keywords.length > 0 && (
                            <View className="bg-card rounded-xl p-4 border border-border mb-4">
                                <View className="flex-row items-center mb-3">
                                    <MaterialCommunityIcons
                                        name="key-variant"
                                        size={20}
                                        color={COLORS.warning}
                                    />
                                    <Text className="text-text-primary font-semibold ml-2">
                                        Keywords
                                    </Text>
                                </View>
                                <View className="flex-row flex-wrap gap-2">
                                    {aiData.keywords.map((keyword, index) => (
                                        <View
                                            key={index}
                                            className="px-3 py-1.5 rounded-full bg-warning/20 border border-warning/30"
                                        >
                                            <Text className="text-warning text-sm font-medium">
                                                {keyword}
                                            </Text>
                                        </View>
                                    ))}
                                </View>
                            </View>
                        )}

                        {/* Summary, Sentiment, Categories Row */}
                        <View className="flex-row gap-4 mb-4">
                            {/* Summary */}
                            {aiData.summary && (
                                <View className="flex-1 bg-card rounded-xl p-4 border border-border">
                                    <View className="flex-row items-center mb-2">
                                        <MaterialCommunityIcons
                                            name="file-document-outline"
                                            size={18}
                                            color={COLORS.info}
                                        />
                                        <Text className="text-text-primary font-semibold text-sm ml-2">
                                            Summary
                                        </Text>
                                    </View>
                                    <Text className="text-text-secondary text-sm leading-5">
                                        {aiData.summary}
                                    </Text>
                                </View>
                            )}
                        </View>

                        {/* Sentiment & Quality Score Row */}
                        <View className="flex-row gap-4">
                            {/* Sentiment */}
                            {aiData.sentiment && (
                                <View className="flex-1 bg-card rounded-xl p-4 border border-border">
                                    <View className="flex-row items-center mb-2">
                                        <MaterialCommunityIcons
                                            name="emoticon-outline"
                                            size={18}
                                            color={
                                                aiData.sentiment === 'positive'
                                                    ? COLORS.success
                                                    : aiData.sentiment === 'negative'
                                                        ? COLORS.error
                                                        : COLORS.text.muted
                                            }
                                        />
                                        <Text className="text-text-primary font-semibold text-sm ml-2">
                                            Sentiment
                                        </Text>
                                    </View>
                                    <Text
                                        className={`text-sm font-medium capitalize ${aiData.sentiment === 'positive'
                                                ? 'text-success'
                                                : aiData.sentiment === 'negative'
                                                    ? 'text-error'
                                                    : 'text-text-secondary'
                                            }`}
                                    >
                                        {aiData.sentiment === 'positive' && '😊 '}
                                        {aiData.sentiment === 'negative' && '😔 '}
                                        {aiData.sentiment === 'neutral' && '😐 '}
                                        {aiData.sentiment}
                                    </Text>
                                </View>
                            )}

                            {/* Quality Score */}
                            {aiData.quality_score !== null && aiData.quality_score !== undefined && (
                                <View className="flex-1 bg-card rounded-xl p-4 border border-border">
                                    <View className="flex-row items-center mb-2">
                                        <MaterialCommunityIcons
                                            name="star-circle-outline"
                                            size={18}
                                            color={COLORS.warning}
                                        />
                                        <Text className="text-text-primary font-semibold text-sm ml-2">
                                            Quality
                                        </Text>
                                    </View>
                                    <View className="flex-row items-center">
                                        <Text className="text-warning text-lg font-bold">
                                            {(aiData.quality_score * 100).toFixed(0)}
                                        </Text>
                                        <Text className="text-text-secondary text-sm ml-1">
                                            /100
                                        </Text>
                                    </View>
                                </View>
                            )}
                        </View>
                    </View>
                )}

                {/* Comments */}
                <View className="px-6 mb-6">
                    <View className="flex-row items-center mb-4">
                        <Ionicons name="chatbubble-outline" size={20} color={COLORS.primary} />
                        <Text className="text-text-primary text-lg font-semibold ml-2">
                            Comments
                        </Text>
                        {comments.length > 0 && (
                            <View className="ml-2 px-2 py-0.5 rounded-full bg-primary/10">
                                <Text className="text-primary text-xs font-medium">{comments.length}</Text>
                            </View>
                        )}
                    </View>

                    {commentsLoading ? (
                        <ActivityIndicator size="small" color={COLORS.primary} style={{ marginVertical: 16 }} />
                    ) : comments.length === 0 ? (
                        <View className="items-center py-8">
                            <Ionicons name="chatbubbles-outline" size={36} color={COLORS.text.muted} />
                            <Text className="text-text-muted text-sm mt-2">
                                No comments yet. Be the first!
                            </Text>
                        </View>
                    ) : (
                        comments.map((comment) => (
                            <CommentItem
                                key={comment.id}
                                comment={comment}
                                currentUserId={currentUserId}
                                onDelete={handleDeleteComment}
                                onPressAuthor={handlePressCommentAuthor}
                            />
                        ))
                    )}
                </View>

                {/* Related Podcasts — horizontal GradientCard scroll row */}
                {relatedPodcasts.length > 0 && (
                    <View className="mb-6">
                        <View className="flex-row items-center px-6 mb-4">
                            <MaterialCommunityIcons
                                name="podcast"
                                size={22}
                                color={COLORS.primary}
                            />
                            <Text className="text-text-primary text-lg font-semibold ml-2">
                                Related Podcasts
                            </Text>
                        </View>
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={{ paddingLeft: 24, paddingRight: 8 }}
                        >
                            {relatedPodcasts.map((relatedPodcast) => (
                                <GradientCard
                                    key={relatedPodcast.id}
                                    podcast={{
                                        ...relatedPodcast,
                                        duration: (relatedPodcast.duration || 0) * 1000,
                                    }}
                                    category={relatedPodcast.category || "default"}
                                    size="medium"
                                    onPress={() =>
                                        router.push({
                                            pathname: "/(main)/details",
                                            params: { id: relatedPodcast.id },
                                        })
                                    }
                                    onPlayPress={() => handlePlayRelated(relatedPodcast)}
                                    isPlaying={
                                        currentTrack?.id === relatedPodcast.id &&
                                        isPlaying
                                    }
                                />
                            ))}
                        </ScrollView>
                    </View>
                )}

                {/* Bottom Spacing — extra room for comment input bar */}
                <View style={{ height: showMiniPlayer ? 160 : 80 }} />
            </ScrollView>

            {/* Comment Input Bar — fixed above mini player */}
            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
            >
                <View
                    className="flex-row items-center px-4 py-3 border-t border-border bg-background"
                    style={{ paddingBottom: showMiniPlayer ? 80 : 12 }}
                >
                    <TextInput
                        ref={commentInputRef}
                        value={commentText}
                        onChangeText={setCommentText}
                        placeholder="Add a comment…"
                        placeholderTextColor={COLORS.text.muted}
                        className="flex-1 bg-card rounded-full px-4 py-2.5 text-text-primary text-sm border border-border"
                        multiline={false}
                        maxLength={500}
                        returnKeyType="send"
                        onSubmitEditing={handleSubmitComment}
                    />
                    <TouchableOpacity
                        onPress={handleSubmitComment}
                        disabled={!commentText.trim() || isSubmittingComment}
                        className="ml-3 w-10 h-10 rounded-full items-center justify-center"
                        style={{
                            backgroundColor: commentText.trim() ? COLORS.primary : COLORS.text.muted + "33",
                        }}
                    >
                        {isSubmittingComment ? (
                            <ActivityIndicator size="small" color="white" />
                        ) : (
                            <Ionicons name="send" size={16} color={commentText.trim() ? "white" : COLORS.text.muted} />
                        )}
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>

            {/* Add-to-Playlist Picker Modal */}
            <CustomModal
                visible={playlistModalVisible}
                onClose={() => setPlaylistModalVisible(false)}
                title="Add to Playlist"
                animationType="slide"
            >
                {loadingPlaylists ? (
                    <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 24 }} />
                ) : myPlaylists.length === 0 ? (
                    <View className="items-center py-6">
                        <MaterialCommunityIcons
                            name="playlist-music-outline"
                            size={48}
                            color={COLORS.text.muted}
                        />
                        <Text className="text-text-secondary mt-3 text-center">
                            You have no playlists yet.
                        </Text>
                        <TouchableOpacity
                            onPress={() => {
                                setPlaylistModalVisible(false);
                                router.push("/(main)/playlists");
                            }}
                            className="mt-4 bg-primary px-5 py-2 rounded-xl"
                            activeOpacity={0.8}
                        >
                            <Text className="text-white font-semibold">Create Playlist</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    myPlaylists.map((pl) => (
                        <TouchableOpacity
                            key={pl.id}
                            onPress={() => handleAddToPlaylist(pl.id)}
                            disabled={addingToPlaylist === pl.id}
                            className="flex-row items-center py-3 border-b border-border"
                            activeOpacity={0.7}
                        >
                            <View className="w-9 h-9 bg-primary/10 rounded-lg items-center justify-center mr-3">
                                <MaterialCommunityIcons
                                    name={pl.is_public ? "playlist-music" : "playlist-lock"}
                                    size={20}
                                    color={COLORS.primary}
                                />
                            </View>
                            <View className="flex-1">
                                <Text className="text-text-primary font-medium" numberOfLines={1}>
                                    {pl.name}
                                </Text>
                                <Text className="text-text-secondary text-xs">
                                    {pl.item_count ?? 0} episode{pl.item_count !== 1 ? "s" : ""}
                                </Text>
                            </View>
                            {addingToPlaylist === pl.id ? (
                                <ActivityIndicator size="small" color={COLORS.primary} />
                            ) : (
                                <MaterialCommunityIcons
                                    name="plus-circle-outline"
                                    size={22}
                                    color={COLORS.primary}
                                />
                            )}
                        </TouchableOpacity>
                    ))
                )}
                <TouchableOpacity
                    onPress={() => setPlaylistModalVisible(false)}
                    className="mt-4 bg-panel border border-border rounded-xl py-3 items-center"
                    activeOpacity={0.7}
                >
                    <Text className="text-text-secondary font-medium">Cancel</Text>
                </TouchableOpacity>
            </CustomModal>
        </SafeAreaView>
    );
};

export default Details;
