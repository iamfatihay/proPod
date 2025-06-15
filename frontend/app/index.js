import { View, Text, TouchableOpacity } from "react-native";
import { Link } from "expo-router";
import LoginScreen from "../src/screens/LoginScreen";

export default function HomeScreen() {
    // TODO: Auth kontrolü eklenecek, şimdilik her zaman login göster
    return <LoginScreen />;
}
