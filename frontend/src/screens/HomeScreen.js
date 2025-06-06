import { View, Text, StyleSheet } from "react-native";
import { Colors } from "../constants/Colors";

export default function HomeScreen() {
    return (
        <View style={styles.container}>
            <Text style={styles.title}>Ana Sayfa</Text>
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
