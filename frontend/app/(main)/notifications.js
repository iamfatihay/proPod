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
    TouchableOpacity,
    Platform,
    RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import useNotificationStore from "../../src/context/useNotificationStore";
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
};

const NotificationCard = ({ notification, onPress, onMarkRead }) => {
    const type = NOTIFICATION_TYPES[notification.type] || NOTIFICATION_TYPES.system;
    const isUnread = !notification.read;

    // Format time
    const getTimeAgo = (timestamp) => {
        const now = Date.now();
        const diff = now - timestamp;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) return "Just now";
        if (minutes < 60) return `${minutes}m ago`;
        if (hours < 24) return `${hours}h ago`;
        if (days < 7) return `${days}d ago`;
        return new Date(timestamp).toLocaleDateString();
    };

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
                        {getTimeAgo(notification.created_at)}
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
    const markAsRead = useNotificationStore((state) => state.markAsRead);
    const markAllAsRead = useNotificationStore((state) => state.markAllAsRead);
    const loadFromStorage = useNotificationStore((state) => state.loadFromStorage);

    const [refreshing, setRefreshing] = React.useState(false);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await loadFromStorage();
        setRefreshing(false);
    }, [loadFromStorage]);

    const handleNotificationPress = (notification) => {
        Logger.log("📬 Notification tapped:", notification.id);

        // Mark as read
        if (!notification.read) {
            markAsRead(notification.id);
        }

        // Handle navigation based on action
        if (notification.action) {
            const { type, screen, params } = notification.action;
            
            if (type === "navigate" && screen) {
                // Sanitize screen name (remove leading slashes and path prefixes)
                const cleanScreen = screen.replace(/^\/(main\/)?/, '');
                
                router.push({
                    pathname: `/(main)/${cleanScreen}`,
                    params: params || {},
                });
            }
        }
    };

    const handleMarkAllRead = () => {
        markAllAsRead();
        Logger.log("📬 All notifications marked as read");
    };

    return (
        <View
            style={{
                flex: 1,
                backgroundColor: COLORS.background,
            }}
        >
            {/* Header */}
            <View
                style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    paddingHorizontal: 20,
                    paddingVertical: 16,
                    borderBottomWidth: 1,
                    borderBottomColor: COLORS.border,
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
                    {unreadCount > 0 && (
                        <Text
                            style={{
                                fontSize: FONT_SIZES.sm,
                                color: COLORS.text.muted,
                                marginTop: 2,
                            }}
                        >
                            {unreadCount} unread
                        </Text>
                    )}
                </View>

                {/* Mark all as read button */}
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
                            onMarkRead={() => markAsRead(item.id)}
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
        </View>
    );
}
