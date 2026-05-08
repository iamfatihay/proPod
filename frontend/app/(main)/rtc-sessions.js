import React, { useCallback, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    RefreshControl,
    SafeAreaView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import apiService from "../../src/services/api/apiService";
import { BORDER_RADIUS, COLORS, FONT_SIZES } from "../../src/constants/theme";
import { buildSecondaryScreenOptions } from "../../src/utils/secondaryScreenOptions";

const PAGE_SIZE = 25;

const formatSessionTimestamp = (value) => {
    if (!value) {
        return "Unknown time";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "Unknown time";
    }

    return date.toLocaleString([], {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
    });
};

const formatDuration = (seconds) => {
    if (!seconds) {
        return "0m";
    }

    const totalMinutes = Math.floor(seconds / 60);

    if (totalMinutes < 60) {
        return `${totalMinutes}m`;
    }

    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
};

const getStatusPresentation = (session) => {
    if (session?.is_live) {
        return {
            label: "Live now",
            toneColor: COLORS.success,
            backgroundColor: "rgba(16,185,129,0.14)",
            detail: "Session is currently in progress.",
        };
    }

    if (session?.podcast_id) {
        return {
            label: "Podcast ready",
            toneColor: COLORS.primary,
            backgroundColor: "rgba(211,47,47,0.14)",
            detail: "Recording finished and is available in your library.",
        };
    }

    if (session?.status === "ended" || session?.status === "completed") {
        return {
            label: "Processing recording",
            toneColor: COLORS.warning,
            backgroundColor: "rgba(245,158,11,0.14)",
            detail: "Recording has ended and is still being prepared.",
        };
    }

    if (session?.status === "failed") {
        return {
            label: "Needs attention",
            toneColor: COLORS.error,
            backgroundColor: "rgba(239,68,68,0.14)",
            detail: "The recording did not finish cleanly.",
        };
    }

    return {
        label: "Lobby ready",
        toneColor: COLORS.text.secondary,
        backgroundColor: "rgba(255,255,255,0.08)",
        detail: "Session was created but has not gone live yet.",
    };
};

const SessionCard = ({ highlighted, onOpenPodcast, session }) => {
    const status = getStatusPresentation(session);
    const hasPodcast = Boolean(session?.podcast_id);
    const participantCount = session?.participant_count ?? 0;
    const participantLabel = participantCount === 0
        ? "No participants"
        : `${participantCount} joined`;
    const mediaModeLabel = session?.media_mode === "video" ? "Video" : "Audio";

    return (
        <View
            style={[
                styles.card,
                highlighted && styles.cardHighlighted,
            ]}
        >
            <View style={styles.cardHeader}>
                <View style={styles.cardTitleWrap}>
                    <Text style={styles.cardTitle} numberOfLines={2}>
                        {session?.title || session?.room_name || "Untitled live session"}
                    </Text>
                    <Text style={styles.cardTimestamp}>
                        {formatSessionTimestamp(session?.created_at)}
                    </Text>
                </View>

                <View
                    style={[
                        styles.statusBadge,
                        { backgroundColor: status.backgroundColor },
                    ]}
                >
                    <Text style={[styles.statusBadgeText, { color: status.toneColor }]}>
                        {status.label}
                    </Text>
                </View>
            </View>

            {highlighted && (
                <View style={styles.highlightRow}>
                    <MaterialCommunityIcons
                        name="star-four-points"
                        size={14}
                        color={COLORS.primary}
                    />
                    <Text style={styles.highlightText}>Latest session</Text>
                </View>
            )}

            <Text style={styles.cardDescription}>{status.detail}</Text>

            <View style={styles.metaRow}>
                <View style={styles.metaItem}>
                    <MaterialCommunityIcons
                        name={session?.media_mode === "video" ? "video-outline" : "microphone-outline"}
                        size={18}
                        color={COLORS.text.secondary}
                    />
                    <Text style={styles.metaText}>{mediaModeLabel}</Text>
                </View>

                <View style={styles.metaItem}>
                    <MaterialCommunityIcons
                        name="account-multiple-outline"
                        size={18}
                        color={COLORS.text.secondary}
                    />
                    <Text style={styles.metaText}>{participantLabel}</Text>
                </View>

                <View style={styles.metaItem}>
                    <MaterialCommunityIcons
                        name="clock-time-four-outline"
                        size={18}
                        color={COLORS.text.secondary}
                    />
                    <Text style={styles.metaText}>{formatDuration(session?.duration_seconds)}</Text>
                </View>
            </View>

            {session?.invite_code && !hasPodcast && (
                <Text style={styles.inviteCodeText}>Invite code: {session.invite_code}</Text>
            )}

            {hasPodcast && (
                <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel={`Open podcast for ${session?.title || session?.room_name || "live session"}`}
                    onPress={() => onOpenPodcast(session)}
                    style={styles.openButton}
                >
                    <Text style={styles.openButtonText}>Open Podcast</Text>
                </TouchableOpacity>
            )}
        </View>
    );
};

export default function RtcSessionsScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const params = useLocalSearchParams();
    const focusSessionId = Number.parseInt(params?.focusSessionId, 10);

    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState(null);

    const loadSessions = useCallback(async ({ isRefresh = false } = {}) => {
        if (isRefresh) {
            setRefreshing(true);
        } else {
            setLoading(true);
        }

        try {
            const response = await apiService.listRtcSessions({ limit: PAGE_SIZE });
            setSessions(Array.isArray(response) ? response : []);
            setError(null);
        } catch (loadError) {
            setError(loadError?.message || "Could not load live sessions.");
        } finally {
            if (isRefresh) {
                setRefreshing(false);
            } else {
                setLoading(false);
            }
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            loadSessions();
        }, [loadSessions])
    );

    const handleOpenPodcast = useCallback(
        (session) => {
            if (!session?.podcast_id) {
                return;
            }

            router.push({
                pathname: "/(main)/details",
                params: { id: String(session.podcast_id) },
            });
        },
        [router]
    );

    const renderEmptyState = () => (
        <View style={styles.emptyState}>
            <MaterialCommunityIcons
                name="broadcast-off"
                size={34}
                color={COLORS.text.muted}
            />
            <Text style={styles.emptyTitle}>No live sessions yet</Text>
            <Text style={styles.emptySubtitle}>
                Start a multi-host live session from Create to track recording progress here.
            </Text>
        </View>
    );

    return (
        <SafeAreaView style={styles.screen}>
            <Stack.Screen
                options={buildSecondaryScreenOptions({
                    router,
                    title: "Live Sessions",
                    backgroundColor: COLORS.background,
                })}
            />

            <FlatList
                data={sessions}
                keyExtractor={(item) => String(item.id)}
                renderItem={({ item }) => (
                    <SessionCard
                        highlighted={Number.isInteger(focusSessionId) && item.id === focusSessionId}
                        onOpenPodcast={handleOpenPodcast}
                        session={item}
                    />
                )}
                contentContainerStyle={[
                    styles.content,
                    sessions.length === 0 && !loading && styles.contentEmpty,
                    { paddingBottom: Math.max(insets.bottom, 16) + 24 },
                ]}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={() => loadSessions({ isRefresh: true })}
                        tintColor={COLORS.primary}
                    />
                }
                ListHeaderComponent={
                    <View style={styles.headerBlock}>
                        <Text style={styles.headerTitle}>Recent Live Sessions</Text>
                        <Text style={styles.headerSubtitle}>
                            Review recent live sessions and whether each recording is ready.
                        </Text>
                    </View>
                }
                ListEmptyComponent={!loading && !error ? renderEmptyState : null}
                ListFooterComponent={
                    error ? (
                        <View style={styles.errorCard}>
                            <Text style={styles.errorTitle}>Couldn&apos;t load live sessions.</Text>
                            <Text style={styles.errorBody}>{error}</Text>
                            <TouchableOpacity
                                onPress={() => loadSessions()}
                                style={styles.retryButton}
                            >
                                <Text style={styles.retryButtonText}>Try Again</Text>
                            </TouchableOpacity>
                        </View>
                    ) : null
                }
            />

            {loading && (
                <View style={styles.loadingOverlay}>
                    <ActivityIndicator size="large" color={COLORS.primary} />
                    <Text style={styles.loadingText}>Loading live sessions...</Text>
                </View>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    content: {
        paddingHorizontal: 20,
        paddingTop: 20,
        gap: 14,
    },
    contentEmpty: {
        flexGrow: 1,
    },
    headerBlock: {
        marginBottom: 4,
    },
    headerTitle: {
        color: COLORS.text.primary,
        fontSize: FONT_SIZES.xl,
        fontWeight: "700",
        marginBottom: 6,
    },
    headerSubtitle: {
        color: COLORS.text.secondary,
        fontSize: FONT_SIZES.base,
        lineHeight: 22,
    },
    card: {
        backgroundColor: COLORS.card,
        borderRadius: BORDER_RADIUS.lg,
        borderWidth: 1,
        borderColor: COLORS.border,
        padding: 16,
    },
    cardHighlighted: {
        borderColor: COLORS.primary,
        shadowColor: COLORS.primary,
        shadowOpacity: 0.16,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
        elevation: 2,
    },
    cardHeader: {
        flexDirection: "row",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 12,
    },
    cardTitleWrap: {
        flex: 1,
    },
    cardTitle: {
        color: COLORS.text.primary,
        fontSize: FONT_SIZES.lg,
        fontWeight: "600",
        marginBottom: 6,
    },
    cardTimestamp: {
        color: COLORS.text.muted,
        fontSize: FONT_SIZES.sm,
    },
    statusBadge: {
        borderRadius: BORDER_RADIUS.full,
        paddingHorizontal: 10,
        paddingVertical: 6,
    },
    statusBadgeText: {
        fontSize: FONT_SIZES.sm,
        fontWeight: "600",
    },
    highlightRow: {
        marginTop: 12,
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
    },
    highlightText: {
        color: COLORS.primary,
        fontSize: FONT_SIZES.sm,
        fontWeight: "600",
    },
    cardDescription: {
        marginTop: 12,
        color: COLORS.text.secondary,
        fontSize: FONT_SIZES.base,
        lineHeight: 21,
    },
    metaRow: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 12,
        marginTop: 14,
    },
    metaItem: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
    },
    metaText: {
        color: COLORS.text.secondary,
        fontSize: FONT_SIZES.sm,
    },
    inviteCodeText: {
        marginTop: 14,
        color: COLORS.text.muted,
        fontSize: FONT_SIZES.sm,
    },
    openButton: {
        marginTop: 16,
        borderRadius: BORDER_RADIUS.md,
        backgroundColor: COLORS.primary,
        paddingVertical: 12,
        alignItems: "center",
    },
    openButtonText: {
        color: "#FFFFFF",
        fontSize: FONT_SIZES.base,
        fontWeight: "600",
    },
    emptyState: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 32,
        paddingBottom: 40,
    },
    emptyTitle: {
        color: COLORS.text.primary,
        fontSize: FONT_SIZES.lg,
        fontWeight: "600",
        marginTop: 14,
        marginBottom: 8,
    },
    emptySubtitle: {
        color: COLORS.text.secondary,
        fontSize: FONT_SIZES.base,
        lineHeight: 22,
        textAlign: "center",
    },
    errorCard: {
        marginTop: 20,
        borderRadius: BORDER_RADIUS.lg,
        borderWidth: 1,
        borderColor: "rgba(239,68,68,0.24)",
        backgroundColor: "rgba(239,68,68,0.08)",
        padding: 16,
    },
    errorTitle: {
        color: COLORS.error,
        fontSize: FONT_SIZES.base,
        fontWeight: "600",
        marginBottom: 6,
    },
    errorBody: {
        color: COLORS.text.secondary,
        fontSize: FONT_SIZES.sm,
        lineHeight: 20,
    },
    retryButton: {
        marginTop: 14,
        borderRadius: BORDER_RADIUS.md,
        borderWidth: 1,
        borderColor: COLORS.primary,
        paddingVertical: 10,
        alignItems: "center",
    },
    retryButtonText: {
        color: COLORS.text.primary,
        fontSize: FONT_SIZES.base,
        fontWeight: "600",
    },
    loadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(0,0,0,0.45)",
        gap: 12,
    },
    loadingText: {
        color: COLORS.text.primary,
        fontSize: FONT_SIZES.base,
    },
});