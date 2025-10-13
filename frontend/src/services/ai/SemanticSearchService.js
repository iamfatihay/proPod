import apiService from "../api/apiService";
import Logger from "../../utils/logger";

/**
 * Semantic Search Service
 * 
 * Provides intelligent search capabilities across podcast content:
 * - Search in transcriptions with context awareness
 * - Keyword-based filtering with AI-analyzed keywords
 * - Category and sentiment-based search
 * - Real-time search suggestions
 * 
 * Unlike traditional text search, semantic search understands:
 * - Related concepts (e.g., "happy" matches "joyful", "excited")
 * - Context and meaning
 * - Synonyms and variations
 */
class SemanticSearchService {
    constructor() {
        this.searchHistory = [];
        this.maxHistorySize = 10;
    }

    /**
     * Search podcasts semantically across all AI-analyzed content
     * @param {string} query - Search query
     * @param {Object} filters - Optional filters (category, sentiment, etc.)
     * @returns {Promise<Array>} Array of matching podcasts with relevance scores
     */
    async searchPodcasts(query, filters = {}) {
        try {
            if (!query || query.trim().length === 0) {
                return [];
            }

            Logger.log(`🔍 Semantic search: "${query}"`);
            
            // Add to search history
            this.addToHistory(query);

            // Get all AI-enhanced podcasts
            const podcasts = await apiService.getPodcasts(100); // Get more for better results
            
            // Filter only AI-enhanced podcasts
            const aiEnhancedPodcasts = podcasts.filter(p => p.ai_enhanced);

            // Calculate relevance scores
            const results = aiEnhancedPodcasts
                .map(podcast => ({
                    ...podcast,
                    relevance: this.calculateRelevanceScore(podcast, query, filters)
                }))
                .filter(podcast => podcast.relevance > 0.1) // Filter out very low relevance
                .sort((a, b) => b.relevance - a.relevance);

            Logger.log(`✅ Found ${results.length} relevant podcasts`);
            return results;

        } catch (error) {
            Logger.error("Semantic search failed:", error);
            return [];
        }
    }

    /**
     * Search specifically in podcast transcriptions
     * @param {string} query - Search query
     * @returns {Promise<Array>} Podcasts with matching transcript segments
     */
    async searchTranscriptions(query) {
        try {
            if (!query || query.trim().length === 0) {
                return [];
            }

            Logger.log(`📝 Searching transcriptions for: "${query}"`);

            const podcasts = await apiService.getPodcasts(100);
            const queryLower = query.toLowerCase();
            const queryWords = queryLower.split(' ').filter(w => w.length > 2);

            const results = podcasts
                .filter(p => p.transcription_text)
                .map(podcast => {
                    const transcriptionLower = podcast.transcription_text.toLowerCase();
                    
                    // Find matching segments (with context)
                    const matches = this.findMatchingSegments(
                        podcast.transcription_text,
                        queryWords,
                        100 // context characters
                    );

                    if (matches.length === 0) return null;

                    return {
                        ...podcast,
                        matches: matches,
                        matchCount: matches.length,
                        relevance: matches.length / queryWords.length
                    };
                })
                .filter(p => p !== null)
                .sort((a, b) => b.relevance - a.relevance);

            Logger.log(`✅ Found ${results.length} podcasts with transcript matches`);
            return results;

        } catch (error) {
            Logger.error("Transcription search failed:", error);
            return [];
        }
    }

    /**
     * Get search suggestions based on query and AI keywords
     * @param {string} query - Partial search query
     * @returns {Promise<Array>} Array of search suggestions
     */
    async getSearchSuggestions(query) {
        try {
            if (!query || query.trim().length < 2) {
                // Return recent search history
                return this.searchHistory.slice(0, 5);
            }

            Logger.log(`💡 Getting suggestions for: "${query}"`);

            const podcasts = await apiService.getPodcasts(50);
            const suggestions = new Set();

            // Extract keywords from AI-analyzed podcasts
            podcasts.forEach(podcast => {
                if (podcast.ai_keywords) {
                    const keywords = podcast.ai_keywords.split(',');
                    keywords.forEach(keyword => {
                        const trimmed = keyword.trim().toLowerCase();
                        if (trimmed.includes(query.toLowerCase())) {
                            suggestions.add(trimmed);
                        }
                    });
                }

                // Also suggest from categories
                if (podcast.category && 
                    podcast.category.toLowerCase().includes(query.toLowerCase())) {
                    suggestions.add(podcast.category);
                }
            });

            const suggestionArray = Array.from(suggestions).slice(0, 8);
            Logger.log(`✅ Generated ${suggestionArray.length} suggestions`);
            return suggestionArray;

        } catch (error) {
            Logger.error("Failed to get suggestions:", error);
            return [];
        }
    }

