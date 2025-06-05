import { View, Text, StyleSheet } from "react-native";

export default function DetailsScreen() {
    return (
        <View style={styles.container}>
            <Text style={styles.title}>Detaylar</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#fff",
    },
    title: {
        fontSize: 20,
        fontWeight: "bold",
        color: "#16a34a",
    },
});
