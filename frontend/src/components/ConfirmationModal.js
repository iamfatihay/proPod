import React from "react";
import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import CustomModal, { ModalActions } from "./CustomModal";

/**
 * Confirmation modal for destructive or important actions
 *
 * @param {boolean} visible - Controls modal visibility
 * @param {function} onClose - Callback when modal closes / user cancels
 * @param {function} onConfirm - Callback when user confirms
 * @param {string} title - Modal title
 * @param {string} message - Confirmation message
 * @param {string} confirmText - Confirm button text (default: "Confirm")
 * @param {string} cancelText - Cancel button text (default: "Cancel")
 * @param {boolean} destructive - Use destructive (red) styling (default: true)
 * @param {boolean} loading - Loading state during confirmation (default: false)
 * @param {string} icon - Ionicons icon name (optional)
 */
const ConfirmationModal = ({
    visible,
    onClose,
    onConfirm,
    title,
    message,
    confirmText = "Confirm",
    cancelText = "Cancel",
    destructive = true,
    loading = false,
    icon = "warning",
}) => {
    return (
        <CustomModal visible={visible} onClose={onClose} animationType="fade">
            {/* Icon */}
            {icon && (
                <View className="items-center mb-4">
                    <View
                        className={`w-16 h-16 ${
                            destructive ? "bg-error/20" : "bg-warning/20"
                        } rounded-full items-center justify-center`}
                    >
                        <Ionicons
                            name={icon}
                            size={32}
                            color={destructive ? "#EF4444" : "#F59E0B"}
                        />
                    </View>
                </View>
            )}

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
                onConfirm={onConfirm}
                cancelText={cancelText}
                confirmText={confirmText}
                destructive={destructive}
                loading={loading}
            />
        </CustomModal>
    );
};

export default ConfirmationModal;
