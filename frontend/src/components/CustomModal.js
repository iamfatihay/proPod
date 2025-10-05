import React from "react";
import { View, Text, Modal, TouchableOpacity, Platform } from "react-native";

/**
 * Reusable custom modal component with consistent styling
 * Used across the app for Edit Profile, Change Password, Delete Account, etc.
 *
 * @param {boolean} visible - Controls modal visibility
 * @param {function} onClose - Callback when modal should close
 * @param {string} title - Modal title
 * @param {ReactNode} children - Modal content
 * @param {string} animationType - Animation type: 'slide' | 'fade' | 'none'
 */
const CustomModal = ({
    visible,
    onClose,
    title,
    children,
    animationType = "fade",
}) => {
    return (
        <Modal
            visible={visible}
            transparent
            animationType={animationType}
            onRequestClose={onClose}
            statusBarTranslucent
        >
            <View className="flex-1 justify-center items-center bg-black/40">
                <View
                    className="w-11/12 bg-panel rounded-2xl p-6"
                    style={{
                        maxWidth: Platform.OS === "web" ? 500 : undefined,
                        // Cross-platform shadow
                        ...Platform.select({
                            ios: {
                                shadowColor: "#000",
                                shadowOffset: { width: 0, height: 4 },
                                shadowOpacity: 0.3,
                                shadowRadius: 8,
                            },
                            android: {
                                elevation: 8,
                            },
                            web: {
                                boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
                            },
                        }),
                    }}
                >
                    {title && (
                        <Text className="text-headline text-text-primary mb-4 text-center font-semibold">
                            {title}
                        </Text>
                    )}
                    {children}
                </View>
            </View>
        </Modal>
    );
};

/**
 * Modal action buttons component for consistent button layouts
 *
 * @param {function} onCancel - Cancel button callback
 * @param {function} onConfirm - Confirm button callback
 * @param {string} cancelText - Cancel button text
 * @param {string} confirmText - Confirm button text
 * @param {boolean} loading - Loading state
 * @param {boolean} destructive - Use destructive (red) styling for confirm button
 */
export const ModalActions = ({
    onCancel,
    onConfirm,
    cancelText = "Cancel",
    confirmText = "Confirm",
    loading = false,
    destructive = false,
}) => {
    return (
        <View className="flex-row justify-between mt-6">
            <TouchableOpacity
                className="flex-1 bg-panel border border-border rounded-lg py-3 items-center mr-2"
                onPress={onCancel}
                disabled={loading}
                activeOpacity={0.7}
            >
                <Text className="text-text-secondary font-medium">
                    {cancelText}
                </Text>
            </TouchableOpacity>
            <TouchableOpacity
                className={`flex-1 rounded-lg py-3 items-center ml-2 ${
                    destructive ? "bg-error" : "bg-primary"
                } ${loading ? "opacity-50" : ""}`}
                onPress={onConfirm}
                disabled={loading}
                activeOpacity={0.7}
            >
                <Text className="text-white font-semibold">{confirmText}</Text>
            </TouchableOpacity>
        </View>
    );
};

export default CustomModal;
