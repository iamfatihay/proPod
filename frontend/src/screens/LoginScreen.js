import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, Image } from "react-native";
import { Link } from "expo-router";

export default function LoginScreen() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);

    const handleLogin = () => {
        setLoading(true);
        // TODO: API ile login işlemi
        setTimeout(() => setLoading(false), 1000);
    };

    return (
        <View className="flex-1 bg-background justify-center items-center px-6">
            <Image
                source={require("../../assets/Volo-logo.png")}
                className="w-24 h-24 mb-8"
                resizeMode="contain"
            />
            <Text className="text-3xl font-bold text-primary mb-2">
                Welcome Back
            </Text>
            <Text className="text-text-secondary mb-8">
                Sign in to your account
            </Text>
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
    );
}
