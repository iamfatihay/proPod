import React, { useState, useCallback } from "react";
import {
    View,
    Text,
    SafeAreaView,
    FlatList,
    TouchableOpacity,
    ActivityIndicator,
    Image,
    Share,
    Platform,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import apiService from "../../src/services/api/apiService";
import ConfirmationModal from "../../src/components/ConfirmationModal";
import { useToast } from "../../src/components/Toast";
import { COLORS } from "../../src/constants/theme";
import useAudioStore from "../../src/context/useAudioStore";

// ─── Helpers ───────────────────────────────────────────────────────────────────

const formatDuration = (seconds) => {
    if (!seconds) return "0:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
};

// ─── Episode Row ──────────────────────────────────────────────────────────────

const EpisodeRow = ({ item, onPress, onRemove }) => {
    const podcast = item.podcast;
    if (!podcast) return null;

    return (
        <TouchableOpacity
            onPress={onPress}
            activeOpacity={0.8}
            className="flex-row items-center bg-panel rounded-2xl px-4 py-3 mb-3 border border-border"
        >
            {/* Thumbnail */}
            <View className="w-12 h-12 bg-primary/10 rounded-xl overflow-hidden items-center justify-center mr-3 border border-primary/20">
                {podcast.thumbnail_url ? (
                    <Image
                        source={{ uri: podcast.thumbnail_url }}
                        style={{ width: "100%", height: "100%" }}
                        resizeMode="cover"
                    />
                ) : (
                    <MaterialCommunityIcons name="waveform" size={24} color={COLORS.primary} />
                )}
            </View>

            {/* Info */}
            <View className="flex-1">
                <Text className="text-text-primary font-semibold text-sm" numberOfLines={2}>
                    {podcast.title}
                </Text>
                <Text className="text-text-secondary text-xs mt-0.5">
                    {podcast.owner?.name || "Unknown"} · {formatDuration(podcast.duration)}
                </Text>
            </View>

            {/* Remove */}
            <TouchableOpacity
                onPress={(e) => { e.stopPropagation(); onRemove(); }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                className="ml-2 p-1"
                accessibilityLabel="Remove from playlist"
            >
                <MaterialCommunityIcons name="close" size={18} color={COLORS.text.muted} />
            </TouchableOpacity>
        </TouchableOpacity>
    );
};

// ─── Main Screen ──────────────────────────────────────────────────────────────

const PlaylistDetail = () => {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { showToast } = useToast();
    const params = useLocalSearchParams();
    const playlistId = params.id;

    const [playlist, setPlaylist] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Remove confirmation
    const [removeTarget, setRemoveTarget] = useState(null); // { podcastId, title }
    const [removing, setRemoving] = useState(false);

    // Audio store actions for Play All
    const setQueue = useAudioStore((state) => state.setQueue);
    const play = useAudioStore((state) => state.play);

    const loadPlaylist = useCallback(async () => {
        try {
            const data = await apiService.getPlaylist(playlistId);
            setPlaylist(data);
            setError(null);
        } catch (e) {
            setError(e?.detail || e?.message || "Failed to load playlist");
        }
    }, [playlistId]);

    useFocusEffect(
        useCallback(() => {
            (async () => {
                setLoading(true);
                await loadPlaylist();
                setLoading(false);
            })();
        }, [loadPlaylist])
    );

    const handleRemove = async () => {
        if (!removeTarget) return;
        setRemoving(true);
        try {
            await apiService.removeFromPlaylist(playlistId, removeTarget.podcastId);
            setPlaylist((prev) => ({
                ...prev,
                items: prev.items.filter((i) => i.podcast_id !== removeTarget.podcastId),
                item_count: (prev.item_count || 1) - 1,
            }));
            showToast("Removed from playlist", "success");
        } catch (e) {
            showToast(e?.detail || e?.message || "Failed to remove episode", "error");
        } finally {
            setRemoving(false);
            setRemoveTarget(null);
        }
    };

    // Play all episodes in the playlist as an ordered queue
    const handlePlayAll = useCallback(() => {
        const playableItems = (playlist?.items || []).filter(
            (item) => item.podcast?.audio_url
        );
        if (playableItems.length === 0) {
            showToast("No playable episodes in this playlist", "warning");
            return;
        }
        const tracks = playableItems.map((item) => ({
            id: item.podcast.id,
            uri: item.podcast.audio_url,
            title: item.podcast.title,
            artist: item.podcast.owner?.name || "Unknown Artist",
            duration: (item.podcast.duration || 0) * 1000,
            artwork: item.podcast.thumbnail_url,
        }));
        setQueue(tracks, 0);
        play(tracks[0]);
        showToast(`Playing ${tracks.length} episode${tracks.length !== 1 ? "s" : ""}`, "success");
    }, [playlist, setQueue, play, showToast]);

    // Share the playlist as a text list of episode titles + deep link
    const handleShare = useCallback(async () => {
        const items = playlist?.items || [];
        const name = playlist?.name || "Playlist";
        const episodeLines = items
            .map((item, i) => `${i + 1}. ${item.podcast?.title || "Unknown"}`)
            .join("\n");
        const shareText = episodeLines.length > 0
            ? `🎧 ${name}\n\n${episodeLines}\n\nListen on proPod!`
            : `🎧 ${name}\n\nListen on proPod!`;
        const deepLink = `volo://playlist/${playlistId}`;
        try {
            if (Platform.OS === "ios") {
                await Share.share({ message: shareText, url: deepLink });
            } else {
                await Share.share({ message: `${shareText}\n\n${deepLink}` });
            }
        } catch {
            // User dismissed the sheet — not an error
        }
    }, [playlist, playlistId]);

    const title = playlist?.name || params.name || "Playlist";
    const items = playlist?.items || [];

    return (
        <SafeAreaView className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
            {/* Header */}
            <View className="flex-row items-center px-4 pt-4 pb-2">
                <TouchableOpacity
                    onPress={() => router.back()}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    className="mr-3"
                >
                    <MaterialCommunityIcons name="arrow-left" size={24} color={COLORS.text.primary} />
                </TouchableOpacity>
                <View className="flex-1">
                    <Text className="text-text-primary text-xl font-bold" numberOfLines={1}>
                        {title}
                    </Text>
                    {playlist ? (
                        <Text className="text-text-secondary text-xs mt-0.5">
                            {playlist.item_count ?? 0} episode{playlist.item_count !== 1 ? "s" : ""} ·{" "}
                            {playlist.is_public ? "Public" : "Private"}
                        </Text>
                    ) : null}
                </View>
                {/* Share button */}
                <TouchableOpacity
                    onPress={handleShare}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    className="ml-2 p-2"
                    accessibilityLabel="Share playlist"
                >
                    <MaterialCommunityIcons name="share-outline" size={22} color={COLORS.text.primary} />
                </TouchableOpacity>
                {/* Play All button — only shown when there are playable episodes */}
                {items.length > 0 && !loading ? (
                    <TouchableOpacity
                        onPress={handlePlayAll}
                        hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
                        className="ml-1 flex-row items-center bg-primary px-3 py-1.5 rounded-xl"
                        accessibilityLabel="Play all episodes"
                    >
                        <MaterialCommunityIcons name="play" size={16} color="#fff" />
                        <Text className="text-white font-semibold text-xs ml-1">Play All</Text>
                    </TouchableOpacity>
                ) : null}
            </View>

            {/* Description */}
            {playlist?.description ? (
                <View className="px-4 pb-3">
                    <Text className="text-text-secondary text-sm">{playlist.description}</Text>
                </View>
            ) : null}

            {/* Content */}
            <View className="flex-1 px-4">
                {loading ? (
                    <View className="flex-1 items-center justify-center">
                        <ActivityIndicator color={COLORS.primary} size="large" />
                    </View>
                ) : error ? (
                    <View className="flex-1 items-center justify-center">
                        <MaterialCommunityIcons name="alert-circle-outline" size={48} color={COLORS.error} />
                        <Text className="text-error mt-3 text-center">{error}</Text>
                        <TouchableOpacity
                            onPress={loadPlaylist}
                            className="mt-4 bg-panel border border-border px-5 py-2 rounded-xl"
                        >
                            <Text className="text-text-primary">Retry</Text>
                        </TouchableOpacity>
                    </View>
                ) : items.length === 0 ? (
                    <View className="flex-1 items-center justify-center">
                        <MaterialCommunityIcons
                            name="playlist-remove"
                            size={64}
                            color={COLORS.text.muted}
                        />
                        <Text className="text-text-secondary mt-4 text-base">No episodes yet</Text>
                        <Text className="text-text-secondary text-sm mt-1 text-center px-8">
                            Open any episode and tap "Add to Playlist" to add it here.
                        </Text>
                    </View>
                ) : (
                    <FlatList
                        data={items}
                        keyExtractor={(item) => String(item.id)}
                        renderItem={({ item }) => (
                            <EpisodeRow
                                item={item}
                                onPress={() =>
                                    router.push({
                                        pathname: "/(main)/details",
                                        params: { id: item.podcast_id },
                                    })
                                }
                                onRemove={() =>
                                    setRemoveTarget({
                                        podcastId: item.podcast_id,
                                        title: item.podcast?.title || "this episode",
                                    })
                                }
                            />
                        )}
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={{ paddingBottom: 100 }}
                    />
                )}
            </View>

            {/* Remove confirmation */}
            <ConfirmationModal
                visible={!!removeTarget}
                onClose={() => setRemoveTarget(null)}
                onConfirm={handleRemove}
                title="Remove Episode"
                message={`Remove "${removeTarget?.title}" from this playlist?`}
                confirmText="Remove"
                cancelText="Cancel"
                destructive
                loading={removing}
                icon="remove-circle-outline"
            />
        </SafeAreaView>
    );
};

export default PlaylistDetail;
