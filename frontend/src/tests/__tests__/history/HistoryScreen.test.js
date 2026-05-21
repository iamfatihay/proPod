import React from "react";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import HistoryScreen from "../../../../app/(main)/history";
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

const buildHistoryEntry = (overrides = {}) => ({
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
    },
    ...overrides,
});

jest.mock("../../../services/api/apiService", () => ({
    __esModule: true,
    default: {
        deleteListeningHistory: jest.fn(),
        getListeningHistory: jest.fn(),
    },
}));

jest.mock("react-native", () => {
    const actual = jest.requireActual("react-native");
    const {
        createFlatListMock,
        createRefreshControlMock,
    } = require("../../utils/reactNativeScreenTestHelpers");

    return {
        ...actual,
        FlatList: createFlatListMock(actual),
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
});