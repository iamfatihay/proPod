/**
 * Component Tests: RecordingControls
 * Tests recording functionality and user interactions
 * Focus on audio recording workflows and state management
 */

import React from "react";
import { render, fireEvent, waitFor, act } from "@testing-library/react-native";
import RecordingControls from "../RecordingControls";

// Mock audio recording hook
const mockRecordingHook = {
    isRecording: false,
    isPaused: false,
    duration: 0,
    canRecord: true,
    isLoading: false,
    error: null,
    startRecording: jest.fn(),
    pauseRecording: jest.fn(),
    resumeRecording: jest.fn(),
    stopRecording: jest.fn(),
    cancelRecording: jest.fn(),
};

jest.mock("../../../hooks/useAudioRecording", () => ({
    useAudioRecording: () => mockRecordingHook,
}));

describe("RecordingControls Component", () => {
    beforeEach(() => {
        jest.clearAllMocks();

        // Reset hook state
        mockRecordingHook.isRecording = false;
        mockRecordingHook.isPaused = false;
        mockRecordingHook.duration = 0;
        mockRecordingHook.canRecord = true;
        mockRecordingHook.isLoading = false;
        mockRecordingHook.error = null;
    });

    describe("Initial State and Setup", () => {
        test("shows record button when not recording", () => {
            const { getByTestId } = render(<RecordingControls />);

            const recordButton = getByTestId("record-button");
            expect(recordButton).toBeTruthy();

            // Should show record icon, not pause
            const recordIcon = getByTestId(
                "icon-MaterialIcons-fiber_manual_record"
            );
            expect(recordIcon).toBeTruthy();
        });

        test("shows duration as 00:00 initially", () => {
            const { getByText } = render(<RecordingControls />);

            expect(getByText("00:00")).toBeTruthy();
        });

        test("displays permission status correctly", () => {
            const { getByText } = render(<RecordingControls />);

            expect(getByText(/Ready to record/i)).toBeTruthy();
        });
    });

    describe("Recording Workflow", () => {
        test("starts recording when record button is pressed", async () => {
            const { getByTestId } = render(<RecordingControls />);

            const recordButton = getByTestId("record-button");

            await act(async () => {
                fireEvent.press(recordButton);
            });

            expect(mockRecordingHook.startRecording).toHaveBeenCalled();
        });

        test("shows pause button when recording starts", () => {
            mockRecordingHook.isRecording = true;

            const { getByTestId } = render(<RecordingControls />);

            const pauseButton = getByTestId("pause-button");
            expect(pauseButton).toBeTruthy();

            const pauseIcon = getByTestId("icon-MaterialIcons-pause");
            expect(pauseIcon).toBeTruthy();
        });

        test("pauses recording when pause button is pressed", async () => {
            mockRecordingHook.isRecording = true;

            const { getByTestId } = render(<RecordingControls />);

            const pauseButton = getByTestId("pause-button");

            await act(async () => {
                fireEvent.press(pauseButton);
            });

            expect(mockRecordingHook.pauseRecording).toHaveBeenCalled();
        });

        test("resumes recording when resume button is pressed", async () => {
            mockRecordingHook.isRecording = false;
            mockRecordingHook.isPaused = true;
            mockRecordingHook.duration = 5000; // 5 seconds recorded

            const { getByTestId } = render(<RecordingControls />);

            const resumeButton = getByTestId("resume-button");

            await act(async () => {
                fireEvent.press(resumeButton);
            });

            expect(mockRecordingHook.resumeRecording).toHaveBeenCalled();
        });

        test("stops recording when stop button is pressed", async () => {
            mockRecordingHook.isRecording = true;

            const { getByTestId } = render(<RecordingControls />);

            const stopButton = getByTestId("stop-button");

            await act(async () => {
                fireEvent.press(stopButton);
            });

            expect(mockRecordingHook.stopRecording).toHaveBeenCalled();
        });
    });

    describe("Duration Display and Updates", () => {
        test("formats short duration correctly", () => {
            mockRecordingHook.duration = 30000; // 30 seconds

            const { getByText } = render(<RecordingControls />);

            expect(getByText("00:30")).toBeTruthy();
        });

        test("formats long duration correctly", () => {
            mockRecordingHook.duration = 3661000; // 1 hour, 1 minute, 1 second

            const { getByText } = render(<RecordingControls />);

            expect(getByText("61:01")).toBeTruthy(); // Shows as minutes:seconds
        });

        test("updates duration in real-time during recording", async () => {
            mockRecordingHook.isRecording = true;

            const { getByText, rerender } = render(<RecordingControls />);

            // Initial duration
            expect(getByText("00:00")).toBeTruthy();

            // Simulate duration update
            mockRecordingHook.duration = 10000; // 10 seconds
            rerender(<RecordingControls />);

            expect(getByText("00:10")).toBeTruthy();
        });
    });

    describe("Visual States and Feedback", () => {
        test("shows recording indicator when recording", () => {
            mockRecordingHook.isRecording = true;

            const { getByTestId } = render(<RecordingControls />);

            const recordingIndicator = getByTestId("recording-indicator");
            expect(recordingIndicator).toBeTruthy();
        });

        test("shows paused state visual feedback", () => {
            mockRecordingHook.isPaused = true;
            mockRecordingHook.duration = 5000;

            const { getByTestId } = render(<RecordingControls />);

            const pausedIndicator = getByTestId("paused-indicator");
            expect(pausedIndicator).toBeTruthy();
        });

        test("shows loading state during recording operations", () => {
            mockRecordingHook.isLoading = true;

            const { getByTestId } = render(<RecordingControls />);

            const loadingIndicator = getByTestId("loading-indicator");
            expect(loadingIndicator).toBeTruthy();
        });

        test("shows waveform visualization during recording", () => {
            mockRecordingHook.isRecording = true;

            const { getByTestId } = render(<RecordingControls />);

            const waveform = getByTestId("waveform-visualization");
            expect(waveform).toBeTruthy();
        });
    });

    describe("Error Handling and Edge Cases", () => {
        test("shows error message when recording fails", () => {
            mockRecordingHook.error = "Microphone permission denied";

            const { getByText } = render(<RecordingControls />);

            expect(getByText("Microphone permission denied")).toBeTruthy();
        });

        test("disables record button when permissions are denied", () => {
            mockRecordingHook.canRecord = false;
            mockRecordingHook.error = "Permission denied";

            const { getByTestId } = render(<RecordingControls />);

            const recordButton = getByTestId("record-button");
            expect(recordButton.props.disabled).toBe(true);
        });

        test("handles maximum recording duration limit", () => {
            mockRecordingHook.duration = 3600000; // 1 hour (max limit)
            mockRecordingHook.isRecording = true;

            const { getByText } = render(<RecordingControls />);

            expect(getByText(/Maximum duration reached/i)).toBeTruthy();
        });

        test("shows warning for low storage space", () => {
            mockRecordingHook.error = "Insufficient storage space";

            const { getByText } = render(<RecordingControls />);

            expect(getByText(/Insufficient storage/i)).toBeTruthy();
        });
    });

    describe("Accessibility and Usability", () => {
        test("has proper accessibility labels for all buttons", () => {
            const { getByTestId } = render(<RecordingControls />);

            const recordButton = getByTestId("record-button");
            expect(recordButton.props.accessibilityLabel).toBe(
                "Start recording"
            );
            expect(recordButton.props.accessibilityRole).toBe("button");
        });

        test("provides audio feedback for recording state changes", () => {
            mockRecordingHook.isRecording = true;

            const { getByTestId } = render(<RecordingControls />);

            const recordingIndicator = getByTestId("recording-indicator");
            expect(recordingIndicator.props.accessibilityLiveRegion).toBe(
                "polite"
            );
            expect(recordingIndicator.props.accessibilityLabel).toContain(
                "Recording in progress"
            );
        });

        test("supports keyboard navigation", () => {
            const { getByTestId } = render(<RecordingControls />);

            const recordButton = getByTestId("record-button");
            expect(recordButton.props.accessible).toBe(true);
            expect(recordButton.props.accessibilityRole).toBe("button");
        });
    });

    describe("Advanced Features", () => {
        test("shows AI enhancement toggle", () => {
            const { getByTestId } = render(<RecordingControls />);

            const aiToggle = getByTestId("ai-enhancement-toggle");
            expect(aiToggle).toBeTruthy();
        });

        test("handles AI toggle state changes", async () => {
            const onAIToggle = jest.fn();

            const { getByTestId } = render(
                <RecordingControls onAIToggle={onAIToggle} />
            );

            const aiToggle = getByTestId("ai-enhancement-toggle");

            await act(async () => {
                fireEvent.press(aiToggle);
            });

            expect(onAIToggle).toHaveBeenCalledWith(true);
        });

        test("shows recording quality options", () => {
            const { getByTestId } = render(<RecordingControls />);

            const qualitySelector = getByTestId("quality-selector");
            expect(qualitySelector).toBeTruthy();
        });
    });

    describe("Cross-Platform Behavior", () => {
        test("handles iOS-specific recording behavior", () => {
            // Mock iOS platform
            jest.mock("react-native/Libraries/Utilities/Platform", () => ({
                OS: "ios",
            }));

            const { getByTestId } = render(<RecordingControls />);

            const recordButton = getByTestId("record-button");
            expect(recordButton).toBeTruthy();

            // iOS should show M4A format indicator
            const formatIndicator = getByTestId("format-indicator");
            expect(formatIndicator.props.children).toContain("M4A");
        });

        test("handles Android-specific recording behavior", () => {
            // Mock Android platform
            jest.mock("react-native/Libraries/Utilities/Platform", () => ({
                OS: "android",
            }));

            const { getByTestId } = render(<RecordingControls />);

            const recordButton = getByTestId("record-button");
            expect(recordButton).toBeTruthy();

            // Android should show MP3 format indicator
            const formatIndicator = getByTestId("format-indicator");
            expect(formatIndicator.props.children).toContain("MP3");
        });
    });

    describe("Performance and Memory", () => {
        test("cancels recording and cleans up resources", async () => {
            mockRecordingHook.isRecording = true;

            const { getByTestId } = render(<RecordingControls />);

            const cancelButton = getByTestId("cancel-button");

            await act(async () => {
                fireEvent.press(cancelButton);
            });

            expect(mockRecordingHook.cancelRecording).toHaveBeenCalled();
        });

        test("handles component unmount during recording", () => {
            mockRecordingHook.isRecording = true;

            const { unmount } = render(<RecordingControls />);

            // Should clean up gracefully
            expect(() => unmount()).not.toThrow();
        });
    });
});
