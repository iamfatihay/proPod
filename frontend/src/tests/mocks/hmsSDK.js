/**
 * Mock for @100mslive/react-native-hms
 */

export const HMSSDK = {
    build: jest.fn().mockResolvedValue({
        join: jest.fn().mockResolvedValue(undefined),
        leave: jest.fn().mockResolvedValue(undefined),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
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
    ON_PEER_UPDATE: "ON_PEER_UPDATE",
    ON_TRACK_UPDATE: "ON_TRACK_UPDATE",
    ON_ERROR: "ON_ERROR",
    ON_ROOM_UPDATE: "ON_ROOM_UPDATE",
    ON_RECONNECTING: "ON_RECONNECTING",
    ON_RECONNECTED: "ON_RECONNECTED",
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
