import {
    View,
    Text,
    SafeAreaView,
    TouchableOpacity,
    ScrollView,
    Modal,
    TextInput,
    ActivityIndicator,
    Image,
    Dimensions,
    Linking,
} from "react-native";
import React from "react";
import useAuthStore from "../../src/context/useAuthStore";
import { useRouter } from "expo-router";
import Avatar from "../../src/components/Avatar";
import ProfileStats from "../../src/components/ProfileStats";
import { Ionicons } from "@expo/vector-icons";
import apiService from "../../src/services/api/apiService";
import * as ImagePicker from "expo-image-picker";
import Logger from "../../src/utils/logger";
import PhotoOptionsModal from "../../src/components/PhotoOptionsModal";
import PermissionModal from "../../src/components/PermissionModal";
import InfoModal from "../../src/components/InfoModal";

const dummyPodcasts = [
    { id: 1, title: "My First Podcast" },
    { id: 2, title: "Tips for Beginners" },
    { id: 3, title: "Advanced Techniques" },
];

export default function Profile() {
    const user = useAuthStore((state) => state.user);
    const logout = useAuthStore((state) => state.logout);
    const router = useRouter();
    const [modalVisible, setModalVisible] = React.useState(false);
    const [avatarPreviewVisible, setAvatarPreviewVisible] =
        React.useState(false);
    const [photoOptionsVisible, setPhotoOptionsVisible] = React.useState(false);
    const [permissionModalVisible, setPermissionModalVisible] =
        React.useState(false);
    const [permissionConfig, setPermissionConfig] = React.useState({
        title: "",
        message: "",
        icon: "",
    });
    const [infoModalVisible, setInfoModalVisible] = React.useState(false);
    const [infoConfig, setInfoConfig] = React.useState({
        title: "",
        message: "",
        type: "info",
    });
    const [editName, setEditName] = React.useState(user?.name || "");
    const [loading, setLoading] = React.useState(false);
    const [error, setError] = React.useState("");
    const setUser = useAuthStore((state) => state.setUser);

    const handleLogout = async () => {
        await logout();
        router.replace("/"); // Redirect to login screen
    };

    // Modern avatar press - Preview first (Instagram/WhatsApp style)
    const handleAvatarPress = () => {
        setAvatarPreviewVisible(true);
    };

    // Photo change options after preview
    const handleChangePhoto = async () => {
        setAvatarPreviewVisible(false);
        setPhotoOptionsVisible(true);
    };

    // Production-ready camera function
    const openCamera = async () => {
        try {
            // Request camera permissions
            const { status } =
                await ImagePicker.requestCameraPermissionsAsync();
            if (status !== "granted") {
                setPermissionConfig({
                    title: "Camera Permission Required",
                    message:
                        "Please allow camera access to take photos for your profile.",
                    icon: "camera",
                });
                setPermissionModalVisible(true);
                return;
            }

            // Launch camera with optimized settings
            const result = await ImagePicker.launchCameraAsync({
                mediaTypes: ["images"], // Modern API, replaces MediaTypeOptions.Images
                allowsEditing: true,
                aspect: [1, 1], // Square aspect ratio for profile photos
                quality: 0.8, // Good quality but not too large
                exif: false, // Don't include EXIF data for privacy
            });

            if (!result.canceled && result.assets[0]) {
                await handleImageSelected(result.assets[0]);
            }
        } catch (error) {
            Logger.error("Camera error:", error);
            setInfoConfig({
                title: "Camera Error",
                message: "Failed to open camera. Please try again.",
                type: "error",
            });
            setInfoModalVisible(true);
        }
    };

    // Production-ready gallery function
    const openGallery = async () => {
        try {
            // Request media library permissions
            const { status } =
                await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== "granted") {
                setPermissionConfig({
                    title: "Photo Library Permission Required",
                    message:
                        "Please allow photo library access to select images for your profile.",
                    icon: "images",
                });
                setPermissionModalVisible(true);
                return;
            }

            // Launch image library with optimized settings
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ["images"], // Modern API, replaces MediaTypeOptions.Images
                allowsEditing: true,
                aspect: [1, 1], // Square aspect ratio for profile photos
                quality: 0.8, // Good quality but not too large
                exif: false, // Don't include EXIF data for privacy
            });

            if (!result.canceled && result.assets[0]) {
                await handleImageSelected(result.assets[0]);
            }
        } catch (error) {
            Logger.error("Gallery error:", error);
            setInfoConfig({
                title: "Gallery Error",
                message: "Failed to open photo library. Please try again.",
                type: "error",
            });
            setInfoModalVisible(true);
        }
    };

    // Handle selected image with proper validation and upload
    const handleImageSelected = async (imageAsset) => {
        try {
            // Validate image
            if (!imageAsset.uri) {
                setInfoConfig({
                    title: "Invalid Image",
                    message: "The selected image is invalid. Please try again.",
                    type: "error",
                });
                setInfoModalVisible(true);
                return;
            }

            // Check file size (limit to 5MB)
            const fileSize = imageAsset.fileSize || 0;
            const maxSize = 5 * 1024 * 1024; // 5MB
            if (fileSize > maxSize) {
                setInfoConfig({
                    title: "File Too Large",
                    message: "Please select an image smaller than 5MB.",
                    type: "error",
                });
                setInfoModalVisible(true);
                return;
            }

            // Show loading state
            setLoading(true);
            setError("");

            // Upload to server
            const updatedUser = await apiService.uploadProfilePhoto(imageAsset);

            Logger.log("👤 Updated user from server:", updatedUser);
            Logger.log("🖼️ Photo URL from server:", updatedUser.photo_url);

            // Update local user state with new photo URL
            setUser(updatedUser);

            Logger.log("✅ User state updated!");

            // Show success message
            setInfoConfig({
                title: "Photo Updated",
                message: "Your profile photo has been successfully updated!",
                type: "success",
            });
            setInfoModalVisible(true);
        } catch (error) {
            Logger.error("Image handling error:", error);
            setInfoConfig({
                title: "Upload Failed",
                message:
                    error.message ||
                    "Failed to upload photo. Please try again.",
                type: "error",
            });
            setInfoModalVisible(true);
        } finally {
            setLoading(false);
        }
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
        if (user && user.photo_url) {
            return (
                <TouchableOpacity
                    onPress={handleAvatarPress}
                    activeOpacity={0.8}
                >
                    <Avatar uri={user.photo_url} name={user.name} size={96} />
                </TouchableOpacity>
            );
        }
        return (
            <TouchableOpacity
                onPress={handleAvatarPress}
                activeOpacity={0.8}
                className="items-center justify-center"
            >
                <View className="w-24 h-24 rounded-full bg-panel items-center justify-center">
                    <Ionicons name="person" size={64} color="#888" />
                </View>
                {user?.name && (
                    <Text className="text-text-primary text-base font-semibold mt-2">
                        {user.name}
                    </Text>
                )}
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView className="flex-1 bg-background">
            {/* Avatar Preview Modal - Instagram/WhatsApp Style */}
            <Modal
                visible={avatarPreviewVisible}
                animationType="fade"
                transparent
                onRequestClose={() => setAvatarPreviewVisible(false)}
            >
                <View className="flex-1 bg-black/90 justify-center items-center">
                    {/* Close button */}
                    <TouchableOpacity
                        onPress={() => setAvatarPreviewVisible(false)}
                        className="absolute top-12 right-6 z-10"
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <Ionicons name="close" size={32} color="#FFFFFF" />
                    </TouchableOpacity>

                        {/* Large avatar preview */}
                        <View className="items-center">
                            {user && user.photo_url ? (
                                <Image
                                    source={{ uri: user.photo_url }}
                                style={{
                                    width: Dimensions.get("window").width * 0.8,
                                    height:
                                        Dimensions.get("window").width * 0.8,
                                    borderRadius:
                                        (Dimensions.get("window").width * 0.8) /
                                        2,
                                }}
                            />
                        ) : (
                            <View
                                style={{
                                    width: Dimensions.get("window").width * 0.6,
                                    height:
                                        Dimensions.get("window").width * 0.6,
                                    borderRadius:
                                        (Dimensions.get("window").width * 0.6) /
                                        2,
                                    backgroundColor: "#333",
                                    justifyContent: "center",
                                    alignItems: "center",
                                }}
                            >
                                <Ionicons
                                    name="person"
                                    size={120}
                                    color="#888"
                                />
                            </View>
                        )}

                        <Text className="text-white text-xl font-semibold mt-6">
                            {user?.name || "Profile Photo"}
                        </Text>

                        {/* Change photo button */}
                        <TouchableOpacity
                            onPress={handleChangePhoto}
                            className="mt-8 bg-primary px-8 py-3 rounded-full"
                            activeOpacity={0.8}
                            disabled={loading}
                        >
                            {loading ? (
                                <ActivityIndicator
                                    color="#FFFFFF"
                                    size="small"
                                />
                            ) : (
                                <Text className="text-white font-semibold text-base">
                                    Change Photo
                                </Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

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

            {/* Photo Options Modal */}
            <PhotoOptionsModal
                visible={photoOptionsVisible}
                onClose={() => setPhotoOptionsVisible(false)}
                onCamera={openCamera}
                onGallery={openGallery}
            />

            {/* Permission Modal */}
            <PermissionModal
                visible={permissionModalVisible}
                onClose={() => setPermissionModalVisible(false)}
                onOpenSettings={() => {
                    setPermissionModalVisible(false);
                    Linking.openSettings();
                }}
                title={permissionConfig.title}
                message={permissionConfig.message}
                icon={permissionConfig.icon}
            />

            {/* Info/Error Modal */}
            <InfoModal
                visible={infoModalVisible}
                onClose={() => setInfoModalVisible(false)}
                title={infoConfig.title}
                message={infoConfig.message}
                type={infoConfig.type}
            />

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
                <View className="px-md">
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
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}
