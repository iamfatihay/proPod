import { View, Text, StyleSheet, Button } from "react-native";
import { Colors } from "../constants/Colors";
import { useRouter } from "expo-router";

export default function HomeScreen() {
    const router = useRouter();
    return (
        <View style={styles.container}>
            <Text style={styles.title}>Ana Sayfa</Text>
            <Button
                title="Detaylara Git"
                onPress={() => router.push("/details")}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: Colors.background,
    },
    title: {
        fontSize: 24,
        fontWeight: "bold",
        color: Colors.textPrimary,
    },
});
