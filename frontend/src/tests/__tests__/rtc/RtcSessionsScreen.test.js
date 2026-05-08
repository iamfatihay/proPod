import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import RtcSessionsScreen from "../../../../app/(main)/rtc-sessions";
import apiService from "../../../services/api/apiService";

const mockPush = jest.fn();
const mockBack = jest.fn();
let mockParams = {};

jest.mock("../../../services/api/apiService", () => ({
    __esModule: true,
    default: {
        listRtcSessions: jest.fn(),
    },
}));

jest.mock("react-native", () => {
    const React = require("react");
    const actual = jest.requireActual("react-native");

    const renderListPart = (part) => {
        if (!part) {
            return null;
        }

        if (typeof part === "function") {
            const Part = part;
            return <Part />;
        }

        return part;
    };

    const FlatList = ({
        data = [],
        ListEmptyComponent,
        ListFooterComponent,
        ListHeaderComponent,
        renderItem,
    }) => (
        <actual.View>
            {renderListPart(ListHeaderComponent)}
            {data.length === 0
                ? renderListPart(ListEmptyComponent)
                : data.map((item) => (
                    <actual.View key={String(item.id)}>
                        {renderItem({ item })}
                    </actual.View>
                ))}
            {renderListPart(ListFooterComponent)}
        </actual.View>
    );

    const RefreshControl = () => null;

    return {
        ...actual,
        FlatList,
        RefreshControl,
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
        useLocalSearchParams: () => mockParams,
        useFocusEffect: (callback) => {
            React.useEffect(() => callback(), [callback]);
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

describe("RtcSessionsScreen", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockParams = {};
    });

    it("renders recent sessions and opens ready podcasts", async () => {
        mockParams = { focusSessionId: "42" };
        apiService.listRtcSessions.mockResolvedValue([
            {
                id: 42,
                title: "Weekly Roundtable",
                room_name: "weekly-roundtable",
                created_at: "2026-05-08T10:00:00Z",
                media_mode: "video",
                participant_count: 3,
                duration_seconds: 1860,
                podcast_id: 77,
                status: "completed",
                is_live: false,
            },
            {
                id: 18,
                title: "Guest Check-In",
                room_name: "guest-check-in",
                created_at: "2026-05-07T08:30:00Z",
                media_mode: "audio",
                participant_count: 2,
                duration_seconds: 420,
                podcast_id: null,
                status: "ended",
                is_live: false,
                invite_code: "ABCD1234",
            },
        ]);

        const { getByText, getByLabelText } = render(<RtcSessionsScreen />);

        await waitFor(() => {
            expect(apiService.listRtcSessions).toHaveBeenCalledWith({ limit: 25 });
        });

        expect(getByText("Recent Live Sessions")).toBeTruthy();
        expect(getByText("Weekly Roundtable")).toBeTruthy();
        expect(getByText("Podcast ready")).toBeTruthy();
        expect(getByText("Processing recording")).toBeTruthy();
        expect(getByText("Latest session")).toBeTruthy();

        fireEvent.press(getByLabelText("Open podcast for Weekly Roundtable"));

        expect(mockPush).toHaveBeenCalledWith({
            pathname: "/(main)/details",
            params: { id: "77" },
        });
    });

    it("shows the empty state when there are no live sessions", async () => {
        apiService.listRtcSessions.mockResolvedValue([]);

        const { getByText } = render(<RtcSessionsScreen />);

        await waitFor(() => {
            expect(apiService.listRtcSessions).toHaveBeenCalled();
        });

        expect(getByText("No live sessions yet")).toBeTruthy();
        expect(
            getByText(
                "Start a multi-host live session from Create to track recording progress here."
            )
        ).toBeTruthy();
    });
});