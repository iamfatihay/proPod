import React, { useCallback, useEffect, useState } from "react";
import {
    SafeAreaView,
    View,
    Text,
    TouchableOpacity,
    TextInput,
    ActivityIndicator,
    ScrollView,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import HmsRoom from "../src/components/rtc/HmsRoom";
import apiService from "../src/services/api/apiService";
import { useToast } from "../src/components/Toast";
import { COLORS } from "../src/constants/theme";
import Logger from "../src/utils/logger";
import useAuthStore from "../src/context/useAuthStore";

const formatSessionDuration = (durationSeconds = 0) => {
    const safeDuration = Math.max(0, Number(durationSeconds) || 0);
    const minutes = Math.floor(safeDuration / 60);
    const seconds = safeDuration % 60;

    return `${minutes.toString().padStart(2, "0")}:${seconds
        .toString()
        .padStart(2, "0")}`;
};

const formatParticipantSummary = (participantCount = 0) => {
    const safeCount = Math.max(0, Number(participantCount) || 0);

    if (safeCount === 0) {
        return "No one else is connected yet";
    }

    if (safeCount === 1) {
        return "1 person is connected";
    }

    return `${safeCount} people are connected`;
};

const LiveInviteScreen = () => {
    const router = useRouter();
    const params = useLocalSearchParams();
    const inviteCode = String(params.inviteCode || "");
    const { showToast } = useToast();
    const currentUser = useAuthStore((state) => state.user);

    const [preview, setPreview] = useState(null);
    const [displayName, setDisplayName] = useState(currentUser?.name || "Guest");
    const [audioMuted, setAudioMuted] = useState(false);
    const [videoMuted, setVideoMuted] = useState(false);
    const [loading, setLoading] = useState(true);
    const [joining, setJoining] = useState(false);
    const [joinPayload, setJoinPayload] = useState(null);
    const [joinState, setJoinState] = useState("lobby");
    const [sessionSummary, setSessionSummary] = useState(null);
    const [error, setError] = useState(null);

    const hostName = preview?.owner_name || "Host";
    const lobbyStatusLabel = preview?.is_live ? "Live now" : "Waiting for host";
    const lobbyStatusClasses = preview?.is_live
        ? "bg-success/15 border-success/30"
        : "bg-warning/15 border-warning/30";
    const lobbyStatusTextClasses = preview?.is_live ? "text-success" : "text-warning";

    const loadPreview = useCallback(async () => {
        if (!inviteCode) {
            setError("Missing invite code");
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            const response = await apiService.getRtcInviteSession(inviteCode);
            setPreview(response);
        } catch (loadError) {
            Logger.error("Failed to load live invite:", loadError);
            setError(loadError?.message || "Could not load this live session");
        } finally {
            setLoading(false);
        }
    }, [inviteCode]);

    useEffect(() => {
        loadPreview();
    }, [loadPreview]);

    const handleJoin = async () => {
        try {
            setJoining(true);
            setError(null);
            const response = await apiService.joinRtcByInvite({
                invite_code: inviteCode,
                display_name: displayName.trim() || currentUser?.name || "Guest",
                role: "guest",
            });
            setJoinPayload(response);
            setSessionSummary(null);
            setJoinState("joining");
        } catch (joinError) {
            Logger.error("Failed to join live invite:", joinError);
            setError(joinError?.message || "Could not join this live session");
            showToast(joinError?.message || "Could not join this live session", "error");
        } finally {
            setJoining(false);
        }
    };

    const handleRoomLeave = (summary = {}) => {
        Logger.info("[RTC] Guest HmsRoom onLeave received", {
            summary,
            inviteCode,
            roomName: joinPayload?.room_name,
        });
        setSessionSummary(summary);
        setJoinState("ended");
    };

    if (loading) {
        return (
            <SafeAreaView className="flex-1 bg-background items-center justify-center">
                <ActivityIndicator size="large" color={COLORS.primary} />
                <Text className="text-text-secondary mt-4">Loading live session…</Text>
            </SafeAreaView>
        );
    }

    if (error && joinState === "lobby") {
        return (
            <SafeAreaView className="flex-1 bg-background items-center justify-center px-6">
                <Text className="text-error text-center mb-4">{error}</Text>
                <TouchableOpacity
                    onPress={() => router.back()}
                    className="bg-primary px-5 py-3 rounded-lg"
                >
                    <Text className="text-white font-semibold">Close</Text>
                </TouchableOpacity>
            </SafeAreaView>
        );
    }

    if (joinPayload && joinState !== "lobby") {
        if (joinState === "ended") {
            const participantCount = sessionSummary?.participantCount || 1;
            const hasSessionSummary = typeof sessionSummary?.durationSeconds === "number";
            const recordingStatus = hasSessionSummary
                ? "Recording processing"
                : "Session ended";
            const sessionStatusDetail = hasSessionSummary
                ? `${hostName} will receive the finished recording after processing.`
                : `${hostName} ended the live session before a recording summary was available.`;

            return (
                <SafeAreaView className="flex-1 bg-background px-6 pt-6">
                    <View className="flex-row items-center mb-8">
                        <TouchableOpacity
                            onPress={() => router.back()}
                            hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
                            accessibilityRole="button"
                            accessibilityLabel="Close session summary"
                        >
                            <Ionicons name="close" size={24} color={COLORS.text.primary} />
                        </TouchableOpacity>
                        <Text className="text-text-primary text-xl font-semibold ml-4">
                            Session Summary
                        </Text>
                    </View>

                    <View className="items-center mb-6">
                        <View className="w-16 h-16 rounded-full bg-success/20 items-center justify-center mb-4">
                            <Ionicons
                                name="checkmark-circle"
                                size={34}
                                color={COLORS.success}
                            />
                        </View>
                        <Text className="text-2xl font-bold text-text-primary text-center">
                            Thanks for joining
                        </Text>
                        <Text className="text-text-secondary text-center mt-2">
                            {`You joined ${hostName}'s ${joinPayload.media_mode === "video" ? "video" : "audio"} session.`}
                        </Text>
                        <View className="mt-4 px-3 py-2 rounded-full border border-success/30 bg-success/15">
                            <Text className="text-success font-semibold">Session ended</Text>
                        </View>
                    </View>

                    <View className="bg-panel rounded-lg p-4 mb-6 border border-border">
                        <Text className="text-text-primary font-semibold mb-3">
                            Live Session Details
                        </Text>
                        <View className="flex-row items-center justify-between py-2 border-b border-border">
                            <Text className="text-text-secondary">Host</Text>
                            <Text className="text-text-primary font-medium flex-1 text-right ml-4">
                                {hostName}
                            </Text>
                        </View>
                        <View className="flex-row items-center justify-between py-2 border-b border-border">
                            <Text className="text-text-secondary">Room</Text>
                            <Text className="text-text-primary font-medium flex-1 text-right ml-4">
                                {joinPayload.room_name || "Live session"}
                            </Text>
                        </View>
                        <View className="flex-row items-center justify-between py-2 border-b border-border">
                            <Text className="text-text-secondary">Recording status</Text>
                            <Text className="text-text-primary font-medium">
                                {recordingStatus}
                            </Text>
                        </View>
                        <View className="flex-row items-center justify-between py-2 border-b border-border">
                            <Text className="text-text-secondary">Duration</Text>
                            <Text className="text-text-primary font-medium">
                                {formatSessionDuration(sessionSummary?.durationSeconds)}
                            </Text>
                        </View>
                        <View className="flex-row items-center justify-between py-2 border-b border-border">
                            <Text className="text-text-secondary">Format</Text>
                            <Text className="text-text-primary font-medium">
                                {joinPayload.media_mode === "video" ? "Video" : "Audio"}
                            </Text>
                        </View>
                        <View className="flex-row items-center justify-between pt-2">
                            <Text className="text-text-secondary">Participants</Text>
                            <Text className="text-text-primary font-medium">
                                {participantCount}
                            </Text>
                        </View>
                    </View>

                    <View className="rounded-lg p-4 mb-6 bg-primary/10 border border-primary/20">
                        <Text className="text-primary text-center font-semibold mb-2">
                            {sessionStatusDetail}
                        </Text>
                        <Text className="text-text-secondary text-center">
                            Invite code: {joinPayload.invite_code || preview?.invite_code || inviteCode}
                        </Text>
                    </View>

                    <TouchableOpacity
                        onPress={() => router.back()}
                        className="bg-primary py-4 rounded-lg"
                    >
                        <Text className="text-white text-center font-semibold text-base">
                            Done
                        </Text>
                    </TouchableOpacity>
                </SafeAreaView>
            );
        }

        return (
            <SafeAreaView className="flex-1 bg-background px-6 pt-6">
                <Text className="text-2xl font-bold text-text-primary text-center mb-4">
                    {joinPayload.title}
                </Text>
                <Text className="text-text-secondary text-center mb-4">
                    {joinState === "live" ? "Connected" : "Joining room..."}
                </Text>

                <HmsRoom
                    token={joinPayload.token}
                    roomName={joinPayload.room_name}
                    userName={displayName.trim() || currentUser?.name || "Guest"}
                    enableVideo={joinPayload.media_mode === "video"}
                    startAudioMuted={audioMuted}
                    startVideoMuted={videoMuted}
                    onJoin={() => setJoinState("live")}
                    onClose={() => router.back()}
                    onError={(message) => {
                        setError(message);
                        showToast(message, "error");
                    }}
                    onLeave={handleRoomLeave}
                />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView className="flex-1 bg-background">
            <ScrollView className="flex-1 px-6 pt-6">
                <View className="flex-row items-center mb-6">
                    <TouchableOpacity
                        onPress={() => router.back()}
                        hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
                        accessibilityRole="button"
                        accessibilityLabel="Go back"
                    >
                        <Ionicons name="arrow-back" size={24} color={COLORS.text.primary} />
                    </TouchableOpacity>
                    <Text className="text-text-primary text-xl font-semibold ml-4">
                        Join Live Session
                    </Text>
                </View>

                <View className="bg-panel rounded-2xl p-4 mb-4 border border-border">
                    <Text className="text-text-primary text-lg font-semibold mb-2">
                        {preview?.title}
                    </Text>
                    <View className={`self-start px-3 py-1 rounded-full border mb-3 ${lobbyStatusClasses}`}>
                        <Text className={`font-semibold ${lobbyStatusTextClasses}`}>
                            {lobbyStatusLabel}
                        </Text>
                    </View>
                    <Text className="text-text-secondary mb-1">
                        Host: {hostName}
                    </Text>
                    <Text className="text-text-secondary mb-1">
                        Format: {preview?.media_mode === "video" ? "Video" : "Audio"}
                    </Text>
                    <Text className="text-text-secondary mb-1">
                        {formatParticipantSummary(preview?.participant_count)}
                    </Text>
                    <Text className="text-text-secondary">
                        Invite code: {preview?.invite_code}
                    </Text>
                </View>

                <View className="bg-card rounded-2xl p-4 mb-4 border border-border">
                    <Text className="text-text-primary font-semibold mb-2">
                        Your Display Name
                    </Text>
                    <TextInput
                        className="bg-panel rounded-lg px-4 py-3 text-text-primary border border-border"
                        placeholder="How should others see you?"
                        placeholderTextColor="#888"
                        value={displayName}
                        onChangeText={setDisplayName}
                    />
                </View>

                <View className="bg-card rounded-2xl p-4 mb-6 border border-border">
                    <Text className="text-text-primary font-semibold mb-3">
                        Join Defaults
                    </Text>
                    <TouchableOpacity
                        onPress={() => setAudioMuted((prev) => !prev)}
                        className="flex-row items-center justify-between py-3 border-b border-border"
                    >
                        <Text className="text-text-primary">
                            Start with microphone {audioMuted ? "off" : "on"}
                        </Text>
                        <Ionicons
                            name={audioMuted ? "mic-off" : "mic"}
                            size={20}
                            color={audioMuted ? COLORS.error : COLORS.text.primary}
                        />
                    </TouchableOpacity>

                    {preview?.media_mode === "video" && (
                        <TouchableOpacity
                            onPress={() => setVideoMuted((prev) => !prev)}
                            className="flex-row items-center justify-between py-3"
                        >
                            <Text className="text-text-primary">
                                Start with camera {videoMuted ? "off" : "on"}
                            </Text>
                            <Ionicons
                                name={videoMuted ? "videocam-off" : "videocam"}
                                size={20}
                                color={videoMuted ? COLORS.error : COLORS.text.primary}
                            />
                        </TouchableOpacity>
                    )}
                </View>

                <TouchableOpacity
                    onPress={handleJoin}
                    disabled={joining}
                    className="bg-primary py-4 rounded-lg mb-8"
                >
                    {joining ? (
                        <ActivityIndicator size="small" color="#fff" />
                    ) : (
                        <Text className="text-white text-center font-semibold text-base">
                            Join as Guest
                        </Text>
                    )}
                </TouchableOpacity>
            </ScrollView>
        </SafeAreaView>
    );
};

export default LiveInviteScreen;