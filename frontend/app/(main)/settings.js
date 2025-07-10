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
} from "react-native";
import React, { useState } from "react";
import { useRouter } from "expo-router";
import SettingRow from "../../src/components/SettingRow";
import { getToken } from "../../src/services/auth/tokenStorage";
import useAuthStore from "../../src/context/useAuthStore";

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
            const token = await getToken("accessToken");
            const res = await fetch("/users/change-password", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    old_password: oldPassword,
                    new_password: newPassword,
                }),
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.detail || "Password change failed");
            }
            setChangePwModal(false);
            Alert.alert("Success", "Password changed successfully.");
        } catch (e) {
            setPwError(e.message);
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
            const token = await getToken("accessToken");
            const res = await fetch("/users/delete", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.detail || "Account deletion failed");
            }
            Alert.alert("Account Deleted", "Your account has been deleted.");
            await logout();
            router.replace("/");
        } catch (e) {
            Alert.alert("Error", e.message);
        }
    };

    // Dummy handler for support
    const handleSupport = () => {
        // TODO: Implement support screen/modal or open mailto link
        Alert.alert("Support", "Contact us at support@propod.com");
    };

    // Dummy handler for privacy policy
    const handlePrivacy = () => {
        // TODO: Open privacy policy link
        Alert.alert("Privacy Policy", "https://propod.com/privacy");
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
            <View className="flex-row items-center px-md py-lg border-b border-borderLight bg-panel">
                {/* Back button */}
                <TouchableOpacity
                    onPress={() => router.back()}
                    className="mr-md"
                >
                    <Text className="text-title text-text-primary">←</Text>
                </TouchableOpacity>
                <Text className="text-headline text-text-primary">
                    Settings
                </Text>
            </View>
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

export default Settings;
