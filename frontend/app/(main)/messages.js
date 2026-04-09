import React, { useCallback, useState } from "react";
import { formatTimeAgo } from "../../src/utils/formatTimeAgo";
import {
    View,
    Text,
    FlatList,
    SafeAreaView,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl,
} from "react-native";
import { Stack, useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, FONT_SIZES, BORDER_RADIUS } from "../../src/constants/theme";
import apiService from "../../src/services/api/apiService";
import { buildSecondaryScreenOptions } from "../../src/utils/secondaryScreenOptions";


const MessageRow = ({ item, onPress }) => (
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
            <Ionicons name="chatbubble-ellipses-outline" size={22} color="#3B82F6" />
        </View>
        <View style={{ flex: 1 }}>
            <Text
                style={{
                    color: COLORS.text.primary,
                    fontSize: FONT_SIZES.md,
                    fontWeight: "700",
                    marginBottom: 4,
                }}
            >
                {item.authorName}
            </Text>
            <Text
                style={{
                    color: COLORS.text.secondary,
                    fontSize: FONT_SIZES.base,
                    marginBottom: 4,
                }}
                numberOfLines={2}
            >
                {item.content}
            </Text>
            <Text style={{ color: COLORS.text.muted, fontSize: FONT_SIZES.sm }}>
                {item.podcastTitle}
            </Text>
        </View>
        <Text style={{ color: COLORS.text.muted, fontSize: FONT_SIZES.sm }}>
            {formatTimeAgo(item.createdAt)}
        </Text>
    </TouchableOpacity>
);

export default function MessagesScreen() {
    const router = useRouter();
    const [threads, setThreads] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState(null);

    const loadThreads = useCallback(async () => {
        try {
            const inbox = await apiService.getCreatorCommentInbox();
            setThreads(inbox);
            setError(null);
        } catch (loadError) {
            setError(loadError?.detail || loadError?.message || "Failed to load messages");
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            let isActive = true;

            setLoading(true);
            loadThreads().finally(() => {
                if (isActive) {
                    setLoading(false);
                }
            });

            return () => {
                isActive = false;
            };
        }, [loadThreads])
    );

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await loadThreads();
        setRefreshing(false);
    }, [loadThreads]);

    const handlePress = useCallback(
        (thread) => {
            router.push({
                pathname: "/(main)/chat-details",
                params: {
                    id: thread.id,
                    commentId: String(thread.commentId),
                    authorName: thread.authorName,
                    content: thread.content,
                    createdAt: thread.createdAt,
                    podcastId: String(thread.podcastId),
                    podcastTitle: thread.podcastTitle,
                    timestampSeconds: String(thread.timestampSeconds || 0),
                },
            });
        },
        [router]
    );

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }}>
            <Stack.Screen
                options={buildSecondaryScreenOptions({
                    router,
                    title: "Messages",
                    backgroundColor: COLORS.background,
                })}
            />
            {loading ? (
                <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                    <ActivityIndicator color={COLORS.primary} />
                </View>
            ) : error ? (
                <View style={{ padding: 20 }}>
                    <Text style={{ color: COLORS.text.secondary, fontSize: FONT_SIZES.base }}>
                        {error}
                    </Text>
                </View>
            ) : (
            <FlatList
                data={threads}
                keyExtractor={(item) => item.id}
                contentContainerStyle={{ padding: 20, paddingBottom: 32 }}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor={COLORS.primary}
                    />
                }
                renderItem={({ item }) => (
                    <MessageRow item={item} onPress={() => handlePress(item)} />
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
                            Comments on your podcasts
                        </Text>
                        <Text style={{ color: COLORS.text.secondary, fontSize: FONT_SIZES.base }}>
                            Built from real listener comments across the podcasts you created.
                        </Text>
                    </View>
                }
                ListEmptyComponent={
                    <Text style={{ color: COLORS.text.secondary, fontSize: FONT_SIZES.base }}>
                        No one has commented on your podcasts yet.
                    </Text>
                }
            />
            )}
        </SafeAreaView>
    );
}