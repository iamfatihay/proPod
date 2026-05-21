import React from "react";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import Library from "../../../../app/(main)/library";
import apiService from "../../../services/api/apiService";

const mockPush = jest.fn();
const mockBack = jest.fn();
var mockFocusEffectCallbacks;
var mockFocusEffectCleanups;

const emitScreenBlur = () => {
    mockFocusEffectCallbacks.forEach((callback) => {
        const cleanup = mockFocusEffectCleanups.get(callback);

        if (typeof cleanup === "function") {
            cleanup();
        }

        mockFocusEffectCleanups.delete(callback);
    });
};

const emitScreenFocus = () => {
    mockFocusEffectCallbacks.forEach((callback) => {
        const cleanup = callback();

        mockFocusEffectCleanups.set(callback, cleanup);
    });
};

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

const buildPodcast = (overrides = {}) => ({
    id: 51,
    title: "Library focus-safe episode",
    created_at: "2026-05-21T10:00:00Z",
    duration: 360,
    owner: {
        name: "ProPod FM",
    },
    ...overrides,
});

jest.mock("../../../services/api/apiService", () => ({
    __esModule: true,
    default: {
        getMyPodcasts: jest.fn(),
        getLikedPodcasts: jest.fn(),
        getBookmarkedPodcasts: jest.fn(),
        getMyPlaylists: jest.fn(),
    },
}));

jest.mock("../../../components/PodcastCard", () => {
    const React = require("react");
    const { Text, TouchableOpacity } = require("react-native");

    return function PodcastCard({ podcast, onPress }) {
        return (
            <TouchableOpacity onPress={onPress} accessibilityRole="button">
                <Text>{podcast.title}</Text>
            </TouchableOpacity>
        );
    };
});

jest.mock("../../../components/PlaylistMosaic", () => {
    const React = require("react");
    const { Text } = require("react-native");

    return function PlaylistMosaic() {
        return <Text>playlist-mosaic</Text>;
    };
});

jest.mock("react-native", () => {
    const actual = jest.requireActual("react-native");
    const {
        createFlatListMock,
        createRefreshControlMock,
    } = require("../../utils/reactNativeScreenTestHelpers");

    return {
        ...actual,
        FlatList: createFlatListMock(actual),
        RefreshControl: createRefreshControlMock(actual, "Refresh library"),
    };
});

jest.mock("expo-router", () => {
    const React = require("react");

    mockFocusEffectCallbacks = new Set();
    mockFocusEffectCleanups = new Map();

    return {
        useRouter: () => ({
            push: mockPush,
            back: mockBack,
        }),
        useLocalSearchParams: () => ({}),
        useFocusEffect: (callback) => {
            React.useEffect(() => {
                mockFocusEffectCallbacks.add(callback);

                const cleanup = callback();
                mockFocusEffectCleanups.set(callback, cleanup);

                return () => {
                    mockFocusEffectCallbacks.delete(callback);

                    const currentCleanup = mockFocusEffectCleanups.get(callback);

                    if (typeof currentCleanup === "function") {
                        currentCleanup();
                    }

                    mockFocusEffectCleanups.delete(callback);
                };
            }, [callback]);
        },
    };
});

