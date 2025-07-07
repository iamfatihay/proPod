import { View, Text, SafeAreaView, TouchableOpacity } from "react-native";
import React from "react";
import useAuthStore from "../../src/context/useAuthStore";
import { useRouter } from "expo-router";

const Profile = () => {
    const logout = useAuthStore((state) => state.logout);
    const router = useRouter();

    const handleLogout = async () => {
        await logout();
        router.replace("/"); // Redirect to login screen
    };

    return (
        <SafeAreaView className="flex-1 bg-background">
            <View className="flex-1 items-center justify-center">
                <Text className="text-2xl text-text-primary">
                    Profile Screen
                </Text>
                <TouchableOpacity
                    className="mt-8 bg-primary px-6 py-3 rounded-lg"
                    onPress={handleLogout}
                >
                    <Text className="text-white font-semibold text-base">
                        Logout
                    </Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
};

export default Profile;
