import React, { useCallback, useEffect, useRef, useState, memo } from "react";
import {
    View,
    Text,
    TouchableOpacity,
    ActivityIndicator,
    Platform,
    ScrollView,
} from "react-native";
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withRepeat,
    withTiming,
    withSequence,
    cancelAnimation,
    Easing,
    FadeIn,
    FadeOut,
    Layout,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { useKeepAwake } from "expo-keep-awake";
import * as Haptics from "expo-haptics";
import {
    HMSSDK,
    HMSConfig,
    HMSUpdateListenerActions,
    HMSTrackType,
    HMSTrackUpdate,
    HMSPeerUpdate,
    HMSAudioTrackSettings,
    HMSTrackSettings,
    HMSIOSAudioMode,
    HMSNoiseCancellationPlugin,
    HMSNoiseCancellationModels,
    HMSNoiseCancellationInitialState,
} from "@100mslive/react-native-hms";
import { Ionicons } from "@expo/vector-icons";
import { requestCameraPermissionsAsync } from "expo-image-picker";
import { requestRecordingPermissionsAsync } from "expo-audio";
import Logger from "../../utils/logger";
import { COLORS } from "../../constants/theme";

// Per-speaker gradient palette — deterministic by name hash
const PEER_GRADIENT_PALETTE = [
    ["#667eea", "#764ba2"],  // purple
    ["#f093fb", "#f5576c"],  // pink
    ["#4facfe", "#00f2fe"],  // blue-cyan
    ["#43e97b", "#38f9d7"],  // green-mint
    ["#fa709a", "#fee140"],  // coral-yellow
    ["#30cfd0", "#330867"],  // teal-deep
    ["#ff9a9e", "#fecfef"],  // rose
];

const getPeerColorIndex = (peerName) => {
    let hash = 0;
    const name = peerName || "Guest";
    for (let i = 0; i < name.length; i++) {
        hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
    }
    return Math.abs(hash) % PEER_GRADIENT_PALETTE.length;
};

const getPeerGradient = (peerName) => PEER_GRADIENT_PALETTE[getPeerColorIndex(peerName)];
const getPeerAccentColor = (peerName) => PEER_GRADIENT_PALETTE[getPeerColorIndex(peerName)][0];

// Animated camera-off avatar with per-peer gradient and gentle pulse
const CameraOffAvatar = memo(({ initials, peerName, size = "small" }) => {
    const gradient = getPeerGradient(peerName);
    const scale = useSharedValue(1);

    useEffect(() => {
        scale.value = withRepeat(
            withSequence(
                withTiming(1.05, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
                withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
            ),
            -1,
            false,
        );
        return () => {
            cancelAnimation(scale);
        };
    }, [scale]);

    const pulseStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
    }));

    const circleSize = size === "large" ? 90 : 64;
    const fontSize = size === "large" ? 34 : 24;

    return (
        <LinearGradient
            colors={[gradient[0] + "1A", gradient[1] + "1A"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
        >
            <Animated.View style={pulseStyle}>
                <LinearGradient
                    colors={gradient}
                    start={{ x: 0.2, y: 0 }}
                    end={{ x: 0.8, y: 1 }}
                    style={{
                        width: circleSize,
                        height: circleSize,
                        borderRadius: circleSize / 2,
                        alignItems: "center",
                        justifyContent: "center",
                        shadowColor: gradient[0],
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.45,
                        shadowRadius: 12,
                        elevation: 6,
                    }}
                >
                    <Text
                        style={{
                            color: "#fff",
                            fontSize,
                            fontWeight: "700",
                            letterSpacing: 1,
                            textShadowColor: "rgba(0,0,0,0.3)",
                            textShadowOffset: { width: 0, height: 1 },
                            textShadowRadius: 3,
                        }}
                    >
                        {initials}
                    </Text>
                </LinearGradient>
            </Animated.View>
            <View style={{ position: "absolute", bottom: size === "large" ? 18 : 12, opacity: 0.35 }}>
                <Ionicons name="headset" size={size === "large" ? 20 : 16} color="#fff" />
            </View>
        </LinearGradient>
    );
});

// Floating emoji reaction that animates upward and fades out
const FloatingReaction = memo(({ emoji, startX }) => {
    const translateY = useSharedValue(0);
    const opacity = useSharedValue(1);

    useEffect(() => {
        translateY.value = withTiming(-200, { duration: 2000 });
        opacity.value = withTiming(0, { duration: 2000 });
        return () => {
            cancelAnimation(translateY);
            cancelAnimation(opacity);
        };
    }, [translateY, opacity]);

    const style = useAnimatedStyle(() => ({
        transform: [{ translateY: translateY.value }],
        opacity: opacity.value,
    }));

    return (
        <Animated.View style={[{ position: "absolute", bottom: 80, left: `${startX}%` }, style]}>
            <Text style={{ fontSize: 28 }}>{emoji}</Text>
        </Animated.View>
    );
});

const maskToken = (token) => {
    if (!token || typeof token !== "string") {
        return "missing";
    }

    if (token.length <= 10) {
        return "short-token";
    }

    return `${token.slice(0, 6)}...${token.slice(-4)}`;
};

const getPeerTrack = (peer, trackKey) => {
    if (!peer) {
        return null;
    }

    const trackAccessor = peer?.[trackKey];
    return typeof trackAccessor === "function" ? trackAccessor.call(peer) : trackAccessor;
};

const buildNode = (peer, track) => ({
    id: peer.peerID,
    peer,
    track,
});

const upsertNode = (nodes, peer, track) => {
    const exists = nodes.find((node) => node.id === peer.peerID);
    if (exists) {
        return nodes.map((node) =>
            node.id === peer.peerID
                ? { ...node, peer, track: track ?? node.track }
                : node
        );
    }

    return [...nodes, buildNode(peer, track)];
};

const removeNode = (nodes, peerId) => nodes.filter((node) => node.id !== peerId);

