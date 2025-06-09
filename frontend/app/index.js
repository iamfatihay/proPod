import { View, Text, TouchableOpacity } from "react-native";
import { Link } from "expo-router";

export default function HomeScreen() {
    return (
        <View>
            <Text>Ana Sayfa</Text>
            <Link href="/details" asChild>
                <TouchableOpacity>
                    <Text>Detaylara Git</Text>
                </TouchableOpacity>
            </Link>
        </View>
    );
}
