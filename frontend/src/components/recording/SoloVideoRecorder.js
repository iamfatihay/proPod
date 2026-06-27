import React, { useRef, useState, useEffect, useCallback } from "react";
import { View, Text, TouchableOpacity, Platform } from "react-native";
import { CameraView, useCameraPermissions, useMicrophonePermissions } from "expo-camera";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../../constants/theme";

const formatDuration = (seconds) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
};

const SoloVideoRecorder = ({ onRecordingStop, onClose, disabled }) => {
    const cameraRef = useRef(null);
    const timerRef = useRef(null);
    const durationRef = useRef(0);

    const [cameraPermission, requestCameraPermission] = useCameraPermissions();
    const [micPermission, requestMicPermission] = useMicrophonePermissions();

    const [facing, setFacing] = useState("front");
    const [isMicMuted, setIsMicMuted] = useState(false);
    const [isCameraOff, setIsCameraOff] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [duration, setDuration] = useState(0);
    const [permissionsGranted, setPermissionsGranted] = useState(false);

    useEffect(() => {
        (async () => {
            const cam = cameraPermission?.granted ? cameraPermission : await requestCameraPermission();
            const mic = micPermission?.granted ? micPermission : await requestMicPermission();
            setPermissionsGranted(cam?.granted && mic?.granted);
        })();
    }, []);

    const startTimer = useCallback(() => {
        durationRef.current = 0;
        setDuration(0);
        timerRef.current = setInterval(() => {
            durationRef.current += 1;
            setDuration(durationRef.current);
        }, 1000);
    }, []);

    const stopTimer = useCallback(() => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
    }, []);

    useEffect(() => () => stopTimer(), [stopTimer]);

    const handleStartRecording = useCallback(async () => {
        if (!cameraRef.current || isRecording || disabled) return;
        setIsRecording(true);
        startTimer();
        try {
            // recordAsync resolves when stopRecording() is called
            const result = await cameraRef.current.recordAsync({
                maxDuration: 3600,
                // 720p at 1 Mbps: ~7.5 MB/min, good quality for podcast talking-head video
                quality: "720p",
                videoBitrate: 1000000,
            });
            stopTimer();
            setIsRecording(false);
            if (result?.uri) {
                onRecordingStop && onRecordingStop(result.uri, durationRef.current);
            }
        } catch {
            stopTimer();
            setIsRecording(false);
        }
    }, [isRecording, disabled, startTimer, stopTimer, onRecordingStop]);

    const handleStopRecording = useCallback(() => {
        if (!cameraRef.current || !isRecording) return;
        cameraRef.current.stopRecording();
    }, [isRecording]);

    const toggleFacing = useCallback(() => {
        setFacing((prev) => (prev === "front" ? "back" : "front"));
    }, []);

    if (!permissionsGranted) {
        return (
            <View className="flex-1 items-center justify-center bg-background px-8">
                <Ionicons name="videocam-off" size={48} color={COLORS.text.secondary} />
                <Text className="text-text-primary text-lg font-semibold mt-4 text-center">
                    Camera & Microphone Access Needed
                </Text>
                <Text className="text-text-secondary text-center mt-2">
                    Allow camera and microphone permissions to record video podcasts.
                </Text>
                <TouchableOpacity
                    onPress={async () => {
                        const cam = await requestCameraPermission();
                        const mic = await requestMicPermission();
                        setPermissionsGranted(cam?.granted && mic?.granted);
                    }}
                    className="mt-6 bg-primary px-6 py-3 rounded-full"
                >
                    <Text className="text-white font-semibold">Grant Permissions</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View className="flex-1 bg-black">
            {isCameraOff ? (
                <View style={{ flex: 1 }} className="bg-black items-center justify-center">
                    <Ionicons name="videocam-off" size={48} color="#666" />
                    <Text style={{ color: "#666", marginTop: 8 }}>Camera is off</Text>
                </View>
            ) : (
                <CameraView
                    ref={cameraRef}
                    style={{ flex: 1 }}
                    facing={facing}
                    mode="video"
                    mute={isMicMuted}
                />
            )}

            {/* Top bar: duration left | camera-toggle + close right */}
            <View
                style={{ position: "absolute", top: 0, left: 0, right: 0 }}
                className="flex-row items-center justify-between px-5 pt-12 pb-4"
            >
                {isRecording ? (
                    <View className="flex-row items-center bg-black/50 px-3 py-1 rounded-full">
                        <View className="w-2 h-2 rounded-full bg-error mr-2" />
                        <Text className="text-white font-semibold text-sm">
                            {formatDuration(duration)}
                        </Text>
                    </View>
                ) : (
                    <View />
                )}

                <View className="flex-row items-center" style={{ gap: 8 }}>
                    {/* Camera on/off toggle — disabled while recording to prevent unmounting CameraView during recordAsync */}
                    <TouchableOpacity
                        onPress={() => !isRecording && setIsCameraOff((prev) => !prev)}
                        className="w-9 h-9 rounded-full items-center justify-center"
                        style={{
                            backgroundColor: isCameraOff ? "rgba(239,68,68,0.6)" : "rgba(0,0,0,0.5)",
                            opacity: isRecording ? 0.4 : 1,
                        }}
                    >
                        <Ionicons name={isCameraOff ? "videocam-off" : "videocam"} size={18} color="white" />
                    </TouchableOpacity>

                    {!isRecording && (
                        <TouchableOpacity
                            onPress={onClose}
                            className="bg-black/50 w-9 h-9 rounded-full items-center justify-center"
                        >
                            <Ionicons name="close" size={20} color="white" />
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {/* Bottom controls: flip | RECORD | mic  (3 buttons, record naturally centered) */}
            <View
                style={{ position: "absolute", bottom: 0, left: 0, right: 0 }}
                className="flex-row items-center justify-around px-8 pb-12 pt-6 bg-black/40"
            >
                {/* Flip camera */}
                <TouchableOpacity
                    onPress={toggleFacing}
                    disabled={isRecording || isCameraOff}
                    className="w-12 h-12 rounded-full bg-white/20 items-center justify-center"
                    style={{ opacity: (isRecording || isCameraOff) ? 0.4 : 1 }}
                >
                    <Ionicons name="camera-reverse" size={22} color="white" />
                </TouchableOpacity>

                {/* Record / Stop button */}
                <TouchableOpacity
                    onPress={isRecording ? handleStopRecording : handleStartRecording}
                    disabled={disabled}
                    className="w-20 h-20 rounded-full items-center justify-center"
                    style={{ backgroundColor: isRecording ? "#fff" : COLORS.error }}
                >
                    {isRecording ? (
                        <View
                            style={{
                                width: 28,
                                height: 28,
                                borderRadius: 6,
                                backgroundColor: COLORS.error,
                            }}
                        />
                    ) : (
                        <View className="w-6 h-6 rounded-full bg-white" />
                    )}
                </TouchableOpacity>

                {/* Mic mute */}
                <TouchableOpacity
                    onPress={() => setIsMicMuted((prev) => !prev)}
                    className="w-12 h-12 rounded-full bg-white/20 items-center justify-center"
                >
                    <Ionicons
                        name={isMicMuted ? "mic-off" : "mic"}
                        size={22}
                        color={isMicMuted ? COLORS.error : "white"}
                    />
                </TouchableOpacity>
            </View>
        </View>
    );
};

export default SoloVideoRecorder;
