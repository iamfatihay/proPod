import { useState } from "react";
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    Image,
    KeyboardAvoidingView,
    Platform,
} from "react-native";
import { Link, useRouter } from "expo-router";
import apiService from "../../src/services/api/apiService";
import * as Google from "expo-auth-session/providers/google";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import useAuthStore from "../../src/context/useAuthStore";
import Constants from "expo-constants";
import * as AuthSession from "expo-auth-session";
import { useToast } from "../../src/components/Toast";

export default function RegisterScreen() {
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState(false);
    const router = useRouter();
    const setUser = useAuthStore((state) => state.setUser);
    const setTokens = useAuthStore((state) => state.setTokens);
    const { showToast } = useToast();

    // Google Auth
    const googleAndroidClientId =
        Constants.expoConfig?.extra?.googleAndroidClientId;
    const googleIosClientId = Constants.expoConfig?.extra?.googleIosClientId;
    const googleExpoClientId = Constants.expoConfig?.extra?.googleExpoClientId;

    const redirectUri = AuthSession.makeRedirectUri({
        scheme: "volo",
        useProxy: false,
    });

    const [request, response, promptAsync] = Google.useAuthRequest({
        androidClientId: googleAndroidClientId,
        iosClientId: googleIosClientId,
        expoClientId: googleExpoClientId,
        redirectUri,
    });

    React.useEffect(() => {
        if (response?.type === "success") {
            const { authentication } = response;
            fetch("https://www.googleapis.com/userinfo/v2/me", {
                headers: {
                    Authorization: `Bearer ${authentication.accessToken}`,
                },
            })
                .then((res) => res.json())
                .then(async (data) => {
                    try {
                        const result = await apiService.googleLogin({
                            email: data.email,
                            name: data.name,
                            photo_url: data.picture,
                        });
                        apiService.setToken(result.access_token);
                        setUser(result.user);
                        setTokens(result.access_token, result.refresh_token);
                    } catch (err) {
                        setError("Google register failed");
                    }
                });
        }
    }, [response]);

    const handleRegister = async () => {
        setLoading(true);
        setError("");
        setSuccess(false);
        if (!name || !email || !password) {
            setError("All fields are required.");
            setLoading(false);
            return;
        }
        try {
            await apiService.register(name, email, password);
            showToast("Registration successful! Redirecting...", "success");
            setSuccess(true);
            setTimeout(() => router.replace("/"), 1000);
        } catch (err) {
            let msg = "Registration failed. Try a different email.";
            let status = err.status || (err.response && err.response.status);
            if (err.response && err.response.data && err.response.data.detail) {
                const detail = err.response.data.detail;
                if (
                    Array.isArray(detail) &&
                    detail.length > 0 &&
                    detail[0].msg
                ) {
                    msg = detail[0].msg;
                } else if (typeof detail === "string") {
                    msg = detail;
                }
            } else if (err.detail) {
                msg = err.detail;
            } else if (err.message) {
                msg = err.message;
            }
            if (status === 500 || (msg && msg.length > 120)) {
                msg = "Something went wrong. Please try again later.";
            }
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            className="flex-1"
        >
            <View className="flex-1 bg-background justify-center items-center px-6">
                <Image
                    source={require("../../assets/Volo-logo.png")}
                    className="w-60 h-60 mb-6"
                    resizeMode="contain"
                />
                <Text className="text-3xl font-bold text-primary mb-2">
                    Create Account
                </Text>
                <Text className="text-text-secondary mb-8">
                    Sign up to get started
                </Text>
                {/* Error/Success message area: always reserve space */}
                <View style={{ minHeight: 24, justifyContent: "center" }}>
                    {error ? (
                        <Text className="text-red-500 mb-2 text-center">
                            {error}
                        </Text>
                    ) : success ? (
                        <Text className="text-green-500 mb-2 text-center">
                            Registration successful! Redirecting...
                        </Text>
                    ) : null}
                </View>
                <View className="w-full space-y-4 mb-6">
                    <TextInput
                        className="bg-card rounded-lg mb-4 px-4 py-3 text-text-primary border border-border focus:border-primary"
                        placeholder="Name"
                        placeholderTextColor="#888"
                        value={name}
                        onChangeText={setName}
                    />
                    <TextInput
                        className="bg-card rounded-lg mb-4 px-4 py-3 text-text-primary border border-border focus:border-primary"
                        placeholder="Email"
                        placeholderTextColor="#888"
                        autoCapitalize="none"
                        keyboardType="email-address"
                        value={email}
                        onChangeText={setEmail}
                    />
                    <TextInput
                        className="bg-card rounded-lg px-4 py-3 text-text-primary border border-border focus:border-primary"
                        placeholder="Password"
                        placeholderTextColor="#888"
                        secureTextEntry
                        value={password}
                        onChangeText={setPassword}
                    />
                </View>
                <TouchableOpacity
                    className="bg-primary w-full py-3 rounded-lg items-center mb-4 disabled:opacity-50"
                    onPress={handleRegister}
                    disabled={loading}
                >
                    <Text className="text-white font-semibold text-base">
                        {loading ? "Signing up..." : "Sign Up"}
                    </Text>
                </TouchableOpacity>
                {/* Register with Google */}
                <TouchableOpacity
                    className="flex-row items-center justify-center bg-panel w-full border border-border rounded-lg py-3 mb-4"
                    onPress={() => promptAsync()}
                    disabled={!request}
                >
                    <Ionicons
                        name="logo-google"
                        size={20}
                        color="#D32F2F"
                        className="mr-2"
                    />
                    <Text className="text-base text-text-secondary ml-2">
                        Sign up with Google
                    </Text>
                </TouchableOpacity>
                <View className="flex-row items-center justify-center">
                    <Text className="text-text-secondary">
                        Already have an account?{" "}
                    </Text>
                    <Link href="/" asChild>
                        <TouchableOpacity>
                            <Text className="text-primary font-semibold">
                                Sign In
                            </Text>
                        </TouchableOpacity>
                    </Link>
                </View>
            </View>
        </KeyboardAvoidingView>
    );
}
