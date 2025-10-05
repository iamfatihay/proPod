import React from "react";
import { View, Text, TouchableOpacity, Linking } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import CustomModal from "./CustomModal";
import InfoModal from "./InfoModal";

/**
 * Privacy policy modal with browser open option
 *
 * @param {boolean} visible - Controls modal visibility
 * @param {function} onClose - Callback when modal closes
 */
const PrivacyModal = ({ visible, onClose }) => {
    const [errorVisible, setErrorVisible] = React.useState(false);

    const handleOpenBrowser = () => {
        onClose();
        Linking.openURL("https://volo.com/privacy").catch(() => {
            setErrorVisible(true);
        });
    };

    return (
        <>
            <CustomModal
                visible={visible}
                onClose={onClose}
                title="Privacy Policy"
                animationType="slide"
            >
                <Text className="text-text-secondary text-center mb-6">
                    View our privacy policy?
                </Text>

                {/* Browser Option */}
                <TouchableOpacity
                    onPress={handleOpenBrowser}
                    className="flex-row items-center bg-card rounded-lg p-4 mb-3 border border-border"
                    activeOpacity={0.7}
                >
                    <View className="w-10 h-10 bg-primary/20 rounded-full items-center justify-center mr-4">
                        <Ionicons name="globe" size={20} color="#D32F2F" />
                    </View>
                    <View className="flex-1">
                        <Text className="text-text-primary font-semibold text-base">
                            Open in Browser
                        </Text>
                        <Text className="text-text-secondary text-sm">
                            volo.com/privacy
                        </Text>
                    </View>
                    <Ionicons
                        name="chevron-forward"
                        size={20}
                        color="#888888"
                    />
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

            {/* Error Modal */}
            <InfoModal
                visible={errorVisible}
                onClose={() => setErrorVisible(false)}
                title="Error"
                message="Could not open privacy policy. Please try again."
                type="error"
            />
        </>
    );
};

export default PrivacyModal;
