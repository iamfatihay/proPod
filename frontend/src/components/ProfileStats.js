import { View, Text } from "react-native";
import React from "react";

// ProfileStats component for displaying user stats (followers, following, posts)
const ProfileStats = ({ followers = 0, following = 0, posts = 0 }) => {
    return (
        <View className="flex-row justify-center gap-x-md my-md">
            <View className="items-center">
                <Text className="text-title text-text-primary font-bold">
                    {followers}
                </Text>
                <Text className="text-caption text-text-secondary">
                    Followers
                </Text>
            </View>
            <View className="items-center">
                <Text className="text-title text-text-primary font-bold">
                    {following}
                </Text>
                <Text className="text-caption text-text-secondary">
                    Following
                </Text>
            </View>
            <View className="items-center">
                <Text className="text-title text-text-primary font-bold">
                    {posts}
                </Text>
                <Text className="text-caption text-text-secondary">Posts</Text>
            </View>
        </View>
    );
};

export default ProfileStats;
