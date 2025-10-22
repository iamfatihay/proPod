import React, { useState, useEffect } from "react";
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    KeyboardAvoidingView,
    Platform,
    SafeAreaView,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import apiService from "../../src/services/api/apiService";
import Logger from "../../src/utils/logger";
import InfoModal from "../../src/components/InfoModal";

export default function ResetPasswordScreen() {
    const [token, setToken] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [infoModalVisible, setInfoModalVisible] = useState(false);
    const router = useRouter();
    const params = useLocalSearchParams();

    // Get token from URL params (from email link)
    useEffect(() => {
        if (params.token && typeof params.token === "string") {
            setToken(params.token);
        }
    }, [params.token]);

    const validateForm = () => {
        setError(""); // Clear previous errors

        if (!token?.trim()) {
            setError("Invalid reset token.");
            return false;
        }
        if (!newPassword?.trim()) {
            setError("New password is required.");
            return false;
        }
        if (newPassword.length < 8) {
            setError("Password must be at least 8 characters long.");
            return false;
        }
        if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(newPassword)) {
            setError(
                "Password must contain at least one uppercase letter, one lowercase letter, and one number."
            );
            return false;
        }
        if (newPassword !== confirmPassword) {
            setError("Passwords do not match.");
            return false;
        }
        return true;
    };

    const handleResetPassword = async () => {
        if (loading) return; // Prevent double submission

        setLoading(true);
        setError("");
        setSuccess("");

        if (!validateForm()) {
            setLoading(false);
            return;
        }

        try {
            await apiService.resetPassword(token.trim(), newPassword);
            setSuccess(
                "Password reset successful! You can now login with your new password."
            );

            // Navigate to login after success
            setTimeout(() => {
                router.replace("/");
            }, 2500);
        } catch (err) {
            Logger.error("Reset password error:", err);

            let msg = "Password reset failed. Please try again.";

            // Handle different error types
            if (err.response?.data?.detail) {
                const detail = err.response.data.detail;
                if (typeof detail === "string") {
                    msg = detail;
                } else if (Array.isArray(detail) && detail[0]?.msg) {
                    msg = detail[0].msg;
                }
            } else if (err.message) {
                msg = err.message;
            }

            // Show user-friendly messages for common errors
            if (msg.toLowerCase().includes("token")) {
                msg =
                    "Reset token is invalid or expired. Please request a new password reset.";
            } else if (msg.toLowerCase().includes("network")) {
                msg =
                    "Network error. Please check your connection and try again.";
            }

            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    const handleBackToLogin = () => {
        if (loading) {
            setInfoModalVisible(true);
            return;
        }
        router.replace("/");
    };

    return (
        <SafeAreaView style={{ flex: 1 }} className="bg-background">
            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={{ flex: 1 }}
                keyboardVerticalOffset={0}
            >
                <View className="flex-1 justify-center items-center px-6">
                    <Text className="text-3xl font-bold text-primary mb-2">
                        Reset Password
                    </Text>
                    <Text className="text-text-secondary mb-8 text-center">
                        Enter your new password below.
                    </Text>

                    {/* Message area: always reserve space */}
                    <View
                        style={{
                            minHeight: 48,
                            justifyContent: "center",
                            marginBottom: 16,
                        }}
                    >
                        {error ? (
                            <Text
                                className="text-error mb-2 text-center"
                                accessible={true}
                                accessibilityRole="alert"
                            >
                                {error}
                            </Text>
                        ) : success ? (
                            <Text
                                className="text-success mb-2 text-center"
                                accessible={true}
                                accessibilityRole="status"
                            >
                                {success}
                            </Text>
                        ) : null}
                    </View>

                    <View className="w-full space-y-4 mb-6">
                        {/* Token Input (for manual entry if needed) */}
                        <TextInput
                            className="bg-card rounded-lg px-4 py-3 text-text-primary border border-border focus:border-primary"
                            placeholder="Reset Token"
                            placeholderTextColor="#888"
                            autoCapitalize="none"
                            autoCorrect={false}
                            autoComplete="off"
                            value={token}
                            onChangeText={setToken}
                            editable={!params.token && !loading}
                            accessible={true}
                            accessibilityLabel="Reset token input"
                            accessibilityHint="Enter the reset token from your email"
                        />

                        {/* New Password Input */}
                        <TextInput
                            className="bg-card rounded-lg px-4 py-3 text-text-primary border border-border focus:border-primary"
                            placeholder="New Password (min 8 chars)"
                            placeholderTextColor="#888"
                            secureTextEntry
                            autoCapitalize="none"
                            autoCorrect={false}
                            autoComplete="new-password"
                            value={newPassword}
                            onChangeText={setNewPassword}
                            editable={!loading}
                            accessible={true}
                            accessibilityLabel="New password input"
                            accessibilityHint="Enter your new password. Must be at least 8 characters with uppercase, lowercase, and number"
                        />

                        {/* Confirm Password Input */}
                        <TextInput
                            className="bg-card rounded-lg px-4 py-3 text-text-primary border border-border focus:border-primary"
                            placeholder="Confirm New Password"
                            placeholderTextColor="#888"
                            secureTextEntry
                            autoCapitalize="none"
                            autoCorrect={false}
                            autoComplete="new-password"
                            value={confirmPassword}
                            onChangeText={setConfirmPassword}
                            editable={!loading}
                            accessible={true}
                            accessibilityLabel="Confirm password input"
                            accessibilityHint="Re-enter your new password to confirm"
                        />
                    </View>

                    <TouchableOpacity
                        className="bg-primary w-full py-3 rounded-lg items-center mb-4 disabled:opacity-50"
                        onPress={handleResetPassword}
                        disabled={loading}
                        accessible={true}
                        accessibilityRole="button"
                        accessibilityLabel={
                            loading ? "Resetting password" : "Reset password"
                        }
                        accessibilityState={{ disabled: loading }}
                    >
                        <Text className="text-white font-semibold text-base">
                            {loading ? "Resetting..." : "Reset Password"}
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={handleBackToLogin}
                        accessible={true}
                        accessibilityRole="button"
                        accessibilityLabel="Back to login"
                    >
                        <Text className="text-text-secondary text-center">
                            Back to Login
                        </Text>
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>

            {/* Info Modal for loading warning */}
            <InfoModal
                visible={infoModalVisible}
                onClose={() => setInfoModalVisible(false)}
                title="Reset in Progress"
                message="Please wait for the password reset to complete before going back."
                type="warning"
            />
        </SafeAreaView>
    );
}
