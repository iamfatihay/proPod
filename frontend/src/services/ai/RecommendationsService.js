import apiService from "../api/apiService";
import Logger from "../../utils/logger";

/**
 * AI-Powered Recommendations Service
 *
 * Provides intelligent podcast recommendations based on:
 * - User's listening history
 * - Podcast categories and keywords
 * - AI-analyzed content similarity
 * - User interactions (likes, bookmarks)
 *
 * Uses backend AI services for content analysis and similarity matching.
 */
class RecommendationsService {
    constructor() {
        this.cache = new Map();
        this.cacheExpiry = 5 * 60 * 1000; // 5 minutes
    }

    /**
     * Get personalized podcast recommendations for current user
     * @param {number} limit - Number of recommendations to return
     * @returns {Promise<Array>} Array of recommended podcasts
     */
    async getPersonalizedRecommendations(limit = 10) {
        try {
            const cacheKey = `recommendations_${limit}`;

            // Check cache
            if (this.cache.has(cacheKey)) {
                const cached = this.cache.get(cacheKey);
                if (Date.now() - cached.timestamp < this.cacheExpiry) {
                    Logger.log("📚 Returning cached recommendations");
                    return cached.data;
                }
            }

            Logger.log("🤖 Fetching AI-powered recommendations...");

            // Get user's listening history and preferences
            const [listeningHistory, likedPodcasts, allPodcasts] =
                await Promise.all([
                    this.getUserListeningHistory(),
                    this.getUserLikedPodcasts(),
                    apiService.getPodcasts({ limit: limit * 2 }), // Get more for filtering
                ]);

            // Validate that allPodcasts is an array
            if (!Array.isArray(allPodcasts)) {
                Logger.error("getPodcasts returned invalid data:", allPodcasts);
                return [];
            }

            // Extract categories and keywords from user's preferences
            const preferredCategories = this.extractPreferredCategories([
                ...listeningHistory,
                ...likedPodcasts,
            ]);

            const preferredKeywords = this.extractPreferredKeywords([
                ...listeningHistory,
                ...likedPodcasts,
            ]);

            // Filter and score podcasts
            const recommendations = allPodcasts
                .filter((podcast) => {
                    // Exclude already listened/liked podcasts
                    const alreadyInteracted = [
                        ...listeningHistory,
                        ...likedPodcasts,
                    ].some((p) => p.id === podcast.id);
                    return !alreadyInteracted && podcast.ai_enhanced;
                })
                .map((podcast) => ({
                    ...podcast,
                    score: this.calculateRelevanceScore(
                        podcast,
                        preferredCategories,
                        preferredKeywords
                    ),
                }))
                .sort((a, b) => b.score - a.score)
                .slice(0, limit);

            // Cache results
            this.cache.set(cacheKey, {
                data: recommendations,
                timestamp: Date.now(),
            });

            Logger.log(
                `✅ Generated ${recommendations.length} recommendations`
            );
            return recommendations;
        } catch (error) {
            Logger.error("Failed to get recommendations:", error);
            // Return empty array on error instead of throwing
            return [];
        }
    }

    /**
     * Get recommendations based on a specific podcast
     * @param {number} podcastId - ID of the reference podcast
     * @param {number} limit - Number of recommendations to return
     * @returns {Promise<Array>} Array of similar podcasts
     */
    async getSimilarPodcasts(podcastId, limit = 5) {
        try {
            Logger.log(`🔍 Finding podcasts similar to ${podcastId}...`);

            // Get the reference podcast
            const referencePodcast = await apiService.getPodcast(podcastId);

            if (!referencePodcast) {
                return [];
            }

            // Get all podcasts for comparison
            const allPodcasts = await apiService.getPodcasts(limit * 3);

            // Find similar podcasts based on AI-analyzed content
            const similarPodcasts = allPodcasts
                .filter((p) => p.id !== podcastId && p.ai_enhanced)
                .map((podcast) => ({
                    ...podcast,
                    similarity: this.calculateSimilarity(
                        referencePodcast,
                        podcast
                    ),
                }))
                .sort((a, b) => b.similarity - a.similarity)
                .slice(0, limit);

            Logger.log(`✅ Found ${similarPodcasts.length} similar podcasts`);
            return similarPodcasts;
        } catch (error) {
            Logger.error("Failed to get similar podcasts:", error);
            return [];
        }
    }

