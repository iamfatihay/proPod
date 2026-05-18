import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import NotificationsScreen from "../../../../app/(main)/notifications";

const mockPush = jest.fn();
const mockFetchNotifications = jest.fn().mockResolvedValue(undefined);
const mockMarkAllRead = jest.fn();
const mockMarkAsReadWithSync = jest.fn();
const mockMarkAllAsReadWithSync = jest.fn();

const mockNotificationStoreState = {
    notifications: [
        {
            id: "notif_failed_1",
            type: "rtc_failed",
            title: "Recording Failed",
            message: "Tap to review the failed live session.",
            created_at: new Date("2026-05-16T12:00:00Z").getTime(),
            read: false,
            action: {
                type: "navigate",
                screen: "rtc-sessions",
                params: { focusSessionId: "42" },
            },
        },
    ],
    unreadCount: 1,
    fetchNotifications: mockFetchNotifications,
    markAllRead: mockMarkAllRead,
    markAsReadWithSync: mockMarkAsReadWithSync,
    markAllAsReadWithSync: mockMarkAllAsReadWithSync,
};

const mockDmStoreState = {
    unreadDMCount: 0,
};

jest.mock("react-native", () => {
    const actual = jest.requireActual("react-native");
    const {
        createFlatListMock,
        createRefreshControlMock,
    } = require("../../utils/reactNativeScreenTestHelpers");

    return {
        ...actual,
        FlatList: createFlatListMock(actual),
        RefreshControl: createRefreshControlMock(actual, "Refresh notifications"),
    };
});

jest.mock("expo-router", () => {
    const React = require("react");

    return {
        useRouter: () => ({
            push: mockPush,
        }),
        useFocusEffect: (callback) => {
            React.useEffect(() => callback(), [callback]);
        },
    };
});

jest.mock("../../../context/useNotificationStore", () => ({
    __esModule: true,
    default: (selector) => selector(mockNotificationStoreState),
}));

jest.mock("../../../context/useDMStore", () => ({
    __esModule: true,
    default: (selector) => selector(mockDmStoreState),
}));

jest.mock("@expo/vector-icons", () => {
    const React = require("react");
    const { Text } = require("react-native");

    return {
        Ionicons: ({ name }) => <Text>{name}</Text>,
    };
});

describe("NotificationsScreen", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("opens the focused RTC session history entry from failed notifications", async () => {
        const { getByText } = render(<NotificationsScreen />);

        await waitFor(() => {
            expect(mockFetchNotifications).toHaveBeenCalledTimes(1);
            expect(mockMarkAllRead).toHaveBeenCalledTimes(1);
        });

        fireEvent.press(getByText("Recording Failed"));

        expect(mockMarkAsReadWithSync).toHaveBeenCalledWith("notif_failed_1");
        expect(mockPush).toHaveBeenCalledWith({
            pathname: "/(main)/rtc-sessions",
            params: { focusSessionId: "42" },
        });
    });
});