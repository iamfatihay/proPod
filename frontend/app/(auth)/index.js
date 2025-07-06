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
import { Link } from "expo-router";
import Constants from "expo-constants";
import useAuthStore from "../../src/context/useAuthStore";
import apiService from "../../src/services/api/apiService";
import * as Google from "expo-auth-session/providers/google";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import * as AuthSession from "expo-auth-session";

export default function LoginScreen() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const setUser = useAuthStore((state) => state.setUser);
    const setTokens = useAuthStore((state) => state.setTokens);
    const googleAndroidClientId =
        Constants.expoConfig?.extra?.googleAndroidClientId;
    const googleIosClientId = Constants.expoConfig?.extra?.googleIosClientId;
    const googleExpoClientId = Constants.expoConfig?.extra?.googleExpoClientId;

    // Google Auth
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
                        setError("Google login failed");
                    }
                });
        }
    }, [response]);

    const handleLogin = async () => {
        setLoading(true);
        setError("");
        try {
            const data = await apiService.login(email, password);
            apiService.setToken(data.access_token);
            setUser(data.user);
            setTokens(data.access_token, data.refresh_token);
        } catch (err) {
            setError("Invalid email or password");
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={{ flex: 1 }}
        >
            <View className="flex-1 bg-background justify-center items-center px-6">
                <Image
                    source={require("../../assets/Volo-logo.png")}
                    className="w-60 h-60 mb-6"
                    resizeMode="contain"
                />
                <Text className="text-3xl font-bold text-primary mb-2">
                    Welcome Back
                </Text>
                <Text className="text-text-secondary mb-8">
                    Sign in to your account
                </Text>
                {error ? (
                    <Text className="text-red-500 mb-2">{error}</Text>
                ) : null}
                <View className="w-full space-y-4 mb-6">
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
                    onPress={handleLogin}
                    disabled={loading}
                >
                    <Text className="text-white font-semibold text-base">
                        {loading ? "Signing in..." : "Sign In"}
                    </Text>
                </TouchableOpacity>
                {/* Sign in with Google */}
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
                        Sign in with Google
                    </Text>
                </TouchableOpacity>
                <View className="flex-row items-center justify-center">
                    <Text className="text-text-secondary">
                        Don't have an account?{" "}
                    </Text>
                    <Link href="/register" asChild>
                        <TouchableOpacity>
                            <Text className="text-primary font-semibold">
                                Sign Up
                            </Text>
                        </TouchableOpacity>
                    </Link>
                </View>
            </View>
        </KeyboardAvoidingView>
    );
}
