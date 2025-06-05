export const AudioConfig = {
    // Recording Settings
    recording: {
        sampleRate: 44100,
        numberOfChannels: 1,
        bitRate: 128000,
        format: "mp3",
        quality: "high",
    },

    // Streaming Settings
    streaming: {
        sampleRate: 44100,
        bitRate: 64000,
        numberOfChannels: 1,
        bufferSize: 1024,
    },

    // Audio Processing
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