jest.mock("react-native-safe-area-context", () => ({
    useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock("@expo/vector-icons", () => {
    const React = require("react");
    const { Text } = require("react-native");

    const Icon = ({ name }) => <Text>{name}</Text>;

    return {
        MaterialCommunityIcons: Icon,
        Ionicons: Icon,
    };
});

describe("Library", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockFocusEffectCallbacks.clear();
        mockFocusEffectCleanups.clear();
        apiService.getMyPodcasts.mockReset();
        apiService.getLikedPodcasts.mockReset();
        apiService.getBookmarkedPodcasts.mockReset();
        apiService.getMyPlaylists.mockReset();
    });

    it("keeps loaded episodes visible while a refocus refresh is in flight", async () => {
        const deferredRefresh = createDeferred();

        apiService.getMyPodcasts
            .mockResolvedValueOnce({ podcasts: [buildPodcast()] })
            .mockReturnValueOnce(deferredRefresh.promise);

        const { getByText, queryByText } = render(<Library />);

        await waitFor(() => {
            expect(getByText("Library focus-safe episode")).toBeTruthy();
        });

        await act(async () => {
            emitScreenBlur();
            emitScreenFocus();
        });

        await waitFor(() => {
            expect(apiService.getMyPodcasts).toHaveBeenCalledTimes(2);
        });

        expect(getByText("Library focus-safe episode")).toBeTruthy();
        expect(queryByText("Couldn't load your library.")).toBeNull();

        await act(async () => {
            deferredRefresh.resolve({
                podcasts: [buildPodcast({ title: "Library refocus recovery" })],
            });
        });

        await waitFor(() => {
            expect(getByText("Library refocus recovery")).toBeTruthy();
        });
    });

    it("keeps loaded episodes visible and shows inline retry copy when a refocus refresh fails", async () => {
        apiService.getMyPodcasts
            .mockResolvedValueOnce({ podcasts: [buildPodcast()] })
            .mockRejectedValueOnce(new Error("Refresh failed"));

        const { getByText, queryByLabelText, queryByText } = render(<Library />);

        await waitFor(() => {
            expect(getByText("Library focus-safe episode")).toBeTruthy();
        });

        await act(async () => {
            emitScreenBlur();
            emitScreenFocus();
        });

        await waitFor(() => {
            expect(apiService.getMyPodcasts).toHaveBeenCalledTimes(2);
        });

        await waitFor(() => {
            expect(getByText("Library focus-safe episode")).toBeTruthy();
            expect(getByText("Couldn't refresh library.")).toBeTruthy();
            expect(getByText("Refresh failed")).toBeTruthy();
        });

        expect(queryByLabelText("Retry loading library")).toBeNull();
        expect(queryByText("Couldn't load your library.")).toBeNull();
    });

    it("keeps the inline refresh error visible and disables retry while a retry is in flight", async () => {
        const deferredRetry = createDeferred();

        apiService.getMyPodcasts
            .mockResolvedValueOnce({ podcasts: [buildPodcast()] })
            .mockRejectedValueOnce(new Error("Retry failed"))
            .mockReturnValueOnce(deferredRetry.promise);

        const { getByLabelText, getByText, queryByText } = render(<Library />);

        await waitFor(() => {
            expect(getByText("Library focus-safe episode")).toBeTruthy();
        });

        await act(async () => {
            emitScreenBlur();
            emitScreenFocus();
        });

        await waitFor(() => {
            expect(getByText("Couldn't refresh library.")).toBeTruthy();
            expect(getByText("Retry failed")).toBeTruthy();
        });

        fireEvent.press(getByLabelText("Retry refreshing library"));

        await waitFor(() => {
            expect(apiService.getMyPodcasts).toHaveBeenCalledTimes(3);
            expect(getByText("Retrying...")).toBeTruthy();
        });

        expect(getByText("Library focus-safe episode")).toBeTruthy();

        await act(async () => {
            deferredRetry.resolve({
                podcasts: [buildPodcast({ title: "Library retry recovered" })],
            });
        });

        await waitFor(() => {
            expect(getByText("Library retry recovered")).toBeTruthy();
        });

        expect(queryByText("Couldn't refresh library.")).toBeNull();
        expect(queryByText("Retry failed")).toBeNull();
    });

    it("keeps pull-to-refresh failures non-blocking after the first successful load", async () => {
        apiService.getMyPodcasts
            .mockResolvedValueOnce({ podcasts: [buildPodcast()] })
            .mockRejectedValueOnce(new Error("Pull to refresh failed"));

        const { getByLabelText, getByText, queryByText } = render(<Library />);

        await waitFor(() => {
            expect(getByText("Library focus-safe episode")).toBeTruthy();
        });

        fireEvent.press(getByLabelText("Refresh library"));

        await waitFor(() => {
            expect(apiService.getMyPodcasts).toHaveBeenCalledTimes(2);
        });

        await waitFor(() => {
            expect(getByText("Library focus-safe episode")).toBeTruthy();
            expect(getByText("Couldn't refresh library.")).toBeTruthy();
            expect(getByText("Pull to refresh failed")).toBeTruthy();
        });

        expect(queryByText("Couldn't load your library.")).toBeNull();
    });
});