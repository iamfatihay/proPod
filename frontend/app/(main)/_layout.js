import { Tabs, useRouter } from "expo-router";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { View, TouchableOpacity } from "react-native";

const TabIcon = ({ icon, color, focused }) => {
    return (
        <View className="items-center justify-center">
            <Ionicons name={icon} size={focused ? 30 : 28} color={color} />
        </View>
    );
};

const CreateTab = () => {
    const router = useRouter();

    return (
        <TouchableOpacity
            onPress={() => router.push("/(main)/create")}
            activeOpacity={0.8}
            className="top-[-22px] items-center justify-center shadow-lg"
        >
            <View className="w-16 h-16 rounded-full bg-[#D32F2F] items-center justify-center border-4 border-black">
                <MaterialCommunityIcons name="plus" size={36} color="white" />
            </View>
        </TouchableOpacity>
    );
};

export default function TabLayout() {
    return (
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
                    height: 84,
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
        </Tabs>
    );
}
