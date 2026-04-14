import React, { useState, useEffect, useCallback } from "react";
import {
    View,
    Text,
    SafeAreaView,
    FlatList,
    TouchableOpacity,
    ActivityIndicator,
    StatusBar,
} from "react-native";
import { Stack, useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Avatar from "../../src/components/Avatar";
import PodcastCard from "../../src/components/PodcastCard";
import apiService from "../../src/services/api/apiService";
import useAudioStore from "../../src/context/useAudioStore";
import useAuthStore from "../../src/context/useAuthStore";
import { normalizePodcasts, toAbsoluteUrl } from "../../src/utils/urlHelper";

// Maps a normalised podcast API object to the track shape required by useAudioStore
const toTrack = (p) => ({
    id: p.id,
    uri: toAbsoluteUrl(p.audio_url),
    title: p.title,
    artist: p.owner?.name || "Unknown Artist",
    artwork: toAbsoluteUrl(p.thumbnail_url),
    duration: (p.duration || 0) * 1000, // convert seconds → ms (backend returns seconds)
    category: p.category,
});
import { COLORS } from "../../src/constants/theme";
import Logger from "../../src/utils/logger";
import { buildSecondaryScreenOptions } from "../../src/utils/secondaryScreenOptions";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const formatDate = (isoString) => {
    if (!isoString) return "";
    const date = new Date(isoString);
    return date.toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
    });
};

const formatCount = (n = 0) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return String(n);
};

// ─── Stat Pill ────────────────────────────────────────────────────────────────

