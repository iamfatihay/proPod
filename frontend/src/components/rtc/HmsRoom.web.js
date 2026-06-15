import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";

const HmsRoom = ({ roomName, onClose }) => {
    return (
        <View style={styles.container}>
            <Text style={styles.title}>Live room is not available on web</Text>

            <Text style={styles.message}>
                100ms live sessions are supported only in the native development build.
                Use the mobile app to join or host a live room.
            </Text>

            {roomName ? (
                <Text style={styles.roomName}>Room: {roomName}</Text>
            ) : null}

            {onClose ? (
                <TouchableOpacity style={styles.button} onPress={onClose}>
                    <Text style={styles.buttonText}>Close</Text>
                </TouchableOpacity>
            ) : null}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        backgroundColor: "#ffffff",
    },
    title: {
        fontSize: 18,
        fontWeight: "700",
        textAlign: "center",
        color: "#111111",
    },
    message: {
        marginTop: 8,
        fontSize: 14,
        lineHeight: 20,
        textAlign: "center",
        color: "#666666",
    },
    roomName: {
        marginTop: 12,
        fontSize: 13,
        color: "#666666",
    },
    button: {
        marginTop: 24,
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 8,
        backgroundColor: "#111111",
    },
    buttonText: {
        color: "#ffffff",
        fontWeight: "600",
    },
});

export default HmsRoom;
