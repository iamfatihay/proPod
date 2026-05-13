import React from "react";
import { act, render, waitFor } from "@testing-library/react-native";
import AnalyticsScreen from "../../../../app/(main)/analytics";
import { withTabScreenBottomPadding } from "../../../constants/theme";
import apiService from "../../../services/api/apiService";

const mockPush = jest.fn();
const mockBack = jest.fn();

jest.mock("../../../services/api/apiService", () => ({
    __esModule: true,
    default: {
        getCreatorDashboard: jest.fn(),
        getPlaysOverTime: jest.fn(),
    },
}));

jest.mock("react-native", () => {
    const React = require("react");
    const actual = jest.requireActual("react-native");

    const ScrollView = ({
        children,
        refreshControl,
        testID = "analytics-scroll-view",
        ...props
    }) =>
        React.createElement(
            actual.ScrollView || "ScrollView",
            { ...props, refreshControl, testID },
            refreshControl,
            children
        );

    const RefreshControl = (props) =>
        React.createElement(actual.View || "View", props);

    return {
        ...actual,
        ScrollView,
        RefreshControl,
        Animated: {
            ...actual.Animated,
            spring: jest.fn(() => ({
                start: jest.fn(),
            })),
            stagger: jest.fn(() => ({
                start: jest.fn(),
            })),
        },
    };
});

jest.mock("expo-router", () => {
    const React = require("react");

    return {
        Stack: {
            Screen: () => null,
        },
        useRouter: () => ({
            push: mockPush,
            back: mockBack,
        }),
        useFocusEffect: (callback) => {
            React.useEffect(() => callback(), [callback]);
        },
    };
});

jest.mock("@expo/vector-icons", () => {
    const React = require("react");
    const { Text } = require("react-native");

    return {
        Ionicons: ({ name }) => <Text>{name}</Text>,
        MaterialCommunityIcons: ({ name }) => <Text>{name}</Text>,
    };
});

const dashboardResponse = {
    total_podcasts: 4,
    total_plays: 1250,
    total_likes: 84,
    total_bookmarks: 23,
    total_comments: 11,
    average_completion_rate: 62,
    recent_likes: 8,
    recent_bookmarks: 5,
    recent_comments: 2,
    top_podcasts: [
        {
            id: 7,
            title: "Signal From Abroad",
            category: "Technology",
            play_count: 420,
        },
    ],
    category_distribution: [
        {
            category: "Technology",
            count: 3,
        },
    ],
};

const chartResponse = {
    data: [
        { date: "2026-05-01", plays: 12 },
        { date: "2026-05-02", plays: 18 },
        { date: "2026-05-03", plays: 9 },
    ],
};

describe("AnalyticsScreen", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        apiService.getCreatorDashboard.mockResolvedValue(dashboardResponse);
        apiService.getPlaysOverTime.mockResolvedValue(chartResponse);
    });

    it("applies shared tab bottom padding to the analytics scroll container", async () => {
        const { findByText, getByTestId } = render(<AnalyticsScreen />);

        await waitFor(() => {
            expect(apiService.getCreatorDashboard).toHaveBeenCalledWith(30);
            expect(apiService.getPlaysOverTime).toHaveBeenCalledWith(30);
        });

        expect(await findByText("All-time totals")).toBeTruthy();

        const scrollView = getByTestId("analytics-scroll-view");

        expect(scrollView.props.contentContainerStyle).toEqual(
            withTabScreenBottomPadding({ padding: 16 })
        );
    });

    it("reloads analytics data when pull-to-refresh runs", async () => {
        const { findByText, getByTestId } = render(<AnalyticsScreen />);

        await waitFor(() => {
            expect(apiService.getCreatorDashboard).toHaveBeenCalledTimes(1);
            expect(apiService.getPlaysOverTime).toHaveBeenCalledTimes(1);
        });

        expect(await findByText("All-time totals")).toBeTruthy();

        const scrollView = getByTestId("analytics-scroll-view");

        await act(async () => {
            await scrollView.props.refreshControl.props.onRefresh();
        });

        await waitFor(() => {
            expect(apiService.getCreatorDashboard).toHaveBeenCalledTimes(2);
            expect(apiService.getPlaysOverTime).toHaveBeenCalledTimes(2);
        });

        expect(apiService.getCreatorDashboard).toHaveBeenLastCalledWith(30);
        expect(apiService.getPlaysOverTime).toHaveBeenLastCalledWith(30);
    });
});