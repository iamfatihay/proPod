import {
    View,
    Text,
    SafeAreaView,
    TouchableOpacity,
    ScrollView,
    Modal,
    TextInput,
    ActivityIndicator,
} from "react-native";
import React from "react";
import useAuthStore from "../../src/context/useAuthStore";
import { useRouter } from "expo-router";
import Avatar from "../../src/components/Avatar";
import ProfileStats from "../../src/components/ProfileStats";
import { Ionicons } from "@expo/vector-icons";
import apiService from "../../src/services/api/apiService";

const dummyPodcasts = [
    { id: 1, title: "My First Podcast" },
    { id: 2, title: "Tips for Beginners" },
    { id: 3, title: "Advanced Techniques" },
];

const Profile = () => {
    const user = useAuthStore((state) => state.user);
    const logout = useAuthStore((state) => state.logout);
    const router = useRouter();
    const [modalVisible, setModalVisible] = React.useState(false);
    const [editName, setEditName] = React.useState(user?.name || "");
    const [loading, setLoading] = React.useState(false);
    const [error, setError] = React.useState("");
    const setUser = useAuthStore((state) => state.setUser);

    const handleLogout = async () => {
        await logout();
        router.replace("/"); // Redirect to login screen
    };

    const handleSettings = () => {
        router.push("/settings");
    };

    const handleEditProfile = () => {
        setEditName(user?.name || "");
        setError("");
        setModalVisible(true);
    };

    const handleSaveProfile = async () => {
        if (!editName.trim()) {
            setError("Name cannot be empty");
            return;
        }
        setLoading(true);
        setError("");
        try {
            // Backend'e güncelleme isteği at
            const updated = await apiService.updateProfile({ name: editName });
            setUser(updated.user);
            setModalVisible(false);
        } catch (e) {
            setError("Update failed. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    // Avatar logic: Google photo varsa onu göster, yoksa user icon
    const renderAvatar = () => {
        if (user && user.photoURL) {
            return <Avatar uri={user.photoURL} name={user.name} size={96} />;
        }
        return (
            <View className="items-center justify-center">
                <View className="w-24 h-24 rounded-full bg-panel items-center justify-center">
                    <Ionicons name="person" size={64} color="#888" />
                </View>
                {user?.name && (
                    <Text className="text-text-primary text-base font-semibold mt-2">
                        {user.name}
                    </Text>
                )}
            </View>
        );
    };

    return (
        <SafeAreaView className="flex-1 bg-background">
            {/* Edit Profile Modal */}
            <Modal
                visible={modalVisible}
                animationType="slide"
                transparent
                onRequestClose={() => setModalVisible(false)}
            >
                <View className="flex-1 justify-center items-center bg-black/40">
                    <View className="w-11/12 bg-panel rounded-2xl p-6 shadow-lg">
                        <Text className="text-headline text-text-primary mb-4 text-center">
                            Edit Profile
                        </Text>
                        <Text className="text-body text-text-secondary mb-2">
                            Name
                        </Text>
                        <TextInput
                            className="bg-card rounded-lg px-4 py-3 text-text-primary border border-border mb-4"
                            value={editName}
                            onChangeText={setEditName}
                            placeholder="Your name"
                        />
                        {error ? (
                            <Text className="text-red-500 mb-2 text-center">
                                {error}
                            </Text>
                        ) : null}
                        <View className="flex-row justify-between mt-2">
                            <TouchableOpacity
                                className="bg-panel border border-border rounded-lg px-6 py-2 items-center"
                                onPress={() => setModalVisible(false)}
                                disabled={loading}
                            >
                                <Text className="text-text-secondary">
                                    Cancel
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                className="bg-primary rounded-lg px-6 py-2 items-center ml-2 disabled:opacity-50"
                                onPress={handleSaveProfile}
                                disabled={loading}
                            >
                                {loading ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <Text className="text-white font-semibold">
                                        Save
                                    </Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
            <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
                <View className="items-center mt-xl mb-lg">
                    {/* User Avatar and Name */}
                    {renderAvatar()}
                    <Text className="text-text-secondary text-base mt-1">
                        {user?.email}
                    </Text>
                    {/* Edit Profile Button */}
                    <TouchableOpacity
                        className="mt-md w-1/2 px-0 py-3 bg-panel rounded-lg border border-borderLight shadow-sm items-center"
                        onPress={handleEditProfile}
                        activeOpacity={0.8}
                    >
                        <Text className="text-text-primary font-medium">
                            Edit Profile
                        </Text>
                    </TouchableOpacity>
                </View>
                {/* User Stats */}
                <ProfileStats
                    followers={123} // dummy
                    following={80} // dummy
                    posts={12} // dummy
                />
                {/* User Content List (Podcasts) */}
                <View className="mt-lg px-md">
                    <Text className="text-headline text-text-primary mb-md">
                        My Podcasts
                    </Text>
                    {dummyPodcasts.map((podcast) => (
                        <View
                            key={podcast.id}
                            className="bg-card rounded-md px-md py-sm mb-sm"
                        >
                            <Text className="text-body text-text-primary">
                                {podcast.title}
                            </Text>
                        </View>
                    ))}
                </View>
                {/* Go to Settings Button */}
                <TouchableOpacity
                    className="mt-xl w-full py-3 bg-panel rounded-lg border border-borderLight items-center shadow-sm"
                    onPress={handleSettings}
                    activeOpacity={0.85}
                >
                    <Text className="text-text-primary font-semibold text-base">
                        Settings
                    </Text>
                </TouchableOpacity>
                {/* Logout Button */}
                <TouchableOpacity
                    className="mt-md w-full py-3 bg-error rounded-lg items-center shadow-sm"
                    onPress={handleLogout}
                    activeOpacity={0.85}
                >
                    <Text className="text-white font-semibold text-base">
                        Logout
                    </Text>
                </TouchableOpacity>
            </ScrollView>
        </SafeAreaView>
    );
};

export default Profile;
