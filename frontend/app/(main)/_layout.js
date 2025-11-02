import { Tabs, useRouter } from "expo-router";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useState } from "react";
import {
    View,
    TouchableOpacity,
    Platform,
    Dimensions,
    Modal,
    Text,
} from "react-native";
import BottomMiniPlayer from "../../src/components/audio/BottomMiniPlayer";
import useAudioStore from "../../src/context/useAudioStore";

const { width: screenWidth } = Dimensions.get("window");

const TabIcon = ({ icon, color, focused }) => {
    return (
        <View className="items-center justify-center">
            <Ionicons name={icon} size={focused ? 30 : 28} color={color} />
        </View>
    );
};

const CreateTab = () => {
    const router = useRouter();
    const [open, setOpen] = useState(false);

    // Responsive tab button size
    const tabSize = Platform.OS === "ios" ? 64 : 60;
    const topOffset = Platform.OS === "ios" ? -28 : -26;

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
                    backgroundColor: "#D32F2F",
                    alignItems: "center",
                    justifyContent: "center",
                    borderWidth: 4,
                    borderColor: "#000000",
                    // Android elevation
                    ...(Platform.OS === "android" && {
                        elevation: 8,
                    }),
                }}
            >
                <MaterialCommunityIcons name="plus" size={36} color="white" />
            </View>
            {/* Custom Themed Modal */}
            <Modal
                transparent
                visible={open}
                animationType="fade"
                onRequestClose={() => setOpen(false)}
            >
                <View className="flex-1 bg-black/60 items-center justify-center px-6">
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

export default function TabLayout() {
    const router = useRouter();

    // Audio store for mini player
    const {
        currentTrack,
        isPlaying,
        showMiniPlayer,
        position,
        duration,
        play,
        pause,
        stop,
        next,
        toggleMiniPlayer,
    } = useAudioStore();

    // Responsive tab bar height
    const tabBarHeight =
        Platform.OS === "ios" ? (screenWidth > 375 ? 90 : 84) : 84;

    const handleMiniPlayerExpand = () => {
        if (currentTrack) {
            router.push({
                pathname: "/(main)/details",
                params: { id: currentTrack.id },
            });
        }
    };

    const handleMiniPlayerClose = async () => {
        await stop();
        toggleMiniPlayer(false);
    };

    const handleMiniPlayerPlayPause = async () => {
        if (isPlaying) {
            await pause();
        } else {
            await play();
        }
    };

    return (
        <View style={{ flex: 1 }}>
            <Tabs
                screenOptions={{
                    headerShown: false,
                    tabBarShowLabel: false,
                    tabBarActiveTintColor: "#D32F2F", // theme.colors.primary
                    tabBarInactiveTintColor: "#888888", // theme.colors.text.muted
                    tabBarStyle: {
                        backgroundColor: "#000000", // theme.colors.background
                        borderTopWidth: 1,
                        borderTopColor: "#333333", // theme.colors.border
                        height: tabBarHeight,
                        paddingBottom: Platform.OS === "ios" ? 6 : 0,
                        alignItems: "center",
                        justifyContent: "center",
                        paddingHorizontal: 8,
                        paddingTop: 6,
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
                        tabBarButton: () => <CreateTab />,
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
                    name="profile"
                    options={{
                        tabBarIcon: ({ color, focused }) => (
                            <TabIcon
                                icon={
                                    focused
                                        ? "person-circle"
                                        : "person-circle-outline"
                                }
                                color={color}
                                focused={focused}
                            />
                        ),
                    }}
                />
                <Tabs.Screen
                    name="details"
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
            </Tabs>

            {/* Debug MiniPlayer State */}
            {/* {__DEV__ && (
                <View
                    style={{
                        position: "absolute",
                        top: 50,
                        left: 10,
                        backgroundColor: "rgba(0,0,0,0.8)",
                        padding: 10,
                        borderRadius: 5,
                    }}
                >
                    <Text style={{ color: "white", fontSize: 12 }}>
                        MiniPlayer: {showMiniPlayer ? "VISIBLE" : "HIDDEN"}
                    </Text>
                    <Text style={{ color: "white", fontSize: 12 }}>
                        Track: {currentTrack ? currentTrack.title : "NONE"}
                    </Text>
                    <Text style={{ color: "white", fontSize: 12 }}>
                        Playing: {isPlaying ? "YES" : "NO"}
                    </Text>
                </View>
            )} */}

            {/* Global Bottom Mini Player */}
            <BottomMiniPlayer
                isVisible={showMiniPlayer}
                track={currentTrack}
                isPlaying={isPlaying}
                position={position}
                duration={duration}
                onPlayPause={handleMiniPlayerPlayPause}
                onNext={next}
                onClose={handleMiniPlayerClose}
                onExpand={handleMiniPlayerExpand}
            />
        </View>
    );
}
