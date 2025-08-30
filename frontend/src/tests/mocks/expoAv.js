// Mock for expo-av
const Audio = {
    Recording: jest.fn().mockImplementation(() => ({
        prepareToRecordAsync: jest.fn().mockResolvedValue(undefined),
        startAsync: jest.fn().mockResolvedValue(undefined),
        stopAndUnloadAsync: jest.fn().mockResolvedValue({
            uri: "file://test-recording.m4a",
            durationMillis: 5000,
        }),
        pauseAsync: jest.fn().mockResolvedValue(undefined),
        resumeAsync: jest.fn().mockResolvedValue(undefined),
        getStatusAsync: jest.fn().mockResolvedValue({
            isRecording: true,
            durationMillis: 5000,
        }),
    })),

    Sound: jest.fn().mockImplementation(() => ({
        loadAsync: jest.fn().mockResolvedValue(undefined),
        playAsync: jest.fn().mockResolvedValue(undefined),
        pauseAsync: jest.fn().mockResolvedValue(undefined),
        stopAsync: jest.fn().mockResolvedValue(undefined),
        unloadAsync: jest.fn().mockResolvedValue(undefined),
        getStatusAsync: jest.fn().mockResolvedValue({
            isLoaded: true,
            isPlaying: false,
            durationMillis: 60000,
            positionMillis: 0,
        }),
    })),

    setAudioModeAsync: jest.fn().mockResolvedValue(undefined),

    // Constants
    INTERRUPTION_MODE_IOS_DO_NOT_MIX: 1,
    INTERRUPTION_MODE_ANDROID_DO_NOT_MIX: 1,
};

export { Audio };
export default Audio;
