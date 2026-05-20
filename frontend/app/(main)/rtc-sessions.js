import AsyncStorage from "@react-native-async-storage/async-storage";
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
import apiService from "../../src/services/api/apiService";
import {
    BORDER_RADIUS,
    COLORS,
    FONT_SIZES,
    withTabScreenBottomPadding,
} from "../../src/constants/theme";
import { buildSecondaryScreenOptions } from "../../src/utils/secondaryScreenOptions";
import { buildRtcSessionRecoveryRoute } from "../../src/utils/rtcSessionRoutes";

const PAGE_SIZE = 25;
const STATUS_CHECK_STORAGE_KEY_PREFIX = "@propod/rtc-history-status-check/";
const STATUS_CHECK_MAX_AGE_MS = 24 * 60 * 60 * 1000;

const getStatusCheckStorageKey = (sessionId) => `${STATUS_CHECK_STORAGE_KEY_PREFIX}${sessionId}`;

const getStatusCheckDate = (value) => {
    if (!value) {
        return null;
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return null;
    }

    return date;
};

const isStatusCheckExpired = (value) => {
    const checkedAtDate = getStatusCheckDate(value);

    if (!checkedAtDate) {
        return true;
    }

    const checkedAtTime = checkedAtDate.getTime();
    const ageMs = Date.now() - checkedAtTime;

    return ageMs < 0 || ageMs > STATUS_CHECK_MAX_AGE_MS;
};

const buildStatusCheckEntry = (session, checkedAt) => {
    if (!checkedAt) {
        return null;
    }

    return {
        checkedAt,
        recordingStatus: getRecordingStatus(session),
    };
};

const getValidStatusCheckEntry = (session, statusCheck) => {
    if (!statusCheck) {
        return null;
    }

    const checkedAt = statusCheck?.checkedAt;
    const recordingStatus = statusCheck?.recordingStatus;

    if (
        typeof checkedAt !== "string"
        || !checkedAt
        || typeof recordingStatus !== "string"
        || !recordingStatus
        || isStatusCheckExpired(checkedAt)
        || recordingStatus !== getRecordingStatus(session)
    ) {
        return null;
    }

    return {
        checkedAt,
        recordingStatus,
    };
};

const buildStatusChecksForSessions = (sessions, ...sources) => sessions.reduce((successes, session) => {
    const sessionId = session?.id;

    if (sessionId === null || sessionId === undefined) {
        return successes;
    }

    const matchedStatusCheck = sources.reduce((match, source) => {
        if (match || !source) {
            return match;
        }

        return source[sessionId] || source[String(sessionId)] || null;
    }, null);
    const validStatusCheck = getValidStatusCheckEntry(session, matchedStatusCheck);

    if (!validStatusCheck) {
        return successes;
    }

    return {
        ...successes,
        [sessionId]: validStatusCheck,
    };
}, {});

const buildRefreshingSessionIdsForSessions = (sessions, refreshingSessionIds) => sessions.reduce(
    (nextRefreshingSessionIds, session) => {
        const sessionId = session?.id;

        if (sessionId === null || sessionId === undefined) {
            return nextRefreshingSessionIds;
        }

        if (!refreshingSessionIds?.[sessionId] && !refreshingSessionIds?.[String(sessionId)]) {
            return nextRefreshingSessionIds;
        }

        return {
            ...nextRefreshingSessionIds,
            [sessionId]: true,
        };
    },
    {}
);

const omitStatusChecksForSessions = (statusChecks, sessions) => {
    const loadedSessionIds = new Set(
        sessions
            .map((session) => session?.id)
            .filter((sessionId) => sessionId !== null && sessionId !== undefined)
            .map((sessionId) => String(sessionId))
    );

    return Object.entries(statusChecks || {}).reduce((remainingStatusChecks, [sessionId, statusCheck]) => {
        if (loadedSessionIds.has(String(sessionId))) {
            return remainingStatusChecks;
        }

        return {
            ...remainingStatusChecks,
            [sessionId]: statusCheck,
        };
    }, {});
};