    /**
     * Calculate relevance score based on user preferences
     * @private
     */
    calculateRelevanceScore(podcast, preferredCategories, preferredKeywords) {
        let score = 0;

        // Category match (40% weight)
        if (preferredCategories.includes(podcast.category)) {
            score += 0.4;
        }

        // Keyword match (30% weight)
        if (podcast.ai_keywords) {
            const podcastKeywords = podcast.ai_keywords
                .toLowerCase()
                .split(",");
            const matchedKeywords = podcastKeywords.filter((kw) =>
                preferredKeywords.some((pref) => kw.includes(pref))
            );
            score +=
                (matchedKeywords.length / Math.max(podcastKeywords.length, 1)) *
                0.3;
        }

        // AI sentiment match (15% weight)
        if (podcast.ai_sentiment) {
            try {
                const sentiment = JSON.parse(podcast.ai_sentiment);
                if (sentiment.compound > 0.5) {
                    // Prefer positive content
                    score += 0.15;
                }
            } catch (e) {
                // Ignore parse errors
            }
        }

        // Popularity boost (15% weight)
        const popularityScore =
            Math.min((podcast.play_count || 0) / 100, 1) * 0.15;
        score += popularityScore;

        return score;
    }

    /**
     * Calculate similarity between two podcasts
     * @private
     */
    calculateSimilarity(podcast1, podcast2) {
        let similarity = 0;

        // Category match (50% weight)
        if (podcast1.category === podcast2.category) {
            similarity += 0.5;
        }

        // Keyword overlap (30% weight)
        if (podcast1.ai_keywords && podcast2.ai_keywords) {
            const keywords1 = podcast1.ai_keywords.toLowerCase().split(",");
            const keywords2 = podcast2.ai_keywords.toLowerCase().split(",");
            const overlap = keywords1.filter((kw1) =>
                keywords2.some((kw2) => kw2.includes(kw1) || kw1.includes(kw2))
            ).length;
            similarity +=
                (overlap / Math.max(keywords1.length, keywords2.length)) * 0.3;
        }

        // Sentiment similarity (20% weight)
        if (podcast1.ai_sentiment && podcast2.ai_sentiment) {
            try {
                const sentiment1 = JSON.parse(podcast1.ai_sentiment);
                const sentiment2 = JSON.parse(podcast2.ai_sentiment);
                const sentimentDiff = Math.abs(
                    sentiment1.compound - sentiment2.compound
                );
                similarity += (1 - sentimentDiff) * 0.2;
            } catch (e) {
                // Ignore parse errors
            }
        }

        return similarity;
    }

    /**
     * Extract preferred categories from user's history
     * @private
     */
    extractPreferredCategories(podcasts) {
        const categoryCounts = {};
        podcasts.forEach((p) => {
            categoryCounts[p.category] = (categoryCounts[p.category] || 0) + 1;
        });

        // Return top 3 categories
        return Object.entries(categoryCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([category]) => category);
    }

    /**
     * Extract preferred keywords from user's history
     * @private
     */
    extractPreferredKeywords(podcasts) {
        const keywordCounts = {};

        podcasts.forEach((p) => {
            if (p.ai_keywords) {
                const keywords = p.ai_keywords.toLowerCase().split(",");
                keywords.forEach((kw) => {
                    const trimmed = kw.trim();
                    keywordCounts[trimmed] = (keywordCounts[trimmed] || 0) + 1;
                });
            }
        });

        // Return top 5 keywords
        return Object.entries(keywordCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([keyword]) => keyword);
    }

    /**
     * Get user's listening history
     * @private
     */
    async getUserListeningHistory() {
        try {
            // This would typically come from a dedicated endpoint
            // For now, we'll return empty array as fallback
            return [];
        } catch (error) {
            Logger.error("Failed to get listening history:", error);
            return [];
        }
    }

    /**
     * Get user's liked podcasts
     * @private
     */
    async getUserLikedPodcasts() {
        try {
            // This would typically come from a dedicated endpoint
            // For now, we'll return empty array as fallback
            return [];
        } catch (error) {
            Logger.error("Failed to get liked podcasts:", error);
            return [];
        }
    }

    /**
     * Clear recommendation cache
     */
    clearCache() {
        this.cache.clear();
        Logger.log("🗑️ Recommendations cache cleared");
    }
}

// Export singleton instance
export default new RecommendationsService();
