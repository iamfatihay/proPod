import { TouchableOpacity, View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Surface } from "react-native-paper";
import React from "react";

export default function ChatCard({ chat, onPress }) {
    return (
        <Surface
            style={{
                elevation: 2,
                borderRadius: 16,
                marginBottom: 10,
                backgroundColor: "#18181b",
            }}
            className="overflow-hidden"
        >
            <TouchableOpacity
                activeOpacity={0.8}
                onPress={onPress}
                className="flex-row items-center px-3 py-2"
            >
                <View className="w-8 h-8 bg-card rounded-full items-center justify-center mr-2">
                    <Ionicons name="person" size={18} color="#888" />
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
            </TouchableOpacity>
        </Surface>
    );
}
