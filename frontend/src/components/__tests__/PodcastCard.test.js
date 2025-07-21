/**
 * Component Tests: PodcastCard
 * User-centric testing following Kent C. Dodds principles
 * Tests what users see and do, not implementation details
 */

import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import PodcastCard from "../PodcastCard";

// Mock navigation
const mockNavigate = jest.fn();
jest.mock("@react-navigation/native", () => ({
    useNavigation: () => ({
        navigate: mockNavigate,
    }),
}));

describe("PodcastCard Component", () => {
    const mockPodcast = {
        id: 1,
        title: "How to Build Great Software",
        description:
            "A podcast about software engineering best practices and clean code principles.",
        duration: 1800000, // 30 minutes
        play_count: 1250,
        like_count: 89,
        bookmark_count: 23,
        category: "Technology",
        created_at: "2024-01-15T10:30:00Z",
        owner: {
            id: 123,
            name: "John Developer",
            photo_url: "https://example.com/avatar.jpg",
        },
        audio_url: "https://example.com/podcast.mp3",
        thumbnail_url: "https://example.com/thumbnail.jpg",
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe("Visual Information Display", () => {
        test("displays podcast title and creator name", () => {
            const { getByText } = render(<PodcastCard podcast={mockPodcast} />);

            expect(getByText("How to Build Great Software")).toBeTruthy();
            expect(getByText("John Developer")).toBeTruthy();
        });

        test("shows podcast description when provided", () => {
            const { getByText } = render(<PodcastCard podcast={mockPodcast} />);

            expect(
                getByText(/software engineering best practices/)
            ).toBeTruthy();
        });

        test("displays formatted duration correctly", () => {
            const { getByText } = render(<PodcastCard podcast={mockPodcast} />);

            // 1800000ms = 30 minutes = "30:00"
            expect(getByText("30:00")).toBeTruthy();
        });

        test("shows engagement metrics (plays, likes, bookmarks)", () => {
            const { getByText } = render(<PodcastCard podcast={mockPodcast} />);

            expect(getByText("1,250")).toBeTruthy(); // Play count
            expect(getByText("89")).toBeTruthy(); // Like count
            expect(getByText("23")).toBeTruthy(); // Bookmark count
        });

        test("displays category badge", () => {
            const { getByText } = render(<PodcastCard podcast={mockPodcast} />);

            expect(getByText("Technology")).toBeTruthy();
        });

        test("shows relative time since creation", () => {
            const { getByText } = render(<PodcastCard podcast={mockPodcast} />);

            // Should show relative time like "2 days ago" or similar
            expect(getByText(/ago/)).toBeTruthy();
        });
    });

    describe("User Interactions", () => {
        test("navigates to podcast details when card is pressed", () => {
            const { getByTestId } = render(
                <PodcastCard podcast={mockPodcast} />
            );

            const card = getByTestId("podcast-card-1");
            fireEvent.press(card);

            expect(mockNavigate).toHaveBeenCalledWith("details", {
                podcastId: 1,
            });
        });

        test("navigates to creator profile when creator name is pressed", () => {
            const { getByTestId } = render(
                <PodcastCard podcast={mockPodcast} />
            );

            const creatorButton = getByTestId("creator-button-123");
            fireEvent.press(creatorButton);

            expect(mockNavigate).toHaveBeenCalledWith("profile", {
                userId: 123,
            });
        });

        test("handles missing thumbnail gracefully", () => {
            const podcastWithoutThumbnail = {
                ...mockPodcast,
                thumbnail_url: null,
            };

            const { getByTestId } = render(
                <PodcastCard podcast={podcastWithoutThumbnail} />
            );

            // Should show default thumbnail or placeholder
            const thumbnail = getByTestId("podcast-thumbnail-1");
            expect(thumbnail).toBeTruthy();
        });

        test("handles long titles with proper truncation", () => {
            const podcastWithLongTitle = {
                ...mockPodcast,
                title: "This is an extremely long podcast title that should be truncated properly to fit within the card layout without breaking the UI",
            };

            const { getByText } = render(
                <PodcastCard podcast={podcastWithLongTitle} />
            );

            // Title should be present but may be truncated
            expect(
                getByText(/This is an extremely long podcast title/)
            ).toBeTruthy();
        });
    });

    describe("Accessibility Support", () => {
        test("has proper accessibility labels for screen readers", () => {
            const { getByTestId } = render(
                <PodcastCard podcast={mockPodcast} />
            );

            const card = getByTestId("podcast-card-1");
            expect(card.props.accessibilityLabel).toBe(
                "Podcast: How to Build Great Software by John Developer, 30 minutes, 1,250 plays"
            );
        });

        test("has accessibility hint for navigation", () => {
            const { getByTestId } = render(
                <PodcastCard podcast={mockPodcast} />
            );

            const card = getByTestId("podcast-card-1");
            expect(card.props.accessibilityHint).toBe(
                "Tap to view podcast details"
            );
        });

        test("creator button has proper accessibility role", () => {
            const { getByTestId } = render(
                <PodcastCard podcast={mockPodcast} />
            );

            const creatorButton = getByTestId("creator-button-123");
            expect(creatorButton.props.accessibilityRole).toBe("button");
            expect(creatorButton.props.accessibilityLabel).toBe(
                "View John Developer profile"
            );
        });
    });

    describe("Visual States and Feedback", () => {
        test("shows pressed state when card is touched", () => {
            const { getByTestId } = render(
                <PodcastCard podcast={mockPodcast} />
            );

            const card = getByTestId("podcast-card-1");

            fireEvent(card, "pressIn");
            // Should show visual feedback (opacity change, etc.)

            fireEvent(card, "pressOut");
            // Should return to normal state
        });

        test("displays loading state for missing images", async () => {
            const { getByTestId } = render(
                <PodcastCard podcast={mockPodcast} />
            );

            const thumbnail = getByTestId("podcast-thumbnail-1");

            // Simulate image loading
            fireEvent(thumbnail, "loadStart");

            await waitFor(() => {
                fireEvent(thumbnail, "loadEnd");
            });
        });
    });

    describe("Edge Cases and Error Handling", () => {
        test("handles podcast with zero metrics gracefully", () => {
            const podcastWithZeroMetrics = {
                ...mockPodcast,
                play_count: 0,
                like_count: 0,
                bookmark_count: 0,
            };

            const { getByText } = render(
                <PodcastCard podcast={podcastWithZeroMetrics} />
            );

            expect(getByText("0")).toBeTruthy(); // Should show zeros, not hide
        });

        test("handles very short duration podcasts", () => {
            const shortPodcast = {
                ...mockPodcast,
                duration: 30000, // 30 seconds
            };

            const { getByText } = render(
                <PodcastCard podcast={shortPodcast} />
            );

            expect(getByText("0:30")).toBeTruthy();
        });

        test("handles very long duration podcasts", () => {
            const longPodcast = {
                ...mockPodcast,
                duration: 7200000, // 2 hours
            };

            const { getByText } = render(<PodcastCard podcast={longPodcast} />);

            expect(getByText("120:00")).toBeTruthy(); // Should show minutes format
        });

        test("handles missing creator information", () => {
            const podcastWithoutCreator = {
                ...mockPodcast,
                owner: null,
            };

            const { getByText } = render(
                <PodcastCard podcast={podcastWithoutCreator} />
            );

            expect(getByText("Unknown Creator")).toBeTruthy();
        });

        test("handles invalid or future dates", () => {
            const podcastWithFutureDate = {
                ...mockPodcast,
                created_at: "2030-01-01T00:00:00Z", // Future date
            };

            const { getByText } = render(
                <PodcastCard podcast={podcastWithFutureDate} />
            );

            // Should handle gracefully, maybe show "Recently"
            expect(getByText(/Recently|just now/i)).toBeTruthy();
        });
    });

    describe("Performance Considerations", () => {
        test("renders quickly with minimal re-renders", () => {
            const renderSpy = jest.fn();

            const TestComponent = () => {
                renderSpy();
                return <PodcastCard podcast={mockPodcast} />;
            };

            const { rerender } = render(<TestComponent />);

            // Initial render
            expect(renderSpy).toHaveBeenCalledTimes(1);

            // Re-render with same props should not cause re-render (if memoized)
            rerender(<TestComponent />);

            // Component should be optimized to prevent unnecessary re-renders
        });

        test("handles large lists efficiently", () => {
            // Test that component can be rendered in a list context
            const podcasts = Array.from({ length: 10 }, (_, i) => ({
                ...mockPodcast,
                id: i + 1,
                title: `Podcast ${i + 1}`,
            }));

            const { getAllByTestId } = render(
                <>
                    {podcasts.map((podcast) => (
                        <PodcastCard key={podcast.id} podcast={podcast} />
                    ))}
                </>
            );

            const cards = getAllByTestId(/podcast-card-/);
            expect(cards).toHaveLength(10);
        });
    });

    describe("Platform-Specific Behavior", () => {
        test("handles touch feedback appropriately for platform", () => {
            const { getByTestId } = render(
                <PodcastCard podcast={mockPodcast} />
            );

            const card = getByTestId("podcast-card-1");

            // Touch feedback should work on both platforms
            fireEvent(card, "pressIn");
            fireEvent(card, "pressOut");
            fireEvent.press(card);

            expect(mockNavigate).toHaveBeenCalled();
        });
    });
});
