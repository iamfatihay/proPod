export const AudioConfig = {
    // Base Recording Settings (expo-audio compatible)
    SAMPLE_RATE: 44100,
    CHANNELS: 1,
    BIT_RATE: 128000,

    // Android specific constants (expo-audio uses string enums)
    ANDROID_OUTPUT_FORMAT: "mpeg4", // MPEG_4
    ANDROID_AUDIO_ENCODER: "aac", // AAC

    // iOS specific constants
    IOS_OUTPUT_FORMAT: 0, // LINEARPCM / MPEG4AAC equivalent
    IOS_AUDIO_QUALITY: 0x7f, // HIGH (127 in hex)

    // Streaming Settings (for live streaming features)
    streaming: {
        sampleRate: 44100,
        bitRate: 64000,
        numberOfChannels: 1,
        bufferSize: 1024,
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
