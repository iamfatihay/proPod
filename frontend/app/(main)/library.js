import {
    View,
    Text,
    SafeAreaView,
    FlatList,
    ActivityIndicator,
    TouchableOpacity,
} from "react-native";
import React, { useEffect, useState, useCallback, useRef } from "react";
import { MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";
import apiService from "../../src/services/api/apiService";
import PodcastCard from "../../src/components/PodcastCard";
import PlaylistMosaic from "../../src/components/PlaylistMosaic";
import { useRouter, useLocalSearchParams, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS } from "../../src/constants/theme";

// ─── Tab definitions ──────────────────────────────────────────────────────────

const TABS = [
    { key: "mine",      label: "My Episodes" },
    { key: "likes",     label: "Liked"       },
    { key: "bookmarks", label: "Saved"        },
    { key: "playlists", label: "Playlists"   },
];

const PLAYLIST_PAGE_SIZE = 20;

// ─── PlaylistRow ──────────────────────────────────────────────────────────────
// Lightweight row used inside the Library playlists tab.
// Tap → playlist-detail. "Manage" header → full playlists.js screen.

const PlaylistRow = ({ playlist, onPress }) => (
    <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.75}
        style={{
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: COLORS.panel,
            borderRadius: 16,
            paddingHorizontal: 16,
            paddingVertical: 14,
            marginBottom: 10,
            borderWidth: 1,
            borderColor: COLORS.border,
        }}
    >
        {/* Cover art mosaic (falls back to icon bubble when no thumbnails) */}
        <View style={{ marginRight: 14 }}>
            <PlaylistMosaic
                thumbnails={playlist.preview_thumbnails}
                isPublic={playlist.is_public}
            />
        </View>

        {/* Text info */}
        <View style={{ flex: 1 }}>
            <Text
                style={{
                    color: COLORS.text.primary,
                    fontWeight: "600",
                    fontSize: 15,
                    marginBottom: 2,
                }}
                numberOfLines={1}
            >
                {playlist.name}
            </Text>
            <Text style={{ color: COLORS.text.secondary, fontSize: 12 }}>
                {playlist.item_count ?? 0} episode
                {playlist.item_count !== 1 ? "s" : ""}{" "}
                ·{" "}
                {playlist.is_public ? "Public" : "Private"}
            </Text>
        </View>

        {/* Chevron */}
        <Ionicons
            name="chevron-forward"
            size={18}
            color={COLORS.text.secondary}
            style={{ marginLeft: 8 }}
        />
    </TouchableOpacity>
);

// ─── Library ──────────────────────────────────────────────────────────────────

