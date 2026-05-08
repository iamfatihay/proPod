import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import LiveInviteScreen from "../../../../app/live";
import apiService from "../../../services/api/apiService";

const mockBack = jest.fn();
let latestHmsRoomProps = null;

jest.mock("../../../services/api/apiService", () => ({
    __esModule: true,
    default: {
        getRtcInviteSession: jest.fn(),
        joinRtcByInvite: jest.fn(),
    },
}));

jest.mock("expo-router", () => ({
    useRouter: () => ({
        back: mockBack,
    }),
    useLocalSearchParams: () => ({
        inviteCode: "JOIN1234",
    }),
}));

jest.mock("@expo/vector-icons", () => {
    const React = require("react");
    const { Text } = require("react-native");

    return {
        Ionicons: ({ name }) => <Text>{name}</Text>,
    };
});

jest.mock("../../../components/Toast", () => ({
    useToast: () => ({
        showToast: jest.fn(),
    }),
}));

jest.mock("../../../context/useAuthStore", () => ({
    __esModule: true,
    default: (selector) => selector({
        user: {
            name: "Guest User",
        },
    }),
}));

jest.mock("../../../components/rtc/HmsRoom", () => {
    const React = require("react");
    const { Text, TouchableOpacity, View } = require("react-native");

    return function MockHmsRoom(props) {
        latestHmsRoomProps = props;

        return (
            <View>
                <Text>Mock HMS Room</Text>
                <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel="Mock join live room"
                    onPress={() => props.onJoin && props.onJoin()}
                >
                    <Text>Join room</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel="Mock leave live room"
                    onPress={() => props.onLeave && props.onLeave({
                        durationSeconds: 125,
                        participantCount: 4,
                    })}
                >
                    <Text>Leave room</Text>
                </TouchableOpacity>
            </View>
        );
    };
});

describe("LiveInviteScreen", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        latestHmsRoomProps = null;
    });

    it("shows live preview status before joining", async () => {
        apiService.getRtcInviteSession.mockResolvedValue({
            session_id: 11,
            room_id: "room-11",
            title: "Remote Roundtable",
            owner_name: "Host Maya",
            media_mode: "video",
            invite_code: "JOIN1234",
            is_live: true,
            participant_count: 3,
        });

        const { getByText } = render(<LiveInviteScreen />);

        await waitFor(() => {
            expect(apiService.getRtcInviteSession).toHaveBeenCalledWith("JOIN1234");
        });

        expect(getByText("Live now")).toBeTruthy();
        expect(getByText("Host: Host Maya")).toBeTruthy();
        expect(getByText("3 people are connected")).toBeTruthy();
    });

    it("shows host and recording status after leaving the room", async () => {
        apiService.getRtcInviteSession.mockResolvedValue({
            session_id: 11,
            room_id: "room-11",
            title: "Remote Roundtable",
            owner_name: "Host Maya",
            media_mode: "video",
            invite_code: "JOIN1234",
            is_live: true,
            participant_count: 2,
        });
        apiService.joinRtcByInvite.mockResolvedValue({
            token: "token-123",
            room_id: "room-11",
            room_name: "remote-roundtable",
            session_id: 11,
            media_mode: "video",
            title: "Remote Roundtable",
            invite_code: "JOIN1234",
            role: "guest",
        });

        const { getByText, getByLabelText } = render(<LiveInviteScreen />);

        await waitFor(() => {
            expect(getByText("Join as Guest")).toBeTruthy();
        });

        fireEvent.press(getByText("Join as Guest"));

        await waitFor(() => {
            expect(apiService.joinRtcByInvite).toHaveBeenCalledWith({
                invite_code: "JOIN1234",
                display_name: "Guest User",
                role: "guest",
            });
        });

        fireEvent.press(getByLabelText("Mock join live room"));
        fireEvent.press(getByLabelText("Mock leave live room"));

        await waitFor(() => {
            expect(getByText("Session Summary")).toBeTruthy();
        });

        expect(getByText("You joined Host Maya's video session.")).toBeTruthy();
        expect(getByText("Recording status")).toBeTruthy();
        expect(getByText("Recording processing")).toBeTruthy();
        expect(getByText("Host")).toBeTruthy();
        expect(getByText("Host Maya")).toBeTruthy();
        expect(getByText("Invite code: JOIN1234")).toBeTruthy();
        expect(latestHmsRoomProps.userName).toBe("Guest User");
    });
});