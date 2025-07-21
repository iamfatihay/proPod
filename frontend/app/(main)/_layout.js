import { Tabs, useRouter } from "expo-router";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import {
    View,
    TouchableOpacity,
    Platform,
    Dimensions,
    Alert,
} from "react-native";
import { MiniPlayer } from "../../src/components/audio";
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

    // Responsive tab button size
    const tabSize = Platform.OS === "ios" ? 64 : 60;
    const topOffset = Platform.OS === "ios" ? -22 : -20;

    const handleCreatePress = () => {
        // Show action sheet for quick actions
        const options =
            Platform.OS === "ios"
                ? ["Cancel", "Quick Record", "Create Podcast"]
                : ["Quick Record", "Create Podcast", "Cancel"];

        const cancelButtonIndex = Platform.OS === "ios" ? 0 : 2;

        Alert.alert(
            "Create Content",
            "What would you like to create?",
            [
                {
                    text: "Quick Record",
                    onPress: () => {
                        // Navigate to create page with immediate recording mode
                        router.push({
                            pathname: "/(main)/create",
                            params: { mode: "quick-record" },
                        });
                    },
                },
                {
                    text: "Create Podcast",
                    onPress: () => {
                        // Navigate to full create experience
                        router.push({
                            pathname: "/(main)/create",
                            params: { mode: "full-create" },
                        });
                    },
                },
                {
                    text: "Cancel",
                    style: "cancel",
                },
            ],
            {
                cancelable: true,
                userInterfaceStyle: "dark", // iOS dark mode support
            }
        );
    };

    return (
        <TouchableOpacity
            onPress={handleCreatePress}
            activeOpacity={0.8}
            style={{
                position: "absolute",
                top: topOffset,
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
        miniPlayerPosition,
        play,
        pause,
        stop,
        toggleMiniPlayer,
        setMiniPlayerPosition,
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

            {/* Global Mini Player */}
            <MiniPlayer
                isVisible={showMiniPlayer}
                track={currentTrack}
                isPlaying={isPlaying}
                position={miniPlayerPosition}
                onPlayPause={handleMiniPlayerPlayPause}
                onClose={handleMiniPlayerClose}
                onExpand={handleMiniPlayerExpand}
                onPositionChange={setMiniPlayerPosition}
            />
        </View>
    );
}
