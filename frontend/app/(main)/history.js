import React, { useState, useCallback } from "react";
import {
    View,
    Text,
    SafeAreaView,
    FlatList,
    TouchableOpacity,
    Image,
    ActivityIndicator,
    StyleSheet,
    RefreshControl,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import apiService from "../../src/services/api/apiService";
import { normalizePodcast } from "../../src/utils/urlHelper";
import { COLORS } from "../../src/constants/theme";

// Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂ Helpers Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ

/** Format a date string relative to now (e.g. "2h ago", "Yesterday", "Apr 10"). */
function formatRelativeTime(dateString) {
    if (!dateString) return "";
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** Format duration in seconds as "M:SS". */
function formatDuration(seconds) {
    if (!seconds) return "0:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
}

// Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂ History Row Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ

const HistoryRow = React.memo(
    function HistoryRow({ entry, onPress, onDelete }) {
        const podcast = entry.podcast;
        if (!podcast) return null;

        const durationSec = podcast.duration || 0;
        const positionSec = entry.position || 0;
        const progressPercent =
            durationSec > 0
                ? Math.min(100, Math.round((positionSec / durationSec) * 100))
                : 0;
        const completed = entry.completed || progressPercent >= 95;

        // FIX #3: accessibilityLabel must reflect completed status Ã¢ÂÂ a row with
        // entry.completed=true but duration=0 would previously read "0% listened"
        // which contradicts the visible "Completed" badge.
        const a11yLabel = completed
            ? `${podcast.title}, Completed`
            : progressPercent > 0
            ? `${podcast.title}, ${progressPercent}% listened`
            : `${podcast.title}, not started`;

        const handleRowPress = useCallback(() => onPress(entry), [onPress, entry]);
        const handleDeletePress = useCallback(() => onDelete(entry), [onDelete, entry]);

        return (
            <View style={styles.row}>
                <TouchableOpacity
                    onPress={handleRowPress}
                    activeOpacity={0.8}
                    style={styles.rowPressable}
                    accessibilityLabel={a11yLabel}
                >
                {/* Thumbnail */
                <View style={styles.thumbnailWrap}>
                    {podcast.thumbnail_url ? (
                        <Image
                            source={{ uri: podcast.thumbnail_url }}
                            style={StyleSheet.absoluteFill}
                            resizeMode="cover"
                        />
                    ) : (
                        <MaterialCommunityIcons
                            name="waveform"
                            size={24}
                            color={COLORS.primary}
                        />
                    )}
                    {completed && (
                        <View style={styles.completedBadge}>
                            <MaterialCommunityIcons
                                name="check"
                                size={12}
                                color="#fff"
                            />
                        </View>
                    )}
                </View>

                {/* Info */}
                <View style={styles.info}>
                    <Text
                        style={[
                            styles.title,
                            completed && { color: COLORS.text.secondary },
                        ]}
                        numberOfLines={2}
                    >
                        {podcast.title}
                    </Text>
                    <Text style={styles.meta} numberOfLines={1}>
                        {podcast.owner?.name || "Unknown"} ÃÂ·{" "}
                        {formatDuration(durationSec)}
                    </Text>

                    {/* Progress bar Ã¢ÂÂ only for in-progress episodes */}
                    {!completed && durationSec > 0 && progressPercent > 0 && (
                        <View style={styles.progressTrack}>
                            <View
                                style={[
                                    styles.progressFill,
                                    { width: `${progressPercent}%` },
                                ]}
                            />
                        </View>
                    )}

                    {/* Status / timestamp */}
                    <Text style={styles.status}>
                        {completed
                            ? "Completed"
                            : progressPercent > 0
                            ? `${progressPercent}% listened`
                            : "Started"}
                        {"  ÃÂ·  "}
                        {formatRelativeTime(entry.updated_at)}
                    </Text>
                </View>
                </TouchableOpacity>

                {/* Delete button — sibling touchable, no propagation to row press */}
                <TouchableOpacity
                    onPress={handleDeletePress}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={styles.deleteButton}
                    accessibilityLabel={`Remove ${podcast.title} from history`}
                >
                    <MaterialCommunityIcons
                        name="trash-can-outline"
                        size={20}
                        color={COLORS.text.muted}
                    />
                </TouchableOpacity>
            </View>
        );
    },
    // FIX #1: Compare all fields that affect rendering, not just entry.id.
    // History entries share their id across sessions but their position,
    // completed flag, updated_at, and even the podcast's title/thumbnail can
    // change between focuses (e.g. after listening more, or after a podcast edit).
    (prev, next) =>
        prev.entry.position === next.entry.position &&
        prev.entry.completed === next.entry.completed &&
        prev.entry.updated_at === next.entry.updated_at &&
        prev.entry.podcast?.title === next.entry.podcast?.title &&
        prev.entry.podcast?.thumbnail_url === next.entry.podcast?.thumbnail_url &&
        prev.onPress === next.onPress &&
        prev.onDelete === next.onDelete
);

// Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂ Main Screen Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ

const PAGE_SIZE = 20;

export default function HistoryScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();

    const [entries, setEntries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [loadMoreError, setLoadMoreError] = useState(null); // FIX #2
    const [error, setError] = useState(null);
    const [hasMore, setHasMore] = useState(true);
    const [currentSkip, setCurrentSkip] = useState(0);

    const fetchPage = useCallback(async (skip) => {
        const data = await apiService.getListeningHistory({
            skip,
            limit: PAGE_SIZE,
        });
        const normalized = (data || []).map((entry) => ({
            ...entry,
            podcast: entry.podcast ? normalizePodcast(entry.podcast) : null,
        }));
        return normalized;
    }, []);

    /** Full reload Ã¢ÂÂ used on focus and pull-to-refresh. */
    const loadFresh = useCallback(
        (opts = {}) => {
            const { isRefresh = false } = opts;
            if (isRefresh) setRefreshing(true);
            else setLoading(true);

            setCurrentSkip(0);
            setHasMore(true);
            setLoadMoreError(null);

            return fetchPage(0)
                .then((normalized) => {
                    setEntries(normalized);
                    setCurrentSkip(normalized.length);
                    setHasMore(normalized.length === PAGE_SIZE);
                    setError(null);
                })
                .catch((e) => {
                    setError(e?.detail || e?.message || "Failed to load history");
                })
                .finally(() => {
                    if (isRefresh) setRefreshing(false);
                    else setLoading(false);
                });
        },
        [fetchPage]
    );

    // Reload whenever screen comes into focus
    useFocusEffect(
        useCallback(() => {
            let active = true;
            loadFresh().then(() => {
                // no-op Ã¢ÂÂ active guard not needed since loadFresh uses setState
                // which React batches; any state update after unmount is a no-op.
            });
            return () => {
                active = false;
            };
        }, [loadFresh])
    );

    // FIX #2: Pull-to-refresh handler
    const handleRefresh = useCallback(() => {
        loadFresh({ isRefresh: true });
    }, [loadFresh]);

    const handleLoadMore = useCallback(async () => {
        if (loadingMore || !hasMore) return;
        setLoadingMore(true);
        setLoadMoreError(null);
        try {
            const normalized = await fetchPage(currentSkip);
            setEntries((prev) => [...prev, ...normalized]);
            setCurrentSkip((s) => s + normalized.length);
            setHasMore(normalized.length === PAGE_SIZE);
        } catch (e) {
            // FIX #2: Surface load-more failures so users can retry instead of
            // silently losing pagination. Pull-to-refresh is also available.
            setLoadMoreError(e?.detail || e?.message || "Failed to load more");
        } finally {
            setLoadingMore(false);
        }
    }, [loadingMore, hasMore, currentSkip, fetchPage]);

    // FIX #2: Retry button in the footer after a load-more failure
    const handleLoadMoreRetry = useCallback(() => {
        setLoadMoreError(null);
        handleLoadMore();
    }, [handleLoadMore]);

    const handleRetry = useCallback(() => loadFresh(), [loadFresh]);

    const handlePress = useCallback(
        (entry) => {
            if (!entry.podcast_id) return;
            router.push({
                pathname: "/(main)/details",
                params: { id: entry.podcast_id },
            });
        },
        [router]
    );

    const handleDelete = useCallback(async (entry) => {
        if (!entry.podcast_id) return;
        // Optimistically remove from list for instant feedback
        setEntries((prev) => prev.filter((e) => e.id !== entry.id));
        try {
            await apiService.deleteListeningHistory(entry.podcast_id);
        } catch (err) {
            // Silently fail â a full refresh on next focus restores true server state.
        }
    }, []);

    const renderItem = useCallback(
        ({ item }) => (
            <HistoryRow
                entry={item}
                onPress={handlePress}
                onDelete={handleDelete}
            />
        ),
        [handlePress, handleDelete]
    );

    const keyExtractor = useCallback((item) => String(item.id), []);

    // FIX #2: ListFooterComponent shows spinner, error+retry, or nothing
    const ListFooter = useCallback(() => {
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
                <View style={styles.footerError}>
                    <Text style={styles.footerErrorText}>{loadMoreError}</Text>
                    <TouchableOpacity
                        onPress={handleLoadMoreRetry}
                        style={styles.footerRetryButton}
                        accessibilityLabel="Retry loading more episodes"
                    >
                        <Text style={styles.retryText}>Retry</Text>
                    </TouchableOpacity>
                </View>
            );
        }
        return null;
    }, [loadingMore, loadMoreError, handleLoadMoreRetry]);

    return (
        <SafeAreaView style={[styles.container, { paddingTop: insets.top }]}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={() => router.back()}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    style={styles.backButton}
                    accessibilityLabel="Go back"
                >
                    <MaterialCommunityIcons
                        name="arrow-left"
                        size={24}
                        color={COLORS.text.primary}
                    />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Listening History</Text>
            </View>

            {/* Body */}
            {loading ? (
                <View style={styles.centered}>
                    <ActivityIndicator color={COLORS.primary} size="large" />
                </View>
            ) : error ? (
                <View style={styles.centered}>
                    <MaterialCommunityIcons
                        name="alert-circle-outline"
                        size={48}
                        color={COLORS.error}
                    />
                    <Text style={styles.errorText}>{error}</Text>
                    <TouchableOpacity
                        onPress={handleRetry}
                        style={styles.retryButton}
                    >
                        <Text style={styles.retryText}>Retry</Text>
                    </TouchableOpacity>
                </View>
            ) : entries.length === 0 ? (
                // FIX #2: empty state also supports pull-to-refresh
                <FlatList
                    data={[]}
                    keyExtractor={keyExtractor}
                    renderItem={null}
                    contentContainerStyle={styles.centered}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={handleRefresh}
                            tintColor={COLORS.primary}
                            colors={[COLORS.primary]}
                        />
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyInner}>
                            <MaterialCommunityIcons
                                name="history"
                                size={64}
                                color={COLORS.text.muted}
                            />
                            <Text style={styles.emptyTitle}>No history yet</Text>
                            <Text style={styles.emptySubtitle}>
                                Episodes you listen to will show up here.
                            </Text>
                        </View>
                    }
                />
            ) : (
                <FlatList
                    data={entries}
                    keyExtractor={keyExtractor}
                    renderItem={renderItem}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                    onEndReached={handleLoadMore}
                    onEndReachedThreshold={0.4}
                    // FIX #2: pull-to-refresh wired up
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={handleRefresh}
                            tintColor={COLORS.primary}
                            colors={[COLORS.primary]}
                        />
                    }
                    ListFooterComponent={ListFooter}
                />
            )}
        </SafeAreaView>
    );
}

// Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂ Styles Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 12,
    },
    backButton: {
        marginRight: 12,
        padding: 4,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: "700",
        color: COLORS.text.primary,
    },
    centered: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 32,
    },
    emptyInner: {
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 32,
        paddingVertical: 80,
    },
    errorText: {
        color: COLORS.error,
        marginTop: 12,
        textAlign: "center",
    },
    retryButton: {
        marginTop: 16,
        backgroundColor: COLORS.panel,
        borderWidth: 1,
        borderColor: COLORS.border,
        paddingHorizontal: 20,
        paddingVertical: 8,
        borderRadius: 12,
    },
    retryText: {
        color: COLORS.text.primary,
    },
    emptyTitle: {
        color: COLORS.text.secondary,
        fontSize: 16,
        marginTop: 16,
        fontWeight: "600",
    },
    emptySubtitle: {
        color: COLORS.text.muted,
        fontSize: 14,
        marginTop: 6,
        textAlign: "center",
    },
    listContent: {
        paddingHorizontal: 16,
        paddingTop: 4,
        paddingBottom: 100,
    },
    // FIX #2 Ã¢ÂÂ load-more footer error
    footerError: {
        alignItems: "center",
        paddingVertical: 12,
        paddingHorizontal: 16,
    },
    footerErrorText: {
        color: COLORS.error,
        fontSize: 13,
        marginBottom: 8,
        textAlign: "center",
    },
    footerRetryButton: {
        backgroundColor: COLORS.panel,
        borderWidth: 1,
        borderColor: COLORS.border,
        paddingHorizontal: 16,
        paddingVertical: 6,
        borderRadius: 10,
    },
    // HistoryRow
    row: {
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
    rowPressable: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
    },
    deleteButton: {
        paddingLeft: 12,
        flexShrink: 0,
    },
    thumbnailWrap: {
        width: 56,
        height: 56,
        borderRadius: 12,
        overflow: "hidden",
        backgroundColor: COLORS.card,
        alignItems: "center",
        justifyContent: "center",
        marginRight: 12,
        flexShrink: 0,
    },
    completedBadge: {
        position: "absolute",
        bottom: 4,
        right: 4,
        width: 18,
        height: 18,
        borderRadius: 9,
        backgroundColor: COLORS.success,
        alignItems: "center",
        justifyContent: "center",
    },
    info: {
        flex: 1,
    },
    title: {
        fontSize: 14,
        fontWeight: "600",
        color: COLORS.text.primary,
        marginBottom: 2,
    },
    meta: {
        fontSize: 12,
        color: COLORS.text.secondary,
        marginBottom: 6,
    },
    progressTrack: {
        height: 3,
        backgroundColor: COLORS.border,
        borderRadius: 2,
        overflow: "hidden",
        marginBottom: 4,
    },
    progressFill: {
        height: "100%",
        backgroundColor: COLORS.primary,
        borderRadius: 2,
    },
    status: {
        fontSize: 11,
        color: COLORS.text.muted,
    },
});
