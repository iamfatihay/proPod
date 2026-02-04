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

const colors = require("../../tailwind.config").theme.extend.colors;

// Notification type icons and colors
const NOTIFICATION_TYPES = {
    ai_complete: {
        icon: "sparkles",
        color: "#8B5CF6",
        bgColor: "#8B5CF620",
    },
    comment: {
        icon: "chatbubble",
        color: "#3B82F6",
        bgColor: "#3B82F620",
    },
    like: {
        icon: "heart",
        color: "#EF4444",
        bgColor: "#EF444420",
    },
    follow: {
        icon: "person-add",
        color: "#10B981",
        bgColor: "#10B98120",
    },
    system: {
        icon: "information-circle",
        color: "#6B7280",
        bgColor: "#6B728020",
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
                backgroundColor: isUnread ? type.bgColor : colors.card,
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
                        borderRadius: 24,
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
                            fontSize: 16,
                            fontWeight: isUnread ? "700" : "600",
                            color: colors.text.primary,
                            marginBottom: 4,
                        }}
                    >
                        {notification.title}
                    </Text>
                    <Text
                        style={{
                            fontSize: 14,
                            color: colors.text.secondary,
                            lineHeight: 20,
                            marginBottom: 8,
                        }}
                    >
                        {notification.message}
                    </Text>
                    <Text
                        style={{
                            fontSize: 12,
                            color: colors.text.muted,
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
                            borderRadius: 5,
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
                borderRadius: 60,
                backgroundColor: colors.card,
                justifyContent: "center",
                alignItems: "center",
                marginBottom: 24,
            }}
        >
            <Ionicons name="notifications-off-outline" size={56} color={colors.text.muted} />
        </View>
        <Text
            style={{
                fontSize: 20,
                fontWeight: "700",
                color: colors.text.primary,
                marginBottom: 8,
                textAlign: "center",
            }}
        >
            No Notifications
        </Text>
        <Text
            style={{
                fontSize: 14,
                color: colors.text.secondary,
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
                backgroundColor: colors.background,
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
                    borderBottomColor: colors.border,
                }}
            >
                <View>
                    <Text
                        style={{
                            fontSize: 24,
                            fontWeight: "700",
                            color: colors.text.primary,
                        }}
                    >
                        Notifications
                    </Text>
                    {unreadCount > 0 && (
                        <Text
                            style={{
                                fontSize: 12,
                                color: colors.text.muted,
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
                            borderRadius: 20,
                            backgroundColor: colors.primary + "20",
                        }}
                    >
                        <Text
                            style={{
                                fontSize: 14,
                                fontWeight: "600",
                                color: colors.primary,
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
                            tintColor={colors.primary}
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
