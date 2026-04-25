import {
    View,
    Text,
    Image,
    SafeAreaView,
    FlatList,
    ActivityIndicator,
    TouchableOpacity,
} from "react-native";
import React, { useEffect, useState, useCallback, useRef } from "react";
import { MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";
import apiService from "../../src/services/api/apiService";
import PodcastCard from "../../src/components/PodcastCard";
import { useRouter, useLocalSearchParams, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS, addAlpha } from "../../src/constants/theme";

// ─── Tab definitions ──────────────────────────────────────────────────────────

const TABS = [
    { key: "mine",      label: "My Episodes" },
    { key: "likes",     label: "Liked"       },
    { key: "bookmarks", label: "Saved"        },
    { key: "playlists", label: "Playlists"   },
];

// ─── PlaylistRow ──────────────────────────────────────────────────────────────
// Lightweight row used inside the Library playlists tab.
// Tap → playlist-detail. "Manage" header → full playlists.js screen.

// ─── PlaylistMosaic ───────────────────────────────────────────────────────────
// Renders a 2×2 grid of cover art thumbnails when available, otherwise shows
// a themed icon bubble. Accepts up to 4 URLs from `preview_thumbnails`.
const PlaylistMosaic = ({ thumbnails, isPublic }) => {
    const urls = (thumbnails || []).filter(Boolean).slice(0, 4);
    if (urls.length === 0) {
        return (
            <View
                style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    backgroundColor: addAlpha(COLORS.primary, 0.1),
                    borderWidth: 1,
                    borderColor: addAlpha(COLORS.primary, 0.2),
                    alignItems: "center",
                    justifyContent: "center",
                }}
            >
                <MaterialCommunityIcons
                    name={isPublic ? "playlist-music" : "playlist-lock"}
                    size={22}
                    color={COLORS.primary}
                />
            </View>
        );
    }
    // Pad to 4 slots so layout stays stable with 1–3 images
    const slots = [...urls, ...Array(4 - urls.length).fill(null)];
    return (
        <View
            style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                overflow: "hidden",
                flexDirection: "row",
                flexWrap: "wrap",
            }}
        >
            {slots.map((url, i) =>
                url ? (
                    <Image
                        key={i}
                        source={{ uri: url }}
                        style={{ width: 22, height: 22 }}
                        resizeMode="cover"
                    />
                ) : (
                    <View
                        key={i}
                        style={{
                            width: 22,
                            height: 22,
                            backgroundColor: addAlpha(COLORS.primary, 0.1),
                        }}
                    />
                )
            )}
        </View>
    );
};

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
                // playlists
                res = await apiService.getMyPlaylists({ limit: 50 });
                if (loadIdRef.current !== myId) return;
                setItems(res.playlists || []);
            }
            setError(null);
        } catch (e) {
            if (loadIdRef.current !== myId) return;
            setError(e?.detail || e?.message || "Failed to load library");
        }
    }, [tab]);

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

                {/* "Manage" link — only shown on Playlists tab */}
                {tab === "playlists" && (
                    <TouchableOpacity
                        onPress={() => router.push("/(main)/playlists")}
                        activeOpacity={0.7}
                        style={{
                            flexDirection: "row",
                            alignItems: "center",
                            alignSelf: "flex-end",
                            marginBottom: 12,
                        }}
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
                        data={items}
                        keyExtractor={(item) => String(item.id)}
                        renderItem={renderPlaylist}
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={{
                            paddingBottom: 100,
                            flexGrow: 1,
                        }}
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
