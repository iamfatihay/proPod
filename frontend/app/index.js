import { View, Text } from "react-native";
import LoginScreen from "../src/screens/LoginScreen";
import useAuthStore from "../src/context/useAuthStore";
import { Stack } from "expo-router";

export default function HomeScreen() {
    const user = useAuthStore((state) => state.user);
    // Eğer kullanıcı login olduysa ana ekranı, yoksa login ekranını göster
    if (!user) {
        return <LoginScreen />;
    }
    return (
        <View className="flex-1 bg-background justify-center items-center">
            <Text className="text-text-primary text-xl font-bold">
                Welcome, {user.email}
            </Text>
        </View>
    );
}

HomeScreen.options = {
    headerShown: false,
};