const buildPermissionError = ({ microphoneGranted, cameraGranted, enableVideo }) => {
    if (!microphoneGranted && enableVideo && !cameraGranted) {
        return {
            title: "Camera and microphone permissions needed",
            message: "Allow camera and microphone access, then retry joining the live session.",
        };
    }

    if (!microphoneGranted) {
        return {
            title: "Microphone permission needed",
            message: "Allow microphone access, then retry joining the live session.",
        };
    }

    return {
        title: "Camera permission needed",
        message: "Allow camera access, then retry joining the video session.",
    };
};

const getErrorDescription = (sourceError) => (
    sourceError?.description ||
    sourceError?.message ||
    sourceError?.reason ||
    sourceError?.error ||
    ""
);

const buildProviderError = (sourceError) => {
    const description = getErrorDescription(sourceError);
    const lowerDescription = description.toLowerCase();

    if (
        lowerDescription.includes("network") ||
        lowerDescription.includes("connection") ||
        lowerDescription.includes("offline") ||
        lowerDescription.includes("timed out") ||
        lowerDescription.includes("timeout")
    ) {
        return {
            title: "Connection problem",
            message: "The live room could not be reached. Check your connection or switch networks, then retry.",
        };
    }

    if (
        lowerDescription.includes("token") ||
        lowerDescription.includes("auth") ||
        lowerDescription.includes("unauthorized") ||
        lowerDescription.includes("expired")
    ) {
        return {
            title: "Session invite expired",
            message: "This live session invite is no longer valid. Ask the host for a fresh invite and try again.",
        };
    }

    return {
        title: "Live provider could not join",
        message: description || "The live session provider rejected the join request. Retry, or ask the host to restart the room if it keeps happening.",
    };
};

const buildTimeoutError = () => ({
    title: "Connection timed out",
    message: "The room did not answer in time. Check your connection or switch networks, then retry.",
});

const getErrorTitle = (error) => (typeof error === "string" ? null : error?.title);
const getErrorMessage = (error) => (typeof error === "string" ? error : error?.message);

const formatDuration = (totalSeconds) => {
    const safe = Math.max(0, Math.floor(totalSeconds || 0));
    const mm = String(Math.floor(safe / 60)).padStart(2, "0");
    const ss = String(safe % 60).padStart(2, "0");
    return `${mm}:${ss}`;
};

// A peer counts as "speaking" once its 100ms audio level (0–100) clears this
// floor; below it we treat the channel as silent to avoid flickering on noise.
const SPEAKING_LEVEL_THRESHOLD = 10;

const SUCCESS_COLOR = COLORS.success || "#4CAF50";

// 100ms downlinkQuality: 0 (worst) → 5 (best); -1/undefined = still measuring.
const getNetworkColor = (quality) => {
    if (typeof quality !== "number" || quality < 0) return COLORS.text.muted;
    if (quality <= 1) return COLORS.error;
    if (quality <= 3) return COLORS.warning;
    return SUCCESS_COLOR;
};

const SignalBars = ({ quality }) => {
    const color = getNetworkColor(quality);
    const filled = typeof quality === "number" && quality >= 0
        ? Math.max(0, Math.ceil((quality / 5) * 3))
        : 0;
    return (
        <View style={{ flexDirection: "row", alignItems: "flex-end" }}>
            {[0, 1, 2].map((i) => (
                <View
                    key={i}
                    style={{
                        width: 3,
                        height: 5 + i * 3,
                        marginLeft: i === 0 ? 0 : 2,
                        borderRadius: 1,
                        backgroundColor: i < filled ? color : "rgba(255,255,255,0.22)",
                    }}
                />
            ))}
        </View>
    );
};

const getPeerAudioMuted = (peer) => {
    const audioTrack = peer?.isLocal
        ? getPeerTrack(peer, "localAudioTrack")
        : getPeerTrack(peer, "audioTrack");
    return audioTrack?.isMute?.() ?? false;
};

