import React from "react";
import { act, render, waitFor } from "@testing-library/react-native";

const mockBack = jest.fn();
const mockPush = jest.fn();
const mockShowToast = jest.fn();
let mockParams = { id: "16" };

const createDeferred = () => {
    let resolve;
    let reject;

    const promise = new Promise((nextResolve, nextReject) => {
        resolve = nextResolve;
        reject = nextReject;
    });

    return {
        promise,
        resolve,
        reject,
    };
};

const mockAudioStoreState = {
    currentTrack: null,
    isPlaying: false,
    isLoading: false,
    showMiniPlayer: false,
    error: null,
    play: jest.fn(),
    pause: jest.fn(),
    setQueue: jest.fn(),
    addToQueue: jest.fn(),
    setPlaybackRate: jest.fn(),
    setVolume: jest.fn(),
    seek: jest.fn(),
    clearError: jest.fn(),
};

jest.mock("../../../services/api/apiService", () => ({
    __esModule: true,
    default: {
        getPodcast: jest.fn(),
        getUserProfile: jest.fn(),
        getPodcastInteractions: jest.fn(),
        getRelatedPodcasts: jest.fn(),
        getPodcastAIData: jest.fn(),
        getPodcastComments: jest.fn().mockResolvedValue([]),
    },
}));

jest.mock("expo-router", () => ({
    Stack: {
        Screen: () => null,
    },
    useRouter: () => ({
        back: mockBack,
        push: mockPush,
    }),
    useLocalSearchParams: () => mockParams,
    useFocusEffect: (cb) => { const { useEffect } = require("react"); useEffect(cb, []); },
}));

jest.mock("../../../context/useAudioStore", () => ({
    __esModule: true,
    default: (selector) => selector(mockAudioStoreState),
}));

jest.mock("../../../components/Toast", () => ({
    useToast: () => ({
        showToast: mockShowToast,
    }),
}));

jest.mock("../../../components/audio/ModernAudioPlayer", () => () => null);
jest.mock("../../../components/video/PodcastVideoPlayer", () => () => null);
jest.mock("../../../components/ConfirmationModal", () => () => null);
jest.mock("../../../components/InfoModal", () => () => null);
jest.mock("../../../components/CustomModal", () => () => null);
jest.mock("../../../components/GradientCard", () => ({ children }) => children || null);

jest.mock("../../../services/haptics/hapticFeedback", () => ({
    __esModule: true,
    default: {
        vibrate: jest.fn(),
    },
}));

jest.mock("../../../services/downloads/downloadService", () => ({
    __esModule: true,
    default: {
        getLocalUri: jest.fn(),
    },
}));

jest.mock("../../../utils/logger", () => ({
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    log: jest.fn(),
}));

jest.mock("@expo/vector-icons", () => {
    const React = require("react");
    const { Text } = require("react-native");

    return {
        Ionicons: ({ name }) => <Text>{name}</Text>,
        MaterialCommunityIcons: ({ name }) => <Text>{name}</Text>,
    };
});

const apiService = require("../../../services/api/apiService").default;
const downloadService = require("../../../services/downloads/downloadService").default;
const DetailsScreen = require("../../../../app/(main)/details").default;

describe("Details screen stale request handling", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockParams = { id: "16" };
        apiService.getUserProfile.mockResolvedValue({ id: 44 });
        apiService.getPodcastInteractions.mockResolvedValue({
            is_liked: false,
            is_bookmarked: false,
        });
        apiService.getRelatedPodcasts.mockResolvedValue([]);
        apiService.getPodcastAIData.mockResolvedValue(null);
        downloadService.getLocalUri.mockResolvedValue(null);
    });

    it("ignores stale load failures after navigating to a different podcast", async () => {
        const staleRequest = createDeferred();

        apiService.getPodcast.mockImplementation((podcastId) => {
            if (String(podcastId) === "16") {
                return staleRequest.promise;
            }

            return Promise.resolve({
                id: 17,
                title: "Fresh Episode",
                description: "Newest episode",
                category: "Tech",
                is_public: true,
                owner_id: 44,
                audio_url: "https://cdn.example.com/fresh.mp3",
                ai_processing_status: "pending",
            });
        });

        const screen = render(<DetailsScreen />);

        await waitFor(() => {
            expect(apiService.getPodcast).toHaveBeenCalledWith("16");
        });

        mockParams = { id: "17" };
        screen.rerender(<DetailsScreen />);

        await waitFor(() => {
            expect(screen.getAllByText("Fresh Episode").length).toBeGreaterThan(0);
        });

        await act(async () => {
            staleRequest.reject(new Error("Podcast missing"));
            await staleRequest.promise.catch(() => {});
        });

        expect(mockShowToast).not.toHaveBeenCalled();
        expect(screen.getAllByText("Fresh Episode").length).toBeGreaterThan(0);
    });

    it("does not let a stale success overwrite the active podcast", async () => {
        const staleRequest = createDeferred();

        apiService.getPodcast.mockImplementation((podcastId) => {
            if (String(podcastId) === "16") {
                return staleRequest.promise;
            }

            return Promise.resolve({
                id: 17,
                title: "Current Episode",
                description: "Current description",
                category: "Business",
                is_public: true,
                owner_id: 44,
                audio_url: "https://cdn.example.com/current.mp3",
                ai_processing_status: "pending",
            });
        });

        const screen = render(<DetailsScreen />);

        await waitFor(() => {
            expect(apiService.getPodcast).toHaveBeenCalledWith("16");
        });

        mockParams = { id: "17" };
        screen.rerender(<DetailsScreen />);

        await waitFor(() => {
            expect(screen.getAllByText("Current Episode").length).toBeGreaterThan(0);
        });

        await act(async () => {
            staleRequest.resolve({
                id: 16,
                title: "Stale Episode",
                description: "Old description",
                category: "General",
                is_public: true,
                owner_id: 44,
                audio_url: "https://cdn.example.com/stale.mp3",
                ai_processing_status: "pending",
            });
            await staleRequest.promise;
        });

        await waitFor(() => {
            expect(screen.queryByText("Stale Episode")).toBeNull();
        });
        expect(screen.getAllByText("Current Episode").length).toBeGreaterThan(0);
    });
});