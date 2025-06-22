import { View, Text, Button } from "react-native";
import { useRouter } from "expo-router";
import useAuthStore from "../../src/context/useAuthStore";

export default function HomeScreen() {
    const router = useRouter();
    const { user, logout } = useAuthStore();

    const handleLogout = () => {
        logout();
        // After logout, the user should be redirected to the login screen.
        // This is typically handled by the navigation setup (e.g., in _layout.js)
        // based on the user's authentication state.
    };

    return (
        <View className="flex-1 items-center justify-center bg-background">
            <Text className="text-2xl font-bold text-text-primary mb-4">
                Welcome, {user?.name}!
            </Text>
            <Button
                title="Go to Details"
                onPress={() => router.push("/details")}
                color="#D32F2F"
            />
            <View className="mt-4" />
            <Button title="Logout" onPress={handleLogout} color="#888" />
        </View>
    );
}
