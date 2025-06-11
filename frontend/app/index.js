import { View, Text, TouchableOpacity } from "react-native";
import { Link } from "expo-router";

export default function HomeScreen() {
    return (
        <View className="flex-1 bg-background justify-center items-center">
            <Text className="text-white text-xl font-bold mb-4">Ana Sayfa</Text>
            <Link href="/details" asChild>
                <TouchableOpacity className="bg-primary px-4 py-2 rounded-lg">
                    <Text className="text-white font-semibold">
                        Detaylara Git
                    </Text>
                </TouchableOpacity>
            </Link>
        </View>
    );
}
