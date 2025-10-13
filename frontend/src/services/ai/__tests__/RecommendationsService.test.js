import RecommendationsService from "../RecommendationsService";
import apiService from "../../api/apiService";

// Mock apiService
jest.mock("../../api/apiService");

describe("RecommendationsService", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        RecommendationsService.clearCache();
    });

    describe("getPersonalizedRecommendations", () => {
        it("should return empty array when no podcasts available", async () => {
            apiService.getPodcasts.mockResolvedValue([]);

            const recommendations = await RecommendationsService.getPersonalizedRecommendations(5);

            expect(recommendations).toEqual([]);
        });

        it("should filter out non-AI-enhanced podcasts", async () => {
            const mockPodcasts = [
                { id: 1, title: "Test 1", ai_enhanced: true, category: "Tech" },
                { id: 2, title: "Test 2", ai_enhanced: false, category: "Tech" },
                { id: 3, title: "Test 3", ai_enhanced: true, category: "Science" },
            ];

            apiService.getPodcasts.mockResolvedValue(mockPodcasts);

            const recommendations = await RecommendationsService.getPersonalizedRecommendations(10);

            expect(recommendations.length).toBe(2);
            expect(recommendations.every(p => p.ai_enhanced)).toBe(true);
        });

        it("should limit results to specified number", async () => {
            const mockPodcasts = Array.from({ length: 20 }, (_, i) => ({
                id: i,
                title: `Test ${i}`,
                ai_enhanced: true,
                category: "Tech",
            }));

            apiService.getPodcasts.mockResolvedValue(mockPodcasts);

            const recommendations = await RecommendationsService.getPersonalizedRecommendations(5);

            expect(recommendations.length).toBeLessThanOrEqual(5);
        });

        it("should cache results", async () => {
            const mockPodcasts = [
                { id: 1, title: "Test 1", ai_enhanced: true, category: "Tech" },
            ];

            apiService.getPodcasts.mockResolvedValue(mockPodcasts);

            // First call
            await RecommendationsService.getPersonalizedRecommendations(5);
            
            // Second call (should use cache)
            await RecommendationsService.getPersonalizedRecommendations(5);

            // Should only call API once due to cache
            expect(apiService.getPodcasts).toHaveBeenCalledTimes(1);
        });
    });

    describe("getSimilarPodcasts", () => {
        it("should return empty array when reference podcast not found", async () => {
            apiService.getPodcast.mockResolvedValue(null);

            const similar = await RecommendationsService.getSimilarPodcasts(999, 5);

            expect(similar).toEqual([]);
        });

        it("should exclude the reference podcast from results", async () => {
            const referencePodcast = { id: 1, title: "Reference", ai_enhanced: true, category: "Tech" };
            const mockPodcasts = [
                { id: 1, title: "Reference", ai_enhanced: true, category: "Tech" },
                { id: 2, title: "Similar", ai_enhanced: true, category: "Tech" },
                { id: 3, title: "Another", ai_enhanced: true, category: "Tech" },
            ];

            apiService.getPodcast.mockResolvedValue(referencePodcast);
            apiService.getPodcasts.mockResolvedValue(mockPodcasts);

            const similar = await RecommendationsService.getSimilarPodcasts(1, 5);

            expect(similar.every(p => p.id !== 1)).toBe(true);
        });

        it("should calculate similarity scores", async () => {
            const referencePodcast = { 
                id: 1, 
                title: "Reference", 
                ai_enhanced: true, 
                category: "Tech",
                ai_keywords: "javascript,react,typescript"
            };
            const mockPodcasts = [
                { id: 1, title: "Reference", ai_enhanced: true, category: "Tech", ai_keywords: "javascript,react,typescript" },
                { id: 2, title: "Similar", ai_enhanced: true, category: "Tech", ai_keywords: "javascript,vue" },
                { id: 3, title: "Different", ai_enhanced: true, category: "Science", ai_keywords: "biology,chemistry" },
            ];

            apiService.getPodcast.mockResolvedValue(referencePodcast);
            apiService.getPodcasts.mockResolvedValue(mockPodcasts);

            const similar = await RecommendationsService.getSimilarPodcasts(1, 5);

            // Similar podcast (id: 2) should have higher similarity than Different (id: 3)
            expect(similar[0].similarity).toBeGreaterThan(similar[similar.length - 1].similarity);
        });
    });

    describe("calculateRelevanceScore", () => {
        it("should give higher score for category match", () => {
            const podcast = { category: "Tech", ai_keywords: "javascript", play_count: 50 };
            const preferredCategories = ["Tech"];
            const preferredKeywords = ["python"];

            const score = RecommendationsService.calculateRelevanceScore(
                podcast,
                preferredCategories,
                preferredKeywords
            );

            expect(score).toBeGreaterThan(0.3); // Category match weight is 0.4
        });

        it("should give higher score for keyword overlap", () => {
            const podcast = { 
                category: "Science", 
                ai_keywords: "machine learning,ai,python", 
                play_count: 50 
            };
            const preferredCategories = ["Tech"];
            const preferredKeywords = ["python", "ai"];

            const score = RecommendationsService.calculateRelevanceScore(
                podcast,
                preferredCategories,
                preferredKeywords
            );

            expect(score).toBeGreaterThan(0); // Should match keywords
        });
    });

    describe("cache management", () => {
        it("should clear cache when requested", async () => {
            const mockPodcasts = [
                { id: 1, title: "Test", ai_enhanced: true, category: "Tech" },
            ];

            apiService.getPodcasts.mockResolvedValue(mockPodcasts);

            // First call
            await RecommendationsService.getPersonalizedRecommendations(5);
            
            // Clear cache
            RecommendationsService.clearCache();
            
            // Second call (should not use cache)
            await RecommendationsService.getPersonalizedRecommendations(5);

            // Should call API twice due to cache clear
            expect(apiService.getPodcasts).toHaveBeenCalledTimes(2);
        });
    });
});

