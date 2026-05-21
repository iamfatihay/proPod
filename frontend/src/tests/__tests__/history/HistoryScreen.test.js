import React from "react";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import HistoryScreen from "../../../../app/(main)/history";
import apiService from "../../../services/api/apiService";

const PAGE_SIZE = 20;

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

const buildHistoryEntry = (overrides = {}) => {
    const { podcast: podcastOverrides = {}, ...entryOverrides } = overrides;

    return {
        id: 11,
        podcast_id: 21,
        position: 120,
        completed: false,
        updated_at: "2026-05-21T10:00:00Z",
        podcast: {
            title: "Focus-safe listening",
            thumbnail_url: null,
            duration: 360,
            owner: { name: "ProPod FM" },
            ...podcastOverrides,
        },
        ...entryOverrides,
    };
};

const buildHistoryPage = (count, startIndex = 0) => Array.from({ length: count }, (_, index) => {
    const id = startIndex + index + 1;

    return buildHistoryEntry({
        id,
        podcast_id: id + 100,
        updated_at: `2026-05-21T10:${String(index).padStart(2, "0")}:00Z`,
        podcast: {
            title: `History episode ${id}`,
        },
    });
});

jest.mock("../../../services/api/apiService", () => ({
    __esModule: true,
    default: {
        deleteListeningHistory: jest.fn(),
        getListeningHistory: jest.fn(),
    },
}));

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
                    accessibilityLabel: "Load more listening history",
                    onPress: onEndReached,
                })
                : null,
            renderListPart(ListFooterComponent)
        );
    };

    return {
        ...actual,
        FlatList,
        RefreshControl: createRefreshControlMock(actual, "Refresh listening history"),
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
    };
});

describe("HistoryScreen", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockFocusEffectCallbacks.clear();
        mockFocusEffectCleanups.clear();
    });

    it("keeps loaded entries visible while a refocus refresh is in flight", async () => {
        const deferredRefresh = createDeferred();

        apiService.getListeningHistory
            .mockResolvedValueOnce([buildHistoryEntry()])
            .mockReturnValueOnce(deferredRefresh.promise);

        const { getByText } = render(<HistoryScreen />);

        await waitFor(() => {
            expect(apiService.getListeningHistory).toHaveBeenCalledWith({ skip: 0, limit: 20 });
        });

        expect(getByText("Focus-safe listening")).toBeTruthy();

        await act(async () => {
            emitScreenBlur();
            emitScreenFocus();
        });

        await waitFor(() => {
            expect(apiService.getListeningHistory).toHaveBeenCalledTimes(2);
        });

        expect(getByText("Focus-safe listening")).toBeTruthy();

        await act(async () => {
            deferredRefresh.resolve([
                buildHistoryEntry({
                    position: 180,
                    updated_at: "2026-05-21T10:05:00Z",
                }),
            ]);
        });

        await waitFor(() => {
            expect(getByText(/50% listened/)).toBeTruthy();
        });
    });

    it("keeps loaded entries visible and shows inline retry copy when a refocus refresh fails", async () => {
        apiService.getListeningHistory
            .mockResolvedValueOnce([buildHistoryEntry()])
            .mockRejectedValueOnce(new Error("Refresh failed"));

        const { getByText, queryByText } = render(<HistoryScreen />);

        await waitFor(() => {
            expect(apiService.getListeningHistory).toHaveBeenCalledWith({ skip: 0, limit: 20 });
        });

        expect(getByText("Focus-safe listening")).toBeTruthy();

        await act(async () => {
            emitScreenBlur();
            emitScreenFocus();
        });

        await waitFor(() => {
            expect(apiService.getListeningHistory).toHaveBeenCalledTimes(2);
        });

        await waitFor(() => {
            expect(getByText("Focus-safe listening")).toBeTruthy();
            expect(getByText("Couldn't refresh listening history.")).toBeTruthy();
            expect(getByText("Refresh failed")).toBeTruthy();
        });

        expect(queryByText("alert-circle-outline")).toBeNull();
    });

    it("keeps loaded entries visible and shows inline retry copy when pull to refresh fails", async () => {
        apiService.getListeningHistory
            .mockResolvedValueOnce([buildHistoryEntry()])
            .mockRejectedValueOnce(new Error("Pull to refresh failed"));

        const { getByLabelText, getByText, queryByText } = render(<HistoryScreen />);

        await waitFor(() => {
            expect(apiService.getListeningHistory).toHaveBeenCalledWith({ skip: 0, limit: 20 });
        });

        fireEvent.press(getByLabelText("Refresh listening history"));

        await waitFor(() => {
            expect(apiService.getListeningHistory).toHaveBeenCalledTimes(2);
        });

        await waitFor(() => {
            expect(getByText("Focus-safe listening")).toBeTruthy();
            expect(getByText("Couldn't refresh listening history.")).toBeTruthy();
            expect(getByText("Pull to refresh failed")).toBeTruthy();
        });

        expect(queryByText("alert-circle-outline")).toBeNull();
    });

    it("preserves the previous pagination offset after a refresh failure", async () => {
        apiService.getListeningHistory
            .mockResolvedValueOnce(buildHistoryPage(PAGE_SIZE))
            .mockRejectedValueOnce(new Error("Refresh failed"))
            .mockResolvedValueOnce([
                buildHistoryEntry({
                    id: 999,
                    podcast_id: 1999,
                    podcast: { title: "Next page episode" },
                }),
            ]);

        const { getByLabelText, getByText } = render(<HistoryScreen />);

        await waitFor(() => {
            expect(apiService.getListeningHistory).toHaveBeenNthCalledWith(1, { skip: 0, limit: PAGE_SIZE });
        });

        await act(async () => {
            emitScreenBlur();
            emitScreenFocus();
        });

        await waitFor(() => {
            expect(apiService.getListeningHistory).toHaveBeenNthCalledWith(2, { skip: 0, limit: PAGE_SIZE });
        });

        fireEvent.press(getByLabelText("Load more listening history"));

        await waitFor(() => {
            expect(apiService.getListeningHistory).toHaveBeenNthCalledWith(3, { skip: PAGE_SIZE, limit: PAGE_SIZE });
        });

        expect(getByText("Next page episode")).toBeTruthy();
    });

    it("does not paginate while a refresh request is still in flight", async () => {
        const deferredRefresh = createDeferred();

        apiService.getListeningHistory
            .mockResolvedValueOnce(buildHistoryPage(PAGE_SIZE))
            .mockReturnValueOnce(deferredRefresh.promise);

        const { getByLabelText } = render(<HistoryScreen />);

        await waitFor(() => {
            expect(apiService.getListeningHistory).toHaveBeenNthCalledWith(1, { skip: 0, limit: PAGE_SIZE });
        });

        await act(async () => {
            emitScreenBlur();
            emitScreenFocus();
        });

        await waitFor(() => {
            expect(apiService.getListeningHistory).toHaveBeenCalledTimes(2);
        });

        fireEvent.press(getByLabelText("Load more listening history"));

        expect(apiService.getListeningHistory).toHaveBeenCalledTimes(2);

        await act(async () => {
            deferredRefresh.resolve(buildHistoryPage(PAGE_SIZE, PAGE_SIZE));
        });

        await waitFor(() => {
            expect(apiService.getListeningHistory).toHaveBeenCalledTimes(2);
        });
    });
});