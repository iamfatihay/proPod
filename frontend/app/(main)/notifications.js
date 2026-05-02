import { formatTimeAgo } from "../../src/utils/formatTimeAgo";
/**
 * Notifications Screen
 * 
 * Displays all in-app notifications with:
 * - AI processing completion
 * - Comments
 * - Likes
 * - System messages
 * 
 * Features:
 * - Mark as read on tap
 * - Mark all as read
 * - Navigate to related content
 * - Empty state
 * - Pull to refresh
 */

import React, { useCallback } from "react";
import {
    View,
    Text,
    FlatList,
    SafeAreaView,
    StatusBar,
    TouchableOpacity,
    Platform,
    RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import useNotificationStore from "../../src/context/useNotificationStore";
import useDMStore from "../../src/context/useDMStore";
import Logger from "../../src/utils/logger";
import { COLORS, FONT_SIZES, BORDER_RADIUS, addAlpha, getNotificationColors } from "../../src/constants/theme";


// Notification type configuration
const NOTIFICATION_TYPES = {
    ai_complete: {
        icon: "sparkles",
        ...getNotificationColors('ai_complete'),
    },
    comment: {
        icon: "chatbubble",
        ...getNotificationColors('comment'),
    },
    like: {
        icon: "heart",
        ...getNotificationColors('like'),
    },
    follow: {
        icon: "person-add",
        ...getNotificationColors('follow'),
    },
    system: {
        icon: "information-circle",
        ...getNotificationColors('system'),
    },
    rtc_processing: {
        icon: "hourglass-outline",
        ...getNotificationColors('rtc_processing'),
    },
    rtc_ready: {
        icon: "mic-circle",
        ...getNotificationColors('rtc_ready'),
    },
    new_episode: {
        icon: "radio",
        ...getNotificationColors('new_episode'),
    },
    dm: {
        icon: "chatbubble-ellipses",
        ...getNotificationColors('dm'),
    },
};

const NotificationCard = ({ notification, onPress, onMarkRead }) => {
    const type = NOTIFICATION_TYPES[notification.type] || NOTIFICATION_TYPES.system;
    const isUnread = !notification.read;

    return (
        <TouchableOpacity
            activeOpacity={0.7}
            onPress={onPress}
            style={{
                backgroundColor: isUnread ? type.bgColor : COLORS.card,
                borderLeftWidth: isUnread ? 4 : 0,
                borderLeftColor: isUnread ? type.color : "transparent",
                marginBottom: 2,
                paddingVertical: 16,
                paddingHorizontal: 20,
            }}
        >
            <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
                {/* Icon */}
                <View
                    style={{
                        width: 48,
                        height: 48,
                        borderRadius: BORDER_RADIUS.xl,
                        backgroundColor: type.bgColor,
                        justifyContent: "center",
                        alignItems: "center",
                        marginRight: 12,
                    }}
                >
                    <Ionicons name={type.icon} size={24} color={type.color} />
                </View>

                {/* Content */}
                <View style={{ flex: 1, paddingRight: 8 }}>
                    <Text
                        style={{
                            fontSize: FONT_SIZES.md,
                            fontWeight: isUnread ? "700" : "600",
                            color: COLORS.text.primary,
                            marginBottom: 4,
                        }}
                    >
                        {notification.title}
                    </Text>
                    <Text
                        style={{
                            fontSize: FONT_SIZES.base,
                            color: COLORS.text.secondary,
                            lineHeight: 20,
                            marginBottom: 8,
                        }}
                    >
                        {notification.message}
                    </Text>
                    <Text
                        style={{
                            fontSize: FONT_SIZES.sm,
                            color: COLORS.text.muted,
                        }}
                    >
                        {formatTimeAgo(notification.created_at)}
                    </Text>
                </View>

                {/* Unread indicator */}
                {isUnread && (
                    <View
                        style={{
                            width: 10,
                            height: 10,
                            borderRadius: BORDER_RADIUS.xs,
                            backgroundColor: type.color,
                            marginTop: 4,
                        }}
                    />
                )}
            </View>
        </TouchableOpacity>
    );
};

const EmptyState = () => (
    <View
        style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            paddingHorizontal: 40,
            paddingTop: 100,
        }}
    >
        <View
            style={{
                width: 120,
                height: 120,
                borderRadius: BORDER_RADIUS.xxl,
                backgroundColor: COLORS.card,
                justifyContent: "center",
                alignItems: "center",
                marginBottom: 24,
            }}
        >
            <Ionicons name="notifications-off-outline" size={56} color={COLORS.text.muted} />
        </View>
        <Text
            style={{
                fontSize: FONT_SIZES.lg,
                fontWeight: "700",
                color: COLORS.text.primary,
                marginBottom: 8,
                textAlign: "center",
            }}
        >
            No Notifications
        </Text>
        <Text
            style={{
                fontSize: FONT_SIZES.base,
                color: COLORS.text.secondary,
                textAlign: "center",
                lineHeight: 20,
            }}
        >
            You're all caught up! We'll notify you when something new happens.
        </Text>
    </View>
);

