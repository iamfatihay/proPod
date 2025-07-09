import {
    View,
    Text,
    SafeAreaView,
    Switch,
    TouchableOpacity,
} from "react-native";
import React, { useState } from "react";
import { useRouter } from "expo-router";
import SettingRow from "../../src/components/SettingRow";

const Settings = () => {
    const router = useRouter();
    const [isDarkMode, setIsDarkMode] = useState(false);
    const [notifications, setNotifications] = useState(true);
    const [language, setLanguage] = useState("English");

    // Dummy handler for language change
    const handleLanguage = () => {
        setLanguage(language === "English" ? "Türkçe" : "English");
    };

    // Dummy handler for account settings
    const handleAccount = () => {
        // TODO: Implement account settings navigation
    };

    return (
        <SafeAreaView className="flex-1 bg-background">
            <View className="flex-row items-center px-md py-lg border-b border-borderLight bg-panel">
                {/* Back button */}
                <TouchableOpacity
                    onPress={() => router.back()}
                    className="mr-md"
                >
                    <Text className="text-title text-text-primary">←</Text>
                </TouchableOpacity>
                <Text className="text-headline text-text-primary">
                    Settings
                </Text>
            </View>
            <View className="mt-lg">
                {/* Language selection */}
                <SettingRow
                    label="Language"
                    value={language}
                    onPress={handleLanguage}
                />
                {/* Theme switch */}
                <SettingRow
                    label="Dark Mode"
                    right={
                        <Switch
                            value={isDarkMode}
                            onValueChange={setIsDarkMode}
                            thumbColor={isDarkMode ? "#D32F2F" : "#888888"}
                            trackColor={{ false: "#444444", true: "#232323" }}
                        />
                    }
                />
                {/* Notifications switch */}
                <SettingRow
                    label="Notifications"
                    right={
                        <Switch
                            value={notifications}
                            onValueChange={setNotifications}
                            thumbColor={notifications ? "#10B981" : "#888888"}
                            trackColor={{ false: "#444444", true: "#232323" }}
                        />
                    }
                />
                {/* Account settings */}
                <SettingRow label="Account Settings" onPress={handleAccount} />
            </View>
        </SafeAreaView>
    );
};

export default Settings;
