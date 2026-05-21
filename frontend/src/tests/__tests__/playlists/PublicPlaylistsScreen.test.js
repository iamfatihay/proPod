import React from "react";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import PublicPlaylists from "../../../../app/(main)/public-playlists";
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

const buildPlaylist = (overrides = {}) => ({
    id: 41,
    name: "Public groove",
    item_count: 4,
    owner_id: 12,
    owner_name: "Casey",
    owner_username: "casey",
    preview_thumbnails: [],
    is_public: true,
    ...overrides,
});

jest.mock("../../../services/api/apiService", () => ({
    __esModule: true,
    default: {
        getPublicPlaylists: jest.fn(),
    },
}));

jest.mock("../../../context/useAudioStore", () => ({
    __esModule: true,
    default: (selector) => selector({ activePlaylistId: null, isPlaying: false }),
}));

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
    } = require("../../utils/reactNativeScreenTestHelpers");

    return {
        ...actual,
        FlatList: createFlatListMock(actual),
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

describe("PublicPlaylists", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockFocusEffectCallbacks.clear();
        mockFocusEffectCleanups.clear();
    });

    it("keeps loaded playlists visible while a refocus refresh is in flight", async () => {
        const deferredRefresh = createDeferred();

        apiService.getPublicPlaylists
            .mockResolvedValueOnce({ playlists: [buildPlaylist()], has_more: false })
            .mockReturnValueOnce(deferredRefresh.promise);

        const { getByText } = render(<PublicPlaylists />);

        await waitFor(() => {
            expect(apiService.getPublicPlaylists).toHaveBeenCalledWith({ skip: 0, limit: 20, q: "" });
        });

        expect(getByText("Public groove")).toBeTruthy();

        await act(async () => {
            emitScreenBlur();
            emitScreenFocus();
        });

        await waitFor(() => {
            expect(apiService.getPublicPlaylists).toHaveBeenCalledTimes(2);
        });

        expect(getByText("Public groove")).toBeTruthy();

        await act(async () => {
            deferredRefresh.resolve({
                playlists: [buildPlaylist({ name: "Fresh discovery" })],
                has_more: false,
            });
        });

        await waitFor(() => {
            expect(getByText("Fresh discovery")).toBeTruthy();
        });
    });

    it("keeps loaded playlists visible and shows inline retry copy when a refocus refresh fails", async () => {
        apiService.getPublicPlaylists
            .mockResolvedValueOnce({ playlists: [buildPlaylist()], has_more: false })
            .mockRejectedValueOnce(new Error("Refresh failed"));

        const { getByText, queryByLabelText } = render(<PublicPlaylists />);

        await waitFor(() => {
            expect(apiService.getPublicPlaylists).toHaveBeenCalledTimes(1);
        });

        await act(async () => {
            emitScreenBlur();
            emitScreenFocus();
        });

        await waitFor(() => {
            expect(apiService.getPublicPlaylists).toHaveBeenCalledTimes(2);
        });

        await waitFor(() => {
            expect(getByText("Public groove")).toBeTruthy();
            expect(getByText("Couldn't refresh playlists.")).toBeTruthy();
            expect(getByText("Refresh failed")).toBeTruthy();
        });

        expect(queryByLabelText("Retry loading public playlists")).toBeNull();
    });

    it("keeps the inline refresh error visible and disables retry while a retry is in flight", async () => {
        const deferredRetry = createDeferred();

        apiService.getPublicPlaylists
            .mockResolvedValueOnce({ playlists: [buildPlaylist()], has_more: false })
            .mockRejectedValueOnce(new Error("Retry failed"))
            .mockReturnValueOnce(deferredRetry.promise);

        const { getByLabelText, getByText, queryByText } = render(<PublicPlaylists />);

        await waitFor(() => {
            expect(apiService.getPublicPlaylists).toHaveBeenCalledTimes(1);
        });

        await act(async () => {
            emitScreenBlur();
            emitScreenFocus();
        });

        await waitFor(() => {
            expect(apiService.getPublicPlaylists).toHaveBeenCalledTimes(2);
        });

        await waitFor(() => {
            expect(getByText("Couldn't refresh playlists.")).toBeTruthy();
            expect(getByText("Retry failed")).toBeTruthy();
        });

        fireEvent.press(getByLabelText("Retry refreshing public playlists"));

        await waitFor(() => {
            expect(apiService.getPublicPlaylists).toHaveBeenCalledTimes(3);
            expect(getByText("Retrying...")).toBeTruthy();
        });

        expect(getByText("Public groove")).toBeTruthy();

        await act(async () => {
            deferredRetry.resolve({
                playlists: [buildPlaylist({ name: "Recovered playlist" })],
                has_more: false,
            });
        });

        await waitFor(() => {
            expect(getByText("Recovered playlist")).toBeTruthy();
        });

        expect(queryByText("Couldn't refresh playlists.")).toBeNull();
        expect(queryByText("Retry failed")).toBeNull();
    });

    it("keeps focus reloads on the blocking load path until at least one playlist page succeeds", async () => {
        const deferredReload = createDeferred();

        apiService.getPublicPlaylists
            .mockRejectedValueOnce(new Error("Initial load failed"))
            .mockReturnValueOnce(deferredReload.promise);

        const { getByLabelText, getByText, queryByLabelText, queryByText } = render(<PublicPlaylists />);

        await waitFor(() => {
            expect(apiService.getPublicPlaylists).toHaveBeenCalledTimes(1);
        });

        await waitFor(() => {
            expect(getByText("Initial load failed")).toBeTruthy();
            expect(getByLabelText("Retry loading public playlists")).toBeTruthy();
        });

        await act(async () => {
            emitScreenBlur();
            emitScreenFocus();
        });

        await waitFor(() => {
            expect(apiService.getPublicPlaylists).toHaveBeenCalledTimes(2);
        });

        expect(queryByLabelText("Retry loading public playlists")).toBeNull();
        expect(queryByText("No public playlists yet")).toBeNull();

        await act(async () => {
            deferredReload.resolve({
                playlists: [buildPlaylist({ name: "Recovered on focus" })],
                has_more: false,
            });
        });

        await waitFor(() => {
            expect(getByText("Recovered on focus")).toBeTruthy();
        });
    });
});