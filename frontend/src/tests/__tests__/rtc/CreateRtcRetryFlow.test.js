import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import {
    RtcFailedReviewActions,
    buildRtcLiveStatusPanel,
    buildRtcProcessingPanel,
    default as Create,
    formatRtcElapsedDuration,
} from "../../../../app/(main)/create";
import {
    maybeStartAiProcessingForPodcast,
    resolveAiEnabledForSave,
} from "../../../utils/createPodcastAi";
import {
    buildRtcSessionHistoryNotificationAction,
    buildRtcSessionHistoryRoute,
    buildRtcSessionRecoveryRoute,
} from "../../../utils/rtcSessionRoutes";

const mockBack = jest.fn();
const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockShowToast = jest.fn();
let mockParams = {};

jest.mock("../../../services/api/apiService", () => ({
    __esModule: true,
    default: {
        baseURL: "https://api.example.com",
        getUserProfile: jest.fn(),
        createRtcRoom: jest.fn(),
        createRtcToken: jest.fn(),
        getRtcSession: jest.fn(),
        startRtcSession: jest.fn(),
        endRtcSession: jest.fn(),
        processAudio: jest.fn(),
    },
}));

jest.mock("expo-router", () => ({
    useRouter: () => ({
        back: mockBack,
        push: mockPush,
        replace: mockReplace,
    }),
    useLocalSearchParams: () => mockParams,
    useFocusEffect: () => {},
}));

