/**
 * Tests for HmsRoom component
 */
import React from "react";
import { render, waitFor, act, fireEvent } from "@testing-library/react-native";
import HmsRoom from "../../../components/rtc/HmsRoom";
import { HMSSDK } from "@100mslive/react-native-hms";

// Mock expo modules
jest.mock("expo-secure-store", () => ({
    getItemAsync: jest.fn().mockResolvedValue('mock-token'),
    setItemAsync: jest.fn().mockResolvedValue(undefined),
    deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("expo-image-picker", () => ({
    requestCameraPermissionsAsync: jest.fn(),
}));

jest.mock("expo-audio", () => ({
    requestRecordingPermissionsAsync: jest.fn(),
}));

jest.mock("../../../utils/logger", () => ({
    __esModule: true,
    default: {
        error: jest.fn(),
        log: jest.fn(),
        debug: jest.fn(),
        warn: jest.fn(),
        info: jest.fn(),
    },
}));

describe("HmsRoom Component", () => {
    const mockToken = "mock-token-123";
    const mockRoomName = "test-room";
    const mockUserName = "Test User";
    const mockOnJoin = jest.fn();
    const mockOnLeave = jest.fn();
    const mockOnClose = jest.fn();

    let mockHmsInstance;

    beforeEach(() => {
        jest.clearAllMocks();

        // Setup mock HMS instance
        mockHmsInstance = {
            addEventListener: jest.fn(),
            removeAllListeners: jest.fn(),
            join: jest.fn().mockResolvedValue(undefined),
            leave: jest.fn().mockResolvedValue(undefined),
            destroy: jest.fn().mockResolvedValue(undefined),
            HmsView: () => null,
        };

        const { HMSSDK } = require("@100mslive/react-native-hms");
        HMSSDK.build.mockResolvedValue(mockHmsInstance);

        const { requestCameraPermissionsAsync } = require("expo-image-picker");
        const { requestRecordingPermissionsAsync } = require("expo-audio");

        requestCameraPermissionsAsync.mockResolvedValue({ status: "granted" });
        requestRecordingPermissionsAsync.mockResolvedValue({
            status: "granted",
        });
    });

    it("should render loading state initially", () => {
        const { getByText } = render(
            <HmsRoom
                token={mockToken}
                roomName={mockRoomName}
                userName={mockUserName}
                enableVideo={true}
                onJoin={mockOnJoin}
                onLeave={mockOnLeave}
            />
        );

        expect(getByText("Joining live session...")).toBeTruthy();
        expect(getByText("Cancel")).toBeTruthy();
    });

    it("should allow cancelling before join completes", async () => {
        const { getByLabelText } = render(
            <HmsRoom
                token={mockToken}
                roomName={mockRoomName}
                userName={mockUserName}
                enableVideo={true}
                onJoin={mockOnJoin}
                onLeave={mockOnLeave}
                onClose={mockOnClose}
            />
        );

        await waitFor(() => {
            expect(mockHmsInstance.join).toHaveBeenCalled();
        });

        await act(async () => {
            fireEvent.press(getByLabelText("Cancel joining live session"));
        });

        await waitFor(() => {
            expect(mockHmsInstance.removeAllListeners).toHaveBeenCalled();
            expect(mockHmsInstance.leave).toHaveBeenCalled();
            expect(mockHmsInstance.destroy).toHaveBeenCalled();
            expect(mockOnClose).toHaveBeenCalled();
        });

        expect(mockOnLeave).not.toHaveBeenCalled();
    });

    it("should request permissions on mount", async () => {
        const { requestCameraPermissionsAsync } = require("expo-image-picker");
        const { requestRecordingPermissionsAsync } = require("expo-audio");

        render(
            <HmsRoom
                token={mockToken}
                roomName={mockRoomName}
                userName={mockUserName}
                enableVideo={true}
                onJoin={mockOnJoin}
                onLeave={mockOnLeave}
            />
        );

        await waitFor(() => {
            expect(requestRecordingPermissionsAsync).toHaveBeenCalled();
            expect(requestCameraPermissionsAsync).toHaveBeenCalled();
        });
    });

    it("should skip camera permission when video disabled", async () => {
        const { requestCameraPermissionsAsync } = require("expo-image-picker");

        render(
            <HmsRoom
                token={mockToken}
                roomName={mockRoomName}
                userName={mockUserName}
                enableVideo={false}
                onJoin={mockOnJoin}
                onLeave={mockOnLeave}
            />
        );

        await waitFor(() => {
            expect(requestCameraPermissionsAsync).not.toHaveBeenCalled();
        });
    });

    it("should show error when permissions denied", async () => {
        const { requestRecordingPermissionsAsync } = require("expo-audio");
        requestRecordingPermissionsAsync.mockResolvedValue({ status: "denied" });

        const { getByText } = render(
            <HmsRoom
                token={mockToken}
                roomName={mockRoomName}
                userName={mockUserName}
                enableVideo={false}
                onJoin={mockOnJoin}
                onLeave={mockOnLeave}
            />
        );

        await waitFor(() => {
            expect(
                getByText("Camera and microphone permissions are required.")
            ).toBeTruthy();
        });
    });

    it("should build HMS SDK and join room", async () => {
        const { HMSSDK } = require("@100mslive/react-native-hms");

        render(
            <HmsRoom
                token={mockToken}
                roomName={mockRoomName}
                userName={mockUserName}
                enableVideo={true}
                onJoin={mockOnJoin}
                onLeave={mockOnLeave}
            />
        );

        await waitFor(() => {
            expect(HMSSDK.build).toHaveBeenCalled();
            expect(mockHmsInstance.join).toHaveBeenCalled();
        });
    });

    it("should register event listeners", async () => {
        render(
            <HmsRoom
                token={mockToken}
                roomName={mockRoomName}
                userName={mockUserName}
                enableVideo={true}
                onJoin={mockOnJoin}
                onLeave={mockOnLeave}
            />
        );

        await waitFor(() => {
            expect(mockHmsInstance.addEventListener).toHaveBeenCalledWith(
                "ON_JOIN",
                expect.any(Function)
            );
            expect(mockHmsInstance.addEventListener).toHaveBeenCalledWith(
                "ON_PEER_UPDATE",
                expect.any(Function)
            );
            expect(mockHmsInstance.addEventListener).toHaveBeenCalledWith(
                "ON_TRACK_UPDATE",
                expect.any(Function)
            );
            expect(mockHmsInstance.addEventListener).toHaveBeenCalledWith(
                "ON_ERROR",
                expect.any(Function)
            );
        });
    });

    it("should call onJoin when successfully joined", async () => {
        render(
            <HmsRoom
                token={mockToken}
                roomName={mockRoomName}
                userName={mockUserName}
                enableVideo={true}
                onJoin={mockOnJoin}
                onLeave={mockOnLeave}
            />
        );

        await waitFor(() => {
            expect(mockHmsInstance.addEventListener).toHaveBeenCalled();
        });

        // Simulate join success
        const onJoinCallback = mockHmsInstance.addEventListener.mock.calls.find(
            (call) => call[0] === "ON_JOIN"
        )[1];

        const mockLocalPeer = {
            peerID: "local-peer-id",
            name: "Test User",
            isLocal: true,
            videoTrack: { trackId: "video-track-1" },
            localAudioTrack: () => ({ isMute: () => false }),
            localVideoTrack: () => ({ isMute: () => false }),
        };

        act(() => {
            onJoinCallback({
                room: { localPeer: mockLocalPeer },
            });
        });

        await waitFor(() => {
            expect(mockOnJoin).toHaveBeenCalled();
        });
    });

    it("should cleanup on unmount", async () => {
        const { unmount } = render(
            <HmsRoom
                token={mockToken}
                roomName={mockRoomName}
                userName={mockUserName}
                enableVideo={true}
                onJoin={mockOnJoin}
                onLeave={mockOnLeave}
            />
        );

        await waitFor(() => {
            expect(mockHmsInstance.join).toHaveBeenCalled();
        });

        unmount();

        await waitFor(() => {
            expect(mockHmsInstance.removeAllListeners).toHaveBeenCalled();
            expect(mockHmsInstance.leave).toHaveBeenCalled();
            expect(mockHmsInstance.destroy).toHaveBeenCalled();
        });
    });

    it("should call onLeave with session summary", async () => {
        const { unmount } = render(
            <HmsRoom
                token={mockToken}
                roomName={mockRoomName}
                userName={mockUserName}
                enableVideo={true}
                onJoin={mockOnJoin}
                onLeave={mockOnLeave}
            />
        );

        await waitFor(() => {
            expect(mockHmsInstance.addEventListener).toHaveBeenCalled();
        });

        // Simulate join to set session start time
        const onJoinCallback = mockHmsInstance.addEventListener.mock.calls.find(
            (call) => call[0] === "ON_JOIN"
        )[1];

        const mockLocalPeer = {
            peerID: "local-peer-id",
            name: "Test User",
            isLocal: true,
            videoTrack: { trackId: "video-track-1" },
            localAudioTrack: () => ({ isMute: () => false }),
            localVideoTrack: () => ({ isMute: () => false }),
        };

        act(() => {
            onJoinCallback({
                room: { localPeer: mockLocalPeer },
            });
        });

        await waitFor(() => {
            expect(mockOnJoin).toHaveBeenCalled();
        });

        unmount();

        await waitFor(() => {
            expect(mockOnLeave).toHaveBeenCalledWith(
                expect.objectContaining({
                    durationSeconds: expect.any(Number),
                    participantCount: expect.any(Number),
                })
            );
        });
    });

    it("should handle join errors gracefully", async () => {
        const Logger = require("../../../utils/logger").default;
        mockHmsInstance.join.mockRejectedValue(new Error("Join failed"));

        const { getByText } = render(
            <HmsRoom
                token={mockToken}
                roomName={mockRoomName}
                userName={mockUserName}
                enableVideo={true}
                onJoin={mockOnJoin}
                onLeave={mockOnLeave}
            />
        );

        await waitFor(() => {
            expect(Logger.error).toHaveBeenCalledWith(
                "Join room failed:",
                expect.any(Error)
            );
            expect(getByText("Failed to join live session.")).toBeTruthy();
            expect(getByText("Retry")).toBeTruthy();
        });
    });

    it("should retry joining after an error", async () => {
        mockHmsInstance.join
            .mockRejectedValueOnce(new Error("Join failed"))
            .mockResolvedValueOnce(undefined);

        const { getByText } = render(
            <HmsRoom
                token={mockToken}
                roomName={mockRoomName}
                userName={mockUserName}
                enableVideo={true}
                onJoin={mockOnJoin}
                onLeave={mockOnLeave}
            />
        );

        await waitFor(() => {
            expect(getByText("Failed to join live session.")).toBeTruthy();
        });

        fireEvent.press(getByText("Retry"));

        await waitFor(() => {
            expect(HMSSDK.build).toHaveBeenCalledTimes(2);
            expect(mockHmsInstance.join).toHaveBeenCalledTimes(2);
        });
    });

    it("should show a close action and call onClose after an error", async () => {
        mockHmsInstance.join.mockRejectedValue(new Error("Join failed"));

        const { getByText } = render(
            <HmsRoom
                token={mockToken}
                roomName={mockRoomName}
                userName={mockUserName}
                enableVideo={true}
                onJoin={mockOnJoin}
                onLeave={mockOnLeave}
                onClose={mockOnClose}
            />
        );

        await waitFor(() => {
            expect(getByText("Close")).toBeTruthy();
        });

        await act(async () => {
            fireEvent.press(getByText("Close"));
        });

        await waitFor(() => {
            expect(mockOnClose).toHaveBeenCalledTimes(1);
        });
    });

    it("should display room name in UI", async () => {
        const { getByText } = render(
            <HmsRoom
                token={mockToken}
                roomName="My Awesome Room"
                userName={mockUserName}
                enableVideo={true}
                onJoin={mockOnJoin}
                onLeave={mockOnLeave}
            />
        );

        await waitFor(() => {
            expect(mockHmsInstance.addEventListener).toHaveBeenCalled();
        });

        // Simulate successful join to show main UI
        const onJoinCallback = mockHmsInstance.addEventListener.mock.calls.find(
            (call) => call[0] === "ON_JOIN"
        )[1];

        const mockLocalPeer = {
            peerID: "local-peer-id",
            name: "Test User",
            isLocal: true,
            videoTrack: { trackId: "video-track-1" },
            localAudioTrack: () => ({ isMute: () => false }),
            localVideoTrack: () => ({ isMute: () => false }),
        };

        act(() => {
            onJoinCallback({
                room: { localPeer: mockLocalPeer },
            });
        });

        await waitFor(() => {
            expect(getByText(/My Awesome Room/)).toBeTruthy();
        });
    });
    // Helper: simulate a successful join and return the ON_JOIN callback
    const simulateJoin = (addEventListenerMock) => {
        const onJoinCallback = addEventListenerMock.mock.calls.find(
            (call) => call[0] === "ON_JOIN"
        )?.[1];
        const mockLocalPeer = {
            peerID: "local-peer-id",
            name: "Test User",
            isLocal: true,
            videoTrack: { trackId: "video-track-1" },
            localAudioTrack: () => ({ isMute: () => false, setMute: jest.fn() }),
            localVideoTrack: () => ({ isMute: () => false, setMute: jest.fn() }),
        };
        act(() => {
            onJoinCallback?.({ room: { localPeer: mockLocalPeer } });
        });
        return { onJoinCallback, mockLocalPeer };
    };

    it("should register ON_RECONNECTING and ON_RECONNECTED listeners", async () => {
        render(
            <HmsRoom
                token={mockToken}
                roomName={mockRoomName}
                userName={mockUserName}
                enableVideo={false}
                onJoin={mockOnJoin}
                onLeave={mockOnLeave}
            />
        );

        await waitFor(() => {
            expect(mockHmsInstance.addEventListener).toHaveBeenCalledWith(
                "ON_RECONNECTING",
                expect.any(Function)
            );
            expect(mockHmsInstance.addEventListener).toHaveBeenCalledWith(
                "ON_RECONNECTED",
                expect.any(Function)
            );
        });
    });

    it("should show reconnecting banner when ON_RECONNECTING fires", async () => {
        const { getByText, queryByText } = render(
            <HmsRoom
                token={mockToken}
                roomName={mockRoomName}
                userName={mockUserName}
                enableVideo={false}
                onJoin={mockOnJoin}
                onLeave={mockOnLeave}
            />
        );

        await waitFor(() => {
            expect(mockHmsInstance.addEventListener).toHaveBeenCalled();
        });

        simulateJoin(mockHmsInstance.addEventListener);

        await waitFor(() => {
            expect(mockOnJoin).toHaveBeenCalled();
        });

        // Initially no banner
        expect(queryByText("Reconnecting\u2026")).toBeNull();

        // Fire ON_RECONNECTING
        const onReconnectingCallback = mockHmsInstance.addEventListener.mock.calls.find(
            (call) => call[0] === "ON_RECONNECTING"
        )?.[1];
        act(() => { onReconnectingCallback?.(); });

        await waitFor(() => {
            expect(getByText("Reconnecting\u2026")).toBeTruthy();
        });
    });

    it("should hide reconnecting banner when ON_RECONNECTED fires", async () => {
        const { getByText, queryByText } = render(
            <HmsRoom
                token={mockToken}
                roomName={mockRoomName}
                userName={mockUserName}
                enableVideo={false}
                onJoin={mockOnJoin}
                onLeave={mockOnLeave}
            />
        );

        await waitFor(() => {
            expect(mockHmsInstance.addEventListener).toHaveBeenCalled();
        });

        simulateJoin(mockHmsInstance.addEventListener);

        await waitFor(() => { expect(mockOnJoin).toHaveBeenCalled(); });

        // Trigger reconnecting then reconnected
        const onReconnecting = mockHmsInstance.addEventListener.mock.calls.find(
            (call) => call[0] === "ON_RECONNECTING"
        )?.[1];
        const onReconnected = mockHmsInstance.addEventListener.mock.calls.find(
            (call) => call[0] === "ON_RECONNECTED"
        )?.[1];

        act(() => { onReconnecting?.(); });
        await waitFor(() => { expect(getByText("Reconnecting\u2026")).toBeTruthy(); });

        act(() => { onReconnected?.(); });
        await waitFor(() => { expect(queryByText("Reconnecting\u2026")).toBeNull(); });
    });

});