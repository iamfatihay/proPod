// Mock for expo-av
const Audio = {
    // Recording class mock
    Recording: jest.fn().mockImplementation(() => ({
        prepareToRecordAsync: jest.fn().mockResolvedValue({}),
        startAsync: jest.fn().mockResolvedValue({}),
        pauseAsync: jest.fn().mockResolvedValue({}),
        stopAndUnloadAsync: jest.fn().mockResolvedValue({
            uri: "file://test-recording.m4a",
            status: {
                durationMillis: 5000,
                canRecord: false,
                isRecording: false,
            },
        }),
        getStatusAsync: jest.fn().mockResolvedValue({
            canRecord: true,
            isRecording: false,
            durationMillis: 0,
            metering: -160,
        }),
        setOnRecordingStatusUpdate: jest.fn(),
        _subscription: null,
    })),

    // Sound class mock
    Sound: {
        createAsync: jest.fn().mockResolvedValue([
            {
                loadAsync: jest.fn().mockResolvedValue({}),
                unloadAsync: jest.fn().mockResolvedValue({}),
                playAsync: jest.fn().mockResolvedValue({}),
                pauseAsync: jest.fn().mockResolvedValue({}),
                stopAsync: jest.fn().mockResolvedValue({}),
                replayAsync: jest.fn().mockResolvedValue({}),
                setPositionAsync: jest.fn().mockResolvedValue({}),
                setRateAsync: jest.fn().mockResolvedValue({}),
                setVolumeAsync: jest.fn().mockResolvedValue({}),
                getStatusAsync: jest.fn().mockResolvedValue({
                    isLoaded: true,
                    isPlaying: false,
                    positionMillis: 0,
                    durationMillis: 60000,
                    rate: 1.0,
                    volume: 1.0,
                    isMuted: false,
                    shouldPlay: false,
                }),
                setOnPlaybackStatusUpdate: jest.fn(),
                _loaded: true,
            },
            {},
        ]),
    },

    // Audio modes and configurations
    setAudioModeAsync: jest.fn().mockResolvedValue({}),

    RecordingOptionsPresets: {
        HIGH_QUALITY: {
            isMeteringEnabled: true,
            android: {
                extension: ".m4a",
                outputFormat: "mpeg_4",
                audioEncoder: "aac",
                sampleRate: 44100,
                numberOfChannels: 2,
                bitRate: 128000,
            },
            ios: {
                extension: ".m4a",
                outputFormat: "mpeg_4",
                audioQuality: "max",
                sampleRate: 44100,
                numberOfChannels: 2,
                bitRate: 128000,
                linearPCMBitDepth: 16,
                linearPCMIsBigEndian: false,
                linearPCMIsFloat: false,
            },
        },
    },

    InterruptionModeIOS: {
        MixWithOthers: 0,
        DoNotMix: 1,
        DuckOthers: 2,
    },

    InterruptionModeAndroid: {
        DoNotMix: 1,
        DuckOthers: 2,
    },

    RECORDING_OPTION_IOS_AUDIO_QUALITY_MAX: "max",
    RECORDING_OPTION_IOS_AUDIO_QUALITY_HIGH: "high",
    RECORDING_OPTION_IOS_AUDIO_QUALITY_MEDIUM: "medium",
    RECORDING_OPTION_IOS_AUDIO_QUALITY_LOW: "low",
    RECORDING_OPTION_IOS_AUDIO_QUALITY_MIN: "min",

    // Permissions mock
    requestPermissionsAsync: jest.fn().mockResolvedValue({
        status: "granted",
        granted: true,
        canAskAgain: true,
        expires: "never",
    }),

    getPermissionsAsync: jest.fn().mockResolvedValue({
        status: "granted",
        granted: true,
        canAskAgain: true,
        expires: "never",
    }),
};

// Video mock (basic)
const Video = jest.fn().mockImplementation(() => ({
    loadAsync: jest.fn().mockResolvedValue({}),
    unloadAsync: jest.fn().mockResolvedValue({}),
    presentFullscreenPlayer: jest.fn().mockResolvedValue({}),
    dismissFullscreenPlayer: jest.fn().mockResolvedValue({}),
}));

// AVPlaybackStatus constants
const AVPlaybackStatus = {
    Loaded: "loaded",
    Loading: "loading",
    Error: "error",
};

module.exports = {
    Audio,
    Video,
    AVPlaybackStatus,
};
