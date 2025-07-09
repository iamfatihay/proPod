import { View, Text, TouchableOpacity } from "react-native";
import React from "react";

// SettingRow component for settings list items
const SettingRow = ({ label, value, onPress, right }) => {
    return (
        <TouchableOpacity
            className="flex-row items-center justify-between px-md py-sm bg-panel border-b border-borderLight"
            onPress={onPress}
            activeOpacity={onPress ? 0.7 : 1}
            disabled={!onPress}
        >
            <Text className="text-body text-text-primary">{label}</Text>
            <View className="flex-row items-center space-x-sm">
                {value && (
                    <Text className="text-body text-text-secondary mr-2">
                        {value}
                    </Text>
                )}
                {right}
            </View>
        </TouchableOpacity>
    );
};

export default SettingRow;
