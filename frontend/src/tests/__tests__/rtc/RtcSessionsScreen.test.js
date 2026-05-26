import React from "react";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import RtcSessionsScreen from "../../../../app/(main)/rtc-sessions";
import apiService from "../../../services/api/apiService";

const mockPush = jest.fn();
const mockBack = jest.fn();
let mockParams = {};
var mockAppState;
var mockAppStateListeners;
var mockEmitAppStateChange;
var mockFocusEffectCallbacks;
var mockFocusEffectCleanups;

const emitAppStateChange = (nextState) => {
    mockEmitAppStateChange(nextState);
};

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

jest.mock("../../../services/api/apiService", () => ({
    __esModule: true,
    default: {
        getRtcSession: jest.fn(),
        listRtcSessions: jest.fn(),
    },
}));

jest.mock("react-native", () => {
    const actual = jest.requireActual("react-native");
    const {
        createFlatListMock,
        createRefreshControlMock,
    } = require("../../utils/reactNativeScreenTestHelpers");

    mockAppStateListeners = new Set();
    mockAppState = {
        currentState: "active",
        addEventListener: jest.fn((eventType, listener) => {
            if (eventType === "change") {
                mockAppStateListeners.add(listener);
            }

            return {
                remove: () => {
                    mockAppStateListeners.delete(listener);
                },
            };
        }),
    };
    mockEmitAppStateChange = (nextState) => {
        mockAppState.currentState = nextState;
        mockAppStateListeners.forEach((listener) => listener(nextState));
    };

    return {
        ...actual,
        AppState: mockAppState,
        FlatList: createFlatListMock(actual),
        RefreshControl: createRefreshControlMock(actual, "Refresh live sessions"),
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
            back: mockBack,
        }),
        useLocalSearchParams: () => mockParams,
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

describe("RtcSessionsScreen", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        AsyncStorage.__clearMockStorage();
        mockParams = {};
        mockAppStateListeners.clear();
        mockAppState.currentState = "active";
        mockFocusEffectCallbacks.clear();
        mockFocusEffectCleanups.clear();
    });

    it("renders recent sessions and opens ready podcasts", async () => {
        mockParams = { focusSessionId: "42" };
        apiService.listRtcSessions.mockResolvedValue({
            sessions: [
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
            ],
            total: 2,
            limit: 25,
            offset: 0,
            has_more: false,
        });

        const { getByText, getByLabelText } = render(<RtcSessionsScreen />);

        await waitFor(() => {
            expect(apiService.listRtcSessions).toHaveBeenCalledWith({ limit: 25, offset: 0 });
        });

        expect(getByText("Recent Live Sessions")).toBeTruthy();
        expect(
            getByText("2 sessions total. Review recent live sessions and whether each recording is ready.")
        ).toBeTruthy();
        expect(getByText("Weekly Roundtable")).toBeTruthy();
        expect(getByText("Podcast ready")).toBeTruthy();
        expect(getByText("Processing recording")).toBeTruthy();
        expect(getByText("Latest session")).toBeTruthy();
        expect(getByText("No participants")).toBeTruthy();
        expect(getByText("You're all caught up")).toBeTruthy();
        expect(getByText("Showing all 2 sessions in your live recording history.")).toBeTruthy();

        fireEvent.press(getByLabelText("Open podcast for Weekly Roundtable"));

        expect(mockPush).toHaveBeenCalledWith({
            pathname: "/(main)/details",
            params: { id: "77" },
        });
    });

    it("shows the empty state when there are no live sessions", async () => {
        apiService.listRtcSessions.mockResolvedValue({
            sessions: [],
            total: 0,
            limit: 25,
            offset: 0,
            has_more: false,
        });

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

    it("keeps the empty state visible when a refresh fails after an empty load", async () => {
        apiService.listRtcSessions
            .mockResolvedValueOnce({
                sessions: [],
                total: 0,
                limit: 25,
                offset: 0,
                has_more: false,
            })
            .mockRejectedValueOnce(new Error("Refresh failed"));

        const { getByLabelText, getByText, queryByText } = render(<RtcSessionsScreen />);

        await waitFor(() => {
            expect(getByText("No live sessions yet")).toBeTruthy();
        });

        fireEvent.press(getByLabelText("Refresh live sessions"));

        await waitFor(() => {
            expect(apiService.listRtcSessions).toHaveBeenCalledTimes(2);
        });

        await waitFor(() => {
            expect(getByText("Couldn't refresh live sessions.")).toBeTruthy();
        });

        expect(getByText("No live sessions yet")).toBeTruthy();
        expect(
            getByText(
                "Start a multi-host live session from Create to track recording progress here."
            )
        ).toBeTruthy();
        expect(queryByText("Couldn't load live sessions.")).toBeNull();
    });

    it("offers a failed-session recovery action with the prior setup", async () => {
        apiService.listRtcSessions.mockResolvedValue({
            sessions: [
                {
                    id: 44,
                    title: "Retry Roundtable",
                    description: "Re-run after processing failed",
                    room_name: "retry-roundtable",
                    created_at: "2026-05-08T10:00:00Z",
                    media_mode: "audio",
                    category: "Business",
                    is_public: true,
                    participant_count: 2,
                    duration_seconds: 300,
                    podcast_id: null,
                    status: "ended",
                    recording_status: "failed",
                    is_live: false,
                },
            ],
            total: 1,
            limit: 25,
            offset: 0,
            has_more: false,
        });

        const { getByLabelText, getByText } = render(<RtcSessionsScreen />);

        await waitFor(() => {
            expect(getByText("Use Same Setup")).toBeTruthy();
        });

        fireEvent.press(getByLabelText("Start a similar session for Retry Roundtable"));

        expect(mockPush).toHaveBeenCalledWith({
            pathname: "/(main)/create",
            params: {
                mode: "full-create",
                recordingMode: "multi",
                rtcMediaMode: "audio",
                prefillTitle: "Retry Roundtable",
                prefillDescription: "Re-run after processing failed",
                prefillCategory: "Business",
                prefillIsPublic: "true",
                sourceSessionId: "44",
            },
        });
    });

    it("checks a processing session inline and updates the card when recording finishes", async () => {
        apiService.listRtcSessions.mockResolvedValue({
            sessions: [
                {
                    id: 55,
                    title: "Processing Roundtable",
                    room_name: "processing-roundtable",
                    created_at: "2026-05-08T10:00:00Z",
                    media_mode: "audio",
                    participant_count: 2,
                    duration_seconds: 300,
                    podcast_id: null,
                    status: "ended",
                    recording_status: "processing",
                    is_live: false,
                },
            ],
            total: 1,
            limit: 25,
            offset: 0,
            has_more: false,
        });
        apiService.getRtcSession.mockResolvedValue({
            id: 55,
            title: "Processing Roundtable",
            room_name: "processing-roundtable",
            created_at: "2026-05-08T10:00:00Z",
            media_mode: "audio",
            participant_count: 2,
            duration_seconds: 300,
            podcast_id: 91,
            status: "ended",
            recording_status: "completed",
            is_live: false,
        });

        const { getByLabelText, getByText } = render(<RtcSessionsScreen />);

        await waitFor(() => {
            expect(getByText("Check Status")).toBeTruthy();
        });

        fireEvent.press(getByLabelText("Check recording status for Processing Roundtable"));

        await waitFor(() => {
            expect(apiService.getRtcSession).toHaveBeenCalledWith(55);
        });

        await waitFor(() => {
            expect(getByText("Podcast ready")).toBeTruthy();
        });

        expect(getByText("Checked just now. Podcast is ready.")).toBeTruthy();

        fireEvent.press(getByLabelText("Open podcast for Processing Roundtable"));

        expect(mockPush).toHaveBeenCalledWith({
            pathname: "/(main)/details",
            params: { id: "91" },
        });
    });

    it("shows an inline error when a processing status refresh fails", async () => {
        apiService.listRtcSessions.mockResolvedValue({
            sessions: [
                {
                    id: 56,
                    title: "Delayed Recording",
                    room_name: "delayed-recording",
                    created_at: "2026-05-08T10:00:00Z",
                    media_mode: "video",
                    participant_count: 3,
                    duration_seconds: 900,
                    podcast_id: null,
                    status: "ended",
                    recording_status: "processing",
                    is_live: false,
                },
            ],
            total: 1,
            limit: 25,
            offset: 0,
            has_more: false,
        });
        apiService.getRtcSession.mockRejectedValue(new Error("Status check timed out"));

        const { getByLabelText, getByText } = render(<RtcSessionsScreen />);

        await waitFor(() => {
            expect(getByText("Check Status")).toBeTruthy();
        });

        fireEvent.press(getByLabelText("Check recording status for Delayed Recording"));

        await waitFor(() => {
            expect(apiService.getRtcSession).toHaveBeenCalledWith(56);
        });

        await waitFor(() => {
            expect(getByText("Status check timed out")).toBeTruthy();
        });
    });

    it("keeps a manual status-check error visible after a successful list refresh", async () => {
        apiService.listRtcSessions
            .mockResolvedValueOnce({
                sessions: [
                    {
                        id: 68,
                        title: "Retrying Processing Session",
                        room_name: "retrying-processing-session",
                        created_at: "2026-05-08T10:00:00Z",
                        media_mode: "audio",
                        participant_count: 2,
                        duration_seconds: 900,
                        podcast_id: null,
                        status: "ended",
                        recording_status: "processing",
                        is_live: false,
                    },
                ],
                total: 1,
                limit: 25,
                offset: 0,
                has_more: false,
            })
            .mockResolvedValueOnce({
                sessions: [
                    {
                        id: 68,
                        title: "Retrying Processing Session",
                        room_name: "retrying-processing-session",
                        created_at: "2026-05-08T10:00:00Z",
                        media_mode: "audio",
                        participant_count: 2,
                        duration_seconds: 900,
                        podcast_id: null,
                        status: "ended",
                        recording_status: "processing",
                        is_live: false,
                    },
                ],
                total: 1,
                limit: 25,
                offset: 0,
                has_more: false,
            });
        apiService.getRtcSession.mockRejectedValue(new Error("Status check timed out"));

        const { getByLabelText, getByText } = render(<RtcSessionsScreen />);

        await waitFor(() => {
            expect(getByText("Check Status")).toBeTruthy();
        });

        fireEvent.press(getByLabelText("Check recording status for Retrying Processing Session"));

        await waitFor(() => {
            expect(apiService.getRtcSession).toHaveBeenCalledWith(68);
        });

        await waitFor(() => {
            expect(getByText("Status check timed out")).toBeTruthy();
        });

        fireEvent.press(getByLabelText("Refresh live sessions"));

        await waitFor(() => {
            expect(apiService.listRtcSessions).toHaveBeenCalledTimes(2);
        });

        expect(getByText("Retrying Processing Session")).toBeTruthy();
        expect(getByText("Status check timed out")).toBeTruthy();
    });

    it("confirms when a processing session is still preparing after a manual check", async () => {
        apiService.listRtcSessions.mockResolvedValue({
            sessions: [
                {
                    id: 57,
                    title: "Long Processing Session",
                    room_name: "long-processing-session",
                    created_at: "2026-05-08T10:00:00Z",
                    media_mode: "audio",
                    participant_count: 2,
                    duration_seconds: 1200,
                    podcast_id: null,
                    status: "ended",
                    recording_status: "processing",
                    is_live: false,
                },
            ],
            total: 1,
            limit: 25,
            offset: 0,
            has_more: false,
        });
        apiService.getRtcSession.mockResolvedValue({
            id: 57,
            title: "Long Processing Session",
            room_name: "long-processing-session",
            created_at: "2026-05-08T10:00:00Z",
            media_mode: "audio",
            participant_count: 2,
            duration_seconds: 1200,
            podcast_id: null,
            status: "ended",
            recording_status: "processing",
            is_live: false,
        });

        const { getByLabelText, getByText } = render(<RtcSessionsScreen />);

        await waitFor(() => {
            expect(getByText("Check Status")).toBeTruthy();
        });

        fireEvent.press(getByLabelText("Check recording status for Long Processing Session"));

        await waitFor(() => {
            expect(apiService.getRtcSession).toHaveBeenCalledWith(57);
        });

        await waitFor(() => {
            expect(getByText("Checked just now. Recording is still processing.")).toBeTruthy();
        });

        expect(getByText("Check Status")).toBeTruthy();
    });

    it("restores manual status-check feedback after the screen remounts", async () => {
        apiService.listRtcSessions.mockResolvedValue({
            sessions: [
                {
                    id: 58,
                    title: "Persistent Processing Session",
                    room_name: "persistent-processing-session",
                    created_at: "2026-05-08T10:00:00Z",
                    media_mode: "audio",
                    participant_count: 2,
                    duration_seconds: 1200,
                    podcast_id: null,
                    status: "ended",
                    recording_status: "processing",
                    is_live: false,
                },
            ],
            total: 1,
            limit: 25,
            offset: 0,
            has_more: false,
        });
        apiService.getRtcSession.mockResolvedValue({
            id: 58,
            title: "Persistent Processing Session",
            room_name: "persistent-processing-session",
            created_at: "2026-05-08T10:00:00Z",
            media_mode: "audio",
            participant_count: 2,
            duration_seconds: 1200,
            podcast_id: null,
            status: "ended",
            recording_status: "processing",
            is_live: false,
        });

        const firstRender = render(<RtcSessionsScreen />);

        await waitFor(() => {
            expect(firstRender.getByText("Check Status")).toBeTruthy();
        });

        fireEvent.press(
            firstRender.getByLabelText(
                "Check recording status for Persistent Processing Session"
            )
        );

        await waitFor(() => {
            expect(apiService.getRtcSession).toHaveBeenCalledWith(58);
        });

        await waitFor(() => {
            expect(
                firstRender.getByText("Checked just now. Recording is still processing.")
            ).toBeTruthy();
        });

        firstRender.unmount();

        const secondRender = render(<RtcSessionsScreen />);

        await waitFor(() => {
            expect(apiService.listRtcSessions).toHaveBeenCalledTimes(2);
        });

        await waitFor(() => {
            expect(
                secondRender.getByText("Checked just now. Recording is still processing.")
            ).toBeTruthy();
        });
    });

    it("keeps manual status-check feedback during an immediate refresh before persistence finishes", async () => {
        let resolvePersist;

        apiService.listRtcSessions
            .mockResolvedValueOnce({
                sessions: [
                    {
                        id: 61,
                        title: "Refresh Race Session",
                        room_name: "refresh-race-session",
                        created_at: "2026-05-08T10:00:00Z",
                        media_mode: "audio",
                        participant_count: 2,
                        duration_seconds: 1200,
                        podcast_id: null,
                        status: "ended",
                        recording_status: "processing",
                        is_live: false,
                    },
                ],
                total: 1,
                limit: 25,
                offset: 0,
                has_more: false,
            })
            .mockResolvedValueOnce({
                sessions: [
                    {
                        id: 61,
                        title: "Refresh Race Session",
                        room_name: "refresh-race-session",
                        created_at: "2026-05-08T10:00:00Z",
                        media_mode: "audio",
                        participant_count: 2,
                        duration_seconds: 1200,
                        podcast_id: 101,
                        status: "ended",
                        recording_status: "completed",
                        is_live: false,
                    },
                ],
                total: 1,
                limit: 25,
                offset: 0,
                has_more: false,
            });
        apiService.getRtcSession.mockResolvedValue({
            id: 61,
            title: "Refresh Race Session",
            room_name: "refresh-race-session",
            created_at: "2026-05-08T10:00:00Z",
            media_mode: "audio",
            participant_count: 2,
            duration_seconds: 1200,
            podcast_id: 101,
            status: "ended",
            recording_status: "completed",
            is_live: false,
        });
        AsyncStorage.setItem.mockImplementationOnce((key, value) => new Promise((resolve) => {
            resolvePersist = () => {
                AsyncStorage.__setMockStorage({
                    ...AsyncStorage.__getMockStorage(),
                    [key]: value,
                });
                resolve();
            };
        }));

        const { getByLabelText, getByText } = render(<RtcSessionsScreen />);

        await waitFor(() => {
            expect(getByText("Check Status")).toBeTruthy();
        });

        fireEvent.press(getByLabelText("Check recording status for Refresh Race Session"));

        await waitFor(() => {
            expect(apiService.getRtcSession).toHaveBeenCalledWith(61);
        });

        await waitFor(() => {
            expect(getByText("Checked just now. Podcast is ready.")).toBeTruthy();
        });

        fireEvent.press(getByLabelText("Refresh live sessions"));

        await waitFor(() => {
            expect(apiService.listRtcSessions).toHaveBeenCalledTimes(2);
        });

        await waitFor(() => {
            expect(getByText("Checked just now. Podcast is ready.")).toBeTruthy();
        });

        resolvePersist();
    });

    it("keeps an in-flight status check locked during a refresh reload", async () => {
        let resolveStatusCheck;

        apiService.listRtcSessions
            .mockResolvedValueOnce({
                sessions: [
                    {
                        id: 62,
                        title: "Locked Refresh Session",
                        room_name: "locked-refresh-session",
                        created_at: "2026-05-08T10:00:00Z",
                        media_mode: "audio",
                        participant_count: 2,
                        duration_seconds: 1200,
                        podcast_id: null,
                        status: "ended",
                        recording_status: "processing",
                        is_live: false,
                    },
                ],
                total: 1,
                limit: 25,
                offset: 0,
                has_more: false,
            })
            .mockResolvedValueOnce({
                sessions: [
                    {
                        id: 62,
                        title: "Locked Refresh Session",
                        room_name: "locked-refresh-session",
                        created_at: "2026-05-08T10:00:00Z",
                        media_mode: "audio",
                        participant_count: 2,
                        duration_seconds: 1200,
                        podcast_id: null,
                        status: "ended",
                        recording_status: "processing",
                        is_live: false,
                    },
                ],
                total: 1,
                limit: 25,
                offset: 0,
                has_more: false,
            });
        apiService.getRtcSession.mockImplementation(() => new Promise((resolve) => {
            resolveStatusCheck = resolve;
        }));

        const { getByLabelText, getByText } = render(<RtcSessionsScreen />);

        await waitFor(() => {
            expect(getByText("Check Status")).toBeTruthy();
        });

        fireEvent.press(getByLabelText("Check recording status for Locked Refresh Session"));

        await waitFor(() => {
            expect(apiService.getRtcSession).toHaveBeenCalledWith(62);
        });

        await waitFor(() => {
            expect(getByText("Checking...")).toBeTruthy();
        });
        expect(
            getByLabelText("Check recording status for Locked Refresh Session").props.disabled
        ).toBe(true);

        fireEvent.press(getByLabelText("Refresh live sessions"));

        await waitFor(() => {
            expect(apiService.listRtcSessions).toHaveBeenCalledTimes(2);
        });

        expect(getByText("Checking...")).toBeTruthy();
        expect(
            getByLabelText("Check recording status for Locked Refresh Session").props.disabled
        ).toBe(true);

        resolveStatusCheck({
            id: 62,
            title: "Locked Refresh Session",
            room_name: "locked-refresh-session",
            created_at: "2026-05-08T10:00:00Z",
            media_mode: "audio",
            participant_count: 2,
            duration_seconds: 1200,
            podcast_id: null,
            status: "ended",
            recording_status: "processing",
            is_live: false,
        });

        await waitFor(() => {
            expect(getByText("Checked just now. Recording is still processing.")).toBeTruthy();
        });
    });

    it("reloads RTC history when the app returns to the foreground", async () => {
        apiService.listRtcSessions
            .mockResolvedValueOnce({
                sessions: [
                    {
                        id: 63,
                        title: "Foreground Refresh Session",
                        room_name: "foreground-refresh-session",
                        created_at: "2026-05-08T10:00:00Z",
                        media_mode: "audio",
                        participant_count: 2,
                        duration_seconds: 1200,
                        podcast_id: null,
                        status: "ended",
                        recording_status: "processing",
                        is_live: false,
                    },
                ],
                total: 1,
                limit: 25,
                offset: 0,
                has_more: false,
            })
            .mockResolvedValueOnce({
                sessions: [
                    {
                        id: 63,
                        title: "Foreground Refresh Session",
                        room_name: "foreground-refresh-session",
                        created_at: "2026-05-08T10:00:00Z",
                        media_mode: "audio",
                        participant_count: 2,
                        duration_seconds: 1200,
                        podcast_id: 121,
                        status: "completed",
                        recording_status: "completed",
                        is_live: false,
                    },
                ],
                total: 1,
                limit: 25,
                offset: 0,
                has_more: false,
            });

        const { getByText } = render(<RtcSessionsScreen />);

        await waitFor(() => {
            expect(getByText("Processing recording")).toBeTruthy();
        });

        act(() => {
            emitAppStateChange("background");
            emitAppStateChange("active");
        });

        await waitFor(() => {
            expect(apiService.listRtcSessions).toHaveBeenCalledTimes(2);
        });

        await waitFor(() => {
            expect(getByText("Podcast ready")).toBeTruthy();
        });
    });

    it("keeps loaded history visible while refocus refresh is in flight", async () => {
        let resolveRefocusRefresh;

        apiService.listRtcSessions
            .mockResolvedValueOnce({
                sessions: [
                    {
                        id: 67,
                        title: "Refocus Refresh Session",
                        room_name: "refocus-refresh-session",
                        created_at: "2026-05-08T10:00:00Z",
                        media_mode: "audio",
                        participant_count: 2,
                        duration_seconds: 1200,
                        podcast_id: null,
                        status: "ended",
                        recording_status: "processing",
                        is_live: false,
                    },
                ],
                total: 1,
                limit: 25,
                offset: 0,
                has_more: false,
            })
            .mockImplementationOnce(() => new Promise((resolve) => {
                resolveRefocusRefresh = resolve;
            }));

        const { getByText, queryByText } = render(<RtcSessionsScreen />);

        await waitFor(() => {
            expect(getByText("Refocus Refresh Session")).toBeTruthy();
        });

        act(() => {
            emitScreenBlur();
            emitScreenFocus();
        });

        await waitFor(() => {
            expect(apiService.listRtcSessions).toHaveBeenCalledTimes(2);
        });

        expect(getByText("Refocus Refresh Session")).toBeTruthy();
        expect(queryByText("Loading live sessions...")).toBeNull();

        resolveRefocusRefresh({
            sessions: [
                {
                    id: 67,
                    title: "Refocus Refresh Session",
                    room_name: "refocus-refresh-session",
                    created_at: "2026-05-08T10:00:00Z",
                    media_mode: "audio",
                    participant_count: 2,
                    duration_seconds: 1200,
                    podcast_id: 122,
                    status: "completed",
                    recording_status: "completed",
                    is_live: false,
                },
            ],
            total: 1,
            limit: 25,
            offset: 0,
            has_more: false,
        });

        await waitFor(() => {
            expect(getByText("Podcast ready")).toBeTruthy();
        });
    });

    it("queues one foreground reload while the initial history load is still in flight", async () => {
        let resolveInitialLoad;

        apiService.listRtcSessions
            .mockImplementationOnce(() => new Promise((resolve) => {
                resolveInitialLoad = resolve;
            }))
            .mockResolvedValueOnce({
                sessions: [
                    {
                        id: 65,
                        title: "Single In-Flight Session",
                        room_name: "single-in-flight-session",
                        created_at: "2026-05-08T10:00:00Z",
                        media_mode: "audio",
                        participant_count: 1,
                        duration_seconds: 600,
                        podcast_id: 201,
                        status: "completed",
                        recording_status: "completed",
                        is_live: false,
                    },
                ],
                total: 1,
                limit: 25,
                offset: 0,
                has_more: false,
            });

        const { getByText } = render(<RtcSessionsScreen />);

        await waitFor(() => {
            expect(apiService.listRtcSessions).toHaveBeenCalledTimes(1);
        });

        act(() => {
            emitAppStateChange("background");
            emitAppStateChange("active");
        });

        expect(apiService.listRtcSessions).toHaveBeenCalledTimes(1);

        resolveInitialLoad({
            sessions: [
                {
                    id: 65,
                    title: "Single In-Flight Session",
                    room_name: "single-in-flight-session",
                    created_at: "2026-05-08T10:00:00Z",
                    media_mode: "audio",
                    participant_count: 1,
                    duration_seconds: 600,
                    podcast_id: null,
                    status: "ended",
                    recording_status: "processing",
                    is_live: false,
                },
            ],
            total: 1,
            limit: 25,
            offset: 0,
            has_more: false,
        });

        await waitFor(() => {
            expect(apiService.listRtcSessions).toHaveBeenCalledTimes(2);
        });

        await waitFor(() => {
            expect(getByText("Podcast ready")).toBeTruthy();
        });
    });

    it("clears stale queued foreground refreshes before an immediate resume reload", async () => {
        let resolveInitialLoad;

        apiService.listRtcSessions
            .mockImplementationOnce(() => new Promise((resolve) => {
                resolveInitialLoad = resolve;
            }))
            .mockResolvedValueOnce({
                sessions: [
                    {
                        id: 66,
                        title: "Stale Pending Session",
                        room_name: "stale-pending-session",
                        created_at: "2026-05-08T10:00:00Z",
                        media_mode: "audio",
                        participant_count: 1,
                        duration_seconds: 600,
                        podcast_id: 301,
                        status: "completed",
                        recording_status: "completed",
                        is_live: false,
                    },
                ],
                total: 1,
                limit: 25,
                offset: 0,
                has_more: false,
            });

        const { getByText, queryByText } = render(<RtcSessionsScreen />);

        await waitFor(() => {
            expect(apiService.listRtcSessions).toHaveBeenCalledTimes(1);
        });

        act(() => {
            emitAppStateChange("background");
            emitAppStateChange("active");
            emitAppStateChange("background");
        });

        resolveInitialLoad({
            sessions: [
                {
                    id: 66,
                    title: "Stale Pending Session",
                    room_name: "stale-pending-session",
                    created_at: "2026-05-08T10:00:00Z",
                    media_mode: "audio",
                    participant_count: 1,
                    duration_seconds: 600,
                    podcast_id: null,
                    status: "ended",
                    recording_status: "processing",
                    is_live: false,
                },
            ],
            total: 1,
            limit: 25,
            offset: 0,
            has_more: false,
        });

        await waitFor(() => {
            expect(getByText("Processing recording")).toBeTruthy();
        });

        expect(apiService.listRtcSessions).toHaveBeenCalledTimes(1);

        act(() => {
            emitAppStateChange("active");
        });

        await waitFor(() => {
            expect(apiService.listRtcSessions).toHaveBeenCalledTimes(2);
        });

        await waitFor(() => {
            expect(getByText("Podcast ready")).toBeTruthy();
        });

        expect(apiService.listRtcSessions).toHaveBeenCalledTimes(2);
        expect(queryByText("Couldn't load live sessions.")).toBeNull();
    });

    it("keeps an in-flight status check locked during a foreground reload", async () => {
        let resolveStatusCheck;

        apiService.listRtcSessions
            .mockResolvedValueOnce({
                sessions: [
                    {
                        id: 64,
                        title: "Foreground Lock Session",
                        room_name: "foreground-lock-session",
                        created_at: "2026-05-08T10:00:00Z",
                        media_mode: "audio",
                        participant_count: 2,
                        duration_seconds: 1200,
                        podcast_id: null,
                        status: "ended",
                        recording_status: "processing",
                        is_live: false,
                    },
                ],
                total: 1,
                limit: 25,
                offset: 0,
                has_more: false,
            })
            .mockResolvedValueOnce({
                sessions: [
                    {
                        id: 64,
                        title: "Foreground Lock Session",
                        room_name: "foreground-lock-session",
                        created_at: "2026-05-08T10:00:00Z",
                        media_mode: "audio",
                        participant_count: 2,
                        duration_seconds: 1200,
                        podcast_id: null,
                        status: "ended",
                        recording_status: "processing",
                        is_live: false,
                    },
                ],
                total: 1,
                limit: 25,
                offset: 0,
                has_more: false,
            });
        apiService.getRtcSession.mockImplementation(() => new Promise((resolve) => {
            resolveStatusCheck = resolve;
        }));

        const { getByLabelText, getByText } = render(<RtcSessionsScreen />);

        await waitFor(() => {
            expect(getByText("Check Status")).toBeTruthy();
        });

        fireEvent.press(getByLabelText("Check recording status for Foreground Lock Session"));

        await waitFor(() => {
            expect(apiService.getRtcSession).toHaveBeenCalledWith(64);
        });

        await waitFor(() => {
            expect(getByText("Checking...")).toBeTruthy();
        });
        expect(
            getByLabelText("Check recording status for Foreground Lock Session").props.disabled
        ).toBe(true);

        act(() => {
            emitAppStateChange("background");
            emitAppStateChange("active");
        });

        await waitFor(() => {
            expect(apiService.listRtcSessions).toHaveBeenCalledTimes(2);
        });

        expect(getByText("Checking...")).toBeTruthy();
        expect(
            getByLabelText("Check recording status for Foreground Lock Session").props.disabled
        ).toBe(true);

        resolveStatusCheck({
            id: 64,
            title: "Foreground Lock Session",
            room_name: "foreground-lock-session",
            created_at: "2026-05-08T10:00:00Z",
            media_mode: "audio",
            participant_count: 2,
            duration_seconds: 1200,
            podcast_id: null,
            status: "ended",
            recording_status: "processing",
            is_live: false,
        });

        await waitFor(() => {
            expect(getByText("Checked just now. Recording is still processing.")).toBeTruthy();
        });
    });

    it("drops persisted manual feedback when the loaded session status has changed", async () => {
        const checkedAt = new Date().toISOString();

        AsyncStorage.__setMockStorage({
            "@propod/rtc-history-status-check/59": JSON.stringify({
                checkedAt,
                recordingStatus: "processing",
            }),
        });

        apiService.listRtcSessions.mockResolvedValue({
            sessions: [
                {
                    id: 59,
                    title: "Completed After Delay",
                    room_name: "completed-after-delay",
                    created_at: "2026-05-08T10:00:00Z",
                    media_mode: "audio",
                    participant_count: 2,
                    duration_seconds: 1200,
                    podcast_id: 99,
                    status: "ended",
                    recording_status: "completed",
                    is_live: false,
                },
            ],
            total: 1,
            limit: 25,
            offset: 0,
            has_more: false,
        });

        const { getByText, queryByText } = render(<RtcSessionsScreen />);

        await waitFor(() => {
            expect(getByText("Podcast ready")).toBeTruthy();
        });

        expect(queryByText("Checked just now. Podcast is ready.")).toBeNull();
        expect(queryByText("Checked just now. Recording is still processing.")).toBeNull();
        expect(AsyncStorage.multiRemove).toHaveBeenCalledWith([
            "@propod/rtc-history-status-check/59",
        ]);
        expect(
            AsyncStorage.__getMockStorage()["@propod/rtc-history-status-check/59"]
        ).toBeUndefined();
    });

    it("drops persisted manual feedback when the stored check is stale", async () => {
        const checkedAt = new Date(Date.now() - (25 * 60 * 60 * 1000)).toISOString();

        AsyncStorage.__setMockStorage({
            "@propod/rtc-history-status-check/60": JSON.stringify({
                checkedAt,
                recordingStatus: "processing",
            }),
        });

        apiService.listRtcSessions.mockResolvedValue({
            sessions: [
                {
                    id: 60,
                    title: "Stale Processing Session",
                    room_name: "stale-processing-session",
                    created_at: "2026-05-08T10:00:00Z",
                    media_mode: "audio",
                    participant_count: 2,
                    duration_seconds: 1200,
                    podcast_id: null,
                    status: "ended",
                    recording_status: "processing",
                    is_live: false,
                },
            ],
            total: 1,
            limit: 25,
            offset: 0,
            has_more: false,
        });

        const { getByText, queryByText } = render(<RtcSessionsScreen />);

        await waitFor(() => {
            expect(getByText("Processing recording")).toBeTruthy();
        });

        expect(queryByText(/^Checked /)).toBeNull();
        expect(AsyncStorage.multiRemove).toHaveBeenCalledWith([
            "@propod/rtc-history-status-check/60",
        ]);
        expect(
            AsyncStorage.__getMockStorage()["@propod/rtc-history-status-check/60"]
        ).toBeUndefined();
    });

    it("keeps exact history count copy for paginated responses", async () => {
        apiService.listRtcSessions.mockResolvedValue({
            sessions: [
                {
                    id: 12,
                    title: "History Session One",
                    room_name: "history-session-one",
                    created_at: "2026-05-08T10:00:00Z",
                    media_mode: "audio",
                    participant_count: 2,
                    duration_seconds: 300,
                    podcast_id: null,
                    status: "ended",
                    recording_status: "processing",
                    is_live: false,
                },
                {
                    id: 11,
                    title: "History Session Two",
                    room_name: "history-session-two",
                    created_at: "2026-05-07T10:00:00Z",
                    media_mode: "video",
                    participant_count: 3,
                    duration_seconds: 1200,
                    podcast_id: null,
                    status: "ended",
                    recording_status: "processing",
                    is_live: false,
                },
            ],
            total: 2,
            limit: 25,
            offset: 0,
            has_more: false,
        });

        const { getByText, queryByText } = render(<RtcSessionsScreen />);

        await waitFor(() => {
            expect(apiService.listRtcSessions).toHaveBeenCalledWith({ limit: 25, offset: 0 });
        });

        expect(
            getByText("2 sessions total. Review recent live sessions and whether each recording is ready.")
        ).toBeTruthy();
        expect(queryByText("Review recent live sessions and whether each recording is ready.")).toBeNull();
        expect(getByText("You're all caught up")).toBeTruthy();
        expect(getByText("Showing all 2 sessions in your live recording history.")).toBeTruthy();
        expect(queryByText("You've reached the end of your live recording history.")).toBeNull();
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

    it("surfaces the paginated response contract error", async () => {
        apiService.listRtcSessions.mockRejectedValue(
            new Error("Live session history is temporarily unavailable. Please try again.")
        );

        const { getByText } = render(<RtcSessionsScreen />);

        await waitFor(() => {
            expect(apiService.listRtcSessions).toHaveBeenCalled();
        });

        expect(getByText("Couldn't load live sessions.")).toBeTruthy();
        expect(
            getByText("Live session history is temporarily unavailable. Please try again.")
        ).toBeTruthy();
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
            .mockResolvedValueOnce({
                sessions: firstPage,
                total: 26,
                limit: 25,
                offset: 0,
                has_more: true,
            })
            .mockResolvedValueOnce({
                sessions: [
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
                ],
                total: 26,
                limit: 25,
                offset: 25,
                has_more: false,
            });

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
        expect(getByText("You're all caught up")).toBeTruthy();
        expect(getByText("Showing all 26 sessions in your live recording history.")).toBeTruthy();
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
            .mockResolvedValueOnce({
                sessions: firstPage,
                total: 26,
                limit: 25,
                offset: 0,
                has_more: true,
            })
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

        resolveRefresh({
            sessions: firstPage,
            total: 26,
            limit: 25,
            offset: 0,
            has_more: true,
        });

        await waitFor(() => {
            expect(apiService.listRtcSessions).toHaveBeenLastCalledWith({
                limit: 25,
                offset: 0,
            });
        });
    });

    it("queues one pull-to-refresh reload while load-more pagination is still in flight", async () => {
        const firstPage = Array.from({ length: 25 }, (_, index) => ({
            id: 400 - index,
            title: `Refresh Queue Session ${index + 1}`,
            room_name: `refresh-queue-session-${index + 1}`,
            created_at: "2026-05-08T10:00:00Z",
            media_mode: "audio",
            participant_count: 2,
            duration_seconds: 300,
            podcast_id: null,
            status: "ended",
            recording_status: "processing",
            is_live: false,
        }));

        let resolveLoadMore;

        apiService.listRtcSessions
            .mockResolvedValueOnce({
                sessions: firstPage,
                total: 26,
                limit: 25,
                offset: 0,
                has_more: true,
            })
            .mockImplementationOnce(() => new Promise((resolve) => {
                resolveLoadMore = resolve;
            }))
            .mockResolvedValueOnce({
                sessions: [
                    {
                        ...firstPage[0],
                        podcast_id: 501,
                        status: "completed",
                        recording_status: "completed",
                    },
                    ...firstPage.slice(1),
                ],
                total: 26,
                limit: 25,
                offset: 0,
                has_more: true,
            });

        const { getByLabelText, getByText } = render(<RtcSessionsScreen />);

        await waitFor(() => {
            expect(getByText("Refresh Queue Session 1")).toBeTruthy();
        });

        fireEvent.press(getByLabelText("Load more live sessions"));

        await waitFor(() => {
            expect(apiService.listRtcSessions).toHaveBeenLastCalledWith({
                limit: 25,
                offset: 25,
            });
        });

        fireEvent.press(getByLabelText("Refresh live sessions"));

        expect(apiService.listRtcSessions).toHaveBeenCalledTimes(2);

        resolveLoadMore({
            sessions: [
                {
                    id: 375,
                    title: "Older Refresh Queue Session",
                    room_name: "older-refresh-queue-session",
                    created_at: "2026-05-07T10:00:00Z",
                    media_mode: "video",
                    participant_count: 3,
                    duration_seconds: 1200,
                    podcast_id: null,
                    status: "ended",
                    recording_status: "processing",
                    is_live: false,
                },
            ],
            total: 26,
            limit: 25,
            offset: 25,
            has_more: false,
        });

        await waitFor(() => {
            expect(apiService.listRtcSessions).toHaveBeenCalledTimes(3);
        });

        await waitFor(() => {
            expect(apiService.listRtcSessions).toHaveBeenLastCalledWith({
                limit: 25,
                offset: 0,
            });
        });

        await waitFor(() => {
            expect(getByText("Podcast ready")).toBeTruthy();
        });
    });

    it("queues one foreground reload while load-more pagination is still in flight", async () => {
        const firstPage = Array.from({ length: 25 }, (_, index) => ({
            id: 300 - index,
            title: `Paged Session ${index + 1}`,
            room_name: `paged-session-${index + 1}`,
            created_at: "2026-05-08T10:00:00Z",
            media_mode: "audio",
            participant_count: 2,
            duration_seconds: 300,
            podcast_id: null,
            status: "ended",
            recording_status: "processing",
            is_live: false,
        }));

        let resolveLoadMore;

        apiService.listRtcSessions
            .mockResolvedValueOnce({
                sessions: firstPage,
                total: 26,
                limit: 25,
                offset: 0,
                has_more: true,
            })
            .mockImplementationOnce(() => new Promise((resolve) => {
                resolveLoadMore = resolve;
            }))
            .mockResolvedValueOnce({
                sessions: [
                    {
                        ...firstPage[0],
                        podcast_id: 401,
                        status: "completed",
                        recording_status: "completed",
                    },
                    ...firstPage.slice(1),
                ],
                total: 26,
                limit: 25,
                offset: 0,
                has_more: true,
            });

        const { getByLabelText, getByText } = render(<RtcSessionsScreen />);

        await waitFor(() => {
            expect(getByText("Paged Session 1")).toBeTruthy();
        });

        fireEvent.press(getByLabelText("Load more live sessions"));

        await waitFor(() => {
            expect(apiService.listRtcSessions).toHaveBeenLastCalledWith({
                limit: 25,
                offset: 25,
            });
        });

        act(() => {
            emitAppStateChange("background");
            emitAppStateChange("active");
        });

        expect(apiService.listRtcSessions).toHaveBeenCalledTimes(2);

        resolveLoadMore({
            sessions: [
                {
                    id: 275,
                    title: "Older Load More Session",
                    room_name: "older-load-more-session",
                    created_at: "2026-05-07T10:00:00Z",
                    media_mode: "video",
                    participant_count: 3,
                    duration_seconds: 1200,
                    podcast_id: null,
                    status: "ended",
                    recording_status: "processing",
                    is_live: false,
                },
            ],
            total: 26,
            limit: 25,
            offset: 25,
            has_more: false,
        });

        await waitFor(() => {
            expect(apiService.listRtcSessions).toHaveBeenCalledTimes(3);
        });

        await waitFor(() => {
            expect(apiService.listRtcSessions).toHaveBeenLastCalledWith({
                limit: 25,
                offset: 0,
            });
        });

        await waitFor(() => {
            expect(getByText("Podcast ready")).toBeTruthy();
        });
    });

    it("queues one refocus reload while load-more pagination is still in flight", async () => {
        const firstPage = Array.from({ length: 25 }, (_, index) => ({
            id: 500 - index,
            title: `Refocus Queue Session ${index + 1}`,
            room_name: `refocus-queue-session-${index + 1}`,
            created_at: "2026-05-08T10:00:00Z",
            media_mode: "audio",
            participant_count: 2,
            duration_seconds: 300,
            podcast_id: null,
            status: "ended",
            recording_status: "processing",
            is_live: false,
        }));

        let resolveLoadMore;

        apiService.listRtcSessions
            .mockResolvedValueOnce({
                sessions: firstPage,
                total: 26,
                limit: 25,
                offset: 0,
                has_more: true,
            })
            .mockImplementationOnce(() => new Promise((resolve) => {
                resolveLoadMore = resolve;
            }))
            .mockResolvedValueOnce({
                sessions: [
                    {
                        ...firstPage[0],
                        podcast_id: 601,
                        status: "completed",
                        recording_status: "completed",
                    },
                    ...firstPage.slice(1),
                ],
                total: 26,
                limit: 25,
                offset: 0,
                has_more: true,
            });

        const { getByLabelText, getByText } = render(<RtcSessionsScreen />);

        await waitFor(() => {
            expect(getByText("Refocus Queue Session 1")).toBeTruthy();
        });

        fireEvent.press(getByLabelText("Load more live sessions"));

        await waitFor(() => {
            expect(apiService.listRtcSessions).toHaveBeenLastCalledWith({
                limit: 25,
                offset: 25,
            });
        });

        act(() => {
            emitScreenBlur();
            emitScreenFocus();
        });

        expect(apiService.listRtcSessions).toHaveBeenCalledTimes(2);

        resolveLoadMore({
            sessions: [
                {
                    id: 475,
                    title: "Older Refocus Queue Session",
                    room_name: "older-refocus-queue-session",
                    created_at: "2026-05-07T10:00:00Z",
                    media_mode: "video",
                    participant_count: 3,
                    duration_seconds: 1200,
                    podcast_id: null,
                    status: "ended",
                    recording_status: "processing",
                    is_live: false,
                },
            ],
            total: 26,
            limit: 25,
            offset: 25,
            has_more: false,
        });

        await waitFor(() => {
            expect(apiService.listRtcSessions).toHaveBeenCalledTimes(3);
        });

        await waitFor(() => {
            expect(apiService.listRtcSessions).toHaveBeenLastCalledWith({
                limit: 25,
                offset: 0,
            });
        });

        await waitFor(() => {
            expect(getByText("Podcast ready")).toBeTruthy();
        });
    });

    it("keeps the footer retry visible when a refresh fails after load-more fails", async () => {
        apiService.listRtcSessions
            .mockResolvedValueOnce({
                sessions: [
                    {
                        id: 410,
                        title: "Recoverable Session",
                        room_name: "recoverable-session",
                        created_at: "2026-05-08T10:00:00Z",
                        media_mode: "audio",
                        participant_count: 2,
                        duration_seconds: 300,
                        podcast_id: null,
                        status: "ended",
                        recording_status: "processing",
                        is_live: false,
                    },
                ],
                total: 26,
                limit: 25,
                offset: 0,
                has_more: true,
            })
            .mockRejectedValueOnce(new Error("Couldn't load more live sessions."))
            .mockRejectedValueOnce(new Error("Refresh failed"));

        const { getByLabelText, getByText, queryByText } = render(<RtcSessionsScreen />);

        await waitFor(() => {
            expect(getByText("Recoverable Session")).toBeTruthy();
        });

        fireEvent.press(getByLabelText("Load more live sessions"));

        await waitFor(() => {
            expect(apiService.listRtcSessions).toHaveBeenCalledTimes(2);
            expect(getByText("Couldn't load more live sessions.")).toBeTruthy();
        });

        fireEvent.press(getByLabelText("Refresh live sessions"));

        await waitFor(() => {
            expect(apiService.listRtcSessions).toHaveBeenCalledTimes(3);
        });

        await waitFor(() => {
            expect(getByText("Recoverable Session")).toBeTruthy();
            expect(getByText("Couldn't refresh live sessions.")).toBeTruthy();
            expect(getByText("Refresh failed")).toBeTruthy();
            expect(getByText("Couldn't load more live sessions.")).toBeTruthy();
        });

        expect(queryByText("No live sessions yet")).toBeNull();
    });

    it("keeps the inline refresh retry visible and disabled while a retry is in flight", async () => {
        let resolveRetry;
        const retryPromise = new Promise((resolve) => {
            resolveRetry = resolve;
        });

        apiService.listRtcSessions
            .mockResolvedValueOnce({
                sessions: [
                    {
                        id: 411,
                        title: "Retry State Session",
                        room_name: "retry-state-session",
                        created_at: "2026-05-08T10:00:00Z",
                        media_mode: "audio",
                        participant_count: 2,
                        duration_seconds: 300,
                        podcast_id: null,
                        status: "ended",
                        recording_status: "processing",
                        is_live: false,
                    },
                ],
                total: 1,
                limit: 25,
                offset: 0,
                has_more: false,
            })
            .mockRejectedValueOnce(new Error("Refresh failed"))
            .mockReturnValueOnce(retryPromise);

        const { getByLabelText, getByText } = render(<RtcSessionsScreen />);

        await waitFor(() => {
            expect(getByText("Retry State Session")).toBeTruthy();
        });

        fireEvent.press(getByLabelText("Refresh live sessions"));

        await waitFor(() => {
            expect(apiService.listRtcSessions).toHaveBeenCalledTimes(2);
        });

        await waitFor(() => {
            expect(getByText("Couldn't refresh live sessions.")).toBeTruthy();
            expect(getByText("Refresh failed")).toBeTruthy();
        });

        fireEvent.press(getByLabelText("Retry refreshing live sessions"));

        await waitFor(() => {
            expect(apiService.listRtcSessions).toHaveBeenCalledTimes(3);
        });

        await waitFor(() => {
            const retryButton = getByLabelText("Retry refreshing live sessions");

            expect(retryButton.props.disabled).toBe(true);
            expect(retryButton.props.accessibilityState).toEqual({ disabled: true });
            expect(getByText("Retrying...")).toBeTruthy();
            expect(getByText("Refresh failed")).toBeTruthy();
        });

        await act(async () => {
            resolveRetry({
                sessions: [
                    {
                        id: 411,
                        title: "Retry State Session",
                        room_name: "retry-state-session",
                        created_at: "2026-05-08T10:00:00Z",
                        media_mode: "audio",
                        participant_count: 2,
                        duration_seconds: 300,
                        podcast_id: 811,
                        status: "completed",
                        recording_status: "completed",
                        is_live: false,
                    },
                ],
                total: 1,
                limit: 25,
                offset: 0,
                has_more: false,
            });
        });

        await waitFor(() => {
            expect(getByText("Podcast ready")).toBeTruthy();
        });
    });
});