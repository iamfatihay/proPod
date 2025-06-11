import { View, Text, Button } from "react-native";
import { useRouter } from "expo-router";

export default function HomeScreen() {
    const router = useRouter();
    return (
        <View className="flex-1 items-center justify-center bg-black">
            <Text className="text-2xl font-bold text-white mb-4">
                Ana Sayfa
            </Text>
            <Button
                title="Detaylara Git"
                onPress={() => router.push("/details")}
                color="#D32F2F"
            />
        </View>
    );
}
