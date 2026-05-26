import React, { useEffect, useState } from "react";
import { COLORS, withTabScreenBottomPadding } from "../../src/constants/theme";
import {
    View,
    Text,
    SafeAreaView,
    ScrollView,
    TextInput,
    TouchableOpacity,
    ActivityIndicator,
    Image,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import apiService from "../../src/services/api/apiService";
import { useToast } from "../../src/components/Toast";

const categories = [
    "General",
    "Tech",
    "Business",
    "Education",
    "Entertainment",
    "Health",
];

export default function EditPodcast() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const params = useLocalSearchParams();
    const { showToast } = useToast();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [apiError, setApiError] = useState(null);

    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [category, setCategory] = useState("General");
    const [isPublic, setIsPublic] = useState(true);
    const [thumbnailUrl, setThumbnailUrl] = useState(null);
    const [thumbnailUploading, setThumbnailUploading] = useState(false);

    useEffect(() => {
        const load = async () => {
            try {
                setLoading(true);
                const data = await apiService.getPodcast(params.id);
                setTitle(data.title || "");
                setDescription(data.description || "");
                setCategory(data.category || "General");
                setIsPublic(data.is_public ?? true);
                setThumbnailUrl(data.thumbnail_url || null);
            } catch (e) {
                setApiError(
                    e?.detail || e?.message || "Failed to load podcast"
                );
            } finally {
                setLoading(false);
            }
        };
        if (params?.id) load();
    }, [params?.id]);

    const handlePickThumbnail = async () => {
        try {
            setApiError(null);
            const { status } =
                await ImagePicker.requestMediaLibraryPermissionsAsync();

            if (status !== "granted") {
                showToast("Photo library permission is required", "error");
                return;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ["images"],
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.8,
                exif: false,
            });

            if (result.canceled || !result.assets?.[0]) {
                return;
            }

            const asset = result.assets[0];
            if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024) {
                setApiError("Thumbnail must be 5MB or smaller");
                return;
            }

            setThumbnailUploading(true);
            const upload = await apiService.uploadPodcastThumbnail(asset);
            setThumbnailUrl(upload.image_url);
            showToast("Thumbnail updated", "success");
        } catch (e) {
            setApiError(e?.detail || e?.message || "Failed to upload thumbnail");
        } finally {
            setThumbnailUploading(false);
        }
    };

    const handleRemoveThumbnail = () => {
        setThumbnailUrl(null);
    };

    const handleSave = async () => {
        try {
            setSaving(true);
            setApiError(null);
            const updateData = {
                title: title.trim(),
                description: description.trim(),
                category: category,
                is_public: isPublic,
                thumbnail_url: thumbnailUrl,
            };
            await apiService.updatePodcast(
                params.id,
                updateData
            );
            showToast("Podcast updated", "success");
            router.replace({
                pathname: "/(main)/details",
                params: {
                    id: params.id,
                    // Pass updated data to avoid refresh
                    updatedTitle: updateData.title,
                    updatedDescription: updateData.description,
                    updatedCategory: updateData.category,
                    updatedIsPublic: updateData.is_public.toString(),
                    updatedThumbnailUrl: updateData.thumbnail_url || "",
                    refresh: Date.now().toString(), // Force refresh
                },
            });
        } catch (e) {
            // backend-validation: rely on Pydantic 422 details
            setApiError(e?.detail || e?.message || "Update failed");
        } finally {
            setSaving(false);
        }
    };

    return (
        <SafeAreaView
            className="flex-1 bg-background"
            style={{ paddingTop: insets.top }}
        >
            {/* Header */}
            <View className="flex-row items-center justify-between px-6 py-4 border-b border-border">
                <TouchableOpacity onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color={COLORS.text.primary} />
                </TouchableOpacity>
                <Text className="text-text-primary font-semibold">
                    Edit Podcast
                </Text>
                <View style={{ width: 24 }} />
            </View>

            {loading ? (
                <View className="flex-1 items-center justify-center">
                    <ActivityIndicator color={COLORS.primary} />
                </View>
            ) : (
                <ScrollView
                    className="flex-1 px-6 pt-6"
                    contentContainerStyle={withTabScreenBottomPadding(null, 24)}
                    showsVerticalScrollIndicator={false}
                >
                    {apiError ? (
                        <View className="bg-error/20 border border-error rounded-lg p-3 mb-4">
                            <Text className="text-error">{apiError}</Text>
                        </View>
                    ) : null}

                    <View className="space-y-4">
                        <View>
                            <Text className="text-text-primary font-semibold mb-2">
                                Thumbnail
                            </Text>
                            <View className="bg-card rounded-xl border border-border p-4">
                                {thumbnailUrl ? (
                                    <Image
                                        source={{ uri: thumbnailUrl }}
                                        className="w-full h-48 rounded-lg mb-3"
                                        resizeMode="cover"
                                    />
                                ) : (
                                    <View className="h-48 rounded-lg border border-dashed border-border items-center justify-center mb-3 bg-panel">
                                        <Ionicons
                                            name="image-outline"
                                            size={32}
                                            color={COLORS.text.secondary}
                                        />
                                        <Text className="text-text-secondary mt-2">
                                            No thumbnail selected
                                        </Text>
                                    </View>
                                )}

                                <View className="flex-row gap-3">
                                    <TouchableOpacity
                                        onPress={handlePickThumbnail}
                                        disabled={thumbnailUploading || saving}
                                        className="flex-1 bg-panel border border-border rounded-lg py-3 px-4 flex-row items-center justify-center"
                                    >
                                        {thumbnailUploading ? (
                                            <ActivityIndicator color={COLORS.primary} />
                                        ) : (
                                            <>
                                                <Ionicons name="images-outline" size={18} color={COLORS.text.primary} />
                                                <Text className="text-text-primary font-medium ml-2">
                                                    {thumbnailUrl ? "Change Image" : "Select Image"}
                                                </Text>
                                            </>
                                        )}
                                    </TouchableOpacity>

                                    {thumbnailUrl ? (
                                        <TouchableOpacity
                                            onPress={handleRemoveThumbnail}
                                            disabled={thumbnailUploading || saving}
                                            className="px-4 rounded-lg border border-border items-center justify-center"
                                        >
                                            <Ionicons name="trash-outline" size={18} color={COLORS.text.secondary} />
                                        </TouchableOpacity>
                                    ) : null}
                                </View>
                            </View>
                        </View>

                        <View>
                            <Text className="text-text-primary font-semibold mb-2">
                                Title
                            </Text>
                            <TextInput
                                className="bg-card rounded-lg px-4 py-3 text-text-primary border border-border"
                                placeholder="Enter title"
                                placeholderTextColor="#888"
                                value={title}
                                onChangeText={setTitle}
                                maxLength={100}
                            />
                        </View>

                        <View>
                            <Text className="text-text-primary font-semibold mb-2">
                                Description
                            </Text>
                            <TextInput
                                className="bg-card rounded-lg px-4 py-3 text-text-primary border border-border"
                                placeholder="Description"
                                placeholderTextColor="#888"
                                value={description}
                                onChangeText={setDescription}
                                multiline
                                numberOfLines={4}
                                maxLength={500}
                                textAlignVertical="top"
                            />
                        </View>

                        <View>
                            <Text className="text-text-primary font-semibold mb-2">
                                Category
                            </Text>
                            <View className="flex-row flex-wrap gap-2">
                                {categories.map((cat) => (
                                    <TouchableOpacity
                                        key={cat}
                                        onPress={() => setCategory(cat)}
                                        className={`px-4 py-2 rounded-full border ${
                                            category === cat
                                                ? "bg-primary border-primary"
                                                : "bg-panel border-border"
                                        }`}
                                    >
                                        <Text
                                            className={`${
                                                category === cat
                                                    ? "text-white"
                                                    : "text-text-secondary"
                                            }`}
                                        >
                                            {cat}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        <View className="flex-row items-center justify-between py-2">
                            <Text className="text-text-primary font-semibold">
                                Make Public
                            </Text>
                            <TouchableOpacity
                                onPress={() => setIsPublic(!isPublic)}
                                className={`w-12 h-6 rounded-full ${
                                    isPublic ? "bg-primary" : "bg-border"
                                }`}
                            >
                                <View
                                    className={`w-5 h-5 bg-white rounded-full m-0.5 ${
                                        isPublic ? "ml-auto" : ""
                                    }`}
                                />
                            </TouchableOpacity>
                        </View>
                    </View>

                    <TouchableOpacity
                        onPress={handleSave}
                        disabled={saving || thumbnailUploading}
                        className="bg-primary py-4 rounded-lg mt-8"
                    >
                        {saving ? (
                            <View className="flex-row items-center justify-center">
                                <ActivityIndicator color="white" />
                                <Text className="text-white font-semibold ml-2">
                                    Saving...
                                </Text>
                            </View>
                        ) : (
                            <Text className="text-white text-center font-semibold">
                                Save Changes
                            </Text>
                        )}
                    </TouchableOpacity>
                </ScrollView>
            )}
        </SafeAreaView>
    );
}
