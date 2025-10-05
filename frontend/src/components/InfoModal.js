import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import CustomModal from "./CustomModal";

/**
 * Simple info/error modal with icon and single action button
 * 
 * @param {boolean} visible - Controls modal visibility
 * @param {function} onClose - Callback when modal closes
 * @param {string} title - Modal title
 * @param {string} message - Modal message
 * @param {string} type - Modal type: 'success' | 'error' | 'warning' | 'info'
 * @param {string} buttonText - Button text (default: "OK")
 */
const InfoModal = ({
    visible,
    onClose,
    title,
    message,
    type = "info",
    buttonText = "OK",
}) => {
    const getIconConfig = () => {
        switch (type) {
            case "success":
                return {
                    name: "checkmark-circle",
                    color: "#10B981",
                    bgColor: "bg-success/20",
                };
            case "error":
                return {
                    name: "alert-circle",
                    color: "#EF4444",
                    bgColor: "bg-error/20",
                };
            case "warning":
                return {
                    name: "warning",
                    color: "#F59E0B",
                    bgColor: "bg-warning/20",
                };
            default:
                return {
                    name: "information-circle",
                    color: "#3B82F6",
                    bgColor: "bg-info/20",
                };
        }
    };

    const iconConfig = getIconConfig();

    return (
        <CustomModal visible={visible} onClose={onClose} animationType="fade">
            {/* Icon */}
            <View className="items-center mb-4">
                <View
                    className={`w-16 h-16 ${iconConfig.bgColor} rounded-full items-center justify-center`}
                >
                    <Ionicons
                        name={iconConfig.name}
                        size={32}
                        color={iconConfig.color}
                    />
                </View>
            </View>

            {/* Title */}
            {title && (
                <Text className="text-headline text-text-primary text-center font-semibold mb-3">
                    {title}
                </Text>
            )}

            {/* Message */}
            <Text className="text-text-secondary text-center mb-6 leading-6">
                {message}
            </Text>

            {/* OK Button */}
            <TouchableOpacity
                onPress={onClose}
                className="w-full py-3 bg-primary rounded-lg items-center"
                activeOpacity={0.7}
            >
                <Text className="text-white font-semibold text-base">
                    {buttonText}
                </Text>
            </TouchableOpacity>
        </CustomModal>
    );
};

export default InfoModal;

