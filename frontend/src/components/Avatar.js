import { Image, View, Text } from "react-native";
import React from "react";

// Avatar component for displaying user profile image and name
const Avatar = ({ uri, name, size = 64 }) => {
    return (
        <View className="items-center justify-center">
            <Image
                source={{ uri }}
                style={{ width: size, height: size, borderRadius: size / 2 }}
                className="bg-panel"
            />
            {name && (
                <Text className="text-text-primary text-base font-semibold mt-2">
                    {name}
                </Text>
            )}
        </View>
    );
};

export default Avatar;