const HmsRoom = ({
    token,
    userName,
    roomName,
    enableVideo,
    startAudioMuted = false,
    startVideoMuted = false,
    onJoin,
    onLeave,
    onClose,
    onError: onErrorCallback,
}) => {
    const [loading, setLoading] = useState(true);
    const [peerNodes, setPeerNodes] = useState([]);
    const [error, setError] = useState(null);
    const [isAudioMuted, setIsAudioMuted] = useState(false);
    const [isVideoMuted, setIsVideoMuted] = useState(false);
    const [isReconnecting, setIsReconnecting] = useState(false);
    const [joinAttempt, setJoinAttempt] = useState(0);
    const [joined, setJoined] = useState(false);
    const [elapsedSeconds, setElapsedSeconds] = useState(0);
    // peerID → audio level (0–100), only present for currently-speaking peers.
    const [audioLevels, setAudioLevels] = useState({});
    // peerID → 100ms downlinkQuality (0–5).
    const [networkQualities, setNetworkQualities] = useState({});
    // Latest live caption from ON_TRANSCRIPTS: { name, text } | null.
    const [caption, setCaption] = useState(null);
    const [noiseCancellationAvailable, setNoiseCancellationAvailable] = useState(false);
    const [noiseCancellationEnabled, setNoiseCancellationEnabled] = useState(false);
    const [qualityWarning, setQualityWarning] = useState(null);
    const [reactions, setReactions] = useState([]);

    // Keep screen awake during live session
    useKeepAwake();

    const hmsInstanceRef = useRef(null);
    const localPeerRef = useRef(null);
    const hasLeftRef = useRef(false);
    const cancelJoinRef = useRef(false);
    const isClosingRef = useRef(false);
    const sessionStartRef = useRef(null);
    const participantCountRef = useRef(1);
    const joinTimeoutRef = useRef(null);
    const onJoinRef = useRef(onJoin);
    const onLeaveRef = useRef(onLeave);
    const onErrorRef = useRef(onErrorCallback);
    const captionTimeoutRef = useRef(null);
    const sessionRef = useRef(`rtc-${Date.now().toString(36)}`);
    const noiseCancellationRef = useRef(null);
    const qualityWarningTimeoutRef = useRef(null);

    const HmsView = hmsInstanceRef.current?.HmsView;

    useEffect(() => {
        onJoinRef.current = onJoin;
    }, [onJoin]);

    useEffect(() => {
        onLeaveRef.current = onLeave;
    }, [onLeave]);

    useEffect(() => {
        onErrorRef.current = onErrorCallback;
    }, [onErrorCallback]);

    useEffect(() => {
        participantCountRef.current = peerNodes.length || 1;
    }, [peerNodes.length]);

    const getLogContext = useCallback(() => ({
        componentSession: sessionRef.current,
        roomName: roomName || "unknown-room",
        userName: userName || "Host",
        enableVideo,
        peerCount: participantCountRef.current,
    }), [enableVideo, roomName, userName]);

    const requestPermissions = useCallback(async () => {
        const micStatus = await requestRecordingPermissionsAsync();
        const cameraStatus = enableVideo
            ? await requestCameraPermissionsAsync()
            : { status: "granted" };

        const microphoneGranted = micStatus?.status === "granted";
        const cameraGranted = cameraStatus?.status === "granted";

        Logger.info("[RTC] Permission check completed", {
            ...getLogContext(),
            microphone: micStatus?.status || "unknown",
            camera: cameraStatus?.status || "unknown",
        });

        return {
            granted: microphoneGranted && cameraGranted,
            microphoneGranted,
            cameraGranted,
        };
    }, [enableVideo, getLogContext]);

    const handleJoinSuccess = useCallback((data) => {
        if (cancelJoinRef.current || isClosingRef.current || hasLeftRef.current) {
            Logger.warn("[RTC] Join success ignored after close request", getLogContext());
            return;
        }

        if (joinTimeoutRef.current) {
            clearTimeout(joinTimeoutRef.current);
            joinTimeoutRef.current = null;
        }

        const localPeer = data?.room?.localPeer || data?.localPeer;
        const startedAt = Date.now();
        sessionStartRef.current = startedAt;
        setJoined(true);

        Logger.info("[RTC] Join event received", {
            ...getLogContext(),
            hasLocalPeer: Boolean(localPeer),
            eventKeys: data ? Object.keys(data) : [],
        });

        if (!localPeer) {
            setLoading(false);
            onJoinRef.current && onJoinRef.current();
            return;
        }

        localPeerRef.current = localPeer;
        setPeerNodes((prev) => upsertNode(prev, localPeer, localPeer.videoTrack));

        const localAudioTrack = getPeerTrack(localPeer, "localAudioTrack");
        const localVideoTrack = getPeerTrack(localPeer, "localVideoTrack");

        let nextAudioMuted = localAudioTrack?.isMute?.() ?? false;
        let nextVideoMuted = localVideoTrack?.isMute?.() ?? false;

        if (localAudioTrack && startAudioMuted !== nextAudioMuted) {
            localAudioTrack.setMute(startAudioMuted);
            nextAudioMuted = startAudioMuted;
        }

        if (enableVideo && localVideoTrack && startVideoMuted !== nextVideoMuted) {
            localVideoTrack.setMute(startVideoMuted);
            nextVideoMuted = startVideoMuted;
        }

        setIsAudioMuted(nextAudioMuted);
        setIsVideoMuted(nextVideoMuted);
        setLoading(false);

        Logger.info("[RTC] Join success applied", {
            ...getLogContext(),
            localPeerId: localPeer?.peerID,
            audioMuted: nextAudioMuted,
            videoMuted: nextVideoMuted,
        });

        onJoinRef.current && onJoinRef.current({ peerId: localPeer?.peerID });
    }, [enableVideo, getLogContext, startAudioMuted, startVideoMuted]);

    const handlePeerUpdate = useCallback(({ peer, type }) => {
        if (!peer) {
            return;
        }

        Logger.debug("[RTC] Peer update", {
            ...getLogContext(),
            type,
            peerId: peer?.peerID,
            peerName: peer?.name,
        });

        if (type === HMSPeerUpdate.PEER_LEFT) {
            setPeerNodes((prev) => removeNode(prev, peer.peerID));
            setNetworkQualities((prev) => {
                if (!(peer.peerID in prev)) return prev;
                const next = { ...prev };
                delete next[peer.peerID];
                return next;
            });
            return;
        }

        const downlink = peer?.networkQuality?.downlinkQuality;
        if (typeof downlink === "number") {
            setNetworkQualities((prev) =>
                prev[peer.peerID] === downlink
                    ? prev
                    : { ...prev, [peer.peerID]: downlink }
            );
        }

        setPeerNodes((prev) => upsertNode(prev, peer));
    }, [getLogContext]);

    const handleSpeakerUpdate = useCallback((speakers) => {
        const levels = {};
        (Array.isArray(speakers) ? speakers : []).forEach((speaker) => {
            const peerId = speaker?.peer?.peerID;
            if (peerId) {
                levels[peerId] = typeof speaker.level === "number" ? speaker.level : 0;
            }
        });
        setAudioLevels(levels);
    }, []);

    const handleTranscripts = useCallback((data) => {
        const items = data?.transcripts || [];
        if (!items.length) {
            return;
        }
        const latest = items[items.length - 1];
        const text = (latest?.transcript || "").trim();
        if (!text) {
            return;
        }
        setCaption({ name: latest?.peer?.name || "Speaker", text });

        // Fade the caption out after a pause in speech; live updates keep it fresh.
        if (captionTimeoutRef.current) {
            clearTimeout(captionTimeoutRef.current);
        }
        captionTimeoutRef.current = setTimeout(() => setCaption(null), 5000);
    }, []);

    const handleTrackUpdate = useCallback(({ peer, track, type }) => {
        if (!peer || !track || track.type !== HMSTrackType.VIDEO) {
            return;
        }

        Logger.debug("[RTC] Track update", {
            ...getLogContext(),
            type,
            peerId: peer?.peerID,
            trackId: track?.trackId,
            trackType: track?.type,
        });

        if (type === HMSTrackUpdate.TRACK_REMOVED) {
            setPeerNodes((prev) =>
                prev.map((node) =>
                    node.id === peer.peerID ? { ...node, track: undefined } : node
                )
            );
            return;
        }

        setPeerNodes((prev) => upsertNode(prev, peer, track));
    }, [getLogContext]);

    const handleError = useCallback((hmsError) => {
        if (joinTimeoutRef.current) {
            clearTimeout(joinTimeoutRef.current);
            joinTimeoutRef.current = null;
        }

        if (cancelJoinRef.current || isClosingRef.current || hasLeftRef.current) {
            Logger.warn("[RTC] HMS error ignored after close request", {
                ...getLogContext(),
                rawError: hmsError,
            });
            return;
        }

        Logger.error("HMS error:", hmsError);
        const nextError = sessionStartRef.current
            ? {
                  title: "Live session issue",
                  message: getErrorDescription(hmsError) || "The live session hit a provider error.",
              }
            : buildProviderError(hmsError);
        setError(nextError);
        setLoading(false);
        Logger.error("[RTC] HMS runtime error", {
            ...getLogContext(),
            errorMsg: nextError.message,
            rawError: hmsError,
        });
        onErrorRef.current && onErrorRef.current(nextError.message);
    }, [getLogContext]);

    const handleReconnecting = useCallback(() => {
        setIsReconnecting(true);
        Logger.warn("[RTC] Connection lost, attempting to reconnect...", getLogContext());
    }, [getLogContext]);

    const handleReconnected = useCallback(() => {
        setIsReconnecting(false);
        Logger.info("[RTC] Reconnected successfully", getLogContext());
    }, [getLogContext]);

    const teardownHmsInstance = useCallback(async (hmsInstance, reason) => {
        if (!hmsInstance) {
            return;
        }

        try {
            hmsInstance.removeAllListeners();
            await hmsInstance.leave();
            await hmsInstance.destroy();
            Logger.info("[RTC] HMS instance torn down", {
                ...getLogContext(),
                reason,
            });
        } catch (teardownError) {
            Logger.error("[RTC] HMS teardown failed:", teardownError);
        } finally {
            if (hmsInstanceRef.current === hmsInstance) {
                hmsInstanceRef.current = null;
            }
        }
    }, [getLogContext]);

    const leaveRoom = useCallback(async () => {
        if (hasLeftRef.current) {
            Logger.debug("[RTC] leaveRoom ignored: already left", getLogContext());
            return;
        }
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

        hasLeftRef.current = true;
        setJoined(false);

        Logger.info("[RTC] leaveRoom started", {
            ...getLogContext(),
            sessionStarted: Boolean(sessionStartRef.current),
        });

        try {
            if (joinTimeoutRef.current) {
                clearTimeout(joinTimeoutRef.current);
                joinTimeoutRef.current = null;
            }

            const hmsInstance = hmsInstanceRef.current;
            if (!hmsInstance) {
                Logger.warn("[RTC] leaveRoom without hmsInstance", getLogContext());
                return;
            }

            await teardownHmsInstance(hmsInstance, "leave-room");
            Logger.info("[RTC] leaveRoom completed", getLogContext());
        } catch (leaveError) {
            Logger.error("Leave room failed:", leaveError);
        } finally {
            // Cleanup refs
            noiseCancellationRef.current = null;
            setNoiseCancellationAvailable(false);
            if (qualityWarningTimeoutRef.current) {
                clearTimeout(qualityWarningTimeoutRef.current);
                qualityWarningTimeoutRef.current = null;
            }
            setReactions([]);

            // Only call onLeave if session actually started
            if (sessionStartRef.current) {
                const durationSeconds = Math.floor((Date.now() - sessionStartRef.current) / 1000);
                onLeaveRef.current && onLeaveRef.current({
                    durationSeconds,
                    participantCount: participantCountRef.current,
                });
                Logger.info("[RTC] onLeave callback dispatched", {
                    ...getLogContext(),
                    durationSeconds,
                    participantCount: participantCountRef.current,
                });
            } else {
                Logger.warn("Session ended before joining completed");
            }
        }
    }, [getLogContext, teardownHmsInstance]);

    const handleClose = useCallback(async () => {
        if (isClosingRef.current) {
            Logger.debug("[RTC] close ignored: already closing", getLogContext());
            return;
        }

        cancelJoinRef.current = true;
        isClosingRef.current = true;

        Logger.info("[RTC] close requested", {
            ...getLogContext(),
            hasSessionStart: Boolean(sessionStartRef.current),
        });

        await leaveRoom();

        if (onClose) {
            onClose();
            return;
        }

        setIsReconnecting(false);
        setPeerNodes([]);
        setLoading(false);
        setError("Live session closed.");
        isClosingRef.current = false;
    }, [getLogContext, leaveRoom, onClose]);

    useEffect(() => {
        let isMounted = true;
        cancelJoinRef.current = false;
        isClosingRef.current = false;
        hasLeftRef.current = false;

        const shouldAbortJoin = () => (
            !isMounted ||
            cancelJoinRef.current ||
            isClosingRef.current ||
            hasLeftRef.current
        );

        const abortJoinIfNeeded = async (reason, hmsInstance) => {
            if (!shouldAbortJoin()) {
                return false;
            }

            Logger.info("[RTC] joinRoom aborted", {
                ...getLogContext(),
                reason,
            });

            if (hmsInstance) {
                await teardownHmsInstance(hmsInstance, reason);
            }

            return true;
        };

        const joinRoom = async () => {
            try {
                setLoading(true);
                setError(null);
                setIsReconnecting(false);
                setPeerNodes([]);
                setJoined(false);
                setElapsedSeconds(0);
                setAudioLevels({});
                setNetworkQualities({});
                setCaption(null);
                localPeerRef.current = null;
                sessionStartRef.current = null;
                participantCountRef.current = 1;
                Logger.info("[RTC] joinRoom started", {
                    ...getLogContext(),
                    tokenPreview: maskToken(token),
                    joinAttempt,
                });
                const permissionState = await requestPermissions();

                if (await abortJoinIfNeeded("after-permissions")) {
                    return;
                }

                if (!permissionState.granted) {
                    const permissionError = buildPermissionError({
                        ...permissionState,
                        enableVideo,
                    });
                    setError(permissionError);
                    setLoading(false);
                    onErrorRef.current && onErrorRef.current(permissionError.message);
                    Logger.warn("[RTC] joinRoom blocked: permissions not granted", {
                        ...getLogContext(),
                        microphoneGranted: permissionState.microphoneGranted,
                        cameraGranted: permissionState.cameraGranted,
                    });
                    return;
                }

                const audioTrackSettings = new HMSAudioTrackSettings({
                    audioMode: Platform.OS === "ios" ? HMSIOSAudioMode.MUSIC : undefined,
                    useHardwareEchoCancellation: Platform.OS === "android" ? true : undefined,
                });
                const trackSettings = new HMSTrackSettings({ audio: audioTrackSettings });
                const hmsInstance = await HMSSDK.build({ trackSettings });

                if (await abortJoinIfNeeded("after-build", hmsInstance)) {
                    return;
                }

                hmsInstanceRef.current = hmsInstance;

                Logger.debug("[RTC] HMSSDK instance built", {
                    ...getLogContext(),
                    hasHmsView: Boolean(hmsInstance?.HmsView),
                });

                joinTimeoutRef.current = setTimeout(() => {
                    if (shouldAbortJoin()) {
                        return;
                    }

                    const timeoutError = buildTimeoutError();
                    const timedOutHmsInstance = hmsInstanceRef.current;
                    cancelJoinRef.current = true;
                    joinTimeoutRef.current = null;
                    setError(timeoutError);
                    setLoading(false);
                    onErrorRef.current && onErrorRef.current(timeoutError.message);
                    Logger.warn("[RTC] joinRoom timeout", getLogContext());

                    teardownHmsInstance(timedOutHmsInstance, "join-timeout");
                }, 15000);

                hmsInstance.addEventListener(
                    HMSUpdateListenerActions.ON_JOIN,
                    handleJoinSuccess
                );
                hmsInstance.addEventListener(
                    HMSUpdateListenerActions.ON_PEER_UPDATE,
                    handlePeerUpdate
                );
                hmsInstance.addEventListener(
                    HMSUpdateListenerActions.ON_TRACK_UPDATE,
                    handleTrackUpdate
                );
                hmsInstance.addEventListener(
                    HMSUpdateListenerActions.ON_SPEAKER,
                    handleSpeakerUpdate
                );
                if (HMSUpdateListenerActions.ON_TRANSCRIPTS) {
                    hmsInstance.addEventListener(
                        HMSUpdateListenerActions.ON_TRANSCRIPTS,
                        handleTranscripts
                    );
                }
                hmsInstance.addEventListener(
                    HMSUpdateListenerActions.ON_ERROR,
                    handleError
                );
                if (!HMSUpdateListenerActions.RECONNECTING || !HMSUpdateListenerActions.RECONNECTED) {
                    Logger.warn("[RTC] HMS SDK does not expose reconnect events; reconnect banner will not appear", getLogContext());
                }
                if (HMSUpdateListenerActions.RECONNECTING) {
                    hmsInstance.addEventListener(
                        HMSUpdateListenerActions.RECONNECTING,
                        handleReconnecting
                    );
                }
                if (HMSUpdateListenerActions.RECONNECTED) {
                    hmsInstance.addEventListener(
                        HMSUpdateListenerActions.RECONNECTED,
                        handleReconnected
                    );
                }

                const config = new HMSConfig({
                    authToken: token,
                    username: userName || "Host",
                });

                Logger.debug("[RTC] HMS listeners registered, attempting join", getLogContext());

                await hmsInstance.join(config);

                if (await abortJoinIfNeeded(
                    "after-join-resolved",
                    hmsInstanceRef.current === hmsInstance ? hmsInstance : null
                )) {
                    return;
                }

                Logger.debug("[RTC] hmsInstance.join promise resolved", getLogContext());

                // Initialize noise cancellation plugin after successful join
                try {
                    const ncPlugin = new HMSNoiseCancellationPlugin({
                        modelName: HMSNoiseCancellationModels.SmallFullBand,
                        initialState: HMSNoiseCancellationInitialState.Disabled,
                    });
                    const ncAvailable = await ncPlugin.isNoiseCancellationAvailable();
                    if (ncAvailable) {
                        noiseCancellationRef.current = ncPlugin;
                        setNoiseCancellationAvailable(true);
                        Logger.debug("[RTC] Noise cancellation available", getLogContext());
                    }
                } catch (ncError) {
                    Logger.debug("[RTC] Noise cancellation not available", { ...getLogContext(), reason: ncError?.message });
                }
            } catch (joinError) {
                if (joinTimeoutRef.current) {
                    clearTimeout(joinTimeoutRef.current);
                    joinTimeoutRef.current = null;
                }

                if (shouldAbortJoin()) {
                    Logger.warn("[RTC] joinRoom error ignored after close request", {
                        ...getLogContext(),
                        rawError: joinError,
                    });
                    return;
                }

                Logger.error("Join room failed:", joinError);
                if (isMounted) {
                    const nextError = buildProviderError(joinError);
                    setError(nextError);
                    setLoading(false);
                    onErrorRef.current && onErrorRef.current(nextError.message);
                }
            }
        };

        joinRoom();

        return () => {
            isMounted = false;
            if (captionTimeoutRef.current) {
                clearTimeout(captionTimeoutRef.current);
                captionTimeoutRef.current = null;
            }
            Logger.debug("[RTC] HmsRoom cleanup triggered", getLogContext());
            leaveRoom();
        };
    }, [
        joinAttempt,
        token,
        userName,
        requestPermissions,
        handleJoinSuccess,
        handlePeerUpdate,
        handleTrackUpdate,
        handleSpeakerUpdate,
        handleTranscripts,
        handleError,
        handleReconnecting,
        handleReconnected,
        enableVideo,
        leaveRoom,
        teardownHmsInstance,
    ]);

    // Tick a session timer once joined so the live header can show elapsed
    // recording time (recording auto-starts on room join per the 100ms template).
    useEffect(() => {
        if (!joined) {
            return undefined;
        }
        const interval = setInterval(() => {
            if (sessionStartRef.current) {
                setElapsedSeconds(Math.floor((Date.now() - sessionStartRef.current) / 1000));
            }
        }, 1000);
        return () => clearInterval(interval);
    }, [joined]);

    const toggleAudio = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        const localAudioTrack = getPeerTrack(localPeerRef.current, "localAudioTrack");
        if (!localAudioTrack) {
            Logger.warn("[RTC] toggleAudio ignored: missing local audio track", getLogContext());
            return;
        }

        const nextMuted = !isAudioMuted;
        localAudioTrack.setMute(nextMuted);
        setIsAudioMuted(nextMuted);
        Logger.debug("[RTC] Audio mute toggled", {
            ...getLogContext(),
            isAudioMuted: nextMuted,
        });
    };

    const toggleVideo = () => {
        if (!enableVideo) {
            return;
        }
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        const localVideoTrack = getPeerTrack(localPeerRef.current, "localVideoTrack");
        if (!localVideoTrack) {
            Logger.warn("[RTC] toggleVideo ignored: missing local video track", getLogContext());
            return;
        }

        const nextMuted = !isVideoMuted;
        localVideoTrack.setMute(nextMuted);
        setIsVideoMuted(nextMuted);
        Logger.debug("[RTC] Video mute toggled", {
            ...getLogContext(),
            isVideoMuted: nextMuted,
        });
    };

    const switchCamera = () => {
        if (!enableVideo) {
            return;
        }
        Haptics.selectionAsync();

        const localVideoTrack = getPeerTrack(localPeerRef.current, "localVideoTrack");
        if (!localVideoTrack) {
            Logger.warn("[RTC] switchCamera ignored: missing local video track", getLogContext());
            return;
        }

        localVideoTrack.switchCamera();
        Logger.debug("[RTC] Camera switched", getLogContext());
    };

    const renderPeerOverlays = (peer, track, level, quality) => {
        const isSpeaking = level > SPEAKING_LEVEL_THRESHOLD;
        const audioMuted = getPeerAudioMuted(peer);
        const accentColor = getPeerAccentColor(peer?.name);

        return (
            <>
                {/* Audio level bar — bottom edge */}
                <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 3, backgroundColor: "rgba(255,255,255,0.08)" }}>
                    <View style={{ height: 3, width: `${Math.min(100, level)}%`, backgroundColor: isSpeaking ? accentColor : "transparent" }} />
                </View>

                {/* Network quality — top right */}
                <View style={{ position: "absolute", top: 8, right: 8, backgroundColor: "rgba(0,0,0,0.45)", borderRadius: 6, paddingHorizontal: 5, paddingVertical: 4 }}>
                    <SignalBars quality={quality} />
                </View>

                {/* Muted mic — top left */}
                {audioMuted && (
                    <View style={{ position: "absolute", top: 8, left: 8, backgroundColor: "rgba(0,0,0,0.5)", borderRadius: 12, padding: 5 }}>
                        <Ionicons name="mic-off" size={13} color={COLORS.error} />
                    </View>
                )}

                {/* Name + You badge — bottom left overlay */}
                <View style={{ position: "absolute", bottom: 10, left: 8, flexDirection: "row", alignItems: "center" }}>
                    <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: "rgba(0,0,0,0.5)", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 }}>
                        <Ionicons
                            name={audioMuted ? "mic-off" : "mic"}
                            size={12}
                            color={audioMuted ? COLORS.error : isSpeaking ? accentColor : "rgba(255,255,255,0.7)"}
                        />
                        <Text style={{ color: "#fff", fontWeight: "600", fontSize: 13, marginLeft: 4 }} numberOfLines={1}>
                            {peer?.name || "Guest"}
                        </Text>
                        {peer?.isLocal && (
                            <Text style={{ color: COLORS.primary, fontSize: 11, marginLeft: 4 }}>· You</Text>
                        )}
                    </View>
                </View>
            </>
        );
    };

    // Single peer: video fills the full card height
    const renderSinglePeerFull = (node) => {
        const { peer, track } = node;
        const peerId = peer?.peerID;
        const level = audioLevels[peerId] || 0;
        const quality = networkQualities[peerId];
        const showVideo = enableVideo && HmsView && track?.trackId && !track.isMute?.();
        const initials = peer?.name ? peer.name.split(" ").map((p) => p[0]).join("") : "P";

        return (
            <View style={{ flex: 1, overflow: "hidden" }}>
                {showVideo ? (
                    <HmsView
                        trackId={track.trackId}
                        mirror={peer?.isLocal}
                        style={{ width: "100%", height: "100%" }}
                    />
                ) : (
                    <CameraOffAvatar initials={initials} peerName={peer?.name} size="large" />
                )}
                {renderPeerOverlays(peer, track, level, quality)}
            </View>
        );
    };

    const toggleNoiseCancellation = async () => {
        const nc = noiseCancellationRef.current;
        if (!nc) return;
        try {
            const isOn = await nc.isEnabled();
            if (isOn) { await nc.disable(); } else { await nc.enable(); }
            setNoiseCancellationEnabled(!isOn);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        } catch (e) {
            Logger.warn("[RTC] Noise cancellation toggle failed", { ...getLogContext(), error: e?.message });
        }
    };

    const sendReaction = (emoji) => {
        const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const startX = Math.random() * 60 + 20;
        setReactions((prev) => [...prev, { id, emoji, startX }]);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setTimeout(() => {
            setReactions((prev) => prev.filter((r) => r.id !== id));
        }, 2200);
    };

    // Proactive connection quality warning for local peer
    useEffect(() => {
        const localPeerId = localPeerRef.current?.peerID;
        if (!localPeerId) return;
        const localQuality = networkQualities[localPeerId];
        if (typeof localQuality !== "number") return;

        if (localQuality <= 1) {
            setQualityWarning({ message: "Poor connection — audio may drop", severity: "error" });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        } else if (localQuality <= 2) {
            setQualityWarning({ message: "Weak connection", severity: "warning" });
        } else {
            setQualityWarning(null);
            return;
        }

        if (qualityWarningTimeoutRef.current) clearTimeout(qualityWarningTimeoutRef.current);
        qualityWarningTimeoutRef.current = setTimeout(() => setQualityWarning(null), 5000);
    }, [networkQualities]);

    // Multi-peer grid tile (portrait 3:4)

    const renderTile = ({ item }) => {
        const { peer, track } = item;
        const peerId = peer?.peerID;
        const level = audioLevels[peerId] || 0;
        const isSpeaking = level > SPEAKING_LEVEL_THRESHOLD;
        const quality = networkQualities[peerId];
        const showVideo = enableVideo && HmsView && track?.trackId && !track.isMute?.();
        const initials = peer?.name?.trim()
            ? peer.name.trim().split(" ").filter(Boolean).map((part) => part[0]).join("").slice(0, 2)
            : "P";

        return (
            <View style={{ width: "50%", padding: 3 }}>
                <View
                    style={{
                        borderWidth: 2,
                        borderColor: isSpeaking ? getPeerAccentColor(peer?.name) : "transparent",
                        borderRadius: 16,
                        overflow: "hidden",
                        aspectRatio: 3 / 4,
                        backgroundColor: "rgba(0,0,0,0.4)",
                        shadowColor: isSpeaking ? getPeerAccentColor(peer?.name) : "transparent",
                        shadowOffset: { width: 0, height: 0 },
                        shadowOpacity: isSpeaking ? 0.5 : 0,
                        shadowRadius: isSpeaking ? 10 : 0,
                        elevation: isSpeaking ? 4 : 0,
                    }}
                >
                    {showVideo ? (
                        <HmsView
                            trackId={track.trackId}
                            mirror={peer?.isLocal}
                            style={{ width: "100%", height: "100%" }}
                        />
                    ) : (
                        <CameraOffAvatar initials={initials} peerName={peer?.name} size="small" />
                    )}
                    {renderPeerOverlays(peer, track, level, quality)}
                </View>
            </View>
        );
    };

    if (loading) {
        return (
            <View className="flex-1 items-center justify-center">
                <ActivityIndicator color={COLORS.primary} size="large" />
                <Text className="text-text-secondary mt-4">
                    Joining live session...
                </Text>
                <TouchableOpacity
                    onPress={handleClose}
                    className="mt-5 border border-border px-4 py-3 rounded-lg"
                    accessibilityRole="button"
                    accessibilityLabel="Cancel joining live session"
                >
                    <Text className="text-text-primary font-semibold">Cancel</Text>
                </TouchableOpacity>
            </View>
        );
    }

    if (error) {
        const errorTitle = getErrorTitle(error);
        const errorMessage = getErrorMessage(error);

        return (
            <View className="flex-1 items-center justify-center">
                {errorTitle && (
                    <Text className="text-error text-center text-lg font-semibold mb-2">
                        {errorTitle}
                    </Text>
                )}
                <Text className="text-text-secondary text-center mb-4 px-4">
                    {errorMessage}
                </Text>
                <View className="flex-row items-center justify-center">
                    <TouchableOpacity
                        onPress={() => setJoinAttempt((currentAttempt) => currentAttempt + 1)}
                        className="bg-primary px-4 py-3 rounded-lg mr-3"
                    >
                        <Text className="text-white font-semibold">Retry</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={handleClose}
                        className="border border-border px-4 py-3 rounded-lg"
                    >
                        <Text className="text-text-primary font-semibold">Close</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    const singlePeerLevel = peerNodes.length === 1
        ? (audioLevels[peerNodes[0]?.id] || 0)
        : 0;
    const isSingleSpeaking = singlePeerLevel > SPEAKING_LEVEL_THRESHOLD;

    return (
        <View style={{ flex: 1 }}>
            {isReconnecting && (
                <View style={{ backgroundColor: COLORS.warning, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 8, paddingHorizontal: 16 }}>
                    <ActivityIndicator size="small" color={COLORS.text.primary} />
                    <Text style={{ color: COLORS.text.primary, fontWeight: "600", marginLeft: 8 }}>Reconnecting…</Text>
                </View>
            )}

            {/* Main video card — matches HmsPreview's bg-card rounded-2xl border aesthetic */}
            <View
                className="flex-1 rounded-2xl overflow-hidden"
                style={{
                    borderWidth: 2,
                    borderColor: isSingleSpeaking ? SUCCESS_COLOR : COLORS.border,
                    backgroundColor: COLORS.card,
                }}
            >
                {/* Card header: REC timer + room name */}
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 8 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: "rgba(239,68,68,0.15)", borderRadius: 100, paddingHorizontal: 12, paddingVertical: 6 }}>
                        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.error, marginRight: 6 }} />
                        <Text style={{ color: COLORS.error, fontWeight: "700", fontSize: 12, letterSpacing: 1 }}>REC</Text>
                        <Text style={{ color: COLORS.text.primary, fontWeight: "600", marginLeft: 8, fontVariant: ["tabular-nums"] }}>
                            {formatDuration(elapsedSeconds)}
                        </Text>
                    </View>
                    <View style={{ flexDirection: "row", alignItems: "center", flex: 1, justifyContent: "flex-end", marginLeft: 12 }}>
                        <Ionicons name="people" size={14} color={COLORS.text.muted} />
                        <Text style={{ color: COLORS.text.secondary, marginLeft: 4 }} numberOfLines={1}>
                            {roomName || "Live session"}
                        </Text>
                    </View>
                </View>

                {/* Video area */}
                {peerNodes.length === 0 ? (
                    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                        <Text style={{ color: COLORS.text.primary, fontSize: 18 }}>You are alone here.</Text>
                        <Text style={{ color: COLORS.text.secondary, marginTop: 8 }}>Share the room name to invite co-hosts.</Text>
                    </View>
                ) : peerNodes.length === 1 ? (
                    renderSinglePeerFull(peerNodes[0])
                ) : (
                    <ScrollView
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={{ flexDirection: "row", flexWrap: "wrap", padding: 3, paddingBottom: 8 }}
                    >
                        {peerNodes.map((item) => (
                            <Animated.View
                                key={item.id}
                                entering={FadeIn.duration(300)}
                                exiting={FadeOut.duration(200)}
                                layout={Layout.springify()}
                            >
                                {renderTile({ item })}
                            </Animated.View>
                        ))}
                    </ScrollView>
                )}

                {/* Live caption overlay */}
                {caption && (
                    <View style={{ position: "absolute", bottom: 8, left: 8, right: 8, backgroundColor: "rgba(0,0,0,0.7)", borderRadius: 12, paddingVertical: 8, paddingHorizontal: 12 }}>
                        <Text style={{ color: COLORS.primary, fontSize: 11, fontWeight: "700", marginBottom: 2 }}>{caption.name}</Text>
                        <Text style={{ color: "#fff", fontSize: 14 }} numberOfLines={2}>{caption.text}</Text>
                    </View>
                )}
            </View>

            {/* Floating emoji reactions layer */}
            <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, top: 0, pointerEvents: "none" }}>
                {reactions.map((r) => (
                    <FloatingReaction key={r.id} emoji={r.emoji} startX={r.startX} />
                ))}
            </View>

            {/* Connection quality warning toast */}
            {qualityWarning && (
                <View
                    style={{
                        backgroundColor: qualityWarning.severity === "error" ? "rgba(239,68,68,0.15)" : "rgba(245,158,11,0.15)",
                        borderRadius: 10,
                        paddingVertical: 8,
                        paddingHorizontal: 12,
                        marginBottom: 8,
                        flexDirection: "row",
                        alignItems: "center",
                    }}
                >
                    <Ionicons
                        name="warning"
                        size={16}
                        color={qualityWarning.severity === "error" ? COLORS.error : COLORS.warning}
                    />
                    <Text
                        style={{
                            color: qualityWarning.severity === "error" ? COLORS.error : COLORS.warning,
                            fontSize: 13,
                            fontWeight: "600",
                            marginLeft: 8,
                        }}
                    >
                        {qualityWarning.message}
                    </Text>
                </View>
            )}

            {/* Emoji reaction bar */}
            <View style={{ flexDirection: "row", justifyContent: "center", paddingVertical: 6 }}>
                {["\ud83d\udc4d", "\ud83d\udd25", "\u2764\ufe0f", "\ud83d\ude02", "\ud83d\udc4f"].map((emoji) => (
                    <TouchableOpacity
                        key={emoji}
                        onPress={() => sendReaction(emoji)}
                        style={{ marginHorizontal: 8, padding: 4 }}
                    >
                        <Text style={{ fontSize: 22 }}>{emoji}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* Controls — same style as HmsPreview (w-11 h-11, gap-16, bg-background) */}
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", marginTop: 12, gap: 16 }}>
                <TouchableOpacity
                    onPress={toggleAudio}
                    className="w-11 h-11 items-center justify-center rounded-full bg-background"
                    accessibilityRole="button"
                    accessibilityLabel={isAudioMuted ? "Unmute microphone" : "Mute microphone"}
                >
                    <Ionicons name={isAudioMuted ? "mic-off" : "mic"} size={20} color={isAudioMuted ? COLORS.error : COLORS.text.primary} />
                </TouchableOpacity>

                {enableVideo && (
                    <TouchableOpacity
                        onPress={toggleVideo}
                        className="w-11 h-11 items-center justify-center rounded-full bg-background"
                        accessibilityRole="button"
                        accessibilityLabel={isVideoMuted ? "Turn camera on" : "Turn camera off"}
                    >
                        <Ionicons name={isVideoMuted ? "videocam-off" : "videocam"} size={20} color={isVideoMuted ? COLORS.error : COLORS.text.primary} />
                    </TouchableOpacity>
                )}

                {enableVideo && (
                    <TouchableOpacity
                        onPress={switchCamera}
                        className="w-11 h-11 items-center justify-center rounded-full bg-background"
                        accessibilityRole="button"
                        accessibilityLabel="Switch camera"
                    >
                        <Ionicons name="camera-reverse" size={20} color={COLORS.text.primary} />
                    </TouchableOpacity>
                )}

                {noiseCancellationAvailable && (
                    <TouchableOpacity
                        onPress={toggleNoiseCancellation}
                        className="w-12 h-12 items-center justify-center rounded-full bg-background"
                    >
                        <Ionicons
                            name={noiseCancellationEnabled ? "ear" : "ear-outline"}
                            size={22}
                            color={noiseCancellationEnabled ? COLORS.primary : COLORS.text.primary}
                        />
                    </TouchableOpacity>
                )}

                <TouchableOpacity
                    onPress={leaveRoom}
                    className="w-11 h-11 items-center justify-center rounded-full"
                    style={{ backgroundColor: COLORS.error + "33" }}
                    accessibilityRole="button"
                    accessibilityLabel="Leave session"
                >
                    <Ionicons name="log-out" size={20} color={COLORS.error} />
                </TouchableOpacity>
            </View>
        </View>
    );
};

export default HmsRoom;
