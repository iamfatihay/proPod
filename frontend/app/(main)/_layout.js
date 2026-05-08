import { Tabs, useRouter, usePathname } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import React, { useState, useCallback, useEffect, useRef } from "react";
import {
    View,
    TouchableOpacity,
    Platform,
    Dimensions,
    Modal,
    Text,
    Image,
    DeviceEventEmitter,
    AppState,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import BottomMiniPlayer from "../../src/components/audio/BottomMiniPlayer";
import useAudioStore from "../../src/context/useAudioStore";
import useNotificationStore from "../../src/context/useNotificationStore";
import useDMStore from "../../src/context/useDMStore";
import { COLORS, FONT_SIZES, BORDER_RADIUS } from "../../src/constants/theme";

const { width: screenWidth } = Dimensions.get("window");

const getCreateTabMetrics = () => ({
    tabSize: Platform.OS === "ios" ? 64 : 60,
    topOffset: Platform.OS === "ios" ? -28 : -26,
});

// badgeLabel: singular noun used in the accessibility string, e.g. "notification" or "message".
// Defaults to "notification" so existing callers (Notifications tab) are unaffected.
const TabIcon = ({ icon, color, focused, badge, badgeLabel = "notification" }) => {
    return (
        <View className="items-center justify-center">
            <Ionicons name={icon} size={focused ? 30 : 28} color={color} />
            {badge > 0 && (
                <View
                    style={{
                        position: "absolute",
                        top: -4,
                        right: -10,
                        backgroundColor: COLORS.error,
                        borderRadius: 10,
                        minWidth: 20,
                        height: 20,
                        paddingHorizontal: 4,
                        justifyContent: "center",
                        alignItems: "center",
                        borderWidth: 2,
                        borderColor: COLORS.background,
                    }}
                    accessible={true}
                    accessibilityLabel={`${badge} unread ${badgeLabel}${badge > 1 ? 's' : ''}`}
                    accessibilityRole="text"
                >
                    <Text
                        style={{
                            color: COLORS.text.primary,
                            fontSize: FONT_SIZES.xs,
                            fontWeight: "700",
                        }}
                        importantForAccessibility="no"
                    >
                        {badge > 99 ? "99+" : badge}
                    </Text>
                </View>
            )}
        </View>
    );
};

const CreateTab = () => {
    const router = useRouter();
    const [open, setOpen] = useState(false);

    // Responsive tab button size
    const { tabSize, topOffset } = getCreateTabMetrics();

    const handleCreatePress = () => setOpen(true);

    return (
        <TouchableOpacity
            onPress={handleCreatePress}
            activeOpacity={0.8}
            style={{
                marginTop: topOffset,
                alignItems: "center",
                justifyContent: "center",
                // iOS specific shadow
                ...(Platform.OS === "ios" && {
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.3,
                    shadowRadius: 6,
                }),
            }}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Create new content"
            accessibilityHint="Tap to choose between quick recording or full podcast creation"
        >
            <View
                style={{
                    width: tabSize,
                    height: tabSize,
                    borderRadius: tabSize / 2,
                    backgroundColor: COLORS.primary,
                    alignItems: "center",
                    justifyContent: "center",
                    borderWidth: 4,
                    borderColor: COLORS.background,
                    overflow: 'hidden',
                }}
            >
                <Image
                    source={require("../../assets/Volo-logo.png")}
                    style={{
                        width: 53,
                        height: 53,
                        tintColor: COLORS.text.primary, // Apply to both iOS and Android
                    }}
                />
            </View>
            {/* Custom Themed Modal */}
            <Modal
                transparent
                visible={open}
                animationType="fade"
                onRequestClose={() => setOpen(false)}
            >
                <View className="flex-1 bg-black/80 items-center justify-center px-6">
                    <View className="w-full bg-panel rounded-2xl p-5 border border-border">
                        <Text className="text-text-primary text-lg font-semibold mb-2">
                            Create Content
                        </Text>
                        <Text className="text-text-secondary mb-4">
                            What would you like to create?
                        </Text>
                        <View className="flex-row items-center justify-between">
                            <TouchableOpacity
                                className="flex-1 bg-primary rounded-lg px-4 py-3 mr-2 items-center"
                                onPress={() => {
                                    setOpen(false);
                                    router.push({
                                        pathname: "/(main)/create",
                                        params: { mode: "quick-record" },
                                    });
                                }}
                            >
                                <Text className="text-white font-semibold">
                                    QUICK RECORD
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                className="flex-1 bg-panel rounded-lg px-4 py-3 ml-2 border border-border items-center"
                                onPress={() => {
                                    setOpen(false);
                                    router.push({
                                        pathname: "/(main)/create",
                                        params: { mode: "full-create" },
                                    });
                                }}
                            >
                                <Text className="text-text-primary font-semibold">
                                    CREATE PODCAST
                                </Text>
                            </TouchableOpacity>
                        </View>
                        <TouchableOpacity
                            className="mt-3 items-center"
                            onPress={() => setOpen(false)}
                        >
                            <Text className="text-text-secondary">CANCEL</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </TouchableOpacity>
    );
};

const CreateTabPlaceholder = ({ style }) => {
    return <View pointerEvents="none" style={style} />;
};

export default function TabLayout() {
    const router = useRouter();
    const pathname = usePathname();
    const insets = useSafeAreaInsets();

    // PERFORMANCE FIX: Use selective subscriptions for mini player
    // Avoid subscribing to fast-changing position/duration in tab layout
    const currentTrack = useAudioStore((state) => state.currentTrack);
    const isPlaying = useAudioStore((state) => state.isPlaying);
    const showMiniPlayer = useAudioStore((state) => state.showMiniPlayer);

    // Notification count and server fetch for badge
    const unreadCount = useNotificationStore((state) => state.unreadCount);
    const fetchNotifications = useNotificationStore((state) => state.fetchNotifications);

    // DM unread count is folded into Notifications now that Messages is no
    // longer a primary tab-bar destination.
    const unreadDMCount = useDMStore((state) => state.unreadDMCount);
    const fetchDMUnreadCount = useDMStore((state) => state.fetchDMUnreadCount);
    const totalInboxCount = unreadCount + unreadDMCount;

    // Fetch server notifications on mount so the badge is accurate from first
    // render — without this, the badge only populates when the user visits the
    // notifications screen for the first time.
    const appStateRef = useRef(AppState.currentState);
    useEffect(() => {
        // Initial fetch on login (this component mounts only in the authed group)
        fetchNotifications();
        fetchDMUnreadCount();

        // Refresh badges when the app returns to the foreground (e.g. user
        // background/foregrounds the app between sessions).
        const subscription = AppState.addEventListener('change', (nextState) => {
            if (
                appStateRef.current !== 'active' &&
                nextState === 'active'
            ) {
                fetchNotifications();
                fetchDMUnreadCount();
            }
            appStateRef.current = nextState;
        });

        return () => subscription.remove();
    }, [fetchNotifications, fetchDMUnreadCount]);

    // Actions (stable)
    const play = useAudioStore((state) => state.play);
    const pause = useAudioStore((state) => state.pause);
    const stop = useAudioStore((state) => state.stop);
    const next = useAudioStore((state) => state.next);
    const toggleMiniPlayer = useAudioStore((state) => state.toggleMiniPlayer);

    // Responsive tab bar height
    const tabBarHeight =
        Platform.OS === "ios" ? (screenWidth > 375 ? 92 : 88) : 100;
    const tabBarPaddingBottom =
        Platform.OS === "ios" ? Math.max(insets.bottom, 8) : 12;
    const tabBarPaddingTop = Platform.OS === "ios" ? 8 : 8;
    const createTabBottomOffset =
        Platform.OS === "ios" ? tabBarPaddingBottom + 40 : tabBarPaddingBottom + 44;

    const handleMiniPlayerExpand = () => {
        if (currentTrack) {
            router.push({
                pathname: "/(main)/details",
                params: { id: currentTrack.id },
            });
        }
    };

    const handleMiniPlayerClose = useCallback(() => {
        stop(); // Non-blocking
        toggleMiniPlayer(false);
    }, [stop, toggleMiniPlayer]);

    const handleMiniPlayerPlayPause = useCallback(() => {
        if (!currentTrack) {
            return;
        }

        // Immediate response - don't await
        if (isPlaying) {
            pause();
        } else {
            // Resume current track - play() without params will use currentTrack
            play();
        }
    }, [currentTrack, isPlaying, play, pause]);

    const handleHomePress = useCallback((defaultOnPress) => {
        // Check if we're currently on the home screen
        const isOnHome = pathname === "/home" || pathname === "/(main)/home";
        
        if (isOnHome) {
            // Already on home, scroll to top
            DeviceEventEmitter.emit("scrollToHomeTop");
        } else {
            // Use default tab navigation behavior
            defaultOnPress?.();
        }
    }, [pathname]);

    return (
        <View style={{ flex: 1 }}>
            <View style={{ flex: 1 }}>
                <Tabs
                    screenOptions={{
                        headerShown: false,
                        tabBarShowLabel: false,
                        tabBarActiveTintColor: COLORS.primary,
                        tabBarInactiveTintColor: COLORS.text.muted,
                        tabBarStyle: {
                            backgroundColor: COLORS.background,
                            borderTopWidth: 1,
                            borderTopColor: COLORS.border,
                            height: tabBarHeight,
                            paddingBottom: tabBarPaddingBottom,
                            alignItems: "center",
                            justifyContent: "center",
                            paddingHorizontal: 8,
                            paddingTop: tabBarPaddingTop,
                        },
                    }}
                >
                    <Tabs.Screen
                        name="home"
                        options={{
                            tabBarIcon: ({ color, focused }) => (
                                <TabIcon
                                    icon={focused ? "home" : "home-outline"}
                                    color={color}
                                    focused={focused}
                                />
                            ),
                            tabBarButton: (props) => (
                                <TouchableOpacity
                                    {...props}
                                    onPress={() => handleHomePress(props.onPress)}
                                    activeOpacity={0.7}
                                />
                            ),
                        }}
                    />
                    <Tabs.Screen
                        name="library"
                        options={{
                            tabBarIcon: ({ color, focused }) => (
                                <TabIcon
                                    icon={focused ? "library" : "library-outline"}
                                    color={color}
                                    focused={focused}
                                />
                            ),
                        }}
                    />
                    <Tabs.Screen
                        name="create"
                        options={{
                            tabBarButton: (props) => (
                                <CreateTabPlaceholder style={props.style} />
                            ),
                        }}
                    />
                    <Tabs.Screen
                        name="search"
                        options={{
                            tabBarIcon: ({ color, focused }) => (
                                <TabIcon
                                    icon={focused ? "search" : "search-outline"}
                                    color={color}
                                    focused={focused}
                                />
                            ),
                        }}
                    />
                    <Tabs.Screen
                        name="messages"
                        options={{
                            href: null,
                        }}
                    />
                    <Tabs.Screen
                        name="notifications"
                        options={{
                            tabBarIcon: ({ color, focused }) => (
                                <TabIcon
                                    icon={
                                        focused
                                            ? "notifications"
                                            : "notifications-outline"
                                    }
                                    color={color}
                                    focused={focused}
                                    badge={totalInboxCount}
                                />
                            ),
                            tabBarAccessibilityLabel: totalInboxCount > 0
                                ? `Notifications, ${totalInboxCount} unread items`
                                : "Notifications",
                        }}
                    />
                    <Tabs.Screen
                        name="details"
                        options={{
                            href: null,
                        }}
                    />
                    <Tabs.Screen
                        name="history"
                        options={{
                            href: null,
                        }}
                    />
                    <Tabs.Screen
                        name="edit-podcast"
                        options={{
                            href: null,
                        }}
                    />
                    <Tabs.Screen
                        name="activity"
                        options={{
                            href: null,
                        }}
                    />
                    <Tabs.Screen
                        name="activity-details"
                        options={{
                            href: null,
                        }}
                    />
                    <Tabs.Screen
                        name="chat-details"
                        options={{
                            href: null,
                        }}
                    />
                    <Tabs.Screen
                        name="settings"
                        options={{
                            href: null,
                        }}
                    />
                    <Tabs.Screen
                        name="profile"
                        options={{
                            href: null,
                        }}
                    />
                    <Tabs.Screen
                        name="creator-profile"
                        options={{
                            href: null,
                        }}
                    />
                    <Tabs.Screen
                        name="analytics"
                        options={{
                            href: null,
                        }}
                    />
                    <Tabs.Screen
                        name="rtc-sessions"
                        options={{
                            href: null,
                        }}
                    />
                    <Tabs.Screen
                        name="playlists"
                        options={{
                            href: null,
                        }}
                    />
                    <Tabs.Screen
                        name="playlist-detail"
                        options={{
                            href: null,
                        }}
                    />
                    <Tabs.Screen
                        name="public-playlists"
                        options={{
                            href: null,
                        }}
                    />
                </Tabs>
            </View>

            {/* Debug MiniPlayer State */}
            {/* {__DEV__ && (
                <View
                    style={{
                        position: "absolute",
                        top: 50,
                        left: 10,
                        backgroundColor: "rgba(0,0,0,0.8)",
                        padding: 10,
                        borderRadius: BORDER_RADIUS.xs,
                    }}
                >
                    <Text style={{ color: "white", fontSize: FONT_SIZES.sm }}>
                        MiniPlayer: {showMiniPlayer ? "VISIBLE" : "HIDDEN"}
                    </Text>
                    <Text style={{ color: "white", fontSize: FONT_SIZES.sm }}>
                        Track: {currentTrack ? currentTrack.title : "NONE"}
                    </Text>
                    <Text style={{ color: "white", fontSize: FONT_SIZES.sm }}>
                        Playing: {isPlaying ? "YES" : "NO"}
                    </Text>
                </View>
            )} */}

            {/* Global Bottom Mini Player */}
            <BottomMiniPlayer
                isVisible={showMiniPlayer}
                track={currentTrack}
                isPlaying={isPlaying}
                bottomOffset={tabBarHeight}
                onPlayPause={handleMiniPlayerPlayPause}
                onNext={next}
                onClose={handleMiniPlayerClose}
                onExpand={handleMiniPlayerExpand}
            />

            {/* Floating Create button — rendered LAST so it always sits above
                the mini player and tab bar (Android elevation + iOS zIndex). */}
            <View
                pointerEvents="box-none"
                style={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    bottom: createTabBottomOffset,
                    alignItems: "center",
                    zIndex: 100,
                    elevation: 100,
                }}
            >
                <CreateTab />
            </View>
        </View>
    );
}
