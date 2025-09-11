import {
    View,
    Text,
    SafeAreaView,
    FlatList,
    ActivityIndicator,
    TouchableOpacity,
} from "react-native";
import React, { useEffect, useState, useCallback } from "react";
import apiService from "../../src/services/api/apiService";
import PodcastCard from "../../src/components/PodcastCard";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const Library = () => {
    const router = useRouter();
    const [tab, setTab] = useState("mine"); // mine | likes | bookmarks
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const load = useCallback(async () => {
        try {
            let res;
            if (tab === "mine") res = await apiService.getMyPodcasts();
            else if (tab === "likes") res = await apiService.getLikedPodcasts();
            else res = await apiService.getBookmarkedPodcasts();
            const list = res.podcasts || res || [];
            const normalized = list.map((p) => ({
                ...p,
                duration: (p.duration || 0) * 1000,
            }));
            setItems(normalized);
            setError(null);
        } catch (e) {
            setError(e?.detail || e?.message || "Failed to load library");
        }
    }, [tab]);

    useEffect(() => {
        (async () => {
            setLoading(true);
            await load();
            setLoading(false);
        })();
    }, [load]);

    const insets = useSafeAreaInsets();

    return (
        <SafeAreaView
            className="flex-1 bg-background"
            style={{ paddingTop: insets.top }}
        >
            <View className="px-4 pt-6">
                {/* Tabs */}
                <View className="flex-row bg-panel rounded-xl p-1 mb-4 border border-border">
                    {[
                        { key: "mine", label: "My Podcasts" },
                        { key: "likes", label: "Likes" },
                        { key: "bookmarks", label: "Bookmarks" },
                    ].map((t) => (
                        <TouchableOpacity
                            key={t.key}
                            onPress={() => setTab(t.key)}
                            className={`flex-1 py-2 rounded-lg ${
                                tab === t.key ? "bg-primary" : ""
                            }`}
                        >
                            <Text
                                className={`text-center ${
                                    tab === t.key
                                        ? "text-white"
                                        : "text-text-secondary"
                                }`}
                            >
                                {t.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {loading ? (
                    <View className="py-10 items-center">
                        <ActivityIndicator color="#D32F2F" />
                    </View>
                ) : error ? (
                    <Text className="text-text-secondary">{error}</Text>
                ) : (
                    <FlatList
                        data={items}
                        keyExtractor={(item) => String(item.id)}
                        renderItem={({ item }) => (
                            <PodcastCard
                                podcast={item}
                                onPress={() =>
                                    router.push({
                                        pathname: "/(main)/details",
                                        params: { id: item.id },
                                    })
                                }
                            />
                        )}
                        showsVerticalScrollIndicator={false}
                    />
                )}
            </View>
        </SafeAreaView>
    );
};

export default Library;
