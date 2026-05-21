import React from "react";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import MessagesScreen from "../../../../app/(main)/messages";
import apiService from "../../../services/api/apiService";

const mockPush = jest.fn();
const mockResetDMUnread = jest.fn();
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

const buildThread = (overrides = {}) => ({
    partner_id: 12,
    partner_name: "Casey",
    unread_count: 1,
    last_message_body: "Can we record tonight?",
    last_message_at: "2026-05-21T10:00:00Z",
    ...overrides,
});

jest.mock("../../../services/api/apiService", () => ({
    __esModule: true,
    default: {
        getDMInbox: jest.fn(),
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
        RefreshControl: createRefreshControlMock(actual, "Refresh messages"),
    };
});

jest.mock("expo-router", () => {
    const React = require("react");

    mockFocusEffectCallbacks = new Set();
    mockFocusEffectCleanups = new Map();

    return {
        Stack: {
            Screen: () => null,
        },
        useRouter: () => ({
            push: mockPush,
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

jest.mock("../../../context/useDMStore", () => ({
    __esModule: true,
    default: (selector) => selector({ resetDMUnread: mockResetDMUnread }),
}));

jest.mock("@expo/vector-icons", () => {
    const React = require("react");
    const { Text } = require("react-native");

    return {
        Ionicons: ({ name }) => <Text>{name}</Text>,
    };
});

describe("MessagesScreen", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockFocusEffectCallbacks.clear();
        mockFocusEffectCleanups.clear();
    });

    it("keeps loaded threads visible while a refocus refresh is in flight", async () => {
        const deferredRefresh = createDeferred();

        apiService.getDMInbox
            .mockResolvedValueOnce({ threads: [buildThread()] })
            .mockReturnValueOnce(deferredRefresh.promise);

        const { getByText } = render(<MessagesScreen />);

        await waitFor(() => {
            expect(apiService.getDMInbox).toHaveBeenCalledTimes(1);
        });

        expect(getByText("Casey")).toBeTruthy();

        await act(async () => {
            emitScreenBlur();
            emitScreenFocus();
        });

        await waitFor(() => {
            expect(apiService.getDMInbox).toHaveBeenCalledTimes(2);
        });

        expect(getByText("Casey")).toBeTruthy();

        await act(async () => {
            deferredRefresh.resolve({
                threads: [buildThread({ last_message_body: "See you in the room." })],
            });
        });

        await waitFor(() => {
            expect(getByText("See you in the room.")).toBeTruthy();
        });
    });

    it("keeps loaded threads visible and shows inline retry copy when a refocus refresh fails", async () => {
        apiService.getDMInbox
            .mockResolvedValueOnce({ threads: [buildThread()] })
            .mockRejectedValueOnce(new Error("Refresh failed"));

        const { getByText, queryByText } = render(<MessagesScreen />);

        await waitFor(() => {
            expect(apiService.getDMInbox).toHaveBeenCalledTimes(1);
        });

        await act(async () => {
            emitScreenBlur();
            emitScreenFocus();
        });

        await waitFor(() => {
            expect(apiService.getDMInbox).toHaveBeenCalledTimes(2);
        });

        await waitFor(() => {
            expect(getByText("Casey")).toBeTruthy();
            expect(getByText("Couldn't refresh messages.")).toBeTruthy();
            expect(getByText("Refresh failed")).toBeTruthy();
        });

        expect(queryByText("Couldn't load messages.")).toBeNull();
    });

    it("does not treat a cancelled focus load as a completed inbox load", async () => {
        const cancelledLoad = createDeferred();

        apiService.getDMInbox
            .mockReturnValueOnce(cancelledLoad.promise)
            .mockRejectedValueOnce(new Error("Refocus failed"));

        const { getByText, queryByText } = render(<MessagesScreen />);

        await waitFor(() => {
            expect(apiService.getDMInbox).toHaveBeenCalledTimes(1);
        });

        await act(async () => {
            emitScreenBlur();
        });

        await act(async () => {
            cancelledLoad.resolve({ threads: [buildThread()] });
        });

        await act(async () => {
            emitScreenFocus();
        });

        await waitFor(() => {
            expect(apiService.getDMInbox).toHaveBeenCalledTimes(2);
        });

        await waitFor(() => {
            expect(getByText("Couldn't load messages.")).toBeTruthy();
            expect(getByText("Refocus failed")).toBeTruthy();
        });

        expect(queryByText("Couldn't refresh messages.")).toBeNull();
    });

    it("keeps the inline refresh error visible and disables retry while an inbox retry is in flight", async () => {
        const deferredRetry = createDeferred();

        apiService.getDMInbox
            .mockResolvedValueOnce({ threads: [buildThread()] })
            .mockRejectedValueOnce(new Error("Retry failed"))
            .mockReturnValueOnce(deferredRetry.promise);

        const { getByLabelText, getByText } = render(<MessagesScreen />);

        await waitFor(() => {
            expect(apiService.getDMInbox).toHaveBeenCalledTimes(1);
        });

        fireEvent.press(getByLabelText("Refresh messages"));

        await waitFor(() => {
            expect(apiService.getDMInbox).toHaveBeenCalledTimes(2);
        });

        await waitFor(() => {
            expect(getByText("Couldn't refresh messages.")).toBeTruthy();
            expect(getByText("Retry failed")).toBeTruthy();
        });

        fireEvent.press(getByLabelText("Retry refreshing messages"));

        await waitFor(() => {
            expect(apiService.getDMInbox).toHaveBeenCalledTimes(3);
        });

        expect(getByText("Retry failed")).toBeTruthy();
        expect(getByText("Retrying...")).toBeTruthy();

        await act(async () => {
            deferredRetry.resolve({
                threads: [buildThread({ last_message_body: "Retry succeeded" })],
            });
        });

        await waitFor(() => {
            expect(getByText("Retry succeeded")).toBeTruthy();
        });
    });
});