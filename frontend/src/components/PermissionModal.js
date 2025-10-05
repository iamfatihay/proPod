import React from "react";
import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import CustomModal, { ModalActions } from "./CustomModal";

/**
 * Permission request modal with modern design
 * Shows permission explanation and settings redirect option
 * 
 * @param {boolean} visible - Controls modal visibility
 * @param {function} onClose - Callback when modal closes
 * @param {function} onOpenSettings - Callback when user wants to open settings
 * @param {string} title - Permission title
 * @param {string} message - Permission explanation message
 * @param {string} icon - Ionicons icon name (optional)
 */
const PermissionModal = ({
    visible,
    onClose,
    onOpenSettings,
    title = "Permission Required",
    message,
    icon = "lock-closed",
}) => {
    return (
        <CustomModal visible={visible} onClose={onClose} animationType="fade">
            {/* Icon */}
            <View className="items-center mb-4">
                <View className="w-16 h-16 bg-warning/20 rounded-full items-center justify-center">
                    <Ionicons name={icon} size={32} color="#F59E0B" />
                </View>
            </View>

            {/* Title */}
            <Text className="text-headline text-text-primary text-center font-semibold mb-3">
                {title}
            </Text>

            {/* Message */}
            <Text className="text-text-secondary text-center mb-6 leading-6">
                {message}
            </Text>

            {/* Actions */}
            <ModalActions
                onCancel={onClose}
                onConfirm={onOpenSettings}
                cancelText="Cancel"
                confirmText="Open Settings"
                destructive={false}
            />
        </CustomModal>
    );
};

export default PermissionModal;

