import { View, Text, SafeAreaView } from "react-native";
import React from "react";

const Profile = () => {
    return (
        <SafeAreaView className="flex-1 bg-background">
            <View className="flex-1 items-center justify-center">
                <Text className="text-2xl text-text-primary">
                    Profile Screen
                </Text>
            </View>
        </SafeAreaView>
    );
};

export default Profile;