const Library = () => {
    const router   = useRouter();
    const params   = useLocalSearchParams();
    const insets   = useSafeAreaInsets();

    const [tab,       setTab]       = useState("mine");
    const [items,     setItems]     = useState([]);
    const [loading,   setLoading]   = useState(true);
    const [error,     setError]     = useState(null);

    // ── Playlist-specific pagination state ──────────────────────────────────
    const [playlists,       setPlaylists]       = useState([]);
    const [playlistOffset,  setPlaylistOffset]  = useState(0);
    const [playlistHasMore, setPlaylistHasMore] = useState(false);
    const [loadingMore,     setLoadingMore]     = useState(false);
    const [loadMoreError,   setLoadMoreError]   = useState(null);

    // Monotonically-increasing ID to guard against stale async responses.
    // Each load() invocation captures the ID at call time; results are only
    // applied if the ref still matches when the response arrives.
    const loadIdRef = useRef(0);

    // ── Data loading ────────────────────────────────────────────────────────
    const load = useCallback(async () => {
        // Capture a snapshot of the current sequence ID.  If a concurrent
        // call increments loadIdRef before this one resolves, results are
        // silently discarded (stale-response guard).
        const myId = ++loadIdRef.current;
        // Reset load-more error on every fresh load
        setLoadMoreError(null);
        try {
            let res;
            if (tab === "mine") {
                res = await apiService.getMyPodcasts();
                const list = res.podcasts || res || [];
                if (loadIdRef.current !== myId) return;
                setItems(list.map((p) => ({ ...p, duration: (p.duration || 0) * 1000 })));
            } else if (tab === "likes") {
                res = await apiService.getLikedPodcasts();
                const list = res.podcasts || res || [];
                if (loadIdRef.current !== myId) return;
                setItems(list.map((p) => ({ ...p, duration: (p.duration || 0) * 1000 })));
            } else if (tab === "bookmarks") {
                res = await apiService.getBookmarkedPodcasts();
                const list = res.podcasts || res || [];
                if (loadIdRef.current !== myId) return;
                setItems(list.map((p) => ({ ...p, duration: (p.duration || 0) * 1000 })));
            } else {
                // playlists — first page; resets pagination state
                res = await apiService.getMyPlaylists({ skip: 0, limit: PLAYLIST_PAGE_SIZE });
                if (loadIdRef.current !== myId) return;
                setPlaylists(res.playlists || []);
                setPlaylistOffset(PLAYLIST_PAGE_SIZE);
                setPlaylistHasMore(res.has_more ?? false);
            }
            setError(null);
        } catch (e) {
            if (loadIdRef.current !== myId) return;
            setError(e?.detail || e?.message || "Failed to load library");
        }
    }, [tab]);

    // ── Load-more (playlists only) ───────────────────────────────────────────
    const loadMorePlaylists = useCallback(async () => {
        // Guard: don't start if already loading or nothing left.
        // loadMoreError is intentionally NOT checked here — removing it from the
        // guard fixes the stale-closure bug where retryLoadMore() called this
        // callback but the memoized closure still saw the old truthy error and
        // returned early (no-op on first tap).
        if (loadingMore || !playlistHasMore) return;

        // Stale-response guard: capture the current load generation counter.
        // If the user switches tabs while this request is in flight, load()
        // increments loadIdRef.current; we detect that below and discard results.
        const guardId = loadIdRef.current;
        setLoadingMore(true);
        setLoadMoreError(null);
        try {
            const res = await apiService.getMyPlaylists({
                skip: playlistOffset,
                limit: PLAYLIST_PAGE_SIZE,
            });
            if (loadIdRef.current !== guardId) return; // stale — load() reset state
            const next = res.playlists || [];
            setPlaylists((prev) => {
                const ids = new Set(prev.map((p) => p.id));
                return [...prev, ...next.filter((p) => !ids.has(p.id))];
            });
            setPlaylistOffset((o) => o + PLAYLIST_PAGE_SIZE);
            setPlaylistHasMore(res.has_more ?? false);
        } catch (e) {
            if (loadIdRef.current !== guardId) return; // stale — discard error too
            setLoadMoreError(e?.detail || e?.message || "Failed to load more");
        } finally {
            setLoadingMore(false);
        }
    }, [loadingMore, playlistHasMore, playlistOffset]);

    const retryLoadMore = useCallback(() => {
        loadMorePlaylists();
    }, [loadMorePlaylists]);

    // Reload when tab changes
    useEffect(() => {
        (async () => {
            setLoading(true);
            await load();
            setLoading(false);
        })();
    }, [load]);

    // Reload on params.refresh (e.g. after create/delete)
    useEffect(() => {
        if (params.refresh) {
            (async () => {
                setLoading(true);
                await load();
                setLoading(false);
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

    // ── Renderers ───────────────────────────────────────────────────────────

    const renderPodcast = ({ item }) => (
        <PodcastCard
            podcast={item}
            onPress={() =>
                router.push({ pathname: "/(main)/details", params: { id: item.id } })
            }
        />
    );

    const renderPlaylist = ({ item }) => (
        <PlaylistRow
            playlist={item}
            onPress={() =>
                router.push({
                    pathname: "/(main)/playlist-detail",
                    params: { id: item.id },
                })
            }
        />
    );

    // Empty-state for playlists tab
    const PlaylistsEmpty = () => (
        <View
            style={{
                alignItems: "center",
                justifyContent: "center",
                paddingTop: 60,
                paddingHorizontal: 32,
            }}
        >
            <MaterialCommunityIcons
                name="playlist-music-outline"
                size={56}
                color={COLORS.text.secondary}
                style={{ marginBottom: 16 }}
            />
            <Text
                style={{
                    color: COLORS.text.primary,
                    fontWeight: "700",
                    fontSize: 18,
                    marginBottom: 8,
                    textAlign: "center",
                }}
            >
                No playlists yet
            </Text>
            <Text
                style={{
                    color: COLORS.text.secondary,
                    fontSize: 14,
                    textAlign: "center",
                    marginBottom: 24,
                    lineHeight: 20,
                }}
            >
                Create your first playlist to organise episodes you love.
            </Text>
            <TouchableOpacity
                onPress={() => router.push("/(main)/playlists")}
                activeOpacity={0.8}
                style={{
                    paddingHorizontal: 28,
                    paddingVertical: 12,
                    borderRadius: 24,
                    backgroundColor: COLORS.primary,
                }}
            >
                <Text style={{ color: "white", fontWeight: "700", fontSize: 15 }}>
                    Create Playlist
                </Text>
            </TouchableOpacity>
        </View>
    );

    // Footer shown at the bottom of the playlists FlatList
    const PlaylistsFooter = () => {
        if (loadingMore) {
            return (
                <ActivityIndicator
                    color={COLORS.primary}
                    style={{ marginVertical: 16 }}
                />
            );
        }
        if (loadMoreError) {
            return (
                <View
                    style={{
                        alignItems: "center",
                        paddingVertical: 16,
                    }}
                >
                    <Text
                        style={{
                            color: COLORS.text.secondary,
                            fontSize: 13,
                            marginBottom: 8,
                        }}
                    >
                        {loadMoreError}
                    </Text>
                    <TouchableOpacity
                        onPress={retryLoadMore}
                        activeOpacity={0.8}
                        style={{
                            paddingHorizontal: 20,
                            paddingVertical: 8,
                            borderRadius: 12,
                            backgroundColor: COLORS.panel,
                            borderWidth: 1,
                            borderColor: COLORS.border,
                        }}
                    >
                        <Text
                            style={{
                                color: COLORS.text.primary,
                                fontSize: 13,
                            }}
                        >
                            Retry
                        </Text>
                    </TouchableOpacity>
                </View>
            );
        }
        return null;
    };

    // ── Layout ──────────────────────────────────────────────────────────────

    return (
        <SafeAreaView
            className="flex-1 bg-background"
            style={{ paddingTop: insets.top }}
        >
            <View style={{ flex: 1, paddingHorizontal: 16, paddingTop: 24 }}>

                {/* Tab bar */}
                <View
                    style={{
                        flexDirection: "row",
                        backgroundColor: COLORS.panel,
                        borderRadius: 12,
                        padding: 4,
                        marginBottom: 16,
                        borderWidth: 1,
                        borderColor: COLORS.border,
                    }}
                >
                    {TABS.map((t) => (
                        <TouchableOpacity
                            key={t.key}
                            onPress={() => setTab(t.key)}
                            style={{
                                flex: 1,
                                paddingVertical: 8,
                                paddingHorizontal: 2,
                                borderRadius: 9,
                                backgroundColor:
                                    tab === t.key ? COLORS.primary : "transparent",
                                alignItems: "center",
                            }}
                        >
                            <Text
                                style={{
                                    color:
                                        tab === t.key
                                            ? "white"
                                            : COLORS.text.secondary,
                                    fontSize: 12,
                                    fontWeight: "600",
                                }}
                                numberOfLines={1}
                            >
                                {t.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Action row — only shown on Playlists tab */}
                {tab === "playlists" && (
                    <View
                        style={{
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "flex-end",
                            marginBottom: 12,
                            gap: 16,
                        }}
                    >
                        {/* Discover public playlists */}
                        <TouchableOpacity
                            onPress={() => router.push("/(main)/public-playlists")}
                            activeOpacity={0.7}
                            style={{ flexDirection: "row", alignItems: "center" }}
                        >
                            <Text
                                style={{
                                    color: COLORS.primary,
                                    fontSize: 13,
                                    fontWeight: "600",
                                    marginRight: 4,
                                }}
                            >
                                Discover
                            </Text>
                            <Ionicons
                                name="globe-outline"
                                size={14}
                                color={COLORS.primary}
                            />
                        </TouchableOpacity>

                        {/* Manage own playlists */}
                        <TouchableOpacity
                            onPress={() => router.push("/(main)/playlists")}
                            activeOpacity={0.7}
                            style={{ flexDirection: "row", alignItems: "center" }}
                        >
                            <Text
                                style={{
                                    color: COLORS.primary,
                                    fontSize: 13,
                                    fontWeight: "600",
                                    marginRight: 4,
                                }}
                            >
                                Manage
                            </Text>
                            <Ionicons
                                name="settings-outline"
                                size={14}
                                color={COLORS.primary}
                            />
                        </TouchableOpacity>
                    </View>
                )}

                {/* Content */}
                {loading ? (
                    <View style={{ flex: 1, alignItems: "center", paddingTop: 40 }}>
                        <ActivityIndicator color={COLORS.primary} />
                    </View>
                ) : error ? (
                    <Text style={{ color: COLORS.text.secondary, textAlign: "center", marginTop: 20 }}>
                        {error}
                    </Text>
                ) : tab === "playlists" ? (
                    <FlatList
                        data={playlists}
                        keyExtractor={(item) => String(item.id)}
                        renderItem={renderPlaylist}
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={{
                            paddingBottom: 100,
                            flexGrow: 1,
                        }}
                        onEndReached={loadMorePlaylists}
                        onEndReachedThreshold={0.4}
                        ListFooterComponent={<PlaylistsFooter />}
                        ListEmptyComponent={<PlaylistsEmpty />}
                    />
                ) : (
                    <FlatList
                        data={items}
                        keyExtractor={(item) => String(item.id)}
                        renderItem={renderPodcast}
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={{ paddingBottom: 100 }}
                    />
                )}
            </View>
        </SafeAreaView>
    );
};

export default Library;
