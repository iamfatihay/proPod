/**
 * HmsPreview — "green room" preview before going live.
 *
 * Uses the 100ms preview API (ON_PREVIEW) to let a host test their camera and
 * microphone, see a live self-view, and pick their initial mic/camera state
 * BEFORE joining the room. The chosen mute state is reported up via
 * onMuteStateChange so the lobby's "go live" defaults stay in sync.
 *
 * Self-contained: it builds its own HMS instance for preview only and tears it
 * down on unmount, before the live HmsRoom builds its own instance to join.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator, Platform } from "react-native";
import {
    HMSSDK,
    HMSConfig,
    HMSUpdateListenerActions,
    HMSTrackType,
    HMSAudioTrackSettings,
    HMSTrackSettings,
    HMSIOSAudioMode,
} from "@100mslive/react-native-hms";
import { Ionicons } from "@expo/vector-icons";
import { requestCameraPermissionsAsync } from "expo-image-picker";
import { requestRecordingPermissionsAsync } from "expo-audio";
import Logger from "../../utils/logger";
import { COLORS } from "../../constants/theme";

const getTrack = (peer, key) => {
    if (!peer) return null;
    const accessor = peer?.[key];
    return typeof accessor === "function" ? accessor.call(peer) : accessor;
};

const HmsPreview = ({ token, userName, enableVideo, onMuteStateChange }) => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [videoTrackId, setVideoTrackId] = useState(null);
    const [isAudioMuted, setIsAudioMuted] = useState(false);
    const [isVideoMuted, setIsVideoMuted] = useState(false);
    const [audioLevel, setAudioLevel] = useState(0);

    const hmsRef = useRef(null);
    const localPeerRef = useRef(null);
    const closedRef = useRef(false);
    const onMuteStateChangeRef = useRef(onMuteStateChange);

    const HmsView = hmsRef.current?.HmsView;

    useEffect(() => {
        onMuteStateChangeRef.current = onMuteStateChange;
    }, [onMuteStateChange]);

    const handlePreview = useCallback((data) => {
        if (closedRef.current) return;
        const localPeer = data?.room?.localPeer || data?.localPeer;
        localPeerRef.current = localPeer;

        const previewTracks = data?.previewTracks || [];
        const videoTrack = previewTracks.find((t) => t?.type === HMSTrackType.VIDEO);
        if (videoTrack?.trackId) {
            setVideoTrackId(videoTrack.trackId);
        }

        const audioTrack = previewTracks.find((t) => t?.type === HMSTrackType.AUDIO)
            || getTrack(localPeer, "localAudioTrack");
        const localVideoTrack = videoTrack || getTrack(localPeer, "localVideoTrack");
        setIsAudioMuted(audioTrack?.isMute?.() ?? false);
        setIsVideoMuted(localVideoTrack?.isMute?.() ?? false);
        setLoading(false);
        Logger.info("[RTC] Preview ready", { hasVideo: Boolean(videoTrack?.trackId) });
    }, []);

    const handleSpeaker = useCallback((speakers) => {
        if (closedRef.current) return;
        const localId = localPeerRef.current?.peerID;
        const me = (Array.isArray(speakers) ? speakers : []).find(
            (s) => s?.peer?.peerID === localId
        );
        setAudioLevel(me ? (me.level || 0) : 0);
    }, []);

    const handleError = useCallback((hmsError) => {
        if (closedRef.current) return;
        Logger.error("[RTC] Preview error", hmsError);
        setError("Could not start camera/mic preview. You can still go live.");
        setLoading(false);
    }, []);

    useEffect(() => {
        closedRef.current = false;
        let cancelled = false;

        const startPreview = async () => {
            try {
                const micStatus = await requestRecordingPermissionsAsync();
                const cameraStatus = enableVideo
                    ? await requestCameraPermissionsAsync()
                    : { status: "granted" };
                if (micStatus?.status !== "granted" || cameraStatus?.status !== "granted") {
                    if (!cancelled) {
                        setError("Allow camera and microphone access to preview before going live.");
                        setLoading(false);
                    }
                    return;
                }

                const audioSettings = new HMSAudioTrackSettings({
                    audioMode: Platform.OS === "ios" ? HMSIOSAudioMode.MUSIC : undefined,
                    useHardwareEchoCancellation: Platform.OS === "android" ? true : undefined,
                });
                const trackSettings = new HMSTrackSettings({ audio: audioSettings });
                const hms = await HMSSDK.build({ trackSettings });
                if (cancelled || closedRef.current) {
                    hms.destroy?.();
                    return;
                }
                hmsRef.current = hms;

                hms.addEventListener(HMSUpdateListenerActions.ON_PREVIEW, handlePreview);
                hms.addEventListener(HMSUpdateListenerActions.ON_SPEAKER, handleSpeaker);
                hms.addEventListener(HMSUpdateListenerActions.ON_ERROR, handleError);

                const config = new HMSConfig({ authToken: token, username: userName || "Host" });
                await hms.preview(config);
            } catch (err) {
                if (!cancelled) handleError(err);
            }
        };

        startPreview();

        return () => {
            cancelled = true;
            closedRef.current = true;
            const hms = hmsRef.current;
            hmsRef.current = null;
            if (hms) {
                try {
                    hms.removeAllListeners();
                    hms.destroy();
                } catch (err) {
                    Logger.error("[RTC] Preview teardown failed", err);
                }
            }
        };
    }, [token, userName, enableVideo, handlePreview, handleSpeaker, handleError]);

    const toggleAudio = () => {
        const track = getTrack(localPeerRef.current, "localAudioTrack");
        if (!track) return;
        const next = !isAudioMuted;
        track.setMute(next);
        setIsAudioMuted(next);
        onMuteStateChangeRef.current?.({ audioMuted: next, videoMuted: isVideoMuted });
    };

    const toggleVideo = () => {
        if (!enableVideo) return;
        const track = getTrack(localPeerRef.current, "localVideoTrack");
        if (!track) return;
        const next = !isVideoMuted;
        track.setMute(next);
        setIsVideoMuted(next);
        onMuteStateChangeRef.current?.({ audioMuted: isAudioMuted, videoMuted: next });
    };

    const switchCamera = () => {
        if (!enableVideo) return;
        const track = getTrack(localPeerRef.current, "localVideoTrack");
        track?.switchCamera?.();
    };

    const showVideo = enableVideo && HmsView && videoTrackId && !isVideoMuted;
    const isSpeaking = audioLevel > 10;

    return (
        <View className="bg-card rounded-2xl p-4 mb-4 border border-border">
            <Text className="text-text-primary font-semibold mb-3">Mic & Camera Check</Text>

            <View
                className="overflow-hidden rounded-xl bg-black/40"
                style={{ aspectRatio: enableVideo ? 3 / 4 : 16 / 6, borderWidth: 2, borderColor: isSpeaking ? (COLORS.success || "#4CAF50") : "transparent" }}
            >
                {loading ? (
                    <View className="flex-1 items-center justify-center">
                        <ActivityIndicator color={COLORS.primary} />
                        <Text className="text-text-secondary mt-2 text-xs">Starting preview…</Text>
                    </View>
                ) : showVideo ? (
                    <HmsView trackId={videoTrackId} mirror style={{ width: "100%", height: "100%" }} />
                ) : (
                    <View className="flex-1 items-center justify-center">
                        <Ionicons
                            name={enableVideo ? "videocam-off" : "mic"}
                            size={28}
                            color={COLORS.text.muted}
                        />
                        <Text className="text-text-secondary mt-2 text-xs px-3 text-center">
                            {error || (enableVideo ? "Camera is off" : "Audio-only preview")}
                        </Text>
                    </View>
                )}

                {/* Live mic level bar */}
                <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 3, backgroundColor: "rgba(255,255,255,0.08)" }}>
                    <View style={{ height: 3, width: `${Math.min(100, audioLevel)}%`, backgroundColor: isSpeaking ? (COLORS.success || "#4CAF50") : "transparent" }} />
                </View>
            </View>

            <View className="flex-row items-center justify-center mt-3" style={{ gap: 16 }}>
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
            </View>
        </View>
    );
};

export default HmsPreview;
