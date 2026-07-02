/**
 * Mock for @100mslive/react-native-hms
 */

export const HMSSDK = {
    build: jest.fn().mockResolvedValue({
        join: jest.fn().mockResolvedValue(undefined),
        preview: jest.fn().mockResolvedValue(undefined),
        leave: jest.fn().mockResolvedValue(undefined),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        removeAllListeners: jest.fn(),
        destroy: jest.fn(),
        setLocalVideoEnabled: jest.fn().mockResolvedValue(undefined),
        setLocalAudioEnabled: jest.fn().mockResolvedValue(undefined),
        getLocalPeer: jest.fn().mockReturnValue({
            videoTrack: { trackId: "mock-video-track" },
            audioTrack: { trackId: "mock-audio-track" },
        }),
    }),
};

export const HMSConfig = jest.fn().mockImplementation((config) => config);

export const HMSUpdateListenerActions = {
    ON_JOIN: "ON_JOIN",
    ON_PREVIEW: "ON_PREVIEW",
    ON_PEER_UPDATE: "ON_PEER_UPDATE",
    ON_TRACK_UPDATE: "ON_TRACK_UPDATE",
    ON_SPEAKER: "ON_SPEAKER",
    ON_TRANSCRIPTS: "ON_TRANSCRIPTS",
    ON_ERROR: "ON_ERROR",
    ON_ROOM_UPDATE: "ON_ROOM_UPDATE",
    // Real SDK enum keys are RECONNECTING/RECONNECTED (no ON_ prefix).
    RECONNECTING: "RECONNECTING",
    RECONNECTED: "RECONNECTED",
};

export const HMSTrackType = {
    VIDEO: "VIDEO",
    AUDIO: "AUDIO",
};

export const HMSTrackUpdate = {
    TRACK_ADDED: "TRACK_ADDED",
    TRACK_REMOVED: "TRACK_REMOVED",
    TRACK_MUTED: "TRACK_MUTED",
    TRACK_UNMUTED: "TRACK_UNMUTED",
};

export const HMSPeerUpdate = {
    PEER_JOINED: "PEER_JOINED",
    PEER_LEFT: "PEER_LEFT",
    NETWORK_QUALITY_UPDATED: "NETWORK_QUALITY_UPDATED",
    BECAME_DOMINANT_SPEAKER: "BECAME_DOMINANT_SPEAKER",
};

export const HMSRoomUpdate = {
    ROOM_PEER_COUNT_UPDATED: "ROOM_PEER_COUNT_UPDATED",
};

export const HMSAudioTrackSettings = jest.fn().mockImplementation((settings) => settings);

export const HMSTrackSettings = jest.fn().mockImplementation((settings) => settings);

export const HMSIOSAudioMode = {
    MUSIC: "MUSIC",
    VOICE: "VOICE",
};

export const HMSNoiseCancellationModels = {
    SmallFullBand: "SMALL_FULL_BAND",
};

export const HMSNoiseCancellationInitialState = {
    Enabled: "ENABLED",
    Disabled: "DISABLED",
};

export const HMSNoiseCancellationPlugin = jest.fn().mockImplementation((config) => ({
    ...config,
    isNoiseCancellationAvailable: jest.fn().mockResolvedValue(false),
    isEnabled: jest.fn().mockResolvedValue(false),
    enable: jest.fn().mockResolvedValue(true),
    disable: jest.fn().mockResolvedValue(true),
}));
