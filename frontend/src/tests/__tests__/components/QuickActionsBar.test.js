import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import QuickActionsBar from "../../../components/QuickActionsBar";
import useViewModeStore from "../../../context/useViewModeStore";
import hapticFeedback from "../../../services/haptics/hapticFeedback";

jest.mock("../../../services/haptics/hapticFeedback", () => ({
    __esModule: true,
    default: {
        impact: jest.fn().mockResolvedValue(true),
    },
}));

describe("QuickActionsBar", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        useViewModeStore.setState({ viewMode: "discover" });
    });

    it("surfaces live sessions from studio mode", () => {
        const onActionPress = jest.fn();
        useViewModeStore.setState({ viewMode: "studio" });

        const { getByLabelText, getByText } = render(
            <QuickActionsBar onActionPress={onActionPress} />
        );

        expect(getByText("Sessions")).toBeTruthy();

        fireEvent.press(getByLabelText("Sessions"));

        expect(hapticFeedback.impact).toHaveBeenCalledTimes(1);
        expect(onActionPress).toHaveBeenCalledWith("live-sessions");
    });
});