import React, { useCallback, useEffect, useRef, useState } from "react";
import {
    View,
    Text,
    TouchableOpacity,
    FlatList,
    ActivityIndicator,
} from "react-native";
import {
    HMSSDK,
    HMSConfig,
    HMSUpdateListenerActions,
    HMSTrackType,
    HMSTrackUpdate,
    HMSPeerUpdate,
} from "@100mslive/react-native-hms";
import { Ionicons } from "@expo/vector-icons";
import { requestCameraPermissionsAsync } from "expo-image-picker";
import { requestRecordingPermissionsAsync } from "expo-audio";
import Logger from "../../utils/logger";
import { COLORS } from "../../constants/theme";

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
    const sessionRef = useRef(`rtc-${Date.now().toString(36)}`);

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

        onJoinRef.current && onJoinRef.current();
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
            return;
        }

        setPeerNodes((prev) => upsertNode(prev, peer));
    }, [getLogContext]);

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

        hasLeftRef.current = true;

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

                const hmsInstance = await HMSSDK.build();

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
                    HMSUpdateListenerActions.ON_ERROR,
                    handleError
                );
                if (!HMSUpdateListenerActions.ON_RECONNECTING || !HMSUpdateListenerActions.ON_RECONNECTED) {
                    Logger.warn("[RTC] HMS SDK does not expose reconnect events; reconnect banner will not appear", getLogContext());
                }
                if (HMSUpdateListenerActions.ON_RECONNECTING) {
                    hmsInstance.addEventListener(
                        HMSUpdateListenerActions.ON_RECONNECTING,
                        handleReconnecting
                    );
                }
                if (HMSUpdateListenerActions.ON_RECONNECTED) {
                    hmsInstance.addEventListener(
                        HMSUpdateListenerActions.ON_RECONNECTED,
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
        handleError,
        handleReconnecting,
        handleReconnected,
        enableVideo,
        leaveRoom,
        teardownHmsInstance,
    ]);

    const toggleAudio = () => {
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

        const localVideoTrack = getPeerTrack(localPeerRef.current, "localVideoTrack");
        if (!localVideoTrack) {
            Logger.warn("[RTC] switchCamera ignored: missing local video track", getLogContext());
            return;
        }

        localVideoTrack.switchCamera();
        Logger.debug("[RTC] Camera switched", getLogContext());
    };

    const renderTile = ({ item }) => {
        const { peer, track } = item;
        const initials = peer?.name
            ? peer.name
                  .split(" ")
                  .map((part) => part[0])
                  .join("")
            : "P";

        return (
            <View className="bg-panel rounded-2xl p-2 mb-3">
                <View className="overflow-hidden rounded-xl bg-black/30" style={{ height: 220 }}>
                    {enableVideo && HmsView && track?.trackId && !track.isMute?.() ? (
                        <HmsView
                            trackId={track.trackId}
                            mirror={peer?.isLocal}
                            style={{ width: "100%", height: "100%" }}
                        />
                    ) : (
                        <View className="flex-1 items-center justify-center">
                            <View className="w-20 h-20 rounded-full bg-primary/30 items-center justify-center">
                                <Text className="text-text-primary text-2xl font-bold">
                                    {initials}
                                </Text>
                            </View>
                        </View>
                    )}
                </View>
                <View className="mt-2 flex-row items-center justify-between">
                    <Text className="text-text-primary font-semibold">
                        {peer?.name || "Guest"}
                    </Text>
                    {peer?.isLocal && (
                        <View className="px-2 py-1 rounded-full bg-primary/20">
                            <Text className="text-primary text-xs">You</Text>
                        </View>
                    )}
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

    return (
        <View className="flex-1">
            {isReconnecting && (
                <View
                    style={{
                        backgroundColor: COLORS.warning,
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "center",
                        paddingVertical: 8,
                        paddingHorizontal: 16,
                    }}
                >
                    <ActivityIndicator size="small" color={COLORS.text.primary} />
                    <Text style={{ color: COLORS.text.primary, fontWeight: "600", marginLeft: 8 }}>
                        Reconnecting…
                    </Text>
                </View>
            )}
            <View className="mb-4">
                <Text className="text-text-secondary text-center">
                    Room: {roomName || "Live session"}
                </Text>
            </View>

            {peerNodes.length > 0 ? (
                <FlatList
                    data={peerNodes}
                    keyExtractor={(item) => item.id}
                    renderItem={renderTile}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingBottom: 120 }}
                />
            ) : (
                <View className="flex-1 items-center justify-center">
                    <Text className="text-text-primary text-lg">You are alone here.</Text>
                    <Text className="text-text-secondary mt-2">
                        Share the room name to invite co-hosts.
                    </Text>
                </View>
            )}

            <View className="flex-row items-center justify-around py-4 bg-panel rounded-2xl">
                <TouchableOpacity
                    onPress={toggleAudio}
                    className="w-12 h-12 items-center justify-center rounded-full bg-background"
                >
                    <Ionicons
                        name={isAudioMuted ? "mic-off" : "mic"}
                        size={22}
                        color={isAudioMuted ? COLORS.error : COLORS.text.primary}
                    />
                </TouchableOpacity>

                {enableVideo && (
                    <TouchableOpacity
                        onPress={toggleVideo}
                        className="w-12 h-12 items-center justify-center rounded-full bg-background"
                    >
                        <Ionicons
                            name={isVideoMuted ? "videocam-off" : "videocam"}
                            size={22}
                            color={isVideoMuted ? COLORS.error : COLORS.text.primary}
                        />
                    </TouchableOpacity>
                )}

                {enableVideo && (
                    <TouchableOpacity
                        onPress={switchCamera}
                        className="w-12 h-12 items-center justify-center rounded-full bg-background"
                    >
                        <Ionicons
                            name="camera-reverse"
                            size={22}
                            color={COLORS.text.primary}
                        />
                    </TouchableOpacity>
                )}

                <TouchableOpacity
                    onPress={leaveRoom}
                    className="w-12 h-12 items-center justify-center rounded-full bg-error/20"
                >
                    <Ionicons name="log-out" size={22} color={COLORS.error} />
                </TouchableOpacity>
            </View>
        </View>
    );
};

export default HmsRoom;
