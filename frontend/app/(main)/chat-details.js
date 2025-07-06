import { View, Text, SafeAreaView } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import { Appbar, Surface } from "react-native-paper";

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
            <Appbar.Header style={{ backgroundColor: "#18181b" }}>
                <Appbar.BackAction onPress={() => router.back()} />
                <Appbar.Content title="Chat Details" />
            </Appbar.Header>
            <View className="flex-1 px-4 pt-6">
                <Surface
                    style={{
                        elevation: 2,
                        borderRadius: 16,
                        padding: 20,
                        backgroundColor: "#18181b",
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
