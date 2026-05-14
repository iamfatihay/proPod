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
    const actual = jest.requireActual("react-native");
    const {
        createFlatListMock,
        createRefreshControlMock,
    } = require("../../utils/reactNativeScreenTestHelpers");

    return {
        ...actual,
        FlatList: createFlatListMock(actual),
        RefreshControl: createRefreshControlMock(actual, "Refresh live sessions"),
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
                recording_status: "completed",
                is_live: false,
            },
            {
                id: 18,
                title: "Guest Check-In",
                room_name: "guest-check-in",
                created_at: "2026-05-07T08:30:00Z",
                media_mode: "audio",
                participant_count: 0,
                duration_seconds: 420,
                podcast_id: null,
                status: "ended",
                recording_status: "processing",
                is_live: false,
                invite_code: "ABCD1234",
            },
        ]);

        const { getByText, getByLabelText } = render(<RtcSessionsScreen />);

        await waitFor(() => {
            expect(apiService.listRtcSessions).toHaveBeenCalledWith({ limit: 25, offset: 0 });
        });

        expect(getByText("Recent Live Sessions")).toBeTruthy();
        expect(getByText("Weekly Roundtable")).toBeTruthy();
        expect(getByText("Podcast ready")).toBeTruthy();
        expect(getByText("Processing recording")).toBeTruthy();
        expect(getByText("Latest session")).toBeTruthy();
        expect(getByText("No participants")).toBeTruthy();

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

    it("shows only the error state when loading sessions fails", async () => {
        apiService.listRtcSessions.mockRejectedValue(new Error("Network unavailable"));

        const { getByText, queryByText } = render(<RtcSessionsScreen />);

        await waitFor(() => {
            expect(apiService.listRtcSessions).toHaveBeenCalled();
        });

        expect(getByText("Couldn't load live sessions.")).toBeTruthy();
        expect(getByText("Network unavailable")).toBeTruthy();
        expect(queryByText("No live sessions yet")).toBeNull();
    });

    it("loads older sessions when more history is available", async () => {
        const firstPage = Array.from({ length: 25 }, (_, index) => ({
            id: 100 - index,
            title: `Session ${index + 1}`,
            room_name: `session-${index + 1}`,
            created_at: "2026-05-08T10:00:00Z",
            media_mode: "audio",
            participant_count: 2,
            duration_seconds: 300,
            podcast_id: null,
            status: "ended",
            recording_status: "processing",
            is_live: false,
        }));

        apiService.listRtcSessions
            .mockResolvedValueOnce(firstPage)
            .mockResolvedValueOnce([
                {
                    id: 50,
                    title: "Older Planning Session",
                    room_name: "older-planning-session",
                    created_at: "2026-05-07T10:00:00Z",
                    media_mode: "video",
                    participant_count: 3,
                    duration_seconds: 1200,
                    podcast_id: null,
                    status: "ended",
                    recording_status: "processing",
                    is_live: false,
                },
            ]);

        const { getByLabelText, getByText, queryByText } = render(<RtcSessionsScreen />);

        await waitFor(() => {
            expect(getByText("Session 1")).toBeTruthy();
        });

        fireEvent.press(getByLabelText("Load more live sessions"));

        await waitFor(() => {
            expect(apiService.listRtcSessions).toHaveBeenLastCalledWith({
                limit: 25,
                offset: 25,
            });
        });

        expect(getByText("Older Planning Session")).toBeTruthy();
        expect(queryByText("Load More Sessions")).toBeNull();
    });

    it("does not paginate while a refresh request is in flight", async () => {
        const firstPage = Array.from({ length: 25 }, (_, index) => ({
            id: 200 - index,
            title: `Session ${index + 1}`,
            room_name: `session-${index + 1}`,
            created_at: "2026-05-08T10:00:00Z",
            media_mode: "audio",
            participant_count: 2,
            duration_seconds: 300,
            podcast_id: null,
            status: "ended",
            recording_status: "processing",
            is_live: false,
        }));

        let resolveRefresh;
        const refreshPromise = new Promise((resolve) => {
            resolveRefresh = resolve;
        });

        apiService.listRtcSessions
            .mockResolvedValueOnce(firstPage)
            .mockImplementationOnce(() => refreshPromise);

        const { getByLabelText, getByText } = render(<RtcSessionsScreen />);

        await waitFor(() => {
            expect(getByText("Session 1")).toBeTruthy();
        });

        fireEvent.press(getByLabelText("Refresh live sessions"));

        await waitFor(() => {
            expect(apiService.listRtcSessions).toHaveBeenCalledTimes(2);
        });

        fireEvent.press(getByLabelText("Load more live sessions"));

        expect(apiService.listRtcSessions).toHaveBeenCalledTimes(2);

        resolveRefresh(firstPage);

        await waitFor(() => {
            expect(apiService.listRtcSessions).toHaveBeenLastCalledWith({
                limit: 25,
                offset: 0,
            });
        });
    });
});