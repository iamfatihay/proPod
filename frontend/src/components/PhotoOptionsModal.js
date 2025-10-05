import React from "react";
import { View, Text, TouchableOpacity, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import CustomModal from "./CustomModal";

/**
 * Modern photo selection modal (Instagram/WhatsApp style)
 * Provides options for camera and gallery with consistent design
 * 
 * @param {boolean} visible - Controls modal visibility
 * @param {function} onClose - Callback when modal closes
 * @param {function} onCamera - Callback when camera option selected
 * @param {function} onGallery - Callback when gallery option selected
 */
const PhotoOptionsModal = ({ visible, onClose, onCamera, onGallery }) => {
    return (
        <CustomModal
            visible={visible}
            onClose={onClose}
            title="Change Profile Photo"
            animationType="slide"
        >
            <Text className="text-text-secondary text-center mb-6">
                How would you like to update your photo?
            </Text>

            {/* Camera Option */}
            <TouchableOpacity
                onPress={() => {
                    onClose();
                    onCamera();
                }}
                className="flex-row items-center bg-card rounded-lg p-4 mb-3 border border-border"
                activeOpacity={0.7}
            >
                <View className="w-10 h-10 bg-primary/20 rounded-full items-center justify-center mr-4">
                    <Ionicons name="camera" size={20} color="#D32F2F" />
                </View>
                <View className="flex-1">
                    <Text className="text-text-primary font-semibold text-base">
                        Take Photo
                    </Text>
                    <Text className="text-text-secondary text-sm">
                        Use your camera to take a new photo
                    </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#888888" />
            </TouchableOpacity>

            {/* Gallery Option */}
            <TouchableOpacity
                onPress={() => {
                    onClose();
                    onGallery();
                }}
                className="flex-row items-center bg-card rounded-lg p-4 mb-3 border border-border"
                activeOpacity={0.7}
            >
                <View className="w-10 h-10 bg-primary/20 rounded-full items-center justify-center mr-4">
                    <Ionicons name="images" size={20} color="#D32F2F" />
                </View>
                <View className="flex-1">
                    <Text className="text-text-primary font-semibold text-base">
                        Choose from Gallery
                    </Text>
                    <Text className="text-text-secondary text-sm">
                        Select an existing photo from your device
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

export default PhotoOptionsModal;

