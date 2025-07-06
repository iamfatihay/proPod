import { View, Text, SafeAreaView } from "react-native";
import React from "react";

const Search = () => {
    return (
        <SafeAreaView className="flex-1 bg-background">
            <View className="flex-1 items-center justify-center">
                <Text className="text-2xl text-text-primary">
                    Search Screen
                </Text>
            </View>
        </SafeAreaView>
    );
};

export default Search;
