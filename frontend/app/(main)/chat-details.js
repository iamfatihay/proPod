import {
    View,
    Text,
    SafeAreaView,
    Platform,
    TouchableOpacity,
} from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import React from "react";
import { Surface } from "react-native-paper";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, BORDER_RADIUS } from "../../src/constants/theme";

const chats = [
    { id: "1", name: "Daniel", message: "Hallo!", time: "2h ago" },
    {
        id: "2",
        name: "Anna",
        message: "Das war eine interessante Folge.",
        time: "3h ago",
    },
];

export default function ChatDetails() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const chat = chats.find((c) => c.id === id);

    return (
        <SafeAreaView className="flex-1 bg-background">
            <Stack.Screen
                options={{
                    title: "Chat Details",
                    headerShown: true,
                    headerStyle: {
                        backgroundColor: COLORS.card,
                    },
                    headerTintColor: COLORS.text.primary,
                    headerTitleStyle: {
                        fontWeight: "500",
                    },
                    headerLeft: () => (
                        <TouchableOpacity
                            onPress={() => router.back()}
                            style={{ marginLeft: 16 }}
                            hitSlop={{
                                top: 10,
                                bottom: 10,
                                left: 10,
                                right: 10,
                            }}
                        >
                            <Ionicons
                                name="arrow-back"
                                size={24}
                                color={COLORS.text.primary}
                            />
                        </TouchableOpacity>
                    ),
                }}
            />
            <View className="flex-1 px-4 pt-6">
                <Surface
                    style={{
                        // Cross-platform shadow for both iOS and Android
                        ...(Platform.OS === "ios"
                            ? {
                                  shadowColor: "#000",
                                  shadowOffset: { width: 0, height: 2 },
                                  shadowOpacity: 0.25,
                                  shadowRadius: 3.84,
                              }
                            : {
                                  elevation: 5,
                              }),
                        borderRadius: BORDER_RADIUS.md,
                        padding: 20,
                        backgroundColor: COLORS.card,
                    }}
                >
                    {chat ? (
                        <>
                            <Text className="text-2xl font-bold text-text-primary mb-2">
                                Chat with {chat.name}
                            </Text>
                            <Text className="text-base text-text-secondary mb-2">
                                Last message: {chat.message}
                            </Text>
                            <Text className="text-base text-text-secondary mb-2">
                                Time: {chat.time}
                            </Text>
                            <Text className="text-base text-text-primary mt-4">
                                Chat details coming soon...
                            </Text>
                        </>
                    ) : (
                        <Text className="mt-8 text-lg text-red-500">
                            Chat not found
                        </Text>
                    )}
                </Surface>
            </View>
        </SafeAreaView>
    );
}
