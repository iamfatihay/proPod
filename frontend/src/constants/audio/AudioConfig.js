export const AudioConfig = {
    // Base Recording Settings (expo-audio compatible)
    // 44.1 kHz mono 128 kbps AAC = podcast industry standard (~57 MB/hour)
    SAMPLE_RATE: 44100,
    CHANNELS: 1,
    BIT_RATE: 128000,

    // Android specific constants (expo-audio uses string enums)
    ANDROID_OUTPUT_FORMAT: "mpeg4", // MPEG_4
    ANDROID_AUDIO_ENCODER: "aac", // AAC

    // iOS specific constants
    IOS_OUTPUT_FORMAT: 0, // LINEARPCM / MPEG4AAC equivalent
    IOS_AUDIO_QUALITY: 0x60, // HIGH (96) — sufficient for speech, was MAX (127)

    // Streaming Settings (for live streaming features)
    streaming: {
        sampleRate: 44100,
        bitRate: 128000,
        numberOfChannels: 1,
        bufferSize: 2048,
    },

    // Audio Processing (for future AI features)
    processing: {
        noiseReduction: true,
        autoGainControl: true,
        echoCancellation: true,
    },

    // File Limits
    limits: {
        maxRecordingDuration: 3600, // 1 hour in seconds
        maxFileSize: 100, // MB
        minRecordingDuration: 1, // 1 second
    },

    // Supported Formats
    supportedFormats: ["mp3", "wav", "m4a"],

    // Default Podcast Settings
    defaultPodcast: {
        title: "Untitled Podcast",
        description: "",
        isPublic: false,
        category: "General",
    },
};
