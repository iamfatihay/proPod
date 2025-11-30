// Mock for expo-audio (migrated from expo-av)
const AudioRecorder = jest.fn().mockImplementation(() => ({
    createRecordingAsync: jest.fn().mockResolvedValue({
        startAsync: jest.fn().mockResolvedValue(undefined),
        stopAndUnloadAsync: jest.fn().mockResolvedValue({
            uri: "file://test-recording.m4a",
            duration: 5000,
        }),
        pauseAsync: jest.fn().mockResolvedValue(undefined),
        resumeAsync: jest.fn().mockResolvedValue(undefined),
        getURI: jest.fn().mockReturnValue("file://test-recording.m4a"),
    }),
}));

const AudioPlayer = jest.fn().mockImplementation(() => ({
    load: jest.fn().mockResolvedValue(undefined),
    play: jest.fn().mockResolvedValue(undefined),
    pause: jest.fn().mockResolvedValue(undefined),
    stop: jest.fn().mockResolvedValue(undefined),
    unload: jest.fn().mockResolvedValue(undefined),
    addListener: jest.fn(),
    removeListener: jest.fn(),
    currentTime: 0,
    duration: 60,
    volume: 1.0,
    rate: 1.0,
    loop: false,
}));

const setAudioModeAsync = jest.fn().mockResolvedValue(undefined);
const requestPermissionsAsync = jest.fn().mockResolvedValue({ status: "granted" });
const getPermissionsAsync = jest.fn().mockResolvedValue({ status: "granted" });

// Enums
const AndroidAudioEncoder = { AAC: "aac" };
const AndroidOutputFormat = { MPEG_4: "mpeg4" };
const IOSOutputFormat = { MPEG4AAC: "mpeg4aac" };
const IOSAudioQuality = { HIGH: "high" };

export {
    AudioRecorder,
    AudioPlayer,
    setAudioModeAsync,
    requestPermissionsAsync,
    getPermissionsAsync,
    AndroidAudioEncoder,
    AndroidOutputFormat,
    IOSOutputFormat,
    IOSAudioQuality,
};

export default {
    AudioRecorder,
    AudioPlayer,
    setAudioModeAsync,
    requestPermissionsAsync,
    getPermissionsAsync,
};
