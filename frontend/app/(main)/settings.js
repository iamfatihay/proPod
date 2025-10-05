import {
    View,
    Text,
    SafeAreaView,
    Switch,
    TouchableOpacity,
    Modal,
    Alert,
    TextInput,
    ActivityIndicator,
    Platform,
    StatusBar,
} from "react-native";
import React, { useState } from "react";
import { useRouter } from "expo-router";
import { Stack } from "expo-router";
import SettingRow from "../../src/components/SettingRow";
import { getToken } from "../../src/services/auth/tokenStorage";
import useAuthStore from "../../src/context/useAuthStore";
import apiService from "../../src/services/api/apiService";
import { ToastProvider, useToast } from "../../src/components/Toast";
import { Ionicons } from "@expo/vector-icons";

const APP_VERSION = "1.0.0";

const Settings = () => {
    const router = useRouter();
    const [isDarkMode, setIsDarkMode] = useState(false);
    const [notifications, setNotifications] = useState(true);
    const [deleteModal, setDeleteModal] = useState(false);
    const [changePwModal, setChangePwModal] = useState(false);
    const [oldPassword, setOldPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [pwLoading, setPwLoading] = useState(false);
    const [pwError, setPwError] = useState("");

    const logout = useAuthStore((state) => state.logout);
    const { showToast } = useToast();

    // Dummy handler for account settings
    const handleAccount = () => {
        router.push("/profile");
    };

    // Dummy handler for password change
    const handleChangePassword = () => {
        setOldPassword("");
        setNewPassword("");
        setPwError("");
        setChangePwModal(true);
    };

    const handleChangePwSubmit = async () => {
        if (!oldPassword || !newPassword) {
            setPwError("Please fill in all fields.");
            return;
        }
        setPwLoading(true);
        setPwError("");
        try {
            await apiService.changePassword(oldPassword, newPassword);
            setChangePwModal(false);
            showToast("Password changed successfully.", "success");
        } catch (e) {
            setPwError(e.message || "Password change failed");
            showToast(e.message || "Password change failed", "error");
        } finally {
            setPwLoading(false);
        }
    };

    // Dummy handler for delete account
    const handleDeleteAccount = () => {
        setDeleteModal(true);
    };

    const confirmDelete = async () => {
        setDeleteModal(false);
        try {
            await apiService.deleteAccount();
            showToast("Account deleted successfully.", "success");
            setTimeout(async () => {
                await logout();
                router.replace("/");
            }, 1200);
        } catch (e) {
            showToast(e.message || "Account deletion failed", "error");
        }
    };

    // Dummy handler for support
    const handleSupport = () => {
        // TODO: Implement support screen/modal or open mailto link
        Alert.alert("Support", "Contact us at support@volo.com");
    };

    // Dummy handler for privacy policy
    const handlePrivacy = () => {
        // TODO: Open privacy policy link
        Alert.alert("Privacy Policy", "https://volo.com/privacy");
    };

    // Dummy handler for notifications
    const handleNotifications = () => {
        Alert.alert(
            "Notifications",
            "Notifications feature will be available soon."
        );
    };

    return (
        <SafeAreaView className="flex-1 bg-background">
            <Stack.Screen
                options={{
                    title: "Settings",
                    headerShown: true,
                    headerStyle: {
                        backgroundColor: "#18181b",
                    },
                    headerTintColor: "#FFFFFF",
                    headerTitleStyle: {
                        fontWeight: "500",
                    },
                    headerLeft: () => (
                        <TouchableOpacity
                            onPress={() => router.back()}
                            style={{ marginLeft: 16 }}
                            hitSlop={{
                                top: 10,
                                bottom: 10,
                                left: 10,
                                right: 10,
                            }}
                        >
                            <Ionicons
                                name="arrow-back"
                                size={24}
                                color="#FFFFFF"
                            />
                        </TouchableOpacity>
                    ),
                }}
            />
            <View className="mt-lg">
                {/* Account settings */}
                <SettingRow label="Account Settings" onPress={handleAccount} />
                {/* Change password */}
                <SettingRow
                    label="Change Password"
                    onPress={handleChangePassword}
                />
                {/* Delete account */}
                <SettingRow
                    label="Delete Account"
                    onPress={handleDeleteAccount}
                />
                {/* Notifications switch */}
                <SettingRow
                    label="Notifications"
                    right={
                        <Switch
                            value={notifications}
                            onValueChange={handleNotifications}
                            thumbColor={notifications ? "#10B981" : "#888888"}
                            trackColor={{ false: "#444444", true: "#232323" }}
                        />
                    }
                />
                {/* About section */}
                <View className="mt-lg px-md">
                    <Text className="text-headline text-text-primary mb-md">
                        About
                    </Text>
                    <SettingRow label="App Version" value={APP_VERSION} />
                    <SettingRow label="Support" onPress={handleSupport} />
                    <SettingRow
                        label="Privacy Policy"
                        onPress={() =>
                            Alert.alert(
                                "Privacy Policy",
                                "Privacy policy will be available soon."
                            )
                        }
                    />
                </View>
            </View>
            {/* Delete Account Modal */}
            <Modal
                visible={deleteModal}
                transparent
                animationType="fade"
                onRequestClose={() => setDeleteModal(false)}
            >
                <View className="flex-1 justify-center items-center bg-black/40">
                    <View className="w-11/12 bg-panel rounded-2xl p-6 shadow-lg">
                        <Text className="text-headline text-error mb-4 text-center">
                            Delete Account
                        </Text>
                        <Text className="text-body text-text-secondary mb-4 text-center">
                            Are you sure you want to delete your account? This
                            action cannot be undone.
                        </Text>
                        <View className="flex-row justify-between mt-2">
                            <TouchableOpacity
                                className="bg-panel border border-border rounded-lg px-6 py-2 items-center"
                                onPress={() => setDeleteModal(false)}
                            >
                                <Text className="text-text-secondary">
                                    Cancel
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                className="bg-error rounded-lg px-6 py-2 items-center ml-2"
                                onPress={confirmDelete}
                            >
                                <Text className="text-white font-semibold">
                                    Delete
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
            {/* Change Password Modal */}
            <Modal
                visible={changePwModal}
                transparent
                animationType="fade"
                onRequestClose={() => setChangePwModal(false)}
            >
                <View className="flex-1 justify-center items-center bg-black/40">
                    <View className="w-11/12 bg-panel rounded-2xl p-6 shadow-lg">
                        <Text className="text-headline text-text-primary mb-4 text-center">
                            Change Password
                        </Text>
                        <Text className="text-body text-text-secondary mb-2">
                            Old Password
                        </Text>
                        <TextInput
                            className="bg-card rounded-lg px-4 py-3 text-text-primary border border-border mb-4"
                            value={oldPassword}
                            onChangeText={setOldPassword}
                            placeholder="Enter your old password"
                            secureTextEntry
                        />
                        <Text className="text-body text-text-secondary mb-2">
                            New Password
                        </Text>
                        <TextInput
                            className="bg-card rounded-lg px-4 py-3 text-text-primary border border-border mb-4"
                            value={newPassword}
                            onChangeText={setNewPassword}
                            placeholder="Enter your new password"
                            secureTextEntry
                        />
                        {pwError ? (
                            <Text className="text-red-500 mb-2 text-center">
                                {pwError}
                            </Text>
                        ) : null}
                        <View className="flex-row justify-between mt-2">
                            <TouchableOpacity
                                className="bg-panel border border-border rounded-lg px-6 py-2 items-center"
                                onPress={() => setChangePwModal(false)}
                                disabled={pwLoading}
                            >
                                <Text className="text-text-secondary">
                                    Cancel
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                className="bg-primary rounded-lg px-6 py-2 items-center ml-2 disabled:opacity-50"
                                onPress={handleChangePwSubmit}
                                disabled={pwLoading}
                            >
                                {pwLoading ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <Text className="text-white font-semibold">
                                        Save
                                    </Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
};

export default () => (
    <ToastProvider>
        <Settings />
    </ToastProvider>
);
