/**
 * messages.js — DM Inbox screen
 *
 * Shows one thread entry per conversation partner, sorted by most-recent
 * message first. Tapping a thread opens chat-details.js with that partner.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
    View,
    Text,
    FlatList,
    SafeAreaView,
    StatusBar,
    Platform,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl,
} from "react-native";
import { Stack, useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, FONT_SIZES, BORDER_RADIUS, withTabScreenBottomPadding } from "../../src/constants/theme";
import apiService from "../../src/services/api/apiService";
import useDMStore from "../../src/context/useDMStore";
import { formatTimeAgo } from "../../src/utils/formatTimeAgo";

// ─── Thread row ───────────────────────────────────────────────────────────────

const ThreadRow = ({ item, onPress }) => (
    <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.7}
        style={{
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: COLORS.card,
            paddingHorizontal: 18,
            paddingVertical: 16,
            borderRadius: BORDER_RADIUS.lg,
            marginBottom: 12,
        }}
    >
        <View
            style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                backgroundColor: "rgba(59,130,246,0.14)",
                alignItems: "center",
                justifyContent: "center",
                marginRight: 14,
            }}
        >
            <Ionicons name="person-outline" size={22} color="#3B82F6" />
        </View>

        <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 3 }}>
                <Text
                    style={{
                        color: COLORS.text.primary,
                        fontSize: FONT_SIZES.md,
                        fontWeight: "700",
                        flex: 1,
                    }}
                >
                    {item.partner_name}
                </Text>
                {item.unread_count > 0 && (
                    <View
                        style={{
                            backgroundColor: COLORS.primary,
                            borderRadius: 10,
                            minWidth: 20,
                            height: 20,
                            alignItems: "center",
                            justifyContent: "center",
                            paddingHorizontal: 5,
                        }}
                    >
                        <Text
                            style={{
                                color: "#fff",
                                fontSize: FONT_SIZES.xs,
                                fontWeight: "700",
                            }}
                        >
                            {item.unread_count}
                        </Text>
                    </View>
                )}
            </View>
            <Text
                style={{
                    color:
                        item.unread_count > 0 ? COLORS.text.primary : COLORS.text.secondary,
                    fontSize: FONT_SIZES.base,
                    fontWeight: item.unread_count > 0 ? "600" : "400",
                }}
                numberOfLines={1}
            >
                {item.last_message_body}
            </Text>
        </View>

        <Text
            style={{ color: COLORS.text.muted, fontSize: FONT_SIZES.sm, marginLeft: 8 }}
        >
            {formatTimeAgo(item.last_message_at)}
        </Text>
    </TouchableOpacity>
);

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function MessagesScreen() {
    const router = useRouter();
    const hasLoadedInboxRef = useRef(false);
    const inboxRequestIdRef = useRef(0);
    const threadsRef = useRef([]);
    const [threads, setThreads] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState(null);

    // Clear the tab-bar badge the moment the user opens the inbox
    const resetDMUnread = useDMStore((state) => state.resetDMUnread);

    useEffect(() => {
        threadsRef.current = threads;
    }, [threads]);

    const loadInbox = useCallback(async ({ isRefresh = false, signal = { cancelled: false } } = {}) => {
        const requestId = inboxRequestIdRef.current + 1;
        inboxRequestIdRef.current = requestId;

        if (isRefresh) {
            setRefreshing(true);
        } else {
            setLoading(true);
        }

        if (!isRefresh || threadsRef.current.length === 0) {
            setError(null);
        }

        try {
            const data = await apiService.getDMInbox();
            if (signal.cancelled || inboxRequestIdRef.current !== requestId) return;
            setThreads(data.threads || []);
            setError(null);
        } catch (err) {
            if (signal.cancelled || inboxRequestIdRef.current !== requestId) return;
            setError(err?.detail || err?.message || "Failed to load messages");
        } finally {
            if (!signal.cancelled) {
                hasLoadedInboxRef.current = true;
            }

            if (inboxRequestIdRef.current !== requestId) {
                return;
            }

            if (isRefresh) {
                setRefreshing(false);
            } else {
                setLoading(false);
            }
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            // Immediately clear badge when user focuses the Messages screen
            resetDMUnread();

            const signal = { cancelled: false };
            loadInbox({ signal, isRefresh: hasLoadedInboxRef.current });
            return () => {
                signal.cancelled = true;
            };
        }, [loadInbox, resetDMUnread])
    );

    const onRefresh = useCallback(async () => {
        await loadInbox({ isRefresh: true });
    }, [loadInbox]);

    const handleRetry = useCallback(() => {
        loadInbox({ isRefresh: threads.length > 0 });
    }, [loadInbox, threads.length]);

    const hasThreads = threads.length > 0;
    const showInlineError = Boolean(error) && hasThreads;
    const isRetryingInlineError = showInlineError && refreshing;

    const handlePress = useCallback(
        (thread) => {
            router.push({
                pathname: "/(main)/chat-details",
                params: {
                    partnerId: String(thread.partner_id),
                    partnerName: thread.partner_name,
                },
            });
        },
        [router]
    );

    return (
        <SafeAreaView
            style={{
                flex: 1,
                backgroundColor: COLORS.background,
                paddingTop: Platform.OS === "android" ? StatusBar.currentHeight : 0,
            }}
        >
            <Stack.Screen
                options={{
                    title: "Messages",
                    headerShown: false,
                }}
            />

            {loading && !hasThreads ? (
                <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                    <ActivityIndicator color={COLORS.primary} />
                </View>
            ) : error && !hasThreads ? (
                <View style={{ flex: 1, justifyContent: "center", padding: 20 }}>
                    <Text
                        style={{
                            color: COLORS.text.primary,
                            fontSize: FONT_SIZES.lg,
                            fontWeight: "700",
                            marginBottom: 8,
                        }}
                    >
                        Couldn&apos;t load messages.
                    </Text>
                    <Text
                        style={{ color: COLORS.text.secondary, fontSize: FONT_SIZES.base }}
                    >
                        {error}
                    </Text>
                    <TouchableOpacity
                        accessibilityLabel="Retry loading messages"
                        onPress={handleRetry}
                        style={{
                            alignItems: "center",
                            borderColor: COLORS.primary,
                            borderRadius: BORDER_RADIUS.md,
                            borderWidth: 1,
                            marginTop: 16,
                            paddingVertical: 12,
                        }}
                    >
                        <Text
                            style={{
                                color: COLORS.text.primary,
                                fontSize: FONT_SIZES.base,
                                fontWeight: "600",
                            }}
                        >
                            Try Again
                        </Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <FlatList
                    data={threads}
                    keyExtractor={(item) => String(item.partner_id)}
                    contentContainerStyle={withTabScreenBottomPadding({ padding: 20 })}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            tintColor={COLORS.primary}
                        />
                    }
                    renderItem={({ item }) => (
                        <ThreadRow item={item} onPress={() => handlePress(item)} />
                    )}
                    ListHeaderComponent={
                        <View style={{ marginBottom: 20 }}>
                            <Text
                                style={{
                                    color: COLORS.text.primary,
                                    fontSize: FONT_SIZES.xl,
                                    fontWeight: "700",
                                    marginBottom: 6,
                                }}
                            >
                                Direct Messages
                            </Text>
                            <Text
                                style={{
                                    color: COLORS.text.secondary,
                                    fontSize: FONT_SIZES.base,
                                }}
                            >
                                Your private conversations with other users.
                            </Text>

                            {showInlineError && (
                                <View
                                    style={{
                                        backgroundColor: "rgba(239,68,68,0.08)",
                                        borderColor: "rgba(239,68,68,0.24)",
                                        borderRadius: BORDER_RADIUS.lg,
                                        borderWidth: 1,
                                        marginTop: 16,
                                        padding: 16,
                                    }}
                                >
                                    <Text
                                        style={{
                                            color: COLORS.error,
                                            fontSize: FONT_SIZES.base,
                                            fontWeight: "600",
                                            marginBottom: 6,
                                        }}
                                    >
                                        Couldn&apos;t refresh messages.
                                    </Text>
                                    <Text
                                        style={{
                                            color: COLORS.text.secondary,
                                            fontSize: FONT_SIZES.sm,
                                            lineHeight: 20,
                                        }}
                                    >
                                        {error}
                                    </Text>
                                    <TouchableOpacity
                                        accessibilityLabel="Retry refreshing messages"
                                        accessibilityState={{ disabled: isRetryingInlineError }}
                                        disabled={isRetryingInlineError}
                                        onPress={handleRetry}
                                        style={{
                                            alignItems: "center",
                                            borderColor: COLORS.primary,
                                            borderRadius: BORDER_RADIUS.md,
                                            borderWidth: 1,
                                            marginTop: 14,
                                            opacity: isRetryingInlineError ? 0.65 : 1,
                                            paddingVertical: 10,
                                        }}
                                    >
                                        <Text
                                            style={{
                                                color: COLORS.text.primary,
                                                fontSize: FONT_SIZES.base,
                                                fontWeight: "600",
                                            }}
                                        >
                                            {isRetryingInlineError ? "Retrying..." : "Retry"}
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            )}
                        </View>
                    }
                    ListEmptyComponent={
                        <View
                            style={{
                                alignItems: "center",
                                justifyContent: "center",
                                paddingTop: 60,
                            }}
                        >
                            <Ionicons
                                name="chatbubbles-outline"
                                size={48}
                                color={COLORS.text.muted}
                            />
                            <Text
                                style={{
                                    color: COLORS.text.secondary,
                                    fontSize: FONT_SIZES.base,
                                    marginTop: 12,
                                    textAlign: "center",
                                }}
                            >
                                {"No conversations yet.\nSend a message from a creator profile!"}
                            </Text>
                        </View>
                    }
                />
            )}
        </SafeAreaView>
    );
}