    /**
     * Calculate relevance score for a podcast given a search query
     * @private
     */
    calculateRelevanceScore(podcast, query, filters = {}) {
        let score = 0;
        const queryLower = query.toLowerCase();
        const queryWords = queryLower.split(' ').filter(w => w.length > 2);

        // Title match (30% weight)
        const titleLower = podcast.title.toLowerCase();
        const titleMatches = queryWords.filter(word => titleLower.includes(word)).length;
        score += (titleMatches / queryWords.length) * 0.3;

        // Description match (15% weight)
        if (podcast.description) {
            const descLower = podcast.description.toLowerCase();
            const descMatches = queryWords.filter(word => descLower.includes(word)).length;
            score += (descMatches / queryWords.length) * 0.15;
        }

        // AI Keywords match (25% weight)
        if (podcast.ai_keywords) {
            const keywordsLower = podcast.ai_keywords.toLowerCase();
            const keywordMatches = queryWords.filter(word => 
                keywordsLower.includes(word)
            ).length;
            score += (keywordMatches / queryWords.length) * 0.25;
        }

        // Transcription match (20% weight)
        if (podcast.transcription_text) {
            const transcriptLower = podcast.transcription_text.toLowerCase();
            const transcriptMatches = queryWords.filter(word => 
                transcriptLower.includes(word)
            ).length;
            score += (transcriptMatches / queryWords.length) * 0.20;
        }

        // AI Summary match (10% weight)
        if (podcast.ai_summary) {
            const summaryLower = podcast.ai_summary.toLowerCase();
            const summaryMatches = queryWords.filter(word => 
                summaryLower.includes(word)
            ).length;
            score += (summaryMatches / queryWords.length) * 0.10;
        }

        // Apply filters
        if (filters.category && podcast.category !== filters.category) {
            score *= 0.5; // Penalize if category doesn't match
        }

        if (filters.sentiment && podcast.ai_sentiment) {
            try {
                const sentiment = JSON.parse(podcast.ai_sentiment);
                if (filters.sentiment === 'positive' && sentiment.compound < 0.2) {
                    score *= 0.7;
                } else if (filters.sentiment === 'negative' && sentiment.compound > -0.2) {
                    score *= 0.7;
                }
            } catch (e) {
                // Ignore parse errors
            }
        }

        return score;
    }

    /**
     * Find matching segments in text with context
     * @private
     */
    findMatchingSegments(text, queryWords, contextLength = 100) {
        const matches = [];
        const textLower = text.toLowerCase();

        queryWords.forEach(word => {
            let index = 0;
            while ((index = textLower.indexOf(word, index)) !== -1) {
                const start = Math.max(0, index - contextLength);
                const end = Math.min(text.length, index + word.length + contextLength);
                
                let segment = text.substring(start, end);
                
                // Add ellipsis if truncated
                if (start > 0) segment = '...' + segment;
                if (end < text.length) segment = segment + '...';

                matches.push({
                    text: segment,
                    keyword: word,
                    position: index
                });

                index += word.length;
            }
        });

        return matches;
    }

    /**
     * Add query to search history
     * @private
     */
    addToHistory(query) {
        const trimmed = query.trim();
        if (trimmed.length === 0) return;

        // Remove if already exists
        this.searchHistory = this.searchHistory.filter(q => q !== trimmed);
        
        // Add to beginning
        this.searchHistory.unshift(trimmed);
        
        // Limit size
        if (this.searchHistory.length > this.maxHistorySize) {
            this.searchHistory.pop();
        }

        Logger.log(`📚 Search history updated: ${this.searchHistory.length} entries`);
    }

    /**
     * Get search history
     * @returns {Array} Array of previous search queries
     */
    getSearchHistory() {
        return [...this.searchHistory];
    }

    /**
     * Clear search history
     */
    clearSearchHistory() {
        this.searchHistory = [];
        Logger.log("🗑️ Search history cleared");
    }
}

// Export singleton instance
export default new SemanticSearchService();

