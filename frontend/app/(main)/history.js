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
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import apiService from "../../src/services/api/apiService";
import { normalizePodcast } from "../../src/utils/urlHelper";
import { COLORS } from "../../src/constants/theme";

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

// ─── History Row ──────────────────────────────────────────────────────────────

const HistoryRow = React.memo(function HistoryRow({ entry, onPress }) {
    const podcast = entry.podcast;
    if (!podcast) return null;

    const durationSec = podcast.duration || 0;
    const positionSec = entry.position || 0;
    const progressPercent =
        durationSec > 0
            ? Math.min(100, Math.round((positionSec / durationSec) * 100))
            : 0;
    const completed = entry.completed || progressPercent >= 95;

    return (
        <TouchableOpacity
            onPress={onPress}
            activeOpacity={0.8}
            style={styles.row}
            accessibilityLabel={`${podcast.title}, ${progressPercent}% listened`}
        >
            {/* Thumbnail */}
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
                    {podcast.owner?.name || "Unknown"} ·{" "}
                    {formatDuration(durationSec)}
                </Text>

                {/* Progress bar — only for in-progress episodes */}
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
                    {"  ·  "}
                    {formatRelativeTime(entry.updated_at)}
                </Text>
            </View>
        </TouchableOpacity>
    );
}, (prev, next) => prev.entry.id === next.entry.id);

// ─── Main Screen ──────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

export default function HistoryScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();

    const [entries, setEntries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
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

    // Reload whenever screen comes into focus
    useFocusEffect(
        useCallback(() => {
            let active = true;
            setLoading(true);
            setCurrentSkip(0);
            setHasMore(true);
            fetchPage(0)
                .then((normalized) => {
                    if (!active) return;
                    setEntries(normalized);
                    setCurrentSkip(normalized.length);
                    setHasMore(normalized.length === PAGE_SIZE);
                    setError(null);
                })
                .catch((e) => {
                    if (active)
                        setError(e?.detail || e?.message || "Failed to load history");
                })
                .finally(() => {
                    if (active) setLoading(false);
                });
            return () => {
                active = false;
            };
        }, [fetchPage])
    );

    const handleLoadMore = useCallback(async () => {
        if (loadingMore || !hasMore) return;
        setLoadingMore(true);
        try {
            const normalized = await fetchPage(currentSkip);
            setEntries((prev) => [...prev, ...normalized]);
            setCurrentSkip((s) => s + normalized.length);
            setHasMore(normalized.length === PAGE_SIZE);
        } catch (e) {
            // Silently ignore load-more failures — user can pull to refresh
        } finally {
            setLoadingMore(false);
        }
    }, [loadingMore, hasMore, currentSkip, fetchPage]);

    const handleRetry = useCallback(() => {
        setLoading(true);
        setCurrentSkip(0);
        setHasMore(true);
        fetchPage(0)
            .then((normalized) => {
                setEntries(normalized);
                setCurrentSkip(normalized.length);
                setHasMore(normalized.length === PAGE_SIZE);
                setError(null);
            })
            .catch((e) => {
                setError(e?.detail || e?.message || "Failed to load history");
            })
            .finally(() => setLoading(false));
    }, [fetchPage]);

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

    const renderItem = useCallback(
        ({ item }) => (
            <HistoryRow entry={item} onPress={() => handlePress(item)} />
        ),
        [handlePress]
    );

    const keyExtractor = useCallback((item) => String(item.id), []);

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
                <View style={styles.centered}>
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
            ) : (
                <FlatList
                    data={entries}
                    keyExtractor={keyExtractor}
                    renderItem={renderItem}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                    onEndReached={handleLoadMore}
                    onEndReachedThreshold={0.4}
                    ListFooterComponent={
                        loadingMore ? (
                            <ActivityIndicator
                                color={COLORS.primary}
                                style={{ marginVertical: 16 }}
                            />
                        ) : null
                    }
                />
            )}
        </SafeAreaView>
    );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

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
