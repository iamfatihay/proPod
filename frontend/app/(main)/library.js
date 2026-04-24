import {
    View,
    Text,
    SafeAreaView,
    FlatList,
    ActivityIndicator,
    TouchableOpacity,
} from "react-native";
import React, { useEffect, useState, useCallback } from "react";
import { MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";
import apiService from "../../src/services/api/apiService";
import PodcastCard from "../../src/components/PodcastCard";
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
        {/* Icon bubble */}
        <View
            style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                backgroundColor: COLORS.primary + "1A",
                borderWidth: 1,
                borderColor: COLORS.primary + "33",
                alignItems: "center",
                justifyContent: "center",
                marginRight: 14,
            }}
        >
            <MaterialCommunityIcons
                name={playlist.is_public ? "playlist-music" : "playlist-lock"}
                size={22}
                color={COLORS.primary}
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

    // ── Data loading ────────────────────────────────────────────────────────
    const load = useCallback(async () => {
        try {
            let res;
            if (tab === "mine") {
                res = await apiService.getMyPodcasts();
                const list = res.podcasts || res || [];
                setItems(list.map((p) => ({ ...p, duration: (p.duration || 0) * 1000 })));
            } else if (tab === "likes") {
                res = await apiService.getLikedPodcasts();
                const list = res.podcasts || res || [];
                setItems(list.map((p) => ({ ...p, duration: (p.duration || 0) * 1000 })));
            } else if (tab === "bookmarks") {
                res = await apiService.getBookmarkedPodcasts();
                const list = res.podcasts || res || [];
                setItems(list.map((p) => ({ ...p, duration: (p.duration || 0) * 1000 })));
            } else {
                // playlists
                res = await apiService.getMyPlaylists({ limit: 50 });
                setItems(res.playlists || []);
            }
            setError(null);
        } catch (e) {
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
