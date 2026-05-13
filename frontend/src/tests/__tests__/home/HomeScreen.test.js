import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";

const mockPush = jest.fn();
const mockPlay = jest.fn();
const mockPause = jest.fn();
const mockToggleMiniPlayer = jest.fn();
const mockClearError = jest.fn();
const mockShowToast = jest.fn();
const mockLoadFromStorage = jest.fn();
const mockGetDraft = jest.fn().mockResolvedValue(null);

jest.mock("react-native", () => {
    const React = require("react");
    const actual = jest.requireActual("react-native");

    const RefreshControl = (props) =>
        React.createElement(actual.View || "View", props);

    return {
        ...actual,
        RefreshControl,
        DeviceEventEmitter: {
            addListener: jest.fn(() => ({
                remove: jest.fn(),
            })),
        },
        InteractionManager: {
            ...actual.InteractionManager,
            runAfterInteractions: jest.fn((callback) => {
                if (callback) {
                    callback();
                }
            }),
        },
    };
});

const mockContinueListeningItem = {
    podcast_id: 23,
    audio_url: "https://cdn.example.com/resume.mp3",
    title: "Resume Episode",
    duration: 145,
    thumbnail_url: "https://cdn.example.com/resume.jpg",
    category: "Business",
    description: "Resume helper coverage",
    owner_id: 44,
    owner_name: "Remote Host",
    position: 37,
    progress_percent: 25,
};

const mockAudioStoreState = {
    currentTrack: null,
    isPlaying: false,
    showMiniPlayer: false,
    error: null,
    play: mockPlay,
    pause: mockPause,
    toggleMiniPlayer: mockToggleMiniPlayer,
    clearError: mockClearError,
};

const mockNotificationStoreState = {
    unreadCount: 0,
    isLoaded: true,
    loadFromStorage: mockLoadFromStorage,
};

const mockDmStoreState = {
    unreadDMCount: 0,
};

jest.mock("../../../services/api/apiService", () => ({
    __esModule: true,
    default: {
        getDiscoverCategories: jest.fn().mockResolvedValue([]),
        getContinueListening: jest.fn().mockResolvedValue([mockContinueListeningItem]),
        getRecommendedPodcasts: jest.fn().mockResolvedValue([]),
        getTrendingPodcasts: jest.fn().mockResolvedValue([]),
        getMyPodcasts: jest.fn().mockResolvedValue([]),
        getFollowingFeed: jest.fn().mockResolvedValue({ podcasts: [] }),
        getPodcasts: jest.fn().mockResolvedValue([]),
        getCreatorDashboard: jest.fn().mockResolvedValue({ recent_comments: 0 }),
    },
}));

jest.mock("expo-router", () => {
    const React = require("react");

    return {
        useRouter: () => ({
            push: mockPush,
        }),
        useLocalSearchParams: () => ({}),
        useFocusEffect: (callback) => {
            React.useEffect(() => callback(), [callback]);
        },
    };
});

jest.mock("../../../context/useAuthStore", () => ({
    __esModule: true,
    default: () => ({
        user: {
            id: 1,
            name: "Fatih",
        },
        logout: jest.fn(),
    }),
}));

jest.mock("../../../context/useAudioStore", () => ({
    __esModule: true,
    default: (selector) => selector(mockAudioStoreState),
}));

jest.mock("../../../context/useViewModeStore", () => ({
    __esModule: true,
    default: () => ({
        viewMode: "grid",
    }),
}));

jest.mock("../../../context/useNotificationStore", () => ({
    __esModule: true,
    default: (selector) => selector(mockNotificationStoreState),
}));

jest.mock("../../../context/useDMStore", () => ({
    __esModule: true,
    default: (selector) => selector(mockDmStoreState),
}));

jest.mock("../../../components/PodcastCard", () => () => null);
jest.mock("../../../components/GradientCard", () => () => null);
jest.mock("../../../components/ModeToggle", () => () => null);
jest.mock("../../../components/HeroSection", () => () => null);
jest.mock("../../../components/QuickActionsBar", () => () => null);
jest.mock("../../../components/SkeletonLoader", () => ({
    PodcastCardSkeleton: () => null,
}));

jest.mock("../../../components/ContinueListeningRow", () => {
    const React = require("react");
    const { Pressable, Text, View } = require("react-native");

    return ({ items = [], onResume }) => (
        <View>
            <Text>Continue Listening</Text>
            <Pressable
                testID="continue-listening-resume"
                onPress={() => onResume?.(items[0])}
            >
                <Text>Resume first item</Text>
            </Pressable>
        </View>
    );
});

jest.mock("../../../components/Toast", () => ({
    useToast: () => ({
        showToast: mockShowToast,
    }),
}));

jest.mock("../../../utils/logger", () => ({
    warn: jest.fn(),
    error: jest.fn(),
    log: jest.fn(),
}));

jest.mock("../../../services/recording/protectionService", () => ({
    __esModule: true,
    default: {
        getDraft: mockGetDraft,
    },
}));

jest.mock("@expo/vector-icons", () => {
    const React = require("react");
    const { Text } = require("react-native");

    return {
        Ionicons: ({ name }) => <Text>{name}</Text>,
        MaterialCommunityIcons: ({ name }) => <Text>{name}</Text>,
    };
});

const HomeScreen = require("../../../../app/(main)/home").default;

describe("HomeScreen continue listening", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockAudioStoreState.currentTrack = null;
        mockAudioStoreState.isPlaying = false;
        mockAudioStoreState.showMiniPlayer = false;
        mockAudioStoreState.error = null;
    });

    it("resumes continue-listening playback with the saved start position", async () => {
        const { getByTestId, findByText } = render(<HomeScreen />);

        expect(await findByText("Continue Listening")).toBeTruthy();

        fireEvent.press(getByTestId("continue-listening-resume"));

        await waitFor(() => {
            expect(mockPlay).toHaveBeenCalledWith(
                expect.objectContaining({
                    id: 23,
                    uri: "https://cdn.example.com/resume.mp3",
                    title: "Resume Episode",
                    artist: "Remote Host",
                    duration: 145000,
                    artwork: "https://cdn.example.com/resume.jpg",
                    category: "Business",
                    description: "Resume helper coverage",
                    ownerId: 44,
                }),
                { startPosition: 37 }
            );
        });

        expect(mockToggleMiniPlayer).toHaveBeenCalledWith(true);
        expect(mockShowToast).not.toHaveBeenCalled();
    });
});