const getPersistedStatusChecksForSessions = async (sessions) => {
    const sessionIds = sessions
        .map((session) => session?.id)
        .filter((sessionId) => sessionId !== null && sessionId !== undefined);

    if (sessionIds.length === 0) {
        return {};
    }

    try {
        const storedEntries = await AsyncStorage.multiGet(
            sessionIds.map((sessionId) => getStatusCheckStorageKey(sessionId))
        );

        const invalidStorageKeys = [];

        const persistedStatusChecks = storedEntries.reduce((successes, [storageKey, rawEntry]) => {
            if (typeof rawEntry !== "string" || !rawEntry) {
                return successes;
            }

            const sessionId = storageKey.replace(STATUS_CHECK_STORAGE_KEY_PREFIX, "");
            const session = sessions.find((candidate) => String(candidate?.id) === sessionId);

            if (!session) {
                invalidStorageKeys.push(storageKey);
                return successes;
            }

            let parsedEntry;

            try {
                parsedEntry = JSON.parse(rawEntry);
            } catch {
                invalidStorageKeys.push(storageKey);
                return successes;
            }

            const checkedAt = parsedEntry?.checkedAt;
            const recordingStatus = parsedEntry?.recordingStatus;

            if (
                typeof checkedAt !== "string"
                || !checkedAt
                || typeof recordingStatus !== "string"
                || !recordingStatus
            ) {
                invalidStorageKeys.push(storageKey);
                return successes;
            }

            if (isStatusCheckExpired(checkedAt)) {
                invalidStorageKeys.push(storageKey);
                return successes;
            }

            if (recordingStatus !== getRecordingStatus(session)) {
                invalidStorageKeys.push(storageKey);
                return successes;
            }

            return {
                ...successes,
                [sessionId]: {
                    checkedAt,
                    recordingStatus,
                },
            };
        }, {});

        if (invalidStorageKeys.length > 0) {
            AsyncStorage.multiRemove(invalidStorageKeys).catch(() => {
                // Ignore cleanup failures so screen loading still succeeds.
            });
        }

        return persistedStatusChecks;
    } catch {
        return {};
    }
};

const persistStatusCheck = async (sessionId, session, checkedAt) => {
    if (sessionId === null || sessionId === undefined) {
        return;
    }

    const statusCheckEntry = buildStatusCheckEntry(session, checkedAt);

    if (!statusCheckEntry) {
        return;
    }

    try {
        await AsyncStorage.setItem(
            getStatusCheckStorageKey(sessionId),
            JSON.stringify(statusCheckEntry)
        );
    } catch {
        // Ignore local persistence failures so status refresh remains usable.
    }
};

const getSessionCountLabel = (count) => (count === 1 ? "1 session" : `${count} sessions`);

const getHeaderSubtitle = (totalSessions) => {
    const baseCopy = "Review recent live sessions and whether each recording is ready.";

    if (!Number.isFinite(totalSessions) || totalSessions <= 0) {
        return baseCopy;
    }

    return `${getSessionCountLabel(totalSessions)} total. ${baseCopy}`;
};

const getHistoryEndCopy = (totalSessions) => {
    if (Number.isFinite(totalSessions) && totalSessions > 0) {
        return `Showing all ${getSessionCountLabel(totalSessions)} in your live recording history.`;
    }

    return "You've reached the end of your live recording history.";
};

const mergeSessionPages = (existingSessions, nextSessions) => {
    const seenSessionIds = new Set(existingSessions.map((session) => session?.id));
    const uniqueNextSessions = nextSessions.filter((session) => {
        if (seenSessionIds.has(session?.id)) {
            return false;
        }

        seenSessionIds.add(session?.id);
        return true;
    });

    return [...existingSessions, ...uniqueNextSessions];
};

const replaceSessionById = (sessions, nextSession) => sessions.map((session) => (
    session?.id === nextSession?.id ? nextSession : session
));

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

