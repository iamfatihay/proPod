import { useState } from "react";
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    KeyboardAvoidingView,
    Platform,
    SafeAreaView,
} from "react-native";
import { useRouter } from "expo-router";
import apiService from "../../src/services/api/apiService";

export default function ForgotPasswordScreen() {
    const [email, setEmail] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const router = useRouter();

    const handleForgotPassword = async () => {
        setLoading(true);
        setError("");
        setSuccess("");
        if (!email) {
            setError("Email is required.");
            setLoading(false);
            return;
        }
        try {
            await apiService.forgotPassword(email);
            setSuccess("If this email exists, a reset link has been sent.");
        } catch (err) {
            let msg = "Something went wrong. Please try again.";
            if (err.response && err.response.data && err.response.data.detail) {
                msg = err.response.data.detail;
            } else if (err.message) {
                msg = err.message;
            }
            setError(msg);
        } finally {
            setLoading(false);
        }
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
                        Forgot Password
                    </Text>
                    <Text className="text-text-secondary mb-8 text-center">
                        Enter your email address to receive a password reset
                        link.
                    </Text>
                    <View style={{ minHeight: 24, justifyContent: "center" }}>
                        {error ? (
                            <Text className="text-error mb-2 text-center">
                                {error}
                            </Text>
                        ) : success ? (
                            <Text className="text-success mb-2 text-center">
                                {success}
                            </Text>
                        ) : null}
                    </View>
                    <View className="w-full space-y-4 mb-6">
                        <TextInput
                            className="bg-card rounded-lg px-4 py-3 text-text-primary border border-border focus:border-primary"
                            placeholder="Email"
                            placeholderTextColor="#888"
                            autoCapitalize="none"
                            keyboardType="email-address"
                            value={email}
                            onChangeText={setEmail}
                        />
                    </View>
                    <TouchableOpacity
                        className="bg-primary w-full py-3 rounded-lg items-center mb-4 disabled:opacity-50"
                        onPress={handleForgotPassword}
                        disabled={loading}
                    >
                        <Text className="text-white font-semibold text-base">
                            {loading ? "Sending..." : "Send Reset Link"}
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => router.replace("/")}>
                        <Text className="text-text-secondary text-center">
                            Back to Login
                        </Text>
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
