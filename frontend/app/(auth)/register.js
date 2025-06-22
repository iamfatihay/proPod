import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, Image } from "react-native";
import { Link, useRouter } from "expo-router";
import apiService from "../../src/services/api/apiService";

export default function RegisterScreen() {
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState(false);
    const router = useRouter();

    const handleRegister = async () => {
        setLoading(true);
        setError("");
        setSuccess(false);
        try {
            await apiService.register(name, email, password);
            setSuccess(true);
            setTimeout(() => router.replace("/"), 1000);
        } catch (err) {
            setError("Registration failed. Try a different email.");
        } finally {
            setLoading(false);
        }
    };

    return (
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
            {error ? <Text className="text-red-500 mb-2">{error}</Text> : null}
            {success ? (
                <Text className="text-green-500 mb-2">
                    Registration successful! Redirecting...
                </Text>
            ) : null}
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
    );
}
