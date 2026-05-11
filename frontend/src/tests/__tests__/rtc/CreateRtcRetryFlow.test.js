import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import { RtcFailedReviewActions } from "../../../../app/(main)/create";

const mockBack = jest.fn();
const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockShowToast = jest.fn();

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
    },
}));

jest.mock("expo-router", () => ({
    useRouter: () => ({
        back: mockBack,
        push: mockPush,
        replace: mockReplace,
    }),
    useLocalSearchParams: () => ({}),
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
        const { getByText, queryByText } = render(
            <RtcFailedReviewActions
                isLoading={true}
                onGoHome={jest.fn()}
                onRetry={jest.fn()}
                onViewSessions={jest.fn()}
            />
        );

        expect(getByText("Preparing new lobby...")).toBeTruthy();
        expect(queryByText("Start New Live Session")).toBeNull();
    });
});
