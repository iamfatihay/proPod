/**
 * chat-details.js — Direct Message conversation screen
 *
 * Displays the 1-on-1 message thread between the current user and a partner.
 * Navigated to from messages.js (DM inbox) or from creator-profile.js via
 * the "Message" button.
 *
 * Expected route params:
 *   - partnerId   {string}  ID of the conversation partner
 *   - partnerName {string}  Display name of the partner
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    KeyboardAvoidingView,
    Platform,
    SafeAreaView,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { BORDER_RADIUS, COLORS, FONT_SIZES } from "../../src/constants/theme";
import apiService from "../../src/services/api/apiService";
import { buildSecondaryScreenOptions } from "../../src/utils/secondaryScreenOptions";
import { useAuthStore } from "../../src/context/useAuthStore";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatMessageTime = (isoString) => {
    if (!isoString) return "";
    const date = new Date(isoString);
    const now = new Date();
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
        return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) {
        return date.toLocaleDateString([], { weekday: "short" });
    }
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
};

// ─── Message bubble ───────────────────────────────────────────────────────────

const MessageBubble = ({ message, isMine }) => (
    <View
        style={{
            alignSelf: isMine ? "flex-end" : "flex-start",
            maxWidth: "80%",
            marginBottom: 8,
        }}
    >
        <View
            style={{
                backgroundColor: isMine ? COLORS.primary : COLORS.card,
                borderRadius: BORDER_RADIUS.lg,
                borderBottomRightRadius: isMine ? 4 : BORDER_RADIUS.lg,
                borderBottomLeftRadius: isMine ? BORDER_RADIUS.lg : 4,
                paddingHorizontal: 14,
                paddingVertical: 10,
            }}
        >
            <Text
                style={{
                    color: isMine ? "#FFFFFF" : COLORS.text.primary,
                    fontSize: FONT_SIZES.base,
                    lineHeight: 20,
                }}
            >
                {message.body}
            </Text>
        </View>
        <Text
            style={{
                color: COLORS.text.muted,
                fontSize: FONT_SIZES.xs,
                marginTop: 3,
                alignSelf: isMine ? "flex-end" : "flex-start",
                paddingHorizontal: 4,
            }}
        >
            {formatMessageTime(message.created_at)}
            {isMine
                ? message.is_read
                    ? "  ✓✓"
                    : "  ✓"
                : ""}
        </Text>
    </View>
);

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ChatDetails() {
    const router = useRouter();
    const params = useLocalSearchParams();

    const partnerId = Number(
        Array.isArray(params.partnerId) ? params.partnerId[0] : params.partnerId
    );
    const partnerName =
        (Array.isArray(params.partnerName) ? params.partnerName[0] : params.partnerName) ||
        "User";

    const currentUser = useAuthStore((s) => s.user);
    const myId = currentUser?.id;

    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [draft, setDraft] = useState("");
    const [error, setError] = useState(null);
    const [hasMore, setHasMore] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [fetchOffset, setFetchOffset] = useState(0);

    const flatListRef = useRef(null);
    const LIMIT = 50;

    // ── Load conversation ──────────────────────────────────────────────────

    const loadConversation = useCallback(
        async (currentOffset, append) => {
            if (!partnerId) return;
            try {
                const data = await apiService.getConversation(partnerId, {
                    skip: currentOffset,
                    limit: LIMIT,
                });
                // Server returns newest-first; reverse so oldest is at top
                const reversed = [...(data.messages || [])].reverse();
                setMessages((prev) => (append ? [...reversed, ...prev] : reversed));
                setHasMore(data.has_more || false);
                setFetchOffset(currentOffset + (data.messages || []).length);
                setError(null);
            } catch (err) {
                setError(err?.detail || err?.message || "Failed to load conversation");
            }
        },
        [partnerId]
    );

    useEffect(() => {
        setLoading(true);
        loadConversation(0, false).finally(() => setLoading(false));
    }, [loadConversation]);

    // ── Load older messages ────────────────────────────────────────────────

    const handleLoadMore = useCallback(async () => {
        if (!hasMore || loadingMore) return;
        setLoadingMore(true);
        await loadConversation(fetchOffset, true);
        setLoadingMore(false);
    }, [hasMore, loadingMore, loadConversation, fetchOffset]);

    // ── Send a message ─────────────────────────────────────────────────────

    const handleSend = useCallback(async () => {
        const text = draft.trim();
        if (!text || sending) return;

        setSending(true);
        setDraft("");
        try {
            const sent = await apiService.sendDirectMessage(partnerId, text);
            setMessages((prev) => [...prev, sent]);
            setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
        } catch (sendErr) {
            setDraft(text); // restore on failure
            setError(sendErr?.detail || sendErr?.message || "Failed to send message");
        } finally {
            setSending(false);
        }
    }, [draft, partnerId, sending]);

    // ── Guard: no partnerId ────────────────────────────────────────────────

    if (!partnerId) {
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }}>
                <Stack.Screen
                    options={buildSecondaryScreenOptions({ router, title: "Messages" })}
                />
                <View
                    style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 20 }}
                >
                    <Text style={{ color: COLORS.text.secondary, fontSize: FONT_SIZES.base }}>
                        No conversation selected.
                    </Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }}>
            <Stack.Screen
                options={buildSecondaryScreenOptions({ router, title: partnerName })}
            />

            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
            >
                {/* ── Message list ── */}
                {loading ? (
                    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                        <ActivityIndicator color={COLORS.primary} />
                    </View>
                ) : error && messages.length === 0 ? (
                    <View style={{ flex: 1, padding: 20 }}>
                        <Text
                            style={{ color: COLORS.text.secondary, fontSize: FONT_SIZES.base }}
                        >
                            {error}
                        </Text>
                    </View>
                ) : (
                    <FlatList
                        ref={flatListRef}
                        data={messages}
                        keyExtractor={(item) => String(item.id)}
                        contentContainerStyle={{
                            paddingHorizontal: 16,
                            paddingTop: 12,
                            paddingBottom: 8,
                            flexGrow: 1,
                        }}
                        onContentSizeChange={() => {
                            if (!loadingMore) {
                                flatListRef.current?.scrollToEnd({ animated: false });
                            }
                        }}
                        ListHeaderComponent={
                            loadingMore ? (
                                <View style={{ alignItems: "center", paddingBottom: 8 }}>
                                    <ActivityIndicator size="small" color={COLORS.primary} />
                                </View>
                            ) : hasMore ? (
                                <TouchableOpacity
                                    onPress={handleLoadMore}
                                    style={{ alignItems: "center", paddingBottom: 12 }}
                                >
                                    <Text
                                        style={{ color: COLORS.primary, fontSize: FONT_SIZES.sm }}
                                    >
                                        Load older messages
                                    </Text>
                                </TouchableOpacity>
                            ) : null
                        }
                        ListEmptyComponent={
                            <View
                                style={{
                                    flex: 1,
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
                                    {"No messages yet.\nSay hello to " + partnerName + "!"}
                                </Text>
                            </View>
                        }
                        renderItem={({ item }) => (
                            <MessageBubble message={item} isMine={item.sender_id === myId} />
                        )}
                    />
                )}

                {/* ── Error banner (only when messages are loaded) ── */}
                {error && messages.length > 0 && (
                    <View
                        style={{
                            backgroundColor: "rgba(239,68,68,0.1)",
                            paddingHorizontal: 16,
                            paddingVertical: 6,
                        }}
                    >
                        <Text style={{ color: "#EF4444", fontSize: FONT_SIZES.sm }}>
                            {error}
                        </Text>
                    </View>
                )}

                {/* ── Compose bar ── */}
                <View
                    style={{
                        flexDirection: "row",
                        alignItems: "flex-end",
                        paddingHorizontal: 12,
                        paddingVertical: 10,
                        borderTopWidth: 1,
                        borderTopColor: COLORS.border,
                        backgroundColor: COLORS.background,
                        gap: 8,
                    }}
                >
                    <TextInput
                        style={{
                            flex: 1,
                            backgroundColor: COLORS.card,
                            borderRadius: BORDER_RADIUS.xl,
                            paddingHorizontal: 16,
                            paddingVertical: Platform.OS === "ios" ? 10 : 8,
                            color: COLORS.text.primary,
                            fontSize: FONT_SIZES.base,
                            maxHeight: 120,
                        }}
                        placeholder="Type a message…"
                        placeholderTextColor={COLORS.text.muted}
                        value={draft}
                        onChangeText={setDraft}
                        multiline
                        returnKeyType="default"
                        editable={!sending}
                        maxLength={2000}
                    />
                    <TouchableOpacity
                        onPress={handleSend}
                        disabled={!draft.trim() || sending}
                        activeOpacity={0.8}
                        style={{
                            width: 44,
                            height: 44,
                            borderRadius: 22,
                            backgroundColor:
                                draft.trim() && !sending ? COLORS.primary : COLORS.card,
                            alignItems: "center",
                            justifyContent: "center",
                        }}
                    >
                        {sending ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                            <Ionicons
                                name="send"
                                size={20}
                                color={draft.trim() ? "#FFFFFF" : COLORS.text.muted}
                            />
                        )}
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
