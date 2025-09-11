import React, { useEffect, useState } from "react";
import {
    View,
    Text,
    SafeAreaView,
    ScrollView,
    TextInput,
    TouchableOpacity,
    ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
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

    useEffect(() => {
        const load = async () => {
            try {
                setLoading(true);
                const data = await apiService.getPodcast(params.id);
                setTitle(data.title || "");
                setDescription(data.description || "");
                setCategory(data.category || "General");
                setIsPublic(data.is_public ?? true);
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

    const handleSave = async () => {
        try {
            setSaving(true);
            setApiError(null);
            const updateData = {
                title: title.trim() || undefined,
                description: description.trim() || undefined,
                category: category || undefined,
                is_public: isPublic,
            };
            await apiService.updatePodcast(params.id, updateData);
            showToast("Podcast updated", "success");
            router.replace({
                pathname: "/(main)/details",
                params: { id: params.id },
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
                    <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
                </TouchableOpacity>
                <Text className="text-text-primary font-semibold">
                    Edit Podcast
                </Text>
                <View style={{ width: 24 }} />
            </View>

            {loading ? (
                <View className="flex-1 items-center justify-center">
                    <ActivityIndicator color="#D32F2F" />
                </View>
            ) : (
                <ScrollView
                    className="flex-1 px-6 pt-6"
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
                        disabled={saving}
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
