import React, { useMemo, useCallback } from "react";
import {
    View,
    Text,
    FlatList,
    SafeAreaView,
    TouchableOpacity,
    RefreshControl,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import useNotificationStore from "../../src/context/useNotificationStore";
import { COLORS, FONT_SIZES, BORDER_RADIUS } from "../../src/constants/theme";
import { buildSecondaryScreenOptions } from "../../src/utils/secondaryScreenOptions";
import { formatTimeAgo } from "../../src/utils/formatTimeAgo";

 ago`;
    return new Date(timestamp).toLocaleDateString();
};

const typeIconMap = {
    comment: "chatbubble-outline",
    like: "heart-outline",
    follow: "person-add-outline",
    ai_complete: "sparkles-outline",
    system: "information-circle-outline",
    livestream: "radio-outline",
    message: "mail-outline",
};

const ActivityRow = ({ item, onPress }) => (
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
                width: 46,
                height: 46,
                borderRadius: 23,
                backgroundColor: "rgba(211,47,47,0.14)",
                alignItems: "center",
                justifyContent: "center",
                marginRight: 14,
            }}
        >
            <Ionicons
                name={typeIconMap[item.type] || "notifications-outline"}
                size={20}
                color={COLORS.primary}
            />
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
                {item.title}
            </Text>
            <Text style={{ color: COLORS.text.secondary, fontSize: FONT_SIZES.base }}>
                {item.text}
            </Text>
        </View>
        <Text style={{ color: COLORS.text.muted, fontSize: FONT_SIZES.sm }}>
            {item.time}
        </Text>
    </TouchableOpacity>
);

export default function ActivityScreen() {
    const router = useRouter();
    const notifications = useNotificationStore((state) => state.notifications);
    const fetchNotifications = useNotificationStore((state) => state.fetchNotifications);
    const [refreshing, setRefreshing] = React.useState(false);

    React.useEffect(() => {
        fetchNotifications();
    }, [fetchNotifications]);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await fetchNotifications();
        setRefreshing(false);
    }, [fetchNotifications]);

    const items = useMemo(() => {
        return notifications
            .filter((item) => ["comment", "like", "follow", "system", "ai_complete"].includes(item.type))
            .map((item) => ({
                id: item.id,
                title: item.title,
                text: item.message,
                type: item.type,
                time: formatTimeAgo(item.created_at),
                podcastId: item.action?.params?.id ? String(item.action.params.id) : null,
            }));
    }, [notifications]);

    const handlePress = useCallback(
        (item) => {
            router.push({
                pathname: "/(main)/activity-details",
                params: {
                    id: item.id,
                    title: item.title,
                    text: item.text,
                    type: item.type,
                    time: item.time,
                    podcastId: item.podcastId || "",
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
                    title: "Activity",
                    backgroundColor: COLORS.background,
                })}
            />
            <FlatList
                data={items}
                keyExtractor={(item) => String(item.id)}
                contentContainerStyle={{ padding: 20, paddingBottom: 32 }}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor={COLORS.primary}
                    />
                }
                renderItem={({ item }) => (
                    <ActivityRow item={item} onPress={() => handlePress(item)} />
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
                            Recent activity
                        </Text>
                        <Text style={{ color: COLORS.text.secondary, fontSize: FONT_SIZES.base }}>
                            Real notifications and system updates for your account.
                        </Text>
                    </View>
                }
                ListEmptyComponent={
                    <Text style={{ color: COLORS.text.secondary, fontSize: FONT_SIZES.base }}>
                        No activity yet.
                    </Text>
                }
            />
        </SafeAreaView>
    );
}