import React, { useState, useCallback, useRef, useEffect } from "react";
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
    Animated,
    StyleSheet,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import apiService from "../../src/services/api/apiService";
import ConfirmationModal from "../../src/components/ConfirmationModal";
import { useToast } from "../../src/components/Toast";
import { COLORS } from "../../src/constants/theme";
import useAudioStore from "../../src/context/useAudioStore";
import Logger from "../../src/utils/logger";

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

    // ── Audio state (hooks must run before any early return) ──────────────────
    const currentTrack = useAudioStore((state) => state.currentTrack);
    const isPlaying = useAudioStore((state) => state.isPlaying);
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const animRef = useRef(null);

    // True when this row is the currently-loaded track
    const isActive = podcast ? String(podcast.id) === String(currentTrack?.id) : false;

    useEffect(() => {
        if (isActive && isPlaying) {
            // Pulse the waveform icon opacity: 1 → 0.4 → 1, loop
            animRef.current = Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, {
                        toValue: 0.4,
                        duration: 550,
                        useNativeDriver: true,
                    }),
                    Animated.timing(pulseAnim, {
                        toValue: 1,
                        duration: 550,
                        useNativeDriver: true,
                    }),
                ])
            );
            animRef.current.start();
        } else {
            // Stop looping and reset to fully opaque
            if (animRef.current) animRef.current.stop();
            pulseAnim.setValue(1);
        }
        return () => {
            if (animRef.current) animRef.current.stop();
        };
    }, [isActive, isPlaying, pulseAnim]);

    if (!podcast) return null;

    return (
        <TouchableOpacity
            onPress={onPress}
            activeOpacity={0.8}
            style={[
                styles.episodeRow,
                isActive && { borderColor: COLORS.primary },
            ]}
        >
            {/* Thumbnail — with active overlay when this track is loaded */}
            <View style={styles.thumbnailContainer}>
                {podcast.thumbnail_url ? (
                    <Image
                        source={{ uri: podcast.thumbnail_url }}
                        style={StyleSheet.absoluteFill}
                        resizeMode="cover"
                    />
                ) : (
                    <MaterialCommunityIcons name="waveform" size={24} color={COLORS.primary} />
                )}

                {/* Active overlay: tinted background + animated waveform / pause icon */}
                {isActive && (
                    <View style={styles.activeOverlay}>
                        <Animated.View style={{ opacity: isPlaying ? pulseAnim : 0.8 }}>
                            <MaterialCommunityIcons
                                name={isPlaying ? "waveform" : "pause-circle"}
                                size={22}
                                color="#fff"
                            />
                        </Animated.View>
                    </View>
                )}
            </View>

            {/* Info */}
            <View className="flex-1">
                <Text
                    className="font-semibold text-sm"
                    style={{ color: isActive ? COLORS.primary : COLORS.text.primary }}
                    numberOfLines={2}
                >
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

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    episodeRow: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: COLORS.panel,
        borderRadius: 16,
        paddingHorizontal: 16,
        paddingVertical: 12,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    thumbnailContainer: {
        width: 48,
        height: 48,
        backgroundColor: COLORS.primary + "1A", // primary at ~10% opacity
        borderRadius: 12,
        overflow: "hidden",
        alignItems: "center",
        justifyContent: "center",
        marginRight: 12,
        borderWidth: 1,
        borderColor: COLORS.primary + "33", // primary at ~20% opacity
    },
    activeOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: COLORS.primary + "B3", // primary at ~70% opacity
        alignItems: "center",
        justifyContent: "center",
    },
});

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

    // Build a track list from the playlist's playable items
    const buildTracks = useCallback(() => {
        const playableItems = (playlist?.items || []).filter(
            (item) => item.podcast?.audio_url
        );
        return playableItems.map((item) => ({
            id: item.podcast.id,
            uri: item.podcast.audio_url,
            title: item.podcast.title,
            artist: item.podcast.owner?.name || "Unknown Artist",
            duration: (item.podcast.duration || 0) * 1000,
            artwork: item.podcast.thumbnail_url,
        }));
    }, [playlist]);

    // Play all episodes in the playlist as an ordered queue
    const handlePlayAll = useCallback(() => {
        const tracks = buildTracks();
        if (tracks.length === 0) {
            showToast("No playable episodes in this playlist", "warning");
            return;
        }
        // play() first so useAudioStore detects the track switch (track.id differs
        // from currentTrack.id at call time) and unloads the old sound before
        // creating a new player. setQueue() runs after to register queue context.
        play(tracks[0]);
        setQueue(tracks, 0);
        showToast(`Playing ${tracks.length} episode${tracks.length !== 1 ? "s" : ""}`, "success");
    }, [buildTracks, setQueue, play, showToast]);

    // Shuffle episodes using Fisher-Yates and start from the first shuffled track
    const handleShuffle = useCallback(() => {
        const tracks = buildTracks();
        if (tracks.length === 0) {
            showToast("No playable episodes in this playlist", "warning");
            return;
        }
        const shuffled = [...tracks];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        // Same ordering rationale as handlePlayAll: play() before setQueue() so the
        // audio store sees a track change and properly unloads any previously-loaded sound.
        play(shuffled[0]);
        setQueue(shuffled, 0);
        showToast(`Shuffling ${shuffled.length} episode${shuffled.length !== 1 ? "s" : ""}`, "success");
    }, [buildTracks, setQueue, play, showToast]);

    // Share the playlist as a text list of episode titles + deep link
    const handleShare = useCallback(async () => {
        const shareItems = playlist?.items || [];
        const name = playlist?.name || "Playlist";
        const episodeLines = shareItems
            .map((item, i) => `${i + 1}. ${item.podcast?.title || "Unknown"}`)
            .join("\n");
        const shareText = episodeLines.length > 0
            ? `🎧 ${name}\n\n${episodeLines}\n\nListen on Volo App!`
            : `🎧 ${name}\n\nListen on Volo App!`;
        const deepLink = `volo://playlist/${playlistId}`;
        try {
            if (Platform.OS === "ios") {
                await Share.share({ message: shareText, url: deepLink });
            } else {
                await Share.share({ message: `${shareText}\n\n${deepLink}` });
            }
        } catch (error) {
            Logger.error("Share failed:", error);
        }
    }, [playlist, playlistId]);

    const title = playlist?.name || params.name || "Playlist";
    const items = playlist?.items || [];
    // Derive playable count once so both the button guard and handlePlayAll agree
    const playableCount = items.filter((item) => item.podcast?.audio_url).length;

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
                {/* Shuffle + Play All buttons — only shown when there are actually playable episodes */}
                {playableCount > 0 && !loading ? (
                    <>
                        <TouchableOpacity
                            onPress={handleShuffle}
                            hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
                            className="ml-1 flex-row items-center bg-panel border border-border px-3 py-1.5 rounded-xl"
                            accessibilityLabel="Shuffle play"
                        >
                            <MaterialCommunityIcons name="shuffle" size={16} color={COLORS.primary} />
                            <Text className="text-primary font-semibold text-xs ml-1">Shuffle</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={handlePlayAll}
                            hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
                            className="ml-1 flex-row items-center bg-primary px-3 py-1.5 rounded-xl"
                            accessibilityLabel="Play all episodes"
                        >
                            <MaterialCommunityIcons name="play" size={16} color="#fff" />
                            <Text className="text-white font-semibold text-xs ml-1">Play All</Text>
                        </TouchableOpacity>
                    </>
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
