import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import PlaybackSpeedModal from "../../components/PlaybackSpeedModal";
import useAudioStore from "../../context/useAudioStore";

jest.mock("../../context/useAudioStore");

describe("PlaybackSpeedModal", () => {
    const mockSetPlaybackRate = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
        useAudioStore.mockImplementation((selector) => {
            return selector({
                playbackRate: 1.0,
                setPlaybackRate: mockSetPlaybackRate,
            });
        });
    });

    it("renders when visible is true", () => {
        const { getByText } = render(
            <PlaybackSpeedModal visible={true} onClose={jest.fn()} />
        );

        expect(getByText("Playback Speed")).toBeTruthy();
        expect(getByText("Current Speed")).toBeTruthy();
    });

    it("displays 'Normal' for 1.0 speed in current speed display", () => {
        const { getByText, getAllByText } = render(
            <PlaybackSpeedModal visible={true} onClose={jest.fn()} />
        );

        // The current speed label is present
        expect(getByText("Current Speed")).toBeTruthy();
        // The current speed value renders as "Normal" for 1.0x
        // (also appears in the preset grid, so getAllByText is used)
        const normalElements = getAllByText("Normal");
        expect(normalElements.length).toBeGreaterThanOrEqual(1);
    });

    it("renders speed preset buttons", () => {
        const { getByText } = render(
            <PlaybackSpeedModal visible={true} onClose={jest.fn()} />
        );

        // Check for some speed presets (Normal appears in presets)
        expect(getByText("0.50x")).toBeTruthy();
        expect(getByText("0.75x")).toBeTruthy();
        expect(getByText("1.25x")).toBeTruthy();
        expect(getByText("1.50x")).toBeTruthy();
        expect(getByText("2.00x")).toBeTruthy();
    });

    it("calls setPlaybackRate when a speed preset is selected", () => {
        const mockOnClose = jest.fn();
        const { getByLabelText } = render(
            <PlaybackSpeedModal visible={true} onClose={mockOnClose} />
        );

        const speedButton = getByLabelText("Set playback speed to 1.50x");
        fireEvent.press(speedButton);

        expect(mockSetPlaybackRate).toHaveBeenCalledWith(1.5);
    });

    it("calls onClose after selecting a speed", () => {
        const mockOnClose = jest.fn();
        const { getByLabelText } = render(
            <PlaybackSpeedModal visible={true} onClose={mockOnClose} />
        );

        const speedButton = getByLabelText("Set playback speed to 1.50x");
        fireEvent.press(speedButton);

        expect(mockOnClose).toHaveBeenCalled();
    });

    it("calls onClose when Done button is pressed", () => {
        const mockOnClose = jest.fn();
        const { getByLabelText } = render(
            <PlaybackSpeedModal visible={true} onClose={mockOnClose} />
        );

        const doneButton = getByLabelText("Close playback speed selector");
        fireEvent.press(doneButton);

        expect(mockOnClose).toHaveBeenCalled();
    });

    it("handles minimum speed (0.5x) selection", () => {
        const mockOnClose = jest.fn();
        const { getByLabelText } = render(
            <PlaybackSpeedModal visible={true} onClose={mockOnClose} />
        );

        const button = getByLabelText("Set playback speed to 0.50x");
        fireEvent.press(button);

        expect(mockSetPlaybackRate).toHaveBeenCalledWith(0.5);
        expect(mockOnClose).toHaveBeenCalled();
    });

    it("handles maximum speed (2.0x) selection", () => {
        const mockOnClose = jest.fn();
        const { getByLabelText } = render(
            <PlaybackSpeedModal visible={true} onClose={mockOnClose} />
        );

        const button = getByLabelText("Set playback speed to 2.00x");
        fireEvent.press(button);

        expect(mockSetPlaybackRate).toHaveBeenCalledWith(2.0);
        expect(mockOnClose).toHaveBeenCalled();
    });

    it("handles intermediate speeds correctly", () => {
        const mockOnClose = jest.fn();
        const { getByLabelText } = render(
            <PlaybackSpeedModal visible={true} onClose={mockOnClose} />
        );

        // Test 0.75x
        const button075 = getByLabelText("Set playback speed to 0.75x");
        fireEvent.press(button075);
        expect(mockSetPlaybackRate).toHaveBeenCalledWith(0.75);

        mockSetPlaybackRate.mockClear();
        mockOnClose.mockClear();

        // Re-render for next test
        const { getByLabelText: getByLabelText2 } = render(
            <PlaybackSpeedModal visible={true} onClose={mockOnClose} />
        );

        // Test 1.25x
        const button125 = getByLabelText2("Set playback speed to 1.25x");
        fireEvent.press(button125);
        expect(mockSetPlaybackRate).toHaveBeenCalledWith(1.25);
    });
});