export default function NotificationsScreen() {
    const router = useRouter();
    const notifications = useNotificationStore((state) => state.notifications);
    const unreadCount = useNotificationStore((state) => state.unreadCount);
    const unreadDMCount = useDMStore((state) => state.unreadDMCount);
    const fetchNotifications = useNotificationStore((state) => state.fetchNotifications);
    const markAsReadWithSync = useNotificationStore((state) => state.markAsReadWithSync);
    const markAllAsReadWithSync = useNotificationStore((state) => state.markAllAsReadWithSync);

    const [refreshing, setRefreshing] = React.useState(false);

    // Fetch server-side notifications on first mount
    React.useEffect(() => {
        fetchNotifications();
    }, [fetchNotifications]);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await fetchNotifications();
        setRefreshing(false);
    }, [fetchNotifications]);

    const handleNotificationPress = (notification) => {
        // Mark as read (syncs to server for server-backed notifications)
        if (!notification.read) {
            markAsReadWithSync(notification.id);
        }

        // Type-specific routing runs BEFORE the generic action block so these
        // branches are never shadowed by notification.action being set.

        // dm → open the conversation (actor_id is the sender); fall back to inbox
        if (notification.type === 'dm') {
            const partnerId = notification.actor_id;
            if (partnerId) {
                // Coerce to string — chat-details expects a string route param
                router.push({ pathname: '/(main)/chat-details', params: { partnerId: String(partnerId) } });
            } else {
                router.push('/(main)/messages');
            }
            return;
        }

        // new_episode → open the episode detail; podcast id lives in action.params
        if (notification.type === 'new_episode') {
            const podcastId = notification.action?.params?.id;
            if (podcastId) {
                router.push({ pathname: '/(main)/details', params: { id: String(podcastId) } });
            } else {
                router.push('/(main)/notifications');
            }
            return;
        }

        // Generic action-based routing (like, comment, follow, system, rtc_*, etc.)
        if (notification.action) {
            const { type, screen, params } = notification.action;

            if (type === "navigate" && screen) {
                // Sanitize screen name (remove leading slashes and path prefixes)
                const cleanScreen = screen.replace(/^\/(main\/)?/, '');

                router.push({
                    pathname: `/(main)/${cleanScreen}`,
                    params: params || {},
                });
                return;
            }
        }

        router.push({
            pathname: "/(main)/activity-details",
            params: {
                id: notification.id,
                title: notification.title,
                text: notification.message,
                type: notification.type,
                time: formatTimeAgo(notification.created_at),
                podcastId: notification.action?.params?.id
                    ? String(notification.action.params.id)
                    : "",
            },
        });
    };

    const handleMarkAllRead = () => {
        markAllAsReadWithSync();
    };

    const handleOpenMessages = () => {
        router.push("/(main)/messages");
    };

    return (
        <SafeAreaView
            style={{
                flex: 1,
                backgroundColor: COLORS.background,
                paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
            }}
        >
            {/* Header */}
            <View
                style={{
                    paddingHorizontal: 20,
                    paddingVertical: 16,
                    borderBottomWidth: 1,
                    borderBottomColor: COLORS.border,
                }}
            >
                <View
                    style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginBottom: 14,
                    }}
                >
                    <View>
                        <Text
                            style={{
                                fontSize: FONT_SIZES.xl,
                                fontWeight: "700",
                                color: COLORS.text.primary,
                            }}
                        >
                            Notifications
                        </Text>
                        {(unreadCount > 0 || unreadDMCount > 0) && (
                            <Text
                                style={{
                                    fontSize: FONT_SIZES.sm,
                                    color: COLORS.text.muted,
                                    marginTop: 2,
                                }}
                            >
                                {unreadCount} updates, {unreadDMCount} messages
                            </Text>
                        )}
                    </View>

                    {unreadCount > 0 && (
                        <TouchableOpacity
                            onPress={handleMarkAllRead}
                            style={{
                                paddingHorizontal: 16,
                                paddingVertical: 8,
                                borderRadius: BORDER_RADIUS.lg,
                                backgroundColor: addAlpha(COLORS.primary, 0.12),
                            }}
                        >
                            <Text
                                style={{
                                    fontSize: FONT_SIZES.base,
                                    fontWeight: "600",
                                    color: COLORS.primary,
                                }}
                            >
                                Mark all read
                            </Text>
                        </TouchableOpacity>
                    )}
                </View>

                <TouchableOpacity
                    onPress={handleOpenMessages}
                    activeOpacity={0.8}
                    style={{
                        flexDirection: "row",
                        alignItems: "center",
                        backgroundColor: COLORS.card,
                        borderRadius: BORDER_RADIUS.lg,
                        borderWidth: 1,
                        borderColor: COLORS.border,
                        paddingHorizontal: 16,
                        paddingVertical: 14,
                    }}
                >
                    <View
                        style={{
                            width: 40,
                            height: 40,
                            borderRadius: 20,
                            backgroundColor: addAlpha(COLORS.info, 0.16),
                            alignItems: "center",
                            justifyContent: "center",
                            marginRight: 12,
                        }}
                    >
                        <Ionicons
                            name="chatbubbles-outline"
                            size={20}
                            color={COLORS.info}
                        />
                    </View>

                    <View style={{ flex: 1 }}>
                        <Text
                            style={{
                                color: COLORS.text.primary,
                                fontSize: FONT_SIZES.base,
                                fontWeight: "700",
                                marginBottom: 2,
                            }}
                        >
                            Direct Messages
                        </Text>
                        <Text
                            style={{
                                color: COLORS.text.secondary,
                                fontSize: FONT_SIZES.sm,
                            }}
                        >
                            Private conversations live here now.
                        </Text>
                    </View>

                    {unreadDMCount > 0 && (
                        <View
                            style={{
                                minWidth: 22,
                                height: 22,
                                borderRadius: 11,
                                backgroundColor: COLORS.primary,
                                alignItems: "center",
                                justifyContent: "center",
                                paddingHorizontal: 6,
                                marginRight: 10,
                            }}
                        >
                            <Text
                                style={{
                                    color: COLORS.text.primary,
                                    fontSize: FONT_SIZES.xs,
                                    fontWeight: "700",
                                }}
                            >
                                {unreadDMCount > 99 ? "99+" : unreadDMCount}
                            </Text>
                        </View>
                    )}

                    <Ionicons
                        name="chevron-forward"
                        size={18}
                        color={COLORS.text.muted}
                    />
                </TouchableOpacity>
            </View>

            {/* Notifications List */}
            {notifications.length === 0 ? (
                <EmptyState />
            ) : (
                <FlatList
                    data={notifications}
                    keyExtractor={(item) => item.id}
                    renderItem={({ item }) => (
                        <NotificationCard
                            notification={item}
                            onPress={() => handleNotificationPress(item)}
                            onMarkRead={() => markAsReadWithSync(item.id)}
                        />
                    )}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            tintColor={COLORS.primary}
                        />
                    }
                    contentContainerStyle={{
                        paddingTop: 8,
                        paddingBottom: 24,
                    }}
                />
            )}
        </SafeAreaView>
    );
}
