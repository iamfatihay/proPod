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
    const [error, setError] = useState(null);

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
            setJoinState("joining");
        } catch (joinError) {
            Logger.error("Failed to join live invite:", joinError);
            setError(joinError?.message || "Could not join this live session");
            showToast(joinError?.message || "Could not join this live session", "error");
        } finally {
            setJoining(false);
        }
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
                    onError={(message) => {
                        setError(message);
                        showToast(message, "error");
                    }}
                    onLeave={() => router.back()}
                />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView className="flex-1 bg-background">
            <ScrollView className="flex-1 px-6 pt-6">
                <View className="flex-row items-center mb-6">
                    <TouchableOpacity onPress={() => router.back()}>
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
                    <Text className="text-text-secondary mb-1">
                        Host: {preview?.owner_name}
                    </Text>
                    <Text className="text-text-secondary mb-1">
                        Format: {preview?.media_mode === "video" ? "Video" : "Audio"}
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