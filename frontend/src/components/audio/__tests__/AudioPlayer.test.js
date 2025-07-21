import React from "react";
import { render, fireEvent, waitFor, act } from "@testing-library/react-native";
import AudioPlayer from "../AudioPlayer";
import { useAudioStore } from "../../../context/useAudioStore";

// Mock the audio store
jest.mock("../../../context/useAudioStore");
const mockUseAudioStore = useAudioStore;

// Mock Expo AV
const mockSound = global.mockAudioPlayback();

describe("AudioPlayer", () => {
    const mockPodcast = {
        id: 1,
        title: "Test Podcast",
        description: "Test Description",
        audio_url: "https://example.com/audio.mp3",
        duration: 60000, // 1 minute
        owner: {
            name: "Test Creator",
        },
    };

    const defaultAudioState = {
        currentPodcast: mockPodcast,
        isPlaying: false,
        position: 0,
        duration: 60000,
        isLoading: false,
        volume: 1.0,
        playbackRate: 1.0,
    };

    const mockAudioActions = {
        playPodcast: jest.fn(),
        pausePodcast: jest.fn(),
        stopPodcast: jest.fn(),
        seekToPosition: jest.fn(),
        setVolume: jest.fn(),
        setPlaybackRate: jest.fn(),
        updatePosition: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();

        mockUseAudioStore.mockReturnValue({
            ...defaultAudioState,
            ...mockAudioActions,
        });
    });

    test("renders podcast information correctly", () => {
        const { getByText } = render(<AudioPlayer />);

        expect(getByText("Test Podcast")).toBeTruthy();
        expect(getByText("Test Creator")).toBeTruthy();
    });

    test("displays play button when not playing", () => {
        const { getByTestId } = render(<AudioPlayer />);

        const playButton = getByTestId("play-pause-button");
        expect(playButton).toBeTruthy();

        // Check if it shows play icon (not pause)
        const playIcon = getByTestId("icon-MaterialIcons-play_arrow");
        expect(playIcon).toBeTruthy();
    });

    test("displays pause button when playing", () => {
        mockUseAudioStore.mockReturnValue({
            ...defaultAudioState,
            ...mockAudioActions,
            isPlaying: true,
        });

        const { getByTestId } = render(<AudioPlayer />);

        const pauseIcon = getByTestId("icon-MaterialIcons-pause");
        expect(pauseIcon).toBeTruthy();
    });

    test("calls playPodcast when play button is pressed", async () => {
        const { getByTestId } = render(<AudioPlayer />);

        const playButton = getByTestId("play-pause-button");

        await act(async () => {
            fireEvent.press(playButton);
        });

        expect(mockAudioActions.playPodcast).toHaveBeenCalledWith(mockPodcast);
    });

    test("calls pausePodcast when pause button is pressed", async () => {
        mockUseAudioStore.mockReturnValue({
            ...defaultAudioState,
            ...mockAudioActions,
            isPlaying: true,
        });

        const { getByTestId } = render(<AudioPlayer />);

        const pauseButton = getByTestId("play-pause-button");

        await act(async () => {
            fireEvent.press(pauseButton);
        });

        expect(mockAudioActions.pausePodcast).toHaveBeenCalled();
    });

    test("displays loading state correctly", () => {
        mockUseAudioStore.mockReturnValue({
            ...defaultAudioState,
            ...mockAudioActions,
            isLoading: true,
        });

        const { getByTestId } = render(<AudioPlayer />);

        // Should show loading indicator
        const loadingIndicator = getByTestId("loading-indicator");
        expect(loadingIndicator).toBeTruthy();
    });

    test("displays current position and duration", () => {
        mockUseAudioStore.mockReturnValue({
            ...defaultAudioState,
            ...mockAudioActions,
            position: 30000, // 30 seconds
            duration: 60000, // 1 minute
        });

        const { getByText } = render(<AudioPlayer />);

        expect(getByText("0:30")).toBeTruthy(); // Current position
        expect(getByText("1:00")).toBeTruthy(); // Total duration
    });

    test("progress slider reflects current position", () => {
        mockUseAudioStore.mockReturnValue({
            ...defaultAudioState,
            ...mockAudioActions,
            position: 30000, // 30 seconds
            duration: 60000, // 1 minute (50% progress)
        });

        const { getByTestId } = render(<AudioPlayer />);

        const progressSlider = getByTestId("progress-slider");
        expect(progressSlider.props.value).toBe(0.5); // 50%
    });

    test("handles seek operation correctly", async () => {
        const { getByTestId } = render(<AudioPlayer />);

        const progressSlider = getByTestId("progress-slider");

        await act(async () => {
            // Simulate user dragging to 75% (45 seconds of 60 seconds)
            fireEvent(progressSlider, "onValueChange", 0.75);
        });

        expect(mockAudioActions.seekToPosition).toHaveBeenCalledWith(45000);
    });

    test("skip forward button advances 15 seconds", async () => {
        mockUseAudioStore.mockReturnValue({
            ...defaultAudioState,
            ...mockAudioActions,
            position: 30000, // Start at 30 seconds
            duration: 60000,
        });

        const { getByTestId } = render(<AudioPlayer />);

        const skipForwardButton = getByTestId("skip-forward-button");

        await act(async () => {
            fireEvent.press(skipForwardButton);
        });

        // Should seek to position + 15 seconds
        expect(mockAudioActions.seekToPosition).toHaveBeenCalledWith(45000);
    });

    test("skip backward button goes back 15 seconds", async () => {
        mockUseAudioStore.mockReturnValue({
            ...defaultAudioState,
            ...mockAudioActions,
            position: 30000, // Start at 30 seconds
            duration: 60000,
        });

        const { getByTestId } = render(<AudioPlayer />);

        const skipBackwardButton = getByTestId("skip-backward-button");

        await act(async () => {
            fireEvent.press(skipBackwardButton);
        });

        // Should seek to position - 15 seconds
        expect(mockAudioActions.seekToPosition).toHaveBeenCalledWith(15000);
    });

    test("volume control adjusts audio volume", async () => {
        const { getByTestId } = render(<AudioPlayer />);

        const volumeSlider = getByTestId("volume-slider");

        await act(async () => {
            fireEvent(volumeSlider, "onValueChange", 0.7);
        });

        expect(mockAudioActions.setVolume).toHaveBeenCalledWith(0.7);
    });

    test("playback rate control changes speed", async () => {
        const { getByTestId } = render(<AudioPlayer />);

        const rateButton = getByTestId("playback-rate-button");

        await act(async () => {
            fireEvent.press(rateButton);
        });

        // Should cycle through rates: 1.0 -> 1.25 -> 1.5 -> 2.0 -> 0.75 -> 1.0
        expect(mockAudioActions.setPlaybackRate).toHaveBeenCalledWith(1.25);
    });

    test("handles missing audio_url gracefully", () => {
        const podcastWithoutAudio = {
            ...mockPodcast,
            audio_url: null,
        };

        mockUseAudioStore.mockReturnValue({
            ...defaultAudioState,
            ...mockAudioActions,
            currentPodcast: podcastWithoutAudio,
        });

        const { getByText } = render(<AudioPlayer />);

        expect(getByText("Audio not available")).toBeTruthy();
    });

    test("displays error state when audio fails to load", () => {
        mockUseAudioStore.mockReturnValue({
            ...defaultAudioState,
            ...mockAudioActions,
            isLoading: false,
            error: "Failed to load audio",
        });

        const { getByText } = render(<AudioPlayer />);

        expect(getByText("Failed to load audio")).toBeTruthy();
    });

    test("formats time correctly for various durations", () => {
        const testCases = [
            { milliseconds: 0, expected: "0:00" },
            { milliseconds: 30000, expected: "0:30" },
            { milliseconds: 60000, expected: "1:00" },
            { milliseconds: 90000, expected: "1:30" },
            { milliseconds: 3600000, expected: "60:00" }, // 1 hour
            { milliseconds: 3661000, expected: "61:01" }, // 1 hour 1 minute 1 second
        ];

        // We need to access the formatTime function somehow
        // This would typically be done by extracting it to a utils file
        // For now, we'll test through component behavior

        testCases.forEach(({ milliseconds, expected }) => {
            mockUseAudioStore.mockReturnValue({
                ...defaultAudioState,
                ...mockAudioActions,
                position: milliseconds,
                duration: 3600000, // 1 hour
            });

            const { getByText } = render(<AudioPlayer />);
            expect(getByText(expected)).toBeTruthy();
        });
    });

    test("handles null podcast gracefully", () => {
        mockUseAudioStore.mockReturnValue({
            ...defaultAudioState,
            ...mockAudioActions,
            currentPodcast: null,
        });

        const { getByText } = render(<AudioPlayer />);

        expect(getByText("No podcast selected")).toBeTruthy();
    });

    test("accessibility labels are present", () => {
        const { getByTestId } = render(<AudioPlayer />);

        const playButton = getByTestId("play-pause-button");
        expect(playButton.props.accessibilityLabel).toBe("Play podcast");

        const skipForwardButton = getByTestId("skip-forward-button");
        expect(skipForwardButton.props.accessibilityLabel).toBe(
            "Skip forward 15 seconds"
        );

        const skipBackwardButton = getByTestId("skip-backward-button");
        expect(skipBackwardButton.props.accessibilityLabel).toBe(
            "Skip backward 15 seconds"
        );
    });

    test("prevents seek beyond duration boundaries", async () => {
        mockUseAudioStore.mockReturnValue({
            ...defaultAudioState,
            ...mockAudioActions,
            position: 55000, // Near end (55 seconds of 60)
            duration: 60000,
        });

        const { getByTestId } = render(<AudioPlayer />);

        const skipForwardButton = getByTestId("skip-forward-button");

        await act(async () => {
            fireEvent.press(skipForwardButton);
        });

        // Should not exceed duration
        expect(mockAudioActions.seekToPosition).toHaveBeenCalledWith(60000);
    });

    test("prevents seek below zero", async () => {
        mockUseAudioStore.mockReturnValue({
            ...defaultAudioState,
            ...mockAudioActions,
            position: 5000, // Near beginning (5 seconds)
            duration: 60000,
        });

        const { getByTestId } = render(<AudioPlayer />);

        const skipBackwardButton = getByTestId("skip-backward-button");

        await act(async () => {
            fireEvent.press(skipBackwardButton);
        });

        // Should not go below 0
        expect(mockAudioActions.seekToPosition).toHaveBeenCalledWith(0);
    });
});
