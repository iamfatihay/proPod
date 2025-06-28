import { View, Text, Image, FlatList, TouchableOpacity } from "react-native";
import React from "react";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import useAuthStore from "../../src/context/useAuthStore";

// Fake Data
const episodes = [
    {
        id: "1",
        title: "Episode 1",
        duration: "28:15",
        date: "2 days ago",
    },
    {
        id: "2",
        title: "Episode 2",
        duration: "34:02",
        date: "1 week ago",
    },
    {
        id: "3",
        title: "Episode 3",
        duration: "21:47",
        date: "2 weeks ago",
    },
];

const chats = [
    {
        id: "1",
        name: "Daniel",
        message: "Hallo!",
        time: "2h ago",
    },
    {
        id: "2",
        name: "Anna",
        message: "Das war eine interessante Folge.",
        time: "3h ago",
    },
];

const activities = [
    {
        id: "1",
        type: "comment",
        text: "User XY hat deine Episode kommentiert",
        time: "4h ago",
    },
    {
        id: "2",
        type: "livestream",
        text: "Livestream gestartet von @PodcastStar",
        time: "3h ago",
    },
    {
        id: "3",
        type: "message",
        text: "Neue Nachricht von Anna",
        time: "2h ago",
    },
];

export default function HomeScreen() {
    const router = useRouter();
    const { user, logout } = useAuthStore();

    const handleLogout = () => {
        logout();
        // After logout, the user should be redirected to the login screen.
        // This is typically handled by the navigation setup (e.g., in _layout.js)
        // based on the user's authentication state.
    };

    return (
        <View className="flex-1 bg-background px-4 pt-10">
            {/* Header */}
            <View className="flex-row items-center justify-between mb-6">
                <Text className="text-3xl font-bold text-text-primary">
                    Podcast
                </Text>
                {user && user.photoURL ? (
                    <Image
                        source={{ uri: user.photoURL }}
                        className="w-10 h-10 rounded-full"
                    />
                ) : (
                    <View className="w-10 h-10 rounded-full bg-card items-center justify-center">
                        <Ionicons name="person" size={28} color="#888" />
                    </View>
                )}
            </View>

            {/* Episodes */}
            <Text className="text-lg font-semibold text-text-primary mb-2">
                Letzte Episoden
            </Text>
            <View className="mb-4">
                {episodes.map((ep) => (
                    <View
                        key={ep.id}
                        className="flex-row items-center bg-panel rounded-xl px-4 py-3 mb-2"
                    >
                        <View className="w-10 h-10 bg-primary/20 rounded-full items-center justify-center mr-3">
                            <MaterialCommunityIcons
                                name="microphone"
                                size={24}
                                color="#D32F2F"
                            />
                        </View>
                        <View className="flex-1">
                            <Text className="text-base font-medium text-text-primary">
                                {ep.title}
                            </Text>
                            <Text className="text-xs text-text-secondary">
                                {ep.duration} • {ep.date}
                            </Text>
                        </View>
                        <TouchableOpacity>
                            <Ionicons
                                name="ellipsis-horizontal"
                                size={22}
                                color="#888"
                            />
                        </TouchableOpacity>
                    </View>
                ))}
            </View>

            {/* Chats & Activities */}
            <View className="flex-row gap-4 mb-4">
                {/* Chats */}
                <View className="flex-1 bg-panel rounded-xl p-4">
                    <Text className="text-base font-semibold text-text-primary mb-2">
                        Chats
                    </Text>
                    {chats.map((chat) => (
                        <View
                            key={chat.id}
                            className="flex-row items-center mb-2"
                        >
                            <View className="w-8 h-8 bg-card rounded-full items-center justify-center mr-2">
                                <Ionicons
                                    name="person"
                                    size={18}
                                    color="#888"
                                />
                            </View>
                            <View className="flex-1">
                                <Text className="text-sm text-text-primary font-medium">
                                    {chat.name}
                                </Text>
                                <Text className="text-xs text-text-secondary">
                                    {chat.message}
                                </Text>
                            </View>
                            <Text className="text-xs text-text-secondary ml-2">
                                {chat.time}
                            </Text>
                        </View>
                    ))}
                </View>
                {/* Activities */}
                <View className="flex-1 bg-panel rounded-xl p-4">
                    <Text className="text-base font-semibold text-text-primary mb-2">
                        Aktivitäten
                    </Text>
                    {activities.map((act) => (
                        <View
                            key={act.id}
                            className="flex-row items-center mb-2"
                        >
                            {act.type === "comment" && (
                                <Ionicons
                                    name="chatbubble-ellipses"
                                    size={18}
                                    color="#D32F2F"
                                    className="mr-2"
                                />
                            )}
                            {act.type === "livestream" && (
                                <MaterialCommunityIcons
                                    name="broadcast"
                                    size={18}
                                    color="#D32F2F"
                                    className="mr-2"
                                />
                            )}
                            {act.type === "message" && (
                                <Ionicons
                                    name="mail"
                                    size={18}
                                    color="#D32F2F"
                                    className="mr-2"
                                />
                            )}
                            <Text className="text-sm text-text-primary flex-1 ml-2">
                                {act.text}
                            </Text>
                            <Text className="text-xs text-text-secondary ml-2">
                                {act.time}
                            </Text>
                        </View>
                    ))}
                </View>
            </View>
        </View>
    );
}
