import React, { useState, useEffect } from "react";
import { View, Text, FlatList, ActivityIndicator } from "react-native";
import PodcastCard from "./PodcastCard";
import RecommendationsService from "../services/ai/RecommendationsService";
import Logger from "../utils/logger";
import { normalizePodcasts } from "../utils/urlHelper";

/**
 * AI-Powered Recommended Podcasts Component
 *
 * Displays personalized podcast recommendations using AI analysis.
 * Automatically updates based on user's listening history and preferences.
 *
 * Features:
 * - Smart caching for performance
 * - Loading states
 * - Error handling with graceful fallback
 * - Responsive layout
 */
const RecommendedPodcasts = ({
    title = "🤖 AI Recommendations",
    limit = 5,
    onPodcastPress,
    onPlayPress,
    horizontal = true,
}) => {
    const [recommendations, setRecommendations] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        loadRecommendations();
    }, [limit]);

    const loadRecommendations = async () => {
        try {
            setIsLoading(true);
            setError(null);

            const recs =
                await RecommendationsService.getPersonalizedRecommendations(
                    limit
                );
            // Normalize URLs (relative to absolute)
            setRecommendations(normalizePodcasts(recs));

            Logger.log(`✅ Loaded ${recs.length} recommendations`);
        } catch (err) {
            Logger.error("Failed to load recommendations:", err);
            setError("Failed to load recommendations");
        } finally {
            setIsLoading(false);
        }
    };

    const renderPodcastItem = ({ item }) => (
        <View className={horizontal ? "mr-3" : "mb-3"}>
            <PodcastCard
                podcast={item}
                onPress={() => onPodcastPress && onPodcastPress(item)}
                onPlayPress={() => onPlayPress && onPlayPress(item)}
                showPlayButton={true}
            />
        </View>
    );

    if (isLoading) {
        return (
            <View className="py-4">
                <Text className="text-headline text-text-primary mb-md px-4">
                    {title}
                </Text>
                <View className="flex-row items-center justify-center py-8">
                    <ActivityIndicator size="large" color="#D32F2F" />
                    <Text className="text-text-secondary ml-3">
                        Analyzing your preferences...
                    </Text>
                </View>
            </View>
        );
    }

    if (error || recommendations.length === 0) {
        return null; // Don't show section if no recommendations
    }

    return (
        <View className="py-4">
            <Text className="text-headline text-text-primary mb-md px-4">
                {title}
            </Text>
            <FlatList
                data={recommendations}
                renderItem={renderPodcastItem}
                keyExtractor={(item) => item.id.toString()}
                horizontal={horizontal}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 16 }}
            />
        </View>
    );
};

export default RecommendedPodcasts;
