import SemanticSearchService from "../SemanticSearchService";
import apiService from "../../api/apiService";

// Mock apiService
jest.mock("../../api/apiService");

describe("SemanticSearchService", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        SemanticSearchService.clearSearchHistory();
    });

    describe("searchPodcasts", () => {
        it("should return empty array for empty query", async () => {
            const results = await SemanticSearchService.searchPodcasts("");

            expect(results).toEqual([]);
        });

        it("should filter out non-AI-enhanced podcasts", async () => {
            const mockPodcasts = [
                { id: 1, title: "AI Test", ai_enhanced: true, transcription_text: "test" },
                { id: 2, title: "Regular Test", ai_enhanced: false, transcription_text: "test" },
            ];

            apiService.getPodcasts.mockResolvedValue(mockPodcasts);

            const results = await SemanticSearchService.searchPodcasts("test");

            expect(results.length).toBe(1);
            expect(results[0].ai_enhanced).toBe(true);
        });

        it("should calculate relevance scores based on title match", async () => {
            const mockPodcasts = [
                { 
                    id: 1, 
                    title: "JavaScript Tutorial", 
                    description: "Learn JS",
                    ai_enhanced: true,
                    transcription_text: "basics"
                },
                { 
                    id: 2, 
                    title: "Python Basics", 
                    description: "Python intro",
                    ai_enhanced: true,
                    transcription_text: "javascript intro"
                },
            ];

            apiService.getPodcasts.mockResolvedValue(mockPodcasts);

            const results = await SemanticSearchService.searchPodcasts("javascript");

            // Podcast with "javascript" in title should rank higher
            expect(results[0].id).toBe(1);
            expect(results[0].relevance).toBeGreaterThan(results[1].relevance);
        });

        it("should add queries to search history", async () => {
            apiService.getPodcasts.mockResolvedValue([]);

            await SemanticSearchService.searchPodcasts("test query");

            const history = SemanticSearchService.getSearchHistory();

            expect(history).toContain("test query");
        });
    });

    describe("searchTranscriptions", () => {
        it("should find podcasts with matching transcription text", async () => {
            const mockPodcasts = [
                { 
                    id: 1, 
                    title: "Podcast 1",
                    transcription_text: "This is about machine learning and AI",
                    ai_enhanced: true
                },
                { 
                    id: 2, 
                    title: "Podcast 2",
                    transcription_text: "This is about web development",
                    ai_enhanced: true
                },
            ];

            apiService.getPodcasts.mockResolvedValue(mockPodcasts);

            const results = await SemanticSearchService.searchTranscriptions("machine learning");

            expect(results.length).toBeGreaterThan(0);
            expect(results[0].matches).toBeDefined();
            expect(results[0].matches.length).toBeGreaterThan(0);
        });

        it("should return matching segments with context", async () => {
            const mockPodcasts = [
                { 
                    id: 1, 
                    title: "Test",
                    transcription_text: "In this episode we discuss artificial intelligence and machine learning concepts",
                    ai_enhanced: true
                },
            ];

            apiService.getPodcasts.mockResolvedValue(mockPodcasts);

            const results = await SemanticSearchService.searchTranscriptions("artificial intelligence");

            expect(results[0].matches[0].text).toContain("artificial intelligence");
        });
    });

    describe("getSearchSuggestions", () => {
        it("should return empty array for very short queries", async () => {
            const suggestions = await SemanticSearchService.getSearchSuggestions("a");

            expect(Array.isArray(suggestions)).toBe(true);
        });

        it("should extract keywords from AI-analyzed podcasts", async () => {
            const mockPodcasts = [
                { 
                    id: 1, 
                    ai_keywords: "javascript,react,typescript,programming",
                    category: "Tech",
                    ai_enhanced: true
                },
            ];

            apiService.getPodcasts.mockResolvedValue(mockPodcasts);

            const suggestions = await SemanticSearchService.getSearchSuggestions("java");

            expect(suggestions).toContain("javascript");
        });

        it("should suggest categories that match query", async () => {
            const mockPodcasts = [
                { 
                    id: 1, 
                    ai_keywords: "test",
                    category: "Technology",
                    ai_enhanced: true
                },
            ];

            apiService.getPodcasts.mockResolvedValue(mockPodcasts);

            const suggestions = await SemanticSearchService.getSearchSuggestions("tech");

            expect(suggestions).toContain("Technology");
        });
    });

    describe("search history management", () => {
        it("should maintain search history", async () => {
            apiService.getPodcasts.mockResolvedValue([]);

            await SemanticSearchService.searchPodcasts("query 1");
            await SemanticSearchService.searchPodcasts("query 2");

            const history = SemanticSearchService.getSearchHistory();

            expect(history).toContain("query 1");
            expect(history).toContain("query 2");
        });

        it("should limit history size", async () => {
            apiService.getPodcasts.mockResolvedValue([]);

            // Add more than max history size
            for (let i = 0; i < 15; i++) {
                await SemanticSearchService.searchPodcasts(`query ${i}`);
            }

            const history = SemanticSearchService.getSearchHistory();

            expect(history.length).toBeLessThanOrEqual(10);
        });

        it("should clear search history", () => {
            SemanticSearchService.addToHistory("test query");
            SemanticSearchService.clearSearchHistory();

            const history = SemanticSearchService.getSearchHistory();

            expect(history.length).toBe(0);
        });
    });

    describe("calculateRelevanceScore", () => {
        it("should give high score for exact title match", () => {
            const podcast = {
                title: "JavaScript Tutorial",
                description: "Learn JS",
                ai_keywords: "programming",
                transcription_text: "basics",
                ai_summary: "intro"
            };

            const score = SemanticSearchService.calculateRelevanceScore(
                podcast,
                "javascript",
                {}
            );

            expect(score).toBeGreaterThan(0.2); // Title has 30% weight
        });

        it("should consider multiple fields for relevance", () => {
            const podcast = {
                title: "Machine Learning",
                description: "Deep learning tutorial",
                ai_keywords: "neural networks,machine learning",
                transcription_text: "machine learning algorithms",
                ai_summary: "Introduction to machine learning"
            };

            const score = SemanticSearchService.calculateRelevanceScore(
                podcast,
                "machine learning",
                {}
            );

            expect(score).toBeGreaterThan(0.5); // Should match in multiple fields
        });
    });
});