const formatStatusCheckTimestamp = (value) => {
    if (isStatusCheckExpired(value)) {
        return null;
    }

    const date = getStatusCheckDate(value);

    if (Date.now() - date.getTime() < 60 * 1000) {
        return "just now";
    }

    return formatSessionTimestamp(value);
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

const getRecordingStatus = (session) => session?.recording_status || session?.recording_state || (session?.is_live ? "live" : "waiting");

const getStatusCheckFeedback = (session, statusCheck) => {
    const checkedLabel = formatStatusCheckTimestamp(statusCheck?.checkedAt);

    if (!checkedLabel) {
        return null;
    }

    const recordingStatus = statusCheck?.recordingStatus || getRecordingStatus(session);

    if (recordingStatus === "completed") {
        return `Checked ${checkedLabel}. Podcast is ready.`;
    }

    if (recordingStatus === "failed") {
        return `Checked ${checkedLabel}. Recording needs attention.`;
    }

    if (recordingStatus === "live") {
        return `Checked ${checkedLabel}. Session is live now.`;
    }

    if (recordingStatus === "processing") {
        return `Checked ${checkedLabel}. Recording is still processing.`;
    }

    return `Checked ${checkedLabel}. Session is waiting to start.`;
};

const getStatusPresentation = (session) => {
    const recordingStatus = getRecordingStatus(session);

    if (recordingStatus === "live") {
        return {
            label: "Live now",
            toneColor: COLORS.success,
            backgroundColor: "rgba(16,185,129,0.14)",
            detail: "Session is currently in progress.",
        };
    }

    if (recordingStatus === "completed") {
        return {
            label: "Podcast ready",
            toneColor: COLORS.primary,
            backgroundColor: "rgba(211,47,47,0.14)",
            detail: "Recording finished and is available in your library.",
        };
    }

    if (recordingStatus === "processing") {
        return {
            label: "Processing recording",
            toneColor: COLORS.warning,
            backgroundColor: "rgba(245,158,11,0.14)",
            detail: "Recording has ended and is still being prepared.",
        };
    }

    if (recordingStatus === "failed") {
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

const SessionCard = ({
    highlighted,
    onCheckSessionStatus,
    onOpenPodcast,
    onRestartSession,
    refreshError,
    refreshSuccess,
    session,
    statusRefreshInFlight,
}) => {
    const status = getStatusPresentation(session);
    const statusCheckFeedback = getStatusCheckFeedback(session, refreshSuccess);
    const recordingStatus = getRecordingStatus(session);
    const hasPodcast = recordingStatus === "completed" && Boolean(session?.podcast_id);
    const canCheckStatus = recordingStatus === "processing";
    const canRestartSession = recordingStatus === "failed";
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

            {refreshError && (
                <Text style={styles.sessionErrorText}>{refreshError}</Text>
            )}

            {!refreshError && statusCheckFeedback && (
                <Text style={styles.sessionFeedbackText}>{statusCheckFeedback}</Text>
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

            {canCheckStatus && (
                <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel={`Check recording status for ${session?.title || session?.room_name || "live session"}`}
                    disabled={statusRefreshInFlight}
                    onPress={() => onCheckSessionStatus(session)}
                    style={[
                        styles.secondaryButton,
                        statusRefreshInFlight && styles.secondaryButtonDisabled,
                    ]}
                >
                    <Text style={styles.secondaryButtonText}>
                        {statusRefreshInFlight ? "Checking..." : "Check Status"}
                    </Text>
                </TouchableOpacity>
            )}

            {canRestartSession && (
                <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel={`Start a similar session for ${session?.title || session?.room_name || "live session"}`}
                    onPress={() => onRestartSession(session)}
                    style={styles.secondaryButton}
                >
                    <Text style={styles.secondaryButtonText}>Use Same Setup</Text>
                </TouchableOpacity>
            )}
        </View>
    );
};

export default function RtcSessionsScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const focusSessionId = Number.parseInt(params?.focusSessionId, 10);

    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState(null);
    const [paginationError, setPaginationError] = useState(null);
    const [hasMore, setHasMore] = useState(false);
    const [totalSessions, setTotalSessions] = useState(null);
    const [refreshingSessionIds, setRefreshingSessionIds] = useState({});
    const [sessionRefreshErrors, setSessionRefreshErrors] = useState({});
    const [sessionRefreshSuccesses, setSessionRefreshSuccesses] = useState({});

    const loadSessions = useCallback(async ({ isRefresh = false } = {}) => {
        if (isRefresh) {
            setRefreshing(true);
        } else {
            setLoading(true);
        }

        try {
            const response = await apiService.listRtcSessions({ limit: PAGE_SIZE, offset: 0 });
            const persistedStatusChecks = await getPersistedStatusChecksForSessions(response.sessions);
            setSessions(response.sessions);
            setHasMore(response.has_more);
            setTotalSessions(response.total);
            setRefreshingSessionIds((currentIds) => buildRefreshingSessionIdsForSessions(
                response.sessions,
                currentIds
            ));
            setSessionRefreshErrors({});
            setSessionRefreshSuccesses((currentSuccesses) => buildStatusChecksForSessions(
                response.sessions,
                currentSuccesses,
                persistedStatusChecks
            ));
            setError(null);
            setPaginationError(null);
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

    const loadMoreSessions = useCallback(async () => {
        if (loading || loadingMore || refreshing || !hasMore) {
            return;
        }

        setLoadingMore(true);
        setPaginationError(null);

        try {
            const response = await apiService.listRtcSessions({
                limit: PAGE_SIZE,
                offset: sessions.length,
            });
            const persistedStatusChecks = await getPersistedStatusChecksForSessions(response.sessions);

            setSessions((currentSessions) => mergeSessionPages(currentSessions, response.sessions));
            setHasMore(response.has_more);
            setTotalSessions(response.total);
            setSessionRefreshSuccesses((currentSuccesses) => ({
                ...omitStatusChecksForSessions(currentSuccesses, response.sessions),
                ...buildStatusChecksForSessions(
                    response.sessions,
                    currentSuccesses,
                    persistedStatusChecks
                ),
            }));
        } catch (loadError) {
            setPaginationError(loadError?.message || "Could not load more live sessions.");
        } finally {
            setLoadingMore(false);
        }
    }, [hasMore, loading, loadingMore, refreshing, sessions.length]);

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

    const handleRestartSession = useCallback(
        (session) => {
            router.push(buildRtcSessionRecoveryRoute(session));
        },
        [router]
    );

    const handleCheckSessionStatus = useCallback(async (session) => {
        if (!session?.id) {
            return;
        }

        setRefreshingSessionIds((currentIds) => ({
            ...currentIds,
            [session.id]: true,
        }));
        setSessionRefreshErrors((currentErrors) => {
            if (!currentErrors[session.id]) {
                return currentErrors;
            }

            const nextErrors = { ...currentErrors };
            delete nextErrors[session.id];
            return nextErrors;
        });
        setSessionRefreshSuccesses((currentSuccesses) => {
            if (!currentSuccesses[session.id]) {
                return currentSuccesses;
            }

            const nextSuccesses = { ...currentSuccesses };
            delete nextSuccesses[session.id];
            return nextSuccesses;
        });

        try {
            const nextSession = await apiService.getRtcSession(session.id);
            const checkedAt = new Date().toISOString();
            const statusCheckEntry = buildStatusCheckEntry(nextSession, checkedAt);
            setSessions((currentSessions) => replaceSessionById(currentSessions, nextSession));
            setSessionRefreshSuccesses((currentSuccesses) => ({
                ...currentSuccesses,
                [session.id]: statusCheckEntry,
            }));
            persistStatusCheck(session.id, nextSession, checkedAt);
        } catch (refreshError) {
            setSessionRefreshErrors((currentErrors) => ({
                ...currentErrors,
                [session.id]: refreshError?.message || "Could not refresh live session status.",
            }));
        } finally {
            setRefreshingSessionIds((currentIds) => {
                const nextIds = { ...currentIds };
                delete nextIds[session.id];
                return nextIds;
            });
        }
    }, []);

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

    const renderFooter = () => {
        if (error) {
            return (
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
            );
        }

        if (loadingMore) {
            return (
                <View style={styles.footerLoading}>
                    <ActivityIndicator size="small" color={COLORS.primary} />
                    <Text style={styles.footerLoadingText}>Loading more sessions...</Text>
                </View>
            );
        }

        if (paginationError) {
            return (
                <View style={styles.errorCard}>
                    <Text style={styles.errorTitle}>Couldn&apos;t load more sessions.</Text>
                    <Text style={styles.errorBody}>{paginationError}</Text>
                    <TouchableOpacity
                        onPress={loadMoreSessions}
                        style={styles.retryButton}
                    >
                        <Text style={styles.retryButtonText}>Try Again</Text>
                    </TouchableOpacity>
                </View>
            );
        }

        if (hasMore && sessions.length > 0) {
            return (
                <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel="Load more live sessions"
                    disabled={refreshing}
                    onPress={loadMoreSessions}
                    style={styles.loadMoreButton}
                >
                    <Text style={styles.loadMoreButtonText}>Load More Sessions</Text>
                </TouchableOpacity>
            );
        }

        if (sessions.length > 0) {
            return (
                <View style={styles.footerSummary}>
                    <Text style={styles.footerSummaryTitle}>You&apos;re all caught up</Text>
                    <Text style={styles.footerSummaryBody}>{getHistoryEndCopy(totalSessions)}</Text>
                </View>
            );
        }

        return null;
    };

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
                        onCheckSessionStatus={handleCheckSessionStatus}
                        onOpenPodcast={handleOpenPodcast}
                        onRestartSession={handleRestartSession}
                        refreshError={sessionRefreshErrors[item.id]}
                        refreshSuccess={sessionRefreshSuccesses[item.id]}
                        session={item}
                        statusRefreshInFlight={Boolean(refreshingSessionIds[item.id])}
                    />
                )}
                contentContainerStyle={withTabScreenBottomPadding([
                    styles.content,
                    sessions.length === 0 && !loading && styles.contentEmpty,
                ])}
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
                            {getHeaderSubtitle(totalSessions)}
                        </Text>
                    </View>
                }
                ListEmptyComponent={!loading && !error ? renderEmptyState : null}
                ListFooterComponent={renderFooter}
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
    sessionErrorText: {
        marginTop: 14,
        color: COLORS.error,
        fontSize: FONT_SIZES.sm,
        lineHeight: 20,
    },
    sessionFeedbackText: {
        marginTop: 14,
        color: COLORS.text.muted,
        fontSize: FONT_SIZES.sm,
        lineHeight: 20,
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
    secondaryButton: {
        marginTop: 14,
        borderRadius: BORDER_RADIUS.md,
        borderWidth: 1,
        borderColor: COLORS.border,
        paddingVertical: 12,
        alignItems: "center",
    },
    secondaryButtonDisabled: {
        opacity: 0.65,
    },
    secondaryButtonText: {
        color: COLORS.text.secondary,
        fontSize: FONT_SIZES.base,
        fontWeight: "600",
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
    loadMoreButton: {
        marginTop: 6,
        borderRadius: BORDER_RADIUS.md,
        borderWidth: 1,
        borderColor: COLORS.primary,
        paddingVertical: 12,
        alignItems: "center",
    },
    loadMoreButtonText: {
        color: COLORS.text.primary,
        fontSize: FONT_SIZES.base,
        fontWeight: "600",
    },
    footerLoading: {
        marginTop: 6,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        paddingVertical: 12,
    },
    footerLoadingText: {
        color: COLORS.text.secondary,
        fontSize: FONT_SIZES.sm,
    },
    footerSummary: {
        marginTop: 6,
        borderRadius: BORDER_RADIUS.lg,
        borderWidth: 1,
        borderColor: COLORS.border,
        backgroundColor: COLORS.card,
        padding: 16,
        gap: 6,
    },
    footerSummaryTitle: {
        color: COLORS.text.primary,
        fontSize: FONT_SIZES.base,
        fontWeight: "600",
    },
    footerSummaryBody: {
        color: COLORS.text.secondary,
        fontSize: FONT_SIZES.sm,
        lineHeight: 20,
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