jest.mock("react-native-safe-area-context", () => ({
    useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock("../../../components/Toast", () => ({
    useToast: () => ({
        showToast: mockShowToast,
    }),
}));

jest.mock("../../../services/audio", () => ({
    __esModule: true,
    default: {
        initialize: jest.fn().mockResolvedValue(true),
        getRecordingStatus: jest.fn(() => ({ isRecording: false, activeMode: null })),
        deleteAudioFile: jest.fn().mockResolvedValue(undefined),
    },
}));

jest.mock("../../../services/recording/protectionService", () => ({
    __esModule: true,
    default: {
        getDraft: jest.fn().mockResolvedValue(null),
        updateMetadata: jest.fn(),
        stopAutoBackup: jest.fn(),
        startProtection: jest.fn().mockResolvedValue(undefined),
        startAutoBackup: jest.fn(),
        saveSegment: jest.fn().mockResolvedValue({ uri: "segment.m4a" }),
        clearDraft: jest.fn().mockResolvedValue(undefined),
    },
}));

jest.mock("../../../services/recording/backgroundService", () => ({
    __esModule: true,
    default: {
        isActive: jest.fn(() => false),
        startRecording: jest.fn().mockResolvedValue(undefined),
        stopRecording: jest.fn().mockResolvedValue(undefined),
    },
}));

jest.mock("../../../context/useNotificationStore", () => {
    const store = () => null;
    store.getState = () => ({
        addNotification: jest.fn(() => ({ id: "notif-1" })),
        updateNotification: jest.fn(),
    });

    return {
        __esModule: true,
        default: store,
    };
});

jest.mock("../../../components/PermissionModal", () => () => null);
jest.mock("../../../components/ConfirmationModal", () => () => null);
jest.mock("../../../components/recording/RecordingControls", () => () => null);
jest.mock("../../../components/rtc/HmsRoom", () => () => null);

describe("RTC session history helpers", () => {
    beforeEach(() => {
        mockParams = {};
        const { default: mockedApiService } = require("../../../services/api/apiService");
        mockedApiService.getUserProfile.mockResolvedValue({ name: "Host" });
    });

    it("builds a focused history route when a session id is available", () => {
        expect(buildRtcSessionHistoryRoute(42)).toEqual({
            pathname: "/(main)/rtc-sessions",
            params: { focusSessionId: "42" },
        });
    });

    it("falls back to the generic history route when no session id exists", () => {
        expect(buildRtcSessionHistoryRoute(null)).toBe("/(main)/rtc-sessions");
    });

    it("includes focusSessionId in failed notification actions", () => {
        expect(buildRtcSessionHistoryNotificationAction(42)).toEqual({
            type: "navigate",
            screen: "rtc-sessions",
            params: { focusSessionId: "42" },
        });
    });

    it("builds a create route with the previous live session setup", () => {
        expect(buildRtcSessionRecoveryRoute({
            id: 8,
            title: "Weekly Sync",
            description: "Retry after a failed export",
            category: "Tech",
            is_public: true,
            media_mode: "audio",
        })).toEqual({
            pathname: "/(main)/create",
            params: {
                mode: "full-create",
                recordingMode: "multi",
                rtcMediaMode: "audio",
                prefillTitle: "Weekly Sync",
                prefillDescription: "Retry after a failed export",
                prefillCategory: "Tech",
                prefillIsPublic: "true",
                sourceSessionId: "8",
            },
        });
    });

    it("prefills create with the previous live session metadata", () => {
        mockParams = {
            mode: "full-create",
            recordingMode: "multi",
            rtcMediaMode: "audio",
            prefillTitle: "Weekly Sync",
            prefillDescription: "Retry after a failed export",
            prefillCategory: "Tech",
            prefillIsPublic: "true",
            sourceSessionId: "8",
        };

        const { getByDisplayValue, getByText } = render(<Create />);

        expect(getByDisplayValue("Weekly Sync")).toBeTruthy();
        expect(getByDisplayValue("Retry after a failed export")).toBeTruthy();
        expect(getByText("Previous Session Restored")).toBeTruthy();
        expect(getByText("Multi-host")).toBeTruthy();
        expect(getByText("Audio only")).toBeTruthy();
    });
});

describe("RTC create status helpers", () => {
    it("formats the live elapsed duration for the recording badge", () => {
        expect(formatRtcElapsedDuration(0)).toBe("00:00");
        expect(formatRtcElapsedDuration(65)).toBe("01:05");
    });

    it("builds a clear live recording panel while the host is broadcasting", () => {
        expect(
            buildRtcLiveStatusPanel({
                rtcSessionState: "live",
                rtcMediaMode: "audio",
                elapsedSeconds: 65,
            })
        ).toMatchObject({
            title: "Recording active",
            badge: "Live 01:05",
        });
    });

    it("builds a stronger delayed-processing message after polling takes too long", () => {
        expect(buildRtcProcessingPanel({ isProcessingDelayed: false })).toMatchObject({
            title: "Processing recording...",
        });

        expect(buildRtcProcessingPanel({ isProcessingDelayed: true })).toMatchObject({
            title: "Processing is taking longer than usual",
        });
    });
});

describe("maybeStartAiProcessingForPodcast", () => {
    it("starts AI processing when enabled and podcast id exists", async () => {
        const processAudio = jest.fn().mockResolvedValue({ status: "processing" });

        await expect(
            maybeStartAiProcessingForPodcast({
                enabled: true,
                podcastId: 17,
                processAudio,
            })
        ).resolves.toBe(true);

        expect(processAudio).toHaveBeenCalledWith(17);
    });

    it("skips AI processing when the toggle is off", async () => {
        const processAudio = jest.fn();

        await expect(
            maybeStartAiProcessingForPodcast({
                enabled: false,
                podcastId: 17,
                processAudio,
            })
        ).resolves.toBe(false);

        expect(processAudio).not.toHaveBeenCalled();
    });

    it("returns false when AI processing startup fails", async () => {
        const logger = { error: jest.fn() };
        const processAudio = jest.fn().mockRejectedValue(new Error("ai failed"));

        await expect(
            maybeStartAiProcessingForPodcast({
                enabled: true,
                podcastId: 17,
                processAudio,
                logger,
            })
        ).resolves.toBe(false);

        expect(processAudio).toHaveBeenCalledWith(17);
        expect(logger.error).toHaveBeenCalled();
    });
});

describe("resolveAiEnabledForSave", () => {
    it("uses in-memory AI state when enabled", () => {
        expect(
            resolveAiEnabledForSave({
                isAIEnabled: true,
                draft: null,
            })
        ).toBe(true);
    });

    it("falls back to draft metadata when state was lost", () => {
        expect(
            resolveAiEnabledForSave({
                isAIEnabled: false,
                draft: {
                    metadata: {
                        ai_enabled: true,
                    },
                },
            })
        ).toBe(true);
    });

    it("returns false when neither state nor draft enables AI", () => {
        expect(
            resolveAiEnabledForSave({
                isAIEnabled: false,
                draft: {
                    metadata: {
                        ai_enabled: false,
                    },
                },
            })
        ).toBe(false);
    });
});

describe("RtcFailedReviewActions", () => {
    it("renders the re-record CTA and dispatches the expected actions", () => {
        const onRetry = jest.fn();
        const onViewSessions = jest.fn();
        const onGoHome = jest.fn();

        const { getByText } = render(
            <RtcFailedReviewActions
                isLoading={false}
                onGoHome={onGoHome}
                onRetry={onRetry}
                onViewSessions={onViewSessions}
            />
        );

        fireEvent.press(getByText("Start New Live Session"));
        fireEvent.press(getByText("View Live Sessions"));
        fireEvent.press(getByText("Go to Home"));

        expect(onRetry).toHaveBeenCalledTimes(1);
        expect(onViewSessions).toHaveBeenCalledTimes(1);
        expect(onGoHome).toHaveBeenCalledTimes(1);
    });

    it("shows a loading label while the new lobby is being prepared", () => {
        const onRetry = jest.fn();
        const onViewSessions = jest.fn();
        const onGoHome = jest.fn();
        const { getByText, queryByText } = render(
            <RtcFailedReviewActions
                isLoading={true}
                onGoHome={onGoHome}
                onRetry={onRetry}
                onViewSessions={onViewSessions}
            />
        );

        expect(getByText("Preparing new lobby...")).toBeTruthy();
        expect(queryByText("Start New Live Session")).toBeNull();

        fireEvent.press(getByText("View Live Sessions"));
        fireEvent.press(getByText("Go to Home"));

        expect(onRetry).not.toHaveBeenCalled();
        expect(onViewSessions).not.toHaveBeenCalled();
        expect(onGoHome).not.toHaveBeenCalled();
    });
});
