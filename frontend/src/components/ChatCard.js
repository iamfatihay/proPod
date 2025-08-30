import { TouchableOpacity, View, Text, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Surface } from "react-native-paper";
import React from "react";

export default function ChatCard({ chat, onPress }) {
    return (
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
                borderRadius: 16,
                marginBottom: 10,
            }}
            className="overflow-hidden bg-panel"
        >
            <TouchableOpacity
                activeOpacity={0.8}
                onPress={onPress}
                className="flex-row items-center px-3 py-2"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel={`Chat with ${chat.name}`}
                accessibilityHint="Tap to open chat conversation"
            >
                <View className="w-8 h-8 bg-card rounded-full items-center justify-center mr-2">
                    <Ionicons name="person" size={18} color="#888888" />
                </View>
                <View className="flex-1">
                    <Text className="text-sm text-text-primary font-medium">
                        {chat.name}
                    </Text>
                    <Text
                        className="text-xs text-text-secondary"
                        numberOfLines={1}
                    >
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
