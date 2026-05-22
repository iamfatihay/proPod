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

const buildPlaylist = (overrides = {}) => ({
    id: 61,
    name: "Focus-safe playlist",
    item_count: 4,
    preview_thumbnails: [],
    is_public: false,
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
    const React = require("react");
    const actual = jest.requireActual("react-native");
    const {
        createRefreshControlMock,
    } = require("../../utils/reactNativeScreenTestHelpers");

    const renderListPart = (part) => {
        if (!part) {
            return null;
        }

        if (typeof part === "function") {
            return React.createElement(part);
        }

        return part;
    };

    const FlatList = ({
        data = [],
        ListEmptyComponent,
        ListFooterComponent,
        ListHeaderComponent,
        refreshControl,
        renderItem,
        keyExtractor,
        onEndReached,
    }) => {
        const items = Array.isArray(data) ? data : [];

        return React.createElement(
            actual.View,
            null,
            renderListPart(ListHeaderComponent),
            refreshControl,
            items.length === 0
                ? renderListPart(ListEmptyComponent)
                : items.map((item, index) => React.createElement(
                    actual.View,
                    {
                        key: keyExtractor?.(item, index) ?? String(item?.id ?? index),
                    },
                    renderItem?.({ item, index }) ?? null
                )),
            onEndReached
                ? React.createElement(actual.TouchableOpacity, {
                    accessibilityRole: "button",
                    accessibilityLabel: "Load more library items",
                    onPress: onEndReached,
                })
                : null,
            renderListPart(ListFooterComponent)
        );
    };

    return {
        ...actual,
        FlatList,
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

    it("keeps the playlists empty state visible and shows inline retry copy when a refresh fails", async () => {
        apiService.getMyPodcasts.mockResolvedValueOnce({ podcasts: [buildPodcast()] });
        apiService.getMyPlaylists
            .mockResolvedValueOnce({ playlists: [], has_more: false })
            .mockRejectedValueOnce(new Error("Playlist refresh failed"));

        const { getByLabelText, getByText, queryByText } = render(<Library />);

        await waitFor(() => {
            expect(getByText("Library focus-safe episode")).toBeTruthy();
        });

        fireEvent.press(getByText("Playlists"));

        await waitFor(() => {
            expect(apiService.getMyPlaylists).toHaveBeenCalledTimes(1);
            expect(getByText("No playlists yet")).toBeTruthy();
        });

        fireEvent.press(getByLabelText("Refresh library"));

        await waitFor(() => {
            expect(apiService.getMyPlaylists).toHaveBeenCalledTimes(2);
        });

        await waitFor(() => {
            expect(getByText("No playlists yet")).toBeTruthy();
            expect(getByText("Couldn't refresh library.")).toBeTruthy();
            expect(getByText("Playlist refresh failed")).toBeTruthy();
        });

        expect(queryByText("Couldn't load your library.")).toBeNull();
    });

    it("keeps the playlists footer retry visible when a pull-to-refresh fails after load-more fails", async () => {
        apiService.getMyPodcasts.mockResolvedValueOnce({ podcasts: [buildPodcast()] });
        apiService.getMyPlaylists
            .mockResolvedValueOnce({
                playlists: [buildPlaylist()],
                has_more: true,
            })
            .mockRejectedValueOnce(new Error("Couldn't load more playlists"))
            .mockRejectedValueOnce(new Error("Playlist refresh failed"));

        const { getByLabelText, getByText, queryByText } = render(<Library />);

        await waitFor(() => {
            expect(getByText("Library focus-safe episode")).toBeTruthy();
        });

        fireEvent.press(getByText("Playlists"));

        await waitFor(() => {
            expect(apiService.getMyPlaylists).toHaveBeenCalledTimes(1);
            expect(getByText("Focus-safe playlist")).toBeTruthy();
        });

        fireEvent.press(getByLabelText("Load more library items"));

        await waitFor(() => {
            expect(apiService.getMyPlaylists).toHaveBeenCalledTimes(2);
            expect(getByText("Couldn't load more playlists")).toBeTruthy();
        });

        fireEvent.press(getByLabelText("Refresh library"));

        await waitFor(() => {
            expect(apiService.getMyPlaylists).toHaveBeenCalledTimes(3);
        });

        await waitFor(() => {
            expect(getByText("Focus-safe playlist")).toBeTruthy();
            expect(getByText("Couldn't refresh library.")).toBeTruthy();
            expect(getByText("Playlist refresh failed")).toBeTruthy();
            expect(getByText("Couldn't load more playlists")).toBeTruthy();
        });

        expect(queryByText("Couldn't load your library.")).toBeNull();
    });

    it("ignores playlists load-more taps while a refresh is already in flight", async () => {
        const deferredRefresh = createDeferred();

        apiService.getMyPodcasts.mockResolvedValueOnce({ podcasts: [buildPodcast()] });
        apiService.getMyPlaylists
            .mockResolvedValueOnce({
                playlists: [buildPlaylist()],
                has_more: true,
            })
            .mockReturnValueOnce(deferredRefresh.promise);

        const { getByLabelText, getByText } = render(<Library />);

        await waitFor(() => {
            expect(getByText("Library focus-safe episode")).toBeTruthy();
        });

        fireEvent.press(getByText("Playlists"));

        await waitFor(() => {
            expect(apiService.getMyPlaylists).toHaveBeenCalledTimes(1);
            expect(getByText("Focus-safe playlist")).toBeTruthy();
        });

        fireEvent.press(getByLabelText("Refresh library"));

        await waitFor(() => {
            expect(apiService.getMyPlaylists).toHaveBeenCalledTimes(2);
        });

        fireEvent.press(getByLabelText("Load more library items"));

        expect(apiService.getMyPlaylists).toHaveBeenCalledTimes(2);

        await act(async () => {
            deferredRefresh.resolve({
                playlists: [buildPlaylist({ id: 62, name: "Refreshed playlist" })],
                has_more: false,
            });
        });

        await waitFor(() => {
            expect(getByText("Refreshed playlist")).toBeTruthy();
        });
    });

    it("does not show the previous tab episodes while a different tab is loading", async () => {
        const deferredLikes = createDeferred();

        apiService.getMyPodcasts.mockResolvedValueOnce({ podcasts: [buildPodcast()] });
        apiService.getLikedPodcasts.mockReturnValueOnce(deferredLikes.promise);

        const { getByText, queryByText } = render(<Library />);

        await waitFor(() => {
            expect(getByText("Library focus-safe episode")).toBeTruthy();
        });

        fireEvent.press(getByText("Liked"));

        await waitFor(() => {
            expect(apiService.getLikedPodcasts).toHaveBeenCalledTimes(1);
        });

        expect(queryByText("Library focus-safe episode")).toBeNull();

        await act(async () => {
            deferredLikes.resolve({
                podcasts: [buildPodcast({ id: 52, title: "Liked tab episode" })],
            });
        });

        await waitFor(() => {
            expect(getByText("Liked tab episode")).toBeTruthy();
        });
    });
});