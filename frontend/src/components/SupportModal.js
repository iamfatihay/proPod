import React from "react";
import { View, Text, TouchableOpacity, Linking } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import CustomModal from "./CustomModal";

/**
 * Support contact modal with email option
 *
 * @param {boolean} visible - Controls modal visibility
 * @param {function} onClose - Callback when modal closes
 */
const SupportModal = ({ visible, onClose }) => {
    const handleEmail = () => {
        onClose();
        Linking.openURL("mailto:support@volo.com?subject=Volo Support Request");
    };

    return (
        <CustomModal
            visible={visible}
            onClose={onClose}
            title="Contact Support"
            animationType="slide"
        >
            <Text className="text-text-secondary text-center mb-6">
                How would you like to reach us?
            </Text>

            {/* Email Option */}
            <TouchableOpacity
                onPress={handleEmail}
                className="flex-row items-center bg-card rounded-lg p-4 mb-3 border border-border"
                activeOpacity={0.7}
            >
                <View className="w-10 h-10 bg-primary/20 rounded-full items-center justify-center mr-4">
                    <Ionicons name="mail" size={20} color="#D32F2F" />
                </View>
                <View className="flex-1">
                    <Text className="text-text-primary font-semibold text-base">
                        Email Us
                    </Text>
                    <Text className="text-text-secondary text-sm">
                        support@volo.com
                    </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#888888" />
            </TouchableOpacity>

            {/* Cancel Button */}
            <TouchableOpacity
                onPress={onClose}
                className="mt-4 py-3 bg-panel border border-border rounded-lg items-center"
                activeOpacity={0.7}
            >
                <Text className="text-text-secondary font-medium text-base">
                    Cancel
                </Text>
            </TouchableOpacity>
        </CustomModal>
    );
};

export default SupportModal;
