import React, { useState, useCallback, useRef } from "react";
import {
    View,
    Text,
    SafeAreaView,
    FlatList,
    TouchableOpacity,
    ActivityIndicator,
    TextInput,
} from "react-native";
import { MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import apiService from "../../src/services/api/apiService";
import PlaylistMosaic from "../../src/components/PlaylistMosaic";
import { COLORS } from "../../src/constants/theme";

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 350;

// ─── PublicPlaylistCard ────────────────────────────────────────────────────────

const PublicPlaylistCard = ({ playlist, onPress }) => {
    const router = useRouter();
    return (
    <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.8}
        className="flex-row items-center bg-panel rounded-2xl px-4 py-4 mb-3 border border-border"
    >
        {/* Cover art mosaic */}
        <View className="mr-4">
            <PlaylistMosaic
                thumbnails={playlist.preview_thumbnails}
                isPublic={true}
                size={56}
            />
        </View>

        {/* Info */}
        <View className="flex-1">
            <Text
                className="text-text-primary font-semibold text-base"
                numberOfLines={1}
            >
                {playlist.name}
            </Text>
            {playlist.owner_name ? (
                <Text
                    className="text-text-secondary text-xs mt-0.5"
                    numberOfLines={1}
                >
                    by {playlist.owner_name}
                </Text>
            ) : null}
            {playlist.owner_username ? (
                <TouchableOpacity
                    onPress={() =>
                        router.push({
                            pathname: "/(main)/creator-profile",
                            params: { userId: String(playlist.owner_id) },
                        })
                    }
                    hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                >
                    <Text className="text-primary text-xs mt-0.5" numberOfLines={1}>
                        @{playlist.owner_username}
                    </Text>
                </TouchableOpacity>
            ) : null}
            {playlist.description ? (
                <Text
                    className="text-text-secondary text-xs mt-0.5"
                    numberOfLines={1}
                >
                    {playlist.description}
                </Text>
            ) : null}
            <Text className="text-text-secondary text-xs mt-1">
                {playlist.item_count ?? 0} episode
                {playlist.item_count !== 1 ? "s" : ""}
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
};

// ─── PublicPlaylists Screen ────────────────────────────────────────────────────

const PublicPlaylists = () => {
    const router = useRouter();
    const insets = useSafeAreaInsets();

    const [playlists, setPlaylists]         = useState([]);
    const [loading, setLoading]             = useState(true);
    const [refreshing, setRefreshing]       = useState(false);
    const [loadingMore, setLoadingMore]     = useState(false);
    const [loadMoreError, setLoadMoreError] = useState(null);
    const [error, setError]                 = useState(null);
    const [hasMore, setHasMore]             = useState(false);
    const [offset, setOffset]               = useState(0);
    const [searchQuery, setSearchQuery]     = useState("");
    const [activeQuery, setActiveQuery]     = useState("");  // committed after debounce

    const debounceTimer = useRef(null);
    // Keep a ref so loadMore always reads the committed query without stale closure
    const activeQueryRef = useRef("");

    // ── Initial / refresh load ─────────────────────────────────────────────
    const loadFirst = useCallback(async ({ silent = false, q = activeQueryRef.current } = {}) => {
        if (silent) {
            setRefreshing(true);
        } else {
            setLoading(true);
        }
        setError(null);
        setLoadMoreError(null);
        try {
            const res = await apiService.getPublicPlaylists({ skip: 0, limit: PAGE_SIZE, q });
            setPlaylists(res.playlists || []);
            setOffset(PAGE_SIZE);
            setHasMore(res.has_more ?? false);
        } catch (e) {
            setError(e?.detail || e?.message || "Failed to load playlists");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    // Pull-to-refresh
    const handleRefresh = useCallback(() => {
        loadFirst({ silent: true });
    }, [loadFirst]);

    // ── Search with debounce ───────────────────────────────────────────────
    const handleSearchChange = useCallback((text) => {
        setSearchQuery(text);
        if (debounceTimer.current) clearTimeout(debounceTimer.current);
        debounceTimer.current = setTimeout(() => {
            const trimmed = text.trim();
            activeQueryRef.current = trimmed;
            setActiveQuery(trimmed);
            // Reset list and load fresh results
            setPlaylists([]);
            setOffset(0);
            setHasMore(false);
            setLoadMoreError(null);
            loadFirst({ q: trimmed });
        }, SEARCH_DEBOUNCE_MS);
    }, [loadFirst]);

    const handleClearSearch = useCallback(() => {
        if (debounceTimer.current) clearTimeout(debounceTimer.current);
        activeQueryRef.current = "";
        setSearchQuery("");
        setActiveQuery("");
        setPlaylists([]);
        setOffset(0);
        setHasMore(false);
        setLoadMoreError(null);
        loadFirst({ q: "" });
    }, [loadFirst]);

    // ── Paginated load-more ────────────────────────────────────────────────
    const loadMore = useCallback(async () => {
        if (loadingMore || !hasMore || loadMoreError) return;
        setLoadingMore(true);
        try {
            const q = activeQueryRef.current;
            const res = await apiService.getPublicPlaylists({ skip: offset, limit: PAGE_SIZE, q });
            const next = res.playlists || [];
            setPlaylists((prev) => {
                const ids = new Set(prev.map((p) => p.id));
                return [...prev, ...next.filter((p) => !ids.has(p.id))];
            });
            setOffset((o) => o + PAGE_SIZE);
            setHasMore(res.has_more ?? false);
        } catch (e) {
            setLoadMoreError(e?.detail || e?.message || "Failed to load more");
        } finally {
            setLoadingMore(false);
        }
    }, [loadingMore, hasMore, loadMoreError, offset]);

    const retryLoadMore = useCallback(() => {
        setLoadMoreError(null);
        loadMore();
    }, [loadMore]);

    useFocusEffect(
        useCallback(() => {
            loadFirst();
        }, [loadFirst])
    );

    // ── Render helpers ─────────────────────────────────────────────────────
    const ListFooter = () => {
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
                <View className="items-center py-4">
                    <Text className="text-text-secondary text-sm mb-2">
                        {loadMoreError}
                    </Text>
                    <TouchableOpacity
                        onPress={retryLoadMore}
                        className="bg-panel border border-border px-5 py-2 rounded-xl"
                    >
                        <Text className="text-text-primary text-sm">Retry</Text>
                    </TouchableOpacity>
                </View>
            );
        }
        return null;
    };

    const ListEmpty = () =>
        !loading ? (
            <View className="flex-1 items-center justify-center pt-20">
                <MaterialCommunityIcons
                    name="playlist-music-outline"
                    size={64}
                    color={COLORS.text.muted}
                />
                {activeQuery ? (
                    <>
                        <Text className="text-text-secondary mt-4 text-base text-center">
                            No playlists match "{activeQuery}"
                        </Text>
                        <TouchableOpacity
                            onPress={handleClearSearch}
                            className="mt-3 bg-panel border border-border px-5 py-2 rounded-xl"
                        >
                            <Text className="text-text-primary text-sm">Clear search</Text>
                        </TouchableOpacity>
                    </>
                ) : (
                    <>
                        <Text className="text-text-secondary mt-4 text-base text-center">
                            No public playlists yet
                        </Text>
                        <Text className="text-text-secondary text-sm mt-1 text-center px-10">
                            Be the first — make a playlist public from your Library.
                        </Text>
                    </>
                )}
            </View>
        ) : null;

    return (
        <SafeAreaView
            className="flex-1 bg-background"
            style={{ paddingTop: insets.top }}
        >
            {/* Header */}
            <View className="px-4 pt-4 pb-2 flex-row items-center">
                <TouchableOpacity
                    onPress={() => router.back()}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    className="mr-3"
                >
                    <Ionicons
                        name="arrow-back"
                        size={24}
                        color={COLORS.text.primary}
                    />
                </TouchableOpacity>
                <Text className="text-text-primary text-2xl font-bold flex-1">
                    Discover Playlists
                </Text>
            </View>

            {/* Search bar */}
            <View className="px-4 pb-3">
                <View className="flex-row items-center bg-panel rounded-xl border border-border px-3 py-2">
                    <Ionicons
                        name="search-outline"
                        size={18}
                        color={COLORS.text.secondary}
                        style={{ marginRight: 8 }}
                    />
                    <TextInput
                        className="flex-1 text-text-primary text-sm"
                        placeholder="Search playlists or creators…"
                        placeholderTextColor={COLORS.text.muted}
                        value={searchQuery}
                        onChangeText={handleSearchChange}
                        returnKeyType="search"
                        clearButtonMode="never"
                        autoCorrect={false}
                        autoCapitalize="none"
                    />
                    {searchQuery.length > 0 ? (
                        <TouchableOpacity
                            onPress={handleClearSearch}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                            <Ionicons
                                name="close-circle"
                                size={18}
                                color={COLORS.text.secondary}
                            />
                        </TouchableOpacity>
                    ) : null}
                </View>
            </View>

            {/* Content */}
            <View className="flex-1 px-4">
                {loading ? (
                    <View className="flex-1 items-center justify-center">
                        <ActivityIndicator color={COLORS.primary} size="large" />
                    </View>
                ) : error ? (
                    <View className="flex-1 items-center justify-center">
                        <MaterialCommunityIcons
                            name="alert-circle-outline"
                            size={48}
                            color={COLORS.error}
                        />
                        <Text className="text-error mt-3 text-center">{error}</Text>
                        <TouchableOpacity
                            onPress={() => loadFirst()}
                            className="mt-4 bg-panel border border-border px-5 py-2 rounded-xl"
                        >
                            <Text className="text-text-primary">Retry</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <FlatList
                        data={playlists}
                        keyExtractor={(item) => String(item.id)}
                        renderItem={({ item }) => (
                            <PublicPlaylistCard
                                playlist={item}
                                onPress={() =>
                                    router.push({
                                        pathname: "/(main)/playlist-detail",
                                        params: { id: item.id, name: item.name },
                                    })
                                }
                            />
                        )}
                        refreshing={refreshing}
                        onRefresh={handleRefresh}
                        onEndReached={loadMore}
                        onEndReachedThreshold={0.4}
                        ListFooterComponent={<ListFooter />}
                        ListEmptyComponent={<ListEmpty />}
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={{ paddingBottom: 100, flexGrow: 1 }}
                    />
                )}
            </View>
        </SafeAreaView>
    );
};

export default PublicPlaylists;
