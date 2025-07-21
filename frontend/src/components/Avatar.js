import { Image, View, Text, Platform } from "react-native";
import React, { useState } from "react";
import { Ionicons } from "@expo/vector-icons";

// Avatar component for displaying user profile image and name
const Avatar = ({ uri, name, size = 64 }) => {
    const [imageError, setImageError] = useState(false);

    const renderPlaceholder = () => (
        <View
            style={{
                width: size,
                height: size,
                borderRadius: size / 2,
                backgroundColor: "#333333",
                alignItems: "center",
                justifyContent: "center",
            }}
        >
            <Ionicons name="person" size={size * 0.6} color="#888" />
        </View>
    );

    return (
        <View className="items-center justify-center">
            {uri && !imageError ? (
                <Image
                    source={{
                        uri,
                        // Cross-platform cache control
                        cache:
                            Platform.OS === "ios" ? "default" : "force-cache",
                    }}
                    style={{
                        width: size,
                        height: size,
                        borderRadius: size / 2,
                        backgroundColor: "#333333",
                    }}
                    onError={() => setImageError(true)}
                    accessible={true}
                    accessibilityLabel={
                        name ? `Profile picture of ${name}` : "Profile picture"
                    }
                    accessibilityRole="image"
                />
            ) : (
                renderPlaceholder()
            )}
            {name && (
                <Text
                    className="text-text-primary text-base font-semibold mt-2"
                    accessible={true}
                    accessibilityRole="text"
                >
                    {name}
                </Text>
            )}
        </View>
    );
};

export default Avatar;