const StatItem = ({ icon, value, label }) => (
    <View className="items-center flex-1">
        <Ionicons name={icon} size={20} color={COLORS.primary} />
        <Text className="text-text-primary font-bold text-base mt-1">
            {formatCount(value)}
        </Text>
        <Text className="text-text-secondary text-xs">{label}</Text>
    </View>
);

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function CreatorProfile() {
    const router = useRouter();
    // useLocalSearchParams can return string | string[] | undefined.
    // Normalise to a single string so API URLs remain valid.
    const rawUserId = useLocalSearchParams().userId;
    const userId = Array.isArray(rawUserId) ? rawUserId[0] : rawUserId;

    const [profile, setProfile] = useState(null);
    const [podcasts, setPodcasts] = useState([]);
    const [total, setTotal] = useState(0);
    const [loadingProfile, setLoadingProfile] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState(null);
    const [page, setPage] = useState(0);

    // Follow state — seeded from the profile API response
    const [isFollowing, setIsFollowing] = useState(false);
    const [followerCount, setFollowerCount] = useState(0);
    const [followLoading, setFollowLoading] = useState(false);

    const PAGE_SIZE = 20;

    // Auth — needed to decide whether to show the follow button
    const currentUser = useAuthStore((state) => state.user);

    // Audio store actions
    const currentTrack = useAudioStore((state) => state.currentTrack);
    const isPlaying = useAudioStore((state) => state.isPlaying);
    const setQueue = useAudioStore((state) => state.setQueue);
    const play = useAudioStore((state) => state.play);
    const pause = useAudioStore((state) => state.pause);

    // ── Load profile + first page of podcasts ──────────────────────────────
    const loadInitial = useCallback(async () => {
        if (!userId) {
            setError("No creator ID provided.");
            setLoadingProfile(false);
            return;
        }
        // Reset all stale data so Retry / userId-change shows a clean load state
        setLoadingProfile(true);
        setError(null);
        setProfile(null);
        setPodcasts([]);
        setTotal(0);
        setPage(0);
        try {
            const [profileData, podcastData] = await Promise.all([
                apiService.getPublicUserProfile(userId),
                apiService.getPublicUserPodcasts(userId, {
                    skip: 0,
                    limit: PAGE_SIZE,
                }),
            ]);
            setProfile(profileData);
            setIsFollowing(profileData.is_following ?? false);
            setFollowerCount(profileData.total_followers ?? 0);
            const normalized = normalizePodcasts(
                podcastData.podcasts || podcastData || []
            );
            setPodcasts(normalized);
            setTotal(podcastData.total ?? normalized.length);
            setPage(1);
        } catch (e) {
            Logger.error("CreatorProfile: failed to load", e);
            setError(e?.detail || e?.message || "Failed to load creator profile.");
        } finally {
            setLoadingProfile(false);
        }
    }, [userId]);

    useEffect(() => {
        loadInitial();
    }, [loadInitial]);

    // ── Load more (infinite scroll) ────────────────────────────────────────
    const loadMore = useCallback(async () => {
        if (loadingMore || podcasts.length >= total) return;
        try {
            setLoadingMore(true);
            const podcastData = await apiService.getPublicUserPodcasts(userId, {
                skip: page * PAGE_SIZE,
                limit: PAGE_SIZE,
            });
            const normalized = normalizePodcasts(
                podcastData.podcasts || podcastData || []
            );
            setPodcasts((prev) => [...prev, ...normalized]);
            setPage((p) => p + 1);
        } catch (e) {
            Logger.error("CreatorProfile: loadMore failed", e);
        } finally {
            setLoadingMore(false);
        }
    }, [loadingMore, podcasts.length, total, userId, page]);

    // ── Playback helpers ───────────────────────────────────────────────────
    const handlePodcastPress = (podcast) => {
        router.push({
            pathname: "/(main)/details",
            params: { id: podcast.id },
        });
    };

    const handlePlayPress = useCallback(
        (podcast) => {
            const isCurrentTrack = currentTrack?.id === podcast.id;
            if (isCurrentTrack) {
                isPlaying ? pause() : play();
            } else {
                // Build proper track objects (audio_url → uri) for useAudioStore.
                // setQueue expects (tracks[], startIndex: number) — pass a numeric index.
                const tracks = podcasts.map(toTrack);
                const startIdx = tracks.findIndex((t) => t.id === podcast.id);
                setQueue(tracks, startIdx >= 0 ? startIdx : 0);
                play(tracks[startIdx >= 0 ? startIdx : 0]);
            }
        },
        [currentTrack, isPlaying, podcasts, setQueue, play, pause]
    );

    // ── Render helpers ─────────────────────────────────────────────────────
    const renderPodcast = useCallback(
        ({ item }) => (
            <PodcastCard
                podcast={item}
                onPress={() => handlePodcastPress(item)}
                onPlayPress={() => handlePlayPress(item)}
                isPlaying={isPlaying && currentTrack?.id === item.id}
                showPlayButton
            />
        ),
        [currentTrack, isPlaying, handlePlayPress]
    );

    const keyExtractor = useCallback((item) => String(item.id), []);

    // ── Follow / Unfollow ─────────────────────────────────────────────────
    const handleFollowToggle = useCallback(async () => {
        if (followLoading) return;
        setFollowLoading(true);

        // Optimistic update
        const wasFollowing = isFollowing;
        setIsFollowing(!wasFollowing);
        setFollowerCount((c) => wasFollowing ? Math.max(0, c - 1) : c + 1);

        try {
            if (wasFollowing) {
                await apiService.unfollowCreator(userId);
            } else {
                await apiService.followCreator(userId);
            }
        } catch (e) {
            // Rollback on failure
            setIsFollowing(wasFollowing);
            setFollowerCount((c) => wasFollowing ? c + 1 : Math.max(0, c - 1));
            Logger.error("CreatorProfile: follow toggle failed", e);
        } finally {
            setFollowLoading(false);
        }
    }, [followLoading, isFollowing, userId]);

    const ListHeader = () => (
        <View>
            {/* Profile card */}
            <View className="items-center pt-6 pb-4 px-6">
                <Avatar
                    uri={profile?.photo_url}
                    name={profile?.name}
                    size={96}
                />
                <Text className="text-text-primary text-xl font-bold mt-3">
                    {profile?.name}
                </Text>
                {profile?.created_at && (
                    <Text className="text-text-secondary text-sm mt-1">
                        Creator since {formatDate(profile.created_at)}
                    </Text>
                )}

                {/* Follow button — only shown to authenticated users viewing another user's profile */}
                {currentUser && String(currentUser.id) !== String(userId) && (
                    <TouchableOpacity
                        onPress={handleFollowToggle}
                        disabled={followLoading}
                        accessible={true}
                        accessibilityRole="button"
                        accessibilityLabel={isFollowing ? "Unfollow creator" : "Follow creator"}
                        style={{
                            marginTop: 16,
                            paddingHorizontal: 28,
                            paddingVertical: 8,
                            borderRadius: 20,
                            borderWidth: 1.5,
                            borderColor: COLORS.primary,
                            backgroundColor: isFollowing ? "transparent" : COLORS.primary,
                            opacity: followLoading ? 0.6 : 1,
                        }}
                    >
                        <Text
                            style={{
                                color: isFollowing ? COLORS.primary : "#FFFFFF",
                                fontWeight: "600",
                                fontSize: 14,
                            }}
                        >
                            {followLoading ? "…" : isFollowing ? "Following" : "Follow"}
                        </Text>
                    </TouchableOpacity>
                )}

                {/* Message button — let any logged-in user start a DM with this creator */}
                {currentUser && String(currentUser.id) !== String(userId) && (
                    <TouchableOpacity
                        onPress={() =>
                            router.push({
                                pathname: "/(main)/chat-details",
                                params: {
                                    partnerId: String(userId),
                                    partnerName: profile?.name || "Creator",
                                },
                            })
                        }
                        accessible={true}
                        accessibilityRole="button"
                        accessibilityLabel="Send a direct message"
                        style={{
                            marginTop: 10,
                            paddingHorizontal: 28,
                            paddingVertical: 8,
                            borderRadius: 20,
                            borderWidth: 1.5,
                            borderColor: COLORS.border,
                            backgroundColor: "transparent",
                        }}
                    >
                        <Text
                            style={{
                                color: COLORS.text.secondary,
                                fontWeight: "600",
                                fontSize: 14,
                            }}
                        >
                            Message
                        </Text>
                    </TouchableOpacity>
                )}
            </View>

            {/* Stats row */}
            <View
                className="flex-row mx-6 mb-6 p-4 rounded-2xl border border-border"
                style={{ backgroundColor: COLORS.panel }}
            >
                <StatItem
                    icon="headset-outline"
                    value={profile?.total_plays}
                    label="Plays"
                />
                <View
                    style={{
                        width: 1,
                        backgroundColor: COLORS.border,
                        marginHorizontal: 8,
                    }}
                />
                <StatItem
                    icon="heart-outline"
                    value={profile?.total_likes}
                    label="Likes"
                />
                <View
                    style={{
                        width: 1,
                        backgroundColor: COLORS.border,
                        marginHorizontal: 8,
                    }}
                />
                <StatItem
                    icon="people-outline"
                    value={followerCount}
                    label="Followers"
                />
                <View
                    style={{
                        width: 1,
                        backgroundColor: COLORS.border,
                        marginHorizontal: 8,
                    }}
                />
                <StatItem
                    icon="mic-outline"
                    value={profile?.podcast_count}
                    label="Episodes"
                />
            </View>

            {/* Section title */}
            {podcasts.length > 0 && (
                <Text className="text-text-primary text-base font-semibold px-6 mb-3">
                    Episodes ({total})
                </Text>
            )}
        </View>
    );

    const ListFooter = () =>
        loadingMore ? (
            <ActivityIndicator
                color={COLORS.primary}
                style={{ paddingVertical: 20 }}
            />
        ) : null;

    const ListEmpty = () =>
        !loadingProfile ? (
            <Text className="text-text-secondary text-center mt-4 px-6">
                This creator hasn't published any episodes yet.
            </Text>
        ) : null;

    // ── Error state ────────────────────────────────────────────────────────
    if (!loadingProfile && error) {
        return (
            <SafeAreaView
                className="flex-1 bg-background"
                
            >
                <Stack.Screen
                    options={buildSecondaryScreenOptions({
                        router,
                        title: "Creator Profile",
                        backgroundColor: COLORS.background,
                    })}
                />
                <StatusBar barStyle="light-content" />
                <View className="flex-1 items-center justify-center px-8">
                    <Ionicons
                        name="person-outline"
                        size={56}
                        color={COLORS.text.muted}
                    />
                    <Text className="text-text-primary text-lg font-semibold mt-4 text-center">
                        Creator not found
                    </Text>
                    <Text className="text-text-secondary text-center mt-2">
                        {error}
                    </Text>
                    <TouchableOpacity
                        onPress={loadInitial}
                        className="mt-6 px-6 py-3 rounded-xl bg-primary"
                        accessible
                        accessibilityLabel="Retry"
                        accessibilityRole="button"
                    >
                        <Text className="text-white font-semibold">Retry</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    // ── Loading skeleton ───────────────────────────────────────────────────
    if (loadingProfile) {
        return (
            <SafeAreaView
                className="flex-1 bg-background"
                
            >
                <Stack.Screen
                    options={buildSecondaryScreenOptions({
                        router,
                        title: "Creator Profile",
                        backgroundColor: COLORS.background,
                    })}
                />
                <StatusBar barStyle="light-content" />
                <View className="flex-1 items-center justify-center">
                    <ActivityIndicator size="large" color={COLORS.primary} />
                    <Text className="text-text-secondary mt-3">
                        Loading creator profile…
                    </Text>
                </View>
            </SafeAreaView>
        );
    }

    // ── Main render ────────────────────────────────────────────────────────
    return (
        <SafeAreaView
            className="flex-1 bg-background"
            
        >
            <Stack.Screen
                options={buildSecondaryScreenOptions({
                    router,
                    title: profile?.name || "Creator Profile",
                    backgroundColor: COLORS.background,
                })}
            />
            <StatusBar barStyle="light-content" />

            <FlatList
                data={podcasts}
                keyExtractor={keyExtractor}
                renderItem={renderPodcast}
                ListHeaderComponent={<ListHeader />}
                ListFooterComponent={<ListFooter />}
                ListEmptyComponent={<ListEmpty />}
                contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120 }}
                onEndReached={loadMore}
                onEndReachedThreshold={0.3}
                showsVerticalScrollIndicator={false}
            />
        </SafeAreaView>
    );
}
